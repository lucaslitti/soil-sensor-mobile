import { colors } from './colors';

/** Chart palette derived from the High-Voltage Industrial design tokens. */
export const CHART_COLORS = {
  moisture: colors.statusProven,
  temperature: colors.statusFeasibility,
  ec: colors.statusActive,
  light: colors.statusActive,
} as const;

export const CHART_GRID = { left: 6, right: 12, top: 20, bottom: 4, containLabel: true };

/** Appends an alpha channel to a 6-digit hex color. */
export function withAlpha(hex: string, alpha: number): string {
  const clamped = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${clamped}`;
}

interface LineSeriesInput {
  name: string;
  data: number[];
  color: string;
  axis?: 0 | 1;
  area?: boolean;
}

export function buildLineSeries({ name, data, color, axis = 0, area = false }: LineSeriesInput) {
  return {
    name,
    type: 'line',
    yAxisIndex: axis,
    smooth: 0.35,
    showSymbol: false,
    symbol: 'circle',
    symbolSize: 6,
    lineStyle: {
      width: 2,
      color,
      shadowBlur: 10,
      shadowColor: withAlpha(color, 0.4),
    },
    itemStyle: { color, borderColor: colors.background, borderWidth: 2 },
    areaStyle: area
      ? {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: withAlpha(color, 0.28) },
              { offset: 1, color: withAlpha(color, 0) },
            ],
          },
        }
      : undefined,
    emphasis: { focus: 'series' },
    data,
  };
}

export function buildCategoryAxis(labels: string[]) {
  const interval = Math.max(0, Math.ceil(labels.length / 4) - 1);
  return {
    type: 'category',
    boundaryGap: false,
    data: labels,
    axisTick: { show: false },
    axisLine: { show: false },
    axisLabel: { color: colors.outline, fontSize: 9, interval, margin: 12 },
    splitLine: { show: false },
  };
}

export function buildValueAxis(max?: number, splitLine = true) {
  return {
    type: 'value',
    min: 0,
    max,
    splitNumber: 4,
    axisTick: { show: false },
    axisLine: { show: false },
    axisLabel: { show: false },
    splitLine: {
      show: splitLine,
      lineStyle: { color: colors.surfaceHigh, type: 'dashed' },
    },
  };
}

export function buildTooltip() {
  return {
    trigger: 'axis',
    backgroundColor: colors.surfaceHighest,
    borderColor: colors.surfaceHigh,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: colors.onSurface, fontSize: 11 },
    axisPointer: { type: 'line', lineStyle: { color: colors.outline, type: 'dashed' } },
  };
}
