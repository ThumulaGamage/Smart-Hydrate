import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext'; // Use our new AuthContext
import { useUser } from '../context/UserDetailContext';
import Colors from '../constant/Colors';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

export default function AuthGuard({ children }) {
  const { user, isLoading: authLoading } = useAuth(); // Use AuthContext for auth state
  const { loading: userLoading } = useUser();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const themeColors = {
    background: isDarkMode ? Colors.DARK_BACKGROUND : Colors.WHITE,
    text: isDarkMode ? Colors.WHITE : Colors.DARK_TEXT,
    accent: isDarkMode ? Colors.GREEN_LIGHT : Colors.GREEN_DARK,
  };

  const loading = authLoading || userLoading;

  useEffect(() => {
    if (!authLoading && !user) {
      // Prevent redirect if already on auth page
      if (!router.pathname?.startsWith('/auth')) {
        console.log('🔒 AuthGuard: No user, redirecting to sign in');
        router.replace('/auth/signIn');
      }
    }
  }, [authLoading, user, router.pathname]);

  if (loading) {
    return (
      <Animated.View 
        style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
      >
        <ActivityIndicator 
          size="large" 
          color={themeColors.accent} 
          style={styles.spinner}
        />
        <Text style={[styles.loadingText, { color: themeColors.text }]}>
          Loading your session...
        </Text>
      </Animated.View>
    );
  }

  if (!user) {
    return null; // Let the navigation handle the redirect
  }

  return children;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    transform: [{ scale: 1.3 }],
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '500',
  },
});