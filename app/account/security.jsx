import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemedView from '../../components/ThemedView';
import ThemedText from '../../components/ThemedText';
import useTheme from '../../Theme/theme';
import { changePassword, validatePassword, passwordsMatch } from '../../services/authService';

// PasswordInput component OUTSIDE main component (fixes cursor issue)
const PasswordInput = ({
  label,
  value,
  onChangeText,
  showPassword,
  toggleShowPassword,
  error,
  placeholder,
  theme,
}) => (
  <View style={styles.inputContainer}>
    <ThemedText style={[styles.label, { color: theme.secondaryText }]}>
      {label}
    </ThemedText>
    <View
      style={[
        styles.passwordInputWrapper,
        {
          backgroundColor: theme.card,
          borderColor: error ? '#ff3b30' : theme.border,
          borderWidth: error ? 2 : 1,
        },
      ]}
    >
      <Ionicons name="lock-closed-outline" size={20} color={theme.secondaryText} />
      <TextInput
        style={[styles.passwordInput, { color: theme.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.secondaryText}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
      />
      <TouchableOpacity onPress={toggleShowPassword} style={styles.eyeIcon}>
        <Ionicons
          name={showPassword ? 'eye-outline' : 'eye-off-outline'}
          size={22}
          color={theme.secondaryText}
        />
      </TouchableOpacity>
    </View>
    {error ? (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={14} color="#ff3b30" />
        <ThemedText style={styles.errorText}>{error}</ThemedText>
      </View>
    ) : null}
  </View>
);

export default function SecurityScreen() {
  const router = useRouter();
  const theme = useTheme();

  // State management
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Show/Hide password states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const validateForm = () => {
    const newErrors = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    };

    let isValid = true;

    // Validate current password
    if (!currentPassword.trim()) {
      newErrors.currentPassword = 'Current password is required';
      isValid = false;
    }

    // Validate new password
    if (!newPassword.trim()) {
      newErrors.newPassword = 'New password is required';
      isValid = false;
    } else {
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        newErrors.newPassword = passwordValidation.errors[0];
        isValid = false;
      }
    }

    // Validate confirm password
    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm your password';
      isValid = false;
    } else if (!passwordsMatch(newPassword, confirmPassword)) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    // Check if new password is same as current
    if (currentPassword && newPassword && currentPassword === newPassword) {
      newErrors.newPassword = 'New password must be different from current password';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleChangePassword = async () => {
    // Validate form
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const result = await changePassword(currentPassword, newPassword);

      if (result.success) {
        Alert.alert(
          'Success',
          'Your password has been changed successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                // Clear form
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setErrors({ currentPassword: '', newPassword: '', confirmPassword: '' });
                router.back();
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to change password');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

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

          <ThemedText style={styles.headerTitle}>Security</ThemedText>

          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.primary + '15' }]}>
          <Ionicons name="information-circle" size={24} color={theme.primary} />
          <ThemedText style={[styles.infoText, { color: theme.text }]}>
            Choose a strong password with at least 6 characters. For better security, use 8+
            characters with a mix of letters, numbers, and symbols.
          </ThemedText>
        </View>

        {/* Change Password Card */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark" size={24} color={theme.primary} />
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
              Change Password
            </ThemedText>
          </View>

          <View style={styles.formContainer}>
            <PasswordInput
              label="Current Password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              showPassword={showCurrentPassword}
              toggleShowPassword={() => setShowCurrentPassword(!showCurrentPassword)}
              error={errors.currentPassword}
              placeholder="Enter current password"
              theme={theme}
            />

            <PasswordInput
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              showPassword={showNewPassword}
              toggleShowPassword={() => setShowNewPassword(!showNewPassword)}
              error={errors.newPassword}
              placeholder="Enter new password"
              theme={theme}
            />

            <PasswordInput
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              showPassword={showConfirmPassword}
              toggleShowPassword={() => setShowConfirmPassword(!showConfirmPassword)}
              error={errors.confirmPassword}
              placeholder="Confirm new password"
              theme={theme}
            />
          </View>
        </View>

        {/* Security Tips Card */}
        <View style={[styles.tipsCard, { backgroundColor: theme.card }]}>
          <ThemedText style={[styles.tipsTitle, { color: theme.text }]}>
            Password Tips
          </ThemedText>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
            <ThemedText style={[styles.tipText, { color: theme.secondaryText }]}>
              Use at least 8 characters
            </ThemedText>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
            <ThemedText style={[styles.tipText, { color: theme.secondaryText }]}>
              Mix uppercase and lowercase letters
            </ThemedText>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
            <ThemedText style={[styles.tipText, { color: theme.secondaryText }]}>
              Include numbers and symbols
            </ThemedText>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
            <ThemedText style={[styles.tipText, { color: theme.secondaryText }]}>
              Avoid common words or patterns
            </ThemedText>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Change Password Button */}
      <View style={[styles.buttonContainer, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={[
            styles.changeButton,
            { backgroundColor: theme.primary },
            loading && styles.buttonDisabled,
          ]}
          onPress={handleChangePassword}
          disabled={loading}
        >
          {loading ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <ThemedText style={styles.buttonText}>Changing...</ThemedText>
            </>
          ) : (
            <>
              <Ionicons name="shield-checkmark" size={22} color="#fff" />
              <ThemedText style={styles.buttonText}>Change Password</ThemedText>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
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
  formContainer: {
    paddingTop: 4,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  eyeIcon: {
    padding: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#ff3b30',
  },
  tipsCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    flex: 1,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  changeButton: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});