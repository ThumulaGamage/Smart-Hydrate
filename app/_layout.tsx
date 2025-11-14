 // app/_layout.tsx
import { useState } from "react";
import { Stack } from "expo-router";
import { UserProvider } from "../context/UserDetailContext";
import LoadingScreen from "../components/loading"; // <-- your custom screen

function RootLayoutNav() {
return (
<Stack screenOptions={{ headerShown: false }}>
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
<UserProvider>
<RootLayoutNav />
</UserProvider>
);
}