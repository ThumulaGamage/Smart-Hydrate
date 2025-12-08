import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Modal,
  Platform,
} from 'react-native';
import { ref, onValue, update, get } from 'firebase/database';
import { Ionicons } from '@expo/vector-icons';
import useTheme from '../../Theme/theme';
import { auth, WaterBottleService } from '../../config/firebaseConfig';
import bleService from '../../services/BLEService';
import { getNotificationManager } from '../../services/NotificationManager';
import { getSmartReminderManager } from '../../services/SmartReminderManager';

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
      shouldShowAlert: false,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Listen for received notifications (when scheduled reminders fire)
  Notifications.addNotificationReceivedListener((notification) => {
    console.log('📬 Scheduled notification fired:', notification);
    
    const { title, body, data } = notification.request.content;
    
    // Show in-app notification when scheduled reminder fires
    if (data?.type === 'hydration_reminder' || data?.type === 'disease_hydration_reminder') {
      console.log('💧 Adding hydration reminder to in-app list');
      
      // Get notification manager and add to list
      const manager = getNotificationManager();
      manager.addNotification({
        type: data.type,
        category: 'hydration',
        icon: data.type === 'disease_hydration_reminder' ? 'medical' : 'water',
        title: title,
        message: body,
        priority: 'high',
        notificationType: 'critical',
        actionable: true,
        action: 'drink',
        snoozeable: true,
        sensorBased: false
      });
    }
  });

  // Listen for notification responses (when user taps notification)
  Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('👆 User tapped notification:', response);
    // Can add navigation logic here if needed
  });
  
  console.log('✅ Notifications module loaded successfully');
} catch (error) {
  console.log('⚠️ Notifications not available');
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
  const notificationManager = getNotificationManager();
  
  // State declarations
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [sensorData, setSensorData] = useState({
    waterLevel: 0,
    temperature: 0,
    lastDrink: null,
    isConnected: false
  });
  const [todayStats, setTodayStats] = useState(null);

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

  // Quiet hours settings
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState(22);
  const [quietHoursEnd, setQuietHoursEnd] = useState(7);

  // UI state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showQuietHoursModal, setShowQuietHoursModal] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [collapsedSections, setCollapsedSections] = useState({
    healthy: false,
    disease: false,
    smart: false
  });

  // Refs
  const listenersRef = useRef([]);
  const waterBottleServiceRef = useRef(null);

  // Subscribe to NotificationManager updates
  useEffect(() => {
    const unsubscribe = notificationManager.subscribe((updatedNotifications) => {
      console.log('🔔 Received notification update:', updatedNotifications.length);
      setNotifications(updatedNotifications);
    });

    return () => unsubscribe();
  }, []);

  // Request notification permissions
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
      }
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
    }
  };

  // Authentication
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load user settings
  useEffect(() => {
    if (!userId || !database) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let mounted = true;

    const loadSettings = async () => {
      try {
        const [healthySnapshot, diseaseSnapshot, settingsSnapshot, quietHoursSnapshot] = await Promise.all([
          get(ref(database, `users/${userId}/profile`)),
          get(ref(database, `users/${userId}/diseaseProfile`)),
          get(ref(database, `users/${userId}/settings`)),
          get(ref(database, `users/${userId}/quietHours`))
        ]);

        if (!mounted) return;

        if (healthySnapshot.exists()) {
          const data = healthySnapshot.val();
          if (data.dailyGoal) setHealthyGoal(data.dailyGoal);
          if (data.reminderGap) setHealthyGap(data.reminderGap);
          if (data.notificationsEnabled !== undefined) setHealthyEnabled(data.notificationsEnabled);
          if (data.nextReminderTime) setHealthyNextReminder(data.nextReminderTime);
        }

        if (diseaseSnapshot.exists()) {
          const data = diseaseSnapshot.val();
          if (data.dailyGoal) setDiseaseGoal(data.dailyGoal);
          if (data.reminderGap) setDiseaseGap(data.reminderGap);
          if (data.diseaseName) setDiseaseName(data.diseaseName);
          if (data.notificationsEnabled !== undefined) setDiseaseEnabled(data.notificationsEnabled);
          if (data.nextReminderTime) setDiseaseNextReminder(data.nextReminderTime);
        }

        if (settingsSnapshot.exists()) {
          const data = settingsSnapshot.val();
          if (data.pushNotifications !== undefined) {
            setAllNotificationsEnabled(data.pushNotifications);
          }
        }

        if (quietHoursSnapshot.exists()) {
          const data = quietHoursSnapshot.val();
          if (data.enabled !== undefined) setQuietHoursEnabled(data.enabled);
          if (data.start !== undefined) setQuietHoursStart(data.start);
          if (data.end !== undefined) setQuietHoursEnd(data.end);
        }

      } catch (error) {
        console.error('❌ Error loading settings:', error);
      } finally {
        if (mounted) {
          setLoading(false);
          
          // Initialize smart reminder manager (automatic system)
          const smartReminderManager = getSmartReminderManager();
          smartReminderManager.initialize(userId).then(() => {
            console.log('✅ SmartReminderManager initialized - automatic reminders active');
          }).catch(err => {
            console.error('❌ Failed to initialize SmartReminderManager:', err);
          });
        }
      }
    };

    loadSettings();

    // Setup real-time listeners
    setupFirebaseListeners(userId, mounted);

    return () => {
      mounted = false;
      listenersRef.current.forEach(unsub => unsub?.());
      listenersRef.current = [];
    };
  }, [userId]);

  // Setup Firebase listeners with real-time sensor updates
  const setupFirebaseListeners = (uid, mounted) => {
    const healthyProfileRef = ref(database, `users/${uid}/profile`);
    const diseaseProfileRef = ref(database, `users/${uid}/diseaseProfile`);
    const settingsRef = ref(database, `users/${uid}/settings`);
    const todayStatsRef = ref(database, `users/${uid}/dailyStats/${new Date().toISOString().split('T')[0]}`);
    const sensorReadingsRef = ref(database, `users/${uid}/sensorReadings`);

    // Healthy profile listener
    const unsubHealthy = onValue(healthyProfileRef, (snapshot) => {
      if (!mounted) return;
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.dailyGoal) setHealthyGoal(data.dailyGoal);
        if (data.reminderGap) setHealthyGap(data.reminderGap);
        if (data.notificationsEnabled !== undefined) setHealthyEnabled(data.notificationsEnabled);
        if (data.nextReminderTime) setHealthyNextReminder(data.nextReminderTime);
      }
    });

    // Disease profile listener
    const unsubDisease = onValue(diseaseProfileRef, (snapshot) => {
      if (!mounted) return;
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.dailyGoal) setDiseaseGoal(data.dailyGoal);
        if (data.reminderGap) setDiseaseGap(data.reminderGap);
        if (data.diseaseName) setDiseaseName(data.diseaseName);
        if (data.notificationsEnabled !== undefined) setDiseaseEnabled(data.notificationsEnabled);
        if (data.nextReminderTime) setDiseaseNextReminder(data.nextReminderTime);
      }
    });

    // Settings listener
    const unsubSettings = onValue(settingsRef, (snapshot) => {
      if (!mounted) return;
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.pushNotifications !== undefined) {
          setAllNotificationsEnabled(data.pushNotifications);
        }
      }
    });

    // Today stats listener - REAL-TIME UPDATES
    const unsubTodayStats = onValue(todayStatsRef, (snapshot) => {
      if (!mounted) return;
      if (snapshot.exists()) {
        const stats = snapshot.val();
        console.log('📊 Today stats updated:', stats);
        setTodayStats(stats);
        
        // Update notifications based on new stats
        if (sensorData) {
          notificationManager.updateFromSensorData(
            sensorData,
            stats,
            quietHoursEnabled,
            quietHoursStart,
            quietHoursEnd
          );
        }
      }
    });

    // Sensor readings listener - REAL-TIME SENSOR DATA
    const unsubSensor = onValue(sensorReadingsRef, (snapshot) => {
      if (!mounted) return;
      
      const readings = [];
      snapshot.forEach((childSnapshot) => {
        readings.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });

      // Get latest reading
      if (readings.length > 0) {
        readings.sort((a, b) => {
          const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : a.timestamp;
          const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : b.timestamp;
          return bTime - aTime;
        });

        const latest = readings[0];
        
        // Match the exact structure from BLE service and Homepage
        const updatedSensorData = {
          waterLevel: latest.waterLevel !== undefined ? latest.waterLevel : 0,
          temperature: latest.temperature !== undefined ? latest.temperature : 22,
          lastDrink: latest.timestamp?.toDate ? latest.timestamp.toDate() : new Date(latest.timestamp),
          isConnected: bleService?.isConnected === true
        };

        console.log('📡 Sensor data updated:', updatedSensorData);
        console.log('📡 Temperature value:', updatedSensorData.temperature);
        console.log('📡 Connection status:', updatedSensorData.isConnected);
        console.log('📡 BLE Service connected:', bleService?.isConnected);
        
        setSensorData(updatedSensorData);

        // Update notifications in real-time based on sensor data
        notificationManager.updateFromSensorData(
          updatedSensorData,
          todayStats,
          quietHoursEnabled,
          quietHoursStart,
          quietHoursEnd
        );
      }
    });

    listenersRef.current = [unsubHealthy, unsubDisease, unsubSettings, unsubTodayStats, unsubSensor];
  };

  // Initialize with WaterBottleService
  useEffect(() => {
    if (userId) {
      initializeNotifications();
    }
  }, [userId]);

  const initializeNotifications = async () => {
    try {
      if (auth.currentUser) {
        const service = new WaterBottleService(auth.currentUser.uid);
        waterBottleServiceRef.current = service;
        
        const [stats, latestReading] = await Promise.all([
          service.getTodayStats(),
          service.getLatestReading()
        ]);
        
        setTodayStats(stats);

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

        // Initialize notification manager with current data
        notificationManager.updateFromSensorData(
          updatedSensorData,
          stats,
          quietHoursEnabled,
          quietHoursStart,
          quietHoursEnd
        );
      }
    } catch (error) {
      console.error('❌ Failed to initialize notifications:', error);
    }
  };

  // Update notifications when quiet hours settings change
  useEffect(() => {
    if (sensorData && todayStats) {
      notificationManager.updateFromSensorData(
        sensorData,
        todayStats,
        quietHoursEnabled,
        quietHoursStart,
        quietHoursEnd
      );
    }
  }, [quietHoursEnabled, quietHoursStart, quietHoursEnd]);

  // Countdown timers
  useEffect(() => {
    if (!allNotificationsEnabled) return;

    const interval = setInterval(() => {
      if (healthyEnabled && healthyNextReminder) {
        setHealthyCountdown(calculateCountdown(healthyNextReminder));
      } else {
        setHealthyCountdown('');
      }

      if (diseaseEnabled && diseaseNextReminder) {
        setDiseaseCountdown(calculateCountdown(diseaseNextReminder));
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

    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${seconds}s`;
  };

  const calculateIntake = (goal, gap) => {
    if (!goal || !gap || goal <= 0 || gap <= 0) return 0;
    const numberOfReminders = Math.floor(WAKING_HOURS / gap);
    return Math.ceil((goal / numberOfReminders) / 10) * 10;
  };

  const scheduleHealthyNotifications = async (gapHours, intakeAmount) => {
    if (!notificationsAvailable || !healthyEnabled || !allNotificationsEnabled) return false;

    const gapInSeconds = gapHours * 60 * 60;
    const nextTime = new Date().getTime() + (gapInSeconds * 1000);
    setHealthyNextReminder(nextTime);

    const success = await notificationManager.scheduleHydrationReminders({
      type: 'healthy',
      goal: healthyGoal,
      gapHours,
      intakeAmount,
      userId
    });

    if (success) {
      await update(ref(database, `users/${userId}/profile`), {
        nextReminderTime: nextTime,
        lastScheduledAt: Date.now(),
      });
    }

    return success;
  };

  const scheduleDiseaseNotifications = async (gapHours, intakeAmount, conditionName) => {
    if (!notificationsAvailable || !diseaseEnabled || !allNotificationsEnabled) return false;

    const gapInSeconds = gapHours * 60 * 60;
    const nextTime = new Date().getTime() + (gapInSeconds * 1000);
    setDiseaseNextReminder(nextTime);

    const success = await notificationManager.scheduleHydrationReminders({
      type: 'disease',
      goal: diseaseGoal,
      gapHours,
      intakeAmount,
      conditionName,
      userId
    });

    if (success) {
      await update(ref(database, `users/${userId}/diseaseProfile`), {
        nextReminderTime: nextTime,
        lastScheduledAt: Date.now(),
      });
    }

    return success;
  };

  const handleHealthyToggle = async (value) => {
    setHealthyEnabled(value);

    if (userId) {
      await update(ref(database, `users/${userId}/profile`), {
        notificationsEnabled: value,
      });

      if (!value) {
        await notificationManager.cancelScheduledReminders('healthy');
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

      if (!value) {
        await notificationManager.cancelScheduledReminders('disease');
        setDiseaseNextReminder(null);
      } else if (value && diseaseGoal > 0 && diseaseName) {
        const intake = calculateIntake(diseaseGoal, diseaseGap);
        await scheduleDiseaseNotifications(diseaseGap, intake, diseaseName);
      }
    }
  };

  const handleRescheduleAll = async () => {
    if (!notificationsAvailable || !allNotificationsEnabled) {
      Alert.alert("Notifications Disabled", "Enable notifications first.");
      return;
    }

    if (!notificationPermission) {
      Alert.alert(
        "Permission Required", 
        "Grant notification permissions to schedule reminders.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Grant", onPress: requestNotificationPermissions }
        ]
      );
      return;
    }

    let scheduled = 0;

    if (healthyEnabled && healthyGoal > 0) {
      const intake = calculateIntake(healthyGoal, healthyGap);
      if (await scheduleHealthyNotifications(healthyGap, intake)) scheduled++;
    }

    if (diseaseEnabled && diseaseGoal > 0 && diseaseName) {
      const intake = calculateIntake(diseaseGoal, diseaseGap);
      if (await scheduleDiseaseNotifications(diseaseGap, intake, diseaseName)) scheduled++;
    }

    if (scheduled > 0) {
      Alert.alert("✅ Success", `Scheduled ${scheduled} plan(s).`);
    } else {
      Alert.alert("No Plans", "Set up hydration plans first.");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await initializeNotifications();
    setRefreshing(false);
  };

  const dismissNotification = (id, addToHistory = true) => {
    if (notificationManager.removeNotification(id)) {
      if (addToHistory) {
        const dismissed = notifications.find(n => n.id === id);
        if (dismissed) {
          setNotificationHistory(prev => [{
            ...dismissed,
            dismissedAt: new Date(),
          }, ...prev].slice(0, 50));
        }
      }
    }
  };

  const snoozeNotification = async (notification, minutes) => {
    dismissNotification(notification.id, false);

    if (notificationsAvailable) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: notification.title,
            body: notification.message + ' (Snoozed)',
            sound: true,
          },
          trigger: { seconds: minutes * 60 }
        });

        Alert.alert("⏰ Snoozed", `Reminder snoozed for ${minutes} min`);
      } catch (error) {
        console.error('Snooze error:', error);
      }
    }
  };

  const showSnoozeOptions = (notification) => {
    Alert.alert(
      "⏰ Snooze Reminder",
      "How long?",
      [
        { text: "10 min", onPress: () => snoozeNotification(notification, 10) },
        { text: "30 min", onPress: () => snoozeNotification(notification, 30) },
        { text: "1 hour", onPress: () => snoozeNotification(notification, 60) },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getNotificationStyle = (type) => {
    const colors = {
      critical: theme.error || '#f44336',
      warning: theme.warning || '#FF9800',
      success: theme.success || '#4CAF50',
      info: theme.primary || '#2196F3'
    };
    const color = colors[type] || colors.info;
    return {
      borderColor: color,
      backgroundColor: `${color}15`
    };
  };

  const getIconColor = (type) => {
    const colors = {
      critical: theme.error || '#f44336',
      warning: theme.warning || '#FF9800',
      success: theme.success || '#4CAF50',
      info: theme.primary || '#2196F3'
    };
    return colors[type] || colors.info;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const diff = new Date() - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return timestamp.toLocaleDateString();
  };

  const filteredNotifications = notifications.filter(notif => {
    if (filterType === 'all') return true;
    if (filterType === 'critical') return notif.notificationType === 'critical';
    if (filterType === 'info') return notif.notificationType === 'info' || notif.notificationType === 'success';
    return true;
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      notificationManager.cleanup();
    };
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textMuted }]}>
          Loading...
        </Text>
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Ionicons name="lock-closed" size={64} color={theme.text} style={{ opacity: 0.3 }} />
        <Text style={[styles.text, { color: theme.text, marginTop: 16 }]}>
          Please sign in
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.mainContainer, { backgroundColor: theme.background }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary || '#2196F3']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="notifications" size={32} color={theme.accent || '#0D9488'} />
          <Text style={[styles.title, { color: theme.text }]}>Notification Center</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
            Real-time hydration alerts
          </Text>
        </View>

        {/* Quick Stats with real-time indicator */}
        <View style={[styles.stats, { backgroundColor: theme.card }]}>
          <View style={styles.stat}>
            <View style={styles.statWithBadge}>
              <Text style={[styles.statNum, { color: theme.primary }]}>
                {notifications.length}
              </Text>
              {notifications.some(n => n.sensorBased) && (
                <View style={[styles.liveBadge, { backgroundColor: theme.error }]}>
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
              )}
            </View>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Active</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: theme.success }]}>
              {notificationHistory.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>History</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.stat}>
            <Ionicons 
              name={quietHoursEnabled && notificationManager.isInQuietHours(new Date().getHours(), quietHoursStart, quietHoursEnd) ? "moon" : "sunny"} 
              size={24} 
              color={quietHoursEnabled && notificationManager.isInQuietHours(new Date().getHours(), quietHoursStart, quietHoursEnd) ? theme.warning : theme.accent} 
            />
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>
              {quietHoursEnabled && notificationManager.isInQuietHours(new Date().getHours(), quietHoursStart, quietHoursEnd) ? 'Quiet' : 'Active'}
            </Text>
          </View>
        </View>

        {/* Real-time sync indicator */}
        {sensorData.isConnected && (
          <View style={[styles.syncIndicator, { backgroundColor: theme.card }]}>
            <View style={[styles.syncDot, { backgroundColor: theme.success }]} />
            <Text style={[styles.syncText, { color: theme.text }]}>
              Real-time sensor monitoring active
            </Text>
            <Ionicons name="sync" size={16} color={theme.success} />
          </View>
        )}

        {/* Warnings */}
        {!notificationsAvailable && (
          <View style={[styles.warning, { backgroundColor: '#F59E0B' }]}>
            <Ionicons name="alert-circle" size={24} color="#FFF" />
            <Text style={styles.warningText}>Notifications unavailable</Text>
          </View>
        )}

        {notificationsAvailable && !notificationPermission && (
          <View style={[styles.warning, { backgroundColor: '#EF4444' }]}>
            <Ionicons name="alert-circle" size={24} color="#FFF" />
            <Text style={styles.warningText}>Permission required</Text>
            <TouchableOpacity
              style={styles.permBtn}
              onPress={requestNotificationPermissions}
            >
              <Text style={styles.permBtnText}>Grant</Text>
            </TouchableOpacity>
          </View>
        )}

        {!allNotificationsEnabled && (
          <View style={[styles.warning, { backgroundColor: '#6B7280' }]}>
            <Ionicons name="notifications-off" size={24} color="#FFF" />
            <Text style={styles.warningText}>Notifications disabled</Text>
          </View>
        )}

        {/* Quiet Hours Banner */}
        {quietHoursEnabled && notificationManager.isInQuietHours(new Date().getHours(), quietHoursStart, quietHoursEnd) && (
          <TouchableOpacity 
            style={[styles.banner, { backgroundColor: theme.card }]}
            onPress={() => setShowQuietHoursModal(true)}
          >
            <Ionicons name="moon" size={20} color={theme.warning} />
            <Text style={[styles.bannerText, { color: theme.text }]}>
              🌙 Quiet Hours ({quietHoursStart}:00-{quietHoursEnd}:00)
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
          </TouchableOpacity>
        )}

        {/* Device Info */}
        {notificationsAvailable && Device && (
          <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
            <Ionicons
              name={Device.isDevice ? "phone-portrait" : "desktop"}
              size={20}
              color={theme.accent}
            />
            <Text style={[styles.infoText, { color: theme.text }]}>
              {Device.isDevice
                ? '📱 Physical Device - Full Push'
                : '💻 Emulator - Local Only'}
            </Text>
          </View>
        )}

        {/* Healthy Hydration Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection('healthy')}
          >
            <View style={styles.sectionLeft}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                💧 Healthy Hydration
              </Text>
              {healthyEnabled && healthyCountdown && (
                <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
                  Next: {healthyCountdown}
                </Text>
              )}
            </View>
            <Ionicons 
              name={collapsedSections.healthy ? "chevron-down" : "chevron-up"} 
              size={24} 
              color={theme.textMuted} 
            />
          </TouchableOpacity>

          {!collapsedSections.healthy && (
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    Daily Plan
                  </Text>
                  <Text style={[styles.cardDetails, { color: theme.textMuted }]}>
                    {healthyGoal > 0
                      ? `${healthyGoal}ml • ${healthyGap}h • ${calculateIntake(healthyGoal, healthyGap)}ml/reminder`
                      : 'Not configured'}
                  </Text>
                </View>
                <Switch
                  value={healthyEnabled && allNotificationsEnabled}
                  onValueChange={handleHealthyToggle}
                  trackColor={{ false: '#374151', true: '#0D9488' }}
                  thumbColor={healthyEnabled ? '#FFF' : '#9CA3AF'}
                  disabled={!notificationsAvailable || !notificationPermission || !allNotificationsEnabled}
                />
              </View>

              {healthyEnabled && allNotificationsEnabled && healthyNextReminder && (
                <View style={[styles.countdown, { backgroundColor: '#0D9488' }]}>
                  <Ionicons name="timer" size={20} color="#FFF" />
                  <View style={styles.countdownInfo}>
                    <Text style={styles.countdownLabel}>Next:</Text>
                    <Text style={styles.countdownTime}>{healthyCountdown}</Text>
                    <Text style={styles.countdownAmount}>
                      {calculateIntake(healthyGoal, healthyGap)}ml
                    </Text>
                  </View>
                </View>
              )}

              {healthyGoal === 0 && (
                <View style={[styles.setup, { backgroundColor: '#374151' }]}>
                  <Ionicons name="information-circle" size={20} color="#6B7280" />
                  <Text style={[styles.setupText, { color: theme.textMuted }]}>
                    Configure in 'Customize Hydration'
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Disease Hydration Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection('disease')}
          >
            <View style={styles.sectionLeft}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                💊 Medical Hydration
              </Text>
              {diseaseEnabled && diseaseCountdown && (
                <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
                  Next: {diseaseCountdown}
                </Text>
              )}
            </View>
            <Ionicons 
              name={collapsedSections.disease ? "chevron-down" : "chevron-up"} 
              size={24} 
              color={theme.textMuted} 
            />
          </TouchableOpacity>

          {!collapsedSections.disease && (
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    Medical Plan
                  </Text>
                  <Text style={[styles.cardDetails, { color: theme.textMuted }]}>
                    {diseaseGoal > 0 && diseaseName
                      ? `${diseaseName} • ${diseaseGoal}ml • ${diseaseGap}h`
                      : 'Not configured'}
                  </Text>
                </View>
                <Switch
                  value={diseaseEnabled && allNotificationsEnabled}
                  onValueChange={handleDiseaseToggle}
                  trackColor={{ false: '#374151', true: '#DC2626' }}
                  thumbColor={diseaseEnabled ? '#FFF' : '#9CA3AF'}
                  disabled={!notificationsAvailable || !notificationPermission || !allNotificationsEnabled}
                />
              </View>

              {diseaseEnabled && allNotificationsEnabled && diseaseNextReminder && (
                <View style={[styles.countdown, { backgroundColor: '#DC2626' }]}>
                  <Ionicons name="medical" size={20} color="#FFF" />
                  <View style={styles.countdownInfo}>
                    <Text style={styles.countdownLabel}>Next:</Text>
                    <Text style={styles.countdownTime}>{diseaseCountdown}</Text>
                    <Text style={styles.countdownAmount}>
                      {diseaseName}: {calculateIntake(diseaseGoal, diseaseGap)}ml
                    </Text>
                  </View>
                </View>
              )}

              {diseaseGoal === 0 && (
                <View style={[styles.setup, { backgroundColor: '#374151' }]}>
                  <Ionicons name="information-circle" size={20} color="#6B7280" />
                  <Text style={[styles.setupText, { color: theme.textMuted }]}>
                    Configure in 'Customize Hydration'
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Smart Alerts with sensor badge */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection('smart')}
          >
            <View style={styles.sectionLeft}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                📬 Smart Alerts ({filteredNotifications.length})
              </Text>
              {filteredNotifications.some(n => n.sensorBased) && (
                <Text style={[styles.sensorBadge, { color: theme.error }]}>
                  • {filteredNotifications.filter(n => n.sensorBased).length} from sensors
                </Text>
              )}
            </View>
            <Ionicons 
              name={collapsedSections.smart ? "chevron-down" : "chevron-up"} 
              size={24} 
              color={theme.textMuted} 
            />
          </TouchableOpacity>

          {!collapsedSections.smart && (
            <>
              {/* Filters */}
              <View style={styles.filters}>
                {['all', 'critical', 'info'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.filter,
                      { borderColor: theme.border },
                      filterType === type && { backgroundColor: theme.primary, borderColor: theme.primary }
                    ]}
                    onPress={() => setFilterType(type)}
                  >
                    <Text style={[
                      styles.filterText,
                      { color: filterType === type ? '#FFF' : theme.text }
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Notifications */}
              {filteredNotifications.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="checkmark-circle-outline" size={64} color={theme.success} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>All Set!</Text>
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                    No alerts. Keep hydrating! 💧
                  </Text>
                  {notificationHistory.length > 0 && (
                    <TouchableOpacity
                      style={[styles.histBtn, { borderColor: theme.primary }]}
                      onPress={() => setShowHistoryModal(true)}
                    >
                      <Ionicons name="time-outline" size={16} color={theme.primary} />
                      <Text style={[styles.histBtnText, { color: theme.primary }]}>
                        History ({notificationHistory.length})
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                filteredNotifications.map((notif) => (
                  <View
                    key={notif.id}
                    style={[
                      styles.notif,
                      getNotificationStyle(notif.notificationType),
                      { backgroundColor: theme.card }
                    ]}
                  >
                    <View style={styles.notifContent}>
                      <View style={styles.notifIconContainer}>
                        <Ionicons
                          name={notif.icon}
                          size={24}
                          color={getIconColor(notif.notificationType)}
                        />
                        {notif.sensorBased && (
                          <View style={[styles.sensorDot, { backgroundColor: theme.error }]} />
                        )}
                      </View>
                      
                      <View style={styles.notifText}>
                        <View style={styles.notifTitleRow}>
                          <Text style={[styles.notifTitle, { color: theme.text }]}>
                            {notif.title}
                          </Text>
                          {notif.updated && (
                            <Text style={[styles.updatedBadge, { color: theme.warning }]}>
                              UPDATED
                            </Text>
                          )}
                        </View>
                        <Text style={[styles.notifMsg, { color: theme.textMuted }]}>
                          {notif.message}
                        </Text>
                        <Text style={[styles.notifTime, { color: theme.textMuted }]}>
                          {formatTimestamp(notif.timestamp)}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.dismiss}
                        onPress={() => dismissNotification(notif.id)}
                      >
                        <Ionicons name="close" size={20} color={theme.textMuted} />
                      </TouchableOpacity>
                    </View>

                    {(notif.actionable || notif.snoozeable) && (
                      <View style={styles.actions}>
                        {notif.snoozeable && (
                          <TouchableOpacity
                            style={[styles.btn, { borderColor: theme.warning, flex: 1, marginRight: 8 }]}
                            onPress={() => showSnoozeOptions(notif)}
                          >
                            <Ionicons name="time-outline" size={16} color={theme.warning} />
                            <Text style={[styles.btnText, { color: theme.warning }]}>Snooze</Text>
                          </TouchableOpacity>
                        )}
                        
                        {notif.actionable && (
                          <TouchableOpacity
                            style={[styles.btn, { borderColor: getIconColor(notif.notificationType), flex: 1 }]}
                            onPress={() => {
                              dismissNotification(notif.id);
                              if (notif.action === 'celebrate') {
                                Alert.alert("🎉 Amazing!", "You achieved your goal!");
                              }
                            }}
                          >
                            <Text style={[styles.btnText, { color: getIconColor(notif.notificationType) }]}>
                              {notif.action === 'refill' ? 'Refilled' : 
                               notif.action === 'celebrate' ? 'View' : 'Done'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                ))
              )}
            </>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {/* Automatic System Status */}
          <View style={[styles.autoStatusCard, { backgroundColor: theme.success + '15', borderColor: theme.success }]}>
            <View style={styles.autoStatusHeader}>
              <Ionicons name="checkmark-circle" size={24} color={theme.success} />
              <Text style={[styles.autoStatusTitle, { color: theme.success }]}>
                Automatic Reminders Active
              </Text>
            </View>
            <Text style={[styles.autoStatusText, { color: theme.textMuted }]}>
              System automatically tracks your intake and notifies you only when needed
            </Text>
            {(healthyEnabled || diseaseEnabled) && (
              <View style={styles.autoStatusDetails}>
                <Ionicons name="pulse" size={16} color={theme.accent} />
                <Text style={[styles.autoStatusSmall, { color: theme.accent }]}>
                  {healthyEnabled && diseaseEnabled 
                    ? 'Both plans active'
                    : healthyEnabled 
                    ? 'Healthy plan active'
                    : 'Medical plan active'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionHalf, { backgroundColor: '#374151' }]}
              onPress={async () => {
                if (notificationsAvailable) {
                  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
                  Alert.alert("Scheduled", `${scheduled.length} notifications.`);
                }
              }}
            >
              <Ionicons name="list" size={20} color="#FFF" />
              <Text style={styles.actionBtnText}>View</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionHalf, { backgroundColor: theme.warning }]}
              onPress={() => setShowQuietHoursModal(true)}
            >
              <Ionicons name="moon" size={20} color="#FFF" />
              <Text style={styles.actionBtnText}>Quiet</Text>
            </TouchableOpacity>
          </View>

          {notificationHistory.length > 0 && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.primary }]}
              onPress={() => setShowHistoryModal(true)}
            >
              <Ionicons name="time-outline" size={20} color="#FFF" />
              <Text style={styles.actionBtnText}>
                History ({notificationHistory.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Help */}
        <View style={[styles.help, { backgroundColor: theme.card }]}>
          <Ionicons name="help-circle" size={24} color={theme.accent} />
          <Text style={[styles.helpTitle, { color: theme.text }]}>How It Works</Text>
          <Text style={[styles.helpText, { color: theme.textMuted }]}>
            • Set up in 'Customize Hydration'{'\n'}
            • Toggle plans on/off{'\n'}
            • Use Quiet Hours for sleep{'\n'}
            • Snooze when needed{'\n'}
            • Real-time sensor updates
          </Text>
        </View>

      </ScrollView>

      {/* History Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showHistoryModal}
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalBg}>
          <View style={[styles.modal, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                History
              </Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <Ionicons name="close" size={28} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {notificationHistory.length === 0 ? (
                <View style={styles.modalEmpty}>
                  <Ionicons name="time-outline" size={48} color={theme.textMuted} />
                  <Text style={[styles.modalEmptyText, { color: theme.textMuted }]}>
                    No history
                  </Text>
                </View>
              ) : (
                notificationHistory.map((notif, idx) => (
                  <View key={idx} style={[styles.histItem, { borderBottomColor: theme.border }]}>
                    <View style={styles.histHeader}>
                      <Ionicons name={notif.icon} size={20} color={getIconColor(notif.notificationType)} />
                      <Text style={[styles.histTitle, { color: theme.text }]}>
                        {notif.title}
                      </Text>
                    </View>
                    <Text style={[styles.histMsg, { color: theme.textMuted }]}>
                      {notif.message}
                    </Text>
                    <Text style={[styles.histTime, { color: theme.textMuted }]}>
                      {formatTimestamp(notif.dismissedAt)}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            {notificationHistory.length > 0 && (
              <TouchableOpacity
                style={[styles.clearBtn, { backgroundColor: theme.error }]}
                onPress={() => {
                  Alert.alert(
                    "Clear History",
                    "Are you sure?",
                    [
                      { text: "Cancel", style: "cancel" },
                      { 
                        text: "Clear",
                        onPress: () => {
                          setNotificationHistory([]);
                          setShowHistoryModal(false);
                        }
                      }
                    ]
                  );
                }}
              >
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Quiet Hours Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showQuietHoursModal}
        onRequestClose={() => setShowQuietHoursModal(false)}
      >
        <View style={styles.modalBg}>
          <View style={[styles.modal, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                🌙 Quiet Hours
              </Text>
              <TouchableOpacity onPress={() => setShowQuietHoursModal(false)}>
                <Ionicons name="close" size={28} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.toggle}>
                <Text style={[styles.toggleText, { color: theme.text }]}>
                  Enable Quiet Hours
                </Text>
                <Switch
                  value={quietHoursEnabled}
                  onValueChange={async (value) => {
                    setQuietHoursEnabled(value);
                    if (userId) {
                      await update(ref(database, `users/${userId}/quietHours`), {
                        enabled: value
                      });
                    }
                  }}
                  trackColor={{ false: '#374151', true: theme.primary }}
                  thumbColor={quietHoursEnabled ? '#FFF' : '#9CA3AF'}
                />
              </View>

              <Text style={[styles.desc, { color: theme.textMuted }]}>
                Suppress non-critical notifications during sleep hours. Medical alerts will always show.
              </Text>

              {/* Start Time Picker */}
              <View style={styles.timeSection}>
                <View style={styles.timeSectionHeader}>
                  <Ionicons name="moon" size={20} color={theme.primary} />
                  <Text style={[styles.timeSectionTitle, { color: theme.text }]}>
                    Start Time (Sleep)
                  </Text>
                </View>
                
                <View style={styles.timePicker}>
                  {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                    <TouchableOpacity
                      key={`start-${hour}`}
                      style={[
                        styles.timeOption,
                        { 
                          backgroundColor: quietHoursStart === hour 
                            ? theme.primary 
                            : theme.background,
                          borderColor: theme.border
                        }
                      ]}
                      onPress={async () => {
                        setQuietHoursStart(hour);
                        if (userId) {
                          await update(ref(database, `users/${userId}/quietHours`), {
                            start: hour
                          });
                        }
                      }}
                    >
                      <Text style={[
                        styles.timeOptionText,
                        { color: quietHoursStart === hour ? '#FFF' : theme.text }
                      ]}>
                        {hour.toString().padStart(2, '0')}:00
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* End Time Picker */}
              <View style={styles.timeSection}>
                <View style={styles.timeSectionHeader}>
                  <Ionicons name="sunny" size={20} color={theme.warning} />
                  <Text style={[styles.timeSectionTitle, { color: theme.text }]}>
                    End Time (Wake Up)
                  </Text>
                </View>
                
                <View style={styles.timePicker}>
                  {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                    <TouchableOpacity
                      key={`end-${hour}`}
                      style={[
                        styles.timeOption,
                        { 
                          backgroundColor: quietHoursEnd === hour 
                            ? theme.warning 
                            : theme.background,
                          borderColor: theme.border
                        }
                      ]}
                      onPress={async () => {
                        setQuietHoursEnd(hour);
                        if (userId) {
                          await update(ref(database, `users/${userId}/quietHours`), {
                            end: hour
                          });
                        }
                      }}
                    >
                      <Text style={[
                        styles.timeOptionText,
                        { color: quietHoursEnd === hour ? '#FFF' : theme.text }
                      ]}>
                        {hour.toString().padStart(2, '0')}:00
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Preview */}
              <View style={[styles.preview, { backgroundColor: theme.background }]}>
                <Ionicons name="information-circle" size={20} color={theme.accent} />
                <View style={styles.previewText}>
                  <Text style={[styles.previewTitle, { color: theme.text }]}>
                    Your Schedule
                  </Text>
                  <Text style={[styles.previewDetails, { color: theme.textMuted }]}>
                    Sleep: {quietHoursStart.toString().padStart(2, '0')}:00 - {quietHoursEnd.toString().padStart(2, '0')}:00
                    {'\n'}
                    Active: {quietHoursEnd.toString().padStart(2, '0')}:00 - {quietHoursStart.toString().padStart(2, '0')}:00
                  </Text>
                  {quietHoursStart > quietHoursEnd && (
                    <Text style={[styles.previewNote, { color: theme.warning }]}>
                      ⚠️ Overnight schedule (crosses midnight)
                    </Text>
                  )}
                </View>
              </View>

              {/* Examples */}
              <View style={styles.examples}>
                <Text style={[styles.examplesTitle, { color: theme.text }]}>
                  Common Schedules:
                </Text>
                
                <TouchableOpacity
                  style={[styles.exampleOption, { backgroundColor: theme.background }]}
                  onPress={async () => {
                    setQuietHoursStart(22);
                    setQuietHoursEnd(7);
                    if (userId) {
                      await update(ref(database, `users/${userId}/quietHours`), {
                        start: 22,
                        end: 7
                      });
                    }
                  }}
                >
                  <Text style={[styles.exampleTime, { color: theme.primary }]}>
                    22:00 - 07:00
                  </Text>
                  <Text style={[styles.exampleLabel, { color: theme.textMuted }]}>
                    Standard (9 hours)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.exampleOption, { backgroundColor: theme.background }]}
                  onPress={async () => {
                    setQuietHoursStart(23);
                    setQuietHoursEnd(7);
                    if (userId) {
                      await update(ref(database, `users/${userId}/quietHours`), {
                        start: 23,
                        end: 7
                      });
                    }
                  }}
                >
                  <Text style={[styles.exampleTime, { color: theme.primary }]}>
                    23:00 - 07:00
                  </Text>
                  <Text style={[styles.exampleLabel, { color: theme.textMuted }]}>
                    Night Owl (8 hours)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.exampleOption, { backgroundColor: theme.background }]}
                  onPress={async () => {
                    setQuietHoursStart(21);
                    setQuietHoursEnd(6);
                    if (userId) {
                      await update(ref(database, `users/${userId}/quietHours`), {
                        start: 21,
                        end: 6
                      });
                    }
                  }}
                >
                  <Text style={[styles.exampleTime, { color: theme.primary }]}>
                    21:00 - 06:00
                  </Text>
                  <Text style={[styles.exampleLabel, { color: theme.textMuted }]}>
                    Early Bird (9 hours)
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.note, { color: theme.warning, backgroundColor: 'rgba(255, 193, 7, 0.1)' }]}>
                💡 Critical medical alerts always show regardless of quiet hours
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.primary }]}
              onPress={() => setShowQuietHoursModal(false)}
            >
              <Text style={styles.saveBtnText}>Save & Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16 },
  text: { fontSize: 16 },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginTop: 12 },
  subtitle: { fontSize: 14, marginTop: 4 },
  stats: { flexDirection: 'row', padding: 16, borderRadius: 12, marginBottom: 16, justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statWithBadge: { position: 'relative', alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: 'bold' },
  statLabel: { fontSize: 12, marginTop: 4 },
  divider: { width: 1, height: 40 },
  liveBadge: { position: 'absolute', top: -8, right: -20, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  liveBadgeText: { color: '#FFF', fontSize: 8, fontWeight: 'bold' },
  syncIndicator: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 16, gap: 8 },
  syncDot: { width: 8, height: 8, borderRadius: 4 },
  syncText: { flex: 1, fontSize: 13, fontWeight: '500' },
  warning: { padding: 16, borderRadius: 12, marginBottom: 16, alignItems: 'center' },
  warningText: { color: '#FFF', fontSize: 14, fontWeight: '600', marginTop: 8 },
  permBtn: { backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 12 },
  permBtnText: { color: '#EF4444', fontWeight: 'bold' },
  banner: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 16, gap: 8 },
  bannerText: { flex: 1, fontSize: 14, fontWeight: '500' },
  infoCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 16, gap: 8 },
  infoText: { fontSize: 13, fontWeight: '500' },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLeft: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  sectionSub: { fontSize: 12, marginTop: 2 },
  sensorBadge: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#374151' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardDetails: { fontSize: 12 },
  countdown: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginTop: 12, gap: 10 },
  countdownInfo: { flex: 1 },
  countdownLabel: { color: '#FFF', fontSize: 12, opacity: 0.9 },
  countdownTime: { color: '#FFF', fontSize: 24, fontWeight: 'bold', marginVertical: 2 },
  countdownAmount: { color: '#FFF', fontSize: 12, opacity: 0.9 },
  setup: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 10, borderRadius: 6 },
  setupText: { flex: 1, fontSize: 12 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filter: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  histBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  histBtnText: { fontSize: 14, fontWeight: '600' },
  notif: { borderRadius: 12, marginBottom: 12, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  notifContent: { flexDirection: 'row', padding: 16, alignItems: 'flex-start' },
  notifIconContainer: { position: 'relative', marginRight: 12, marginTop: 2 },
  sensorDot: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: '#FFF' },
  notifText: { flex: 1 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  notifTitle: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  updatedBadge: { fontSize: 9, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(255, 193, 7, 0.2)', borderRadius: 4 },
  notifMsg: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  notifTime: { fontSize: 12, marginTop: 4 },
  dismiss: { padding: 4 },
  actions: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, gap: 4 },
  btnText: { fontSize: 14, fontWeight: '600' },
  actionsContainer: { gap: 12, marginVertical: 20 },
  autoStatusCard: { 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12,
    borderWidth: 1,
    borderLeftWidth: 4
  },
  autoStatusHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 8 
  },
  autoStatusTitle: { 
    fontSize: 16, 
    fontWeight: '600' 
  },
  autoStatusText: { 
    fontSize: 14, 
    lineHeight: 20,
    marginBottom: 8
  },
  autoStatusDetails: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  autoStatusSmall: { 
    fontSize: 13, 
    fontWeight: '500' 
  },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 10, gap: 8 },
  actionHalf: { flex: 1 },
  actionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  help: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#374151' },
  helpTitle: { fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 8 },
  helpText: { fontSize: 13, lineHeight: 20 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#374151' },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalBody: { padding: 20, maxHeight: 400 },
  modalEmpty: { alignItems: 'center', paddingVertical: 40 },
  modalEmptyText: { marginTop: 12, fontSize: 14 },
  histItem: { paddingVertical: 12, borderBottomWidth: 1 },
  histHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  histTitle: { fontSize: 15, fontWeight: '600' },
  histMsg: { fontSize: 13, marginBottom: 4, marginLeft: 28 },
  histTime: { fontSize: 11, marginLeft: 28 },
  clearBtn: { margin: 20, marginTop: 0, padding: 14, borderRadius: 10, alignItems: 'center' },
  clearBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  toggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  toggleText: { fontSize: 16, fontWeight: '600' },
  desc: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  timeSection: { marginBottom: 24 },
  timeSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  timeSectionTitle: { fontSize: 15, fontWeight: '600' },
  timePicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeOption: { 
    paddingVertical: 10, 
    paddingHorizontal: 14, 
    borderRadius: 8, 
    borderWidth: 1,
    minWidth: 70,
    alignItems: 'center'
  },
  timeOptionText: { fontSize: 13, fontWeight: '600' },
  preview: { padding: 16, borderRadius: 12, marginBottom: 20, flexDirection: 'row', gap: 12 },
  previewText: { flex: 1 },
  previewTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  previewDetails: { fontSize: 13, lineHeight: 20 },
  previewNote: { fontSize: 12, marginTop: 8, fontWeight: '600' },
  examples: { marginBottom: 20 },
  examplesTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  exampleOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 8, marginBottom: 8 },
  exampleTime: { fontSize: 15, fontWeight: 'bold' },
  exampleLabel: { fontSize: 13 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 20 },
  timeItem: { alignItems: 'center' },
  timeLabel: { fontSize: 14, marginBottom: 8 },
  timeValue: { fontSize: 24, fontWeight: 'bold' },
  note: { fontSize: 13, lineHeight: 18, padding: 12, borderRadius: 8 },
  saveBtn: { margin: 20, marginTop: 0, padding: 14, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});