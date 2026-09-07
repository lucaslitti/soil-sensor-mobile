import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { colors } from '../../../app/theme/colors';
import type { HistoryPoint } from '../domain/sensorRecord';

interface Props {
  title: string;
  points: HistoryPoint[];
  /** 展示的数据时间范围（如 "近 2 小时"、"近 2 天"）。子记录无时间戳，故用保留窗口表示。 */
  timeRange?: string;
}

const WIDTH = 320;
const HEIGHT = 96;
const LEFT = 8;
const RIGHT = 312;
const BOTTOM = 80;

/**
 * 简易历史曲线（react-native-svg polyline），采用暗色工业主题。
 */
export function HistoryChart({ points, timeRange }: Props) {
  const norm = (key: 'moisture' | 'temperature' | 'ec') => {
    const max = key === 'moisture' ? 100 : key === 'temperature' ? 50 : 5;
    return points
      .map((p) => {
        const y = BOTTOM - Math.min(60, Math.max(0, (p[key] / max) * 60));
        return `${p.x},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  if (!points.length) {
    return <Text style={styles.empty}>No history data</Text>;
  }

  const last = points[points.length - 1];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          {timeRange ? <Text style={styles.timeRange}>{timeRange}</Text> : null}
        </View>
        <Text style={styles.waveform}>{points.length} points</Text>
      </View>
      <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Line x1={LEFT} y1={BOTTOM} x2={RIGHT} y2={BOTTOM} stroke={colors.surfaceHighest} strokeWidth={1} />
        <Line x1={LEFT} y1={56} x2={RIGHT} y2={56} stroke={colors.surfaceHighest} strokeWidth={1} strokeDasharray="3 3" />
        <Line x1={LEFT} y1={32} x2={RIGHT} y2={32} stroke={colors.surfaceHighest} strokeWidth={1} strokeDasharray="3 3" />
        <Polyline points={norm('moisture')} fill="none" stroke={colors.statusProven} strokeWidth={2.5} />
        <Polyline points={norm('temperature')} fill="none" stroke={colors.statusActive} strokeWidth={2} strokeDasharray="5 3" />
        <Polyline points={norm('ec')} fill="none" stroke={colors.statusIdeas} strokeWidth={2} />
      </Svg>
      <View style={styles.legend}>
        <LegendDot color={colors.statusProven} label={`Moisture ${last.moisture.toFixed(1)}%`} />
        <LegendDot color={colors.statusActive} label={`Temp ${last.temperature.toFixed(1)}℃`} />
        <LegendDot color={colors.statusIdeas} label={`EC ${last.ec.toFixed(2)}`} />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.line, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceLow,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  headerLeft: { flex: 1 },
  title: { fontSize: 11, letterSpacing: 0.4, color: colors.outline, textTransform: 'uppercase' },
  timeRange: { fontSize: 10, color: colors.onSurfaceVariant, marginTop: 2 },
  waveform: { fontSize: 11, letterSpacing: 0.4, color: colors.statusIdeas },
  empty: { color: colors.onSurfaceVariant, padding: 8, fontSize: 13 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  line: { width: 12, height: 3, borderRadius: 2, marginRight: 5 },
  legendText: { fontSize: 11, letterSpacing: 0.4, color: colors.onSurfaceVariant },
});
