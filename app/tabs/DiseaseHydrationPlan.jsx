import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Switch } from 'react-native';
import { ref, onValue, update } from 'firebase/database';
import { getDatabase } from 'firebase/database';
import { getFirestore, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';

// Import auth and WaterBottleService from your existing Firebase config
import { auth, WaterBottleService } from '../../config/firebaseConfig';

// Import theme components
import useTheme from '../../Theme/theme';
import ThemedView from '../../components/ThemedView';
import ThemedText from '../../components/ThemedText';

// Import utilities from customize-hydration
import { AVAILABLE_GAPS, WAKING_HOURS, getTodayDateString, database } from './customize-hydration';

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
  console.log('✅ Notifications module loaded');
} catch (error) {
  console.log('⚠️ Notifications not available');
}

function DiseaseHydrationPlan() {
  const theme = useTheme();
  const [dailyGoal, setDailyGoal] = useState('');
  const [reminderGap, setReminderGap] = useState(3);
  const [customGap, setCustomGap] = useState('');
  const [diseaseName, setDiseaseName] = useState('');
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
    try {
      const db = getFirestore(auth.app);
      setFirestoreDb(db);
      console.log('✅ Firestore initialized in Disease component');
    } catch (error) {
      console.error('❌ Failed to initialize Firestore:', error);
    }
  }, []);

  useEffect(() => {
    if (notificationsAvailable) {
      registerForNotifications();
    }
  }, []);

  const registerForNotifications = async () => {
    if (!notificationsAvailable) return;

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
          console.log('📱 Physical device - Push notifications supported');
        } else {
          console.log('💻 Emulator - Local notifications');
        }
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
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

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
        const service = new WaterBottleService(user.uid);
        setWaterBottleService(service);
        loadUserSettings(user.uid);
      } else {
        setUserId(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loadUserSettings = async (uid) => {
    const diseaseProfileRef = ref(database, `users/${uid}/diseaseProfile`);
    onValue(diseaseProfileRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();

        if (data.notificationsEnabled !== undefined) {
          setNotificationsEnabled(data.notificationsEnabled);
        }

        if (data.planEnabled !== undefined) {
          setPlanEnabled(data.planEnabled);
        }

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

    if (!planEnabled) {
      console.log('⏸️ Disease plan disabled - stopping all tracking');
      setTotalConsumed(0);
      setGoalAchieved(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribeTodayStats = waterBottleService.onTodayStats((stats) => {
      if (stats) {
        const consumed = stats.totalConsumed || 0;
        setTotalConsumed(consumed);

        if (stats.goal !== undefined && stats.goal !== null) {
          setDailyGoal(String(stats.goal));
        }

        const goal = stats.goal || 0;
        setGoalAchieved(consumed >= goal && goal > 0);
      } else {
        setTotalConsumed(0);
        setGoalAchieved(false);
      }
      setLoading(false);
    });

    const diseaseProfileRef = ref(database, `users/${userId}/diseaseProfile`);
    const unsubscribeDiseaseProfile = onValue(diseaseProfileRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.dailyGoal) setDailyGoal(String(data.dailyGoal));
        if (data.reminderGap) {
          setReminderGap(data.reminderGap);
          if (data.reminderGap > 4) setCustomGap(String(data.reminderGap));
        }
        if (data.diseaseName) setDiseaseName(data.diseaseName);
        if (data.notificationsEnabled !== undefined) {
          setNotificationsEnabled(data.notificationsEnabled);
        }
        if (data.planEnabled !== undefined) {
          setPlanEnabled(data.planEnabled);
        }
      }
    });

    return () => {
      if (unsubscribeTodayStats) unsubscribeTodayStats();
      if (unsubscribeDiseaseProfile) unsubscribeDiseaseProfile();
    };
  }, [userId, waterBottleService, planEnabled]);

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

  // Handle plan enable/disable toggle
  const handlePlanToggle = async (value) => {
    setPlanEnabled(value);

    if (userId) {
      try {
        if (!value) {
          console.log('🔴 DISABLING Disease Plan - Clearing all data...');

          if (notificationsAvailable) {
            await Notifications.cancelAllScheduledNotificationsAsync();
            console.log('🔕 Medical notifications cancelled');
          }

          setNotificationsScheduled(false);
          setNextReminderTime(null);
          setTimeUntilNext('');
          setTotalConsumed(0);
          setGoalAchieved(false);

          await update(ref(database, `users/${userId}/diseaseProfile`), {
            planEnabled: false,
            planType: null,
            nextReminderTime: null,
            lastScheduledAt: null,
            notificationsScheduled: false,
            lastUpdated: Date.now(),
            disabledAt: Date.now(),
          });
          console.log('✅ Disease plan DISABLED in Realtime Database');

          if (firestoreDb) {
            const userDocRef = doc(firestoreDb, 'users', userId);
            try {
              const userDoc = await getDoc(userDocRef);

              if (userDoc.exists()) {
                await updateDoc(userDocRef, {
                  'diseaseHydration.planEnabled': false,
                  'diseaseHydration.planType': null,
                  'diseaseHydration.nextReminderTime': null,
                  'diseaseHydration.notificationsScheduled': false,
                  'diseaseHydration.lastUpdated': Date.now(),
                  'diseaseHydration.disabledAt': Date.now(),
                });
              } else {
                await setDoc(userDocRef, {
                  diseaseHydration: {
                    planEnabled: false,
                    planType: null,
                    nextReminderTime: null,
                    notificationsScheduled: false,
                    lastUpdated: Date.now(),
                    disabledAt: Date.now(),
                  }
                }, { merge: true });
              }
              console.log('✅ Disease plan DISABLED in Firestore');
            } catch (firestoreError) {
              console.error('⚠️ Firestore update failed:', firestoreError);
            }
          }

          Alert.alert(
            "Medical Plan Disabled ⏸️",
            "Your Disease Hydration Plan has been completely disabled.\n\n✓ All medical reminders cancelled\n✓ Tracking stopped\n✓ Database fully updated\n✓ Hardware will not track\n\nYou can enable it anytime.",
            [{ text: "OK" }]
          );

        } else {
          console.log('🟢 ENABLING Disease Plan...');

          await update(ref(database, `users/${userId}/diseaseProfile`), {
            planEnabled: true,
            planType: 'disease',
            lastUpdated: Date.now(),
            enabledAt: Date.now(),
          });
          console.log('✅ Disease plan ENABLED in Realtime Database');

          if (firestoreDb) {
            const userDocRef = doc(firestoreDb, 'users', userId);
            try {
              const userDoc = await getDoc(userDocRef);

              if (userDoc.exists()) {
                await updateDoc(userDocRef, {
                  'diseaseHydration.planEnabled': true,
                  'diseaseHydration.planType': 'disease',
                  'diseaseHydration.lastUpdated': Date.now(),
                  'diseaseHydration.enabledAt': Date.now(),
                });
              } else {
                await setDoc(userDocRef, {
                  diseaseHydration: {
                    planEnabled: true,
                    planType: 'disease',
                    lastUpdated: Date.now(),
                    enabledAt: Date.now(),
                  }
                }, { merge: true });
              }
              console.log('✅ Disease plan ENABLED in Firestore');
            } catch (firestoreError) {
              console.error('⚠️ Firestore update failed:', firestoreError);
            }
          }

          Alert.alert(
            "Medical Plan Enabled ✅",
            "Your Disease Hydration Plan is now active!\n\n✓ Database updated\n✓ Hardware will track this plan\n\nSave your settings to schedule medical reminders.",
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
        await update(ref(database, `users/${userId}/diseaseProfile`), {
          notificationsEnabled: value,
          lastUpdated: Date.now(),
        });

        if (firestoreDb) {
          const userDocRef = doc(firestoreDb, 'users', userId);
          try {
            await updateDoc(userDocRef, {
              'diseaseHydration.notificationsEnabled': value,
            });
            console.log('✅ Notification preference updated in Firestore');
          } catch (firestoreError) {
            console.log('⚠️ Firestore update failed:', firestoreError.message);
          }
        }

        if (!value) {
          if (notificationsAvailable) {
            await Notifications.cancelAllScheduledNotificationsAsync();
            console.log('🔕 Medical notifications cancelled');
          }
          setNotificationsScheduled(false);
          setNextReminderTime(null);
          setTimeUntilNext('');
        } else {
          if (dailyGoal && reminderGap && diseaseName && planEnabled) {
            Alert.alert(
              "Notifications Enabled",
              "Please save your medical plan again to schedule reminders.",
              [{ text: "OK" }]
            );
          }
        }
      } catch (error) {
        console.error('Error updating notification preference:', error);
      }
    }
  };

  const scheduleHydrationNotifications = async (gapHours, intakeAmount, conditionName) => {
    if (!notificationsAvailable || !notificationsEnabled || !planEnabled) return false;

    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('🗑️ Cancelled existing medical notifications');

      const gapInSeconds = gapHours * 60 * 60;
      const numberOfReminders = Math.floor(WAKING_HOURS / gapHours);

      const nextTime = new Date().getTime() + (gapInSeconds * 1000);
      setNextReminderTime(nextTime);
      setNotificationsScheduled(true);

      const isPhysicalDevice = Device && Device.isDevice;

      for (let i = 0; i < numberOfReminders; i++) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '💊 Medical Hydration Reminder',
            body: `⚕️ ${conditionName}: Time to drink ${intakeAmount}ml of water as prescribed. 💧`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            data: {
              type: 'disease_hydration_reminder',
              planType: 'disease',
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

      console.log(`✅ Scheduled ${numberOfReminders} medical notifications`);
      console.log(`📱 Device: ${isPhysicalDevice ? 'Physical (Full Push)' : 'Emulator (Local)'}`);

      await update(ref(database, `users/${userId}/diseaseProfile`), {
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
      Alert.alert("Authentication Error", "Please wait for authentication.");
      return;
    }

    if (!planEnabled) {
      Alert.alert(
        "Plan Disabled",
        "Please enable your Disease Hydration Plan first using the toggle above.",
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

    if (!diseaseName || diseaseName.trim() === '') {
      Alert.alert("Disease Name Required", "Please enter the disease/condition name.");
      return;
    }

    await proceedWithSave(goalValue);
  };

  const proceedWithSave = async (goalValue) => {
    setIsSaving(true);

    try {
      const todayStr = getTodayDateString();
      const now = Date.now();

      console.log('💾 Starting save process for disease plan...');
      console.log('Goal:', goalValue, 'Gap:', reminderGap, 'Disease:', diseaseName);

      const diseaseProfileRef = ref(database, `users/${userId}/diseaseProfile`);
      await update(diseaseProfileRef, {
        dailyGoal: goalValue,
        reminderGap: parseInt(reminderGap),
        diseaseName: diseaseName.trim(),
        notificationsEnabled: notificationsEnabled,
        planEnabled: planEnabled,
        planType: 'disease',
        lastUpdated: now,
        updatedAt: new Date().toISOString(),
      });

      const dailyStatsRef = ref(database, `users/${userId}/dailyStats/${todayStr}`);
      await update(dailyStatsRef, {
        goal: goalValue,
        date: todayStr,
        lastUpdated: now,
        diseaseMode: true,
        diseaseName: diseaseName.trim(),
        planType: 'disease',
      });

      console.log('✅ Medical plan saved to Realtime Database');

      if (firestoreDb) {
        try {
          console.log('🔄 Attempting Firestore update for disease plan...');
          const userDocRef = doc(firestoreDb, 'users', userId);

          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            console.log('📄 Firestore document exists, updating disease plan...');

            await updateDoc(userDocRef, {
              'diseaseHydration.enabled': true,
              'diseaseHydration.planEnabled': planEnabled,
              'diseaseHydration.planType': 'disease',
              'diseaseHydration.condition': diseaseName.trim(),
              'diseaseHydration.dailyGoal': goalValue,
              'diseaseHydration.reminderInterval': parseInt(reminderGap) * 60,
              'diseaseHydration.notificationsEnabled': notificationsEnabled,
              'diseaseHydration.lastUpdated': now,
            });

            console.log('✅ Medical plan saved to Firestore successfully!');
          } else {
            console.log('📄 Creating new Firestore document...');

            await setDoc(userDocRef, {
              diseaseHydration: {
                enabled: true,
                planEnabled: planEnabled,
                planType: 'disease',
                condition: diseaseName.trim(),
                dailyGoal: goalValue,
                reminderInterval: parseInt(reminderGap) * 60,
                notificationsEnabled: notificationsEnabled,
                lastUpdated: now,
              }
            }, { merge: true });

            console.log('✅ New Firestore document created!');
          }
        } catch (firestoreError) {
          console.error('❌ Firestore update error:', firestoreError);
        }
      }

      let notificationScheduled = false;
      if (planEnabled && notificationsEnabled && notificationsAvailable && notificationPermission) {
        notificationScheduled = await scheduleHydrationNotifications(
          parseInt(reminderGap),
          calculatedIntake.intake,
          diseaseName.trim()
        );
      }

      let alertTitle = "Medical Plan Saved! 🏥";
      let alertMessage = `Your medical hydration plan has been saved!\n\n` +
                        `🏥 Condition: ${diseaseName}\n` +
                        `💧 Daily Goal: ${goalValue}ml\n` +
                        `⏰ Every ${reminderGap} hours\n` +
                        `💊 Drink ${calculatedIntake.intake}ml each time\n` +
                        `📊 ${calculatedIntake.reminders} reminders per day\n` +
                        `🔴 Plan Type: Disease\n` +
                        `💾 Database: Updated\n\n`;

      if (notificationScheduled) {
        const nextReminderDate = new Date(nextReminderTime);
        const timeString = nextReminderDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
        alertMessage += `⏱️ First reminder: ${timeString}\n\n`;

        if (Device && Device.isDevice) {
          alertMessage += `📱 Medical push notifications active!\n\n`;
        } else {
          alertMessage += `💻 Local notifications active\n\n`;
        }
        alertMessage += `⚠️ Always follow your doctor's advice!`;
      } else if (!notificationsEnabled) {
        alertMessage += `🔕 Notifications are OFF\n` +
                       `Enable anytime using the toggle above.\n\n` +
                       `⚠️ Always follow your doctor's advice!`;
      } else if (!notificationsAvailable) {
        alertMessage += `⚠️ Install expo-notifications for reminders\n\n` +
                       `Always follow your doctor's advice!`;
      } else if (!notificationPermission) {
        alertMessage += `⚠️ Notification permissions required\n\n` +
                       `Always follow your doctor's advice!`;
      }

      Alert.alert(alertTitle, alertMessage, [{ text: "OK" }]);

    } catch (error) {
      console.error("❌ Failed to save:", error);
      Alert.alert("Save Error", `Failed: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const currentGoal = parseFloat(dailyGoal) || 0;
  const progressPercentage = currentGoal > 0 ? Math.min(100, (totalConsumed / currentGoal) * 100) : 0;

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
        <ThemedText style={styles.loadingText}>Loading...</ThemedText>
      </ThemedView>
    );
  }

  if (!userId) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText style={styles.loadingText}>Please sign in</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView style={[styles.planScrollView, { backgroundColor: theme.background }]} contentContainerStyle={styles.planScrollContent}>
      <ThemedView style={styles.planContainer}>
        <ThemedText style={styles.planTitle}>Disease Hydration Plan</ThemedText>

        <View style={styles.warningBanner}>
          <ThemedText style={styles.warningEmoji}>⚠️</ThemedText>
          <ThemedText style={styles.warningText}>
            Consult your doctor before setting fluid goals.
          </ThemedText>
        </View>

        {/* Plan Enable/Disable Toggle */}
        <View style={[styles.toggleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <ThemedText style={styles.toggleTitle}>
                ❤️ Enable Disease Hydration Plan
              </ThemedText>
              <ThemedText style={[styles.toggleDescription, { color: theme.secondaryText }]}>
                {planEnabled
                  ? 'Active - Hardware will track this medical plan'
                  : 'Disabled - Hardware will not track'}
              </ThemedText>
            </View>
            <Switch
              value={planEnabled}
              onValueChange={handlePlanToggle}
              trackColor={{ false: theme.border, true: '#DC2626' }}
              thumbColor={planEnabled ? '#FFFFFF' : '#9CA3AF'}
              ios_backgroundColor={theme.border}
            />
          </View>
          {!planEnabled && (
            <ThemedText style={styles.toggleWarning}>
              ⚠️ Enable to start medical tracking with your water bottle hardware
            </ThemedText>
          )}
        </View>

        {/* Notification Toggle Switch */}
        <View style={[styles.toggleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <ThemedText style={styles.toggleTitle}>
                💊 Medical Reminder Notifications
              </ThemedText>
              <ThemedText style={[styles.toggleDescription, { color: theme.secondaryText }]}>
                {notificationsEnabled
                  ? 'You will receive medical hydration reminders'
                  : 'Medical notifications are turned off'}
              </ThemedText>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: theme.border, true: '#DC2626' }}
              thumbColor={notificationsEnabled ? '#FFFFFF' : '#9CA3AF'}
              ios_backgroundColor={theme.border}
              disabled={!planEnabled}
            />
          </View>
          {!notificationsAvailable && (
            <ThemedText style={styles.toggleWarning}>
              ⚠️ Install expo-notifications for medical reminders
            </ThemedText>
          )}
          {notificationsAvailable && !notificationPermission && notificationsEnabled && (
            <ThemedText style={styles.toggleWarning}>
              ⚠️ Notification permissions required
            </ThemedText>
          )}
        </View>

        {/* Countdown Timer */}
        {planEnabled && notificationsEnabled && notificationsScheduled && nextReminderTime && timeUntilNext && (
          <View style={styles.countdownCard}>
            <ThemedText style={styles.countdownTitle}>⏰ Next Medical Reminder In:</ThemedText>
            <ThemedText style={styles.countdownTime}>{timeUntilNext}</ThemedText>
            <ThemedText style={styles.countdownSubtext}>
              {diseaseName}: {calculatedIntake.intake}ml prescribed
            </ThemedText>
          </View>
        )}

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.label, { color: theme.secondaryText }]}>Disease/Condition Name *</ThemedText>
          <TextInput
            style={[styles.input, {
              backgroundColor: theme.card,
              color: theme.text,
              borderColor: theme.border,
              opacity: planEnabled ? 1 : 0.5
            }]}
            onChangeText={setDiseaseName}
            value={diseaseName}
            placeholder="e.g., Kidney Disease, Heart Failure"
            placeholderTextColor={theme.secondaryText}
            editable={planEnabled}
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.label, { color: theme.secondaryText }]}>Daily Water Goal (ML) *</ThemedText>
          <TextInput
            style={[styles.input, {
              backgroundColor: theme.card,
              color: theme.text,
              borderColor: theme.border,
              opacity: planEnabled ? 1 : 0.5
            }]}
            onChangeText={setDailyGoal}
            value={dailyGoal}
            keyboardType="numeric"
            placeholder="Enter goal based on doctor's advice"
            placeholderTextColor={theme.secondaryText}
            editable={planEnabled}
          />
          <ThemedText style={[styles.helperText, { color: theme.secondaryText }]}>
            💡 Some conditions require fluid restriction. Follow your doctor's advice.
          </ThemedText>
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.label, { color: theme.secondaryText }]}>Reminder Time Gap (Hours) *</ThemedText>
          <View style={styles.gapSelector}>
            {AVAILABLE_GAPS.map(gap => (
              <TouchableOpacity
                key={gap}
                style={[
                  styles.gapButton,
                  {
                    backgroundColor: reminderGap === gap ? '#DC2626' : theme.card,
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
                  borderColor: reminderGap > 4 ? '#DC2626' : theme.border,
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

        {/* Real-Time Progress */}
        {planEnabled ? (
          <View style={[styles.realTimeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText style={styles.summaryTitle}>
              🔴 Live Hydration Progress
            </ThemedText>
            <ThemedText style={styles.liveIndicator}>
              ● Real-time from your water bottle hardware
            </ThemedText>

            <View style={[styles.progressContainer, { backgroundColor: theme.border }]}>
              <View style={[styles.progressBar, { width: `${progressPercentage}%`, backgroundColor: goalAchieved ? '#0D9488' : '#DC2626' }]} />
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
              <ThemedText style={[styles.summaryValue, { color: '#DC2626' }]}>
                {currentGoal > 0 ? currentGoal : '--'} ml
              </ThemedText>
            </View>

            {diseaseName && (
              <View style={styles.summaryRow}>
                <ThemedText style={[styles.summaryLabel, { color: theme.secondaryText }]}>Condition:</ThemedText>
                <ThemedText style={[styles.summaryValue, { color: '#DC2626' }]}>
                  {diseaseName}
                </ThemedText>
              </View>
            )}

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
              ⏸️ Medical Hardware Tracking Disabled
            </ThemedText>
            <ThemedText style={[styles.disabledText, { color: theme.secondaryText }]}>
              Enable your medical plan above to start tracking with your water bottle hardware
            </ThemedText>
          </View>
        )}

        <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ThemedText style={[styles.summaryTitle, { color: '#DC2626' }]}>
            Your Calculated Intake Plan:
          </ThemedText>
          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: theme.secondaryText }]}>Condition:</ThemedText>
            <ThemedText style={styles.summaryValue}>
              {diseaseName || 'Not specified'}
            </ThemedText>
          </View>
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
            <ThemedText style={[styles.summaryValue, { color: '#DC2626' }]}>
              {calculatedIntake.intake > 0 ? `${calculatedIntake.intake} ml` : '--'}
            </ThemedText>
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              {
                opacity: (planEnabled && dailyGoal && parseFloat(dailyGoal) > 0 && diseaseName.trim() !== '') ? 1 : 0.5
              }
            ]}
            onPress={handleSave}
            disabled={isSaving || !planEnabled || !dailyGoal || parseFloat(dailyGoal) <= 0 || diseaseName.trim() === ''}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.saveButtonText}>Save Medical Plan</ThemedText>
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
  toggleCard: { padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleInfo: { flex: 1, marginRight: 12 },
  toggleTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  toggleDescription: { fontSize: 13, lineHeight: 18 },
  toggleWarning: { fontSize: 12, marginTop: 10, fontStyle: 'italic', color: '#F59E0B' },
  countdownCard: { padding: 20, borderRadius: 12, marginBottom: 20, alignItems: 'center', backgroundColor: '#DC2626' },
  countdownTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 10 },
  countdownTime: { color: '#FFFFFF', fontSize: 36, fontWeight: 'bold', marginBottom: 5 },
  countdownSubtext: { color: '#FFFFFF', fontSize: 14, opacity: 0.9 },
  warningBanner: { padding: 15, borderRadius: 12, marginBottom: 20, alignItems: 'center', backgroundColor: '#DC2626' },
  warningEmoji: { fontSize: 32, marginBottom: 8, color: '#FFFFFF' },
  warningText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 16, marginBottom: 8, fontWeight: '600' },
  input: { height: 50, borderRadius: 12, paddingHorizontal: 15, fontSize: 16, borderWidth: 1 },
  helperText: { fontSize: 12, marginTop: 5, fontStyle: 'italic' },
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
  liveIndicator: { fontSize: 12, fontWeight: '600', marginBottom: 15, color: '#DC2626' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, marginBottom: 5 },
  summaryLabel: { fontSize: 15 },
  summaryValue: { fontSize: 16, fontWeight: '600' },
  saveButton: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 20, backgroundColor: '#DC2626' },
  saveButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  progressContainer: { height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  progressBar: { height: '100%', borderRadius: 5 },
  progressText: { textAlign: 'right', fontSize: 12, marginTop: 5 },
  achievementBanner: { marginTop: 15, padding: 15, borderRadius: 12, alignItems: 'center', backgroundColor: '#0D9488' },
  achievementEmoji: { fontSize: 32, marginBottom: 5, color: '#FFFFFF' },
  achievementText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});

export default DiseaseHydrationPlan;