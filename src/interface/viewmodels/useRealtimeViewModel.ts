import { useCallback, useEffect, useState } from 'react';
import { readLiveUseCase } from '../../application/compositionRoot';
import { dashboardManager } from '../services/devicePresentationCoordinator';
import { useDeviceStore } from '../stores/deviceStore';
import type { ConnectionInfo } from './presentationTypes';
import type { LiveReading } from '../../domain/entities/sensorDevice';

export function useRealtimeViewModel(deviceId?: string, deviceName?: string | null) {
  const device = useDeviceStore(state => (deviceId ? state.devices[deviceId] : undefined));
  const [connection, setConnection] = useState<ConnectionInfo>({ state: 'idle', deviceId: null, deviceName: null, error: null });
  const [isReading, setIsReading] = useState(true);
  const reading = (device?.reading ?? null) as LiveReading | null;

  useEffect(() => {
    if (!deviceId) return;
    setConnection({
      state: device?.connection === 'reading' ? 'reading' : device?.connection === 'error' ? 'error' : 'connecting',
      deviceId,
      deviceName: deviceName ?? null,
      error: device?.error ?? null,
    });
  }, [deviceId, deviceName, device?.connection, device?.error]);

  const refresh = useCallback(async () => {
    if (!deviceId || !isReading) return;
    try {
      await readLiveUseCase.execute(deviceId);
    } catch (error) {
      setConnection(current => ({ ...current, state: 'error', error: error instanceof Error ? error.message : 'Read failed' }));
    }
  }, [deviceId, isReading]);

  const connect = useCallback(async (id = deviceId, name = deviceName) => {
    if (!id) return;
    setConnection({ state: 'connecting', deviceId: id, deviceName: name ?? null, error: null });
    await readLiveUseCase.execute(id);
  }, [deviceId, deviceName]);

  const disconnect = useCallback(async () => {
    if (deviceId) dashboardManager.remove(deviceId);
    setConnection(current => ({ ...current, state: 'idle', deviceId: null, deviceName: null }));
  }, [deviceId]);

  const setReadingEnabled = useCallback(async (enabled: boolean) => {
    setIsReading(enabled);
    if (enabled) await refresh();
  }, [refresh]);

  return { connection, reading, isReading, device: device ? {} : null, connect, disconnect, setReadingEnabled, refresh };
}
