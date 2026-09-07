import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../../app/navigation/types';
import { colors } from '../../../app/theme/colors';
import { smartPotRepository } from '../data/smartPotRepository';
import { isSmartPotAutoMode, validateSmartPotConfig } from '../domain/smartPot';
import { useSmartPot } from '../hooks/useSmartPot';

type Props = NativeStackScreenProps<RootStackParamList, 'SmartPotDetail'>;

export function SmartPotDetailScreen({ route, navigation }: Props) {
  const { deviceId, deviceName } = route.params;
  const insets = useSafeAreaInsets();
  const { connection, snapshot, refreshing, connect, disconnect, refresh, write } = useSmartPot();
  const [rgb, setRgb] = useState('255,255,255');
  const [pumpSeconds, setPumpSeconds] = useState('30');
  const [config, setConfig] = useState('');
  const started = useRef(false);
  const run = (operation: Promise<void>) => operation.catch(error => Alert.alert('操作失败', error instanceof Error ? error.message : '未知错误'));

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      run(connect(deviceId, deviceName));
    }
    return () => { run(disconnect()); };
  }, [connect, deviceId, deviceName, disconnect]);

  useEffect(() => {
    if (snapshot?.config) setConfig(snapshot.config);
  }, [snapshot?.config]);

  const sendRgb = () => {
    if (!/^\d{1,3},\d{1,3},\d{1,3}$/.test(rgb) || rgb.split(',').some(value => Number(value) > 255)) {
      Alert.alert('RGB 无效', '请输入 0-255 范围内的 R,G,B，例如 255,128,0。');
      return;
    }
    run(write(device => smartPotRepository.writeRgb(device, rgb)));
  };

  const sendPump = (value: string) => {
    if (value !== 'on' && !/^\d+$/.test(value)) {
      Alert.alert('时长无效', '泵运行时长必须是非负整数秒。');
      return;
    }
    Alert.alert('确认浇水', value === 'on' ? '立即启动水泵？' : `运行水泵 ${value} 秒？`, [
      { text: '取消', style: 'cancel' },
      { text: '确认', style: 'destructive', onPress: () => run(write(device => smartPotRepository.writePump(device, value))) },
    ]);
  };

  const sendConfig = () => {
    const error = validateSmartPotConfig(config);
    if (error) { Alert.alert('配置无效', error); return; }
    run(write(device => smartPotRepository.writeConfig(device, config)));
  };

  const connected = connection.state === 'reading';
  const automatic = isSmartPotAutoMode(snapshot?.config ?? config);
  const status = connection.state === 'connecting' ? '连接中并同步时间…' : connection.state === 'error' ? `错误：${connection.error}` : connected ? '已连接，每 2 秒刷新' : '未连接';

  return (
    <View style={styles.container}>
      <View style={[styles.nav, { paddingTop: 10 + insets.top }]}>
        <TouchableOpacity style={styles.circleButton} onPress={() => navigation.goBack()}><Text style={styles.circleText}>‹</Text></TouchableOpacity>
        <View><Text style={styles.title}>SmartPot</Text><Text style={styles.subtitle}>{deviceName ?? deviceId}</Text></View>
        <TouchableOpacity style={styles.circleButton} disabled={!connected || refreshing} onPress={() => run(refresh())}><Text style={styles.circleText}>⟳</Text></TouchableOpacity>
      </View>
      <View style={styles.status}><Text style={[styles.statusText, connection.state === 'error' && styles.error]}>{status}</Text><TouchableOpacity onPress={() => run(disconnect())}><Text style={styles.disconnect}>断开</Text></TouchableOpacity></View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        {refreshing ? <ActivityIndicator color={colors.statusIdeas} /> : null}
        <Section title="实时状态">
          <View style={styles.grid}>
            <Value label="土壤湿度" value={snapshot?.moisture} />
            <Value label="土壤温度" value={snapshot?.temperature} />
            <Value label="土壤 EC" value={snapshot?.ec} />
            <Value label="光照传感器" value={snapshot?.lightSensor} />
            <Value label="灯" value={snapshot?.light} />
            <Value label="水泵" value={snapshot?.pump} />
          </View>
          <Text style={styles.detail}>RGB: {snapshot?.rgb ?? '--'}</Text>
        </Section>
        <Section title="手动控制">
          {automatic ? <Text style={styles.hint}>AUTO 模式下手动控制已锁定。</Text> : null}
          <View style={styles.buttons}><Button label="开灯" disabled={!connected || automatic} onPress={() => run(write(device => smartPotRepository.writeLight(device, 'on')))} /><Button label="关灯" disabled={!connected || automatic} onPress={() => run(write(device => smartPotRepository.writeLight(device, 'off')))} /></View>
          <TextInput value={rgb} onChangeText={setRgb} style={styles.input} placeholder="R,G,B" placeholderTextColor={colors.outline} keyboardType="number-pad" />
          <Button label="设置 RGB" disabled={!connected || automatic} onPress={sendRgb} />
          <View style={styles.buttons}><Button label="启动水泵" disabled={!connected || automatic} danger onPress={() => sendPump('on')} /><Button label="停止水泵" disabled={!connected || automatic} onPress={() => run(write(device => smartPotRepository.writePump(device, 'off')))} /></View>
          <View style={styles.buttons}><TextInput value={pumpSeconds} onChangeText={setPumpSeconds} style={[styles.input, styles.secondsInput]} keyboardType="number-pad" /><Button label="定时浇水" disabled={!connected || automatic} danger onPress={() => sendPump(pumpSeconds)} /></View>
        </Section>
        <Section title="自动化配置">
          <View style={styles.buttons}><Button label="MANUAL" disabled={!connected} onPress={() => run(write(device => smartPotRepository.writeConfig(device, 'am=0')))} /><Button label="AUTO" disabled={!connected} onPress={() => run(write(device => smartPotRepository.writeConfig(device, 'am=1')))} /></View>
          <Text style={styles.hint}>支持 am, aw, al, le, l, h, d, i, ld, li, lon, loff, ace, cs, ce。配置由设备读取后自动回填。</Text>
          <TextInput value={config} onChangeText={setConfig} style={[styles.input, styles.configInput]} multiline placeholder="aw=1,al=0,le=0,l=35,h=50,d=30,i=60" placeholderTextColor={colors.outline} />
          <Button label="应用配置" disabled={!connected || !config.trim()} onPress={sendConfig} />
        </Section>
        <Section title={`24 小时历史（${snapshot?.history.length ?? 0}）`}>
          {!snapshot?.history.length ? <Text style={styles.hint}>暂无历史记录</Text> : snapshot.history.map(point => <View key={`${point.timestamp}-${point.soil}`} style={styles.historyRow}><Text style={styles.historyTime}>{point.timestamp ? new Date(point.timestamp * 1000).toLocaleString() : '--'}</Text><Text style={styles.historyValue}>湿度 {point.soil}%</Text><Text style={styles.historyValue}>温度 {point.temperature}C</Text><Text style={styles.historyValue}>光照 {point.lux} Lux</Text></View>)}
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
