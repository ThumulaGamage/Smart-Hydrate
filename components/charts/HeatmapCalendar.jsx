import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import useTheme from '../../Theme/theme';


const HeatmapCalendar = ({ monthData = [], dailyGoal = 2500 }) => {
  const theme = useTheme();

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get current month name
  const currentMonth = monthData.length > 0 
    ? new Date(monthData[0].date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Get color based on achievement percentage (you can update these values from database later)
  const getColorForDay = (consumed) => {
    if (consumed === 0) return '#e0e0e0'; // No data - gray
    
    const percentage = (consumed / dailyGoal) * 100;
    
    if (percentage >= 100) return '#27ae60'; // 100%+ - dark green
    if (percentage >= 75) return '#2ecc71';  // 75-99% - medium green  
    if (percentage >= 50) return '#52c483';  // 50-74% - light green
    if (percentage >= 25) return '#f39c12';  // 25-49% - orange
    return '#e74c3c'; // 0-24% - red
  };

  // Organize days into weeks
  const weeks = [];
  let currentWeek = [];
  
  // Add empty cells for days before the first day of month
  if (monthData.length > 0) {
    const firstDayOfWeek = monthData[0].dayOfWeek;
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push(null);
    }
  }

  // Add all days
  monthData.forEach((dayData) => {
    currentWeek.push(dayData);
    
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  // Add remaining days to last week
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  // Calculate statistics
  const daysWithData = monthData.filter(day => day.consumed > 0).length;
  const totalConsumed = monthData.reduce((sum, day) => sum + day.consumed, 0);
  const avgDaily = daysWithData > 0 ? Math.round(totalConsumed / daysWithData) : 0;
  const daysAchieved = monthData.filter(day => day.consumed >= dailyGoal).length;
  const successRate = monthData.length > 0 ? Math.round((daysAchieved / monthData.length) * 100) : 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Title */}
      <Text style={[styles.title, { color: theme.text }]}>Monthly Consistency</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
        {currentMonth}
      </Text>

      {monthData.length === 0 ? (
        /* No Data Message */
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataEmoji}>📅</Text>
          <Text style={[styles.noDataText, { color: theme.text }]}>
            No Data Yet
          </Text>
          <Text style={[styles.noDataSubtext, { color: theme.textMuted }]}>
            Start tracking your water intake to see monthly consistency!
          </Text>
        </View>
      ) : (
        <>
          {/* Calendar Grid */}
          <View style={styles.calendarContainer}>
            {/* Week day headers */}
            <View style={styles.weekDaysRow}>
              {weekDays.map((day) => (
                <View key={day} style={styles.weekDayCell}>
                  <Text style={[styles.weekDayText, { color: theme.textMuted }]}>
                    {day}
                  </Text>
                </View>
              ))}
            </View>

            {/* Calendar weeks */}
            {weeks.map((week, weekIndex) => (
              <View key={weekIndex} style={styles.weekRow}>
                {week.map((dayData, dayIndex) => (
                  <View key={dayIndex} style={styles.dayCell}>
                    {dayData ? (
                      <View
                        style={[
                          styles.dayBox,
                          { backgroundColor: getColorForDay(dayData.consumed) },
                        ]}
                      >
                        <Text style={styles.dayNumber}>{dayData.day}</Text>
                      </View>
                    ) : (
                      <View style={styles.emptyDayBox} />
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>

          {/* Legend */}
          <View style={styles.legendContainer}>
            <Text style={[styles.legendTitle, { color: theme.text }]}>Achievement Level</Text>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: '#e74c3c' }]} />
                <Text style={[styles.legendText, { color: theme.textMuted }]}>{'<25%'}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: '#f39c12' }]} />
                <Text style={[styles.legendText, { color: theme.textMuted }]}>25-49%</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: '#52c483' }]} />
                <Text style={[styles.legendText, { color: theme.textMuted }]}>50-74%</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: '#2ecc71' }]} />
                <Text style={[styles.legendText, { color: theme.textMuted }]}>75-99%</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: '#27ae60' }]} />
                <Text style={[styles.legendText, { color: theme.textMuted }]}>100%+</Text>
              </View>
            </View>
          </View>

          {/* Statistics */}
          <View style={styles.statsContainer}>
            <View style={[styles.statCard, { backgroundColor: theme.background }]}>
              <Text style={[styles.statValue, { color: '#3498db' }]}>{avgDaily}ml</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Avg Daily</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.background }]}>
              <Text style={[styles.statValue, { color: '#27ae60' }]}>{daysAchieved}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Goals Met</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.background }]}>
              <Text style={[styles.statValue, { color: '#9b59b6' }]}>{successRate}%</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Success Rate</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.background }]}>
              <Text style={[styles.statValue, { color: '#e74c3c' }]}>{daysWithData}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Days Tracked</Text>
            </View>
          </View>

          {/* Monthly Insight */}
          <View style={[styles.insightContainer, { backgroundColor: theme.background }]}>
            <Text style={[styles.insightTitle, { color: theme.text }]}>📅 Monthly Insight</Text>
            <Text style={[styles.insightText, { color: theme.textMuted }]}>
              {successRate >= 80
                ? `Outstanding! You achieved your goal ${daysAchieved} days this month. Keep it up! 🎉`
                : successRate >= 60
                ? `Good progress! You're on track. Try to stay consistent. 💪`
                : successRate >= 40
                ? `You're halfway there! Set reminders to help you stay hydrated. 💧`
                : `Let's build a routine! Small daily improvements lead to big results. 🚰`}
            </Text>
          </View>

          {/* Streaks */}
          {daysAchieved > 0 && (
            <View style={[styles.streakContainer, { backgroundColor: '#27ae6020' }]}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={[styles.streakTitle, { color: '#27ae60' }]}>
                {daysAchieved}-Day Achievement
              </Text>
              <Text style={[styles.streakText, { color: theme.textMuted }]}>
                You've met your goal {daysAchieved} {daysAchieved === 1 ? 'day' : 'days'} this month!
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  calendarContainer: {
    marginBottom: 20,
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    padding: 2,
  },
  dayBox: {
    flex: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDayBox: {
    flex: 1,
  },
  dayNumber: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  legendContainer: {
    marginBottom: 20,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  insightContainer: {
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#9b59b6',
    marginBottom: 16,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  insightText: {
    fontSize: 13,
    lineHeight: 20,
  },
  streakContainer: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  streakEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  streakTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  streakText: {
    fontSize: 13,
    textAlign: 'center',
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noDataEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  noDataText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  noDataSubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default HeatmapCalendar;