import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore'; // <-- Add this


const firebaseConfig = {
 apiKey: "AIzaSyCV5Qiz9DkdwSRoSWUwh6BOsBNb2qgCZmc",
  authDomain: "smart-hydrate-5b0bd.firebaseapp.com",
  projectId: "smart-hydrate-5b0bd",
  storageBucket: "smart-hydrate-5b0bd.firebasestorage.app",
  messagingSenderId: "201171796898",
  appId: "1:201171796898:web:c35eded0095783049c68fb",
  measurementId: "G-9NFNL714XF"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore(); // <-- Add this
export default firebase;
