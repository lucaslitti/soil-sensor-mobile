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
import { useGattReader } from '../hooks/useGattReader';
import { useHistory } from '../hooks/useHistory';
import { MetricCard } from '../../../shared/components/MetricCard';
import { HistoryChart } from './HistoryChart';
import { buildHistoryPoints } from '../domain/historyUtil';
import { colors } from '../../../app/theme/colors';
import type { RootStackParamList } from '../../../app/navigation/types';
import type { Tone } from '../../../core/utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'SensorDetail'>;

const MOISTURE_RANGES = { dry: 15, ok: 70, noNeed: 90 };
const TEMP_RANGES = { cool: 18, ideal: 28, warm: 35 };
const EC_RANGES = { idealMin: 0.8, idealMax: 1.8, warning: 2.5, saline: 4.0 };

export function SensorDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { deviceId, deviceName } = route.params;
  const { connection, reading, isReading, device, connect, disconnect, setReadingEnabled } =
    useGattReader();
  const { loading, error, l1, l2, readLatest, readL1, readL2 } = useHistory();
  const connectStartedRef = useRef(false);

  useEffect(() => {
    if (!connectStartedRef.current) {
      connectStartedRef.current = true;
      connect(deviceId, deviceName);
    }
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

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
      ? '已连接，每 3 秒读数'
      : connection.state === 'connecting'
        ? '连接中…'
        : connection.state === 'error'
          ? `错误：${connection.error}`
          : '未连接';
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
        <View style={styles.navTitleWrap}>
          <Text style={styles.navTitle}>传感器详情</Text>
          <Text style={styles.navSubtitle}>{deviceName ?? 'Soil Sensor'}</Text>
        </View>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.navBtnText}>⚙</Text>
        </TouchableOpacity>
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
                <Text style={styles.pollActionText}>{isReading ? '暂停读数' : '恢复读数'}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={[styles.pollActionBtn, styles.disconnectBtn]} onPress={disconnect}>
              <Text style={styles.disconnectText}>断开连接</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.pollMeta}>
          <Text style={styles.pollMetaText}>最近更新: {lastUpdate}</Text>
          <Text style={[styles.pollMetaOk, { color: statusColor }]}>
            {connection.state === 'reading' ? '3 秒轮询正常' : '--'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]}
      >
        <View style={styles.metrics}>
          <MetricCard
            label="土壤湿度 (Moisture)"
            value={moisture === null ? '--' : moisture.toFixed(1)}
            unit=" %"
            tone={moistureTone}
            status={moisture === null ? '等待读数' : '15-70% 正常（适宜）'}
            subtitle={moisture === null ? '等待读数…' : `读数 ${moisture.toFixed(1)}%`}
            fill={moisture}
            segments={[
              { label: '<15 偏干', active: moisture !== null && moisture < MOISTURE_RANGES.dry },
              { label: '15-70 正常', active: moisture !== null && moisture >= MOISTURE_RANGES.dry && moisture <= MOISTURE_RANGES.ok },
              { label: '70-90 充沛', active: moisture !== null && moisture > MOISTURE_RANGES.ok && moisture <= MOISTURE_RANGES.noNeed },
              { label: '>90 过多', active: moisture !== null && moisture > MOISTURE_RANGES.noNeed },
            ]}
          />
          <MetricCard
            label="土壤温度 (Temperature)"
            value={temperature === null ? '--' : temperature.toFixed(1)}
            unit=" ℃"
            tone={tempTone}
            status={temperature === null ? '等待读数' : '18-28℃ 适宜'}
            subtitle={temperature === null ? '等待读数…' : `读数 ${temperature.toFixed(1)}℃`}
            fill={temperature === null ? 0 : (temperature / 50) * 100}
            segments={[
              { label: '<18 偏冷', active: temperature !== null && temperature < TEMP_RANGES.cool },
              { label: '18-28 适宜', active: temperature !== null && temperature >= TEMP_RANGES.cool && temperature <= TEMP_RANGES.ideal },
              { label: '28-35 偏暖', active: temperature !== null && temperature > TEMP_RANGES.ideal && temperature <= TEMP_RANGES.warm },
              { label: '>35 过热', active: temperature !== null && temperature > TEMP_RANGES.warm },
            ]}
          />
          <MetricCard
            label="土壤电导率 (EC 肥力)"
            value={ec === null ? '--' : ec.toFixed(2)}
            unit=" mS/cm"
            tone={ecTone}
            status={ec === null ? '等待读数' : '0.8-1.8 理想'}
            subtitle={ec === null ? '等待读数…' : '即时刻读数 (精度 ±0.05 mS/cm)'}
            fill={ec === null ? 0 : (ec / 5) * 100}
            segments={[
              { label: '<0.8 偏低', active: ec !== null && ec < EC_RANGES.idealMin },
              { label: '0.8-1.8 理想', active: ec !== null && ec >= EC_RANGES.idealMin && ec <= EC_RANGES.idealMax },
              { label: '1.8-2.5 偏高', active: ec !== null && ec > EC_RANGES.idealMax && ec <= EC_RANGES.warning },
              { label: '>2.5 警戒', active: ec !== null && ec > EC_RANGES.warning },
            ]}
          />
        </View>

        {/* Historical section */}
        <View style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>历史记录区</Text>
            <View style={styles.segmented}>
              <TouchableOpacity
                style={[styles.segBtn, styles.segBtnActive]}
                disabled={!device}
                onPress={() => device && readLatest(device, deviceId)}
              >
                <Text style={[styles.segText, styles.segTextActive]}>读 Latest</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.segBtn}
                disabled={!device}
                onPress={() => device && readL1(device, deviceId)}
              >
                <Text style={styles.segText}>L1 (2h)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.segBtn}
                disabled={!device}
                onPress={() => device && readL2(device, deviceId)}
              >
                <Text style={styles.segText}>L2 (2d)</Text>
              </TouchableOpacity>
            </View>
          </View>

          {loading ? <ActivityIndicator style={styles.spinner} color={colors.statusIdeas} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {l1 ? (
            <HistoryChart title="L1 近 2 小时遥测趋势" points={buildHistoryPoints(l1.subRecords)} />
          ) : null}
          {l2 ? (
            <HistoryChart title="L2 近 2 天遥测趋势" points={buildHistoryPoints(l2.subRecords)} />
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
  },
  navBtnText: { color: colors.onSurface, fontSize: 18 },
  navTitleWrap: { alignItems: 'center' },
  navTitle: { fontSize: 16, color: colors.onSurface, fontWeight: '700' },
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