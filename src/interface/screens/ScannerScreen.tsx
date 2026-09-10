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
import { useScanner } from '../viewmodels/useScannerViewModel';
import { colors } from '../components/colors';
import { BluetoothIcon } from '../components/BluetoothIcon';
import { AutorenewIcon } from '../components/AutorenewIcon';
import { useDeviceListViewModel } from '../viewmodels/useDeviceListViewModel';
import type { RootStackParamList } from '../viewmodels/navigationTypes';
import type { ScannedDevice } from '../../domain/ports/sensorGateway';

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
    return { bars: 4, label: 'Excellent', color: colors.onSurface, rssiColor: colors.statusProven };
  }
  if (rssi >= -75) {
    return { bars: 3, label: 'Good', color: colors.onSurface, rssiColor: colors.onSurface };
  }
  if (rssi >= -90) {
    return { bars: 2, label: 'Fair', color: colors.secondary, rssiColor: colors.statusFeasibility };
  }
  return { bars: 1, label: 'Weak', color: colors.secondary, rssiColor: colors.statusFeasibility };
}

function SectionHeader({
  accentColor,
  label,
  enLabel,
}: {
  accentColor: string;
  label: string;
  enLabel: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <View style={[styles.sectionAccent, { backgroundColor: accentColor }]} />
        <Text style={styles.sectionLabel}>{label}</Text>
      </View>
      <Text style={styles.sectionEnLabel}>{enLabel}</Text>
    </View>
  );
}

export function ScannerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { state, devices, error, start } = useScanner();
  const { add } = useDeviceListViewModel();
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 已连接探针（当前扫描流程不跟踪连接态，预留为 null）
  const connectedDevice: ScannedDevice | null = null;

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
    // 加入看板并返回 Dashboard（Dashboard 统一管理连接与轮询）
    add(device);
    navigation.goBack();
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <View style={styles.container}>
      {/* App top navigation bar */}
      <View style={[styles.navBar, { paddingTop: 12 + insets.top }]}>
        <View>
          <Text style={styles.title}>Add Device</Text>
          <Text style={styles.subtitle}>Nearby devices</Text>
        </View>
        <View style={styles.navIcon}>
          <BluetoothIcon size={18} />
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
                  ? 'Scanning...'
                  : state === 'stopped'
                    ? 'Scan finished (30s timeout)'
                    : state === 'error'
                      ? `Scan error: ${error ?? ''}`
                      : 'Ready to scan'}
              </Text>
              <Text style={styles.bannerMeta}>
                {state === 'scanning'
                  ? `${mm}:${ss} / ${TIMEOUT}s Timeout`
                  : 'Tap rescan to start'}
              </Text>
            </View>
          </View>
          {state === 'scanning' ? <Spinner /> : null}
        </View>

        {/* Connected devices */}
        {connectedDevice ? (
          <View style={styles.section}>
            <SectionHeader
              accentColor={colors.statusProven}
              label={`Connected devices (${1})`}
              enLabel="CONNECTED PROBE"
            />
            <ConnectedCard
              device={connectedDevice}
              onPress={() => openDevice(connectedDevice)}
            />
          </View>
        ) : null}

        {/* Available peripherals */}
        <View style={styles.section}>
          <SectionHeader
            accentColor={colors.outline}
            label={`Available peripherals (${devices.length})`}
            enLabel="AVAILABLE PERIPHERALS"
          />

          {devices.length === 0 ? (
            <Text style={styles.empty}>
              {state === 'scanning'
                ? 'No devices found. The device may be asleep — move closer and press the wake button on the top of the housing.'
                : 'Tap rescan to start.'}
            </Text>
          ) : (
            devices.map((device) => (
              <AvailableCard
                 key={device.id.value}
                device={device}
                onPress={() => openDevice(device)}
              />
            ))
          )}
        </View>

        {/* Troubleshooting footnote */}
        <View style={styles.footnote}>
          <Text style={styles.footnoteIcon}>?</Text>
          <Text style={styles.footnoteText}>
            No devices found? The device may be asleep — move closer and press the wake button on
            the top of the housing.
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
            {state === 'scanning' ? 'Rescan (locked)' : 'Rescan'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PingDot({ active, color = colors.statusIdeas }: { active: boolean; color?: string }) {
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
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0] });

  return (
    <View style={styles.pulseWrap}>
      {active ? <Animated.View style={[styles.ping, { backgroundColor: color, opacity, transform: [{ scale }] }]} /> : null}
      <View
        style={[styles.pulseDot, active ? { backgroundColor: color } : styles.pulseDotIdle]}
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
    <Animated.View style={{ transform: [{ rotate }] }}>
      <AutorenewIcon size={20} />
    </Animated.View>
  );
}

