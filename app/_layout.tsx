// app/_layout.tsx - Updated with Rehydration Check

import { useState, useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { UserProvider } from "../context/UserDetailContext";
import { AuthProvider, useAuth } from "../context/AuthContext";
import LoadingScreen from "../components/loading";

function RootLayoutNav() {
  const { user, isLoading, isRehydrating } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // 🔑 KEY FIX: Wait for BOTH loading AND rehydration to complete
    if (isLoading || isRehydrating) {
      console.log('⏳ Waiting for auth to rehydrate...', { isLoading, isRehydrating });
      return;
    }

    console.log('🔍 Auth rehydrated. User:', user?.uid || 'None');

    const firstSegment = segments[0];
    const inAuthGroup = firstSegment === 'auth';
    const onIndexPage = firstSegment === undefined;

    if (user && (inAuthGroup || onIndexPage)) {
      // User is logged in but on index or auth pages, redirect to homepage
      console.log('🔀 Redirecting authenticated user to homepage');
      router.replace('/homepage');
    } else if (!user && !inAuthGroup && !onIndexPage) {
      // User is not logged in and not on index/auth pages, redirect to index
      console.log('🔀 Redirecting unauthenticated user to index');
      router.replace('/');
    }
  }, [user, segments, isLoading, isRehydrating]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/signIn" />
      <Stack.Screen name="auth/signUp" />
      <Stack.Screen name="homepage" />
    </Stack>
  );
}

export default function Layout() {
  const [isAppReady, setIsAppReady] = useState(false);

  if (!isAppReady) {
    return <LoadingScreen onFinish={() => setIsAppReady(true)} />;
  }

  return (
    <AuthProvider>
      <UserProvider>
        <RootLayoutNav />
      </UserProvider>
    </AuthProvider>
  );
}