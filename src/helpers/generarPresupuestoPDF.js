import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { HOJA_PRESUPUESTO_FONDO } from '../constants/pdfAssets';

// Tamaño de página igual al que usa la app del celu (612 x 862 pt)
const PAGE_W = 612;
const PAGE_H = 862;
const NEGRO = rgb(0.1, 0.1, 0.1);
const FONT_SIZE = 10;

const valorODefault = (valor, porDefecto = '') => (valor && String(valor).trim() !== '' ? valor : porDefecto);
const monto = (valor) => (valor && Number(valor) > 0 ? `$${Number(valor).toLocaleString('es-AR')}` : '');

// Convierte una posición en vh/vw (como en la app del celu) a puntos de PDF.
// pdf-lib mide "y" desde ABAJO, así que hay que invertir el eje.
const vhvw = (topVh, leftVw) => ({
  x: (leftVw / 100) * PAGE_W,
  y: PAGE_H - (topVh / 100) * PAGE_H - FONT_SIZE, // baseline aprox. a la altura del div
});

export const generarPresupuestoPDF = async (form) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ── Fondo (misma hoja diseñada que en el celu) ──
  const base64 = HOJA_PRESUPUESTO_FONDO.split(',')[1];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const fondoImg = await pdfDoc.embedPng(bytes);
  page.drawImage(fondoImg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  const escribir = (topVh, leftVw, valor) => {
    const texto = valorODefault(valor);
    if (!texto) return;
    const { x, y } = vhvw(topVh, leftVw);
    page.drawText(String(texto), { x, y, size: FONT_SIZE, font, color: NEGRO });
  };

  // ── Línea divisoria ──
  const lx = (64.6 / 100) * PAGE_W;
  const lyTop = PAGE_H - (22.83 / 100) * PAGE_H;
  const lyBottom = lyTop - (45.24 / 100) * PAGE_H;
  page.drawLine({ start: { x: lx, y: lyTop }, end: { x: lx, y: lyBottom }, thickness: 1, color: NEGRO });

  // ── Datos generales ──
  escribir(18.79, 70.20, form.nroPresupuesto);
  escribir(24.18, 17.79, form.cliente);
  escribir(26.70, 16.25, form.fecha);
  escribir(29.57, 19.45, form.vigencia);
  escribir(36.14, 17.44, form.origen);
  escribir(38.75, 18.62, form.destino);

  // ── Salida / Retorno ──
  escribir(41.36, 27.88, form.salidaFecha);
  escribir(43.98, 26.81, valorODefault(form.salidaHora, 'A confirmar'));
  escribir(46.50, 29.90, form.retornoFecha);
  escribir(49.20, 28.83, valorODefault(form.retornoHora, 'A confirmar'));
  escribir(51.72, 21.83, form.capacidad);

  // ── Movimientos / Adicionales / Aloj. y Viát. (texto izq. + monto der. de la línea) ──
  escribir(54.34, 25.15, valorODefault(form.movimiento, 'No'));
  escribir(54.34, 65.60, monto(form.cantMov));

  escribir(56.95, 23.25, valorODefault(form.adicionales, 'No'));
  escribir(56.95, 65.60, monto(form.cantAdi));

  escribir(59.56, 37.25, form.alojViaticosCargo);
  escribir(59.56, 65.60, monto(form.importAlojViaticos));

  // ── Costos ──
  escribir(62.76, 65.60, valorODefault(form.costoTotal, '0'));
  escribir(65.71, 65.60, valorODefault(form.costoIva, '0'));

  return await pdfDoc.save();
};
