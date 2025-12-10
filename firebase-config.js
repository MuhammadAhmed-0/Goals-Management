import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBiXEuDcRQTdT8cvYNeYJvrgvVU0kE9Ryg",
  authDomain: "goal-tracking1.firebaseapp.com",
  projectId: "goal-tracking1",
  storageBucket: "goal-tracking1.firebasestorage.app",
  messagingSenderId: "812310139110",
  appId: "1:812310139110:web:fd39da48c342cc55aa2b27"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
