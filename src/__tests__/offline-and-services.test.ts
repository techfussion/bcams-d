import { describe, it, expect, beforeEach } from 'vitest';
import { offlineQueue } from '@/services/offline-queue-service';
import { HttpApiAdapter, ApiError } from '@/api/http-adapter';
import { wsService } from '@/services/websocket-service';
import {
  isElectron,
  getAppVersion,
  getAppPlatform,
  getSystemTime,
  getNativeScannerStatus,
} from '@/services/electron-service';
import type { PendingQueueItem, CalibrationPair } from '@/stores/sync-store';

describe('Offline Queue Service (FR-3 IndexedDB & Memory Fallback)', () => {
  beforeEach(async () => {
    await offlineQueue.clear();
  });

  it('enqueues and retrieves offline pending items', async () => {
    const item1: PendingQueueItem = {
      id: 'test-evt-1',
      type: 'attendance',
      description: 'Aliyu Bello - CSC 201',
      timestamp: new Date('2026-10-04T10:00:00Z').toISOString(),
      monotonicOffsetMs: 500,
      clockIntegrity: 'verified',
      deviceId: 'dev-001',
    };

    const item2: PendingQueueItem = {
      id: 'test-evt-2',
      type: 'clock',
      description: 'Zainab Ahmed - Gate Clock In',
      timestamp: new Date('2026-10-04T10:05:00Z').toISOString(),
      monotonicOffsetMs: 1200,
      clockIntegrity: 'verified',
      deviceId: 'dev-gate-01',
    };

    await offlineQueue.enqueue(item1);
    await offlineQueue.enqueue(item2);

    const count = await offlineQueue.count();
    expect(count).toBe(2);

    const items = await offlineQueue.getAll();
    expect(items.length).toBe(2);
    // Ordered descending by timestamp (item2 is newer)
    expect(items[0].id).toBe('test-evt-2');
    expect(items[1].id).toBe('test-evt-1');
  });

  it('removes synchronized items by ID', async () => {
    const item: PendingQueueItem = {
      id: 'to-remove',
      type: 'attendance',
      description: 'Student Test',
      timestamp: new Date().toISOString(),
      monotonicOffsetMs: 100,
      clockIntegrity: 'verified',
      deviceId: 'dev-001',
    };

    await offlineQueue.enqueue(item);
    expect(await offlineQueue.count()).toBe(1);

    await offlineQueue.remove(['to-remove']);
    expect(await offlineQueue.count()).toBe(0);
  });

  it('persists and retrieves FR-4 calibration pair', async () => {
    const cal: CalibrationPair = {
      serverWallClock: '2026-10-04T08:00:00.000Z',
      deviceMonotonicMs: 12345.67,
      lastCalibratedAt: '2026-10-04T08:00:00.000Z',
    };

    await offlineQueue.saveCalibration(cal);
    const retrieved = await offlineQueue.getCalibration();

    expect(retrieved).not.toBeNull();
    expect(retrieved?.serverWallClock).toBe(cal.serverWallClock);
    expect(retrieved?.deviceMonotonicMs).toBe(cal.deviceMonotonicMs);
  });
});

describe('HTTP REST Client Adapter (Priority 5)', () => {
  it('manages baseUrl and trims trailing slashes', () => {
    const adapter = new HttpApiAdapter('http://api.unilag.edu.ng/v1/');
    expect(adapter.getBaseUrl()).toBe('http://api.unilag.edu.ng/v1');

    adapter.setBaseUrl('https://bcams.unilag.edu.ng/api/v2/');
    expect(adapter.getBaseUrl()).toBe('https://bcams.unilag.edu.ng/api/v2');
  });

  it('manages JWT auth token', () => {
    const adapter = new HttpApiAdapter('http://localhost:8000');
    adapter.setToken('jwt-sample-token-xyz');
    expect(adapter.getToken()).toBe('jwt-sample-token-xyz');

    adapter.setToken(null);
    expect(adapter.getToken()).toBeNull();
  });

  it('constructs ApiError with status and custom data', () => {
    const err = new ApiError('Course not found', 404, { code: 'COURSE_NOT_FOUND' });
    expect(err.message).toBe('Course not found');
    expect(err.statusCode).toBe(404);
    expect(err.responseData).toEqual({ code: 'COURSE_NOT_FOUND' });
  });
});

describe('Real-Time WebSocket & Event Service', () => {
  it('dispatches events to registered type subscribers', () => {
    let receivedPayload: any = null;
    const unsubscribe = wsService.subscribe('clock_event', (evt) => {
      receivedPayload = evt.payload;
    });

    wsService.broadcast('clock_event', { personName: 'Dr. Adeyemi', status: 'on_time' });
    expect(receivedPayload).toEqual({ personName: 'Dr. Adeyemi', status: 'on_time' });

    unsubscribe();
  });

  it('wildcard listener receives all event types', () => {
    const receivedTypes: string[] = [];
    const unsubscribe = wsService.subscribe('*', (evt) => {
      receivedTypes.push(evt.type);
    });

    wsService.broadcast('clock_event', { test: 1 });
    wsService.broadcast('attendance_capture', { test: 2 });

    expect(receivedTypes).toContain('clock_event');
    expect(receivedTypes).toContain('attendance_capture');

    unsubscribe();
  });

  it('unsubscribing removes the callback', () => {
    let count = 0;
    const unsubscribe = wsService.subscribe('session_state', () => {
      count++;
    });

    wsService.broadcast('session_state', { active: true });
    expect(count).toBe(1);

    unsubscribe();
    wsService.broadcast('session_state', { active: false });
    expect(count).toBe(1);
  });
});

describe('Electron Service Native Fallbacks', () => {
  it('provides safe browser fallbacks when window.bcamsDesktop is undefined', async () => {
    expect(typeof isElectron()).toBe('boolean');

    const version = await getAppVersion();
    expect(version).toBeDefined();

    const platform = await getAppPlatform();
    expect(platform).toBeDefined();

    const sysTime = await getSystemTime();
    expect(sysTime).toHaveProperty('wallClock');
    expect(sysTime).toHaveProperty('monotonicNs');

    const scannerStatus = await getNativeScannerStatus();
    expect(scannerStatus).toHaveProperty('connected');
    expect(scannerStatus).toHaveProperty('model');
  });
});
