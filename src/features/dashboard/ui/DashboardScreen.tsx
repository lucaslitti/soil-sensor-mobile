import React, { useRef } from 'react';
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
import { colors } from '../../../app/theme/colors';
import type { RootStackParamList } from '../../../app/navigation/types';
import { useDashboardStore } from '../hooks/dashboardStore';
import { dashboardManager } from '../data/dashboardManager';
import {
  readingTone,
  signalInfo,
  toneColor,
  type DashboardConnectionState,
  type DashboardDevice,
} from '../domain/dashboardDevice';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const STATUS_LABEL: Record<DashboardConnectionState, string> = {
  reading: '3s polling',
  connecting: 'Connecting…',
  error: 'Error',
};

const STATUS_COLOR: Record<DashboardConnectionState, string> = {
  reading: colors.statusProven,
  connecting: colors.statusFeasibility,
  error: colors.error,
};

export function DashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const devices = useDashboardStore((s) => s.devices);
  const list = Object.values(devices);

  const openDevice = (device: DashboardDevice) => {
    if (device.protocol === 'smart-pot') {
      navigation.navigate('SmartPotDetail', {
        deviceId: device.id,
        deviceName: device.name,
      });
    } else {
      navigation.navigate('SensorDetail', {
        deviceId: device.id,
        deviceName: device.name,
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* App top navigation bar */}
      <View style={[styles.navBar, { paddingTop: 12 + insets.top }]}>
        <View>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>Connected devices ({list.length})</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('Scanner')}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} style={styles.flex}>
        {list.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No connected devices</Text>
            <Text style={styles.emptyText}>
              Tap the + button to scan and add a soil sensor to the dashboard.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Scanner')}>
              <Text style={styles.emptyBtnText}>Add device</Text>
            </TouchableOpacity>
          </View>
        ) : (
          list.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onPress={() => openDevice(device)}
              onRemove={() => dashboardManager.remove(device.id)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function DeviceCard({
  device,
  onPress,
  onRemove,
}: {
  device: DashboardDevice;
  onPress: () => void;
  onRemove: () => void;
}) {
  const statusColor = STATUS_COLOR[device.connection];
  const sig = device.rssi == null ? null : signalInfo(device.rssi);
  const isSmartPot = device.protocol === 'smart-pot';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleWrap}>
          <StatusDot active={device.connection === 'reading'} color={statusColor} />
          <View style={styles.cardTitleBlock}>
            <Text style={styles.cardName}>{device.name}</Text>
            <Text style={[styles.cardStatus, { color: statusColor }]}>
              {STATUS_LABEL[device.connection]}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.removeBtn} onPress={onRemove} hitSlop={8}>
          <Text style={styles.removeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {isSmartPot ? (
        <>
          <View style={styles.metricGrid}>
            <MetricCell
              label="Moisture"
              value={device.snapshot ? `${device.snapshot.moisture}%` : '--'}
              color={toneColor(readingTone('moisture', num(device.snapshot?.moisture)))}
            />
            <MetricCell
              label="Temp"
              value={device.snapshot ? `${device.snapshot.temperature}℃` : '--'}
              color={toneColor(readingTone('temperature', num(device.snapshot?.temperature)))}
            />
            <MetricCell
              label="EC"
              value={device.snapshot ? `${device.snapshot.ec} mS/cm` : '--'}
              color={toneColor(readingTone('ec', num(device.snapshot?.ec)))}
            />
          </View>
          <View style={styles.infoGrid}>
            <Info label="Light" value={device.snapshot?.light ?? '--'} />
            <Info label="Light Sensor" value={device.snapshot?.lightSensor ?? '--'} />
            <Info label="Pump" value={device.snapshot?.pump ?? '--'} />
          </View>
        </>
      ) : (
        <View style={styles.metricGrid}>
          <MetricCell
            label="Moisture"
            value={device.reading ? `${device.reading.moisturePercent.toFixed(1)}%` : '--'}
            color={toneColor(readingTone('moisture', device.reading?.moisturePercent ?? null))}
          />
          <MetricCell
            label="Temp"
            value={device.reading ? `${device.reading.temperatureC.toFixed(1)}℃` : '--'}
            color={toneColor(readingTone('temperature', device.reading?.temperatureC ?? null))}
          />
          <MetricCell
            label="EC"
            value={device.reading ? `${device.reading.soilEc.toFixed(2)}` : '--'}
            color={toneColor(readingTone('ec', device.reading?.soilEc ?? null))}
          />
        </View>
      )}

      <View style={styles.metaRow}>
        <Meta label="RSSI" value={device.rssi == null ? '--' : `${device.rssi} dBm`} />
        <Meta
          label="Signal"
          value={sig ? `${sig.bars} bars (${sig.label})` : '--'}
        />
        <Meta
          label="Updated"
          value={device.lastUpdated ? new Date(device.lastUpdated).toLocaleTimeString() : '--'}
        />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.mac}>MAC: {device.id}</Text>
        <TouchableOpacity style={styles.manageLink} onPress={onPress}>
          <Text style={styles.manageText}>Manage &gt;</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function num(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function MetricCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.metricCell}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function StatusDot({ active, color }: { active: boolean; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
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
    <View style={styles.statusDotWrap}>
      {active ? (
        <Animated.View
          style={[styles.statusPing, { backgroundColor: color, opacity, transform: [{ scale }] }]}
        />
      ) : null}
      <View style={[styles.statusDot, { backgroundColor: color }]} />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  subtitle: {
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: colors.statusIdeas, fontSize: 20, lineHeight: 22, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 24 },
  empty: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  emptyBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.statusIdeas,
  },
  emptyBtnText: { fontSize: 13, fontWeight: '700', color: colors.onPrimary },
  card: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  statusDotWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  statusPing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  cardTitleBlock: { flex: 1 },
  cardName: { fontSize: 15, color: colors.onSurface, fontWeight: '700' },
  cardStatus: { fontSize: 10, letterSpacing: 0.4, fontWeight: '700', marginTop: 2 },
  removeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { fontSize: 12, color: colors.onSurfaceVariant },
  metricGrid: { flexDirection: 'row', gap: 6 },
  metricCell: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 6,
    padding: 8,
  },
  metricLabel: {
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.outline,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  metricValue: { fontSize: 16, fontWeight: '700' },
  infoGrid: { flexDirection: 'row', gap: 6 },
  infoCell: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 6,
    padding: 8,
  },
  infoValue: { fontSize: 13, color: colors.onSurface, fontWeight: '600', marginTop: 2 },
  metaRow: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainer,
  },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 10, letterSpacing: 0.4, color: colors.outline },
  metaValue: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainer,
  },
  mac: { fontSize: 11, color: colors.onSurfaceVariant, fontFamily: 'monospace' },
  manageLink: { paddingVertical: 2 },
  manageText: {
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.statusIdeas,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});