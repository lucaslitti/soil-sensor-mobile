/* eslint-disable no-undef */
// 测试环境 mock react-native-ble-plx 原生模块
jest.mock('react-native-ble-plx', () => {
  const noop = () => {};
  class FakeDevice {
    constructor(id) {
      this.id = id;
      this.name = 'Soil Sensor-TEST';
      this.rssi = -50;
      this.isConnectable = true;
    }
    async discoverAllServicesAndCharacteristics() {
      return this;
    }
    async cancelConnection() {
      return this;
    }
    async readCharacteristicForService() {
      return { value: '' };
    }
    async writeCharacteristicWithResponseForService() {
      return this;
    }
  }
  class FakeBleManager {
    constructor() {}
    onStateChange() {
      return { remove: noop };
    }
    startDeviceScan() {
      noop();
    }
    stopDeviceScan() {
      noop();
    }
    async connectToDevice(id) {
      return new FakeDevice(id);
    }
    async destroy() {
      noop();
    }
  }
  return {
    BleManager: FakeBleManager,
    ScanMode: { LowLatency: 2 },
    BleError: class BleError extends Error {},
  };
});

jest.mock('@op-engineering/op-sqlite', () => ({
  open: () => ({
    executeSync: jest.fn(() => ({ rows: [], rowsAffected: 0 })),
  }),
}));
