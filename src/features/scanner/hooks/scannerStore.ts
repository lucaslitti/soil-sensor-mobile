import { create } from 'zustand';
import type { ScannedDevice } from '../domain/scanState';

interface ScannerState {
  state: 'idle' | 'scanning' | 'stopped' | 'error';
  devices: ScannedDevice[];
  error: string | null;
  setState: (s: ScannerState['state'], error?: string) => void;
  upsert: (d: ScannedDevice) => void;
  reset: () => void;
}

export const useScannerStore = create<ScannerState>((set) => ({
  state: 'idle',
  devices: [],
  error: null,
  setState: (state, error) =>
    set({
      state,
      error: state === 'error' ? error ?? '扫描出错' : null,
    }),
  upsert: (device) =>
    set((s) => ({
      devices: s.devices.some((d) => d.id === device.id)
        ? s.devices.map((d) => (d.id === device.id ? device : d))
        : [...s.devices, device],
    })),
  reset: () => set({ devices: [], error: null, state: 'idle' }),
}));
