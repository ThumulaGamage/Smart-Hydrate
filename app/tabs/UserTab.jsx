import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  Animated,
  Dimensions,
  RefreshControl,
  Modal,
  Share,
  Text
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '../../context/UserDetailContext';
import { auth, WaterBottleService } from '../../config/firebaseConfig';
import useTheme from '../../Theme/theme';

import ThemedButton from '../../components/ThemedButton';
import ThemedText from '../../components/ThemedText';
import ThemedView from '../../components/ThemedView';

const { width } = Dimensions.get('window');

// Stats Card Component
const StatsCard = ({ icon, title, value, subtitle, color, onPress }) => {
  const theme = useTheme();
  
  return (
    <TouchableOpacity style={[styles.statsCard, { backgroundColor: theme.card }]} onPress={onPress}>
      <View style={[styles.statsIconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.statsContent}>
        <ThemedText style={[styles.statsValue, { color: theme.text }]}>{value}</ThemedText>
        <ThemedText style={[styles.statsTitle, { color: theme.text }]}>{title}</ThemedText>
        {subtitle && (
          <ThemedText style={[styles.statsSubtitle, { color: theme.textMuted }]}>{subtitle}</ThemedText>
        )}
      </View>
    </TouchableOpacity>
  );
};

// Achievement Badge Component
const AchievementBadge = ({ icon, title, achieved, description }) => {
  const theme = useTheme();
  
  return (
    <View style={[styles.achievementBadge, { 
      backgroundColor: achieved ? theme.primary + '20' : theme.card,
      borderColor: achieved ? theme.primary : theme.border
    }]}>
      <Ionicons 
        name={icon} 
        size={20} 
        color={achieved ? theme.primary : theme.textMuted} 
      />
      <ThemedText style={[
        styles.achievementTitle, 
        { color: achieved ? theme.primary : theme.textMuted }
      ]}>
        {title}
      </ThemedText>
      <ThemedText style={[styles.achievementDesc, { color: theme.textMuted }]}>
        {description}
      </ThemedText>
    </View>
  );
};

// Settings Option Component
const SettingsOption = ({ icon, title, subtitle, onPress, showArrow = true, rightElement }) => {
  const theme = useTheme();
  
  return (
    <TouchableOpacity style={[styles.settingsOption, { backgroundColor: theme.card }]} onPress={onPress}>
      <View style={styles.settingsLeft}>
        <View style={[styles.settingsIconContainer, { backgroundColor: theme.primary + '15' }]}>
          <Ionicons name={icon} size={20} color={theme.primary} />
        </View>
        <View style={styles.settingsContent}>
          <ThemedText style={[styles.settingsTitle, { color: theme.text }]}>{title}</ThemedText>
          {subtitle && (
            <ThemedText style={[styles.settingsSubtitle, { color: theme.textMuted }]}>{subtitle}</ThemedText>
          )}
        </View>
      </View>
      <View style={styles.settingsRight}>
        {rightElement && rightElement}
        {showArrow && (
          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
        )}
      </View>
    </TouchableOpacity>
  );
};

export default function EnhancedUserTab() {
  const { user, userDetails, logout } = useUser();
  const router = useRouter();
  const theme = useTheme();
  
  const [userStats, setUserStats] = useState({
    totalDaysTracked: 0,
    averageDailyIntake: 0,
    goalAchievementRate: 0,
    currentStreak: 0,
    totalLitersConsumed: 0
  });
  
  const [profileData, setProfileData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    loadUserData();
    
    // Debug logging to see what user data is available
    console.log('🔍 User Profile Debug:');
    console.log('userDetails:', userDetails);
    console.log('user:', user);
    console.log('auth.currentUser:', auth.currentUser);
    console.log('Generated name:', getUserName());
    
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [userDetails, user]);

  const loadUserData = async () => {
    try {
      if (auth.currentUser) {
        const waterBottleService = new WaterBottleService(auth.currentUser.uid);
        
        // Load user profile and stats
        const [profile, todayStats, weeklyData] = await Promise.all([
          waterBottleService.getUserProfile().catch(() => null),
          waterBottleService.getTodayStats().catch(() => null),
          waterBottleService.getWeeklyStats().catch(() => [])
        ]);

        setProfileData(profile);

        // Calculate user statistics
        const totalConsumed = weeklyData.reduce((sum, day) => sum + (day.totalConsumed || 0), 0);
        const achievedDays = weeklyData.filter(day => day.goalAchieved).length;
        const avgDaily = weeklyData.length > 0 ? totalConsumed / weeklyData.length : 0;
        
        setUserStats({
          totalDaysTracked: weeklyData.length,
          averageDailyIntake: Math.round(avgDaily),
          goalAchievementRate: weeklyData.length > 0 ? Math.round((achievedDays / weeklyData.length) * 100) : 0,
          currentStreak: calculateStreak(weeklyData),
          totalLitersConsumed: Math.round(totalConsumed / 1000 * 10) / 10
        });
      }
    } catch (error) {
      console.error('❌ Error loading user data:', error);
    }
  };

  const calculateStreak = (weeklyData) => {
    let streak = 0;
    const sortedData = weeklyData.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    for (const day of sortedData) {
      if (day.goalAchieved) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/auth/signIn');
    } catch (error) {
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  const confirmLogout = () => {
    setShowLogoutModal(true);
  };

  const shareProgress = async () => {
    try {
      const message = `🏆 My Hydration Journey:\n\n💧 ${userStats.totalLitersConsumed}L total consumed\n📊 ${userStats.goalAchievementRate}% goal achievement\n🔥 ${userStats.currentStreak} day streak\n\nStay hydrated with Smart Water Bottle! 💪`;
      
      await Share.share({
        message,
        title: 'My Hydration Stats'
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const getInitials = () => {
    // First try to get the actual name
    const name = getUserName();
    
    // If it's not "User" and not an email format, use it for initials
    if (name && name !== 'User' && !name.includes('@')) {
      const names = name.split(' ');
      return names.map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }
    
    // Fallback to email if available
    const email = auth.currentUser?.email || user?.email;
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    
    return '?';
  };

  const getUserName = () => {
    // First try userDetails from context (this should have the Firestore data)
    if (userDetails?.name) return userDetails.name;
    
    // Then try profileData from Firebase (loaded in this component)
    if (profileData?.name) return profileData.name;
    
    // Then try Firebase Auth displayName
    if (auth.currentUser?.displayName) return auth.currentUser.displayName;
    if (user?.displayName) return user.displayName;
    
    // Last resort: use email username
    if (auth.currentUser?.email) return auth.currentUser.email.split('@')[0];
    if (user?.email) return user.email.split('@')[0];
    
    return 'User';
  };

  const getMembershipStatus = () => {
    return userDetails?.member ? 'Premium Member' : 'Free Member';
  };

  const getAccountAge = () => {
    if (!user?.metadata?.creationTime) return 'New User';
    const created = new Date(user.metadata.creationTime);
    const now = new Date();
    const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    
    if (days < 7) return `${days} days`;
    if (days < 30) return `${Math.floor(days / 7)} weeks`;
    return `${Math.floor(days / 30)} months`;
  };

  const achievements = [
    { icon: 'water', title: 'First Drop', achieved: userStats.totalDaysTracked > 0, description: 'Started tracking' },
    { icon: 'flame', title: 'Hot Streak', achieved: userStats.currentStreak >= 7, description: '7-day streak' },
    { icon: 'trophy', title: 'Achiever', achieved: userStats.goalAchievementRate >= 80, description: '80% goal rate' },
    { icon: 'analytics', title: 'Data Lover', achieved: userStats.totalDaysTracked >= 30, description: '30 days tracked' },
  ];

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        
        {/* Enhanced Header with Gradient */}
        <LinearGradient
          colors={[theme.primary, theme.primary + 'CC']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <ThemedText style={styles.headerGreeting}>Welcome back!</ThemedText>
              <TouchableOpacity onPress={() => router.push('/settings')}>
                <Ionicons name="settings-outline" size={24} color="white" />
              </TouchableOpacity>
            </View>
            
            {/* Profile Section */}
            <Animated.View style={[styles.profileSection, { opacity: fadeAnim }]}>
              <View style={styles.profileImageContainer}>
                <View style={[styles.profileImage, { backgroundColor: theme.card || '#ffffff' }]}>
                  <Text style={[styles.profileInitials, { color: theme.primary || '#667eea' }]}>
                    {getInitials()}
                  </Text>
                </View>
                
                {/* Online Status Indicator */}
                <View style={[styles.onlineIndicator, { backgroundColor: theme.success || '#27ae60' }]} />
              </View>
              
              <View style={styles.profileInfo}>
                <ThemedText style={styles.userName}>{getUserName()}</ThemedText>
                <ThemedText style={styles.userEmail}>{user?.email}</ThemedText>
                <View style={styles.membershipBadge}>
                  <Ionicons 
                    name={userDetails?.member ? "diamond" : "person"} 
                    size={12} 
                    color="white" 
                  />
                  <ThemedText style={styles.membershipText}>{getMembershipStatus()}</ThemedText>
                </View>
              </View>
            </Animated.View>
          </View>
        </LinearGradient>

        {/* Quick Stats Grid */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>📊 Your Hydration Stats</ThemedText>
          <View style={styles.statsGrid}>
            <StatsCard
              icon="water"
              title="Total Intake"
              value={`${userStats.totalLitersConsumed}L`}
              subtitle="All time"
              color="#3498db"
            />
            <StatsCard
              icon="flame"
              title="Current Streak"
              value={`${userStats.currentStreak}`}
              subtitle="days"
              color="#e74c3c"
            />
            <StatsCard
              icon="trending-up"
              title="Success Rate"
              value={`${userStats.goalAchievementRate}%`}
              subtitle="goal achievement"
              color="#27ae60"
            />
            <StatsCard
              icon="calendar"
              title="Days Tracked"
              value={`${userStats.totalDaysTracked}`}
              subtitle="total days"
              color="#9b59b6"
            />
          </View>
        </View>

        {/* Achievements Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>🏆 Achievements</ThemedText>
            <TouchableOpacity onPress={() => router.push('/achievements')}>
              <ThemedText style={[styles.seeAllText, { color: theme.primary }]}>See All</ThemedText>
            </TouchableOpacity>
          </View>
          <View style={styles.achievementsGrid}>
            {achievements.map((achievement, index) => (
              <AchievementBadge key={index} {...achievement} />
            ))}
          </View>
        </View>

        {/* Account Information */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>👤 Account Details</ThemedText>
          <View style={[styles.infoContainer, { backgroundColor: theme.card }]}>
            <View style={styles.infoRow}>
              <FontAwesome name="user" size={18} color={theme.textMuted} />
              <View style={styles.infoContent}>
                <ThemedText style={[styles.infoLabel, { color: theme.textMuted }]}>Full Name</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                  {getUserName()}
                </ThemedText>
              </View>
            </View>

            <View style={styles.infoRow}>
              <FontAwesome name="envelope" size={18} color={theme.textMuted} />
              <View style={styles.infoContent}>
                <ThemedText style={[styles.infoLabel, { color: theme.textMuted }]}>Email Address</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                  {user?.email}
                </ThemedText>
              </View>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons
                name={user?.emailVerified ? 'verified' : 'warning'}
                size={18}
                color={user?.emailVerified ? '#27ae60' : '#f39c12'}
              />
              <View style={styles.infoContent}>
                <ThemedText style={[styles.infoLabel, { color: theme.textMuted }]}>Account Status</ThemedText>
                <ThemedText style={[
                  styles.infoValue,
                  { color: user?.emailVerified ? '#27ae60' : '#f39c12' }
                ]}>
                  {user?.emailVerified ? 'Verified Account' : 'Pending Verification'}
                </ThemedText>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="time" size={18} color={theme.textMuted} />
              <View style={styles.infoContent}>
                <ThemedText style={[styles.infoLabel, { color: theme.textMuted }]}>Member Since</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                  {getAccountAge()} ago
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* Settings & Actions */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>⚙️ Settings & Actions</ThemedText>
          
          <SettingsOption
            icon="person-outline"
            title="Edit Profile"
            subtitle="Update your personal information"
            onPress={() => router.push('/account/edit')}
          />
          
          <SettingsOption
            icon="water-outline"
            title="Hydration Goals"
            subtitle="Customize your daily water intake goals"
            onPress={() => router.push('/settings/goals')}
          />
          
          <SettingsOption
            icon="notifications-outline"
            title="Notifications"
            subtitle="Manage your hydration reminders"
            onPress={() => router.push('/settings/notifications')}
          />
          
          <SettingsOption
            icon="analytics-outline"
            title="Export Data"
            subtitle="Download your hydration history"
            onPress={() => router.push('/export')}
          />
          
          <SettingsOption
            icon="share-outline"
            title="Share Progress"
            subtitle="Share your hydration achievements"
            onPress={shareProgress}
          />
          
          <SettingsOption
            icon="help-circle-outline"
            title="Help & Support"
            subtitle="Get help or contact support"
            onPress={() => router.push('/support')}
          />
        </View>

        {/* Logout Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.logoutButton, { backgroundColor: theme.error || '#e74c3c' }]}
            onPress={confirmLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="white" />
            <ThemedText style={styles.logoutButtonText}>Sign Out</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Extra padding for bottom tab */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showLogoutModal}
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Ionicons name="log-out-outline" size={48} color={theme.error || '#e74c3c'} />
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Sign Out</ThemedText>
            <ThemedText style={[styles.modalMessage, { color: theme.textMuted }]}>
              Are you sure you want to sign out of your account?
            </ThemedText>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.border }]}
                onPress={() => setShowLogoutModal(false)}
              >
                <ThemedText style={[styles.modalButtonText, { color: theme.text }]}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton, { backgroundColor: theme.error || '#e74c3c' }]}
                onPress={() => {
                  setShowLogoutModal(false);
                  handleLogout();
                }}
              >
                <ThemedText style={styles.modalButtonText}>Sign Out</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  
  // Header Styles
  headerGradient: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    flex: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerGreeting: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileInitials: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#27ae60',
    borderWidth: 2,
    borderColor: 'white',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  membershipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  membershipText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
    marginLeft: 4,
  },

  // Section Styles
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Stats Grid Styles
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statsCard: {
    width: (width - 56) / 2,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsContent: {
    alignItems: 'flex-start',
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  statsSubtitle: {
    fontSize: 12,
  },

  // Achievements Styles
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  achievementBadge: {
    width: (width - 56) / 2,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  achievementDesc: {
    fontSize: 12,
    textAlign: 'center',
  },

  // Info Container Styles
  infoContainer: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  infoContent: {
    flex: 1,
    marginLeft: 16,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Settings Option Styles
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsContent: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingsSubtitle: {
    fontSize: 14,
  },
  settingsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Logout Button Styles
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: 6,
  },
  confirmButton: {
    marginLeft: 6,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },

  bottomPadding: {
    height: 20,
  },
});