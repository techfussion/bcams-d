/// <reference types="vite/client" />

interface Window {
  bcamsDesktop?: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    getScannerStatus: () => Promise<{ connected: boolean; transport: string; model: string }>;
    getDeviceInfo: () => Promise<{ platform: string; arch: string; hostname: string }>;
  };
}
