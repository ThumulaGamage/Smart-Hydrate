import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { ref, onValue, update } from 'firebase/database';

// Import auth and WaterBottleService from your existing Firebase config (like HomeTab does)
import { auth, WaterBottleService } from '../../config/firebaseConfig';

// IMPORTING Theme, Utilities, and database from the main file
import {
    theme, AVAILABLE_GAPS, WAKING_HOURS,
    getTodayDateString, database
} from './customize-hydration';

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

  // Wait for authentication (same as HomeTab)
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
        console.log('User authenticated:', user.uid);

        // Initialize WaterBottleService (same as HomeTab)
        const service = new WaterBottleService(user.uid);
        setWaterBottleService(service);
      } else {
        setUserId(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for consumption data (like HomeTab)
  useEffect(() => {
    if (!userId || !waterBottleService) {
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('🔄 Setting up real-time listeners for hydration plan...');

    // Listen to today's stats in real-time (SAME AS HOMETAB)
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

    // Also listen to profile for saved goal and reminder gap
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
      }
    }, (error) => {
      console.error("Error listening to profile:", error);
    });

    // Cleanup listeners
    return () => {
      console.log('🧹 Cleaning up hydration plan listeners');
      if (unsubscribeTodayStats) unsubscribeTodayStats();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [userId, waterBottleService, database]);

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

  // Handle custom gap input
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

    setIsSaving(true);

    try {
      const todayStr = getTodayDateString();
      const now = Date.now();

      // Save to profile (user's default settings including reminder gap)
      const profileRef = ref(database, `users/${userId}/profile`);
      await update(profileRef, {
        dailyGoal: goalValue,
        reminderGap: parseInt(reminderGap),  // SAVE TIME GAP HERE
        lastUpdated: now,
        updatedAt: new Date().toISOString()
      });

      // Update today's goal in dailyStats
      const dailyStatsRef = ref(database, `users/${userId}/dailyStats/${todayStr}`);
      await update(dailyStatsRef, {
        goal: goalValue,
        date: todayStr,
        lastUpdated: now,
      });

      console.log('✅ Goal and reminder gap saved successfully to Firebase');
      Alert.alert(
        "Plan Saved!",
        `Your daily water goal of ${goalValue}ml has been saved successfully.\n\nReminder Gap: Every ${reminderGap} hours\nYou'll receive ${calculatedIntake.reminders} reminders to drink ${calculatedIntake.intake}ml each.`,
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("❌ Failed to save plan to Realtime Database:", error);
      Alert.alert("Save Error", `Failed to save plan: ${error.message}\n\nPlease check your connection and try again.`);
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

        {/* 1. Daily Water Goal Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.secondaryText }]}>Daily Water Goal (ML)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.secondary, color: theme.primaryText }]}
            onChangeText={(text) => setDailyGoal(text)}
            value={dailyGoal}
            keyboardType="numeric"
            placeholder="Enter your goal (e.g., 3000)"
            placeholderTextColor="#6B7280"
            editable={true}
          />
        </View>

        {/* 2. Reminder Gap Selector */}
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

            {/* Custom Gap Input */}
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

        {/* 3. Real-Time Consumption Status (LIVE DATA FROM BOTTLE) */}
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

        {/* 4. Calculated Plan Summary and Save */}
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

// --- Stylesheet ---
const styles = StyleSheet.create({
  planScrollView: {
    flex: 1,
  },
  planScrollContent: {
    padding: 20,
    paddingBottom: 50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 300,
    backgroundColor: theme.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  planContainer: {
    flex: 1,
  },
  planTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    height: 50,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#374151',
  },
  gapSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  gapButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  gapText: {
    fontWeight: '700',
    fontSize: 16,
  },
  inputCustom: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    textAlign: 'center',
  },
  summaryCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  realTimeCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  liveIndicator: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 15,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  saveButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressContainer: {
    height: 10,
    backgroundColor: '#374151',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 5,
  },
  progressText: {
    textAlign: 'right',
    fontSize: 12,
  },
  achievementBanner: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#0D9488',
    borderRadius: 10,
    alignItems: 'center',
  },
  achievementEmoji: {
    fontSize: 32,
    marginBottom: 5,
  },
  achievementText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});