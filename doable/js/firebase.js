import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  setDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
  increment,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDSvHjfHMFmXHjNx0bGUUAqgD4NXbRX4lo",
  authDomain: "students-point-system.firebaseapp.com",
  projectId: "students-point-system",
  storageBucket: "students-point-system.firebasestorage.app",
  messagingSenderId: "704140573531",
  appId: "1:704140573531:web:3dc9c6090653c3c220b87e",
  measurementId: "G-PH3E2ND1X8",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  app,
  firebaseConfig,
  initializeApp,
  getAuth,
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  setDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
  increment,
};
