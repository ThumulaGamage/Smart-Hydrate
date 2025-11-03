// EnhancedHomepage.jsx - Fixed WaterBottleService initialization (CLEANED VERSION)
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
  Dimensions,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import bleService from '../../services/BLEService';
import { auth, WaterBottleService } from '../../config/firebaseConfig';
import { useUser } from '../../context/UserDetailContext';
import useTheme from '../../Theme/theme';
import { styles } from '../../constant/hometabstyles';
import DataDebugger from '../DataDebugger';

// Import the working intake components
import { HydrationGoalCard, WeeklyChart, DrinkingStats, useIntakeService } from './IntakeComponents';

const { width } = Dimensions.get('window');

// Create a ref to hold the current service instance
const waterBottleServiceRef = React.createRef();

// ADDED: bottleCapacity prop to WaterBottleVisual
const WaterBottleVisual = ({ waterLevel, isConnected, temperature, batteryLevel, theme, bottleCapacity }) => {
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
    if (level <= 0) return theme?.textMuted || '#e0e0e0';
    if (level < 25) return theme?.error || '#f44336';
    if (level < 50) return theme?.warning || '#FF9800';
    if (level < 75) return '#FFC107';
    return theme?.success || '#4CAF50';
  };

  const getBottleOpacity = () => isConnected ? 1 : 0.3;

  // Calculate remaining volume
  const remainingVolume = (waterLevel / 100) * bottleCapacity;

  return (
    <Animated.View style={[styles.bottleContainer, { transform: [{ scale: pulseAnim }] }]}>
      <View style={[styles.bottleOutline, { opacity: getBottleOpacity() }]}>
        <View style={[styles.bottleCap, { backgroundColor: theme?.text || '#34495e' }]} />
        <View style={[styles.bottleNeck, {
          backgroundColor: theme?.card || '#ecf0f1',
          borderColor: theme?.border || '#bdc3c7'
        }]} />

        <View style={[styles.bottleBody, {
          backgroundColor: theme?.card || '#ecf0f1',
          borderColor: theme?.border || '#bdc3c7'
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
                <View style={[styles.markerLine, { backgroundColor: theme?.border || '#bdc3c7' }]} />
                <Text style={[styles.markerText, { color: theme?.textMuted || '#7f8c8d' }]}>{level}%</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.bottleBase, { backgroundColor: theme?.text || '#34495e' }]} />
      </View>

      <View style={styles.waterLevelText}>
        <Text style={[styles.waterPercentage, { color: getWaterColor(waterLevel) }]}>
          {waterLevel.toFixed(1)}%
        </Text>
        {/* ADDED: Remaining water volume */}
        <Text style={[styles.waterLevelVolume, { color: theme?.text || '#2c3e50', fontSize: 18, fontWeight: '600', marginTop: 4 }]}>
          {remainingVolume.toFixed(0)} ml left
        </Text>
        <Text style={[styles.waterLevelLabel, { color: theme?.textMuted || '#7f8c8d' }]}>Water Level</Text>

        <View style={styles.statusGrid}>
          <View style={styles.statusItem}>
            <Ionicons name="thermometer" size={16} color={theme?.primary || "#2196F3"} />
            <Text style={[styles.statusValue, { color: theme?.text || '#2c3e50' }]}>{temperature.toFixed(1)}°C</Text>
          </View>
          <View style={styles.statusItem}>
            <Ionicons name="battery-half" size={16} color={theme?.success || "#4CAF50"} />
            <Text style={[styles.statusValue, { color: theme?.text || '#2c3e50' }]}>{batteryLevel}%</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? (theme?.success || '#4CAF50') : (theme?.error || '#f44336') }]} />
            <Text style={[styles.statusValue, { color: theme?.text || '#2c3e50' }]}>{isConnected ? 'Connected' : 'Offline'}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
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
      <View style={[styles.recommendationsContainer, { backgroundColor: theme?.background || '#f8f9fa' }]}>
        <View style={styles.noRecommendations}>
          <Ionicons name="checkmark-circle" size={32} color={theme?.success || "#4CAF50"} />
          <Text style={[styles.noRecommendationsText, { color: theme?.success || "#4CAF50" }]}>You're doing great! Keep it up!</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.recommendationsContainer, { backgroundColor: theme?.background || '#f8f9fa' }]}>
      <Text style={[styles.recommendationsTitle, { color: theme?.text || '#2c3e50' }]}>💡 Smart Recommendations</Text>
      {recommendations.map((rec, index) => (
        <View key={index} style={[
          styles.recommendationItem,
          {
            backgroundColor: theme?.card || 'white',
            borderLeftColor: rec.priority === 'high' ? (theme?.error || '#f44336') : (theme?.warning || '#FF9800')
          }
        ]}>
          <Ionicons
            name={rec.icon}
            size={20}
            color={rec.priority === 'high' ? (theme?.error || '#f44336') : (theme?.warning || '#FF9800')}
          />
          <Text style={[styles.recommendationText, { color: theme?.text || '#495057' }]}>{rec.text}</Text>
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
    status: 'ok',
    lastUpdate: null,
  });

  const lastReportedWaterLevel = useRef(75);
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

  // Store unsubscribe functions for cleanup
  const unsubscribersRef = useRef([]);

  // Data debugger state
  const [showDebugger, setShowDebugger] = useState(false);

  // Use the intake service hook
  const { dailyStats, weeklyData, sensorData: intakeSensorData } = useIntakeService(user);

  useEffect(() => {
    initializeServices();
    return cleanup;
  }, []);

  // Update ref when service changes
  useEffect(() => {
    waterBottleServiceRef.current = waterBottleService;
  }, [waterBottleService]);

  // Enhanced function to update hydration progress with animation
  const updateHydrationProgress = useCallback(async (volumeConsumed) => {
    console.log(`💧 Drink detected: ${volumeConsumed.toFixed(0)}ml`);

    // Show drink animation immediately
    setLastDrinkVolume(Math.round(volumeConsumed));
    setShowDrinkAnimation(true);

    // Clear animation after 3 seconds
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    animationTimeoutRef.current = setTimeout(() => {
      setShowDrinkAnimation(false);
      setLastDrinkVolume(0);
    }, 3000);

    // Try to save to database using the current service reference
    const currentService = waterBottleServiceRef.current;

    if (currentService) {
      try {
        console.log(`💾 Saving drinking event to database: ${volumeConsumed.toFixed(0)}ml`);
        await currentService.saveDrinkingEvent(volumeConsumed);
        console.log('✅ Drinking event saved successfully to database');

        // Refresh Firebase data to reflect the update
        try {
          const updatedStats = await currentService.getTodayStats();
          setFirebaseData(prev => ({
            ...prev,
            todayStats: updatedStats
          }));
        } catch (refreshError) {
          console.warn('⚠️ Could not refresh stats after drink:', refreshError);
        }
      } catch (error) {
        console.error('❌ Failed to save drinking event to database:', error);
        Alert.alert('Database Error', 'Failed to save drinking event. Please try again.');
      }
    } else {
      console.warn('⚠️ WaterBottleService not ready, cannot save to database');
      Alert.alert(
        'Service Not Ready',
        'Drink detected but database service not ready. The drink will be saved when the service is available.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  const initializeServices = async () => {
    try {
      initializeBLE();

      if (auth.currentUser) {
        console.log('🔧 Initializing WaterBottleService...');

        // Initialize the service immediately
        const service = new WaterBottleService(auth.currentUser.uid);

        // Set both state and ref
        setWaterBottleService(service);
        waterBottleServiceRef.current = service;

        // Load initial data
        await loadFirebaseData(service);
        setupFirebaseListeners(service);

        console.log('✅ WaterBottleService initialized and ready');
      } else {
        console.warn('⚠️ No authenticated user found');
      }
    } catch (error) {
      console.error('❌ Initialization error:', error);
      Alert.alert('Initialization Error', 'Failed to initialize services. Please restart the app.');
    }
  };

  const initializeBLE = () => {
    try {
      bleService.setCallbacks({
        onConnectionChange: (state) => {
          console.log('🔄 BLE connection state changed:', state);
          setBleState(state);
        },
        onDataReceived: async (data) => {
          console.log('📡 BLE data received:', data);

          let newWaterLevel = data.waterLevel;
          const currentTimestamp = new Date();

          // Validate and sanitize water level
          if (newWaterLevel === undefined || newWaterLevel === null) {
            console.warn('⚠️ Invalid water level data received');
            return;
          }
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
            status: data.status || prev.status,
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

      if (latestReading && latestReading.length > 0) {
        const reading = latestReading[0]; // Firebase returns array
        setSensorData(prev => ({
          ...prev,
          waterLevel: reading.waterLevel || prev.waterLevel,
          temperature: reading.temperature || prev.temperature,
          batteryLevel: reading.batteryLevel || prev.batteryLevel,
          status: reading.status || prev.status,
          lastUpdate: reading.timestamp?.toDate ? reading.timestamp.toDate() : new Date(reading.timestamp)
        }));
        lastReportedWaterLevel.current = reading.waterLevel;
      }
    } catch (error) {
      console.error('❌ Error loading Firebase data:', error);
      Alert.alert('Data Load Error', 'Failed to load user data. Some features may not work properly.');
    }
  };

  const setupFirebaseListeners = (service) => {
    try {
      // Clear any existing listeners
      cleanupListeners();

      console.log('🔄 Setting up Firebase listeners...');

      // Enhanced listener for today's stats with better error handling
      const todayStatsUnsubscribe = service.onTodayStats((stats) => {
        console.log('🔄 Firebase onTodayStats listener triggered:', stats);
        setFirebaseData(prev => ({
          ...prev,
          todayStats: stats
        }));
      });

      const readingsUnsubscribe = service.onLatestReadings((readings) => {
        if (readings && readings.length > 0) {
          const latest = readings[0];
          console.log('🔄 Latest reading updated:', latest);
          setFirebaseData(prev => ({ ...prev, latestReading: latest }));

          // Handle Firestore timestamp conversion
          const timestamp = latest.timestamp?.toDate ? latest.timestamp.toDate() : new Date(latest.timestamp);

          setSensorData(prev => ({
            ...prev,
            waterLevel: latest.waterLevel || prev.waterLevel,
            temperature: latest.temperature || prev.temperature,
            batteryLevel: latest.batteryLevel || prev.batteryLevel,
            status: latest.status || prev.status,
            lastUpdate: timestamp
          }));
        }
      });

      const profileUnsubscribe = service.onProfileChanges((profile) => {
        console.log('🔄 Profile updated:', profile);
        setFirebaseData(prev => ({
          ...prev,
          profile: profile
        }));
      });

      // Store unsubscribe functions
      unsubscribersRef.current = [
        todayStatsUnsubscribe,
        readingsUnsubscribe,
        profileUnsubscribe
      ].filter(Boolean); // Remove any undefined functions

      console.log(`✅ Set up ${unsubscribersRef.current.length} Firebase listeners`);

    } catch (error) {
      console.error('❌ Error setting up Firebase listeners:', error);
    }
  };

  const cleanupListeners = () => {
    if (unsubscribersRef.current && unsubscribersRef.current.length > 0) {
      console.log(`🧹 Cleaning up ${unsubscribersRef.current.length} Firebase listeners`);
      unsubscribersRef.current.forEach(unsubscribe => {
        try {
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          }
        } catch (error) {
          console.warn('⚠️ Error cleaning up listener:', error);
        }
      });
      unsubscribersRef.current = [];
    }
  };

  const cleanup = () => {
    console.log('🧹 Starting cleanup...');

    // Cleanup Firebase listeners
    cleanupListeners();

    // Cleanup BLE
    if (bleService?.isConnected) {
      bleService.disconnect().catch(e => console.log('BLE cleanup error:', e));
    }

    // Cleanup animations
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const currentService = waterBottleServiceRef.current;
      if (currentService) {
        await loadFirebaseData(currentService);
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
    // First check profile, then fallback to default
    const profileCapacity = firebaseData.profile?.bottleCapacity;
    if (profileCapacity && profileCapacity > 0) {
      return profileCapacity;
    }
    return 1000; // Default bottle capacity
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
    if (firebaseData.profile?.dailyGoal !== undefined && firebaseData.profile?.dailyGoal !== null) {
      return firebaseData.profile.dailyGoal;
    }
    if (firebaseData.todayStats?.goal !== undefined && firebaseData.todayStats?.goal !== null) {
      return firebaseData.todayStats.goal;
    }
    return 2000; // default
  };

  const getTodayIntake = () => {
    return firebaseData.todayStats?.totalConsumed ?? 0;
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

  // Get actual daily stats from Firebase or fallback to sample data
  const actualDailyStats = firebaseData.todayStats || dailyStats;
  const actualWeeklyData = firebaseData.weeklyData.length > 0 ? firebaseData.weeklyData : weeklyData;

  const bottleCapacity = getBottleCapacity(); // Get capacity here once

  return (
    <View style={[styles.container, { backgroundColor: theme?.background || '#f5f7fa' }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme?.primary}
            colors={[theme?.primary || '#667eea']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme?.primary || '#667eea' }]}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>Hello, {getUserDisplayName()}! 👋</Text>
              <Text style={styles.subtitle}>Stay hydrated & healthy today</Text>
            </View>
            {/* REMOVED: Right top corner button (Data Debugger) */}
          </View>
        </View>

        {/* Connection Section */}
        <View style={[styles.section, { backgroundColor: theme?.card || 'white' }]}>
          <Text style={[styles.sectionTitle, { color: theme?.text || '#2c3e50' }]}>🔗 Smart Bottle Connection</Text>

          <View style={[styles.connectionStatus, { backgroundColor: theme?.background || '#f8f9fa' }]}>
            <Ionicons
              name={bleState.isConnected ? "bluetooth" : "bluetooth-outline"}
              size={24}
              color={bleState.isConnected ? (theme?.success || "#4CAF50") : (theme?.textMuted || "#999")}
            />
            <Text style={[styles.statusTextMain, {
              color: bleState.isConnected ? (theme?.success || "#4CAF50") : (theme?.textMuted || "#999")
            }]}>
              {bleState.isConnected ? `Connected to ${bleState.deviceName}` : 'Not Connected'}
            </Text>
          </View>

          {bleState.isConnected ? (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme?.error || '#e74c3c' }]}
                onPress={handleDisconnect}
              >
                <Ionicons name="close-circle" size={16} color="white" />
                <Text style={styles.buttonText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme?.success || '#27ae60' }]}
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
        <View style={[styles.section, { backgroundColor: theme?.card || 'white' }]}>
          <WaterBottleVisual
            waterLevel={sensorData.waterLevel}
            isConnected={bleState.isConnected}
            temperature={sensorData.temperature}
            batteryLevel={sensorData.batteryLevel}
            theme={theme}
            bottleCapacity={bottleCapacity}
          />
        </View>

        {/* Temperature Display */}
        <View style={[styles.section, { backgroundColor: theme?.card || 'white', alignItems: 'center', padding: 16 }]}>
          <Ionicons name="thermometer" size={32} color={theme?.primary || "#2196F3"} />
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme?.text || '#2c3e50' }}>
            {sensorData.temperature.toFixed(1)}°C
          </Text>
          <Text style={{ color: theme?.textMuted || '#7f8c8d' }}>
            Current Water Temperature
          </Text>
          <Text style={{
            color: theme?.textMuted || '#7f8c8d',
            fontSize: 12,
            marginTop: 4,
            fontStyle: 'italic'
          }}>
            Status: {sensorData.status}
          </Text>
        </View>

        {/* Hydration Goal Card - Using the restored component */}
        <HydrationGoalCard
          dailyStats={actualDailyStats}
          theme={theme}
        />

        {/* Drinking Stats - Using the restored component */}
        <DrinkingStats
          dailyStats={actualDailyStats}
          sensorData={sensorData}
          theme={theme}
        />

        {/* Smart Recommendations */}
        <View style={[styles.section, { backgroundColor: theme?.card || 'white' }]}>
          <SmartRecommendations
            waterLevel={sensorData.waterLevel}
            temperature={sensorData.temperature}
            lastDrink={sensorData.lastUpdate}
            theme={theme}
          />
        </View>

        {/* Weekly Chart - Using the restored component */}
        <View style={[styles.section, { backgroundColor: theme?.card || 'white' }]}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16
          }}>
            <Text style={{
              color: theme?.text || '#2c3e50',
              fontSize: 18,
              fontWeight: 'bold'
            }}>
              📊 Hydration Progress
            </Text>

          </View>

          {/* Chart content - always render the container, toggle the actual chart */}
          <View style={{
            overflow: 'hidden',
            borderRadius: 16,
            marginLeft: -30,
            marginRight: -30,
            marginBottom: -30,


          }}>
            <WeeklyChart
              weeklyData={actualWeeklyData}
              dailyStats={actualDailyStats}
              theme={theme}
            />
          </View>
        </View>

        {/* Goal Achievement Celebration */}
        {isGoalAchieved() && showDrinkAnimation && (
          <View style={[styles.section, { backgroundColor: theme?.success || '#4CAF50' }]}>
            <View style={{
              padding: 20,
              alignItems: 'center'
            }}>
              <Text style={{
                fontSize: 48,
                marginBottom: 10
              }}>🎉</Text>
              <Text style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: 'white',
                marginBottom: 5
              }}>
                Congratulations!
              </Text>
              <Text style={{
                color: 'white',
                textAlign: 'center'
              }}>
                You've reached your daily hydration goal!
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Data Debugger Modal */}
      <DataDebugger
        visible={showDebugger}
        onClose={() => setShowDebugger(false)}
        theme={theme}
      />
    </View>
  );
}