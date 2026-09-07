import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { CONTRATO_FONDO } from '../constants/pdfAssets';

const PAGE_W = 612;
const PAGE_H = 862;
const NEGRO = rgb(0.1, 0.1, 0.1);
const GRIS_RENGLON = rgb(0.82, 0.82, 0.82);

// Área imprimible: debajo de la cinta amarilla/negra de arriba, arriba
// del pie de "Información de contacto".
const MARGEN_IZQ = 40;
const MARGEN_DER = 40;
const Y_TOPE_ARRIBA = 715; // debajo del logo/cinta
const Y_TOPE_ABAJO = 82;   // arriba del pie negro

const valorODefault = (valor, porDefecto = '') => (valor && String(valor).trim() !== '' ? String(valor) : porDefecto);

// ── Número a letras (igual que antes) ──
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

// ── Runs de texto: cada uno es { t: texto, b: negrita?, u: subrayado? } ──
// Los datos (dato()) van en negrita y subrayados; si no hay valor, no se
// dibuja nada — nunca puntos de relleno.
const normal = (t) => ({ t, b: false, u: false });
const dato = (valor) => ({ t: valorODefault(valor), b: true, u: true });

// Dibuja el renglón gris exactamente en la Y donde va a ir un texto
// (mismo Y que usa el texto, así coinciden siempre).
const lineaGris = (page, y, xIni, xFin) => {
  page.drawLine({ start: { x: xIni, y: y - 2.5 }, end: { x: xFin, y: y - 2.5 }, thickness: 0.5, color: GRIS_RENGLON });
};

// Dibuja una lista de "runs" con salto de línea automático, devuelve el
// Y (medido desde abajo, como pide pdf-lib) donde debería arrancar el
// próximo párrafo.
const dibujarParrafo = (page, fontNormal, fontBold, runs, yInicio, fontSize = 10.5, interlinea = 14, xIni = MARGEN_IZQ, xFin = PAGE_W - MARGEN_DER, conRenglon = true) => {
  let cursorX = xIni;
  let cursorY = yInicio;
  if (conRenglon) lineaGris(page, cursorY, xIni, xFin);

  runs.forEach((run) => {
    if (!run.t) return;
    const font = run.b ? fontBold : fontNormal;
    const palabras = run.t.split(' ').filter((p) => p !== '');

    palabras.forEach((palabra) => {
      const conEspacio = cursorX > xIni ? ' ' + palabra : palabra;
      const ancho = font.widthOfTextAtSize(conEspacio, fontSize);

      if (cursorX + ancho > xFin && cursorX > xIni) {
        cursorX = xIni;
        cursorY -= interlinea;
        if (conRenglon) lineaGris(page, cursorY, xIni, xFin);
      }

      const espacioAntes = cursorX > xIni ? ' ' : '';
      const textoFinal = espacioAntes + palabra;
      const anchoEspacio = espacioAntes ? font.widthOfTextAtSize(' ', fontSize) : 0;
      const xPalabra = cursorX + anchoEspacio;
      const anchoPalabra = font.widthOfTextAtSize(palabra, fontSize);

      page.drawText(palabra, { x: xPalabra, y: cursorY, size: fontSize, font, color: NEGRO });
      if (run.u) {
        page.drawLine({
          start: { x: xPalabra, y: cursorY - 1.5 },
          end: { x: xPalabra + anchoPalabra, y: cursorY - 1.5 },
          thickness: 0.6,
          color: NEGRO,
        });
      }

      cursorX = xPalabra + anchoPalabra;
    });
  });

  return cursorY - interlinea;
};

// Dibuja una línea de texto pegada al margen derecho de la columna
// (para el bloque de datos del cliente en el pie).
const dibujarLineaDerecha = (page, fontNormal, fontBold, runs, y, fontSize, interlinea, xIni, xFin, conRenglon = true) => {
  if (conRenglon) lineaGris(page, y, xIni, xFin);
  let anchoTotal = 0;
  runs.forEach((run, i) => {
    if (!run.t) return;
    const font = run.b ? fontBold : fontNormal;
    const texto = (anchoTotal > 0 ? ' ' : '') + run.t;
    anchoTotal += font.widthOfTextAtSize(texto, fontSize);
  });

  let cursorX = Math.max(xIni, xFin - anchoTotal);
  let primero = true;
  runs.forEach((run) => {
    if (!run.t) return;
    const font = run.b ? fontBold : fontNormal;
    const espacio = primero ? '' : ' ';
    const texto = espacio + run.t;
    const anchoEspacio = espacio ? font.widthOfTextAtSize(' ', fontSize) : 0;
    const xPalabra = cursorX + anchoEspacio;
    const anchoRun = font.widthOfTextAtSize(run.t, fontSize);

    page.drawText(run.t, { x: xPalabra, y, size: fontSize, font, color: NEGRO });
    if (run.u) {
      page.drawLine({
        start: { x: xPalabra, y: y - 1.5 },
        end: { x: xPalabra + anchoRun, y: y - 1.5 },
        thickness: 0.6,
        color: NEGRO,
      });
    }
    cursorX = xPalabra + anchoRun;
    primero = false;
  });

  return y - interlinea;
};

