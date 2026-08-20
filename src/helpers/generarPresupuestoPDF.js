import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const NEGRO = rgb(0.1, 0.1, 0.1);
const AMARILLO = rgb(0.96, 0.77, 0);
const GRIS = rgb(0.5, 0.5, 0.5);
const GRIS_CLARO = rgb(0.95, 0.95, 0.95);

export const generarPresupuestoPDF = async (form) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let y = height - 40;

  // ── HEADER NEGRO ──
  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: NEGRO });

  page.drawCircle({ x: 50, y: height - 40, size: 18, color: AMARILLO });
  page.drawText('ND', { x: 42, y: height - 46, size: 10, font: bold, color: NEGRO });

  page.drawText('NUEVO ', { x: 76, y: height - 38, size: 12, font: bold, color: rgb(1,1,1) });
  page.drawText('DESTINO', { x: 76 + bold.widthOfTextAtSize('NUEVO ', 12), y: height - 38, size: 12, font: bold, color: AMARILLO });

  page.drawText('PRESUPUESTO', { x: width - 160, y: height - 34, size: 14, font: bold, color: rgb(1,1,1) });
  page.drawText(`N° ${form.nroPresupuesto || '-'}`, { x: width - 160, y: height - 52, size: 20, font: bold, color: AMARILLO });

  y = height - 100;

  // ── DATOS GENERALES ──
  const seccion = (titulo, yPos) => {
    page.drawRectangle({ x: 40, y: yPos - 4, width: width - 80, height: 20, color: GRIS_CLARO });
    page.drawText(titulo, { x: 48, y: yPos, size: 9, font: bold, color: NEGRO });
    return yPos - 24;
  };

  const fila = (label, value, x, yPos, colWidth = 240) => {
    page.drawText(label, { x, y: yPos, size: 8, font: bold, color: GRIS });
    page.drawText(value || '-', { x, y: yPos - 12, size: 9, font: regular, color: NEGRO });
    return yPos - 28;
  };

  y = seccion('DATOS GENERALES', y);
  fila('Cliente', form.cliente, 48, y);
  fila('Nro. Presupuesto', form.nroPresupuesto, 300, y);
  y -= 28;
  fila('Fecha', form.fecha, 48, y);
  fila('Vigencia', form.vigencia, 300, y);
  y -= 28;
  fila('Origen', form.origen, 48, y);
  fila('Destino', form.destino, 300, y);
  y -= 36;

  y = seccion('SALIDA / RETORNO', y);
  fila('Fecha Salida', form.salidaFecha, 48, y);
  fila('Hora Salida', form.salidaHora, 180, y);
  fila('Fecha Retorno', form.retornoFecha, 310, y);
  fila('Hora Retorno', form.retornoHora, 440, y);
  y -= 36;

  y = seccion('VEHÍCULO Y SERVICIOS', y);
  fila('Movimiento', form.movimiento, 48, y);
  fila('Adicionales', form.adicionales, 300, y);
  y -= 28;
  fila('Cant. Movimientos', form.cantMov, 48, y);
  fila('Cant. Adicionales', form.cantAdi, 300, y);
  y -= 28;
  fila('Aloj. y Viát. a cargo de', form.alojViaticosCargo, 48, y);
  fila('Importe Aloj. y Viát.', form.importAlojViaticos, 300, y);
  y -= 28;
  fila('Capacidad', form.capacidad, 48, y);
  y -= 36;

  y = seccion('COSTOS', y);
  fila('Costo Total', form.costoTotal ? `$${form.costoTotal}` : '-', 48, y);
  fila('Costo + IVA (10.5%)', form.costoIva ? `$${form.costoIva}` : '-', 300, y);
  y -= 36;

  // ── FOOTER ──
  page.drawLine({ start: { x: 40, y: 60 }, end: { x: width - 40, y: 60 }, thickness: 0.5, color: GRIS_CLARO });
  page.drawText('Nuevo Destino Viajes — DEF UX', { x: 40, y: 44, size: 8, font: regular, color: GRIS });
  page.drawText(`Generado el ${new Date().toLocaleDateString('es-AR')}`, { x: width - 180, y: 44, size: 8, font: regular, color: GRIS });

  return await pdfDoc.save();
};