// services/NotificationManager.js
// Central notification management system with deduplication and real-time updates

let Notifications = null;
let notificationsAvailable = false;

try {
  Notifications = require('expo-notifications');
  notificationsAvailable = true;
} catch (error) {
  console.log('⚠️ Notifications not available in NotificationManager');
}

class NotificationManager {
  constructor() {
    this.activeNotifications = new Map(); // Track active notifications by ID
    this.notificationQueue = new Set(); // Prevent duplicates
    this.scheduledIds = new Map(); // Track scheduled notification IDs
    this.lastSensorUpdate = null;
    this.listeners = new Set();
    
    // Debounce timers
    this.debounceTimers = new Map();
    
    console.log('🔔 NotificationManager initialized');
  }

  // Subscribe to notification changes
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notify all listeners
  notifyListeners() {
    const notifications = Array.from(this.activeNotifications.values());
    this.listeners.forEach(callback => callback(notifications));
  }

  // Generate unique notification ID
  generateId(type, subtype = '') {
    return `${type}_${subtype}_${Date.now()}`;
  }

  // Check if notification already exists
  hasActiveNotification(type) {
    return Array.from(this.activeNotifications.keys()).some(id => id.startsWith(type));
  }

  // Add or update notification
  addNotification(notification) {
    const existingKey = Array.from(this.activeNotifications.keys())
      .find(key => key.startsWith(notification.type));

    if (existingKey) {
      // Update existing notification instead of creating duplicate
      const existing = this.activeNotifications.get(existingKey);
      this.activeNotifications.set(existingKey, {
        ...existing,
        ...notification,
        timestamp: new Date(),
        updated: true
      });
      console.log(`🔄 Updated notification: ${notification.type}`);
    } else {
      // Add new notification
      const id = this.generateId(notification.type, notification.subtype);
      this.activeNotifications.set(id, {
        ...notification,
        id,
        timestamp: new Date()
      });
      console.log(`➕ Added notification: ${notification.type}`);
    }

    this.notifyListeners();
  }

