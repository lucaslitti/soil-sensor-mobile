import type { BondState } from '../value-objects/bondState';
import type { DeviceId } from '../value-objects/deviceId';

export type SensorConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'failed';

export interface LiveReading {
  moisturePercent: number;
  temperatureC: number;
  soilEc: number;
  timestamp: number;
  source: 'gatt';
  receivedAt?: number;
  sessionId?: string;
  operationId?: string;
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

  markConnected(): void {
    if (this._state !== 'connecting') throw new Error('Device is not connecting');
    this._state = 'connected';
  }

  applyReading(reading: LiveReading): void {
    this._latestReading = reading;
    this._lastActiveAt = reading.timestamp;
    this._state = 'connected';
    this._error = null;
  }

  updateBondState(state: BondState): void {
    this._bondState = state;
  }

  markFailed(error: string): void {
    this._state = 'failed';
    this._error = error;
  }

  markDisconnected(): void {
    this._state = 'disconnected';
  }

  isIdleForEviction(now: number, idleMs: number): boolean {
    return this._lastActiveAt === null || now - this._lastActiveAt >= idleMs;
  }
}
