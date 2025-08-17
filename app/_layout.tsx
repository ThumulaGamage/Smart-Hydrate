import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { UserProvider, useUser } from "../context/UserDetailContext";
import { StorageHelper } from "../utils/storage";

function RootLayoutNav() {
  const [isCheckingFirstTime, setIsCheckingFirstTime] = useState(true);
  const [isFirstTime, setIsFirstTime] = useState(true);
  
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, loading } = useUser();

  // Check if it's first time user when app starts
  useEffect(() => {
    checkFirstTimeUser();
  }, []);

  // Re-check first time status when authentication state changes
  useEffect(() => {
    if (isAuthenticated) {
      checkFirstTimeUser();
    }
  }, [isAuthenticated]);

  // Handle navigation based on auth state and first time status
  useEffect(() => {
    if (!loading && !isCheckingFirstTime) {
      const currentRoute = segments?.[0] as string;
      const inAuthGroup = currentRoute === 'auth';
      const onHomepage = currentRoute === 'homepage';
      const onWelcome = currentRoute === '(welcome)';

      console.log('🔄 Navigation check:', {
        isFirstTime,
        isAuthenticated,
        currentPath: segments.join('/'),
        inAuthGroup,
        onHomepage,
        onWelcome
      });

      if (isAuthenticated) {
        if (isFirstTime && !onWelcome) {
          console.log('🔄 First time authenticated user - redirecting to welcome');
          router.replace('/');
        } else if (!isFirstTime && !onHomepage) {
          console.log('🔄 Authenticated user - redirecting to homepage');
          router.replace('/homepage');
        }
      } else if (!inAuthGroup && !onWelcome) {
        console.log('🔄 Not authenticated - redirecting to sign in');
        router.replace('/auth/signIn');
      }
    }
  }, [isAuthenticated, isFirstTime, loading, isCheckingFirstTime, segments]);

  const checkFirstTimeUser = async () => {
    try {
      const isFirstTimeUser = await StorageHelper.isFirstTimeUser();
      console.log('📱 Is first time user:', isFirstTimeUser);
      
      // If authenticated, it's not first time anymore
      setIsFirstTime(isAuthenticated ? false : isFirstTimeUser);
    } catch (error) {
      console.error('Error checking first time user:', error);
      setIsFirstTime(true);
    } finally {
      setIsCheckingFirstTime(false);
    }
  };

  const completeOnboarding = async () => {
    try {
      await StorageHelper.setFirstTimeUser(false);
      setIsFirstTime(false);
      router.replace('/homepage');
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  // Show loading while checking auth and first time status
  if (loading || isCheckingFirstTime) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066CC" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(welcome)" />
      <Stack.Screen name="auth/signIn" />
      <Stack.Screen name="auth/signUp" />
      <Stack.Screen name="homepage" />
    </Stack>
  );
}

export default function Layout() {
  return (
    <UserProvider>
      <RootLayoutNav />
    </UserProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgb(16, 26, 83)',
  },
});