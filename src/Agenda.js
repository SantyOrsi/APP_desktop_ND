import React, { useState, useEffect } from 'react';
import { db } from './constants/firebase';
import { collection, getDocs, doc, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { recomendarUnidad, FLOTA } from './constants/flota';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const COLOR_ESTADO = { pendiente: '#F5C400', enRuta: '#1E88E5', completo: '#43A047' };
const PRIORIDAD = ['pendiente', 'enRuta', 'completo'];
const COLOR_EVENTO = '#8E24AA';
const ESTADOS_MANUALES = ['cancelado'];

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

export default function Agenda() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth());
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [porDia, setPorDia] = useState({});
  const [eventosPorDia, setEventosPorDia] = useState({});
  const [servicios, setServicios] = useState([]);
  const [semanaFecha, setSemanaFecha] = useState(aTexto(hoy)); // referencia de la semana mostrada a la derecha
  const [panelIzqVisible, setPanelIzqVisible] = useState(true);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalFecha, setModalFecha] = useState('');
  const [modalTitulo, setModalTitulo] = useState('');
  const [modalDescripcion, setModalDescripcion] = useState('');
  const [guardandoEvento, setGuardandoEvento] = useState(false);

  const cargarServicios = async () => {
    try {
      const snap = await getDocs(collection(db, 'servicios'));
      const ahora = new Date();
      const hoyDate = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 12);

      const batch = writeBatch(db);
      let huboCambios = false;
      const mapa = {};
      const lista = [];

      snap.docs.forEach((d) => {
        const data = d.data();
        lista.push({ id: d.id, ...data });

        const salida = normalizarFecha(data.salidaFecha);
        if (!salida) return;
        const retorno = normalizarFecha(data.retornoFecha) || salida;

        let estadoReal = data.estado || 'pendiente';
        if (!ESTADOS_MANUALES.includes(data.estado)) {
          estadoReal = calcularEstado(salida, retorno, hoyDate);
          if (estadoReal !== data.estado) {
            batch.update(doc(db, 'servicios', d.id), { estado: estadoReal });
            huboCambios = true;
          }
        }

        if (!mapa[salida]) mapa[salida] = { estados: new Set(), cantidad: 0, terminaCantidad: 0 };
        mapa[salida].estados.add(estadoReal);
        mapa[salida].cantidad += 1;

        if (!mapa[retorno]) mapa[retorno] = { estados: new Set(), cantidad: 0, terminaCantidad: 0 };
        mapa[retorno].terminaCantidad += 1;
      });

      if (huboCambios) await batch.commit();
      setPorDia(mapa);
      setServicios(lista);
    } catch (error) {
      console.log('Error al cargar agenda:', error.message);
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

  const recargarTodo = () => { cargarServicios(); cargarEventos(); };

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

  // Dado un código de unidad específica (ej: "16" o "RANGER"), devuelve
  // "Categoría (N° código)"; si ya es un nombre genérico (dato viejo o
  // categoría sin sub-unidades), lo deja igual.
  const formatearUnidad = (valor) => {
    const categoria = FLOTA.find((fl) => fl.subUnidades?.includes(valor));
    return categoria ? `${categoria.nombre} (N° ${valor})` : valor;
  };

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
                const terminaCantidad = info?.terminaCantidad || 0;
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                        {terminaCantidad > 0 && (
                          <div style={{ width: 14, height: 14, borderRadius: 7, background: '#E53935', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 8, fontWeight: 700, color: '#fff' }}>{terminaCantidad}</span>
                          </div>
                        )}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: '#E53935' }} />
                <span style={{ fontSize: 11, color: '#555' }}>Termina</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PANEL DERECHO: SEMANA DETALLADA ── */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => setPanelIzqVisible((v) => !v)}
            style={{ padding: '7px 14px', background: '#F2F2F2', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {panelIzqVisible ? '‹ Ocultar calendario' : '› Mostrar calendario'}
          </button>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>
            Semana del {aTexto(semana[0])} al {aTexto(semana[6])}
          </div>
          <button onClick={recargarTodo}
            style={{ marginLeft: 'auto', padding: '7px 14px', background: '#F2F2F2', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ↻ Recargar
          </button>
        </div>

        {semana.map((d) => {
          const fechaStr = aTexto(d);
          const items = servicios.filter((s) => s.salidaFecha === fechaStr);
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
    </div>
  );
}
