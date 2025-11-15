import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import useTheme from '../../Theme/theme';

const CircularProgressChart = ({ consumed = 0, goal = 2500 }) => {
  const theme = useTheme();

  // Calculate percentage
  const percentage = Math.min(Math.round((consumed / goal) * 100), 100);
  
  // Circle calculations
  const size = 220;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (percentage / 100) * circumference;

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

  const remaining = Math.max(goal - consumed, 0);

  return (
    <View style={styles.container}>
      {/* Title */}
      <Text style={[styles.title, { color: theme.text }]}>Today's Progress</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
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
            stroke={theme.textMuted || '#e0e0e0'}
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
          <Text style={[styles.consumedText, { color: theme.text }]}>
            {consumed}ml
          </Text>
          <Text style={[styles.goalText, { color: theme.textMuted }]}>
            of {goal}ml
          </Text>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: theme.background }]}>
          <Text style={[styles.statValue, { color: '#3498db' }]}>{consumed}ml</Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Consumed</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.background }]}>
          <Text style={[styles.statValue, { color: '#e74c3c' }]}>{remaining}ml</Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Remaining</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.background }]}>
          <Text style={[styles.statValue, { color: '#27ae60' }]}>{goal}ml</Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Daily Goal</Text>
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
        <Text style={[styles.milestonesTitle, { color: theme.text }]}>
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
                      : theme.textMuted || '#e0e0e0',
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
                    color: milestone.achieved ? theme.text : theme.textMuted,
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
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
});

export default CircularProgressChart;