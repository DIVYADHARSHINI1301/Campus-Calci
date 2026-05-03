import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD9qvBUzKJlRZIlqNRDxdtNDeSbEavApKM",
  authDomain: "campus-calci.firebaseapp.com",
  projectId: "campus-calci",
  storageBucket: "campus-calci.firebasestorage.app",
  messagingSenderId: "188419156890",
  appId: "1:188419156890:web:f63e5a825e6bb2a5a96823"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();