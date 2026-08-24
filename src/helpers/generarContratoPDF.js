import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { CONTRATO_FONDO } from '../constants/pdfAssets';

const PAGE_W = 612;
const PAGE_H = 862;
const NEGRO = rgb(0.1, 0.1, 0.1);

const valorODefault = (valor, porDefecto = '') => (valor && String(valor).trim() !== '' ? valor : porDefecto);

// ── Número a letras (igual que en la app del celu) ──
const UNIDADES = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const DECENAS_10_19 = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const DECENAS_20_90 = ['veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const convertirGrupo = (n) => {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  let letras = '';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c > 0) letras += CENTENAS[c] + ' ';
  if (resto > 0) {
    if (resto < 10) letras += UNIDADES[resto];
    else if (resto < 20) letras += DECENAS_10_19[resto - 10];
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      letras += DECENAS_20_90[d - 2];
      if (u > 0) letras += ' y ' + UNIDADES[u];
    }
  }
  return letras.trim();
};

const numeroALetras = (numero) => {
  let n = Math.round(Number(numero) || 0);
  if (!n) return '';
  if (n < 0) return 'Menos ' + numeroALetras(-n);
  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const resto = n % 1000;
  const partes = [];
  if (millones > 0) partes.push(millones === 1 ? 'un millón' : `${convertirGrupo(millones)} millones`);
  if (miles > 0) partes.push(miles === 1 ? 'mil' : `${convertirGrupo(miles)} mil`);
  if (resto > 0) partes.push(convertirGrupo(resto));
  const texto = partes.join(' ').trim();
  return texto.replace(/\b\w/g, (c) => c.toUpperCase());
};

const parseFecha = (fechaStr) => {
  if (!fechaStr) return { dia: '', mes: '', anio: '' };
  const partes = String(fechaStr).split('/');
  if (partes.length !== 3) return { dia: fechaStr, mes: '', anio: '' };
  const [dd, mm, aaaa] = partes;
  const mesNombre = MESES[parseInt(mm, 10) - 1] || '';
  return { dia: dd.replace(/^0/, ''), mes: mesNombre, anio: aaaa };
};

// vh/vw (como en el celu) -> puntos de PDF, con "y" invertido (pdf-lib mide desde abajo)
const vhvw = (topVh, leftVw, fontSize) => ({
  x: (leftVw / 100) * PAGE_W,
  y: PAGE_H - (topVh / 100) * PAGE_H - fontSize,
});

export const generarContratoPDF = async (presupuesto, contrato) => {
  const fServicio = parseFecha(presupuesto.salidaFecha);
  const fRetorno = parseFecha(presupuesto.retornoFecha);

  const montoViaje = presupuesto.costoIva && Number(presupuesto.costoIva) > 0
    ? presupuesto.costoIva
    : presupuesto.costoTotal;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const base64 = CONTRATO_FONDO.split(',')[1];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const fondoImg = await pdfDoc.embedPng(bytes);
  page.drawImage(fondoImg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  const escribir = (topVh, leftVw, valor, fontSize = 9) => {
    const texto = valorODefault(valor);
    if (!texto) return;
    const { x, y } = vhvw(topVh, leftVw, fontSize);
    page.drawText(String(texto), { x, y, size: fontSize, font, color: NEGRO });
  };

  // Encabezado: a los [dia] Días del mes de [mes] de [año]
  escribir(20.9, 28.3, fServicio.dia);
  escribir(20.9, 45.7, fServicio.mes);
  escribir(20.9, 89.0, fServicio.anio);

  // Sr/a/Empresa
  escribir(25.0, 13.2, contrato.clienteNombre);
  // CUIT/DNI
  escribir(27.1, 15.1, contrato.cuitDni);
  // Domiciliado en la calle
  escribir(29.0, 21.9, contrato.domicilioCliente);
  // de la ciudad de
  escribir(29.0, 76.0, contrato.ciudad);

  // Primera: cantidad de pasajeros
  escribir(37.5, 68.0, presupuesto.capacidad);
  // origen desde la localidad de
  escribir(39.3, 13.3, presupuesto.destino);
  // Con destino a la ciudad de
  escribir(41.4, 23.7, contrato.domicilioDestino);

  // Segundo: A las [hora] horas, del día [dia] De [mes-año]
  escribir(46.1, 8.5, presupuesto.salidaHora);
  escribir(46.1, 36.0, fServicio.dia);
  escribir(46.1, 44.0, fServicio.anio ? `${fServicio.mes} de ${fServicio.anio}` : '');

  // Y con regreso aproximado [hora] horas, del día [dia] De [mes-año]
  escribir(48.0, 23.7, presupuesto.retornoHora);
  escribir(48.0, 54.5, fRetorno.dia);
  escribir(48.0, 61.8, fRetorno.anio ? `${fRetorno.mes} de ${fRetorno.anio}` : '');

  // Quinto: importe del viaje $ [monto] pesos [monto en letras]
  escribir(62.6, 36.3, valorODefault(montoViaje, '0'));
  escribir(62.6, 49.6, numeroALetras(montoViaje));

  // Seña $ [monto] / Pesos [monto en letras]
  escribir(64.6, 58.8, valorODefault(contrato.senia, '0'));
  escribir(66.5, 9.6, numeroALetras(contrato.senia));

  // Saldo $ [monto] / Pesos [monto en letras]
  escribir(68.5, 77.5, valorODefault(contrato.saldo, '0'));
  escribir(70.6, 9.6, numeroALetras(contrato.saldo));

  // Pie: Ref Presupuesto
  escribir(95.2, 50.7, presupuesto.nroPresupuesto, 8);
  // Pie: Nombre / D.N.I-CUIT / Tel del cliente
  escribir(92.0, 74.3, contrato.clienteNombre, 8);
  escribir(93.8, 77.2, contrato.cuitDni, 8);
  escribir(95.9, 71.1, contrato.telefono, 8);

  return await pdfDoc.save();
};
