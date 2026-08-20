import React, { useState } from 'react';
import { auth } from './constants/firebase';
import { signOut } from 'firebase/auth';
import { useColeccion } from './hooks/useFirestore';
import Presupuestos from './Presupuestos';

const NAV = [
  { section: 'General' },
  { id: 'dashboard', label: 'Dashboard', icon: 'ti-layout-dashboard' },
  { section: 'Traslado' },
  { id: 'servicios', label: 'Servicios', icon: 'ti-car' },
  { id: 'presupuestos', label: 'Presupuestos', icon: 'ti-file-text' },
  { id: 'contratos', label: 'Contratos', icon: 'ti-contract' },
  { section: 'Sistema' },
  { id: 'agenda', label: 'Agenda', icon: 'ti-calendar' },
  { id: 'usuarios', label: 'Usuarios', icon: 'ti-users' },
  { id: 'configuracion', label: 'Configuración', icon: 'ti-settings' },
];

const iniciales = (nombre) => nombre?.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase() || 'ND';

const BADGE = {
  'en ruta':  { bg: '#E3F2FD', txt: '#1565C0' },
  'pendiente': { bg: '#FFF8E1', txt: '#F57F17' },
  'completo':  { bg: '#E8F5E9', txt: '#2E7D32' },
};

const badge = (estado) => {
  const e = (estado || 'pendiente').toLowerCase();
  const c = BADGE[e] || BADGE['pendiente'];
  return (
    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: c.bg, color: c.txt }}>
      {estado || 'Pendiente'}
    </span>
  );
};

export default function Dashboard({ usuario, onLogout }) {
  const [seccion, setSeccion] = useState('dashboard');
  const [tab, setTab] = useState('servicios');

  const { datos: servicios,    cargando: cargandoServicios }    = useColeccion('servicios');
  const { datos: presupuestos, cargando: cargandoPresupuestos } = useColeccion('presupuestos');
  const { datos: contratos,    cargando: cargandoContratos }    = useColeccion('contratos');

  const datosMostrados = tab === 'servicios' ? servicios : tab === 'presupuestos' ? presupuestos : contratos;
  const cargando = tab === 'servicios' ? cargandoServicios : tab === 'presupuestos' ? cargandoPresupuestos : cargandoContratos;

  const handleLogout = async () => {
    await signOut(auth);
    onLogout();
  };

  const columnas = {
    servicios:    ['Cliente', 'Origen → Destino', 'Responsable', 'Salida', 'Estado'],
    presupuestos: ['Nro', 'Cliente', 'Origen → Destino', 'Salida', 'Costo Total'],
    contratos:    ['Nro Presupuesto', 'Cliente', 'Destino', 'Fecha Contrato', 'Estado'],
  };

  const fila = (row) => {
    if (tab === 'servicios') return [
      row.contacto || '-',
      row.domicilioOrigen && row.domicilioDestino ? `${row.domicilioOrigen} → ${row.domicilioDestino}` : '-',
      row.responsable || '-',
      `${row.salidaFecha || '-'} ${row.salidaHora || ''}`,
      badge(row.estado),
    ];
    if (tab === 'presupuestos') return [
      row.nroPresupuesto || '-',
      row.cliente || '-',
      row.origen && row.destino ? `${row.origen} → ${row.destino}` : '-',
      `${row.salidaFecha || '-'} ${row.salidaHora || ''}`,
      row.costoTotal ? `$${row.costoTotal}` : '-',
    ];
    if (tab === 'contratos') return [
      row.nroPresupuesto || '-',
      row.cliente || '-',
      row.destino || '-',
      row.fechaContrato || '-',
      badge(row.estado),
    ];
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>

      {/* ── SIDEBAR ── */}
      <div style={{ width: 220, background: '#1A1A1A', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '24px 20px 20px', borderBottom: '0.5px solid #2a2a2a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#F5C400', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#1A1A1A', flexShrink: 0 }}>ND</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              <span style={{ color: '#fff' }}>NUEVO </span>
              <span style={{ color: '#F5C400' }}>DESTINO</span>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {NAV.map((item, i) => {
            if (item.section) return (
              <div key={i} style={{ padding: '8px 20px 4px', fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1 }}>
                {item.section}
              </div>
            );
            const activo = seccion === item.id;
            return (
              <div key={item.id} onClick={() => setSeccion(item.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', fontSize: 13, color: activo ? '#1A1A1A' : '#888', fontWeight: activo ? 600 : 400, background: activo ? '#F5C400' : 'transparent', cursor: 'pointer' }}>
                <i className={`ti ${item.icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
                {item.label}
              </div>
            );
          })}
        </div>

        <div style={{ padding: '16px 20px', borderTop: '0.5px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F5C400', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#1A1A1A', flexShrink: 0 }}>
            {iniciales(usuario?.nombre)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#ccc', fontWeight: 500 }}>{usuario?.nombre || 'Usuario'}</div>
            <div style={{ fontSize: 10, color: '#555' }}>{usuario?.rol || ''}</div>
          </div>
          <div onClick={handleLogout} title="Cerrar sesión" style={{ cursor: 'pointer', color: '#555', fontSize: 16 }}>
            <i className="ti ti-logout" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, background: '#F2F2F2', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E0E0E0', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A' }}>
            {NAV.find(n => n.id === seccion)?.label || 'Dashboard'} <span style={{ color: '#F5C400' }}>General</span>
          </div>
          <div style={{ fontSize: 11, background: '#1A1A1A', color: '#F5C400', padding: '4px 10px', borderRadius: 20 }}>
            Traslado activo
          </div>
        </div>

       <div style={{ flex: 1, overflowY: 'auto' }}>
             {seccion === 'presupuestos' ? (
            <Presupuestos />
              ) : (
                <>
          {/* Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { val: servicios.length,    label: 'Servicios',    sub: 'total' },
              { val: presupuestos.length, label: 'Presupuestos', sub: 'total' },
              { val: contratos.length,    label: 'Contratos',    sub: 'total' },
              { val: servicios.filter(s => (s.estado || '').toLowerCase() === 'en ruta').length, label: 'En ruta', sub: 'ahora' },
            ].map((m, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E0E0E0', padding: 16 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1A1A1A' }}>{m.val}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>{m.label}</div>
                <div style={{ fontSize: 10, color: '#888' }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Tabla */}
          <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E0E0E0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #E0E0E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>Traslado</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['servicios', 'presupuestos', 'contratos'].map(t => (
                    <div key={t} onClick={() => setTab(t)}
                      style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', background: tab === t ? '#1A1A1A' : 'transparent', color: tab === t ? '#F5C400' : '#888' }}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </div>
                  ))}
                </div>
                <button style={{ padding: '6px 14px', background: '#F5C400', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#1A1A1A', cursor: 'pointer' }}>
                  + Nuevo
                </button>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {columnas[tab].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '0.5px solid #F0F0F0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#888' }}>Cargando...</td></tr>
                ) : datosMostrados.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#888' }}>No hay registros</td></tr>
                ) : (
                  datosMostrados.map((row) => (
                    <tr key={row.id}>
                      {fila(row).map((celda, ci) => (
                        <td key={ci} style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8', color: '#333' }}>{celda}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
                </>
              )}
        </div>
      </div>
    </div>
  );
}