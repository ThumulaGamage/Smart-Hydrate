// context/AuthContext.jsx - CORRECT VERSION (Trust Firebase)
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebaseConfig';

const AuthContext = createContext({
  user: null,
  isLoading: true,
  isRehydrating: true,
  isAuthenticated: false,
});

export const useAuth = () => useContext(AuthContext);

const AUTH_USER_KEY = '@auth_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRehydrating, setIsRehydrating] = useState(true);

  useEffect(() => {
    console.log('🔄 Setting up auth listener...');
    
    // IMPORTANT: Don't load from AsyncStorage first
    // Let Firebase be the source of truth
    
    // Listen to Firebase auth state changes
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      console.log('🔄 Auth state changed:', firebaseUser?.email || 'No user');
      
      if (firebaseUser) {
        // User is authenticated by Firebase
        const userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified,
          phoneNumber: firebaseUser.phoneNumber,
        };
        
        setUser(userData);
        
        // Save to AsyncStorage for reference
        try {
          await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
          console.log('💾 User saved to AsyncStorage:', userData.email);
        } catch (error) {
          console.error('❌ Error saving to storage:', error);
        }
        
        console.log('✅ User authenticated');
      } else {
        // No user - clear everything
        setUser(null);
        
        try {
          await AsyncStorage.removeItem(AUTH_USER_KEY);
          console.log('🗑️ Cleared AsyncStorage');
        } catch (error) {
          console.error('❌ Error clearing storage:', error);
        }
        
        console.log('ℹ️ No user authenticated');
      }
      
      setIsLoading(false);
      setIsRehydrating(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        isLoading,
        isRehydrating,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}