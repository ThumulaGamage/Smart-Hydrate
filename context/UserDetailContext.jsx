import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../config/firebaseConfig';

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

  // ✅ Updated: fetch user details using UID instead of email
  const fetchUserDetails = async (uid) => {
    try {
      const userDocRef = doc(db, 'users', uid); // using UID now
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserDetails(userData);
        return userData;
      } else {
        console.log('No user document found in Firestore');
        return null;
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
      setError(error.message);
      return null;
    }
  };

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
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

          // ✅ Updated: fetch details using UID
          await fetchUserDetails(firebaseUser.uid);
        } else {
          setUser(null);
          setUserDetails(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Auth state change error:', error);
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
      console.log('✅ User signed out successfully');
    } catch (error) {
      console.error('❌ Error signing out:', error);
      setError(error.message);
    }
  };

  const refreshUserDetails = async () => {
    if (user?.uid) {
      await fetchUserDetails(user.uid); // ✅ use UID
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
    logout,
    refreshUserDetails,
    updateUserDetails,
    isAuthenticated: !!user,
  };

  return (
    <UserDetailContext.Provider value={value}>
      {children}
    </UserDetailContext.Provider>
  );
};

export { UserDetailContext };

