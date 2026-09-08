import type { ScannedDevice } from '../../domain/ports/sensorGateway';

const STORAGE_KEY = '@ryobi/dashboard-devices';

type StoredDevice = {
  id: string;
  name: string | null;
  protocol: ScannedDevice['protocol'];
  rssi: number;
  isConnectable: boolean;
};

// MMKV is resolved lazily so domain/application tests do not load a native module.
type Storage = { getString(key: string): string | undefined; set(key: string, value: string): void };
let memoryValue: string | null = null;
function storage(): Storage {
  try {
    const { MMKV } = require('react-native-mmkv') as { MMKV: new (options: { id: string }) => Storage };
    return new MMKV({ id: 'ryobi-devices' });
  } catch {
    return {
      getString: () => memoryValue ?? undefined,
      set: (_key, value) => { memoryValue = value; },
    };
  }
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
