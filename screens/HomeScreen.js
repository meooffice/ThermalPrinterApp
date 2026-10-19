// screens/HomeScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import BluetoothService from '../services/BluetoothService';
import SettingsService from '../services/SettingsService';
import SchoolService from '../services/SchoolService';
import CatalogService from '../services/CatalogService';
import EscPosEncoder from '../services/EscPosEncoder';
import { Colors, Radius, Spacing, Typography } from '../constants/Theme';
import { Card } from '../components/ui';

let autoReconnectTried = false;   // auto-reconnect is tried once per app start

// Section heading with an icon (display only)
function SectionHead({ icon, label }) {
  return (
    <View style={styles.sectionRow}>
      <MaterialCommunityIcons name={icon} size={16} color={Colors.primary} />
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const [connected, setConnected]   = useState(false);
  const [deviceName, setDeviceName] = useState(null);
  const [testing, setTesting]       = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [info, setInfo]             = useState({ mandal: '', year: '', schools: null, items: null });

  useFocusEffect(useCallback(() => {
    (async () => {
      await checkConnection();
      loadInfo();
      // App just started and no printer: one silent try to the last printer
      if (!autoReconnectTried && !(await BluetoothService.isConnected())) {
        autoReconnectTried = true;
        setReconnecting(true);
        await BluetoothService.reconnectLast();
        setReconnecting(false);
        checkConnection();
      }
    })();
  }, []));

  // Header info only (read-only). A failure just leaves the numbers blank.
  const loadInfo = async () => {
    try {
      const [s, sc, it] = await Promise.all([SettingsService.get(), SchoolService.getAll(), CatalogService.getAll()]);
      setInfo({ mandal: s?.shopName || '', year: s?.academicYear || '', schools: sc.length, items: it.length });
    } catch { /* ignore */ }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'శుభోదయం · Good Morning' : hour < 17 ? 'శుభ మధ్యాహ్నం · Good Afternoon' : 'శుభ సాయంత్రం · Good Evening';

  const checkConnection = async () => {
    const isConnected = await BluetoothService.isConnected();
    setConnected(isConnected);
    if (isConnected) {
      const device = BluetoothService.getConnectedDevice();
      setDeviceName(device?.name || device?.address || 'Unknown');
    } else {
      setDeviceName(null);
    }
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect', 'Printer disconnect చేయాలా?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          await BluetoothService.disconnect();
          await BluetoothService.forgetLastPrinter();   // user chose to disconnect: no auto-reconnect
          setConnected(false);
          setDeviceName(null);
        },
      },
    ]);
  };

  const handleTestPrint = async () => {
    try {
      setTesting(true);
      const encoder = new EscPosEncoder();
      encoder
        .initialize()
        .align('center')
        .bold(true).size('double')
        .text('TEST PRINT').newline()
        .size('normal').bold(false)
        .divider('=')
        .text('Everycom EC-58').newline()
        .text('58mm Thermal Printer').newline()
        .divider('=')
        .align('left')
        .text('Normal text line').newline()
        .bold(true).text('Bold text line').bold(false).newline()
        .align('center')
        .divider()
        .text('Printer is working!').newline()
        .newline(3)
        .cut();
      await BluetoothService.sendBase64(encoder.encodeBase64());
      Alert.alert('Success', 'Test print sent!');
    } catch (error) {
      Alert.alert('Failed', error.message);
    } finally {
      setTesting(false);
    }
  };

  const DATA_TILES = [
    { title: 'Schools',    sub: 'Add · Upload',       icon: 'school-outline',         tone: TONE.green, onPress: () => navigation.navigate('Settings', { screen: 'Schools' }) },
    { title: 'Items',      sub: 'Add · Upload',       icon: 'bag-personal-outline',   tone: TONE.gold,  onPress: () => navigation.navigate('Settings', { screen: 'Catalog' }) },
    { title: 'Stock',      sub: 'Received · Balance', icon: 'package-variant-closed', tone: TONE.sage,  onPress: () => navigation.navigate('Stock') },
    { title: 'Defficit',   sub: 'Requirement',        icon: 'trending-down',          tone: TONE.sage,  onPress: () => navigation.navigate('Requirement') },
    { title: 'Reports',    sub: 'PDF · Excel',        icon: 'file-chart-outline',     tone: TONE.green, onPress: () => navigation.navigate('Reports') },
    { title: 'Year Close', sub: 'Backup · Promote',   icon: 'calendar-lock-outline',  tone: TONE.gold,  onPress: () => navigation.navigate('YearClose') },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      {/* ── Hero (fixed on top) ── */}
        <SafeAreaView style={styles.hero} edges={['top']}>
          <View style={styles.heroBlob} />
          <Text style={styles.heroGreeting}>{greeting}</Text>
          <Text style={styles.heroTitle}>SRKVM Kit Distribution</Text>
          <Text style={styles.heroSub}>{info.mandal ? `${info.mandal} Mandal` : 'T-Print'}</Text>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{info.year || '—'}</Text>
            <Text style={styles.heroStatLabel}>Academic Year</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{info.schools ?? '—'}</Text>
            <Text style={styles.heroStatLabel}>Schools</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{info.items ?? '—'}</Text>
            <Text style={styles.heroStatLabel}>Items</Text>
          </View>
        </View>
        </SafeAreaView>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          {/* ── Printer card ── */}
          <View style={[styles.printerCard, connected ? styles.printerOn : styles.printerOff]}>
            <View style={[styles.printerDot, { backgroundColor: connected ? Colors.success : reconnecting ? Colors.primary : Colors.danger }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.printerTitle, { color: connected ? Colors.successText : '#991b1b' }]}>
                {connected ? 'Printer Connected' : reconnecting ? 'Reconnecting…' : 'No Printer Connected'}
              </Text>
              <Text style={styles.printerSub} numberOfLines={1}>
                {connected ? deviceName : reconnecting ? 'చివరి printer కి connect అవుతోంది' : 'Bluetooth printer connect చేయండి'}
              </Text>
            </View>
            {connected ? (
              <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
                <MaterialCommunityIcons name="eject" size={14} color="#991b1b" />
                <Text style={styles.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            ) : reconnecting ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <TouchableOpacity style={styles.connectBtn} onPress={() => navigation.navigate('Scan')}>
                <MaterialCommunityIcons name="magnify" size={15} color={Colors.primaryText} />
                <Text style={styles.connectText}>Connect</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Quick Actions ── */}
          <SectionHead icon="lightning-bolt" label="Quick Actions" />
          {connected ? (
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionMain]} onPress={() => navigation.navigate('Receipt')}>
                <View style={styles.actionMainIconWrap}>
                  <MaterialCommunityIcons name="receipt-text-plus-outline" size={26} color={Colors.primaryText} />
                </View>
                <Text style={styles.actionMainTitle}>New Receipt</Text>
                <Text style={styles.actionMainSub}>Receipt తయారు చేయండి</Text>
              </TouchableOpacity>
              <View style={styles.actionCol}>
                <TouchableOpacity
                  style={[styles.actionSmall, testing && styles.rowBtnDisabled]}
                  onPress={handleTestPrint}
                  disabled={testing}
                >
                  {testing ? <ActivityIndicator size="small" color={Colors.primary} /> : <MaterialCommunityIcons name="flask-outline" size={20} color={Colors.primary} />}
                  <Text style={styles.actionSmallText}>Test Print</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionSmall} onPress={() => navigation.navigate('Scan')}>
                  <MaterialCommunityIcons name="swap-horizontal" size={20} color={Colors.primary} />
                  <Text style={styles.actionSmallText}>Change Printer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.rowCard} onPress={() => navigation.navigate('Scan')}>
              <View style={styles.rowIconWrap}><MaterialCommunityIcons name="bluetooth-connect" size={22} color={Colors.primary} /></View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Connect Printer</Text>
                <Text style={styles.rowSub}>Bluetooth తో connect చేయండి</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* ── Data Setup tiles ── */}
          <SectionHead icon="view-grid-outline" label="Data & Reports" />
          <View style={styles.grid}>
            {DATA_TILES.map(tile => (
              <TouchableOpacity key={tile.title} style={styles.tile} onPress={tile.onPress} activeOpacity={0.8}>
                <View style={[styles.tileIcon, { backgroundColor: tile.tone.bg }]}>
                  <MaterialCommunityIcons name={tile.icon} size={24} color={tile.tone.fg} />
                </View>
                <Text style={styles.tileTitle}>{tile.title}</Text>
                <Text style={styles.tileSub}>{tile.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Quick Guide ── */}
          <SectionHead icon="lightbulb-on-outline" label="Quick Guide" />
          <Card>
            {[
              { step: '1', icon: 'folder-upload-outline', text: 'Schools & Items Excel upload చేయండి (Items / Schools screen లోని Template తో)' },
              { step: '2', icon: 'printer-wireless', text: 'Printer connect చేయండి' },
              { step: '3', icon: 'receipt-text-outline', text: 'Receipt tab లో school select చేయండి' },
              { step: '4', icon: 'check-circle-outline', text: 'Roll సరిచూసి Proceed నొక్కి, Items tick చేసి print చేయండి' },
            ].map((item, idx, arr) => (
              <View key={item.step}>
                <View style={styles.guideRow}>
                  <View style={styles.guideStepBubble}>
                    <Text style={styles.guideStep}>{item.step}</Text>
                  </View>
                  <MaterialCommunityIcons name={item.icon} size={18} color={Colors.accent} />
                  <Text style={styles.guideText}>{item.text}</Text>
                </View>
                {idx < arr.length - 1 && <View style={styles.rowDivider} />}
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Icon tile tones (icon color on tinted circle) — from the uniform / bag palette
const TONE = {
  green: { fg: Colors.primary, bg: Colors.primaryLight },
  gold:  { fg: Colors.highlightText, bg: '#FBF3C9' },
  sage:  { fg: '#5E7F43', bg: '#E9F0DC' },
};

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content:   { paddingBottom: Spacing.xl },
  body:      { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.sm },

  // Hero
  hero:          { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  heroBlob:      { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.08)', top: -70, right: -60 },
  heroGreeting:  { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  heroTitle:     { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 4 },
  heroSub:       { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  heroStats:     { marginTop: Spacing.md, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingVertical: Spacing.md, elevation: 0 },
  heroStat:      { flex: 1, alignItems: 'center' },
  heroStatVal:   { fontSize: 17, fontWeight: '800', color: Colors.primary },
  heroStatLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  heroStatDivider: { width: 0.5, height: 28, backgroundColor: Colors.cardBorder },

  // Printer card
  printerCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.xl, borderWidth: 1 },
  printerOn:   { backgroundColor: Colors.successBg, borderColor: Colors.accent },
  printerOff:  { backgroundColor: Colors.dangerBg, borderColor: '#fca5a5' },
  printerDot:  { width: 10, height: 10, borderRadius: 5 },
  printerTitle:{ fontSize: 13, fontWeight: '700' },
  printerSub:  { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  disconnectBtn:{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.full },
  disconnectText:{ fontSize: 12, color: '#991b1b', fontWeight: '700' },
  connectBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.full },
  connectText: { fontSize: 12, color: Colors.primaryText, fontWeight: '700' },

  sectionRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md },
  sectionTitle: { ...Typography.label, textTransform: 'uppercase', letterSpacing: 0.8, color: Colors.primaryDark, fontWeight: '700' },

  // Quick actions (connected)
  actionRow:      { flexDirection: 'row', gap: Spacing.sm },
  actionMain:     { flex: 1.2, backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: Spacing.lg, justifyContent: 'center', elevation: 3 },
  actionMainIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  actionMainTitle:{ fontSize: 16, fontWeight: '800', color: Colors.primaryText, marginTop: Spacing.sm },
  actionMainSub:  { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  actionCol:      { flex: 1, gap: Spacing.sm },
  actionSmall:    { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: 4, elevation: 1 },
  actionSmallText:{ fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  rowBtnDisabled: { opacity: 0.55 },

  // Row card (connect printer)
  rowCard:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder, elevation: 1 },
  rowIconWrap: { width: 42, height: 42, backgroundColor: Colors.primaryLight, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  rowTextWrap: { flex: 1 },
  rowTitle:    { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  rowSub:      { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  rowDivider:  { height: 0.5, backgroundColor: Colors.cardBorder, marginHorizontal: Spacing.md },

  // Data tiles (3 per row)
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile:      { width: '31.5%', flexGrow: 1, backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.xs, elevation: 1 },
  tileIcon:  { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.sm, textAlign: 'center' },
  tileSub:   { fontSize: 10, color: Colors.textMuted, marginTop: 1, textAlign: 'center' },

  // Guide
  guideRow:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  guideStepBubble: { width: 22, height: 22, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  guideStep:       { fontSize: 11, fontWeight: '700', color: Colors.primaryText, lineHeight: 14 },
  guideText:       { fontSize: 12, color: Colors.textAccent, flex: 1 },
});