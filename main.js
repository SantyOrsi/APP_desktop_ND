const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { generarPresupuestoPDF } = require('./generarPresupuestoPDFMain');
const { generarTraficoPDF } = require('./generarTraficoPDFMain');
const { generarContratoPDF } = require('./generarContratoPDFMain');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    icon: path.join(__dirname, 'build/icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: 'Nuevo Destino',
    autoHideMenuBar: true,
    show: false,
  });

  win.loadFile('dist/index.html');

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── Guardar PDF ──
const CARPETA_PDFS_PRESUPUESTOS = 'D:/Proyectos/Pdfs';
const CARPETA_PDFS_CONTRATOS   = 'D:/Proyectos/Pdfs';
const CARPETA_PDFS_SERVICIOS   = 'D:/Proyectos/Pdfs';
const CARPETA_PDFS_TRAFICO     = 'D:/Proyectos/Pdfs';

const carpetaSegunTipo = (tipo) => {
  if (tipo === 'contrato') return CARPETA_PDFS_CONTRATOS;
  if (tipo === 'servicio') return CARPETA_PDFS_SERVICIOS;
  if (tipo === 'trafico') return CARPETA_PDFS_TRAFICO;
  return CARPETA_PDFS_PRESUPUESTOS;
};

ipcMain.handle('guardar-pdf', async (event, { nombre, buffer, tipo }) => {
  try {
    const carpeta = carpetaSegunTipo(tipo);
    if (!fs.existsSync(carpeta)) {
      fs.mkdirSync(carpeta, { recursive: true });
    }
    const filePath = path.join(carpeta, nombre);
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return { ok: true, ruta: filePath };
  } catch (error) {
    console.error('Error guardando PDF:', error);
    return { ok: false, error: error.message };
  }
});

// Arma Y guarda el PDF de Presupuesto acá (proceso principal), para que
// el trabajo pesado (embeber la imagen de fondo) no trabe la ventana
// mientras se genera. El renderer solo manda los datos del formulario.
ipcMain.handle('generar-pdf-presupuesto', async (event, { form }) => {
  try {
    const pdfBytes = await generarPresupuestoPDF(form);
    const carpeta = carpetaSegunTipo('presupuesto');
    if (!fs.existsSync(carpeta)) {
      fs.mkdirSync(carpeta, { recursive: true });
    }
    const nombre = `Presupuesto_${form.nroPresupuesto || 'nuevo'}.pdf`;
    const filePath = path.join(carpeta, nombre);
    fs.writeFileSync(filePath, Buffer.from(pdfBytes));
    return { ok: true, ruta: filePath };
  } catch (error) {
    console.error('Error generando PDF de presupuesto:', error);
    return { ok: false, error: error.message };
  }
});

// Arma Y guarda el PDF de Tráfico (y, si hay contrato vinculado, también
// el Contrato sin el importe) acá en el proceso principal — mismo motivo
// que Presupuesto: no trabar la ventana mientras se arma.
ipcMain.handle('generar-pdf-trafico', async (event, { servicio, presupuesto, contrato }) => {
  try {
    const carpetaTrafico = carpetaSegunTipo('trafico');
    if (!fs.existsSync(carpetaTrafico)) fs.mkdirSync(carpetaTrafico, { recursive: true });

    const pdfTraficoBytes = await generarTraficoPDF(servicio, presupuesto);
    const nombreTrafico = `Trafico_${servicio?.nropresupuesto || 'nuevo'}.pdf`;
    const rutaTrafico = path.join(carpetaTrafico, nombreTrafico);
    fs.writeFileSync(rutaTrafico, Buffer.from(pdfTraficoBytes));

    let rutaContrato = null;
    if (presupuesto && contrato) {
      const carpetaContrato = carpetaSegunTipo('contrato');
      if (!fs.existsSync(carpetaContrato)) fs.mkdirSync(carpetaContrato, { recursive: true });

      const pdfContratoBytes = await generarContratoPDF(presupuesto, contrato, servicio, { incluirImporte: false });
      const nombreContrato = `Contrato_${servicio?.nropresupuesto || 'nuevo'}_sin_importe.pdf`;
      rutaContrato = path.join(carpetaContrato, nombreContrato);
      fs.writeFileSync(rutaContrato, Buffer.from(pdfContratoBytes));
    }

    return { ok: true, ruta: rutaTrafico, rutaContrato };
  } catch (error) {
    console.error('Error generando PDF de tráfico:', error);
    return { ok: false, error: error.message };
  }
});
