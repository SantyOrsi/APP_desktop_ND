import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../constants/firebase';

export const useColeccion = (nombre) => {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, nombre), (snap) => {
      setDatos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCargando(false);
    }, (error) => {
      console.log('Error Firestore:', error.message);
      setCargando(false);
    });
    return unsub;
  }, [nombre]);

  return { datos, cargando };
};