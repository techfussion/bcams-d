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

const os = require('os');

// --- Scanner Hardware State ---
let scannerState = {
  connected: true,
  transport: 'usb',
  model: 'SecuGen Hamster Pro 20 (FDU08)',
  serialNumber: 'SG-2026-NG-4081',
  firmware: 'v3.2.1-prod',
  qualityThreshold: 70, // NFIQ threshold standard
  isCapturing: false,
};

// Mock student pool for local biometric matching simulation
const biometricRoster = [
  { id: 'stu-001', name: 'Oluwaseun Adeyemi', regNo: 'CSC/2021/001', quality: 92, minutiae: 48 },
  { id: 'stu-002', name: 'Ngozi Chukwuma', regNo: 'CSC/2021/002', quality: 89, minutiae: 44 },
  { id: 'stu-005', name: 'Chinedu Obi', regNo: 'CSC/2021/005', quality: 95, minutiae: 52 },
  { id: 'stu-006', name: 'Folake Ogunleye', regNo: 'CSC/2021/006', quality: 86, minutiae: 39 },
  { id: 'stu-007', name: 'Emmanuel Okechukwu', regNo: 'CSC/2021/007', quality: 91, minutiae: 46 },
  { id: 'stu-008', name: 'Blessing Adekunle', regNo: 'CSC/2021/008', quality: 88, minutiae: 41 },
];
let captureSequence = 0;

// --- IPC Handlers (Security boundary) ---

// App info
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getPlatform', () => {
  return process.platform;
});

// High-resolution hardware time for FR-4 Monotonic Tamper Protection
ipcMain.handle('app:getSystemTime', () => {
  return {
    wallClock: new Date().toISOString(),
    monotonicNs: process.hrtime.bigint().toString(),
    uptimeSeconds: Math.floor(process.uptime()),
  };
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

// Scanner Hardware Control
ipcMain.handle('scanner:getStatus', () => {
  return { ...scannerState };
});

ipcMain.handle('scanner:connect', async (_, transport = 'usb') => {
  scannerState.connected = true;
  scannerState.transport = transport;
  return { success: true, status: { ...scannerState } };
});

ipcMain.handle('scanner:disconnect', async () => {
  scannerState.connected = false;
  scannerState.isCapturing = false;
  return { success: true, status: { ...scannerState } };
});

ipcMain.handle('scanner:setTransport', async (_, transport) => {
  if (['usb', 'bluetooth', 'none'].includes(transport)) {
    scannerState.transport = transport;
  }
  return { ...scannerState };
});

ipcMain.handle('scanner:cancelCapture', async () => {
  scannerState.isCapturing = false;
  return { success: true };
});

ipcMain.handle('scanner:startCapture', async () => {
  if (!scannerState.connected) {
    return {
      type: 'error',
      message: 'Fingerprint scanner is not connected. Connect via USB or Bluetooth.',
      timestamp: new Date().toISOString(),
    };
  }

  scannerState.isCapturing = true;

  try {
    // Simulate optical sensor exposure & ISO 19794-2 template extraction
    await new Promise((resolve) => setTimeout(resolve, 850));

    if (!scannerState.isCapturing) {
      return { type: 'error', message: 'Capture was cancelled by user or system.', timestamp: new Date().toISOString() };
    }

    const candidate = biometricRoster[captureSequence % biometricRoster.length];
    captureSequence++;

    scannerState.isCapturing = false;

    // Simulate match result
    const isNoMatch = captureSequence % 7 === 0;
    if (isNoMatch) {
      return {
        type: 'no_match',
        timestamp: new Date().toISOString(),
        qualityScore: 68,
        minutiaeCount: 22,
        sensorModel: scannerState.model,
      };
    }

    return {
      type: 'success',
      personId: candidate.id,
      personName: candidate.name,
      registrationNumber: candidate.regNo,
      qualityScore: candidate.quality,
      minutiaeCount: candidate.minutiae,
      sensorModel: scannerState.model,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    scannerState.isCapturing = false;
    return {
      type: 'error',
      message: err instanceof Error ? err.message : 'Biometric capture failed',
      timestamp: new Date().toISOString(),
    };
  }
});

// Device telemetry & hardware profile
ipcMain.handle('device:getInfo', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model || 'Unknown CPU',
    totalMemBytes: os.totalmem(),
    freeMemBytes: os.freemem(),
    osRelease: os.release(),
    uptimeSeconds: Math.floor(os.uptime()),
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
