import type { SensorGateway } from '../../domain/ports/sensorGateway';

export class ScanDevicesUseCase {
  constructor(private readonly gateway: SensorGateway) {}
  scan() {
    return this.gateway.scan();
  }
}
