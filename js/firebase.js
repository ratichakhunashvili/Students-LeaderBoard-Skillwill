// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, getDoc, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDSvHjfHMFmXHjNx0bGUUAqgD4NXbRX4lo",
  authDomain: "students-point-system.firebaseapp.com",
  projectId: "students-point-system",
  storageBucket: "students-point-system.firebasestorage.app",
  messagingSenderId: "704140573531",
  appId: "1:704140573531:web:3dc9c6090653c3c220b87e",
  measurementId: "G-PH3E2ND1X8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Export for use in other files
export { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, getDoc, query, where, orderBy, onSnapshot, Timestamp };

