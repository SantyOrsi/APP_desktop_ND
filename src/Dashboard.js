import React, { useState, useEffect } from 'react';

import { auth } from './constants/firebase';

import { signOut } from 'firebase/auth';

import { useColeccion } from './hooks/useFirestore';

import { useSolicitudes } from './hooks/useSolicitudes';

import Presupuestos from './Presupuestos';
import Contratos from './Contratos';
import Servicios from './Servicios';
import Agenda from './Agenda';
import Usuarios from './Usuarios';
import ChatGeneral from './ChatGeneral';
import Logistica from './Logistica';
import { LOGO_ND } from './constants/logo';

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
} from 'chart.js';

import { Pie, Bar } from 'react-chartjs-2';


ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
);


const NAV = [
  { section: 'General' },

  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'ti-layout-dashboard'
  },

  { section: 'Traslado' },

  {
    id: 'servicios',
    label: 'Servicios',
    icon: 'ti-car'
  },

  {
    id: 'presupuestos',
    label: 'Presupuestos',
    icon: 'ti-file-text'
  },

  {
    id: 'contratos',
    label: 'Contratos',
    icon: 'ti-contract'
  },

  {
    id: 'logistica',
    label: 'Trafico',
    icon: 'ti-truck'
  },

  { section: 'Sistema' },

  {
    id: 'agenda',
    label: 'Agenda',
    icon: 'ti-calendar'
  },
    {
    id: 'chat',
    label: 'Chat General',
    icon: '  💬 '
  },

  {
    id: 'usuarios',
    label: 'Usuarios',
    icon: 'ti-users'
  },

  {
    id: 'configuracion',
    label: 'Configuración',
    icon: 'ti-settings'
  }
];


const iniciales = (nombre) =>
  nombre
    ?.split(' ')
    .map(p => p[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'ND';


const BADGE = {
  'en ruta': {
    bg: '#E3F2FD',
    txt: '#1565C0'
  },

  'enruta': {
    bg: '#E3F2FD',
    txt: '#1565C0'
  },

  'pendiente': {
    bg: '#FFF8E1',
    txt: '#F57F17'
  },

  'completo': {
    bg: '#E8F5E9',
    txt: '#2E7D32'
  }
};


const badge = (estado) => {

  const e = (estado || 'pendiente').toLowerCase();

  const c = BADGE[e] || BADGE['pendiente'];

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 600,
        background: c.bg,
        color: c.txt
      }}
    >
      {estado || 'Pendiente'}
    </span>
  );

};


function RelojInfo() {

  const [ahora, setAhora] = useState(new Date());


  useEffect(() => {

    const interval = setInterval(
      () => setAhora(new Date()),
      1000
    );

    return () => clearInterval(interval);

  }, []);


  const hora = ahora.toLocaleTimeString(
    'es-AR',
    {
      hour: '2-digit',
      minute: '2-digit'
    }
  );


  const fecha = ahora.toLocaleDateString(
    'es-AR',
    {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }
  );


  return (

    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '0.5px solid #E0E0E0',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 32
      }}
    >

      <div style={{ textAlign: 'center' }}>

        <div
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: '#1A1A1A',
            lineHeight: 1
          }}
        >
          {hora}
        </div>

        <div
          style={{
            fontSize: 11,
            color: '#888',
            marginTop: 4,
            textTransform: 'capitalize'
          }}
        >
          {fecha}
        </div>

      </div>


      <div
        style={{
          width: 0.5,
          height: 48,
          background: '#E0E0E0'
        }}
      />


      <div style={{ textAlign: 'center' }}>

        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#1A1A1A'
          }}
        >
          🌤️
        </div>

        <div
          style={{
            fontSize: 11,
            color: '#888',
            marginTop: 2
          }}
        >
          Rosario, AR
        </div>

      </div>

    </div>

  );

}


