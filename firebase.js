import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBiXEuDcRQTdT8cvYNeYJvrgvVU0kE9Ryg",
  authDomain: "goal-tracking1.firebaseapp.com",
  projectId: "goal-tracking1",
  storageBucket: "goal-tracking1.firebasestorage.app",
  messagingSenderId: "812310139110",
  appId: "1:812310139110:web:fd39da48c342cc55aa2b27"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
