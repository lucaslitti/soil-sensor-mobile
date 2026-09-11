import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SVGRenderer } from '@wuba/react-native-echarts/svgChart';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { colors } from './colors';
import { ChartCanvas, ChartLegend } from './ChartCanvas';
import {
  buildCategoryAxis,
  buildLineSeries,
  buildTooltip,
  buildValueAxis,
  CHART_COLORS,
  CHART_GRID,
} from './chartTheme';
import type { SmartPotHistoryPoint } from '../../domain/entities/smartPot';

echarts.use([LineChart, GridComponent, TooltipComponent, SVGRenderer]);

const HEIGHT = 168;

/** Dark industrial 24h curve for SmartPot (soil moisture / temperature / light). */
export function SmartPotHistoryChart({ points }: { points: SmartPotHistoryPoint[] }) {
  const option = useMemo<Record<string, unknown>>(
    () => ({
      animation: true,
      animationDuration: 600,
      animationEasing: 'cubicOut',
      backgroundColor: 'transparent',
      grid: CHART_GRID,
      tooltip: buildTooltip(),
      xAxis: buildCategoryAxis(
        points.map(point =>
          new Date(point.timestamp * 1000).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        ),
      ),
      yAxis: [buildValueAxis(100, true), buildValueAxis(undefined, false)],
      series: [
        buildLineSeries({
          name: 'Moisture',
          data: points.map(point => point.soil),
          color: CHART_COLORS.moisture,
          area: true,
        }),
        buildLineSeries({
          name: 'Temp',
          data: points.map(point => point.temperature),
          color: CHART_COLORS.temperature,
        }),
        buildLineSeries({
          name: 'Light',
          data: points.map(point => point.lux),
          color: CHART_COLORS.light,
          axis: 1,
        }),
      ],
    }),
    [points],
  );

  if (!points.length) {
    return <Text style={styles.empty}>No history data</Text>;
  }

  const last = points[points.length - 1];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Last 24 hours</Text>
        <Text style={styles.meta}>{points.length} pts</Text>
      </View>
      <ChartCanvas option={option} height={HEIGHT} />
      <ChartLegend
        items={[
          { color: CHART_COLORS.moisture, label: 'Moisture', value: `${last.soil}%` },
          { color: CHART_COLORS.temperature, label: 'Temp', value: `${last.temperature}°C` },
          { color: CHART_COLORS.light, label: 'Light', value: `${last.lux} lx` },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.outline,
    fontWeight: '700',
  },
  meta: { fontSize: 11, letterSpacing: 0.4, color: colors.statusIdeas, fontWeight: '700' },
  empty: { color: colors.onSurfaceVariant, padding: 8, fontSize: 13 },
});
