import React, { useState, useMemo } from 'react';
import { db } from './constants/firebase';
import { collection, addDoc, updateDoc, doc, Timestamp, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { generarServicioPDF } from './helpers/generarServicioPDF';
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

const formatearHora = (texto) => {
  const limpio = (texto || '').replace(/[^0-9]/g, '').slice(0, 4);
  if (limpio.length > 2) return `${limpio.slice(0, 2)}:${limpio.slice(2, 4)}`;
  return limpio;
};

const fechaCompleta = (texto) => /^\d{2}\/\d{2}\/\d{4}$/.test(texto || '');

const OPCIONES_ESTADO = [
  { key: 'pendiente', label: 'Pendiente' },
  { key: 'enRuta', label: 'En ruta' },
  { key: 'completo', label: 'Completo' },
];
const CICLO_FILTRO = [null, 'pendiente', 'enRuta', 'completo'];

const FORM_VACIO = {
  nropresupuesto: '', contacto: '', telefono: '', cuit: '', responsable: '', telefonoResponsable: '',
  capacidad: '', estado: 'pendiente', domicilioOrigen: '', domicilioDestino: '',
  salidaFecha: '', salidaHora: '', retornoFecha: '', retornoHora: '',
  movimientos: 'NO', movimientosDetalle: '', alojViaticos: '', dineroViaje: '', servicioABordo: 'No',
  infoAdicional: '', observaciones: '',
};

const inp = (value, onChange, placeholder = '', type = 'text', readOnly = false) => (
  <input type={type} value={value || ''} onChange={onChange} placeholder={placeholder} readOnly={readOnly} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
    className={readOnly ? '' : 'nd-input'}
    style={{ padding: '8px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, background: readOnly ? '#F0F0F0' : '#F8F8F8', outline: 'none', width: '100%', color: readOnly ? '#888' : '#1A1A1A', transition: 'background 0.15s' }} />
);

const sel = (value, onChange, disabled, opciones) => (
  <select value={value || ''} onChange={onChange} disabled={disabled} className="nd-input"
    style={{ padding: '8px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, background: disabled ? '#F0F0F0' : '#F8F8F8', outline: 'none', width: '100%', color: '#1A1A1A' }}>
    {opciones.map((op) => <option key={op.key} value={op.key}>{op.label}</option>)}
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

const ESTADO_COLOR = {
  pendiente: { bg: '#FFF8E1', color: '#F57F17' },
  enRuta: { bg: '#E3F2FD', color: '#1565C0' },
  completo: { bg: '#E8F5E9', color: '#2E7D32' },
};

export default function Servicios({ rol, servicios = [], presupuestosTodos = [], cargando = false }) {
  const esAdmin = rol === 'admin';
  const [busquedaTabla, setBusquedaTabla] = useState('');
  const [vista, setVista] = useState('tabla');
  const [verPapelera, setVerPapelera] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [docId, setDocId] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // ── Selección múltiple para eliminar (papelera) ──
  const [seleccionados, setSeleccionados] = useState([]);

  // ── Búsqueda (Cliente / Destino / Nro Presupuesto / Fecha) ──
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [busquedaDestino, setBusquedaDestino] = useState('');
  const [busquedaNro, setBusquedaNro] = useState('');
  const [busquedaFecha, setBusquedaFecha] = useState('');
  const [resultadosCliente, setResultadosCliente] = useState([]);
  const [resultadosDestino, setResultadosDestino] = useState([]);
  const [resultadosNro, setResultadosNro] = useState([]);
  const [resultadosFecha, setResultadosFecha] = useState([]);

  // No se puede escribir ni guardar hasta encontrar un servicio o presupuesto.
  // OJO: esto es un estado propio, no depende de que "nropresupuesto" tenga
  // contenido — si dependiera del campo, un servicio encontrado con ese dato
  // vacío dejaba todo bloqueado sin avisar.
  const [desbloqueado, setDesbloqueado] = useState(false);
  const bloqueado = !desbloqueado;

  const CAMPOS_FECHA = ['salidaFecha', 'retornoFecha'];
  const CAMPOS_HORA = ['salidaHora', 'retornoHora'];
  const CAMPOS_NUMERICOS = ['cuit', 'telefono', 'capacidad', 'dineroViaje'];

  const set = (key) => (e) => {
    let val = e.target.value;
    if (CAMPOS_FECHA.includes(key)) val = formatearFecha(val);
    else if (CAMPOS_HORA.includes(key)) val = formatearHora(val);
    else if (CAMPOS_NUMERICOS.includes(key)) val = soloNumeros(val);
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const limpiarResultados = () => {
    setResultadosCliente([]);
    setResultadosDestino([]);
    setResultadosNro([]);
    setResultadosFecha([]);
  };

  // Busca primero en 'servicios' (ya cargado) y si no hay, arma uno nuevo
  // a partir del 'presupuesto' + 'contrato' vinculados (mismo criterio que el celu).
  const buscarUnificado = (campoServicio, campoPresupuesto, valor, setResultados) => {
    if (!valor.trim()) return;
    const enServicios = servicios.filter((s) => (s[campoServicio] || '').toString().trim() === valor.trim());
    if (enServicios.length > 0) {
      setResultados(enServicios.map((s) => ({ ...s, _tipo: 'servicio' })));
      if (enServicios.length === 1) seleccionar({ ...enServicios[0], _tipo: 'servicio' });
      return;
    }
    const enPresupuestos = presupuestosTodos.filter((p) => (p[campoPresupuesto] || '').toString().trim() === valor.trim());
    if (enPresupuestos.length === 0) {
      alert('No se encontraron resultados');
      setResultados([]);
      return;
    }
    setResultados(enPresupuestos.map((p) => ({ ...p, _tipo: 'presupuesto' })));
    if (enPresupuestos.length === 1) seleccionar({ ...enPresupuestos[0], _tipo: 'presupuesto' });
  };

  // Sugerencias en vivo mientras se escribe (match parcial, no dispara selección sola)
  const sugerirUnificado = (campoServicio, campoPresupuesto, valor, setResultados) => {
    const filtro = valor.trim().toLowerCase();
    if (!filtro) { setResultados([]); return; }
    const deServicios = servicios
      .filter((s) => (s[campoServicio] || '').toString().toLowerCase().includes(filtro))
      .map((s) => ({ ...s, _tipo: 'servicio' }));
    const dePresupuestos = presupuestosTodos
      .filter((p) => (p[campoPresupuesto] || '').toString().toLowerCase().includes(filtro))
      .map((p) => ({ ...p, _tipo: 'presupuesto' }));
    setResultados([...deServicios, ...dePresupuestos].slice(0, 6));
  };

  const buscarCliente = () => buscarUnificado('contacto', 'cliente', busquedaCliente, setResultadosCliente);
  const buscarDestino = () => buscarUnificado('domicilioDestino', 'destino', busquedaDestino, setResultadosDestino);
  const buscarNro = () => buscarUnificado('nropresupuesto', 'nroPresupuesto', busquedaNro, setResultadosNro);
  const buscarFecha = () => buscarUnificado('salidaFecha', 'salidaFecha', busquedaFecha, setResultadosFecha);

  const seleccionar = async (it) => {
    if (it._tipo === 'servicio') {
      setForm({ ...FORM_VACIO, ...it });
      setDocId(it.id);
      setBusquedaCliente(it.contacto || '');
      setBusquedaNro(it.nropresupuesto || '');
      setBusquedaDestino(it.domicilioDestino || '');
      setBusquedaFecha(it.salidaFecha || '');
      setDesbloqueado(true);
      limpiarResultados();
      return;
    }

    // Es un presupuesto: arma el servicio combinando presupuesto + contrato
    let contrato = null;
    try {
      const q = query(collection(db, 'contratos'), where('nroPresupuesto', '==', it.nroPresupuesto));
      const snap = await getDocs(q);
      if (!snap.empty) contrato = snap.docs[0].data();
    } catch (error) {
      console.log('Error al buscar contrato:', error.message);
    }

    setForm((prev) => ({
      ...FORM_VACIO,
      nropresupuesto: it.nroPresupuesto || '',
      contacto: it.cliente || '',
      capacidad: it.capacidad || '',
      salidaFecha: it.salidaFecha || hoy(),
      salidaHora: it.salidaHora || '',
      retornoFecha: it.retornoFecha || hoy(),
      retornoHora: it.retornoHora || '',
      telefono: contrato?.telefono || '',
      cuit: contrato?.cuitDni || '',
      domicilioOrigen: contrato?.domicilioOrigen || '',
      domicilioDestino: contrato?.domicilioDestino || '',
      movimientos: it.movimiento || 'NO',
      movimientosDetalle: it.movimientoDetalle || '',
    }));
    setDocId(null);
    setBusquedaCliente(it.cliente || '');
    setBusquedaNro(it.nroPresupuesto || '');
    setBusquedaDestino(it.destino || '');
    setBusquedaFecha(it.salidaFecha || '');
    setDesbloqueado(true);
    limpiarResultados();
  };

  // ── Navegar servicios ya guardados ──
  const listaOrdenada = [...servicios].sort((a, b) => Number(a.nropresupuesto) - Number(b.nropresupuesto));
  const indiceActual = listaOrdenada.findIndex((s) => s.id === docId);

  const irPrimero = () => listaOrdenada.length && seleccionar({ ...listaOrdenada[0], _tipo: 'servicio' });
  const irUltimo = () => listaOrdenada.length && seleccionar({ ...listaOrdenada[listaOrdenada.length - 1], _tipo: 'servicio' });
  const irAnterior = () => indiceActual > 0 && seleccionar({ ...listaOrdenada[indiceActual - 1], _tipo: 'servicio' });
  const irSiguiente = () => indiceActual >= 0 && indiceActual < listaOrdenada.length - 1 && seleccionar({ ...listaOrdenada[indiceActual + 1], _tipo: 'servicio' });

  const nuevo = () => {
    setForm(FORM_VACIO);
    setDocId(null);
    setBusquedaCliente('');
    setBusquedaDestino('');
    setBusquedaNro('');
    setBusquedaFecha('');
    setDesbloqueado(false);
    limpiarResultados();
    setVista('form');
  };

  const guardar = async () => {
    if (bloqueado) { alert('Primero buscá y seleccioná un servicio o presupuesto'); return; }
    for (const c of CAMPOS_FECHA) {
      if (form[c] && !fechaCompleta(form[c])) {
        alert(`La fecha "${c}" está incompleta. Usá el formato DD/MM/AAAA.`);
        return;
      }
    }
    setGuardando(true);
    try {
      const datos = { ...form, actualizadoEn: Timestamp.now() };
      const q = query(collection(db, 'servicios'), where('nropresupuesto', '==', form.nropresupuesto.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, 'servicios', snap.docs[0].id), datos);
        setDocId(snap.docs[0].id);
      } else {
        datos.creadoEn = Timestamp.now();
        const ref = await addDoc(collection(db, 'servicios'), datos);
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
      let presu = null;
      if (form.nropresupuesto) {
        const q = query(collection(db, 'presupuestos'), where('nroPresupuesto', '==', String(form.nropresupuesto).trim()));
        const snap = await getDocs(q);
        if (!snap.empty) presu = snap.docs[0].data();
      }
      const pdfBytes = await generarServicioPDF(form, presu);
      const result = await ipcRenderer.invoke('guardar-pdf', {
        nombre: `Servicio_${form.nropresupuesto || 'nuevo'}.pdf`,
        buffer: Array.from(pdfBytes),
        tipo: 'servicio', // main.js usa esto para elegir la carpeta de destino
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
    const encontrado = servicios.find((s) => String(s.nropresupuesto) === busquedaTabla.trim());
    if (encontrado) { seleccionar({ ...encontrado, _tipo: 'servicio' }); setVista('form'); }
    else alert('No se encontró ningún servicio con ese número');
  };

  // ── Orden (columnas normales) + filtro cíclico (Estado) ──
  const [orden, setOrden] = useState({ campo: 'salida', asc: false }); // por defecto: más reciente primero
  const [filtroEstado, setFiltroEstado] = useState(null);

  const toggleOrden = (campo) => {
    setOrden((prev) => (prev.campo === campo ? { campo, asc: !prev.asc } : { campo, asc: true }));
  };
  const toggleFiltroEstado = () => {
    const idx = CICLO_FILTRO.indexOf(filtroEstado);
    setFiltroEstado(CICLO_FILTRO[(idx + 1) % CICLO_FILTRO.length]);
  };

  const aFechaOrden = (fecha) => {
    if (!fecha) return new Date(0);
    const [dd, mm, aaaaRaw] = fecha.split('/');
    if (!dd || !mm || !aaaaRaw) return new Date(0);
    const aaaa = aaaaRaw.length === 2 ? `20${aaaaRaw}` : aaaaRaw;
    return new Date(Number(aaaa), Number(mm) - 1, Number(dd));
  };

  const COMPARADORES = {
    nro: (a, b) => (Number(a.nropresupuesto) || 0) - (Number(b.nropresupuesto) || 0),
    cliente: (a, b) => (a.contacto || '').localeCompare(b.contacto || '', 'es', { sensitivity: 'base' }),
    telefono: (a, b) => (a.telefono || '').localeCompare(b.telefono || '', 'es', { sensitivity: 'base' }),
    salida: (a, b) => aFechaOrden(a.salidaFecha) - aFechaOrden(b.salidaFecha),
    retorno: (a, b) => aFechaOrden(a.retornoFecha) - aFechaOrden(b.retornoFecha),
    origen: (a, b) => (a.domicilioOrigen || '').localeCompare(b.domicilioOrigen || '', 'es', { sensitivity: 'base' }),
  };

  const ESTADO_LABEL = Object.fromEntries(OPCIONES_ESTADO.map((o) => [o.key, o.label]));

const serviciosActivos = useMemo(
  () => servicios.filter((s) => s.estado !== 'suspendido' && s.estado !== 'eliminado'),
  [servicios]
);
const serviciosPapelera = useMemo(
  () => servicios.filter((s) => s.estado === 'suspendido'),
  [servicios]
);

const listaBase = verPapelera ? serviciosPapelera : serviciosActivos;

const filtrados = useMemo(() => listaBase
  .filter((s) =>
    (s.contacto || '').toLowerCase().includes(busquedaTabla.toLowerCase()) ||
    (s.nropresupuesto || '').toString().includes(busquedaTabla)
  )
  .filter((s) => verPapelera || !filtroEstado || s.estado === filtroEstado)
  .sort((a, b) => {
    if (!orden.campo) return 0;
    const resultado = COMPARADORES[orden.campo](a, b);
    return orden.asc ? resultado : -resultado;
  }), [listaBase, busquedaTabla, filtroEstado, verPapelera, orden]);

  // ── Selección múltiple en la papelera ──
  const toggleSeleccionarTodo = (e, items) => {
    if (e.target.checked) {
      setSeleccionados(items.map((i) => i.id));
    } else {
      setSeleccionados([]);
    }
  };

  const toggleSeleccionarItem = (id) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Devuelve un servicio suspendido al estado que tenía antes de ir a la papelera
  const restaurarServicio = async (row) => {
    try {
      await updateDoc(doc(db, 'servicios', row.id), {
        estado: row.estadoPrevio || 'pendiente',
        estadoPrevio: '',
        eliminadoEn: null,
      });
    } catch (error) {
      alert('Error al restaurar el servicio: ' + error.message);
    }
  };

  // Elimina definitivamente de la base de datos los servicios seleccionados en la papelera
  const eliminarDefinitivamente = async () => {
    if (!esAdmin) {
      alert('Solo un administrador puede eliminar servicios de la base de datos.');
      return;
    }
    if (seleccionados.length === 0) return;

    const confirmar = window.confirm(
      `¿Estás seguro de eliminar definitivamente ${seleccionados.length} servicio(s)? Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    try {
      const batch = writeBatch(db);
      seleccionados.forEach((id) => batch.delete(doc(db, 'servicios', id)));
      await batch.commit();
      setSeleccionados([]);
      alert('Servicios eliminados correctamente de la base de datos.');
    } catch (error) {
      alert('Error al eliminar servicios: ' + error.message);
    }
  };
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
            {form.nropresupuesto ? `Servicio — Presupuesto N° ${form.nropresupuesto}` : 'Nuevo Servicio'}
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
              {campo('Cliente', inp(busquedaCliente, (e) => { setBusquedaCliente(e.target.value); sugerirUnificado('contacto', 'cliente', e.target.value, setResultadosCliente); }, 'Buscar...'))}
              {resultadosCliente.map((r, i) => resultadoItem(`${r.contacto || r.cliente} — N° ${r.nropresupuesto || r.nroPresupuesto}`, () => seleccionar(r)))}
            </div>
            <div>
              {campo('Destino', inp(busquedaDestino, (e) => { setBusquedaDestino(e.target.value); sugerirUnificado('domicilioDestino', 'destino', e.target.value, setResultadosDestino); }, 'Buscar...'))}
              {resultadosDestino.map((r, i) => resultadoItem(`${r.contacto || r.cliente} — N° ${r.nropresupuesto || r.nroPresupuesto}`, () => seleccionar(r)))}
            </div>
            <div>
              {campo('Nro. Presupuesto', inp(busquedaNro, (e) => { setBusquedaNro(e.target.value); sugerirUnificado('nropresupuesto', 'nroPresupuesto', e.target.value, setResultadosNro); }, 'Buscar...'))}
              {resultadosNro.map((r, i) => resultadoItem(`${r.contacto || r.cliente} — N° ${r.nropresupuesto || r.nroPresupuesto}`, () => seleccionar(r)))}
            </div>
            <div>
              {campo('Fecha', inp(busquedaFecha, (e) => { const v = formatearFecha(e.target.value); setBusquedaFecha(v); sugerirUnificado('salidaFecha', 'salidaFecha', v, setResultadosFecha); }, 'DD/MM/AAAA'))}
              {resultadosFecha.map((r, i) => resultadoItem(`${r.contacto || r.cliente} — N° ${r.nropresupuesto || r.nroPresupuesto}`, () => seleccionar(r)))}
            </div>
          </div>
        </Seccion>

        {/* NAVEGAR SERVICIOS */}
        <Seccion titulo="Navegar Servicios">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', columnGap: 28, rowGap: 12 }}>
            {btnChico('PRIMERO', irPrimero, listaOrdenada.length === 0)}
            {btnChico('ANTERIOR', irAnterior, indiceActual <= 0)}
            {btnChico('SIGUIENTE', irSiguiente, indiceActual === -1 || indiceActual >= listaOrdenada.length - 1)}
            {btnChico('ULTIMO', irUltimo, listaOrdenada.length === 0)}
          </div>
        </Seccion>

        {/* CONTACTO */}
        <Seccion titulo="Contacto">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: 36, rowGap: 22 }}>
            {campo('Contacto', inp(form.contacto, set('contacto'), '', 'text', bloqueado))}
            {campo('Telf. Contacto', inp(form.telefono, set('telefono'), '', 'text', bloqueado))}
            {campo('Cuit', inp(form.cuit, set('cuit'), '', 'text', bloqueado))}
            {campo('Responsable', inp(form.responsable, set('responsable'), '', 'text', bloqueado))}
            {campo('Telf. Responsable', inp(form.telefonoResponsable, set('telefonoResponsable'), '', 'text', bloqueado))}
          </div>
        </Seccion>

        {/* VIAJE */}
        <Seccion titulo="Viaje">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: 36, rowGap: 22 }}>
            {campo('Cap. Transporte', inp(form.capacidad, set('capacidad'), '', 'text', bloqueado))}
            {campo('Estado', inp(ESTADO_LABEL[form.estado] || form.estado, () => {}, '', true))}
          </div>
        </Seccion>

        {/* LUGARES */}
        <Seccion titulo="Lugares">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: 36, rowGap: 22 }}>
            {campo('Domicilio Origen', inp(form.domicilioOrigen, set('domicilioOrigen'), '', 'text', bloqueado))}
            {campo('Domicilio Destino', inp(form.domicilioDestino, set('domicilioDestino'), '', 'text', bloqueado))}
          </div>
        </Seccion>

        {/* SALIDA / RETORNO */}
        <Seccion titulo="Salida / Retorno">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', columnGap: 36, rowGap: 22 }}>
            {campo('Fecha Salida', inp(form.salidaFecha, set('salidaFecha'), 'DD/MM/AAAA', 'text', bloqueado))}
            {campo('Hora Salida', inp(form.salidaHora, set('salidaHora'), 'HH:MM', 'text', bloqueado))}
            {campo('Fecha Retorno', inp(form.retornoFecha, set('retornoFecha'), 'DD/MM/AAAA', 'text', bloqueado))}
            {campo('Hora Retorno', inp(form.retornoHora, set('retornoHora'), 'HH:MM', 'text', bloqueado))}
          </div>
        </Seccion>

        {/* ADICIONALES */}
        <Seccion titulo="Adicionales">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: 36, rowGap: 22 }}>
            {campo('Movimientos', sel(form.movimientos, set('movimientos'), bloqueado, [{ key: 'NO', label: 'NO' }, { key: 'SI', label: 'SI' }]))}
            {form.movimientos === 'SI' && campo('Detalle Movimientos', inp(form.movimientosDetalle, set('movimientosDetalle'), 'Detallar movimientos...', 'text', bloqueado))}
            {campo('Aloj y Viat a cargo de', inp(form.alojViaticos, set('alojViaticos'), '', 'text', bloqueado))}
            {campo('Servicio a bordo', sel(form.servicioABordo, set('servicioABordo'), bloqueado, [{ key: 'Si', label: 'Si' }, { key: 'No', label: 'No' }]))}
            {campo('Info Adicional', inp(form.infoAdicional, set('infoAdicional'), '', 'text', bloqueado))}
            {campo('Observaciones', inp(form.observaciones, set('observaciones'), '', 'text', bloqueado))}
          </div>
        </Seccion>

      </div>
    </div>
  );

  // ── TABLA ──
  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>

        {/* Pestañas Activos / Papelera */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>
            {verPapelera ? 'Papelera (Suspendidos)' : 'Servicios'}
          </div>

          <button
            onClick={() => { setVerPapelera(false); setSeleccionados([]); }}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: !verPapelera ? '#1A1A1A' : '#E0E0E0',
              color: !verPapelera ? '#F5C400' : '#555'
            }}>
            Activos
          </button>

          <button
            onClick={() => { setVerPapelera(true); setSeleccionados([]); }}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: verPapelera ? '#D32F2F' : '#E0E0E0',
              color: verPapelera ? '#FFF' : '#555'
            }}>
            🗑️ Papelera ({serviciosPapelera.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {verPapelera && esAdmin && seleccionados.length > 0 && (
            <button onClick={eliminarDefinitivamente}
              style={{ padding: '8px 18px', background: '#D32F2F', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#FFF', cursor: 'pointer' }}>
              Eliminar Definitivamente ({seleccionados.length})
            </button>
          )}
          {!verPapelera && (
            <button onClick={nuevo}
              style={{ padding: '8px 18px', background: '#F5C400', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1A1A1A', cursor: 'pointer' }}>
              + Nuevo
            </button>
          )}
        </div>
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
              {/* Checkbox global en Papelera (solo admins pueden eliminar) */}
              {verPapelera && esAdmin && (
                <th style={{ padding: '10px 12px', textAlign: 'center', width: 40, borderBottom: '0.5px solid #F0F0F0' }}>
                  <input
                    type="checkbox"
                    checked={filtrados.length > 0 && seleccionados.length === filtrados.length}
                    onChange={(e) => toggleSeleccionarTodo(e, filtrados)}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
              )}
              {[
                { label: 'Nro', campo: 'nro' },
                { label: 'Cliente', campo: 'cliente' },
                { label: 'Telefono', campo: 'telefono' },
                { label: 'Fecha Salida', campo: 'salida' },
                { label: 'Fecha Retorno', campo: 'retorno' },
                { label: 'Origen → Destino', campo: 'origen' },
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
                  cursor: verPapelera ? 'default' : 'pointer', userSelect: 'none',
                }}>
                Estado{filtroEstado && !verPapelera ? ` (${ESTADO_LABEL[filtroEstado]})` : ''}
              </th>
              {/* Columna de acción en Papelera */}
              {verPapelera && (
                <th style={{
                  padding: '10px 20px', textAlign: 'left', fontSize: 10, fontWeight: 600,
                  color: '#888', textTransform: 'uppercase', letterSpacing: 0.5,
                  borderBottom: '0.5px solid #F0F0F0',
                }}>
                  Acción
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={verPapelera ? (esAdmin ? 9 : 8) : 7} style={{ padding: 20, textAlign: 'center', color: '#888' }}>Cargando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={verPapelera ? (esAdmin ? 9 : 8) : 7} style={{ padding: 20, textAlign: 'center', color: '#888' }}>
                {verPapelera ? 'No hay servicios suspendidos' : 'No hay servicios'}
              </td></tr>
            ) : (
              filtrados.map(row => {
                const ec = ESTADO_COLOR[row.estado] || ESTADO_COLOR.pendiente;
                return (
                  <tr key={row.id} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                    {/* Checkbox por fila en Papelera (solo admins pueden eliminar) */}
                    {verPapelera && esAdmin && (
                      <td style={{ padding: '12px 12px', textAlign: 'center', borderBottom: '0.5px solid #F8F8F8' }}
                        onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={seleccionados.includes(row.id)}
                          onChange={() => toggleSeleccionarItem(row.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                    )}

                    <td onClick={() => { seleccionar({ ...row, _tipo: 'servicio' }); setVista('form'); }} style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.nropresupuesto || '-'}</td>
                    <td onClick={() => { seleccionar({ ...row, _tipo: 'servicio' }); setVista('form'); }} style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.contacto || '-'}</td>
                    <td onClick={() => { seleccionar({ ...row, _tipo: 'servicio' }); setVista('form'); }} style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.telefono || '-'}</td>
                    <td onClick={() => { seleccionar({ ...row, _tipo: 'servicio' }); setVista('form'); }} style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.salidaFecha || '-'}</td>
                    <td onClick={() => { seleccionar({ ...row, _tipo: 'servicio' }); setVista('form'); }} style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.retornoFecha || '-'}</td>
                    <td onClick={() => { seleccionar({ ...row, _tipo: 'servicio' }); setVista('form'); }} style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.domicilioOrigen && row.domicilioDestino ? `${row.domicilioOrigen} → ${row.domicilioDestino}` : '-'}</td>
                    <td onClick={() => { seleccionar({ ...row, _tipo: 'servicio' }); setVista('form'); }} style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>
                      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: ec.bg, color: ec.color }}>
                        {verPapelera
                          ? `Suspendido (era ${ESTADO_LABEL[row.estadoPrevio] || 'Pendiente'})`
                          : (ESTADO_LABEL[row.estado] || row.estado || '-')}
                      </span>
                    </td>

                    {/* Botón Restablecer en Papelera */}
                    {verPapelera && (
                      <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}
                        onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => restaurarServicio(row)}
                          style={{ padding: '6px 14px', background: '#E8F5E9', border: '1px solid #C8E6C9', color: '#2E7D32', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          Restablecer
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
