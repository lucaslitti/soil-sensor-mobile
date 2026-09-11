import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../viewmodels/navigationTypes';
import { colors } from '../components/colors';
import { isSmartPotAutoMode, validateSmartPotConfig } from '../../domain/entities/smartPot';
import { useSmartPotViewModel } from '../viewmodels/useSmartPotViewModel';
import { SmartPotHistoryChart } from '../components/SmartPotHistoryChart';

type Props = NativeStackScreenProps<RootStackParamList, 'SmartPotDetail'>;

const navLayout = StyleSheet.create({
  nav: { position: 'relative' },
  circleButton: { zIndex: 1 },
  titleContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 10,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredText: { textAlign: 'center' },
});

type ConfigValues = Record<string, string>;

const CONFIG_FIELDS = [
  { key: 'am', label: 'Auto mode', min: 0, max: 1, step: 1 },
  { key: 'aw', label: 'Auto watering', min: 0, max: 1, step: 1 },
  { key: 'al', label: 'Auto light', min: 0, max: 1, step: 1 },
  { key: 'le', label: 'Low moisture', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'l', label: 'Watering starts below', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'h', label: 'Watering stops above', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'd', label: 'Watering duration', min: 1, max: 3600, step: 1, unit: 's' },
  { key: 'i', label: 'Watering interval', min: 1, max: 86400, step: 60, unit: 's' },
  { key: 'ld', label: 'Light duration', min: 0, max: 86400, step: 60, unit: 's' },
  { key: 'li', label: 'Light interval', min: 0, max: 86400, step: 60, unit: 's' },
  { key: 'lon', label: 'Light starts below', min: 0, max: 10000, step: 10, unit: 'lux' },
  { key: 'loff', label: 'Light stops above', min: 0, max: 10000, step: 10, unit: 'lux' },
  { key: 'ace', label: 'Care time enabled', min: 0, max: 1, step: 1 },
  { key: 'cs', label: 'Care time starts', min: 0, max: 1439, step: 15 },
  { key: 'ce', label: 'Care time ends', min: 0, max: 1439, step: 15 },
] as const;

const DEFAULT_CONFIG: ConfigValues = Object.fromEntries(
  CONFIG_FIELDS.map(field => [field.key, field.key === 'h' ? '70' : field.key === 'd' ? '30' : field.key === 'i' ? '3600' : '0']),
);

function parseConfig(value: string): ConfigValues {
  const parsed = { ...DEFAULT_CONFIG };
  for (const part of value.split(',')) {
    const [key, raw] = part.split('=', 2);
    if (key && raw !== undefined) {
      const normalizedKey = key.trim().toLowerCase();
      const time = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
      parsed[normalizedKey] = time ? String(Number(time[1]) * 60 + Number(time[2])) : raw.trim();
    }
  }
  return parsed;
}

function formatConfigValue(key: string, value: string): string {
  if (key !== 'cs' && key !== 'ce') return value;
  const minutes = Math.max(0, Math.min(1439, Number(value) || 0));
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function ConfigSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const startValue = useRef(value);
  const update = (dx: number) => {
    if (!width) return;
    const raw = startValue.current + (dx / width) * (max - min);
    const next = Math.round(Math.max(min, Math.min(max, raw)) / step) * step;
    onChange(next);
  };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startValue.current = value;
      },
      onPanResponderMove: (_, gesture) => update(gesture.dx),
    }),
  ).current;
  const progress = (value - min) / (max - min);

  return (
    <View style={sliderStyles.sliderRow}>
      <View style={sliderStyles.sliderHeader}>
        <Text style={sliderStyles.sliderLabel}>{label}</Text>
        <Text style={sliderStyles.sliderValue}>{formatConfigValue(label.includes('time') ? label === 'Care time starts' ? 'cs' : 'ce' : '', String(value))}{unit && !label.includes('time') ? ` ${unit}` : ''}</Text>
      </View>
      <View
        style={sliderStyles.sliderTrack}
        onLayout={event => setWidth(event.nativeEvent.layout.width)}
        {...responder.panHandlers}
      >
        <View style={[sliderStyles.sliderFill, { width: `${Math.max(0, Math.min(1, progress)) * 100}%` }]} />
        <View style={[sliderStyles.sliderThumb, { left: `${Math.max(0, Math.min(1, progress)) * 100}%` }]} />
      </View>
    </View>
  );
}

