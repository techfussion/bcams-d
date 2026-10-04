/**
 * BCAMS Desktop - Real-Time WebSocket & Event Stream Service
 * 
 * Manages live bidirectional event streams for:
 * - Real-time gate clock events
 * - Lecture hall biometric attendance capture feeds
 * - Session authorization status changes
 * - Device tamper alerts & clock drift warnings
 */
export type RealtimeEventType = 
  | 'clock_event' 
  | 'attendance_capture' 
  | 'session_state' 
  | 'device_alert' 
  | 'sync_completed';

export interface RealtimeEvent<T = any> {
  id: string;
  type: RealtimeEventType;
  timestamp: string;
  payload: T;
}

export type EventListener<T = any> = (event: RealtimeEvent<T>) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private url: string;
  private listeners: Map<RealtimeEventType | '*', Set<EventListener>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectIntervalMs = 3000;
  private isConnected = false;
  private simulationInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.url = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL) || 'ws://localhost:8000/ws/events';
  }

  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };

      this.socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as RealtimeEvent;
          this.dispatch(parsed);
        } catch {
          // Ignore malformed payloads
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.handleReconnect();
      };

      this.socket.onerror = () => {
        this.isConnected = false;
      };
    } catch {
      // In standalone / web sandbox environment, WS server may not exist
      this.isConnected = false;
      this.handleReconnect();
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), this.reconnectIntervalMs * Math.min(this.reconnectAttempts, 4));
    }
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.stopSimulation();
  }

  public isSocketConnected(): boolean {
    return this.isConnected;
  }

  public subscribe<T = any>(type: RealtimeEventType | '*', callback: EventListener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);

    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  public dispatch<T = any>(event: RealtimeEvent<T>): void {
    // Specific listeners
    const specific = this.listeners.get(event.type);
    if (specific) {
      specific.forEach(cb => cb(event));
    }

    // Wildcard listeners
    const wildcard = this.listeners.get('*');
    if (wildcard) {
      wildcard.forEach(cb => cb(event));
    }
  }

  public broadcast<T = any>(type: RealtimeEventType, payload: T): void {
    const event: RealtimeEvent<T> = {
      id: `rt-evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      timestamp: new Date().toISOString(),
      payload,
    };

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event));
    }

    // Local dispatch
    this.dispatch(event);
  }

  /**
   * Start periodic live background feed simulation for testing/demo
   */
  public startSimulation(): void {
    if (this.simulationInterval) return;

    const names = ['Amina Bello', 'Kehinde Balogun', 'Dr. F. Alabi', 'Grace Bassey', 'Tunde Bakare'];
    let idx = 0;

    this.simulationInterval = setInterval(() => {
      const name = names[idx % names.length];
      idx++;

      this.dispatch({
        id: `sim-clock-${Date.now()}`,
        type: 'clock_event',
        timestamp: new Date().toISOString(),
        payload: {
          personName: name,
          department: 'Computer Science',
          direction: 'in',
          status: 'on_time',
        },
      });
    }, 25000);
  }

  public stopSimulation(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }
}

export const wsService = new WebSocketService();
