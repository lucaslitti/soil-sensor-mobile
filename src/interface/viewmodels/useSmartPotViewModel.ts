import { useCallback, useEffect, useState } from 'react';
import { controlSmartPotUseCase, readLiveUseCase } from '../../application/compositionRoot';
import type { SmartPotCommand } from '../../application/usecases/controlSmartPot';
import { dashboardManager } from './devicePresentationCoordinator';
import { useDeviceStore } from '../stores/deviceStore';
import type { ConnectionInfo } from './presentationTypes';
import type { SmartPotSnapshot } from '../../domain/entities/smartPot';

const INITIAL: ConnectionInfo = { state: 'idle', deviceId: null, deviceName: null, error: null };

/** Presentation adapter. BLE lifecycle and writes remain in Application Runtime. */
export function useSmartPotViewModel(deviceId?: string, deviceName?: string | null) {
  const device = useDeviceStore(state => (deviceId ? state.devices[deviceId] : undefined));
  const [connection, setConnection] = useState<ConnectionInfo>(INITIAL);
  const [refreshing, setRefreshing] = useState(false);
  const snapshot = (device?.snapshot ?? null) as SmartPotSnapshot | null;

  useEffect(() => {
    if (!deviceId) return;
    setConnection(current => ({ ...current, deviceId, deviceName: deviceName ?? null, state: device?.connection === 'reading' ? 'reading' : 'connecting', error: device?.error ?? null }));
  }, [deviceId, deviceName, device?.connection, device?.error]);

  const refresh = useCallback(async () => {
    if (!deviceId) return;
    setRefreshing(true);
    try {
      await readLiveUseCase.execute(deviceId);
      setConnection(current => ({ ...current, state: 'reading', error: null }));
    } catch (error) {
      setConnection(current => ({ ...current, state: 'error', error: error instanceof Error ? error.message : 'Read failed' }));
    } finally {
      setRefreshing(false);
    }
  }, [deviceId]);

  const disconnect = useCallback(async () => {
    if (deviceId) dashboardManager.remove(deviceId);
    setConnection(INITIAL);
  }, [deviceId]);

  const connect = useCallback(async () => {
    if (!deviceId) return;
    await dashboardManager.connect(deviceId);
    await refresh();
  }, [deviceId, refresh]);

  const write = useCallback(async (command: SmartPotCommand) => {
    if (!deviceId) return;
    await controlSmartPotUseCase.execute(deviceId, command);
    await refresh();
  }, [deviceId, refresh]);

  return { connection, snapshot, refreshing, connect, disconnect, refresh, write };
}
