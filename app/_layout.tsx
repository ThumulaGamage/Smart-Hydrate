// app/_layout.tsx
import { Stack } from "expo-router";
import { UserProvider } from "../context/UserDetailContext";

export default function Layout() {
  return (
    <UserProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </UserProvider>
  );
}