// screens/ScanScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import BluetoothService from '../services/BluetoothService';

export default function ScanScreen({ navigation }) {
  const [pairedDevices, setPairedDevices]   = useState([]);
  const [nearbyDevices, setNearbyDevices]   = useState([]);
  const [scanning, setScanning]             = useState(false);
  const [connecting, setConnecting]         = useState(null); // device address

  useEffect(() => {
    initBluetooth();
    return () => {
      BluetoothService.cancelDiscovery().catch(() => {});
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    const grants = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(grants).every(
      v => v === PermissionsAndroid.RESULTS.GRANTED
    );
  };

  const initBluetooth = async () => {
    try {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert('Permission Denied', 'Bluetooth permissions are required.');
        return;
      }
      const enabled = await BluetoothService.requestEnable();
      if (!enabled) {
        Alert.alert('Bluetooth Off', 'Please enable Bluetooth and try again.');
        return;
      }
      const paired = await BluetoothService.getPairedDevices();
      setPairedDevices(paired);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const startScan = async () => {
    try {
      setScanning(true);
      setNearbyDevices([]);
      const devices = await BluetoothService.startDiscovery();
      setNearbyDevices(devices);
    } catch (error) {
      Alert.alert('Scan Error', error.message);
    } finally {
      setScanning(false);
    }
  };

  const connectToDevice = async (device) => {
    try {
      setConnecting(device.address);
      await BluetoothService.connect(device);
      Alert.alert(
        'Connected!',
        `Connected to ${device.name}`,
        [{ text: 'Go to Printer', onPress: () => navigation.navigate('Home') }]
      );
    } catch (error) {
      Alert.alert('Connection Failed', error.message);
    } finally {
      setConnecting(null);
    }
  };

  const renderDevice = ({ item }) => (
    <TouchableOpacity
      style={styles.deviceCard}
      onPress={() => connectToDevice(item)}
      disabled={connecting !== null}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
        <Text style={styles.deviceAddress}>{item.address}</Text>
      </View>
      {connecting === item.address ? (
        <ActivityIndicator color="#4f46e5" />
      ) : (
        <Text style={styles.connectText}>Connect</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>

      {/* Paired Devices */}
      <Text style={styles.sectionTitle}>Paired Devices</Text>
      {pairedDevices.length === 0 ? (
        <Text style={styles.emptyText}>No paired devices found.</Text>
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
        style={[styles.scanButton, scanning && styles.scanButtonDisabled]}
        onPress={startScan}
        disabled={scanning}
      >
        {scanning ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.scanButtonText}>Scan for Devices</Text>
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

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 8,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    elevation: 1,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  deviceAddress: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  connectText: {
    color: '#4f46e5',
    fontWeight: '600',
    fontSize: 14,
  },
  scanButton: {
    backgroundColor: '#4f46e5',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  scanButtonDisabled: {
    backgroundColor: '#a5b4fc',
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});