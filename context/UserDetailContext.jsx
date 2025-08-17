import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../config/firebaseConfig';
import { StorageHelper } from '../utils/storage';

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
  const [isFirstTime, setIsFirstTime] = useState(true);

  // Fetch user details using UID
  const fetchUserDetails = async (uid) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserDetails(userData);
        return userData;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user details:', error);
      setError('Failed to load user data');
      return null;
    }
  };

  // Check if first time user
  const checkFirstTimeUser = async () => {
    try {
      const isFirstTimeUser = await StorageHelper.isFirstTimeUser();
      setIsFirstTime(isFirstTimeUser);
      return isFirstTimeUser;
    } catch (error) {
      console.error('Error checking first time status:', error);
      return true;
    }
  };

  // Mark user as not first time
  const setNotFirstTimeUser = async () => {
    try {
      await StorageHelper.setNotFirstTimeUser();
      setIsFirstTime(false);
    } catch (error) {
      console.error('Error setting first time status:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        try {
          setLoading(true);
          
          if (firebaseUser) {
            const basicUserData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              emailVerified: firebaseUser.emailVerified,
              phoneNumber: firebaseUser.phoneNumber,
            };

            setUser(basicUserData);
            await fetchUserDetails(firebaseUser.uid);
            await checkFirstTimeUser();
          } else {
            setUser(null);
            setUserDetails(null);
          }
        } catch (error) {
          console.error('Auth state change error:', error);
          setError(error.message);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error('Auth observer error:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserDetails(null);
    } catch (error) {
      console.error('Error signing out:', error);
      setError(error.message);
    }
  };

  const refreshUserDetails = async () => {
    if (user?.uid) {
      await fetchUserDetails(user.uid);
    }
  };

  const updateUserDetails = (newDetails) => {
    setUserDetails(prevDetails => ({
      ...prevDetails,
      ...newDetails
    }));
  };

  const value = {
    user,
    userDetails,
    loading,
    error,
    isFirstTime,
    isAuthenticated: !!user,
    logout,
    refreshUserDetails,
    updateUserDetails,
    setNotFirstTimeUser,
    checkFirstTimeUser
  };

  return (
    <UserDetailContext.Provider value={value}>
      {children}
    </UserDetailContext.Provider>
  );
};

export { UserDetailContext };