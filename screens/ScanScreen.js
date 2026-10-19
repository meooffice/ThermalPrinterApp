// screens/ScanScreen.js
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet, PermissionsAndroid, Platform,  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BluetoothService from '../services/BluetoothService';
import { isPrinterDevice } from '../services/PrinterFilter';
import { Colors, Radius, Spacing, Typography } from '../constants/Theme'; 
import { ScreenHeader, Card, ConnectedChip } from '../components/ui';
import { NativeModules, TurboModuleRegistry } from 'react-native';

// Section heading with an icon (display only)
function SectionHead({ icon, label }) {
  return (
    <View style={styles.sectionRow}>
      <MaterialCommunityIcons name={icon} size={16} color={Colors.primary} />
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );
}

export default function ScanScreen({ navigation }) {
  const [pairedDevices, setPairedDevices] = useState([]);
  const [nearbyDevices, setNearbyDevices] = useState([]);
  const [scanning, setScanning]           = useState(false);
  const [connecting, setConnecting]       = useState(null);
  const [showAll, setShowAll]             = useState(false);   // false = printers only

  useEffect(() => {
    
    initBluetooth();
    return () => { BluetoothService.cancelDiscovery().catch(() => {}); };
  }, []);

  const requestPermissions = async () => {
  if (Platform.OS !== 'android') return true;
  // BLUETOOTH_CONNECT / BLUETOOTH_SCAN Android 12 (API 31) నుండి మాత్రమే ఉన్నాయి
  const perms = Platform.Version >= 31
    ? [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const grants = await PermissionsAndroid.requestMultiple(perms);
  return Object.values(grants).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
};

  const initBluetooth = async () => {
    try {
      const granted = await requestPermissions();
      if (!granted) { Alert.alert('Permission Denied', 'Bluetooth permissions required.'); return; }
      const enabled = await BluetoothService.requestEnable();
      if (!enabled) { Alert.alert('Bluetooth Off', 'Please enable Bluetooth.'); return; }
      const paired = await BluetoothService.getPairedDevices();
      setPairedDevices(paired);
    } catch (error) { Alert.alert('Error', error.message); }
  };

  const startScan = async () => {
    try {
      setScanning(true);
      setNearbyDevices([]);
      const devices = await BluetoothService.startDiscovery();
      setNearbyDevices(devices);
    } catch (error) { Alert.alert('Scan Error', error.message); }
    finally { setScanning(false); }
  };

  const connectToDevice = async (device) => {
    try {
      setConnecting(device.address);
      await BluetoothService.connect(device);
      Alert.alert('Connected', `${device.name} కి connect అయింది`, [
        { text: 'Go Home', onPress: () => navigation.navigate('HomeMain') },
      ]);
    } catch (error) { Alert.alert('Failed', error.message); }
    finally { setConnecting(null); }
  };

  // Printers only by default (display filter; connection logic is unchanged)
  const visiblePaired = showAll ? pairedDevices : pairedDevices.filter(isPrinterDevice);
  const visibleNearby = showAll ? nearbyDevices : nearbyDevices.filter(isPrinterDevice);
  const hiddenCount   = (pairedDevices.length - pairedDevices.filter(isPrinterDevice).length)
                      + (nearbyDevices.length - nearbyDevices.filter(isPrinterDevice).length);

  const renderDevice = ({ item }) => (
    <TouchableOpacity
      style={styles.deviceCard}
      onPress={() => connectToDevice(item)}
      disabled={connecting !== null}
      activeOpacity={0.8}
    >
      <View style={styles.deviceIcon}>
        <MaterialCommunityIcons name="printer" size={24} color={Colors.primary} />
      </View>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
        <View style={styles.deviceRow}>
          <MaterialCommunityIcons name="bluetooth" size={12} color={Colors.textMuted} />
          <Text style={styles.deviceAddress}>{item.address}</Text>
        </View>
        {showAll && item.deviceClass ? (
          <View style={styles.deviceRow}>
            <MaterialCommunityIcons name={isPrinterDevice(item) ? 'printer' : 'cellphone'} size={12} color={Colors.textMuted} />
            <Text style={styles.deviceAddress}>
              {isPrinterDevice(item) ? 'printer' : 'ఇతర'} · class {item.deviceClass.majorClass}/{item.deviceClass.deviceClass}
            </Text>
          </View>
        ) : null}
      </View>
      {connecting === item.address ? (
        <ActivityIndicator color={Colors.primary} />
      ) : (
        <View style={styles.connectBadge}>
          <Text style={styles.connectBadgeText}>Connect</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── ui.js → ScreenHeader ── */}
      <ScreenHeader title="Connect" subtitle="Bluetooth Printer" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* Back button row */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹  Back</Text>
        </TouchableOpacity>

        {/* ── Paired Devices ── */}
        <SectionHead icon="link-variant" label="Paired Devices" />
        {visiblePaired.length === 0 ? (
          // ui.js → Card
          <Card style={styles.emptyCard}>
            <MaterialCommunityIcons name="bluetooth-off" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Paired devices లేవు</Text>
            <Text style={styles.emptyHint}>Phone Settings లో printer pair చేయండి</Text>
          </Card>
        ) : (
          <FlatList
            data={visiblePaired}
            keyExtractor={item => item.address}
            renderItem={renderDevice}
            scrollEnabled={false}
          />
        )}

        {/* ── Printers only / all devices toggle ── */}
        {(hiddenCount > 0 || showAll) && (
          <TouchableOpacity style={styles.filterToggle} onPress={() => setShowAll(v => !v)}>
            <MaterialCommunityIcons name={showAll ? 'printer' : 'cellphone'} size={15} color={Colors.primary} />
            <Text style={styles.filterToggleText}>
              {showAll ? 'Printers మాత్రమే చూపించు' : `ఇతర devices (${hiddenCount}) కూడా చూపించు`}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Scan Button ── */}
        <TouchableOpacity
          style={[styles.scanBtn, scanning && styles.scanBtnDisabled]}
          onPress={startScan}
          disabled={scanning}
          activeOpacity={0.85}
        >
          {scanning ? (
            <View style={styles.scanBtnContent}>
              <ActivityIndicator color={Colors.primaryText} size="small" />
              <Text style={styles.scanBtnText}>Scanning...</Text>
            </View>
          ) : (
            <View style={styles.scanBtnContent}>
              <MaterialCommunityIcons name="radar" size={20} color={Colors.primaryText} />
              <Text style={styles.scanBtnText}>Scan for New Devices</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Nearby Devices ── */}
        {visibleNearby.length > 0 && (
          <>
            <SectionHead icon="radar" label="Nearby Devices" />
            <FlatList
              data={visibleNearby}
              keyExtractor={item => item.address}
              renderItem={renderDevice}
              scrollEnabled={false}
            />
          </>
        )}

        {/* ── Tips ── ui.js → Card ── */}
        <SectionHead icon="lightbulb-on-outline" label="Tips" />
        <Card style={styles.hintCard}>
          {[
            { icon: 'power-plug-outline', text: 'Printer on చేయండి' },
            { icon: 'bluetooth', text: 'Phone Bluetooth on చేయండి' },
            { icon: 'magnify', text: '"EC58" లేదా "BT Printer" పేరు కోసం చూడండి' },
          ].map((tip, idx) => (
            <View key={idx} style={styles.tipRow}>
              <MaterialCommunityIcons name={tip.icon} size={18} color={Colors.accent} style={styles.tipIcon} />
              <Text style={styles.tipText}>{tip.text}</Text>
            </View>
          ))}
        </Card>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content:   { padding: Spacing.lg, gap: Spacing.sm },

  backBtn:     { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  backBtnText: { fontSize: 16, color: Colors.primary, fontWeight: '600' },

  sectionRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
  sectionTitle: { ...Typography.label, textTransform: 'uppercase', letterSpacing: 0.8, color: Colors.primaryDark, fontWeight: '700' },

  // Device card
  deviceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    elevation: 1,
  },
  deviceIcon:    { width: 44, height: 44, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  deviceInfo:    { flex: 1 },
  deviceName:    { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  deviceRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  deviceAddress: { fontSize: 11, color: Colors.textMuted },
  filterToggle:     { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterToggleText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  connectBadge:  { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  connectBadgeText: { color: Colors.primary, fontWeight: '700', fontSize: 12 },

  // Empty card
  emptyCard: { alignItems: 'center', gap: Spacing.xs },
  emptyText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  emptyHint: { ...Typography.bodySm, textAlign: 'center' },

  // Scan button
  scanBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    alignItems: 'center',
    elevation: 2,
  },
  scanBtnDisabled: { backgroundColor: '#9DB89F' },
  scanBtnContent:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  scanBtnText:     { color: Colors.primaryText, fontWeight: '700', fontSize: 15 },

  // Hint card
  hintCard: { gap: Spacing.sm },
  tipRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tipIcon:  { width: 24, textAlign: 'center' },
  tipText:  { fontSize: 13, color: Colors.textAccent, flex: 1 },
});