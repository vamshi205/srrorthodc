import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDuK5kOP_WsiFTgMQE7B2qyYaAPDwdi_hY",
  authDomain: "srrorthodc-antigravity.firebaseapp.com",
  projectId: "srrorthodc-antigravity",
  storageBucket: "srrorthodc-antigravity.firebasestorage.app",
  messagingSenderId: "851487467736",
  appId: "1:851487467736:web:1065fa1ffbfdd194530fad",
  measurementId: "G-RPSEV8795H"
};

// Initialize Firebase (Singleton pattern to avoid duplicate app errors)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Services
export const db = getFirestore(app);
export const auth = getAuth(app);

// Initialize Analytics (optional, only works in browser)
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { analytics };
export default app;
