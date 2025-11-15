import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemedView from '../../components/ThemedView';
import ThemedText from '../../components/ThemedText';
import EditableField from '../../components/profile/EditableField';
import useTheme from '../../Theme/theme';
import { getUserProfile, updateUserProfile, updateProfileFields, updateBasicInfo } from '../../services/UserService';

export default function EditProfileScreen() {
  const router = useRouter();
  const theme = useTheme();

  // State management
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // User data state
  const [userData, setUserData] = useState({
    email: '',
    name: '',
    age: '',
    weight: '',
    height: '',
    gender: '',
    activityLevel: '',
  });

  // Original data for cancel functionality
  const [originalData, setOriginalData] = useState({});

  // Fetch user profile on component mount
  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    setLoading(true);
    const result = await getUserProfile();

    if (result.success) {
      const data = result.data;
      const profileData = {
        email: data.email || '',
        name: data.name || '',
        age: data.profile?.age?.toString() || '',
        weight: data.profile?.weight?.toString() || '',
        height: data.profile?.height?.toString() || '',
        gender: data.profile?.gender || '',
        activityLevel: data.profile?.activityLevel || '',
      };
      
      setUserData(profileData);
      setOriginalData(profileData);
    } else {
      Alert.alert('Error', result.error || 'Failed to load profile');
    }

    setLoading(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setUserData(originalData);
    setIsEditing(false);
  };

  const handleSave = async () => {
    // Validation
    if (!userData.name.trim()) {
      Alert.alert('Validation Error', 'Name cannot be empty');
      return;
    }

    if (userData.age && (isNaN(userData.age) || parseInt(userData.age) <= 0)) {
      Alert.alert('Validation Error', 'Please enter a valid age');
      return;
    }

    if (userData.weight && (isNaN(userData.weight) || parseFloat(userData.weight) <= 0)) {
      Alert.alert('Validation Error', 'Please enter a valid weight');
      return;
    }

    setSaving(true);

    try {
      // Update basic info (name and email)
      const basicInfoResult = await updateBasicInfo(userData.name, userData.email);
      
      if (!basicInfoResult.success) {
        throw new Error(basicInfoResult.error);
      }

      // Update profile fields
      const profileUpdates = {
        age: parseInt(userData.age) || 0,
        weight: parseFloat(userData.weight) || 0,
        height: parseInt(userData.height) || 0,
        gender: userData.gender,
        activityLevel: userData.activityLevel,
      };

      const profileResult = await updateProfileFields(profileUpdates);

      if (!profileResult.success) {
        throw new Error(profileResult.error);
      }

      // Update original data
      setOriginalData(userData);
      setIsEditing(false);

      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', style: 'default' }
      ]);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <View style={[styles.loadingCard, { backgroundColor: theme.card }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={[styles.loadingText, { marginTop: 16 }]}>
            Loading profile...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Gradient Header */}
      <LinearGradient
        colors={[theme.primary, theme.primary + 'CC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <ThemedText style={styles.headerTitle}>
            Profile Information
          </ThemedText>
          
          {!isEditing ? (
            <TouchableOpacity onPress={handleEdit} style={styles.editIconButton}>
              <Ionicons name="create-outline" size={24} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.card }]}>
          <View style={styles.profilePictureSection}>
            <View style={[styles.profilePictureBorder, { borderColor: theme.primary + '30' }]}>
              <View style={[styles.profilePicture, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="person" size={60} color={theme.primary} />
              </View>
            </View>
            {isEditing && (
              <TouchableOpacity 
                style={[styles.changePictureButton, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="camera" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          <ThemedText style={[styles.userName, { color: theme.text }]}>
            {userData.name || 'Your Name'}
          </ThemedText>
          <ThemedText style={[styles.userEmail, { color: theme.secondaryText }]}>
            {userData.email}
          </ThemedText>
        </View>

        {/* Basic Information Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-outline" size={24} color={theme.primary} />
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
              Basic Information
            </ThemedText>
          </View>

          <View style={styles.cardContent}>
            <EditableField
              label="Full Name"
              value={userData.name}
              onChangeText={(text) => setUserData({ ...userData, name: text })}
              editable={isEditing}
              placeholder="Enter your name"
              icon="person-outline"
            />

            <EditableField
              label="Email Address"
              value={userData.email}
              onChangeText={(text) => setUserData({ ...userData, email: text })}
              editable={false}
              disabled={true}
              icon="mail-outline"
            />
          </View>
        </View>

        {/* Health Information Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="fitness-outline" size={24} color={theme.primary} />
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
              Health Information
            </ThemedText>
          </View>

          <View style={styles.cardContent}>
            <EditableField
              label="Age"
              value={userData.age}
              onChangeText={(text) => setUserData({ ...userData, age: text })}
              editable={isEditing}
              keyboardType="numeric"
              placeholder="Enter your age"
              icon="calendar-outline"
            />

            <EditableField
              label="Weight (kg)"
              value={userData.weight}
              onChangeText={(text) => setUserData({ ...userData, weight: text })}
              editable={isEditing}
              keyboardType="decimal-pad"
              placeholder="Enter your weight"
              icon="barbell-outline"
            />

            <EditableField
              label="Height (cm)"
              value={userData.height}
              onChangeText={(text) => setUserData({ ...userData, height: text })}
              editable={isEditing}
              keyboardType="numeric"
              placeholder="Enter your height"
              icon="resize-outline"
            />

            <EditableField
              label="Gender"
              value={userData.gender}
              onChangeText={(text) => setUserData({ ...userData, gender: text })}
              editable={isEditing}
              placeholder="Male/Female/Other"
              icon="male-female-outline"
            />

            <EditableField
              label="Activity Level"
              value={userData.activityLevel}
              onChangeText={(text) => setUserData({ ...userData, activityLevel: text })}
              editable={isEditing}
              placeholder="Sedentary/Moderate/Active"
              icon="walk-outline"
            />
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Buttons */}
      {isEditing && (
        <View style={[styles.floatingActions, { backgroundColor: theme.background }]}>
          <TouchableOpacity
            style={[styles.cancelFloatingButton, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={handleCancel}
            disabled={saving}
          >
            <Ionicons name="close" size={24} color={theme.text} />
            <ThemedText style={[styles.floatingButtonText, { color: theme.text }]}>
              Cancel
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveFloatingButton, { backgroundColor: theme.primary }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <ThemedText style={styles.saveFloatingButtonText}>Saving...</ThemedText>
              </>
            ) : (
              <>
                <Ionicons name="checkmark" size={24} color="#fff" />
                <ThemedText style={styles.saveFloatingButtonText}>Save</ThemedText>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingCard: {
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  gradientHeader: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  editIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  profileCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  profilePictureSection: {
    position: 'relative',
    marginBottom: 16,
  },
  profilePictureBorder: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePictureButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    fontWeight: '400',
  },
  infoCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
  cardContent: {
    paddingTop: 4,
  },
  floatingActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  cancelFloatingButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveFloatingButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveFloatingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});