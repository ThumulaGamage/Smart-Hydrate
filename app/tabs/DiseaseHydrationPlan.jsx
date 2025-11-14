import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { ref, onValue, update } from 'firebase/database';
import { getDatabase } from 'firebase/database';

// Import auth and WaterBottleService from your existing Firebase config
import { auth, WaterBottleService } from '../../config/firebaseConfig';

// Local theme definition
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

// Initialize database
let database;
try {
  database = getDatabase(auth.app);
} catch (e) {
  console.error("Failed to initialize Realtime Database:", e);
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

  // Wait for authentication
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
        console.log('User authenticated:', user.uid);

        // Initialize WaterBottleService
        const service = new WaterBottleService(user.uid);
        setWaterBottleService(service);
      } else {
        setUserId(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for consumption data
  useEffect(() => {
    if (!userId || !waterBottleService) {
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('🔄 Setting up real-time listeners for disease hydration plan...');

    // Listen to today's stats in real-time
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

    // Listen to disease profile for saved goal, reminder gap, and disease name
    const diseaseProfileRef = ref(database, `users/${userId}/diseaseProfile`);
    const unsubscribeDiseaseProfile = onValue(diseaseProfileRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log('📋 Disease profile data loaded:', data);

        if (data.dailyGoal) {
          setDailyGoal(String(data.dailyGoal));
        }
        if (data.reminderGap) {
          setReminderGap(data.reminderGap);
          if (data.reminderGap > 4) {
            setCustomGap(String(data.reminderGap));
          }
        }
        if (data.diseaseName) {
          setDiseaseName(data.diseaseName);
        }
      }
    }, (error) => {
      console.error("Error listening to disease profile:", error);
    });

    // Cleanup listeners
    return () => {
      console.log('🧹 Cleaning up disease hydration plan listeners');
      if (unsubscribeTodayStats) unsubscribeTodayStats();
      if (unsubscribeDiseaseProfile) unsubscribeDiseaseProfile();
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

    if (!diseaseName || diseaseName.trim() === '') {
      Alert.alert("Disease Name Required", "Please enter the disease/condition name.");
      return;
    }

    setIsSaving(true);

    try {
      const todayStr = getTodayDateString();
      const now = Date.now();

      // Save to diseaseProfile (separate from regular profile)
      const diseaseProfileRef = ref(database, `users/${userId}/diseaseProfile`);
      await update(diseaseProfileRef, {
        dailyGoal: goalValue,
        reminderGap: parseInt(reminderGap),
        diseaseName: diseaseName.trim(),
        lastUpdated: now,
        updatedAt: new Date().toISOString()
      });

      // Update today's goal in dailyStats (same stats tracking)
      const dailyStatsRef = ref(database, `users/${userId}/dailyStats/${todayStr}`);
      await update(dailyStatsRef, {
        goal: goalValue,
        date: todayStr,
        lastUpdated: now,
        diseaseMode: true,
        diseaseName: diseaseName.trim()
      });

      console.log('✅ Disease hydration plan saved successfully to Firebase');
      Alert.alert(
        "Plan Saved!",
        `Your disease hydration plan has been saved successfully.\n\nCondition: ${diseaseName}\nDaily Goal: ${goalValue}ml\nReminder Gap: Every ${reminderGap} hours\nYou'll receive ${calculatedIntake.reminders} reminders to drink ${calculatedIntake.intake}ml each.\n\n⚠️ Always follow your doctor's advice.`,
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("❌ Failed to save disease plan to Realtime Database:", error);
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
        <ActivityIndicator size="large" color={theme.danger} />
        <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading Disease Hydration Plan...</Text>
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
        <Text style={[styles.planTitle, { color: theme.primaryText }]}>Disease Hydration Plan</Text>

        {/* Warning Banner */}
        <View style={[styles.warningBanner, { backgroundColor: theme.danger }]}>
          <Text style={styles.warningEmoji}>⚠️</Text>
          <Text style={styles.warningText}>
            Consult your doctor before setting fluid goals. This plan should be based on medical advice.
          </Text>
        </View>

        {/* 1. Disease Name Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.secondaryText }]}>Disease/Condition Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.secondary, color: theme.primaryText }]}
            onChangeText={(text) => setDiseaseName(text)}
            value={diseaseName}
            placeholder="e.g., Kidney Disease, Heart Failure, Diabetes"
            placeholderTextColor="#6B7280"
            editable={true}
          />
        </View>

        {/* 2. Daily Water Goal Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.secondaryText }]}>Daily Water Goal (ML) *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.secondary, color: theme.primaryText }]}
            onChangeText={(text) => setDailyGoal(text)}
            value={dailyGoal}
            keyboardType="numeric"
            placeholder="Enter goal based on doctor's advice"
            placeholderTextColor="#6B7280"
            editable={true}
          />
          <Text style={[styles.helperText, { color: theme.secondaryText }]}>
            💡 Some conditions require fluid restriction. Always follow your healthcare provider's recommendations.
          </Text>
        </View>

        {/* 3. Reminder Gap Selector */}
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

            {/* Custom Gap Input */}
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

        {/* 4. Real-Time Consumption Status */}
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

        {/* 5. Calculated Plan Summary and Save */}
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
              <Text style={styles.saveButtonText}>Save Disease Plan</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

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
  warningBanner: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  warningEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  warningText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
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
  helperText: {
    fontSize: 12,
    marginTop: 5,
    fontStyle: 'italic',
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

export default DiseaseHydrationPlan;