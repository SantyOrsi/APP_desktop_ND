import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { TRAFICO_FONDO } from '../constants/pdfAssets';

// Tamaño de página igual al resto (612 x 862 pt), coincide con la
// proporción real de la hoja de fondo (843 x 1187 px).
const PAGE_W = 612;
const PAGE_H = 862;
const NEGRO = rgb(0.1, 0.1, 0.1);
const FONT_SIZE = 12; // un poco más grande que antes (era 10)

const valorODefault = (valor, porDefecto = '') => (valor && String(valor).trim() !== '' ? valor : porDefecto);

// pdf-lib mide "y" desde ABAJO. Restamos un 80% de la fuente (no el 100%)
// para que la letra no quede pegada más abajo de la línea al agrandarla.
const vhvw = (topVh, leftVw) => ({
  x: (leftVw / 100) * PAGE_W,
  y: PAGE_H - (topVh / 100) * PAGE_H - FONT_SIZE * 0.8,
});

// Junta un array (o string suelto) de nombres/unidades en un solo texto
const unirLista = (valor) => {
  if (Array.isArray(valor)) return valor.filter(Boolean).join(', ');
  return valor || '';
};

export const generarTraficoPDF = async (servicio, presupuesto) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontDet = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const base64 = TRAFICO_FONDO.split(',')[1];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const fondoImg = await pdfDoc.embedPng(bytes);
  page.drawImage(fondoImg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  const escribir = (topVh, leftVw, valor, fontSize = FONT_SIZE) => {
    const texto = valorODefault(valor);
    if (!texto) return;
    const { x, y } = vhvw(topVh, leftVw);
    page.drawText(String(texto), { x, y: y + (FONT_SIZE - fontSize) * 0.8, size: fontSize, font, color: NEGRO });
  };

  // ── Encabezado (punto medio entre la calibración anterior y la última) ──
  escribir(18.95, 57.53, servicio?.nropresupuesto);

  // ── Contacto ──
  escribir(24.08, 21.95, servicio?.contacto);
  escribir(26.61, 24.32, servicio?.telefono);
  escribir(29.05, 24.91, servicio?.responsable);
  escribir(31.58, 29.06, servicio?.telefonoResponsable);

  // ── Servicio de traslado ──
  escribir(37.48, 16.50, presupuesto ? valorODefault(presupuesto.kmRecorrer, '0') : '0');
  escribir(40.17, 18.98, presupuesto?.origen);
  escribir(42.70, 19.93, presupuesto?.destino);
  escribir(45.32, 30.01, servicio?.domicilioOrigen);
  escribir(47.93, 30.61, servicio?.domicilioDestino);

  // Fecha/hora: el día pegado a la etiqueta, la hora más a la derecha
  escribir(50.54, 35.94, servicio?.salidaFecha);
  escribir(50.54, 65.00, servicio?.salidaHora);
  escribir(53.15, 37.60, servicio?.retornoFecha);
  escribir(53.15, 65.00, servicio?.retornoHora);

  // Capacidad + Tipo de transporte juntos
  const capacidadTexto = presupuesto?.capacidad
    ? `${presupuesto.capacidad}${presupuesto.tipoTransporte ? ` (${presupuesto.tipoTransporte})` : ''}`
    : (presupuesto?.tipoTransporte || '');
  escribir(55.76, 22.54, capacidadTexto);

  escribir(58.29, 21.35, unirLista(servicio?.unidad) || 'Sin asignar');
  escribir(60.90, 19.93, unirLista(servicio?.chofer) || 'Sin asignar');
  escribir(63.51, 24.91, valorODefault(servicio?.dineroViaje, '0'));

  // ── Info adicional (cuadro grande, con salto de línea) ──
  const infoTexto = presupuesto?.infoAdicional === 'SI'
    ? valorODefault(presupuesto.infoAdicionalDetalle, '-')
    : 'No';
  const { x: xInfo, y: yInfoTop } = vhvw(69.9, 8.3);
  const anchoMax = (92.5 - 8.3) / 100 * PAGE_W;
  const palabras = String(infoTexto).split(' ');
  let linea = '';
  let renglon = 0;
  palabras.forEach((palabra, i) => {
    const prueba = linea ? `${linea} ${palabra}` : palabra;
    if (fontDet.widthOfTextAtSize(prueba, 10) > anchoMax) {
      page.drawText(linea, { x: xInfo, y: yInfoTop - renglon * 14, size: 10, font: fontDet, color: NEGRO });
      linea = palabra;
      renglon += 1;
    } else {
      linea = prueba;
    }
    if (i === palabras.length - 1 && linea) {
      page.drawText(linea, { x: xInfo, y: yInfoTop - renglon * 14, size: 10, font: fontDet, color: NEGRO });
    }
  });

  return await pdfDoc.save();
};
