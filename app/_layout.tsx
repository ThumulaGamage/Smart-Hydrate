import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { UserProvider, useUser } from "../context/UserDetailContext";

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  

  return (
    <Stack screenOptions={{ headerShown: false }}>
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

