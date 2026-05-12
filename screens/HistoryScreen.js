// screens/HistoryScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ReceiptHistory from '../services/ReceiptHistory';
import BluetoothService from '../services/BluetoothService';
import EscPosEncoder from '../services/EscPosEncoder';
import SettingsService from '../services/SettingsService';

export default function HistoryScreen() {
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [printing, setPrinting] = useState(null);

  useFocusEffect(
    useCallback(() => { loadHistory(); }, [])
  );

  const loadHistory = async () => {
    setLoading(true);
    const all = await ReceiptHistory.getAll();
    setHistory(all);
    setLoading(false);
  };

  const handleDelete = (id) => {
    Alert.alert('Delete', 'Receipt delete చేయాలా?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await ReceiptHistory.delete(id);
          loadHistory();
        },
      },
    ]);
  };

  const handleReprint = async (receipt) => {
    try {
      const connected = await BluetoothService.isConnected();
      if (!connected) {
        Alert.alert('Not Connected', 'Printer connect చేయండి.');
        return;
      }
      setPrinting(receipt.id);
      const settings = await SettingsService.get();
      const encoder  = new EscPosEncoder();
      const width    = settings?.paperWidth || 32;

      encoder.initialize()
        .align('center')
        .bold(true).size('double')
        .text('SRKVM Kits').newline()
        .size('normal')
        .text(`${settings?.shopName || ''} Mandal`).newline()
        .bold(false)
        .divider('=', width)
        .align('left');

      const date = new Date(receipt.savedAt);
      encoder
        .text(`Date : ${date.toLocaleDateString()}`).newline()
        .text(`Time : ${date.toLocaleTimeString()}`).newline()
        .bold(true)
        .text(`Spell: Spell ${receipt.spell || 1}`).newline()
        .bold(false)
        .divider('-', width);

      if (receipt.school) {
        encoder.bold(true).text('School:').bold(false).newline()
          .text(receipt.school.name || '').newline();
        if (receipt.school.udise) {
          encoder.text(`UDISE : ${receipt.school.udise}`).newline();
        }
      }

      encoder.divider('-', width);
      const countCol = 6;
      const nameCol  = width - countCol - 1;
      encoder.bold(true)
        .text('Item'.padEnd(nameCol) + 'Count').newline()
        .bold(false).divider('-', width);

      (receipt.items || []).forEach(item => {
        const name  = (item.name || '').substring(0, nameCol).padEnd(nameCol);
        const count = String(item.count || 0).padStart(countCol);
        encoder.text(name + count).newline();
      });

      const totalQty = (receipt.items || []).reduce(
        (sum, i) => sum + parseInt(i.count || 0), 0
      );

      encoder.divider('-', width)
        .row('Total Items :', String((receipt.items || []).length), width)
        .bold(true)
        .row('Total Qty   :', String(totalQty), width)
        .bold(false)
        .divider('=', width)
        .align('center')
        .text(settings?.shopTagline || 'Thank you!').newline()
        .newline(3).cut();

      await BluetoothService.sendBase64(encoder.encodeBase64());
      Alert.alert('✅ Success', 'Reprinted successfully!');
    } catch (error) {
      Alert.alert('❌ Failed', error.message);
    } finally {
      setPrinting(null);
    }
  };

  const handleClearAll = () => {
    Alert.alert('Clear All', 'All history delete చేయాలా?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All', style: 'destructive',
        onPress: async () => {
          await ReceiptHistory.clear();
          loadHistory();
        },
      },
    ]);
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} · ${d.toLocaleTimeString(
      [], { hour: '2-digit', minute: '2-digit' }
    )}`;
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIconWrap}>
          <Text style={{ fontSize: 20 }}>🏫</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.schoolName}>
            {item.school?.name || item.shopName || 'Receipt'}
          </Text>
          <Text style={styles.dateText}>{formatDate(item.savedAt)}</Text>
        </View>
        <View style={styles.spellBadge}>
          <Text style={styles.spellBadgeText}>Spell {item.spell || 1}</Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>
          {(item.items || []).length} items ·{' '}
          {(item.items || []).reduce((s, i) => s + parseInt(i.count || 0), 0)} qty
        </Text>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.reprintBtn}
          onPress={() => handleReprint(item)}
          disabled={printing !== null}
        >
          {printing === item.id ? (
            <ActivityIndicator color="#4f46e5" size="small" />
          ) : (
            <Text style={styles.reprintText}>🖨️  Reprint</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item.id)}
        >
          <Text style={styles.deleteText}>🗑️  Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>Printed receipts</Text>
            <Text style={styles.headerTitle}>History</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.headerIcon}>
              <Text style={{ fontSize: 26 }}>📋</Text>
            </View>
            {history.length > 0 && (
              <TouchableOpacity onPress={handleClearAll}>
                <Text style={styles.clearText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {history.length === 0 ? (
          <View style={styles.centered}>
            <Text style={{ fontSize: 52, marginBottom: 16 }}>📋</Text>
            <Text style={styles.emptyTitle}>No history yet</Text>
            <Text style={styles.emptyHint}>
              Print చేసిన తర్వాత ఇక్కడ కనిపిస్తుంది
            </Text>
          </View>
        ) : (
          <FlatList
            data={history}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { flex: 1, padding: 20, paddingTop: 52 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  headerSub: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1e1b4b' },
  headerRight: { alignItems: 'flex-end', gap: 6 },
  headerIcon: {
    width: 52, height: 52, backgroundColor: '#ede9fe',
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  clearText: { fontSize: 12, color: '#ef4444', fontWeight: '600' },
  list: { paddingBottom: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 14, marginBottom: 10, elevation: 1,
    borderWidth: 0.5, borderColor: '#f0f0f0',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 8,
  },
  cardIconWrap: {
    width: 40, height: 40, backgroundColor: '#ede9fe',
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  schoolName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  dateText: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  spellBadge: {
    backgroundColor: '#ede9fe', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 10,
  },
  spellBadgeText: { fontSize: 11, color: '#4f46e5', fontWeight: '700' },
  cardMeta: { marginBottom: 10 },
  metaText: { fontSize: 12, color: '#6b7280' },
  cardActions: { flexDirection: 'row', gap: 8 },
  reprintBtn: {
    flex: 1, backgroundColor: '#ede9fe', padding: 10,
    borderRadius: 10, alignItems: 'center',
  },
  reprintText: { color: '#4f46e5', fontWeight: '600', fontSize: 13 },
  deleteBtn: {
    flex: 1, backgroundColor: '#fee2e2', padding: 10,
    borderRadius: 10, alignItems: 'center',
  },
  deleteText: { color: '#ef4444', fontWeight: '600', fontSize: 13 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 6 },
  emptyHint: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
});