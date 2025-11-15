// FirebaseConfig.jsx - Updated with Async Storage Persistence

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCV5Qiz9DkdwSRoSWUwh6BOsBNb2qgCZmc",
  authDomain: "smart-hydrate-5b0bd.firebaseapp.com",
  databaseURL: "https://smart-hydrate-5b0bd-default-rtdb.firebaseio.com",
  projectId: "smart-hydrate-5b0bd",
  storageBucket: "smart-hydrate-5b0bd.firebasestorage.app",
  messagingSenderId: "201171796898",
  appId: "1:201171796898:web:c35eded0095783049c68fb",
  measurementId: "G-9NFNL714XF"
};

// Initialize Firebase (only once)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Export Firebase services
export const auth = firebase.auth();
export const realtimeDB = firebase.database();
export const firestore = firebase.firestore();
export const storage = firebase.storage();

export const FieldValue = firebase.firestore.FieldValue;



export default firebase;

// =======================================================
// SMART WATER BOTTLE SERVICE CLASS - Updated for new users
// =======================================================

export class WaterBottleService {
  constructor(userId = null) {
    this.userId = userId || 'default_user';
    this.userRef = realtimeDB.ref(`users/${this.userId}`);
    this.readingsRef = this.userRef.child('readings');
    this.dailyStatsRef = this.userRef.child('dailyStats');
    this.profileRef = this.userRef.child('profile');
    this.database = realtimeDB;
  }

  // Check if user is new (created within last 24 hours)
  async isNewUser() {
    try {
      const profileSnapshot = await this.profileRef.once('value');
      const profile = profileSnapshot.val();
      
      if (!profile || !profile.createdAt) return true;
      
      const now = Date.now();
      const createdAt = profile.createdAt;
      const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
      
      return hoursSinceCreation < 24;
    } catch (error) {
      console.error('Error checking if user is new:', error);
      return false;
    }
  }

  // Check if user has any real activity
  async hasRealActivity() {
    try {
      // Check for any readings
      const readingsSnapshot = await this.readingsRef.limitToLast(1).once('value');
      const hasReadings = readingsSnapshot.exists();
      
      // Check for any consumption today
      const todayStats = await this.getTodayStats();
      const hasConsumption = todayStats.totalConsumed > 0;
      
      return hasReadings || hasConsumption;
    } catch (error) {
      console.error('Error checking user activity:', error);
      return false;
    }
  }

  // ======================
  // USER PROFILE METHODS
  // ======================

