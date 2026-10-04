/**
 * Electron Service
 * 
 * Safe wrapper for native Electron operations with web browser fallbacks.
 */

export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && Boolean(window.bcamsDesktop);
};

export const getAppVersion = async (): Promise<string> => {
  if (isElectron() && window.bcamsDesktop?.getVersion) {
    return window.bcamsDesktop.getVersion();
  }
  return '1.0.0 (Web/Dev)';
};

export const minimizeWindow = async (): Promise<void> => {
  if (isElectron() && window.bcamsDesktop?.minimize) {
    await window.bcamsDesktop.minimize();
  }
};

export const maximizeWindow = async (): Promise<void> => {
  if (isElectron() && window.bcamsDesktop?.maximize) {
    await window.bcamsDesktop.maximize();
  }
};

export const closeWindow = async (): Promise<void> => {
  if (isElectron() && window.bcamsDesktop?.close) {
    await window.bcamsDesktop.close();
  }
};
