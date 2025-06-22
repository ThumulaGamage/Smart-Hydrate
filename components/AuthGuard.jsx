// components/AuthGuard.js
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';
import { useUser } from '../context/UserDetailContext';
import Colors from '../constant/Colors';

export default function AuthGuard({ children }) {
  const { user, loading, isAuthenticated } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // Redirect to sign in if not authenticated
      router.replace('/auth/signIn');
    }
  }, [loading, isAuthenticated, router]);

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: Colors.WHITE,
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <ActivityIndicator size="large" color={Colors.GREEN_DARK} />
        <Text style={{
          marginTop: 20,
          fontSize: 16,
          color: Colors.GREEN_DARK
        }}>
          Loading...
        </Text>
      </View>
    );
  }

  // Don't render children if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Render children if authenticated
  return children;
}

// Example usage in a protected route:
// export default function ProtectedPage() {
//   return (
//     <AuthGuard>
//       <YourPageContent />
//     </AuthGuard>
//   );
// }