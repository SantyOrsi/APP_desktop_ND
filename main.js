const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: 'Nuevo Destino',
    autoHideMenuBar: true,
  });

  win.loadFile('dist/index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── Guardar PDF (usado por "Solo PDF" / "Guardar y PDF") ──
// Cuando tengan la carpeta definitiva de Contratos, solo hay que cambiar
// esta línea (CARPETA_PDFS_CONTRATOS); todo lo demás ya está armado.
const CARPETA_PDFS_PRESUPUESTOS = 'D:\\Proyectos\\Pdfs';
const CARPETA_PDFS_CONTRATOS = CARPETA_PDFS_PRESUPUESTOS; // por ahora, la misma carpeta

const carpetaSegunTipo = (tipo) => {
  if (tipo === 'contrato') return CARPETA_PDFS_CONTRATOS;
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
    return { ok: false, error: error.message };
  }
});
