import {
  applicationEvents,
  connectDeviceUseCase,
  disconnectDeviceUseCase,
  readLiveUseCase,
  dashboardDeviceStorage,
} from '../../application/compositionRoot';
import { DeviceId } from '../../domain/value-objects/deviceId';
import type { ScannedDevice } from '../../domain/ports/sensorGateway';
import { useDeviceStore } from '../stores/deviceStore';

let subscribed = false;
let restorePromise: Promise<void> | null = null;
let restored = false;

function ensureEventProjection(): void {
  if (subscribed) return;
  subscribed = true;
  applicationEvents.subscribe(event => {
    if (event.type === 'ReadingUpdated') {
      useDeviceStore.getState().setReading(event.deviceId, event.reading);
    } else if (event.type === 'SmartPotSnapshotUpdated') {
      useDeviceStore.getState().setSnapshot(event.deviceId, event.snapshot);
    } else if (event.type === 'DeviceStateChanged') {
      const state = event.state === 'failed' ? 'error' : event.state === 'polling' ? 'reading' : 'connecting';
      useDeviceStore.getState().setConnection(event.deviceId, state, event.error ?? null);
    }
  });
}

/** V4 Application Coordinator 的 Dashboard 适配器。 */
export const dashboardManager = {
  add(device: ScannedDevice): void {
    ensureEventProjection();
    const id = device.id.value;
    useDeviceStore.getState().upsert({
      id,
      name: device.name ?? id,
      protocol: device.protocol,
      rssi: device.rssi,
    });
    connectDeviceUseCase.execute(device).catch(() => undefined);
    this.persist().catch(() => undefined);
  },

  async connect(id: string): Promise<void> {
    const device = useDeviceStore.getState().devices[id];
    if (!device) return;
    await connectDeviceUseCase.execute({
      id: DeviceId.create(device.id),
      name: device.name || null,
      protocol: device.protocol,
      rssi: device.rssi ?? -100,
      isConnectable: true,
    });
  },

  remove(id: string): void {
    disconnectDeviceUseCase.execute(id).catch(() => undefined).finally(() => {
      useDeviceStore.getState().remove(id);
      this.persist().catch(() => undefined);
    });
  },

  async restore(): Promise<void> {
    if (restored) return;
    if (restorePromise) return restorePromise;
    restorePromise = (async () => {
      ensureEventProjection();
      const devices = await dashboardDeviceStorage.load();
      const devicesToConnect: ScannedDevice[] = [];
      devices.forEach(device => {
        const restoredDevice = { ...device, id: DeviceId.create(device.id) };
        if (!useDeviceStore.getState().devices[device.id]) {
          useDeviceStore.getState().upsert({
            id: device.id,
            name: device.name ?? device.id,
            protocol: device.protocol,
            rssi: device.rssi,
          });
        }
        devicesToConnect.push(restoredDevice);
      });
      await Promise.all(
        devicesToConnect.map(device => connectDeviceUseCase.execute(device)),
      );
      restored = true;
    })();
    try {
      await restorePromise;
    } finally {
      restorePromise = null;
    }
  },

  reconnect(device: ScannedDevice): void {
    disconnectDeviceUseCase.execute(device.id.value).catch(() => undefined).finally(() => this.add(device));
  },

  refresh(ids: readonly string[]): Promise<void> {
    return Promise.all(ids.map(id => readLiveUseCase.execute(id))).then(() => undefined);
  },

  async persist(): Promise<void> {
    if (restorePromise) await restorePromise;
    const devices = Object.values(useDeviceStore.getState().devices).map(device => ({
      id: device.id,
      name: device.name || null,
      protocol: device.protocol,
      rssi: device.rssi ?? -100,
      isConnectable: true,
    }));
    await dashboardDeviceStorage.save(devices.map(device => ({ ...device, id: DeviceId.create(device.id) })));
  },

  destroy(): void {
    // Runtime shutdown is owned by the composition root lifecycle coordinator.
  },
};
