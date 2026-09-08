import type { LiveReading } from '../entities/sensorDevice';
export type DeviceEventState = 'connecting' | 'polling' | 'connected' | 'disconnected' | 'failed';
import type { BondState } from '../value-objects/bondState';
import type { SmartPotSnapshot } from '../entities/smartPot';

export type DomainEvent =
  | { type: 'ReadingUpdated'; deviceId: string; reading: LiveReading }
  | { type: 'SmartPotSnapshotUpdated'; deviceId: string; snapshot: SmartPotSnapshot }
  | { type: 'DeviceStateChanged'; deviceId: string; state: DeviceEventState; error?: string }
  | { type: 'BondStateChanged'; deviceId: string; bondState: BondState }
  | { type: 'DeviceDisconnected'; deviceId: string }
  | { type: 'HistorySynced'; deviceId: string; count: number };

export interface DomainEventPublisher {
  publish(event: DomainEvent): void;
}
