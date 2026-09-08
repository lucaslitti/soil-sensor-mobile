import { DeviceId } from '../src/domain/value-objects/deviceId';
import { loadDashboardDevices, saveDashboardDevices } from '../src/infrastructure/storage/dashboardDeviceStorage';

describe('dashboard device persistence', () => {
  it('round-trips device metadata across application restart boundaries', async () => {
    await saveDashboardDevices([{
      id: DeviceId.create('sensor-persisted'),
      name: 'Persisted sensor',
      protocol: 'soil-sensor',
      rssi: -42,
      isConnectable: true,
    }]);

    await expect(loadDashboardDevices()).resolves.toEqual([{
      id: 'sensor-persisted',
      name: 'Persisted sensor',
      protocol: 'soil-sensor',
      rssi: -42,
      isConnectable: true,
    }]);
  });
});
