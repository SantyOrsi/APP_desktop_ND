import React, { useEffect, useRef, useState } from 'react';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
} from 'firebase/firestore';

import { db, auth } from './constants/firebase';

export default function ChatGeneral() {
  const [mensajes, setMensajes] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const mensajesRef = useRef(null);
  const inputRef = useRef(null);

  // ============================================================
  // ESCUCHAR MENSAJES EN TIEMPO REAL
  // ============================================================

  useEffect(() => {
    const q = query(
      collection(db, 'chatGeneral'),
      orderBy('fecha', 'asc'),
      limit(300)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const datos = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        }));

        setMensajes(datos);
        setError('');
      },
      (err) => {
        console.error('Error cargando chat general:', err);
        setError('No se pudieron cargar los mensajes.');
      }
    );

    return () => unsubscribe();
  }, []);

  // ============================================================
  // SCROLL AUTOMÁTICO AL ÚLTIMO MENSAJE
  // ============================================================

  useEffect(() => {
    if (mensajesRef.current) {
      mensajesRef.current.scrollTop =
        mensajesRef.current.scrollHeight;
    }
  }, [mensajes]);

  // ============================================================
  // ENVIAR MENSAJE
  // ============================================================

  const enviarMensaje = async () => {
    const texto = mensaje.trim();

    if (!texto || enviando) return;

    const usuario = auth.currentUser;

    if (!usuario) {
      alert('No hay un usuario conectado.');
      return;
    }

    setEnviando(true);
    setError('');

    try {
      await addDoc(collection(db, 'chatGeneral'), {
        mensaje: texto,
        uid: usuario.uid,
        nombre:
          usuario.displayName ||
          usuario.email ||
          'Usuario',
        email: usuario.email || '',
        fecha: serverTimestamp(),
      });

      setMensaje('');

      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);

    } catch (err) {
      console.error('Error enviando mensaje:', err);

      setError(
        'No se pudo enviar el mensaje.'
      );
    } finally {
      setEnviando(false);
    }
  };

  // ============================================================
  // ENTER PARA ENVIAR
  // SHIFT + ENTER = SALTO DE LÍNEA
  // ============================================================

  const manejarTecla = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  };

  // ============================================================
  // FORMATEAR HORA
  // ============================================================

  const obtenerHora = (fecha) => {
    if (!fecha) {
      return '--:--';
    }

    try {
      const date =
        typeof fecha.toDate === 'function'
          ? fecha.toDate()
          : new Date(fecha);

      return date.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return '--:--';
    }
  };

  // ============================================================
  // FORMATEAR FECHA COMPLETA
  // ============================================================

  const obtenerFecha = (fecha) => {
    if (!fecha) {
      return '';
    }

    try {
      const date =
        typeof fecha.toDate === 'function'
          ? fecha.toDate()
          : new Date(fecha);

      return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  // ============================================================
  // SABER SI CAMBIÓ EL DÍA
  // ============================================================

  const esNuevoDia = (actual, anterior) => {
    if (!actual?.fecha || !anterior?.fecha) {
      return false;
    }

    return (
      obtenerFecha(actual.fecha) !==
      obtenerFecha(anterior.fecha)
    );
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#F5F5F5',
      }}
    >
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #E5E5E5',
          padding: '18px 24px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#1A1A1A',
              }}
            >
              Chat General
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: '#888',
              }}
            >
              Conversación interna en tiempo real
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 11,
              color: '#666',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#39A852',
                display: 'inline-block',
              }}
            />

            En línea
          </div>
        </div>
      </div>

      {/* ======================================================
          MENSAJES
      ====================================================== */}

      <div
        ref={mensajesRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {error && (
          <div
            style={{
              padding: '10px 12px',
              marginBottom: 12,
              borderRadius: 8,
              background: '#FFF0F0',
              border: '1px solid #F1CACA',
              color: '#A33',
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        {mensajes.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              color: '#999',
              fontSize: 13,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 30,
                  marginBottom: 10,
                }}
              >
                💬
              </div>

              <div
                style={{
                  fontWeight: 600,
                  color: '#777',
                }}
              >
                No hay mensajes todavía
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                }}
              >
                Sé el primero en escribir.
              </div>
            </div>
          </div>
        ) : (
          mensajes.map((item, index) => {
            const usuarioActual =
              auth.currentUser?.uid === item.uid;

            const mensajeAnterior =
              index > 0
                ? mensajes[index - 1]
                : null;

            return (
              <React.Fragment key={item.id}>
                {esNuevoDia(
                  item,
                  mensajeAnterior
                ) && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      margin: '14px 0',
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background: '#E2E2E2',
                      }}
                    />

                    <span
                      style={{
                        fontSize: 10,
                        color: '#999',
                        padding: '3px 8px',
                        borderRadius: 12,
                        background: '#EAEAEA',
                      }}
                    >
                      {obtenerFecha(item.fecha)}
                    </span>

                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background: '#E2E2E2',
                      }}
                    />
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: usuarioActual
                      ? 'flex-end'
                      : 'flex-start',
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      maxWidth: '72%',
                      minWidth: 100,
                      padding: '10px 12px',
                      borderRadius: usuarioActual
                        ? '12px 12px 4px 12px'
                        : '12px 12px 12px 4px',
                      background: usuarioActual
                        ? '#FFF3C4'
                        : '#FFFFFF',
                      border: '1px solid #E2E2E2',
                      boxShadow:
                        '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    {/* NOMBRE */}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent:
                          'space-between',
                        gap: 15,
                        marginBottom: 5,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: usuarioActual
                            ? '#806800'
                            : '#555',
                        }}
                      >
                        {usuarioActual
                          ? 'Vos'
                          : item.nombre ||
                            'Usuario'}
                      </div>

                      <div
                        style={{
                          fontSize: 10,
                          color: '#999',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {obtenerHora(
                          item.fecha
                        )}
                      </div>
                    </div>

                    {/* MENSAJE */}

                    <div
                      style={{
                        fontSize: 13,
                        lineHeight: 1.45,
                        color: '#1A1A1A',
                        whiteSpace: 'pre-wrap',
                        wordBreak:
                          'break-word',
                      }}
                    >
                      {item.mensaje}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* ======================================================
          INPUT
      ====================================================== */}

      <div
        style={{
          background: '#fff',
          borderTop: '1px solid #E5E5E5',
          padding: '14px 16px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
          }}
        >
          <textarea
            ref={inputRef}
            value={mensaje}
            onChange={(e) =>
              setMensaje(e.target.value)
            }
            onKeyDown={manejarTecla}
            placeholder="Escribí un mensaje..."
            rows={1}
            disabled={enviando}
            style={{
              flex: 1,
              minHeight: 42,
              maxHeight: 120,
              resize: 'vertical',
              padding: '11px 13px',
              border: '1px solid #DCDCDC',
              borderRadius: 9,
              background: '#F8F8F8',
              outline: 'none',
              fontSize: 13,
              fontFamily: 'inherit',
              color: '#1A1A1A',
              boxSizing: 'border-box',
            }}
          />

          <button
            onClick={enviarMensaje}
            disabled={
              !mensaje.trim() ||
              enviando
            }
            style={{
              height: 42,
              padding: '0 18px',
              border: 'none',
              borderRadius: 9,
              background:
                !mensaje.trim() || enviando
                  ? '#D8D8D8'
                  : '#1A1A1A',
              color:
                !mensaje.trim() || enviando
                  ? '#999'
                  : '#F5C400',
              fontSize: 12,
              fontWeight: 700,
              cursor:
                !mensaje.trim() || enviando
                  ? 'default'
                  : 'pointer',
            }}
          >
            {enviando
              ? '...'
              : 'ENVIAR'}
          </button>
        </div>

        <div
          style={{
            marginTop: 6,
            paddingLeft: 2,
            fontSize: 10,
            color: '#999',
          }}
        >
          Enter para enviar · Shift + Enter para
          escribir en otra línea
        </div>
      </div>
    </div>
  );
}