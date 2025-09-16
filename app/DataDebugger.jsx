// DataDebugger.js - Live data flow debugger
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import bleServiceFactory from '../services/BLEService';

const DataDebugger = ({ visible, onClose, theme }) => {
  const [liveData, setLiveData] = useState({
    rawDataCount: 0,
    lastRawData: '',
    lastParsedData: null,
    dataHistory: [],
    connectionState: 'Unknown'
  });
  
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!visible) return;

    // Monitor BLE service directly
    const interval = setInterval(() => {
      const bleService = bleServiceFactory.getInstance();
      
      // Add null check
      if (!bleService) {
        console.warn('BLE service not initialized yet');
        return;
      }

      const state = bleService.getState();
      
      setLiveData(prev => ({
        rawDataCount: state.debugInfo?.dataPacketsReceived || 0,
        lastRawData: state.debugInfo?.lastRawData || '',
        lastParsedData: state.debugInfo?.lastParsedData || null,
        dataHistory: state.debugInfo?.connectionHistory || [],
        connectionState: state.isConnected ? 'Connected' : 'Disconnected'
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [visible]);

  // Safe JSON stringify to prevent circular reference errors
  const safeStringify = (obj, space = 2) => {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          return '[Circular Reference]';
        }
        cache.add(value);
      }
      return value;
    }, space);
  };

  // Truncate large JSON strings
  const truncateJson = (jsonStr, maxLength = 2000) => {
    if (jsonStr.length <= maxLength) return jsonStr;
    return jsonStr.substring(0, maxLength) + '... [truncated]';
  };

  // Alert debouncing
  let alertTimeout = null;
  const showAlert = (title, message) => {
    if (alertTimeout) clearTimeout(alertTimeout);
    
    alertTimeout = setTimeout(() => {
      Alert.alert(title, message);
    }, 300);
  };

  const sendTestCommand = async (command) => {
    if (isSending) {
      console.log('Already sending command...');
      return;
    }

    setIsSending(true);
    
    try {
      const bleService = bleServiceFactory.getInstance();
      if (!bleService || !bleService.isConnected) {
        showAlert('Error', 'Not connected to device');
        return;
      }
      
      console.log(`🧪 Sending test command: ${command}`);
      await bleService.sendCommand(command);
      showAlert('Success', `Command "${command}" sent`);
    } catch (error) {
      console.error('Command failed:', error);
      showAlert('Error', `Failed: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Dynamic troubleshooting hints
  const getTroubleshootingHints = () => {
    const hints = [];
    
    if (!liveData.lastRawData) {
      hints.push('❌ No raw data received - check ESP32 BLE transmission');
    }
    
    if (liveData.lastParsedData && liveData.lastParsedData.distance === 0) {
      hints.push('⚠️ Distance is 0 - possible sensor wiring issue');
    }
    
    if (liveData.lastParsedData && liveData.lastParsedData.waterLevel === 0) {
      hints.push('⚠️ Water level is 0 - check calibration or sensor');
    }
    
    if (liveData.connectionState !== 'Connected') {
      hints.push('🔌 Not connected - try reconnecting');
    }
    
    if (hints.length === 0) {
      hints.push('✅ All systems nominal');
    }
    
    return hints;
  };

  if (!visible) return null;

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : 'pageSheet'}
    >
      <View style={[styles.container, { backgroundColor: theme?.background || '#f5f7fa' }]}>
        
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme?.card || 'white' }]}>
          <Text style={[styles.title, { color: theme?.text || '#2c3e50' }]}>Live Data Debugger</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme?.text || '#2c3e50'} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          
          {/* Connection Status */}
          <View style={[styles.section, { backgroundColor: theme?.card || 'white' }]}>
            <Text style={[styles.sectionTitle, { color: theme?.text || '#2c3e50' }]}>🔗 Connection Status</Text>
            <View style={styles.statusRow}>
              <Text style={[styles.label, { color: theme?.textMuted || '#7f8c8d' }]}>State:</Text>
              <Text style={[styles.value, { 
                color: liveData.connectionState === 'Connected' ? '#4CAF50' : '#f44336' 
              }]}>
                {liveData.connectionState}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.label, { color: theme?.textMuted || '#7f8c8d' }]}>Data Packets:</Text>
              <Text style={[styles.value, { color: theme?.text || '#2c3e50' }]}>
                {liveData.rawDataCount}
              </Text>
            </View>
          </View>

          {/* Test Commands */}
          <View style={[styles.section, { backgroundColor: theme?.card || 'white' }]}>
            <Text style={[styles.sectionTitle, { color: theme?.text || '#2c3e50' }]}>🧪 Test Commands</Text>
            <View style={styles.commandRow}>
              <TouchableOpacity
                style={[styles.commandButton, { backgroundColor: theme?.primary || '#1976D2' }]}
                onPress={() => sendTestCommand('GET_DATA')}
                disabled={isSending}
              >
                <Text style={styles.buttonText}>
                  {isSending ? 'Sending...' : 'GET_DATA'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.commandButton, { backgroundColor: '#FF9800' }]}
                onPress={() => sendTestCommand('TEST')}
                disabled={isSending}
              >
                <Text style={styles.buttonText}>TEST</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.commandButton, { backgroundColor: '#4CAF50' }]}
                onPress={() => sendTestCommand('RESET')}
                disabled={isSending}
              >
                <Text style={styles.buttonText}>RESET</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Raw Data */}
          <View style={[styles.section, { backgroundColor: theme?.card || 'white' }]}>
            <Text style={[styles.sectionTitle, { color: theme?.text || '#2c3e50' }]}>📦 Last Raw Data</Text>
            <View style={[styles.dataBox, { backgroundColor: theme?.background || '#f8f9fa' }]}>
              <ScrollView style={styles.scrollableData} nestedScrollEnabled>
                <Text style={[styles.dataText, { color: theme?.text || '#2c3e50' }]}>
                  {liveData.lastRawData || 'No raw data received yet...'}
                </Text>
              </ScrollView>
            </View>
            {liveData.lastRawData && (
              <Text style={[styles.dataInfo, { color: theme?.textMuted || '#7f8c8d' }]}>
                Length: {liveData.lastRawData.length} characters
              </Text>
            )}
          </View>

          {/* Parsed Data */}
          {liveData.lastParsedData && (
            <View style={[styles.section, { backgroundColor: theme?.card || 'white' }]}>
              <Text style={[styles.sectionTitle, { color: theme?.text || '#2c3e50' }]}>🔍 Last Parsed Data</Text>
              <View style={[styles.dataBox, { backgroundColor: theme?.background || '#f8f9fa' }]}>
                <ScrollView style={styles.scrollableData} nestedScrollEnabled>
                  <Text style={[styles.dataText, { color: theme?.text || '#2c3e50' }]}>
                    {truncateJson(safeStringify(liveData.lastParsedData))}
                  </Text>
                </ScrollView>
              </View>
            </View>
          )}

          {/* Key Values Monitor */}
          {liveData.lastParsedData && (
            <View style={[styles.section, { backgroundColor: theme?.card || 'white' }]}>
              <Text style={[styles.sectionTitle, { color: theme?.text || '#2c3e50' }]}>📊 Key Values</Text>
              <View style={styles.keyValuesGrid}>
                <View style={styles.keyValue}>
                  <Text style={[styles.keyLabel, { color: theme?.textMuted || '#7f8c8d' }]}>Distance</Text>
                  <Text style={[styles.keyValueText, { 
                    color: liveData.lastParsedData.distance > 0 ? '#4CAF50' : '#f44336' 
                  }]}>
                    {liveData.lastParsedData.distance || 'N/A'} cm
                  </Text>
                </View>
                <View style={styles.keyValue}>
                  <Text style={[styles.keyLabel, { color: theme?.textMuted || '#7f8c8d' }]}>Water Level</Text>
                  <Text style={[styles.keyValueText, { 
                    color: liveData.lastParsedData.waterLevel > 0 ? '#4CAF50' : '#f44336' 
                  }]}>
                    {liveData.lastParsedData.waterLevel || 'N/A'} %
                  </Text>
                </View>
                <View style={styles.keyValue}>
                  <Text style={[styles.keyLabel, { color: theme?.textMuted || '#7f8c8d' }]}>Temperature</Text>
                  <Text style={[styles.keyValueText, { color: '#FF9800' }]}>
                    {liveData.lastParsedData.temperature || 'N/A'} °C
                  </Text>
                </View>
                <View style={styles.keyValue}>
                  <Text style={[styles.keyLabel, { color: theme?.textMuted || '#7f8c8d' }]}>Status</Text>
                  <Text style={[styles.keyValueText, { color: theme?.text || '#2c3e50' }]}>
                    {liveData.lastParsedData.status || 'N/A'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Data Flow History */}
          <View style={[styles.section, { backgroundColor: theme?.card || 'white' }]}>
            <Text style={[styles.sectionTitle, { color: theme?.text || '#2c3e50' }]}>📋 Recent Activity</Text>
            <ScrollView style={styles.historyBox} nestedScrollEnabled>
              {liveData.dataHistory.slice(-10).map((entry, index) => (
                <Text key={index} style={[styles.historyEntry, { color: theme?.textMuted || '#7f8c8d' }]}>
                  {entry}
                </Text>
              ))}
              {liveData.dataHistory.length === 0 && (
                <Text style={[styles.noData, { color: theme?.textMuted || '#7f8c8d' }]}>
                  No activity yet...
                </Text>
              )}
            </ScrollView>
          </View>

          {/* Troubleshooting */}
          <View style={[styles.section, { backgroundColor: theme?.card || 'white' }]}>
            <Text style={[styles.sectionTitle, { color: theme?.text || '#2c3e50' }]}>🔧 Troubleshooting</Text>
            <View style={styles.troubleshootList}>
              {getTroubleshootingHints().map((hint, index) => (
                <Text key={index} style={[styles.troubleshootItem, { color: theme?.textMuted || '#7f8c8d' }]}>
                  {hint}
                </Text>
              ))}
            </View>
          </View>

        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginVertical: 8,
    padding: 16,
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      }
    })
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  commandRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  commandButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    margin: 4,
  },
  buttonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  dataBox: {
    borderRadius: 6,
    padding: 12,
    maxHeight: 120,
  },
  scrollableData: {
    maxHeight: 100,
  },
  dataText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 14,
  },
  dataInfo: {
    fontSize: 10,
    marginTop: 4,
    fontStyle: 'italic',
  },
  keyValuesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  keyValue: {
    width: '48%',
    marginBottom: 12,
    alignItems: 'center',
  },
  keyLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  keyValueText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyBox: {
    maxHeight: 150,
  },
  historyEntry: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 2,
    lineHeight: 14,
  },
  noData: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  troubleshootList: {
    paddingTop: 8,
  },
  troubleshootItem: {
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 16,
  },
});

export default DataDebugger;