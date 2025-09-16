// app/auth/signUp.jsx
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View, TouchableOpacity, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, firestore, FieldValue, WaterBottleService } from '../../config/firebaseConfig';
import { useUser } from '../../context/UserDetailContext';
import useTheme from '../../Theme/theme';
import { StorageHelper } from '../../utils/storage';

import ThemedButton from '../../components/ThemedButton';
import ThemedText from '../../components/ThemedText';
import ThemedTextInput from '../../components/ThemedTextInput';
import ThemedView from '../../components/ThemedView';

export default function SignUp() {
  // Basic account fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Health and hydration profile fields
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [gender, setGender] = useState('');
  const [activityLevel, setActivityLevel] = useState('moderate');
  const [dailyWaterGoal, setDailyWaterGoal] = useState('');
  const [wakeUpTime, setWakeUpTime] = useState('07:00');
  const [bedTime, setBedTime] = useState('22:00');
  const [reminderInterval, setReminderInterval] = useState('60');
  const [healthConditions, setHealthConditions] = useState('');
  const [medications, setMedications] = useState('');
  const [preferredTemperature, setPreferredTemperature] = useState('room');

  // UI state
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showWakeTimePicker, setShowWakeTimePicker] = useState(false);
  const [showBedTimePicker, setShowBedTimePicker] = useState(false);

  const router = useRouter();
  const theme = useTheme();
  const { refreshUserDetails } = useUser();

  // === VALIDATION ===
  const validateStep1 = useCallback(() => {
    if (!name.trim()) {
      showErrorMessage('Please enter your full name');
      return false;
    }
    if (!email.trim()) {
      showErrorMessage('Please enter your email address');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showErrorMessage('Please enter a valid email address');
      return false;
    }
    if (password.length < 6) {
      showErrorMessage('Password must be at least 6 characters long');
      return false;
    }
    if (password !== confirmPassword) {
      showErrorMessage('Passwords do not match');
      return false;
    }
    return true;
  }, [name, email, password, confirmPassword]);

  const validateStep2 = useCallback(() => {
    if (!age || isNaN(age) || age < 1 || age > 120) {
      showErrorMessage('Please enter a valid age (1-120)');
      return false;
    }
    if (!weight || isNaN(weight) || weight < 20 || weight > 300) {
      showErrorMessage('Please enter a valid weight in kg (20-300)');
      return false;
    }
    if (!height || isNaN(height) || height < 100 || height > 250) {
      showErrorMessage('Please enter a valid height in cm (100-250)');
      return false;
    }
    if (!gender) {
      showErrorMessage('Please select your gender');
      return false;
    }
    return true;
  }, [age, weight, height, gender]);

  // === CALCULATION ===
  const calculateDailyWaterGoal = useCallback(() => {
    const weightNum = parseFloat(weight);
    const ageNum = parseInt(age);

    let baseAmount = weightNum * 35;

    if (ageNum > 65) baseAmount *= 0.9;
    if (ageNum < 18) baseAmount *= 1.1;

    const activityMultipliers = {
      sedentary: 1.0,
      light: 1.1,
      moderate: 1.2,
      active: 1.3,
      very_active: 1.4,
    };

    baseAmount *= activityMultipliers[activityLevel];
    return Math.round(baseAmount);
  }, [weight, age, activityLevel]);

  // === HANDLERS ===
  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword((prev) => !prev);

  const formatTime = (time) => {
    const [hours, minutes] = time.split(':');
    const hour12 = hours % 12 || 12;
    const ampm = hours < 12 ? 'AM' : 'PM';
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleTimeSelect = (type, hour, minute) => {
    const formattedTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    if (type === 'wake') {
      setWakeUpTime(formattedTime);
      setShowWakeTimePicker(false);
    } else {
      setBedTime(formattedTime);
      setShowBedTimePicker(false);
    }
  };

  const renderTimePicker = (type, currentTime, visible, onClose) => {
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from({ length: 60 }, (_, i) => i);

    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.timePickerOverlay}>
          <View style={[styles.timePickerContainer, { backgroundColor: theme.card }]}>
            <ThemedText style={[styles.timePickerTitle, { color: theme.primary }]}>
              Select {type === 'wake' ? 'Wake Up' : 'Bed'} Time
            </ThemedText>
            
            <View style={styles.timePickerContent}>
              <View style={styles.timeColumn}>
                <ThemedText style={[styles.timeColumnLabel, { color: theme.text }]}>Hour</ThemedText>
                <ScrollView style={styles.timeScrollView} showsVerticalScrollIndicator={false}>
                  {hours.map((hour) => (
                    <TouchableOpacity
                      key={hour}
                      style={[
                        styles.timeOption,
                        hour === currentHour && { backgroundColor: theme.primary + '20' }
                      ]}
                      onPress={() => handleTimeSelect(type, hour, currentMinute)}
                    >
                      <ThemedText style={[
                        styles.timeOptionText,
                        { color: hour === currentHour ? theme.primary : theme.text }
                      ]}>
                        {hour.toString().padStart(2, '0')}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              
              <ThemedText style={[styles.timeSeparator, { color: theme.text }]}>:</ThemedText>
              
              <View style={styles.timeColumn}>
                <ThemedText style={[styles.timeColumnLabel, { color: theme.text }]}>Minute</ThemedText>
                <ScrollView style={styles.timeScrollView} showsVerticalScrollIndicator={false}>
                  {minutes.filter(m => m % 5 === 0).map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[
                        styles.timeOption,
                        minute === currentMinute && { backgroundColor: theme.primary + '20' }
                      ]}
                      onPress={() => handleTimeSelect(type, currentHour, minute)}
                    >
                      <ThemedText style={[
                        styles.timeOptionText,
                        { color: minute === currentMinute ? theme.primary : theme.text }
                      ]}>
                        {minute.toString().padStart(2, '0')}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            
            <View style={styles.timePickerButtons}>
              <ThemedButton
                title="Cancel"
                onPress={onClose}
                style={[styles.timePickerButton, styles.cancelButton]}
              />
              <ThemedButton
                title="Done"
                onPress={onClose}
                style={styles.timePickerButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const nextStep = useCallback(() => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    }
  }, [currentStep, validateStep1]);

  const prevStep = useCallback(() => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  }, [currentStep]);

  const showErrorMessage = (msg) => {
    setMessage(msg);
    setMessageType('error');
    setModalVisible(true);
  };

  const showSuccessMessage = (msg) => {
    setMessage(msg);
    setMessageType('success');
    setModalVisible(true);
  };

  const handleModalClose = useCallback(() => {
    setModalVisible(false);
    if (messageType === 'success') {
      router.replace('/homepage');
    }
  }, [messageType, router]);

  // === MAIN SIGNUP ===
  const CreateNewAccount = useCallback(async () => {
    if (!validateStep1() || !validateStep2()) return;

    setIsLoading(true);
    try {
      const resp = await auth.createUserWithEmailAndPassword(email, password);
      const user = resp.user;
      await SaveUser(user);
    } catch (error) {
      let errorMessage = error.message;
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists. Please sign in instead.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
      }
      showErrorMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [email, password, validateStep1, validateStep2]);

  const SaveUser = async (user) => {
    try {
      console.log('🔄 Starting to save user data for:', user.uid);

      if (!user || !user.uid) throw new Error('Invalid user object or missing UID');

      const calculatedGoal = dailyWaterGoal || calculateDailyWaterGoal();
      console.log('📊 Calculated daily goal:', calculatedGoal);

      // Create user profile using WaterBottleService first
      console.log('🔄 Creating WaterBottleService profile...');
      const waterBottleService = new WaterBottleService(user.uid);
      await waterBottleService.createUserProfile({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        dailyGoal: calculatedGoal,
        weight: parseFloat(weight),
        age: parseInt(age),
        height: parseFloat(height),
        activityLevel: activityLevel,
        gender: gender,
      });
      console.log('✅ WaterBottleService profile created successfully');

      // Save to Firestore with authentication context
      console.log('🔄 Saving to Firestore...');
      const userData = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        member: false,
        uid: user.uid,
        createdAt: FieldValue.serverTimestamp(),
        profileComplete: true,
        lastLoginAt: FieldValue.serverTimestamp(),
        accountStatus: 'active',

        profile: {
          age: parseInt(age),
          weight: parseFloat(weight),
          height: parseFloat(height),
          gender: gender,
          activityLevel: activityLevel,
          healthConditions: healthConditions.trim(),
          medications: medications.trim(),
        },

        hydrationSettings: {
          dailyWaterGoal: calculatedGoal,
          preferredTemperature: preferredTemperature,
          wakeUpTime: wakeUpTime,
          bedTime: bedTime,
          reminderInterval: parseInt(reminderInterval),
          notificationsEnabled: true,
          smartReminders: true,
        },

        deviceSettings: {
          connectedBottles: [],
          temperatureUnit: 'celsius',
          volumeUnit: 'ml',
          syncEnabled: true,
          bluetoothEnabled: true,
        },

        analytics: {
          totalDaysTracked: 0,
          averageDailyIntake: 0,
          goalAchievementRate: 0,
          preferredDrinkingTimes: [],
          lastBottleSync: null,
        },

        preferences: {
          dataSharing: false,
          healthInsights: true,
          weeklyReports: true,
          friendsFeature: false,
        },
      };

      // Try to save to Firestore with better error handling
      try {
        await firestore.collection('users').doc(user.uid).set(userData);
        console.log('✅ Firestore user document created successfully');
      } catch (firestoreError) {
        console.error('❌ Firestore write error:', firestoreError);
        
        // Check if it's a permissions error
        if (firestoreError.code === 'permission-denied') {
          console.log('⚠️ Firestore permissions denied - continuing with Realtime Database only');
          showErrorMessage('Account created successfully, but some features may be limited due to database permissions. Please contact support if issues persist.');
        } else {
          // Re-throw other Firestore errors
          throw firestoreError;
        }
      }

      // Initialize daily tracking in Firestore (if permissions allow)
      try {
        const today = new Date().toISOString().split('T')[0];
        await firestore.collection('dailyTracking').doc(`${user.uid}_${today}`).set({
          userId: user.uid,
          date: today,
          waterIntake: 0,
          goal: calculatedGoal,
          drinkingEvents: [],
          bottleData: {
            temperatureReadings: [],
            movementEvents: [],
            lastSync: null,
          },
          achievements: [],
          createdAt: FieldValue.serverTimestamp(),
        });
        console.log('✅ Daily tracking document created successfully');
      } catch (dailyTrackingError) {
        console.error('❌ Daily tracking creation error:', dailyTrackingError);
        // Don't fail the entire process for this
        console.log('⚠️ Continuing without daily tracking document...');
      }

      // Create initial bottle reading with realistic new user data
      console.log('🔄 Creating initial bottle reading...');
      try {
        // Don't create any initial reading for new users
        // Let them start with truly empty data
        console.log('✅ Skipping initial bottle reading for new user - they should start empty');
      } catch (realtimeError) {
        console.error('❌ Realtime Database error:', realtimeError);
        // Don't fail for this either, but log it
        console.log('⚠️ Continuing without initial bottle reading...');
      }

      // Mark as not first time user
      try {
        await StorageHelper.setNotFirstTimeUser();
        console.log('✅ Marked user as completed onboarding');
      } catch (storageError) {
        console.error('❌ Storage error:', storageError);
        // Continue even if this fails
      }

      // Refresh context
      if (refreshUserDetails) {
        try {
          await refreshUserDetails();
          console.log('✅ User details refreshed');
        } catch (refreshError) {
          console.error('❌ Context refresh error:', refreshError);
          // Continue even if this fails
        }
      }

      showSuccessMessage('Account created successfully! Welcome to your hydration journey!');

      // Clear form
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setAge('');
      setWeight('');
      setHeight('');
      setGender('');

      console.log('🎉 User creation process completed successfully');

      // Navigate after delay
      setTimeout(() => {
        console.log('🔄 Navigating to homepage...');
        router.replace('/homepage');
      }, 2000);
    } catch (error) {
      console.error('❌ Error saving user data:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Account created but there was an error setting up your profile. ';
      
      if (error.code === 'permission-denied') {
        errorMessage += 'This appears to be a database permissions issue. Please contact support.';
      } else if (error.code === 'network-request-failed') {
        errorMessage += 'Please check your internet connection and try signing in.';
      } else {
        errorMessage += `Error details: ${error.message}. Please try signing in.`;
      }
      
      showErrorMessage(errorMessage);
    }
  };

  // === RENDERING ===
  const renderStep1 = () => (
    <>
      <ThemedText style={[styles.stepTitle, { color: theme.primary }]}>Account Information</ThemedText>

      <View style={styles.inputContainer}>
        <ThemedText style={[styles.inputLabel, { color: theme.text }]}>Full Name</ThemedText>
        <ThemedTextInput
          placeholder="Enter your full name"
          value={name}
          onChangeText={setName}
          editable={!isLoading}
          style={styles.input}
          accessibilityLabel="Full name input"
        />
      </View>

      <View style={styles.inputContainer}>
        <ThemedText style={[styles.inputLabel, { color: theme.text }]}>Email Address</ThemedText>
        <ThemedTextInput
          placeholder="Enter your email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          editable={!isLoading}
          style={styles.input}
          accessibilityLabel="Email input"
        />
      </View>

      {/* PASSWORD WITH EYE ICON */}
      <View style={styles.inputContainer}>
        <ThemedText style={[styles.inputLabel, { color: theme.text }]}>Password</ThemedText>
        <View style={styles.passwordContainer}>
          <ThemedTextInput
            placeholder="Create a strong password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!isLoading}
            style={[styles.input, styles.passwordInput]}
            accessibilityLabel="Password input"
          />
          <TouchableOpacity
            onPress={togglePasswordVisibility}
            style={styles.eyeIcon}
            disabled={isLoading}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={24}
              color={theme.text || '#666'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* CONFIRM PASSWORD WITH EYE ICON */}
      <View style={styles.inputContainer}>
        <ThemedText style={[styles.inputLabel, { color: theme.text }]}>Confirm Password</ThemedText>
        <View style={styles.passwordContainer}>
          <ThemedTextInput
            placeholder="Confirm your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            editable={!isLoading}
            style={[styles.input, styles.passwordInput]}
            accessibilityLabel="Confirm password input"
          />
          <TouchableOpacity
            onPress={toggleConfirmPasswordVisibility}
            style={styles.eyeIcon}
            disabled={isLoading}
            accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            accessibilityRole="button"
          >
            <Ionicons
              name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
              size={24}
              color={theme.text || '#666'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ThemedButton
        title="Next: Health Profile"
        onPress={nextStep}
        style={styles.stepButton}
        accessibilityLabel="Go to health profile step"
      />
    </>
  );

  const renderStep2 = () => (
    <>
      <ThemedText style={[styles.stepTitle, styles.stepTitleLower, { color: theme.primary }]}>
        Health & Hydration Profile
      </ThemedText>

      <View style={styles.row}>
        <View style={styles.halfInputContainer}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>Age</ThemedText>
          <ThemedTextInput
            placeholder="Your age"
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
            style={styles.halfInput}
            editable={!isLoading}
            accessibilityLabel="Age input"
          />
        </View>
        <View style={styles.halfInputContainer}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>Weight (kg)</ThemedText>
          <ThemedTextInput
            placeholder="Weight in kg"
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
            style={styles.halfInput}
            editable={!isLoading}
            accessibilityLabel="Weight input"
          />
        </View>
      </View>

      <View style={styles.inputContainer}>
        <ThemedText style={[styles.inputLabel, { color: theme.text }]}>Height (cm)</ThemedText>
        <ThemedTextInput
          placeholder="Height in centimeters"
          value={height}
          onChangeText={setHeight}
          keyboardType="numeric"
          editable={!isLoading}
          style={styles.input}
          accessibilityLabel="Height input"
        />
      </View>

      {/* GENDER FIELD */}
      <View style={styles.pickerContainer}>
        <ThemedText style={styles.label}>Gender:</ThemedText>
        <View style={styles.buttonGroup}>
          {[
            { key: 'male', label: 'Male' },
            { key: 'female', label: 'Female' },
            { key: 'other', label: 'Other' },
          ].map((option) => (
            <Pressable
              key={option.key}
              style={[
                styles.genderButton,
                gender === option.key && { backgroundColor: theme.primary },
              ]}
              onPress={() => setGender(option.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: gender === option.key }}
              accessibilityLabel={option.label}
            >
              <ThemedText
                style={[
                  styles.genderButtonText,
                  gender === option.key && { color: 'white' },
                ]}
              >
                {option.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.pickerContainer}>
        <ThemedText style={styles.label}>Activity Level:</ThemedText>
        <View style={styles.buttonGroup}>
          {['sedentary', 'light', 'moderate', 'active', 'very_active'].map((level) => (
            <Pressable
              key={level}
              style={[
                styles.activityButton,
                activityLevel === level && { backgroundColor: theme.primary },
              ]}
              onPress={() => setActivityLevel(level)}
              accessibilityRole="radio"
              accessibilityState={{ selected: activityLevel === level }}
              accessibilityLabel={level.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            >
              <ThemedText
                style={[
                  styles.activityButtonText,
                  activityLevel === level && { color: 'white' },
                ]}
              >
                {level.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.halfInputContainer}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>Wake Up Time</ThemedText>
          <TouchableOpacity
            style={[styles.timeButton, { borderColor: theme.border || '#ddd' }]}
            onPress={() => setShowWakeTimePicker(true)}
            disabled={isLoading}
          >
            <ThemedText style={[styles.timeButtonText, { color: theme.text }]}>
              {formatTime(wakeUpTime)}
            </ThemedText>
            <Ionicons name="time-outline" size={20} color={theme.text || '#666'} />
          </TouchableOpacity>
        </View>
        <View style={styles.halfInputContainer}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>Bed Time</ThemedText>
          <TouchableOpacity
            style={[styles.timeButton, { borderColor: theme.border || '#ddd' }]}
            onPress={() => setShowBedTimePicker(true)}
            disabled={isLoading}
          >
            <ThemedText style={[styles.timeButtonText, { color: theme.text }]}>
              {formatTime(bedTime)}
            </ThemedText>
            <Ionicons name="time-outline" size={20} color={theme.text || '#666'} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputContainer}>
        <ThemedText style={[styles.inputLabel, { color: theme.text }]}>Reminder Interval</ThemedText>
        <ThemedTextInput
          placeholder="Reminder interval in minutes (e.g., 60)"
          value={reminderInterval}
          onChangeText={setReminderInterval}
          keyboardType="numeric"
          editable={!isLoading}
          style={styles.input}
          accessibilityLabel="Reminder interval input"
        />
      </View>

      <View style={styles.inputContainer}>
        <ThemedText style={[styles.inputLabel, { color: theme.text }]}>Health Conditions (Optional)</ThemedText>
        <ThemedTextInput
          placeholder="Any health conditions we should know about"
          value={healthConditions}
          onChangeText={setHealthConditions}
          multiline
          editable={!isLoading}
          style={styles.input}
          accessibilityLabel="Health conditions input"
        />
      </View>

      <View style={styles.inputContainer}>
        <ThemedText style={[styles.inputLabel, { color: theme.text }]}>Current Medications (Optional)</ThemedText>
        <ThemedTextInput
          placeholder="List any medications you're currently taking"
          value={medications}
          onChangeText={setMedications}
          multiline
          editable={!isLoading}
          style={styles.input}
          accessibilityLabel="Medications input"
        />
      </View>

      {/* Time Pickers */}
      {renderTimePicker('wake', wakeUpTime, showWakeTimePicker, () => setShowWakeTimePicker(false))}
      {renderTimePicker('bed', bedTime, showBedTimePicker, () => setShowBedTimePicker(false))}

      <View style={styles.buttonRow}>
        <ThemedButton
          title="Back"
          onPress={prevStep}
          style={[styles.stepButton, styles.backButton]}
          accessibilityLabel="Go back to account info"
        />
        <ThemedButton
          title={isLoading ? 'Creating Account...' : 'Create Account'}
          onPress={CreateNewAccount}
          disabled={isLoading}
          style={[styles.stepButton, isLoading && { backgroundColor: '#aaa' }]}
          accessibilityLabel="Create account"
        />
      </View>
    </>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <ThemedText style={[styles.title, { color: theme.primary }]}>
          Smart Water Bottle Setup
        </ThemedText>

        <View style={styles.progressContainer}>
          <View style={[styles.progressDot, currentStep >= 1 && { backgroundColor: theme.primary }]} />
          <View style={[styles.progressLine, currentStep >= 2 && { backgroundColor: theme.primary }]} />
          <View style={[styles.progressDot, currentStep >= 2 && { backgroundColor: theme.primary }]} />
        </View>

        {currentStep === 1 ? renderStep1() : renderStep2()}

        <View style={styles.bottomTextContainer}>
          <ThemedText style={styles.buttonSecondaryText}>Already have an account? </ThemedText>
          <Pressable
            onPress={() => router.push('/auth/signIn')}
            disabled={isLoading}
            accessibilityRole="link"
          >
            <ThemedText style={[styles.signInLink, { color: theme.primary }]}>Sign In</ThemedText>
          </Pressable>
        </View>
      </ScrollView>

      {modalVisible && (
        <View style={styles.modalOverlay} accessibilityLiveRegion="assertive">
          <View style={[styles.modalBox, { backgroundColor: theme.card }]}>
            <ThemedText
              style={[
                styles.modalText,
                messageType === 'success'
                  ? { color: theme.success || '#155724' }
                  : { color: theme.error || '#721c24' },
              ]}
            >
              {message}
            </ThemedText>
            <ThemedButton
              title="OK"
              onPress={handleModalClose}
              style={{ backgroundColor: theme.primary, width: 100, marginTop: 16 }}
              accessibilityLabel="Close message"
            />
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  stepTitleLower: {
    marginTop: 20,
    marginBottom: 32,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ddd',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#ddd',
    marginHorizontal: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    borderRadius: 10,
    marginBottom: 0,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: '50%',
    transform: [{ translateY: -12 }],
    zIndex: 1,
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  halfInputContainer: {
    flex: 1,
  },
  halfInput: {
    borderRadius: 10,
    marginBottom: 0,
  },
  pickerContainer: {
    marginVertical: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    minWidth: 80,
    alignItems: 'center',
  },
  activityButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  genderButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    minWidth: 80,
    alignItems: 'center',
  },
  genderButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  stepButton: {
    marginTop: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  backButton: {
    backgroundColor: '#666',
    flex: 1,
  },
  bottomTextContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  buttonSecondaryText: {
    fontSize: 16,
    fontWeight: '500',
  },
  signInLink: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  modalBox: {
    width: '80%',
    padding: 20,
    borderRadius: 10,
    elevation: 10,
    alignItems: 'center',
  },
  modalText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  // Time Picker Styles
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: 'transparent',
    minHeight: 48,
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  timePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerContainer: {
    width: '85%',
    maxHeight: '70%',
    borderRadius: 15,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  timePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  timeColumn: {
    alignItems: 'center',
    width: 80,
  },
  timeColumnLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  timeScrollView: {
    maxHeight: 200,
    borderRadius: 8,
  },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
    alignItems: 'center',
    minWidth: 60,
  },
  timeOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    marginHorizontal: 15,
    marginTop: 25,
  },
  timePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  timePickerButton: {
    flex: 1,
    paddingVertical: 12,
  },
  cancelButton: {
    backgroundColor: '#666',
  },
});