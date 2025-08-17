// src/services/IntakeTracker.js
// Water Intake Detection and Notification System

import { Alert, AppState, Platform } from 'react-native';
import PushNotification from 'react-native-push-notification';

export class IntakeTracker {
  constructor(waterBottleService, bleService) {
    this.waterBottleService = waterBottleService;
    this.bleService = bleService;
    
    // Intake tracking state
    this.previousWaterLevel = null;
    this.previousTemperature = null;
    this.lastDrinkTime = null;
    this.bottleCapacity = 1000; // ml - configurable
    this.isTracking = false;
    
    // Notification settings
    this.notificationSettings = {
      drinkReminders: true,
      lowWaterAlerts: true,
      goalAchievements: true,
      deviceAlerts: true,
      quietHours: { start: 22, end: 7 }, // 10PM - 7AM
      reminderInterval: 2 * 60 * 60 * 1000, // 2 hours in ms
    };
    
    // State tracking
    this.currentDayStats = null;
    this.lastNotificationTime = {};
    this.connectionStatus = 'disconnected';
    this.deviceData = null;
    
    this.setupNotifications();
    this.setupAppStateTracking();
  }

  // ======================
  // INITIALIZATION
  // ======================

  async initialize(userId, bottleCapacity = 1000) {
    try {
      this.bottleCapacity = bottleCapacity;
      
      // Set up BLE data listener
      this.bleService.setCallbacks({
        onDataReceived: (data) => this.handleBLEData(data),
        onConnectionChange: (state) => this.handleConnectionChange(state),
        onError: (error) => this.handleBLEError(error)
      });

      // Set up daily stats listener
      this.unsubscribeStats = this.waterBottleService.onTodayStats((stats) => {
        this.currentDayStats = stats;
        this.checkGoalNotifications(stats);
      });

      // Get initial water level
      const latestReading = await this.waterBottleService.getLatestReading();
      if (latestReading) {
        this.previousWaterLevel = latestReading.waterLevel;
        this.previousTemperature = latestReading.temperature;
      }

      this.isTracking = true;
      console.log('✅ Intake tracker initialized');
      
      // Schedule periodic reminders
      this.schedulePeriodicReminders();
      
    } catch (error) {
      console.error('❌ Error initializing intake tracker:', error);
    }
  }

  // ======================
  // BLE DATA PROCESSING
  // ======================

  async handleBLEData(data) {
    try {
      console.log('📊 Processing BLE data:', data);
      
      this.deviceData = data;
      const { waterLevel, temperature, status } = data;
      
      // Convert percentage to actual volume
      const currentVolume = (waterLevel / 100) * this.bottleCapacity;
      const previousVolume = this.previousWaterLevel ? 
        (this.previousWaterLevel / 100) * this.bottleCapacity : currentVolume;
      
      // Detect drinking or refilling
      if (this.previousWaterLevel !== null) {
        const volumeChange = currentVolume - previousVolume;
        
        if (volumeChange < -50) { // Drinking detected (at least 50ml consumed)
          const consumedAmount = Math.abs(volumeChange);
          await this.recordDrinkingEvent(consumedAmount, temperature);
          
        } else if (volumeChange > 200) { // Refill detected (more than 200ml added)
          this.handleRefillDetected(currentVolume);
        }
      }
      
      // Check for various alert conditions
      this.checkDeviceAlerts(data);
      
      // Update tracking variables
      this.previousWaterLevel = waterLevel;
      this.previousTemperature = temperature;
      
    } catch (error) {
      console.error('❌ Error processing BLE data:', error);
    }
  }

  async recordDrinkingEvent(consumedAmount, temperature) {
    try {
      const now = new Date();
      
      // Save to database
      await this.waterBottleService.saveDrinkingEvent(consumedAmount);
      
      // Update local state
      this.lastDrinkTime = now;
      
      // Send positive feedback notification
      this.sendNotification({
        title: '💧 Hydration Tracked!',
        message: `Great! You drank ${Math.round(consumedAmount)}ml`,
        type: 'drinking_event',
        data: { amount: consumedAmount, temperature }
      });

      console.log(`✅ Drinking event recorded: ${consumedAmount}ml`);
      
    } catch (error) {
      console.error('❌ Error recording drinking event:', error);
    }
  }

