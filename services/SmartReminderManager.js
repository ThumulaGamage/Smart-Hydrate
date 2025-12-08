// services/SmartReminderManager.js - Automatic hydration reminder system

import * as Notifications from 'expo-notifications';
import { ref, onValue, get, update, getDatabase } from 'firebase/database';
import { auth } from '../config/firebaseConfig';

class SmartReminderManager {
  constructor() {
    this.userId = null;
    this.activeReminder = null;
    this.unsubscribers = [];
    this.lastCheckTimestamp = null;
    this.reminderInterval = null;
    this.database = null;
    
    console.log('🧠 SmartReminderManager initialized');
  }

  // Initialize database connection
  initializeDatabase() {
    if (!this.database && auth?.app) {
      try {
        this.database = getDatabase(auth.app);
        console.log('✅ Database initialized in SmartReminderManager');
      } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        throw error;
      }
    }
    return this.database;
  }

  // Initialize for a user
  async initialize(userId) {
    try {
      // Ensure database is initialized first
      this.initializeDatabase();
      
      if (!this.database) {
        throw new Error('Database not initialized');
      }

      this.cleanup();
      this.userId = userId;
      
      console.log('🔧 Initializing SmartReminderManager for user:', userId);
      
      // Start monitoring user's hydration plan and intake
      await this.startMonitoring();
    } catch (error) {
      console.error('❌ Failed to initialize SmartReminderManager:', error);
      throw error;
    }
  }

  // Start monitoring user's hydration data
  async startMonitoring() {
    if (!this.userId || !this.database) {
      console.warn('⚠️ Cannot start monitoring - missing userId or database');
      return;
    }

    try {
      // Listen to user profile (for hydration plan settings)
      const profileRef = ref(this.database, `users/${this.userId}/profile`);
      const profileUnsubscribe = onValue(profileRef, (snapshot) => {
        if (snapshot.exists()) {
          const profile = snapshot.val();
          console.log('👤 Profile updated:', {
            dailyGoal: profile.dailyGoal,
            reminderGap: profile.reminderGap,
            notificationsEnabled: profile.notificationsEnabled
          });
          
          // Restart reminder system with new settings
          this.setupAutomaticReminders(profile);
        }
      }, (error) => {
        console.error('❌ Error listening to profile:', error);
      });

      // Listen to disease profile if exists
      const diseaseProfileRef = ref(this.database, `users/${this.userId}/diseaseProfile`);
      const diseaseUnsubscribe = onValue(diseaseProfileRef, (snapshot) => {
        if (snapshot.exists()) {
          const diseaseProfile = snapshot.val();
          console.log('💊 Disease profile updated:', {
            dailyGoal: diseaseProfile.dailyGoal,
            reminderGap: diseaseProfile.reminderGap,
            notificationsEnabled: diseaseProfile.notificationsEnabled
          });
          
          // If disease profile exists and is enabled, it takes priority
          if (diseaseProfile.notificationsEnabled) {
            this.setupAutomaticReminders(diseaseProfile, true);
          }
        }
      }, (error) => {
        console.error('❌ Error listening to disease profile:', error);
      });

      this.unsubscribers.push(profileUnsubscribe, diseaseUnsubscribe);
      console.log('✅ Started monitoring user data');
    } catch (error) {
      console.error('❌ Error in startMonitoring:', error);
      throw error;
    }
  }

  // Setup automatic reminder system based on plan
  setupAutomaticReminders(profile, isMedical = false) {
    // Clear existing reminders
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
    }

    if (!profile.notificationsEnabled || !profile.reminderGap) {
      console.log('⏸️ Reminders disabled or no gap set');
      return;
    }

    const gapHours = profile.reminderGap;
    const dailyGoal = profile.dailyGoal || 2000;
    const intakePerReminder = Math.floor(dailyGoal / (16 / gapHours)); // 16 waking hours

    console.log(`⏰ Setting up automatic ${isMedical ? 'MEDICAL' : 'healthy'} reminders:`, {
      gap: `${gapHours} hours`,
      intakePerReminder: `${intakePerReminder}ml`,
      dailyGoal: `${dailyGoal}ml`
    });

    // Store reminder config
    this.activeReminder = {
      gapHours,
      dailyGoal,
      intakePerReminder,
      isMedical,
      conditionName: profile.diseaseName || null
    };

    // Check immediately
    this.checkAndNotify();

    // Then check at the specified interval
    const intervalMs = gapHours * 60 * 60 * 1000; // Convert hours to milliseconds
    this.reminderInterval = setInterval(() => {
      this.checkAndNotify();
    }, intervalMs);

    console.log(`✅ Automatic reminders running every ${gapHours} hours`);
  }

  // Check if user needs reminder and send notification
  async checkAndNotify() {
    if (!this.userId || !this.activeReminder || !this.database) {
      console.warn('⚠️ Cannot check reminder - missing data');
      return;
    }

    console.log('🔍 Checking if user needs reminder...');

    try {
      const { gapHours, intakePerReminder, isMedical, conditionName } = this.activeReminder;
      
      // Get user's intake for the current interval
      const intakeInInterval = await this.getIntakeForCurrentInterval(gapHours);
      
      console.log(`📊 Interval check (last ${gapHours}h):`, {
        requiredIntake: `${intakePerReminder}ml`,
        actualIntake: `${intakeInInterval}ml`,
        needsReminder: intakeInInterval < intakePerReminder
      });

      // Check if user has drunk enough in this interval
      if (intakeInInterval < intakePerReminder) {
        // User hasn't drunk enough - send reminder
        const deficit = intakePerReminder - intakeInInterval;
        
        console.log(`⚠️ User needs reminder! Deficit: ${deficit}ml`);
        
        await this.sendSmartReminder({
          required: intakePerReminder,
          consumed: intakeInInterval,
          deficit,
          isMedical,
          conditionName
        });
      } else {
        console.log('✅ User is on track! No reminder needed.');
      }

    } catch (error) {
      console.error('❌ Error checking reminder:', error);
    }
  }

  // Get user's water intake for the current interval period
  async getIntakeForCurrentInterval(gapHours) {
    if (!this.database) {
      console.error('❌ Database not initialized');
      return 0;
    }

    try {
      const now = Date.now();
      const intervalStart = now - (gapHours * 60 * 60 * 1000);

      // Get today's date key
      const today = new Date().toISOString().split('T')[0];
      
      // Get drinking events for today
      const eventsRef = ref(this.database, `users/${this.userId}/drinkingEvents/${today}`);
      const snapshot = await get(eventsRef);

      if (!snapshot.exists()) {
        console.log('📊 No drinking events found for today');
        return 0;
      }

      const events = snapshot.val();
      let totalIntake = 0;

      // Sum up intake from events within the interval
      Object.values(events).forEach(event => {
        const eventTime = event.timestamp?.toDate ? event.timestamp.toDate().getTime() : event.timestamp;
        
        if (eventTime >= intervalStart && eventTime <= now) {
          totalIntake += event.amount || 0;
        }
      });

      console.log(`💧 Total intake in last ${gapHours}h: ${totalIntake}ml`);
      return totalIntake;

    } catch (error) {
      console.error('❌ Error getting interval intake:', error);
      return 0;
    }
  }

  // Send smart reminder notification
  async sendSmartReminder({ required, consumed, deficit, isMedical, conditionName }) {
    try {
      const title = isMedical ? '💊 Medical Hydration Reminder' : '💧 Hydration Reminder';
      
      let body;
      if (consumed === 0) {
        // User hasn't drunk anything
        body = isMedical && conditionName
          ? `⚕️ ${conditionName}: Please drink ${required}ml as prescribed.`
          : `Time to drink ${required}ml of water! Stay hydrated! 🌊`;
      } else {
        // User has drunk some, but not enough
        body = isMedical && conditionName
          ? `⚕️ ${conditionName}: You drank ${consumed}ml. Please drink ${deficit}ml more to meet your target.`
          : `You drank ${consumed}ml. Drink ${deficit}ml more to stay on track! 💪`;
      }

      // Send push notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: isMedical 
            ? Notifications.AndroidNotificationPriority.MAX
            : Notifications.AndroidNotificationPriority.HIGH,
          data: {
            type: isMedical ? 'medical_reminder' : 'hydration_reminder',
            required,
            consumed,
            deficit,
            timestamp: Date.now(),
            condition: conditionName
          },
        },
        trigger: null, // Send immediately
      });

      console.log(`📢 Smart reminder sent: ${title}`);
      console.log(`📝 Message: ${body}`);

    } catch (error) {
      console.error('❌ Error sending smart reminder:', error);
    }
  }

  // Cleanup
  cleanup() {
    console.log('🧹 Cleaning up SmartReminderManager');
    
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
    }

    this.unsubscribers.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('⚠️ Error unsubscribing:', error);
        }
      }
    });
    this.unsubscribers = [];

    this.activeReminder = null;
    this.userId = null;
  }
}

// Singleton instance
let smartReminderManager = null;

export const getSmartReminderManager = () => {
  if (!smartReminderManager) {
    smartReminderManager = new SmartReminderManager();
  }
  return smartReminderManager;
};

export default SmartReminderManager;