import type { SensorGateway } from '../../domain/ports/sensorGateway';
import type { PermissionGateway } from '../ports/permissionGateway';

export class ScanDevicesUseCase {
  constructor(private readonly gateway: SensorGateway, private readonly permissions: PermissionGateway) {}
  async *scan() {
    if (!await this.permissions.requestBluetooth()) throw new Error('Bluetooth permission not granted');
    yield* this.gateway.scan();
  }
}
