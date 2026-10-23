// screens/HistoryScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ReceiptHistory from '../services/ReceiptHistory';
import BluetoothService from '../services/BluetoothService';
import { buildReceiptBase64 } from '../services/ReceiptPrinter';
import SettingsService from '../services/SettingsService';
import ShareService from '../services/ShareService';
import { Colors, Radius, Spacing, Typography } from '../constants/Theme'; 
import { Card } from '../components/ui';
import Hero from '../components/Hero';


export default function HistoryScreen() {
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [printing, setPrinting] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');   // all | active | cancelled | legacy

  useFocusEffect(useCallback(() => { loadHistory(); }, []));

  const loadHistory = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setHistory(await ReceiptHistory.getAll());
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Old (legacy / test) receipts only: permanent delete
  const handleDelete = (id) => {
    Alert.alert('Delete', 'ఈ పాత receipt ను శాశ్వతంగా delete చేయాలా?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await ReceiptHistory.delete(id); loadHistory(); }
          catch (e) { Alert.alert('Delete కాదు', e.message); }
        } },
    ]);
  };

  // New receipts: Cancel (stays in the list, invoice number remains accounted for)
  const handleCancel = (entry) => {
    Alert.alert(
      'Receipt Cancel చేయాలా?',
      `${entry.invoiceNo || ''}\n${entry.schoolName}\n\nCancel చేస్తే ఈ రశీదు లెక్క నుండి తొలగిపోతుంది. తిరిగి మార్చలేరు.`,
      [
        { text: 'వెనక్కి', style: 'cancel' },
        { text: 'Cancel Receipt', style: 'destructive',
          onPress: async () => {
            try { await ReceiptHistory.cancel(entry.id); loadHistory(); }
            catch (e) { Alert.alert('Cancel కాదు', e.message); }
          } },
      ],
    );
  };

  // Share an OLD receipt again as an A4 PDF (WhatsApp, Drive, mail ... from the share sheet).
  // Nothing is issued or saved: same invoice number, original date, marked DUPLICATE COPY.
  const handleSharePdf = async (entry) => {
    if (printing) return;
    try {
      setPrinting(entry.id);
      const receipt = await ReceiptHistory.get(entry.id);
      if (!receipt) { Alert.alert('Failed', 'రశీదు data కనబడలేదు.'); return; }
      const settings = await SettingsService.get();
      const items = receipt.items || [];
      const totalQty = Number(entry.totalQty ?? receipt.totalQty) ||
        items.reduce((a, i) => a + (parseInt(i.count, 10) || 0), 0);
      await ShareService.sharePDF({
        settings, school: receipt.school, spell: receipt.spell || 1, items, totalQty,
        invoiceNo: receipt.invoiceNo, when: new Date(receipt.savedAt), duplicate: true,
      });
    } catch (error) {
      Alert.alert('Failed', error.message);
    } finally {
      setPrinting(null);
    }
  };

  const handleReprint = async (entry) => {
    if (printing) return;                       // a reprint is already running
    try {
      setPrinting(entry.id);                // also shown while a dropped printer is being reconnected
      const connected = await BluetoothService.ensureConnected();
      if (!connected) { Alert.alert('Not Connected', 'Printer connect చేయండి.'); return; }
      const receipt = await ReceiptHistory.get(entry.id);   // full receipt is loaded only when needed
      if (!receipt) { Alert.alert('Failed', 'రశీదు data కనబడలేదు.'); return; }
      const settings = await SettingsService.get();
      const data = await buildReceiptBase64({
        settings, school: receipt.school, spell: receipt.spell || 1, items: receipt.items || [],
        invoiceNo: receipt.invoiceNo, when: new Date(receipt.savedAt), duplicate: true,
      });
      await BluetoothService.sendBase64(data);
      Alert.alert('Success', 'Reprinted successfully!');
    } catch (error) {
      Alert.alert('Failed', error.message);
    } finally {
      setPrinting(null);
    }
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const q = search.trim().toLowerCase();
  const statusOf = (r) => (r.status === 'cancelled' ? 'cancelled' : r.legacy ? 'legacy' : 'active');
  const counts = history.reduce((c, r) => { c[statusOf(r)] += 1; return c; }, { active: 0, cancelled: 0, legacy: 0 });
  const filters = [
    { key: 'all', label: 'All', n: history.length },
    { key: 'active', label: 'Active', n: counts.active },
    { key: 'cancelled', label: 'Cancelled', n: counts.cancelled },
    ...(counts.legacy > 0 ? [{ key: 'legacy', label: 'పాత', n: counts.legacy }] : []),
  ];
  const matchesText = (r) => q === '' ||
    (r.invoiceNo || '').toLowerCase().includes(q) ||
    (r.schoolName || '').toLowerCase().includes(q) ||
    (r.udise || '').includes(q) ||
    formatDate(r.savedAt).toLowerCase().includes(q);   // the date exactly as shown on the card
  const visible = history.filter(r => (statusFilter === 'all' || statusOf(r) === statusFilter) && matchesText(r));

  const renderItem = ({ item }) => {
    const cancelled = item.status === 'cancelled';
    return (
      // ui.js → Card
      <Card style={[styles.historyCard, cancelled && styles.historyCardCancelled]}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardIconWrap}>
            <MaterialCommunityIcons name={cancelled ? 'cancel' : 'school-outline'} size={22} color={cancelled ? Colors.danger : Colors.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.schoolName}>{item.schoolName || 'Receipt'}</Text>
            <View style={styles.dateRow}>
              <MaterialCommunityIcons name="clock-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.dateText}>{formatDate(item.savedAt)}</Text>
            </View>
          </View>
          <View style={styles.spellBadge}>
            <Text style={styles.spellBadgeText}>Spell {item.spell || 1}</Text>
          </View>
        </View>

        {/* Meta */}
        <View style={styles.cardMeta}>
          {item.invoiceNo ? (
            <View style={styles.metaChip}>
              <MaterialCommunityIcons name="receipt-text-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.metaChipText}>{item.invoiceNo}</Text>
            </View>
          ) : null}
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="package-variant-closed" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaChipText}>{item.itemCount} items</Text>
          </View>
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="pound" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaChipText}>{item.totalQty} qty</Text>
          </View>
          {item.channel && item.channel !== 'thermal' ? (
            <View style={styles.metaChip}>
              <MaterialCommunityIcons name={item.channel === 'pdf' ? 'file-pdf-box' : 'printer'} size={12} color={Colors.textSecondary} />
              <Text style={styles.metaChipText}>{item.channel === 'pdf' ? 'PDF' : 'System'}</Text>
            </View>
          ) : null}
          {item.legacy ? (
            <View style={[styles.metaChip, styles.chipLegacy]}>
              <MaterialCommunityIcons name="flask-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.metaChipText}>పాత (లెక్కలో లేదు)</Text>
            </View>
          ) : null}
          {cancelled ? (
            <View style={[styles.metaChip, styles.chipCancelled]}>
              <Text style={[styles.metaChipText, { color: Colors.danger }]}>CANCELLED</Text>
            </View>
          ) : null}
        </View>

        {/* Actions */}
        {!cancelled && (
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
                    <MaterialCommunityIcons name="printer" size={16} color={Colors.primary} />
                    <Text style={styles.reprintText}>Reprint</Text>
                  </View>
                )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.reprintBtn} onPress={() => handleSharePdf(item)} disabled={printing !== null}>
              <View style={styles.actionBtnInner}>
                <MaterialCommunityIcons name="share-variant-outline" size={16} color={Colors.primary} />
                <Text style={styles.reprintText}>PDF</Text>
              </View>
            </TouchableOpacity>
            {item.legacy ? (
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                <View style={styles.actionBtnInner}>
                  <MaterialCommunityIcons name="trash-can-outline" size={16} color={Colors.danger} />
                  <Text style={styles.deleteText}>Delete</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleCancel(item)}>
                <View style={styles.actionBtnInner}>
                  <MaterialCommunityIcons name="cancel" size={16} color={Colors.danger} />
                  <Text style={styles.deleteText}>Cancel</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <Hero title="History" subtitle="Printed receipts" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>

      <Hero title="History" subtitle="Printed receipts" info={`${history.length} receipts`} />

      <View style={styles.container}>

        {/* Subheader row */}
        <View style={styles.subHeader}>
          <View style={styles.countChip}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={14} color={Colors.primary} />
            <Text style={styles.countChipText}>{history.length} records</Text>
          </View>
        </View>

        {history.length > 0 && (
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Invoice no., school పేరు లేదా తేదీ..."
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={Colors.textMuted}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <MaterialCommunityIcons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {history.length > 0 && (
          <View style={styles.filterRow}>
            {filters.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, statusFilter === f.key && styles.filterChipOn]}
                onPress={() => setStatusFilter(f.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, statusFilter === f.key && styles.filterTextOn]}>{f.label} · {f.n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loadError ? (
          <View style={styles.centered}>
            <MaterialCommunityIcons name="alert-circle-outline" size={52} color={Colors.danger} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>History చదవలేకపోయాను</Text>
            <Text style={styles.emptyHint}>{loadError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadHistory}>
              <Text style={styles.retryBtnText}>మళ్ళీ ప్రయత్నించు</Text>
            </TouchableOpacity>
          </View>
        ) : history.length === 0 ? (
          <View style={styles.centered}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={52} color={Colors.accent} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No history yet</Text>
            <Text style={styles.emptyHint}>Print చేసిన తర్వాత ఇక్కడ కనిపిస్తుంది</Text>
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.centered}>
            <MaterialCommunityIcons name="file-search-outline" size={52} color={Colors.accent} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>ఏమీ దొరకలేదు</Text>
            <Text style={styles.emptyHint}>వేరే పదంతో వెతకండి</Text>
          </View>
        ) : (
          <FlatList
            data={visible}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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

  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 0.5, borderColor: Colors.cardBorder, gap: Spacing.sm,
  },
  filterRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs + 2, marginBottom: Spacing.sm },
  filterChip:   { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 1, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.surface },
  filterChipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText:   { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  filterTextOn: { color: Colors.primaryText },
  searchInput: { flex: 1, paddingVertical: Spacing.md, fontSize: 14, color: Colors.textPrimary },
  historyCardCancelled: { opacity: 0.6 },
  chipLegacy:    { backgroundColor: '#FBF3C9' },
  chipCancelled: { backgroundColor: Colors.dangerBg },
  retryBtn:     { marginTop: Spacing.md, backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  retryBtnText: { color: Colors.primary, fontWeight: '700' },

  // Card
  historyCard:  { marginBottom: Spacing.sm, gap: Spacing.sm },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardIconWrap: { width: 40, height: 40, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  cardInfo:     { flex: 1 },
  schoolName:   { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  dateRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dateText:     { fontSize: 11, color: Colors.textMuted },
  spellBadge:   { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.md },
  spellBadgeText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },

  cardMeta: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.background, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.sm },
  metaChipText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },

  cardActions:    { flexDirection: 'row', gap: Spacing.sm },
  actionBtnInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  reprintBtn:     { flex: 1, backgroundColor: Colors.primaryLight, padding: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  reprintText:    { color: Colors.primary, fontWeight: '600', fontSize: 13 },
  deleteBtn:      { flex: 1, backgroundColor: Colors.dangerBg, padding: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  deleteText:     { color: Colors.danger, fontWeight: '600', fontSize: 13 },

  // Empty
  emptyIcon:  { marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.xs },
  emptyHint:  { ...Typography.bodySm, textAlign: 'center' },
});