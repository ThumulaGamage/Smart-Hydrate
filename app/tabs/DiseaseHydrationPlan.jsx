import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Switch } from 'react-native';
import { ref, onValue, update } from 'firebase/database';
import { getDatabase } from 'firebase/database';

// Import auth and WaterBottleService from your existing Firebase config
import { auth, WaterBottleService } from '../../config/firebaseConfig';

const theme = {
  primary: '#1D4ED8',
  secondary: '#1F2937',
  background: '#0F172A',
  card: '#1F2937',
  primaryText: '#FFFFFF',
  secondaryText: '#D1D5DB',
  accent: '#0D9488',
  danger: '#DC2626',
};

const AVAILABLE_GAPS = [2, 3, 4];
const WAKING_HOURS = 16;

const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

let database;
try {
  database = getDatabase(auth.app);
} catch (e) {
  console.error("Failed to initialize database:", e);
}

function DiseaseHydrationPlan() {
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

  // NEW: Notification toggle state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

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

        if (data.nextReminderTime) {
          setNextReminderTime(data.nextReminderTime);
          setNotificationsScheduled(true);
        }
      }
    });
  };

  // Real-time listener - ALWAYS WORKS regardless of notifications
  useEffect(() => {
    if (!userId || !waterBottleService) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Water consumption tracking - ALWAYS ACTIVE
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
      }
    });

    return () => {
      if (unsubscribeTodayStats) unsubscribeTodayStats();
      if (unsubscribeDiseaseProfile) unsubscribeDiseaseProfile();
    };
  }, [userId, waterBottleService]);

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
        await update(ref(database, `users/${userId}/diseaseProfile`), {
          notificationsEnabled: value,
          lastUpdated: Date.now(),
        });

        if (!value) {
          if (notificationsAvailable) {
            await Notifications.cancelAllScheduledNotificationsAsync();
            console.log('🔕 Medical notifications cancelled');
          }
          setNotificationsScheduled(false);
          setNextReminderTime(null);
        } else {
          if (dailyGoal && reminderGap && diseaseName) {
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
    if (!notificationsAvailable || !notificationsEnabled) return false;

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

      // ALWAYS save disease profile
      const diseaseProfileRef = ref(database, `users/${userId}/diseaseProfile`);
      await update(diseaseProfileRef, {
        dailyGoal: goalValue,
        reminderGap: parseInt(reminderGap),
        diseaseName: diseaseName.trim(),
        notificationsEnabled: notificationsEnabled,
        lastUpdated: now,
        updatedAt: new Date().toISOString(),
      });

      // ALWAYS update today's stats
      const dailyStatsRef = ref(database, `users/${userId}/dailyStats/${todayStr}`);
      await update(dailyStatsRef, {
        goal: goalValue,
        date: todayStr,
        lastUpdated: now,
        diseaseMode: true,
        diseaseName: diseaseName.trim()
      });

      console.log('✅ Medical plan saved');

      // Only schedule if enabled
      let notificationScheduled = false;
      if (notificationsEnabled && notificationsAvailable && notificationPermission) {
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
                        `📊 ${calculatedIntake.reminders} reminders per day\n\n`;

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.danger} />
        <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading...</Text>
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Please sign in</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.planScrollView} contentContainerStyle={styles.planScrollContent}>
      <View style={styles.planContainer}>
        <Text style={[styles.planTitle, { color: theme.primaryText }]}>Disease Hydration Plan</Text>

        <View style={[styles.warningBanner, { backgroundColor: theme.danger }]}>
          <Text style={styles.warningEmoji}>⚠️</Text>
          <Text style={styles.warningText}>
            Consult your doctor before setting fluid goals.
          </Text>
        </View>

        {/* Notification Toggle Switch */}
        <View style={[styles.toggleCard, { backgroundColor: theme.secondary }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={[styles.toggleTitle, { color: theme.primaryText }]}>
                💊 Medical Reminder Notifications
              </Text>
              <Text style={[styles.toggleDescription, { color: theme.secondaryText }]}>
                {notificationsEnabled
                  ? 'You will receive medical hydration reminders'
                  : 'Medical notifications are turned off'}
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: '#374151', true: theme.danger }}
              thumbColor={notificationsEnabled ? '#FFFFFF' : '#9CA3AF'}
              ios_backgroundColor="#374151"
            />
          </View>
          {!notificationsAvailable && (
            <Text style={[styles.toggleWarning, { color: '#F59E0B' }]}>
              ⚠️ Install expo-notifications for medical reminders
            </Text>
          )}
          {notificationsAvailable && !notificationPermission && notificationsEnabled && (
            <Text style={[styles.toggleWarning, { color: '#F59E0B' }]}>
              ⚠️ Notification permissions required
            </Text>
          )}
        </View>

        {/* Countdown Timer - Only if notifications enabled */}
        {notificationsEnabled && notificationsScheduled && nextReminderTime && (
          <View style={[styles.countdownCard, { backgroundColor: theme.danger }]}>
            <Text style={styles.countdownTitle}>⏰ Next Medical Reminder In:</Text>
            <Text style={styles.countdownTime}>{timeUntilNext}</Text>
            <Text style={styles.countdownSubtext}>
              {diseaseName}: {calculatedIntake.intake}ml prescribed
            </Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.secondaryText }]}>Disease/Condition Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.secondary, color: theme.primaryText }]}
            onChangeText={setDiseaseName}
            value={diseaseName}
            placeholder="e.g., Kidney Disease, Heart Failure"
            placeholderTextColor="#6B7280"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.secondaryText }]}>Daily Water Goal (ML) *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.secondary, color: theme.primaryText }]}
            onChangeText={setDailyGoal}
            value={dailyGoal}
            keyboardType="numeric"
            placeholder="Enter goal based on doctor's advice"
            placeholderTextColor="#6B7280"
          />
          <Text style={[styles.helperText, { color: theme.secondaryText }]}>
            💡 Some conditions require fluid restriction. Follow your doctor's advice.
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.secondaryText }]}>Reminder Time Gap (Hours) *</Text>
          <View style={styles.gapSelector}>
            {AVAILABLE_GAPS.map(gap => (
              <TouchableOpacity
                key={gap}
                style={[
                  styles.gapButton,
                  { backgroundColor: reminderGap === gap ? theme.danger : theme.secondary },
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
                  borderColor: reminderGap > 4 ? theme.danger : '#374151',
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

        {/* Real-Time Progress - ALWAYS WORKS */}
        <View style={[styles.realTimeCard, { backgroundColor: theme.secondary }]}>
          <Text style={[styles.summaryTitle, { color: theme.primaryText }]}>
            🔴 Live Hydration Progress
          </Text>
          <Text style={[styles.liveIndicator, { color: theme.danger }]}>
            ● Real-time from your water bottle
          </Text>

          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${progressPercentage}%`, backgroundColor: goalAchieved ? theme.accent : theme.danger }]} />
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
            <Text style={[styles.summaryValue, { color: theme.danger }]}>
              {currentGoal > 0 ? currentGoal : '--'} ml
            </Text>
          </View>

          {diseaseName && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Condition:</Text>
              <Text style={[styles.summaryValue, { color: theme.danger }]}>
                {diseaseName}
              </Text>
            </View>
          )}

          {goalAchieved && (
            <View style={[styles.achievementBanner, { backgroundColor: theme.accent }]}>
              <Text style={styles.achievementEmoji}>🎉</Text>
              <Text style={styles.achievementText}>Goal Achieved!</Text>
            </View>
          )}
        </View>

        <View style={[styles.summaryCard, { backgroundColor: theme.secondary, marginTop: 20 }]}>
          <Text style={[styles.summaryTitle, { color: theme.danger }]}>
            Your Calculated Intake Plan:
          </Text>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.secondaryText }]}>Condition:</Text>
            <Text style={[styles.summaryValue, { color: theme.primaryText }]}>
              {diseaseName || 'Not specified'}
            </Text>
          </View>
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
            <Text style={[styles.summaryValue, { color: theme.danger }]}>
              {calculatedIntake.intake > 0 ? `${calculatedIntake.intake} ml` : '--'}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              {
                backgroundColor: theme.danger,
                opacity: (dailyGoal && parseFloat(dailyGoal) > 0 && diseaseName.trim() !== '') ? 1 : 0.5
              }
            ]}
            onPress={handleSave}
            disabled={isSaving || !dailyGoal || parseFloat(dailyGoal) <= 0 || diseaseName.trim() === ''}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save Medical Plan</Text>
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
  toggleCard: { padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#374151' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleInfo: { flex: 1, marginRight: 12 },
  toggleTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  toggleDescription: { fontSize: 13, lineHeight: 18 },
  toggleWarning: { fontSize: 12, marginTop: 10, fontStyle: 'italic' },
  countdownCard: { padding: 20, borderRadius: 15, marginBottom: 20, alignItems: 'center', elevation: 5 },
  countdownTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 10 },
  countdownTime: { color: '#FFFFFF', fontSize: 36, fontWeight: 'bold', marginBottom: 5 },
  countdownSubtext: { color: '#FFFFFF', fontSize: 14, opacity: 0.9 },
  warningBanner: { padding: 15, borderRadius: 10, marginBottom: 20, alignItems: 'center' },
  warningEmoji: { fontSize: 32, marginBottom: 8 },
  warningText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 16, marginBottom: 8, fontWeight: '600' },
  input: { height: 50, borderRadius: 10, paddingHorizontal: 15, fontSize: 18, borderWidth: 1, borderColor: '#374151' },
  helperText: { fontSize: 12, marginTop: 5, fontStyle: 'italic' },
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
  achievementBanner: { marginTop: 15, padding: 15, borderRadius: 10, alignItems: 'center' },
  achievementEmoji: { fontSize: 32, marginBottom: 5 },
  achievementText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});

export default DiseaseHydrationPlan;