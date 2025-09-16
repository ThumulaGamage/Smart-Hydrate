import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  TextInput,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar
} from 'react-native';
import { useUser } from '../../context/UserDetailContext';
import useTheme from '../../Theme/theme';

import ThemedButton from '../../components/ThemedButton';
import ThemedText from '../../components/ThemedText';
import ThemedView from '../../components/ThemedView';

export default function EditProfile() {
  const router = useRouter();
  const { user, userDetails, updateUserDetails } = useUser();
  const theme = useTheme();

  // Form state
  const [formData, setFormData] = useState({
    name: userDetails?.name || '',
    email: user?.email || '',
    newEmail: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    age: userDetails?.age?.toString() || '',
    gender: userDetails?.gender || 'male',
    height: userDetails?.height?.toString() || '',
    weight: userDetails?.weight?.toString() || ''
  });

  // UI state
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load user data on mount
  useEffect(() => {
    if (userDetails) {
      setFormData(prev => ({
        ...prev,
        name: userDetails.name || '',
        age: userDetails.age?.toString() || '',
        gender: userDetails.gender || 'male',
        height: userDetails.height?.toString() || '',
        weight: userDetails.weight?.toString() || ''
      }));
    }
  }, [userDetails]);

  // Track changes to show unsaved changes warning
  useEffect(() => {
    const hasChanges = 
      formData.name !== (userDetails?.name || '') ||
      formData.age !== (userDetails?.age?.toString() || '') ||
      formData.gender !== (userDetails?.gender || 'male') ||
      formData.height !== (userDetails?.height?.toString() || '') ||
      formData.weight !== (userDetails?.weight?.toString() || '') ||
      showChangeEmail && formData.newEmail ||
      showChangePassword && (formData.currentPassword || formData.newPassword || formData.confirmPassword);
    
    setHasUnsavedChanges(hasChanges);
  }, [formData, userDetails, showChangeEmail, showChangePassword]);

  // Form validation
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (formData.age && (isNaN(parseInt(formData.age)) || parseInt(formData.age) < 1 || parseInt(formData.age) > 120)) {
      newErrors.age = 'Please enter a valid age (1-120)';
    }

    if (formData.height && (isNaN(parseFloat(formData.height)) || parseFloat(formData.height) < 50 || parseFloat(formData.height) > 300)) {
      newErrors.height = 'Please enter a valid height (50-300 cm)';
    }

    if (formData.weight && (isNaN(parseFloat(formData.weight)) || parseFloat(formData.weight) < 20 || parseFloat(formData.weight) > 500)) {
      newErrors.weight = 'Please enter a valid weight (20-500 kg)';
    }

    if (showChangeEmail) {
      if (!formData.newEmail) {
        newErrors.newEmail = 'New email is required';
      } else if (!/\S+@\S+\.\S+/.test(formData.newEmail)) {
        newErrors.newEmail = 'Please enter a valid email address';
      } else if (formData.newEmail === formData.email) {
        newErrors.newEmail = 'New email must be different from current email';
      }
    }

    if (showChangePassword) {
      if (!formData.currentPassword) {
        newErrors.currentPassword = 'Current password is required';
      }
      if (!formData.newPassword) {
        newErrors.newPassword = 'New password is required';
      } else if (formData.newPassword.length < 6) {
        newErrors.newPassword = 'Password must be at least 6 characters';
      }
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your new password';
      } else if (formData.newPassword !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsSaving(true);

      const updateData = {
        name: formData.name.trim(),
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender,
        height: formData.height ? parseFloat(formData.height) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null
      };

      if (showChangeEmail && formData.newEmail) {
        updateData.newEmail = formData.newEmail.trim();
      }

      if (showChangePassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      await updateUserDetails(updateData);
      
      Alert.alert(
        'Success', 
        'Profile updated successfully!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error updating profile:', error);
      
      let errorMessage = 'Failed to update profile. Please try again.';
      if (error.message?.includes('email')) {
        errorMessage = 'Email update failed. Please check your new email address.';
      } else if (error.message?.includes('password')) {
        errorMessage = 'Password update failed. Please check your current password.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel with unsaved changes warning
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Discard Changes',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => router.back() }
        ]
      );
    } else {
      router.back();
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Custom Toggle Component
  const CustomToggle = ({ value, onValueChange, disabled }) => (
    <TouchableOpacity
      style={[
        styles.customToggle,
        { backgroundColor: value ? theme.primary : theme.border }
      ]}
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
    >
      <View style={[
        styles.customToggleThumb,
        { 
          transform: [{ translateX: value ? 20 : 2 }],
          backgroundColor: 'white'
        }
      ]} />
    </TouchableOpacity>
  );

  // Toggle sections
  const toggleChangeEmail = () => {
    setShowChangeEmail(prev => !prev);
    if (showChangeEmail) {
      handleInputChange('newEmail', '');
      setErrors(prev => ({ ...prev, newEmail: null }));
    }
  };

  const toggleChangePassword = () => {
    setShowChangePassword(prev => !prev);
    if (showChangePassword) {
      handleInputChange('currentPassword', '');
      handleInputChange('newPassword', '');
      handleInputChange('confirmPassword', '');
      setErrors(prev => ({
        ...prev,
        currentPassword: null,
        newPassword: null,
        confirmPassword: null
      }));
    }
  };

  const renderInput = (field, label, placeholder, options = {}) => (
    <View style={styles.inputGroup}>
      <ThemedText style={[styles.label, { color: theme.textMuted }]}>{label}</ThemedText>
      <View style={[
        styles.inputContainer, 
        { borderColor: errors[field] ? '#e74c3c' : theme.border }
      ]}>
        {options.icon && (
          <Ionicons name={options.icon} size={20} color={theme.textMuted} style={styles.icon} />
        )}
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={formData[field]}
          onChangeText={(value) => handleInputChange(field, value)}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          secureTextEntry={options.secure && !showPasswords[options.passwordField]}
          keyboardType={options.keyboardType || 'default'}
          maxLength={options.maxLength}
          editable={!isSaving}
        />
        {options.secure && (
          <TouchableOpacity
            onPress={() => togglePasswordVisibility(options.passwordField)}
            style={styles.eyeIcon}
          >
            <Ionicons 
              name={showPasswords[options.passwordField] ? "eye" : "eye-off"} 
              size={20} 
              color={theme.textMuted} 
            />
          </TouchableOpacity>
        )}
      </View>
      {errors[field] && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={16} color="#e74c3c" />
          <ThemedText style={styles.errorText}>{errors[field]}</ThemedText>
        </View>
      )}
    </View>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.card} />
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity 
            onPress={handleCancel} 
            style={styles.headerButton}
            disabled={isSaving}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText style={[styles.title, { color: theme.text }]}>Edit Profile</ThemedText>
          <TouchableOpacity
            onPress={handleSave}
            style={[
              styles.saveButton,
              { 
                backgroundColor: theme.primary,
                opacity: isSaving ? 0.7 : 1
              }
            ]}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="white" />
                <ThemedText style={styles.saveButtonText}>Save</ThemedText>
              </>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Section */}
          <View style={[styles.profileSection, { backgroundColor: theme.card }]}>
            <View style={styles.profileImageContainer}>
              <View style={[styles.profileImage, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="person" size={50} color={theme.primary} />
              </View>
              <TouchableOpacity 
                style={[styles.editImageButton, { backgroundColor: theme.primary }]}
                disabled={isSaving}
              >
                <Ionicons name="camera" size={16} color="white" />
              </TouchableOpacity>
            </View>
            <View style={styles.profileInfo}>
              <ThemedText style={[styles.profileName, { color: theme.text }]}>
                {formData.name || 'No Name'}
              </ThemedText>
              <ThemedText style={[styles.profileEmail, { color: theme.textMuted }]}>
                {formData.email || 'No Email'}
              </ThemedText>
            </View>
          </View>

          {/* Basic Information */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              Basic Information
            </ThemedText>
            
            {renderInput('name', 'Full Name', 'Enter your full name', {
              icon: 'person-outline',
              maxLength: 50
            })}

            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                {renderInput('age', 'Age', 'Age', {
                  icon: 'calendar-outline',
                  keyboardType: 'numeric',
                  maxLength: 3
                })}
              </View>
              <View style={styles.halfInput}>
                {renderInput('height', 'Height (cm)', 'Height', {
                  icon: 'resize-outline',
                  keyboardType: 'numeric',
                  maxLength: 5
                })}
              </View>
            </View>

            {renderInput('weight', 'Weight (kg)', 'Enter your weight', {
              icon: 'fitness-outline',
              keyboardType: 'numeric',
              maxLength: 5
            })}

            {/* Gender Selection */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: theme.textMuted }]}>Gender</ThemedText>
              <View style={styles.genderContainer}>
                {[
                  { value: 'male', icon: 'man-outline', label: 'Male' },
                  { value: 'female', icon: 'woman-outline', label: 'Female' },
                  { value: 'other', icon: 'people-outline', label: 'Other' }
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.genderButton,
                      { 
                        backgroundColor: formData.gender === option.value ? theme.primary : theme.card,
                        borderColor: formData.gender === option.value ? theme.primary : theme.border
                      }
                    ]}
                    onPress={() => handleInputChange('gender', option.value)}
                    disabled={isSaving}
                  >
                    <Ionicons 
                      name={option.icon} 
                      size={20} 
                      color={formData.gender === option.value ? 'white' : theme.textMuted} 
                    />
                    <ThemedText 
                      style={[
                        styles.genderLabel,
                        { color: formData.gender === option.value ? 'white' : theme.textMuted }
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Email Change Section */}
          <View style={styles.section}>
            <View style={[styles.toggleSection, { backgroundColor: theme.card }]}>
              <View style={styles.toggleHeader}>
                <View style={styles.toggleInfo}>
                  <ThemedText style={[styles.toggleTitle, { color: theme.text }]}>
                    Change Email
                  </ThemedText>
                  <ThemedText style={[styles.toggleSubtitle, { color: theme.textMuted }]}>
                    Update your email address
                  </ThemedText>
                </View>
                <CustomToggle
                  value={showChangeEmail}
                  onValueChange={toggleChangeEmail}
                  disabled={isSaving}
                />
              </View>
              
              {showChangeEmail && (
                <View style={styles.expandedContent}>
                  <View style={[styles.currentInfo, { backgroundColor: theme.background }]}>
                    <ThemedText style={[styles.currentLabel, { color: theme.textMuted }]}>
                      Current: {formData.email}
                    </ThemedText>
                  </View>
                  {renderInput('newEmail', 'New Email', 'Enter new email address', {
                    icon: 'mail-outline',
                    keyboardType: 'email-address'
                  })}
                </View>
              )}
            </View>
          </View>

          {/* Password Change Section */}
          <View style={styles.section}>
            <View style={[styles.toggleSection, { backgroundColor: theme.card }]}>
              <View style={styles.toggleHeader}>
                <View style={styles.toggleInfo}>
                  <ThemedText style={[styles.toggleTitle, { color: theme.text }]}>
                    Change Password
                  </ThemedText>
                  <ThemedText style={[styles.toggleSubtitle, { color: theme.textMuted }]}>
                    Update your account password
                  </ThemedText>
                </View>
                <CustomToggle
                  value={showChangePassword}
                  onValueChange={toggleChangePassword}
                  disabled={isSaving}
                />
              </View>
              
              {showChangePassword && (
                <View style={styles.expandedContent}>
                  {renderInput('currentPassword', 'Current Password', 'Enter current password', {
                    icon: 'lock-closed-outline',
                    secure: true,
                    passwordField: 'current'
                  })}
                  {renderInput('newPassword', 'New Password', 'Enter new password', {
                    icon: 'lock-closed-outline',
                    secure: true,
                    passwordField: 'new'
                  })}
                  {renderInput('confirmPassword', 'Confirm Password', 'Confirm new password', {
                    icon: 'lock-closed-outline',
                    secure: true,
                    passwordField: 'confirm'
                  })}
                </View>
              )}
            </View>
          </View>

          <View style={{ height: 50 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginBottom: 8,
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
  },
  editImageButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    alignItems: 'center',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  profileEmail: {
    fontSize: 14,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    minHeight: 20,
  },
  eyeIcon: {
    padding: 4,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginLeft: 4,
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  genderLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleSection: {
    borderRadius: 12,
    padding: 20,
  },
  toggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontSize: 13,
  },
  customToggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    position: 'relative',
  },
  customToggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    position: 'absolute',
  },
  expandedContent: {
    marginTop: 20,
  },
  currentInfo: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  currentLabel: {
    fontSize: 14,
  },
});