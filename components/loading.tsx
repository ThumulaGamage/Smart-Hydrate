// app/loading-screen.js
import { LinearGradient } from "expo-linear-gradient";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";

SplashScreen.preventAutoHideAsync();

export default function LoadingScreen({ onFinish }: { onFinish?: () => void }) {
  const scaleValue = new Animated.Value(0.8);
  const opacityValue = new Animated.Value(0);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacityValue, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await SplashScreen.hideAsync();
      onFinish?.();
    });
  }, []);

  return (
    <LinearGradient
      colors={["#e0f7ff", "#2196f3"]}
      style={styles.container}
    >
      <Animated.View
        style={{
          transform: [{ scale: scaleValue }],
          opacity: opacityValue,
          shadowColor: "#2196f3",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
          elevation: 5,
        }}
      >
        <Image
          source={require("../assets/images/smart_hydration_logo.png")}
          style={styles.logo}
          resizeMode="contain"
          onError={(e) => console.warn("Logo load error:", e)}
        />
      </Animated.View>

      <Animated.View style={{ opacity: opacityValue }}>
        <Text style={styles.appName}>SmartHydration</Text>
        <Text style={styles.subtitle}>Track. Hydrate. Thrive.</Text>
      </Animated.View>

      <ActivityIndicator size="large" color="#2196f3" style={styles.loader} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  logo: {
    width: 280,
    height: 280,
    marginBottom: 30,
  },
  appName: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#0d47a1",
    textAlign: "center",
    letterSpacing: 0.5,
    textShadowColor: "rgba(0,0,0,0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 16,
    color: "#00796b",
    textAlign: "center",
    paddingHorizontal: 40,
    marginTop: 8,
  },
  loader: {
    marginTop: 32,
  },
});