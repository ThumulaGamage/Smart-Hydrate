// services/BleService.js - Fixed BLE error handling for intentional disconnections

import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

global.Buffer = Buffer;

const SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
const CHARACTERISTIC_UUID = '12345678-1234-5678-1234-56789abcdef1';
const DEVICE_NAME = 'SmartHydrate-ESP32';

class BleService {
  constructor() {
    console.log('🏗️ Creating BLE Service');

    this.bleManager = new BleManager();
    this.connectedDevice = null;
    this.deviceId = null;

    this.isConnected = false;
    this.isConnecting = false;
    this.isScanning = false;

    this.currentSensorData = {
      waterLevel: 0,
      temperature: 25,
      status: 'unknown',
      batteryLevel: 100
    };

    this.onConnectionChange = null;
    this.onDataReceived = null;
    this.onError = null;

    this.debugInfo = {
      dataPacketsReceived: 0,
      lastRawData: '',
      lastParsedData: null,
      connectionHistory: []
    };
  }

  async requestPermissions() {
    if (Platform.OS !== 'android') return true;

    try {
      const permissions = Platform.Version >= 31
        ? [
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
          ]
        : [
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN
          ];

      const results = await PermissionsAndroid.requestMultiple(permissions);
      const allGranted = Object.values(results).every(
        result => result === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allGranted) {
        Alert.alert('Permissions Required', 'Bluetooth permissions are required.');
      }

      return allGranted;
    } catch (error) {
      console.error('❌ Permission error:', error);
      return false;
    }
  }

  async connectToWaterBottle() {
    if (this.isConnecting) {
      console.log('⚠️ Already connecting...');
      return false;
    }

    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      this.notifyError('Permissions denied');
      return false;
    }

    this.isConnecting = true;
    this.addHistory('Starting connection...');
    this.notifyConnectionChange();

