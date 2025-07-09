// utils/storage.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  FIRST_TIME_USER: 'isFirstTimeUser',
};

export const StorageHelper = {
  async isFirstTimeUser() {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_TIME_USER);
      return value === null;
    } catch (error) {
      console.error('Error checking first time user:', error);
      return true;
    }
  },

  async setNotFirstTimeUser() {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.FIRST_TIME_USER, 'false');
      console.log('✅ Marked as not first time user');
    } catch (error) {
      console.error('Error setting first time user:', error);
    }
  },

  // Only use this for testing or if user wants to see welcome screen again
  async resetFirstTimeUser() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.FIRST_TIME_USER);
      console.log('✅ Reset first time user flag');
    } catch (error) {
      console.error('Error resetting first time user:', error);
    }
  }
};