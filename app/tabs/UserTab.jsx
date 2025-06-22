import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useUser } from '../../context/UserDetailContext';
import useTheme from '../../Theme/theme';

import ThemedButton from '../../components/ThemedButton';
import ThemedText from '../../components/ThemedText';
import ThemedView from '../../components/ThemedView';

export default function UserTab() {
  const { user, userDetails, logout } = useUser();
  const router = useRouter();
  const theme = useTheme();

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const navigateToSettings = () => {
    router.push('/settings'); // Make sure this path matches your actual settings route
  };

  const getInitials = () => {
    if (!userDetails?.name) return '?';
    const names = userDetails.name.split(' ');
    return names.map(name => name[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <ThemedView style={styles.container}>
      {/* Improved Header with top padding */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
          My Profile
        </ThemedText>
   
      </View>

      {/* Rest of your content remains the same */}
      {/* Profile section */}
      <View style={styles.profileSection}>
        <View style={[styles.profileIcon, { backgroundColor: theme.primary }]}>
          <ThemedText style={styles.profileInitials}>{getInitials()}</ThemedText>
        </View>

        <ThemedText style={[styles.userName, { color: theme.text }]}>
          {userDetails?.name || 'User'}
        </ThemedText>
        <ThemedText style={[styles.userEmail, { color: theme.secondaryText }]}>
          {user?.email || 'email@example.com'}
        </ThemedText>
      </View>

      {/* Account details */}
      <View style={[styles.infoContainer, { backgroundColor: theme.card }]}>
        <View style={styles.infoRow}>
          <FontAwesome name="user" size={18} color={theme.secondaryText} />
          <ThemedText style={[styles.label, { color: theme.text }]}>Name:</ThemedText>
          <ThemedText style={[styles.value, { color: theme.text }]}>
            {userDetails?.name || 'Not provided'}
          </ThemedText>
        </View>

        <View style={styles.infoRow}>
          <FontAwesome name="envelope" size={18} color={theme.secondaryText} />
          <ThemedText style={[styles.label, { color: theme.text }]}>Email:</ThemedText>
          <ThemedText style={[styles.value, { color: theme.text }]}>
            {user?.email || 'N/A'}
          </ThemedText>
        </View>

        <View style={styles.infoRow}>
          <MaterialIcons
            name={user?.emailVerified ? 'verified' : 'warning'}
            size={18}
            color={user?.emailVerified ? 'green' : 'orange'}
          />
          <ThemedText style={[styles.label, { color: theme.text }]}>Status:</ThemedText>
          <ThemedText
            style={[
              styles.value,
              user?.emailVerified ? styles.verified : styles.unverified,
            ]}
          >
            {user?.emailVerified ? 'Verified' : 'Not Verified'}
          </ThemedText>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsContainer}>
        <ThemedButton
          title="Edit Profile"
          onPress={() => router.push('/account/edit')}
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          icon={<MaterialIcons name="edit" size={20} color="white" />}
        />

        <ThemedButton
          title="Sign Out"
          onPress={handleLogout}
          style={[styles.actionButton, { backgroundColor: theme.error || '#dc3545' }]}
          textStyle={styles.logoutButtonText}
          icon={<MaterialIcons name="logout" size={20} color="white" />}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 50, // Added top padding to prevent overlap
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 15,
    marginBottom: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  settingsButton: {
    padding: 10,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  profileIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  profileInitials: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 16,
    textAlign: 'center',
  },
  infoContainer: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
    marginRight: 5,
    width: 70,
  },
  value: {
    fontSize: 16,
    flex: 1,
  },
  verified: {
    color: 'green',
    fontWeight: '600',
  },
  unverified: {
    color: 'orange',
    fontWeight: '600',
  },
  actionsContainer: {
    gap: 15,
    paddingHorizontal: 10,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});