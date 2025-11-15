import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
import { ref, onValue, update } from 'firebase/database';
import { Ionicons } from '@expo/vector-icons';
import useTheme from '../../Theme/theme';

// Import auth from your existing Firebase config
import { auth } from '../../config/firebaseConfig';

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

  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState(false);

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

    return () => {
      unsubscribeHealthy();
      unsubscribeDisease();
    };
  }, [userId]);

  // Countdown timers
  useEffect(() => {
    if (!allNotificationsEnabled) return;

    const interval = setInterval(() => {
      // Update healthy countdown
      if (healthyEnabled && healthyNextReminder) {
        const countdown = calculateCountdown(healthyNextReminder);
        setHealthyCountdown(countdown);
      } else {
        setHealthyCountdown('');
      }

      // Update disease countdown
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

  // Calculate intake per reminder
  const calculateIntake = (goal, gap) => {
    if (!goal || !gap || goal <= 0 || gap <= 0) return 0;
    const numberOfReminders = Math.floor(WAKING_HOURS / gap);
    return Math.ceil((goal / numberOfReminders) / 10) * 10;
  };

  // Schedule healthy hydration notifications
  const scheduleHealthyNotifications = async (gapHours, intakeAmount) => {
    if (!notificationsAvailable || !healthyEnabled || !allNotificationsEnabled) return false;

    try {
      // Cancel existing healthy notifications
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

  // Schedule disease hydration notifications
  const scheduleDiseaseNotifications = async (gapHours, intakeAmount, conditionName) => {
    if (!notificationsAvailable || !diseaseEnabled || !allNotificationsEnabled) return false;

    try {
      // Cancel existing disease notifications
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

  // Handle master toggle
  const handleMasterToggle = async (value) => {
    setAllNotificationsEnabled(value);

    if (!value) {
      // Turn off all notifications
      if (notificationsAvailable) {
        await Notifications.cancelAllScheduledNotificationsAsync();
        console.log('🔕 All notifications cancelled');
      }

      // Update Firebase
      if (userId) {
        await update(ref(database, `users/${userId}/profile`), {
          notificationsEnabled: false,
        });
        await update(ref(database, `users/${userId}/diseaseProfile`), {
          notificationsEnabled: false,
        });
      }

      Alert.alert(
        "All Notifications Disabled",
        "All hydration reminders have been turned off. You can re-enable them anytime.",
        [{ text: "OK" }]
      );
    } else {
      Alert.alert(
        "Notifications Enabled",
        "Please go to 'Customize Hydration' tab to set up your reminders.",
        [{ text: "OK" }]
      );
    }
  };

  // Handle healthy toggle
  const handleHealthyToggle = async (value) => {
    setHealthyEnabled(value);

    if (userId) {
      await update(ref(database, `users/${userId}/profile`), {
        notificationsEnabled: value,
      });

      if (!value && notificationsAvailable) {
        // Cancel healthy notifications
        const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
        for (const notification of allScheduled) {
          if (notification.content.data?.type === 'hydration_reminder') {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
          }
        }
        setHealthyNextReminder(null);
      } else if (value && healthyGoal > 0) {
        // Reschedule
        const intake = calculateIntake(healthyGoal, healthyGap);
        await scheduleHealthyNotifications(healthyGap, intake);
      }
    }
  };

  // Handle disease toggle
  const handleDiseaseToggle = async (value) => {
    setDiseaseEnabled(value);

    if (userId) {
      await update(ref(database, `users/${userId}/diseaseProfile`), {
        notificationsEnabled: value,
      });

      if (!value && notificationsAvailable) {
        // Cancel disease notifications
        const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
        for (const notification of allScheduled) {
          if (notification.content.data?.type === 'disease_hydration_reminder') {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
          }
        }
        setDiseaseNextReminder(null);
      } else if (value && diseaseGoal > 0 && diseaseName) {
        // Reschedule
        const intake = calculateIntake(diseaseGoal, diseaseGap);
        await scheduleDiseaseNotifications(diseaseGap, intake, diseaseName);
      }
    }
  };

  // Reschedule all notifications
  const handleRescheduleAll = async () => {
    if (!notificationsAvailable || !allNotificationsEnabled) {
      Alert.alert("Notifications Disabled", "Please enable notifications first.");
      return;
    }

    if (!notificationPermission) {
      Alert.alert("Permission Required", "Please grant notification permissions.");
      return;
    }

    let scheduled = 0;

    // Reschedule healthy
    if (healthyEnabled && healthyGoal > 0) {
      const intake = calculateIntake(healthyGoal, healthyGap);
      const success = await scheduleHealthyNotifications(healthyGap, intake);
      if (success) scheduled++;
    }

    // Reschedule disease
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

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent || '#0D9488'} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading notifications...</Text>
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Ionicons name="lock-closed" size={64} color={theme.text} style={{ opacity: 0.3 }} />
        <Text style={[styles.text, { color: theme.text, marginTop: 16 }]}>Please sign in to manage notifications</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.scrollContainer, { backgroundColor: theme.background }]}>
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

        {/* Master Toggle */}
        <View style={[styles.masterToggleCard, { backgroundColor: theme.card || '#1F2937' }]}>
          <View style={styles.toggleHeader}>
            <Ionicons name="notifications-circle" size={28} color={theme.accent || '#0D9488'} />
            <View style={styles.toggleInfo}>
              <Text style={[styles.toggleTitle, { color: theme.text }]}>
                All Notifications
              </Text>
              <Text style={[styles.toggleDescription, { color: theme.secondaryText || '#9CA3AF' }]}>
                {allNotificationsEnabled ? 'Master switch ON' : 'All reminders disabled'}
              </Text>
            </View>
            <Switch
              value={allNotificationsEnabled}
              onValueChange={handleMasterToggle}
              trackColor={{ false: '#374151', true: theme.accent || '#0D9488' }}
              thumbColor={allNotificationsEnabled ? '#FFFFFF' : '#9CA3AF'}
              disabled={!notificationsAvailable || !notificationPermission}
            />
          </View>
        </View>

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
            • Enable notifications here to receive reminders{'\n'}
            • Toggle individual plans on/off as needed{'\n'}
            • Master switch controls all notifications at once{'\n'}
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
  masterToggleCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 30,
    borderWidth: 2,
    borderColor: '#0D9488',
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 13,
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
});