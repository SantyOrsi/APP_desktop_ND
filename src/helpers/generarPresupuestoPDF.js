import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { HOJA_PRESUPUESTO_FONDO } from '../constants/pdfAssets';

// Tamaño de página igual al resto (612 x 862 pt), coincide con la
// proporción real de la hoja de fondo (843 x 1187 px).
const PAGE_W = 612;
const PAGE_H = 862;
const NEGRO = rgb(0.1, 0.1, 0.1);
const FONT_SIZE = 12; // un poco más grande que antes (era 10)

const valorODefault = (valor, porDefecto = '') => (valor && String(valor).trim() !== '' ? valor : porDefecto);
const monto = (valor) => (valor && Number(valor) > 0 ? `$${Number(valor).toLocaleString('es-AR')}` : '');

// pdf-lib mide "y" desde ABAJO. Restamos un 80% de la fuente (no el 100%)
// para que la letra no quede pegada más abajo de la línea al agrandarla.
// Empuje vertical global: todo el texto sube este % de página.
// Si hace falta afinar más, subir/bajar este único número alcanza.
const AJUSTE_ARRIBA = 0.6;

const vhvw = (topVh, leftVw) => ({
  x: (leftVw / 100) * PAGE_W,
  y: PAGE_H - ((topVh - AJUSTE_ARRIBA) / 100) * PAGE_H - FONT_SIZE * 0.8,
});

export const generarPresupuestoPDF = async (form) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontDet = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // ── Fondo ──
  const base64 = HOJA_PRESUPUESTO_FONDO.split(',')[1];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const fondoImg = await pdfDoc.embedPng(bytes);
  page.drawImage(fondoImg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  const escribir = (topVh, leftVw, valor, fontSize = FONT_SIZE) => {
    const texto = valorODefault(valor);
    if (!texto) return;
    const { x, y } = vhvw(topVh, leftVw);
    page.drawText(String(texto), { x, y: y + (FONT_SIZE - fontSize) * 0.8, size: fontSize, font, color: NEGRO });
  };

  // Fila de la tabla: Sí/No pegado al nombre del campo (antes de la línea
  // vertical). Del otro lado de la línea va el detalle en texto (Movimiento/
  // Adicionales) o el monto en $ (Aloj. y Viát., que sí es un número real).
  const filaTabla = (topVh, leftVwSiNo, leftVwDerecha, esSi, valorDerecha, esMonto = false) => {
    escribir(topVh, leftVwSiNo, esSi ? 'Si' : 'No');
    if (esSi && valorDerecha) escribir(topVh, leftVwDerecha, esMonto ? monto(valorDerecha) : valorDerecha, esMonto ? FONT_SIZE : 9);
  };

  // ── Encabezado ──
  escribir(19.33, 58.00, form.nroPresupuesto);

  // ── Datos generales ──
  escribir(24.70, 19.13, form.cliente);
  escribir(27.07, 17.66, form.fecha);
  escribir(29.90, 20.30, form.vigencia);

  // ── Servicio de traslado ──
  escribir(36.69, 18.75, form.origen);
  escribir(39.13, 19.83, form.destino);
  escribir(41.83, 29.62, form.salidaFecha);
  escribir(44.23, 28.15, valorODefault(form.salidaHora, 'A confirmar'));
  escribir(46.88, 31.87, form.retornoFecha);
  escribir(49.80, 29.70, valorODefault(form.retornoHora, 'A confirmar'));
  escribir(52.42, 22.98, form.capacidad);

  // ── Tabla: Movimientos / Adicionales / Aloj. y viáticos choferes / Costo Total / Costo con IVA ──
  filaTabla(54.78, 27.17, 66.68, form.movimiento === 'SI', form.movimientoDetalle);
  filaTabla(57.52, 24.73, 66.99, form.adicionales === 'SI', form.adicionalesDetalle);
  filaTabla(59.90, 38.68, 67.9, !!form.alojViaticosCargo || Number(form.importAlojViaticos) > 0, form.importAlojViaticos, true);

  escribir(63.12, 67.9, monto(form.costoTotal) || '$0');
  escribir(65.87, 67.9, monto(form.costoIva) || '$0');

  // ── Detalle de movimientos (cuadro grande, con salto de línea) ──
  const detalleTexto = form.movimiento === 'SI'
    ? valorODefault(form.movimientoDetalle, '-')
    : '-';
  const { x: xDet, y: yDetTop } = vhvw(72.0, 11.4);
  const anchoMax = (91.9 - 8.5) / 100 * PAGE_W;
  const palabras = String(detalleTexto).split(' ');
  let linea = '';
  let renglon = 0;
  palabras.forEach((palabra, i) => {
    const prueba = linea ? `${linea} ${palabra}` : palabra;
    if (fontDet.widthOfTextAtSize(prueba, 10) > anchoMax) {
      page.drawText(linea, { x: xDet, y: yDetTop - renglon * 14, size: 10, font: fontDet, color: NEGRO });
      linea = palabra;
      renglon += 1;
    } else {
      linea = prueba;
    }
    if (i === palabras.length - 1 && linea) {
      page.drawText(linea, { x: xDet, y: yDetTop - renglon * 14, size: 10, font: fontDet, color: NEGRO });
    }
  });

  return await pdfDoc.save();
};
