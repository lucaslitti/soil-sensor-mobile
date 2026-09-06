/**
 * BLE 原生传输层：封装 react-native-ble-plx。
 * 本层唯一接触原生库/原始字节，上层只见业务语义。
 */
import { BleManager, Device, ScanMode } from 'react-native-ble-plx';
import { AppError } from '../../../core/errors';
import { SENSOR_NAME_PREFIX, SCAN_TIMEOUT_MS } from '../../../core/constants/protocol';
import type { ScannedDevice } from '../domain/scanState';

export const bleManager = new BleManager();

export interface ScanHandler {
  onFound: (device: ScannedDevice) => void;
  onError: (error: AppError) => void;
  onTimeout: () => void;
}

/**
 * 按名称前缀扫描 Soil Sensor 设备。
 * 名称在 scan response 中，Android 上可能延迟到达，UI 需容忍"名称待定"。
 */
export function startScan(handler: ScanHandler): () => void {
  const seen = new Set<string>();
  const stopTimer = setTimeout(() => {
    bleManager.stopDeviceScan();
    handler.onTimeout();
  }, SCAN_TIMEOUT_MS);

  try {
    bleManager.startDeviceScan(null, { scanMode: ScanMode.LowLatency }, (error, device) => {
      if (error) {
        clearTimeout(stopTimer);
        handler.onError(new AppError('scan-timeout', error.message, error));
        return;
      }
      if (!device) return;
      const nameMatches = (device.name ?? '').startsWith(SENSOR_NAME_PREFIX);
      if (!nameMatches) return;
      if (seen.has(device.id)) return;
      seen.add(device.id);
      handler.onFound({
        id: device.id,
        name: device.name,
        rssi: device.rssi ?? 0,
        isConnectable: device.isConnectable ?? true,
      });
    });
  } catch (error) {
    clearTimeout(stopTimer);
    handler.onError(new AppError('bluetooth-unavailable', '无法启动扫描', error));
  }

  return () => {
    clearTimeout(stopTimer);
    bleManager.stopDeviceScan();
  };
}

export function getDevice(id: string): Promise<Device> {
  return bleManager.connectToDevice(id);
}
