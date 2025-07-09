import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated,
  RefreshControl,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { useRouter } from 'expo-router';
import bleService from '../../services/BLEService';
import { auth, WaterBottleService } from '../../config/firebaseConfig';
import { useUser } from '../../context/UserDetailContext';
import useTheme from '../../Theme/theme';
import { styles } from '../../constant/hometabstyles';

const { width } = Dimensions.get('window');

// Enhanced Water Bottle Visual Component
const WaterBottleVisual = ({ waterLevel, isConnected, temperature, batteryLevel, theme }) => {
  const [animatedValue] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: waterLevel,
      duration: 1000,
      useNativeDriver: false,
    }).start();

    // Pulse animation for low water
    if (waterLevel < 25) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [waterLevel]);

  const getWaterColor = (level) => {
    if (level <= 0) return theme.textMuted || '#e0e0e0';
    if (level < 25) return theme.error || '#f44336';
    if (level < 50) return theme.warning || '#FF9800';
    if (level < 75) return '#FFC107';
    return theme.success || '#4CAF50';
  };

  const getBottleOpacity = () => isConnected ? 1 : 0.3;

  return (
    <Animated.View style={[styles.bottleContainer, { transform: [{ scale: pulseAnim }] }]}>
      <View style={[styles.bottleOutline, { opacity: getBottleOpacity() }]}>
        <View style={[styles.bottleCap, { backgroundColor: theme.text || '#34495e' }]} />
        <View style={[styles.bottleNeck, { 
          backgroundColor: theme.card || '#ecf0f1',
          borderColor: theme.border || '#bdc3c7'
        }]} />
        
        <View style={[styles.bottleBody, { 
          backgroundColor: theme.card || '#ecf0f1',
          borderColor: theme.border || '#bdc3c7'
        }]}>
          <Animated.View
            style={[
              styles.waterLevel,
              {
                height: animatedValue.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                  extrapolate: 'clamp',
                }),
                backgroundColor: getWaterColor(waterLevel),
              },
            ]}
          />
          
          <View style={styles.levelMarkers}>
            {[25, 50, 75, 100].map((level) => (
              <View key={level} style={styles.levelMarker}>
                <View style={[styles.markerLine, { backgroundColor: theme.border || '#bdc3c7' }]} />
                <Text style={[styles.markerText, { color: theme.textMuted || '#7f8c8d' }]}>{level}%</Text>
              </View>
            ))}
          </View>
        </View>
        
        <View style={[styles.bottleBase, { backgroundColor: theme.text || '#34495e' }]} />
      </View>
      
      <View style={styles.waterLevelText}>
        <Text style={[styles.waterPercentage, { color: getWaterColor(waterLevel) }]}>
          {waterLevel.toFixed(1)}%
        </Text>
        <Text style={[styles.waterLevelLabel, { color: theme.textMuted || '#7f8c8d' }]}>Water Level</Text>
        
        <View style={styles.statusGrid}>
          <View style={styles.statusItem}>
            <Ionicons name="thermometer" size={16} color={theme.primary || "#2196F3"} />
            <Text style={[styles.statusValue, { color: theme.text || '#2c3e50' }]}>{temperature.toFixed(1)}°C</Text>
          </View>
          <View style={styles.statusItem}>
            <Ionicons name="battery-half" size={16} color={theme.success || "#4CAF50"} />
            <Text style={[styles.statusValue, { color: theme.text || '#2c3e50' }]}>{batteryLevel}%</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? (theme.success || '#4CAF50') : (theme.error || '#f44336') }]} />
            <Text style={[styles.statusValue, { color: theme.text || '#2c3e50' }]}>{isConnected ? 'Connected' : 'Offline'}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

// Enhanced Hydration Progress Component
const HydrationProgress = ({ currentIntake, dailyGoal, goalAchieved, theme }) => {
  const progress = Math.min((currentIntake / dailyGoal) * 100, 100);
  
  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={[styles.progressTitle, { color: theme.text || '#2c3e50' }]}>Today's Hydration Goal</Text>
        {goalAchieved && <Ionicons name="trophy" size={20} color="#FFD700" />}
      </View>
      
      <View style={styles.progressStats}>
        <Text style={[styles.progressCurrent, { color: theme.primary || '#3498db' }]}>{currentIntake}ml</Text>
        <Text style={[styles.progressGoal, { color: theme.textMuted || '#7f8c8d' }]}>of {dailyGoal}ml</Text>
      </View>
      
      <View style={[styles.progressBar, { backgroundColor: theme.background || '#ecf0f1' }]}>
        <Animated.View style={[styles.progressFill, { 
          width: `${progress}%`,
          backgroundColor: theme.primary || '#3498db'
        }]} />
        <View style={styles.progressOverlay}>
          <Text style={styles.progressPercentage}>{progress.toFixed(0)}%</Text>
        </View>
      </View>
      
      <View style={styles.progressFooter}>
        <Text style={[styles.remainingText, { color: theme.textMuted || '#7f8c8d' }]}>
          {goalAchieved ? '🎉 Goal Achieved!' : `${dailyGoal - currentIntake}ml remaining`}
        </Text>
      </View>
    </View>
  );
};

