import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Dimensions,
  Platform,
  TouchableOpacity,
  ScrollView,
  StyleSheet
} from 'react-native';
// Import Svg components required for the circular chart
import Svg, { Circle } from 'react-native-svg';
import { BarChart } from 'react-native-chart-kit';
import { MaterialIcons } from '@expo/vector-icons';
import { WaterBottleService } from '../../config/firebaseConfig';

const { width: screenWidth } = Dimensions.get('window');

// --- Circular Chart Constants (now dynamic inside component) ---
const STROKE_WIDTH = 20;
const CIRCLE_SIZE = 220;

// Helper function for cross-platform card styles
const getCardStyle = (theme) => ({
  backgroundColor: theme?.card || 'white',
  margin: 16,
  padding: 20,
  borderRadius: 16,
  ...Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    android: {
      elevation: 5,
    }
  })
});

// =======================================================
// 1. UPDATED HYDRATION GOAL CARD (REPLACED WITH YOUR DESIGN)
// =======================================================
export const HydrationGoalCard = ({ dailyStats, theme }) => {
  const consumed = dailyStats.totalConsumed || 0;
  const goal = dailyStats.goal || 2500;
  const isNewUser = dailyStats.isNewUser && consumed === 0;

  // Calculate percentage
  const percentage = Math.min(Math.round((consumed / goal) * 100), 100);
  const remaining = Math.max(goal - consumed, 0);

  // Determine color based on progress
  const getProgressColor = () => {
    if (percentage >= 100) return '#27ae60'; // Green - Goal achieved
    if (percentage >= 75) return '#3498db';  // Blue - Good progress
    if (percentage >= 50) return '#f39c12';  // Orange - Half way
    return '#e74c3c'; // Red - Need more water
  };

  const progressColor = getProgressColor();

  // Get motivational message
  const getMessage = () => {
    if (percentage >= 100) return 'Goal Achieved! 🎉';
    if (percentage >= 75) return 'Almost there! 💪';
    if (percentage >= 50) return 'Keep going! 💧';
    return 'Stay hydrated! 🚰';
  };

  // Circle calculations
  const size = CIRCLE_SIZE;
  const strokeWidth = STROKE_WIDTH;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (percentage / 100) * circumference;

  // --- Empty State (New User) ---
  if (isNewUser) {
    return (
      <View style={[getCardStyle(theme), styles.emptyCard]}>
        <Text style={[styles.title, { color: theme?.text || '#2c3e50' }]}>
          Today's Progress
        </Text>
        <Text style={[styles.subtitle, { color: theme?.textMuted || '#7f8c8d' }]}>
          Your daily hydration goal
        </Text>
        <View style={styles.emptyState}>
          <MaterialIcons name="local-drink" size={48} color={theme?.textMuted || '#BDBDBD'} />
          <Text style={[styles.emptyTextBold, { color: theme?.text || '#2c3e50' }]}>
            {goal}ml Goal Set
          </Text>
          <Text style={[styles.emptyTextMuted, { color: theme?.textMuted || '#7f8c8d' }]}>
            Start drinking to begin tracking your progress
          </Text>
        </View>
      </View>
    );
  }

  // --- Progress State (Enhanced Circular Chart) ---
  return (
    <View style={getCardStyle(theme)}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme?.text || '#2c3e50' }]}>
          Today's Progress
        </Text>
        <View style={styles.badge}>
          <MaterialIcons name="sensors" size={14} color="#1976D2" />
          <Text style={styles.badgeText}>Auto-tracked</Text>
        </View>
      </View>
      <Text style={[styles.subtitle, { color: theme?.textMuted || '#7f8c8d', marginBottom: 16 }]}>
        Your daily hydration goal
      </Text>

      {/* Circular Progress Ring */}
      <View style={styles.circleContainer}>
        <Svg width={size} height={size}>
          {/* Background Circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={theme?.textMuted || '#e0e0e0'}
            strokeWidth={strokeWidth}
            fill="none"
            opacity={0.2}
          />
          
          {/* Progress Circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={progressColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={progressOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>

        {/* Center Text */}
        <View style={styles.centerTextContainer}>
          <Text style={[styles.percentageText, { color: progressColor }]}>
            {percentage}%
          </Text>
          <Text style={[styles.consumedText, { color: theme?.text || '#2c3e50' }]}>
            {consumed}ml
          </Text>
          <Text style={[styles.goalText, { color: theme?.textMuted || '#7f8c8d' }]}>
            of {goal}ml
          </Text>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: theme?.background || '#F8F9FA' }]}>
          <Text style={[styles.statValue, { color: '#3498db' }]}>{consumed}ml</Text>
          <Text style={[styles.statLabel, { color: theme?.textMuted || '#7f8c8d' }]}>Consumed</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme?.background || '#F8F9FA' }]}>
          <Text style={[styles.statValue, { color: '#e74c3c' }]}>{remaining}ml</Text>
          <Text style={[styles.statLabel, { color: theme?.textMuted || '#7f8c8d' }]}>Remaining</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme?.background || '#F8F9FA' }]}>
          <Text style={[styles.statValue, { color: '#27ae60' }]}>{goal}ml</Text>
          <Text style={[styles.statLabel, { color: theme?.textMuted || '#7f8c8d' }]}>Daily Goal</Text>
        </View>
      </View>

      {/* Motivational Message */}
      <View style={[styles.messageContainer, { backgroundColor: progressColor + '20' }]}>
        <Text style={[styles.messageText, { color: progressColor }]}>
          {getMessage()}
        </Text>
      </View>

      {/* Progress Milestones */}
      <View style={styles.milestonesContainer}>
        <Text style={[styles.milestonesTitle, { color: theme?.text || '#2c3e50' }]}>
          Progress Milestones
        </Text>
        <View style={styles.milestones}>
          {[
            { percent: 25, label: 'Good Start', achieved: percentage >= 25 },
            { percent: 50, label: 'Halfway', achieved: percentage >= 50 },
            { percent: 75, label: 'Almost There', achieved: percentage >= 75 },
            { percent: 100, label: 'Goal!', achieved: percentage >= 100 },
          ].map((milestone) => (
            <View key={milestone.percent} style={styles.milestone}>
              <View
                style={[
                  styles.milestoneCircle,
                  {
                    backgroundColor: milestone.achieved
                      ? progressColor
                      : theme?.textMuted || '#e0e0e0',
                  },
                ]}
              >
                <Text style={styles.milestonePercent}>
                  {milestone.achieved ? '✓' : milestone.percent}
                </Text>
              </View>
              <Text
                style={[
                  styles.milestoneLabel,
                  {
                    color: milestone.achieved ? theme?.text : theme?.textMuted,
                    fontWeight: milestone.achieved ? '600' : '400',
                  },
                ]}
              >
                {milestone.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

// =======================================================
// STYLESHEET (MERGED & UPDATED)
// =======================================================
const styles = StyleSheet.create({
  // Card States
  emptyCard: {
    borderWidth: 2, 
    borderColor: '#E0E0E0', 
    borderStyle: 'dashed' 
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(25, 118, 210, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  badgeText: {
    color: '#1976D2',
    fontSize: 12,
    marginLeft: 4
  },

  // Empty State
  emptyState: { 
    alignItems: 'center', 
    paddingVertical: 20 
  },
  emptyTextBold: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    marginTop: 12, 
    marginBottom: 4 
  },
  emptyTextMuted: { 
    fontSize: 14, 
    textAlign: 'center' 
  },

  // Circular Progress
  circleContainer: {
    marginVertical: 20,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 42,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  consumedText: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 2,
  },
  goalText: {
    fontSize: 14,
    opacity: 0.7,
  },

  // Stats Cards
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 24,
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

  // Motivational Message
  messageContainer: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  messageText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Milestones
  milestonesContainer: {
    width: '100%',
    marginTop: 24,
  },
  milestonesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  milestones: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  milestone: {
    alignItems: 'center',
    flex: 1,
  },
  milestoneCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  milestonePercent: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  milestoneLabel: {
    fontSize: 11,
    textAlign: 'center',
  },

  // --- WeeklyChart & DrinkingStats styles (from original) ---
  barChartContainer: { 
    marginVertical: 16 
  },
  completeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completeBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  footerText: {
    fontSize: 14,
  },
});

// =======================================================
// 2. ENHANCED SCROLLABLE BAR CHART COMPONENT (UNCHANGED)
// =======================================================
export const WeeklyChart = ({ weeklyData, dailyStats, theme }) => {
  const [chartType, setChartType] = useState('weekly');
  
  // Safe data handling
  const safeWeeklyData = useMemo(() => weeklyData || [], [weeklyData]);
  
  // Check if user is new or has no real data
  const isNewUser = useMemo(() => {
    if (!safeWeeklyData || safeWeeklyData.length === 0) return true;
    const totalConsumed = safeWeeklyData.reduce((sum, day) => sum + (day.totalConsumed || 0), 0);
    return totalConsumed === 0;
  }, [safeWeeklyData]);

  // Calculate weekly average
  const weeklyAverage = useMemo(() => {
    if (safeWeeklyData.length === 0) return 0;
    const total = safeWeeklyData.reduce((sum, day) => sum + (day.totalConsumed || 0), 0);
    return Math.round(total / safeWeeklyData.length);
  }, [safeWeeklyData]);

  // Generate daily chart data (last 24 hours with hourly breakdown)
  const dailyChartData = useMemo(() => {
    if (!dailyStats.sessions || dailyStats.sessions.length === 0) {
      return {
        labels: ['Night', 'Morning', 'Afternoon', 'Evening'],
        data: [0, 0, 0, 0]
      };
    }

    // Create hourly buckets for the last 24 hours
    const hourlyData = new Array(24).fill(0);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    dailyStats.sessions.forEach(session => {
      const sessionTime = new Date(session.timestamp);
      if (sessionTime >= startOfDay) {
        const hour = sessionTime.getHours();
        hourlyData[hour] += session.amount || 0;
      }
    });

    // Group into 6-hour periods for better visualization
    const groupedData = [
      hourlyData.slice(0, 6).reduce((a, b) => a + b, 0),    // 12AM-6AM
      hourlyData.slice(6, 12).reduce((a, b) => a + b, 0),   // 6AM-12PM
      hourlyData.slice(12, 18).reduce((a, b) => a + b, 0),  // 12PM-6PM
      hourlyData.slice(18, 24).reduce((a, b) => a + b, 0)  // 6PM-12AM
    ];

    return {
      labels: ['Night', 'Morning', 'Afternoon', 'Evening'],
      data: groupedData
    };
  }, [dailyStats.sessions]);

  // Enhanced chart configuration
  const chartConfig = {
    backgroundColor: 'transparent',
    backgroundGradientFrom: theme?.card || 'white',
    backgroundGradientTo: theme?.card || 'white',
    decimalPlaces: 0,
    color: (opacity = 1) => {
      if (chartType === 'weekly') {
        return `rgba(25, 118, 210, ${opacity})`;
      } else {
        return `rgba(255, 152, 0, ${opacity})`;
      }
    },
    labelColor: (opacity = 1) => theme?.text || `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForBackgroundLines: {
      strokeDasharray: '3,3',
      strokeWidth: 1,
      stroke: theme?.border || 'rgba(0,0,0,0.08)',
    },
    barPercentage: 0.7,
    fillShadowGradient: chartType === 'weekly' ? '#1976D2' : '#FF9800',
    fillShadowGradientOpacity: 1,
    useShadowColorFromDataset: false,
    strokeWidth: 0,
  };

  // Render chart based on selected type
  const renderChart = () => {
    // Show empty state for new users
    if (isNewUser || (chartType === 'weekly' && safeWeeklyData.length === 0)) {
      return (
        <View style={{
          backgroundColor: theme?.background || '#F5F5F5',
          alignItems: 'center',
          justifyContent: 'center',
          height: 220,
          borderRadius: 16,
          marginVertical: 16,
          borderWidth: 2,
          borderColor: theme?.border || '#E0E0E0',
          borderStyle: 'dashed'
        }}>
          <MaterialIcons name="bar-chart" size={64} color="#BDBDBD" />
          <Text style={{
            color: theme?.textMuted || '#757575',
            fontSize: 16,
            fontWeight: '600',
            marginTop: 12,
            textAlign: 'center'
          }}>
            No Data Yet
          </Text>
          <Text style={{
            color: theme?.textMuted || '#757575',
            fontSize: 14,
            marginTop: 4,
            textAlign: 'center'
          }}>
            Charts will appear after you start tracking
          </Text>
        </View>
      );
    }

    if (chartType === 'daily' && (!dailyStats.sessions || dailyStats.sessions.length === 0)) {
      return (
        <View style={{
          backgroundColor: theme?.background || '#FFF3E0',
          alignItems: 'center',
          justifyContent: 'center',
          height: 220,
          borderRadius: 16,
          marginVertical: 16,
          borderWidth: 2,
          borderColor: '#FFE0B2',
          borderStyle: 'dashed'
        }}>
          <MaterialIcons name="local-drink" size={64} color="#FFB74D" />
          <Text style={{
            color: '#FF9800',
            fontSize: 16,
            fontWeight: '600',
            marginTop: 12,
            textAlign: 'center'
          }}>
            No Sessions Today
          </Text>
          <Text style={{
            color: theme?.textMuted || '#757575',
            fontSize: 14,
            marginTop: 4,
            textAlign: 'center'
          }}>
            Start drinking to see daily patterns
          </Text>
        </View>
      );
    }

    let chartData;
    let chartTitle;
    let chartAverage;
    let chartWidth;
    let chartIcon;

    if (chartType === 'weekly') {
      chartWidth = Math.max(320, safeWeeklyData.length * 60);
      
      chartData = {
        labels: safeWeeklyData.map(day => {
          try {
            return new Date(day.date).toLocaleDateString('en', { 
              weekday: 'short',
              day: 'numeric'
            });
          } catch (e) {
            return 'N/A';
          }
        }),
        datasets: [{
          data: safeWeeklyData.map(day => day.totalConsumed || 0),
        }]
      };
      chartTitle = 'Weekly Overview';
      chartAverage = weeklyAverage;
      chartIcon = 'date-range';
    } else {
      chartWidth = 320;
      
      chartData = {
        labels: dailyChartData.labels,
        datasets: [{
          data: dailyChartData.data,
        }]
      };
      chartTitle = 'Today\'s Pattern';
      chartAverage = Math.round(dailyChartData.data.reduce((a, b) => a + b, 0) / 4);
      chartIcon = 'schedule';
    }

    return (
      <View style={{ marginVertical: 16 }}>
        {/* Chart Header */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          paddingHorizontal: 4
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialIcons 
              name={chartIcon} 
              size={20} 
              color={theme?.primary || (chartType === 'weekly' ? '#1976D2' : '#FF9800')} 
            />
            <Text style={{
              color: theme?.primary || (chartType === 'weekly' ? '#1976D2' : '#FF9800'),
              fontSize: 16,
              fontWeight: '700',
              marginLeft: 8
            }}>
              {chartTitle}
            </Text>
          </View>
          
          <View style={{
            backgroundColor: theme?.background || '#F8F9FA',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme?.border || '#E9ECEF'
          }}>
            <Text style={{
              color: theme?.textMuted || '#6C757D',
              fontSize: 12,
              fontWeight: '600'
            }}>
              Avg: {chartAverage}ml
            </Text>
          </View>
        </View>
        
        {/* Horizontal Scrollable Bar Chart Container */}
        <View style={{
          backgroundColor: theme?.card || 'white',
          borderRadius: 16,
          padding: 4,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
            },
            android: {
              elevation: 2,
            }
          })
        }}>
          <ScrollView 
            horizontal={true}
            showsHorizontalScrollIndicator={true}
            scrollEnabled={chartWidth > (screenWidth - 60)}
            style={{
              borderRadius: 12,
            }}
            contentContainerStyle={{
              paddingRight: 20,
              paddingLeft: 4
            }}
          >
            <BarChart
              data={chartData}
              width={chartWidth}
              height={220}
              chartConfig={chartConfig}
              style={{
                borderRadius: 12,
                paddingRight: 20
              }}
              yAxisLabel=""
              yAxisSuffix="ml"
              yAxisInterval={1}
              fromZero={true}
              showValuesOnTopOfBars={true}
              withInnerLines={true}
              withVerticalLabels={true}
              withHorizontalLabels={true}
              verticalLabelRotation={0}
              horizontalLabelRotation={0}
            />
          </ScrollView>
        </View>

        {/* Chart Legend */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: 12,
          paddingHorizontal: 4
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme?.background || '#F8F9FA',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16
          }}>
            <View style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: chartType === 'weekly' ? '#1976D2' : '#FF9800',
              marginRight: 8
            }} />
            <Text style={{
              color: theme?.textMuted || '#6C757D',
              fontSize: 12,
              fontWeight: '500'
            }}>
              {chartType === 'weekly' ? 'Daily Intake (ml)' : 'Intake by Time Period (ml)'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={getCardStyle(theme)}>
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
      }}>
        {/* Enhanced Chart Type Selector */}
        <View style={{
          flexDirection: 'row',
          backgroundColor: theme?.background || '#F0F0F0',
          borderRadius: 24,
          padding: 3,
          borderWidth: 1,
          borderColor: theme?.border || '#E0E0E0'
        }}>
          <TouchableOpacity
            onPress={() => setChartType('weekly')}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: chartType === 'weekly' 
                ? theme?.primary || '#1976D2' 
                : 'transparent',
              shadowColor: chartType === 'weekly' ? '#1976D2' : 'transparent',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: chartType === 'weekly' ? 2 : 0,
            }}
          >
            <Text style={{
              color: chartType === 'weekly' ? 'white' : theme?.textMuted || '#7f8c8d',
              fontSize: 13,
              fontWeight: '700'
            }}>
              Weekly
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => setChartType('daily')}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: chartType === 'daily' 
                ? '#FF9800' 
                : 'transparent',
              shadowColor: chartType === 'daily' ? '#FF9800' : 'transparent',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: chartType === 'daily' ? 2 : 0,
            }}
          >
            <Text style={{
              color: chartType === 'daily' ? 'white' : theme?.textMuted || '#7f8c8d',
              fontSize: 13,
              fontWeight: '700'
            }}>
              Daily
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {renderChart()}
    </View>
  );
};

// =======================================================
// 3. DRINKING STATS COMPONENT (UNCHANGED)
// =======================================================
export const DrinkingStats = ({ dailyStats, sensorData, theme }) => {
  // Safe temperature display
  const displayTemp = useMemo(() => {
    if (dailyStats.averageTemperature != null && !isNaN(dailyStats.averageTemperature)) {
      return `${Math.round(dailyStats.averageTemperature)}°C`;
    }
    return '--';
  }, [dailyStats.averageTemperature]);

  // Show empty state for new users
  if (dailyStats.isNewUser && dailyStats.totalConsumed === 0) {
    return (
      <View style={[getCardStyle(theme), { borderWidth: 2, borderColor: theme?.border || '#E0E0E0', borderStyle: 'dashed' }]}>
        <Text style={{
          color: theme?.primary || '#1976D2',
          fontSize: 18,
          fontWeight: 'bold',
          marginBottom: 16
        }}>
          Today's Stats
        </Text>
        
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <MaterialIcons name="analytics" size={48} color={theme?.textMuted || '#BDBDBD'} />
          <Text style={{
            color: theme?.textMuted || '#7f8c8d',
            fontSize: 14,
            textAlign: 'center',
            marginTop: 12
          }}>
            Stats will appear after you start drinking
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={getCardStyle(theme)}>
      <Text style={{
        color: theme?.primary || '#1976D2',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16
      }}>
        Today's Stats
      </Text>
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12
      }}>
        <View style={{
          flex: 1,
          alignItems: 'center',
          padding: 16,
          borderRadius: 12,
          backgroundColor: theme?.background || '#F8F9FA'
        }}>
          <MaterialIcons name="local-drink" size={24} color="#1976D2" />
          <Text style={{
            color: theme?.text || '#2c3e50',
            fontSize: 20,
            fontWeight: 'bold',
            marginTop: 8,
            marginBottom: 4
          }}>
            {dailyStats.drinkingFrequency || 0}
          </Text>
          <Text style={{
            color: theme?.textMuted || '#7f8c8d',
            fontSize: 12,
            fontWeight: '500',
            textAlign: 'center'
          }}>
            Drinks Today
          </Text>
        </View>
        
        <View style={{
          flex: 1,
          alignItems: 'center',
          padding: 16,
          borderRadius: 12,
          backgroundColor: theme?.background || '#F8F9FA'
        }}>
          <MaterialIcons name="thermostat" size={24} color="#4CAF50" />
          <Text style={{
            color: theme?.text || '#2c3e50',
            fontSize: 20,
            fontWeight: 'bold',
            marginTop: 8,
            marginBottom: 4
          }}>
            {displayTemp}
          </Text>
          <Text style={{
            color: theme?.textMuted || '#7f8c8d',
            fontSize: 12,
            fontWeight: '500',
            textAlign: 'center'
          }}>
            Avg Temp
          </Text>
        </View>
        
        <View style={{
          flex: 1,
          alignItems: 'center',
          padding: 16,
          borderRadius: 12,
          backgroundColor: theme?.background || '#F8F9FA'
        }}>
          <MaterialIcons name="schedule" size={24} color="#FF9800" />
          <Text style={{
            color: theme?.text || '#2c3e50',
            fontSize: 20,
            fontWeight: 'bold',
            marginTop: 8,
            marginBottom: 4
          }}>
            {dailyStats.sessions ? dailyStats.sessions.length : 0}
          </Text>
          <Text style={{
            color: theme?.textMuted || '#7f8c8d',
            fontSize: 12,
            fontWeight: '500',
            textAlign: 'center'
          }}>
            Sessions
          </Text>
        </View>
      </View>
    </View>
  );
};

// =======================================================
// 4. REAL DATA INTEGRATION HOOK (UNCHANGED)
// =======================================================
export const useIntakeService = (user) => {
  const [dailyStats, setDailyStats] = useState({
    totalConsumed: 0,
    drinkingFrequency: 0,
    goal: 2000,
    goalAchieved: false,
    averageTemperature: null,
    sessions: [],
    isNewUser: true
  });
  
  const [weeklyData, setWeeklyData] = useState([]);
  const [sensorData, setSensorData] = useState({
    waterLevel: 0,
    temperature: 22,
    status: 'ok',
    batteryLevel: 100,
    isStable: true,
    lastUpdate: new Date()
  });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const waterBottleService = new WaterBottleService(user.uid);

    // Listen to today's stats
    const unsubscribeStats = waterBottleService.onTodayStats((stats) => {
      console.log('Received today stats:', stats);
      setDailyStats(stats);
      setLoading(false);
    });

    // Listen to latest readings for sensor data
    const unsubscribeReadings = waterBottleService.onLatestReadings((readings) => {
      if (readings && readings.length > 0) {
        const latest = readings[0];
        setSensorData({
          waterLevel: latest.waterLevel || 0,
          temperature: latest.temperature || 22,
          status: 'ok',
          batteryLevel: latest.batteryLevel || 100,
          isStable: true,
          lastUpdate: new Date(latest.timestamp || Date.now())
        });
      }
    });

    // Fetch weekly data
    const fetchWeeklyData = async () => {
      try {
        const weeklyResult = await waterBottleService.getWeeklyStats();
        console.log('Received weekly data:', weeklyResult);
        setWeeklyData(weeklyResult.data || []);
      } catch (error) {
        console.error('Error fetching weekly data:', error);
        setWeeklyData([]);
      }
    };

    fetchWeeklyData();

    return () => {
      unsubscribeStats();
      unsubscribeReadings();
    };
  }, [user?.uid]);

  return {
    dailyStats,
    weeklyData,
    sensorData,
    loading
  };
};

// Don't forget to export as default for route compatibility
export default function IntakeComponents() {
  return null; // This file is used for components, not as a screen
}