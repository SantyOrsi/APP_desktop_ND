import React, { useState } from 'react';
import { useColeccion } from './hooks/useFirestore';
import { db } from './constants/firebase';
import { collection, addDoc, updateDoc, doc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { generarContratoPDF } from './helpers/generarContratoPDF';
const { ipcRenderer } = window.require('electron');

const hoy = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};

const soloNumeros = (texto) => (texto || '').replace(/[^0-9]/g, '');

const formatearFecha = (texto) => {
  const limpio = (texto || '').replace(/[^0-9]/g, '').slice(0, 8);
  if (limpio.length > 4) return `${limpio.slice(0, 2)}/${limpio.slice(2, 4)}/${limpio.slice(4, 8)}`;
  if (limpio.length > 2) return `${limpio.slice(0, 2)}/${limpio.slice(2, 4)}`;
  return limpio;
};

const fechaCompleta = (texto) => /^\d{2}\/\d{2}\/\d{4}$/.test(texto || '');

const OPCIONES_ESTADO = ['Reservado', 'Señado', 'Suspendido', 'Abonado'];
const CICLO_FILTRO = [null, ...OPCIONES_ESTADO];

const FORM_VACIO = {
  fechaContrato: '', clienteNombre: '', cuitDni: '', telefono: '',
  domicilioCliente: '', ciudad: '', domicilioOrigen: '', domicilioDestino: '',
  senia: '', saldo: '', estado: '', metodoPago: '', fechaCancelacion: '',
};

