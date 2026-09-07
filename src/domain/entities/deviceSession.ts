import type { DeviceId } from '../value-objects/deviceId';

export type SessionState =
  | 'disconnected'
  | 'connecting'
  | 'ready'
  | 'polling'
  | 'readingHistory'
  | 'disconnecting'
  | 'failed';

export interface DeviceConnection {
  readonly deviceId: DeviceId;
  readonly protocol?: 'soil-sensor' | 'smart-pot';
  readonly native?: unknown;
}

/** 一次真实 BLE 连接生命周期，和 SensorDevice 业务实体分离。 */
export class DeviceSession {
  private _state: SessionState = 'disconnected';
  private _connection: DeviceConnection | null = null;

  constructor(readonly deviceId: DeviceId, readonly sessionId: string) {}

  get state(): SessionState {
    return this._state;
  }

  get connection(): DeviceConnection | null {
    return this._connection;
  }

  attach(connection: DeviceConnection): void {
    if (this._state !== 'connecting' && this._state !== 'disconnected') {
      throw new Error(`Cannot attach session from ${this._state}`);
    }
    this._connection = connection;
    this._state = 'ready';
  }

  startPolling(): void {
    if (this._state !== 'ready' && this._state !== 'polling') {
      throw new Error(`Cannot start polling from ${this._state}`);
    }
    this._state = 'polling';
  }

  startHistoryReading(): void {
    if (this._state !== 'polling') throw new Error('History requires polling state');
    this._state = 'readingHistory';
  }

  finishHistoryReading(): void {
    if (this._state !== 'readingHistory') throw new Error('Session is not reading history');
    this._state = 'polling';
  }

  beginConnect(): void {
    if (this._state !== 'disconnected' && this._state !== 'failed') {
      throw new Error(`Cannot connect from ${this._state}`);
    }
    this._state = 'connecting';
  }

  disconnect(): void {
    if (this._state === 'disconnected') return;
    this._state = 'disconnecting';
  }

  markDisconnected(): void {
    this._state = 'disconnected';
    this._connection = null;
  }

  fail(): void {
    this._state = 'failed';
  }
}
