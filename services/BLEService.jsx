// BleService.js - Direct export, no factory pattern

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
    
    // Store cumulative sensor data (since we get different values in different packets)
    this.currentSensorData = {
      waterLevel: 0,
      temperature: 25,
      batteryLevel: 100,
      distance: 0,
      status: 'unknown',
      isCalibrated: false
    };
    
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
      console.log('📋 Requesting permissions...');
      
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
      if (!device) {
        throw new Error('Device not found');
      }

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

        if (device && (device.name || device.localName)) {
          const name = device.name || device.localName;
          console.log(`📱 Found device: ${name}`);

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
      console.log('📏 Data length:', rawData.length);
      
      // Store raw data for debugging
      this.debugInfo.lastRawData = rawData;
      this.debugInfo.dataPacketsReceived++;
      
      if (!rawData || rawData.trim().length === 0) {
        console.log('⚠️ Empty data received');
        return;
      }

      // Parse the ultra-short format
      let parsedData = this.parseShortFormat(rawData);
      
      if (!parsedData) {
        console.log('⚠️ Could not parse short format data');
        return;
      }

      console.log('✅ PARSED SHORT DATA:', parsedData);

      // Store parsed data
      this.debugInfo.lastParsedData = parsedData;

      // Merge with existing data (since we get different values in different packets)
      if (!this.currentSensorData) {
        this.currentSensorData = {
          waterLevel: 0,
          temperature: 25,
          batteryLevel: 100,
          distance: 0,
          status: 'unknown',
          isCalibrated: false
        };
      }

      // Update with new data from this packet
      Object.assign(this.currentSensorData, parsedData);

      // Create final data object
      const finalData = {
        ...this.currentSensorData,
        lastUpdate: new Date(),
        emptyDistance: 25,
        fullDistance: 3,
        bottleHeight: 30,
        maxWaterHeight: 25,
        deviceName: DEVICE_NAME,
        timestamp: Date.now()
      };

      this.addHistory(`Data: Distance ${finalData.distance}cm, Water ${finalData.waterLevel}%`);
      console.log('📊 FINAL DATA TO UI:', finalData);
      
      // Send to UI callback
      if (this.onDataReceived) {
        this.onDataReceived(finalData);
      }

    } catch (error) {
      console.error('❌ Data processing error:', error);
    }
  }

  parseShortFormat(data) {
    console.log('🔍 Parsing short format:', data);
    
    // Handle different packet types
    // Type 0: D[dist*10]W[water*10] - e.g. "D65W841"
    // Type 1: T[temp*10]B[battery] - e.g. "T251B100"
    // Type 2: S[status]C[cal] - e.g. "SOKC1"
    
    const result = {};
    
    if (data.startsWith('D') && data.includes('W')) {
      // Distance and water packet
      const distMatch = data.match(/D(\d+)/);
      const waterMatch = data.match(/W(\d+)/);
      
      if (distMatch) {
        result.distance = parseInt(distMatch[1]) / 10;
        console.log('  → Distance:', result.distance);
      }
      if (waterMatch) {
        result.waterLevel = parseInt(waterMatch[1]) / 10;
        console.log('  → Water Level:', result.waterLevel);
      }
    }
    else if (data.startsWith('T') && data.includes('B')) {
      // Temperature and battery packet
      const tempMatch = data.match(/T(\d+)/);
      const batteryMatch = data.match(/B(\d+)/);
      
      if (tempMatch) {
        result.temperature = parseInt(tempMatch[1]) / 10;
        console.log('  → Temperature:', result.temperature);
      }
      if (batteryMatch) {
        result.batteryLevel = parseInt(batteryMatch[1]);
        console.log('  → Battery:', result.batteryLevel);
      }
    }
    else if (data.startsWith('S')) {
      // Status packet
      const statusMatch = data.match(/S([A-Z]{2})/);
      const calMatch = data.match(/C(\d)/);
      
      if (statusMatch) {
        const statusCode = statusMatch[1];
        const statusMap = {
          'OK': 'ok',
          'FL': 'full',
          'LO': 'low',
          'ER': 'error'
        };
        result.status = statusMap[statusCode] || 'unknown';
        console.log('  → Status:', result.status);
      }
      if (calMatch) {
        result.isCalibrated = calMatch[1] === '1';
        console.log('  → Calibrated:', result.isCalibrated);
      }
    }
    else {
      console.log('  → Unknown packet format');
      return null;
    }
    
    return Object.keys(result).length > 0 ? result : null;
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
      console.error('❌ Disconnect error:', error);
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

// Export single instance directly
export default new BleService();