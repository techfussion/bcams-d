/**
 * Electron Preload IPC Bridge Type Declarations
 */
import type { CaptureResult, DeviceTransport } from './domain';

export interface ScannerHardwareStatus {
  connected: boolean;
  transport: DeviceTransport;
  model: string;
  serialNumber?: string;
  firmware?: string;
  qualityThreshold?: number;
  isCapturing?: boolean;
}

export interface DeviceTelemetryInfo {
  platform: string;
  arch: string;
  hostname: string;
  cpus?: number;
  cpuModel?: string;
  totalMemBytes?: number;
  freeMemBytes?: number;
  osRelease?: string;
  uptimeSeconds?: number;
}

export interface SystemTimeInfo {
  wallClock: string;
  monotonicNs: string;
  uptimeSeconds: number;
}

export interface BcamsDesktopBridge {
  // App & System
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  getSystemTime: () => Promise<SystemTimeInfo>;

  // Window Controls
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;

  // Scanner Hardware
  getScannerStatus: () => Promise<ScannerHardwareStatus>;
  connectScanner: (transport?: DeviceTransport) => Promise<{ success: boolean; status: ScannerHardwareStatus }>;
  disconnectScanner: () => Promise<{ success: boolean; status: ScannerHardwareStatus }>;
  setScannerTransport: (transport: DeviceTransport) => Promise<ScannerHardwareStatus>;
  startScannerCapture: () => Promise<CaptureResult>;
  cancelScannerCapture: () => Promise<{ success: boolean }>;

  // Device Telemetry
  getDeviceInfo: () => Promise<DeviceTelemetryInfo>;
}

declare global {
  interface Window {
    bcamsDesktop?: BcamsDesktopBridge;
  }
}
