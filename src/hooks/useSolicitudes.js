import { useState, useEffect } from 'react';

import { db } from '../constants/firebase';

import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';


export function useSolicitudes(usuario) {

  const [solicitudesPendientes, setSolicitudesPendientes] = useState([]);
  const [solicitudesPropias, setSolicitudesPropias] = useState([]);
  const [cargandoSolicitud, setCargandoSolicitud] = useState(false);

  const rol = (usuario?.rol || '').trim().toLowerCase();

  const esAdmin = rol === 'admin';


  // ==========================================
  // SOLICITUDES PENDIENTES PARA EL ADMIN
  // ==========================================

  useEffect(() => {

    if (!esAdmin) {
      setSolicitudesPendientes([]);
      return;
    }

    const q = query(
      collection(db, 'SolicitudesPermiso'),
      where('estado', '==', 'pendiente')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {

        const docs = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        setSolicitudesPendientes(docs);

      },
      (error) => {
        console.error(
          'Error al escuchar solicitudes pendientes:',
          error
        );
      }
    );

    return () => unsubscribe();

  }, [esAdmin]);


  // ==========================================
  // SOLICITUDES DEL USUARIO ACTUAL
  // ==========================================

  useEffect(() => {

    if (esAdmin || !usuario?.uid) {
      setSolicitudesPropias([]);
      return;
    }

    const q = query(
      collection(db, 'SolicitudesPermiso'),
      where('usuarioId', '==', usuario.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {

        const docs = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        setSolicitudesPropias(docs);

      },
      (error) => {
        console.error(
          'Error al escuchar solicitudes propias:',
          error
        );
      }
    );

    return () => unsubscribe();

  }, [esAdmin, usuario?.uid]);


  // ==========================================
  // OBTENER LA SOLICITUD DE UNA SECCIÓN/TABLA
  // ==========================================

  const obtenerSolicitud = (seccion, tipoAcceso) => {

    const solicitudes = solicitudesPropias.filter(
      s =>
        s.seccionSolicitada === seccion &&
        s.tipoAcceso === tipoAcceso
    );

    // Priorizamos:
    // 1. Aprobada
    // 2. Pendiente
    // 3. La última disponible

    return (
      solicitudes.find(s => s.estado === 'aprobada') ||
      solicitudes.find(s => s.estado === 'pendiente') ||
      solicitudes[0] ||
      null
    );
  };


  // ==========================================
  // SOLICITAR ACCESO
  // ==========================================

  const solicitarAcceso = async (
    seccionSolicitada,
    tipoAcceso = 'seccion'
  ) => {

    if (!usuario?.uid || cargandoSolicitud) return;

    const solicitudExistente = obtenerSolicitud(
      seccionSolicitada,
      tipoAcceso
    );

    // No crear duplicados si ya está pendiente
    // o si ya tiene acceso aprobado

    if (
      solicitudExistente &&
      ['pendiente', 'aprobada'].includes(
        solicitudExistente.estado
      )
    ) {
      return;
    }

    setCargandoSolicitud(true);

    try {

      await addDoc(
        collection(db, 'SolicitudesPermiso'),
        {
          usuarioId: usuario.uid,

          nombreUsuario:
            usuario.nombre || usuario.email || 'Usuario',

          email: usuario.email || '',

          seccionSolicitada,

          tipoAcceso,

          estado: 'pendiente',

          creadoEn: serverTimestamp()
        }
      );

    } catch (error) {

      console.error(
        'Error al enviar solicitud:',
        error
      );

    } finally {

      setCargandoSolicitud(false);

    }
  };


  // ==========================================
  // APROBAR O RECHAZAR SOLICITUD
  // ==========================================

  const responderSolicitud = async (
    solicitudId,
    nuevoEstado
  ) => {

    try {

      const docRef = doc(
        db,
        'SolicitudesPermiso',
        solicitudId
      );

      await updateDoc(
        docRef,
        {
          estado: nuevoEstado,
          fechaRespuesta: serverTimestamp()
        }
      );

    } catch (error) {

      console.error(
        'Error al responder solicitud:',
        error
      );

    }
  };


  // ==========================================
  // REVOCAR PERMISO
  // ==========================================

  const revocarPermiso = async (
    solicitudId
  ) => {

    if (!solicitudId) return;

    try {

      const docRef = doc(
        db,
        'SolicitudesPermiso',
        solicitudId
      );

      await deleteDoc(docRef);

    } catch (error) {

      console.error(
        'Error al revocar permiso:',
        error
      );

    }
  };


  return {

    solicitudesPendientes,

    solicitudesPropias,

    obtenerSolicitud,

    cargandoSolicitud,

    solicitarAcceso,

    responderSolicitud,

    revocarPermiso

  };

}