import React, { useState } from 'react';
import { useColeccion } from './hooks/useFirestore';
import { db } from './constants/firebase';
import { collection, addDoc, updateDoc, doc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { generarPresupuestoPDF } from './helpers/generarPresupuestoPDF';

const hoy = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};

// Solo dígitos
const soloNumeros = (texto) => (texto || '').replace(/[^0-9]/g, '');

// El usuario solo escribe números: las barras se insertan solas después
// del día (2 dígitos) y del mes (2 dígitos). Corta en 8 dígitos (DDMMAAAA).
const formatearFecha = (texto) => {
  const limpio = (texto || '').replace(/[^0-9]/g, '').slice(0, 8);
  if (limpio.length > 4) return `${limpio.slice(0, 2)}/${limpio.slice(2, 4)}/${limpio.slice(4, 8)}`;
  if (limpio.length > 2) return `${limpio.slice(0, 2)}/${limpio.slice(2, 4)}`;
  return limpio;
};

// Igual que la fecha pero HH:MM (4 dígitos, con ":" automático)
const formatearHora = (texto) => {
  const limpio = (texto || '').replace(/[^0-9]/g, '').slice(0, 4);
  if (limpio.length > 2) return `${limpio.slice(0, 2)}:${limpio.slice(2, 4)}`;
  return limpio;
};

const FORM_VACIO = {
  nroPresupuesto: '', cliente: '', fecha: hoy(), vigencia: hoy(),
  origen: '', destino: '', kmRecorrer: '', salidaFecha: hoy(), salidaHora: '',
  retornoFecha: '', retornoHora: '', movimiento: 'NO', movimientoDetalle: '',
  adicionales: 'NO', adicionalesDetalle: '', alojViaticosCargo: '',
  importAlojViaticos: '', capacidad: '', tipoTransporte: '', costoTotal: '', costoIva: '', estado: 'pendiente',
};

