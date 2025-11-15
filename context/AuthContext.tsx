import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '../config/firebaseConfig';
import { StorageHelper } from '../utils/storage';

const AuthContext = createContext({
  user: null,
  isLoading: true,
  isAuthenticated: false,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Listen to Firebase auth state changes
  useEffect(() => {
    console.log('🔄 Setting up auth listener...');
    
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      console.log('🔄 Auth state changed:', firebaseUser?.email || 'No user');
      
      if (firebaseUser) {
        setUser(firebaseUser);
        console.log('✅ User authenticated and set');
      } else {
        setUser(null);
        console.log('ℹ️ No user authenticated');
      }
      
      setIsLoading(false);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        isLoading, 
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}