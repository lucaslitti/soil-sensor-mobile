import type { BondState } from '../value-objects/bondState';
import type { DeviceId } from '../value-objects/deviceId';

export type SensorConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'ready'
  | 'polling'
  | 'readingHistory'
  | 'disconnecting'
  | 'failed';

export interface LiveReading {
  moisturePercent: number;
  temperatureC: number;
  soilEc: number;
  timestamp: number;
  source: 'gatt';
}

export class SensorDevice {
  private _state: SensorConnectionState = 'disconnected';
  private _bondState: BondState = 'none';
  private _lastActiveAt: number | null = null;
  private _latestReading: LiveReading | null = null;
  private _error: string | null = null;

  constructor(
    readonly id: DeviceId,
    readonly name: string | null,
  ) {}

  get state(): SensorConnectionState {
    return this._state;
  }

  get bondState(): BondState {
    return this._bondState;
  }

  get latestReading(): LiveReading | null {
    return this._latestReading;
  }

  get lastActiveAt(): number | null {
    return this._lastActiveAt;
  }

  get error(): string | null {
    return this._error;
  }

  markConnecting(): void {
    this._state = 'connecting';
    this._error = null;
  }

  markReady(): void {
    if (this._state !== 'connecting') throw new Error('Device is not connecting');
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
    if (this._state !== 'readingHistory') throw new Error('Device is not reading history');
    this._state = 'polling';
  }

  applyReading(reading: LiveReading): void {
    this._latestReading = reading;
    this._lastActiveAt = reading.timestamp;
    this._state = 'polling';
    this._error = null;
  }

  updateBondState(state: BondState): void {
    this._bondState = state;
  }

  markFailed(error: string): void {
    this._state = 'failed';
    this._error = error;
  }

  disconnect(): void {
    this._state = 'disconnecting';
  }

  markDisconnected(): void {
    this._state = 'disconnected';
  }

  isIdleForEviction(now: number, idleMs: number): boolean {
    return this._lastActiveAt === null || now - this._lastActiveAt >= idleMs;
  }
}
