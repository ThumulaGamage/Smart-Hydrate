import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Switch } from 'react-native';
import { ref, onValue, update } from 'firebase/database';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

// Import auth and WaterBottleService from your existing Firebase config
import { auth, WaterBottleService } from '../../config/firebaseConfig';

// IMPORTING Theme, Utilities, and database from the main file
import {
    theme, AVAILABLE_GAPS, WAKING_HOURS,
    getTodayDateString, database
} from './customize-hydration';

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
  console.log('✅ Notifications module loaded successfully');
} catch (error) {
  console.log('⚠️ Notifications not available:', error.message);
}

export default function HealthyHydrationPlan() {
  const [dailyGoal, setDailyGoal] = useState('');
  const [reminderGap, setReminderGap] = useState(3);
  const [customGap, setCustomGap] = useState('');
  const [loading, setLoading] = useState(true);
  const [totalConsumed, setTotalConsumed] = useState(0);
  const [goalAchieved, setGoalAchieved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState(null);
  const [waterBottleService, setWaterBottleService] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(false);

  // Countdown timer states
  const [nextReminderTime, setNextReminderTime] = useState(null);
  const [timeUntilNext, setTimeUntilNext] = useState('');
  const [notificationsScheduled, setNotificationsScheduled] = useState(false);

  // Notification toggle state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Initialize Firestore directly
  const [firestoreDb, setFirestoreDb] = useState(null);

  useEffect(() => {
    // Initialize Firestore when component mounts
    try {
      const db = getFirestore(auth.app);
      setFirestoreDb(db);
      console.log('✅ Firestore initialized in component');
    } catch (error) {
      console.error('❌ Failed to initialize Firestore:', error);
    }
  }, []);

  // Request notification permissions
  useEffect(() => {
    if (notificationsAvailable) {
      registerForNotifications();
    }
  }, []);

  const registerForNotifications = async () => {
    if (!notificationsAvailable) {
      console.log('Notifications not available');
      return;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus === 'granted') {
        setNotificationPermission(true);
        console.log('✅ Notification permissions granted');

        if (Device && Device.isDevice) {
          console.log('📱 Running on physical device - Push notifications fully supported');
        } else {
          console.log('💻 Running on emulator - Using local notifications');
        }
      } else {
        setNotificationPermission(false);
        console.log('⚠️ Notification permissions denied');
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      setNotificationPermission(false);
    }
  };

  // Countdown timer effect
  useEffect(() => {
    if (!nextReminderTime || !notificationsEnabled) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = nextReminderTime - now;

      if (distance < 0) {
        setTimeUntilNext('Time for water! 💧');
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeUntilNext(`${hours}h ${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [nextReminderTime, notificationsEnabled]);

  // Wait for authentication
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
        console.log('User authenticated:', user.uid);

        const service = new WaterBottleService(user.uid);
        setWaterBottleService(service);

        // Load saved settings including notification preference
        loadUserSettings(user.uid);
      } else {
        setUserId(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load user settings including notification toggle
  const loadUserSettings = async (uid) => {
    const profileRef = ref(database, `users/${uid}/profile`);
    onValue(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();

        // Load notification preference
        if (data.notificationsEnabled !== undefined) {
          setNotificationsEnabled(data.notificationsEnabled);
        }

        // Load next reminder time
        if (data.nextReminderTime) {
          setNextReminderTime(data.nextReminderTime);
          setNotificationsScheduled(true);
        }
      }
    });
  };

  // Real-time listener for consumption data (ALWAYS WORKS regardless of notifications)
  useEffect(() => {
    if (!userId || !waterBottleService) {
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('🔄 Setting up real-time listeners for hydration plan...');

    // Listen to today's stats in real-time (ALWAYS ACTIVE)
    const unsubscribeTodayStats = waterBottleService.onTodayStats((stats) => {
      console.log('📊 Real-time stats update received:', stats);

      if (stats) {
        // Update total consumed (real-time from bottle) - ALWAYS WORKS
        const consumed = stats.totalConsumed || 0;
        setTotalConsumed(consumed);

        // Update goal if exists
        if (stats.goal !== undefined && stats.goal !== null) {
          setDailyGoal(String(stats.goal));
        }

        // Check if goal achieved
        const goal = stats.goal || 0;
        setGoalAchieved(consumed >= goal && goal > 0);
      } else {
        console.log('No stats found for today');
        setTotalConsumed(0);
        setGoalAchieved(false);
      }

      setLoading(false);
    });

    // Listen to profile for saved settings
    const profileRef = ref(database, `users/${userId}/profile`);
    const unsubscribeProfile = onValue(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log('📋 Profile data loaded:', data);

        if (data.dailyGoal) {
          setDailyGoal(String(data.dailyGoal));
        }
        if (data.reminderGap) {
          setReminderGap(data.reminderGap);
          if (data.reminderGap > 4) {
            setCustomGap(String(data.reminderGap));
          }
        }
        if (data.notificationsEnabled !== undefined) {
          setNotificationsEnabled(data.notificationsEnabled);
        }
      }
    });

    return () => {
      console.log('🧹 Cleaning up hydration plan listeners');
      if (unsubscribeTodayStats) unsubscribeTodayStats();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [userId, waterBottleService]);

  // Calculate intake per reminder
  const calculatedIntake = useMemo(() => {
    const goal = parseFloat(dailyGoal) || 0;
    const gap = parseInt(reminderGap) || 0;

    if (goal <= 0 || gap <= 0) {
      return { intake: 0, reminders: 0 };
    }

    const numberOfReminders = Math.floor(WAKING_HOURS / gap);
    const intakePerReminder = Math.ceil((goal / numberOfReminders) / 10) * 10;

    return { intake: intakePerReminder, reminders: numberOfReminders };
  }, [dailyGoal, reminderGap]);

  const handleCustomGap = (text) => {
    setCustomGap(text);
    const gapValue = parseInt(text) || 0;
    if (gapValue > 0 && gapValue <= WAKING_HOURS) {
      setReminderGap(gapValue);
    } else if (text === '') {
      setReminderGap(3);
      setCustomGap('');
    }
  };

  // Toggle notifications on/off
  const handleNotificationToggle = async (value) => {
    setNotificationsEnabled(value);

    if (userId) {
      try {
        // Save preference to Realtime Database
        await update(ref(database, `users/${userId}/profile`), {
          notificationsEnabled: value,
          lastUpdated: Date.now(),
        });

        // Save preference to Firestore
        if (firestoreDb) {
          const userDocRef = doc(firestoreDb, 'users', userId);
          try {
            await updateDoc(userDocRef, {
              'hydrationSettings.notificationsEnabled': value,
            });
            console.log('✅ Notification preference updated in Firestore');
          } catch (firestoreError) {
            console.log('⚠️ Firestore update failed:', firestoreError.message);
          }
        }

        if (!value) {
          // If turning off, cancel all scheduled notifications
          if (notificationsAvailable) {
            await Notifications.cancelAllScheduledNotificationsAsync();
            console.log('🔕 All notifications cancelled');
          }
          setNotificationsScheduled(false);
          setNextReminderTime(null);
        } else {
          // If turning on, reschedule if we have settings
          if (dailyGoal && reminderGap) {
            Alert.alert(
              "Notifications Enabled",
              "Please save your plan again to schedule reminders.",
              [{ text: "OK" }]
            );
          }
        }
      } catch (error) {
        console.error('Error updating notification preference:', error);
      }
    }
  };

  // Schedule notifications (works on both emulator and physical device)
  const scheduleHydrationNotifications = async (gapHours, intakeAmount) => {
    if (!notificationsAvailable || !notificationsEnabled) {
      console.log('⚠️ Notifications disabled or not available');
      return false;
    }

    try {
      // Cancel all existing notifications
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('🗑️ Cancelled all existing notifications');

      const gapInSeconds = gapHours * 60 * 60;
      const numberOfReminders = Math.floor(WAKING_HOURS / gapHours);

      // Calculate next reminder time
      const nextTime = new Date().getTime() + (gapInSeconds * 1000);
      setNextReminderTime(nextTime);
      setNotificationsScheduled(true);

      // Schedule notifications
      const isPhysicalDevice = Device && Device.isDevice;

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
              totalReminders: numberOfReminders,
            },
          },
          trigger: {
            seconds: gapInSeconds * (i + 1),
            repeats: false,
          },
        });
      }

      console.log(`✅ Scheduled ${numberOfReminders} notifications every ${gapHours} hours`);
      console.log(`📱 Device type: ${isPhysicalDevice ? 'Physical Device (Full Push)' : 'Emulator (Local)'}`);

      // Save to Realtime Database
      await update(ref(database, `users/${userId}/profile`), {
        nextReminderTime: nextTime,
        lastScheduledAt: Date.now(),
      });

      return true;
    } catch (error) {
      console.error('❌ Error scheduling notifications:', error);
      return false;
    }
  };

  const handleSave = async () => {
    if (!userId) {
      Alert.alert("Authentication Error", "Please wait for user authentication to complete.");
      return;
    }

    const goalValue = parseFloat(dailyGoal);
    if (!goalValue || goalValue <= 0) {
      Alert.alert("Invalid Goal", "Please enter a valid daily water goal (in ML).");
      return;
    }

    if (!reminderGap || reminderGap <= 0) {
      Alert.alert("Invalid Gap", "Please select a valid reminder gap.");
      return;
    }

    // Proceed with save regardless of notification settings
    await proceedWithSave(goalValue);
  };

  const proceedWithSave = async (goalValue) => {
    setIsSaving(true);

    try {
      const todayStr = getTodayDateString();
      const now = Date.now();

      console.log('💾 Starting save process...');
      console.log('Goal:', goalValue, 'Gap:', reminderGap);

      // 1. SAVE TO REALTIME DATABASE
      const profileRef = ref(database, `users/${userId}/profile`);
      await update(profileRef, {
        dailyGoal: goalValue,
        reminderGap: parseInt(reminderGap),
        notificationsEnabled: notificationsEnabled,
        lastUpdated: now,
        updatedAt: new Date().toISOString(),
      });

      // Update today's goal in dailyStats
      const dailyStatsRef = ref(database, `users/${userId}/dailyStats/${todayStr}`);
      await update(dailyStatsRef, {
        goal: goalValue,
        date: todayStr,
        lastUpdated: now,
      });

      console.log('✅ Goal saved to Realtime Database');

      // 2. SAVE TO FIRESTORE DATABASE
      if (firestoreDb) {
        try {
          console.log('🔄 Attempting Firestore update...');
          const userDocRef = doc(firestoreDb, 'users', userId);

          // Check if document exists first
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            console.log('📄 Firestore document exists, updating...');

            // Update existing document
            await updateDoc(userDocRef, {
              'hydrationSettings.dailyWaterGoal': goalValue,
              'hydrationSettings.reminderInterval': parseInt(reminderGap) * 60, // Convert hours to minutes
              'hydrationSettings.notificationsEnabled': notificationsEnabled,
            });

            console.log('✅ Goal saved to Firestore successfully!');
            console.log('   dailyWaterGoal:', goalValue);
            console.log('   reminderInterval:', parseInt(reminderGap) * 60, 'minutes');
          } else {
            console.log('⚠️ Firestore user document does not exist yet');
            console.log('   Document path: users/', userId);
            Alert.alert(
              "Firestore Not Configured",
              "Firestore user document doesn't exist. Create it in Firebase Console first.",
              [{ text: "OK" }]
            );
          }
        } catch (firestoreError) {
          console.error('❌ Firestore update error:', firestoreError);
          console.error('   Error code:', firestoreError.code);
          console.error('   Error message:', firestoreError.message);
          // Don't fail the entire save if Firestore fails
        }
      } else {
        console.log('⚠️ Firestore DB not initialized');
      }

      // Only schedule notifications if enabled
      let notificationScheduled = false;
      if (notificationsEnabled && notificationsAvailable && notificationPermission) {
        notificationScheduled = await scheduleHydrationNotifications(
          parseInt(reminderGap),
          calculatedIntake.intake
        );
      }

      // Show appropriate success message
      let alertTitle = "Plan Saved! 🎉";
      let alertMessage = `Your daily water goal of ${goalValue}ml has been saved!\n\n` +
                        `💧 Drink ${calculatedIntake.intake}ml every ${reminderGap} hours\n` +
                        `📊 ${calculatedIntake.reminders} reminders per day\n\n`;

      if (notificationScheduled) {
        const nextReminderDate = new Date(nextReminderTime);
        const timeString = nextReminderDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
        alertMessage += `⏱️ First reminder at: ${timeString}\n\n`;

        if (Device && Device.isDevice) {
          alertMessage += `📱 Push notifications active on your device!`;
        } else {
          alertMessage += `💻 Local notifications active (works on emulator)`;
        }
      } else if (!notificationsEnabled) {
        alertMessage += `🔕 Notifications are OFF\nYou can enable them anytime using the toggle switch above.`;
      } else if (!notificationsAvailable) {
        alertMessage += `⚠️ To enable notifications:\nnpx expo install expo-notifications`;
      } else if (!notificationPermission) {
        alertMessage += `⚠️ Notification permissions not granted`;
      }

      Alert.alert(alertTitle, alertMessage, [{ text: "OK" }]);

    } catch (error) {
      console.error("❌ Failed to save plan:", error);
      Alert.alert("Save Error", `Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const currentGoal = parseFloat(dailyGoal) || 0;
  const progressPercentage = currentGoal > 0 ? Math.min(100, (totalConsumed / currentGoal) * 100) : 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading Hydration Plan...</Text>
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Please sign in to continue</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.planScrollView} contentContainerStyle={styles.planScrollContent}>
      <View style={styles.planContainer}>
        <Text style={[styles.planTitle, { color: theme.primaryText }]}>Set Your Daily Hydration Plan</Text>

        {/* Notification Toggle Switch */}
        <View style={[styles.toggleCard, { backgroundColor: theme.secondary }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={[styles.toggleTitle, { color: theme.primaryText }]}>
                🔔 Reminder Notifications
              </Text>
              <Text style={[styles.toggleDescription, { color: theme.secondaryText }]}>
                {notificationsEnabled
                  ? 'You will receive hydration reminders'
                  : 'Notifications are turned off'}
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: '#374151', true: theme.accent }}
              thumbColor={notificationsEnabled ? '#FFFFFF' : '#9CA3AF'}
              ios_backgroundColor="#374151"
            />
          </View>
          {!notificationsAvailable && (
            <Text style={[styles.toggleWarning, { color: '#F59E0B' }]}>
              ⚠️ Install expo-notifications to enable reminders
            </Text>
          )}
          {notificationsAvailable && !notificationPermission && notificationsEnabled && (
            <Text style={[styles.toggleWarning, { color: '#F59E0B' }]}>
              ⚠️ Notification permissions required
            </Text>
          )}
        </View>

        {/* Countdown Timer Card - Only show if notifications enabled */}
        {notificationsEnabled && notificationsScheduled && nextReminderTime && (
          <View style={[styles.countdownCard, { backgroundColor: theme.accent }]}>
            <Text style={styles.countdownTitle}>⏰ Next Reminder In:</Text>
            <Text style={styles.countdownTime}>{timeUntilNext}</Text>
            <Text style={styles.countdownSubtext}>
              You'll be reminded to drink {calculatedIntake.intake}ml
            </Text>
          </View>
        )}

        {/* Daily Water Goal Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.secondaryText }]}>Daily Water Goal (ML)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.secondary, color: theme.primaryText }]}
            onChangeText={(text) => setDailyGoal(text)}
            value={dailyGoal}
            keyboardType="numeric"
            placeholder="Enter your goal (e.g., 3000)"
            placeholderTextColor="#6B7280"
          />
        </View>

        {/* Reminder Gap Selector */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.secondaryText }]}>Reminder Time Gap (Hours)</Text>
          <View style={styles.gapSelector}>
            {AVAILABLE_GAPS.map(gap => (
              <TouchableOpacity
                key={gap}
                style={[
                  styles.gapButton,
                  { backgroundColor: reminderGap === gap ? theme.accent : theme.secondary },
                ]}
                onPress={() => {
                  setReminderGap(gap);
                  setCustomGap('');
                }}
              >
                <Text style={[styles.gapText, { color: theme.primaryText }]}>{gap} hrs</Text>
              </TouchableOpacity>
            ))}

            <TextInput
              style={[
                styles.inputCustom,
                {
                  backgroundColor: theme.secondary,
                  color: theme.primaryText,
                  borderColor: reminderGap > 4 ? theme.accent : '#374151',
                  borderWidth: 1,
                }
              ]}
              onChangeText={handleCustomGap}
              value={customGap}
              keyboardType="numeric"
              placeholder="Custom"
              placeholderTextColor="#6B7280"
            />
          </View>
        </View>

        {/* Real-Time Consumption Status - ALWAYS WORKS */}
        <View style={[styles.realTimeCard, { backgroundColor: theme.secondary }]}>
          <Text style={[styles.summaryTitle, { color: theme.primaryText }]}>
            🔴 Live Hydration Progress
          </Text>
          <Text style={[styles.liveIndicator, { color: theme.accent }]}>
            ● Real-time from your water bottle
          </Text>

          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${progressPercentage}%`, backgroundColor: goalAchieved ? theme.accent : theme.primary }]} />
          </View>
          <Text style={[styles.progressText, { color: theme.secondaryText, marginTop: 5 }]}>
            {progressPercentage.toFixed(1)}% of Goal
          </Text>

          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Total Consumed Today:</Text>
            <Text style={[styles.summaryValue, { color: goalAchieved ? theme.accent : theme.primaryText }]}>
              {totalConsumed} ml
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Daily Goal:</Text>
            <Text style={[styles.summaryValue, { color: theme.accent }]}>
              {currentGoal > 0 ? currentGoal : '--'} ml
            </Text>
          </View>

          {goalAchieved && (
            <View style={styles.achievementBanner}>
              <Text style={styles.achievementEmoji}>🎉</Text>
              <Text style={styles.achievementText}>Goal Achieved!</Text>
            </View>
          )}
        </View>

        {/* Calculated Plan Summary */}
        <View style={[styles.summaryCard, { backgroundColor: theme.secondary, marginTop: 20 }]}>
          <Text style={[styles.summaryTitle, { color: theme.accent }]}>
            Your Calculated Intake Plan:
          </Text>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Reminder Gap:</Text>
            <Text style={[styles.summaryValue, { color: theme.primaryText }]}>
              Every {reminderGap} hours
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Reminders Per Day:</Text>
            <Text style={[styles.summaryValue, { color: theme.primaryText }]}>
              {calculatedIntake.reminders > 0 ? calculatedIntake.reminders : '--'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Amount Per Reminder:</Text>
            <Text style={[styles.summaryValue, { color: theme.accent }]}>
              {calculatedIntake.intake > 0 ? `${calculatedIntake.intake} ml` : '--'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.accent, opacity: (dailyGoal && parseFloat(dailyGoal) > 0) ? 1 : 0.5 }]}
            onPress={handleSave}
            disabled={isSaving || !dailyGoal || parseFloat(dailyGoal) <= 0}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save Plan</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  planScrollView: { flex: 1 },
  planScrollContent: { padding: 20, paddingBottom: 50 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', height: 300, backgroundColor: theme.background },
  loadingText: { marginTop: 10, fontSize: 16 },
  planContainer: { flex: 1 },
  planTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  toggleCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  toggleWarning: {
    fontSize: 12,
    marginTop: 10,
    fontStyle: 'italic',
  },
  countdownCard: { padding: 20, borderRadius: 15, marginBottom: 20, alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  countdownTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 10 },
  countdownTime: { color: '#FFFFFF', fontSize: 36, fontWeight: 'bold', marginBottom: 5 },
  countdownSubtext: { color: '#FFFFFF', fontSize: 14, opacity: 0.9 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 16, marginBottom: 8, fontWeight: '600' },
  input: { height: 50, borderRadius: 10, paddingHorizontal: 15, fontSize: 18, borderWidth: 1, borderColor: '#374151' },
  gapSelector: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  gapButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#374151' },
  gapText: { fontWeight: '700', fontSize: 16 },
  inputCustom: { flex: 1, height: 50, borderRadius: 8, paddingHorizontal: 15, fontSize: 16, textAlign: 'center' },
  summaryCard: { padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#374151' },
  realTimeCard: { padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#374151', marginBottom: 10 },
  summaryTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  liveIndicator: { fontSize: 12, fontWeight: '600', marginBottom: 15 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#374151', marginBottom: 5 },
  summaryLabel: { fontSize: 15 },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  saveButton: { padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  progressContainer: { height: 10, backgroundColor: '#374151', borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  progressBar: { height: '100%', borderRadius: 5 },
  progressText: { textAlign: 'right', fontSize: 12 },
  achievementBanner: { marginTop: 15, padding: 15, backgroundColor: '#0D9488', borderRadius: 10, alignItems: 'center' },
  achievementEmoji: { fontSize: 32, marginBottom: 5 },
  achievementText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});