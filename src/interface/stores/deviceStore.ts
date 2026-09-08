import { create } from 'zustand';
import type { LiveReading } from '../../domain/entities/sensorDevice';
import type { SmartPotSnapshot } from '../../domain/entities/smartPot';
import type { DashboardConnectionState, DashboardDevice } from '../viewmodels/dashboardTypes';

const EMPTY: DashboardDevice = {
  id: '',
  name: '',
  protocol: 'soil-sensor',
  connection: 'connecting',
  reading: null,
  snapshot: null,
  rssi: null,
  lastUpdated: null,
  error: null,
};

interface DashboardStoreState {
  devices: Record<string, DashboardDevice>;
  upsert: (patch: Partial<DashboardDevice> & { id: string }) => void;
  setConnection: (
    id: string,
    connection: DashboardConnectionState,
    error?: string | null,
  ) => void;
  setReading: (id: string, reading: LiveReading) => void;
  setSnapshot: (id: string, snapshot: SmartPotSnapshot) => void;
  remove: (id: string) => void;
}

/** 全局设备看板：跨页面（Dashboard / Scanner / Detail）共享设备与实时读数。 */
export const useDashboardStore = create<DashboardStoreState>((set) => ({
  devices: {},
  upsert: (patch) =>
    set((s) => ({
      devices: {
        ...s.devices,
        [patch.id]: { ...(s.devices[patch.id] ?? EMPTY), ...patch },
      },
    })),
  setConnection: (id, connection, error = null) =>
    set((s) => {
      const device = s.devices[id];
      if (!device) return s;
      return {
        devices: {
          ...s.devices,
          [id]: { ...device, connection, error },
        },
      };
    }),
  setReading: (id, reading) =>
    set((s) => {
      const device = s.devices[id];
      if (!device) return s;
      return {
        devices: {
          ...s.devices,
          [id]: {
            ...device,
            connection: 'reading',
            reading,
            error: null,
            lastUpdated: reading.timestamp,
          },
        },
      };
    }),
  setSnapshot: (id, snapshot) =>
    set((s) => {
      const device = s.devices[id];
      if (!device) return s;
      return {
        devices: {
          ...s.devices,
          [id]: {
            ...device,
            connection: 'reading',
            snapshot,
            error: null,
            lastUpdated: Date.now(),
          },
        },
      };
    }),
  remove: (id) =>
    set((s) => {
      const next = { ...s.devices };
      delete next[id];
      return { devices: next };
    }),
}));

export const useDeviceStore = useDashboardStore;
