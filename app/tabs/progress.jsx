import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useTheme from '../../Theme/theme';
import { auth } from '../../firebaseConfig'; // Adjust path to your firebase config
import DailyPatternChart from '../../components/charts/DailyPatternChart';
import ChartDataService from '../../services/chartDataservice';

export default function Progress() {
  const theme = useTheme();
  const [selectedGraph, setSelectedGraph] = useState('daily');
  const [loading, setLoading] = useState(false);
  const [hourlyData, setHourlyData] = useState([]);

  const graphOptions = [
    {
      id: 'daily',
      title: 'Today\'s Progress',
      subtitle: 'Circular progress ring',
      icon: 'pie-chart',
      color: '#3498db',
    },
    {
      id: 'weekly',
      title: 'Weekly Comparison',
      subtitle: 'Last 7 days vs goal',
      icon: 'bar-chart',
      color: '#27ae60',
    },
    {
      id: 'monthly',
      title: 'Daily Water Pattern',
      subtitle: 'Hourly intake tracking',
      icon: 'analytics',
      color: '#e74c3c',
    },
    {
      id: 'heatmap',
      title: 'Monthly Consistency',
      subtitle: 'Heatmap calendar view',
      icon: 'calendar',
      color: '#9b59b6',
    },
  ];

  // Load data when "monthly" (Daily Pattern) is selected
  useEffect(() => {
    if (selectedGraph === 'monthly') {
      loadHourlyData();
    }
  }, [selectedGraph]);

  const loadHourlyData = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      
      if (!user) {
        console.log('No user logged in');
        setLoading(false);
        return;
      }

      const dataService = new ChartDataService(user.uid);
      const data = await dataService.getHourlyPattern();
      setHourlyData(data);
      
    } catch (error) {
      console.error('Error loading hourly data:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderGraphContent = () => {
    switch (selectedGraph) {
      case 'daily':
        return (
          <View style={styles.graphPlaceholder}>
            <Ionicons name="pie-chart" size={80} color="#3498db" />
            <Text style={[styles.placeholderText, { color: theme.text }]}>
              Circular Progress Ring
            </Text>
            <Text style={[styles.placeholderSubtext, { color: theme.textMuted }]}>
              Today's goal visualization
            </Text>
          </View>
        );
      case 'weekly':
        return (
          <View style={styles.graphPlaceholder}>
            <Ionicons name="bar-chart" size={80} color="#27ae60" />
            <Text style={[styles.placeholderText, { color: theme.text }]}>
              Grouped Column Chart
            </Text>
            <Text style={[styles.placeholderSubtext, { color: theme.textMuted }]}>
              Recommended vs Consumed (Last 7 days)
            </Text>
          </View>
        );
      case 'monthly':
        if (loading) {
          return (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#e74c3c" />
              <Text style={[styles.loadingText, { color: theme.textMuted }]}>
                Loading hourly data...
              </Text>
            </View>
          );
        }
        return <DailyPatternChart data={hourlyData} />;
        
      case 'heatmap':
        return (
          <View style={styles.graphPlaceholder}>
            <Ionicons name="calendar" size={80} color="#9b59b6" />
            <Text style={[styles.placeholderText, { color: theme.text }]}>
              Heatmap Calendar
            </Text>
            <Text style={[styles.placeholderSubtext, { color: theme.textMuted }]}>
              Monthly consistency view
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Progress & Analytics
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
            Track your hydration journey
          </Text>
        </View>

        {/* Graph Selection Options */}
        <View style={styles.optionsContainer}>
          {graphOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionCard,
                { 
                  backgroundColor: theme.card,
                  borderColor: selectedGraph === option.id ? option.color : 'transparent',
                  borderWidth: 2,
                },
              ]}
              onPress={() => setSelectedGraph(option.id)}
              activeOpacity={0.7}
            >
              <View 
                style={[
                  styles.iconContainer, 
                  { backgroundColor: option.color + '20' }
                ]}
              >
                <Ionicons name={option.icon} size={28} color={option.color} />
              </View>
              
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: theme.text }]}>
                  {option.title}
                </Text>
                <Text style={[styles.optionSubtitle, { color: theme.textMuted }]}>
                  {option.subtitle}
                </Text>
              </View>

              {selectedGraph === option.id && (
                <View style={[styles.checkmark, { backgroundColor: option.color }]}>
                  <Ionicons name="checkmark" size={16} color="white" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Graph Display Area */}
        <View style={[styles.graphContainer, { backgroundColor: theme.card }]}>
          {renderGraphContent()}
        </View>

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  optionsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 13,
    opacity: 0.7,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  graphContainer: {
    margin: 16,
    marginTop: 24,
    borderRadius: 20,
    padding: 24,
    minHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  graphPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  bottomPadding: {
    height: 100,
  },
});