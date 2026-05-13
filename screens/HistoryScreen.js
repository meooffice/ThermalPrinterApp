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
import { Colors, Radius, Spacing, Typography } from '../constants/Theme'; 
import { ScreenHeader, Card } from '../components/Ui';


export default function HistoryScreen() {
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [printing, setPrinting] = useState(null);

  useFocusEffect(useCallback(() => { loadHistory(); }, []));

  const loadHistory = async () => {
    setLoading(true);
    setHistory(await ReceiptHistory.getAll());
    setLoading(false);
  };

  const handleDelete = (id) => {
    Alert.alert('Delete', 'Receipt delete చేయాలా?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await ReceiptHistory.delete(id); loadHistory(); } },
    ]);
  };

  const handleReprint = async (receipt) => {
    try {
      const connected = await BluetoothService.isConnected();
      if (!connected) { Alert.alert('Not Connected', 'Printer connect చేయండి.'); return; }
      setPrinting(receipt.id);
      const settings = await SettingsService.get();
      const encoder  = new EscPosEncoder();
      const width    = settings?.paperWidth || 32;

      encoder.initialize()
        .align('center').bold(true).size('double')
        .text('SRKVM Kits').newline()
        .size('normal').text(`${settings?.shopName || ''} Mandal`).newline()
        .bold(false).divider('=', width).align('left');

      const date = new Date(receipt.savedAt);
      encoder
        .text(`Date : ${date.toLocaleDateString()}`).newline()
        .text(`Time : ${date.toLocaleTimeString()}`).newline()
        .bold(true).text(`Spell: Spell ${receipt.spell || 1}`).newline()
        .bold(false).divider('-', width);

      if (receipt.school) {
        encoder.bold(true).text('School:').bold(false).newline()
          .text(receipt.school.name || '').newline();
        if (receipt.school.udise) encoder.text(`UDISE : ${receipt.school.udise}`).newline();
      }

      encoder.divider('-', width);
      const countCol = 6, nameCol = width - countCol - 1;
      encoder.bold(true).text('Item'.padEnd(nameCol) + 'Count').newline().bold(false).divider('-', width);
      (receipt.items || []).forEach(item => {
        encoder.text((item.name || '').substring(0, nameCol).padEnd(nameCol) + String(item.count || 0).padStart(countCol)).newline();
      });

      const totalQty = (receipt.items || []).reduce((sum, i) => sum + parseInt(i.count || 0), 0);
      encoder.divider('-', width)
        .row('Total Items :', String((receipt.items || []).length), width)
        .bold(true).row('Total Qty   :', String(totalQty), width).bold(false)
        .divider('=', width).align('center')
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
      { text: 'Clear All', style: 'destructive', onPress: async () => { await ReceiptHistory.clear(); loadHistory(); } },
    ]);
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const renderItem = ({ item }) => (
    // ui.js → Card
    <Card style={styles.historyCard}>
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardIconWrap}>
          <Text style={{ fontSize: 20 }}>🏫</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.schoolName}>{item.school?.name || item.shopName || 'Receipt'}</Text>
          <Text style={styles.dateText}>🕐 {formatDate(item.savedAt)}</Text>
        </View>
        <View style={styles.spellBadge}>
          <Text style={styles.spellBadgeText}>Spell {item.spell || 1}</Text>
        </View>
      </View>

      {/* Meta */}
      <View style={styles.cardMeta}>
        <View style={styles.metaChip}>
          <Text style={styles.metaChipText}>📦 {(item.items || []).length} items</Text>
        </View>
        <View style={styles.metaChip}>
          <Text style={styles.metaChipText}>🔢 {(item.items || []).reduce((s, i) => s + parseInt(i.count || 0), 0)} qty</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.reprintBtn}
          onPress={() => handleReprint(item)}
          disabled={printing !== null}
        >
          {printing === item.id
            ? <ActivityIndicator color={Colors.primary} size="small" />
            : (
              <View style={styles.actionBtnInner}>
                <Text style={styles.reprintIcon}>🖨️</Text>
                <Text style={styles.reprintText}>Reprint</Text>
              </View>
            )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
          <View style={styles.actionBtnInner}>
            <Text style={styles.deleteIcon}>🗑️</Text>
            <Text style={styles.deleteText}>Delete</Text>
          </View>
        </TouchableOpacity>
      </View>
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="History" subtitle="Printed receipts" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── ui.js → ScreenHeader ── */}
      <ScreenHeader title="History" subtitle="Printed receipts" />

      <View style={styles.container}>

        {/* Subheader row */}
        <View style={styles.subHeader}>
          <View style={styles.countChip}>
            <Text style={styles.countChipText}>📋 {history.length} records</Text>
          </View>
          {history.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
              <Text style={styles.clearBtnIcon}>🗑️</Text>
              <Text style={styles.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {history.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>No history yet</Text>
            <Text style={styles.emptyHint}>Print చేసిన తర్వాత ఇక్కడ కనిపిస్తుంది</Text>
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
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingHorizontal: Spacing.lg },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  countChip: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  countChipText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.dangerBg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  clearBtnIcon: { fontSize: 12 },
  clearBtnText: { fontSize: 12, color: Colors.danger, fontWeight: '600' },

  list: { paddingBottom: Spacing.xl },

  // Card
  historyCard:  { marginBottom: Spacing.sm, gap: Spacing.sm },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardIconWrap: { width: 40, height: 40, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  cardInfo:     { flex: 1 },
  schoolName:   { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  dateText:     { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  spellBadge:   { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.md },
  spellBadgeText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },

  cardMeta: { flexDirection: 'row', gap: Spacing.sm },
  metaChip: { backgroundColor: Colors.background, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.sm },
  metaChipText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },

  cardActions:    { flexDirection: 'row', gap: Spacing.sm },
  actionBtnInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  reprintBtn:     { flex: 1, backgroundColor: Colors.primaryLight, padding: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  reprintIcon:    { fontSize: 14 },
  reprintText:    { color: Colors.primary, fontWeight: '600', fontSize: 13 },
  deleteBtn:      { flex: 1, backgroundColor: Colors.dangerBg, padding: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  deleteIcon:     { fontSize: 14 },
  deleteText:     { color: Colors.danger, fontWeight: '600', fontSize: 13 },

  // Empty
  emptyEmoji: { fontSize: 52, marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.xs },
  emptyHint:  { ...Typography.bodySm, textAlign: 'center' },
});