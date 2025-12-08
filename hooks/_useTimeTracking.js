// hooks/useTimeTracking.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { TimeTrackingService } from '../services/TimeTrackingService';
import { useUser } from '../context/UserDetailContext';

/**
 * Custom hook for time tracking
 * Automatically handles app state changes and user authentication
 */
const useTimeTracking = () => {
  const { user, isAuthenticated } = useUser();
  const [totalTime, setTotalTime] = useState(0);
  const [sessionTime, setSessionTime] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const timeTrackingService = useRef(null);
  const updateInterval = useRef(null);
  const appState = useRef(AppState.currentState);

  // Initialize service when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user?.uid) {
      console.log('⏱️ Initializing TimeTrackingService for user:', user.uid);
      
      try {
        timeTrackingService.current = new TimeTrackingService(user.uid);
        initializeTracking();
      } catch (error) {
        console.error('❌ Failed to initialize time tracking:', error);
      }
    } else {
      console.log('ℹ️ User not authenticated, skipping time tracking initialization');
      cleanupTracking();
    }

    return () => {
      cleanupTracking();
    };
  }, [isAuthenticated, user?.uid]);

  // Initialize tracking
  const initializeTracking = async () => {
    if (!timeTrackingService.current) return;

    try {
      // Recover any incomplete session
      await timeTrackingService.current.recoverIncompleteSession();

      // Load total time
      const total = await timeTrackingService.current.getTotalTime();
      setTotalTime(total);

      // Start new session
      await timeTrackingService.current.startSession();
      setIsTracking(true);

      // Start update interval
      startUpdateInterval();

      console.log('✅ Time tracking initialized');
    } catch (error) {
      console.error('❌ Error initializing tracking:', error);
    }
  };

  // Start update interval (updates session time every second)
  const startUpdateInterval = () => {
    if (updateInterval.current) {
      clearInterval(updateInterval.current);
    }

    updateInterval.current = setInterval(() => {
      if (timeTrackingService.current) {
        const currentSession = timeTrackingService.current.getCurrentSessionDuration();
        setSessionTime(currentSession);
      }
    }, 1000);
  };

  // Stop update interval
  const stopUpdateInterval = () => {
    if (updateInterval.current) {
      clearInterval(updateInterval.current);
      updateInterval.current = null;
    }
  };

  // Cleanup tracking
  const cleanupTracking = async () => {
    stopUpdateInterval();

    if (timeTrackingService.current && isTracking) {
      try {
        const duration = await timeTrackingService.current.endSession();
        const newTotal = totalTime + duration;
        setTotalTime(newTotal);
        setSessionTime(0);
        setIsTracking(false);
        console.log('✅ Session ended during cleanup');
      } catch (error) {
        console.error('❌ Error during cleanup:', error);
      }
    }

    timeTrackingService.current = null;
  };

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isTracking, totalTime]);

  const handleAppStateChange = async (nextAppState) => {
    if (!timeTrackingService.current) return;

    console.log('📱 App state change:', appState.current, '→', nextAppState);

    // App going to background
    if (
      appState.current.match(/active/) &&
      nextAppState.match(/inactive|background/)
    ) {
      console.log('📱 App going to background - saving session');
      stopUpdateInterval();

      try {
        const duration = await timeTrackingService.current.endSession();
        const newTotal = totalTime + duration;
        setTotalTime(newTotal);
        setSessionTime(0);
        setIsTracking(false);
        console.log('✅ Session saved before background');
      } catch (error) {
        console.error('❌ Error saving session on background:', error);
      }
    }
    // App coming to foreground
    else if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      console.log('📱 App coming to foreground - starting new session');

      try {
        // Reload total time
        const total = await timeTrackingService.current.getTotalTime();
        setTotalTime(total);

        // Start new session
        await timeTrackingService.current.startSession();
        setIsTracking(true);
        startUpdateInterval();
        console.log('✅ New session started on foreground');
      } catch (error) {
        console.error('❌ Error starting session on foreground:', error);
      }
    }

    appState.current = nextAppState;
  };

  // Manual sync to Firebase
  const syncToFirebase = useCallback(async () => {
    if (!timeTrackingService.current) return;

    try {
      await timeTrackingService.current.syncToFirebase();
      setLastSync(new Date());
      console.log('✅ Manual sync completed');
    } catch (error) {
      console.error('❌ Manual sync failed:', error);
      throw error;
    }
  }, []);

  // Reset all time tracking
  const resetTimeTracking = useCallback(async () => {
    if (!timeTrackingService.current) return;

    try {
      await timeTrackingService.current.resetAllData();
      setTotalTime(0);
      setSessionTime(0);
      setLastSync(null);
      
      // Restart tracking
      if (isAuthenticated && user?.uid) {
        await timeTrackingService.current.startSession();
        setIsTracking(true);
        startUpdateInterval();
      }
      
      console.log('✅ Time tracking reset');
    } catch (error) {
      console.error('❌ Reset failed:', error);
      throw error;
    }
  }, [isAuthenticated, user?.uid]);

  // Get today's time from Firebase
  const getTodayTime = useCallback(async () => {
    if (!timeTrackingService.current) return 0;

    try {
      return await timeTrackingService.current.getTodayTime();
    } catch (error) {
      console.error('❌ Error getting today time:', error);
      return 0;
    }
  }, []);

  // Get weekly data
  const getWeeklyData = useCallback(async () => {
    if (!timeTrackingService.current) return [];

    try {
      return await timeTrackingService.current.getWeeklyData();
    } catch (error) {
      console.error('❌ Error getting weekly data:', error);
      return [];
    }
  }, []);

  // Format time helper
  const formatTime = useCallback((seconds) => {
    if (!timeTrackingService.current) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return timeTrackingService.current.formatTime(seconds);
  }, []);

  // Format time human-readable
  const formatTimeHuman = useCallback((seconds) => {
    if (!timeTrackingService.current) {
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
    return timeTrackingService.current.formatTimeHuman(seconds);
  }, []);

  return {
    // Time values (in seconds)
    totalTime,           // Total time from previous sessions
    sessionTime,         // Current session time
    combinedTime: totalTime + sessionTime, // Total + current session
    
    // Status
    isTracking,
    lastSync,
    
    // Methods
    syncToFirebase,
    resetTimeTracking,
    getTodayTime,
    getWeeklyData,
    formatTime,
    formatTimeHuman,
  };
};

// Export as both default and named export for flexibility
export default useTimeTracking;
export { useTimeTracking };