  handleRefillDetected(newVolume) {
    console.log(`🔄 Refill detected: ${Math.round(newVolume)}ml`);
    
    this.sendNotification({
      title: '🚰 Bottle Refilled',
      message: `Bottle refilled to ${Math.round((newVolume / this.bottleCapacity) * 100)}%`,
      type: 'refill',
      priority: 'low'
    });
  }

  // ======================
  // DEVICE ALERTS
  // ======================

  checkDeviceAlerts(data) {
    const { waterLevel, temperature, status, batteryLevel } = data;
    
    // Low water alert
    if (waterLevel < 20 && this.shouldSendNotification('low_water')) {
      this.sendNotification({
        title: '💧 Low Water Alert',
        message: 'Your bottle is running low. Time to refill!',
        type: 'low_water',
        priority: 'high'
      });
    }

    // Empty bottle alert
    if (waterLevel < 5 && this.shouldSendNotification('empty_bottle')) {
      this.sendNotification({
        title: '🔴 Bottle Empty',
        message: 'Your water bottle is empty. Please refill it.',
        type: 'empty_bottle',
        priority: 'high'
      });
    }

    // Temperature alerts
    if (temperature > 35 && this.shouldSendNotification('hot_water')) {
      this.sendNotification({
        title: '🌡️ Water Too Hot',
        message: `Water temperature is ${temperature}°C. Let it cool down.`,
        type: 'hot_water',
        priority: 'medium'
      });
    }

    // Battery alerts
    if (batteryLevel < 15 && this.shouldSendNotification('low_battery')) {
      this.sendNotification({
        title: '🔋 Low Battery',
        message: 'Your smart bottle battery is low. Please charge it.',
        type: 'low_battery',
        priority: 'medium'
      });
    }

    // Device moving/unstable
    if (status === 'MOVING' && this.shouldSendNotification('bottle_moving')) {
      this.sendNotification({
        title: '📱 Bottle Moving',
        message: 'Keep bottle stable for accurate readings.',
        type: 'bottle_moving',
        priority: 'low'
      });
    }
  }

  // ======================
  // HYDRATION REMINDERS
  // ======================

  schedulePeriodicReminders() {
    // Clear existing reminders
    PushNotification.cancelAllLocalNotifications();
    
    // Schedule next reminder
    if (this.notificationSettings.drinkReminders) {
      this.scheduleNextReminder();
    }
  }

  scheduleNextReminder() {
    const now = new Date();
    const nextReminder = new Date(now.getTime() + this.notificationSettings.reminderInterval);
    
    // Check if it's quiet hours
    if (this.isQuietHours(nextReminder)) {
      // Schedule after quiet hours end
      const nextMorning = new Date(nextReminder);
      nextMorning.setHours(this.notificationSettings.quietHours.end, 0, 0, 0);
      nextReminder.setTime(nextMorning.getTime());
    }

    PushNotification.localNotificationSchedule({
      title: '💧 Hydration Reminder',
      message: this.getHydrationReminderMessage(),
      date: nextReminder,
      userInfo: { type: 'drink_reminder' },
      repeatType: 'time',
      repeatTime: this.notificationSettings.reminderInterval,
    });

    console.log(`⏰ Next drink reminder scheduled for: ${nextReminder.toLocaleTimeString()}`);
  }

  getHydrationReminderMessage() {
    const messages = [
      "Time to drink some water! 💧",
      "Don't forget to stay hydrated! 🚰",
      "Your body needs water. Take a sip! 💦",
      "Hydration break time! 🥤",
      "Keep the water flowing! 💧"
    ];
    
    if (this.currentDayStats) {
      const progress = (this.currentDayStats.totalConsumed / this.currentDayStats.goal) * 100;
      if (progress < 30) {
        return "You're behind on your hydration goal. Drink up! 💧";
      } else if (progress > 80) {
        return "You're doing great! Almost at your goal! 🎯";
      }
    }
    
    return messages[Math.floor(Math.random() * messages.length)];
  }

  // ======================
  // GOAL NOTIFICATIONS
  // ======================

