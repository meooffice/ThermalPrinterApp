// screens/HomeScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import BluetoothService from '../services/BluetoothService';
import EscPosEncoder from '../services/EscPosEncoder';
import { Colors, Radius, Spacing, Typography } from '../constants/Theme'; 
import { ScreenHeader, Card, ConnectedChip} from '../components/Ui';

export default function HomeScreen({ navigation }) {
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState(null);
  const [testing, setTesting] = useState(false);

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

      {/* ── ui.js → ScreenHeader ── */}
      <ScreenHeader title="T-Print" subtitle="SRKVM Kit Distribution" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Printer Status ── ui.js → ConnectedChip ── */}
        {connected ? (
          <View style={styles.statusRow}>
            <ConnectedChip label={`Connected · ${deviceName}`} />
            <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
              <Text style={styles.disconnectIcon}>⏏</Text>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noDeviceChip}>
            <Text style={styles.noDeviceIcon}>⚠</Text>
            <Text style={styles.noDeviceText}>No Printer Connected</Text>
          </View>
        )}

        {/* ── Quick Actions ── */}
        <Text style={styles.sectionTitle}>⚡  Quick Actions</Text>

        {/* ── ui.js → Card ── */}
        <Card style={styles.actionsCard}>
          {!connected ? (
            <TouchableOpacity
              style={styles.rowBtn}
              onPress={() => navigation.navigate('Scan')}
            >
              <View style={styles.rowIconWrap}>
                <Text style={styles.rowIcon}>🔍</Text>
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Connect Printer</Text>
                <Text style={styles.rowSub}>Bluetooth తో connect చేయండి</Text>
              </View>
              <Text style={styles.rowArrow}>›</Text>
            </TouchableOpacity>
          ) : (
            <>
              {/* Test Print */}
              <TouchableOpacity
                style={[styles.rowBtn, testing && styles.rowBtnDisabled]}
                onPress={handleTestPrint}
                disabled={testing}
              >
                <View style={styles.rowIconWrap}>
                  {testing
                    ? <ActivityIndicator size="small" color={Colors.primary} />
                    : <Text style={styles.rowIcon}>🧪</Text>
                  }
                </View>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowTitle}>Test Print</Text>
                  <Text style={styles.rowSub}>Printer working ని verify చేయండి</Text>
                </View>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>

              <View style={styles.rowDivider} />

              {/* New Receipt */}
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={() => navigation.navigate('Receipt')}
              >
                <View style={styles.rowIconWrap}>
                  <Text style={styles.rowIcon}>🧾</Text>
                </View>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowTitle}>New Receipt</Text>
                  <Text style={styles.rowSub}>Receipt తయారు చేయండి</Text>
                </View>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>

              <View style={styles.rowDivider} />

              {/* Change Printer */}
              <TouchableOpacity
                style={styles.rowBtn}
                onPress={() => navigation.navigate('Scan')}
              >
                <View style={[styles.rowIconWrap, { backgroundColor: '#f3f4f6' }]}>
                  <Text style={styles.rowIcon}>🔄</Text>
                </View>
                <View style={styles.rowTextWrap}>
                  <Text style={[styles.rowTitle, { color: Colors.textSecondary }]}>Change Printer</Text>
                  <Text style={styles.rowSub}>వేరే printer కి switch చేయండి</Text>
                </View>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>
            </>
          )}
        </Card>

        {/* ── Quick Guide ── ui.js → Card ── */}
        <Text style={styles.sectionTitle}>💡  Quick Guide</Text>
        <Card>
          {[
            { step: '1', icon: '🔌', text: 'Printer connect చేయండి' },
            { step: '2', icon: '🧾', text: 'Receipt tab లో school select చేయండి' },
            { step: '3', icon: '✅', text: 'Items tick చేసి print చేయండి' },
          ].map((item, idx, arr) => (
            <View key={item.step}>
              <View style={styles.guideRow}>
                <View style={styles.guideStepBubble}>
                  <Text style={styles.guideStep}>{item.step}</Text>
                </View>
                <Text style={styles.guideIcon}>{item.icon}</Text>
                <Text style={styles.guideText}>{item.text}</Text>
              </View>
              {idx < arr.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: { flex: 1 },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },

  // Status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.dangerBg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  disconnectIcon: { fontSize: 12, color: '#991b1b' },
  disconnectText: { fontSize: 12, color: '#991b1b', fontWeight: '600' },
  noDeviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.dangerBg,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  noDeviceIcon: { fontSize: 13, color: Colors.danger },
  noDeviceText: { fontSize: 12, color: Colors.danger, fontWeight: '600' },

  // Section title — theme → Typography.label
  sectionTitle: {
    ...Typography.label,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.xs,
  },

  // Actions Card
  actionsCard: { padding: 0, overflow: 'hidden' },

  rowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  rowBtnDisabled: { opacity: 0.55 },
  rowIconWrap: {
    width: 40,
    height: 40,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIcon: { fontSize: 20 },
  rowTextWrap: { flex: 1 },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rowSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  rowArrow: { fontSize: 22, color: Colors.textMuted },
  rowDivider: {
    height: 0.5,
    backgroundColor: Colors.cardBorder,
    marginHorizontal: Spacing.md,
  },

  // Guide Card
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  guideStepBubble: {
    width: 22,
    height: 22,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideStep: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryText,
    lineHeight: 14,
  },
  guideIcon: { fontSize: 15 },
  guideText: {
    fontSize: 12,
    color: Colors.textAccent,
    flex: 1,
  },
});