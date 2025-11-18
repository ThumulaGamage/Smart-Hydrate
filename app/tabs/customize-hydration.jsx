import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase, ref, onValue } from 'firebase/database';

// Import auth from your existing Firebase config
import { auth } from '../../config/firebaseConfig';

// Import the component for the Healthy tab
import HealthyHydrationPlan from './HealthyHydrationPlan';

// Import the component for the Disease tab
import DiseaseHydrationPlan from './DiseaseHydrationPlan';

// --- Built-in Theme (No external imports needed) ---
const lightTheme = {
  background: '#FFFFFF',
  card: '#F5F5F5',
  text: '#000000',
  secondaryText: '#6B7280',
  border: '#E5E7EB',
  icon: '#6B7280',
};

const darkTheme = {
  background: '#000000',
  card: '#1C1C1E',
  text: '#FFFFFF',
  secondaryText: '#8E8E93',
  border: '#38383A',
  icon: '#8E8E93',
};

// --- Global Variables ---
export let database;
export let isAuthReady = false;
export let currentUserId = null;

// Initialize Realtime Database using your existing Firebase app
try {
  database = getDatabase(auth.app);
  console.log('Realtime Database initialized successfully');
} catch (e) {
  console.error("Failed to initialize Realtime Database:", e);
}

// --- Global Context & Utilities (EXPORTED for HealthyHydrationPlan.jsx) ---
export const AVAILABLE_GAPS = [2, 3, 4];
export const WAKING_HOURS = 16;

export const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- Authentication Handler ---
const useFirebaseAuth = () => {
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        currentUserId = user.uid;
        isAuthReady = true;
        console.log('User authenticated:', user.uid);
        setAuthLoading(false);
      } else {
        console.log('No user authenticated');
        currentUserId = null;
        isAuthReady = false;
        setAuthLoading(false);
      }
    });

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  return authLoading;
};

// --- Main App Component (Tab Navigator) ---
export default function App() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  const [activeTab, setActiveTab] = useState('Healthy');
  const [userId, setUserId] = useState(null);
  const [healthyPlanActive, setHealthyPlanActive] = useState(false);
  const [diseasePlanActive, setDiseasePlanActive] = useState(false);
  const authLoading = useFirebaseAuth();

  // Listen to user authentication
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
        checkActivePlans(user.uid);
      } else {
        setUserId(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Check which plans are active
  const checkActivePlans = (uid) => {
    // Check healthy plan
    const healthyRef = ref(database, `users/${uid}/profile`);
    onValue(healthyRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setHealthyPlanActive(data.planEnabled === true && data.dailyGoal > 0);
      } else {
        setHealthyPlanActive(false);
      }
    });

    // Check disease plan
    const diseaseRef = ref(database, `users/${uid}/diseaseProfile`);
    onValue(diseaseRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setDiseasePlanActive(data.planEnabled === true && data.dailyGoal > 0);
      } else {
        setDiseasePlanActive(false);
      }
    });
  };

  // Handle tab change with conflict detection
  const handleTabChange = (tab) => {
    if (tab === 'Disease' && healthyPlanActive) {
      Alert.alert(
        "⚠️ Healthy Plan Active",
        "You have an active Healthy Hydration Plan. Only one plan can be active at a time.\n\nWould you like to disable your Healthy plan before enabling the Disease plan?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Switch to Disease Plan",
            onPress: () => setActiveTab(tab)
          }
        ]
      );
    } else if (tab === 'Healthy' && diseasePlanActive) {
      Alert.alert(
        "⚠️ Disease Plan Active",
        "You have an active Disease Hydration Plan. Only one plan can be active at a time.\n\nWould you like to disable your Disease plan before enabling the Healthy plan?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Switch to Healthy Plan",
            onPress: () => setActiveTab(tab)
          }
        ]
      );
    } else {
      setActiveTab(tab);
    }
  };

  return (
    <View style={[styles.appContainer, { backgroundColor: theme.background }]}>
      {/* Header / Title */}
      <View style={[styles.headerContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
          <Text style={[styles.appTitle, { color: theme.text }]}>Customize Hydration</Text>

          {/* Active Plan Indicator */}
          {(healthyPlanActive || diseasePlanActive) && (
            <View style={[styles.activeIndicator, {
              backgroundColor: healthyPlanActive
                ? 'rgba(13, 148, 136, 0.2)'
                : 'rgba(220, 38, 38, 0.2)'
            }]}>
              <Text style={styles.activeIndicatorText}>
                {healthyPlanActive && '💚 Healthy Plan Active'}
                {diseasePlanActive && '❤️ Disease Plan Active'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabBar, {
        backgroundColor: theme.card,
        borderBottomColor: theme.border
      }]}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            { borderBottomColor: activeTab === 'Healthy' ? '#0D9488' : 'transparent' }
          ]}
          onPress={() => handleTabChange('Healthy')}
        >
          <Ionicons
            name="heart"
            size={20}
            color={activeTab === 'Healthy' ? '#0D9488' : theme.secondaryText}
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'Healthy' ? '#0D9488' : theme.secondaryText }
          ]}>
            Healthy People
          </Text>
          {healthyPlanActive && <View style={[styles.activeDot, { backgroundColor: '#0D9488' }]} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            { borderBottomColor: activeTab === 'Disease' ? '#DC2626' : 'transparent' }
          ]}
          onPress={() => handleTabChange('Disease')}
        >
          <Ionicons
            name="medkit"
            size={20}
            color={activeTab === 'Disease' ? '#DC2626' : theme.secondaryText}
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'Disease' ? '#DC2626' : theme.secondaryText }
          ]}>
            People with Disease
          </Text>
          {diseasePlanActive && <View style={[styles.activeDot, { backgroundColor: '#DC2626' }]} />}
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        {authLoading ? (
          <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
            <ActivityIndicator size="large" color="#0D9488" />
            <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
              Loading...
            </Text>
          </View>
        ) : (
          activeTab === 'Healthy' ? <HealthyHydrationPlan /> : <DiseaseHydrationPlan />
        )}
      </View>
    </View>
  );
}

// --- Stylesheet ---
const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
  },
  headerContainer: {
    paddingTop: 50,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  activeIndicator: {
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeIndicatorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderBottomWidth: 3,
    position: 'relative',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  activeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  contentArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
});