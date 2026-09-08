import type { SensorSubRecord as SubRecord } from '../../domain/ports/sensorGateway';
import type { HistoryPoint } from './presentationTypes';

const LEFT = 12;
const RIGHT = 228;

/**
 * 将有序子记录映射为曲线数据点（按时间正序，x 线性铺满）。
 * 由调用方保证传入的子记录已是正确时间顺序。
 */
export function buildHistoryPoints(records: SubRecord[]): HistoryPoint[] {
  const filled = records.filter((r) => !r.isEmpty);
  if (!filled.length) return [];

  const n = filled.length;
  const step = n === 1 ? 0 : (RIGHT - LEFT) / (n - 1);
  return filled.map((r, i) => ({
    x: n === 1 ? RIGHT : LEFT + i * step,
    timeLabel: `${i + 1}`,
    moisture: r.moisturePercent,
    temperature: r.temperatureC,
    ec: r.soilEc,
  }));
}
