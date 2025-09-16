// app/auth/signIn.jsx
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { Pressable, StyleSheet, View, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, firestore, FieldValue } from '../../config/firebaseConfig';
import { useUser } from '../../context/UserDetailContext';
import useTheme from '../../Theme/theme';
import { StorageHelper } from '../../utils/storage';

import ThemedButton from '../../components/ThemedButton';
import ThemedText from '../../components/ThemedText';
import ThemedTextInput from '../../components/ThemedTextInput';
import ThemedView from '../../components/ThemedView';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const theme = useTheme();
  const { refreshUserDetails } = useUser();

  // Memoize expensive or repeated logic with useCallback
  const handleSignIn = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      showErrorMessage('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔄 Starting sign in process for:', email);

      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;

      console.log('✅ Authentication successful for:', user.email);

      // Update last login time — non-blocking
      updateLastLogin(user.uid).catch((err) =>
        console.warn('⚠️ Could not update last login time:', err.message)
      );

      // Mark as returning user
      await StorageHelper.setNotFirstTimeUser();
      console.log('✅ Marked as returning user');

      // Refresh user context if available
      if (refreshUserDetails) {
        await refreshUserDetails().catch((err) =>
          console.warn('⚠️ Could not refresh user details:', err.message)
        );
        console.log('✅ User details refreshed successfully');
      }

      // Clear form and navigate
      setEmail('');
      setPassword('');
      console.log('🎉 Sign in process completed successfully');
      router.replace('/homepage');

    } catch (error) {
      console.error('❌ Sign in failed:', error);

      const errorMessage = getFriendlyErrorMessage(error);
      showErrorMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [email, password, router, refreshUserDetails]);

  const updateLastLogin = async (uid) => {
    await firestore.collection('users').doc(uid).update({
      lastLoginAt: FieldValue.serverTimestamp(),
    });
    console.log('✅ Last login time updated');
  };

  const getFriendlyErrorMessage = (error) => {
    const codes = {
      'auth/user-not-found': 'No account found with this email address.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/user-disabled': 'This account has been disabled. Please contact support.',
      'auth/invalid-credential': 'Invalid email or password. Please check your credentials.',
    };
    return codes[error.code] || error.message || 'An unexpected error occurred.';
  };

  const showErrorMessage = (msg) => {
    setMessage(msg);
    setModalVisible(true);
  };

  const togglePasswordVisibility = () => {
    if (!isLoading) {
      setShowPassword((prev) => !prev);
    }
  };

  const closeModal = () => setModalVisible(false);

  // Optional: Handle hardware back button or ESC key for modal (web/desktop)
  // useEffect(() => {
  //   const backAction = () => {
  //     if (modalVisible) {
  //       closeModal();
  //       return true;
  //     }
  //     return false;
  //   };
  //   const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
  //   return () => backHandler.remove();
  // }, [modalVisible]);

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={[styles.title, { color: theme.primary }]}>Welcome Back</ThemedText>
      <ThemedText style={styles.subtitle}>Please sign in to continue</ThemedText>

      <ThemedTextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!isLoading}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        style={styles.input}
        accessibilityLabel="Email input field"
      />

      <View style={styles.passwordContainer}>
        <ThemedTextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          editable={!isLoading}
          autoComplete="password"
          textContentType="password"
          returnKeyType="done"
          style={[styles.input, styles.passwordInput]}
          accessibilityLabel="Password input field"
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

      <ThemedButton
        title={isLoading ? 'Signing In...' : 'Sign In'}
        onPress={handleSignIn}
        disabled={isLoading}
        style={[styles.button, isLoading && styles.buttonDisabled]}
        accessibilityLabel="Sign in button"
      />

      <View style={styles.bottomTextContainer}>
        <ThemedText style={styles.bottomText}>Don't have an account? </ThemedText>
        <Pressable
          onPress={() => router.push('/auth/signUp')}
          disabled={isLoading}
          accessibilityRole="link"
        >
          <ThemedText style={[styles.signInLink, { color: theme.primary }]}>Create new</ThemedText>
        </Pressable>
      </View>

      {/* Modal Dialog */}
      {modalVisible && (
        <View style={styles.modalOverlay} accessibilityLiveRegion="assertive">
          <View style={[styles.modalBox, { backgroundColor: theme.card }]}>
            <ThemedText style={[styles.modalText, { color: theme.error || '#D32F2F' }]}>
              {message}
            </ThemedText>
            <ThemedButton
              title="OK"
              onPress={closeModal}
              style={{ backgroundColor: theme.primary, width: 100, marginTop: 16 }}
              accessibilityLabel="Close error message"
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
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#888',
    marginBottom: 24,
  },
  input: {
    borderRadius: 10,
    marginBottom: 12,
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: '50%',
    transform: [{ translateY: -12 }],
    zIndex: 1,
    padding: 4, // Increase touch target
  },
  button: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonDisabled: {
    backgroundColor: '#aaa',
  },
  bottomTextContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  bottomText: {
    fontSize: 16,
    fontWeight: '500',
  },
  signInLink: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  modalBox: {
    width: '80%',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
  },
  modalText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
});