// services/TimeTrackingService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { realtimeDB, firestore, FieldValue } from '../config/firebaseConfig';

/**
 * Time Tracking Service
 * Tracks user login/session time across app sessions with Firebase sync
 */
export class TimeTrackingService {
  constructor(userId) {
    if (!userId) {
      throw new Error('userId is required for TimeTrackingService');
    }
    
    this.userId = userId;
    this.sessionStartTime = null;
    this.isTracking = false;
    
    // AsyncStorage keys
    this.STORAGE_KEYS = {
      SESSION_START: `@time_tracking_session_start_${userId}`,
      TOTAL_TIME: `@time_tracking_total_time_${userId}`,
      LAST_SYNC: `@time_tracking_last_sync_${userId}`,
      PENDING_TIME: `@time_tracking_pending_time_${userId}`,
    };
    
    // Firebase references
    this.timeTrackingRef = realtimeDB.ref(`users/${userId}/timeTracking`);
    this.firestoreUserRef = firestore.collection('users').doc(userId);
  }

  // ==========================================
  // SESSION MANAGEMENT
  // ==========================================

  /**
   * Start a new tracking session
   */
  async startSession() {
    try {
      if (this.isTracking) {
        console.log('⏱️ Session already active');
        return;
      }

      const now = Date.now();
      this.sessionStartTime = now;
      this.isTracking = true;

      // Save session start to AsyncStorage
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.SESSION_START,
        now.toString()
      );

      console.log('✅ Time tracking session started:', new Date(now).toLocaleString());
    } catch (error) {
      console.error('❌ Error starting session:', error);
      throw error;
    }
  }

  /**
   * End current session and save time
   */
  async endSession() {
    try {
      if (!this.isTracking || !this.sessionStartTime) {
        console.log('⏱️ No active session to end');
        return 0;
      }

      const now = Date.now();
      const sessionDuration = Math.floor((now - this.sessionStartTime) / 1000); // in seconds

      console.log(`⏱️ Ending session. Duration: ${sessionDuration}s (${this.formatTime(sessionDuration)})`);

      // Save session duration
      await this.saveSessionDuration(sessionDuration);

      // Sync to Firebase
      await this.syncToFirebase();

      // Clean up
      this.sessionStartTime = null;
      this.isTracking = false;
      await AsyncStorage.removeItem(this.STORAGE_KEYS.SESSION_START);

      console.log('✅ Session ended successfully');
      return sessionDuration;
    } catch (error) {
      console.error('❌ Error ending session:', error);
      throw error;
    }
  }

  /**
   * Save session duration to local storage
   */
  async saveSessionDuration(duration) {
    try {
      // Get current total time
      const totalTime = await this.getTotalTime();
      const newTotal = totalTime + duration;

      // Save new total
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.TOTAL_TIME,
        newTotal.toString()
      );

      // Add to pending time for Firebase sync
      const pendingTime = await this.getPendingTime();
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.PENDING_TIME,
        (pendingTime + duration).toString()
      );

      console.log(`💾 Saved session: ${duration}s | New total: ${newTotal}s`);
    } catch (error) {
      console.error('❌ Error saving session duration:', error);
      throw error;
    }
  }

  /**
   * Get current session duration (live)
   */
  getCurrentSessionDuration() {
    if (!this.isTracking || !this.sessionStartTime) {
      return 0;
    }
    return Math.floor((Date.now() - this.sessionStartTime) / 1000);
  }

  // ==========================================
  // DATA RETRIEVAL
  // ==========================================

  /**
   * Get total time from AsyncStorage
   */
  async getTotalTime() {
    try {
      const saved = await AsyncStorage.getItem(this.STORAGE_KEYS.TOTAL_TIME);
      return saved ? parseInt(saved, 10) : 0;
    } catch (error) {
      console.error('❌ Error getting total time:', error);
      return 0;
    }
  }

  /**
   * Get pending time (not yet synced to Firebase)
   */
  async getPendingTime() {
    try {
      const saved = await AsyncStorage.getItem(this.STORAGE_KEYS.PENDING_TIME);
      return saved ? parseInt(saved, 10) : 0;
    } catch (error) {
      console.error('❌ Error getting pending time:', error);
      return 0;
    }
  }

  /**
   * Get combined time (total + current session)
   */
  async getCombinedTime() {
    const totalTime = await this.getTotalTime();
    const currentSession = this.getCurrentSessionDuration();
    return totalTime + currentSession;
  }

  /**
   * Get today's time from Firebase Realtime Database
   */
  async getTodayTime() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const snapshot = await this.timeTrackingRef
        .child('daily')
        .child(today)
        .once('value');
      
      const data = snapshot.val();
      return data?.totalSeconds || 0;
    } catch (error) {
      console.error('❌ Error getting today time from Firebase:', error);
      return 0;
    }
  }

  /**
   * Get all-time total from Firebase
   */
  async getAllTimeTotal() {
    try {
      const snapshot = await this.timeTrackingRef
        .child('allTime')
        .child('totalSeconds')
        .once('value');
      
      return snapshot.val() || 0;
    } catch (error) {
      console.error('❌ Error getting all-time total from Firebase:', error);
      return 0;
    }
  }

  // ==========================================
  // FIREBASE SYNC
  // ==========================================

  /**
   * Sync pending time to Firebase
   */
  async syncToFirebase() {
    try {
      const pendingTime = await this.getPendingTime();
      
      if (pendingTime <= 0) {
        console.log('ℹ️ No pending time to sync');
        return;
      }

      console.log(`🔄 Syncing ${pendingTime}s to Firebase...`);

      const today = new Date().toISOString().split('T')[0];
      const now = Date.now();

      // Update daily stats
      const dailyRef = this.timeTrackingRef.child('daily').child(today);
      const dailySnapshot = await dailyRef.once('value');
      const dailyData = dailySnapshot.val() || { totalSeconds: 0, sessions: [] };

      await dailyRef.set({
        totalSeconds: dailyData.totalSeconds + pendingTime,
        date: today,
        lastUpdated: now,
        sessions: [
          ...(dailyData.sessions || []),
          {
            duration: pendingTime,
            timestamp: now,
          }
        ]
      });

      // Update all-time stats
      const allTimeRef = this.timeTrackingRef.child('allTime');
      const allTimeSnapshot = await allTimeRef.once('value');
      const allTimeData = allTimeSnapshot.val() || { totalSeconds: 0 };

      await allTimeRef.update({
        totalSeconds: allTimeData.totalSeconds + pendingTime,
        lastUpdated: now,
      });

      // Update Firestore (if available) - non-blocking
      this.updateFirestore(pendingTime).catch(err => 
        console.warn('⚠️ Firestore sync failed:', err.message)
      );

      // Clear pending time
      await AsyncStorage.setItem(this.STORAGE_KEYS.PENDING_TIME, '0');
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.LAST_SYNC,
        now.toString()
      );

      console.log('✅ Successfully synced to Firebase');
    } catch (error) {
      console.error('❌ Error syncing to Firebase:', error);
      // Don't throw - keep pending time for next sync attempt
    }
  }

  /**
   * Update Firestore with time tracking data
   */
  async updateFirestore(additionalSeconds) {
    try {
      await this.firestoreUserRef.update({
        'timeTracking.totalSeconds': FieldValue.increment(additionalSeconds),
        'timeTracking.lastUpdated': FieldValue.serverTimestamp(),
      });
      console.log('✅ Firestore updated');
    } catch (error) {
      if (error.code !== 'permission-denied') {
        console.error('⚠️ Firestore update error:', error);
      }
      // Fail silently for Firestore - Realtime DB is primary
    }
  }

  // ==========================================
  // RECOVERY & CLEANUP
  // ==========================================

  /**
   * Recover incomplete session (called on app restart)
   */
  async recoverIncompleteSession() {
    try {
      const sessionStart = await AsyncStorage.getItem(
        this.STORAGE_KEYS.SESSION_START
      );

      if (!sessionStart) {
        console.log('ℹ️ No incomplete session to recover');
        return;
      }

      const startTime = parseInt(sessionStart, 10);
      const now = Date.now();
      const duration = Math.floor((now - startTime) / 1000);

      console.log(`🔄 Recovering incomplete session: ${this.formatTime(duration)}`);

      // Save recovered session
      await this.saveSessionDuration(duration);
      await this.syncToFirebase();

      // Clear session start
      await AsyncStorage.removeItem(this.STORAGE_KEYS.SESSION_START);

      console.log('✅ Session recovered successfully');
    } catch (error) {
      console.error('❌ Error recovering session:', error);
    }
  }

  /**
   * Reset all time tracking data
   */
  async resetAllData() {
    try {
      console.log('🗑️ Resetting all time tracking data...');

      // Clear AsyncStorage
      await AsyncStorage.multiRemove([
        this.STORAGE_KEYS.SESSION_START,
        this.STORAGE_KEYS.TOTAL_TIME,
        this.STORAGE_KEYS.LAST_SYNC,
        this.STORAGE_KEYS.PENDING_TIME,
      ]);

      // Reset Firebase (optional - comment out if you want to keep Firebase data)
      // await this.timeTrackingRef.remove();

      // Reset instance state
      this.sessionStartTime = null;
      this.isTracking = false;

      console.log('✅ All time tracking data reset');
    } catch (error) {
      console.error('❌ Error resetting data:', error);
      throw error;
    }
  }

  // ==========================================
  // ANALYTICS & REPORTING
  // ==========================================

  /**
   * Get weekly time tracking data
   */
  async getWeeklyData() {
    try {
      const today = new Date();
      const weekData = [];

      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const snapshot = await this.timeTrackingRef
          .child('daily')
          .child(dateStr)
          .once('value');

        const data = snapshot.val();
        weekData.push({
          date: dateStr,
          totalSeconds: data?.totalSeconds || 0,
          sessions: data?.sessions || [],
        });
      }

      return weekData;
    } catch (error) {
      console.error('❌ Error getting weekly data:', error);
      return [];
    }
  }

  /**
   * Get monthly time tracking data
   */
  async getMonthlyData() {
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');

      const snapshot = await this.timeTrackingRef
        .child('daily')
        .orderByKey()
        .startAt(`${year}-${month}-01`)
        .endAt(`${year}-${month}-31`)
        .once('value');

      const monthlyData = [];
      snapshot.forEach(childSnapshot => {
        monthlyData.push({
          date: childSnapshot.key,
          ...childSnapshot.val(),
        });
      });

      return monthlyData;
    } catch (error) {
      console.error('❌ Error getting monthly data:', error);
      return [];
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Format seconds to HH:MM:SS
   */
  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Format seconds to human-readable string
   */
  formatTimeHuman(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get time tracking status
   */
  getStatus() {
    return {
      isTracking: this.isTracking,
      sessionStartTime: this.sessionStartTime,
      currentSessionDuration: this.getCurrentSessionDuration(),
    };
  }
}