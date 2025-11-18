import { getDatabase } from 'firebase/database';
import { auth } from '../config/firebaseConfig';

// --- Global Variables ---
export let database;
export let isAuthReady = false;
export let currentUserId = null;

// Initialize Realtime Database using your existing Firebase app
try {
  database = getDatabase(auth.app);
  console.log('Realtime Database initialized successfully');
} catch (e) {
  console.error("Failed to initialize Realtime Database:", e);
}

// --- Global Constants & Utilities ---
export const AVAILABLE_GAPS = [2, 3, 4];
export const WAKING_HOURS = 16;

export const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};