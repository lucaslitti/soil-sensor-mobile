import type { Device } from 'react-native-ble-plx';
import { gattRepository } from '../../features/sensor/data/gattRepository';
import { startScan } from '../../features/scanner/data/bleTransport';
import type { DeviceConnection } from '../../domain/entities/deviceSession';
import type { LiveReading } from '../../domain/entities/sensorDevice';
import type { SensorGateway, ScannedDevice } from '../../domain/ports/sensorGateway';
import type { HistoryLevel, SensorRecord } from '../../domain/ports/sensorGateway';
import { DeviceId } from '../../domain/value-objects/deviceId';

export class BleSensorGateway implements SensorGateway {
  private readonly devices = new Map<string, Device>();

  async *scan(): AsyncGenerator<ScannedDevice> {
    const queue: ScannedDevice[] = [];
    let resolve: (() => void) | null = null;
    let done = false;
    const stop = startScan({
      onFound: device => {
        queue.push({
          ...device,
          id: DeviceId.create(device.id),
        });
        resolve?.();
        resolve = null;
      },
      onError: () => {
        done = true;
        resolve?.();
      },
      onTimeout: () => {
        done = true;
        resolve?.();
      },
    });
    try {
      while (!done || queue.length) {
        if (!queue.length) await new Promise<void>(r => { resolve = r; });
        while (queue.length) yield queue.shift()!;
      }
    } finally {
      stop();
    }
  }

  async connect(id: DeviceId, protocol: 'soil-sensor' | 'smart-pot' = 'soil-sensor'): Promise<DeviceConnection> {
    if (protocol !== 'soil-sensor') throw new Error('Use SmartPotGateway for SmartPot devices');
    const device = await gattRepository.connect(id.value);
    this.devices.set(id.value, device);
    await gattRepository.setReadingEnabled(device, true);
    return { deviceId: id, protocol, native: device };
  }

  async disconnect(connection: DeviceConnection): Promise<void> {
    const device = this.deviceOf(connection);
    this.devices.delete(connection.deviceId.value);
    await gattRepository.setReadingEnabled(device, false).catch(() => undefined);
    await gattRepository.disconnect(device);
  }

  async readLive(connection: DeviceConnection): Promise<LiveReading> {
    return gattRepository.readLive(this.deviceOf(connection));
  }

  async readHistory(connection: DeviceConnection, level: HistoryLevel): Promise<readonly SensorRecord[]> {
    const device = this.deviceOf(connection);
    const read = async (target: 'latest' | 'l1' | 'l2') => {
      if (target === 'latest') return gattRepository.readLatest(device);
      if (target === 'l1') return gattRepository.readL1(device);
      return gattRepository.readL2(device);
    };
    const subRecords = level === 'all'
      ? [...await read('l2'), ...await read('l1')]
      : await read(level);
    return [{ deviceId: connection.deviceId.value, capturedAt: Date.now(), subRecords }];
  }

  private deviceOf(connection: DeviceConnection): Device {
    const device = this.devices.get(connection.deviceId.value) ?? connection.native;
    if (!device || typeof device !== 'object') throw new Error('Device connection is missing');
    return device as Device;
  }
}
