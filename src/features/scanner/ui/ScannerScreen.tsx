import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useScanner } from '../hooks/useScanner';
import { colors } from '../../../app/theme/colors';
import type { RootStackParamList } from '../../../app/navigation/types';
import type { ScannedDevice } from '../domain/scanState';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

const TIMEOUT = 30;

interface SignalInfo {
  bars: number;
  label: string;
  color: string;
  rssiColor: string;
}

function signalInfo(rssi: number): SignalInfo {
  if (rssi >= -60) {
    return { bars: 4, label: '极佳', color: colors.onSurface, rssiColor: colors.statusProven };
  }
  if (rssi >= -75) {
    return { bars: 3, label: '良好', color: colors.onSurface, rssiColor: colors.onSurface };
  }
  if (rssi >= -90) {
    return { bars: 2, label: '较弱', color: colors.secondary, rssiColor: colors.statusFeasibility };
  }
  return { bars: 1, label: '微弱', color: colors.secondary, rssiColor: colors.statusFeasibility };
}

export function ScannerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { state, devices, error, start } = useScanner();
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state === 'scanning') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  const openDevice = (device: ScannedDevice) => {
    navigation.navigate('SensorDetail', {
      deviceId: device.id,
      deviceName: device.name,
    });
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <View style={styles.container}>
      {/* App top navigation bar */}
      <View style={[styles.navBar, { paddingTop: 12 + insets.top }]}>
        <View>
          <Text style={styles.title}>Soil Sensor</Text>
          <Text style={styles.subtitle}>附近设备（名称以 Soil Sensor- 开头）</Text>
        </View>
        <View style={styles.navIcon}>
          <Text style={styles.navIconText}>⌁</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} style={styles.flex}>
        {/* Scanning status banner */}
        <View style={styles.banner}>
          <View style={styles.bannerLeft}>
            <PingDot active={state === 'scanning'} />
            <View>
              <Text style={styles.bannerTitle}>
                {state === 'scanning'
                  ? '扫描中…'
                  : state === 'stopped'
                    ? '扫描结束（30s 超时）'
                    : state === 'error'
                      ? `扫描出错：${error ?? ''}`
                      : '准备扫描'}
              </Text>
              <Text style={styles.bannerMeta}>
                {state === 'scanning' ? `${mm}:${ss} / ${TIMEOUT}s 超时` : '点击重新扫描开始'}
              </Text>
            </View>
          </View>
          {state === 'scanning' ? <Spinner /> : null}
        </View>

        <Text style={styles.listLabel}>已发现设备（{devices.length}）</Text>

        {devices.length === 0 ? (
          <Text style={styles.empty}>
            {state === 'scanning'
              ? '未发现设备。设备可能处于休眠状态，请靠近传感器并按下外壳顶部的唤醒按钮。'
              : '点击重新扫描开始。'}
          </Text>
        ) : (
          devices.map((device) => (
            <DeviceCard key={device.id} device={device} onPress={() => openDevice(device)} />
          ))
        )}

        {/* Troubleshooting footnote */}
        <View style={styles.footnote}>
          <Text style={styles.footnoteIcon}>?</Text>
          <Text style={styles.footnoteText}>
            未发现设备？设备可能处于休眠状态，请靠近传感器并按下外壳顶部的唤醒按钮。
          </Text>
        </View>
      </ScrollView>

      {/* Bottom action drawer */}
      <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity
          style={[
            styles.rescanBtn,
            state === 'scanning' ? styles.rescanBtnDisabled : styles.rescanBtnActive,
          ]}
          disabled={state === 'scanning'}
          onPress={start}
        >
          <Text style={styles.rescanIcon}>⟳</Text>
          <Text
            style={[
              styles.rescanText,
              state === 'scanning' ? styles.rescanTextDisabled : styles.rescanTextActive,
            ]}
          >
            {state === 'scanning' ? '重新扫描（锁定中）' : '重新扫描'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PingDot({ active }: { active: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      anim.setValue(0);
    };
  }, [active, anim]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0] });

  return (
    <View style={styles.pulseWrap}>
      {active ? <Animated.View style={[styles.ping, { opacity, transform: [{ scale }] }]} /> : null}
      <View
        style={[styles.pulseDot, active ? styles.pulseDotActive : styles.pulseDotIdle]}
      />
    </View>
  );
}

function Spinner() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.Text style={[styles.bannerSpinner, { transform: [{ rotate }] }]}>⟳</Animated.Text>
  );
}

