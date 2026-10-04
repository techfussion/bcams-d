/**
 * BCAMS Desktop — Preload Script (Controlled IPC Bridge)
 * 
 * Exposes a narrow, typed API to the renderer via contextBridge.
 * No arbitrary Node.js access — only specific channels.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bcamsDesktop', {
  // App & System
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  getSystemTime: () => ipcRenderer.invoke('app:getSystemTime'),

  // Window
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Scanner Hardware
  getScannerStatus: () => ipcRenderer.invoke('scanner:getStatus'),
  connectScanner: (transport) => ipcRenderer.invoke('scanner:connect', transport),
  disconnectScanner: () => ipcRenderer.invoke('scanner:disconnect'),
  setScannerTransport: (transport) => ipcRenderer.invoke('scanner:setTransport', transport),
  startScannerCapture: () => ipcRenderer.invoke('scanner:startCapture'),
  cancelScannerCapture: () => ipcRenderer.invoke('scanner:cancelCapture'),

  // Device Telemetry
  getDeviceInfo: () => ipcRenderer.invoke('device:getInfo'),
});
