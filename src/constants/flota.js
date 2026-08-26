// Flota de unidades — categorías generales, cada una con las unidades
// específicas del parque móvil real (cuando corresponde).
export const FLOTA = [
  {
    id: 'auto', nombre: 'Auto', capacidad: 4, capacidadTexto: 'Hasta 4 pasajeros',
    subUnidades: ['C200', 'RANGER', 'COROLLA', 'ONIX'],
  },
  {
    id: 'van', nombre: 'Van Ejecutiva', capacidad: 7, capacidadTexto: '7 pasajeros',
    subUnidades: ['HIACE'],
  },
  {
    id: 'mini15', nombre: 'Minibús 15 pax', capacidad: 15, capacidadTexto: '15 pasajeros',
    // No hay unidades de 15 pax en el parque móvil, queda sin sub-lista.
  },
  {
    id: 'mini17', nombre: 'Minibús 17 pax', capacidad: 17, capacidadTexto: '17 pasajeros',
    subUnidades: ['26'],
  },
  {
    id: 'mini19', nombre: 'Minibús 19 pax', capacidad: 19, capacidadTexto: '19 pasajeros',
    subUnidades: ['12', '19', '20', '23', '29', '30', '31', '32', '33'],
  },
  {
    id: 'mini23', nombre: 'Minibús 23 pax', capacidad: 23, capacidadTexto: '23 pasajeros',
    subUnidades: ['16', '18'], // son de 24 pax en el parque, van agrupadas acá
  },
  {
    id: 'urbano', nombre: 'Bus urbano/interurbano', capacidad: 50, capacidadTexto: 'De 41 a 50 pasajeros',
    subUnidades: ['24', '25', '27', '28', '38'],
  },
  {
    id: 'comil', nombre: 'Comil', capacidad: 47, capacidadTexto: '47 pasajeros',
    // No hay unidad específica "Comil" en el parque móvil, queda sin sub-lista.
  },
  {
    id: 'dobleP', nombre: 'Doble piso', capacidad: 60, capacidadTexto: '60 pasajeros',
    subUnidades: ['3426', '3526', '3626', '3726'], // incluye la de 64 pax
  },
];

export const recomendarUnidad = (pasajeros) => {
  const n = Number(String(pasajeros ?? '').replace(/[^\d]/g, ''));
  if (!n || n <= 0) return null;
  if (n <= 4)  return FLOTA[0]; // Auto
  if (n <= 7)  return FLOTA[1]; // Van Ejecutiva
  if (n <= 15) return FLOTA[2]; // Minibús 15
  if (n <= 17) return FLOTA[3]; // Minibús 17
  if (n <= 19) return FLOTA[4]; // Minibús 19
  if (n <= 23) return FLOTA[5]; // Minibús 23
  if (n <= 47) return FLOTA[7]; // Comil
  if (n <= 50) return FLOTA[6]; // Bus urbano/interurbano
  if (n <= 60) return FLOTA[8]; // Doble piso
  return null;
};
