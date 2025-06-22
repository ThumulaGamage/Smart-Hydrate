import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { auth, db } from '../../config/firebaseConfig';
import { useUser } from '../../context/UserDetailContext';
import useTheme from '../../Theme/theme';

// Themed Components
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
  
  // Health and hydration profile fields
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [activityLevel, setActivityLevel] = useState('moderate'); // sedentary, light, moderate, active, very_active
  const [dailyWaterGoal, setDailyWaterGoal] = useState('');
  const [wakeUpTime, setWakeUpTime] = useState('07:00');
  const [bedTime, setBedTime] = useState('22:00');
  const [reminderInterval, setReminderInterval] = useState('60'); // minutes
  const [healthConditions, setHealthConditions] = useState('');
  const [medications, setMedications] = useState('');
  const [preferredTemperature, setPreferredTemperature] = useState('room'); // cold, cool, room, warm
  
  // UI state
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // Multi-step form

  const router = useRouter();
  const theme = useTheme();
  const { refreshUserDetails } = useUser();

  const validateStep1 = () => {
    if (!name.trim()) {
      setMessage('Please enter your full name');
      setMessageType('error');
      setModalVisible(true);
      return false;
    }
    if (!email.trim()) {
      setMessage('Please enter your email address');
      setMessageType('error');
      setModalVisible(true);
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage('Please enter a valid email address');
      setMessageType('error');
      setModalVisible(true);
      return false;
    }
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters long');
      setMessageType('error');
      setModalVisible(true);
      return false;
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      setMessageType('error');
      setModalVisible(true);
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!age || isNaN(age) || age < 1 || age > 120) {
      setMessage('Please enter a valid age (1-120)');
      setMessageType('error');
      setModalVisible(true);
      return false;
    }
    if (!weight || isNaN(weight) || weight < 20 || weight > 300) {
      setMessage('Please enter a valid weight in kg (20-300)');
      setMessageType('error');
      setModalVisible(true);
      return false;
    }
    if (!height || isNaN(height) || height < 100 || height > 250) {
      setMessage('Please enter a valid height in cm (100-250)');
      setMessageType('error');
      setModalVisible(true);
      return false;
    }
    return true;
  };

  const calculateDailyWaterGoal = () => {
    const weightNum = parseFloat(weight);
    const ageNum = parseInt(age);
    
    // Basic calculation: 35ml per kg body weight, adjusted for age and activity
    let baseAmount = weightNum * 35;
    
    // Age adjustment
    if (ageNum > 65) baseAmount *= 0.9;
    if (ageNum < 18) baseAmount *= 1.1;
    
    // Activity level adjustment
    const activityMultipliers = {
      sedentary: 1.0,
      light: 1.1,
      moderate: 1.2,
      active: 1.3,
      very_active: 1.4
    };
    
    baseAmount *= activityMultipliers[activityLevel];
    
    return Math.round(baseAmount);
  };

  const CreateNewAccount = async () => {
    if (!validateStep1() || !validateStep2()) return;

    setIsLoading(true);
    try {
      const resp = await createUserWithEmailAndPassword(auth, email, password);
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
      setMessage(errorMessage);
      setMessageType('error');
      setModalVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  const SaveUser = async (user) => {
    try {
      if (!user || !user.uid) throw new Error('Invalid user object or missing UID');
      
      const calculatedGoal = dailyWaterGoal || calculateDailyWaterGoal();
      
      const userData = {
        // Basic account info
        name: name.trim(),
        email: email.toLowerCase().trim(),
        member: false,
        uid: user.uid,
        createdAt: new Date().toISOString(),
        profileComplete: true,
        lastLoginAt: new Date().toISOString(),
        accountStatus: 'active',
        
        // Health and hydration profile
        profile: {
          age: parseInt(age),
          weight: parseFloat(weight),
          height: parseFloat(height),
          activityLevel: activityLevel,
          healthConditions: healthConditions.trim(),
          medications: medications.trim(),
        },
        
        // Hydration settings
        hydrationSettings: {
          dailyWaterGoal: calculatedGoal,
          preferredTemperature: preferredTemperature,
          wakeUpTime: wakeUpTime,
          bedTime: bedTime,
          reminderInterval: parseInt(reminderInterval),
          notificationsEnabled: true,
          smartReminders: true, // AI-based reminders considering activity and environment
        },
        
        // Device and tracking settings
        deviceSettings: {
          connectedBottles: [], // Array of connected smart bottle IDs
          temperatureUnit: 'celsius',
          volumeUnit: 'ml',
          syncEnabled: true,
          bluetoothEnabled: true,
        },
        
        // Analytics and history initialization
        analytics: {
          totalDaysTracked: 0,
          averageDailyIntake: 0,
          goalAchievementRate: 0,
          preferredDrinkingTimes: [],
          lastBottleSync: null,
        },
        
        // Privacy and preferences
        preferences: {
          dataSharing: false,
          healthInsights: true,
          weeklyReports: true,
          friendsFeature: false,
        }
      };
      
      await setDoc(doc(db, 'users', user.uid), userData);
      
      // Initialize daily tracking document
      const today = new Date().toISOString().split('T')[0];
      await setDoc(doc(db, 'dailyTracking', `${user.uid}_${today}`), {
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
      });
      
      await refreshUserDetails();

      setMessage('Account created successfully! Welcome to your hydration journey!');
      setMessageType('success');
      setModalVisible(true);

      // Clear form
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setAge('');
      setWeight('');
      setHeight('');

      setTimeout(() => {
        router.push('/homepage');
      }, 2000);
    } catch (error) {
      console.error('❌ Error saving user:', error.message);
      setMessage('Account created but error saving profile. Please sign in.');
      setMessageType('error');
      setModalVisible(true);
    }
  };

  const handleModalClose = () => {
    setModalVisible(false);
    if (messageType === 'success') {
      router.push('/homepage');
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    }
  };

  const prevStep = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  const renderStep1 = () => (
    <>
      <ThemedText style={[styles.stepTitle, { color: theme.primary }]}>Account Information</ThemedText>
      
      <ThemedTextInput 
        placeholder="Full Name" 
        value={name} 
        onChangeText={setName} 
        editable={!isLoading} 
      />
      <ThemedTextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!isLoading}
      />
      <ThemedTextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!isLoading}
      />
      <ThemedTextInput
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        editable={!isLoading}
      />

      <ThemedButton
        title="Next: Health Profile"
        onPress={nextStep}
        style={styles.stepButton}
      />
    </>
  );

  const renderStep2 = () => (
    <>
      <ThemedText style={[styles.stepTitle, { color: theme.primary }]}>Health & Hydration Profile</ThemedText>
      
      <View style={styles.row}>
        <ThemedTextInput
          placeholder="Age"
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
          style={styles.halfInput}
          editable={!isLoading}
        />
        <ThemedTextInput
          placeholder="Weight (kg)"
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
          style={styles.halfInput}
          editable={!isLoading}
        />
      </View>

      <ThemedTextInput
        placeholder="Height (cm)"
        value={height}
        onChangeText={setHeight}
        keyboardType="numeric"
        editable={!isLoading}
      />

      <View style={styles.pickerContainer}>
        <ThemedText style={styles.label}>Activity Level:</ThemedText>
        <View style={styles.buttonGroup}>
          {['sedentary', 'light', 'moderate', 'active', 'very_active'].map((level) => (
            <Pressable
              key={level}
              style={[
                styles.activityButton,
                activityLevel === level && { backgroundColor: theme.primary }
              ]}
              onPress={() => setActivityLevel(level)}
            >
              <ThemedText style={[
                styles.activityButtonText,
                activityLevel === level && { color: 'white' }
              ]}>
                {level.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.row}>
        <ThemedTextInput
          placeholder="Wake up time (HH:MM)"
          value={wakeUpTime}
          onChangeText={setWakeUpTime}
          style={styles.halfInput}
          editable={!isLoading}
        />
        <ThemedTextInput
          placeholder="Bed time (HH:MM)"
          value={bedTime}
          onChangeText={setBedTime}
          style={styles.halfInput}
          editable={!isLoading}
        />
      </View>

      <ThemedTextInput
        placeholder="Reminder interval (minutes)"
        value={reminderInterval}
        onChangeText={setReminderInterval}
        keyboardType="numeric"
        editable={!isLoading}
      />

      <ThemedTextInput
        placeholder="Health conditions (optional)"
        value={healthConditions}
        onChangeText={setHealthConditions}
        multiline
        editable={!isLoading}
      />

      <ThemedTextInput
        placeholder="Current medications (optional)"
        value={medications}
        onChangeText={setMedications}
        multiline
        editable={!isLoading}
      />

      <View style={styles.buttonRow}>
        <ThemedButton
          title="Back"
          onPress={prevStep}
          style={[styles.stepButton, styles.backButton]}
        />
        <ThemedButton
          title={isLoading ? 'Creating Account...' : 'Create Account'}
          onPress={CreateNewAccount}
          style={[styles.stepButton, isLoading && { backgroundColor: '#aaa' }]}
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
          <Pressable onPress={() => router.push('/auth/signIn')}>
            <ThemedText style={[styles.signInLink, { color: theme.primary }]}>Sign In</ThemedText>
          </Pressable>
        </View>
      </ScrollView>

      {modalVisible && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.card }]}>
            <ThemedText
              style={[
                styles.modalText,
                messageType === 'success' ? { color: '#155724' } : { color: '#721c24' },
              ]}
            >
              {message}
            </ThemedText>
            <ThemedButton
              title="OK"
              onPress={handleModalClose}
              style={{ backgroundColor: theme.primary }}
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfInput: {
    flex: 1,
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
});