    try {
      const device = await this.scanForDevice();
      if (!device) throw new Error('Device not found');

      await this.connectToDevice(device);
      return true;

    } catch (error) {
      console.error('❌ Connection error:', error);
      this.isConnecting = false;
      this.notifyConnectionChange();
      this.notifyError(error.message);
      return false;
    }
  }

  async scanForDevice() {
    return new Promise((resolve, reject) => {
      console.log('🔍 Scanning for device...');
      this.isScanning = true;
      this.notifyConnectionChange();

      const timeout = setTimeout(() => {
        this.bleManager.stopDeviceScan();
        this.isScanning = false;
        this.isConnecting = false;
        this.notifyConnectionChange();
        reject(new Error('Scan timeout - device not found'));
      }, 15000);

      this.bleManager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.error('❌ Scan error:', error);
          clearTimeout(timeout);
          this.isScanning = false;
          this.isConnecting = false;
          this.notifyConnectionChange();
          reject(error);
          return;
        }

        if (!device) return;

        const name = device.name || device.localName;
        if (name && name === DEVICE_NAME) {
          console.log('✅ Target device found!');
          clearTimeout(timeout);
          this.bleManager.stopDeviceScan();
          this.isScanning = false;
          resolve(device);
        }
      });
    });
  }

  async connectToDevice(device) {
    console.log('🔗 Connecting to device...');
    this.addHistory(`Connecting to ${device.name}`);

    try {
      const connectedDevice = await this.bleManager.connectToDevice(device.id);
      await connectedDevice.discoverAllServicesAndCharacteristics();

      this.deviceId = device.id;
      this.connectedDevice = connectedDevice;
      this.isConnected = true;
      this.isConnecting = false;

      console.log('✅ Connected! Setting up data monitoring...');
      this.addHistory('Connected successfully');

      // Set up disconnect listener
      connectedDevice.onDisconnected((error) => {
        if (error) {
          console.log('Device disconnected with error:', error);
        }
        console.log('💔 Device disconnected unexpectedly');
        this.isConnected = false;
        this.connectedDevice = null;
        this.deviceId = null;
        this.addHistory('Device disconnected unexpectedly');
        this.notifyConnectionChange();
      });

      // Monitor characteristic for data
      connectedDevice.monitorCharacteristicForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            // Check if this is a normal disconnection event
            if (error.message && 
                (error.message.includes('disconnected') || 
                 error.message.includes('Device was disconnected'))) {
              console.log('🔌 Normal disconnection detected - ignoring error');
              return; // Ignore this error for normal disconnections
            }
            
            console.error('❌ Monitor error:', error);
            this.notifyError(`Monitor Error: ${error.message}`);
          }

          if (characteristic?.value) {
            this.handleIncomingData(characteristic);
          }
        }
      );

      this.notifyConnectionChange();
      
      // Request initial data
      setTimeout(() => {
        this.sendCommand('GET_DATA').catch(e => 
          console.log('Initial data request failed:', e)
        );
      }, 1000);

      Alert.alert('Success! 🎉', 'Connected to Smart Water Bottle!');

    } catch (error) {
      console.error('❌ Connection error:', error);
      this.isConnecting = false;
      this.notifyConnectionChange();
      this.notifyError(error.message);
      throw error;
    }
  }

  handleIncomingData(characteristic) {
    try {
      // Handle different data formats (iOS vs Android)
      let rawData;
      const value = characteristic.value;

      if (typeof value === 'string') {
        // Likely base64-encoded
        rawData = Buffer.from(value, 'base64').toString('utf-8');
      } else if (Array.isArray(value)) {
        // Raw byte array (common on iOS)
        rawData = Buffer.from(value).toString('utf-8');
      } else {
        console.warn('Unknown characteristic value type:', typeof value, value);
        return;
      }

      console.log('📦 RAW DATA RECEIVED [v2]:', rawData);

      this.debugInfo.lastRawData = rawData;
      this.debugInfo.dataPacketsReceived++;

      if (!rawData || rawData.trim().length === 0) {
        console.log('⚠️ Empty data received');
        return;
      }

      // Parse the "W:...,T:...,S:..." format
      const parsedData = {
        waterLevel: 0,
        temperature: 25,
        status: 'unknown',
        batteryLevel: 100
      };

      const parts = rawData.split(',');
      
      parts.forEach(part => {
        const trimmedPart = part.trim();
        if (!trimmedPart) return;
        
        const colonIndex = trimmedPart.indexOf(':');
        if (colonIndex === -1) return;
        
        const key = trimmedPart.substring(0, colonIndex).trim();
        const value = trimmedPart.substring(colonIndex + 1).trim();

        switch (key) {
          case 'W':
            const waterLevel = parseInt(value, 10);
            if (!isNaN(waterLevel)) {
              parsedData.waterLevel = Math.max(0, Math.min(100, waterLevel)); // Clamp to 0-100
            }
            break;
          case 'T':
            const temperature = parseInt(value, 10);
            if (!isNaN(temperature)) {
              parsedData.temperature = temperature;
            }
            break;
          case 'S':
            const statusMap = { 
              'OK': 'ok', 
              'FULL': 'full', 
              'LOW': 'low', 
              'EMPTY': 'empty',
              'ERROR': 'error',
              'MOVING': 'moving'
            };
            parsedData.status = statusMap[value] || 'unknown';
            break;
          case 'B': // Battery level
            const batteryLevel = parseInt(value, 10);
            if (!isNaN(batteryLevel)) {
              parsedData.batteryLevel = Math.max(0, Math.min(100, batteryLevel)); // Clamp to 0-100
            }
            break;
        }
      });

      if (Object.keys(parsedData).length === 0) {
        console.warn('⚠️ Could not parse valid keys from ', rawData);
        return;
      }

      this.debugInfo.lastParsedData = parsedData;
      Object.assign(this.currentSensorData, parsedData);

      const finalData = {
        ...this.currentSensorData,
        lastUpdate: new Date(),
        timestamp: Date.now()
      };

      console.log('📊 FINAL DATA TO UI:', finalData);

      if (this.onDataReceived) {
        this.onDataReceived(finalData);
      }

    } catch (error) {
      console.error('❌ Data processing error:', error);
      this.notifyError(`Data Processing Error: ${error.message}`);
    }
  }

  async sendCommand(command) {
    if (!this.isConnected || !this.connectedDevice) {
      throw new Error('Not connected');
    }

    try {
      console.log(`📤 Sending command: ${command}`);
      
      // Send raw UTF-8 bytes (not base64 for commands)
      const commandBytes = Buffer.from(command, 'utf-8');
      
      // Convert to string for react-native-ble-plx
      const commandString = commandBytes.toString('utf-8');
      
      await this.connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        commandString
      );

      console.log(`✅ Command sent: ${command}`);
      this.addHistory(`Sent: ${command}`);

    } catch (error) {
      console.error(`❌ Command failed: ${command}`, error);
      this.notifyError(`Command Failed: ${error.message}`);
      throw error;
    }
  }

  async disconnect() {
    try {
      console.log('🔌 Disconnecting...');
      
      if (this.deviceId) {
        await this.bleManager.cancelDeviceConnection(this.deviceId);
      }

      this.isConnected = false;
      this.deviceId = null;
      this.connectedDevice = null;

      this.addHistory('Disconnected');
      this.notifyConnectionChange();

      Alert.alert('Disconnected', 'Disconnected from water bottle');

    } catch (error) {
      console.error('❌ Disconnect error:', error);
      this.notifyError(`Disconnect Error: ${error.message}`);
    }
  }

  addHistory(message) {
    const timestamp = new Date().toLocaleTimeString();
    this.debugInfo.connectionHistory.push(`${timestamp}: ${message}`);
    if (this.debugInfo.connectionHistory.length > 20) {
      this.debugInfo.connectionHistory.shift();
    }
  }

  getState() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      isScanning: this.isScanning,
      deviceName: this.connectedDevice?.name || '',
      debugInfo: { ...this.debugInfo }
    };
  }

  setCallbacks({ onConnectionChange, onDataReceived, onError }) {
    this.onConnectionChange = onConnectionChange;
    this.onDataReceived = onDataReceived;
    this.onError = onError;
  }

  notifyConnectionChange() {
    if (this.onConnectionChange) {
      this.onConnectionChange(this.getState());
    }
  }

  notifyError(message) {
    console.error('BLE Error:', message);
    if (this.onError) {
      this.onError(message);
    }
  }

  destroy() {
    console.log('🗑️ Destroying BLE Service');
    
    // Clean up any ongoing operations
    if (this.bleManager) {
      this.bleManager.stopDeviceScan();
      
      if (this.deviceId) {
        this.bleManager.cancelDeviceConnection(this.deviceId)
          .catch(e => console.log('Cleanup error:', e));
      }
      
      this.bleManager.destroy();
    }
    
    this.connectedDevice = null;
    this.deviceId = null;
    this.isConnected = false;
  }
}

export default new BleService();