  checkGoalNotifications(stats) {
    if (!stats) return;
    
    const progress = (stats.totalConsumed / stats.goal) * 100;
    
    // Milestone notifications (25%, 50%, 75%, 100%)
    [25, 50, 75, 100].forEach(milestone => {
      if (progress >= milestone && this.shouldSendNotification(`milestone_${milestone}`)) {
        this.sendMilestoneNotification(milestone, stats);
      }
    });

    // Behind goal warning (6PM and only 30% complete)
    const now = new Date();
    if (now.getHours() >= 18 && progress < 30 && this.shouldSendNotification('behind_goal')) {
      this.sendNotification({
        title: '⚠️ Hydration Warning',
        message: `You're behind on your daily goal (${Math.round(progress)}%). Time to catch up!`,
        type: 'behind_goal',
        priority: 'high'
      });
    }
  }

  sendMilestoneNotification(milestone, stats) {
    const emojis = { 25: '🌱', 50: '💪', 75: '🔥', 100: '🏆' };
    const messages = {
      25: `Great start! You've reached 25% of your daily goal!`,
      50: `Halfway there! Keep up the good work!`,
      75: `Almost there! 75% of your goal completed!`,
      100: `🎉 Congratulations! You've reached your daily hydration goal!`
    };

    this.sendNotification({
      title: `${emojis[milestone]} ${milestone}% Complete`,
      message: messages[milestone],
      type: `milestone_${milestone}`,
      priority: milestone === 100 ? 'high' : 'medium',
      data: { milestone, totalConsumed: stats.totalConsumed, goal: stats.goal }
    });
  }

  // ======================
  // CONNECTION HANDLING
  // ======================

  handleConnectionChange(state) {
    const previousStatus = this.connectionStatus;
    this.connectionStatus = state.isConnected ? 'connected' : 'disconnected';
    
    if (previousStatus === 'connected' && !state.isConnected) {
      // Device disconnected
      this.sendNotification({
        title: '📱 Device Disconnected',
        message: 'SmartHydrate bottle disconnected. Reconnecting...',
        type: 'disconnected',
        priority: 'medium'
      });
    } else if (previousStatus === 'disconnected' && state.isConnected) {
      // Device reconnected
      this.sendNotification({
        title: '✅ Device Connected',
        message: 'SmartHydrate bottle connected successfully!',
        type: 'connected',
        priority: 'low'
      });
    }
  }

  handleBLEError(error) {
    console.error('BLE Error:', error);
    
    this.sendNotification({
      title: '❌ Device Error',
      message: 'There was an issue with your smart bottle. Please check the connection.',
      type: 'ble_error',
      priority: 'high'
    });
  }

  // ======================
  // NOTIFICATION SYSTEM
  // ======================

