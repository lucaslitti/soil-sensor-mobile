import { create } from 'zustand';
import type { LiveReading } from '../../sensor/domain/codec';
import type { SmartPotSnapshot } from '../../sensor/domain/smartPot';
import type { DashboardConnectionState, DashboardDevice } from '../domain/dashboardDevice';

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
    set((s) => ({
      devices: {
        ...s.devices,
        [id]: {
          ...(s.devices[id] ?? EMPTY),
          connection,
          error,
        },
      },
    })),
  setReading: (id, reading) =>
    set((s) => ({
      devices: {
        ...s.devices,
        [id]: {
          ...(s.devices[id] ?? EMPTY),
          connection: 'reading',
          reading,
          error: null,
          lastUpdated: reading.timestamp,
        },
      },
    })),
  setSnapshot: (id, snapshot) =>
    set((s) => ({
      devices: {
        ...s.devices,
        [id]: {
          ...(s.devices[id] ?? EMPTY),
          connection: 'reading',
          snapshot,
          error: null,
          lastUpdated: Date.now(),
        },
      },
    })),
  remove: (id) =>
    set((s) => {
      const next = { ...s.devices };
      delete next[id];
      return { devices: next };
    }),
}));