import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../app/theme/colors';
import type { RootStackParamList } from '../../app/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [moistureAlarm, setMoistureAlarm] = useState(true);
  const [ecAlarm, setEcAlarm] = useState(true);
  const [unit, setUnit] = useState<'c' | 'f'>('c');

  return (
    <View style={styles.container}>
      {/* App top nav bar */}
      <View style={[styles.navBar, { paddingTop: 10 + insets.top }]}>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.navTitleWrap}>
          <Text style={styles.navTitle}>设置与校准</Text>
          <Text style={styles.navSubtitle}>预留通道 & 参数</Text>
        </View>
        <View style={styles.navBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]}
        style={styles.flex}
      >
        {/* OTA firmware notice */}
        <View style={styles.notice}>
          <Text style={styles.noticeIcon}>!</Text>
          <Text style={styles.noticeText}>
            <Text style={styles.noticeStrong}>注意：</Text>当前固件版本 v1.2.0。部分高级校准与离线聚合
            功能将在下一代固件 OTA 更新中开放。
          </Text>
        </View>

        {/* Threshold alarms */}
        <Group label="阈值报警配置 (Thresholds)">
          <View style={styles.card}>
            <Row
              title="湿度下限报警 (<15%)"
              subtitle="触发土壤缺水推送"
              right={<Switch value={moistureAlarm} onValueChange={setMoistureAlarm} trackColor={{ true: colors.statusIdeas, false: colors.surfaceHighest }} thumbColor={moistureAlarm ? colors.onPrimary : colors.outline} />}
            />
            <View style={styles.divider} />
            <Row
              title="EC 盐分超标报警 (>2.5 mS/cm)"
              subtitle="防止烧根与施肥过度"
              right={<Switch value={ecAlarm} onValueChange={setEcAlarm} trackColor={{ true: colors.statusIdeas, false: colors.surfaceHighest }} thumbColor={ecAlarm ? colors.onPrimary : colors.outline} />}
            />
          </View>
        </Group>

        {/* Units */}
        <Group label="计量单位偏好 (Units)">
          <View style={styles.card}>
            <Row
              title="温度单位切换"
              right={
                <View style={styles.segmented}>
                  <TouchableOpacity
                    style={[styles.segBtn, unit === 'c' && styles.segBtnActive]}
                    onPress={() => setUnit('c')}
                  >
                    <Text style={[styles.segText, unit === 'c' && styles.segTextActive]}>℃ 摄氏</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segBtn, unit === 'f' && styles.segBtnActive]}
                    onPress={() => setUnit('f')}
                  >
                    <Text style={[styles.segText, unit === 'f' && styles.segTextActive]}>℉ 华氏</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          </View>
        </Group>

        {/* Flash cache */}
        <Group label="本机存储管理 (Flash Cache)">
          <View style={styles.card}>
            <Row
              title="清理传感器本机缓存"
              subtitle="释放 512KB 环形 Flash 记录"
              right={
                <TouchableOpacity style={styles.dangerBtn}>
                  <Text style={styles.dangerText}>清空缓存</Text>
                </TouchableOpacity>
              }
            />
            <View style={styles.divider} />
            <Row
              title="导出 CSV 格式日志 (预留)"
              subtitle="即将支持 OTA 批处理导出"
              right={<Text style={styles.reservedTag}>V2.0 预留</Text>}
              dimmed
            />
          </View>
        </Group>

        {/* Firmware spec */}
        <Group label="固件与通讯协议" last>
          <View style={styles.specCard}>
            <SpecRow label="MAC 地址" value="E4:5F:01:9A:42:C8" />
            <SpecRow label="广播频率" value="3.0 秒 (BLE GATT 0x181A)" />
            <SpecRow label="SoC 型号" value="Nordic nRF52840-QIAA" />
            <SpecRow label="校准版本" value="CAL-V3-SILT-LOAM" accent />
          </View>
        </Group>
      </ScrollView>
    </View>
  );
}

function Group({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <View style={[styles.group, last && styles.groupLast]}>
      <Text style={styles.groupLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Row({
  title,
  subtitle,
  right,
  dimmed,
}: {
  title: string;
  subtitle?: string;
  right: React.ReactNode;
  dimmed?: boolean;
}) {
  return (
    <View style={[styles.row, dimmed && styles.rowDimmed]}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function SpecRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.specRow}>
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={[styles.specValue, accent && { color: colors.statusIdeas }]}>{value}</Text>
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
  scroll: { padding: 16, paddingBottom: 32 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: `${colors.statusFeasibility}1a`,
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
  },
  noticeIcon: { color: colors.statusFeasibility, fontWeight: '700', marginTop: 1 },
  noticeText: { color: colors.statusFeasibility, fontSize: 13, lineHeight: 19, flex: 1 },
  noticeStrong: { fontWeight: '700' },
  group: { marginBottom: 20 },
  groupLast: { marginBottom: 0 },
  groupLabel: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.outline,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    gap: 14,
  },
  divider: { height: 1, backgroundColor: colors.surfaceHigh },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowDimmed: { opacity: 0.5 },
  rowText: { flex: 1, marginRight: 12 },
  rowTitle: { fontSize: 14, color: colors.onSurface, fontWeight: '600' },
  rowSubtitle: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 3 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceHigh,
    borderRadius: 999,
    padding: 2,
    gap: 2,
  },
  segBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  segBtnActive: { backgroundColor: colors.statusIdeas },
  segText: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '600' },
  segTextActive: { color: colors.onPrimary },
  dangerBtn: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dangerText: { fontSize: 11, letterSpacing: 0.4, color: colors.error },
  reservedTag: {
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.outline,
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  specCard: {
    backgroundColor: colors.surfaceLow,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  specRow: { flexDirection: 'row', justifyContent: 'space-between' },
  specLabel: { fontSize: 11, color: colors.onSurfaceVariant, fontFamily: 'monospace' },
  specValue: { fontSize: 11, color: colors.onSurface, fontFamily: 'monospace', fontWeight: '700' },
});
