import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';

/**
 * Get current user's profile data from Firestore
 */
export const getUserProfile = async () => {
  try {
    // Check if Firebase is initialized
    if (!db) {
      throw new Error('Firebase Firestore is not initialized. Check your firebase.js config file.');
    }

    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user. Please log in first.');
    }

    console.log('Fetching profile for user:', user.uid);
    
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      console.log('User profile found:', userDoc.data());
      return {
        success: true,
        data: userDoc.data()
      };
    } else {
      return {
        success: false,
        error: 'User profile not found in database'
      };
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update user's profile information
 * @param {Object} updates - Object containing fields to update
 */
export const updateUserProfile = async (updates) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }

    const userDocRef = doc(db, 'users', user.uid);
    
    // Update the document
    await updateDoc(userDocRef, updates);

    return {
      success: true,
      message: 'Profile updated successfully'
    };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update specific profile fields (nested in profile object)
 * @param {Object} profileUpdates - Object containing profile fields to update
 */
export const updateProfileFields = async (profileUpdates) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }

    const userDocRef = doc(db, 'users', user.uid);
    
    // Create update object with nested profile fields
    const updates = {};
    Object.keys(profileUpdates).forEach(key => {
      updates[`profile.${key}`] = profileUpdates[key];
    });

    await updateDoc(userDocRef, updates);

    return {
      success: true,
      message: 'Profile fields updated successfully'
    };
  } catch (error) {
    console.error('Error updating profile fields:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update user's name and email (top-level fields)
 */
export const updateBasicInfo = async (name, email) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }

    const userDocRef = doc(db, 'users', user.uid);
    
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;

    await updateDoc(userDocRef, updates);

    return {
      success: true,
      message: 'Basic info updated successfully'
    };
  } catch (error) {
    console.error('Error updating basic info:', error);
    return {
      success: false,
      error: error.message
    };
  }
};