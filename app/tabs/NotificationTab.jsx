import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useTheme from '../../Theme/theme';
import { auth, WaterBottleService } from '../../config/firebaseConfig';
import bleService from '../../services/BLEService';

export default function NotificationTab() {
  const theme = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sensorData, setSensorData] = useState({
    waterLevel: 0,
    temperature: 0,
    lastDrink: null,
    isConnected: false
  });

  const cleanup = () => {
    // Cleanup function: Add any necessary cleanup logic here if you set up listeners/subscriptions
  };

  useEffect(() => {
    // ⚠️ FIX: Correctly call the initialization function and return cleanup
    initializeNotifications();
    // Note: We intentionally avoid setting up a new BLE listener here
    return cleanup;
  }, []);

  const initializeNotifications = async () => {
    setLoading(true);
    try {
      if (auth.currentUser) {
        // Assuming WaterBottleService requires the user's UID to initialize
        const service = new WaterBottleService(auth.currentUser.uid);
        
        // Get today's stats (total consumed, goal)
        const todayStats = await service.getTodayStats();
        
        // Get latest sensor reading
        const latestReading = await service.getLatestReading();
        
        let updatedSensorData = { ...sensorData };
        
        if (latestReading && latestReading.length > 0) {
          const reading = latestReading[0];
          updatedSensorData = {
            waterLevel: reading.waterLevel || 0,
            temperature: reading.temperature || 0,
            // Ensure timestamp is converted to a Date object if it's a Firebase Timestamp
            lastDrink: reading.timestamp?.toDate ? reading.timestamp.toDate() : null,
            isConnected: bleService.isConnected || false // Use current BLE state
          };
          setSensorData(updatedSensorData);
        }

        // Generate notifications based on the latest data
        generateNotifications(todayStats, updatedSensorData);
      }
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      // Optionally add an error notification here
    } finally {
      setLoading(false);
    }
  };

  const generateNotifications = (todayStats, currentSensorData) => {
    const newNotifications = [];
    const now = Date.now();

    // 1. Water Level Notifications
    if (currentSensorData.waterLevel < 25) {
      newNotifications.push({
        id: 'low-water',
        type: 'critical',
        icon: 'water',
        title: 'Bottle Running Low',
        message: 'Your bottle is running low! Time for a refill.',
        timestamp: new Date(),
        priority: 'high',
        actionable: true,
        action: 'refill'
      });
    } else if (currentSensorData.waterLevel < 50) {
      newNotifications.push({
        id: 'half-water',
        type: 'warning',
        icon: 'water-outline',
        title: 'Water Level Medium',
        message: 'Your bottle is half empty. Consider refilling soon.',
        timestamp: new Date(),
        priority: 'medium',
        actionable: false
      });
    }

    // 2. Temperature Notifications
    if (currentSensorData.temperature > 30) {
      newNotifications.push({
        id: 'warm-water',
        type: 'warning',
        icon: 'thermometer-outline',
        title: 'Water Temperature High',
        message: 'Water is quite warm. Consider adding ice for better taste.',
        timestamp: new Date(),
        priority: 'medium',
        actionable: false
      });
    } else if (currentSensorData.temperature < 10) {
      newNotifications.push({
        id: 'cold-water',
        type: 'info',
        icon: 'snow-outline',
        title: 'Refreshingly Cold',
        message: 'Your water is nice and cold! Perfect for hydration.',
        timestamp: new Date(),
        priority: 'low',
        actionable: false
      });
    }

    // 3. Hydration Reminder (If last drink was over 1 hour ago (3,600,000 ms))
    if (currentSensorData.lastDrink && (now - currentSensorData.lastDrink) > 3600000) {
      newNotifications.push({
        id: 'drink-reminder',
        type: 'critical',
        icon: 'time-outline',
        title: 'Hydration Reminder',
        message: "It's been over an hour since your last drink. Stay hydrated!",
        timestamp: new Date(),
        priority: 'high',
        actionable: true,
        action: 'drink'
      });
    }

    // 4. Goal Progress Notifications
    if (todayStats && todayStats.goal > 0) {
      const progressPercent = (todayStats.totalConsumed / todayStats.goal) * 100;
      
      if (progressPercent >= 100) {
        newNotifications.push({
          id: 'goal-achieved',
          type: 'success',
          icon: 'checkmark-circle',
          title: 'Goal Achieved! 🎉',
          message: "Congratulations! You've reached your daily hydration goal!",
          timestamp: new Date(),
          priority: 'high',
          actionable: false
        });
      } else if (progressPercent >= 75 && progressPercent < 100) {
        newNotifications.push({
          id: 'almost-there',
          type: 'info',
          icon: 'trending-up',
          title: 'Almost There!',
          message: `You're ${progressPercent.toFixed(0)}% towards your goal. Keep it up!`,
          timestamp: new Date(),
          priority: 'medium',
          actionable: false
        });
      } else if (progressPercent < 25) {
        newNotifications.push({
          id: 'low-progress',
          type: 'warning',
          icon: 'alert-circle-outline',
          title: 'Low Daily Progress',
          message: 'You haven\'t consumed much water today. Remember to stay hydrated!',
          timestamp: new Date(),
          priority: 'medium',
          actionable: true,
          action: 'drink'
        });
      }
    }

    // 5. Connection Status
    if (!bleService.isConnected) {
      newNotifications.push({
        id: 'disconnected',
        type: 'warning',
        icon: 'bluetooth-outline',
        title: 'Bottle Disconnected',
        message: 'Your smart bottle is not connected. Connect to track your hydration.',
        timestamp: new Date(),
        priority: 'medium',
        actionable: true,
        action: 'connect'
      });
    }

    // Sort by priority (high first) and then by timestamp (newest first)
    newNotifications.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.timestamp.getTime() - a.timestamp.getTime(); // Ensure comparison uses milliseconds
    });

    setNotifications(newNotifications);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await initializeNotifications();
    setRefreshing(false);
  };

  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  // --- Utility Styling Functions ---

  const getNotificationStyle = (type) => {
    switch (type) {
      case 'critical':
        return {
          borderColor: theme.error || '#f44336',
          backgroundColor: `${theme.error || '#f44336'}15` // 15 is 9.8% opacity
        };
      case 'warning':
        return {
          borderColor: theme.warning || '#FF9800',
          backgroundColor: `${theme.warning || '#FF9800'}15`
        };
      case 'success':
        return {
          borderColor: theme.success || '#4CAF50',
          backgroundColor: `${theme.success || '#4CAF50'}15`
        };
      case 'info':
      default:
        return {
          borderColor: theme.primary || '#2196F3',
          backgroundColor: `${theme.primary || '#2196F3'}15`
        };
    }
  };

  const getIconColor = (type) => {
    switch (type) {
      case 'critical':
        return theme.error || '#f44336';
      case 'warning':
        return theme.warning || '#FF9800';
      case 'success':
        return theme.success || '#4CAF50';
      case 'info':
      default:
        return theme.primary || '#2196F3';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Time unknown';
    const now = new Date();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return timestamp.toLocaleDateString();
  };
  
  // --- Render Logic ---

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary || '#2196F3'} />
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>
            Loading notifications...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card || 'white' }]}>
        <View style={styles.headerContent}>
          <Ionicons name="notifications" size={28} color={theme.primary || '#2196F3'} />
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Notifications
          </Text>
        </View>
        {notifications.length > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.error || '#f44336' }]}>
            <Text style={styles.badgeText}>{notifications.length}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary || '#2196F3']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons 
              name="checkmark-circle-outline" 
              size={80} 
              color={theme.success || '#4CAF50'} 
            />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              All Caught Up!
            </Text>
            <Text style={[styles.emptyMessage, { color: theme.textMuted }]}>
              You don't have any notifications right now.
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.textMuted }]}>
              Keep up the great hydration habits! 💧
            </Text>
          </View>
        ) : (
          notifications.map((notification) => (
            <Animated.View
              key={notification.id}
              style={[
                styles.notificationCard,
                getNotificationStyle(notification.type),
                { backgroundColor: theme.card || 'white' }
              ]}
            >
              <View style={styles.notificationContent}>
                <View style={styles.iconContainer}>
                  <Ionicons
                    name={notification.icon}
                    size={24}
                    color={getIconColor(notification.type)}
                  />
                </View>
                
                <View style={styles.textContainer}>
                  <Text style={[styles.notificationTitle, { color: theme.text }]}>
                    {notification.title}
                  </Text>
                  <Text style={[styles.notificationMessage, { color: theme.textMuted }]}>
                    {notification.message}
                  </Text>
                  <Text style={[styles.timestamp, { color: theme.textMuted }]}>
                    {formatTimestamp(notification.timestamp)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={() => dismissNotification(notification.id)}
                >
                  <Ionicons name="close" size={20} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              {notification.actionable && (
                <View style={styles.actionContainer}>
                  <TouchableOpacity
                    style={[styles.actionButton, { borderColor: getIconColor(notification.type) }]}
                    onPress={() => {
                      // Placeholder for action handling (e.g., navigating to refill screen, or marking goal as met)
                      console.log(`Action taken: ${notification.action} for ${notification.id}`);
                      dismissNotification(notification.id); // Dismiss after action
                    }}
                  >
                    <Text style={[styles.actionText, { color: getIconColor(notification.type) }]}>
                      {notification.action === 'refill' ? 'Mark as Refilled' : 
                       notification.action === 'drink' ? 'Remind Me Later' : 
                       notification.action === 'connect' ? 'Go to Settings' : 'Got it'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

// --- Stylesheet ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  notificationCard: {
    borderRadius: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  notificationContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
  },
  dismissButton: {
    padding: 4,
  },
  actionContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});