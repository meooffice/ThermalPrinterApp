// screens/ScanScreen.js
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet, PermissionsAndroid, Platform, SafeAreaView, ScrollView,
} from 'react-native';
import BluetoothService from '../services/BluetoothService';
import { Colors, Radius, Spacing, Typography } from '../constants/Theme'; 
import { ScreenHeader, Card, ConnectedChip } from '../components/ui';

export default function ScanScreen({ navigation }) {
  const [pairedDevices, setPairedDevices] = useState([]);
  const [nearbyDevices, setNearbyDevices] = useState([]);
  const [scanning, setScanning]           = useState(false);
  const [connecting, setConnecting]       = useState(null);

  useEffect(() => {
    initBluetooth();
    return () => { BluetoothService.cancelDiscovery().catch(() => {}); };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    const grants = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
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
      Alert.alert('✅ Connected!', `${device.name} కి connect అయింది`, [
        { text: 'Go Home', onPress: () => navigation.navigate('HomeMain') },
      ]);
    } catch (error) { Alert.alert('❌ Failed', error.message); }
    finally { setConnecting(null); }
  };

  const renderDevice = ({ item }) => (
    <TouchableOpacity
      style={styles.deviceCard}
      onPress={() => connectToDevice(item)}
      disabled={connecting !== null}
      activeOpacity={0.8}
    >
      <View style={styles.deviceIcon}>
        <Text style={{ fontSize: 22 }}>🖨️</Text>
      </View>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
        <Text style={styles.deviceAddress}>📶 {item.address}</Text>
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
        <Text style={styles.sectionTitle}>🔗  Paired Devices</Text>
        {pairedDevices.length === 0 ? (
          // ui.js → Card
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📵</Text>
            <Text style={styles.emptyText}>Paired devices లేవు</Text>
            <Text style={styles.emptyHint}>Phone Settings లో printer pair చేయండి</Text>
          </Card>
        ) : (
          <FlatList
            data={pairedDevices}
            keyExtractor={item => item.address}
            renderItem={renderDevice}
            scrollEnabled={false}
          />
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
              <Text style={styles.scanBtnIcon}>📡</Text>
              <Text style={styles.scanBtnText}>Scan for New Devices</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Nearby Devices ── */}
        {nearbyDevices.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>📡  Nearby Devices</Text>
            <FlatList
              data={nearbyDevices}
              keyExtractor={item => item.address}
              renderItem={renderDevice}
              scrollEnabled={false}
            />
          </>
        )}

        {/* ── Tips ── ui.js → Card ── */}
        <Text style={styles.sectionTitle}>💡  Tips</Text>
        <Card style={styles.hintCard}>
          {[
            { icon: '🔌', text: 'Printer on చేయండి' },
            { icon: '📱', text: 'Phone Bluetooth on చేయండి' },
            { icon: '🔍', text: '"EC58" లేదా "BT Printer" పేరు కోసం చూడండి' },
          ].map((tip, idx) => (
            <View key={idx} style={styles.tipRow}>
              <Text style={styles.tipIcon}>{tip.icon}</Text>
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

  sectionTitle: { ...Typography.label, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.xs },

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
  deviceAddress: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  connectBadge:  { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  connectBadgeText: { color: Colors.primary, fontWeight: '700', fontSize: 12 },

  // Empty card
  emptyCard: { alignItems: 'center', gap: Spacing.xs },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  emptyHint: { ...Typography.bodySm, textAlign: 'center' },

  // Scan button
  scanBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    elevation: 2,
  },
  scanBtnDisabled: { backgroundColor: '#a5b4fc' },
  scanBtnContent:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  scanBtnIcon:     { fontSize: 20 },
  scanBtnText:     { color: Colors.primaryText, fontWeight: '700', fontSize: 15 },

  // Hint card
  hintCard: { gap: Spacing.sm },
  tipRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tipIcon:  { fontSize: 16, width: 24, textAlign: 'center' },
  tipText:  { fontSize: 13, color: Colors.textAccent, flex: 1 },
});