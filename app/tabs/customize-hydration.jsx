import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase } from 'firebase/database';

// Import auth from your existing Firebase config
import { auth } from '../../config/firebaseConfig';

// Import the component for the Healthy tab
import HealthyHydrationPlan from './HealthyHydrationPlan';

// Import the component for the Disease taba
import DiseaseHydrationPlan from './DiseaseHydrationPlan';

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
export const theme = {
  primary: '#1D4ED8', // Indigo 700
  secondary: '#1F2937', // Gray 800
  background: '#0F172A', // Slate 900
  card: '#1F2937', // Gray 800
  primaryText: '#FFFFFF',
  secondaryText: '#D1D5DB', // Gray 300
  accent: '#0D9488', // Teal 600
  danger: '#DC2626', // Red 600
};

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
    // Use existing auth from firebaseConfig
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
  const [activeTab, setActiveTab] = useState('Healthy');
  const authLoading = useFirebaseAuth();

  return (
    <View style={[styles.appContainer, { backgroundColor: theme.background }]}>
      {/* Header / Title */}
      <View style={styles.header}>
        <Text style={[styles.appTitle, { color: theme.primaryText }]}>Customize Hydration</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            { borderBottomColor: activeTab === 'Healthy' ? theme.accent : 'transparent' }
          ]}
          onPress={() => setActiveTab('Healthy')}
        >
          <Ionicons name="heart" size={20} color={activeTab === 'Healthy' ? theme.accent : theme.secondaryText} />
          <Text style={[styles.tabText, { color: activeTab === 'Healthy' ? theme.accent : theme.secondaryText }]}>
            Healthy People
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            { borderBottomColor: activeTab === 'Disease' ? theme.danger : 'transparent' }
          ]}
          onPress={() => setActiveTab('Disease')}
        >
          <Ionicons name="medkit" size={20} color={activeTab === 'Disease' ? theme.danger : theme.secondaryText} />
          <Text style={[styles.tabText, { color: activeTab === 'Disease' ? theme.danger : theme.secondaryText }]}>
            People with Disease
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        {authLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Loading...</Text>
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
  header: {
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: theme.secondary,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.secondary,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderBottomWidth: 3,
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  contentArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
});