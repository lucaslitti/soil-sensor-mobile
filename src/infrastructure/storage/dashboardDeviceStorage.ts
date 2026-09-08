import type { ScannedDevice } from '../../domain/ports/sensorGateway';
import { MMKV } from 'react-native-mmkv';

const STORAGE_KEY = '@ryobi/dashboard-devices';

type StoredDevice = {
  id: string;
  name: string | null;
  protocol: ScannedDevice['protocol'];
  rssi: number;
  isConnectable: boolean;
};

let storageInstance: MMKV | null = null;

function storage(): MMKV {
  if (!storageInstance) storageInstance = new MMKV({ id: 'ryobi-devices' });
  return storageInstance;
}

export async function loadDashboardDevices(): Promise<StoredDevice[]> {
  try {
    const value = storage().getString(STORAGE_KEY);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredDevice) as StoredDevice[];
  } catch {
    return [];
  }
}

export async function saveDashboardDevices(devices: readonly ScannedDevice[]): Promise<void> {
  const stored: StoredDevice[] = devices.map(({ id, name, protocol, rssi, isConnectable }) => ({
    id: id.value,
    name,
    protocol,
    rssi,
    isConnectable,
  }));
  storage().set(STORAGE_KEY, JSON.stringify(stored));
}

function isStoredDevice(value: unknown): value is StoredDevice {
  if (!value || typeof value !== 'object') return false;
  const device = value as Partial<ScannedDevice>;
  return (
    typeof device.id === 'string' &&
    (device.name === null || typeof device.name === 'string') &&
    typeof device.rssi === 'number' &&
    typeof device.isConnectable === 'boolean' &&
    (device.protocol === 'soil-sensor' || device.protocol === 'smart-pot')
  );
}
