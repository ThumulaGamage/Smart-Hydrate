// components/AuthGuard.js
import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useUser } from '../context/UserDetailContext';
import Colors from '../constant/Colors';

export default function AuthGuard({ children }) {
  const { loading, isAuthenticated } = useUser();

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: Colors.WHITE || '#ffffff',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <ActivityIndicator size="large" color={Colors.GREEN_DARK || '#0066CC'} />
        <Text style={{
          marginTop: 20,
          fontSize: 16,
          color: Colors.GREEN_DARK || '#0066CC'
        }}>
          Loading...
        </Text>
      </View>
    );
  }

  // Don't render children if not authenticated - root layout will handle redirect
  if (!isAuthenticated) {
    return null;
  }

  // Render children if authenticated
  return children;
}