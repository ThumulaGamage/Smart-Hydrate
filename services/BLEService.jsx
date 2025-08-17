// BleService.js - Final Corrected Version for "W:...,T:...,S:..." format

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

        const name = device?.name || device?.localName;
        if (name === DEVICE_NAME) {
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

    const connectedDevice = await this.bleManager.connectToDevice(device.id);
    await connectedDevice.discoverAllServicesAndCharacteristics();

    this.deviceId = device.id;
    this.connectedDevice = connectedDevice;
    this.isConnected = true;
    this.isConnecting = false;

    console.log('✅ Connected! Setting up data monitoring...');
    this.addHistory('Connected successfully');

    connectedDevice.monitorCharacteristicForService(
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          console.error('❌ Monitor error:', error);
          this.notifyError(`Monitor Error: ${error.message}`);
          this.disconnect();
          return;
        }

        if (characteristic?.value) {
          this.handleIncomingData(characteristic);
        }
      }
    );

    this.notifyConnectionChange();
    Alert.alert('Success! 🎉', 'Connected to Smart Water Bottle!');
  }

  handleIncomingData(characteristic) {
    try {
      const rawData = Buffer.from(characteristic.value, 'base64').toString('utf-8');
      console.log('📦 RAW DATA RECEIVED [v2]:', rawData);

      this.debugInfo.lastRawData = rawData;
      this.debugInfo.dataPacketsReceived++;

      if (!rawData || rawData.trim().length === 0) {
        console.log('⚠️ Empty data received');
        return;
      }

      const parts = rawData.split(',');
      const parsedData = {};

      parts.forEach(part => {
        const [key, value] = part.split(':');
        if (!key || value === undefined) return;

        switch (key) {
          case 'W':
            parsedData.waterLevel = parseInt(value, 10);
            break;
          case 'T':
            parsedData.temperature = parseInt(value, 10);
            break;
          case 'S':
            const statusMap = { OK: 'ok', FULL: 'full', LOW: 'low', ERROR: 'error' };
            parsedData.status = statusMap[value] || 'unknown';
            break;
        }
      });

      if (Object.keys(parsedData).length === 0) {
        console.warn('⚠️ Could not parse valid keys from data:', rawData);
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
      console.error('❌ Disconnect error:', error);
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
    this.bleManager.destroy();
  }
}

export default new BleService();
