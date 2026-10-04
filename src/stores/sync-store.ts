/**
 * Sync & Clock Integrity Store
 * 
 * Manages synchronization state, offline queue, network simulation,
 * and FR-4 Monotonic-Clock Cross-Check calibration pairs.
 */
import { create } from 'zustand';
import type { SyncState, ConnectionStatus, ClockIntegrityStatus } from '@/types';
import { api } from '@/api';
import { offlineQueue } from '@/services/offline-queue-service';

export interface PendingQueueItem {
  id: string;
  type: 'attendance' | 'clock' | 'audit';
  description: string;
  timestamp: string;
  monotonicOffsetMs: number;
  clockIntegrity: ClockIntegrityStatus;
  deviceId: string;
}

export interface CalibrationPair {
  serverWallClock: string;
  deviceMonotonicMs: number;
  lastCalibratedAt: string;
}

interface SyncStoreState extends SyncState {
  pendingItems: PendingQueueItem[];
  calibrationPair: CalibrationPair;
  isSyncModalOpen: boolean;
  isInitialized: boolean;
  
  // Actions
  initializeQueue: () => Promise<void>;
  refresh: () => Promise<void>;
  setConnection: (status: ConnectionStatus) => void;
  toggleConnection: () => void;
  syncNow: () => Promise<boolean>;
  openSyncModal: () => void;
  closeSyncModal: () => void;
  addPendingItem: (item: Omit<PendingQueueItem, 'id' | 'monotonicOffsetMs' | 'clockIntegrity' | 'deviceId'>) => void;
  simulateClockDriftTest: (driftMinutes: number) => void;
  simulateOfflineRebootTest: () => void;
}

const initialCalibration: CalibrationPair = {
  serverWallClock: new Date().toISOString(),
  deviceMonotonicMs: performance.now(),
  lastCalibratedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
};

const initialPendingItems: PendingQueueItem[] = [
  {
    id: 'evt-pend-01',
    type: 'attendance',
    description: 'Chinedu Obi — CSC 201 Session',
    timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    monotonicOffsetMs: 480000,
    clockIntegrity: 'verified',
    deviceId: 'dev-001',
  },
  {
    id: 'evt-pend-02',
    type: 'attendance',
    description: 'Folake Ogunleye — CSC 201 Session',
    timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    monotonicOffsetMs: 360000,
    clockIntegrity: 'verified',
    deviceId: 'dev-001',
  },
  {
    id: 'evt-pend-03',
    type: 'clock',
    description: 'Mrs. Amara Okwu — Gate Clock-In',
    timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    monotonicOffsetMs: 240000,
    clockIntegrity: 'verified',
    deviceId: 'dev-gate-01',
  },
];

