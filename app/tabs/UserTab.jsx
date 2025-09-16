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

// Stats Card Component - Updated for new users
const StatsCard = ({ icon, title, value, subtitle, color, isNewUser = false }) => {
  const theme = useTheme();
  
  if (isNewUser) {
    return (
      <View style={[styles.statsCard, { 
        backgroundColor: theme.card,
        borderWidth: 2,
        borderColor: theme.border || '#E0E0E0',
        borderStyle: 'dashed'
      }]}>
        <View style={[styles.statsIconContainer, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={24} color={color + '80'} />
        </View>
        <View style={styles.statsContent}>
          <ThemedText style={[styles.statsValue, { color: theme.textMuted }]}>--</ThemedText>
          <ThemedText style={[styles.statsTitle, { color: theme.textMuted }]}>{title}</ThemedText>
          <ThemedText style={[styles.statsSubtitle, { color: theme.textMuted }]}>Start tracking</ThemedText>
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
    
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [userDetails, user]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      
      if (auth.currentUser) {
        const waterBottleService = new WaterBottleService(auth.currentUser.uid);
        
        // Load user profile and stats
        const [profile, todayStats, weeklyResult] = await Promise.all([
          waterBottleService.getUserProfile().catch(() => null),
          waterBottleService.getTodayStats().catch(() => ({ isNewUser: true, totalConsumed: 0 })),
          waterBottleService.getWeeklyStats().catch(() => ({ data: [], isNewUser: true }))
        ]);

        setProfileData(profile);

        const weeklyData = weeklyResult.data || [];
        const isNewUser = weeklyResult.isNewUser || weeklyData.length === 0;
        
        // Check if user has any real activity
        const hasRealData = weeklyData.some(day => day.totalConsumed > 0) || todayStats.totalConsumed > 0;

        if (isNewUser || !hasRealData) {
          // Set empty stats for new users
          setUserStats({
            totalDaysTracked: 0,
            averageDailyIntake: 0,
            goalAchievementRate: 0,
            currentStreak: 0,
            totalLitersConsumed: 0,
            isNewUser: true
          });
        } else {
          // Calculate real user statistics
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
      // Set safe defaults on error
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
      .filter(day => day.totalConsumed > 0) // Only count days with actual data
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
      if (userStats.isNewUser) {
        const message = `Just started my hydration journey with Smart Water Bottle! 💧\n\nJoin me in building healthy hydration habits! 💪`;
        
        await Share.share({
          message,
          title: 'My Hydration Journey'
        });
      } else {
        const message = `My Hydration Journey:\n\n💧 ${userStats.totalLitersConsumed}L total consumed\n📊 ${userStats.goalAchievementRate}% goal achievement\n🔥 ${userStats.currentStreak} day streak\n\nStay hydrated with Smart Water Bottle! 💪`;
        
        await Share.share({
          message,
          title: 'My Hydration Stats'
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const getInitials = () => {
    const name = getUserName();
    
    if (name && name !== 'User' && !name.includes('@')) {
      const names = name.split(' ');
      return names.map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }
    
    const email = auth.currentUser?.email || user?.email;
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    
    return '?';
  };

  const getUserName = () => {
    if (userDetails?.name) return userDetails.name;
    if (profileData?.name) return profileData.name;
    if (auth.currentUser?.displayName) return auth.currentUser.displayName;
    if (user?.displayName) return user.displayName;
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
    { icon: 'water', title: 'First Drop', achieved: !userStats.isNewUser && userStats.totalDaysTracked > 0, description: 'Started tracking' },
    { icon: 'flame', title: 'Hot Streak', achieved: userStats.currentStreak >= 7, description: '7-day streak' },
    { icon: 'trophy', title: 'Achiever', achieved: userStats.goalAchievementRate >= 80, description: '80% goal rate' },
    { icon: 'analytics', title: 'Data Lover', achieved: userStats.totalDaysTracked >= 30, description: '30 days tracked' },
  ];

  // Show loading state
  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedText style={{ color: theme.text }}>Loading your profile...</ThemedText>
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
        {/* Title and Sign Out Section */}
        <View style={[styles.titleSection, { backgroundColor: theme.card, flexDirection: 'row', alignItems: 'center' }]}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <ThemedText style={[styles.pageTitle, { color: theme.text }]}>
              User Dashboard
            </ThemedText>
          </View>

          <TouchableOpacity 
            style={styles.signOutIconContainer}
            onPress={confirmLogout}
          >
            <Ionicons name="log-out-outline" size={24} color="#e74c3c" />
          </TouchableOpacity>
        </View>

        {/* Enhanced Header with Gradient */}
        <LinearGradient
          colors={[theme.primary, theme.primary + 'CC']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <ThemedText style={styles.headerGreeting}>
                {userStats.isNewUser ? 'Welcome to your hydration journey!' : 'Welcome back!'}
              </ThemedText>
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
              </View>

              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => {
                  router.push('/tabs/editprofile');
                }}
              >
                <Ionicons name="create-outline" size={20} color="white" />
                <ThemedText style={styles.editButtonText}>Edit</ThemedText>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </LinearGradient>

        {/* Quick Stats Grid */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            {userStats.isNewUser ? 'Your Journey Starts Here' : 'Your Hydration Stats'}
          </ThemedText>
          
          {userStats.isNewUser ? (
            <View style={styles.newUserMessage}>
              <Ionicons name="water" size={48} color={theme.primary} />
              <ThemedText style={[styles.newUserTitle, { color: theme.text }]}>
                Ready to Start Tracking?
              </ThemedText>
              <ThemedText style={[styles.newUserSubtitle, { color: theme.textMuted }]}>
                Fill your smart bottle and take your first sip to begin building healthy hydration habits!
              </ThemedText>
            </View>
          ) : null}
          
          <View style={styles.statsGrid}>
            <StatsCard
              icon="water"
              title="Total Intake"
              value={userStats.isNewUser ? '--' : `${userStats.totalLitersConsumed}L`}
              subtitle={userStats.isNewUser ? 'Start tracking' : 'All time'}
              color="#3498db"
              isNewUser={userStats.isNewUser}
            />
            <StatsCard
              icon="flame"
              title="Current Streak"
              value={userStats.isNewUser ? '--' : `${userStats.currentStreak}`}
              subtitle={userStats.isNewUser ? 'Start tracking' : 'days'}
              color="#e74c3c"
              isNewUser={userStats.isNewUser}
            />
            <StatsCard
              icon="trending-up"
              title="Success Rate"
              value={userStats.isNewUser ? '--' : `${userStats.goalAchievementRate}%`}
              subtitle={userStats.isNewUser ? 'Start tracking' : 'goal achievement'}
              color="#27ae60"
              isNewUser={userStats.isNewUser}
            />
            <StatsCard
              icon="calendar"
              title="Days Tracked"
              value={userStats.isNewUser ? '--' : `${userStats.totalDaysTracked}`}
              subtitle={userStats.isNewUser ? 'Start tracking' : 'total days'}
              color="#9b59b6"
              isNewUser={userStats.isNewUser}
            />
          </View>
        </View>

        {/* Achievements Section */}
        {!userStats.isNewUser && (
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Achievements</ThemedText>
            <View style={styles.achievementsGrid}>
              {achievements.map((achievement, index) => (
                <AchievementBadge
                  key={index}
                  icon={achievement.icon}
                  title={achievement.title}
                  achieved={achievement.achieved}
                  description={achievement.description}
                />
              ))}
            </View>
          </View>
        )}

        {/* Share Progress */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.shareButton, { backgroundColor: theme.primary }]}
            onPress={shareProgress}
          >
            <Ionicons name="share-outline" size={20} color="white" />
            <ThemedText style={styles.shareButtonText}>
              {userStats.isNewUser ? 'Share Journey' : 'Share Progress'}
            </ThemedText>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Title Section Styles
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  signOutIconContainer: {
    padding: 4,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 32,
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
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editButtonText: {
    color: 'white',
    fontSize: 14,
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

  // New User Message
  newUserMessage: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  newUserTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  newUserSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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

  // Share Button Styles
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  shareButtonText: {
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