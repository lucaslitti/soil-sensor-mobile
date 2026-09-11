import React, { useEffect, useRef } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import SvgChart from '@wuba/react-native-echarts/svgChart';
import * as echarts from 'echarts/core';
import { colors } from './colors';

const WIDTH = Math.max(280, Dimensions.get('window').width - 64);

interface Props {
  option: Record<string, unknown>;
  height: number;
}

/**
 * ECharts SVG canvas that updates in place instead of re-initializing on every
 * option change, so live polling does not replay the entrance animation.
 */
export function ChartCanvas({ option, height }: Props) {
  const chartRef = useRef<React.ElementRef<typeof SvgChart> | null>(null);
  const instance = useRef<ReturnType<typeof echarts.init> | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current, undefined, {
      renderer: 'svg',
      width: WIDTH,
      height,
    });
    instance.current = chart;
    return () => {
      chart.dispose();
      instance.current = null;
    };
  }, [height]);

  useEffect(() => {
    instance.current?.setOption(option, true);
  }, [option]);

  return <SvgChart ref={chartRef} />;
}

interface LegendItem {
  color: string;
  label: string;
  value: string;
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <View style={styles.legend}>
      {items.map(item => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: item.color }]} />
          <View>
            <Text style={styles.legendLabel}>{item.label}</Text>
            <Text style={[styles.legendValue, { color: item.color }]}>{item.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 3, height: 24, borderRadius: 2 },
  legendLabel: {
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.outline,
    textTransform: 'uppercase',
  },
  legendValue: { fontSize: 13, fontWeight: '700' },
});
