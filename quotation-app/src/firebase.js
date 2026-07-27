import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase config - uses srrorthodc-antigravity project (shared with main app)
const firebaseConfig = {
  apiKey: "AIzaSyDuK5kOP_WsiFTgMQE7B2qyYaAPDwdi_hY",
  authDomain: "srrorthodc-antigravity.firebaseapp.com",
  projectId: "srrorthodc-antigravity",
  storageBucket: "srrorthodc-antigravity.firebasestorage.app",
  messagingSenderId: "851487467736",
  appId: "1:851487467736:web:1065fa1ffbfdd194530fad",
  measurementId: "G-RPSEV8795H"
};

const hasFirebaseConfig = true;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage, hasFirebaseConfig };
