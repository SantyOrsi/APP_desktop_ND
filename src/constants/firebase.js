import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCbcpfUIeRjuS9MuZJgfUpRipSNyKWY7Yk",
  authDomain: "app-nd-c9d6c.firebaseapp.com",
  projectId: "app-nd-c9d6c",
  storageBucket: "app-nd-c9d6c.firebasestorage.app",
  messagingSenderId: "378026749697",
  appId: "1:378026749697:web:17bc39df0294391876b500",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);