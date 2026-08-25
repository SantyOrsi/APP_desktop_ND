// Flota de unidades (misma que usa la app del celu)
export const FLOTA = [
  { id: '2', nombre: 'Auto',                   capacidad: 3,  capacidadTexto: 'Hasta 3 pasajeros' },
  { id: '3', nombre: 'Van Ejecutiva',          capacidad: 7,  capacidadTexto: '7 pasajeros' },
  { id: '4', nombre: 'Minibús 15 pax',         capacidad: 15, capacidadTexto: '15 pasajeros' },
  { id: '5', nombre: 'Minibús 19 pax',         capacidad: 19, capacidadTexto: '19 pasajeros' },
  { id: '6', nombre: 'Minibús 23 pax',         capacidad: 23, capacidadTexto: '23 pasajeros' },
  { id: '7', nombre: 'Bus urbano/interurbano', capacidad: 50, capacidadTexto: 'De 41 a 50 pasajeros' },
  { id: '8', nombre: 'Comil',                  capacidad: 47, capacidadTexto: '47 pasajeros' },
  { id: '9', nombre: 'Doble piso',             capacidad: 60, capacidadTexto: '60 pasajeros' },
];

export const recomendarUnidad = (pasajeros) => {
  const n = Number(String(pasajeros ?? '').replace(/[^\d]/g, ''));
  if (!n || n <= 0) return null;
  if (n <= 3)  return FLOTA[0];
  if (n <= 7)  return FLOTA[1];
  if (n <= 15) return FLOTA[2];
  if (n <= 19) return FLOTA[3];
  if (n <= 23) return FLOTA[4];
  if (n <= 47) return FLOTA[6];
  if (n <= 50) return FLOTA[5];
  if (n <= 60) return FLOTA[7];
  return null;
};
