// context/UserDetailContext.jsx - Updated with Time Tracking Integration

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, firestore, realtimeDB, WaterBottleService, FieldValue } from '../config/firebaseConfig';
import { TimeTrackingService } from '../services/TimeTrackingService';

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
  const [timeTrackingService, setTimeTrackingService] = useState(null);

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
      // Time tracking data placeholder
      timeTracking: {
        totalSeconds: 0,
        lastUpdated: null,
      },
    };
  };

  // Initialize time tracking service for user
  const initializeTimeTracking = async (uid) => {
    try {
      console.log('⏱️ Initializing time tracking for user:', uid);
      const service = new TimeTrackingService(uid);
      
      // Recover any incomplete session
      await service.recoverIncompleteSession();
      
      // Start new session
      await service.startSession();
      
      setTimeTrackingService(service);
      console.log('✅ Time tracking initialized successfully');
      
      return service;
    } catch (error) {
      console.error('❌ Failed to initialize time tracking:', error);
      return null;
    }
  };

  // Cleanup time tracking on logout
  const cleanupTimeTracking = async () => {
    if (timeTrackingService) {
      try {
        console.log('⏱️ Cleaning up time tracking...');
        await timeTrackingService.endSession();
        setTimeTrackingService(null);
        console.log('✅ Time tracking cleaned up');
      } catch (error) {
        console.error('❌ Error cleaning up time tracking:', error);
      }
    }
  };

  // Fetch user details from Realtime Database as fallback
  const fetchUserDetailsFromRealtime = async (uid) => {
    try {
      console.log('Fetching user from Realtime Database...');
      const userSnapshot = await realtimeDB.ref(`users/${uid}/profile`).once('value');
      const profileData = userSnapshot.val();
      
      if (profileData) {
        console.log('User details fetched from Realtime Database');
        const userData = convertRealtimeToFirestoreFormat(profileData, uid);
        setUserDetails(userData);
        return userData;
      } else {
        console.log('User not found in Realtime Database either');
        return null;
      }
    } catch (error) {
      console.error('Realtime Database fetch failed:', error);
      throw error;
    }
  };

  // Fetch user details using UID with fallback mechanism
  const fetchUserDetails = async (uid) => {
    try {
      setError(null);

      // Try Firestore first (if we haven't disabled it)
      if (useFirestore) {
        try {
          console.log('Attempting to fetch user from Firestore...');
          const userDocRef = firestore.collection('users').doc(uid);
          const userDoc = await userDocRef.get();
          
          if (userDoc.exists) {
            console.log('User details fetched from Firestore');
            const userData = userDoc.data();
            setUserDetails(userData);
            
            // Update last login time
            userDocRef.update({
              lastLoginAt: FieldValue.serverTimestamp(),
            }).catch(err => console.warn('Could not update lastLoginAt:', err));
            
            return userData;
          } else {
            console.log('User not found in Firestore, trying Realtime Database...');
            return await fetchUserDetailsFromRealtime(uid);
          }
        } catch (firestoreError) {
          console.error('Firestore fetch failed:', firestoreError);
          
          if (firestoreError.code === 'permission-denied') {
            console.log('Firestore permissions denied, switching to Realtime Database');
            setUseFirestore(false);
            return await fetchUserDetailsFromRealtime(uid);
          } else {
            console.log('Firestore error, trying Realtime Database as fallback...');
            try {
              return await fetchUserDetailsFromRealtime(uid);
            } catch (realtimeError) {
              throw firestoreError;
            }
          }
        }
      } else {
        return await fetchUserDetailsFromRealtime(uid);
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
      setError('Failed to load user data. Please check your internet connection.');
      return null;
    }
  };

  // Updated updateUserDetails method with proper Firebase compat SDK
  const updateUserDetails = async (newDetails) => {
    try {
      if (!auth.currentUser) {
        throw new Error('No authenticated user');
      }

      const uid = auth.currentUser.uid;
      let firestoreSuccess = false;
      let realtimeSuccess = false;
      let authSuccess = false;

      console.log('Starting profile update for user:', uid);

      // Handle email update (compat SDK)
      if (newDetails.newEmail && newDetails.currentPassword) {
        try {
          console.log('Updating email...');
          const credential = auth.EmailAuthProvider.credential(
            auth.currentUser.email,
            newDetails.currentPassword
          );
          await auth.currentUser.reauthenticateWithCredential(credential);
          await auth.currentUser.updateEmail(newDetails.newEmail);
          console.log('Email updated successfully');
          authSuccess = true;
        } catch (error) {
          console.error('Email update failed:', error);
          throw new Error('Email update failed: ' + error.message);
        }
      }

      // Handle password update (compat SDK)
      if (newDetails.newPassword && newDetails.currentPassword) {
        try {
          console.log('Updating password...');
          const credential = auth.EmailAuthProvider.credential(
            auth.currentUser.email,
            newDetails.currentPassword
          );
          await auth.currentUser.reauthenticateWithCredential(credential);
          await auth.currentUser.updatePassword(newDetails.newPassword);
          console.log('Password updated successfully');
          authSuccess = true;
        } catch (error) {
          console.error('Password update failed:', error);
          throw new Error('Password update failed: ' + error.message);
        }
      }

      // Handle display name update (compat SDK)
      if (newDetails.name && newDetails.name !== auth.currentUser.displayName) {
        try {
          await auth.currentUser.updateProfile({ displayName: newDetails.name });
          console.log('Display name updated successfully');
          authSuccess = true;
        } catch (error) {
          console.error('Display name update failed:', error);
        }
      }

      // Prepare update data for databases
      const profileUpdateData = {
        name: newDetails.name,
        email: newDetails.newEmail || auth.currentUser.email,
        lastUpdated: new Date().toISOString(),
      };

      // Only include these fields if they're provided
      if (newDetails.age !== null && newDetails.age !== undefined) {
        profileUpdateData.age = newDetails.age;
      }
      if (newDetails.gender) {
        profileUpdateData.gender = newDetails.gender;
      }
      if (newDetails.height !== null && newDetails.height !== undefined) {
        profileUpdateData.height = newDetails.height;
      }
      if (newDetails.weight !== null && newDetails.weight !== undefined) {
        profileUpdateData.weight = newDetails.weight;
      }

      // Update Firestore (if available)
      if (useFirestore) {
        try {
          console.log('Updating Firestore...');
          const userDocRef = firestore.collection('users').doc(uid);
          
          const firestoreUpdateData = {
            name: profileUpdateData.name,
            email: profileUpdateData.email,
            'profile.age': profileUpdateData.age,
            'profile.gender': profileUpdateData.gender,
            'profile.height': profileUpdateData.height,
            'profile.weight': profileUpdateData.weight,
            lastLoginAt: FieldValue.serverTimestamp(),
          };

          // Remove undefined values
          Object.keys(firestoreUpdateData).forEach(key => {
            if (firestoreUpdateData[key] === undefined) {
              delete firestoreUpdateData[key];
            }
          });

          await userDocRef.update(firestoreUpdateData);
          firestoreSuccess = true;
          console.log('Firestore updated successfully');
        } catch (error) {
          console.error('Firestore update failed:', error);
          if (error.code === 'permission-denied') {
            console.log('Firestore permissions denied, continuing with Realtime DB only');
            setUseFirestore(false);
          }
        }
      }

      // Update Realtime Database (WaterBottleService profile)
      try {
        console.log('Updating Realtime Database...');
        const waterBottleService = new WaterBottleService(uid);
        
        // Get current profile to merge with new data
        const currentProfile = await waterBottleService.getUserProfile();
        
        const realtimeUpdateData = {
          ...currentProfile,
          ...profileUpdateData,
          updatedAt: Date.now(),
        };

        await realtimeDB.ref(`users/${uid}/profile`).update(realtimeUpdateData);
        realtimeSuccess = true;
        console.log('Realtime Database updated successfully');
      } catch (error) {
        console.error('Realtime Database update failed:', error);
        if (!firestoreSuccess) {
          throw error;
        }
      }

      // Update local state
      setUserDetails(prevDetails => ({
        ...prevDetails,
        name: profileUpdateData.name,
        email: profileUpdateData.email,
        profile: {
          ...prevDetails?.profile,
          age: profileUpdateData.age || prevDetails?.profile?.age,
          gender: profileUpdateData.gender || prevDetails?.profile?.gender,
          height: profileUpdateData.height || prevDetails?.profile?.height,
          weight: profileUpdateData.weight || prevDetails?.profile?.weight,
        },
      }));

      console.log('Profile update completed successfully');
      return {
        firestoreSuccess,
        realtimeSuccess,
        authSuccess,
        message: 'Profile updated successfully'
      };

    } catch (error) {
      console.error('Error updating user details:', error);
      throw error;
    }
  };

  useEffect(() => {
    console.log('👤 UserDetailContext: Setting up auth listener...');
    
    const unsubscribe = auth.onAuthStateChanged(
      async (firebaseUser) => {
        try {
          setLoading(true);
          setError(null);
          
          if (firebaseUser) {
            console.log('👤 UserDetailContext: User authenticated:', firebaseUser.uid);
            
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
            
            // Initialize time tracking
            await initializeTimeTracking(firebaseUser.uid);
          } else {
            console.log('👤 UserDetailContext: User signed out');
            
            // Cleanup time tracking before clearing user
            await cleanupTimeTracking();
            
            setUser(null);
            setUserDetails(null);
            setUseFirestore(true);
          }
        } catch (error) {
          console.error('👤 UserDetailContext: Auth state change error:', error);
          setError('Authentication error occurred');
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error('👤 UserDetailContext: Auth observer error:', error);
        setError('Authentication error occurred');
        setLoading(false);
      }
    );

    return () => {
      console.log('👤 UserDetailContext: Cleaning up auth listener');
      cleanupTimeTracking();
      unsubscribe();
    };
  }, [useFirestore]);

  const logout = async () => {
    try {
      setLoading(true);
      
      // End time tracking session before logout
      await cleanupTimeTracking();
      
      await auth.signOut();
      setUser(null);
      setUserDetails(null);
      setError(null);
      setUseFirestore(true);
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
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
        console.error('Error refreshing user details:', error);
      } finally {
        setLoading(false);
      }
    }
  };

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
    dataSource: useFirestore ? 'firestore' : 'realtime',
    timeTrackingService, // Expose time tracking service
  };

  return (
    <UserDetailContext.Provider value={value}>
      {children}
    </UserDetailContext.Provider>
  );
};

export { UserDetailContext };