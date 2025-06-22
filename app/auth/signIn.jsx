import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View
} from 'react-native';
import { auth } from '../../config/firebaseConfig';
import { useUser } from '../../context/UserDetailContext';
import useTheme from '../../Theme/theme';

import ThemedButton from '../../components/ThemedButton';
import ThemedText from '../../components/ThemedText';
import ThemedTextInput from '../../components/ThemedTextInput';
import ThemedView from '../../components/ThemedView';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const theme = useTheme();
  const { isAuthenticated } = useUser(); // optional

  const handleSignIn = async () => {
    if (!email || !password) {
      setMessage('Please enter both email and password');
      setModalVisible(true);
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('✅ Signed in:', user.email);
      setEmail('');
      setPassword('');
      router.replace('/homepage'); // better UX
    } catch (error) {
      let errorMessage = error.message;
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      }
      setMessage(errorMessage);
      setModalVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

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
        style={styles.input}
      />

      <ThemedTextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!isLoading}
        style={styles.input}
      />

      <ThemedButton
        title={isLoading ? 'Signing In...' : 'Sign In'}
        onPress={handleSignIn}
        disabled={isLoading}
        style={[styles.button, isLoading && styles.buttonDisabled]}
      />

      <View style={styles.bottomTextContainer}>
        <ThemedText style={styles.bottomText}>Don't have an account? </ThemedText>
        <Pressable onPress={() => router.push('/auth/signUp')}>
          <ThemedText style={[styles.signInLink, { color: theme.primary }]}>Create new</ThemedText>
        </Pressable>
      </View>

      {/* Modal Dialog */}
      {modalVisible && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.card }]}>
            <ThemedText style={[styles.modalText, { color: theme.error || '#D32F2F' }]}>
              {message}
            </ThemedText>
            <ThemedButton
              title="OK"
              onPress={() => setModalVisible(false)}
              style={{ backgroundColor: theme.primary, width: 100 }}
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

  // Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
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
