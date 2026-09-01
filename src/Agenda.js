import React, { useState, useEffect } from 'react';
import { db } from './constants/firebase';
import { collection, getDocs, doc, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { recomendarUnidad, FLOTA } from './constants/flota';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const COLOR_ESTADO = { pendiente: '#F5C400', enRuta: '#1E88E5', completo: '#43A047' };
const PRIORIDAD = ['pendiente', 'enRuta', 'completo'];
const COLOR_EVENTO = '#8E24AA';
const ESTADOS_MANUALES = ['cancelado', 'suspendido'];

const COLUMNAS = [
  { key: 'contratante',      label: 'Contratante',              width: 130 },
  { key: 'unidadContratada', label: 'Unidad/es contratada',      width: 160 },
  { key: 'localidadSalida',  label: 'Localidad de salida',       width: 150 },
  { key: 'localidadDestino', label: 'Localidad de destino',      width: 150 },
  { key: 'alojViaticos',     label: 'Aloj. y comida choferes',   width: 170 },
  { key: 'horaSalida',       label: 'Horario de salida',         width: 130 },
  { key: 'diaRegreso',       label: 'Día de regreso',            width: 130 },
  { key: 'horaRegreso',      label: 'Horario de regreso',        width: 140 },
  { key: 'movilAsignado',    label: 'Móvil asignado',            width: 150 },
  { key: 'choferes',         label: 'Choferes',                  width: 150 },
  { key: 'nroContrato',      label: 'Nro. contrato/presupuesto', width: 190 },
  { key: 'observacion',      label: 'Observación',               width: 200 },
];

const normalizarFecha = (f) => {
  if (!f) return null;
  const partes = String(f).split('/');
  if (partes.length !== 3) return null;
  const [dd, mm, aaaa] = partes;
  if (!dd || !mm || !aaaa || aaaa.length !== 4) return null;
  return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${aaaa}`;
};

const aDate = (f) => {
  const [dd, mm, aaaa] = f.split('/');
  return new Date(Number(aaaa), Number(mm) - 1, Number(dd), 12);
};

const aTexto = (d) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

const calcularEstado = (salida, retorno, hoyDate) => {
  const dSalida = aDate(salida);
  const dRetorno = retorno ? aDate(retorno) : dSalida;
  if (hoyDate < dSalida) return 'pendiente';
  if (hoyDate > dRetorno) return 'completo';
  return 'enRuta';
};

// ── Íconos simples por categoría de unidad ──
const IconoVehiculo = ({ tipo, size = 30 }) => {
  const props = { width: size, height: size * (32 / 48), viewBox: '0 0 48 32' };
  if (tipo === 'auto') {
    return (
      <svg {...props}>
        <path d="M6 22 L10 12 Q12 9 16 9 L30 9 Q34 9 36 12 L40 22 Z" fill="#1A1A1A" />
        <rect x="2" y="20" width="44" height="6" rx="3" fill="#1A1A1A" />
        <circle cx="12" cy="27" r="4" fill="#666" />
        <circle cx="36" cy="27" r="4" fill="#666" />
      </svg>
    );
  }
  if (tipo === 'van') {
    return (
      <svg {...props}>
        <rect x="4" y="8" width="38" height="14" rx="3" fill="#1A1A1A" />
        <rect x="8" y="11" width="7" height="6" fill="#F5C400" />
        <rect x="18" y="11" width="7" height="6" fill="#F5C400" />
        <rect x="2" y="18" width="44" height="6" rx="3" fill="#1A1A1A" />
        <circle cx="12" cy="27" r="4" fill="#666" />
        <circle cx="34" cy="27" r="4" fill="#666" />
      </svg>
    );
  }
  if (tipo === 'mini19' || tipo === 'mini23') {
    return (
      <svg {...props}>
        <rect x="3" y="6" width="42" height="16" rx="3" fill="#1A1A1A" />
        {[7, 15, 23, 31].map((x) => <rect key={x} x={x} y="9" width="6" height="6" fill="#F5C400" />)}
        <rect x="1" y="20" width="46" height="5" rx="2.5" fill="#1A1A1A" />
        <circle cx="11" cy="27" r="4" fill="#666" />
        <circle cx="37" cy="27" r="4" fill="#666" />
      </svg>
    );
  }
  if (tipo === 'urbano' || tipo === 'comil') {
    return (
      <svg {...props}>
        <rect x="1" y="5" width="46" height="17" rx="2" fill="#1A1A1A" />
        {[6, 13, 20, 27, 34].map((x) => <rect key={x} x={x} y="8" width="5" height="6" fill="#F5C400" />)}
        <rect x="0" y="21" width="48" height="5" rx="2.5" fill="#1A1A1A" />
        <circle cx="10" cy="28" r="4" fill="#666" />
        <circle cx="38" cy="28" r="4" fill="#666" />
      </svg>
    );
  }
  if (tipo === 'dobleP') {
    return (
      <svg {...props}>
        <rect x="1" y="2" width="46" height="20" rx="2" fill="#1A1A1A" />
        {[5, 12, 19, 26, 33].map((x) => <rect key={'a' + x} x={x} y="4" width="5" height="5" fill="#F5C400" />)}
        {[5, 12, 19, 26, 33].map((x) => <rect key={'b' + x} x={x} y="12" width="5" height="5" fill="#F5C400" />)}
        <rect x="0" y="22" width="48" height="4" rx="2" fill="#1A1A1A" />
        <circle cx="10" cy="28" r="4" fill="#666" />
        <circle cx="38" cy="28" r="4" fill="#666" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <rect x="4" y="10" width="40" height="12" rx="3" fill="#999" />
      <circle cx="12" cy="24" r="4" fill="#666" />
      <circle cx="36" cy="24" r="4" fill="#666" />
    </svg>
  );
};

export default function Agenda() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth());
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [eventosPorDia, setEventosPorDia] = useState({});
  const [servicios, setServicios] = useState([]);
  const [contratoPorNro, setContratoPorNro] = useState({}); // nroPresupuesto -> estado del contrato
  const [filtroPago, setFiltroPago] = useState('pagos'); // SE MODIFICÓ PARA QUE EMPIECE EN PAGOS
  const [semanaFecha, setSemanaFecha] = useState(aTexto(hoy)); // día de referencia (el que tocaste)
  const [panelIzqVisible, setPanelIzqVisible] = useState(true);
  const [modoVista, setModoVista] = useState('dia'); // 'dia' | 'semana'

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalFecha, setModalFecha] = useState('');
  const [modalTitulo, setModalTitulo] = useState('');
  const [modalDescripcion, setModalDescripcion] = useState('');
  const [guardandoEvento, setGuardandoEvento] = useState(false);

  const [modalDisponibilidad, setModalDisponibilidad] = useState(false);

  const cargarServicios = async () => {
    try {
      const snap = await getDocs(collection(db, 'servicios'));
      const ahora = new Date();
      const hoyDate = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 12);

      const batch = writeBatch(db);
      let huboCambios = false;
      const lista = [];

      snap.docs.forEach((d) => {
        const data = d.data();
        let estadoReal = data.estado || 'pendiente';

        const salida = normalizarFecha(data.salidaFecha);
        const retorno = normalizarFecha(data.retornoFecha) || salida;
        if (salida && !ESTADOS_MANUALES.includes(data.estado)) {
          estadoReal = calcularEstado(salida, retorno, hoyDate);
          if (estadoReal !== data.estado) {
            batch.update(doc(db, 'servicios', d.id), { estado: estadoReal });
            huboCambios = true;
          }
        }

        lista.push({ id: d.id, ...data, estado: estadoReal });
      });

      if (huboCambios) await batch.commit();
      // Los servicios suspendidos (en la papelera) no se muestran en la agenda
      setServicios(lista.filter((s) => s.estado !== 'suspendido'));
    } catch (error) {
      console.log('Error al cargar agenda:', error.message);
    }
  };

  const cargarContratos = async () => {
    try {
      const snap = await getDocs(collection(db, 'contratos'));
      const mapa = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.nroPresupuesto) mapa[String(data.nroPresupuesto)] = data.estado || '';
      });
      setContratoPorNro(mapa);
    } catch (error) {
      console.log('Error al cargar contratos:', error.message);
    }
  };

  const cargarEventos = async () => {
    try {
      const snap = await getDocs(collection(db, 'eventosAgenda'));
      const mapa = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const fecha = normalizarFecha(data.fecha);
        if (!fecha) return;
        if (!mapa[fecha]) mapa[fecha] = [];
        mapa[fecha].push({ id: d.id, ...data });
      });
      setEventosPorDia(mapa);
    } catch (error) {
      console.log('Error al cargar eventos:', error.message);
    }
  };

  const recargarTodo = () => { cargarServicios(); cargarContratos(); cargarEventos(); };

  useEffect(() => { recargarTodo(); }, []);

  const cambiarMes = (delta) => {
    let m = mes + delta;
    let a = anio;
    if (m < 0) { m = 11; a -= 1; }
    if (m > 11) { m = 0; a += 1; }
    setMes(m);
    setAnio(a);
  };

  const primerDiaSemana = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const celdas = [
    ...Array.from({ length: primerDiaSemana }, () => null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];

  const colorParaDia = (estados) => {
    for (const key of PRIORIDAD) {
      if (estados.has(key)) return COLOR_ESTADO[key];
    }
    return null;
  };

  // Filtra por el estado del CONTRATO vinculado. (SE QUITÓ CC)
  const pasaFiltroPago = (s) => {
    if (filtroPago === 'todos') return true;
    const estadoContrato = contratoPorNro[String(s.nropresupuesto)];
    if (!estadoContrato) return false; // sin contrato cargado, no pasa el filtro
    if (filtroPago === 'pagos') return ['Señado', 'Pago total'].includes(estadoContrato);
    return true;
  };

  const porDia = {};
  servicios.forEach((s) => {
    if (!pasaFiltroPago(s)) return;
    const salida = normalizarFecha(s.salidaFecha);
    if (!salida) return;
    if (!porDia[salida]) porDia[salida] = { estados: new Set(), cantidad: 0 };
    porDia[salida].estados.add(s.estado || 'pendiente');
    porDia[salida].cantidad += 1;
  });

  // ── Semana (Lunes a Domingo) que contiene semanaFecha ──
  const base = aDate(semanaFecha);
  const offsetLunes = (base.getDay() + 6) % 7;
  const lunes = new Date(base);
  lunes.setDate(base.getDate() - offsetLunes);
  const semana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    return d;
  });

  const diasAMostrar = modoVista === 'dia' ? [base] : semana;

  const formatearUnidad = (valor) => {
    const categoria = FLOTA.find((fl) => fl.subUnidades?.includes(valor));
    return categoria ? `${categoria.nombre} (N° ${valor})` : valor;
  };

  const categoriaDeUnidad = (valor) =>
    FLOTA.find((fl) => fl.subUnidades?.includes(valor)) || FLOTA.find((fl) => fl.nombre === valor) || null;

  const filaDeServicio = (s) => {
    const unidadesAsignadas = Array.isArray(s.unidad) ? s.unidad.filter(Boolean) : (s.unidad ? [s.unidad] : []);
    const unidadContratada = unidadesAsignadas.length
      ? unidadesAsignadas.map(formatearUnidad).join(', ')
      : (recomendarUnidad(s.capacidad)?.nombre || '-');

    return {
      contratante: s.contacto || '-',
      unidadContratada,
      localidadSalida: s.domicilioOrigen || '-',
      localidadDestino: s.domicilioDestino || '-',
      alojViaticos: s.alojViaticos || '-',
      horaSalida: s.salidaHora || '-',
      diaRegreso: s.retornoFecha || '-',
      horaRegreso: s.retornoHora || '-',
      movilAsignado: unidadesAsignadas.length ? unidadesAsignadas.map(formatearUnidad).join(', ') : 'Sin asignar',
      choferes: Array.isArray(s.chofer) ? (s.chofer.length ? s.chofer.join(', ') : 'Sin asignar') : (s.chofer || 'Sin asignar'),
      nroContrato: s.nropresupuesto || '-',
      observacion: s.observaciones || '-',
    };
  };

  const abrirModalEvento = (fechaStr) => {
    setModalFecha(fechaStr);
    setModalTitulo('');
    setModalDescripcion('');
    setModalAbierto(true);
  };

  const guardarEvento = async () => {
    if (!modalTitulo.trim()) { alert('Poné un título para el evento'); return; }
    setGuardandoEvento(true);
    try {
      await addDoc(collection(db, 'eventosAgenda'), {
        titulo: modalTitulo.trim(),
        fecha: modalFecha.trim(),
        descripcion: modalDescripcion.trim(),
        creadoEn: serverTimestamp(),
      });
      setModalAbierto(false);
      cargarEventos();
    } catch (error) {
      alert('Error al guardar el evento: ' + error.message);
    }
    setGuardandoEvento(false);
  };

  const unidadesOcupadas = (() => {
    const d = aDate(semanaFecha);
    const porCategoria = {};
    servicios.forEach((s) => {
      const salida = normalizarFecha(s.salidaFecha);
      if (!salida) return;
      const retorno = normalizarFecha(s.retornoFecha) || salida;
      if (d < aDate(salida) || d > aDate(retorno)) return;
      const unidades = Array.isArray(s.unidad) ? s.unidad.filter(Boolean) : (s.unidad ? [s.unidad] : []);
      unidades.forEach((codigo) => {
        const cat = categoriaDeUnidad(codigo);
        const catId = cat?.id || 'otro';
        const catNombre = cat?.nombre || 'Otro';
        if (!porCategoria[catId]) porCategoria[catId] = { nombre: catNombre, items: [] };
        porCategoria[catId].items.push({ codigo, cliente: s.contacto || '-' });
      });
    });
    return porCategoria;
  })();

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', gap: 16, overflow: 'hidden' }}>

      {/* ── PANEL IZQUIERDO: CALENDARIO DEL MES ── */}
      {panelIzqVisible && (
        <div style={{ width: 420, flexShrink: 0, overflowY: 'auto', paddingRight: 4 }}>
          <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E0E0E0', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
              <button onClick={() => cambiarMes(-1)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#1A1A1A' }}>‹</button>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>{MESES[mes]} {anio}</div>
              <button onClick={() => cambiarMes(1)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#1A1A1A' }}>›</button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 6 }}>
              {DIAS_SEMANA.map((d) => (
                <div key={d} style={{ width: '14.2857%', boxSizing: 'border-box', textAlign: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#888' }}>{d.slice(0, 3)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {celdas.map((dia, idx) => {
                if (dia === null) return <div key={`b-${idx}`} style={{ width: '14.2857%', boxSizing: 'border-box', aspectRatio: '1', padding: 3 }} />;
                const fechaKey = `${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${anio}`;
                const info = porDia[fechaKey];
                const color = info ? colorParaDia(info.estados) : null;
                const cantidad = info?.cantidad || 0;
                const tieneEvento = !!eventosPorDia[fechaKey]?.length;
                const seleccionado = normalizarFecha(semanaFecha) === fechaKey;

                return (
                  <div key={dia} onClick={() => setSemanaFecha(fechaKey)}
                    style={{ width: '14.2857%', boxSizing: 'border-box', aspectRatio: '1', padding: 3, cursor: 'pointer' }}>
                    <div style={{
                      height: '100%', borderRadius: 10, background: color || '#EFEFEF', padding: 4,
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                      outline: seleccionado ? '2px solid #1A1A1A' : 'none', outlineOffset: -2,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: color ? '#1A1A1A' : '#999' }}>{dia}</span>
                        {tieneEvento && <div style={{ width: 6, height: 6, borderRadius: 3, background: COLOR_EVENTO }} />}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        {cantidad > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: color ? '#1A1A1A' : '#999' }}>{cantidad}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 20, justifyContent: 'center' }}>
              {[
                { label: 'Pendiente', color: COLOR_ESTADO.pendiente },
                { label: 'En ruta', color: COLOR_ESTADO.enRuta },
                { label: 'Completo', color: COLOR_ESTADO.completo },
              ].map((r) => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: r.color }} />
                  <span style={{ fontSize: 11, color: '#555' }}>{r.label}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: COLOR_EVENTO }} />
                <span style={{ fontSize: 11, color: '#555' }}>Evento</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PANEL DERECHO: DÍA / SEMANA ── */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={() => setPanelIzqVisible((v) => !v)}
            style={{ padding: '7px 14px', background: '#F2F2F2', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {panelIzqVisible ? '‹ Ocultar calendario' : '› Mostrar calendario'}
          </button>

          <div style={{ display: 'flex', gap: 6 }}>
            {[{ key: 'dia', label: 'Día' }, { key: 'semana', label: 'Semana' }].map((op) => (
              <button key={op.key} onClick={() => setModoVista(op.key)}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: modoVista === op.key ? 'none' : '1px solid #E0E0E0',
                  background: modoVista === op.key ? '#1A1A1A' : '#fff',
                  color: modoVista === op.key ? '#F5C400' : '#555',
                }}>
                {op.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {/* SE MODIFICARON LAS OPCIONES DE FILTRO */}
            {[
              { key: 'pagos', label: 'Señado / Pago total' },
              { key: 'todos', label: 'Todos' },
            ].map((op) => (
              <button key={op.key} onClick={() => setFiltroPago(op.key)}
                style={{
                  padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  border: filtroPago === op.key ? 'none' : '1px solid #E0E0E0',
                  background: filtroPago === op.key ? '#1A1A1A' : '#fff',
                  color: filtroPago === op.key ? '#F5C400' : '#555',
                }}>
                {op.label}
              </button>
            ))}
          </div>

          <button onClick={() => setModalDisponibilidad(true)}
            style={{ marginLeft: 'auto', padding: '7px 14px', background: '#F2F2F2', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            🚐 Disponibilidad Unidades
          </button>
          <button onClick={recargarTodo}
            style={{ padding: '7px 14px', background: '#F2F2F2', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ↻ Recargar
          </button>
        </div>

        <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #E0E0E0', padding: 20 }}>
          {diasAMostrar.map((d) => {
            const fechaStr = aTexto(d);
            
            // SE MODIFICÓ LA LÓGICA DE FILTRADO PARA MOSTRAR RANGOS EN VISTA "DIA"
            const items = servicios.filter((s) => {
              if (!pasaFiltroPago(s)) return false;
              const salida = normalizarFecha(s.salidaFecha);
              if (!salida) return false;
              
              if (modoVista === 'semana') {
                return salida === fechaStr;
              } else {
                const retorno = normalizarFecha(s.retornoFecha) || salida;
                const dActual = aDate(fechaStr).getTime();
                const dSalida = aDate(salida).getTime();
                const dRetorno = aDate(retorno).getTime();
                return dActual >= dSalida && dActual <= dRetorno;
              }
            });

            const eventosDelDia = eventosPorDia[fechaStr] || [];

            return (
              <div key={fechaStr} style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: '#999', fontWeight: 600 }}>{fechaStr}</span>
                  <button onClick={() => abrirModalEvento(fechaStr)}
                    style={{ background: 'none', border: 'none', fontSize: 11, color: COLOR_EVENTO, fontWeight: 700, cursor: 'pointer' }}>
                    + Agregar evento
                  </button>
                </div>

                {eventosDelDia.length > 0 && (
                  <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {eventosDelDia.map((e) => (
                      <div key={e.id} style={{ borderLeft: `3px solid ${COLOR_EVENTO}`, background: '#F6EEFA', borderRadius: 6, padding: '6px 10px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A' }}>{e.titulo}</div>
                        {!!e.descripcion && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{e.descripcion}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {items.length === 0 ? (
                  eventosDelDia.length === 0 && <span style={{ fontSize: 12, color: '#CCC' }}>Sin servicios</span>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <div style={{ borderRadius: 12, overflow: 'hidden', display: 'inline-block', minWidth: '100%' }}>
                      <div style={{ display: 'flex', background: '#1A1A1A' }}>
                        {COLUMNAS.map((c) => (
                          <div key={c.key} style={{ width: c.width, padding: '10px', borderRight: '1px solid #333', flexShrink: 0 }}>
                            <span style={{ color: '#F5C400', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{c.label}</span>
                          </div>
                        ))}
                      </div>
                      {items.map((s) => {
                        const fila = filaDeServicio(s);
                        return (
                          <div key={s.id} style={{ display: 'flex', background: '#F4F4F4' }}>
                            {COLUMNAS.map((c) => (
                              <div key={c.key} style={{ width: c.width, padding: '10px', borderRight: '1px solid #F5C400', borderTop: '1px solid #E5E5E5', flexShrink: 0 }}>
                                <span style={{ fontSize: 12, color: '#1A1A1A' }}>{fila[c.key]}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MODAL: AGREGAR EVENTO ── */}
      {modalAbierto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setModalAbierto(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 420 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', marginBottom: 16 }}>
              Nuevo <span style={{ color: COLOR_EVENTO }}>evento</span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 6, textTransform: 'uppercase' }}>Fecha (DD/MM/AAAA)</div>
              <input value={modalFecha} onChange={(e) => setModalFecha(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 6, textTransform: 'uppercase' }}>Título</div>
              <input value={modalTitulo} onChange={(e) => setModalTitulo(e.target.value)} placeholder="Ej: Capacitación choferes"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 6, textTransform: 'uppercase' }}>Descripción (opcional)</div>
              <textarea value={modalDescripcion} onChange={(e) => setModalDescripcion(e.target.value)} rows={3}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalAbierto(false)}
                style={{ padding: '9px 18px', background: '#F2F2F2', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={guardarEvento} disabled={guardandoEvento}
                style={{ padding: '9px 18px', background: '#F5C400', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1A1A1A', cursor: 'pointer' }}>
                {guardandoEvento ? 'Guardando...' : 'Guardar evento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: DISPONIBILIDAD DE UNIDADES ── */}
      {modalDisponibilidad && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setModalDisponibilidad(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 520, maxHeight: '80vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>
              Unidades ocupadas
            </div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 18 }}>{semanaFecha}</div>

            {Object.keys(unidadesOcupadas).length === 0 ? (
              <div style={{ fontSize: 13, color: '#999', textAlign: 'center', padding: '20px 0' }}>
                No hay unidades asignadas para este día.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {Object.entries(unidadesOcupadas).map(([catId, cat]) => (
                  <div key={catId}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <IconoVehiculo tipo={catId} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>{cat.nombre}</span>
                      <span style={{ fontSize: 11, color: '#999' }}>({cat.items.length})</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 40 }}>
                      {cat.items.map((it, i) => (
                        <div key={i} style={{ fontSize: 12, color: '#555' }}>
                          N° {it.codigo} — <span style={{ color: '#1A1A1A' }}>{it.cliente}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModalDisponibilidad(false)}
                style={{ padding: '9px 18px', background: '#1A1A1A', color: '#F5C400', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}