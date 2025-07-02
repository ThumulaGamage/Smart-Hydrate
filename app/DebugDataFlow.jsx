// DataDebugger.js - Add this to your HomeTab to see live data flow

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import bleServiceFactory from '../services/BLEServiceFactory';

const DataDebugger = ({ visible, onClose, theme }) => {
  const [liveData, setLiveData] = useState({
    rawDataCount: 0,
    lastRawData: '',
    lastParsedData: null,
    dataHistory: [],
    connectionState: 'Unknown'
  });

  useEffect(() => {
    if (!visible) return;

    // Monitor BLE service directly
    const interval = setInterval(() => {
      const bleService = bleServiceFactory.getInstance();
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

  const sendTestCommand = async (command) => {
    try {
      const bleService = bleServiceFactory.getInstance();
      if (!bleService.isConnected) {
        Alert.alert('Error', 'Not connected to device');
        return;
      }
      
      console.log(`🧪 Sending test command: ${command}`);
      await bleService.sendCommand(command);
      Alert.alert('Success', `Command "${command}" sent`);
    } catch (error) {
      console.error('Command failed:', error);
      Alert.alert('Error', `Failed: ${error.message}`);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <Text style={[styles.title, { color: theme.text }]}>Live Data Debugger</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          
          {/* Connection Status */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🔗 Connection Status</Text>
            <View style={styles.statusRow}>
              <Text style={[styles.label, { color: theme.textMuted }]}>State:</Text>
              <Text style={[styles.value, { 
                color: liveData.connectionState === 'Connected' ? '#4CAF50' : '#f44336' 
              }]}>
                {liveData.connectionState}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.label, { color: theme.textMuted }]}>Data Packets:</Text>
              <Text style={[styles.value, { color: theme.text }]}>
                {liveData.rawDataCount}
              </Text>
            </View>
          </View>

          {/* Test Commands */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🧪 Test Commands</Text>
            <View style={styles.commandRow}>
              <TouchableOpacity
                style={[styles.commandButton, { backgroundColor: theme.primary }]}
                onPress={() => sendTestCommand('GET_DATA')}
              >
                <Text style={styles.buttonText}>GET_DATA</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.commandButton, { backgroundColor: '#FF9800' }]}
                onPress={() => sendTestCommand('TEST')}
              >
                <Text style={styles.buttonText}>TEST</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.commandButton, { backgroundColor: '#4CAF50' }]}
                onPress={() => sendTestCommand('RESET')}
              >
                <Text style={styles.buttonText}>RESET</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Raw Data */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>📦 Last Raw Data</Text>
            <View style={[styles.dataBox, { backgroundColor: theme.background }]}>
              <ScrollView style={styles.scrollableData} nestedScrollEnabled>
                <Text style={[styles.dataText, { color: theme.text }]}>
                  {liveData.lastRawData || 'No raw data received yet...'}
                </Text>
              </ScrollView>
            </View>
            {liveData.lastRawData && (
              <Text style={[styles.dataInfo, { color: theme.textMuted }]}>
                Length: {liveData.lastRawData.length} characters
              </Text>
            )}
          </View>

          {/* Parsed Data */}
          {liveData.lastParsedData && (
            <View style={[styles.section, { backgroundColor: theme.card }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>🔍 Last Parsed Data</Text>
              <View style={[styles.dataBox, { backgroundColor: theme.background }]}>
                <ScrollView style={styles.scrollableData} nestedScrollEnabled>
                  <Text style={[styles.dataText, { color: theme.text }]}>
                    {JSON.stringify(liveData.lastParsedData, null, 2)}
                  </Text>
                </ScrollView>
              </View>
            </View>
          )}

          {/* Key Values Monitor */}
          {liveData.lastParsedData && (
            <View style={[styles.section, { backgroundColor: theme.card }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>📊 Key Values</Text>
              <View style={styles.keyValuesGrid}>
                <View style={styles.keyValue}>
                  <Text style={[styles.keyLabel, { color: theme.textMuted }]}>Distance</Text>
                  <Text style={[styles.keyValueText, { 
                    color: liveData.lastParsedData.distance > 0 ? '#4CAF50' : '#f44336' 
                  }]}>
                    {liveData.lastParsedData.distance || 'N/A'} cm
                  </Text>
                </View>
                <View style={styles.keyValue}>
                  <Text style={[styles.keyLabel, { color: theme.textMuted }]}>Water Level</Text>
                  <Text style={[styles.keyValueText, { 
                    color: liveData.lastParsedData.waterLevel > 0 ? '#4CAF50' : '#f44336' 
                  }]}>
                    {liveData.lastParsedData.waterLevel || 'N/A'} %
                  </Text>
                </View>
                <View style={styles.keyValue}>
                  <Text style={[styles.keyLabel, { color: theme.textMuted }]}>Temperature</Text>
                  <Text style={[styles.keyValueText, { color: '#FF9800' }]}>
                    {liveData.lastParsedData.temperature || 'N/A'} °C
                  </Text>
                </View>
                <View style={styles.keyValue}>
                  <Text style={[styles.keyLabel, { color: theme.textMuted }]}>Status</Text>
                  <Text style={[styles.keyValueText, { color: theme.text }]}>
                    {liveData.lastParsedData.status || 'N/A'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Data Flow History */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>📋 Recent Activity</Text>
            <ScrollView style={styles.historyBox} nestedScrollEnabled>
              {liveData.dataHistory.slice(-10).map((entry, index) => (
                <Text key={index} style={[styles.historyEntry, { color: theme.textMuted }]}>
                  {entry}
                </Text>
              ))}
              {liveData.dataHistory.length === 0 && (
                <Text style={[styles.noData, { color: theme.textMuted }]}>
                  No activity yet...
                </Text>
              )}
            </ScrollView>
          </View>

          {/* Troubleshooting */}
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🔧 Troubleshooting</Text>
            <View style={styles.troubleshootList}>
              <Text style={[styles.troubleshootItem, { color: theme.textMuted }]}>
                ❌ If "No raw data": ESP32 not sending or BLE connection issue
              </Text>
              <Text style={[styles.troubleshootItem, { color: theme.textMuted }]}>
                ❌ If "distance: 0": ESP32 sensor wiring problem
              </Text>
              <Text style={[styles.troubleshootItem, { color: theme.textMuted }]}>
                ❌ If "waterLevel: 0": ESP32 calculation issue
              </Text>
              <Text style={[styles.troubleshootItem, { color: theme.textMuted }]}>
                ✅ If both distance and waterLevel : 0": System working!
              </Text>
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
    borderBottomColor: 'rgba(255,255,255,0.1)',
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
    fontFamily: 'monospace',
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
    fontFamily: 'monospace',
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