function DeviceCard({ device, onPress }: { device: ScannedDevice; onPress: () => void }) {
  const sig = signalInfo(device.rssi);
  const resolving = !device.name;

  return (
    <TouchableOpacity
      style={[styles.deviceCard, resolving && styles.deviceCardResolving]}
      onPress={onPress}
    >
      <View style={styles.deviceHeader}>
        <View style={styles.deviceTitleWrap}>
          <View
            style={[
              styles.deviceDot,
              { backgroundColor: resolving ? colors.outline : colors.secondary },
            ]}
          />
          <Text style={[styles.deviceName, resolving && styles.deviceNameResolving]}>
            {device.name ?? '名称解析中…'}
          </Text>
        </View>
        <Text
          style={[styles.deviceState, resolving ? styles.deviceStateResolving : styles.deviceStateIdle]}
        >
          {resolving ? '解析 GATT…' : '可连接'}
        </Text>
      </View>

      <View style={styles.metricGrid}>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>RSSI</Text>
          <Text
            style={[
              styles.metricValue,
              styles.metricValueStrong,
              { color: resolving ? colors.statusFeasibility : sig.rssiColor },
            ]}
          >
            {device.rssi} dBm
          </Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>信号等级</Text>
          <Text style={[styles.metricValue, { color: resolving ? colors.secondary : sig.color }]}>
            {sig.bars} 格（{sig.label}）
          </Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>电量</Text>
          <Text style={[styles.metricValue, resolving && styles.metricValueMuted]}>--</Text>
        </View>
      </View>

      {!resolving ? (
        <View style={styles.deviceFooter}>
          <Text style={styles.mac}>MAC: {device.id}</Text>
          <Text style={styles.pairLink}>点击配对 ›</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 8 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconText: { color: colors.statusIdeas, fontSize: 18 },
  title: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  subtitle: { fontSize: 11, letterSpacing: 0.6, color: colors.onSurfaceVariant, marginTop: 2 },
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceHigh,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pulseWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  ping: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.statusIdeas,
  },
  pulseDot: { width: 12, height: 12, borderRadius: 6 },
  pulseDotActive: { backgroundColor: colors.statusIdeas },
  pulseDotIdle: { backgroundColor: colors.outline },
  bannerTitle: { fontSize: 13, color: colors.onSurface, fontWeight: '600' },
  bannerMeta: { fontSize: 11, letterSpacing: 0.4, color: colors.statusIdeas, marginTop: 2 },
  bannerSpinner: { fontSize: 20, color: colors.statusIdeas },
  listLabel: {
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.outline,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  deviceCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    gap: 10,
  },
  deviceCardResolving: { opacity: 0.75 },
  deviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deviceTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deviceDot: { width: 10, height: 10, borderRadius: 5 },
  deviceName: { fontSize: 15, color: colors.onSurface, fontWeight: '600' },
  deviceNameResolving: { color: colors.onSurfaceVariant, fontStyle: 'italic' },
  deviceState: {
    fontSize: 11,
    letterSpacing: 0.4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  deviceStateIdle: { color: colors.onSurfaceVariant, backgroundColor: colors.surfaceHigh },
  deviceStateResolving: { color: colors.outline, backgroundColor: colors.surfaceHigh },
  metricGrid: { flexDirection: 'row', gap: 6 },
  metricCell: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 6,
    padding: 8,
  },
  metricLabel: { fontSize: 10, letterSpacing: 0.4, color: colors.outline, marginBottom: 2 },
  metricValue: { fontSize: 12, color: colors.onSurface },
  metricValueStrong: { fontWeight: '700' },
  metricValueMuted: { color: colors.secondary },
  deviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mac: { fontSize: 11, color: colors.onSurfaceVariant, fontFamily: 'monospace' },
  pairLink: { fontSize: 11, letterSpacing: 0.4, color: colors.statusIdeas, fontWeight: '700' },
  empty: { color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 16, lineHeight: 20 },
  footnote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
  },
  footnoteIcon: { color: colors.statusFeasibility, fontWeight: '700', fontSize: 14, marginTop: 1 },
  footnoteText: { color: colors.onSurfaceVariant, fontSize: 12, lineHeight: 18, flex: 1 },
  footer: {
    padding: 16,
    backgroundColor: colors.surfaceLow,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceHigh,
  },
  rescanBtn: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  rescanBtnActive: { backgroundColor: colors.statusIdeas },
  rescanBtnDisabled: { backgroundColor: colors.surfaceHigh, opacity: 0.6 },
  rescanIcon: { fontSize: 16, color: colors.textSecondary },
  rescanText: { fontSize: 15, fontWeight: '700' },
  rescanTextActive: { color: colors.onPrimary },
  rescanTextDisabled: { color: colors.textSecondary },
});