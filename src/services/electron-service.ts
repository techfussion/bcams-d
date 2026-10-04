/**
 * Electron Service
 * 
 * Safe wrapper for native Electron operations with web browser fallbacks.
 */
import type {
  ScannerHardwareStatus,
  DeviceTelemetryInfo,
  SystemTimeInfo,
} from '@/types/electron';
import type { CaptureResult, DeviceTransport } from '@/types';

export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && Boolean(window.bcamsDesktop);
};

export const getAppVersion = async (): Promise<string> => {
  if (isElectron() && window.bcamsDesktop?.getVersion) {
    return window.bcamsDesktop.getVersion();
  }
  return '1.0.0 (Web/Dev)';
};

export const getAppPlatform = async (): Promise<string> => {
  if (isElectron() && window.bcamsDesktop?.getPlatform) {
    return window.bcamsDesktop.getPlatform();
  }
  return typeof navigator !== 'undefined' ? navigator.platform : 'web';
};

export const getSystemTime = async (): Promise<SystemTimeInfo> => {
  if (isElectron() && window.bcamsDesktop?.getSystemTime) {
    return window.bcamsDesktop.getSystemTime();
  }
  return {
    wallClock: new Date().toISOString(),
    monotonicNs: String(Math.floor(performance.now() * 1_000_000)),
    uptimeSeconds: Math.floor(performance.now() / 1000),
  };
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

// Scanner Hardware Controls
export const getNativeScannerStatus = async (): Promise<ScannerHardwareStatus> => {
  if (isElectron() && window.bcamsDesktop?.getScannerStatus) {
    return window.bcamsDesktop.getScannerStatus();
  }
  return {
    connected: false,
    transport: 'none',
    model: 'Web Emulated Scanner',
  };
};

export const connectNativeScanner = async (
  transport: DeviceTransport = 'usb'
): Promise<boolean> => {
  if (isElectron() && window.bcamsDesktop?.connectScanner) {
    const res = await window.bcamsDesktop.connectScanner(transport);
    return res.success;
  }
  return true;
};

export const disconnectNativeScanner = async (): Promise<boolean> => {
  if (isElectron() && window.bcamsDesktop?.disconnectScanner) {
    const res = await window.bcamsDesktop.disconnectScanner();
    return res.success;
  }
  return true;
};

export const setNativeScannerTransport = async (
  transport: DeviceTransport
): Promise<ScannerHardwareStatus | null> => {
  if (isElectron() && window.bcamsDesktop?.setScannerTransport) {
    return window.bcamsDesktop.setScannerTransport(transport);
  }
  return null;
};

export const startNativeScannerCapture = async (): Promise<CaptureResult | null> => {
  if (isElectron() && window.bcamsDesktop?.startScannerCapture) {
    return window.bcamsDesktop.startScannerCapture();
  }
  return null;
};

export const cancelNativeScannerCapture = async (): Promise<boolean> => {
  if (isElectron() && window.bcamsDesktop?.cancelScannerCapture) {
    const res = await window.bcamsDesktop.cancelScannerCapture();
    return res.success;
  }
  return false;
};

export const getDeviceTelemetry = async (): Promise<DeviceTelemetryInfo> => {
  if (isElectron() && window.bcamsDesktop?.getDeviceInfo) {
    return window.bcamsDesktop.getDeviceInfo();
  }
  return {
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'browser',
    arch: 'x64',
    hostname: 'bcams-web-client',
  };
};
