/**
 * High-Voltage Industrial dark theme.
 * Tokens ported from soi_sensor_uikit/DESIGN.md.
 */
export const colors = {
  // Base canvas
  background: '#121315',
  surface: '#121315',
  surfaceLow: '#1a1c1d',
  surfaceContainer: '#1e2022',
  surfaceHigh: '#292a2c',
  surfaceHighest: '#343537',

  // Text
  text: '#e3e2e4',
  onSurface: '#e3e2e4',
  secondary: '#c7c6c8',
  textSecondary: '#c8c8ad',
  onSurfaceVariant: '#c8c8ad',
  outline: '#92927a',
  outlineVariant: '#474834',

  // Brand accents
  primary: '#d4e128',
  primaryBright: '#f1fe47',
  onPrimary: '#2f3300',
  accent: '#e0ec35',
  tertiary: '#5df0ba',
  statusProven: '#38d39f',
  statusActive: '#3fa9f5',
  statusIdeas: '#d4e128',
  statusFeasibility: '#e69b38',

  // Functional
  danger: '#ffb4ab',
  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',

  // Metric tones (kept for MetricCard)
  dry: '#e69b38',
  good: '#38d39f',
  cool: '#3fa9f5',
  warm: '#d4e128',
  alert: '#ffb4ab',

  white: '#ffffff',
} as const;

export type Colors = typeof colors;
