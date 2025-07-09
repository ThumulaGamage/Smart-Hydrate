// FirebaseConfig.jsx - Simplified Configuration (No AsyncStorage Issues)

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

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

// Export Firebase services and FieldValue
export const auth = firebase.auth();
export const realtimeDB = firebase.database();
export const firestore = firebase.firestore();
export const storage = firebase.storage();
export const FieldValue = firebase.firestore.FieldValue; // Add this for server timestamps
export default firebase;

// =======================================================
// SMART WATER BOTTLE SERVICE CLASS (Same as before)
// =======================================================

export class WaterBottleService {
  constructor(userId = null) {
    this.userId = userId || 'default_user';
    this.userRef = realtimeDB.ref(`users/${this.userId}`);
    this.readingsRef = this.userRef.child('readings');
    this.dailyStatsRef = this.userRef.child('dailyStats');
    this.profileRef = this.userRef.child('profile');
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
      
      return latestReading;
    } catch (error) {
      console.error('Error getting latest reading:', error);
      throw error;
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
  // DAILY STATISTICS
  // ======================

  async getTodayStats() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const snapshot = await this.dailyStatsRef.child(today).once('value');
      return snapshot.val();
    } catch (error) {
      console.error('Error getting today stats:', error);
      throw error;
    }
  }

  onTodayStats(callback) {
    const today = new Date().toISOString().split('T')[0];
    const listener = this.dailyStatsRef.child(today).on('value', (snapshot) => {
      const stats = snapshot.val();
      if (callback) {
        callback(stats);
      }
    }, (error) => {
      console.error('Error in today stats listener:', error);
    });

    return () => this.dailyStatsRef.child(today).off('value', listener);
  }

  async getWeeklyStats() {
    try {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const startDate = weekAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];
      
      const snapshot = await this.dailyStatsRef
        .orderByKey()
        .startAt(startDate)
        .endAt(endDate)
        .once('value');
      
      const weeklyData = [];
      snapshot.forEach((childSnapshot) => {
        weeklyData.push({
          date: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      
      return weeklyData;
    } catch (error) {
      console.error('Error getting weekly stats:', error);
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
        averageTemperature: temperature,
        sessions: []
      };

      const updatedStats = {
        ...currentStats,
        totalConsumed: currentStats.totalConsumed + consumed,
        goalAchieved: (currentStats.totalConsumed + consumed) >= dailyGoal,
        drinkingFrequency: currentStats.drinkingFrequency + 1,
        averageTemperature: currentStats.averageTemperature 
          ? (currentStats.averageTemperature + temperature) / 2 
          : temperature,
        lastUpdated: firebase.database.ServerValue.TIMESTAMP,
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
      console.log('Daily stats updated for', today);
      return updatedStats;
    } catch (error) {
      console.error('Error updating daily stats:', error);
      throw error;
    }
  }

  // ======================
  // SIMULATION METHODS
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
      const latestReading = await this.getLatestReading();
      const currentLevel = latestReading?.waterLevel || 1000;
      const newLevel = Math.max(0, currentLevel - amount);
      
      await this.saveReading({
        waterLevel: newLevel,
        temperature: 18 + Math.random() * 10,
        batteryLevel: 40 + Math.floor(Math.random() * 60),
        isCharging: Math.random() > 0.9,
        deviceId: 'bottle_001'
      });

      await this.updateDailyStats(amount, 22.5);
      
      console.log(`Simulated drinking ${amount}ml. New level: ${newLevel}ml`);
      return newLevel;
    } catch (error) {
      console.error('Error simulating drinking:', error);
      throw error;
    }
  }

  async refillBottle(capacity = 1000) {
    try {
      await this.saveReading({
        waterLevel: capacity,
        temperature: 20 + Math.random() * 5,
        batteryLevel: 50 + Math.floor(Math.random() * 50),
        isCharging: false,
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