import { SensorDevice } from '../src/domain/entities/sensorDevice';
import { ConnectionPolicy } from '../src/domain/services/connectionPolicy';
import { DeviceId } from '../src/domain/value-objects/deviceId';
import { ReadingDecoder } from '../src/domain/services/readingDecoder';

const u8 = (...bytes: number[]) => Uint8Array.from(bytes);

describe('V4 domain', () => {
  it('decodes protocol values without platform dependencies', () => {
    const live = ReadingDecoder.decodeLive(u8(0x28), u8(0x1e), u8(0x64), u8(1, 0, 0, 0));
    expect(live).toMatchObject({ moisturePercent: 20, temperatureC: 15, soilEc: 5, timestamp: 1000 });
  });

  it('enforces SensorDevice and DeviceSession lifecycle transitions', () => {
    const id = DeviceId.create('sensor-1');
    const device = new SensorDevice(id, 'Soil Sensor-1');
    device.markConnecting();
    device.markConnected();
    expect(device.state).toBe('connected');
  });

  it('selects only idle devices for the four-device eviction policy', () => {
    const policy = new ConnectionPolicy(4, 60_000);
    const devices = Array.from({ length: 4 }, (_, i) => {
      const device = new SensorDevice(DeviceId.create(`sensor-${i}`), null);
      device.markConnecting();
      device.markConnected();
      device.applyReading({ moisturePercent: 1, temperatureC: 1, soilEc: 1, timestamp: i, source: 'gatt' });
      return device;
    });
    expect(policy.selectEvictionCandidate(devices, devices[3].id, 120_000)?.value).toBe('sensor-0');
  });
});