const inp = (value, onChange, placeholder = '', type = 'text', readOnly = false) => (
  <input type={type} value={value || ''} onChange={onChange} placeholder={placeholder} readOnly={readOnly}
    className={readOnly ? '' : 'nd-input'}
    style={{ padding: '8px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, background: readOnly ? '#F0F0F0' : '#F8F8F8', outline: 'none', width: '100%', color: readOnly ? '#888' : '#1A1A1A', transition: 'background 0.15s' }} />
);

const txtArea = (value, onChange, placeholder = '', rows = 3) => (
  <textarea value={value || ''} onChange={onChange} placeholder={placeholder} rows={rows}
    className="nd-input"
    style={{ padding: '8px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, background: '#F8F8F8', outline: 'none', width: '100%', color: '#1A1A1A', resize: 'vertical', fontFamily: 'inherit', transition: 'background 0.15s' }} />
);

const sel = (value, onChange, options = []) => (
  <select value={value || 'NO'} onChange={onChange} className="nd-input"
    style={{ padding: '8px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, background: '#F8F8F8', outline: 'none', width: '100%', color: '#1A1A1A', cursor: 'pointer', transition: 'background 0.15s' }}>
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

const lbl = (texto) => (
  <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>{texto}</label>
);

const campo = (label, children) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 16 }}>
    {lbl(label)}
    {children}
  </div>
);

// Tarjeta con barra de título negra
const Seccion = ({ titulo, children }) => (
  <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E0E0E0', overflow: 'hidden' }}>
    <div style={{ background: '#1A1A1A', padding: '10px 24px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#F5C400', textTransform: 'uppercase', letterSpacing: 1 }}>{titulo}</div>
    </div>
    <div style={{ padding: 24 }}>{children}</div>
  </div>
);

const btnBuscar = (onClick) => (
  <button onClick={onClick}
    style={{ padding: '9px 0', background: '#F5C400', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#1A1A1A', cursor: 'pointer', width: '100%' }}>
    BUSCAR
  </button>
);

const btnChico = (texto, onClick, disabled) => (
  <button onClick={onClick} disabled={disabled}
    style={{ padding: '9px 0', background: '#fff', border: '1px solid #1A1A1A', borderRadius: 8, fontSize: 11, fontWeight: 700, color: disabled ? '#CCC' : '#1A1A1A', cursor: disabled ? 'default' : 'pointer', width: '100%', opacity: disabled ? 0.5 : 1 }}>
    {texto}
  </button>
);

const resultadoItem = (texto, onClick) => (
  <div onClick={onClick}
    style={{ padding: '8px 10px', background: '#F8F8F8', border: '0.5px solid #E0E0E0', borderRadius: 6, fontSize: 12, marginTop: 4, cursor: 'pointer' }}>
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

  // ── Búsqueda dentro del formulario ──
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [busquedaNro, setBusquedaNro] = useState('');
  const [resultadosCliente, setResultadosCliente] = useState([]);
  const [resultadosNro, setResultadosNro] = useState([]);

  // ── Navegación Primero/Anterior/Siguiente/Ultimo ──
  const listaOrdenada = [...presupuestos].sort((a, b) => Number(a.nroPresupuesto) - Number(b.nroPresupuesto));
  const indiceActual = listaOrdenada.findIndex((p) => p.id === docId);

  const CAMPOS_FECHA = ['fecha', 'vigencia', 'salidaFecha', 'retornoFecha'];
  const CAMPOS_HORA = ['salidaHora', 'retornoHora'];
  const CAMPOS_NUMERICOS = ['nroPresupuesto', 'kmRecorrer'];

  // Función para obtener el próximo número de presupuesto (autoincremental arrancando en 1)
  const obtenerProximoNro = () => {
    const numeros = presupuestos.map((p) => Number(p.nroPresupuesto)).filter((n) => !isNaN(n) && n > 0);
    const maxNro = numeros.length > 0 ? Math.max(...numeros) : 0;
    return String(maxNro + 1);
  };

  // Suma días a una fecha "DD/MM/AAAA" y devuelve "DD/MM/AAAA"
  const sumarDias = (fecha, dias) => {
    if (!fecha) return '';
    const [dd, mm, aaaa] = fecha.split('/');
    if (!dd || !mm || !aaaa) return fecha;
    const d = new Date(Number(aaaa), Number(mm) - 1, Number(dd));
    d.setDate(d.getDate() + dias);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const set = (key) => (e) => {
    let val = e.target.value;
    if (CAMPOS_FECHA.includes(key)) val = formatearFecha(val);
    else if (CAMPOS_HORA.includes(key)) val = formatearHora(val);
    else if (CAMPOS_NUMERICOS.includes(key)) val = soloNumeros(val);
    setForm(prev => {
      const updated = { ...prev, [key]: val };
      if (key === 'fecha') {
        updated.vigencia = sumarDias(val, 30);
      }
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
    setResultadosCliente([]);
    setResultadosNro([]);
  };

  const nuevo = () => {
    const proximoNro = obtenerProximoNro();
    setForm({ ...FORM_VACIO, nroPresupuesto: proximoNro });
    setDocId(null);
    setVista('form');
  };

  const buscarCliente = () => {
    if (!busquedaCliente.trim()) return;
    const encontrados = presupuestos.filter((p) =>
      (p.cliente || '').toLowerCase().includes(busquedaCliente.trim().toLowerCase())
    );
    setResultadosCliente(encontrados);
    if (encontrados.length === 0) alert('No se encontraron presupuestos con ese cliente');
  };

  const buscarNro = () => {
    if (!busquedaNro.trim()) return;
    const encontrado = presupuestos.find((p) => String(p.nroPresupuesto) === busquedaNro.trim());
    if (encontrado) {
      seleccionar(encontrado);
    } else {
      alert('No se encontró ningún presupuesto con ese número');
    }
  };

  const irPrimero = () => listaOrdenada.length && seleccionar(listaOrdenada[0]);
  const irUltimo = () => listaOrdenada.length && seleccionar(listaOrdenada[listaOrdenada.length - 1]);
  const irAnterior = () => indiceActual > 0 && seleccionar(listaOrdenada[indiceActual - 1]);
  const irSiguiente = () => {
    if (listaOrdenada.length === 0) return;
    if (indiceActual >= 0 && indiceActual < listaOrdenada.length - 1) {
      seleccionar(listaOrdenada[indiceActual + 1]);
      return;
    }
    const proximoNro = obtenerProximoNro();
    setForm({ ...FORM_VACIO, nroPresupuesto: proximoNro });
    setDocId(null);
  };

  const { ipcRenderer } = window.require ? window.require('electron') : {};

  const copiar = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(form, null, 2));
      alert('Datos copiados al portapapeles');
    }
  };

  const guardar = async () => {
    if (!form.nroPresupuesto.trim()) { 
      alert('Ingresá un número de presupuesto'); 
      return; 
    }
    setGuardando(true);

    try {
      // 1. Guardado en Firebase
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

      // 2. Envío a Google Sheets (con tipoDoc especificado)
      const webhookUrl = 'https://script.google.com/macros/s/AKfycbzujjs9mK50DDfnhKPJPGKTW7ZtbdqorfmpJKFhAEA1wumTEDr3L5WM8WtRkYNoreUYHQ/exec';

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          ...form,
          tipoDoc: 'presupuesto'
        })
      });

      alert('Presupuesto guardado');
    } catch (error) {
      alert('Error al guardar: ' + error.message);
    }
    setGuardando(false);
  };

  const generarPDF = async () => {
    try {
      const pdfBytes = await generarPresupuestoPDF(form);
      if (ipcRenderer) {
        const result = await ipcRenderer.invoke('guardar-pdf', {
          nombre: `Presupuesto_${form.nroPresupuesto || 'nuevo'}.pdf`,
          buffer: Array.from(pdfBytes),
          tipo: 'presupuesto'
        });
        if (result.ok) {
          alert(`PDF guardado en: ${result.ruta}`);
        } else {
          alert(`Error al guardar PDF: ${result.error}`);
        }
      }
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
        const item = { id: snap.docs[0].id, ...snap.docs[0].data() };
        seleccionar(item);
        setVista('form');
      } else {
        alert('No se encontró ningún presupuesto con ese número');
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  // ── Orden de la tabla ──
  const [orden, setOrden] = useState({ campo: null, asc: true });

  const toggleOrden = (campo) => {
    setOrden((prev) => (prev.campo === campo ? { campo, asc: !prev.asc } : { campo, asc: true }));
  };

  const aFechaOrden = (fecha, hora) => {
    if (!fecha) return new Date(0);
    const [dd, mm, aaaaRaw] = fecha.split('/');
    if (!dd || !mm || !aaaaRaw) return new Date(0);
    const aaaa = aaaaRaw.length === 2 ? `20${aaaaRaw}` : aaaaRaw;
    const [hh = '00', min = '00'] = (hora || '').split(':');
    return new Date(Number(aaaa), Number(mm) - 1, Number(dd), Number(hh) || 0, Number(min) || 0);
  };

  const COMPARADORES = {
    nro: (a, b) => (Number(a.nroPresupuesto) || 0) - (Number(b.nroPresupuesto) || 0),
    cliente: (a, b) => (a.cliente || '').localeCompare(b.cliente || '', 'es', { sensitivity: 'base' }),
    origen: (a, b) => (a.origen || '').localeCompare(b.origen || '', 'es', { sensitivity: 'base' }),
    salida: (a, b) => aFechaOrden(a.salidaFecha, a.salidaHora) - aFechaOrden(b.salidaFecha, b.salidaHora),
    costo: (a, b) => (Number(a.costoTotal) || 0) - (Number(b.costoTotal) || 0),
  };

  const filtrados = presupuestos
    .filter(p =>
      (p.cliente || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.nroPresupuesto || '').toString().includes(busqueda)
    )
    .sort((a, b) => {
      if (!orden.campo) return 0;
      const resultado = COMPARADORES[orden.campo](a, b);
      return orden.asc ? resultado : -resultado;
    });

  // Opciones para los selects de SÍ/NO
  const opcionesSiNo = [
    { label: 'NO', value: 'NO' },
    { label: 'SÍ', value: 'SI' }
  ];

  // ── FORMULARIO ──
  if (vista === 'form') return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <style>{`.nd-input:focus { background: #FFF3C4 !important; border-color: #F5C400 !important; }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', columnGap: 28, rowGap: 12 }}>
          <button onClick={() => setVista('tabla')}
            style={{ padding: '7px 16px', background: 'transparent', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
            ← Volver
          </button>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>
            {form.nroPresupuesto ? `Presupuesto N° ${form.nroPresupuesto}` : 'Nuevo Presupuesto'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={copiar}
            style={{ padding: '9px 20px', background: '#F2F2F2', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Copiar
          </button>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* BÚSQUEDA */}
        <Seccion titulo="Búsqueda">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', columnGap: 40, rowGap: 22 }}>
            <div>
              {campo('Cliente', inp(busquedaCliente, (e) => setBusquedaCliente(e.target.value), 'Buscar por nombre...'))}
              <div style={{ marginTop: 8 }}>{btnBuscar(buscarCliente)}</div>
              {resultadosCliente.map((r) => resultadoItem(`${r.cliente} — N° ${r.nroPresupuesto}`, () => seleccionar(r)))}
            </div>
            <div>
              {campo('Nro. Presupuesto', inp(busquedaNro, (e) => setBusquedaNro(e.target.value), 'Buscar por id...'))}
              <div style={{ marginTop: 8 }}>{btnBuscar(buscarNro)}</div>
            </div>
          </div>
        </Seccion>

        {/* NAVEGAR PRESUPUESTOS */}
        <Seccion titulo="Navegar Presupuestos">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', columnGap: 28, rowGap: 12 }}>
            {btnChico('PRIMERO', irPrimero, listaOrdenada.length === 0)}
            {btnChico('ANTERIOR', irAnterior, indiceActual <= 0)}
            {btnChico('SIGUIENTE', irSiguiente, listaOrdenada.length === 0)}
            {btnChico('ULTIMO', irUltimo, listaOrdenada.length === 0)}
          </div>
        </Seccion>

        {/* DATOS GENERALES */}
        <Seccion titulo="Datos Generales">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: 36, rowGap: 22 }}>
            {campo('Nro. Presupuesto', inp(form.nroPresupuesto, () => {}, '', 'text', true))}
            {campo('Cliente', inp(form.cliente, set('cliente')))}
            {campo('Fecha', inp(form.fecha, set('fecha'), 'DD/MM/AAAA'))}
            {campo('Vigencia', inp(form.vigencia, set('vigencia'), 'DD/MM/AAAA'))}
            {campo('Origen', inp(form.origen, set('origen')))}
            {campo('Destino', inp(form.destino, set('destino')))}
            {campo('Km. a Recorrer', inp(form.kmRecorrer, set('kmRecorrer'), '0'))}
          </div>
        </Seccion>

        {/* SALIDA / RETORNO */}
        <Seccion titulo="Salida / Retorno">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', columnGap: 36, rowGap: 22 }}>
            {campo('Fecha Salida', inp(form.salidaFecha, set('salidaFecha'), 'DD/MM/AAAA'))}
            {campo('Hora Salida', inp(form.salidaHora, set('salidaHora'), 'HH:MM'))}
            {campo('Fecha Retorno', inp(form.retornoFecha, set('retornoFecha'), 'DD/MM/AAAA'))}
            {campo('Hora Retorno', inp(form.retornoHora, set('retornoHora'), 'HH:MM'))}
          </div>
        </Seccion>

        {/* VEHICULO Y SERVICIOS */}
        <Seccion titulo="Vehículo y Servicios">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', columnGap: 36, rowGap: 22, alignItems: 'start' }}>
            <div>
              {campo('Movimiento', sel(form.movimiento, set('movimiento'), opcionesSiNo))}
              {form.movimiento === 'SI' && (
                <div style={{ marginTop: 8 }}>
                  {inp(form.movimientoDetalle, set('movimientoDetalle'), 'Detallar movimientos...')}
                </div>
              )}
            </div>

            <div>
              {campo('Adicionales', sel(form.adicionales, set('adicionales'), opcionesSiNo))}
              {form.adicionales === 'SI' && (
                <div style={{ marginTop: 8 }}>
                  {inp(form.adicionalesDetalle, set('adicionalesDetalle'), 'Detallar adicionales...')}
                </div>
              )}
            </div>

            {campo('Aloj. y Viát. a cargo de', inp(form.alojViaticosCargo, set('alojViaticosCargo')))}
            {campo('Importe Aloj. y Viát.', inp(form.importAlojViaticos, set('importAlojViaticos')))}
            {campo('Cap. Transporte', inp(form.capacidad, set('capacidad')))}
            {campo('Tipo Transporte', txtArea(form.tipoTransporte, set('tipoTransporte'), 'Detallar características o tipo de transporte...', 3))}
          </div>
        </Seccion>

        {/* COSTOS */}
        <Seccion titulo="Costos">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: 36, rowGap: 22 }}>
            {campo('Costo Total', inp(form.costoTotal, set('costoTotal')))}
            {campo('Costo + IVA (10.5%)', inp(form.costoIva, () => {}, '', 'text', true))}
          </div>
        </Seccion>

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
              {[
                { label: 'Nro', campo: 'nro' },
                { label: 'Cliente', campo: 'cliente' },
                { label: 'Origen → Destino', campo: 'origen' },
                { label: 'Salida', campo: 'salida' },
                { label: 'Costo Total', campo: 'costo' },
                { label: 'Estado', campo: null },
              ].map(({ label, campo }) => (
                <th key={label}
                  onClick={() => campo && toggleOrden(campo)}
                  style={{
                    padding: '10px 20px', textAlign: 'left', fontSize: 10, fontWeight: 600,
                    color: orden.campo === campo ? '#1A1A1A' : '#888', textTransform: 'uppercase',
                    letterSpacing: 0.5, borderBottom: '0.5px solid #F0F0F0',
                    cursor: campo ? 'pointer' : 'default', userSelect: 'none',
                  }}>
                  {label}{campo && orden.campo === campo ? (orden.asc ? ' ▲' : ' ▼') : ''}
                </th>
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
                <tr key={row.id} onClick={() => { seleccionar(row); setVista('form'); }} style={{ cursor: 'pointer' }}
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