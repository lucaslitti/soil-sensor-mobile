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
  if (value === null || Number.isNaN(value)) return '暂无湿度读数';
  if (value < r.dry) return `需浇水（${value.toFixed(1)}%）`;
  if (value < r.ok) return `正常（${value.toFixed(1)}%）`;
  if (value <= r.noNeed) return `暂不需浇水（${value.toFixed(1)}%）`;
  return `水分过多（${value.toFixed(1)}%）`;
}

export function describeTemperature(
  value: number | null,
  r: TemperatureRanges,
): string {
  if (value === null || Number.isNaN(value)) return '暂无温度读数';
  if (value < r.cool) return `偏冷（${value.toFixed(1)}℃）`;
  if (value <= r.ideal) return `适宜（${value.toFixed(1)}℃）`;
  if (value <= r.warm) return `偏暖（${value.toFixed(1)}℃）`;
  return `过热（${value.toFixed(1)}℃）`;
}

export function describeEc(value: number | null, r: EcRanges): string {
  if (value === null || Number.isNaN(value)) return '暂无 EC 读数';
  if (value < r.idealMin) return `低于理想（${value.toFixed(2)} mS/cm）`;
  if (value <= r.idealMax) return `理想区间（${value.toFixed(2)} mS/cm）`;
  if (value <= r.warning) return `高于理想（${value.toFixed(2)} mS/cm）`;
  if (value <= r.saline) return `警戒区（${value.toFixed(2)} mS/cm）`;
  return `盐渍土（${value.toFixed(2)} mS/cm）`;
}
