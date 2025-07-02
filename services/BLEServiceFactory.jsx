// CleanBleService.js - Replace your entire BLE service with this

import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

global.Buffer = Buffer;

const SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
const CHARACTERISTIC_UUID = '12345678-1234-5678-1234-56789abcdef1';
const DEVICE_NAME = 'SmartHydrate-ESP32';

class CleanBleService {
  constructor() {
    console.log('🏗️ Creating CleanBleService');
    
    this.bleManager = new BleManager();
    this.connectedDevice = null;
    this.deviceId = null;
    
    this.isConnected = false;
    this.isConnecting = false;
    this.isScanning = false;
    
    // Callbacks
    this.onConnectionChange = null;
    this.onDataReceived = null;
    this.onError = null;
    
    // Debug
    this.debugInfo = {
      dataPacketsReceived: 0,
      lastRawData: '',
      lastParsedData: null,
      connectionHistory: []
    };
  }

  async requestPermissions() {
    if (Platform.OS !== 'android') {
      return true;
    }

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
      console.error('Permission error:', error);
      return false;
    }
  }

  async connectToWaterBottle() {
    if (this.isConnecting) {
      console.log('Already connecting...');
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
      if (!device) {
        throw new Error('Device not found');
      }

      await this.connectToDevice(device);
      return true;

    } catch (error) {
      console.error('Connection error:', error);
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
          console.error('Scan error:', error);
          clearTimeout(timeout);
          this.isScanning = false;
          this.isConnecting = false;
          this.notifyConnectionChange();
          reject(error);
          return;
        }

        if (device && (device.name || device.localName)) {
          const name = device.name || device.localName;
          console.log(`Found device: ${name}`);

          // Check if this is our target device
          if (name === DEVICE_NAME || 
              name.toLowerCase().includes('smarthydrate') || 
              name.toLowerCase().includes('esp32')) {
            
            console.log('✅ Target device found!');
            clearTimeout(timeout);
            this.bleManager.stopDeviceScan();
            this.isScanning = false;
            resolve(device);
          }
        }
      });
    });
  }

  async connectToDevice(device) {
    console.log('🔗 Connecting to device...');
    this.addHistory(`Connecting to ${device.name}`);

    const connectedDevice = await this.bleManager.connectToDevice(device.id);
    await connectedDevice.discoverAllServicesAndCharacteristics();

    this.deviceId = device.id;
    this.connectedDevice = connectedDevice;
    this.isConnected = true;
    this.isConnecting = false;

    console.log('✅ Connected! Setting up data monitoring...');
    this.addHistory('Connected successfully');

    // Start monitoring for data
    connectedDevice.monitorCharacteristicForService(
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          console.error('❌ Monitor error:', error);
          return;
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
  }

  handleIncomingData(characteristic) {
    try {
      // Decode the base64 data
      const rawData = Buffer.from(characteristic.value, 'base64').toString('utf-8');
      
      console.log('📦 RAW DATA RECEIVED:', rawData);
      
      // Store raw data for debugging
      this.debugInfo.lastRawData = rawData;
      this.debugInfo.dataPacketsReceived++;
      
      if (!rawData || rawData.trim().length === 0) {
        console.log('⚠️ Empty data received');
        return;
      }

      // Parse JSON
      let parsedData;
      try {
        parsedData = JSON.parse(rawData);
        console.log('✅ PARSED DATA:', parsedData);
      } catch (jsonError) {
        console.error('❌ JSON parse error:', jsonError);
        console.log('Raw data was:', rawData);
        return;
      }

      if (!parsedData || typeof parsedData !== 'object') {
        console.log('⚠️ Invalid parsed data');
        return;
      }

      // Store parsed data
      this.debugInfo.lastParsedData = parsedData;
      this.addHistory(`Data: Distance ${parsedData.distance}cm, Water ${parsedData.waterLevel}%`);

      // Create final data object - NO VALIDATION THAT ZEROS VALUES
      const finalData = {
        // Core readings - keep exactly as received from ESP32
        waterLevel: Number(parsedData.waterLevel) || 0,
        temperature: Number(parsedData.temperature) || 0,
        batteryLevel: Number(parsedData.batteryLevel) || 0,
        distance: Number(parsedData.distance) || 0, // This was being zeroed!
        
        // Status and other fields
        status: parsedData.status || 'unknown',
        isCalibrated: Boolean(parsedData.isCalibrated),
        emptyDistance: Number(parsedData.emptyDistance) || 0,
        fullDistance: Number(parsedData.fullDistance) || 0,
        
        // Metadata
        lastUpdate: new Date(),
        bottleHeight: Number(parsedData.bottleHeight) || 30,
        maxWaterHeight: Number(parsedData.maxWaterHeight) || 25,
        deviceName: parsedData.deviceName || DEVICE_NAME,
        timestamp: parsedData.timestamp || Date.now()
      };

      console.log('📊 FINAL DATA TO UI:', finalData);
      
      // Send to UI callback
      if (this.onDataReceived) {
        this.onDataReceived(finalData);
      }

    } catch (error) {
      console.error('❌ Data processing error:', error);
    }
  }

  async sendCommand(command) {
    if (!this.isConnected || !this.connectedDevice) {
      throw new Error('Not connected');
    }

    try {
      console.log(`📤 Sending command: ${command}`);
      
      const commandBytes = Buffer.from(command, 'utf-8').toString('base64');
      
      await this.connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        commandBytes
      );
      
      console.log(`✅ Command sent: ${command}`);
      this.addHistory(`Sent: ${command}`);
      
    } catch (error) {
      console.error(`❌ Command failed: ${command}`, error);
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
      console.error('Disconnect error:', error);
    }
  }

  // Helper methods
  addHistory(message) {
    const timestamp = new Date().toLocaleTimeString();
    this.debugInfo.connectionHistory.push(`${timestamp}: ${message}`);
    
    if (this.debugInfo.connectionHistory.length > 20) {
      this.debugInfo.connectionHistory = this.debugInfo.connectionHistory.slice(-20);
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

// Simple factory
class CleanBleServiceFactory {
  constructor() {
    this.instance = null;
  }

  getInstance() {
    if (!this.instance) {
      console.log('🏭 Creating new CleanBleService instance');
      this.instance = new CleanBleService();
    }
    return this.instance;
  }

  createFreshInstance() {
    if (this.instance) {
      this.instance.destroy();
    }
    this.instance = new CleanBleService();
    return this.instance;
  }
}

export default new CleanBleServiceFactory();