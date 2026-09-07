/**
 * 单位格式化与阈值分类（从 Web 端 describe* 逻辑移植）。
 */

export interface MoistureRanges {
  dry: number;
  ok: number;
  noNeed: number;
}

export interface EcRanges {
  idealMin: number;
  idealMax: number;
  warning: number;
  saline: number;
}

export interface TemperatureRanges {
  cool: number;
  ideal: number;
  warm: number;
}

export type Tone = 'dry' | 'good' | 'cool' | 'warm' | 'alert' | 'normal';

export function formatValue(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return '--';
  return value.toFixed(digits);
}

export function describeMoisture(
  value: number | null,
  r: MoistureRanges,
): string {
  if (value === null || Number.isNaN(value)) return 'No moisture reading';
  if (value < r.dry) return `Need water (${value.toFixed(1)}%)`;
  if (value < r.ok) return `OK (${value.toFixed(1)}%)`;
  if (value <= r.noNeed) return `No need water now (${value.toFixed(1)}%)`;
  return `Too much water (${value.toFixed(1)}%)`;
}

export function describeTemperature(
  value: number | null,
  r: TemperatureRanges,
): string {
  if (value === null || Number.isNaN(value)) return 'No temperature reading';
  if (value < r.cool) return `Cool (${value.toFixed(1)}℃)`;
  if (value <= r.ideal) return `Ideal (${value.toFixed(1)}℃)`;
  if (value <= r.warm) return `Warm (${value.toFixed(1)}℃)`;
  return `Too hot (${value.toFixed(1)}℃)`;
}

export function describeEc(value: number | null, r: EcRanges): string {
  if (value === null || Number.isNaN(value)) return 'No EC reading';
  if (value < r.idealMin) return `Below ideal (${value.toFixed(2)} mS/cm)`;
  if (value <= r.idealMax) return `Ideal range (${value.toFixed(2)} mS/cm)`;
  if (value <= r.warning) return `Above ideal (${value.toFixed(2)} mS/cm)`;
  if (value <= r.saline) return `Warning zone (${value.toFixed(2)} mS/cm)`;
  return `Saline soil (${value.toFixed(2)} mS/cm)`;
}
