/* eslint-disable no-bitwise */
export class TemperatureC {
  private constructor(readonly value: number) {}

  static fromInt8(raw: number): TemperatureC {
    const signed = (raw << 24) >> 24;
    return new TemperatureC(signed / 2);
  }

  static fromInt16(lo: number, hi: number): TemperatureC {
    const signed = ((lo | (hi << 8)) << 16) >> 16;
    return new TemperatureC(signed / 100);
  }
}
