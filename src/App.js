import React, { useState } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';

export default function App() {
  const [usuario, setUsuario] = useState(null);

  if (!usuario) return <Login onLogin={setUsuario} />;
  return <Dashboard usuario={usuario} onLogout={() => setUsuario(null)} />;
}