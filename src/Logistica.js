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
  <input value={value || ''} onChange={onChange} placeholder={placeholder} readOnly={readOnly}
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
  const [guardando, setGuardando] = useState(false);

  const bloqueado = chequeandoBusqueda && !servicioActivo;

  const abrirDesdeTabla = (s) => {
    setServicioActivo(s);
    setChequeandoBusqueda(false);
    setChoferes(Array.isArray(s.chofer) ? (s.chofer.length ? s.chofer : ['']) : (s.chofer ? [s.chofer] : ['']));
    setUnidadesSeleccionadas(Array.isArray(s.unidad) ? s.unidad : (s.unidad ? [s.unidad] : []));
    setCategoriaAbierta(null);
    setResultados([]);
    setVista('form');
  };

  const nuevo = () => {
    setServicioActivo(null);
    setChequeandoBusqueda(true);
    setChoferes(['']);
    setUnidadesSeleccionadas([]);
    setCategoriaAbierta(null);
    setBusquedaCliente(''); setBusquedaDestino(''); setBusquedaNro(''); setBusquedaFecha('');
    setResultados([]);
    setVista('form');
  };

  const buscar = (campoServicio, valor) => {
    if (!valor.trim()) return;
    const encontrados = servicios.filter((s) => (s[campoServicio] || '').toString().trim() === valor.trim());
    setResultados(encontrados);
    if (encontrados.length === 0) alert('No se encontraron servicios');
    else if (encontrados.length === 1) abrirDesdeTabla(encontrados[0]);
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
    nro: (a, b) => (Number(a.nropresupuesto) || 0) - (Number(b.nropresupuesto) || 0),
    cliente: (a, b) => (a.contacto || '').localeCompare(b.contacto || '', 'es', { sensitivity: 'base' }),
    telefono: (a, b) => (a.telefono || '').localeCompare(b.telefono || '', 'es', { sensitivity: 'base' }),
    salida: (a, b) => aFechaOrden(a.salidaFecha) - aFechaOrden(b.salidaFecha),
    retorno: (a, b) => aFechaOrden(a.retornoFecha) - aFechaOrden(b.retornoFecha),
    origen: (a, b) => (a.domicilioOrigen || '').localeCompare(b.domicilioOrigen || '', 'es', { sensitivity: 'base' }),
  };

  const filtrados = servicios
    .filter((s) => (s.contacto || '').toLowerCase().includes(busquedaTabla.toLowerCase()) || (s.nropresupuesto || '').toString().includes(busquedaTabla))
    .filter((s) => !filtroEstado || s.estado === filtroEstado)
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
            {servicioActivo ? `Logística — Presupuesto N° ${servicioActivo.nropresupuesto}` : 'Asignar chofer a servicio'}
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
                {campo('Cliente', inp(busquedaCliente, (e) => setBusquedaCliente(e.target.value), 'Buscar...'))}
                <div style={{ marginTop: 8 }}>{btnBuscar(() => buscar('contacto', busquedaCliente))}</div>
              </div>
              <div>
                {campo('Destino', inp(busquedaDestino, (e) => setBusquedaDestino(e.target.value), 'Buscar...'))}
                <div style={{ marginTop: 8 }}>{btnBuscar(() => buscar('domicilioDestino', busquedaDestino))}</div>
              </div>
              <div>
                {campo('Nro. Presupuesto', inp(busquedaNro, (e) => setBusquedaNro(e.target.value), 'Buscar...'))}
                <div style={{ marginTop: 8 }}>{btnBuscar(() => buscar('nropresupuesto', busquedaNro))}</div>
              </div>
              <div>
                {campo('Fecha de Salida', inp(busquedaFecha, (e) => setBusquedaFecha(e.target.value), 'DD/MM/AAAA'))}
                <div style={{ marginTop: 8 }}>{btnBuscar(() => buscar('salidaFecha', busquedaFecha))}</div>
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
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>Logistica</div>
        <button onClick={nuevo}
          style={{ padding: '8px 18px', background: '#F5C400', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1A1A1A', cursor: 'pointer' }}>
          + Asignar chofer a servicio
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="Buscar por cliente o número..." value={busquedaTabla} onChange={(e) => setBusquedaTabla(e.target.value)}
          style={{ flex: 1, padding: '10px 14px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, background: '#fff', outline: 'none' }} />
      </div>

      <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E0E0E0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {[
                { label: 'Nro', campo: 'nro' },
                { label: 'Cliente', campo: 'cliente' },
                { label: 'Telefono', campo: 'telefono' },
                { label: 'Fecha Salida', campo: 'salida' },
                { label: 'Fecha Retorno', campo: 'retorno' },
                { label: 'Origen → Destino', campo: 'origen' },
              ].map(({ label, campo }) => (
                <th key={label} onClick={() => toggleOrden(campo)}
                  style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: orden.campo === campo ? '#1A1A1A' : '#888', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '0.5px solid #F0F0F0', cursor: 'pointer', userSelect: 'none' }}>
                  {label}{orden.campo === campo ? (orden.asc ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
              <th onClick={toggleFiltroEstado}
                style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: filtroEstado ? '#1A1A1A' : '#888', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '0.5px solid #F0F0F0', cursor: 'pointer', userSelect: 'none' }}>
                Estado{filtroEstado ? ` (${ESTADO_LABEL[filtroEstado]})` : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#888' }}>Cargando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#888' }}>No hay servicios</td></tr>
            ) : (
              filtrados.map((row) => {
                const ec = ESTADO_COLOR[row.estado] || ESTADO_COLOR.pendiente;
                return (
                  <tr key={row.id} onClick={() => abrirDesdeTabla(row)} style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFAFA')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.nropresupuesto || '-'}</td>
                    <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.contacto || '-'}</td>
                    <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.telefono || '-'}</td>
                    <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.salidaFecha || '-'}</td>
                    <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.retornoFecha || '-'}</td>
                    <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>{row.domicilioOrigen && row.domicilioDestino ? `${row.domicilioOrigen} → ${row.domicilioDestino}` : '-'}</td>
                    <td style={{ padding: '12px 20px', borderBottom: '0.5px solid #F8F8F8' }}>
                      <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: ec.bg, color: ec.color }}>
                        {ESTADO_LABEL[row.estado] || row.estado || '-'}
                      </span>
                    </td>
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
