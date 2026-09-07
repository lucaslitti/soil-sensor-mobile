/* eslint-disable no-bitwise */
export class SoilMoisturePercent {
  private constructor(readonly value: number) {}

  static fromUint8HalfStep(raw: number): SoilMoisturePercent {
    return new SoilMoisturePercent(raw / 2);
  }

  static fromUint16Hundredth(lo: number, hi: number): SoilMoisturePercent {
    return new SoilMoisturePercent((lo | (hi << 8)) / 100);
  }
}
