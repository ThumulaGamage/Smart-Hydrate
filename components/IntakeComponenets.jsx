// src/components/IntakeComponents.jsx
// Modular UI Components for Home Tab Integration

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { styles } from '../styles';
import { WaterBottleService } from '../FirebaseConfig';
import BleService from '../BleService';
import IntakeTracker from '../services/IntakeTracker';

const { width: screenWidth } = Dimensions.get('window');

// =======================================================
// 1. DAILY PROGRESS CARD COMPONENT
// =======================================================
export const DailyProgressCard = ({ dailyStats, onManualIntake }) => {
  const progress = Math.min((dailyStats.totalConsumed / dailyStats.goal) * 100, 100);
  const remaining = Math.max(dailyStats.goal - dailyStats.totalConsumed, 0);
  
  const getProgressColor = (progress) => {
    if (progress >= 100) return '#4CAF50';
    if (progress >= 75) return '#8BC34A';
    if (progress >= 50) return '#FFC107';
    if (progress >= 25) return '#FF9800';
    return '#FF5722';
  };

  const addManualIntake = (amount) => {
    Alert.alert(
      'Add Manual Intake',
      `Record drinking ${amount}ml manually?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Add', 
          onPress: () => onManualIntake(amount)
        }
      ]
    );
  };

  return (
    <View style={[styles.section, { backgroundColor: 'white', margin: 16 }]}>
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressTitle, { color: '#1976D2', fontSize: 18, fontWeight: 'bold' }]}>
            Daily Progress
          </Text>
          <View style={styles.autoTrackBadge}>
            <Icon name="autorenew" size={14} color="#1976D2" />
            <Text style={[styles.autoTrackText, { color: '#1976D2', fontSize: 12, marginLeft: 4 }]}>
              Auto-tracked
            </Text>
          </View>
        </View>
        
        <View style={styles.progressStats}>
          <Text style={[styles.progressCurrent, { color: getProgressColor(progress), fontSize: 28, fontWeight: 'bold' }]}>
            {dailyStats.totalConsumed}ml
          </Text>
          <Text style={[styles.progressGoal, { color: '#666', fontSize: 16 }]}>
            / {dailyStats.goal}ml
          </Text>
        </View>
        
        <View style={[styles.progressBar, { backgroundColor: '#E3F2FD', height: 16, borderRadius: 8, marginBottom: 8 }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress}%`,
                backgroundColor: getProgressColor(progress),
                height: '100%',
                borderRadius: 8,
              },
            ]}
          />
          <View style={[styles.progressOverlay, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={[styles.progressPercentage, { fontSize: 11, fontWeight: 'bold', color: 'white' }]}>
              {Math.round(progress)}%
            </Text>
          </View>
        </View>
        
        <View style={styles.progressFooter}>
          <Text style={[styles.remainingText, { color: '#666', fontSize: 14 }]}>
            {remaining > 0 ? `${remaining}ml remaining` : 'Goal achieved! 🎉'}
          </Text>
        </View>
      </View>
      
      {/* Quick Actions */}
      <View style={[styles.quickDrinkActions, { borderTopColor: '#E0E0E0', marginTop: 16, paddingTop: 16, borderTopWidth: 1 }]}>
        <Text style={[styles.quickActionsTitle, { color: '#1976D2', fontSize: 16, fontWeight: '600', marginBottom: 12 }]}>
          Quick Add (Manual)
        </Text>
        <View style={[styles.quickActionButtons, { flexDirection: 'row', justifyContent: 'space-around' }]}>
          {[100, 250, 500].map((amount) => (
            <TouchableOpacity
              key={amount}
              style={[
                styles.quickDrinkButton,
                { 
                  backgroundColor: 'white', 
                  borderColor: '#1976D2',
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  borderWidth: 1
                }
              ]}
              onPress={() => addManualIntake(amount)}
            >
              <Icon name="local-drink" size={16} color="#1976D2" />
              <Text style={[styles.quickDrinkText, { color: '#1976D2', fontSize: 14, fontWeight: '600', marginLeft: 6 }]}>
                {amount}ml
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

// =======================================================
// 2. WEEKLY CHART COMPONENT
// =======================================================
export const WeeklyChart = ({ weeklyData }) => {
  if (weeklyData.length === 0) {
    return (
      <View style={[styles.section, { backgroundColor: 'white', margin: 16 }]}>
        <Text style={[styles.sectionTitle, { color: '#1976D2', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }]}>Progress Chart</Text>
        <View style={[styles.chartPlaceholder, { backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', height: 150, borderRadius: 12 }]}>
          <Icon name="timeline" size={48} color="#BDBDBD" />
          <Text style={[styles.chartPlaceholderText, { color: '#757575', fontSize: 14, marginTop: 8 }]}>
            Chart will appear after a few days of data
          </Text>
        </View>
      </View>
    );
  }

  const chartData = {
    labels: weeklyData.map(day => new Date(day.date).toLocaleDateString('en', { weekday: 'short' })),
    datasets: [{
      data: weeklyData.map(day => day.totalConsumed || 0),
      color: (opacity = 1) => `rgba(25, 118, 210, ${opacity})`,
      strokeWidth: 3
    }]
  };

  return (
    <View style={[styles.section, { backgroundColor: 'white', margin: 16 }]}>
      <Text style={[styles.sectionTitle, { color: '#1976D2', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }]}>Progress Chart</Text>
      <View style={styles.chartContainer}>
        <View style={[styles.chartHeader, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }]}>
          <Text style={[styles.chartTitle, { color: '#1976D2', fontSize: 16, fontWeight: '600' }]}>
            Weekly Progress
          </Text>
          <Text style={[{ color: '#666', fontSize: 12 }]}>
            Last 7 days
          </Text>
        </View>
        <LineChart
          data={chartData}
          width={screenWidth - 64}
          height={180}
          chartConfig={{
            backgroundColor: 'white',
            backgroundGradientFrom: 'white',
            backgroundGradientTo: 'white',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(25, 118, 210, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: '#1976D2'
            }
          }}
          bezier
          style={[styles.chart, { borderRadius: 16, marginVertical: 8 }]}
        />
      </View>
    </View>
  );
};

// =======================================================
// 3. SUMMARY STATS COMPONENT
// =======================================================
export const SummaryStats = ({ dailyStats, sensorData }) => {
  return (
    <View style={[styles.section, { backgroundColor: 'white', margin: 16 }]}>
      <Text style={[styles.sectionTitle, { color: '#1976D2', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }]}>Today's Summary</Text>
      <View style={[styles.summaryGrid, { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }]}>
        <View style={[styles.summaryCard, { flex: 1, alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E3F2FD' }]}>
          <Icon name="local-drink" size={24} color="#1976D2" />
          <Text style={[styles.summaryValue, { color: '#1976D2', fontSize: 20, fontWeight: 'bold', marginTop: 8, marginBottom: 4 }]}>
            {dailyStats.drinkingFrequency}
          </Text>
          <Text style={[styles.summaryLabel, { color: '#666', fontSize: 12, fontWeight: '500', textAlign: 'center' }]}>
            Drinks Today
          </Text>
        </View>
        
        <View style={[styles.summaryCard, { flex: 1, alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E8F5E8' }]}>
          <Icon name="thermostat" size={24} color="#4CAF50" />
          <Text style={[styles.summaryValue, { color: '#4CAF50', fontSize: 20, fontWeight: 'bold', marginTop: 8, marginBottom: 4 }]}>
            {dailyStats.averageTemperature ? `${Math.round(dailyStats.averageTemperature)}°C` : '--'}
          </Text>
          <Text style={[styles.summaryLabel, { color: '#666', fontSize: 12, fontWeight: '500', textAlign: 'center' }]}>
            Avg Temp
          </Text>
        </View>
        
        <View style={[styles.summaryCard, { flex: 1, alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FFF3E0' }]}>
          <Icon name="battery-charging-full" size={24} color="#FF9800" />
          <Text style={[styles.summaryValue, { color: '#FF9800', fontSize: 20, fontWeight: 'bold', marginTop: 8, marginBottom: 4 }]}>
            {sensorData.batteryLevel || '--'}%
          </Text>
          <Text style={[styles.summaryLabel, { color: '#666', fontSize: 12, fontWeight: '500', textAlign: 'center' }]}>
            Battery
          </Text>
        </View>
      </View>
    </View>
  );
};

// =======================================================
// 4. CONNECTION MANAGER COMPONENT
// =======================================================
export const ConnectionManager = ({ connectionState, onConnect, onDisconnect, onTest }) => {
  const getConnectionColor = () => {
    if (connectionState.isConnected) return '#4CAF50';
    if (connectionState.isConnecting || connectionState.isScanning) return '#FF9800';
    return '#F44336';
  };

  return (
    <View style={[styles.section, { backgroundColor: 'white', margin: 16 }]}>
      {/* Connection Status */}
      <View style={[
        styles.connectionStatus, 
        { 
          backgroundColor: getConnectionColor() + '20', 
          borderColor: getConnectionColor(),
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 16,
          padding: 16,
          borderRadius: 12,
          borderWidth: 1
        }
      ]}>
        {connectionState.isConnecting || connectionState.isScanning ? (
          <View style={[styles.connectingRow, { flexDirection: 'row', alignItems: 'center' }]}>
            <ActivityIndicator size="small" color={getConnectionColor()} />
            <Text style={[styles.statusTextMain, { color: getConnectionColor(), fontSize: 16, marginLeft: 12, fontWeight: '500' }]}>
              {connectionState.isScanning ? 'Scanning...' : 'Connecting...'}
            </Text>
          </View>
        ) : (
          <>
            <Icon 
              name={connectionState.isConnected ? 'bluetooth-connected' : 'bluetooth-disabled'} 
              size={24} 
              color={getConnectionColor()} 
            />
            <Text style={[styles.statusTextMain, { color: getConnectionColor(), fontSize: 16, marginLeft: 12, fontWeight: '500' }]}>
              {connectionState.isConnected 
                ? `Connected to ${connectionState.deviceName || 'SmartHydrate'}` 
                : 'Bottle not connected'}
            </Text>
          </>
        )}
      </View>
      
      {/* Connection Buttons */}
      <View style={[styles.buttonRow, { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }]}>
        <TouchableOpacity
          style={[styles.button, { 
            backgroundColor: connectionState.isConnected ? '#F44336' : '#1976D2',
            opacity: connectionState.isConnecting ? 0.7 : 1,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            flexDirection: 'row'
          }]}
          onPress={connectionState.isConnected ? onDisconnect : onConnect}
          disabled={connectionState.isConnecting}
        >
          <Icon 
            name={connectionState.isConnected ? 'bluetooth-disabled' : 'bluetooth'} 
            size={20} 
            color="white" 
          />
          <Text style={[styles.buttonText, { color: 'white', fontSize: 13, fontWeight: '600', marginLeft: 4 }]}>
            {connectionState.isConnected ? 'Disconnect' : 'Connect'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, { 
            backgroundColor: '#4CAF50',
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            flexDirection: 'row'
          }]}
          onPress={onTest}
        >
          <Icon name="play-arrow" size={20} color="white" />
          <Text style={[styles.buttonText, { color: 'white', fontSize: 13, fontWeight: '600', marginLeft: 4 }]}>Test 250ml</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// =======================================================
// 5. INTAKE SERVICE HOOK
// =======================================================
export const useIntakeService = (user) => {
  const waterBottleService = useRef(null);
  const intakeTracker = useRef(null);
  
  const [dailyStats, setDailyStats] = useState({
    totalConsumed: 0,
    drinkingFrequency: 0,
    goal: 2000,
    goalAchieved: false,
    averageTemperature: null,
    sessions: []
  });
  
  const [weeklyData, setWeeklyData] = useState([]);
  const [sensorData, setSensorData] = useState({
    waterLevel: 0,
    temperature: 25,
    status: 'unknown',
    batteryLevel: 100,
    isStable: false,
    lastUpdate: null
  });
  
  const [connectionState, setConnectionState] = useState({
    isConnected: false,
    isConnecting: false,
    isScanning: false,
    deviceName: ''
  });

  // Initialize services when user is available
  useEffect(() => {
    if (user) {
      initializeServices(user.uid);
    }
    
    return () => {
      cleanup();
    };
  }, [user]);

  const initializeServices = async (userId) => {
    try {
      // Initialize Firebase service
      waterBottleService.current = new WaterBottleService(userId);
      
      // Create or get user profile
      let profile = await waterBottleService.current.getUserProfile();
      if (!profile) {
        profile = await waterBottleService.current.createUserProfile({
          name: user?.displayName || 'User',
          email: user?.email || '',
          dailyGoal: 2000,
        });
      }
      
      // Initialize intake tracker
      intakeTracker.current = new IntakeTracker(
        waterBottleService.current,
        BleService
      );
      
      await intakeTracker.current.initialize(userId, 1000);
      
      // Set up listeners
      setupListeners();
      await loadData();
      
    } catch (error) {
      console.error('❌ Service initialization error:', error);
    }
  };

  const setupListeners = () => {
    // Daily stats listener
    waterBottleService.current.onTodayStats((stats) => {
      setDailyStats(stats);
    });

    // BLE listeners
    BleService.setCallbacks({
      onDataReceived: (data) => {
        setSensorData(prevData => ({
          ...prevData,
          ...data,
          lastUpdate: new Date()
        }));
      },
      onConnectionChange: setConnectionState,
      onError: (error) => {
        Alert.alert('Bluetooth Error', error);
      }
    });
  };

  const loadData = async () => {
    try {
      const weeklyStats = await waterBottleService.current.getWeeklyStats();
      setWeeklyData(weeklyStats);
    } catch (error) {
      console.error('❌ Error loading data:', error);
    }
  };

  // Service methods
  const connectToBottle = async () => {
    try {
      const success = await BleService.connectToWaterBottle();
      if (success) {
        Alert.alert('Success! 🎉', 'Connected to SmartHydrate bottle!');
      } else {
        Alert.alert('Connection Failed', 'Could not connect to bottle.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to bottle');
    }
  };

  const disconnectBottle = async () => {
    try {
      await BleService.disconnect();
      Alert.alert('Disconnected', 'Disconnected from bottle');
    } catch (error) {
      Alert.alert('Error', 'Failed to disconnect');
    }
  };

  const addManualIntake = async (amount) => {
    try {
      await waterBottleService.current.saveDrinkingEvent(amount);
      Alert.alert('Success', `Added ${amount}ml to your daily intake!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to record intake');
    }
  };

  const testDrinking = async () => {
    try {
      await waterBottleService.current.simulateDrinking(250);
      Alert.alert('Test Complete', 'Simulated drinking 250ml');
    } catch (error) {
      Alert.alert('Error', 'Failed to simulate');
    }
  };

  const cleanup = () => {
    if (intakeTracker.current) {
      intakeTracker.current.destroy();
    }
    BleService.disconnect();
  };

  return {
    dailyStats,
    weeklyData,
    sensorData,
    connectionState,
    connectToBottle,
    disconnectBottle,
    addManualIntake,
    testDrinking
  };
};