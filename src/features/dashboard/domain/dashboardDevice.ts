import { colors } from '../../../app/theme/colors';
import type { LiveReading } from '../../sensor/domain/codec';
import type { SmartPotSnapshot } from '../../sensor/domain/smartPot';

/** Dashboard 设备连接状态。 */
export type DashboardConnectionState = 'connecting' | 'reading' | 'error';

export interface DashboardDevice {
  id: string;
  name: string;
  protocol: 'soil-sensor' | 'smart-pot';
  connection: DashboardConnectionState;
  /** Soil Sensor 实时读数 */
  reading: LiveReading | null;
  /** SmartPot 快照 */
  snapshot: SmartPotSnapshot | null;
  rssi: number | null;
  lastUpdated: number | null;
  error: string | null;
}

export interface SignalInfo {
  bars: number;
  label: string;
  color: string;
  rssiColor: string;
}

export function signalInfo(rssi: number): SignalInfo {
  if (rssi >= -60) {
    return { bars: 4, label: 'Excellent', color: colors.onSurface, rssiColor: colors.statusProven };
  }
  if (rssi >= -75) {
    return { bars: 3, label: 'Good', color: colors.onSurface, rssiColor: colors.onSurface };
  }
  if (rssi >= -90) {
    return { bars: 2, label: 'Fair', color: colors.secondary, rssiColor: colors.statusFeasibility };
  }
  return { bars: 1, label: 'Weak', color: colors.secondary, rssiColor: colors.statusFeasibility };
}

const MOISTURE_RANGES = { dry: 15, ok: 70 };
const TEMP_RANGES = { cool: 18, ideal: 28, warm: 35 };
const EC_RANGES = { idealMin: 0.8, idealMax: 1.8, warning: 2.5 };

type Tone = 'dry' | 'good' | 'cool' | 'warm' | 'alert' | 'normal';

export function readingTone(
  kind: 'moisture' | 'temperature' | 'ec',
  value: number | null,
): Tone {
  if (value === null) return 'normal';
  if (kind === 'moisture') {
    return value < MOISTURE_RANGES.dry ? 'dry' : value <= MOISTURE_RANGES.ok ? 'good' : 'alert';
  }
  if (kind === 'temperature') {
    return value < TEMP_RANGES.cool
      ? 'cool'
      : value <= TEMP_RANGES.ideal
        ? 'good'
        : value <= TEMP_RANGES.warm
          ? 'warm'
          : 'alert';
  }
  return value < EC_RANGES.idealMin
    ? 'cool'
    : value <= EC_RANGES.idealMax
      ? 'good'
      : value <= EC_RANGES.warning
        ? 'warm'
        : 'alert';
}

export function toneColor(tone: Tone): string {
  switch (tone) {
    case 'dry':
      return colors.dry;
    case 'good':
      return colors.good;
    case 'cool':
      return colors.cool;
    case 'warm':
      return colors.warm;
    case 'alert':
      return colors.alert;
    default:
      return colors.onSurfaceVariant;
  }
}