import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  TouchableWithoutFeedback,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  SafeAreaView,
  Image,
  Modal,
  Dimensions
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useUser } from '../context/UserDetailContext';
import useTheme from '../Theme/theme';

// Import Supabase and Firebase directly
import { supabase } from '../config/supabaseConfig';
import { firestore } from '../config/firebaseConfig';

import ThemedButton from '../components/ThemedButton';
import ThemedText from '../components/ThemedText';
import ThemedView from '../components/ThemedView';

const { width } = Dimensions.get('window');

export default function EditProfile() {
  const router = useRouter();
  const { user, userDetails, updateUserDetails, refreshUserDetails } = useUser();
  const theme = useTheme();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    newEmail: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    age: '',
    gender: 'male',
    height: '',
    weight: '',
    profileImage: null
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
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [errors, setErrors] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load user data on mount
  useEffect(() => {
    if (userDetails && user) {
      setFormData(prev => ({
        ...prev,
        name: userDetails.name || '',
        email: user.email || '',
        age: userDetails.profile?.age?.toString() || '',
        gender: userDetails.profile?.gender || 'male',
        height: userDetails.profile?.height?.toString() || '',
        weight: userDetails.profile?.weight?.toString() || '',
        profileImage: userDetails.profilePicture || null
      }));
    }
  }, [userDetails, user]);

  // Request permissions
  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to upload profile pictures.');
      }
    })();
  }, []);

  // Track changes to show unsaved changes warning
  useEffect(() => {
    const originalData = {
      name: userDetails?.name || '',
      age: userDetails?.profile?.age?.toString() || '',
      gender: userDetails?.profile?.gender || 'male',
      height: userDetails?.profile?.height?.toString() || '',
      weight: userDetails?.profile?.weight?.toString() || '',
      profileImage: userDetails?.profilePicture || null
    };

    const hasChanges = 
      formData.name !== originalData.name ||
      formData.age !== originalData.age ||
      formData.gender !== originalData.gender ||
      formData.height !== originalData.height ||
      formData.weight !== originalData.weight ||
      formData.profileImage !== originalData.profileImage ||
      (showChangeEmail && formData.newEmail) ||
      (showChangePassword && (formData.currentPassword || formData.newPassword || formData.confirmPassword));
    
    setHasUnsavedChanges(hasChanges);
  }, [formData, userDetails, showChangeEmail, showChangePassword]);

  // Handle image upload - Matching UserTab implementation
  const uploadImage = async (uri) => {
    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setIsUploadingImage(true);
    console.log('Starting upload process...');
    console.log('Image URI:', uri);
    console.log('User UID:', user.uid);

    try {
      // Test Supabase connection first
      console.log('Testing Supabase connection...');
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      if (bucketsError) {
        console.error('Cannot connect to Supabase:', bucketsError);
        throw new Error('Cannot connect to storage service');
      }
      console.log('Supabase connection OK, buckets:', buckets?.map(b => b.name));

      // Check if our bucket exists
      const profileBucket = buckets?.find(b => b.name === 'profile-images');
      if (!profileBucket) {
        throw new Error('profile-images bucket not found');
      }

      // Compress and resize image
      console.log('Compressing image...');
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 400, height: 400 } }],
        { 
          compress: 0.8, 
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );
      console.log('Image compressed:', manipulatedImage.uri);

      // Create unique filename
      const fileName = `profile_${user.uid}_${Date.now()}.jpg`;
      console.log('Filename:', fileName);

      // Convert to ArrayBuffer
      console.log('Converting to ArrayBuffer...');
      const response = await fetch(manipulatedImage.uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      console.log('ArrayBuffer size:', arrayBuffer.byteLength);

      // Delete old profile picture if exists
      if (userDetails?.profilePicture) {
        try {
          console.log('Attempting to delete old image...');
          const urlParts = userDetails.profilePicture.split('/');
          const oldFileName = urlParts[urlParts.length - 1].split('?')[0];
          
          if (oldFileName && oldFileName.startsWith('profile_')) {
            console.log('Deleting old file:', oldFileName);
            const { error: deleteError } = await supabase.storage
              .from('profile-images')
              .remove([oldFileName]);
            
            if (deleteError) {
              console.warn('Could not delete old image:', deleteError);
            } else {
              console.log('Old image deleted successfully');
            }
          }
        } catch (deleteError) {
          console.warn('Error deleting old image:', deleteError);
        }
      }

      // Upload using ArrayBuffer
      console.log('Uploading to Supabase...');
      const { data, error } = await supabase.storage
        .from('profile-images')
        .upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) {
        console.error('Supabase upload error details:', {
          message: error.message,
          statusCode: error.statusCode,
          error: error
        });
        throw new Error(`Upload failed: ${error.message}`);
      }

      console.log('Upload successful:', data);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(fileName);

      console.log('Public URL:', publicUrl);

      // Verify the URL is accessible
      try {
        const testResponse = await fetch(publicUrl, { method: 'HEAD' });
        if (!testResponse.ok) {
          console.warn('Uploaded image may not be accessible:', testResponse.status);
        }
      } catch (urlError) {
        console.warn('Could not verify image URL:', urlError);
      }

      // Update Firebase user document
      console.log('Updating Firebase document...');
      await firestore.collection('users').doc(user.uid).update({
        profilePicture: publicUrl,
        updatedAt: new Date().toISOString(),
      });

      await refreshUserDetails();
      Alert.alert('Success', 'Profile picture updated successfully!');
    } catch (error) {
      console.error('Full error details:', error);
      
      // More specific error handling
      if (error.message?.includes('Network request failed')) {
        Alert.alert(
          'Network Error', 
          'Cannot connect to storage service. Please check your internet connection and try again.'
        );
      } else if (error.message?.includes('bucket not found')) {
        Alert.alert(
          'Configuration Error', 
          'Storage bucket not found. Please contact support.'
        );
      } else if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
        Alert.alert(
          'Permission Error', 
          'You don\'t have permission to upload images. Please contact support.'
        );
      } else if (error.message?.includes('fetch image')) {
        Alert.alert(
          'Image Error', 
          'Could not process the selected image. Please try a different image.'
        );
      } else {
        Alert.alert(
          'Upload Error', 
          `Failed to update profile picture: ${error.message}`
        );
      }
    } finally {
      setIsUploadingImage(false);
      setShowImagePicker(false);
    }
  };

  // Request permissions helper
  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'We need camera and photo library permissions to set your profile picture.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  // Handle camera photo
  const takePhoto = async () => {
    setShowImagePicker(false);
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  // Handle gallery selection
  const pickFromGallery = async () => {
    setShowImagePicker(false);
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

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

      if (!formData.currentPassword) {
        newErrors.currentPassword = 'Current password is required to change email';
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

      // Prepare update data
      const updateData = {
        name: formData.name.trim(),
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender,
        height: formData.height ? parseFloat(formData.height) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        profileImage: formData.profileImage
      };

      // Add email change if requested
      if (showChangeEmail && formData.newEmail && formData.currentPassword) {
        updateData.newEmail = formData.newEmail.trim();
        updateData.currentPassword = formData.currentPassword;
      }

      // Add password change if requested
      if (showChangePassword && formData.currentPassword && formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      console.log('Updating profile with data:', updateData);

      const result = await updateUserDetails(updateData);
      
      console.log('Update result:', result);

      let successMessage = 'Profile updated successfully!';
      if (result.authSuccess) {
        if (updateData.newEmail) {
          successMessage += ' Your email has been changed.';
        }
        if (updateData.newPassword) {
          successMessage += ' Your password has been changed.';
        }
      }

      Alert.alert(
        'Success', 
        successMessage,
        [{ text: 'OK', onPress: () => router.back() }]
      );

      // Clear sensitive data
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        newEmail: showChangeEmail ? formData.newEmail : ''
      }));

      // Reset toggle states
      setShowChangeEmail(false);
      setShowChangePassword(false);

    } catch (error) {
      console.error('Error updating profile:', error);
      
      let errorMessage = 'Failed to update profile. Please try again.';
      
      if (error.message?.includes('email')) {
        errorMessage = 'Email update failed. Please check your current password and new email address.';
      } else if (error.message?.includes('password')) {
        errorMessage = 'Password update failed. Please check your current password.';
      } else if (error.message?.includes('auth/wrong-password')) {
        errorMessage = 'Current password is incorrect.';
      } else if (error.message?.includes('auth/email-already-in-use')) {
        errorMessage = 'This email is already in use by another account.';
      } else if (error.message?.includes('auth/weak-password')) {
        errorMessage = 'The new password is too weak. Please choose a stronger password.';
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
      handleInputChange('currentPassword', '');
      setErrors(prev => ({ 
        ...prev, 
        newEmail: null,
        currentPassword: null
      }));
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
          autoCapitalize={options.autoCapitalize || 'sentences'}
          autoCorrect={options.autoCorrect !== false}
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

  // Image Picker Modal Component
  const ImagePickerModal = () => (
    <Modal
      visible={showImagePicker}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowImagePicker(false)}
    >
      <TouchableWithoutFeedback onPress={() => setShowImagePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
              Choose Profile Picture
            </ThemedText>
            
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={takePhoto}
            >
              <Ionicons name="camera" size={24} color={theme.primary} />
              <ThemedText style={[styles.modalOptionText, { color: theme.text }]}>
                Take Photo
              </ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={pickFromGallery}
            >
              <Ionicons name="images" size={24} color={theme.primary} />
              <ThemedText style={[styles.modalOptionText, { color: theme.text }]}>
                Choose from Gallery
              </ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalOption, styles.modalCancel]}
              onPress={() => setShowImagePicker(false)}
            >
              <Ionicons name="close" size={24} color={theme.textMuted} />
              <ThemedText style={[styles.modalOptionText, { color: theme.textMuted }]}>
                Cancel
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
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
              {userDetails?.profilePicture ? (
                <Image 
                  source={{ uri: userDetails.profilePicture }} 
                  style={styles.profileImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.profileIcon, { backgroundColor: theme.primary }]}>
                  <Ionicons name="person" size={50} color="white" />
                </View>
              )}
              
              {isUploadingImage && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              )}
              
              <TouchableOpacity
                style={[styles.cameraButton, { backgroundColor: theme.primary }]}
                onPress={() => setShowImagePicker(true)}
                disabled={isSaving || isUploadingImage}
              >
                <Ionicons name="camera" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.profileTextInfo}>
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
                    keyboardType: 'email-address',
                    autoCapitalize: 'none'
                  })}
                  {renderInput('currentPassword', 'Current Password', 'Enter current password to confirm', {
                    icon: 'lock-closed-outline',
                    secure: true,
                    passwordField: 'current'
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

        {/* Image Picker Modal */}
        <ImagePickerModal />
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
    paddingTop: Platform.OS === 'ios' ? 10 : StatusBar.currentHeight || 20,
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
    marginBottom: 8,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profileIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  profileTextInfo: {
    alignItems: 'center',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  profileEmail: {
    fontSize: 16,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  eyeIcon: {
    padding: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginLeft: 6,
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  genderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  genderLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleSection: {
    borderRadius: 16,
    padding: 16,
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
    marginBottom: 4,
  },
  toggleSubtitle: {
    fontSize: 12,
  },
  customToggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  customToggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 3,
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  currentInfo: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  currentLabel: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  modalCancel: {
    marginTop: 8,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 16,
  },
});