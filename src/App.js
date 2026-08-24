import React, { useState, useEffect } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';
import { auth, db } from './constants/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Firebase ya guarda la sesión sola (localStorage); acá solo la leemos
    // al abrir la app para no pedir el mail y la contraseña de nuevo.
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docSnap = await getDoc(doc(db, 'Usuarios', user.uid));
          if (docSnap.exists()) {
            setUsuario({ uid: user.uid, ...docSnap.data() });
          }
        } catch (error) {
          console.log('Error recuperando sesión:', error.message);
        }
      } else {
        setUsuario(null);
      }
      setCargando(false);
    });
    return unsub;
  }, []);

  if (cargando) return null;
  if (!usuario) return <Login onLogin={setUsuario} />;
  return <Dashboard usuario={usuario} onLogout={() => setUsuario(null)} />;
}
