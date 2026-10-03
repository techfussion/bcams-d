/**
 * BCAMS Desktop — Electron Main Process
 * 
 * Security boundary: contextIsolation=true, nodeIntegration=false.
 * All renderer communication goes through the preload bridge.
 */
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'BCAMS Desktop',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    show: false,
    titleBarStyle: 'default',
    backgroundColor: '#FFFFFF',
  });

  // Graceful window display
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Prevent external navigation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// --- IPC Handlers (narrow API surface) ---

// App info
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getPlatform', () => {
  return process.platform;
});

// Window controls
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

// Scanner stub — future hardware integration point
ipcMain.handle('scanner:getStatus', () => {
  return { connected: false, transport: 'none', model: 'unknown' };
});

// Device info stub
ipcMain.handle('device:getInfo', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    hostname: require('os').hostname(),
  };
});

// --- App lifecycle ---

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Block permission requests we don't need
app.on('web-contents-created', (_, contents) => {
  contents.session.setPermissionRequestHandler((_, permission, callback) => {
    const allowed = ['geolocation']; // Required for geofence
    callback(allowed.includes(permission));
  });
});
