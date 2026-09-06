import { useCallback, useEffect, useRef, useState } from 'react';
import type { Device } from 'react-native-ble-plx';
import { gattRepository } from '../data/gattRepository';
import type { ConnectionInfo } from '../domain/connectionState';
import type { LiveReading } from '../domain/codec';

interface GattReaderState {
  connection: ConnectionInfo;
  reading: LiveReading | null;
  isReading: boolean;
}

const INITIAL: GattReaderState = {
  connection: {
    state: 'idle',
    deviceId: null,
    deviceName: null,
    error: null,
  },
  reading: null,
  isReading: false,
};

/**
 * 单设备连接 + 实时读数编排。
 * 连接 -> 服务发现 -> 写 0x01 开启读数 -> 3s 轮询实时特征。
 */
export function useGattReader() {
  const [state, setState] = useState<GattReaderState>(INITIAL);
  const deviceRef = useRef<Device | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readingEnabledRef = useRef(false);

  const setConnection = useCallback((patch: Partial<ConnectionInfo>) => {
    setState((s) => ({
      ...s,
      connection: { ...s.connection, ...patch },
    }));
  }, []);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const stopPolling = useCallback(() => {
    clearPoll();
    setState((s) => ({ ...s, isReading: false }));
  }, [clearPoll]);

  const pollOnce = useCallback(async () => {
    const device = deviceRef.current;
    if (!device || !readingEnabledRef.current) return;
    try {
      const reading = await gattRepository.readLive(device);
      setState((s) => ({ ...s, reading }));
    } catch (e) {
      setState((s) => ({
        ...s,
        connection: {
          ...s.connection,
          state: 'error',
          error: e instanceof Error ? e.message : '读取失败',
        },
      }));
    }
  }, []);

  const disconnect = useCallback(async () => {
    stopPolling();
    readingEnabledRef.current = false;
    const device = deviceRef.current;
    deviceRef.current = null;
    if (device) {
      await gattRepository.disconnect(device);
    }
    setState(INITIAL);
  }, [stopPolling]);

  const connect = useCallback(
    async (deviceId: string, deviceName: string | null) => {
      await disconnect();
      setConnection({ state: 'connecting', deviceId, deviceName, error: null });
      setState((s) => ({ ...s, reading: null }));
      try {
        const device = await gattRepository.connect(deviceId);
        deviceRef.current = device;
        setConnection({ state: 'ready' });
        await gattRepository.setReadingEnabled(device, true);
        readingEnabledRef.current = true;
        setConnection({ state: 'reading' });
        await pollOnce();
        clearPoll();
        pollRef.current = setInterval(pollOnce, 3000);
        setState((s) => ({ ...s, isReading: true }));
      } catch (e) {
        setConnection({
          state: 'error',
          error: e instanceof Error ? e.message : '连接失败',
        });
        deviceRef.current = null;
      }
    },
    [disconnect, setConnection, pollOnce, clearPoll],
  );

  const setReadingEnabled = useCallback(
    async (enabled: boolean) => {
      const device = deviceRef.current;
      if (!device) return;
      readingEnabledRef.current = enabled;
      await gattRepository.setReadingEnabled(device, enabled);
      if (enabled) {
        setConnection({ state: 'reading' });
        clearPoll();
        pollRef.current = setInterval(pollOnce, 3000);
        setState((s) => ({ ...s, isReading: true }));
      } else {
        stopPolling();
      }
    },
    [setConnection, clearPoll, pollOnce, stopPolling],
  );

  useEffect(() => {
    return () => {
      clearPoll();
      if (deviceRef.current) {
        gattRepository.disconnect(deviceRef.current);
      }
    };
  }, [clearPoll]);

  return {
    connection: state.connection,
    reading: state.reading,
    isReading: state.isReading,
    device: deviceRef.current,
    connect,
    disconnect,
    setReadingEnabled,
  };
}
