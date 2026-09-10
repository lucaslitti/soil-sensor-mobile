import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRealtimeViewModel } from '../viewmodels/useRealtimeViewModel';
import { useHistoryViewModel } from '../viewmodels/useHistoryViewModel';
import { MetricCard } from '../components/MetricCard';
import { HistoryChart } from '../components/HistoryChart';
import { buildHistoryPoints } from '../viewmodels/historyUtil';
import { colors } from '../components/colors';
import type { RootStackParamList } from '../viewmodels/navigationTypes';
import type { Tone } from '../viewmodels/format';

type Props = NativeStackScreenProps<RootStackParamList, 'SensorDetail'>;

const MOISTURE_RANGES = { dry: 15, ok: 70, noNeed: 90 };
const TEMP_RANGES = { cool: 18, ideal: 28, warm: 35 };
const EC_RANGES = { idealMin: 0.8, idealMax: 1.8, warning: 2.5, saline: 4.0 };

export function SensorDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { deviceId, deviceName } = route.params;
  const { connection, reading, isReading, connect, disconnect, setReadingEnabled } =
    useRealtimeViewModel(deviceId, deviceName);
  const { loading, all, readAll } = useHistoryViewModel();
  const connectStartedRef = useRef(false);
  const historyStartedRef = useRef(false);

  useEffect(() => {
    if (!connectStartedRef.current) {
      connectStartedRef.current = true;
      connect(deviceId, deviceName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  useEffect(() => {
    if (historyStartedRef.current) return;
    historyStartedRef.current = true;
    readAll(deviceId);
  }, [deviceId, readAll]);

  const moisture = reading?.moisturePercent ?? null;
  const temperature = reading?.temperatureC ?? null;
  const ec = reading?.soilEc ?? null;
  const lastUpdate = reading?.timestamp
    ? new Date(reading.timestamp).toLocaleString()
    : '--';

  const moistureTone: Tone =
    moisture === null ? 'normal' : moisture < MOISTURE_RANGES.dry ? 'dry' : 'good';
  const tempTone: Tone =
    temperature === null
      ? 'normal'
      : temperature < TEMP_RANGES.cool
        ? 'cool'
        : temperature <= TEMP_RANGES.ideal
          ? 'good'
          : temperature <= TEMP_RANGES.warm
            ? 'warm'
            : 'alert';
  const ecTone: Tone =
    ec === null ? 'normal' : ec < EC_RANGES.idealMin ? 'cool' : ec <= EC_RANGES.idealMax ? 'good' : 'warm';

  const statusLabel =
    connection.state === 'reading'
      ? 'Connected, reading every 3s'
      : connection.state === 'connecting'
        ? 'Connecting…'
        : connection.state === 'error'
          ? `Error: ${connection.error}`
          : 'Not connected';
  const statusColor =
    connection.state === 'reading'
      ? colors.statusProven
      : connection.state === 'error'
        ? colors.error
        : colors.statusFeasibility;

  return (
    <View style={styles.container}>
      {/* App top nav bar */}
      <View style={[styles.navBar, { paddingTop: 10 + insets.top }]}>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={[styles.navTitleWrap, { top: insets.top + 10 }]}>
          <Text style={[styles.navTitle, styles.centeredText]}>{deviceName ?? 'Soil Sensor'}</Text>
        </View>
      </View>

      {/* Polling header strip */}
      <View style={styles.pollStrip}>
        <View style={styles.pollRow}>
          <View style={styles.pollStatus}>
            <View style={[styles.pollDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.pollText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <View style={styles.pollActions}>
            {connection.state === 'reading' ? (
              <TouchableOpacity
                style={styles.pollActionBtn}
                onPress={() => setReadingEnabled(!isReading)}
              >
                <Text style={styles.pollActionText}>{isReading ? 'Pause' : 'Resume'}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={[styles.pollActionBtn, styles.disconnectBtn]} onPress={disconnect}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.pollMeta}>
          <Text style={styles.pollMetaText}>Last update: {lastUpdate}</Text>
          <Text style={[styles.pollMetaOk, { color: statusColor }]}>
            {connection.state === 'reading' ? '3s polling OK' : '--'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]}
      >
        <View style={styles.metrics}>
          <MetricCard
            label="Soil Moisture"
            value={moisture === null ? '--' : moisture.toFixed(1)}
            unit=" %"
            tone={moistureTone}
            status={moisture === null ? 'Waiting for reading' : '15-70% Normal (suitable)'}
            subtitle={moisture === null ? 'Waiting for reading…' : `Reading ${moisture.toFixed(1)}%`}
            fill={moisture}
            segments={[
              { label: '<15 Dry', active: moisture !== null && moisture < MOISTURE_RANGES.dry },
              { label: '15-70 Normal', active: moisture !== null && moisture >= MOISTURE_RANGES.dry && moisture <= MOISTURE_RANGES.ok },
              { label: '70-90 Adequate', active: moisture !== null && moisture > MOISTURE_RANGES.ok && moisture <= MOISTURE_RANGES.noNeed },
              { label: '>90 Too wet', active: moisture !== null && moisture > MOISTURE_RANGES.noNeed },
            ]}
          />
          <MetricCard
            label="Soil Temperature"
            value={temperature === null ? '--' : temperature.toFixed(1)}
            unit=" ℃"
            tone={tempTone}
            status={temperature === null ? 'Waiting for reading' : '18-28℃ Suitable'}
            subtitle={temperature === null ? 'Waiting for reading…' : `Reading ${temperature.toFixed(1)}℃`}
            fill={temperature === null ? 0 : (temperature / 50) * 100}
            segments={[
              { label: '<18 Cool', active: temperature !== null && temperature < TEMP_RANGES.cool },
              { label: '18-28 Suitable', active: temperature !== null && temperature >= TEMP_RANGES.cool && temperature <= TEMP_RANGES.ideal },
              { label: '28-35 Warm', active: temperature !== null && temperature > TEMP_RANGES.ideal && temperature <= TEMP_RANGES.warm },
              { label: '>35 Too hot', active: temperature !== null && temperature > TEMP_RANGES.warm },
            ]}
          />
          <MetricCard
            label="Soil EC (Fertility)"
            value={ec === null ? '--' : ec.toFixed(2)}
            unit=" mS/cm"
            tone={ecTone}
            status={ec === null ? 'Waiting for reading' : '0.8-1.8 Ideal'}
            subtitle={ec === null ? 'Waiting for reading…' : 'Live reading (accuracy ±0.05 mS/cm)'}
            fill={ec === null ? 0 : (ec / 5) * 100}
            segments={[
              { label: '<0.8 Low', active: ec !== null && ec < EC_RANGES.idealMin },
              { label: '0.8-1.8 Ideal', active: ec !== null && ec >= EC_RANGES.idealMin && ec <= EC_RANGES.idealMax },
              { label: '1.8-2.5 High', active: ec !== null && ec > EC_RANGES.idealMax && ec <= EC_RANGES.warning },
              { label: '>2.5 Alert', active: ec !== null && ec > EC_RANGES.warning },
            ]}
          />
        </View>

        {/* Historical section */}
        <View style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>History</Text>
          </View>
          {loading ? <ActivityIndicator style={styles.spinner} color={colors.statusIdeas} /> : null}
          {all ? (
            <HistoryChart
              title="All History (L1 + L2)"
              timeRange="Time range: last 2 days"
              points={buildHistoryPoints(all)}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  navBar: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  navBtnText: { color: colors.onSurface, fontSize: 18 },
  navTitleWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 10,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  navTitle: { fontSize: 16, color: colors.onSurface, fontWeight: '700' },
  centeredText: { textAlign: 'center' },
  navSubtitle: { fontSize: 10, letterSpacing: 0.4, color: colors.onSurfaceVariant, marginTop: 2 },
  pollStrip: {
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  pollRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pollStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pollDot: { width: 8, height: 8, borderRadius: 4 },
  pollText: { fontSize: 11, letterSpacing: 0.6, fontWeight: '700', textTransform: 'uppercase' },
  pollActions: { flexDirection: 'row', gap: 6 },
  pollActionBtn: {
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pollActionText: { fontSize: 11, letterSpacing: 0.4, color: colors.onSurface },
  disconnectBtn: { backgroundColor: colors.errorContainer },
  disconnectText: { fontSize: 11, letterSpacing: 0.4, color: colors.error },
  pollMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  pollMetaText: { fontSize: 10, letterSpacing: 0.4, color: colors.outline },
  pollMetaOk: { fontSize: 10, letterSpacing: 0.4 },
  scroll: { padding: 16, paddingBottom: 32 },
  metrics: { gap: 12 },
  historyCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 12,
    padding: 16,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    gap: 12,
  },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyTitle: { fontSize: 14, color: colors.onSurface, fontWeight: '700' },
  allHistoryAction: {
    marginLeft: 'auto',
    marginRight: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.statusIdeas,
  },
  allHistoryActionText: { fontSize: 11, color: colors.onPrimary, fontWeight: '700' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceHigh,
    borderRadius: 999,
    padding: 2,
    gap: 2,
  },
  segBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  segBtnActive: { backgroundColor: colors.statusIdeas },
  segText: { fontSize: 11, letterSpacing: 0.4, color: colors.onSurfaceVariant },
  segTextActive: { color: colors.onPrimary, fontWeight: '700' },
  spinner: { marginVertical: 12 },
  error: { color: colors.error, marginVertical: 6 },
});
