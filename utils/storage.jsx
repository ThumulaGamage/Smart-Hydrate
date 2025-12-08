// utils/storage.jsx

import AsyncStorage from '@react-native-async-storage/async-storage';

export const StorageHelper = {
  FIRST_TIME_KEY: '@first_time_user',

  isFirstTimeUser: async function() {
    try {
      const value = await AsyncStorage.getItem(this.FIRST_TIME_KEY);
      return value === null;
    } catch (error) {
      console.error('Error reading first time status:', error);
      return true;
    }
  },

  setNotFirstTimeUser: async function() {
    try {
      await AsyncStorage.setItem(this.FIRST_TIME_KEY, 'false');
    } catch (error) {
      console.error('Error setting not first time:', error);
      throw error;
    }
  }
};