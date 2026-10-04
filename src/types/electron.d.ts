/**
 * Electron Preload IPC Bridge Type Declarations
 */
export interface BcamsDesktopBridge {
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  getScannerStatus: () => Promise<{ connected: boolean; transport: string; model: string }>;
  getDeviceInfo: () => Promise<{ platform: string; arch: string; hostname: string }>;
}

declare global {
  interface Window {
    bcamsDesktop?: BcamsDesktopBridge;
  }
}
