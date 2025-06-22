// Adapted Home Screen for SmartHydrate App (hydration tracker)

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../config/firebaseConfig';
import useTheme from '../../Theme/theme';

const { width } = Dimensions.get('window');

export default function HomeTab() {
  const theme = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState({ name: '', email: '' });

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userEmail = user.email || '';
      let userName = user.displayName || '';

      if (!userName) {
        try {
          const userDoc = await db.collection('users').doc(user.uid).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            userName = userData.name || userData.displayName || '';
          }
        } catch (error) {
          console.log('No user document found, using email');
        }
      }

      if (!userName && userEmail) {
        userName = userEmail.split('@')[0];
      }

      setUserInfo({ name: userName, email: userEmail });
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await auth.signOut();
            router.replace('/auth/login');
          } catch (error) {
            console.error('Error signing out:', error);
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>

        {/* User Header */}
        <View style={[styles.userHeader, { backgroundColor: theme.card }]}>
          <View style={styles.userInfo}>
            <View style={[styles.userAvatar, { backgroundColor: theme.primary }]}>
              <Text style={styles.userInitials}>{getInitials(userInfo.name)}</Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={[styles.userName, { color: theme.text }]}>{userInfo.name || 'User'}</Text>
              <Text style={[styles.userEmail, { color: theme.textMuted }]}>{userInfo.email}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Welcome Section */}
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Welcome to SmartHydrate</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>Stay refreshed, stay healthy.</Text>
          </View>
          <View style={[styles.headerIcon, { backgroundColor: theme.secondary }]}>
            <Ionicons name="water" size={32} color={theme.icon} />
          </View>
        </View>

        {/* Placeholder for hydration stats or features */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: theme.textMuted, fontSize: 16 }}>
            Your hydration summary will appear here.
          </Text>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInitials: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    fontWeight: '400',
  },
  signOutButton: {
    padding: 8,
    borderRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '400',
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});