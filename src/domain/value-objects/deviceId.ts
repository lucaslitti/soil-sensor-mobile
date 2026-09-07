export class DeviceId {
  private constructor(readonly value: string) {}

  static create(value: string): DeviceId {
    if (!value.trim()) throw new Error('DeviceId cannot be empty');
    return new DeviceId(value);
  }

  equals(other: DeviceId): boolean {
    return this.value === other.value;
  }
}
