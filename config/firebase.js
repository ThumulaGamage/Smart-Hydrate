// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCV5Qiz9DkdwSRoSWUwh6BOsBNb2qgCZmc",
  authDomain: "smart-hydrate-5b0bd.firebaseapp.com",
  databaseURL: "https://smart-hydrate-5b0bd-default-rtdb.firebaseio.com",
  projectId: "smart-hydrate-5b0bd",
  storageBucket: "smart-hydrate-5b0bd.firebasestorage.app",
  messagingSenderId: "201171796898",
  appId: "1:201171796898:web:c35eded0095783049c68fb",
  measurementId: "G-9NFNL714XF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;