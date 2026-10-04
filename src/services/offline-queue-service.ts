/**
 * BCAMS Offline Queue Service
 * 
 * IndexedDB persistence layer for FR-3 offline attendance & gate clock events.
 * Ensures unsynced records survive browser/app reloads and unexpected system shutdowns.
 * Includes graceful in-memory fallback for environments where IndexedDB is unavailable
 * (e.g. headless tests, sandboxed SSR).
 */
import type { PendingQueueItem, CalibrationPair } from '@/stores/sync-store';

const DB_NAME = 'bcams_offline_store';
const DB_VERSION = 1;
const STORE_EVENTS = 'pending_events';
const STORE_CALIBRATION = 'calibration_meta';

class OfflineQueueService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryEvents: Map<string, PendingQueueItem> = new Map();
  private memoryCalibration: CalibrationPair | null = null;
  private isIndexedDBAvailable: boolean;

  constructor() {
    this.isIndexedDBAvailable = typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
  }

  private getDB(): Promise<IDBDatabase> {
    if (!this.isIndexedDBAvailable) {
      return Promise.reject(new Error('IndexedDB not supported in current runtime'));
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        try {
          const request = window.indexedDB.open(DB_NAME, DB_VERSION);

          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            if (!db.objectStoreNames.contains(STORE_EVENTS)) {
              const eventStore = db.createObjectStore(STORE_EVENTS, { keyPath: 'id' });
              eventStore.createIndex('by_timestamp', 'timestamp', { unique: false });
              eventStore.createIndex('by_type', 'type', { unique: false });
              eventStore.createIndex('by_clockIntegrity', 'clockIntegrity', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORE_CALIBRATION)) {
              db.createObjectStore(STORE_CALIBRATION, { keyPath: 'key' });
            }
          };

          request.onsuccess = () => {
            resolve(request.result);
          };

          request.onerror = () => {
            this.dbPromise = null;
            reject(request.error || new Error('Failed to open IndexedDB'));
          };
        } catch (err) {
          this.dbPromise = null;
          reject(err);
        }
      });
    }

    return this.dbPromise;
  }

  /**
   * Persist a new offline queue item
   */
  async enqueue(item: PendingQueueItem): Promise<void> {
    if (!this.isIndexedDBAvailable) {
      this.memoryEvents.set(item.id, item);
      return;
    }

    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_EVENTS, 'readwrite');
        const store = tx.objectStore(STORE_EVENTS);
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback to memory
      this.memoryEvents.set(item.id, item);
    }
  }

  /**
   * Retrieve all pending offline items ordered by timestamp
   */
  async getAll(): Promise<PendingQueueItem[]> {
    if (!this.isIndexedDBAvailable) {
      return Array.from(this.memoryEvents.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }

    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_EVENTS, 'readonly');
        const store = tx.objectStore(STORE_EVENTS);
        const req = store.getAll();
        req.onsuccess = () => {
          const items = (req.result as PendingQueueItem[]) || [];
          items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          resolve(items);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return Array.from(this.memoryEvents.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }
  }

  /**
   * Remove synchronized items by ID
   */
  async remove(ids: string[]): Promise<void> {
    ids.forEach(id => this.memoryEvents.delete(id));

    if (!this.isIndexedDBAvailable) return;

    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_EVENTS, 'readwrite');
        const store = tx.objectStore(STORE_EVENTS);
        ids.forEach(id => store.delete(id));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Memory already updated
    }
  }

  /**
   * Clear all pending items from store
   */
  async clear(): Promise<void> {
    this.memoryEvents.clear();
    if (!this.isIndexedDBAvailable) return;

    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_EVENTS, 'readwrite');
        const store = tx.objectStore(STORE_EVENTS);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Memory already cleared
    }
  }

  /**
   * Count pending items in queue
   */
  async count(): Promise<number> {
    if (!this.isIndexedDBAvailable) {
      return this.memoryEvents.size;
    }

    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_EVENTS, 'readonly');
        const store = tx.objectStore(STORE_EVENTS);
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.memoryEvents.size;
    }
  }

  /**
   * Save FR-4 calibration pair to persistent storage
   */
  async saveCalibration(calibration: CalibrationPair): Promise<void> {
    this.memoryCalibration = calibration;
    if (!this.isIndexedDBAvailable) return;

    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CALIBRATION, 'readwrite');
        const store = tx.objectStore(STORE_CALIBRATION);
        const req = store.put({ key: 'last_calibration', ...calibration });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Memory already updated
    }
  }

  /**
   * Retrieve last stored calibration pair
   */
  async getCalibration(): Promise<CalibrationPair | null> {
    if (!this.isIndexedDBAvailable) {
      return this.memoryCalibration;
    }

    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CALIBRATION, 'readonly');
        const store = tx.objectStore(STORE_CALIBRATION);
        const req = store.get('last_calibration');
        req.onsuccess = () => {
          if (req.result) {
            const { serverWallClock, deviceMonotonicMs, lastCalibratedAt } = req.result;
            resolve({ serverWallClock, deviceMonotonicMs, lastCalibratedAt });
          } else {
            resolve(null);
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.memoryCalibration;
    }
  }
}

export const offlineQueue = new OfflineQueueService();
