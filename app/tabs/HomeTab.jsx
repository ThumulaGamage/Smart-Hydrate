import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const WaterBottleVisual = ({ waterLevel, isConnected, temperature, batteryLevel, theme }) => {
  const [animatedValue] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: waterLevel,
      duration: 1000,
      useNativeDriver: false,
    }).start();

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

const HydrationProgress = ({ currentIntake, dailyGoal, goalAchieved, theme, lastDrinkVolume, showAnimation }) => {
  const progress = Math.min((currentIntake / dailyGoal) * 100, 100);
  const [animatedProgress] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));
  
  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  useEffect(() => {
    if (showAnimation && lastDrinkVolume > 0) {
      // Pulse animation when new drink is detected
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [lastDrinkVolume, showAnimation]);
  
  return (
    <Animated.View style={[styles.progressContainer, { transform: [{ scale: pulseAnim }] }]}>
      <View style={styles.progressHeader}>
        <Text style={[styles.progressTitle, { color: theme.text || '#2c3e50' }]}>Today's Hydration Goal</Text>
        {goalAchieved && <Ionicons name="trophy" size={20} color="#FFD700" />}
        {lastDrinkVolume > 0 && showAnimation && (
          <View style={styles.newDrinkBadge}>
            <Text style={styles.newDrinkText}>+{lastDrinkVolume}ml</Text>
          </View>
        )}
      </View>
      
      <View style={styles.progressStats}>
        <Text style={[styles.progressCurrent, { color: theme.primary || '#3498db' }]}>{Math.round(currentIntake)}ml</Text>
        <Text style={[styles.progressGoal, { color: theme.textMuted || '#7f8c8d' }]}>of {dailyGoal}ml</Text>
      </View>
      
      <View style={[styles.progressBar, { backgroundColor: theme.background || '#ecf0f1' }]}>
        <Animated.View style={[styles.progressFill, { 
          width: animatedProgress.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
            extrapolate: 'clamp',
          }),
          backgroundColor: goalAchieved ? '#4CAF50' : (theme.primary || '#3498db')
        }]} />
        <View style={styles.progressOverlay}>
          <Text style={styles.progressPercentage}>{Math.round(progress)}%</Text>
        </View>
      </View>
      
      <View style={styles.progressFooter}>
        <Text style={[styles.remainingText, { color: theme.textMuted || '#7f8c8d' }]}>
          {goalAchieved ? '🎉 Goal Achieved!' : `${Math.max(0, dailyGoal - currentIntake)}ml remaining`}
        </Text>
      </View>
    </Animated.View>
  );
};

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

  const lastReportedWaterLevel = useRef(null);
  const [firebaseData, setFirebaseData] = useState({
    todayStats: null,
    weeklyData: [],
    latestReading: null,
    profile: null
  });

  const [refreshing, setRefreshing] = useState(false);
  const [waterBottleService, setWaterBottleService] = useState(null);
  const [showChart, setShowChart] = useState(false);
  
  // New states for drink detection and animation
  const [lastDrinkVolume, setLastDrinkVolume] = useState(0);
  const [showDrinkAnimation, setShowDrinkAnimation] = useState(false);
  const animationTimeoutRef = useRef(null);

  useEffect(() => {
    initializeServices();
    return cleanup;
  }, []);

  // Enhanced function to update hydration progress with animation
  const updateHydrationProgress = useCallback(async (volumeConsumed) => {
    if (!waterBottleService) return;

    try {
      console.log(`💧 Updating hydration progress: +${volumeConsumed.toFixed(0)}ml`);
      
      // Show drink animation
      setLastDrinkVolume(Math.round(volumeConsumed));
      setShowDrinkAnimation(true);
      
      // Save drinking event to database
      const drinkingEvent = {
        volume: volumeConsumed,
        timestamp: new Date().toISOString(),
        waterLevel: sensorData.waterLevel,
        temperature: sensorData.temperature
      };
      
      await waterBottleService.saveDrinkingEvent(drinkingEvent);
      
      // Immediately refresh today's stats for real-time UI update
      const updatedStats = await waterBottleService.getTodayStats();
      console.log('📊 Updated today stats:', updatedStats);
      
      setFirebaseData(prev => ({ 
        ...prev, 
        todayStats: updatedStats 
      }));

      // Clear animation after 3 seconds
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      
      animationTimeoutRef.current = setTimeout(() => {
        setShowDrinkAnimation(false);
        setLastDrinkVolume(0);
      }, 3000);
      
    } catch (error) {
      console.error('❌ Failed to update hydration progress:', error);
      Alert.alert('Error', 'Failed to update hydration progress. Please try again.');
    }
  }, [waterBottleService, sensorData.waterLevel, sensorData.temperature]);

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
          let newWaterLevel = data.waterLevel;
          const currentTimestamp = new Date();

          // Validate and sanitize water level
          if (newWaterLevel === undefined || newWaterLevel === null) return;
          newWaterLevel = Math.max(0, Math.min(100, newWaterLevel)); // Clamp between 0-100

          // Enhanced drink detection with improved thresholds
          if (lastReportedWaterLevel.current !== null) {
            const levelDifference = lastReportedWaterLevel.current - newWaterLevel;
            const minThreshold = 1.5; // Minimum 1.5% change to detect drink
            const maxThreshold = 40; // Maximum 40% change to avoid false positives

            console.log('[Water Change Detection]', {
              previous: lastReportedWaterLevel.current?.toFixed(1),
              current: newWaterLevel?.toFixed(1),
              difference: levelDifference?.toFixed(1),
              threshold: `${minThreshold}-${maxThreshold}%`,
              bottleCapacity: getBottleCapacity()
            });

            // Detect consumption (water level decreased)
            if (levelDifference > minThreshold && levelDifference <= maxThreshold) {
              const bottleCapacity = getBottleCapacity();
              const volumeConsumed = (levelDifference / 100) * bottleCapacity;
              
              console.log(`💧 Drink detected: ${volumeConsumed.toFixed(0)}ml (${levelDifference.toFixed(1)}% decrease)`);
              
              // Update hydration progress with animation
              await updateHydrationProgress(volumeConsumed);
              
            } else if (levelDifference < -minThreshold) {
              console.log('🔄 Bottle refilled - not counting as consumption');
            } else if (levelDifference > maxThreshold) {
              console.log('⚠️ Large water level change detected - possibly sensor error or bottle removed');
            }
          }

          // Update sensor data
          setSensorData(prev => ({ 
            ...prev, 
            waterLevel: newWaterLevel,
            temperature: data.temperature || prev.temperature,
            batteryLevel: data.batteryLevel || prev.batteryLevel,
            lastUpdate: currentTimestamp
          }));
          
          // Update last reported level
          lastReportedWaterLevel.current = newWaterLevel;
        },
        onError: (message) => {
          console.error('❌ BLE Error:', message);
          Alert.alert('BLE Error', message);
        }
      });
    } catch (error) {
      console.error('❌ BLE initialization error:', error);
    }
  };

  const loadFirebaseData = async (service) => {
    try {
      console.log('🔄 Loading Firebase data...');
      const [todayStats, weeklyData, latestReading, profile] = await Promise.all([
        service.getTodayStats(),
        service.getWeeklyStats(),
        service.getLatestReading(),
        service.getUserProfile()
      ]);

      console.log('📊 Loaded today stats:', todayStats);

      setFirebaseData({
        todayStats: todayStats || null,
        weeklyData: weeklyData || [],
        latestReading: latestReading || null,
        profile: profile || null
      });

      if (latestReading) {
        setSensorData(prev => ({
          ...prev,
          waterLevel: latestReading.waterLevel || prev.waterLevel,
          temperature: latestReading.temperature || prev.temperature,
          batteryLevel: latestReading.batteryLevel || prev.batteryLevel,
          lastUpdate: new Date(latestReading.timestamp)
        }));
        lastReportedWaterLevel.current = latestReading.waterLevel;
      }
    } catch (error) {
      console.error('❌ Error loading Firebase data:', error);
    }
  };

  const setupFirebaseListeners = (service) => {
    const unsubscribers = [];

    try {
      // Enhanced listener for today's stats with better error handling
      if (service.onTodayStats) {
        const unsubscribe = service.onTodayStats((stats) => {
          console.log('🔄 Firebase onTodayStats listener triggered:', stats);
          setFirebaseData(prev => ({ 
            ...prev, 
            todayStats: stats 
          }));
        });
        unsubscribers.push(unsubscribe);
      }

      if (service.onLatestReadings) {
        const unsubscribe = service.onLatestReadings((readings) => {
          if (readings && readings.length > 0) {
            const latest = readings[0];
            console.log('🔄 Latest reading updated:', latest);
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
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
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
      } else {
        setTimeout(() => sendCommand('GET_DATA'), 1000);
      }
    } catch (error) {
      console.error('❌ Connection error:', error);
      Alert.alert('Connection Error', error.message);
    }
  };

  const handleDisconnect = async () => {
    try {
      await bleService.disconnect();
      lastReportedWaterLevel.current = null;
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

  const getBottleCapacity = () => {
    return firebaseData.profile?.bottleCapacity || 500;
  };

  const getUserDisplayName = () => {
    if (user?.name) return user.name;
    if (user?.displayName) return user.displayName;
    if (auth.currentUser?.displayName) return auth.currentUser.displayName;
    
    if (auth.currentUser?.email) {
      const emailPart = auth.currentUser.email.split('@')[0];
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
    const intake = getTodayIntake();
    const goal = getTodayGoal();
    return intake >= goal;
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
        <View style={[styles.section, { backgroundColor: theme.card || 'white', alignItems: 'center', padding: 16 }]}>
  <Ionicons name="thermometer" size={32} color={theme.primary || "#2196F3"} />
  <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.text || '#2c3e50' }}>
    {sensorData.temperature.toFixed(1)}°C
  </Text>
  <Text style={{ color: theme.textMuted || '#7f8c8d' }}>Current Water Temperature</Text>
</View>

        {/* Enhanced Hydration Progress with Auto-Update */}
        <View style={[styles.section, { backgroundColor: theme.card || 'white' }]}>
          <HydrationProgress 
            currentIntake={getTodayIntake()}
            dailyGoal={getTodayGoal()}
            goalAchieved={isGoalAchieved()}
            theme={theme}
            lastDrinkVolume={lastDrinkVolume}
            showAnimation={showDrinkAnimation}
          />
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
              <Text style={[styles.summaryValue, { color: theme.text || '#2c3e50' }]}>{Math.round(getDisplayStats().totalConsumed)}ml</Text>
              <Text style={[styles.summaryLabel, { color: theme.textMuted || '#6c757d' }]}>Total Intake</Text>
            </View>
            <View style={[styles.summaryCard, { 
              backgroundColor: theme.background || '#f8f9fa',
              borderColor: theme.border || '#e9ecef'
            }]}>
              <Ionicons name="trending-up" size={24} color={theme.success || "#27ae60"} />
              <Text style={[styles.summaryValue, { color: theme.text || '#2c3e50' }]}>{getDisplayStats().drinkingFrequency || 0}</Text>
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

        {/* Goal Achievement Celebration */}
        {isGoalAchieved() && showDrinkAnimation && (
          <View style={[styles.section, { backgroundColor: theme.success || '#4CAF50' }]}>
            <View style={styles.celebrationContainer}>
              <Text style={styles.celebrationEmoji}>🎉</Text>
              <Text style={styles.celebrationTitle}>Congratulations!</Text>
              <Text style={styles.celebrationText}>You've reached your daily hydration goal!</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}