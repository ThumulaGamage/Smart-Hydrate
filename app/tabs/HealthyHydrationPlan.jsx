import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Switch } from 'react-native';
import { ref, onValue, update } from 'firebase/database';
import { getFirestore, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';

// Import auth and WaterBottleService from your existing Firebase config
import { auth, WaterBottleService } from '../../config/firebaseConfig';

// Import theme components
import useTheme from '../../Theme/theme';
import ThemedView from '../../components/ThemedView';
import ThemedText from '../../components/ThemedText';

// IMPORTING Utilities and database from the main file
import {
    AVAILABLE_GAPS, WAKING_HOURS,
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
  const theme = useTheme();
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

  // Plan enable/disable state
  const [planEnabled, setPlanEnabled] = useState(true);

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

  // Countdown timer effect - ONLY RUNS WHEN PLAN IS ENABLED
  useEffect(() => {
    if (!nextReminderTime || !notificationsEnabled || !planEnabled) {
      setTimeUntilNext('');
      return;
    }

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
  }, [nextReminderTime, notificationsEnabled, planEnabled]);

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

  // Load user settings including notification toggle and plan status
  const loadUserSettings = async (uid) => {
    const profileRef = ref(database, `users/${uid}/profile`);
    onValue(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();

        // Load notification preference
        if (data.notificationsEnabled !== undefined) {
          setNotificationsEnabled(data.notificationsEnabled);
        }

        // Load plan enabled status
        if (data.planEnabled !== undefined) {
          setPlanEnabled(data.planEnabled);
        }

        // Load next reminder time
        if (data.nextReminderTime) {
          setNextReminderTime(data.nextReminderTime);
          setNotificationsScheduled(true);
        }
      }
    });
  };

  // Real-time listener - ONLY WORKS WHEN PLAN IS ENABLED
  useEffect(() => {
    if (!userId || !waterBottleService) {
      setLoading(false);
      return;
    }

    // If plan is disabled, don't track anything
    if (!planEnabled) {
      console.log('⏸️ Healthy plan disabled - stopping all tracking');
      setTotalConsumed(0);
      setGoalAchieved(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('🔄 Setting up real-time listeners for healthy hydration plan...');

    // Listen to today's stats in real-time (ONLY WHEN PLAN IS ENABLED)
    const unsubscribeTodayStats = waterBottleService.onTodayStats((stats) => {
      console.log('📊 Real-time stats update received:', stats);

      if (stats) {
        // Update total consumed (real-time from bottle)
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
        if (data.planEnabled !== undefined) {
          setPlanEnabled(data.planEnabled);
        }
      }
    });

    return () => {
      console.log('🧹 Cleaning up hydration plan listeners');
      if (unsubscribeTodayStats) unsubscribeTodayStats();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [userId, waterBottleService, planEnabled]); // Added planEnabled to dependencies

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

  // Handle plan enable/disable toggle - WITH COMPLETE DATABASE UPDATES
  const handlePlanToggle = async (value) => {
    setPlanEnabled(value);

    if (userId) {
      try {
        if (!value) {
          console.log('🔴 DISABLING Healthy Plan - Clearing all data...');

          // 1. Cancel notifications
          if (notificationsAvailable) {
            await Notifications.cancelAllScheduledNotificationsAsync();
            console.log('🔕 Notifications cancelled');
          }

          // 2. Clear local state
          setNotificationsScheduled(false);
          setNextReminderTime(null);
          setTimeUntilNext('');
          setTotalConsumed(0);
          setGoalAchieved(false);

          // 3. Update Realtime Database - COMPLETELY DISABLE
          await update(ref(database, `users/${userId}/profile`), {
            planEnabled: false,
            planType: null,  // Clear plan type
            nextReminderTime: null,
            lastScheduledAt: null,
            notificationsScheduled: false,
            lastUpdated: Date.now(),
            disabledAt: Date.now(),
          });
          console.log('✅ Healthy plan DISABLED in Realtime Database');

          // 4. Update Firestore - COMPLETELY DISABLE
          if (firestoreDb) {
            const userDocRef = doc(firestoreDb, 'users', userId);
            try {
              const userDoc = await getDoc(userDocRef);

              if (userDoc.exists()) {
                await updateDoc(userDocRef, {
                  'hydrationSettings.planEnabled': false,
                  'hydrationSettings.planType': null,
                  'hydrationSettings.nextReminderTime': null,
                  'hydrationSettings.notificationsScheduled': false,
                  'hydrationSettings.lastUpdated': Date.now(),
                  'hydrationSettings.disabledAt': Date.now(),
                });
              } else {
                // Create document if doesn't exist
                await setDoc(userDocRef, {
                  hydrationSettings: {
                    planEnabled: false,
                    planType: null,
                    nextReminderTime: null,
                    notificationsScheduled: false,
                    lastUpdated: Date.now(),
                    disabledAt: Date.now(),
                  }
                }, { merge: true });
              }
              console.log('✅ Healthy plan DISABLED in Firestore');
            } catch (firestoreError) {
              console.error('⚠️ Firestore update failed:', firestoreError);
            }
          }

          Alert.alert(
            "Plan Disabled ⏸️",
            "Your Healthy Hydration Plan has been completely disabled.\n\n✓ All reminders cancelled\n✓ Tracking stopped\n✓ Database fully updated\n✓ Hardware will not track\n\nYou can enable it anytime.",
            [{ text: "OK" }]
          );

        } else {
          console.log('🟢 ENABLING Healthy Plan...');

          // Update Realtime Database
          await update(ref(database, `users/${userId}/profile`), {
            planEnabled: true,
            planType: 'healthy',  // Mark as healthy plan
            lastUpdated: Date.now(),
            enabledAt: Date.now(),
          });
          console.log('✅ Healthy plan ENABLED in Realtime Database');

          // Update Firestore
          if (firestoreDb) {
            const userDocRef = doc(firestoreDb, 'users', userId);
            try {
              const userDoc = await getDoc(userDocRef);

              if (userDoc.exists()) {
                await updateDoc(userDocRef, {
                  'hydrationSettings.planEnabled': true,
                  'hydrationSettings.planType': 'healthy',
                  'hydrationSettings.lastUpdated': Date.now(),
                  'hydrationSettings.enabledAt': Date.now(),
                });
              } else {
                // Create document if doesn't exist
                await setDoc(userDocRef, {
                  hydrationSettings: {
                    planEnabled: true,
                    planType: 'healthy',
                    lastUpdated: Date.now(),
                    enabledAt: Date.now(),
                  }
                }, { merge: true });
              }
              console.log('✅ Healthy plan ENABLED in Firestore');
            } catch (firestoreError) {
              console.error('⚠️ Firestore update failed:', firestoreError);
            }
          }

          Alert.alert(
            "Plan Enabled ✅",
            "Your Healthy Hydration Plan is now active!\n\n✓ Database updated\n✓ Hardware will track this plan\n\nSave your settings to schedule reminders.",
            [{ text: "OK" }]
          );
        }
      } catch (error) {
        console.error('❌ Error updating plan status:', error);
        Alert.alert("Error", "Failed to update plan status. Please try again.");
      }
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
          setTimeUntilNext('');
        } else {
          // If turning on, reschedule if we have settings
          if (dailyGoal && reminderGap && planEnabled) {
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
    if (!notificationsAvailable || !notificationsEnabled || !planEnabled) {
      console.log('⚠️ Notifications disabled or not available or plan disabled');
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
              planType: 'healthy',
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
        notificationsScheduled: true,
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

    if (!planEnabled) {
      Alert.alert(
        "Plan Disabled",
        "Please enable your Healthy Hydration Plan first using the toggle above.",
        [{ text: "OK" }]
      );
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

    // Proceed with save
    await proceedWithSave(goalValue);
  };

  const proceedWithSave = async (goalValue) => {
    setIsSaving(true);

    try {
      const todayStr = getTodayDateString();
      const now = Date.now();

      console.log('💾 Starting save process for healthy plan...');
      console.log('Goal:', goalValue, 'Gap:', reminderGap);

      // 1. SAVE TO REALTIME DATABASE
      const profileRef = ref(database, `users/${userId}/profile`);
      await update(profileRef, {
        dailyGoal: goalValue,
        reminderGap: parseInt(reminderGap),
        notificationsEnabled: notificationsEnabled,
        planEnabled: planEnabled,
        planType: 'healthy',  // Mark as healthy plan
        lastUpdated: now,
        updatedAt: new Date().toISOString(),
      });

      // Update today's goal in dailyStats
      const dailyStatsRef = ref(database, `users/${userId}/dailyStats/${todayStr}`);
      await update(dailyStatsRef, {
        goal: goalValue,
        date: todayStr,
        lastUpdated: now,
        planType: 'healthy',  // Mark which plan is active
      });

      console.log('✅ Healthy plan saved to Realtime Database');

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
              'hydrationSettings.planEnabled': planEnabled,
              'hydrationSettings.planType': 'healthy',  // Mark as healthy plan
              'hydrationSettings.lastUpdated': now,
            });

            console.log('✅ Healthy plan saved to Firestore successfully!');
          } else {
            console.log('📄 Creating new Firestore document...');

            // Create new document
            await setDoc(userDocRef, {
              hydrationSettings: {
                dailyWaterGoal: goalValue,
                reminderInterval: parseInt(reminderGap) * 60,
                notificationsEnabled: notificationsEnabled,
                planEnabled: planEnabled,
                planType: 'healthy',
                lastUpdated: now,
              }
            }, { merge: true });

            console.log('✅ New Firestore document created!');
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

      // Only schedule notifications if enabled and plan is enabled
      let notificationScheduled = false;
      if (planEnabled && notificationsEnabled && notificationsAvailable && notificationPermission) {
        notificationScheduled = await scheduleHydrationNotifications(
          parseInt(reminderGap),
          calculatedIntake.intake
        );
      }

      // Show appropriate success message
      let alertTitle = "Plan Saved! 🎉";
      let alertMessage = `Your daily water goal of ${goalValue}ml has been saved!\n\n` +
                        `💧 Drink ${calculatedIntake.intake}ml every ${reminderGap} hours\n` +
                        `📊 ${calculatedIntake.reminders} reminders per day\n` +
                        `🔵 Plan Type: Healthy\n` +
                        `💾 Database: Updated\n\n`;

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
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0D9488" />
        <ThemedText style={styles.loadingText}>Loading Hydration Plan...</ThemedText>
      </ThemedView>
    );
  }

  if (!userId) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText style={styles.loadingText}>Please sign in to continue</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView style={[styles.planScrollView, { backgroundColor: theme.background }]} contentContainerStyle={styles.planScrollContent}>
      <ThemedView style={styles.planContainer}>
        <ThemedText style={styles.planTitle}>Set Your Daily Hydration Plan</ThemedText>

        {/* Plan Enable/Disable Toggle */}
        <View style={[styles.toggleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <ThemedText style={styles.toggleTitle}>
                💚 Enable Healthy Hydration Plan
              </ThemedText>
              <ThemedText style={[styles.toggleDescription, { color: theme.secondaryText }]}>
                {planEnabled
                  ? 'Active - Hardware will track this plan'
                  : 'Disabled - Hardware will not track'}
              </ThemedText>
            </View>
            <Switch
              value={planEnabled}
              onValueChange={handlePlanToggle}
              trackColor={{ false: theme.border, true: '#0D9488' }}
              thumbColor={planEnabled ? '#FFFFFF' : '#9CA3AF'}
              ios_backgroundColor={theme.border}
            />
          </View>
          {!planEnabled && (
            <ThemedText style={styles.toggleWarning}>
              ⚠️ Enable to start tracking with your water bottle hardware
            </ThemedText>
          )}
        </View>

        {/* Notification Toggle Switch */}
        <View style={[styles.toggleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <ThemedText style={styles.toggleTitle}>
                🔔 Reminder Notifications
              </ThemedText>
              <ThemedText style={[styles.toggleDescription, { color: theme.secondaryText }]}>
                {notificationsEnabled
                  ? 'You will receive hydration reminders'
                  : 'Notifications are turned off'}
              </ThemedText>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: theme.border, true: '#0D9488' }}
              thumbColor={notificationsEnabled ? '#FFFFFF' : '#9CA3AF'}
              ios_backgroundColor={theme.border}
              disabled={!planEnabled}
            />
          </View>
          {!notificationsAvailable && (
            <ThemedText style={styles.toggleWarning}>
              ⚠️ Install expo-notifications to enable reminders
            </ThemedText>
          )}
          {notificationsAvailable && !notificationPermission && notificationsEnabled && (
            <ThemedText style={styles.toggleWarning}>
              ⚠️ Notification permissions required
            </ThemedText>
          )}
        </View>

        {/* Countdown Timer Card - Only show if plan enabled and notifications enabled */}
        {planEnabled && notificationsEnabled && notificationsScheduled && nextReminderTime && timeUntilNext && (
          <View style={styles.countdownCard}>
            <ThemedText style={styles.countdownTitle}>⏰ Next Reminder In:</ThemedText>
            <ThemedText style={styles.countdownTime}>{timeUntilNext}</ThemedText>
            <ThemedText style={styles.countdownSubtext}>
              You'll be reminded to drink {calculatedIntake.intake}ml
            </ThemedText>
          </View>
        )}

        {/* Daily Water Goal Input */}
        <View style={styles.inputGroup}>
          <ThemedText style={[styles.label, { color: theme.secondaryText }]}>Daily Water Goal (ML)</ThemedText>
          <TextInput
            style={[styles.input, {
              backgroundColor: theme.card,
              color: theme.text,
              borderColor: theme.border,
              opacity: planEnabled ? 1 : 0.5
            }]}
            onChangeText={(text) => setDailyGoal(text)}
            value={dailyGoal}
            keyboardType="numeric"
            placeholder="Enter your goal (e.g., 3000)"
            placeholderTextColor={theme.secondaryText}
            editable={planEnabled}
          />
        </View>

        {/* Reminder Gap Selector */}
        <View style={styles.inputGroup}>
          <ThemedText style={[styles.label, { color: theme.secondaryText }]}>Reminder Time Gap (Hours)</ThemedText>
          <View style={styles.gapSelector}>
            {AVAILABLE_GAPS.map(gap => (
              <TouchableOpacity
                key={gap}
                style={[
                  styles.gapButton,
                  {
                    backgroundColor: reminderGap === gap ? '#0D9488' : theme.card,
                    borderColor: theme.border,
                    opacity: planEnabled ? 1 : 0.5
                  },
                ]}
                onPress={() => {
                  if (planEnabled) {
                    setReminderGap(gap);
                    setCustomGap('');
                  }
                }}
                disabled={!planEnabled}
              >
                <ThemedText style={styles.gapText}>{gap} hrs</ThemedText>
              </TouchableOpacity>
            ))}

            <TextInput
              style={[
                styles.inputCustom,
                {
                  backgroundColor: theme.card,
                  color: theme.text,
                  borderColor: reminderGap > 4 ? '#0D9488' : theme.border,
                  opacity: planEnabled ? 1 : 0.5
                }
              ]}
              onChangeText={handleCustomGap}
              value={customGap}
              keyboardType="numeric"
              placeholder="Custom"
              placeholderTextColor={theme.secondaryText}
              editable={planEnabled}
            />
          </View>
        </View>

        {/* Real-Time Consumption Status - ONLY WHEN PLAN IS ENABLED */}
        {planEnabled ? (
          <View style={[styles.realTimeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText style={styles.summaryTitle}>
              🔴 Live Hydration Progress
            </ThemedText>
            <ThemedText style={styles.liveIndicator}>
              ● Real-time from your water bottle hardware
            </ThemedText>

            <View style={[styles.progressContainer, { backgroundColor: theme.border }]}>
              <View style={[styles.progressBar, { width: `${progressPercentage}%`, backgroundColor: goalAchieved ? '#0D9488' : '#1D4ED8' }]} />
            </View>
            <ThemedText style={[styles.progressText, { color: theme.secondaryText }]}>
              {progressPercentage.toFixed(1)}% of Goal
            </ThemedText>

            <View style={styles.summaryRow}>
              <ThemedText style={[styles.summaryLabel, { color: theme.secondaryText }]}>Total Consumed Today:</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: goalAchieved ? '#0D9488' : theme.text }]}>
                {totalConsumed} ml
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={[styles.summaryLabel, { color: theme.secondaryText }]}>Daily Goal:</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: '#0D9488' }]}>
                {currentGoal > 0 ? currentGoal : '--'} ml
              </ThemedText>
            </View>

            {goalAchieved && (
              <View style={styles.achievementBanner}>
                <ThemedText style={styles.achievementEmoji}>🎉</ThemedText>
                <ThemedText style={styles.achievementText}>Goal Achieved!</ThemedText>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.disabledCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText style={[styles.disabledTitle, { color: theme.secondaryText }]}>
              ⏸️ Hardware Tracking Disabled
            </ThemedText>
            <ThemedText style={[styles.disabledText, { color: theme.secondaryText }]}>
              Enable your plan above to start tracking with your water bottle hardware
            </ThemedText>
          </View>
        )}

        {/* Calculated Plan Summary */}
        <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ThemedText style={[styles.summaryTitle, { color: '#0D9488' }]}>
            Your Calculated Intake Plan:
          </ThemedText>
          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: theme.secondaryText }]}>Reminder Gap:</ThemedText>
            <ThemedText style={styles.summaryValue}>
              Every {reminderGap} hours
            </ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: theme.secondaryText }]}>Reminders Per Day:</ThemedText>
            <ThemedText style={styles.summaryValue}>
              {calculatedIntake.reminders > 0 ? calculatedIntake.reminders : '--'}
            </ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: theme.secondaryText }]}>Amount Per Reminder:</ThemedText>
            <ThemedText style={[styles.summaryValue, { color: '#0D9488' }]}>
              {calculatedIntake.intake > 0 ? `${calculatedIntake.intake} ml` : '--'}
            </ThemedText>
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              {
                opacity: (planEnabled && dailyGoal && parseFloat(dailyGoal) > 0) ? 1 : 0.5
              }
            ]}
            onPress={handleSave}
            disabled={isSaving || !planEnabled || !dailyGoal || parseFloat(dailyGoal) <= 0}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.saveButtonText}>Save Plan</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  planScrollView: { flex: 1 },
  planScrollContent: { padding: 20, paddingBottom: 50 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', height: 300 },
  loadingText: { marginTop: 10, fontSize: 16 },
  planContainer: { flex: 1 },
  planTitle: { fontSize: 20, fontWeight: '600', marginBottom: 20, textAlign: 'center' },
  toggleCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
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
    color: '#F59E0B',
  },
  countdownCard: { padding: 20, borderRadius: 12, marginBottom: 20, alignItems: 'center', backgroundColor: '#0D9488' },
  countdownTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 10 },
  countdownTime: { color: '#FFFFFF', fontSize: 36, fontWeight: 'bold', marginBottom: 5 },
  countdownSubtext: { color: '#FFFFFF', fontSize: 14, opacity: 0.9 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 16, marginBottom: 8, fontWeight: '600' },
  input: { height: 50, borderRadius: 12, paddingHorizontal: 15, fontSize: 16, borderWidth: 1 },
  gapSelector: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  gapButton: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  gapText: { fontWeight: '600', fontSize: 16 },
  inputCustom: { flex: 1, height: 50, borderRadius: 12, paddingHorizontal: 15, fontSize: 16, textAlign: 'center', borderWidth: 1 },
  summaryCard: { padding: 20, borderRadius: 12, borderWidth: 1, marginTop: 20 },
  realTimeCard: { padding: 20, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  disabledCard: { padding: 30, borderRadius: 12, borderWidth: 1, marginBottom: 10, alignItems: 'center' },
  disabledTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  disabledText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  summaryTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  liveIndicator: { fontSize: 12, fontWeight: '600', marginBottom: 15, color: '#0D9488' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, marginBottom: 5 },
  summaryLabel: { fontSize: 15 },
  summaryValue: { fontSize: 16, fontWeight: '600' },
  saveButton: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 20, backgroundColor: '#0D9488' },
  saveButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  progressContainer: { height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  progressBar: { height: '100%', borderRadius: 5 },
  progressText: { textAlign: 'right', fontSize: 12, marginTop: 5 },
  achievementBanner: { marginTop: 15, padding: 15, backgroundColor: '#0D9488', borderRadius: 12, alignItems: 'center' },
  achievementEmoji: { fontSize: 32, marginBottom: 5, color: '#FFFFFF' },
  achievementText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});