function MetricCell({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: object;
}) {
  return (
    <View style={styles.metricCell}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, valueStyle]}>{value}</Text>
    </View>
  );
}

function ConnectedCard({
  device,
  onPress,
}: {
  device: ScannedDevice;
  onPress: () => void;
}) {
  const sig = signalInfo(device.rssi);
  return (
    <TouchableOpacity style={styles.connectedCard} onPress={onPress}>
      <View style={styles.deviceHeader}>
        <View style={styles.deviceTitleWrap}>
          <PingDot active color={colors.statusProven} />
          <Text style={styles.connectedName}>{device.name}</Text>
        </View>
        <View style={styles.pollingBadge}>
          <Text style={styles.pollingBadgeText}>3s polling (3s POLLING)</Text>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <MetricCell
          label="RSSI"
          value={`${device.rssi} dBm`}
          valueStyle={[styles.metricValueStrong, { color: sig.rssiColor }]}
        />
        <MetricCell label="Signal" value={`${sig.bars} bars (${sig.label})`} />
        <MetricCell
          label="Battery"
          value="--"
          valueStyle={styles.metricValueMuted}
        />
      </View>

      <View style={styles.connectedFooter}>
               <Text style={styles.mac}>MAC: {device.id.value}</Text>
        <View style={styles.manageLink}>
          <Text style={styles.manageLinkText}>Manage / Details</Text>
          <Text style={styles.manageChevron}>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function AvailableCard({
  device,
  onPress,
}: {
  device: ScannedDevice;
  onPress: () => void;
}) {
  const sig = signalInfo(device.rssi);
  const resolving = !device.name;

  return (
    <TouchableOpacity
      style={[styles.availableCard, resolving && styles.availableCardResolving]}
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
            {device.name ?? 'Resolving name…'}
          </Text>
        </View>
        <Text
          style={[
            styles.deviceState,
            resolving ? styles.deviceStateResolving : styles.deviceStateIdle,
          ]}
        >
          {resolving
            ? 'Resolving GATT…'
            : device.protocol === 'smart-pot'
              ? 'SmartPot'
              : 'Ready'}
        </Text>
      </View>

      <View style={styles.metricGrid}>
        <MetricCell
          label="RSSI"
          value={`${device.rssi} dBm`}
          valueStyle={[
            styles.metricValueStrong,
            { color: resolving ? colors.statusFeasibility : sig.rssiColor },
          ]}
        />
        <MetricCell
          label="Signal"
          value={`${sig.bars} bars (${sig.label})`}
          valueStyle={{ color: resolving ? colors.secondary : sig.color }}
        />
        <MetricCell
          label="Battery"
          value="--"
          valueStyle={resolving ? styles.metricValueMuted : styles.metricValueStrong}
        />
      </View>

      {!resolving ? (
        <View style={styles.availableFooter}>
           <Text style={styles.mac}>MAC: {device.id.value}</Text>
          <View style={styles.pairLink}>
            <Text style={styles.pairLinkText}>
              {device.protocol === 'smart-pot' ? 'View details' : 'Pair & Connect'}
            </Text>
            <Text style={styles.pairArrow}>›</Text>
          </View>
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
  title: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  subtitle: { fontSize: 11, letterSpacing: 0.6, color: colors.onSurfaceVariant, marginTop: 2 },
banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceHigh,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pulseWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  ping: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.statusIdeas,
  },
  pulseDot: { width: 12, height: 12, borderRadius: 6 },
  pulseDotIdle: { backgroundColor: colors.outline },
  bannerTitle: { fontSize: 13, color: colors.onSurface, fontWeight: '600' },
  bannerMeta: {
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.statusIdeas,
    marginTop: 2,
    fontWeight: '700',
  },
  section: { marginTop: 2, marginBottom: 4 },  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionAccent: { width: 6, height: 14, borderRadius: 3 },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  sectionEnLabel: {
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.outline,
  },
  connectedCard: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    gap: 10,
  },
  connectedName: { fontSize: 15, color: colors.onSurface, fontWeight: '700' },
  pollingBadge: {
    backgroundColor: 'rgba(56, 211, 159, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pollingBadgeText: {
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.statusProven,
    fontWeight: '700',
  },
  connectedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceHigh,
  },
  manageLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  manageLinkText: {
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.statusIdeas,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  manageChevron: { fontSize: 15, color: colors.statusIdeas, fontWeight: '700' },
  availableCard: {
    backgroundColor: colors.surfaceLow,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    gap: 10,
  },
  availableCardResolving: { opacity: 0.75 },
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
  availableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mac: { fontSize: 11, color: colors.onSurfaceVariant, fontFamily: 'monospace' },
  pairLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  pairLinkText: {
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.statusIdeas,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  pairArrow: { fontSize: 14, color: colors.statusIdeas, fontWeight: '700' },
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