export const useSyncStore = create<SyncStoreState>((set, get) => ({
  connection: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online',
  pendingEvents: initialPendingItems.length,
  lastSyncAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  syncingNow: false,
  failedEvents: 0,
  pendingItems: initialPendingItems,
  calibrationPair: initialCalibration,
  isSyncModalOpen: false,
  isInitialized: false,

  initializeQueue: async () => {
    if (get().isInitialized) return;
    try {
      const storedCalibration = await offlineQueue.getCalibration();
      const persistedItems = await offlineQueue.getAll();

      if (persistedItems.length > 0) {
        set({
          pendingItems: persistedItems,
          pendingEvents: persistedItems.length,
          calibrationPair: storedCalibration || get().calibrationPair,
          isInitialized: true,
        });
      } else {
        // Seed initial mock items to offline store so it matches UI
        for (const item of initialPendingItems) {
          await offlineQueue.enqueue(item);
        }
        await offlineQueue.saveCalibration(initialCalibration);
        set({ isInitialized: true });
      }
    } catch {
      set({ isInitialized: true });
    }
  },

  refresh: async () => {
    try {
      const state = await api.getSyncState();
      set({
        pendingEvents: get().pendingItems.length,
        lastSyncAt: state.lastSyncAt,
      });
    } catch {
      // Silently fail
    }
  },

  setConnection: (status: ConnectionStatus) => {
    set({ connection: status });
    if (status === 'online' && get().pendingItems.length > 0) {
      // Automatic auto-replay upon reconnect (FR-3.2)
      get().syncNow().catch(() => {});
    }
  },

  toggleConnection: () => {
    const next = get().connection === 'online' ? 'offline' : 'online';
    get().setConnection(next);
  },

  openSyncModal: () => set({ isSyncModalOpen: true }),
  closeSyncModal: () => set({ isSyncModalOpen: false }),

  syncNow: async () => {
    const { connection, pendingItems } = get();
    if (connection === 'offline') {
      return false;
    }

    set({ syncingNow: true });

    try {
      // Simulate network round-trip and idempotent ingestion (FR-3.3)
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Update Calibration Pair on successful sync (FR-4.1)
      const newCalibration: CalibrationPair = {
        serverWallClock: new Date().toISOString(),
        deviceMonotonicMs: performance.now(),
        lastCalibratedAt: new Date().toISOString(),
      };

      // Clear local IndexedDB queue and persist updated calibration
      await offlineQueue.clear();
      await offlineQueue.saveCalibration(newCalibration);

      set({
        syncingNow: false,
        pendingEvents: 0,
        pendingItems: [],
        lastSyncAt: new Date().toISOString(),
        calibrationPair: newCalibration,
        failedEvents: 0,
      });

      return true;
    } catch {
      set({
        syncingNow: false,
        failedEvents: get().failedEvents + 1,
      });
      return false;
    }
  },

  addPendingItem: (item) => {
    const { calibrationPair } = get();
    const currentMonotonic = performance.now();
    const monotonicDeltaMs = currentMonotonic - calibrationPair.deviceMonotonicMs;
    
    // FR-4.2 Expected wall-clock calculation:
    const expectedTimeMs = new Date(calibrationPair.serverWallClock).getTime() + monotonicDeltaMs;
    const actualTimeMs = new Date(item.timestamp).getTime();
    const driftMinutes = Math.abs(actualTimeMs - expectedTimeMs) / (1000 * 60);

    // FR-4.3: Threshold > 5 minutes -> suspicious
    const clockIntegrity: ClockIntegrityStatus = driftMinutes > 5 ? 'suspicious' : 'verified';

    const newItem: PendingQueueItem = {
      ...item,
      id: `evt-pend-${Date.now().toString().slice(-4)}`,
      monotonicOffsetMs: monotonicDeltaMs,
      clockIntegrity,
      deviceId: 'dev-001',
    };

    const updated = [newItem, ...get().pendingItems];
    set({
      pendingItems: updated,
      pendingEvents: updated.length,
    });

    // Asynchronously persist to IndexedDB
    offlineQueue.enqueue(newItem).catch(() => {});
  },

  simulateClockDriftTest: (driftMinutes: number) => {
    // Deliberately induce clock divergence to test FR-4.3 Anomaly Flagging
    const driftedTimestamp = new Date(Date.now() + driftMinutes * 60 * 1000).toISOString();
    get().addPendingItem({
      type: 'attendance',
      description: `Test Drift Student (+${driftMinutes}m altered device clock)`,
      timestamp: driftedTimestamp,
    });
  },

  simulateOfflineRebootTest: () => {
    // FR-4.4: Device reboot during offline -> anchor lost -> mark unverified
    const newItem: PendingQueueItem = {
      id: `evt-reboot-${Date.now().toString().slice(-4)}`,
      type: 'attendance',
      description: 'Post-Reboot Offline Capture (Anchor Reset)',
      timestamp: new Date().toISOString(),
      monotonicOffsetMs: 0,
      clockIntegrity: 'unverified',
      deviceId: 'dev-001',
    };

    const updated = [newItem, ...get().pendingItems];
    set({
      pendingItems: updated,
      pendingEvents: updated.length,
    });

    offlineQueue.enqueue(newItem).catch(() => {});
  },
}));

// Setup window network connectivity listeners for automatic recovery
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useSyncStore.getState().setConnection('online');
  });

  window.addEventListener('offline', () => {
    useSyncStore.getState().setConnection('offline');
  });
}

