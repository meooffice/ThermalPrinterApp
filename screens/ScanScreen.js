// screens/ScanScreen.js
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet, PermissionsAndroid, Platform, SafeAreaView,
} from 'react-native';
import BluetoothService from '../services/BluetoothService';
import { Colors, Radius, Spacing, Shadow } from '../constants/Theme';

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
        <Text style={{ fontSize: 20 }}>🖨️</Text>
      </View>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
        <Text style={styles.deviceAddress}>{item.address}</Text>
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
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>‹ Back</Text>
          </TouchableOpacity>
          <View style={styles.headerIcon}>
            <Text style={{ fontSize: 26 }}>🔍</Text>
          </View>
        </View>

        <Text style={styles.headerSub}>Bluetooth Printer</Text>
        <Text style={styles.headerTitle}>Connect</Text>

        {/* Paired Devices */}
        <Text style={styles.sectionTitle}>Paired Devices</Text>
        {pairedDevices.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Paired devices లేవు</Text>
            <Text style={styles.emptyHint}>Phone Settings లో printer pair చేయండి</Text>
          </View>
        ) : (
          <FlatList
            data={pairedDevices}
            keyExtractor={item => item.address}
            renderItem={renderDevice}
            scrollEnabled={false}
          />
        )}

        {/* Scan Button */}
        <TouchableOpacity
          style={[styles.scanBtn, scanning && styles.scanBtnDisabled]}
          onPress={startScan}
          disabled={scanning}
          activeOpacity={0.85}
        >
          {scanning ? (
            <View style={styles.scanBtnContent}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.scanBtnText}>Scanning...</Text>
            </View>
          ) : (
            <View style={styles.scanBtnContent}>
              <Text style={{ fontSize: 20 }}>📡</Text>
              <Text style={styles.scanBtnText}>Scan for New Devices</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Nearby Devices */}
        {nearbyDevices.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Nearby Devices</Text>
            <FlatList
              data={nearbyDevices}
              keyExtractor={item => item.address}
              renderItem={renderDevice}
            />
          </>
        )}

        {/* Hint */}
        <View style={styles.hintCard}>
          <Text style={styles.hintTitle}>💡 Tips</Text>
          <Text style={styles.hintText}>• Printer on చేయండి</Text>
          <Text style={styles.hintText}>• Phone Bluetooth on చేయండి</Text>
          <Text style={styles.hintText}>• "EC58" లేదా "BT Printer" పేరు కోసం చూడండి</Text>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bgPage },
  container: { flex: 1, padding: Spacing.xl, paddingTop: 52 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  backBtn:     { paddingVertical: 8, paddingRight: 16 },
  backBtnText: { fontSize: 16, color: Colors.primary, fontWeight: '600' },
  headerIcon:  { width: 52, height: 52, backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  headerSub:   { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.primaryDark, marginBottom: Spacing.xxl },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginTop: 8, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  deviceCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: Colors.border, ...Shadow.card },
  deviceIcon: { width: 44, height: 44, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  deviceInfo: { flex: 1 },
  deviceName:    { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  deviceAddress: { fontSize: 11, color: Colors.textHint, marginTop: 2 },
  connectBadge:  { backgroundColor: Colors.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  connectBadgeText: { color: Colors.primary, fontWeight: '700', fontSize: 12 },

  emptyCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 20, alignItems: 'center', marginBottom: 8, borderWidth: 0.5, borderColor: Colors.border },
  emptyText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  emptyHint: { fontSize: 12, color: Colors.textHint, textAlign: 'center' },

  scanBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 16, alignItems: 'center', marginVertical: 12, ...Shadow.card },
  scanBtnDisabled: { backgroundColor: Colors.primaryMid },
  scanBtnContent:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scanBtnText:     { color: '#fff', fontWeight: '700', fontSize: 15 },

  hintCard: { backgroundColor: '#f0f4ff', borderRadius: Radius.lg, padding: 16, marginTop: 8, borderWidth: 1, borderColor: '#e0e7ff' },
  hintTitle:{ fontSize: 13, fontWeight: '700', color: '#3730a3', marginBottom: 8 },
  hintText: { fontSize: 12, color: '#4338ca', marginBottom: 4 },
});