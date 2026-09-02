const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

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

// ── Guardar PDF (Rutas para Máquina Virtual en Disco D:) ──
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