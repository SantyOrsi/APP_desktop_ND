import React, { useState } from 'react';
import { useColeccion } from './hooks/useFirestore';
import { db } from './constants/firebase';
import { updateDoc, doc, Timestamp } from 'firebase/firestore';
import { FLOTA } from './constants/flota';

const ESTADO_LABEL = { pendiente: 'Pendiente', enRuta: 'En ruta', completo: 'Completo' };
const ESTADO_COLOR = {
  pendiente: { bg: '#FFF8E1', color: '#F57F17' },
  enRuta: { bg: '#E3F2FD', color: '#1565C0' },
  completo: { bg: '#E8F5E9', color: '#2E7D32' },
};
const CICLO_FILTRO = [null, 'pendiente', 'enRuta', 'completo'];

const inp = (value, onChange, placeholder = '', readOnly = false, fontSize = 13) => (
  <input value={value || ''} onChange={onChange} placeholder={placeholder} readOnly={readOnly} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
    style={{ padding: '8px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize, background: readOnly ? '#F0F0F0' : '#F8F8F8', outline: 'none', width: '100%', color: readOnly ? '#888' : '#1A1A1A' }} />
);

const campo = (label, children) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 16 }}>
    <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
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

const resultadoItem = (texto, onClick) => (
  <div onClick={onClick}
    style={{ padding: '8px 10px', background: '#F8F8F8', border: '0.5px solid #E0E0E0', borderRadius: 6, fontSize: 12, marginTop: 4, cursor: 'pointer' }}>
    {texto}
  </div>
);