// Weekly Chart Component
const WeeklyChart = ({ weeklyData, theme }) => {
  if (!weeklyData || weeklyData.length === 0) {
    return (
      <View style={[styles.chartPlaceholder, { backgroundColor: theme.background || '#f8f9fa' }]}>
        <Ionicons name="bar-chart-outline" size={48} color={theme.textMuted || "#ddd"} />
        <Text style={[styles.chartPlaceholderText, { color: theme.textMuted || "#adb5bd" }]}>No data available</Text>
      </View>
    );
  }

  const chartData = {
    labels: weeklyData.map(d => d.date.split('-')[2]),
    datasets: [{
      data: weeklyData.map(d => (d.totalConsumed / d.goal) * 100),
      color: (opacity = 1) => `rgba(52, 152, 219, ${opacity})`,
      strokeWidth: 3
    }]
  };

  return (
    <View style={styles.chartContainer}>
      <Text style={[styles.chartTitle, { color: theme.text || '#2c3e50' }]}>Weekly Progress</Text>
      <LineChart
        data={chartData}
        width={width - 80}
        height={200}
        chartConfig={{
          backgroundColor: theme.card || '#ffffff',
          backgroundGradientFrom: theme.card || '#ffffff',
          backgroundGradientTo: theme.card || '#ffffff',
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(52, 152, 219, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          style: { borderRadius: 16 },
          propsForDots: {
            r: "4",
            strokeWidth: "2",
            stroke: theme.primary || "#3498db"
          }
        }}
        bezier
        style={styles.chart}
      />
    </View>
  );
};

// Smart Recommendations Component
const SmartRecommendations = ({ waterLevel, temperature, lastDrink, theme }) => {
  const getRecommendations = () => {
    const recommendations = [];
    
    if (waterLevel < 25) {
      recommendations.push({
        icon: 'water',
        text: 'Your bottle is running low! Time for a refill.',
        priority: 'high'
      });
    }
    
    if (temperature > 30) {
      recommendations.push({
        icon: 'thermometer-outline',
        text: 'Water is quite warm. Consider adding ice for better taste.',
        priority: 'medium'
      });
    }
    
    if (lastDrink && (Date.now() - lastDrink) > 3600000) {
      recommendations.push({
        icon: 'time-outline',
        text: 'It\'s been over an hour since your last drink. Stay hydrated!',
        priority: 'high'
      });
    }
    
    return recommendations;
  };

  const recommendations = getRecommendations();

  if (recommendations.length === 0) {
    return (
      <View style={[styles.recommendationsContainer, { backgroundColor: theme.background || '#f8f9fa' }]}>
        <View style={styles.noRecommendations}>
          <Ionicons name="checkmark-circle" size={32} color={theme.success || "#4CAF50"} />
          <Text style={[styles.noRecommendationsText, { color: theme.success || "#4CAF50" }]}>You're doing great! Keep it up!</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.recommendationsContainer, { backgroundColor: theme.background || '#f8f9fa' }]}>
      <Text style={[styles.recommendationsTitle, { color: theme.text || '#2c3e50' }]}>💡 Smart Recommendations</Text>
      {recommendations.map((rec, index) => (
        <View key={index} style={[
          styles.recommendationItem,
          { 
            backgroundColor: theme.card || 'white',
            borderLeftColor: rec.priority === 'high' ? (theme.error || '#f44336') : (theme.warning || '#FF9800')
          }
        ]}>
          <Ionicons 
            name={rec.icon} 
            size={20} 
            color={rec.priority === 'high' ? (theme.error || '#f44336') : (theme.warning || '#FF9800')} 
          />
          <Text style={[styles.recommendationText, { color: theme.text || '#495057' }]}>{rec.text}</Text>
        </View>
      ))}
    </View>
  );
};

// Main Component
export default function EnhancedHomepage() {
  const { user } = useUser();
  const theme = useTheme();
  const router = useRouter();
  
  const [bleState, setBleState] = useState({
    isConnected: false,
    isConnecting: false,
    isScanning: false,
    deviceName: ''
  });

  const [sensorData, setSensorData] = useState({
    waterLevel: 75,
    temperature: 22.5,
    batteryLevel: 85,
    lastUpdate: null,
  });

  const [firebaseData, setFirebaseData] = useState({
    todayStats: null,
    weeklyData: [],
    latestReading: null,
    profile: null
  });

  const [refreshing, setRefreshing] = useState(false);
  const [waterBottleService, setWaterBottleService] = useState(null);
  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    initializeServices();
    return cleanup;
  }, []);

  const initializeServices = async () => {
    try {
      initializeBLE();
      
      if (auth.currentUser) {
        const service = new WaterBottleService(auth.currentUser.uid);
        setWaterBottleService(service);
        await loadFirebaseData(service);
        setupFirebaseListeners(service);
      }
    } catch (error) {
      console.error('❌ Initialization error:', error);
    }
  };

  const initializeBLE = () => {
    try {
      bleService.setCallbacks({
        onConnectionChange: (state) => {
          setBleState(state);
        },
        onDataReceived: async (data) => {
          setSensorData(prev => ({ ...prev, ...data, lastUpdate: new Date() }));
          
          if (waterBottleService) {
            try {
              await waterBottleService.saveReading({
                waterLevel: data.waterLevel || prev.waterLevel,
                temperature: data.temperature || prev.temperature,
                batteryLevel: data.batteryLevel || prev.batteryLevel,
                isCharging: data.isCharging || false,
                deviceId: bleState.deviceName || 'bottle_001'
              });
            } catch (error) {
              console.warn('⚠️ Could not save to Firebase:', error);
            }
          }
        },
        onError: (message) => {
          Alert.alert('BLE Error', message);
        }
      });
    } catch (error) {
      console.error('❌ BLE initialization error:', error);
    }
  };

  const loadFirebaseData = async (service) => {
    try {
      const [todayStats, weeklyData, latestReading, profile] = await Promise.allSettled([
        service.getTodayStats(),
        service.getWeeklyStats(),
        service.getLatestReading(),
        service.getUserProfile()
      ]);

      setFirebaseData({
        todayStats: todayStats.status === 'fulfilled' ? todayStats.value : null,
        weeklyData: weeklyData.status === 'fulfilled' ? weeklyData.value : [],
        latestReading: latestReading.status === 'fulfilled' ? latestReading.value : null,
        profile: profile.status === 'fulfilled' ? profile.value : null
      });

      if (latestReading.status === 'fulfilled' && latestReading.value) {
        const latest = latestReading.value;
        setSensorData(prev => ({
          ...prev,
          waterLevel: latest.waterLevel || prev.waterLevel,
          temperature: latest.temperature || prev.temperature,
          batteryLevel: latest.batteryLevel || prev.batteryLevel,
          lastUpdate: new Date(latest.timestamp)
        }));
      }
    } catch (error) {
      console.error('❌ Error loading Firebase data:', error);
    }
  };

  const setupFirebaseListeners = (service) => {
    const unsubscribers = [];

    try {
      if (service.onTodayStats) {
        const unsubscribe = service.onTodayStats((stats) => {
          setFirebaseData(prev => ({ ...prev, todayStats: stats }));
        });
        unsubscribers.push(unsubscribe);
      }

      if (service.onLatestReadings) {
        const unsubscribe = service.onLatestReadings((readings) => {
          if (readings && readings.length > 0) {
            const latest = readings[0];
            setFirebaseData(prev => ({ ...prev, latestReading: latest }));
            setSensorData(prev => ({
              ...prev,
              waterLevel: latest.waterLevel || prev.waterLevel,
              temperature: latest.temperature || prev.temperature,
              batteryLevel: latest.batteryLevel || prev.batteryLevel,
              lastUpdate: new Date(latest.timestamp)
            }));
          }
        });
        unsubscribers.push(unsubscribe);
      }
    } catch (error) {
      console.error('❌ Error setting up Firebase listeners:', error);
    }

    return () => {
      unsubscribers.forEach(unsubscribe => {
        try {
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          }
        } catch (error) {
          console.warn('⚠️ Error cleaning up listener:', error);
        }
      });
    };
  };

  const cleanup = () => {
    if (bleService?.isConnected) {
      bleService.disconnect().catch(e => console.log('Cleanup error:', e));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (waterBottleService) {
        await loadFirebaseData(waterBottleService);
      }
      if (bleState.isConnected) {
        await sendCommand('GET_DATA');
      }
    } catch (error) {
      console.error('❌ Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleConnect = async () => {
    try {
      const success = await bleService.connectToWaterBottle();
      if (!success) {
        Alert.alert('Connection Failed', 'Could not connect to water bottle');
      }
    } catch (error) {
      console.error('❌ Connection error:', error);
      Alert.alert('Connection Error', error.message);
    }
  };

  const handleDisconnect = async () => {
    try {
      await bleService.disconnect();
    } catch (error) {
      console.error('❌ Disconnect error:', error);
    }
  };

  const sendCommand = async (command) => {
    try {
      if (!bleService.isConnected) {
        Alert.alert('Not Connected', 'Please connect first');
        return;
      }
      
      await bleService.sendCommand(command);
    } catch (error) {
      console.error('❌ Command error:', error);
      Alert.alert('Command Failed', error.message);
    }
  };

  const simulateDrinking = async (amount) => {
    if (waterBottleService) {
      try {
        await waterBottleService.simulateDrinking(amount);
        Alert.alert('Success', `Recorded drinking ${amount}ml`);
      } catch (error) {
        console.error('❌ Simulation error:', error);
        Alert.alert('Error', 'Could not record drinking');
      }
    }
  };

  const getUserDisplayName = () => {
    // Priority order: user context name, Firebase display name, email name part
    if (user?.name) return user.name;
    if (user?.displayName) return user.displayName;
    if (auth.currentUser?.displayName) return auth.currentUser.displayName;
    
    // Extract first name from email if no display name
    if (auth.currentUser?.email) {
      const emailPart = auth.currentUser.email.split('@')[0];
      // Convert email part to readable name (e.g., "john.doe" -> "John Doe")
      return emailPart
        .split(/[._-]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }
    
    return 'User';
  };

  const getTodayGoal = () => {
    return firebaseData.profile?.dailyGoal || firebaseData.todayStats?.goal || 2000;
  };

  const getTodayIntake = () => {
    return firebaseData.todayStats?.totalConsumed || 0;
  };

  const isGoalAchieved = () => {
    return firebaseData.todayStats?.goalAchieved || false;
  };

  const getDisplayStats = () => {
    return firebaseData.todayStats || {
      totalConsumed: 0,
      drinkingFrequency: 0,
      averageTemperature: 22.5,
      goalAchieved: false
    };
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background || '#f5f7fa' }]}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary || '#667eea']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.primary || '#667eea' }]}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>Hello, {getUserDisplayName()}! 👋</Text>
              <Text style={styles.subtitle}>Stay hydrated & healthy today</Text>
            </View>
          </View>
        </View>

        {/* Connection Section */}
        <View style={[styles.section, { backgroundColor: theme.card || 'white' }]}>
          <Text style={[styles.sectionTitle, { color: theme.text || '#2c3e50' }]}>🔗 Smart Bottle Connection</Text>
          
          <View style={[styles.connectionStatus, { backgroundColor: theme.background || '#f8f9fa' }]}>
            <Ionicons 
              name={bleState.isConnected ? "bluetooth" : "bluetooth-outline"} 
              size={24} 
              color={bleState.isConnected ? (theme.success || "#4CAF50") : (theme.textMuted || "#999")} 
            />
            <Text style={[styles.statusTextMain, { 
              color: bleState.isConnected ? (theme.success || "#4CAF50") : (theme.textMuted || "#999")
            }]}>
              {bleState.isConnected ? `Connected to ${bleState.deviceName}` : 'Not Connected'}
            </Text>
          </View>

          {bleState.isConnected ? (
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: theme.primary || '#3498db' }]}
                onPress={() => sendCommand('GET_DATA')}
              >
                <Ionicons name="refresh" size={16} color="white" />
                <Text style={styles.buttonText}>Sync Data</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: theme.warning || '#f39c12' }]}
                onPress={() => sendCommand('CALIBRATE')}
              >
                <Ionicons name="settings" size={16} color="white" />
                <Text style={styles.buttonText}>Calibrate</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: theme.error || '#e74c3c' }]}
                onPress={handleDisconnect}
              >
                <Ionicons name="close-circle" size={16} color="white" />
                <Text style={styles.buttonText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: theme.success || '#27ae60' }]}
              onPress={handleConnect}
              disabled={bleState.isConnecting}
            >
              {bleState.isConnecting ? (
                <View style={styles.connectingRow}>
                  <ActivityIndicator color="white" size="small" />
                  <Text style={[styles.buttonText, { marginLeft: 8 }]}>
                    {bleState.isScanning ? 'Scanning...' : 'Connecting...'}
                  </Text>
                </View>
              ) : (
                <>
                  <Ionicons name="bluetooth" size={16} color="white" />
                  <Text style={[styles.buttonText, { marginLeft: 8 }]}>Connect Bottle</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Water Bottle Visual */}
        <View style={[styles.section, { backgroundColor: theme.card || 'white' }]}>
          <WaterBottleVisual 
            waterLevel={sensorData.waterLevel} 
            isConnected={bleState.isConnected}
            temperature={sensorData.temperature}
            batteryLevel={sensorData.batteryLevel}
            theme={theme}
          />
        </View>

        {/* Hydration Progress */}
        <View style={[styles.section, { backgroundColor: theme.card || 'white' }]}>
          <HydrationProgress 
            currentIntake={getTodayIntake()}
            dailyGoal={getTodayGoal()}
            goalAchieved={isGoalAchieved()}
            theme={theme}
          />
          
          {/* Quick Actions */}
          <View style={[styles.quickDrinkActions, { borderTopColor: theme.border || '#ecf0f1' }]}>
            <Text style={[styles.quickActionsTitle, { color: theme.text || '#2c3e50' }]}>Quick Log</Text>
            <View style={styles.quickActionButtons}>
              {[100, 250, 500].map(amount => (
                <TouchableOpacity 
                  key={amount}
                  style={[styles.quickDrinkButton, { 
                    backgroundColor: theme.background || '#f8f9fa',
                    borderColor: theme.border || '#e9ecef'
                  }]}
                  onPress={() => simulateDrinking(amount)}
                >
                  <Ionicons name="water" size={16} color={theme.primary || "#3498db"} />
                  <Text style={[styles.quickDrinkText, { color: theme.primary || "#3498db" }]}>{amount}ml</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Smart Recommendations */}
        <View style={[styles.section, { backgroundColor: theme.card || 'white' }]}>
          <SmartRecommendations 
            waterLevel={sensorData.waterLevel}
            temperature={sensorData.temperature}
            lastDrink={sensorData.lastUpdate}
            theme={theme}
          />
        </View>

        {/* Weekly Chart */}
        {firebaseData.weeklyData.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.card || 'white' }]}>
            <View style={styles.chartHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text || '#2c3e50' }]}>📊 Weekly Progress</Text>
              <TouchableOpacity onPress={() => setShowChart(!showChart)}>
                <Ionicons 
                  name={showChart ? "chevron-up" : "chevron-down"} 
                  size={24} 
                  color={theme.primary || "#3498db"} 
                />
              </TouchableOpacity>
            </View>
            {showChart && <WeeklyChart weeklyData={firebaseData.weeklyData} theme={theme} />}
          </View>
        )}

        {/* Today's Summary */}
        <View style={[styles.section, { backgroundColor: theme.card || 'white' }]}>
          <Text style={[styles.sectionTitle, { color: theme.text || '#2c3e50' }]}>📈 Today's Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { 
              backgroundColor: theme.background || '#f8f9fa',
              borderColor: theme.border || '#e9ecef'
            }]}>
              <Ionicons name="water" size={24} color={theme.primary || "#3498db"} />
              <Text style={[styles.summaryValue, { color: theme.text || '#2c3e50' }]}>{getDisplayStats().totalConsumed}ml</Text>
              <Text style={[styles.summaryLabel, { color: theme.textMuted || '#6c757d' }]}>Total Intake</Text>
            </View>
            <View style={[styles.summaryCard, { 
              backgroundColor: theme.background || '#f8f9fa',
              borderColor: theme.border || '#e9ecef'
            }]}>
              <Ionicons name="trending-up" size={24} color={theme.success || "#27ae60"} />
              <Text style={[styles.summaryValue, { color: theme.text || '#2c3e50' }]}>{getDisplayStats().drinkingFrequency}</Text>
              <Text style={[styles.summaryLabel, { color: theme.textMuted || '#6c757d' }]}>Drinks Today</Text>
            </View>
            <View style={[styles.summaryCard, { 
              backgroundColor: theme.background || '#f8f9fa',
              borderColor: theme.border || '#e9ecef'
            }]}>
              <Ionicons name="thermometer" size={24} color={theme.error || "#e74c3c"} />
              <Text style={[styles.summaryValue, { color: theme.text || '#2c3e50' }]}>{getDisplayStats().averageTemperature?.toFixed(1) || '--'}°C</Text>
              <Text style={[styles.summaryLabel, { color: theme.textMuted || '#6c757d' }]}>Avg Temp</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

