import { useEffect, useRef } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { auth } from '../../config/firebaseConfig';

// Graceful notification import
let Notifications = null;
let notificationsAvailable = false;

try {
  Notifications = require('expo-notifications');
  notificationsAvailable = true;
  
  // Configure notification handler globally with updated API
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,  // Keep for backwards compatibility
      shouldShowBanner: true, // New API: Show as banner
      shouldShowList: true,   // New API: Show in notification list
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  console.log('✅ Notification service loaded');
} catch (error) {
  console.log('⚠️ Notifications not available in app');
}

// Initialize database
let database;
try {
  const { getDatabase } = require('firebase/database');
  database = getDatabase(auth.app);
} catch (e) {
  console.error("Failed to initialize database:", e);
}

const WAKING_HOURS = 16;

/**
 * Hook to initialize and manage app-wide push notifications
 * Call this at the root level of your app (in _layout.tsx)
 */
export const useNotificationService = () => {
  const isInitializedRef = useRef(false);
  const unsubscribersRef = useRef([]);
  const sentAlertsRef = useRef(new Set()); // Track sent alerts
  const lastAlertTimeRef = useRef({}); // Track last alert time for each type

  // Request permissions on mount
  useEffect(() => {
    if (!notificationsAvailable) return;

    const requestPermissions = async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus === 'granted') {
          console.log('✅ Notification permissions granted at app level');
        } else {
          console.log('⚠️ Notification permissions denied');
        }
      } catch (error) {
        console.error('Error requesting notification permissions:', error);
      }
    };

    requestPermissions();
  }, []);

  // Listen to auth state and initialize notifications
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      // Cleanup previous subscriptions
      unsubscribersRef.current.forEach(unsub => unsub());
      unsubscribersRef.current = [];

      if (user && user.uid) {
        console.log('🔔 User logged in, initializing notifications for:', user.uid);
        await initializeUserNotifications(user.uid);
        isInitializedRef.current = true;
      } else {
        console.log('🔕 User logged out, cancelling all notifications');
        isInitializedRef.current = false;
        
        // Clear alert tracking on logout
        sentAlertsRef.current.clear();
        lastAlertTimeRef.current = {};
        
        // Cancel all notifications on logout
        if (notificationsAvailable) {
          await Notifications.cancelAllScheduledNotificationsAsync();
        }
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribersRef.current.forEach(unsub => unsub());
    };
  }, []);

  const initializeUserNotifications = async (userId) => {
    if (!notificationsAvailable || !database) {
      console.log('⚠️ Cannot initialize notifications - service not available');
      return;
    }

    try {
      let masterEnabled = true;
      let healthyProfile = null;
      let diseaseProfile = null;
      let lastSensorCheck = Date.now();

      // Listen to settings for master toggle
      const settingsRef = ref(database, `users/${userId}/settings`);
      const unsubSettings = onValue(settingsRef, async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const newMasterEnabled = data.pushNotifications !== false;
          
          if (newMasterEnabled !== masterEnabled) {
            masterEnabled = newMasterEnabled;
            
            if (!masterEnabled) {
              await Notifications.cancelAllScheduledNotificationsAsync();
              console.log('🔕 Notifications disabled by user settings');
            } else {
              await scheduleAllNotifications(userId, healthyProfile, diseaseProfile, masterEnabled);
            }
          }
        } else {
          masterEnabled = true;
        }
      });
      unsubscribersRef.current.push(unsubSettings);

      // Listen to healthy profile
      const healthyProfileRef = ref(database, `users/${userId}/profile`);
      const unsubHealthy = onValue(healthyProfileRef, async (snapshot) => {
        if (snapshot.exists()) {
          healthyProfile = snapshot.val();
          await scheduleAllNotifications(userId, healthyProfile, diseaseProfile, masterEnabled);
        }
      });
      unsubscribersRef.current.push(unsubHealthy);

      // Listen to disease profile
      const diseaseProfileRef = ref(database, `users/${userId}/diseaseProfile`);
      const unsubDisease = onValue(diseaseProfileRef, async (snapshot) => {
        if (snapshot.exists()) {
          diseaseProfile = snapshot.val();
          await scheduleAllNotifications(userId, healthyProfile, diseaseProfile, masterEnabled);
        }
      });
      unsubscribersRef.current.push(unsubDisease);

    } catch (error) {
      console.error('❌ Error initializing user notifications:', error);
    }
  };

  const scheduleAllNotifications = async (userId, healthyProfile, diseaseProfile, masterEnabled) => {
    if (!notificationsAvailable || !masterEnabled) return;

    try {
      // Cancel existing notifications first
      await Notifications.cancelAllScheduledNotificationsAsync();

      let scheduled = 0;

      // Schedule healthy hydration notifications
      if (healthyProfile?.notificationsEnabled && healthyProfile?.dailyGoal > 0 && healthyProfile?.reminderGap > 0) {
        const success = await scheduleHealthyNotifications(
          healthyProfile.reminderGap,
          healthyProfile.dailyGoal,
          userId
        );
        if (success) scheduled++;
      }

      // Schedule disease hydration notifications
      if (diseaseProfile?.notificationsEnabled && diseaseProfile?.dailyGoal > 0 && 
          diseaseProfile?.reminderGap > 0 && diseaseProfile?.diseaseName) {
        const success = await scheduleDiseaseNotifications(
          diseaseProfile.reminderGap,
          diseaseProfile.dailyGoal,
          diseaseProfile.diseaseName,
          userId
        );
        if (success) scheduled++;
      }

      if (scheduled > 0) {
        console.log(`✅ Scheduled ${scheduled} notification plan(s) automatically`);
      }
    } catch (error) {
      console.error('❌ Error scheduling notifications:', error);
    }
  };

  const calculateIntake = (goal, gap) => {
    if (!goal || !gap || goal <= 0 || gap <= 0) return 0;
    const numberOfReminders = Math.floor(WAKING_HOURS / gap);
    return Math.ceil((goal / numberOfReminders) / 10) * 10;
  };

  const scheduleHealthyNotifications = async (gapHours, dailyGoal, userId) => {
    if (!notificationsAvailable) return false;

    try {
      const gapInSeconds = gapHours * 60 * 60;
      const numberOfReminders = Math.floor(WAKING_HOURS / gapHours);
      const intakeAmount = calculateIntake(dailyGoal, gapHours);

      const nextTime = new Date().getTime() + (gapInSeconds * 1000);

      for (let i = 0; i < numberOfReminders; i++) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '💧 Hydration Reminder',
            body: `Time to drink ${intakeAmount}ml of water! Stay hydrated! 🌊`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            data: {
              type: 'hydration_reminder',
              amount: intakeAmount,
              reminderNumber: i + 1,
            },
          },
          trigger: {
            seconds: gapInSeconds * (i + 1),
            repeats: false,
          },
        });
      }

      // Update Firebase with next reminder time
      if (database) {
        await update(ref(database, `users/${userId}/profile`), {
          nextReminderTime: nextTime,
          lastScheduledAt: Date.now(),
        });
      }

      console.log(`✅ Scheduled ${numberOfReminders} healthy hydration notifications`);
      return true;
    } catch (error) {
      console.error('❌ Error scheduling healthy notifications:', error);
      return false;
    }
  };

  const scheduleDiseaseNotifications = async (gapHours, dailyGoal, diseaseName, userId) => {
    if (!notificationsAvailable) return false;

    try {
      const gapInSeconds = gapHours * 60 * 60;
      const numberOfReminders = Math.floor(WAKING_HOURS / gapHours);
      const intakeAmount = calculateIntake(dailyGoal, gapHours);

      const nextTime = new Date().getTime() + (gapInSeconds * 1000);

      for (let i = 0; i < numberOfReminders; i++) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '💊 Medical Hydration Reminder',
            body: `⚕️ ${diseaseName}: Time to drink ${intakeAmount}ml of water as prescribed. 💧`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            data: {
              type: 'disease_hydration_reminder',
              amount: intakeAmount,
              condition: diseaseName,
              medicalAlert: true,
            },
          },
          trigger: {
            seconds: gapInSeconds * (i + 1),
            repeats: false,
          },
        });
      }

      // Update Firebase with next reminder time
      if (database) {
        await update(ref(database, `users/${userId}/diseaseProfile`), {
          nextReminderTime: nextTime,
          lastScheduledAt: Date.now(),
        });
      }

      console.log(`✅ Scheduled ${numberOfReminders} disease hydration notifications`);
      return true;
    } catch (error) {
      console.error('❌ Error scheduling disease notifications:', error);
      return false;
    }
  };
};

export default useNotificationService;