export const generarContratoPDF = async (presupuesto, contrato, servicio = null, opciones = {}) => {
  const { incluirImporte = true } = opciones;

  const fFirma = parseFecha(contrato.fechaContrato);
  const fServicio = parseFecha(presupuesto.salidaFecha);
  const fRetorno = parseFecha(presupuesto.retornoFecha);

  const montoViaje = presupuesto.costoIva && Number(presupuesto.costoIva) > 0
    ? presupuesto.costoIva
    : presupuesto.costoTotal;
  const simboloMoneda = presupuesto.moneda === 'USD' ? 'US$' : '$';

  const cantChoferes = Array.isArray(servicio?.chofer)
    ? (servicio.chofer.length || '')
    : (servicio?.chofer ? 1 : '');

  const viaticosACargo = (Number(presupuesto.importAlojViaticos) > 0 || presupuesto.alojViaticosCargo) ? 'SI' : 'NO';

  const traslladosExtras = presupuesto.adicionales === 'SI' ? valorODefault(presupuesto.adicionalesDetalle) : '';

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ── Fondo ──
  const base64 = CONTRATO_FONDO.split(',')[1];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const fondoImg = await pdfDoc.embedPng(bytes);
  page.drawImage(fondoImg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  let y = Y_TOPE_ARRIBA;

  // ── Encabezado de la empresa ──
  y = dibujarParrafo(page, fontNormal, fontBold, [
    normal('NUEVO DESTINO VIAJES S.R.L. – CUIT 30-71578387'),
  ], y, 8.5, 11, MARGEN_IZQ, PAGE_W - MARGEN_DER, false);
  y = dibujarParrafo(page, fontNormal, fontBold, [
    normal('Bv. 27 de Febrero Nº 2265, Rosario Santa Fe C.P 2000 / 0341-153341317'),
  ], y, 7.5, 10, MARGEN_IZQ, PAGE_W - MARGEN_DER, false);

  y -= 7;

  // ── Título centrado ──
  const titulo = 'CONTRATO DE SERVICIO PARA TRASLADO DE PASAJEROS';
  const tituloSize = 11;
  const anchoTitulo = fontBold.widthOfTextAtSize(titulo, tituloSize);
  page.drawText(titulo, { x: (PAGE_W - anchoTitulo) / 2, y, size: tituloSize, font: fontBold, color: NEGRO });
  y -= 20;

  // ── Cuerpo ──
  y = dibujarParrafo(page, fontNormal, fontBold, [
    normal('En la ciudad de Rosario a los'), dato(fFirma.dia), normal('días del mes de'), dato(fFirma.mes), normal('de'), dato(fFirma.anio) ,normal('.'),
  ], y);
  y -= 3;

  y = dibujarParrafo(page, fontNormal, fontBold, [
    normal('Entre la Empresa de transporte Nuevo Destino Viajes S.R.L. con domicilio en Bv. 27 de Febrero 2265, de la ciudad de Rosario, y el Sr/a/Empresa'),
    dato(contrato.clienteNombre), normal('.'),
  ], y);
  y -= 3;

  y = dibujarParrafo(page, fontNormal, fontBold, [
    normal('CUIT/D.N.I Nº'), dato(contrato.cuitDni), normal('.'),
  ], y);
  y -= 3;

  y = dibujarParrafo(page, fontNormal, fontBold, [
    normal('Domiciliado en la calle'), dato(contrato.domicilioCliente), normal('de la ciudad de'), dato(contrato.ciudad),
    normal('como Contratante, conviene en realizar el siguiente contrato de prestación de servicio, sujeto a las siguientes cláusulas.'),
  ], y);
  y -= 7;

  y = dibujarParrafo(page, fontNormal, fontBold, [
    normal('Primera:'), normal('La Empresa se compromete a trasladar en vehículos habilitados por la C.N.R.T. (Comisión Nacional de Regulación del Transporte) y Transporte de la Provincia, a'),
    dato(presupuesto.capacidad), normal('pasajeros, en unidad/es tipo:'), dato(presupuesto.tipoTransporte),
    normal('. Con origen desde la localidad de'), dato(presupuesto.destino),
    normal('. Con destino a la ciudad de'), dato(contrato.domicilioDestino), normal('.'),
  ], y);
  y -= 7;

  y = dibujarParrafo(page, fontNormal, fontBold, [
    normal('Segundo:'), normal('Dicho traslado se realizará con salida a las'), dato(presupuesto.salidaHora),
    normal('horas, del día'), dato(fServicio.dia), normal('de'), dato(fServicio.mes), normal('de'), dato(fServicio.anio),
    normal('. Y con regreso aproximado'), dato(presupuesto.retornoHora), normal('horas, del día'),
    dato(fRetorno.dia), normal('de'), dato(fRetorno.mes), normal('de'), dato(fRetorno.anio), normal('.'),
  ], y);
  y -= 7;

  y = dibujarParrafo(page, fontNormal, fontBold, [
    normal('Tercero:'), normal('El viaje, que consta aproximadamente de'), dato(presupuesto.kmRecorrer),
    normal('km. será realizado con'), dato(cantChoferes), normal('chóferes. Los viáticos de los chóferes (almuerzo-cena-alojamiento-cochera)'),
    dato(viaticosACargo), normal('estará a cargo del contratante.'),
  ], y);
  y -= 7;

  y = dibujarParrafo(page, fontNormal, fontBold, [
    normal('Cuarto:'), normal('Traslados extras:'), dato(traslladosExtras),
  ], y);
  y -= 7;

  if (incluirImporte) {
    const palabraMoneda = presupuesto.moneda === 'USD' ? 'dólares' : 'pesos';
    y = dibujarParrafo(page, fontNormal, fontBold, [
      normal('Quinto:'), normal(`El importe del viaje será de ${simboloMoneda}`), dato(montoViaje), normal(palabraMoneda), dato(numeroALetras(montoViaje)),
      normal(`. Final, el que será abonado de la siguiente manera: en concepto de seña ${simboloMoneda}`), dato(contrato.senia),
      normal(palabraMoneda), dato(numeroALetras(contrato.senia)), normal('y el saldo el día'), dato(contrato.fechaSaldo),
      normal(simboloMoneda), dato(contrato.saldo), normal(palabraMoneda), dato(numeroALetras(contrato.saldo)),
      normal('. Contado efectivo/transferencia bancaria.'),
    ], y);
    y -= 7;
  }

  y = dibujarParrafo(page, fontNormal, fontBold, [
    normal('Sexto:'), normal('El anticipo en concepto de seña registra el compromiso entre La Empresa y El contratante para la fecha, hora, cantidad de pasajeros, origen y destino acordados, los que no podrán alterarse salvo acuerdo entre las partes.'),
  ], y);
  y -= 7;

  y = dibujarParrafo(page, fontNormal, fontBold, [
    normal('Séptimo:'), normal('Política de Cancelación (en caso de cancelar dicho servicio deberá hacerlo quince (15) días hábiles anteriores a la fecha de realizar el traslado, de lo contrario no habrá devolución de seña).'),
  ], y);
  y -= 7;

  y = dibujarParrafo(page, fontNormal, fontBold, [
    normal('Octavo:'), normal('Envío de listas de pasajeros. La lista de pasajeros deberá estar completa con la siguiente información: APELLIDO, NOMBRES, DNI, FECHA DE NACIMIENTO, NACIONALIDAD (ACLARAR SI SON MENORES DE 18 AÑOS). La misma deberá ser confeccionada mediante un formato de Excel que la empresa proporcionará, y deberá ser enviada por WhatsApp o a info@nuevodestinoviajes.com 48hs antes del servicio contratado SIN EXCEPCIÓN, de lo contrario quedará cancelado el servicio sin devolución de seña.'),
  ], y);

  // ── Pie: datos de la empresa (izquierda) y del cliente (derecha) ──
  y -= 16;
  const xMedio = PAGE_W / 2;
  const colIzqFin = xMedio - 10;
  const colDerIni = xMedio + 10;

  const yFinIzq = dibujarParrafo(page, fontNormal, fontBold, [
    normal('Empresa Nuevo Destino Viajes S.R.L.'),
  ], y, 13, 17, MARGEN_IZQ, colIzqFin, false);
  const yFinIzq2 = dibujarParrafo(page, fontNormal, fontBold, [
    normal('Tel (0341) 153 341 317'),
  ], yFinIzq, 13, 17, MARGEN_IZQ, colIzqFin, false);
  const yFinIzq3 = dibujarParrafo(page, fontNormal, fontBold, [
    normal('info@nuevodestinoviajes.com'),
  ], yFinIzq2, 13, 17, MARGEN_IZQ, colIzqFin, false);
  dibujarParrafo(page, fontNormal, fontBold, [
    normal('WWW.NUEVODESTINO-VIAJES.COM'),
  ], yFinIzq3, 13, 17, MARGEN_IZQ, colIzqFin, false);

  const yFinDer = dibujarLineaDerecha(page, fontNormal, fontBold, [
    normal('Nombre:'), dato(contrato.clienteNombre),
  ], y, 15, 19, colDerIni, PAGE_W - MARGEN_DER, false);
  const yFinDer2 = dibujarLineaDerecha(page, fontNormal, fontBold, [
    normal('D.N.I/CUIT:'), dato(contrato.cuitDni),
  ], yFinDer, 15, 19, colDerIni, PAGE_W - MARGEN_DER, false);
  dibujarLineaDerecha(page, fontNormal, fontBold, [
    normal('Tel:'), dato(contrato.telefono),
  ], yFinDer2, 15, 19, colDerIni, PAGE_W - MARGEN_DER, false);

  return await pdfDoc.save();
};
