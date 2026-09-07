import { Mutex } from './mutex';

/** 同一设备所有 BLE 操作串行化，避免 live/history/disconnect 竞争。 */
export class DeviceCommandQueue {
  private readonly queues = new Map<string, Mutex>();

  run<T>(deviceId: string, task: () => Promise<T>): Promise<T> {
    let mutex = this.queues.get(deviceId);
    if (!mutex) {
      mutex = new Mutex();
      this.queues.set(deviceId, mutex);
    }
    return mutex.runExclusive(task);
  }

  remove(deviceId: string): void {
    this.queues.delete(deviceId);
  }
}
