import { 
  EmailAuthProvider, 
  reauthenticateWithCredential, 
  updatePassword 
} from 'firebase/auth';
import { auth } from '../config/firebase';

/**
 * Re-authenticate user with current password
 * Required by Firebase before changing sensitive data like password
 */
export const reauthenticateUser = async (currentPassword) => {
  try {
    const user = auth.currentUser;
    
    if (!user || !user.email) {
      throw new Error('No authenticated user found');
    }

    // Create credential with email and current password
    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword
    );

    // Re-authenticate
    await reauthenticateWithCredential(user, credential);

    return {
      success: true,
      message: 'Re-authentication successful'
    };
  } catch (error) {
    console.error('Re-authentication error:', error);
    
    let errorMessage = 'Re-authentication failed';
    
    // Handle specific Firebase errors
    if (error.code === 'auth/wrong-password') {
      errorMessage = 'Current password is incorrect';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Too many failed attempts. Please try again later';
    } else if (error.code === 'auth/user-mismatch') {
      errorMessage = 'User mismatch error';
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Change user's password
 * @param {string} currentPassword - Current password for verification
 * @param {string} newPassword - New password to set
 */
export const changePassword = async (currentPassword, newPassword) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('No authenticated user found');
    }

    // Step 1: Re-authenticate user first (Firebase requirement)
    const reauthResult = await reauthenticateUser(currentPassword);
    
    if (!reauthResult.success) {
      return reauthResult;
    }

    // Step 2: Update password
    await updatePassword(user, newPassword);

    return {
      success: true,
      message: 'Password changed successfully!'
    };
  } catch (error) {
    console.error('Change password error:', error);
    
    let errorMessage = 'Failed to change password';
    
    // Handle specific Firebase errors
    if (error.code === 'auth/weak-password') {
      errorMessage = 'Password is too weak. Use at least 6 characters';
    } else if (error.code === 'auth/requires-recent-login') {
      errorMessage = 'Please log out and log in again before changing password';
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 */
export const validatePassword = (password) => {
  const errors = [];

  if (password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  if (password.length > 0 && password.length < 8) {
    errors.push('For better security, use 8+ characters');
  }

  // Optional: Add more validation rules
  // if (!/[A-Z]/.test(password)) {
  //   errors.push('Include at least one uppercase letter');
  // }
  // if (!/[a-z]/.test(password)) {
  //   errors.push('Include at least one lowercase letter');
  // }
  // if (!/[0-9]/.test(password)) {
  //   errors.push('Include at least one number');
  // }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
};

/**
 * Check if passwords match
 */
export const passwordsMatch = (password, confirmPassword) => {
  return password === confirmPassword;
};