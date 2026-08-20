import React, { useState } from 'react';
import { auth, db } from './constants/firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      const docSnap = await getDoc(doc(db, 'Usuarios', uid));
      if (docSnap.exists()) {
        onLogin({ uid, ...docSnap.data() });
      } else {
        setError('Usuario no encontrado en el sistema');
      }
    } catch (e) {
      setError('Email o contraseña incorrectos');
    }
    setLoading(false);
  };

  const handleForgot = async () => {
    if (!email) { setError('Ingresá tu email primero'); return; }
    await sendPasswordResetEmail(auth, email);
    alert('Te enviamos un email para restablecer tu contraseña');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ width: 420, background: '#1A1A1A', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 40, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F5C400', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>ND</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            <span style={{ color: '#fff' }}>NUEVO </span>
            <span style={{ color: '#F5C400' }}>DESTINO</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 42, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>
            CADA VIAJE<br />ES UN<br />
            <span style={{ color: '#F5C400' }}>NUEVO</span><br />DESTINO
          </div>
          <div style={{ fontSize: 13, color: '#666', marginTop: 12 }}>Sistema de gestión interno</div>
        </div>
        <div style={{ fontSize: 11, color: '#444' }}>DEF UX · v1.0.0</div>
      </div>

      <div style={{ flex: 1, background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 48 }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>Bienvenido de vuelta</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#F5C400', marginBottom: 4 }}>Iniciá sesión</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 32 }}>Accedé al sistema de la agencia</div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#1A1A1A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Correo electrónico</div>
          <input type="email" placeholder="correo@nuevodestino.com" value={email} onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', padding: '11px 14px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 14, background: '#F8F8F8', outline: 'none' }} />
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#1A1A1A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Contraseña</div>
          <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ width: '100%', padding: '11px 14px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 14, background: '#F8F8F8', outline: 'none' }} />
        </div>

        <div onClick={handleForgot} style={{ fontSize: 12, color: '#F5C400', textAlign: 'right', marginBottom: 24, cursor: 'pointer' }}>
          Olvidé mi contraseña
        </div>

        {error && <div style={{ fontSize: 12, color: '#E53935', marginBottom: 16 }}>{error}</div>}

        <button onClick={handleLogin} disabled={loading}
          style={{ width: '100%', padding: 14, background: '#1A1A1A', color: '#F5C400', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, letterSpacing: 1.5, cursor: 'pointer' }}>
          {loading ? 'INGRESANDO...' : 'INGRESAR AL SISTEMA'}
        </button>
      </div>
    </div>
  );
}