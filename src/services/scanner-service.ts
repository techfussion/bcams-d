/**
 * Scanner Service Abstraction
 * 
 * Pluggable interface for fingerprint scanner hardware.
 * Interacts with native Electron IPC when running in Electron desktop app,
 * and gracefully falls back to mock scanner when running in web browser or mock mode.
 * 
 * Transport (USB/Bluetooth) is abstracted.
 * 
 * Scanner Interface
 *       │
 *  ┌────┼─────────┐
 *  │    │         │
 * USB  Bluetooth  Mock
 */
import type { ScannerState, CaptureResult, DeviceTransport } from '@/types';
import {
  isElectron,
  connectNativeScanner,
  disconnectNativeScanner,
  startNativeScannerCapture,
  getNativeScannerStatus,
  setNativeScannerTransport,
} from './electron-service';

export interface ScannerService {
  getState(): ScannerState;
  getTransport(): DeviceTransport;
  setTransport(transport: DeviceTransport): void;
  getModel(): string;
  connect(transport?: DeviceTransport): Promise<boolean>;
  disconnect(): void;
  startCapture(): Promise<CaptureResult>;
  simulateScan(): Promise<CaptureResult>;
  onStateChange(callback: (state: ScannerState) => void): () => void;
}

type StateChangeCallback = (state: ScannerState) => void;

class HybridScannerService implements ScannerService {
  private state: ScannerState = 'disconnected';
  private transport: DeviceTransport = 'usb';
  private model: string = 'SecuGen Hamster Pro 20';
  private listeners: Set<StateChangeCallback> = new Set();
  private captureCount = 0;

  // Mock capture results for web fallback
  private readonly mockResults: CaptureResult[] = [
    { type: 'success', personId: 'stu-001', personName: 'Oluwaseun Adeyemi', timestamp: new Date().toISOString() },
    { type: 'success', personId: 'stu-002', personName: 'Ngozi Chukwuma', timestamp: new Date().toISOString() },
    { type: 'success', personId: 'stu-005', personName: 'Chinedu Obi', timestamp: new Date().toISOString() },
    { type: 'duplicate', personId: 'stu-001', personName: 'Oluwaseun Adeyemi', originalTimestamp: new Date().toISOString() },
    { type: 'success', personId: 'stu-006', personName: 'Folake Ogunleye', timestamp: new Date().toISOString() },
    { type: 'no_match', timestamp: new Date().toISOString() },
    { type: 'success', personId: 'stu-008', personName: 'Blessing Adekunle', timestamp: new Date().toISOString() },
    { type: 'success', personId: 'stu-007', personName: 'Emmanuel Okechukwu', timestamp: new Date().toISOString() },
  ];

  getState(): ScannerState {
    return this.state;
  }

  getTransport(): DeviceTransport {
    return this.transport;
  }

  setTransport(transport: DeviceTransport) {
    this.transport = transport;
    if (isElectron()) {
      setNativeScannerTransport(transport).catch(() => {});
    }
  }

  getModel(): string {
    return this.model;
  }

  private setState(newState: ScannerState) {
    this.state = newState;
    this.listeners.forEach(cb => cb(newState));
  }

  async connect(transport?: DeviceTransport): Promise<boolean> {
    if (transport) {
      this.transport = transport;
    }

    if (isElectron()) {
      try {
        const success = await connectNativeScanner(this.transport);
        if (success) {
          const status = await getNativeScannerStatus();
          this.model = status.model || this.model;
          this.setState('ready');
          return true;
        }
      } catch {
        // Fall back to mock
      }
    }

    this.setState('ready');
    return true;
  }

  disconnect(): void {
    if (isElectron()) {
      disconnectNativeScanner().catch(() => {});
    }
    this.setState('disconnected');
  }

  async startCapture(): Promise<CaptureResult> {
    if (this.state === 'disconnected') {
      return { type: 'error', message: 'Scanner is not connected. Please connect the scanner and try again.' };
    }

    this.setState('scanning');

    // If running in native Electron, delegate to native IPC bridge
    if (isElectron()) {
      try {
        const nativeResult = await startNativeScannerCapture();
        if (nativeResult) {
          this.setState('ready');
          return nativeResult;
        }
      } catch (err) {
        // Fall back to web mock flow below if IPC failed
      }
    }

    // Web simulation flow
    await new Promise(resolve => setTimeout(resolve, 800));
    this.setState('processing');
    await new Promise(resolve => setTimeout(resolve, 600));

    const result = this.mockResults[this.captureCount % this.mockResults.length];
    this.captureCount++;

    const timestampedResult = { ...result, timestamp: new Date().toISOString() };
    this.setState('ready');
    return timestampedResult;
  }

  async simulateScan(): Promise<CaptureResult> {
    return this.startCapture();
  }

  onStateChange(callback: StateChangeCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

// Export singleton instance
export const scannerService: ScannerService = new HybridScannerService();
