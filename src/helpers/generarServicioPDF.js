import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { SERVICIO_FONDO } from '../constants/pdfAssets';

const PAGE_W = 612;
const PAGE_H = 862;
const NEGRO = rgb(0.1, 0.1, 0.1);

const valorODefault = (valor, porDefecto = '') => (valor && String(valor).trim() !== '' ? valor : porDefecto);

const vhvw = (topVh, leftVw, fontSize) => ({
  x: (leftVw / 100) * PAGE_W,
  y: PAGE_H - (topVh / 100) * PAGE_H - fontSize,
});

export const generarServicioPDF = async (form, presupuesto = null) => {
  const adicionalesTexto = presupuesto
    ? valorODefault(presupuesto.adicionales, '-')
    : 'No hay adicionales';

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontObs = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const base64 = SERVICIO_FONDO.split(',')[1];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const fondoImg = await pdfDoc.embedPng(bytes);
  page.drawImage(fondoImg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  const escribir = (topVh, leftVw, valor, fontSize = 9) => {
    const texto = valorODefault(valor);
    if (!texto) return;
    const { x, y } = vhvw(topVh, leftVw, fontSize);
    page.drawText(String(texto), { x, y, size: fontSize, font, color: NEGRO });
  };

  escribir(18.70, 70.58, presupuesto ? presupuesto.nroPresupuesto : '');
  escribir(24.01, 18.39, form.contacto);
  escribir(26.62, 14.71, form.cuit);
  escribir(29.23, 20.52, form.telefono);
  escribir(35.97, 18.03, form.domicilioOrigen);
  escribir(38.50, 19.22, form.domicilioDestino);
  escribir(41.11, 28.47, form.salidaFecha);
  escribir(43.72, 27.40, form.salidaHora);
  escribir(46.25, 22.54, form.capacidad);
  escribir(48.86, 25.74, form.movimientos);
  escribir(52.06, 23.84, adicionalesTexto);
  escribir(54.68, 29.18, form.servicioABordo);
  escribir(57.96, 62.40, form.alojViaticos);

  // Observaciones: texto normal, dentro del recuadro (con salto de línea si no entra)
  const obs = valorODefault(form.observaciones);
  if (obs) {
    const { x, y } = vhvw(64.4, 7.95, 8);
    const anchoMax = (82.0 / 100) * PAGE_W;
    const palabras = String(obs).split(' ');
    let linea = '';
    let renglon = 0;
    palabras.forEach((palabra, i) => {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (fontObs.widthOfTextAtSize(prueba, 8) > anchoMax) {
        page.drawText(linea, { x, y: y - renglon * 11, size: 8, font: fontObs, color: NEGRO });
        linea = palabra;
        renglon += 1;
      } else {
        linea = prueba;
      }
      if (i === palabras.length - 1 && linea) {
        page.drawText(linea, { x, y: y - renglon * 11, size: 8, font: fontObs, color: NEGRO });
      }
    });
  }

  return await pdfDoc.save();
};
