import React, { useState } from 'react';
import { useColeccion } from './hooks/useFirestore';
import { db } from './constants/firebase';
import { collection, addDoc, updateDoc, doc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { generarPresupuestoPDF } from './helpers/generarPresupuestoPDF';
const { ipcRenderer } = window.require('electron');

const hoy = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};

const FORM_VACIO = {
  nroPresupuesto: '', cliente: '', fecha: hoy(), vigencia: hoy(),
  origen: '', destino: '', salidaFecha: hoy(), salidaHora: '',
  retornoFecha: '', retornoHora: '', movimiento: '', adicionales: '',
  cantMov: '', cantAdi: '', alojViaticosCargo: '', importAlojViaticos: '',
  capacidad: '', costoTotal: '', costoIva: '', estado: 'pendiente',
};

const inp = (value, onChange, placeholder = '', type = 'text', readOnly = false) => (
  <input type={type} value={value || ''} onChange={onChange} placeholder={placeholder} readOnly={readOnly}
    style={{ padding: '8px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, background: readOnly ? '#F0F0F0' : '#F8F8F8', outline: 'none', width: '100%', color: readOnly ? '#888' : '#1A1A1A' }} />
);

const lbl = (texto) => (
  <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>{texto}</label>
);

const campo = (label, children) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    {lbl(label)}
    {children}
  </div>
);

const seccionTitulo = (texto) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: '#F5C400', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #F0F0F0', paddingBottom: 8, marginBottom: 4 }}>
    {texto}
  </div>
);

export default function Presupuestos() {
  const { datos: presupuestos, cargando } = useColeccion('presupuestos');
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState('tabla');
  const [form, setForm] = useState(FORM_VACIO);
  const [docId, setDocId] = useState(null);
  const [guardando, setGuardando] = useState(false);

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
    setDocId(item.id);
    setVista('form');
  };

  const nuevo = () => {
    setForm(FORM_VACIO);
    setDocId(null);
    setVista('form');
  };

  const guardar = async () => {
    if (!form.nroPresupuesto.trim()) { alert('Ingresá un número de presupuesto'); return; }
    setGuardando(true);
    try {
      const datos = { ...form, actualizadoEn: Timestamp.now() };
      delete datos.id;
      if (docId) {
        await updateDoc(doc(db, 'presupuestos', docId), datos);
      } else {
        const q = query(collection(db, 'presupuestos'), where('nroPresupuesto', '==', form.nroPresupuesto.trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(doc(db, 'presupuestos', snap.docs[0].id), datos);
          setDocId(snap.docs[0].id);
        } else {
          datos.creadoEn = Timestamp.now();
          const ref = await addDoc(collection(db, 'presupuestos'), datos);
          setDocId(ref.id);
        }
      }
    } catch (error) {
      alert('Error al guardar: ' + error.message);
    }
    setGuardando(false);
  };

  const generarPDF = async () => {
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

  const handleGuardarPDF = async () => {
    await guardar();
    await generarPDF();
  };

  const buscarPorNro = async () => {
    if (!busqueda.trim()) return;
    try {
      const q = query(collection(db, 'presupuestos'), where('nroPresupuesto', '==', busqueda.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        seleccionar({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        alert('No se encontró ningún presupuesto con ese número');
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const filtrados = presupuestos.filter(p =>
    (p.cliente || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.nroPresupuesto || '').toString().includes(busqueda)
  );

  // ── FORMULARIO ──
  if (vista === 'form') return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setVista('tabla')}
            style={{ padding: '7px 16px', background: 'transparent', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
            ← Volver
          </button>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>
            {form.nroPresupuesto ? `Presupuesto N° ${form.nroPresupuesto}` : 'Nuevo Presupuesto'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={guardar} disabled={guardando}
            style={{ padding: '9px 20px', background: '#F2F2F2', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={generarPDF}
            style={{ padding: '9px 20px', background: '#F2F2F2', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Solo PDF
          </button>
          <button onClick={handleGuardarPDF} disabled={guardando}
            style={{ padding: '9px 20px', background: '#1A1A1A', color: '#F5C400', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Guardar y PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* DATOS GENERALES */}
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E0E0E0', padding: 24 }}>
          {seccionTitulo('Datos Generales')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
            {campo('Nro. Presupuesto', inp(form.nroPresupuesto, set('nroPresupuesto')))}
            {campo('Cliente', inp(form.cliente, set('cliente')))}
            {campo('Fecha', inp(form.fecha, set('fecha'), 'DD/MM/AAAA'))}
            {campo('Vigencia', inp(form.vigencia, set('vigencia'), 'DD/MM/AAAA'))}
            {campo('Origen', inp(form.origen, set('origen')))}
            {campo('Destino', inp(form.destino, set('destino')))}
          </div>
        </div>

        {/* SALIDA / RETORNO */}
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E0E0E0', padding: 24 }}>
          {seccionTitulo('Salida / Retorno')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
            {campo('Fecha Salida', inp(form.salidaFecha, set('salidaFecha'), 'DD/MM/AAAA'))}
            {campo('Hora Salida', inp(form.salidaHora, set('salidaHora'), 'HH:MM'))}
            {campo('Fecha Retorno', inp(form.retornoFecha, set('retornoFecha'), 'DD/MM/AAAA'))}
            {campo('Hora Retorno', inp(form.retornoHora, set('retornoHora'), 'HH:MM'))}
          </div>
        </div>

        {/* VEHICULO Y SERVICIOS */}
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E0E0E0', padding: 24 }}>
          {seccionTitulo('Vehículo y Servicios')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
            {campo('Movimiento', inp(form.movimiento, set('movimiento')))}
            {campo('Adicionales', inp(form.adicionales, set('adicionales')))}
            {campo('Cant. Movimientos', inp(form.cantMov, set('cantMov')))}
            {campo('Cant. Adicionales', inp(form.cantAdi, set('cantAdi')))}
            {campo('Aloj. y Viát. a cargo de', inp(form.alojViaticosCargo, set('alojViaticosCargo')))}
            {campo('Importe Aloj. y Viát.', inp(form.importAlojViaticos, set('importAlojViaticos')))}
            {campo('Capacidad', inp(form.capacidad, set('capacidad')))}
          </div>
        </div>

        {/* COSTOS */}
        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E0E0E0', padding: 24 }}>
          {seccionTitulo('Costos')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
            {campo('Costo Total', inp(form.costoTotal, set('costoTotal')))}
            {campo('Costo + IVA (10.5%)', inp(form.costoIva, () => {}, '', 'text', true))}
          </div>
        </div>

      </div>
    </div>
  );

  // ── TABLA ──
  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>Presupuestos</div>
        <button onClick={nuevo}
          style={{ padding: '8px 18px', background: '#F5C400', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1A1A1A', cursor: 'pointer' }}>
          + Nuevo
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="Buscar por cliente o número..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscarPorNro()}
          style={{ flex: 1, padding: '10px 14px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, background: '#fff', outline: 'none' }} />
        <button onClick={buscarPorNro}
          style={{ padding: '10px 18px', background: '#1A1A1A', color: '#F5C400', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          Buscar
        </button>
      </div>

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