const inp = (value, onChange, placeholder = '', type = 'text', readOnly = false) => (
  <input type={type} value={value || ''} onChange={onChange} placeholder={placeholder} readOnly={readOnly}
    className={readOnly ? '' : 'nd-input'}
    style={{ padding: '8px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, background: readOnly ? '#F0F0F0' : '#F8F8F8', outline: 'none', width: '100%', color: readOnly ? '#888' : '#1A1A1A', transition: 'background 0.15s' }} />
);

const sel = (value, onChange, disabled) => (
  <select value={value || ''} onChange={onChange} disabled={disabled} className="nd-input"
    style={{ padding: '8px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, background: disabled ? '#F0F0F0' : '#F8F8F8', outline: 'none', width: '100%', color: '#1A1A1A' }}>
    <option value="">Seleccionar...</option>
    {OPCIONES_ESTADO.map((op) => <option key={op} value={op}>{op}</option>)}
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

export default function Contratos() {
  const { datos: contratos, cargando } = useColeccion('contratos');
  const { datos: presupuestosTodos } = useColeccion('presupuestos');
  const [busquedaTabla, setBusquedaTabla] = useState('');
  const [vista, setVista] = useState('tabla');
  const [form, setForm] = useState(FORM_VACIO);
  const [docId, setDocId] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // ── Datos del presupuesto vinculado (se llenan al buscar) ──
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [busquedaNro, setBusquedaNro] = useState('');
  const [fecha, setFecha] = useState('');
  const [destino, setDestino] = useState('');
  const [resultadosCliente, setResultadosCliente] = useState([]);
  const [resultadosNro, setResultadosNro] = useState([]);
  const [resultadosFecha, setResultadosFecha] = useState([]);
  const [resultadosDestino, setResultadosDestino] = useState([]);
  const [nroPresupuesto, setNroPresupuesto] = useState('');
  const [clienteEncontrado, setClienteEncontrado] = useState('');
  const [costoTotal, setCostoTotal] = useState('0');
  const [presupuestoVinculado, setPresupuestoVinculado] = useState(null);

  // No se puede escribir en los datos del contrato ni guardar/PDF hasta
  // presionar ALTA CONTRATO (lo que requiere haber encontrado un presupuesto)
  const bloqueado = !form.fechaContrato;

  const CAMPOS_FECHA = ['fechaContrato', 'fechaCancelacion'];
  const CAMPOS_NUMERICOS = ['cuitDni', 'telefono', 'senia', 'saldo'];

  const set = (key) => (e) => {
    let val = e.target.value;
    if (CAMPOS_FECHA.includes(key)) val = formatearFecha(val);
    else if (CAMPOS_NUMERICOS.includes(key)) val = soloNumeros(val);
    setForm((prev) => {
      const updated = { ...prev, [key]: val };
      if (key === 'senia') {
        const total = parseFloat(costoTotal) || 0;
        const senia = parseFloat(val) || 0;
        updated.saldo = (total - senia).toFixed(2);
      }
      return updated;
    });
  };

  const limpiarResultados = () => {
    setResultadosCliente([]);
    setResultadosNro([]);
    setResultadosFecha([]);
    setResultadosDestino([]);
  };

  // Al encontrar un presupuesto por cualquiera de las 4 búsquedas: completa
  // las otras 3, y si ya existe un contrato para ese presupuesto lo carga
  // (si no existe, deja los campos del contrato en blanco para cargarlo).
  const seleccionarPresupuesto = async (item) => {
    setBusquedaCliente(item.cliente || '');
    setBusquedaNro(item.nroPresupuesto || '');
    setFecha(item.fecha || '');
    setDestino(item.destino || '');
    setNroPresupuesto(item.nroPresupuesto || '');
    setClienteEncontrado(item.cliente || '');
    setCostoTotal(item.costoTotal || '0');
    setPresupuestoVinculado(item);
    limpiarResultados();

    try {
      const q = query(collection(db, 'contratos'), where('nroPresupuesto', '==', String(item.nroPresupuesto).trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setDocId(snap.docs[0].id);
        const existente = snap.docs[0].data();
        setForm({ ...FORM_VACIO, ...existente });
      } else {
        setDocId(null);
        setForm(FORM_VACIO);
      }
    } catch (error) {
      alert('Error al buscar contrato: ' + error.message);
    }
  };

  // Sugerencias en vivo mientras se escribe (filtra localmente, sin ir a Firestore)
  const sugerirCliente = (texto) => {
    setBusquedaCliente(texto);
    const filtro = texto.trim().toLowerCase();
    setResultadosCliente(
      filtro ? presupuestosTodos.filter((p) => (p.cliente || '').toLowerCase().includes(filtro)).slice(0, 8) : []
    );
  };

  const sugerirDestino = (texto) => {
    setDestino(texto);
    const filtro = texto.trim().toLowerCase();
    setResultadosDestino(
      filtro ? presupuestosTodos.filter((p) => (p.destino || '').toLowerCase().includes(filtro)).slice(0, 8) : []
    );
  };

  const buscarCliente = async () => {
    if (!busquedaCliente.trim()) return;
    const filtro = busquedaCliente.trim().toLowerCase();
    const datos = presupuestosTodos.filter((p) => (p.cliente || '').toLowerCase().includes(filtro));
    setResultadosCliente(datos);
    if (datos.length === 0) alert('No se encontraron presupuestos con ese cliente');
    else if (datos.length === 1) seleccionarPresupuesto(datos[0]);
  };

  const buscarNro = async () => {
    if (!busquedaNro.trim()) return;
    const q = query(collection(db, 'presupuestos'), where('nroPresupuesto', '==', busquedaNro.trim()));
    const snap = await getDocs(q);
    const datos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setResultadosNro(datos);
    if (datos.length === 0) alert('No se encontró ningún presupuesto con ese número');
    else if (datos.length === 1) seleccionarPresupuesto(datos[0]);
  };

  const buscarFecha = async () => {
    if (!fecha.trim()) return;
    const q = query(collection(db, 'presupuestos'), where('fecha', '==', fecha.trim()));
    const snap = await getDocs(q);
    const datos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setResultadosFecha(datos);
    if (datos.length === 0) alert('No se encontraron presupuestos con esa fecha');
    else if (datos.length === 1) seleccionarPresupuesto(datos[0]);
  };

  const buscarDestino = async () => {
    if (!destino.trim()) return;
    const filtro = destino.trim().toLowerCase();
    const datos = presupuestosTodos.filter((p) => (p.destino || '').toLowerCase().includes(filtro));
    setResultadosDestino(datos);
    if (datos.length === 0) alert('No se encontraron presupuestos con ese destino');
    else if (datos.length === 1) seleccionarPresupuesto(datos[0]);
  };

  const handleAltaContrato = () => {
    if (!clienteEncontrado) {
      alert('Primero buscá y seleccioná un presupuesto');
      return;
    }
    setForm((prev) => ({
      ...prev,
      fechaContrato: hoy(),
      clienteNombre: clienteEncontrado,
      ciudad: presupuestoVinculado?.origen || prev.ciudad,
    }));
  };

  // ── Navegar contratos ya guardados (independiente de la búsqueda de arriba) ──
  const listaOrdenada = [...contratos].sort((a, b) => Number(a.nroPresupuesto) - Number(b.nroPresupuesto));
  const indiceActual = listaOrdenada.findIndex((c) => c.id === docId);

  const seleccionarContrato = (item) => {
    setDocId(item.id);
    setNroPresupuesto(item.nroPresupuesto || '');
    setClienteEncontrado(item.cliente || item.clienteNombre || '');
    setFecha(item.fechaPresupuesto || '');
    setDestino(item.destino || '');
    setCostoTotal(item.costoTotal || '0');
    setBusquedaCliente(item.cliente || item.clienteNombre || '');
    setBusquedaNro(item.nroPresupuesto || '');
    setPresupuestoVinculado(null);
    setForm({ ...FORM_VACIO, ...item });
    limpiarResultados();
  };

  const irPrimero = () => listaOrdenada.length && seleccionarContrato(listaOrdenada[0]);
  const irUltimo = () => listaOrdenada.length && seleccionarContrato(listaOrdenada[listaOrdenada.length - 1]);
  const irAnterior = () => indiceActual > 0 && seleccionarContrato(listaOrdenada[indiceActual - 1]);
  const irSiguiente = () => indiceActual >= 0 && indiceActual < listaOrdenada.length - 1 && seleccionarContrato(listaOrdenada[indiceActual + 1]);

  const nuevo = () => {
    setForm(FORM_VACIO);
    setDocId(null);
    setNroPresupuesto('');
    setClienteEncontrado('');
    setFecha('');
    setDestino('');
    setBusquedaCliente('');
    setBusquedaNro('');
    setCostoTotal('0');
    setPresupuestoVinculado(null);
    limpiarResultados();
    setVista('form');
  };

  const guardar = async () => {
    if (bloqueado) { alert('Primero buscá un presupuesto y presioná ALTA CONTRATO'); return; }
    if (!nroPresupuesto.trim()) { alert('Primero buscá y seleccioná un presupuesto'); return; }
    for (const c of CAMPOS_FECHA) {
      if (form[c] && !fechaCompleta(form[c])) {
        alert(`La fecha "${c}" está incompleta. Usá el formato DD/MM/AAAA.`);
        return;
      }
    }
    setGuardando(true);
    try {
      const datos = {
        nroPresupuesto,
        cliente: clienteEncontrado,
        fechaPresupuesto: fecha,
        destino,
        costoTotal,
        ...form,
        actualizadoEn: Timestamp.now(),
      };
      const q = query(collection(db, 'contratos'), where('nroPresupuesto', '==', nroPresupuesto.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, 'contratos', snap.docs[0].id), datos);
        setDocId(snap.docs[0].id);
      } else {
        datos.creadoEn = Timestamp.now();
        const ref = await addDoc(collection(db, 'contratos'), datos);
        setDocId(ref.id);
      }
    } catch (error) {
      alert('Error al guardar: ' + error.message);
    }
    setGuardando(false);
  };

  const copiar = () => {
    navigator.clipboard?.writeText(JSON.stringify(form, null, 2));
    console.log('COPIAR:', form);
  };

  const generarPDF = async () => {
    try {
      let presu = presupuestoVinculado;
      if (!presu && nroPresupuesto) {
        const q = query(collection(db, 'presupuestos'), where('nroPresupuesto', '==', String(nroPresupuesto).trim()));
        const snap = await getDocs(q);
        if (!snap.empty) presu = snap.docs[0].data();
      }
      const pdfBytes = await generarContratoPDF(
        { ...presu, nroPresupuesto, destino, costoTotal, costoIva: presu?.costoIva },
        form
      );
      const result = await ipcRenderer.invoke('guardar-pdf', {
        nombre: `Contrato_${nroPresupuesto || 'nuevo'}.pdf`,
        buffer: Array.from(pdfBytes),
        tipo: 'contrato', // main.js usa esto para elegir la carpeta de destino
      });
      if (result.ok) alert(`PDF guardado en: ${result.ruta}`);
      else if (result.error) alert('Error al generar PDF: ' + result.error);
    } catch (error) {
      alert('Error al generar PDF: ' + error.message);
    }
  };
  const handleGuardarPDF = async () => { await guardar(); await generarPDF(); };

  const buscarPorNroTabla = () => {
    if (!busquedaTabla.trim()) return;
    const encontrado = contratos.find((c) => String(c.nroPresupuesto) === busquedaTabla.trim());
    if (encontrado) { seleccionarContrato(encontrado); setVista('form'); }
    else alert('No se encontró ningún contrato con ese número');
  };

  // ── Orden (columnas normales) + filtro cíclico (Estado) ──
  const [orden, setOrden] = useState({ campo: null, asc: true });
  const [filtroEstado, setFiltroEstado] = useState(null);

  const toggleOrden = (campo) => {
    setOrden((prev) => (prev.campo === campo ? { campo, asc: !prev.asc } : { campo, asc: true }));
  };
  const toggleFiltroEstado = () => {
    const idx = CICLO_FILTRO.indexOf(filtroEstado);
    setFiltroEstado(CICLO_FILTRO[(idx + 1) % CICLO_FILTRO.length]);
  };

  const COMPARADORES = {
    nro: (a, b) => (Number(a.nroPresupuesto) || 0) - (Number(b.nroPresupuesto) || 0),
    cliente: (a, b) => (a.clienteNombre || '').localeCompare(b.clienteNombre || '', 'es', { sensitivity: 'base' }),
    telefono: (a, b) => (a.telefono || '').localeCompare(b.telefono || '', 'es', { sensitivity: 'base' }),
    domicilio: (a, b) => (a.domicilioCliente || '').localeCompare(b.domicilioCliente || '', 'es', { sensitivity: 'base' }),
    senia: (a, b) => (Number(a.senia) || 0) - (Number(b.senia) || 0),
    metodoPago: (a, b) => (a.metodoPago || '').localeCompare(b.metodoPago || '', 'es', { sensitivity: 'base' }),
  };

  const filtrados = contratos
    .filter((c) =>
      (c.clienteNombre || '').toLowerCase().includes(busquedaTabla.toLowerCase()) ||
      (c.nroPresupuesto || '').toString().includes(busquedaTabla)
    )
    .filter((c) => !filtroEstado || c.estado === filtroEstado)
    .sort((a, b) => {
      if (!orden.campo) return 0;
      const resultado = COMPARADORES[orden.campo](a, b);
      return orden.asc ? resultado : -resultado;
    });

  // ── FORMULARIO ──
  if (vista === 'form') return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <style>{`.nd-input:focus { background: #FFF3C4 !important; border-color: #F5C400 !important; }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setVista('tabla')}
            style={{ padding: '7px 16px', background: 'transparent', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
            ← Volver
          </button>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>
            {nroPresupuesto ? `Contrato — Presupuesto N° ${nroPresupuesto}` : 'Nuevo Contrato'}
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

        {/* BÚSQUEDA PRESUPUESTO */}
        <Seccion titulo="Búsqueda Presupuesto">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', columnGap: 40, rowGap: 22, marginBottom: 20 }}>
            <div>
              {campo('Cliente', inp(busquedaCliente, (e) => sugerirCliente(e.target.value), 'Buscar por nombre...'))}
              <div style={{ marginTop: 8 }}>{btnBuscar(buscarCliente)}</div>
              {resultadosCliente.map((r) => resultadoItem(`${r.cliente} — N° ${r.nroPresupuesto}`, () => seleccionarPresupuesto(r)))}
            </div>
            <div>
              {campo('Nro. Presupuesto', inp(busquedaNro, (e) => setBusquedaNro(e.target.value), 'Buscar por id...'))}
              <div style={{ marginTop: 8 }}>{btnBuscar(buscarNro)}</div>
              {resultadosNro.map((r) => resultadoItem(`${r.cliente} — N° ${r.nroPresupuesto}`, () => seleccionarPresupuesto(r)))}
            </div>
            <div>
              {campo('Fecha', inp(fecha, (e) => setFecha(formatearFecha(e.target.value)), 'DD/MM/AAAA'))}
              <div style={{ marginTop: 8 }}>{btnBuscar(buscarFecha)}</div>
              {resultadosFecha.map((r) => resultadoItem(`${r.cliente} — N° ${r.nroPresupuesto}`, () => seleccionarPresupuesto(r)))}
            </div>
            <div>
              {campo('Destino', inp(destino, (e) => sugerirDestino(e.target.value), 'Buscar por destino...'))}
              <div style={{ marginTop: 8 }}>{btnBuscar(buscarDestino)}</div>
              {resultadosDestino.map((r) => resultadoItem(`${r.cliente} — N° ${r.nroPresupuesto}`, () => seleccionarPresupuesto(r)))}
            </div>
          </div>
          <button onClick={handleAltaContrato}
            style={{ width: '100%', padding: '12px 0', background: '#F5C400', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1A1A1A', cursor: 'pointer' }}>
            ALTA CONTRATO
          </button>
        </Seccion>

        {/* NAVEGAR CONTRATOS */}
        <Seccion titulo="Navegar Contratos">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', columnGap: 28, rowGap: 12 }}>
            {btnChico('PRIMERO', irPrimero, listaOrdenada.length === 0)}
            {btnChico('ANTERIOR', irAnterior, indiceActual <= 0)}
            {btnChico('SIGUIENTE', irSiguiente, indiceActual === -1 || indiceActual >= listaOrdenada.length - 1)}
            {btnChico('ULTIMO', irUltimo, listaOrdenada.length === 0)}
          </div>
        </Seccion>

        {/* FECHA CONTRATO */}
        <Seccion titulo="Fecha Contrato">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: 36 }}>
            {campo('Fecha Contrato',
              inp(form.fechaContrato, set('fechaContrato'), bloqueado ? 'Se completa al presionar ALTA CONTRATO' : 'DD/MM/AAAA')
            )}
          </div>
        </Seccion>

        {/* DATOS CLIENTE */}
        <Seccion titulo="Datos Cliente">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: 36, rowGap: 22 }}>
            {campo('Cliente', inp(form.clienteNombre, set('clienteNombre'), '', 'text', bloqueado))}
            {campo('Cuit-Dni', inp(form.cuitDni, set('cuitDni'), '', 'text', bloqueado))}
            {campo('Telefono', inp(form.telefono, set('telefono'), '', 'text', bloqueado))}
            {campo('Domicilio', inp(form.domicilioCliente, set('domicilioCliente'), '', 'text', bloqueado))}
          </div>
        </Seccion>

        {/* LUGARES */}
        <Seccion titulo="Lugares">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: 36, rowGap: 22 }}>
            {campo('Ciudad', inp(form.ciudad, set('ciudad'), '', 'text', bloqueado))}
            {campo('Domicilio Origen', inp(form.domicilioOrigen, set('domicilioOrigen'), '', 'text', bloqueado))}
            {campo('Domicilio Destino', inp(form.domicilioDestino, set('domicilioDestino'), '', 'text', bloqueado))}
          </div>
        </Seccion>

        {/* PAGO */}
        <Seccion titulo="Pago">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: 36, rowGap: 22 }}>
            {campo('Seña', inp(form.senia, set('senia'), '', 'text', bloqueado))}
            {campo('Saldo', inp(form.saldo, () => {}, '', 'text', true))}
            {campo('Estado', sel(form.estado, set('estado'), bloqueado))}
            {campo('Metodo de Pago', inp(form.metodoPago, set('metodoPago'), 'Ej: Efectivo, Transferencia', 'text', bloqueado))}
            {campo('Fecha Cancelación', inp(form.fechaCancelacion, set('fechaCancelacion'), 'DD/MM/AAAA', 'text', bloqueado))}
          </div>
        </Seccion>

      </div>
    </div>
  );

  // ── TABLA ──
  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>Contratos</div>
        <button onClick={nuevo}
          style={{ padding: '8px 18px', background: '#F5C400', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1A1A1A', cursor: 'pointer' }}>
          + Nuevo
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="Buscar por cliente o número..." value={busquedaTabla} onChange={e => setBusquedaTabla(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscarPorNroTabla()}
          style={{ flex: 1, padding: '10px 14px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, background: '#fff', outline: 'none' }} />
        <button onClick={buscarPorNroTabla}
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
                { label: 'Telefono', campo: 'telefono' },
                { label: 'Domicilio', campo: 'domicilio' },
                { label: 'Seña', campo: 'senia' },
                { label: 'Metodo de Pago', campo: 'metodoPago' },
              ].map(({ label, campo }) => (
                <th key={label}
                  onClick={() => toggleOrden(campo)}
                  style={{
                    padding: '10px 20px', textAlign: 'left', fontSize: 10, fontWeight: 600,
                    color: orden.campo === campo ? '#1A1A1A' : '#888', textTransform: 'uppercase',
                    letterSpacing: 0.5, borderBottom: '0.5px solid #F0F0F0',
                    cursor: 'pointer', userSelect: 'none',
                  }}>
                  {label}{orden.campo === campo ? (orden.asc ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
              <th
                onClick={toggleFiltroEstado}
                style={{
                  padding: '10px 20px', textAlign: 'left', fontSize: 10, fontWeight: 600,
                  color: filtroEstado ? '#1A1A1A' : '#888', textTransform: 'uppercase',
                  letterSpacing: 0.5, borderBottom: '0.5px solid #F0F0F0',
                  cursor: 'pointer', userSelect: 'none',
                }}>
                Estado{filtroEstado ? ` (${filtroEstado})` : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#888' }}>Cargando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#888' }}>No hay contratos</td></tr>
            ) : (
              filtrados.map(row => (
                <tr key={row.id} onClick={() => { seleccionarContrato(row); setVista('form'); }} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.nroPresupuesto || '-'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.clienteNombre || '-'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.telefono || '-'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.domicilioCliente || '-'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.senia ? `$${row.senia}` : '-'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.metodoPago || '-'}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>
                    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: '#FFF8E1', color: '#F57F17' }}>
                      {row.estado || '-'}
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
