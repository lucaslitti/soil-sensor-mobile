import type { LiveReading } from '../entities/sensorDevice';
import type { SessionState } from '../entities/deviceSession';
import type { BondState } from '../value-objects/bondState';
import type { SmartPotSnapshot } from '../entities/smartPot';

export type DomainEvent =
  | { type: 'ReadingUpdated'; deviceId: string; reading: LiveReading }
  | { type: 'SmartPotSnapshotUpdated'; deviceId: string; snapshot: SmartPotSnapshot }
  | { type: 'DeviceStateChanged'; deviceId: string; state: SessionState; error?: string }
  | { type: 'BondStateChanged'; deviceId: string; bondState: BondState }
  | { type: 'DeviceDisconnected'; deviceId: string };

export interface DomainEventPublisher {
  publish(event: DomainEvent): void;
}
