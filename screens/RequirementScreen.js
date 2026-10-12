// screens/RequirementScreen.js
// Requirement & Deficit: required (from school rolls) vs Received stock, per item. Read-only.
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import CatalogService from '../services/CatalogService';
import ItemTypeService from '../services/ItemTypeService';
import SchoolService from '../services/SchoolService';
import SettingsService from '../services/SettingsService';
import StockService from '../services/StockService';
import { receivedTotals } from '../services/StockModel';
import { computeRequirement } from '../services/RequirementModel';
import { Colors, Radius, Spacing, Typography } from '../constants/Theme';
import { Card } from '../components/ui';
import Hero from '../components/Hero';

export default function RequirementScreen({ navigation }) {
  const [items, setItems]     = useState([]);
  const [types, setTypes]     = useState([]);
  const [schools, setSchools] = useState([]);
  const [entries, setEntries] = useState([]);
  const [ay, setAy]           = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState(null);

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = await SettingsService.get();
      const [its, tps, sch, ents] = await Promise.all([
        CatalogService.getAll(),
        ItemTypeService.getAll(),
        SchoolService.getAll(),
        StockService.getAll(),
      ]);
      setAy(settings.academicYear); setItems(its); setTypes(tps); setSchools(sch); setEntries(ents);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const req      = useMemo(() => computeRequirement(items, schools), [items, schools]);
  const received = useMemo(() => receivedTotals(entries, ay), [entries, ay]);

  const reqOf  = (id) => req.byItem[id]?.required || 0;
  const recOf  = (id) => received.byItem[id] || 0;
  const defOf  = (id) => reqOf(id) - recOf(id);          // > 0 = deficit, < 0 = surplus

  const q = search.trim().toLowerCase();
  const visibleItems = items.filter(i =>
    q === '' || i.name.toLowerCase().includes(q) || (i.code || '').toLowerCase().includes(q));

  const rows = useMemo(() => {
    const extra = [...new Set(visibleItems.map(i => i.category || 'Others'))].filter(c => !types.includes(c));
    const out = [];
    [...types, ...extra].forEach(cat => {
      const group = visibleItems.filter(i => (i.category || 'Others') === cat);
      if (group.length === 0) return;
      out.push({ key: `h-${cat}`, header: cat });
      group.forEach(i => out.push({ key: i.id, item: i }));
    });
    return out;
  }, [visibleItems, types]);

  const deficitCount = items.filter(i => defOf(i.id) > 0).length;

  const showNoRoll = () => {
    const names = req.noRoll.map(s => `• ${s.name}`).join('\n');
    Alert.alert(`Roll లేని schools (${req.noRoll.length})`, names + '\n\nSchools లో Min–Max మరియు roll నమోదు చేయండి.');
  };

  const defStyle = (d) => (d > 0 ? styles.defNeg : d === 0 ? styles.defZero : styles.defPos);
  const defText  = (d) => (d > 0 ? `${d}` : d === 0 ? '0' : `+${-d}`);

  const renderRow = ({ item: row }) => {
    if (row.header) return <Text style={styles.groupTitle}>🏷️  {row.header}</Text>;
    const it = row.item;
    const d  = defOf(it.id);
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => setSelected(it)}>
        <Card style={styles.itemCard}>
          <View style={styles.itemLeft}>
            <Text style={styles.itemName}>{it.name}</Text>
            <Text style={styles.itemSub}>
              {it.code ? `🔖 ${it.code}` : ''}
              {it.subType && it.subType !== 'Common' ? `  ${it.subType === 'Boys' ? '👦' : '👧'} ${it.subType}` : ''}
              {it.classFrom || it.classTo ? `  🎓 ${it.classFrom || 1}-${it.classTo || 12}` : ''}
            </Text>
          </View>
          <View style={styles.nums}>
            <View style={styles.numCol}><Text style={styles.numLabel}>Required</Text><Text style={styles.numVal}>{reqOf(it.id)}</Text></View>
            <View style={styles.numCol}><Text style={styles.numLabel}>Received</Text><Text style={styles.numVal}>{recOf(it.id)}</Text></View>
            <View style={styles.numCol}><Text style={styles.numLabel}>కొరత</Text><Text style={[styles.numVal, defStyle(d)]}>{defText(d)}</Text></View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <Hero title="Requirement & కొరత" subtitle="Required · Received · కొరత" />
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const selReq = selected ? req.byItem[selected.id] : null;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Hero title="Requirement & కొరత" subtitle="Required · Received · కొరత" info={`Academic Year ${ay}`} />

      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹  Back</Text>
        </TouchableOpacity>

        {error ? (
          <View style={styles.centered}>
            <Text style={styles.emptyEmoji}>⚠️</Text>
            <Text style={styles.emptyTitle}>చదవలేకపోయాను</Text>
            <Text style={styles.emptyHint}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryBtnText}>మళ్ళీ ప్రయత్నించు</Text>
            </TouchableOpacity>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>Catalog లో items లేవు</Text>
            <Text style={styles.emptyHint}>ముందు Items Data లో items add చేయండి</Text>
          </View>
        ) : req.rollSchoolCount === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyEmoji}>🏫</Text>
            <Text style={styles.emptyTitle}>ఏ school కీ roll నమోదు కాలేదు</Text>
            <Text style={styles.emptyHint}>Schools Data లో Min–Max classes మరియు roll నమోదు చేయండి</Text>
          </View>
        ) : (
          <>
            <View style={styles.chipsRow}>
              <View style={[styles.chip, deficitCount > 0 && styles.chipRed]}>
                <Text style={[styles.chipText, deficitCount > 0 && { color: Colors.danger }]}>⚠️ కొరత ఉన్న items: {deficitCount}</Text>
              </View>
              <TouchableOpacity
                style={[styles.chip, req.noRoll.length > 0 && styles.chipRed]}
                disabled={req.noRoll.length === 0}
                onPress={showNoRoll}
              >
                <Text style={[styles.chipText, req.noRoll.length > 0 && { color: Colors.danger }]}>
                  🏫 Roll లేని schools: {req.noRoll.length}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Item పేరు లేదా code..."
                value={search}
                onChangeText={setSearch}
                placeholderTextColor={Colors.textMuted}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Text style={{ fontSize: 16, color: Colors.textMuted }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {rows.length === 0 ? (
              <View style={styles.centered}><Text style={styles.emptyTitle}>ఏమీ దొరకలేదు</Text></View>
            ) : (
              <FlatList
                data={rows}
                keyExtractor={r => r.key}
                renderItem={renderRow}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
              />
            )}
          </>
        )}
      </View>

      {/* ── Item detail: school-wise requirement ─────────────────────────── */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalKAV}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelected(null)} />
          <View style={[styles.modalSheet, { height: '80%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.sheetTop}>
              <Text style={styles.modalTitle} numberOfLines={2}>{selected?.name}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
                <Text style={styles.closeBtnText}>✕  Close</Text>
              </TouchableOpacity>
            </View>
            {selected && (
              <Text style={styles.sheetSummary}>
                Required {reqOf(selected.id)}  ·  Received {recOf(selected.id)}  ·  కొరత {defText(defOf(selected.id))}
              </Text>
            )}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionTitle}>Schools వారీగా అవసరం</Text>
              {!selReq || selReq.schools.length === 0 ? (
                <Text style={styles.mutedText}>ఈ item కి ఏ school కీ అవసరం లేదు (class range / roll చూడండి).</Text>
              ) : (
                selReq.schools.map(s => (
                  <View key={s.id} style={styles.givenRow}>
                    <Text style={styles.givenName}>{s.name}</Text>
                    <Text style={styles.givenQty}>{s.qty}</Text>
                  </View>
                ))
              )}
              <View style={{ height: Spacing.xl }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingHorizontal: Spacing.lg },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  backBtn:     { paddingVertical: Spacing.md },
  backBtnText: { fontSize: 16, color: Colors.primary, fontWeight: '600' },

  chipsRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginBottom: Spacing.sm },
  chip:     { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  chipRed:  { backgroundColor: Colors.dangerBg },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 0.5, borderColor: Colors.cardBorder, gap: Spacing.sm,
  },
  searchIcon:  { fontSize: 16 },
  searchInput: { flex: 1, paddingVertical: Spacing.md, fontSize: 14, color: Colors.textPrimary },

  groupTitle: { ...Typography.label, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.sm, marginBottom: Spacing.xs },

  itemCard: { marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemLeft: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  itemSub:  { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  nums:     { flexDirection: 'row', gap: Spacing.md },
  numCol:   { alignItems: 'center', minWidth: 52 },
  numLabel: { fontSize: 9, color: Colors.textMuted },
  numVal:   { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  defNeg:   { color: Colors.danger },
  defZero:  { color: Colors.textMuted },
  defPos:   { color: Colors.success },

  emptyEmoji: { fontSize: 52, marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.xs },
  emptyHint:  { ...Typography.bodySm, textAlign: 'center' },
  retryBtn:     { marginTop: Spacing.md, backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  retryBtnText: { color: Colors.primary, fontWeight: '700' },

  modalKAV:      { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.cardBorder, alignSelf: 'center', marginBottom: Spacing.md },
  sheetTop:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  modalTitle:  { flex: 1, fontSize: 18, fontWeight: '800', color: Colors.primaryDark },
  closeBtn:    { backgroundColor: Colors.background, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cardBorder },
  closeBtnText:{ color: Colors.textSecondary, fontWeight: '700', fontSize: 12 },
  sheetSummary:{ fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: Spacing.sm },

  sectionTitle: { ...Typography.label, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.md, marginBottom: Spacing.xs },
  mutedText:    { fontSize: 12, color: Colors.textMuted },
  givenRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 0.5, borderBottomColor: Colors.cardBorder },
  givenName: { flex: 1, fontSize: 13, color: Colors.textPrimary },
  givenQty:  { fontSize: 13, fontWeight: '800', color: Colors.primary },
});