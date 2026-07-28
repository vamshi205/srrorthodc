import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDzZBf78Qg-iNhcnRF3JcF7obL-lK2KpJE",
  authDomain: "quotationmakersrr.firebaseapp.com",
  projectId: "quotationmakersrr",
  storageBucket: "quotationmakersrr.firebasestorage.app",
  messagingSenderId: "426066228311",
  appId: "1:426066228311:web:178f88119ac88818411f12"
};

const hasFirebaseConfig = true;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage, hasFirebaseConfig };
