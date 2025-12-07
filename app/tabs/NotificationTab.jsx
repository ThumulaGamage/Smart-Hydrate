import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { ref, onValue, update } from 'firebase/database';
import { Ionicons } from '@expo/vector-icons';
import useTheme from '../../Theme/theme';
import { auth, WaterBottleService } from '../../config/firebaseConfig';
import bleService from '../../services/BLEService';

// Graceful notification import
let Notifications = null;
let Device = null;
let notificationsAvailable = false;

try {
  Notifications = require('expo-notifications');
  Device = require('expo-device');
  notificationsAvailable = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  console.log('✅ Notifications module loaded in NotificationTab');
} catch (error) {
  console.log('⚠️ Notifications not available in NotificationTab');
}

const WAKING_HOURS = 16;

// Initialize database
let database;
try {
  const { getDatabase } = require('firebase/database');
  database = getDatabase(auth.app);
} catch (e) {
  console.error("Failed to initialize database:", e);
}

export default function NotificationTab() {
  const theme = useTheme();
  
  // State declarations
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [sensorData, setSensorData] = useState({
    waterLevel: 0,
    temperature: 0,
    lastDrink: null,
    isConnected: false
  });

  // Healthy hydration settings
  const [healthyEnabled, setHealthyEnabled] = useState(true);
  const [healthyGoal, setHealthyGoal] = useState(0);
  const [healthyGap, setHealthyGap] = useState(3);
  const [healthyNextReminder, setHealthyNextReminder] = useState(null);
  const [healthyCountdown, setHealthyCountdown] = useState('');

  // Disease hydration settings
  const [diseaseEnabled, setDiseaseEnabled] = useState(true);
  const [diseaseGoal, setDiseaseGoal] = useState(0);
  const [diseaseGap, setDiseaseGap] = useState(3);
  const [diseaseName, setDiseaseName] = useState('');
  const [diseaseNextReminder, setDiseaseNextReminder] = useState(null);
  const [diseaseCountdown, setDiseaseCountdown] = useState('');

  // Master notification toggle
  const [allNotificationsEnabled, setAllNotificationsEnabled] = useState(true);

  // Request notification permissions on mount
  useEffect(() => {
    if (notificationsAvailable) {
      requestNotificationPermissions();
    }
  }, []);

  const requestNotificationPermissions = async () => {
    if (!notificationsAvailable) return;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      setNotificationPermission(finalStatus === 'granted');

      if (finalStatus === 'granted') {
        console.log('✅ Notification permissions granted');

        if (Device && Device.isDevice) {
          console.log('📱 Physical device - Full push notifications');
        } else {
          console.log('💻 Emulator - Local notifications');
        }
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  // Authentication
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
        console.log('User authenticated in NotificationTab:', user.uid);
      } else {
        setUserId(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load user settings from Firebase
  useEffect(() => {
    if (!userId || !database) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Load healthy hydration settings
    const healthyProfileRef = ref(database, `users/${userId}/profile`);
    const unsubscribeHealthy = onValue(healthyProfileRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log('📋 Healthy profile loaded:', data);

        if (data.dailyGoal) setHealthyGoal(data.dailyGoal);
        if (data.reminderGap) setHealthyGap(data.reminderGap);
        if (data.notificationsEnabled !== undefined) setHealthyEnabled(data.notificationsEnabled);
        if (data.nextReminderTime) setHealthyNextReminder(data.nextReminderTime);
      }
      setLoading(false);
    });

    // Load disease hydration settings
    const diseaseProfileRef = ref(database, `users/${userId}/diseaseProfile`);
    const unsubscribeDisease = onValue(diseaseProfileRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log('📋 Disease profile loaded:', data);

        if (data.dailyGoal) setDiseaseGoal(data.dailyGoal);
        if (data.reminderGap) setDiseaseGap(data.reminderGap);
        if (data.diseaseName) setDiseaseName(data.diseaseName);
        if (data.notificationsEnabled !== undefined) setDiseaseEnabled(data.notificationsEnabled);
        if (data.nextReminderTime) setDiseaseNextReminder(data.nextReminderTime);
      }
    });

    // Load master notification setting
    const settingsRef = ref(database, `users/${userId}/settings`);
    const unsubscribeSettings = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.pushNotifications !== undefined) {
          setAllNotificationsEnabled(data.pushNotifications);
        }
      }
    });

    return () => {
      unsubscribeHealthy();
      unsubscribeDisease();
      unsubscribeSettings();
    };
  }, [userId]);

  // Initialize notifications and sensor data
  useEffect(() => {
    if (userId) {
      initializeNotifications();
    }
  }, [userId]);

  const initializeNotifications = async () => {
    try {
      if (auth.currentUser) {
        const service = new WaterBottleService(auth.currentUser.uid);
        
        const todayStats = await service.getTodayStats();
        const latestReading = await service.getLatestReading();
        
        let updatedSensorData = { ...sensorData };
        
        if (latestReading && latestReading.length > 0) {
          const reading = latestReading[0];
          updatedSensorData = {
            waterLevel: reading.waterLevel || 0,
            temperature: reading.temperature || 0,
            lastDrink: reading.timestamp?.toDate ? reading.timestamp.toDate() : null,
            isConnected: bleService.isConnected || false
          };
          setSensorData(updatedSensorData);
        }

        generateNotifications(todayStats, updatedSensorData);
      }
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  };

  const generateNotifications = (todayStats, currentSensorData) => {
    const newNotifications = [];
    const now = Date.now();

    // Water Level Notifications
    if (currentSensorData.waterLevel < 25) {
      newNotifications.push({
        id: 'low-water',
        type: 'critical',
        icon: 'water',
        title: 'Bottle Running Low',
        message: 'Your bottle is running low! Time for a refill.',
        timestamp: new Date(),
        priority: 'high',
        actionable: true,
        action: 'refill'
      });
    } else if (currentSensorData.waterLevel < 50) {
      newNotifications.push({
        id: 'half-water',
        type: 'warning',
        icon: 'water-outline',
        title: 'Water Level Medium',
        message: 'Your bottle is half empty. Consider refilling soon.',
        timestamp: new Date(),
        priority: 'medium',
        actionable: false
      });
    }

    // Temperature Notifications
    if (currentSensorData.temperature > 30) {
      newNotifications.push({
        id: 'warm-water',
        type: 'warning',
        icon: 'thermometer-outline',
        title: 'Water Temperature High',
        message: 'Water is quite warm. Consider adding ice for better taste.',
        timestamp: new Date(),
        priority: 'medium',
        actionable: false
      });
    } else if (currentSensorData.temperature < 10) {
      newNotifications.push({
        id: 'cold-water',
        type: 'info',
        icon: 'snow-outline',
        title: 'Refreshingly Cold',
        message: 'Your water is nice and cold! Perfect for hydration.',
        timestamp: new Date(),
        priority: 'low',
        actionable: false
      });
    }

    // Hydration Reminder
    if (currentSensorData.lastDrink && (now - currentSensorData.lastDrink) > 3600000) {
      newNotifications.push({
        id: 'drink-reminder',
        type: 'critical',
        icon: 'time-outline',
        title: 'Hydration Reminder',
        message: "It's been over an hour since your last drink. Stay hydrated!",
        timestamp: new Date(),
        priority: 'high',
        actionable: true,
        action: 'drink'
      });
    }

    // Goal Progress Notifications
    if (todayStats && todayStats.goal > 0) {
      const progressPercent = (todayStats.totalConsumed / todayStats.goal) * 100;
      
      if (progressPercent >= 100) {
        newNotifications.push({
          id: 'goal-achieved',
          type: 'success',
          icon: 'checkmark-circle',
          title: 'Goal Achieved! 🎉',
          message: "Congratulations! You've reached your daily hydration goal!",
          timestamp: new Date(),
          priority: 'high',
          actionable: false
        });
      } else if (progressPercent >= 75 && progressPercent < 100) {
        newNotifications.push({
          id: 'almost-there',
          type: 'info',
          icon: 'trending-up',
          title: 'Almost There!',
          message: `You're ${progressPercent.toFixed(0)}% towards your goal. Keep it up!`,
          timestamp: new Date(),
          priority: 'medium',
          actionable: false
        });
      } else if (progressPercent < 25) {
        newNotifications.push({
          id: 'low-progress',
          type: 'warning',
          icon: 'alert-circle-outline',
          title: 'Low Daily Progress',
          message: 'You haven\'t consumed much water today. Remember to stay hydrated!',
          timestamp: new Date(),
          priority: 'medium',
          actionable: true,
          action: 'drink'
        });
      }
    }

    // Connection Status
    if (!bleService.isConnected) {
      newNotifications.push({
        id: 'disconnected',
        type: 'warning',
        icon: 'bluetooth-outline',
        title: 'Bottle Disconnected',
        message: 'Your smart bottle is not connected. Connect to track your hydration.',
        timestamp: new Date(),
        priority: 'medium',
        actionable: true,
        action: 'connect'
      });
    }

    // Sort by priority and timestamp
    newNotifications.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    setNotifications(newNotifications);
  };

  // Countdown timers
  useEffect(() => {
    if (!allNotificationsEnabled) return;

    const interval = setInterval(() => {
      if (healthyEnabled && healthyNextReminder) {
        const countdown = calculateCountdown(healthyNextReminder);
        setHealthyCountdown(countdown);
      } else {
        setHealthyCountdown('');
      }

      if (diseaseEnabled && diseaseNextReminder) {
        const countdown = calculateCountdown(diseaseNextReminder);
        setDiseaseCountdown(countdown);
      } else {
        setDiseaseCountdown('');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [allNotificationsEnabled, healthyEnabled, diseaseEnabled, healthyNextReminder, diseaseNextReminder]);

  const calculateCountdown = (targetTime) => {
    const now = new Date().getTime();
    const distance = targetTime - now;

    if (distance < 0) return 'Time for water! 💧';

    const hours = Math.floor(distance / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const calculateIntake = (goal, gap) => {
    if (!goal || !gap || goal <= 0 || gap <= 0) return 0;
    const numberOfReminders = Math.floor(WAKING_HOURS / gap);
    return Math.ceil((goal / numberOfReminders) / 10) * 10;
  };

  const scheduleHealthyNotifications = async (gapHours, intakeAmount) => {
    if (!notificationsAvailable || !healthyEnabled || !allNotificationsEnabled) return false;

    try {
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const notification of allScheduled) {
        if (notification.content.data?.type === 'hydration_reminder') {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }

      const gapInSeconds = gapHours * 60 * 60;
      const numberOfReminders = Math.floor(WAKING_HOURS / gapHours);

      const nextTime = new Date().getTime() + (gapInSeconds * 1000);
      setHealthyNextReminder(nextTime);

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

      await update(ref(database, `users/${userId}/profile`), {
        nextReminderTime: nextTime,
        lastScheduledAt: Date.now(),
      });

      console.log(`✅ Scheduled ${numberOfReminders} healthy hydration notifications`);
      return true;
    } catch (error) {
      console.error('❌ Error scheduling healthy notifications:', error);
      return false;
    }
  };

  const scheduleDiseaseNotifications = async (gapHours, intakeAmount, conditionName) => {
    if (!notificationsAvailable || !diseaseEnabled || !allNotificationsEnabled) return false;

    try {
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const notification of allScheduled) {
        if (notification.content.data?.type === 'disease_hydration_reminder') {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }

      const gapInSeconds = gapHours * 60 * 60;
      const numberOfReminders = Math.floor(WAKING_HOURS / gapHours);

      const nextTime = new Date().getTime() + (gapInSeconds * 1000);
      setDiseaseNextReminder(nextTime);

      for (let i = 0; i < numberOfReminders; i++) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '💊 Medical Hydration Reminder',
            body: `⚕️ ${conditionName}: Time to drink ${intakeAmount}ml of water as prescribed. 💧`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            data: {
              type: 'disease_hydration_reminder',
              amount: intakeAmount,
              condition: conditionName,
              medicalAlert: true,
            },
          },
          trigger: {
            seconds: gapInSeconds * (i + 1),
            repeats: false,
          },
        });
      }

      await update(ref(database, `users/${userId}/diseaseProfile`), {
        nextReminderTime: nextTime,
        lastScheduledAt: Date.now(),
      });

      console.log(`✅ Scheduled ${numberOfReminders} disease hydration notifications`);
      return true;
    } catch (error) {
      console.error('❌ Error scheduling disease notifications:', error);
      return false;
    }
  };

  const handleHealthyToggle = async (value) => {
    setHealthyEnabled(value);

    if (userId) {
      await update(ref(database, `users/${userId}/profile`), {
        notificationsEnabled: value,
      });

      if (!value && notificationsAvailable) {
        const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
        for (const notification of allScheduled) {
          if (notification.content.data?.type === 'hydration_reminder') {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
          }
        }
        setHealthyNextReminder(null);
      } else if (value && healthyGoal > 0) {
        const intake = calculateIntake(healthyGoal, healthyGap);
        await scheduleHealthyNotifications(healthyGap, intake);
      }
    }
  };

  const handleDiseaseToggle = async (value) => {
    setDiseaseEnabled(value);

    if (userId) {
      await update(ref(database, `users/${userId}/diseaseProfile`), {
        notificationsEnabled: value,
      });

      if (!value && notificationsAvailable) {
        const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
        for (const notification of allScheduled) {
          if (notification.content.data?.type === 'disease_hydration_reminder') {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
          }
        }
        setDiseaseNextReminder(null);
      } else if (value && diseaseGoal > 0 && diseaseName) {
        const intake = calculateIntake(diseaseGoal, diseaseGap);
        await scheduleDiseaseNotifications(diseaseGap, intake, diseaseName);
      }
    }
  };

  const handleRescheduleAll = async () => {
    if (!notificationsAvailable || !allNotificationsEnabled) {
      Alert.alert("Notifications Disabled", "Please enable notifications in Settings first.");
      return;
    }

    if (!notificationPermission) {
      Alert.alert("Permission Required", "Please grant notification permissions.");
      return;
    }

    let scheduled = 0;

    if (healthyEnabled && healthyGoal > 0) {
      const intake = calculateIntake(healthyGoal, healthyGap);
      const success = await scheduleHealthyNotifications(healthyGap, intake);
      if (success) scheduled++;
    }

    if (diseaseEnabled && diseaseGoal > 0 && diseaseName) {
      const intake = calculateIntake(diseaseGoal, diseaseGap);
      const success = await scheduleDiseaseNotifications(diseaseGap, intake, diseaseName);
      if (success) scheduled++;
    }

    if (scheduled > 0) {
      Alert.alert(
        "Reminders Scheduled! ✅",
        `Successfully scheduled ${scheduled} reminder plan(s).`,
        [{ text: "OK" }]
      );
    } else {
      Alert.alert(
        "No Plans to Schedule",
        "Please set up your hydration plans in 'Customize Hydration' tab first.",
        [{ text: "OK" }]
      );
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await initializeNotifications();
    setRefreshing(false);
  };

  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const getNotificationStyle = (type) => {
    switch (type) {
      case 'critical':
        return {
          borderColor: theme.error || '#f44336',
          backgroundColor: `${theme.error || '#f44336'}15`
        };
      case 'warning':
        return {
          borderColor: theme.warning || '#FF9800',
          backgroundColor: `${theme.warning || '#FF9800'}15`
        };
      case 'success':
        return {
          borderColor: theme.success || '#4CAF50',
          backgroundColor: `${theme.success || '#4CAF50'}15`
        };
      case 'info':
      default:
        return {
          borderColor: theme.primary || '#2196F3',
          backgroundColor: `${theme.primary || '#2196F3'}15`
        };
    }
  };

  const getIconColor = (type) => {
    switch (type) {
      case 'critical':
        return theme.error || '#f44336';
      case 'warning':
        return theme.warning || '#FF9800';
      case 'success':
        return theme.success || '#4CAF50';
      case 'info':
      default:
        return theme.primary || '#2196F3';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Time unknown';
    const now = new Date();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return timestamp.toLocaleDateString();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary || '#2196F3'} />
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>
            Loading notifications...
          </Text>
        </View>
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Ionicons name="lock-closed" size={64} color={theme.text} style={{ opacity: 0.3 }} />
        <Text style={[styles.text, { color: theme.text, marginTop: 16 }]}>
          Please sign in to manage notifications
        </Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.scrollContainer, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
          colors={[theme.primary || '#2196F3']}
        />
      }
    >
      <View style={styles.contentContainer}>

        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="notifications" size={32} color={theme.accent || '#0D9488'} />
          <Text style={[styles.title, { color: theme.text }]}>Notification Center</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryText || '#9CA3AF' }]}>
            Manage all your hydration reminders
          </Text>
        </View>

        {/* Package Status */}
        {!notificationsAvailable && (
          <View style={[styles.warningCard, { backgroundColor: '#F59E0B' }]}>
            <Ionicons name="alert-circle" size={24} color="#FFFFFF" />
            <Text style={styles.warningText}>
              Install expo-notifications to enable reminders:{'\n'}
              npx expo install expo-notifications expo-device
            </Text>
          </View>
        )}

        {/* Permission Status */}
        {notificationsAvailable && !notificationPermission && (
          <View style={[styles.warningCard, { backgroundColor: '#EF4444' }]}>
            <Ionicons name="alert-circle" size={24} color="#FFFFFF" />
            <Text style={styles.warningText}>
              Notification permissions required
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestNotificationPermissions}
            >
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Master Notification Status Banner */}
        {!allNotificationsEnabled && (
          <View style={[styles.warningCard, { backgroundColor: '#6B7280' }]}>
            <Ionicons name="notifications-off" size={24} color="#FFFFFF" />
            <Text style={styles.warningText}>
              Push notifications are disabled. Enable them in Settings to receive reminders.
            </Text>
          </View>
        )}

        {/* Device Info */}
        {notificationsAvailable && Device && (
          <View style={[styles.infoCard, { backgroundColor: theme.card || '#1F2937' }]}>
            <Ionicons
              name={Device.isDevice ? "phone-portrait" : "desktop"}
              size={20}
              color={theme.accent || '#0D9488'}
            />
            <Text style={[styles.infoText, { color: theme.text }]}>
              {Device.isDevice
                ? '📱 Physical Device - Full Push Notifications'
                : '💻 Emulator - Local Notifications'}
            </Text>
          </View>
        )}

        {/* Healthy Hydration Section */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            💧 Healthy Hydration
          </Text>

          <View style={[styles.planCard, { backgroundColor: theme.card || '#1F2937' }]}>
            <View style={styles.planHeader}>
              <View style={styles.planInfo}>
                <Text style={[styles.planTitle, { color: theme.text }]}>
                  Daily Hydration Plan
                </Text>
                <Text style={[styles.planDetails, { color: theme.secondaryText || '#9CA3AF' }]}>
                  {healthyGoal > 0
                    ? `Goal: ${healthyGoal}ml • Every ${healthyGap} hours`
                    : 'Not configured yet'}
                </Text>
              </View>
              <Switch
                value={healthyEnabled && allNotificationsEnabled}
                onValueChange={handleHealthyToggle}
                trackColor={{ false: '#374151', true: '#0D9488' }}
                thumbColor={healthyEnabled ? '#FFFFFF' : '#9CA3AF'}
                disabled={!notificationsAvailable || !notificationPermission || !allNotificationsEnabled}
              />
            </View>

            {healthyEnabled && allNotificationsEnabled && healthyNextReminder && (
              <View style={[styles.countdownContainer, { backgroundColor: '#0D9488' }]}>
                <Ionicons name="timer" size={20} color="#FFFFFF" />
                <View style={styles.countdownInfo}>
                  <Text style={styles.countdownLabel}>Next reminder in:</Text>
                  <Text style={styles.countdownTime}>{healthyCountdown}</Text>
                  <Text style={styles.countdownAmount}>
                    Drink {calculateIntake(healthyGoal, healthyGap)}ml
                  </Text>
                </View>
              </View>
            )}

            {healthyGoal === 0 && (
              <View style={styles.setupPrompt}>
                <Ionicons name="information-circle" size={20} color="#6B7280" />
                <Text style={[styles.setupText, { color: theme.secondaryText || '#9CA3AF' }]}>
                  Set up your plan in 'Customize Hydration' → 'Healthy People'
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Disease Hydration Section */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            💊 Medical Hydration
          </Text>

          <View style={[styles.planCard, { backgroundColor: theme.card || '#1F2937' }]}>
            <View style={styles.planHeader}>
              <View style={styles.planInfo}>
                <Text style={[styles.planTitle, { color: theme.text }]}>
                  Disease Hydration Plan
                </Text>
                <Text style={[styles.planDetails, { color: theme.secondaryText || '#9CA3AF' }]}>
                  {diseaseGoal > 0 && diseaseName
                    ? `${diseaseName} • ${diseaseGoal}ml • Every ${diseaseGap} hours`
                    : 'Not configured yet'}
                </Text>
              </View>
              <Switch
                value={diseaseEnabled && allNotificationsEnabled}
                onValueChange={handleDiseaseToggle}
                trackColor={{ false: '#374151', true: '#DC2626' }}
                thumbColor={diseaseEnabled ? '#FFFFFF' : '#9CA3AF'}
                disabled={!notificationsAvailable || !notificationPermission || !allNotificationsEnabled}
              />
            </View>

            {diseaseEnabled && allNotificationsEnabled && diseaseNextReminder && (
              <View style={[styles.countdownContainer, { backgroundColor: '#DC2626' }]}>
                <Ionicons name="medical" size={20} color="#FFFFFF" />
                <View style={styles.countdownInfo}>
                  <Text style={styles.countdownLabel}>Next medical reminder in:</Text>
                  <Text style={styles.countdownTime}>{diseaseCountdown}</Text>
                  <Text style={styles.countdownAmount}>
                    {diseaseName}: {calculateIntake(diseaseGoal, diseaseGap)}ml prescribed
                  </Text>
                </View>
              </View>
            )}

            {diseaseGoal === 0 && (
              <View style={styles.setupPrompt}>
                <Ionicons name="information-circle" size={20} color="#6B7280" />
                <Text style={[styles.setupText, { color: theme.secondaryText || '#9CA3AF' }]}>
                  Set up your plan in 'Customize Hydration' → 'People with Disease'
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Real-time Notifications from Sensor Data */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            📬 Smart Alerts
          </Text>
          
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons 
                name="checkmark-circle-outline" 
                size={64} 
                color={theme.success || '#4CAF50'} 
              />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                All Caught Up!
              </Text>
              <Text style={[styles.emptyMessage, { color: theme.textMuted }]}>
                No alerts at the moment. Keep up the great hydration! 💧
              </Text>
            </View>
          ) : (
            notifications.map((notification) => (
              <View
                key={notification.id}
                style={[
                  styles.notificationCard,
                  getNotificationStyle(notification.type),
                  { backgroundColor: theme.card || 'white' }
                ]}
              >
                <View style={styles.notificationContent}>
                  <View style={styles.iconContainer}>
                    <Ionicons
                      name={notification.icon}
                      size={24}
                      color={getIconColor(notification.type)}
                    />
                  </View>
                  
                  <View style={styles.textContainer}>
                    <Text style={[styles.notificationTitle, { color: theme.text }]}>
                      {notification.title}
                    </Text>
                    <Text style={[styles.notificationMessage, { color: theme.textMuted }]}>
                      {notification.message}
                    </Text>
                    <Text style={[styles.timestamp, { color: theme.textMuted }]}>
                      {formatTimestamp(notification.timestamp)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={() => dismissNotification(notification.id)}
                  >
                    <Ionicons name="close" size={20} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>

                {notification.actionable && (
                  <View style={styles.notificationActionContainer}>
                    <TouchableOpacity
                      style={[styles.notificationActionButton, { borderColor: getIconColor(notification.type) }]}
                      onPress={() => {
                        console.log(`Action taken: ${notification.action} for ${notification.id}`);
                        dismissNotification(notification.id);
                      }}
                    >
                      <Text style={[styles.actionText, { color: getIconColor(notification.type) }]}>
                        {notification.action === 'refill' ? 'Mark as Refilled' : 
                         notification.action === 'drink' ? 'Remind Me Later' : 
                         notification.action === 'connect' ? 'Go to Settings' : 'Got it'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: theme.accent || '#0D9488',
                opacity: (notificationsAvailable && notificationPermission && allNotificationsEnabled) ? 1 : 0.5
              }
            ]}
            onPress={handleRescheduleAll}
            disabled={!notificationsAvailable || !notificationPermission || !allNotificationsEnabled}
          >
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Reschedule All Reminders</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#374151' }]}
            onPress={async () => {
              if (notificationsAvailable) {
                const scheduled = await Notifications.getAllScheduledNotificationsAsync();
                Alert.alert(
                  "Scheduled Notifications",
                  `You have ${scheduled.length} notification(s) scheduled.`,
                  [{ text: "OK" }]
                );
              }
            }}
          >
            <Ionicons name="list" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>View Scheduled</Text>
          </TouchableOpacity>
        </View>

        {/* Help Section */}
        <View style={[styles.helpCard, { backgroundColor: theme.card || '#1F2937' }]}>
          <Ionicons name="help-circle" size={24} color={theme.accent || '#0D9488'} />
          <Text style={[styles.helpTitle, { color: theme.text }]}>How It Works</Text>
          <Text style={[styles.helpText, { color: theme.secondaryText || '#9CA3AF' }]}>
            • Set up your hydration plans in 'Customize Hydration' tab{'\n'}
            • Enable push notifications in Settings to receive reminders{'\n'}
            • Toggle individual plans on/off as needed{'\n'}
            • Master notification control is in Settings{'\n'}
            • Water tracking always works, even if notifications are off
          </Text>
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  warningCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
    flexDirection: 'column',
  },
  warningText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  permissionButtonText: {
    color: '#EF4444',
    fontWeight: 'bold',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '500',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  planCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planInfo: {
    flex: 1,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  planDetails: {
    fontSize: 13,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 10,
  },
  countdownInfo: {
    flex: 1,
  },
  countdownLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.9,
  },
  countdownTime: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  countdownAmount: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.9,
  },
  setupPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: '#374151',
    borderRadius: 6,
  },
  setupText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  actionContainer: {
    gap: 12,
    marginVertical: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  helpCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
  notificationCard: {
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  notificationContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
  },
  dismissButton: {
    padding: 4,
  },
  notificationActionContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  notificationActionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});