export default function Dashboard({
  usuario,
  onLogout
}) {

  const [seccion, setSeccion] =
    useState('dashboard');

  const [sidebarVisible, setSidebarVisible] =
    useState(true);

  const [tab, setTab] =
    useState('servicios');


  // ==========================================
  // SOLICITUDES DE PERMISOS
  // ==========================================

  const {

    solicitudesPendientes,

    obtenerSolicitud,

    cargandoSolicitud,

    solicitarAcceso,

    responderSolicitud

  } = useSolicitudes(usuario);


  const rol =
    (usuario?.rol || '')
      .trim()
      .toLowerCase();


  const esAdminSecretaria =
    ['admin', 'secretaria']
      .includes(rol);


  // ==========================================
  // CAMBIAR TABLA
  // ==========================================

  const cambiarPestaña = (
    nuevaPestaña
  ) => {

    setTab(nuevaPestaña);

  };


  // ==========================================
  // DATOS FIRESTORE
  // ==========================================

  const {
    datos: serviciosTodos,
    cargando: cargandoServicios
  } = useColeccion('servicios');
  const servicios = serviciosTodos.filter(s => (s.estado || '') !== 'suspendido' && (s.estado || '') !== 'eliminado');


  const {
    datos: presupuestos,
    cargando: cargandoPresupuestos
  } = useColeccion('presupuestos');


  const {
    datos: contratosTodos,
    cargando: cargandoContratos
  } = useColeccion('contratos');
  const contratos = contratosTodos.filter(c => (c.estado || '') !== 'Suspendido');


  const datosMostrados =
    tab === 'servicios'
      ? servicios
      : tab === 'presupuestos'
        ? presupuestos
        : contratos;


  const cargando =
    tab === 'servicios'
      ? cargandoServicios
      : tab === 'presupuestos'
        ? cargandoPresupuestos
        : cargandoContratos;


  // ==========================================
  // LOGOUT
  // ==========================================

  const handleLogout = async () => {

    await signOut(auth);

    onLogout();

  };


  // ==========================================
  // MÉTRICAS
  // ==========================================

  const completosCount =
    servicios.filter(
      s =>
        (s.estado || '')
          .toLowerCase() === 'completo'
    ).length;


  const pendienteCount =
    servicios.filter(
      s =>
        (s.estado || '')
          .toLowerCase() === 'pendiente'
    ).length;


  const enRutaCount =
    servicios.filter(
      s =>
        ['en ruta', 'enruta']
          .includes(
            (s.estado || '')
              .toLowerCase()
          )
    ).length;


  const pieData = {

    labels: [
      'Completo',
      'Pendiente',
      'En ruta'
    ],

    datasets: [

      {
        data: [
          completosCount,
          pendienteCount,
          enRutaCount
        ],

        backgroundColor: [
          '#4CAF50',
          '#FFC107',
          '#2196F3'
        ],

        borderWidth: 0
      }

    ]

  };


  const meses = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic'
  ];


  const porMes =
    Array(12).fill(0);


  presupuestos.forEach(p => {

    if (p.fecha) {

      const partes =
        p.fecha.split('/');

      if (partes.length === 3) {

        const mes =
          parseInt(partes[1]) - 1;

        if (
          mes >= 0 &&
          mes < 12
        ) {

          porMes[mes]++;

        }

      }

    }

  });


  const barData = {

    labels: meses,

    datasets: [

      {
        label: 'Presupuestos',

        data: porMes,

        backgroundColor: '#F5C400',

        borderRadius: 6
      }

    ]

  };


  // ==========================================
  // TABLAS
  // ==========================================

  const columnas = {

    servicios: [
      'Cliente',
      'Origen → Destino',
      'Responsable',
      'Salida',
      'Estado'
    ],

    presupuestos: [
      'Nro',
      'Cliente',
      'Origen → Destino',
      'Salida',
      'Costo Total'
    ],

    contratos: [
      'Nro Presupuesto',
      'Cliente',
      'Destino',
      'Fecha Contrato',
      'Estado'
    ]

  };


  const fila = (row) => {

    if (tab === 'servicios') {

      return [

        row.contacto || '-',

        row.domicilioOrigen &&
        row.domicilioDestino
          ? `${row.domicilioOrigen} → ${row.domicilioDestino}`
          : '-',

        row.responsable || '-',

        `${row.salidaFecha || '-'} ${row.salidaHora || ''}`,

        badge(row.estado)

      ];

    }


    if (tab === 'presupuestos') {

      return [

        row.nroPresupuesto || '-',

        row.cliente || '-',

        row.origen &&
        row.destino
          ? `${row.origen} → ${row.destino}`
          : '-',

        `${row.salidaFecha || '-'} ${row.salidaHora || ''}`,

        row.costoTotal
          ? `$${row.costoTotal}`
          : '-'

      ];

    }


    if (tab === 'contratos') {

      return [

        row.nroPresupuesto || '-',

        row.cliente || '-',

        row.destino || '-',

        row.fechaContrato || '-',

        badge(row.estado)

      ];

    }

  };


  // ==========================================
  // CONTENIDO PRINCIPAL
  // ==========================================

  const renderContenido = () => {


    // ==========================================
    // CONFIGURACIÓN
    // ==========================================

    if (seccion === 'configuracion') {

      return (

        <div
          style={{
            padding: 32,
            maxWidth: 800,
            margin: '0 auto'
          }}
        >

          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#1A1A1A',
              marginBottom: 8
            }}
          >
            Configuración del Sistema
          </div>


          <p
            style={{
              fontSize: 13,
              color: '#666',
              marginBottom: 24
            }}
          >
            Administra tu sesión y las opciones
            de soporte de la plataforma.
          </p>


          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}
          >

            <div
              style={{
                background: '#fff',
                padding: 20,
                borderRadius: 10,
                border: '0.5px solid #E0E0E0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >

              <div>

                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#1A1A1A'
                  }}
                >
                  Contactar a Soporte
                </div>


                <div
                  style={{
                    fontSize: 12,
                    color: '#888',
                    marginTop: 2
                  }}
                >
                  Envia un correo directo al equipo técnico
                  (startupdefux@gmail.com)
                </div>

              </div>


              <a
                href="mailto:startupdefux@gmail.com?subject=Soporte%20Sistema%20Nuevo%20Destino"

                style={{
                  background: '#1A1A1A',
                  color: '#F5C400',
                  padding: '10px 18px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >

                <i
                  className="ti ti-mail"
                  style={{
                    fontSize: 16
                  }}
                />

                Enviar correo

              </a>

            </div>


            <div
              style={{
                background: '#fff',
                padding: 20,
                borderRadius: 10,
                border: '0.5px solid #E0E0E0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >

              <div>

                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#1A1A1A'
                  }}
                >
                  Cerrar Sesión
                </div>


                <div
                  style={{
                    fontSize: 12,
                    color: '#888',
                    marginTop: 2
                  }}
                >
                  Finaliza tu sesión actual en este dispositivo
                </div>

              </div>


              <button

                onClick={handleLogout}

                style={{
                  background: '#FFEBEE',
                  color: '#C62828',
                  border: '1px solid #FFCDD2',
                  padding: '10px 18px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >

                <i
                  className="ti ti-logout"
                  style={{
                    fontSize: 16
                  }}
                />

                Cerrar Sesión

              </button>

            </div>

          </div>

        </div>

      );

    }


    // ==========================================
    // PERMISOS DE SECCIONES
    // ==========================================

    const seccionesConPermiso = [
      'servicios',
      'presupuestos',
      'contratos',
      'logistica'
    ];


    if (
      seccionesConPermiso.includes(seccion)
    ) {


      const solicitudSeccion =
        obtenerSolicitud(
          seccion,
          'seccion'
        );


      const permisoSeccionAprobado =
        esAdminSecretaria ||
        (seccion === 'logistica' && rol === 'logistica') ||
        solicitudSeccion?.estado === 'aprobada';


      // ==========================================
      // ACCESO BLOQUEADO
      // ==========================================

      if (!permisoSeccionAprobado) {

        return (

          <div
            style={{
              padding: 40,
              textAlign: 'center',
              marginTop: 40
            }}
          >

            <div
              style={{
                fontSize: 40,
                marginBottom: 12
              }}
            >
              🔒
            </div>


            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#1A1A1A'
              }}
            >
              Acceso Restringido
            </div>


            <p
              style={{
                fontSize: 13,
                color: '#666',
                margin: '8px 0 24px'
              }}
            >
              Tu usuario requiere autorización para ingresar
              a la sección completa de{' '}

              <b
                style={{
                  textTransform: 'capitalize'
                }}
              >
                {seccion}
              </b>

              .
            </p>


            {solicitudSeccion?.estado === 'pendiente' ? (

              <div
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  background: '#FFF8E1',
                  color: '#F57F17',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  border: '1px solid #FFE082'
                }}
              >
                ⏳ Solicitud enviada. Esperando aprobación
                del administrador...
              </div>

            ) : (

              <button

                onClick={() =>
                  solicitarAcceso(
                    seccion,
                    'seccion'
                  )
                }

                disabled={cargandoSolicitud}

                style={{
                  background: '#1A1A1A',
                  color: '#F5C400',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 13,

                  cursor: cargandoSolicitud
                    ? 'wait'
                    : 'pointer',

                  opacity: cargandoSolicitud
                    ? 0.7
                    : 1
                }}
              >

                {cargandoSolicitud
                  ? 'Enviando solicitud...'
                  : 'Solicitar acceso al Administrador'}

              </button>

            )}

          </div>

        );

      }
      


      // ==========================================
      // PRESUPUESTOS
      // ==========================================

      if (seccion === 'presupuestos') {

        return <Presupuestos />;

      }

      // ==========================================
      // CONTRATOS
      // ==========================================

      if (seccion === 'contratos') {

        return <Contratos rol={rol} />;

      }

      // ==========================================
      // SERVICIOS
      // ==========================================

      if (seccion === 'servicios') {

        return <Servicios rol={rol} />;

      }

      if (seccion === 'logistica') {

        return <Logistica />;

      }

    }

    // ==========================================
    // AGENDA
    // ==========================================

    if (seccion === 'agenda') {

      return <Agenda />;

    }
     // ==========================================
    // AGENDA
    // ==========================================

    if (seccion === 'usuarios' && rol === 'admin') return <Usuarios />;


    // ==========================================
    // Chat
    // ==========================================

   if (seccion === 'chat') {
      return <ChatGeneral />;
    }
    // ==========================================
    // PERMISOS DE TABLAS
    // ==========================================

    const solicitudTabla =
      obtenerSolicitud(
        tab,
        'tabla'
      );


    const tienePermisoTabla =
      solicitudTabla?.estado === 'aprobada';


    const permisoTablaAprobado =
      esAdminSecretaria ||
      tab === 'servicios' ||
      tienePermisoTabla;


    return (

      <div
        style={{
          padding: 24,
          maxWidth: 1400,
          margin: '0 auto'
        }}
      >


        {/* ======================================
            NOTIFICACIONES DEL ADMIN
        ====================================== */}

        {rol === 'admin' &&
          solicitudesPendientes.length > 0 && (

            <div
              style={{
                background: '#FFF3CD',
                border: '1px solid #FFEBAA',
                padding: '12px 16px',
                borderRadius: 8,
                marginBottom: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >

              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: '#856404'
                }}
              >
                🔔 Solicitudes de acceso pendientes:
              </div>


              {solicitudesPendientes.map(sol => (

                <div

                  key={sol.id}

                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#fff',
                    padding: '8px 12px',
                    borderRadius: 6
                  }}
                >

                  <span
                    style={{
                      fontSize: 12,
                      color: '#333'
                    }}
                  >

                    <b>
                      {sol.nombreUsuario || sol.email}
                    </b>

                    {' '}solicita acceso a{' '}

                    <b>

                      {sol.tipoAcceso === 'tabla'
                        ? `la tabla de ${sol.seccionSolicitada}`
                        : `la sección completa de ${sol.seccionSolicitada}`}

                    </b>

                  </span>


                  <div
                    style={{
                      display: 'flex',
                      gap: 8
                    }}
                  >

                    <button

                      onClick={() =>
                        responderSolicitud(
                          sol.id,
                          'aprobada'
                        )
                      }

                      style={{
                        background: '#2E7D32',
                        color: '#fff',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 600
                      }}
                    >
                      Aprobar
                    </button>


                    <button

                      onClick={() =>
                        responderSolicitud(
                          sol.id,
                          'rechazada'
                        )
                      }

                      style={{
                        background: '#C62828',
                        color: '#fff',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 600
                      }}
                    >
                      Rechazar
                    </button>

                  </div>

                </div>

              ))}

            </div>

          )}


        {/* ======================================
            BIENVENIDA
        ====================================== */}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24
          }}
        >

          <div>

            <div
              style={{
                fontSize: 13,
                color: '#888'
              }}
            >
              Bienvenido de vuelta,
            </div>


            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#1A1A1A'
              }}
            >

              {usuario?.nombre || 'Usuario'}

              <span
                style={{
                  color: '#F5C400'
                }}
              >
                {' '}👋
              </span>

            </div>

          </div>


          <RelojInfo />

        </div>


        {/* ======================================
            MÉTRICAS
        ====================================== */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 20
          }}
        >

          {[
            {
              val: servicios.length,
              label: 'Servicios',
              sub: 'total'
            },

            {
              val: presupuestos.length,
              label: 'Presupuestos',
              sub: 'total'
            },

            {
              val: contratos.length,
              label: 'Contratos',
              sub: 'total'
            },

            {
              val: enRutaCount,
              label: 'En ruta',
              sub: 'ahora'
            }

          ].map((m, i) => (

            <div

              key={i}

              style={{
                background: '#fff',
                borderRadius: 10,
                border:
                  '0.5px solid #E0E0E0',
                padding: 16
              }}
            >

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: '#1A1A1A'
                }}
              >
                {m.val}
              </div>


              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#555'
                }}
              >
                {m.label}
              </div>


              <div
                style={{
                  fontSize: 10,
                  color: '#888'
                }}
              >
                {m.sub}
              </div>

            </div>

          ))}

        </div>


        {/* ======================================
            GRÁFICOS
        ====================================== */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              '1fr 2fr',
            gap: 16,
            marginBottom: 20
          }}
        >

          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              border:
                '0.5px solid #E0E0E0',
              padding: 20
            }}
          >

            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: 16
              }}
            >
              Servicios por estado
            </div>


            <div
              style={{
                height: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >

              <Pie
                data={pieData}

                options={{
                  plugins: {
                    legend: {
                      position: 'bottom'
                    }
                  },

                  maintainAspectRatio: false
                }}
              />

            </div>

          </div>


          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              border:
                '0.5px solid #E0E0E0',
              padding: 20
            }}
          >

            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#1A1A1A',
                marginBottom: 16
              }}
            >
              Presupuestos por mes
            </div>


            <div
              style={{
                height: 200
              }}
            >

              <Bar

                data={barData}

                options={{

                  plugins: {
                    legend: {
                      display: false
                    }
                  },

                  maintainAspectRatio: false,

                  scales: {
                    y: {
                      beginAtZero: true,

                      ticks: {
                        stepSize: 1
                      }
                    }
                  }

                }}

              />

            </div>

          </div>

        </div>


        {/* ======================================
            TABLA GENERAL
        ====================================== */}

        <div
          style={{
            background: '#fff',
            borderRadius: 10,
            border:
              '0.5px solid #E0E0E0',
            overflow: 'hidden'
          }}
        >

          <div
            style={{
              padding: '14px 20px',
              borderBottom:
                '0.5px solid #E0E0E0',
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                'space-between'
            }}
          >

            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#1A1A1A'
              }}
            >
              Traslado
            </div>


            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center'
              }}
            >

              <div
                style={{
                  display: 'flex',
                  gap: 4
                }}
              >

                {[
                  'servicios',
                  'presupuestos',
                  'contratos'
                ].map(t => (

                  <div

                    key={t}

                    onClick={() =>
                      cambiarPestaña(t)
                    }

                    style={{
                      padding: '5px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 6,
                      cursor: 'pointer',

                      background:
                        tab === t
                          ? '#1A1A1A'
                          : 'transparent',

                      color:
                        tab === t
                          ? '#F5C400'
                          : '#888'
                    }}
                  >

                    {t.charAt(0).toUpperCase() +
                      t.slice(1)}

                  </div>

                ))}

              </div>


              <button

                onClick={() =>
                  setSeccion(tab)
                }

                style={{
                  padding: '6px 14px',
                  background: '#F5C400',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#1A1A1A',
                  cursor: 'pointer'
                }}
              >
                + Nuevo
              </button>

            </div>

          </div>


          {!permisoTablaAprobado ? (

            <div
              style={{
                padding: 40,
                textAlign: 'center'
              }}
            >

              <div
                style={{
                  fontSize: 32,
                  marginBottom: 10
                }}
              >
                🔒
              </div>


              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#1A1A1A'
                }}
              >
                Acceso Restringido a la Tabla
              </div>


              <p
                style={{
                  fontSize: 12,
                  color: '#666',
                  margin: '8px 0 20px'
                }}
              >
                Tu usuario requiere autorización para
                ver la lista de{' '}

                <b>
                  {tab}
                </b>

                .
              </p>


              {solicitudTabla?.estado === 'pendiente' ? (

                <div
                  style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    background: '#FFF8E1',
                    color: '#F57F17',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  ⏳ Solicitud enviada para la tabla.
                  Esperando aprobación...
                </div>

              ) : (

                <button

                  onClick={() =>
                    solicitarAcceso(
                      tab,
                      'tabla'
                    )
                  }

                  disabled={cargandoSolicitud}

                  style={{
                    background: '#1A1A1A',
                    color: '#F5C400',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 6,
                    fontWeight: 700,
                    fontSize: 12,

                    cursor: cargandoSolicitud
                      ? 'wait'
                      : 'pointer',

                    opacity: cargandoSolicitud
                      ? 0.7
                      : 1
                  }}
                >

                  {cargandoSolicitud
                    ? 'Enviando solicitud...'
                    : 'Solicitar acceso a la tabla'}

                </button>

              )}

            </div>

          ) : (

            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13
              }}
            >

              <thead>

                <tr>

                  {columnas[tab].map(h => (

                    <th

                      key={h}

                      style={{
                        padding: '10px 20px',
                        textAlign: 'left',
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#888',
                        textTransform:
                          'uppercase',
                        letterSpacing: 0.5,
                        borderBottom:
                          '0.5px solid #F0F0F0'
                      }}
                    >
                      {h}
                    </th>

                  ))}

                </tr>

              </thead>


              <tbody>

                {cargando ? (

                  <tr>

                    <td
                      colSpan={5}

                      style={{
                        padding: 20,
                        textAlign: 'center',
                        color: '#888'
                      }}
                    >
                      Cargando...
                    </td>

                  </tr>

                ) : datosMostrados.length === 0 ? (

                  <tr>

                    <td
                      colSpan={5}

                      style={{
                        padding: 20,
                        textAlign: 'center',
                        color: '#888'
                      }}
                    >
                      No hay registros
                    </td>

                  </tr>

                ) : (

                  datosMostrados.map(row => (

                    <tr

                      key={row.id}

                      style={{
                        cursor: 'pointer'
                      }}

                      onMouseEnter={e =>
                        e.currentTarget.style.background =
                          '#FAFAFA'
                      }

                      onMouseLeave={e =>
                        e.currentTarget.style.background =
                          'transparent'
                      }
                    >

                      {fila(row).map(
                        (celda, ci) => (

                          <td

                            key={ci}

                            style={{
                              padding:
                                '12px 20px',

                              borderBottom:
                                '0.5px solid #F8F8F8',

                              color: '#333'
                            }}
                          >
                            {celda}
                          </td>

                        )
                      )}

                    </tr>

                  ))

                )}

              </tbody>

            </table>

          )}

        </div>

      </div>

    );

  };


  return (

    <div
      style={{
        display: 'flex',
        height: '100vh',
        fontFamily: 'sans-serif'
      }}
    >



      {/* ======================================
          SIDEBAR
      ====================================== */}

      <div
        style={{
          width: sidebarVisible ? 220 : 0,
          background: '#1A1A1A',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.18s ease',
        }}
      >

        <div style={{ width: 220 }}>

        <div
          style={{
            padding: '24px 20px 20px',
            borderBottom:
              '0.5px solid #2a2a2a'
          }}
        >

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}
          >

            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#F5C400',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0
              }}
            >
              <img src={LOGO_ND} alt="ND" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>


            <div
              style={{
                fontSize: 13,
                fontWeight: 700
              }}
            >

              <span
                style={{
                  color: '#fff'
                }}
              >
                NUEVO{' '}
              </span>


              <span
                style={{
                  color: '#F5C400'
                }}
              >
                DESTINO
              </span>

            </div>

          </div>

        </div>


        <div
          style={{
            flex: 1,
            padding: '12px 0',
            overflowY: 'auto'
          }}
        >

          {NAV.map((item, i) => {

            if (item.section) {

              return (

                <div

                  key={i}

                  style={{
                    padding:
                      '8px 20px 4px',

                    fontSize: 10,

                    color: '#444',

                    textTransform:
                      'uppercase',

                    letterSpacing: 1
                  }}
                >
                  {item.section}
                </div>

              );

            }

            // Solo admin puede ver "Usuarios" en el menú
            if (item.id === 'usuarios' && rol !== 'admin') {
              return null;
            }


            const activo =
              seccion === item.id;


            return (

              <div

                key={item.id}

                onClick={() =>
                  setSeccion(item.id)
                }

                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 20px',
                  fontSize: 13,

                  color:
                    activo
                      ? '#1A1A1A'
                      : '#888',

                  fontWeight:
                    activo
                      ? 600
                      : 400,

                  background:
                    activo
                      ? '#F5C400'
                      : 'transparent',

                  cursor: 'pointer'
                }}
              >

                <i
                  className={`ti ${item.icon}`}
                  style={{
                    fontSize: 16
                  }}
                  aria-hidden="true"
                />

                {item.label}

              </div>

            );

          })}

        </div>


        <div
          style={{
            padding: '16px 20px',
            borderTop:
              '0.5px solid #2a2a2a',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}
        >

          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#F5C400',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#1A1A1A',
              flexShrink: 0
            }}
          >
            {iniciales(usuario?.nombre)}
          </div>


          <div
            style={{
              flex: 1
            }}
          >

            <div
              style={{
                fontSize: 12,
                color: '#ccc',
                fontWeight: 500
              }}
            >
              {usuario?.nombre || 'Usuario'}
            </div>


            <div
              style={{
                fontSize: 10,
                color: '#555'
              }}
            >
              {usuario?.rol || ''}
            </div>

          </div>


          <div

            onClick={handleLogout}

            title="Cerrar sesión"

            style={{
              cursor: 'pointer',
              color: '#555',
              fontSize: 16
            }}
          >

            <i
              className="ti ti-logout"
              aria-hidden="true"
            />

          </div>

        </div>

        </div>

      </div>

      {/* Flechita para esconder/mostrar la sidebar */}
      <div
        onClick={() => setSidebarVisible((v) => !v)}
        title={sidebarVisible ? 'Ocultar menú' : 'Mostrar menú'}
        style={{
          position: 'fixed',
          top: '50%',
          left: sidebarVisible ? 220 : 0,
          transform: 'translate(-50%, -50%)',
          width: 22,
          height: 40,
          background: '#1A1A1A',
          borderRadius: '0 6px 6px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 50,
          transition: 'left 0.18s ease',
        }}
      >
        <span style={{ color: '#F5C400', fontSize: 12 }}>
          {sidebarVisible ? '‹' : '›'}
        </span>
      </div>


      {/* ======================================
          MAIN
      ====================================== */}

      <div
        style={{
          flex: 1,
          background: '#F2F2F2',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >

        <div
          style={{
            background: '#fff',
            borderBottom:
              '0.5px solid #E0E0E0',
            padding: '0 24px',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >

          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#1A1A1A'
            }}
          >

            {NAV.find(
              n => n.id === seccion
            )?.label || 'Dashboard'}

            <span
              style={{
                color: '#F5C400'
              }}
            >
              {' '}General
            </span>

          </div>


          <div
            style={{
              fontSize: 11,
              background: '#1A1A1A',
              color: '#F5C400',
              padding: '4px 10px',
              borderRadius: 20
            }}
          >
            Traslado activo
          </div>

        </div>


        <div
          style={{
            flex: 1,
            overflowY: 'auto'
          }}
        >

          {renderContenido()}

        </div>

      </div>

    </div>

  );

}