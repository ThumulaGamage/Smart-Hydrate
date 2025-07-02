// SimpleHomeTab.js - Enhanced version with visual water bottle

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import bleService from '../../services/BLEService';

// Water Bottle Visual Component
const WaterBottleVisual = ({ waterLevel, isConnected }) => {
  const [animatedValue] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: waterLevel,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [waterLevel]);

  const getWaterColor = (level) => {
    if (level <= 0) return '#e0e0e0'; // Empty - gray
    if (level < 25) return '#f44336'; // Low - red
    if (level < 50) return '#FF9800'; // Medium-low - orange
    if (level < 75) return '#FFC107'; // Medium - yellow
    return '#4CAF50'; // High - green
  };

  const getBottleOpacity = () => {
    return isConnected ? 1 : 0.3;
  };

  return (
    <View style={styles.bottleContainer}>
      <View style={[styles.bottleOutline, { opacity: getBottleOpacity() }]}>
        {/* Bottle Cap */}
        <View style={styles.bottleCap} />
        
        {/* Bottle Neck */}
        <View style={styles.bottleNeck} />
        
        {/* Main Bottle Body */}
        <View style={styles.bottleBody}>
          {/* Water Level Indicator */}
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
          
          {/* Water Level Markers */}
          <View style={styles.levelMarkers}>
            {[25, 50, 75, 100].map((level) => (
              <View key={level} style={styles.levelMarker}>
                <View style={styles.markerLine} />
                <Text style={styles.markerText}>{level}%</Text>
              </View>
            ))}
          </View>
        </View>
        
        {/* Bottle Base */}
        <View style={styles.bottleBase} />
      </View>
      
      {/* Water Level Text */}
      <View style={styles.waterLevelText}>
        <Text style={[styles.waterPercentage, { color: getWaterColor(waterLevel) }]}>
          {waterLevel.toFixed(1)}%
        </Text>
        <Text style={styles.waterLevelLabel}>Water Level</Text>
        
        {/* Status Indicator */}
        <View style={styles.statusIndicator}>
          <View style={[
            styles.statusDot, 
            { backgroundColor: isConnected ? '#4CAF50' : '#f44336' }
          ]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
      </View>
    </View>
  );
};

// Hydration Progress Bar
const HydrationProgress = ({ currentLevel, dailyGoal = 100 }) => {
  const progress = Math.min((currentLevel / dailyGoal) * 100, 100);
  
  return (
    <View style={styles.progressContainer}>
      <Text style={styles.progressTitle}>Daily Hydration Goal</Text>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.progressText}>
        {currentLevel.toFixed(1)}% of {dailyGoal}% daily goal
      </Text>
    </View>
  );
};

