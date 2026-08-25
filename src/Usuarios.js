import React, { useState, useEffect } from 'react';
import { db } from './constants/firebase';
import { collection, onSnapshot, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

export default function Usuarios() {
  const [usuarios, setUsuarios]   = useState([]);
  const [permisos, setPermisos]   = useState([]);
  const [cargando, setCargando]   = useState(true);

  useEffect(() => {
    const unsubUsuarios = onSnapshot(collection(db, 'Usuarios'), (snap) => {
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCargando(false);
    });
    const unsubPermisos = onSnapshot(
      query(collection(db, 'SolicitudesPermiso'), where('estado', '==', 'aprobada')),
      (snap) => setPermisos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubUsuarios(); unsubPermisos(); };
  }, []);

  const revocarPermiso = async (permisoId) => {
    if (!window.confirm('¿Revocar este permiso?')) return;
    await deleteDoc(doc(db, 'SolicitudesPermiso', permisoId));
  };

  const permisosDeUsuario = (uid) => permisos.filter(p => p.usuarioId === uid);

  const ROLES = {
    admin:      { bg: '#E3F2FD', txt: '#1565C0' },
    secretaria: { bg: '#F3E5F5', txt: '#6A1B9A' },
    logistica:  { bg: '#E8F5E9', txt: '#2E7D32' },
  };

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 20 }}>
        Gestión de Usuarios
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Cargando...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {usuarios.map(u => {
            const c = ROLES[(u.rol || '').toLowerCase()] || { bg: '#F5F5F5', txt: '#555' };
            const permsUser = permisosDeUsuario(u.id);
            return (
              <div key={u.id} style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E0E0E0', padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#F5C400', flexShrink: 0 }}>
                      {(u.nombre || u.email || '?').split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{u.nombre || '-'}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{u.email || '-'}</div>
                    </div>
                  </div>
                  <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.bg, color: c.txt }}>
                    {u.rol || 'sin rol'}
                  </span>
                </div>

                {permsUser.length > 0 && (
                  <div style={{ marginTop: 16, borderTop: '0.5px solid #F0F0F0', paddingTop: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                      Permisos otorgados
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {permsUser.map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F8F8F8', border: '0.5px solid #E0E0E0', borderRadius: 8, padding: '6px 12px' }}>
                          <span style={{ fontSize: 12, color: '#333' }}>
                            {p.tipoAcceso === 'tabla' ? `Tabla de ${p.seccionSolicitada}` : `Sección ${p.seccionSolicitada}`}
                          </span>
                          <button onClick={() => revocarPermiso(p.id)}
                            style={{ background: '#FFEBEE', color: '#C62828', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                            Revocar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {permsUser.length === 0 && (u.rol || '').toLowerCase() !== 'admin' && (
                  <div style={{ marginTop: 12, borderTop: '0.5px solid #F0F0F0', paddingTop: 10 }}>
                    <div style={{ fontSize: 12, color: '#bbb' }}>Sin permisos adicionales otorgados</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}