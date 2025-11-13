import React from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import useTheme from '../../Theme/theme';
import { Ionicons } from '@expo/vector-icons';
const { width } = Dimensions.get('window');

const DailyPatternChart = ({ data = [] }) => {
  const theme = useTheme();

  

  const chartData = data;
  // Filter to show only active hours
  const activeHours = chartData.filter(item => item.volume > 0);

  const lineChartData = {
    labels: activeHours.map(item => item.label),
    datasets: [
      {
        data: activeHours.map(item => item.volume),
        color: (opacity = 1) => `rgba(52, 152, 219, ${opacity})`,
        strokeWidth: 3
      }
    ],
  };

  // Calculate statistics
  const totalVolume = chartData.reduce((sum, item) => sum + item.volume, 0);
  const drinksCount = chartData.filter(item => item.volume > 0).length;
  const avgVolume = drinksCount > 0 ? Math.round(totalVolume / drinksCount) : 0;
  const peakHour = chartData.reduce((max, item) => 
    item.volume > max.volume ? item : max, 
    { hour: 0, volume: 0 }
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>Daily Water Pattern</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
        Hourly intake throughout the day
      </Text>

      {/* Statistics Cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.background }]}>
          <Text style={[styles.statValue, { color: '#3498db' }]}>{totalVolume}ml</Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Total</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: theme.background }]}>
          <Text style={[styles.statValue, { color: '#27ae60' }]}>{avgVolume}ml</Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Avg</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: theme.background }]}>
          <Text style={[styles.statValue, { color: '#e74c3c' }]}>{peakHour.hour}:00</Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Peak</Text>
        </View>
      </View>

      {/* Line Chart */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chartContainer}>
          {activeHours.length > 0 ? (
            <LineChart
              data={lineChartData}
              width={Math.max(width - 40, activeHours.length * 40)}
              height={220}
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
                propsForDots: {
                  r: '5',
                  strokeWidth: '2',
                  stroke: '#3498db',
                },
              }}
              bezier
              style={styles.chart}
              fromZero
            />
          ) : (
            <View style={styles.noDataContainer}>
                <View style={styles.noDataIconContainer}>
                    <Ionicons name="water-outline" size={80} color="#3498db" />
                </View>
                <Text style={[styles.noDataText, { color: theme.text }]}>
                    No Water Intake Today
                </Text>
                <Text style={[styles.noDataSubtext, { color: theme.textMuted }]}>
                    Start drinking water to see your hourly pattern! 💧
                </Text>
                <View style={styles.noDataTipBox}>
                    <Text style={styles.noDataTip}>💡 Tip: Stay hydrated throughout the day</Text>
                </View>
             </View>
          )}
        </View>
      </ScrollView>
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
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
  },
  chartContainer: {
    paddingVertical: 10,
  },
  chart: {
    borderRadius: 16,
  },
  noDataContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 16,
  },
});

export default DailyPatternChart;