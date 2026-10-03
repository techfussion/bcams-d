/**
 * Scanner Service Abstraction
 * 
 * Pluggable interface for fingerprint scanner hardware.
 * Currently uses a mock implementation. Transport (USB/Bluetooth)
 * is abstracted — the UI doesn't care about the physical connection.
 * 
 * Scanner Interface
 *       │
 *  ┌────┼─────────┐
 *  │    │         │
 * USB  Bluetooth  Mock
 */
import type { ScannerState, CaptureResult, DeviceTransport } from '@/types';

export interface ScannerService {
  getState(): ScannerState;
  getTransport(): DeviceTransport;
  connect(): Promise<boolean>;
  disconnect(): void;
  startCapture(): Promise<CaptureResult>;
  simulateScan(): Promise<CaptureResult>;
  onStateChange(callback: (state: ScannerState) => void): () => void;
}

// ─── Mock Scanner Implementation ────────────────────────────────────────────

type StateChangeCallback = (state: ScannerState) => void;

class MockScannerService implements ScannerService {
  private state: ScannerState = 'disconnected';
  private listeners: Set<StateChangeCallback> = new Set();
  private captureCount = 0;

  // Simulated capture results that cycle through different outcomes
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
    return 'usb';
  }

  private setState(newState: ScannerState) {
    this.state = newState;
    this.listeners.forEach(cb => cb(newState));
  }

  async connect(): Promise<boolean> {
    this.setState('ready');
    return true;
  }

  disconnect(): void {
    this.setState('disconnected');
  }

  async startCapture(): Promise<CaptureResult> {
    if (this.state === 'disconnected') {
      return { type: 'error', message: 'Scanner is not connected. Please connect the scanner and try again.' };
    }

    this.setState('scanning');
    
    // Simulate scanning delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    this.setState('processing');
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const result = this.mockResults[this.captureCount % this.mockResults.length];
    this.captureCount++;
    
    // Update timestamp to current
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
export const scannerService: ScannerService = new MockScannerService();
