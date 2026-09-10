import { BleManager, type Device, ScanMode } from 'react-native-ble-plx';
import { AppError } from './errors';
import { SCAN_TIMEOUT_MS, SENSOR_NAME_PREFIX, SMART_POT_NAME_PREFIX } from './protocol';
import type { ScannedDevice } from '../../domain/ports/sensorGateway';
import { DeviceId } from '../../domain/value-objects/deviceId';
import { logBleError } from './bleLogger';

export const bleManager = new BleManager();

export interface ScanHandler {
  onFound: (device: ScannedDevice) => void;
  onError: (error: AppError) => void;
  onTimeout: () => void;
}

export function startScan(handler: ScanHandler): () => void {
  const seen = new Set<string>();
  let stopped = false;
  const stopTimer = setTimeout(() => {
    if (stopped) return;
    bleManager.stopDeviceScan();
    handler.onTimeout();
  }, SCAN_TIMEOUT_MS);

  try {
    bleManager.startDeviceScan(null, { scanMode: ScanMode.LowLatency }, (error, device) => {
      if (error) {
        clearTimeout(stopTimer);
        logBleError('scan.error', error);
        handler.onError(new AppError('scan-timeout', error.message, error));
        return;
      }
      if (!device || seen.has(device.id)) return;
      const name = device.name ?? '';
      const protocol = name.startsWith(SMART_POT_NAME_PREFIX)
        ? 'smart-pot'
        : name.startsWith(SENSOR_NAME_PREFIX)
          ? 'soil-sensor'
          : null;
      if (!protocol) return;
      seen.add(device.id);
      handler.onFound({
        id: DeviceId.create(device.id),
        name: device.name,
        rssi: device.rssi ?? 0,
        isConnectable: device.isConnectable ?? true,
        protocol,
      });
    });
  } catch (error) {
    clearTimeout(stopTimer);
    logBleError('scan.start.error', error);
    handler.onError(new AppError('bluetooth-unavailable', 'Unable to start scanning', error));
  }

  return () => {
    stopped = true;
    clearTimeout(stopTimer);
    bleManager.stopDeviceScan();
  };
}

export function getDevice(id: string): Promise<Device> {
  return bleManager.connectToDevice(id);
}