  // Remove notification
  removeNotification(id) {
    if (this.activeNotifications.delete(id)) {
      console.log(`➖ Removed notification: ${id}`);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  // Clear all notifications of a specific type
  clearNotificationsOfType(type) {
    let removed = 0;
    for (const [id, notif] of this.activeNotifications.entries()) {
      if (notif.type === type) {
        this.activeNotifications.delete(id);
        removed++;
      }
    }
    if (removed > 0) {
      console.log(`🧹 Cleared ${removed} notifications of type: ${type}`);
      this.notifyListeners();
    }
  }

  // Clear all notifications
  clearAll() {
    this.activeNotifications.clear();
    console.log('🧹 Cleared all notifications');
    this.notifyListeners();
  }

  // Get all active notifications
  getActiveNotifications() {
    return Array.from(this.activeNotifications.values());
  }

  // Update notifications based on sensor data with debouncing
  updateFromSensorData(sensorData, todayStats, quietHoursEnabled = false, quietHoursStart = 22, quietHoursEnd = 7) {
    // Clear debounce timer
    if (this.debounceTimers.has('sensor')) {
      clearTimeout(this.debounceTimers.get('sensor'));
    }

    // Debounce sensor updates (wait 2 seconds before processing)
    const timer = setTimeout(() => {
      this.processSensorData(sensorData, todayStats, quietHoursEnabled, quietHoursStart, quietHoursEnd);
      this.debounceTimers.delete('sensor');
    }, 2000);

    this.debounceTimers.set('sensor', timer);
  }

  // Process sensor data and generate notifications
  processSensorData(sensorData, todayStats, quietHoursEnabled, quietHoursStart, quietHoursEnd) {
    const now = Date.now();
    const currentHour = new Date().getHours();
    const isQuietTime = quietHoursEnabled && this.isInQuietHours(currentHour, quietHoursStart, quietHoursEnd);

    console.log('📊 Processing sensor data for notifications:', {
      waterLevel: sensorData.waterLevel,
      temperature: sensorData.temperature,
      isConnected: sensorData.isConnected,
      isQuietTime,
      currentHour
    });

    // --- Water Level Notifications ---
    if (sensorData.waterLevel < 25) {
      this.addNotification({
        type: 'low-water',
        category: 'bottle',
        icon: 'water',
        title: 'Bottle Running Low',
        message: 'Your bottle is running low! Time for a refill.',
        priority: 'high',
        notificationType: 'critical',
        actionable: true,
        action: 'refill',
        sensorBased: true
      });
      
      // Send push notification for critical alert
      this.sendPushNotification(
        '🚰 Bottle Running Low',
        'Your water bottle is almost empty. Time for a refill!',
        { type: 'low-water', priority: 'high' }
      );
    } else if (sensorData.waterLevel < 50 && !isQuietTime) {
      this.addNotification({
        type: 'medium-water',
        category: 'bottle',
        icon: 'water-outline',
        title: 'Water Level Medium',
        message: 'Your bottle is half empty. Consider refilling soon.',
        priority: 'medium',
        notificationType: 'warning',
        actionable: false,
        sensorBased: true
      });
    } else {
      // Clear water level notifications if level is good
      this.clearNotificationsOfType('low-water');
      this.clearNotificationsOfType('medium-water');
    }

    // --- Temperature Notifications ---
    // Validate temperature is a valid number
    const temperature = parseFloat(sensorData.temperature);
    const hasValidTemperature = !isNaN(temperature) && temperature !== null && temperature !== undefined;
    
    console.log('🌡️ Temperature check:', {
      raw: sensorData.temperature,
      parsed: temperature,
      isValid: hasValidTemperature,
      isHot: hasValidTemperature && temperature > 30,
      isCold: hasValidTemperature && temperature < 10,
      isQuietTime
    });
    
    if (hasValidTemperature && temperature > 30 && !isQuietTime) {
      // Hot water alert
      console.log('🔥 Adding hot water alert');
      this.addNotification({
        type: 'warm-water',
        category: 'temperature',
        icon: 'thermometer-outline',
        title: 'Water Temperature High',
        message: `Water is ${temperature.toFixed(1)}°C. Consider adding ice.`,
        priority: 'low',
        notificationType: 'info',
        actionable: false,
        sensorBased: true
      });
      // Clear cold water notification if it exists
      this.clearNotificationsOfType('cold-water');
    } else if (hasValidTemperature && temperature < 10 && !isQuietTime) {
      // Cold water alert
      console.log('❄️ Adding cold water alert');
      this.addNotification({
        type: 'cold-water',
        category: 'temperature',
        icon: 'snow-outline',
        title: 'Refreshingly Cold',
        message: `Your water is ${temperature.toFixed(1)}°C. Perfect for hydration!`,
        priority: 'low',
        notificationType: 'success',
        actionable: false,
        sensorBased: true
      });
      // Clear warm water notification if it exists
      this.clearNotificationsOfType('warm-water');
    } else {
      // Temperature is normal (10-30°C) or it's quiet time or invalid - clear all temperature notifications
      console.log('🌡️ Clearing temperature alerts (normal temp, quiet time, or invalid)');
      this.clearNotificationsOfType('warm-water');
      this.clearNotificationsOfType('cold-water');
    }

    // --- Hydration Reminder ---
    if (sensorData.lastDrink) {
      const timeSince = now - sensorData.lastDrink;
      const oneHour = 3600000;
      
      if (timeSince > oneHour) {
        this.addNotification({
          type: 'drink-reminder',
          category: 'hydration',
          icon: 'time-outline',
          title: 'Hydration Reminder',
          message: `It's been ${Math.floor(timeSince / oneHour)} hour(s) since your last drink. Stay hydrated!`,
          priority: 'high',
          notificationType: 'critical',
          actionable: true,
          action: 'drink',
          snoozeable: true,
          sensorBased: true
        });

        // Send push notification if more than 2 hours
        if (timeSince > (oneHour * 2)) {
          this.sendPushNotification(
            '💧 Time to Hydrate!',
            `It's been ${Math.floor(timeSince / oneHour)} hours since your last drink.`,
            { type: 'drink-reminder', priority: 'high' }
          );
        }
      } else {
        // Clear reminder if recently drank
        this.clearNotificationsOfType('drink-reminder');
      }
    }

    // --- Goal Progress ---
    if (todayStats && todayStats.goal > 0) {
      const progress = (todayStats.totalConsumed / todayStats.goal) * 100;

      if (progress >= 100) {
        // Check if we already sent this achievement notification today
        const existingAchievement = Array.from(this.activeNotifications.values())
          .find(n => n.type === 'goal-achieved');
        
        if (!existingAchievement) {
          this.addNotification({
            type: 'goal-achieved',
            category: 'achievement',
            icon: 'checkmark-circle',
            title: 'Goal Achieved! 🎉',
            message: "Congratulations! You've reached your daily hydration goal!",
            priority: 'high',
            notificationType: 'success',
            actionable: true,
            action: 'celebrate',
            sensorBased: false
          });

          // Send celebratory push notification
          this.sendPushNotification(
            '🎉 Goal Achieved!',
            `Congratulations! You've reached your ${todayStats.goal}ml daily goal!`,
            { type: 'goal-achieved', priority: 'high' }
          );
        }
      } else if (progress >= 75 && progress < 100 && !isQuietTime) {
        this.addNotification({
          type: 'almost-there',
          category: 'progress',
          icon: 'trending-up',
          title: 'Almost There!',
          message: `You're ${progress.toFixed(0)}% towards your goal. Keep it up!`,
          priority: 'medium',
          notificationType: 'info',
          actionable: false,
          sensorBased: false
        });
      } else if (progress < 25 && !isQuietTime) {
        const hoursLeft = this.getHoursUntilEndOfDay();
        if (hoursLeft > 2) {
          this.addNotification({
            type: 'low-progress',
            category: 'progress',
            icon: 'alert-circle-outline',
            title: 'Low Daily Progress',
            message: `You're only at ${progress.toFixed(0)}% of your goal. Drink more water!`,
            priority: 'medium',
            notificationType: 'warning',
            actionable: true,
            action: 'drink',
            snoozeable: true,
            sensorBased: false
          });
        }
      }
    }

    // --- Connection Status ---
    console.log('🔌 Connection check:', {
      isConnected: sensorData.isConnected,
      isQuietTime,
      shouldShowAlert: !sensorData.isConnected && !isQuietTime
    });
    
    if (!sensorData.isConnected) {
      // Bottle is disconnected
      if (!isQuietTime) {
        // Show disconnection alert (only during active hours)
        console.log('⚠️ Adding disconnection alert');
        this.addNotification({
          type: 'disconnected',
          category: 'connection',
          icon: 'bluetooth-outline',
          title: 'Bottle Disconnected',
          message: 'Your smart bottle is not connected. Connect to track your hydration.',
          priority: 'medium',
          notificationType: 'warning',
          actionable: true,
          action: 'connect',
          sensorBased: true
        });
      } else {
        // During quiet hours, clear the notification (user is sleeping, no need to alert)
        console.log('🌙 Clearing disconnection alert (quiet hours)');
        this.clearNotificationsOfType('disconnected');
      }
    } else {
      // Bottle is connected - always clear disconnection notification
      console.log('✅ Clearing disconnection alert (connected)');
      this.clearNotificationsOfType('disconnected');
    }

    this.lastSensorUpdate = now;
  }

  // Send actual push notification
  async sendPushNotification(title, body, data = {}) {
    if (!notificationsAvailable) return;

    try {
      // Check if we already sent this notification recently (prevent spam)
      const notifKey = `${data.type}_push`;
      if (this.notificationQueue.has(notifKey)) {
        console.log(`⏭️ Skipping duplicate push notification: ${data.type}`);
        return;
      }

      // Add to queue
      this.notificationQueue.add(notifKey);

      // Schedule push notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: data.priority === 'high' 
            ? Notifications.AndroidNotificationPriority.HIGH 
            : Notifications.AndroidNotificationPriority.DEFAULT,
          data: {
            ...data,
            timestamp: Date.now()
          },
        },
        trigger: null, // Send immediately
      });

      console.log(`📢 Push notification sent: ${title}`);

      // Remove from queue after 5 minutes to allow resending
      setTimeout(() => {
        this.notificationQueue.delete(notifKey);
      }, 300000); // 5 minutes

    } catch (error) {
      console.error('❌ Error sending push notification:', error);
    }
  }

  // Schedule recurring hydration reminders
  async scheduleHydrationReminders(config) {
    if (!notificationsAvailable) return false;

    try {
      const {
        type, // 'healthy' or 'disease'
        goal,
        gapHours,
        intakeAmount,
        conditionName = null,
        userId
      } = config;

      // Cancel existing reminders of this type
      await this.cancelScheduledReminders(type);

      const gapInSeconds = gapHours * 60 * 60;
      const WAKING_HOURS = 16;
      const numberOfReminders = Math.floor(WAKING_HOURS / gapHours);

      const scheduledIds = [];

      for (let i = 0; i < numberOfReminders; i++) {
        const identifier = await Notifications.scheduleNotificationAsync({
          content: {
            title: type === 'disease' ? '💊 Medical Hydration' : '💧 Hydration Reminder',
            body: conditionName 
              ? `⚕️ ${conditionName}: Time to drink ${intakeAmount}ml as prescribed.`
              : `Time to drink ${intakeAmount}ml of water! Stay hydrated! 🌊`,
            sound: true,
            priority: type === 'disease' 
              ? Notifications.AndroidNotificationPriority.MAX
              : Notifications.AndroidNotificationPriority.HIGH,
            data: {
              type: type === 'disease' ? 'disease_hydration_reminder' : 'hydration_reminder',
              amount: intakeAmount,
              reminderNumber: i + 1,
              condition: conditionName,
              userId
            },
          },
          trigger: {
            seconds: gapInSeconds * (i + 1),
            repeats: false,
          },
        });

        scheduledIds.push(identifier);
      }

      // Store scheduled IDs
      this.scheduledIds.set(type, scheduledIds);

      console.log(`✅ Scheduled ${numberOfReminders} ${type} reminders`);
      return true;

    } catch (error) {
      console.error(`❌ Error scheduling ${config.type} reminders:`, error);
      return false;
    }
  }

  // Cancel scheduled reminders
  async cancelScheduledReminders(type) {
    if (!notificationsAvailable) return;

    try {
      const ids = this.scheduledIds.get(type);
      if (ids && ids.length > 0) {
        for (const id of ids) {
          await Notifications.cancelScheduledNotificationAsync(id);
        }
        this.scheduledIds.delete(type);
        console.log(`🗑️ Cancelled ${ids.length} ${type} reminders`);
      }
    } catch (error) {
      console.error(`❌ Error cancelling ${type} reminders:`, error);
    }
  }

  // Cancel all scheduled notifications
  async cancelAllScheduledReminders() {
    if (!notificationsAvailable) return;

    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      this.scheduledIds.clear();
      console.log('🗑️ Cancelled all scheduled reminders');
    } catch (error) {
      console.error('❌ Error cancelling all reminders:', error);
    }
  }

  // Get count of scheduled notifications
  async getScheduledCount() {
    if (!notificationsAvailable) return 0;

    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      return scheduled.length;
    } catch (error) {
      console.error('❌ Error getting scheduled count:', error);
      return 0;
    }
  }

  // Helper: Check if in quiet hours
  isInQuietHours(hour, start, end) {
    if (start < end) {
      return hour >= start && hour < end;
    } else {
      return hour >= start || hour < end;
    }
  }

  // Helper: Get hours until end of day
  getHoursUntilEndOfDay() {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    return (endOfDay - now) / (1000 * 60 * 60);
  }

  // Cleanup
  cleanup() {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    
    // Clear listeners
    this.listeners.clear();
    
    console.log('🧹 NotificationManager cleaned up');
  }
}

// Singleton instance
let notificationManagerInstance = null;

export const getNotificationManager = () => {
  if (!notificationManagerInstance) {
    notificationManagerInstance = new NotificationManager();
  }
  return notificationManagerInstance;
};

export default NotificationManager;