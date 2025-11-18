import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
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
  Text,
  Image
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
const StatsCard = ({ icon, title, value, subtitle, color, isNewUser = false }) => {
  const theme = useTheme();
  
  if (isNewUser) {
    return (
      <View style={[styles.statsCard, { 
        backgroundColor: theme.card,
        borderWidth: 2,
        borderColor: color + '30',
        borderStyle: 'dashed',
      }]}>
        <View style={[styles.statsIconContainer, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon} size={24} color={color + '60'} />
        </View>
        <View style={styles.statsContent}>
          <ThemedText style={[styles.statsValue, { color: theme.textMuted }]}>--</ThemedText>
          <ThemedText style={[styles.statsTitle, { color: theme.textMuted }]}>{title}</ThemedText>
          <ThemedText style={[styles.statsSubtitle, { color: theme.textMuted }]}>Not started</ThemedText>
        </View>
      </View>
    );
  }
  
  return (
    <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
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
    </View>
  );
};

// Achievement Badge Component
const AchievementBadge = ({ icon, title, achieved, description }) => {
  const theme = useTheme();
  
  return (
    <View style={[styles.achievementBadge, { 
      backgroundColor: achieved ? theme.primary + '15' : theme.card,
      borderColor: achieved ? theme.primary : theme.border,
      opacity: achieved ? 1 : 0.6,
    }]}>
      <View style={[styles.achievementIconContainer, {
        backgroundColor: achieved ? theme.primary + '20' : theme.border + '30'
      }]}>
        <Ionicons 
          name={icon} 
          size={24} 
          color={achieved ? theme.primary : theme.textMuted} 
        />
      </View>
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

export default function EnhancedUserTab() {
  const { user, userDetails, logout } = useUser();
  const router = useRouter();
  const theme = useTheme();
  
  const [userStats, setUserStats] = useState({
    totalDaysTracked: 0,
    averageDailyIntake: 0,
    goalAchievementRate: 0,
    currentStreak: 0,
    totalLitersConsumed: 0,
    isNewUser: true
  });
  
  const [profileData, setProfileData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [userDetails, user]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      
      if (auth.currentUser) {
        const waterBottleService = new WaterBottleService(auth.currentUser.uid);
        
        const [profile, todayStats, weeklyResult] = await Promise.all([
          waterBottleService.getUserProfile().catch(() => null),
          waterBottleService.getTodayStats().catch(() => ({ isNewUser: true, totalConsumed: 0 })),
          waterBottleService.getWeeklyStats().catch(() => ({ data: [], isNewUser: true }))
        ]);

        setProfileData(profile);

        const weeklyData = weeklyResult.data || [];
        const isNewUser = weeklyResult.isNewUser || weeklyData.length === 0;
        const hasRealData = weeklyData.some(day => day.totalConsumed > 0) || todayStats.totalConsumed > 0;

        if (isNewUser || !hasRealData) {
          setUserStats({
            totalDaysTracked: 0,
            averageDailyIntake: 0,
            goalAchievementRate: 0,
            currentStreak: 0,
            totalLitersConsumed: 0,
            isNewUser: true
          });
        } else {
          const totalConsumed = weeklyData.reduce((sum, day) => sum + (day.totalConsumed || 0), 0);
          const achievedDays = weeklyData.filter(day => day.goalAchieved).length;
          const avgDaily = weeklyData.length > 0 ? totalConsumed / weeklyData.length : 0;
          const daysWithData = weeklyData.filter(day => day.totalConsumed > 0).length;
          
          setUserStats({
            totalDaysTracked: daysWithData,
            averageDailyIntake: Math.round(avgDaily),
            goalAchievementRate: daysWithData > 0 ? Math.round((achievedDays / daysWithData) * 100) : 0,
            currentStreak: calculateStreak(weeklyData),
            totalLitersConsumed: Math.round(totalConsumed / 1000 * 10) / 10,
            isNewUser: false
          });
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setUserStats({
        totalDaysTracked: 0,
        averageDailyIntake: 0,
        goalAchievementRate: 0,
        currentStreak: 0,
        totalLitersConsumed: 0,
        isNewUser: true
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStreak = (weeklyData) => {
    if (!weeklyData || weeklyData.length === 0) return 0;
    
    let streak = 0;
    const sortedData = weeklyData
      .filter(day => day.totalConsumed > 0)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    for (const day of sortedData) {
      if (day.goalAchieved) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/auth/signIn');
    } catch (error) {
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  const shareProgress = async () => {
    try {
      const message = userStats.isNewUser
        ? `Just started my hydration journey with Smart Water Bottle! 💧\n\nJoin me in building healthy hydration habits! 💪`
        : `My Hydration Journey:\n\n💧 ${userStats.totalLitersConsumed}L consumed\n📊 ${userStats.goalAchievementRate}% success rate\n🔥 ${userStats.currentStreak} day streak\n\nStay hydrated with Smart Water Bottle! 💪`;
      
      await Share.share({ message, title: 'My Hydration Journey' });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const getInitials = () => {
    const name = getUserName();
    if (name && name !== 'User' && !name.includes('@')) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }
    const email = auth.currentUser?.email || user?.email;
    return email ? email.substring(0, 2).toUpperCase() : '?';
  };

  const getUserName = () => {
    if (userDetails?.name) return userDetails.name;
    if (profileData?.name) return profileData.name;
    if (auth.currentUser?.displayName) return auth.currentUser.displayName;
    if (user?.displayName) return user.displayName;
    const email = auth.currentUser?.email || user?.email;
    return email ? email.split('@')[0] : 'User';
  };

  const achievements = [
    { icon: 'water', title: 'First Drop', achieved: !userStats.isNewUser && userStats.totalDaysTracked > 0, description: 'Started tracking' },
    { icon: 'flame', title: 'Hot Streak', achieved: userStats.currentStreak >= 7, description: '7-day streak' },
    { icon: 'trophy', title: 'Achiever', achieved: userStats.goalAchievementRate >= 80, description: '80% goal rate' },
    { icon: 'analytics', title: 'Data Lover', achieved: userStats.totalDaysTracked >= 30, description: '30 days tracked' },
  ];

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="water" size={48} color={theme.primary} />
          <ThemedText style={[styles.loadingText, { color: theme.text }]}>Loading your profile...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
            {/* Profile Header - Updated with centered profile picture */}
        <LinearGradient
          colors={[theme.primary, theme.primary + 'DD']}
          style={styles.headerGradient}
        >
          <Animated.View style={[styles.profileSection, { opacity: fadeAnim }]}>
            {/* Centered Profile Picture */}
            <View style={styles.profileImageCenterContainer}>
              <View style={styles.profileImageContainer}>
                {userDetails?.profilePicture ? (
                  <Image 
                    source={{ uri: userDetails.profilePicture }} 
                    style={styles.profileImage}
                  />
                ) : (
                  <View style={[styles.profileImage, { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
                    <Text style={[styles.profileInitials, { color: theme.primary }]}>
                      {getInitials()}
                    </Text>
                  </View>
                )}
                <View style={styles.onlineIndicator} />
              </View>
            </View>
            
            {/* User Info Below Profile Picture */}
            <View style={styles.profileInfo}>
              <ThemedText style={styles.userName}>{getUserName()}</ThemedText>
              <ThemedText style={styles.userEmail}>{user?.email}</ThemedText>
              <ThemedText style={styles.headerGreeting}>
                {userStats.isNewUser ? 'Welcome to your hydration journey!' : 'Keep up the great work!'}
              </ThemedText>
            </View>

            {/* Edit Button Positioned Absolutely */}
            <TouchableOpacity 
              style={[styles.editButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
              onPress={() => router.push('tabs/editprofile')}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={20} color="white" />
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>

        {/* Stats Section */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            {userStats.isNewUser ? 'Your Journey Awaits' : 'Hydration Stats'}
          </ThemedText>
          
          {userStats.isNewUser && (
            <View style={[styles.newUserCard, { backgroundColor: theme.card }]}>
              <Ionicons name="water" size={40} color={theme.primary} />
              <ThemedText style={[styles.newUserTitle, { color: theme.text }]}>
                Ready to Start?
              </ThemedText>
              <ThemedText style={[styles.newUserDesc, { color: theme.textMuted }]}>
                Fill your smart bottle and take your first sip to begin tracking your hydration!
              </ThemedText>
            </View>
          )}
          
          <View style={styles.statsGrid}>
            <StatsCard
              icon="water"
              title="Total Intake"
              value={`${userStats.totalLitersConsumed}L`}
              subtitle="all time"
              color="#3498db"
              isNewUser={userStats.isNewUser}
            />
            <StatsCard
              icon="flame"
              title="Streak"
              value={`${userStats.currentStreak}`}
              subtitle="days"
              color="#e74c3c"
              isNewUser={userStats.isNewUser}
            />
            <StatsCard
              icon="trending-up"
              title="Success Rate"
              value={`${userStats.goalAchievementRate}%`}
              subtitle="goal achieved"
              color="#27ae60"
              isNewUser={userStats.isNewUser}
            />
            <StatsCard
              icon="calendar"
              title="Days Tracked"
              value={`${userStats.totalDaysTracked}`}
              subtitle="total"
              color="#9b59b6"
              isNewUser={userStats.isNewUser}
            />
          </View>
        </View>

        {/* Achievements */}
        {!userStats.isNewUser && (
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Achievements</ThemedText>
            <View style={styles.achievementsGrid}>
              {achievements.map((achievement, index) => (
                <AchievementBadge key={index} {...achievement} />
              ))}
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</ThemedText>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push('tabs/customize-hydration')}
            activeOpacity={0.8}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="settings-outline" size={22} color="white" />
            </View>
            <View style={styles.actionContent}>
              <ThemedText style={styles.actionText}>Hydration Settings</ThemedText>
              <ThemedText style={styles.actionSubtext}>Customize your goals</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push('tabs/progress')}
            activeOpacity={0.8}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="analytics-outline" size={22} color="white" />
            </View>
            <View style={styles.actionContent}>
              <ThemedText style={styles.actionText}>View Progress</ThemedText>
              <ThemedText style={styles.actionSubtext}>Track your trends</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Share Button */}
      <View style={[styles.shareContainer, { backgroundColor: theme.background }]}>
        <TouchableOpacity 
          style={[styles.shareButton, { backgroundColor: '#388E3C' }]}
          onPress={shareProgress}
          activeOpacity={0.8}
        >
          <Ionicons name="share-social-outline" size={20} color="white" />
          <ThemedText style={styles.shareText}>
            {userStats.isNewUser ? 'Share Journey' : 'Share Progress'}
          </ThemedText>
        </TouchableOpacity>
      </View>

           <View style={[styles.shareContainer, { backgroundColor: theme.background }]}>
        <TouchableOpacity 
          style={[styles.shareButton, { backgroundColor: '#cf0000ff' }]}
         onPress={() => setShowLogoutModal(true)}
            activeOpacity={0.7}
        >
           <Ionicons name="log-out-outline" size={24} color="#ffffffff" />
          <ThemedText style={styles.shareText}>
             Log out
          </ThemedText>
        </TouchableOpacity>
      </View>


      {/* Logout Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showLogoutModal}
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Ionicons name="log-out-outline" size={48} color="#e74c3c" />
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Sign Out</ThemedText>
            <ThemedText style={[styles.modalDesc, { color: theme.textMuted }]}>
              Are you sure you want to sign out?
            </ThemedText>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: theme.border }]}
                onPress={() => setShowLogoutModal(false)}
              >
                <ThemedText style={[styles.modalBtnText, { color: theme.text }]}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#e74c3c' }]}
                onPress={() => {
                  setShowLogoutModal(false);
                  handleLogout();
                }}
              >
                <ThemedText style={[styles.modalBtnText, { color: 'white' }]}>Sign Out</ThemedText>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  
  // Header
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  signOutButton: {
    padding: 8,
  },

  // Profile Section - Updated for centered profile picture
  headerGradient: {
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  profileSection: {
    alignItems: 'center',
    position: 'relative',
  },
  profileImageCenterContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImageContainer: {
    position: 'relative',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileInitials: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#27ae60',
    borderWidth: 2,
    borderColor: 'white',
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 8,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerGreeting: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    textAlign: 'center',
  },
  editButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Sections
  section: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },

  // New User Card
  newUserCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
  },
  newUserTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
  },
  newUserDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statsCard: {
    width: (width - 44) / 2,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
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
    gap: 2,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsSubtitle: {
    fontSize: 12,
  },

  // Achievements
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievementBadge: {
    width: (width - 44) / 2,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  achievementIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  achievementDesc: {
    fontSize: 12,
    textAlign: 'center',
  },

  // Actions
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },

  // Share Button
  shareContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  shareText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // Modal
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
  modalDesc: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },

  bottomPadding: {
    height: 100,
  },
});