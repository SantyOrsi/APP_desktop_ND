import React, { useState } from 'react';
import { useColeccion } from './hooks/useFirestore';
import { db } from './constants/firebase';
import { collection, addDoc, updateDoc, doc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { generarPresupuestoPDF } from './helpers/generarPresupuestoPDF';
const { ipcRenderer } = window.require('electron');

const guardarPDF = async () => {
  try {
    const pdfBytes = await generarPresupuestoPDF(form);
    const result = await ipcRenderer.invoke('guardar-pdf', {
      nombre: `Presupuesto_${form.nroPresupuesto || 'nuevo'}.pdf`,
      buffer: Array.from(pdfBytes),
    });
    if (result.ok) alert(`PDF guardado en: ${result.ruta}`);
  } catch (error) {
    alert('Error al generar PDF: ' + error.message);
  }
};
export default function Presupuestos() {
  const { datos: presupuestos, cargando } = useColeccion('presupuestos');
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState('tabla'); // 'tabla' | 'form'
  const [form, setForm] = useState({
    nroPresupuesto: '', cliente: '', fecha: '', vigencia: '',
    origen: '', destino: '', salidaFecha: '', salidaHora: '',
    retornoFecha: '', retornoHora: '', movimiento: '', adicionales: '',
    cantMov: '', cantAdi: '', alojViaticosCargo: '', importAlojViaticos: '',
    capacidad: '', costoTotal: '', costoIva: '',
  });

  const set = (key) => (e) => {
    const val = e.target.value;
    setForm(prev => {
      const updated = { ...prev, [key]: val };
      if (key === 'costoTotal') {
        const total = parseFloat(val);
        updated.costoIva = !isNaN(total) ? (total * 1.105).toFixed(2) : '';
      }
      return updated;
    });
  };

  const seleccionar = (item) => {
    setForm(item);
    setVista('form');
  };

  const nuevo = () => {
    setForm({
      nroPresupuesto: '', cliente: '', fecha: '', vigencia: '',
      origen: '', destino: '', salidaFecha: '', salidaHora: '',
      retornoFecha: '', retornoHora: '', movimiento: '', adicionales: '',
      cantMov: '', cantAdi: '', alojViaticosCargo: '', importAlojViaticos: '',
      capacidad: '', costoTotal: '', costoIva: '',
    });
    setVista('form');
  };

  const guardar = async () => {
    try {
      if (!form.nroPresupuesto.trim()) { alert('Ingresá un número de presupuesto'); return; }
      const datos = { ...form, actualizadoEn: Timestamp.now() };
      const q = query(collection(db, 'presupuestos'), where('nroPresupuesto', '==', form.nroPresupuesto.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, 'presupuestos', snap.docs[0].id), datos);
      } else {
        datos.creadoEn = Timestamp.now();
        await addDoc(collection(db, 'presupuestos'), datos);
      }
      alert('Presupuesto guardado correctamente');
      setVista('tabla');
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const filtrados = presupuestos.filter(p =>
    (p.cliente || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.nroPresupuesto || '').toString().includes(busqueda)
  );

  const campo = (label, key, type = 'text') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
      <input type={type} value={form[key] || ''} onChange={set(key)}
        style={{ padding: '8px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, background: '#F8F8F8', outline: 'none' }} />
    </div>
  );

  if (vista === 'form') return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => setVista('tabla')}
          style={{ padding: '7px 16px', background: 'transparent', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
          ← Volver
        </button>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>
          {form.nroPresupuesto ? `Presupuesto N° ${form.nroPresupuesto}` : 'Nuevo Presupuesto'}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E0E0E0', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#F5C400', textTransform: 'uppercase', letterSpacing: 1 }}>Datos Generales</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {campo('Nro. Presupuesto', 'nroPresupuesto')}
          {campo('Cliente', 'cliente')}
          {campo('Fecha', 'fecha')}
          {campo('Vigencia', 'vigencia')}
          {campo('Origen', 'origen')}
          {campo('Destino', 'destino')}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: '#F5C400', textTransform: 'uppercase', letterSpacing: 1 }}>Salida / Retorno</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
          {campo('Fecha Salida', 'salidaFecha')}
          {campo('Hora Salida', 'salidaHora')}
          {campo('Fecha Retorno', 'retornoFecha')}
          {campo('Hora Retorno', 'retornoHora')}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: '#F5C400', textTransform: 'uppercase', letterSpacing: 1 }}>Vehículo y Servicios</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {campo('Movimiento', 'movimiento')}
          {campo('Adicionales', 'adicionales')}
          {campo('Cant Mov', 'cantMov')}
          {campo('Cant Adi', 'cantAdi')}
          {campo('Aloj y Viat a cargo de', 'alojViaticosCargo')}
          {campo('Import Aloj y Viat', 'importAlojViaticos')}
          {campo('Capacidad', 'capacidad')}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: '#F5C400', textTransform: 'uppercase', letterSpacing: 1 }}>Costos</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {campo('Costo Total', 'costoTotal')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>Costo + IVA</label>
            <input value={form.costoIva || ''} readOnly
              style={{ padding: '8px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, background: '#F0F0F0', outline: 'none', color: '#888' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={() => setVista('tabla')}
            style={{ padding: '10px 24px', background: 'transparent', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={guardar}
            style={{ padding: '10px 24px', background: '#1A1A1A', color: '#F5C400', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>Presupuestos</div>
        <button onClick={nuevo}
          style={{ padding: '8px 18px', background: '#F5C400', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1A1A1A', cursor: 'pointer' }}>
          + Nuevo
        </button>
      </div>

      <input placeholder="Buscar por cliente o número..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
        style={{ width: '100%', padding: '10px 14px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, marginBottom: 16, background: '#fff', outline: 'none' }} />

      <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E0E0E0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Nro', 'Cliente', 'Origen → Destino', 'Salida', 'Costo Total', 'Estado'].map(h => (
                <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '0.5px solid #F0F0F0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#888' }}>Cargando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#888' }}>No hay presupuestos</td></tr>
            ) : (
              filtrados.map(row => (
                <tr key={row.id} onClick={() => seleccionar(row)} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.nroPresupuesto || '-'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.cliente || '-'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.origen && row.destino ? `${row.origen} → ${row.destino}` : '-'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.salidaFecha || '-'} {row.salidaHora || ''}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.costoTotal ? `$${row.costoTotal}` : '-'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>
                    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: '#FFF8E1', color: '#F57F17' }}>
                      {row.estado || 'Pendiente'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}