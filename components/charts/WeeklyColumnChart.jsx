import React from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import useTheme from '../../Theme/theme';

const { width } = Dimensions.get('window');

const WeeklyColumnChart = ({ weekData = [], dailyGoal = 2500 }) => {
  const theme = useTheme();

  // Prepare data for the chart
  const labels = weekData.map(day => day.dayName || '');
  const consumedData = weekData.map(day => day.consumed || 0);

  const chartData = {
    labels,
    datasets: [
      {
        data: consumedData,
        color: (opacity = 1) => `rgba(52, 152, 219, ${opacity})`, // Blue for consumed
      },
    ],
  };

  // Calculate statistics
  const totalConsumed = consumedData.reduce((sum, val) => sum + val, 0);
  const avgConsumed = weekData.length > 0 ? Math.round(totalConsumed / weekData.length) : 0;
  const daysAchieved = weekData.filter(day => day.consumed >= dailyGoal).length;
  const successRate = weekData.length > 0 ? Math.round((daysAchieved / weekData.length) * 100) : 0;

  // Find best and worst days
  const bestDay = weekData.reduce((best, day) => 
    day.consumed > best.consumed ? day : best, 
    { consumed: 0, dayName: '-' }
  );
  const worstDay = weekData.reduce((worst, day) => 
    day.consumed < worst.consumed && day.consumed > 0 ? day : worst, 
    { consumed: Infinity, dayName: '-' }
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>Weekly Comparison</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
        Last 7 days: Consumed vs Goal
      </Text>

      {/* Chart Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#3498db' }]} />
          <Text style={[styles.legendText, { color: theme.text }]}>Consumed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDash, { borderColor: '#27ae60' }]} />
          <Text style={[styles.legendText, { color: theme.text }]}>Goal: {dailyGoal}ml</Text>
        </View>
      </View>

      {weekData.length === 0 ? (
        /* No Data Message */
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataEmoji}>📊</Text>
          <Text style={[styles.noDataText, { color: theme.text }]}>
            No Weekly Data Yet
          </Text>
          <Text style={[styles.noDataSubtext, { color: theme.textMuted }]}>
            Start tracking your water intake to see weekly comparison!
          </Text>
        </View>
      ) : (
        <>
          {/* Bar Chart */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chartContainer}>
              <BarChart
                data={chartData}
                width={Math.max(width - 40, weekData.length * 80)}
                height={240}
                yAxisSuffix="ml"
                chartConfig={{
                  backgroundColor: theme.card,
                  backgroundGradientFrom: theme.card,
                  backgroundGradientTo: theme.card,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(52, 152, 219, ${opacity})`,
                  labelColor: (opacity = 1) => theme.textMuted || `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16,
                  },
                  barPercentage: 0.7,
                  propsForBackgroundLines: {
                    strokeDasharray: '',
                    stroke: theme.textMuted || '#e0e0e0',
                    strokeOpacity: 0.2,
                  },
                }}
                style={styles.chart}
                fromZero
                showValuesOnTopOfBars
              />
            </View>
          </ScrollView>

          {/* Statistics Cards */}
          <View style={styles.statsContainer}>
            <View style={[styles.statCard, { backgroundColor: theme.background }]}>
              <Text style={[styles.statValue, { color: '#3498db' }]}>{avgConsumed}ml</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Daily Avg</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.background }]}>
              <Text style={[styles.statValue, { color: '#27ae60' }]}>{daysAchieved}/7</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Goals Met</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.background }]}>
              <Text style={[styles.statValue, { color: '#9b59b6' }]}>{successRate}%</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Success</Text>
            </View>
          </View>

          {/* Best & Worst Days */}
          <View style={styles.performanceContainer}>
            <View style={[styles.performanceCard, { backgroundColor: '#27ae6020' }]}>
              <Text style={styles.performanceEmoji}>🏆</Text>
              <Text style={[styles.performanceLabel, { color: theme.textMuted }]}>
                Best Day
              </Text>
              <Text style={[styles.performanceDay, { color: '#27ae60' }]}>
                {bestDay.dayName}
              </Text>
              <Text style={[styles.performanceValue, { color: theme.text }]}>
                {bestDay.consumed}ml
              </Text>
            </View>

            {worstDay.consumed !== Infinity && worstDay.consumed > 0 && (
              <View style={[styles.performanceCard, { backgroundColor: '#e74c3c20' }]}>
                <Text style={styles.performanceEmoji}>💪</Text>
                <Text style={[styles.performanceLabel, { color: theme.textMuted }]}>
                  Needs Work
                </Text>
                <Text style={[styles.performanceDay, { color: '#e74c3c' }]}>
                  {worstDay.dayName}
                </Text>
                <Text style={[styles.performanceValue, { color: theme.text }]}>
                  {worstDay.consumed}ml
                </Text>
              </View>
            )}
          </View>

          {/* Weekly Insight */}
          <View style={[styles.insightContainer, { backgroundColor: theme.background }]}>
            <Text style={[styles.insightTitle, { color: theme.text }]}>📊 Weekly Insight</Text>
            <Text style={[styles.insightText, { color: theme.textMuted }]}>
              {successRate >= 80
                ? 'Excellent consistency! You\'re maintaining great hydration habits. 🎉'
                : successRate >= 60
                ? 'Good progress! Try to be more consistent throughout the week. 💪'
                : successRate >= 40
                ? 'You\'re halfway there! Focus on meeting your daily goals more often. 💧'
                : 'Let\'s improve! Set reminders to help you stay on track with your hydration goals. 🚰'}
            </Text>
          </View>
        </>
      )}
    </View>
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
    marginBottom: 16,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendDash: {
    width: 20,
    height: 0,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  legendText: {
    fontSize: 13,
    fontWeight: '500',
  },
  chartContainer: {
    paddingVertical: 10,
  },
  chart: {
    borderRadius: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    opacity: 0.7,
    textAlign: 'center',
  },
  performanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 8,
  },
  performanceCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  performanceEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  performanceLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  performanceDay: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  performanceValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  insightContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
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

export default WeeklyColumnChart;