export function SmartPotDetailScreen({ route, navigation }: Props) {
  const { deviceId, deviceName } = route.params;
  const insets = useSafeAreaInsets();
  const { connection, snapshot, connect, disconnect, write } = useSmartPotViewModel(deviceId, deviceName);
  const [rgb, setRgb] = useState('255,255,255');
  const [pumpSeconds, setPumpSeconds] = useState('30');
  const [configValues, setConfigValues] = useState<ConfigValues>(DEFAULT_CONFIG);
  const started = useRef(false);
  const run = (operation: Promise<void>) => operation.catch(error => Alert.alert('Operation failed', error instanceof Error ? error.message : 'Unknown error'));

  useEffect(() => {
    if (!started.current) {
      started.current = true;
       run(connect());
    }
  }, [connect, deviceId, deviceName, disconnect]);

  useEffect(() => {
    if (snapshot?.config) setConfigValues(parseConfig(snapshot.config));
  }, [snapshot?.config]);

  const sendRgb = () => {
    if (!/^\d{1,3},\d{1,3},\d{1,3}$/.test(rgb) || rgb.split(',').some(value => Number(value) > 255)) {
      Alert.alert('Invalid RGB', 'Enter R,G,B within 0-255, e.g. 255,128,0.');
      return;
    }
       run(write({ type: 'rgb', value: rgb }));
  };

  const sendPump = (value: string) => {
    if (value !== 'on' && !/^\d+$/.test(value)) {
      Alert.alert('Invalid duration', 'Pump run duration must be a non-negative integer in seconds.');
      return;
    }
    Alert.alert('Confirm watering', value === 'on' ? 'Start pump now?' : `Run pump for ${value} seconds?`, [
      { text: 'Cancel', style: 'cancel' },
       { text: 'Confirm', style: 'destructive', onPress: () => run(write({ type: 'pump', value })) },
    ]);
  };

  const sendConfig = () => {
    const config = CONFIG_FIELDS.map(field => `${field.key}=${formatConfigValue(field.key, configValues[field.key])}`).join(',');
    const error = validateSmartPotConfig(config);
    if (error) { Alert.alert('Invalid config', error); return; }
    run(write({ type: 'config', value: config }));
  };

  const setConfigValue = (key: string, value: number) => {
    setConfigValues(current => ({ ...current, [key]: String(value) }));
  };

  const historyPoints = useMemo(() => snapshot?.history ?? [], [snapshot?.history]);
  const connected = connection.state === 'reading';
  const automatic = isSmartPotAutoMode(snapshot?.config ?? '');
  const status = connection.state === 'connecting' ? 'Connecting and syncing time…' : connection.state === 'error' ? `Error: ${connection.error}` : connected ? 'Connected, refreshing every 2s' : 'Not connected';

  return (
    <View style={styles.container}>
      <View style={[styles.nav, navLayout.nav, { paddingTop: 10 + insets.top }]}>
        <TouchableOpacity style={[styles.circleButton, navLayout.circleButton]} onPress={() => navigation.goBack()}><Text style={styles.circleText}>‹</Text></TouchableOpacity>
        <View style={[navLayout.titleContainer, { top: insets.top + 10 }]} pointerEvents="none"><Text style={[styles.title, navLayout.centeredText]}>SmartPot</Text><Text style={[styles.subtitle, navLayout.centeredText]}>{deviceName ?? deviceId}</Text></View>
      </View>
      <View style={styles.status}><Text style={[styles.statusText, connection.state === 'error' && styles.error]}>{status}</Text><TouchableOpacity onPress={() => run(disconnect())}><Text style={styles.disconnect}>Disconnect</Text></TouchableOpacity></View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        <Section title="Live Status">
          <View style={styles.grid}>
            <Value label="Soil Moisture" value={snapshot?.moisture} />
            <Value label="Soil Temperature" value={snapshot?.temperature} />
            <Value label="Soil EC" value={snapshot?.ec} />
            <Value label="Light Sensor" value={snapshot?.lightSensor} />
            <Value label="Light" value={snapshot?.light} />
            <Value label="Pump" value={snapshot?.pump} />
          </View>
          <Text style={styles.detail}>RGB: {snapshot?.rgb ?? '--'}</Text>
        </Section>
        <Section title="Manual Control">
          {automatic ? <Text style={styles.hint}>Manual control is locked in AUTO mode.</Text> : null}
           <View style={styles.buttons}><Button label="Light On" disabled={!connected || automatic} onPress={() => run(write({ type: 'light', value: 'on' }))} /><Button label="Light Off" disabled={!connected || automatic} onPress={() => run(write({ type: 'light', value: 'off' }))} /></View>
          <TextInput value={rgb} onChangeText={setRgb} style={styles.input} placeholder="R,G,B" placeholderTextColor={colors.outline} keyboardType="number-pad" />
          <Button label="Set RGB" disabled={!connected || automatic} onPress={sendRgb} />
           <View style={styles.buttons}><Button label="Start Pump" disabled={!connected || automatic} danger onPress={() => sendPump('on')} /><Button label="Stop Pump" disabled={!connected || automatic} onPress={() => run(write({ type: 'pump', value: 'off' }))} /></View>
          <View style={styles.buttons}><TextInput value={pumpSeconds} onChangeText={setPumpSeconds} style={[styles.input, styles.secondsInput]} keyboardType="number-pad" /><Button label="Timed Watering" disabled={!connected || automatic} danger onPress={() => sendPump(pumpSeconds)} /></View>
        </Section>
        <Section title="Automation Config">
           <View style={styles.buttons}><Button label="MANUAL" disabled={!connected} onPress={() => run(write({ type: 'config', value: 'am=0' }))} /><Button label="AUTO" disabled={!connected} onPress={() => run(write({ type: 'config', value: 'am=1' }))} /></View>
          <Text style={styles.hint}>Adjust each automation parameter, then apply the complete configuration.</Text>
          {CONFIG_FIELDS.map(field => (
            <ConfigSlider
              {...field}
              key={field.key}
              value={Number(configValues[field.key]) || 0}
              onChange={value => setConfigValue(field.key, value)}
            />
          ))}
          <Button label="Apply Config" disabled={!connected} onPress={sendConfig} />
        </Section>
        <Section title={`24h History (${snapshot?.history.length ?? 0})`}>
           <SmartPotHistoryChart points={historyPoints} />
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function Value({ label, value }: { label: string; value?: string }) { return <View style={styles.value}><Text style={styles.label}>{label}</Text><Text style={styles.valueText}>{value ?? '--'}</Text></View>; }
function Button({ label, disabled, danger, onPress }: { label: string; disabled?: boolean; danger?: boolean; onPress: () => void }) { return <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.button, danger && styles.dangerButton, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceLow, paddingHorizontal: 12, paddingBottom: 10 }, circleButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainer }, circleText: { fontSize: 20, color: colors.onSurface }, title: { color: colors.onSurface, fontWeight: '700', textAlign: 'center' }, subtitle: { color: colors.onSurfaceVariant, fontSize: 10, maxWidth: 180 }, status: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: colors.surfaceContainer }, statusText: { color: colors.statusProven, fontSize: 12 }, error: { color: colors.error }, disconnect: { color: colors.error, fontWeight: '700' }, scroll: { padding: 16, gap: 12 }, section: { backgroundColor: colors.surfaceContainer, borderRadius: 12, padding: 14, gap: 10 }, sectionTitle: { color: colors.onSurface, fontWeight: '700', fontSize: 15 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, value: { width: '31%', backgroundColor: colors.surfaceHigh, borderRadius: 8, padding: 8 }, label: { fontSize: 10, color: colors.outline }, valueText: { color: colors.onSurface, fontWeight: '700', marginTop: 3 }, detail: { color: colors.onSurfaceVariant }, buttons: { flexDirection: 'row', gap: 8 }, button: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: colors.statusIdeas, alignItems: 'center' }, dangerButton: { backgroundColor: colors.error }, disabled: { opacity: 0.45 }, buttonText: { color: colors.onPrimary, fontWeight: '700' }, input: { color: colors.onSurface, borderWidth: 1, borderColor: colors.outline, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }, secondsInput: { flex: 1 }, configInput: { minHeight: 76, textAlignVertical: 'top' }, hint: { color: colors.onSurfaceVariant, fontSize: 11, lineHeight: 17 }, historyRow: { borderTopWidth: 1, borderTopColor: colors.surfaceHigh, paddingTop: 8, gap: 3 }, historyTime: { color: colors.onSurface, fontWeight: '600', fontSize: 12 }, historyValue: { color: colors.onSurfaceVariant, fontSize: 12 },
});

const sliderStyles = StyleSheet.create({
  sliderRow: { gap: 6 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderLabel: { color: colors.onSurfaceVariant, fontSize: 11 },
  sliderValue: { color: colors.onSurface, fontSize: 11, fontWeight: '700' },
  sliderTrack: { height: 24, justifyContent: 'center' },
  sliderFill: { position: 'absolute', left: 0, height: 4, borderRadius: 2, backgroundColor: colors.statusIdeas },
  sliderThumb: { position: 'absolute', width: 14, height: 14, marginLeft: -7, borderRadius: 7, backgroundColor: colors.statusIdeas },
});
