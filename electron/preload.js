/**
 * BCAMS Desktop — Preload Script (Controlled IPC Bridge)
 * 
 * Exposes a narrow, typed API to the renderer via contextBridge.
 * No arbitrary Node.js access — only specific channels.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bcamsDesktop', {
  // App
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),

  // Window
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Scanner (stub for future hardware integration)
  getScannerStatus: () => ipcRenderer.invoke('scanner:getStatus'),

  // Device
  getDeviceInfo: () => ipcRenderer.invoke('device:getInfo'),
});
