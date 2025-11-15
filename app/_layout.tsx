 // app/_layout.tsx

import { useState, useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { UserProvider } from "../context/UserDetailContext";
import { AuthProvider, useAuth } from "../context/AuthContext";
import LoadingScreen from "../components/loading";

function RootLayoutNav() {


  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const firstSegment = segments[0];
    const inAuthGroup = firstSegment === 'auth';
    // useSegments can have a literal length type (e.g. 1 | 2), so avoid comparing to 0
    // treat the index page as the root (no first segment)
    const onIndexPage = firstSegment === undefined;

    if (user && (inAuthGroup || onIndexPage)) {
      // User is logged in but on index or auth pages, redirect to homepage
      router.replace('/homepage');
    } else if (!user && !inAuthGroup && !onIndexPage) {
      // User is not logged in and not on index/auth pages, redirect to index
      router.replace('/');
    }
  }, [user, segments, isLoading]);

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