  async createUserProfile(profileData) {
    try {
      const profile = {
        name: profileData.name || 'User',
        email: profileData.email || '',
        dailyGoal: profileData.dailyGoal || 2000,
        weight: profileData.weight || 70,
        age: profileData.age || 25,
        height: profileData.height || 170,
        activityLevel: profileData.activityLevel || 'moderate',
        gender: profileData.gender || '',
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      };

      await this.profileRef.set(profile);
      console.log('User profile created successfully');
      return profile;
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

  async getUserProfile() {
    try {
      const snapshot = await this.profileRef.once('value');
      return snapshot.val();
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  // ======================
  // SENSOR DATA METHODS
  // ======================

  async saveReading(sensorData) {
    try {
      const reading = {
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        waterLevel: sensorData.waterLevel || 0,
        temperature: sensorData.temperature || 20,
        batteryLevel: sensorData.batteryLevel || 100,
        isCharging: sensorData.isCharging || false,
        humidity: sensorData.humidity || null,
        pressure: sensorData.pressure || null,
        sensorData: sensorData.accelerometer ? {
          accelerometer: sensorData.accelerometer,
          gyroscope: sensorData.gyroscope || null
        } : null,
        deviceId: sensorData.deviceId || 'bottle_001',
        firmwareVersion: sensorData.firmwareVersion || '1.0.0'
      };

      const newReadingRef = await this.readingsRef.push(reading);
      console.log('Sensor reading saved with ID:', newReadingRef.key);
      return newReadingRef.key;
    } catch (error) {
      console.error('Error saving sensor reading:', error);
      throw error;
    }
  }

  async getLatestReading() {
    try {
      const snapshot = await this.readingsRef
        .orderByChild('timestamp')
        .limitToLast(1)
        .once('value');

      let latestReading = null;
      snapshot.forEach((childSnapshot) => {
        latestReading = {
          id: childSnapshot.key,
          ...childSnapshot.val()
        };
      });

      // Return empty bottle state for new users with no readings
      if (!latestReading) {
        return {
          id: 'empty',
          waterLevel: 0,
          temperature: 22,
          batteryLevel: 100,
          isCharging: false,
          timestamp: Date.now(),
          deviceId: 'bottle_001'
        };
      }

      return latestReading;
    } catch (error) {
      console.error('Error getting latest reading:', error);
      // Return empty state on error
      return {
        id: 'empty',
        waterLevel: 0,
        temperature: 22,
        batteryLevel: 100,
        isCharging: false,
        timestamp: Date.now(),
        deviceId: 'bottle_001'
      };
    }
  }

  // ======================
  // REAL-TIME LISTENERS
  // ======================

  onRealtimeData(callback) {
    const listener = this.userRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data && callback) {
        callback(data);
      }
    }, (error) => {
      console.error('Error in real-time listener:', error);
    });

    return () => this.userRef.off('value', listener);
  }

  onLatestReadings(callback, limit = 10) {
    const listener = this.readingsRef
      .orderByChild('timestamp')
      .limitToLast(limit)
      .on('value', (snapshot) => {
        const readings = [];
        snapshot.forEach((childSnapshot) => {
          readings.unshift({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });

        // If no readings for new user, provide empty state
        if (readings.length === 0) {
          readings.push({
            id: 'empty',
            waterLevel: 0,
            temperature: 22,
            batteryLevel: 100,
            isCharging: false,
            timestamp: Date.now(),
            deviceId: 'bottle_001'
          });
        }

        if (callback) {
          callback(readings);
        }
      }, (error) => {
        console.error('Error in readings listener:', error);
      });

    return () => this.readingsRef.off('value', listener);
  }

  onProfileChanges(callback) {
    const listener = this.profileRef.on('value', (snapshot) => {
      const profile = snapshot.val();
      if (callback) {
        callback(profile);
      }
    }, (error) => {
      console.error('Error in profile listener:', error);
    });

    return () => this.profileRef.off('value', listener);
  }

  // ======================
  // DAILY STATISTICS - Updated for new users
  // ======================

  async saveDrinkingEvent(volumeConsumed, timestamp = null) {
    try {
      if (!this.userId) {
        throw new Error('User ID is required');
      }

      const currentTime = timestamp || new Date();
      const today = currentTime.toISOString().split('T')[0];

      const drinkingEvent = {
        volume: Math.round(volumeConsumed),
        timestamp: currentTime.toISOString(),
        date: today,
        source: 'smart_bottle',
        deviceId: 'bottle_001'
      };

      const drinkingEventsRef = this.userRef.child('drinkingEvents');
      const newEventRef = drinkingEventsRef.push();
      await newEventRef.set(drinkingEvent);

      console.log(`Drinking event saved: ${volumeConsumed}ml at ${currentTime.toLocaleTimeString()}`);

      await this.updateDailyStats(volumeConsumed, 22.5);

      return newEventRef.key;
    } catch (error) {
      console.error('Error saving drinking event:', error);
      throw error;
    }
  }

  async updateDailyStats(consumed, temperature) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const statsRef = this.dailyStatsRef.child(today);

      const snapshot = await statsRef.once('value');
      const profile = await this.getUserProfile();
      const dailyGoal = profile?.dailyGoal || 2000;

      const currentStats = snapshot.val() || {
        date: today,
        totalConsumed: 0,
        goalAchieved: false,
        drinkingFrequency: 0,
        averageTemperature: null,
        sessions: []
      };

      let newAverageTemperature = temperature;
      if (currentStats.averageTemperature !== null) {
        newAverageTemperature = (currentStats.averageTemperature * currentStats.drinkingFrequency + temperature) / (currentStats.drinkingFrequency + 1);
      }

      const updatedStats = {
        ...currentStats,
        totalConsumed: currentStats.totalConsumed + consumed,
        goalAchieved: (currentStats.totalConsumed + consumed) >= dailyGoal,
        drinkingFrequency: currentStats.drinkingFrequency + 1,
        averageTemperature: newAverageTemperature,
        lastUpdated: firebase.database.ServerValue.TIMESTAMP,
        lastDrink: new Date().toISOString(),
        goal: dailyGoal,
        sessions: [
          ...(currentStats.sessions || []),
          {
            amount: consumed,
            temperature: temperature,
            timestamp: firebase.database.ServerValue.TIMESTAMP
          }
        ]
      };

      await statsRef.set(updatedStats);
      console.log(`Daily stats updated for ${today}: ${updatedStats.totalConsumed}ml total, ${updatedStats.drinkingFrequency} drinks`);
      return updatedStats;
    } catch (error) {
      console.error('Error updating daily stats:', error);
      throw error;
    }
  }

  // Enhanced method for new users
  onTodayStats(callback) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayStatsRef = this.dailyStatsRef.child(today);

      const listener = todayStatsRef.on('value', async (snapshot) => {
        const stats = snapshot.val();
        
        // For new users or users with no stats, return empty state
        if (!stats) {
          const profile = await this.getUserProfile();
          const emptyStats = {
            totalConsumed: 0,
            drinkingFrequency: 0,
            goal: profile?.dailyGoal || 2000,
            date: today,
            goalAchieved: false,
            averageTemperature: null,
            sessions: [],
            isNewUser: true // Flag to help UI components
          };
          console.log('Returning empty stats for new user');
          callback(emptyStats);
          return;
        }

        console.log('Real-time stats update:', stats);
        callback({ ...stats, isNewUser: false });
      }, (error) => {
        console.error('Error in today stats listener:', error);
      });

      return () => todayStatsRef.off('value', listener);
    } catch (error) {
      console.error('Error setting up today stats listener:', error);
      return () => {};
    }
  }

  async getTodayStats() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayStatsRef = this.dailyStatsRef.child(today);

      const snapshot = await todayStatsRef.once('value');
      const stats = snapshot.val();
      
      if (!stats) {
        const profile = await this.getUserProfile();
        return {
          totalConsumed: 0,
          drinkingFrequency: 0,
          goal: profile?.dailyGoal || 2000,
          date: today,
          goalAchieved: false,
          averageTemperature: null,
          sessions: [],
          isNewUser: true
        };
      }
      
      return { ...stats, isNewUser: false };
    } catch (error) {
      console.error('Error getting today stats:', error);
      return {
        totalConsumed: 0,
        drinkingFrequency: 0,
        goal: 2000,
        date: new Date().toISOString().split('T')[0],
        goalAchieved: false,
        averageTemperature: null,
        sessions: [],
        isNewUser: true
      };
    }
  }

  // Updated weekly stats for new users
  async getWeeklyStats() {
    try {
      const today = new Date();
      const profile = await this.getUserProfile();
      const defaultGoal = profile?.dailyGoal || 2000;

      const snapshot = await this.dailyStatsRef
        .orderByKey()
        .limitToLast(7)
        .once('value');

      const weeklyData = [];
      const hasData = snapshot.exists();
      
      // Generate 7 days of data
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        let dayData = null;
        if (hasData) {
          snapshot.forEach((childSnapshot) => {
            if (childSnapshot.key === dateStr) {
              dayData = childSnapshot.val();
            }
          });
        }
        
        weeklyData.push({
          date: dateStr,
          totalConsumed: dayData?.totalConsumed || 0,
          goal: dayData?.goal || defaultGoal,
          goalAchieved: dayData?.goalAchieved || false,
          drinkingFrequency: dayData?.drinkingFrequency || 0
        });
      }

      return {
        data: weeklyData,
        hasRealData: hasData,
        isNewUser: !hasData
      };
    } catch (error) {
      console.error('Error getting weekly stats:', error);
      
      // Always return a valid structure
      const today = new Date();
      const emptyWeekData = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        emptyWeekData.push({
          date: date.toISOString().split('T')[0],
          totalConsumed: 0,
          goal: 2000,
          goalAchieved: false,
          drinkingFrequency: 0
        });
      }
      
      return {
        data: emptyWeekData,
        hasRealData: false,
        isNewUser: true
      };
    }
  }

  // ======================
  // SIMULATION METHODS - Updated
  // ======================

  simulateReading() {
    const sensorData = {
      waterLevel: Math.floor(Math.random() * 1000),
      temperature: 15 + Math.random() * 20,
      batteryLevel: 20 + Math.floor(Math.random() * 80),
      isCharging: Math.random() > 0.8,
      humidity: 40 + Math.random() * 30,
      accelerometer: {
        x: (Math.random() - 0.5) * 4,
        y: (Math.random() - 0.5) * 4,
        z: 9.8 + (Math.random() - 0.5) * 1
      },
      gyroscope: {
        x: (Math.random() - 0.5) * 0.2,
        y: (Math.random() - 0.5) * 0.2,
        z: (Math.random() - 0.5) * 0.2
      },
      deviceId: 'bottle_001',
      firmwareVersion: '1.2.3'
    };

    return this.saveReading(sensorData);
  }

  async simulateDrinking(amount) {
    try {
      const latestSensorReading = await this.getLatestReading();
      const currentLevel = latestSensorReading?.waterLevel || 0;
      const newLevel = Math.max(0, currentLevel - amount);

      const currentTemp = latestSensorReading?.temperature || 20;
      const currentBattery = latestSensorReading?.batteryLevel || 100;
      const isCharging = latestSensorReading?.isCharging || false;

      if (newLevel !== currentLevel) {
        await this.saveReading({
          waterLevel: newLevel,
          temperature: currentTemp,
          batteryLevel: currentBattery,
          isCharging: isCharging,
          deviceId: 'bottle_001'
        });

        await this.updateDailyStats(amount, currentTemp);

        console.log(`Simulated drinking ${amount}ml. New level: ${newLevel}ml`);
        return newLevel;
      } else {
        console.log('No change in water volume detected. No update to readings or daily stats.');
        return currentLevel;
      }
    } catch (error) {
      console.error('Error simulating drinking:', error);
      throw error;
    }
  }

  async refillBottle(capacity = 1000) {
    try {
      const latestSensorReading = await this.getLatestReading();
      const currentTemp = latestSensorReading?.temperature || 20;
      const currentBattery = latestSensorReading?.batteryLevel || 100;
      const isCharging = latestSensorReading?.isCharging || false;

      await this.saveReading({
        waterLevel: capacity,
        temperature: currentTemp,
        batteryLevel: currentBattery,
        isCharging: isCharging,
        deviceId: 'bottle_001'
      });

      console.log(`Bottle refilled to ${capacity}ml`);
      return capacity;
    } catch (error) {
      console.error('Error refilling bottle:', error);
      throw error;
    }
  }
}

// =======================================================
// AUTHENTICATION HELPER FUNCTIONS
// =======================================================

export const authHelpers = {
  async signUp(email, password, displayName) {
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);

      if (displayName) {
        await userCredential.user.updateProfile({ displayName });
      }

      console.log('User signed up successfully');
      return userCredential.user;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  },

  async signIn(email, password) {
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      console.log('User signed in successfully');
      return userCredential.user;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  },

  async signOut() {
    try {
      await auth.signOut();
      console.log('User signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },

  onAuthStateChanged(callback) {
    return auth.onAuthStateChanged(callback);
  },

  getCurrentUser() {
    return auth.currentUser;
  },

  async resetPassword(email) {
    try {
      await auth.sendPasswordResetEmail(email);
      console.log('Password reset email sent');
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  }
};