  setupNotifications() {
    PushNotification.configure({
      onRegister: (token) => {
        console.log('📱 Push notification token:', token);
      },

      onNotification: (notification) => {
        console.log('📬 Notification received:', notification);
        
        // Handle notification tap
        if (notification.userInteraction) {
          this.handleNotificationTap(notification);
        }
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    // Create notification channels for Android
    if (Platform.OS === 'android') {
      PushNotification.createChannel({
        channelId: 'hydration-reminders',
        channelName: 'Hydration Reminders',
        channelDescription: 'Regular reminders to drink water',
        importance: 3,
      });

      PushNotification.createChannel({
        channelId: 'device-alerts',
        channelName: 'Device Alerts',
        channelDescription: 'Alerts about bottle status and issues',
        importance: 4,
      });

      PushNotification.createChannel({
        channelId: 'goal-achievements',
        channelName: 'Goal Achievements',
        channelDescription: 'Notifications about hydration milestones',
        importance: 3,
      });
    }
  }

  sendNotification({ title, message, type, priority = 'medium', data = {} }) {
    if (!this.notificationSettings[this.getNotificationCategory(type)]) {
      return; // Category disabled
    }

    if (this.isQuietHours()) {
      console.log('🔇 Notification suppressed (quiet hours):', title);
      return;
    }

    const channelId = this.getChannelId(type);
    const importance = priority === 'high' ? 4 : priority === 'medium' ? 3 : 2;

    PushNotification.localNotification({
      title,
      message,
      channelId,
      importance,
      priority,
      userInfo: { type, ...data },
      playSound: priority === 'high',
      vibrate: priority === 'high',
    });

    // Track notification time to prevent spam
    this.lastNotificationTime[type] = Date.now();
    
    console.log(`📬 Notification sent [${type}]: ${title}`);
  }

  // ======================
  // UTILITY METHODS
  // ======================

  shouldSendNotification(type) {
    const lastTime = this.lastNotificationTime[type] || 0;
    const cooldownPeriod = this.getNotificationCooldown(type);
    
    return (Date.now() - lastTime) > cooldownPeriod;
  }

  getNotificationCooldown(type) {
    const cooldowns = {
      'low_water': 30 * 60 * 1000,      // 30 minutes
      'empty_bottle': 60 * 60 * 1000,   // 1 hour
      'hot_water': 15 * 60 * 1000,      // 15 minutes
      'low_battery': 4 * 60 * 60 * 1000, // 4 hours
      'bottle_moving': 5 * 60 * 1000,    // 5 minutes
      'behind_goal': 2 * 60 * 60 * 1000, // 2 hours
      'disconnected': 10 * 60 * 1000,    // 10 minutes
    };
    
    return cooldowns[type] || 15 * 60 * 1000; // Default 15 minutes
  }

  getNotificationCategory(type) {
    const categories = {
      'drinking_event': 'goalAchievements',
      'milestone_25': 'goalAchievements',
      'milestone_50': 'goalAchievements',
      'milestone_75': 'goalAchievements',
      'milestone_100': 'goalAchievements',
      'low_water': 'lowWaterAlerts',
      'empty_bottle': 'lowWaterAlerts',
      'hot_water': 'deviceAlerts',
      'low_battery': 'deviceAlerts',
      'bottle_moving': 'deviceAlerts',
      'drink_reminder': 'drinkReminders',
      'behind_goal': 'drinkReminders',
    };
    
    return categories[type] || 'deviceAlerts';
  }

  getChannelId(type) {
    const channels = {
      'drink_reminder': 'hydration-reminders',
      'behind_goal': 'hydration-reminders',
      'milestone_25': 'goal-achievements',
      'milestone_50': 'goal-achievements',
      'milestone_75': 'goal-achievements',
      'milestone_100': 'goal-achievements',
      'drinking_event': 'goal-achievements',
    };
    
    return channels[type] || 'device-alerts';
  }

  isQuietHours(time = new Date()) {
    const hour = time.getHours();
    const { start, end } = this.notificationSettings.quietHours;
    
    if (start > end) { // Overnight quiet hours (e.g., 22 to 7)
      return hour >= start || hour < end;
    } else { // Same day quiet hours
      return hour >= start && hour < end;
    }
  }

  handleNotificationTap(notification) {
    const { type } = notification.userInfo || {};
    
    switch (type) {
      case 'drink_reminder':
      case 'behind_goal':
        // Navigate to main screen or open water tracking
        break;
      case 'low_water':
      case 'empty_bottle':
        // Show refill instructions or nearby water sources
        break;
      case 'milestone_25':
      case 'milestone_50':
      case 'milestone_75':
      case 'milestone_100':
        // Navigate to progress/achievements screen
        break;
      default:
        // Navigate to main app
        break;
    }
  }

  setupAppStateTracking() {
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background') {
        this.handleAppBackground();
      } else if (nextAppState === 'active') {
        this.handleAppForeground();
      }
    });
  }

  handleAppBackground() {
    console.log('📱 App went to background - starting background tracking');
  }

  handleAppForeground() {
    console.log('📱 App came to foreground - stopping background tracking');
    
    // Refresh data when app becomes active
    this.schedulePeriodicReminders();
  }

  // ======================
  // CONFIGURATION
  // ======================

  updateSettings(newSettings) {
    this.notificationSettings = { ...this.notificationSettings, ...newSettings };
    console.log('⚙️ Notification settings updated:', this.notificationSettings);
    
    if (newSettings.drinkReminders !== undefined) {
      this.schedulePeriodicReminders();
    }
  }

  setBottleCapacity(capacity) {
    this.bottleCapacity = capacity;
    console.log(`🍼 Bottle capacity set to ${capacity}ml`);
  }

  // ======================
  // CLEANUP
  // ======================

  destroy() {
    console.log('🗑️ Destroying intake tracker');
    
    this.isTracking = false;
    
    if (this.unsubscribeStats) {
      this.unsubscribeStats();
    }
    
    PushNotification.cancelAllLocalNotifications();
  }
}

export default IntakeTracker;