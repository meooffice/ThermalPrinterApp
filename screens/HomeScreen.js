// screens/HomeScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import BluetoothService from '../services/BluetoothService';
import EscPosEncoder from '../services/EscPosEncoder';

export default function HomeScreen({ navigation }) {
  const [connected, setConnected]   = useState(false);
  const [deviceName, setDeviceName] = useState(null);
  const [testing, setTesting]       = useState(false);

  useFocusEffect(
    useCallback(() => { checkConnection(); }, [])
  );

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
      Alert.alert('✅ Success', 'Test print sent!');
    } catch (error) {
      Alert.alert('❌ Failed', error.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>SRKVM Kit Distribution</Text>
            <Text style={styles.headerTitle}>T-Print</Text>
          </View>
          <View style={styles.headerIcon}>
            <Text style={{ fontSize: 28 }}>🖨️</Text>
          </View>
        </View>

        {/* Printer Status Card */}
        <View style={[
          styles.statusCard,
          connected ? styles.statusConnected : styles.statusDisconnected
        ]}>
          <View style={styles.statusLeft}>
            <View style={[
              styles.statusDot,
              connected ? styles.dotConnected : styles.dotDisconnected
            ]} />
            <View>
              <Text style={[
                styles.statusTitle,
                { color: connected ? '#065f46' : '#991b1b' }
              ]}>
                {connected ? 'Printer Connected' : 'No Printer'}
              </Text>
              <Text style={[
                styles.statusSub,
                { color: connected ? '#047857' : '#b91c1c' }
              ]}>
                {connected ? deviceName : 'Connect your printer'}
              </Text>
            </View>
          </View>
          {connected && (
            <TouchableOpacity
              style={styles.disconnectBtn}
              onPress={handleDisconnect}
            >
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        {!connected ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('Scan')}
          >
            <Text style={styles.primaryBtnIcon}>🔍</Text>
            <View>
              <Text style={styles.primaryBtnTitle}>Connect Printer</Text>
              <Text style={styles.primaryBtnSub}>Bluetooth తో connect చేయండి</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.primaryBtn, testing && styles.btnDisabled]}
              onPress={handleTestPrint}
              disabled={testing}
            >
              {testing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.primaryBtnIcon}>🧪</Text>
                  <View>
                    <Text style={styles.primaryBtnTitle}>Test Print</Text>
                    <Text style={styles.primaryBtnSub}>Printer working ని verify చేయండి</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('Scan')}
            >
              <Text style={styles.secondaryBtnIcon}>🔄</Text>
              <View>
                <Text style={styles.secondaryBtnTitle}>Change Printer</Text>
                <Text style={styles.secondaryBtnSub}>వేరే printer కి switch చేయండి</Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 Quick Guide</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoStep}>1</Text>
            <Text style={styles.infoText}>Printer connect చేయండి</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoStep}>2</Text>
            <Text style={styles.infoText}>🧾 Receipt tab లో school select చేయండి</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoStep}>3</Text>
            <Text style={styles.infoText}>Items tick చేసి print చేయండి</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 52,
    paddingBottom: 20,
  },
  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    marginBottom:    24,
  },
  headerSub: {
    fontSize:  12,
    color:     '#6b7280',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize:   28,
    fontWeight: '800',
    color:      '#1e1b4b',
  },
  headerIcon: {
    width:           52,
    height:          52,
    backgroundColor: '#ede9fe',
    borderRadius:    16,
    alignItems:      'center',
    justifyContent:  'center',
  },
  statusCard: {
    borderRadius:   16,
    padding:        16,
    marginBottom:   24,
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  statusConnected: {
    backgroundColor: '#d1fae5',
  },
  statusDisconnected: {
    backgroundColor: '#fee2e2',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  statusDot: {
    width:        10,
    height:       10,
    borderRadius: 5,
  },
  dotConnected: {
    backgroundColor: '#10b981',
  },
  dotDisconnected: {
    backgroundColor: '#ef4444',
  },
  statusTitle: {
    fontSize:   14,
    fontWeight: '700',
  },
  statusSub: {
    fontSize:  12,
    marginTop:  2,
  },
  disconnectBtn: {
    backgroundColor: '#fca5a5',
    paddingHorizontal: 12,
    paddingVertical:    6,
    borderRadius:      10,
  },
  disconnectText: {
    fontSize:   12,
    color:      '#991b1b',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize:     13,
    fontWeight:   '700',
    color:        '#6b7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  primaryBtn: {
    backgroundColor: '#4f46e5',
    borderRadius:    16,
    padding:         16,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             14,
    marginBottom:    10,
    elevation:       2,
  },
  btnDisabled: {
    backgroundColor: '#a5b4fc',
  },
  primaryBtnIcon: {
    fontSize: 24,
  },
  primaryBtnTitle: {
    fontSize:   15,
    fontWeight: '700',
    color:      '#fff',
  },
  primaryBtnSub: {
    fontSize:  11,
    color:     '#c7d2fe',
    marginTop:  2,
  },
  secondaryBtn: {
    backgroundColor: '#fff',
    borderRadius:    16,
    padding:         16,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             14,
    marginBottom:    10,
    borderWidth:     1,
    borderColor:     '#e5e7eb',
    elevation:       1,
  },
  secondaryBtnIcon: {
    fontSize: 24,
  },
  secondaryBtnTitle: {
    fontSize:   15,
    fontWeight: '700',
    color:      '#1e1b4b',
  },
  secondaryBtnSub: {
    fontSize:  11,
    color:     '#9ca3af',
    marginTop:  2,
  },
  infoCard: {
    backgroundColor: '#f0f4ff',
    borderRadius:    16,
    padding:         16,
    marginTop:       12,
    borderWidth:     1,
    borderColor:     '#e0e7ff',
  },
  infoTitle: {
    fontSize:     13,
    fontWeight:   '700',
    color:        '#3730a3',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    marginBottom:  8,
  },
  infoStep: {
    width:           22,
    height:          22,
    backgroundColor: '#4f46e5',
    borderRadius:    11,
    color:           '#fff',
    fontSize:        12,
    fontWeight:      '700',
    textAlign:       'center',
    lineHeight:      22,
  },
  infoText: {
    fontSize: 12,
    color:    '#4338ca',
    flex:     1,
  },
});