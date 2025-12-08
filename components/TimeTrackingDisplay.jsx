// components/TimeTrackingDisplay.jsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTimeTracking } from '../hooks/_useTimeTracking';
import useTheme from '../Theme/theme';
import ThemedView from './ThemedView';
import ThemedText from './ThemedText';
import ThemedButton from './ThemedButton';

export default function TimeTrackingDisplay() {
  const theme = useTheme();
  const {
    totalTime,
    sessionTime,
    combinedTime,
    isTracking,
    lastSync,
    syncToFirebase,
    resetTimeTracking,
    getTodayTime,
    getWeeklyData,
    formatTime,
    formatTimeHuman,
  } = useTimeTracking();

  const [todayTime, setTodayTime] = useState(0);
  const [weeklyData, setWeeklyData] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showWeekly, setShowWeekly] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load today's time and weekly data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [today, weekly] = await Promise.all([
        getTodayTime(),
        getWeeklyData(),
      ]);
      setTodayTime(today);
      setWeeklyData(weekly);
    } catch (error) {
      console.error('Error loading time data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      await syncToFirebase();
      await loadData(); // Reload data after sync
    } catch (error) {
      console.error('Sync error:', error);
      alert('Failed to sync data');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReset = async () => {
    try {
      const confirmed = await new Promise((resolve) => {
        // In a real app, use a proper modal/dialog
        if (confirm('Are you sure you want to reset all time tracking data?')) {
          resolve(true);
        } else {
          resolve(false);
        }
      });

      if (confirmed) {
        await resetTimeTracking();
        await loadData();
      }
    } catch (error) {
      console.error('Reset error:', error);
      alert('Failed to reset data');
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={styles.loadingText}>Loading time data...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView style={styles.scrollView}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={[styles.title, { color: theme.primary }]}>
            ⏱️ Time Tracking
          </ThemedText>
          {isTracking && (
            <View style={[styles.statusBadge, { backgroundColor: theme.success || '#4CAF50' }]}>
              <View style={styles.pulseDot} />
              <Text style={styles.statusText}>Active</Text>
            </View>
          )}
        </View>

        {/* Current Session Card */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="timer-outline" size={24} color={theme.primary} />
            <ThemedText style={styles.cardTitle}>Current Session</ThemedText>
          </View>
          <ThemedText style={[styles.bigTime, { color: theme.primary }]}>
            {formatTime(sessionTime)}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {formatTimeHuman(sessionTime)}
          </ThemedText>
        </View>

        {/* Today's Total Card */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="today-outline" size={24} color={theme.accent || '#FF9800'} />
            <ThemedText style={styles.cardTitle}>Today's Total</ThemedText>
          </View>
          <ThemedText style={[styles.bigTime, { color: theme.accent || '#FF9800' }]}>
            {formatTime(todayTime + sessionTime)}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {formatTimeHuman(todayTime + sessionTime)}
          </ThemedText>
        </View>

        {/* All-Time Total Card */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="time-outline" size={24} color={theme.success || '#4CAF50'} />
            <ThemedText style={styles.cardTitle}>All-Time Total</ThemedText>
          </View>
          <ThemedText style={[styles.bigTime, { color: theme.success || '#4CAF50' }]}>
            {formatTime(combinedTime)}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {formatTimeHuman(combinedTime)}
          </ThemedText>
          <View style={styles.breakdown}>
            <ThemedText style={styles.breakdownText}>
              Previous: {formatTime(totalTime)}
            </ThemedText>
            <ThemedText style={styles.breakdownText}>
              Current: {formatTime(sessionTime)}
            </ThemedText>
          </View>
        </View>

        {/* Weekly Overview Toggle */}
        <TouchableOpacity
          style={[styles.toggleButton, { backgroundColor: theme.card }]}
          onPress={() => setShowWeekly(!showWeekly)}
        >
          <ThemedText style={styles.toggleText}>
            {showWeekly ? 'Hide' : 'Show'} Weekly Overview
          </ThemedText>
          <Ionicons
            name={showWeekly ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.text}
          />
        </TouchableOpacity>

        {/* Weekly Data */}
        {showWeekly && (
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <ThemedText style={styles.cardTitle}>Last 7 Days</ThemedText>
            {weeklyData.map((day, index) => {
              const date = new Date(day.date);
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
              const isToday = day.date === new Date().toISOString().split('T')[0];
              
              return (
                <View
                  key={day.date}
                  style={[
                    styles.weekDay,
                    isToday && { backgroundColor: theme.primaryLight || '#E3F2FD' },
                  ]}
                >
                  <View style={styles.weekDayLeft}>
                    <ThemedText style={[styles.weekDayName, isToday && { fontWeight: 'bold' }]}>
                      {dayName}
                    </ThemedText>
                    <ThemedText style={styles.weekDayDate}>
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.weekDayTime, isToday && { fontWeight: 'bold' }]}>
                    {formatTime(day.totalSeconds)}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: theme.primary },
              isSyncing && styles.actionButtonDisabled,
            ]}
            onPress={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="cloud-upload-outline" size={20} color="#FFF" />
            )}
            <Text style={styles.actionButtonText}>
              {isSyncing ? 'Syncing...' : 'Sync to Cloud'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.error || '#F44336' }]}
            onPress={handleReset}
          >
            <Ionicons name="refresh-outline" size={20} color="#FFF" />
            <Text style={styles.actionButtonText}>Reset All</Text>
          </TouchableOpacity>
        </View>

        {/* Last Sync Info */}
        {lastSync && (
          <ThemedText style={styles.lastSyncText}>
            Last synced: {lastSync.toLocaleTimeString()}
          </ThemedText>
        )}

        {/* Info Box */}
        <View style={[styles.infoBox, { backgroundColor: theme.primaryLight || '#E3F2FD' }]}>
          <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
          <ThemedText style={styles.infoText}>
            Time tracking runs automatically. Data is saved even when the app is closed.
          </ThemedText>
        </View>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
    marginRight: 6,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  bigTime: {
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 8,
    fontFamily: 'monospace',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  breakdown: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  breakdownText: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  toggleButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '500',
  },
  weekDay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  weekDayLeft: {
    flex: 1,
  },
  weekDayName: {
    fontSize: 16,
  },
  weekDayDate: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  weekDayTime: {
    fontSize: 16,
    fontFamily: 'monospace',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  lastSyncText: {
    textAlign: 'center',
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 16,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});