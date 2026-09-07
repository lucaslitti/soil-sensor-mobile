import { useCallback, useEffect, useRef, useState } from 'react';
import type { Device } from 'react-native-ble-plx';
import { smartPotRepository } from '../data/smartPotRepository';
import type { ConnectionInfo } from '../domain/connectionState';
import type { SmartPotSnapshot } from '../domain/smartPot';

const INITIAL_CONNECTION: ConnectionInfo = { state: 'idle', deviceId: null, deviceName: null, error: null };

export function useSmartPot() {
  const [connection, setConnection] = useState<ConnectionInfo>(INITIAL_CONNECTION);
  const [snapshot, setSnapshot] = useState<SmartPotSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const deviceRef = useRef<Device | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshingRef = useRef(false);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const refresh = useCallback(async () => {
    const device = deviceRef.current;
    if (!device || refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      setSnapshot(await smartPotRepository.readSnapshot(device));
      setConnection(current => ({ ...current, state: 'reading', error: null }));
    } catch (error) {
      stopTimer();
      setConnection(current => ({ ...current, state: 'error', error: error instanceof Error ? error.message : '读取失败' }));
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [stopTimer]);

  const disconnect = useCallback(async () => {
    stopTimer();
    const device = deviceRef.current;
    deviceRef.current = null;
    if (device) await smartPotRepository.disconnect(device);
    setSnapshot(null);
    setConnection(INITIAL_CONNECTION);
  }, [stopTimer]);

  const connect = useCallback(async (deviceId: string, deviceName: string | null) => {
    await disconnect();
    setConnection({ state: 'connecting', deviceId, deviceName, error: null });
    try {
      deviceRef.current = await smartPotRepository.connect(deviceId);
      await refresh();
      timerRef.current = setInterval(refresh, 2000);
    } catch (error) {
      setConnection({ state: 'error', deviceId, deviceName, error: error instanceof Error ? error.message : '连接失败' });
    }
  }, [disconnect, refresh]);

  const write = useCallback(async (operation: (device: Device) => Promise<void>) => {
    if (!deviceRef.current) return;
    await operation(deviceRef.current);
    await new Promise<void>(resolve => setTimeout(() => resolve(), 800));
    await refresh();
  }, [refresh]);

  useEffect(() => () => {
    stopTimer();
    if (deviceRef.current) smartPotRepository.disconnect(deviceRef.current).catch(() => undefined);
  }, [stopTimer]);

  return { connection, snapshot, refreshing, connect, disconnect, refresh, write };
}
