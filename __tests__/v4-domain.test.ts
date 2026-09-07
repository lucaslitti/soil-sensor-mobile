import { DeviceSession } from '../src/domain/entities/deviceSession';
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
    const session = new DeviceSession(id, 'session-1');
    device.markConnecting();
    session.beginConnect();
    session.attach({ deviceId: id });
    device.markReady();
    device.startPolling();
    session.startPolling();
    expect(device.state).toBe('polling');
    expect(session.state).toBe('polling');
  });

  it('selects only idle devices for the four-device eviction policy', () => {
    const policy = new ConnectionPolicy(4, 60_000);
    const devices = Array.from({ length: 4 }, (_, i) => {
      const device = new SensorDevice(DeviceId.create(`sensor-${i}`), null);
      device.markConnecting();
      device.markReady();
      device.startPolling();
      device.applyReading({ moisturePercent: 1, temperatureC: 1, soilEc: 1, timestamp: i, source: 'gatt' });
      return device;
    });
    expect(policy.selectEvictionCandidate(devices, devices[3].id, 120_000)?.value).toBe('sensor-0');
  });
});
