import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from './colors';
import type { Tone } from '../viewmodels/format';

interface Props {
  label: string;
  value: string;
  unit: string;
  tone: Tone;
  subtitle?: string;
  status: string;
  /** 当前值对应进度条填充比例 (0-100) */
  fill?: number | null;
  /** 阈值分段标签 */
  segments: { label: string; active: boolean }[];
}

export function MetricCard({ label, value, unit, tone, subtitle, status, fill, segments }: Props) {
  const accent = toneColor(tone);
  const fillWidth = fill == null ? 0 : Math.min(100, Math.max(0, fill));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <View style={[styles.icon, { backgroundColor: tint(tone) }]}>
            <View style={[styles.iconDot, { backgroundColor: accent }]} />
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.label}>{label}</Text>
            <Text style={[styles.value, { color: accent }]}>
              {value}
              <Text style={styles.unit}>{unit}</Text>
            </Text>
          </View>
        </View>
        <Text style={[styles.status, { color: accent, backgroundColor: tint(tone) }]}>
          {status}
        </Text>
      </View>

      {/* Segmented progress bar */}
      <View style={styles.progressWrap}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${fillWidth}%`, backgroundColor: accent }]} />
        </View>
        <View style={styles.segments}>
          {segments.map((seg, i) => (
            <Text
              key={`${seg.label}-${i}`}
              style={[styles.seg, seg.active && styles.segActive, seg.active && { color: accent }]}
            >
              {seg.label}
            </Text>
          ))}
        </View>
      </View>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function tint(tone: Tone): string {
  return `${toneColor(tone)}26`;
}

function toneColor(tone: Tone): string {
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
      return colors.outline;
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDot: { width: 10, height: 10, borderRadius: 5 },
  titleBlock: { flex: 1 },
  label: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.outline,
    marginBottom: 2,
  },
  value: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 36,
  },
  unit: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
  },
  status: {
    fontSize: 10,
    letterSpacing: 0.4,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressWrap: { gap: 6 },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceHighest,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  segments: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  seg: {
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.outline,
    marginRight: 8,
  },
  segActive: {
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.outline,
  },
});
