import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';

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

// Guarda la sesión en el disco (localStorage) para no pedir el login de nuevo
// cada vez que se abre la app de escritorio.
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.log('Error configurando persistencia:', error.message);
});