export default function SimpleHomeTab() {
  const [bleState, setBleState] = useState({
    isConnected: false,
    isConnecting: false,
    isScanning: false,
    deviceName: ''
  });

  const [sensorData, setSensorData] = useState({
    distance: 0,
    waterLevel: 0,
    temperature: 0,
    batteryLevel: 0,
    status: 'disconnected',
    lastUpdate: null,
    isCalibrated: false
  });

  const [rawDataLog, setRawDataLog] = useState([]);
  const [dailyConsumption, setDailyConsumption] = useState(0);

  useEffect(() => {
    initializeBLE();
    
    return () => {
      if (bleService && bleService.isConnected) {
        bleService.disconnect().catch(e => console.log('Cleanup error:', e));
      }
    };
  }, []);

  // Track water consumption changes
  useEffect(() => {
    if (sensorData.waterLevel < 90) { // Assuming consumption when level drops
      // This is a simplified logic - you might want to implement more sophisticated tracking
      const consumption = 100 - sensorData.waterLevel;
      setDailyConsumption(prev => Math.max(prev, consumption));
    }
  }, [sensorData.waterLevel]);

  const initializeBLE = () => {
    try {
      bleService.setCallbacks({
        onConnectionChange: (state) => {
          console.log('🔄 Connection state changed:', state);
          setBleState(state);
        },
        onDataReceived: (data) => {
          console.log('📊 RECEIVED DATA:', data);
          setSensorData(data);
          
          // Add to raw data log for debugging
          setRawDataLog(prev => {
            const newLog = [...prev, {
              time: new Date().toLocaleTimeString(),
              data: data
            }].slice(-10); // Keep last 10 entries
            return newLog;
          });
        },
        onError: (message) => {
          Alert.alert('BLE Error', message);
        }
      });

    } catch (error) {
      console.error('❌ BLE initialization error:', error);
      Alert.alert('Error', 'Failed to initialize Bluetooth');
    }
  };

  const handleConnect = async () => {
    try {
      const success = await bleService.connectToWaterBottle();
      
      if (!success) {
        console.log('❌ Connection failed');
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
      console.log(`✅ Sent: ${command}`);
    } catch (error) {
      console.error('❌ Command error:', error);
      Alert.alert('Command Failed', error.message);
    }
  };

  const resetDailyGoal = () => {
    setDailyConsumption(0);
    Alert.alert('Reset', 'Daily consumption tracking reset!');
  };

  const getDistanceColor = (distance) => {
    if (distance <= 0) return '#f44336'; // Red for no reading
    if (distance <= 10) return '#4CAF50'; // Green for close (full)
    if (distance <= 20) return '#FF9800'; // Orange for medium
    return '#f44336'; // Red for far (empty)
  };

  const getTemperatureColor = (temp) => {
    if (temp < 5) return '#2196F3'; // Cold - blue
    if (temp < 15) return '#00BCD4'; // Cool - cyan
    if (temp < 25) return '#4CAF50'; // Room temp - green
    if (temp < 35) return '#FF9800'; // Warm - orange
    return '#f44336'; // Hot - red
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Smart Water Bottle</Text>
          <Text style={styles.subtitle}>Stay Hydrated & Healthy</Text>
        </View>

        {/* Water Bottle Visual Section */}
        <View style={styles.section}>
          <WaterBottleVisual 
            waterLevel={sensorData.waterLevel} 
            isConnected={bleState.isConnected}
          />
        </View>

        {/* Hydration Progress */}
        {bleState.isConnected && (
          <View style={styles.section}>
            <HydrationProgress 
              currentLevel={dailyConsumption}
              dailyGoal={100}
            />
            <TouchableOpacity 
              style={styles.resetButton}
              onPress={resetDailyGoal}
            >
              <Ionicons name="refresh-circle-outline" size={16} color="#666" />
              <Text style={styles.resetButtonText}>Reset Daily Goal</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Connection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔗 Device Connection</Text>
          
          <View style={styles.connectionStatus}>
            <Ionicons 
              name={bleState.isConnected ? "bluetooth" : "bluetooth-outline"} 
              size={24} 
              color={bleState.isConnected ? "#4CAF50" : "#999"} 
            />
            <Text style={[styles.statusTextMain, { 
              color: bleState.isConnected ? "#4CAF50" : "#999" 
            }]}>
              {bleState.isConnected ? `Connected to ${bleState.deviceName}` : 'Not Connected'}
            </Text>
          </View>

          {bleState.isConnected ? (
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.button, styles.refreshButton]}
                onPress={() => sendCommand('GET_DATA')}
              >
                <Ionicons name="refresh" size={16} color="white" />
                <Text style={styles.buttonText}>Refresh Data</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.disconnectButton]}
                onPress={handleDisconnect}
              >
                <Ionicons name="close-circle" size={16} color="white" />
                <Text style={styles.buttonText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.button, styles.connectButton]}
              onPress={handleConnect}
              disabled={bleState.isConnecting}
            >
              {bleState.isConnecting ? (
                <View style={styles.connectingRow}>
                  <ActivityIndicator color="white" size="small" />
                  <Text style={[styles.buttonText, { marginLeft: 8 }]}>
                    {bleState.isScanning ? 'Scanning for bottle...' : 'Connecting...'}
                  </Text>
                </View>
              ) : (
                <>
                  <Ionicons name="bluetooth" size={16} color="white" />
                  <Text style={[styles.buttonText, { marginLeft: 8 }]}>Connect to Bottle</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Detailed Sensor Data Section */}
        {bleState.isConnected && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Sensor Readings</Text>
            
            {/* Main Readings */}
            <View style={styles.dataGrid}>
              <View style={styles.dataCard}>
                <Ionicons name="resize-outline" size={24} color={getDistanceColor(sensorData.distance)} />
                <Text style={styles.dataLabel}>Distance Sensor</Text>
                <Text style={[styles.dataValue, { color: getDistanceColor(sensorData.distance) }]}>
                  {sensorData.distance.toFixed(1)} cm
                </Text>
                <Text style={styles.dataSubtext}>from water surface</Text>
              </View>

              <View style={styles.dataCard}>
                <Ionicons name="thermometer-outline" size={24} color={getTemperatureColor(sensorData.temperature)} />
                <Text style={styles.dataLabel}>Temperature</Text>
                <Text style={[styles.dataValue, { color: getTemperatureColor(sensorData.temperature) }]}>
                  {sensorData.temperature.toFixed(1)} °C
                </Text>
                <Text style={styles.dataSubtext}>water temperature</Text>
              </View>

              <View style={styles.dataCard}>
                <Ionicons 
                  name={sensorData.batteryLevel > 50 ? "battery-full" : 
                        sensorData.batteryLevel > 20 ? "battery-half" : "battery-dead"} 
                  size={24} 
                  color={sensorData.batteryLevel > 20 ? "#4CAF50" : "#f44336"} 
                />
                <Text style={styles.dataLabel}>Battery Level</Text>
                <Text style={[styles.dataValue, { 
                  color: sensorData.batteryLevel > 20 ? "#4CAF50" : "#f44336" 
                }]}>
                  {sensorData.batteryLevel} %
                </Text>
                <Text style={styles.dataSubtext}>device battery</Text>
              </View>

              <View style={styles.dataCard}>
                <Ionicons 
                  name={sensorData.isCalibrated ? "checkmark-circle" : "warning"} 
                  size={24} 
                  color={sensorData.isCalibrated ? "#4CAF50" : "#FF9800"} 
                />
                <Text style={styles.dataLabel}>Calibration</Text>
                <Text style={[styles.dataValue, { 
                  color: sensorData.isCalibrated ? "#4CAF50" : "#FF9800" 
                }]}>
                  {sensorData.isCalibrated ? 'Active' : 'Needed'}
                </Text>
                <Text style={styles.dataSubtext}>sensor status</Text>
              </View>
            </View>

            {/* Status Info */}
            <View style={styles.statusInfo}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Device Status:</Text>
                <Text style={[styles.statusValue, { textTransform: 'capitalize' }]}>
                  {sensorData.status}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Last Update:</Text>
                <Text style={styles.statusValue}>
                  {sensorData.lastUpdate ? sensorData.lastUpdate.toLocaleTimeString() : 'Never'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        {bleState.isConnected && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
            <View style={styles.quickActions}>
              <TouchableOpacity 
                style={styles.quickActionButton}
                onPress={() => sendCommand('CALIBRATE')}
              >
                <Ionicons name="settings-outline" size={20} color="#2196F3" />
                <Text style={styles.quickActionText}>Calibrate</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.quickActionButton}
                onPress={() => sendCommand('RESET')}
              >
                <Ionicons name="refresh-outline" size={20} color="#FF9800" />
                <Text style={styles.quickActionText}>Reset Device</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.quickActionButton}
                onPress={() => sendCommand('LED_ON')}
              >
                <Ionicons name="bulb-outline" size={20} color="#4CAF50" />
                <Text style={styles.quickActionText}>LED On</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Debug Data Log */}
        {bleState.isConnected && rawDataLog.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔍 Recent Data Log</Text>
            {rawDataLog.slice(-5).map((entry, index) => (
              <View key={index} style={styles.logEntry}>
                <Text style={styles.logTime}>{entry.time}</Text>
                <Text style={styles.logData}>
                  💧 {entry.data.waterLevel.toFixed(1)}% | 📏 {entry.data.distance.toFixed(1)}cm | 🌡️ {entry.data.temperature.toFixed(1)}°C
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Setup Instructions</Text>
          <View style={styles.instructionsList}>
            <Text style={styles.instruction}>
              • Ensure your ESP32 device is powered on and broadcasting
            </Text>
            <Text style={styles.instruction}>
              • Enable Bluetooth on your phone if not already active
            </Text>
            <Text style={styles.instruction}>
              • Tap "Connect to Bottle" and wait for pairing
            </Text>
            <Text style={styles.instruction}>
              • Calibrate the sensor for accurate water level readings
            </Text>
            <Text style={styles.instruction}>
              • Monitor your hydration goals throughout the day
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    backgroundColor: '#667eea',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  section: {
    margin: 16,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#2c3e50',
  },
  
  // Water Bottle Visual Styles
  bottleContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  bottleOutline: {
    alignItems: 'center',
    marginBottom: 20,
  },
  bottleCap: {
    width: 30,
    height: 15,
    backgroundColor: '#34495e',
    borderRadius: 8,
    marginBottom: 2,
  },
  bottleNeck: {
    width: 20,
    height: 20,
    backgroundColor: '#ecf0f1',
    borderWidth: 2,
    borderColor: '#bdc3c7',
    marginBottom: 2,
  },
  bottleBody: {
    width: 80,
    height: 200,
    backgroundColor: '#ecf0f1',
    borderWidth: 2,
    borderColor: '#bdc3c7',
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  waterLevel: {
    width: '100%',
    borderRadius: 10,
    position: 'absolute',
    bottom: 0,
  },
  levelMarkers: {
    position: 'absolute',
    right: -40,
    height: '100%',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  levelMarker: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markerLine: {
    width: 15,
    height: 1,
    backgroundColor: '#bdc3c7',
    marginRight: 5,
  },
  markerText: {
    fontSize: 10,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  bottleBase: {
    width: 85,
    height: 8,
    backgroundColor: '#34495e',
    borderRadius: 4,
    marginTop: 2,
  },
  waterLevelText: {
    alignItems: 'center',
  },
  waterPercentage: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  waterLevelLabel: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 12,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
  },

  // Progress Bar Styles
  progressContainer: {
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  progressBar: {
    height: 12,
    backgroundColor: '#ecf0f1',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3498db',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    alignSelf: 'center',
  },
  resetButtonText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },

  // Connection Styles
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  statusTextMain: {
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    flexDirection: 'row',
  },
  connectButton: {
    backgroundColor: '#27ae60',
    width: '100%',
  },
  refreshButton: {
    backgroundColor: '#3498db',
    flex: 1,
    marginRight: 8,
  },
  disconnectButton: {
    backgroundColor: '#e74c3c',
    flex: 1,
    marginLeft: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  connectingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Data Grid Styles
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dataCard: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  dataLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 6,
    marginBottom: 4,
    fontWeight: '500',
  },
  dataValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  dataSubtext: {
    fontSize: 10,
    color: '#adb5bd',
    textAlign: 'center',
  },

  // Status Info Styles
  statusInfo: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 2,
  },
  statusLabel: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },

  // Quick Actions Styles
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickActionButton: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  quickActionText: {
    fontSize: 12,
    color: '#495057',
    marginTop: 4,
    fontWeight: '500',
  },

  // Log Styles
  logEntry: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#3498db',
  },
  logTime: {
    fontSize: 10,
    color: '#adb5bd',
    marginBottom: 4,
    fontWeight: '500',
  },
  logData: {
    fontSize: 12,
    color: '#495057',
    fontFamily: 'monospace',
  },

  // Instructions Styles
  instructionsList: {
    paddingLeft: 8,
  },
  instruction: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
    lineHeight: 20,
  },
});