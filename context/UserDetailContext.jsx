// context/UserDetailContext.jsx - Updated with fallback mechanism

import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, firestore, realtimeDB } from '../config/firebaseConfig';

// Create the UserContext
const UserDetailContext = createContext();

// Custom hook to use the UserContext
export const useUser = () => {
  const context = useContext(UserDetailContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

// UserProvider component
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [useFirestore, setUseFirestore] = useState(true);

  // Convert Realtime DB profile data to Firestore-like format
  const convertRealtimeToFirestoreFormat = (profileData, uid) => {
    return {
      uid: uid,
      name: profileData.name || '',
      email: profileData.email || '',
      member: false,
      profileComplete: true,
      accountStatus: 'active',
      createdAt: profileData.createdAt || null,
      lastLoginAt: null,
      profile: {
        age: profileData.age || 25,
        weight: profileData.weight || 70,
        height: profileData.height || 170,
        gender: profileData.gender || '',
        activityLevel: profileData.activityLevel || 'moderate',
        healthConditions: '',
        medications: '',
      },
      hydrationSettings: {
        dailyWaterGoal: profileData.dailyGoal || 2000,
        wakeUpTime: '07:00',
        bedTime: '22:00',
        reminderInterval: 60,
        notificationsEnabled: true,
        smartReminders: true,
        preferredTemperature: 'room',
      },
      deviceSettings: {
        connectedBottles: [],
        temperatureUnit: 'celsius',
        volumeUnit: 'ml',
        syncEnabled: true,
        bluetoothEnabled: true,
      },
      analytics: {
        totalDaysTracked: 0,
        averageDailyIntake: 0,
        goalAchievementRate: 0,
        preferredDrinkingTimes: [],
        lastBottleSync: null,
      },
      preferences: {
        dataSharing: false,
        healthInsights: true,
        weeklyReports: true,
        friendsFeature: false,
      },
    };
  };

  // Fetch user details from Realtime Database as fallback
  const fetchUserDetailsFromRealtime = async (uid) => {
    try {
      console.log('🔄 Fetching user from Realtime Database...');
      const userSnapshot = await realtimeDB.ref(`users/${uid}/profile`).once('value');
      const profileData = userSnapshot.val();
      
      if (profileData) {
        console.log('✅ User details fetched from Realtime Database');
        const userData = convertRealtimeToFirestoreFormat(profileData, uid);
        setUserDetails(userData);
        return userData;
      } else {
        console.log('⚠️ User not found in Realtime Database either');
        return null;
      }
    } catch (error) {
      console.error('❌ Realtime Database fetch failed:', error);
      throw error;
    }
  };

  // Fetch user details using UID with fallback mechanism
  const fetchUserDetails = async (uid) => {
    try {
      setError(null); // Clear any previous errors

      // Try Firestore first (if we haven't disabled it)
      if (useFirestore) {
        try {
          console.log('🔄 Attempting to fetch user from Firestore...');
          const userDocRef = doc(firestore, 'users', uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            console.log('✅ User details fetched from Firestore');
            const userData = userDoc.data();
            setUserDetails(userData);
            return userData;
          } else {
            console.log('⚠️ User not found in Firestore, trying Realtime Database...');
            return await fetchUserDetailsFromRealtime(uid);
          }
        } catch (firestoreError) {
          console.error('❌ Firestore fetch failed:', firestoreError);
          
          if (firestoreError.code === 'permission-denied') {
            console.log('⚠️ Firestore permissions denied, switching to Realtime Database');
            setUseFirestore(false); // Disable Firestore for this session
            return await fetchUserDetailsFromRealtime(uid);
          } else {
            // For other errors, still try Realtime DB as fallback
            console.log('⚠️ Firestore error, trying Realtime Database as fallback...');
            try {
              return await fetchUserDetailsFromRealtime(uid);
            } catch (realtimeError) {
              // If both fail, throw the original Firestore error
              throw firestoreError;
            }
          }
        }
      } else {
        // Firestore is disabled, go straight to Realtime DB
        return await fetchUserDetailsFromRealtime(uid);
      }
    } catch (error) {
      console.error('❌ Error fetching user details:', error);
      setError('Failed to load user data. Please check your internet connection.');
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        try {
          setLoading(true);
          setError(null);
          
          if (firebaseUser) {
            console.log('🔄 User authenticated:', firebaseUser.uid);
            
            const basicUserData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              emailVerified: firebaseUser.emailVerified,
              phoneNumber: firebaseUser.phoneNumber,
            };

            setUser(basicUserData);
            
            // Fetch additional user details
            await fetchUserDetails(firebaseUser.uid);
          } else {
            console.log('🔄 User signed out');
            setUser(null);
            setUserDetails(null);
            setUseFirestore(true); // Reset Firestore preference for next login
          }
        } catch (error) {
          console.error('❌ Auth state change error:', error);
          setError('Authentication error occurred');
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error('❌ Auth observer error:', error);
        setError('Authentication error occurred');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [useFirestore]);

  const logout = async () => {
    try {
      setLoading(true);
      await signOut(auth);
      setUser(null);
      setUserDetails(null);
      setError(null);
      setUseFirestore(true); // Reset preference
      console.log('✅ User logged out successfully');
    } catch (error) {
      console.error('❌ Error signing out:', error);
      setError('Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  const refreshUserDetails = async () => {
    if (user?.uid) {
      setLoading(true);
      try {
        await fetchUserDetails(user.uid);
      } catch (error) {
        console.error('❌ Error refreshing user details:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const updateUserDetails = (newDetails) => {
    setUserDetails(prevDetails => ({
      ...prevDetails,
      ...newDetails
    }));
  };

  // Clear error function
  const clearError = () => {
    setError(null);
  };

  const value = {
    user,
    userDetails,
    loading,
    error,
    isAuthenticated: !!user,
    logout,
    refreshUserDetails,
    updateUserDetails,
    clearError,
    dataSource: useFirestore ? 'firestore' : 'realtime', // For debugging
  };

  return (
    <UserDetailContext.Provider value={value}>
      {children}
    </UserDetailContext.Provider>
  );
};

export { UserDetailContext };