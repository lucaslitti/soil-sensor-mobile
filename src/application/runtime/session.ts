import type { DeviceId } from '../../domain/value-objects/deviceId';
import type { SessionId } from './operationContext';

/** Connection-lifecycle identity used to reject results from an old connection. */
export class Session {
  private active = true;

  constructor(readonly deviceId: DeviceId, readonly id: SessionId) {}

  invalidate(): void {
    this.active = false;
  }

  isCurrent(id: SessionId): boolean {
    return this.active && id === this.id;
  }
}