export default function Logistica() {
  const { datos: servicios, cargando } = useColeccion('servicios');
  const { datos: presupuestosTodos } = useColeccion('presupuestos');
  const [busquedaTabla, setBusquedaTabla] = useState('');
  const [vista, setVista] = useState('tabla');

  const [servicioActivo, setServicioActivo] = useState(null);
  const [chequeandoBusqueda, setChequeandoBusqueda] = useState(false);

  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [busquedaDestino, setBusquedaDestino] = useState('');
  const [busquedaNro, setBusquedaNro] = useState('');
  const [busquedaFecha, setBusquedaFecha] = useState('');
  const [resultados, setResultados] = useState([]);

  const [choferes, setChoferes] = useState(['']);
  const [unidadesSeleccionadas, setUnidadesSeleccionadas] = useState([]);
  const [categoriaAbierta, setCategoriaAbierta] = useState(null);
  const [dineroViaje, setDineroViaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const bloqueado = chequeandoBusqueda && !servicioActivo;

  const abrirDesdeTabla = (s) => {
    setServicioActivo(s);
    setChequeandoBusqueda(false);
    setChoferes(Array.isArray(s.chofer) ? (s.chofer.length ? s.chofer : ['']) : (s.chofer ? [s.chofer] : ['']));
    setUnidadesSeleccionadas(Array.isArray(s.unidad) ? s.unidad : (s.unidad ? [s.unidad] : []));
    setDineroViaje(s.dineroViaje || '');
    setCategoriaAbierta(null);
    setResultados([]);
    setVista('form');
  };

  const nuevo = () => {
    setServicioActivo(null);
    setChequeandoBusqueda(true);
    setChoferes(['']);
    setUnidadesSeleccionadas([]);
    setDineroViaje('');
    setCategoriaAbierta(null);
    setBusquedaCliente(''); setBusquedaDestino(''); setBusquedaNro(''); setBusquedaFecha('');
    setResultados([]);
    setVista('form');
  };

  const sugerir = (campoServicio, valor) => {
    const filtro = valor.trim().toLowerCase();
    if (!filtro) { setResultados([]); return; }
    const encontrados = servicios.filter((s) => (s[campoServicio] || '').toString().toLowerCase().includes(filtro));
    setResultados(encontrados.slice(0, 6));
  };

  const agregarChofer = () => setChoferes((prev) => [...prev, '']);
  const quitarChofer = (idx) => setChoferes((prev) => prev.filter((_, i) => i !== idx));
  const setChofer = (idx, val) => setChoferes((prev) => prev.map((c, i) => (i === idx ? val : c)));

  const toggleCategoria = (fl) => {
    if (fl.subUnidades) {
      setCategoriaAbierta((prev) => (prev === fl.id ? null : fl.id));
      return;
    }
    setUnidadesSeleccionadas((prev) =>
      prev.includes(fl.nombre) ? prev.filter((u) => u !== fl.nombre) : [...prev, fl.nombre]
    );
  };

  const toggleSubUnidad = (codigo) => {
    setUnidadesSeleccionadas((prev) =>
      prev.includes(codigo) ? prev.filter((u) => u !== codigo) : [...prev, codigo]
    );
  };

  const categoriaTieneSeleccion = (fl) =>
    fl.subUnidades ? fl.subUnidades.some((c) => unidadesSeleccionadas.includes(c)) : unidadesSeleccionadas.includes(fl.nombre);

  const guardar = async () => {
    if (bloqueado || !servicioActivo) { alert('Primero buscá y seleccioná un servicio'); return; }
    setGuardando(true);
    try {
      const choferesLimpios = choferes.map((c) => c.trim()).filter(Boolean);
      await updateDoc(doc(db, 'servicios', servicioActivo.id), {
        chofer: choferesLimpios,
        unidad: unidadesSeleccionadas,
        dineroViaje: dineroViaje.trim(),
        actualizadoEn: Timestamp.now(),
      });
      alert('Chofer y unidad asignados correctamente');
      setVista('tabla');
    } catch (error) {
      alert('Error al guardar: ' + error.message);
    }
    setGuardando(false);
  };

  const [orden, setOrden] = useState({ campo: 'salida', asc: false });
  const [filtroEstado, setFiltroEstado] = useState(null);
  const [modoVista, setModoVista] = useState('pendientes'); // 'pendientes' | 'todos'

  const presuPorNro = {};
  presupuestosTodos.forEach((p) => { presuPorNro[String(p.nroPresupuesto)] = p; });

  // "Trafico hecho" = ya tiene unidad Y chofer asignados
  const tieneTraficoHecho = (s) => {
    const tieneUnidad = Array.isArray(s.unidad) ? s.unidad.length > 0 : !!s.unidad;
    const tieneChofer = Array.isArray(s.chofer) ? s.chofer.length > 0 : !!s.chofer;
    return tieneUnidad && tieneChofer;
  };

  const toggleOrden = (c) => setOrden((prev) => (prev.campo === c ? { campo: c, asc: !prev.asc } : { campo: c, asc: true }));
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
    cliente: (a, b) => (a.contacto || '').localeCompare(b.contacto || '', 'es', { sensitivity: 'base' }),
    salida: (a, b) => aFechaOrden(a.salidaFecha) - aFechaOrden(b.salidaFecha),
    retorno: (a, b) => aFechaOrden(a.retornoFecha) - aFechaOrden(b.retornoFecha),
    origen: (a, b) => ((presuPorNro[a.nropresupuesto]?.origen) || '').localeCompare((presuPorNro[b.nropresupuesto]?.origen) || '', 'es', { sensitivity: 'base' }),
    destino: (a, b) => ((presuPorNro[a.nropresupuesto]?.destino) || '').localeCompare((presuPorNro[b.nropresupuesto]?.destino) || '', 'es', { sensitivity: 'base' }),
    nro: (a, b) => (Number(a.nropresupuesto) || 0) - (Number(b.nropresupuesto) || 0),
  };

  const filtrados = servicios
    .filter((s) => (s.contacto || '').toLowerCase().includes(busquedaTabla.toLowerCase()) || (s.nropresupuesto || '').toString().includes(busquedaTabla))
    .filter((s) => !filtroEstado || s.estado === filtroEstado)
    .filter((s) => modoVista === 'todos' || !tieneTraficoHecho(s))
    .sort((a, b) => {
      if (!orden.campo) return 0;
      const r = COMPARADORES[orden.campo](a, b);
      return orden.asc ? r : -r;
    });

  if (vista === 'form') return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setVista('tabla')}
            style={{ padding: '7px 16px', background: 'transparent', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
            ← Volver
          </button>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>
            {servicioActivo ? `Tráfico — Presupuesto N° ${servicioActivo.nropresupuesto}` : 'Asignar chofer a servicio'}
          </div>
        </div>
        <button onClick={guardar} disabled={guardando || bloqueado}
          style={{ padding: '9px 20px', background: bloqueado ? '#F2F2F2' : '#1A1A1A', color: bloqueado ? '#AAA' : '#F5C400', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: bloqueado ? 'default' : 'pointer' }}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

        {chequeandoBusqueda && !servicioActivo && (
          <Seccion titulo="Buscar Servicio">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', columnGap: 36, rowGap: 20 }}>
              <div>
                {campo('Cliente', inp(busquedaCliente, (e) => { setBusquedaCliente(e.target.value); sugerir('contacto', e.target.value); }, 'Buscar...'))}
              </div>
              <div>
                {campo('Destino', inp(busquedaDestino, (e) => { setBusquedaDestino(e.target.value); sugerir('domicilioDestino', e.target.value); }, 'Buscar...'))}
              </div>
              <div>
                {campo('Nro. Presupuesto', inp(busquedaNro, (e) => { setBusquedaNro(e.target.value); sugerir('nropresupuesto', e.target.value); }, 'Buscar...'))}
              </div>
              <div>
                {campo('Fecha de Salida', inp(busquedaFecha, (e) => { setBusquedaFecha(e.target.value); sugerir('salidaFecha', e.target.value); }, 'DD/MM/AAAA'))}
              </div>
            </div>
            {resultados.length > 1 && (
              <div style={{ marginTop: 16 }}>
                {resultados.map((r) => resultadoItem(`${r.contacto} — N° ${r.nropresupuesto}`, () => abrirDesdeTabla(r)))}
              </div>
            )}
          </Seccion>
        )}

        <Seccion titulo="A Completar">
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>Chofer</label>
              {!bloqueado && (
                <button onClick={agregarChofer} style={{ background: 'none', border: 'none', fontSize: 18, fontWeight: 700, color: '#2E7D32', cursor: 'pointer' }}>+</button>
              )}
            </div>
            {choferes.map((c, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: idx > 0 ? 8 : 0 }}>
                <input
                  value={c}
                  onChange={(e) => setChofer(idx, e.target.value)}
                  readOnly={bloqueado}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #E0E0E0',
                    borderRadius: 8,
                    fontSize: 11,
                    background: bloqueado ? '#F0F0F0' : '#F8F8F8',
                    outline: 'none',
                    color: bloqueado ? '#888' : '#1A1A1A',
                  }}
                />
                {!bloqueado && choferes.length > 1 && (
                  <button onClick={() => quitarChofer(idx)} style={{ background: 'none', border: 'none', fontSize: 16, color: '#C62828', cursor: 'pointer', padding: '0 4px' }}>×</button>
                )}
              </div>
            ))}
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Unidad</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {FLOTA.map((fl) => {
                const seleccionado = categoriaTieneSeleccion(fl);
                const abierta = categoriaAbierta === fl.id;
                return (
                  <div key={fl.id}>
                    <div onClick={() => !bloqueado && toggleCategoria(fl)}
                      style={{
                        border: `1px solid ${seleccionado ? '#1A1A1A' : '#D9D9D9'}`,
                        background: seleccionado ? '#1A1A1A' : '#F7F7F7',
                        borderRadius: 8, padding: '8px 10px', cursor: bloqueado ? 'default' : 'pointer',
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: seleccionado ? '#F5C400' : '#1A1A1A' }}>{fl.nombre}</span>
                        {fl.subUnidades && <span style={{ fontSize: 11, color: seleccionado ? '#F5C400' : '#888' }}>{abierta ? '▲' : '▼'}</span>}
                      </div>
                      <div style={{ fontSize: 10, color: seleccionado ? '#CCC' : '#888', marginTop: 2 }}>{fl.capacidadTexto}</div>
                    </div>

                    {fl.subUnidades && abierta && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, paddingLeft: 6 }}>
                        {fl.subUnidades.map((codigo) => {
                          const sel = unidadesSeleccionadas.includes(codigo);
                          return (
                            <div key={codigo} onClick={() => !bloqueado && toggleSubUnidad(codigo)}
                              style={{
                                border: `1px solid ${sel ? '#1A1A1A' : '#D9D9D9'}`,
                                background: sel ? '#1A1A1A' : '#fff',
                                color: sel ? '#F5C400' : '#1A1A1A',
                                borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                                cursor: bloqueado ? 'default' : 'pointer',
                              }}>
                              N° {codigo}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {unidadesSeleccionadas.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#555' }}>
                Seleccionadas: <b>{unidadesSeleccionadas.join(', ')}</b>
              </div>
            )}
          </div>

          <div style={{ marginTop: 22 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Dinero para viaje</label>
            <input
              value={dineroViaje}
              onChange={(e) => setDineroViaje(e.target.value.replace(/[^0-9]/g, ''))}
              readOnly={bloqueado}
              placeholder="0"
              style={{
                padding: '8px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13,
                background: bloqueado ? '#F0F0F0' : '#F8F8F8', outline: 'none', width: '100%',
                color: bloqueado ? '#888' : '#1A1A1A',
              }}
            />
          </div>
        </Seccion>

        <Seccion titulo="Contacto / Viaje">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: 36, rowGap: 22 }}>
            {campo('Contacto', inp(servicioActivo?.contacto, () => {}, '', true))}
            {campo('Capacidad', inp(servicioActivo?.capacidad, () => {}, '', true))}
            {campo('Telefono', inp(servicioActivo?.telefono, () => {}, '', true))}
            {campo('Estado', inp(ESTADO_LABEL[servicioActivo?.estado] || servicioActivo?.estado, () => {}, '', true))}
            {campo('Cuit', inp(servicioActivo?.cuit, () => {}, '', true))}
            {campo('Responsable', inp(servicioActivo?.responsable, () => {}, '', true))}
          </div>
        </Seccion>

        <Seccion titulo="Lugares">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: 36, rowGap: 22 }}>
            {campo('Domicilio Origen', inp(servicioActivo?.domicilioOrigen, () => {}, '', true))}
            {campo('Domicilio Destino', inp(servicioActivo?.domicilioDestino, () => {}, '', true))}
          </div>
        </Seccion>

        <Seccion titulo="Salida / Retorno">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', columnGap: 36, rowGap: 22 }}>
            {campo('Fecha Salida', inp(servicioActivo?.salidaFecha, () => {}, '', true))}
            {campo('Hora Salida', inp(servicioActivo?.salidaHora, () => {}, '', true))}
            {campo('Fecha Retorno', inp(servicioActivo?.retornoFecha, () => {}, '', true))}
            {campo('Hora Retorno', inp(servicioActivo?.retornoHora, () => {}, '', true))}
          </div>
        </Seccion>

      </div>
    </div>
  );

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>Trafico</div>
        <button onClick={nuevo}
          style={{ padding: '8px 18px', background: '#F5C400', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1A1A1A', cursor: 'pointer' }}>
          + Asignar chofer a servicio
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="Buscar por cliente o número..." value={busquedaTabla} onChange={(e) => setBusquedaTabla(e.target.value)}
          style={{ flex: 1, padding: '10px 14px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, background: '#fff', outline: 'none' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'pendientes', label: 'Sin tráfico asignado' },
          { key: 'todos', label: 'Todos' },
        ].map((op) => (
          <button key={op.key} onClick={() => setModoVista(op.key)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: modoVista === op.key ? 'none' : '1px solid #E0E0E0',
              background: modoVista === op.key ? '#1A1A1A' : '#fff',
              color: modoVista === op.key ? '#F5C400' : '#555',
            }}>
            {op.label}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E0E0E0', overflow: 'hidden', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {[
                { label: 'Fecha Salida', campo: 'salida' },
                { label: 'Hora Salida', campo: null },
                { label: 'Fecha Retorno', campo: 'retorno' },
                { label: 'Hora Retorno', campo: null },
                { label: 'Tipo de Vehículo', campo: null },
                { label: 'Origen', campo: 'origen' },
                { label: 'Km', campo: null },
                { label: 'Destino', campo: 'destino' },
                { label: 'Cliente', campo: 'cliente' },
              ].map(({ label, campo }) => (
                <th key={label} onClick={() => campo && toggleOrden(campo)}
                  style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: orden.campo === campo ? '#1A1A1A' : '#888', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '0.5px solid #F0F0F0', whiteSpace: 'nowrap', cursor: campo ? 'pointer' : 'default', userSelect: 'none' }}>
                  {label}{campo && orden.campo === campo ? (orden.asc ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
              <th onClick={toggleFiltroEstado}
                style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: filtroEstado ? '#1A1A1A' : '#888', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '0.5px solid #F0F0F0', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                Estado{filtroEstado ? ` (${ESTADO_LABEL[filtroEstado]})` : ''}
              </th>
              <th onClick={() => toggleOrden('nro')}
                style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: orden.campo === 'nro' ? '#1A1A1A' : '#888', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '0.5px solid #F0F0F0', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                Nro. Presupuesto{orden.campo === 'nro' ? (orden.asc ? ' ▲' : ' ▼') : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={11} style={{ padding: 20, textAlign: 'center', color: '#888' }}>Cargando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: 20, textAlign: 'center', color: '#888' }}>
                {modoVista === 'pendientes' ? 'No hay servicios sin tráfico asignado' : 'No hay servicios'}
              </td></tr>
            ) : (
              filtrados.map((row) => {
                const ec = ESTADO_COLOR[row.estado] || ESTADO_COLOR.pendiente;
                const presu = presuPorNro[row.nropresupuesto];
                const tipoVehiculo = presu
                  ? [presu.tipoTransporte, presu.capacidad ? `${presu.capacidad} pax` : null].filter(Boolean).join(' - ') || '-'
                  : '-';
                const km = presu && Number(presu.kmRecorrer) > 0 ? presu.kmRecorrer : '';
                return (
                  <tr key={row.id} onClick={() => abrirDesdeTabla(row)} style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFAFA')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 16px', borderBottom: '0.5px solid #F8F8F8', whiteSpace: 'nowrap' }}>{row.salidaFecha || '-'}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '0.5px solid #F8F8F8', whiteSpace: 'nowrap' }}>{row.salidaHora || '-'}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '0.5px solid #F8F8F8', whiteSpace: 'nowrap' }}>{row.retornoFecha || '-'}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '0.5px solid #F8F8F8', whiteSpace: 'nowrap' }}>{row.retornoHora || '-'}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '0.5px solid #F8F8F8', whiteSpace: 'nowrap' }}>{tipoVehiculo}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '0.5px solid #F8F8F8' }}>{presu?.origen || '-'}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '0.5px solid #F8F8F8' }}>{km}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '0.5px solid #F8F8F8' }}>{presu?.destino || '-'}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '0.5px solid #F8F8F8' }}>{row.contacto || '-'}</td>
                    <td style={{ padding: '12px 16px', borderBottom: '0.5px solid #F8F8F8' }}>
                      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: ec.bg, color: ec.color }}>
                        {ESTADO_LABEL[row.estado] || row.estado || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '0.5px solid #F8F8F8', fontSize: 12, color: '#555' }}>{row.nropresupuesto || '-'}</td>
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
