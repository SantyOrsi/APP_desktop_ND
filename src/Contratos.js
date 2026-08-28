import React, { useState } from 'react';
import { useColeccion } from './hooks/useFirestore';
import { db } from './constants/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, where, getDocs } from 'firebase/firestore';
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

const OPCIONES_ESTADO = ['Señado', 'Pago total', 'Suspendido', 'Cuenta corriente'];
const CICLO_FILTRO = [null, ...OPCIONES_ESTADO];

const FORM_VACIO = {
  fechaContrato: '', clienteNombre: '', cuitDni: '', telefono: '',
  domicilioCliente: '', ciudad: '', domicilioOrigen: '', domicilioDestino: '',
  senia: '', saldo: '', estado: '', estadoPrevio: '', metodoPago: '', fechaCancelacion: '',
};

const inp = (value, onChange, placeholder = '', type = 'text', readOnly = false) => (
  <input type={type} value={value || ''} onChange={onChange} placeholder={placeholder} readOnly={readOnly} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
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
  const [verPapelera, setVerPapelera] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [docId, setDocId] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // ── Selección múltiple para eliminar ──
  const [seleccionados, setSeleccionados] = useState([]);

  // ── Datos del presupuesto vinculado ──
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

  const [desbloqueado, setDesbloqueado] = useState(false);
  const bloqueado = !desbloqueado;

  const [sugerenciasClienteDatos, setSugerenciasClienteDatos] = useState([]);

  const CAMPOS_FECHA = ['fechaContrato', 'fechaCancelacion'];
  const CAMPOS_NUMERICOS = ['cuitDni', 'telefono', 'senia', 'saldo'];

  const set = (key) => (e) => {
    let val = e.target.value;
    if (CAMPOS_FECHA.includes(key)) val = formatearFecha(val);
    else if (CAMPOS_NUMERICOS.includes(key)) val = soloNumeros(val);
    
    setForm((prev) => {
      const updated = { ...prev, [key]: val };

      if (key === 'estado') {
        if (val === 'Suspendido' && prev.estado !== 'Suspendido') {
          updated.estadoPrevio = prev.estado || 'Señado';
        }
      }

      if (key === 'senia') {
        const total = parseFloat(costoTotal) || 0;
        const senia = parseFloat(val) || 0;
        updated.saldo = (total - senia).toFixed(2);
      }
      return updated;
    });

    if (key === 'clienteNombre') {
      const filtro = val.trim().toLowerCase();
      if (!filtro) { setSugerenciasClienteDatos([]); return; }
      const vistos = new Set();
      const encontrados = [];
      for (const c of contratos) {
        const nombre = (c.clienteNombre || '').trim();
        if (!nombre || !nombre.toLowerCase().includes(filtro)) continue;
        const clave = nombre.toLowerCase();
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        encontrados.push(c);
        if (encontrados.length >= 6) break;
      }
      setSugerenciasClienteDatos(encontrados);
    }
  };

  const elegirSugerenciaCliente = (c) => {
    setForm((prev) => ({
      ...prev,
      clienteNombre: c.clienteNombre || '',
      cuitDni: c.cuitDni || prev.cuitDni,
      telefono: c.telefono || prev.telefono,
      domicilioCliente: c.domicilioCliente || prev.domicilioCliente,
    }));
    setSugerenciasClienteDatos([]);
  };

  const limpiarResultados = () => {
    setResultadosCliente([]);
    setResultadosNro([]);
    setResultadosFecha([]);
    setResultadosDestino([]);
  };

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
        setDesbloqueado(true);
      } else {
        setDocId(null);
        setForm(FORM_VACIO);
        setDesbloqueado(false);
      }
    } catch (error) {
      alert('Error al buscar contrato: ' + error.message);
    }
  };

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

  const sugerirNro = (texto) => {
    setBusquedaNro(texto);
    const filtro = texto.trim();
    setResultadosNro(
      filtro ? presupuestosTodos.filter((p) => String(p.nroPresupuesto || '').includes(filtro)).slice(0, 6) : []
    );
  };

  const sugerirFecha = (texto) => {
    const val = formatearFecha(texto);
    setFecha(val);
    const filtro = val.trim();
    setResultadosFecha(
      filtro ? presupuestosTodos.filter((p) => (p.fecha || '').includes(filtro)).slice(0, 6) : []
    );
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
    setDesbloqueado(true);
  };

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
    setDesbloqueado(true);
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
    setDesbloqueado(false);
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
      const estadoAnterior = !snap.empty ? (snap.docs[0].data().estado || '') : null;

      if (!snap.empty) {
        await updateDoc(doc(db, 'contratos', snap.docs[0].id), datos);
        setDocId(snap.docs[0].id);
      } else {
        datos.creadoEn = Timestamp.now();
        const ref = await addDoc(collection(db, 'contratos'), datos);
        setDocId(ref.id);
      }

      // Si el contrato pasó a "Suspendido", los servicios asociados van a la papelera
      if (form.estado === 'Suspendido' && estadoAnterior !== 'Suspendido') {
        await moverServiciosAPapelera(nroPresupuesto);
      }
      // Si el contrato salió de "Suspendido" (se restableció), sus servicios se restauran
      if (estadoAnterior === 'Suspendido' && form.estado !== 'Suspendido') {
        await restaurarServiciosDelContrato(nroPresupuesto);
      }
    } catch (error) {
      alert('Error al guardar: ' + error.message);
    }
    setGuardando(false);
  };

  const restablecerEstadoPrevio = () => {
    const estadoRestablecido = form.estadoPrevio || 'Señado';
    setForm((prev) => ({
      ...prev,
      estado: estadoRestablecido,
      estadoPrevio: ''
    }));
  };

  // ── Lógica para eliminar definitivamente ──
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

  const eliminarDefinitivamente = async () => {
    if (seleccionados.length === 0) return;

    const confirmar = window.confirm(
      `¿Estás seguro de eliminar definitivamente ${seleccionados.length} contrato(s)? Esta acción también eliminará los servicios asociados que estén en la papelera y no se puede deshacer.`
    );
    if (!confirmar) return;

    try {
      for (const id of seleccionados) {
        const contrato = contratos.find((c) => c.id === id);
        await deleteDoc(doc(db, 'contratos', id));

        if (contrato?.nroPresupuesto) {
          const qServicios = query(
            collection(db, 'servicios'),
            where('nropresupuesto', '==', String(contrato.nroPresupuesto).trim())
          );
          const snapServicios = await getDocs(qServicios);
          const borrados = snapServicios.docs
            .filter((d) => (d.data().estado || '') === 'suspendido')
            .map((d) => deleteDoc(doc(db, 'servicios', d.id)));
          await Promise.all(borrados);
        }
      }
      setSeleccionados([]);
      alert('Contratos eliminados correctamente de la base de datos.');
    } catch (error) {
      alert('Error al eliminar contratos: ' + error.message);
    }
  };

  // Mueve a la papelera los servicios vinculados a un contrato recién suspendido,
  // guardando el estado que tenían para poder restaurarlos después.
  const moverServiciosAPapelera = async (nroPresupuesto) => {
    if (!nroPresupuesto) return;
    try {
      const qServicios = query(
        collection(db, 'servicios'),
        where('nropresupuesto', '==', String(nroPresupuesto).trim())
      );
      const snapServicios = await getDocs(qServicios);
      const promesas = snapServicios.docs
        .filter((docServicio) => (docServicio.data().estado || '') !== 'suspendido')
        .map((docServicio) =>
          updateDoc(doc(db, 'servicios', docServicio.id), {
            estado: 'suspendido',
            estadoPrevio: docServicio.data().estado || 'pendiente',
            eliminadoEn: Timestamp.now(),
          })
        );
      await Promise.all(promesas);
    } catch (error) {
      console.error('Error al mover servicios a la papelera:', error);
    }
  };

  // Restaura los servicios vinculados a un contrato que se restableció desde
  // la papelera, devolviéndolos al estado que tenían antes de suspenderse.
  const restaurarServiciosDelContrato = async (nroPresupuesto) => {
    if (!nroPresupuesto) return;
    try {
      const qServicios = query(
        collection(db, 'servicios'),
        where('nropresupuesto', '==', String(nroPresupuesto).trim())
      );
      const snapServicios = await getDocs(qServicios);
      const promesas = snapServicios.docs
        .filter((docServicio) => (docServicio.data().estado || '') === 'suspendido')
        .map((docServicio) =>
          updateDoc(doc(db, 'servicios', docServicio.id), {
            estado: docServicio.data().estadoPrevio || 'pendiente',
            estadoPrevio: '',
            eliminadoEn: null,
          })
        );
      await Promise.all(promesas);
    } catch (error) {
      console.error('Error al restaurar servicios:', error);
    }
  };

  const copiar = () => {
    navigator.clipboard?.writeText(JSON.stringify(form, null, 2));
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
        tipo: 'contrato',
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

  const listaBase = contratos.filter((c) =>
    verPapelera
      ? (c.estado || '') === 'Suspendido'
      : (c.estado || '') !== 'Suspendido'
  );

  const filtrados = listaBase
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
          {form.estado === 'Suspendido' && (
            <button onClick={restablecerEstadoPrevio}
              style={{ padding: '9px 20px', background: '#E8F5E9', border: '1px solid #C8E6C9', color: '#2E7D32', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Restablecer a {form.estadoPrevio || 'Señado'}
            </button>
          )}
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
        <Seccion titulo="Búsqueda Presupuesto">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', columnGap: 40, rowGap: 22, marginBottom: 20 }}>
            <div>
              {campo('Cliente', inp(busquedaCliente, (e) => sugerirCliente(e.target.value), 'Buscar por nombre...'))}
              {resultadosCliente.map((r) => resultadoItem(`${r.cliente} — N° ${r.nroPresupuesto}`, () => seleccionarPresupuesto(r)))}
            </div>
            <div>
              {campo('Nro. Presupuesto', inp(busquedaNro, (e) => sugerirNro(e.target.value), 'Buscar por id...'))}
              {resultadosNro.map((r) => resultadoItem(`${r.cliente} — N° ${r.nroPresupuesto}`, () => seleccionarPresupuesto(r)))}
            </div>
            <div>
              {campo('Fecha', inp(fecha, (e) => sugerirFecha(e.target.value), 'DD/MM/AAAA'))}
              {resultadosFecha.map((r) => resultadoItem(`${r.cliente} — N° ${r.nroPresupuesto}`, () => seleccionarPresupuesto(r)))}
            </div>
            <div>
              {campo('Destino', inp(destino, (e) => sugerirDestino(e.target.value), 'Buscar por destino...'))}
              {resultadosDestino.map((r) => resultadoItem(`${r.cliente} — N° ${r.nroPresupuesto}`, () => seleccionarPresupuesto(r)))}
            </div>
          </div>
          <button onClick={handleAltaContrato}
            style={{ width: '100%', padding: '12px 0', background: '#F5C400', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1A1A1A', cursor: 'pointer' }}>
            ALTA CONTRATO
          </button>
        </Seccion>

        <Seccion titulo="Navegar Contratos">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', columnGap: 28, rowGap: 12 }}>
            {btnChico('PRIMERO', irPrimero, listaOrdenada.length === 0)}
            {btnChico('ANTERIOR', irAnterior, indiceActual <= 0)}
            {btnChico('SIGUIENTE', irSiguiente, indiceActual === -1 || indiceActual >= listaOrdenada.length - 1)}
            {btnChico('ULTIMO', irUltimo, listaOrdenada.length === 0)}
          </div>
        </Seccion>

        <Seccion titulo="Fecha Contrato">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: 36 }}>
            {campo('Fecha Contrato',
              inp(form.fechaContrato, set('fechaContrato'), bloqueado ? 'Se completa al presionar ALTA CONTRATO' : 'DD/MM/AAAA')
            )}
          </div>
        </Seccion>

        <Seccion titulo="Datos Cliente">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: 36, rowGap: 22 }}>
            <div>
              {campo('Cliente', inp(form.clienteNombre, set('clienteNombre'), '', 'text', bloqueado))}
              {!bloqueado && sugerenciasClienteDatos.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {sugerenciasClienteDatos.map((c) =>
                    resultadoItem(c.clienteNombre, () => elegirSugerenciaCliente(c))
                  )}
                </div>
              )}
            </div>
            {campo('Cuit-Dni', inp(form.cuitDni, set('cuitDni'), '', 'text', bloqueado))}
            {campo('Telefono', inp(form.telefono, set('telefono'), '', 'text', bloqueado))}
            {campo('Domicilio', inp(form.domicilioCliente, set('domicilioCliente'), '', 'text', bloqueado))}
          </div>
        </Seccion>

        <Seccion titulo="Lugares">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: 36, rowGap: 22 }}>
            {campo('Ciudad', inp(form.ciudad, set('ciudad'), '', 'text', bloqueado))}
            {campo('Domicilio Origen', inp(form.domicilioOrigen, set('domicilioOrigen'), '', 'text', bloqueado))}
            {campo('Domicilio Destino', inp(form.domicilioDestino, set('domicilioDestino'), '', 'text', bloqueado))}
          </div>
        </Seccion>

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
        
        {/* Pestañas Activos / Papelera */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>
            {verPapelera ? 'Papelera (Suspendidos)' : 'Contratos'}
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
            🗑️ Papelera ({contratos.filter(c => (c.estado || '') === 'Suspendido').length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {verPapelera && seleccionados.length > 0 && (
            <button onClick={eliminarDefinitivamente}
              style={{ padding: '8px 18px', background: '#D32F2F', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#FFF', cursor: 'pointer' }}>
              Eliminar Definitivamente ({seleccionados.length})
            </button>
          )}
          <button onClick={nuevo}
            style={{ padding: '8px 18px', background: '#F5C400', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1A1A1A', cursor: 'pointer' }}>
            + Nuevo
          </button>
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
              {/* Checkbox global en Papelera */}
              {verPapelera && (
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
              <tr><td colSpan={verPapelera ? 8 : 7} style={{ padding: 20, textAlign: 'center', color: '#888' }}>Cargando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={verPapelera ? 8 : 7} style={{ padding: 20, textAlign: 'center', color: '#888' }}>
                {verPapelera ? 'No hay contratos suspendidos' : 'No hay contratos activos'}
              </td></tr>
            ) : (
              filtrados.map(row => (
                <tr key={row.id} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  
                  {/* Checkbox por fila en Papelera */}
                  {verPapelera && (
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

                  <td onClick={() => { seleccionarContrato(row); setVista('form'); }} style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.nroPresupuesto || '-'}</td>
                  <td onClick={() => { seleccionarContrato(row); setVista('form'); }} style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.clienteNombre || '-'}</td>
                  <td onClick={() => { seleccionarContrato(row); setVista('form'); }} style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.telefono || '-'}</td>
                  <td onClick={() => { seleccionarContrato(row); setVista('form'); }} style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.domicilioCliente || '-'}</td>
                  <td onClick={() => { seleccionarContrato(row); setVista('form'); }} style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.senia ? `$${row.senia}` : '-'}</td>
                  <td onClick={() => { seleccionarContrato(row); setVista('form'); }} style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.metodoPago || '-'}</td>
                  <td onClick={() => { seleccionarContrato(row); setVista('form'); }} style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: 20,
                      fontSize: 10,
                      fontWeight: 600,
                      background: row.estado === 'Suspendido' ? '#FFEBEE' : '#FFF8E1',
                      color: row.estado === 'Suspendido' ? '#C62828' : '#F57F17'
                    }}>
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