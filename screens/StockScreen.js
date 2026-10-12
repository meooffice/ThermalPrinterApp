// screens/StockScreen.js
// Stock & Balance: Received (entered by hand) / Given (from the receipt ledger) / Balance, per item.
import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Alert, Modal, ActivityIndicator, Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import CatalogService from '../services/CatalogService';
import ItemTypeService from '../services/ItemTypeService';
import SettingsService from '../services/SettingsService';
import StockService from '../services/StockService';
import LedgerService from '../services/LedgerService';
import { buildStockEntry, receivedTotals, todayISO } from '../services/StockModel';
import { Colors, Radius, Spacing, Typography } from '../constants/Theme';
import { Card } from '../components/ui';
import Hero from '../components/Hero';

const EMPTY_GIVEN = { byItem: {}, bySchool: {}, schoolNames: {} };

export default function StockScreen({ navigation }) {
  const insets = useSafeAreaInsets(); // keep sheet buttons above the Android navigation bar
  const [items, setItems]       = useState([]);
  const [types, setTypes]       = useState([]);
  const [ay, setAy]             = useState('');
  const [entries, setEntries]   = useState([]);
  const [given, setGiven]       = useState(EMPTY_GIVEN);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState('');

  // detail sheet
  const [selected, setSelected] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [qty, setQty]           = useState('');
  const [size, setSize]         = useState('');
  const [date, setDate]         = useState(todayISO());
  const [note, setNote]         = useState('');
  const [busy, setBusy]         = useState(false);

  // bulk add (many items of one Type at once)
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkType, setBulkType] = useState('');
  const [bulkQty, setBulkQty]   = useState({});          // { 'itemId|size': '500' }  (size is '' for items without sizes)
  const [bulkDate, setBulkDate] = useState(todayISO());
  const [bulkNote, setBulkNote] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const bulkRefs = useRef({});

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = await SettingsService.get();
      const year = settings.academicYear;
      const [its, tps, ents, g] = await Promise.all([
        CatalogService.getAll(),
        ItemTypeService.getAll(),
        StockService.getAll(),
        LedgerService.givenTotals(year),
      ]);
      setAy(year); setItems(its); setTypes(tps); setEntries(ents); setGiven(g);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const received = useMemo(() => receivedTotals(entries, ay), [entries, ay]);

  const recOf = (id) => received.byItem[id] || 0;
  const givOf = (id) => given.byItem[id] || 0;
  const balOf = (id) => recOf(id) - givOf(id);

  // ── list rows (grouped by Item Type) ───────────────────────────────────────
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

  const negativeCount = items.filter(i => balOf(i.id) < 0).length;
  const noStockCount  = items.filter(i => recOf(i.id) === 0).length;

  // ── bulk add ───────────────────────────────────────────────────────────────
  const bulkTypes = useMemo(() => {
    const cats = [...new Set(items.map(i => i.category || 'Others'))];
    return [...types.filter(t => cats.includes(t)), ...cats.filter(c => !types.includes(c))];
  }, [items, types]);
  const bulkItems = useMemo(() => items.filter(i => (i.category || 'Others') === bulkType), [items, bulkType]);
  // keyboard order: date, note, then every quantity box of the chosen Type (top to bottom)
  const bulkOrder = useMemo(() => {
    const keys = ['date', 'note'];
    bulkItems.forEach(i => {
      if (Array.isArray(i.sizes) && i.sizes.length) i.sizes.forEach(s => keys.push(`${i.id}|${s}`));
      else keys.push(`${i.id}|`);
    });
    return keys;
  }, [bulkItems]);
  const bulkFilled = Object.values(bulkQty).filter(v => v && !/^0+$/.test(v)).length;

  const bulkNext = (key) => {
    const nk = bulkOrder[bulkOrder.indexOf(key) + 1];
    if (nk && bulkRefs.current[nk]) bulkRefs.current[nk].focus();
    else Keyboard.dismiss();
  };
  // Next (→) on every box, Done (✓) on the last one
  const bulkInput = (key) => {
    const last = key === bulkOrder[bulkOrder.length - 1];
    return {
      ref: (el) => { bulkRefs.current[key] = el; },
      returnKeyType: last ? 'done' : 'next',
      blurOnSubmit: last,
      onSubmitEditing: () => bulkNext(key),
    };
  };
  const setBulkQ = (key, v) => setBulkQty(prev => ({ ...prev, [key]: v.replace(/[^0-9]/g, '') }));

  const openBulk = () => {
    setBulkQty({}); setBulkDate(todayISO()); setBulkNote('');
    setBulkType(bulkTypes[0] || '');
    setBulkOpen(true);
  };

  const handleBulkSave = async () => {
    const list = [];
    for (const it of items) {
      const sizes = Array.isArray(it.sizes) ? it.sizes : [];
      const cells = sizes.length ? sizes.map(s => [`${it.id}|${s}`, s]) : [[`${it.id}|`, '']];
      for (const [k, s] of cells) {
        const v = (bulkQty[k] || '').trim();
        if (v === '' || /^0+$/.test(v)) continue;                  // empty / 0 = skipped
        const built = buildStockEntry({ qty: v, size: s, date: bulkDate, note: bulkNote }, it, ay);
        if (built.error) { Alert.alert(`${it.name}${s ? ` (size ${s})` : ''}`, built.error); return; }
        list.push(built.data);
      }
    }
    if (list.length === 0) { Alert.alert('ఏ సంఖ్యా లేదు', 'కనీసం ఒక item కి సంఖ్య నమోదు చేయండి.'); return; }
    try {
      setBulkBusy(true);
      await StockService.addMany(list);
      setEntries(await StockService.getAll());
      setBulkOpen(false);
      Alert.alert('✅ Stock జోడించబడింది', `${list.length} entries జోడించబడ్డాయి.`);
    } catch (e) {
      Alert.alert('Save కాలేదు', e.message);
    } finally {
      setBulkBusy(false);
    }
  };

  // ── detail sheet ───────────────────────────────────────────────────────────
  const resetForm = () => { setEditingId(null); setQty(''); setSize(''); setDate(todayISO()); setNote(''); };
  const openDetail = (item) => { resetForm(); setSelected(item); };
  const closeDetail = () => { setSelected(null); resetForm(); };

  const itemEntries = selected
    ? entries
        .filter(e => e.itemId === selected.id && e.academicYear === ay)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)))
    : [];

  const givenBySchool = selected
    ? Object.keys(given.bySchool)
        .map(sid => ({ sid, name: given.schoolNames[sid] || '—', qty: given.bySchool[sid][selected.id] || 0 }))
        .filter(r => r.qty !== 0)
        .sort((a, b) => b.qty - a.qty)
    : [];

  const startEdit = (e) => {
    setEditingId(e.id);
    setQty(String(e.qty));
    setSize(e.size || '');
    setDate(e.date);
    setNote(e.note || '');
  };

  const handleSaveEntry = async () => {
    const built = buildStockEntry({ qty, size, date, note }, selected, ay);
    if (built.error) { Alert.alert('Validation', built.error); return; }
    try {
      setBusy(true);
      if (editingId) await StockService.update(editingId, built.data);
      else           await StockService.add(built.data);
      setEntries(await StockService.getAll());
      resetForm();
    } catch (e) {
      Alert.alert('Save కాలేదు', e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteEntry = (e) => {
    Alert.alert('Stock entry delete చేయాలా?', `${e.date} · ${e.size ? `size ${e.size} · ` : ''}${e.qty}`, [
      { text: 'వెనక్కి', style: 'cancel' },
      { text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await StockService.delete(e.id);
            setEntries(await StockService.getAll());
            if (editingId === e.id) resetForm();
          } catch (err) { Alert.alert('Delete కాలేదు', err.message); }
        } },
    ]);
  };

  // ── render ─────────────────────────────────────────────────────────────────
  const balStyle = (b) => (b < 0 ? styles.balNeg : b === 0 ? styles.balZero : styles.balPos);

  const renderRow = ({ item: row }) => {
    if (row.header) return <Text style={styles.groupTitle}>🏷️  {row.header}</Text>;
    const it = row.item;
    const bal = balOf(it.id);
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => openDetail(it)}>
        <Card style={styles.itemCard}>
          <View style={styles.itemLeft}>
            <Text style={styles.itemName}>{it.name}</Text>
            <Text style={styles.itemSub}>
              {it.code ? `🔖 ${it.code}` : ''}
              {it.subType && it.subType !== 'Common' ? `  ${it.subType === 'Boys' ? '👦' : '👧'} ${it.subType}` : ''}
              {it.sizes && it.sizes.length ? `  📏 ${it.sizes.length} sizes` : ''}
            </Text>
          </View>
          <View style={styles.nums}>
            <View style={styles.numCol}><Text style={styles.numLabel}>Received</Text><Text style={styles.numVal}>{recOf(it.id)}</Text></View>
            <View style={styles.numCol}><Text style={styles.numLabel}>Given</Text><Text style={styles.numVal}>{givOf(it.id)}</Text></View>
            <View style={styles.numCol}><Text style={styles.numLabel}>Balance</Text><Text style={[styles.numVal, balStyle(bal)]}>{bal}</Text></View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <Hero title="Stock & Balance" subtitle="Received · Given · Balance" />
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Hero title="Stock & Balance" subtitle="Received · Given · Balance" info={`Academic Year ${ay}`} />

      <View style={styles.container}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>‹  Back</Text>
          </TouchableOpacity>
          {!error && items.length > 0 && (
            <TouchableOpacity style={styles.bulkBtn} onPress={openBulk}>
              <Text style={styles.bulkBtnText}>📥  Bulk Add</Text>
            </TouchableOpacity>
          )}
        </View>

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
        ) : (
          <>
            <View style={styles.chipsRow}>
              <View style={[styles.chip, negativeCount > 0 && styles.chipRed]}>
                <Text style={[styles.chipText, negativeCount > 0 && { color: Colors.danger }]}>⚠️ Balance ఋణం: {negativeCount}</Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipText}>📭 Stock నమోదు కానివి: {noStockCount}</Text>
              </View>
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
              <View style={styles.centered}>
                <Text style={styles.emptyTitle}>ఏమీ దొరకలేదు</Text>
              </View>
            ) : (
              <FlatList
                data={rows}
                keyExtractor={r => r.key}
                renderItem={renderRow}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Spacing.xl }}
              />
            )}
          </>
        )}
      </View>

      {/* ── Item detail: stock entries ───────────────────────────────────── */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={closeDetail}>
        {/* plain View: KeyboardAvoidingView made the sheet shake on keyboard close */}
        <View style={styles.modalKAV}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeDetail} />
          <View style={[styles.modalSheet, { height: '88%' }, { paddingBottom: Spacing.lg + insets.bottom }]}>
            <View style={styles.modalHandle} />

            {/* Title + Close stay at the top so they are always visible */}
            <View style={styles.sheetTop}>
              <Text style={styles.modalTitle} numberOfLines={2}>{selected?.name}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={closeDetail}>
                <Text style={styles.closeBtnText}>✕  Close</Text>
              </TouchableOpacity>
            </View>

            {selected && (
              <Text style={styles.sheetSummary}>
                Received {recOf(selected.id)}  ·  Given {givOf(selected.id)}  ·{' '}
                <Text style={balStyle(balOf(selected.id))}>Balance {balOf(selected.id)}</Text>
              </Text>
            )}

            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
              {/* Add / edit form */}
              <View style={styles.formBox}>
                <Text style={styles.formTitle}>{editingId ? '✏️  Entry మార్చండి' : '＋  Stock Received జోడించండి'}</Text>

                <Text style={styles.inputLabel}>సంఖ్య *</Text>
                <TextInput
                  style={styles.input}
                  value={qty}
                  onChangeText={v => setQty(v.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 500"
                  keyboardType="numeric"
                  maxLength={7}
                  placeholderTextColor={Colors.textMuted}
                />

                {selected?.sizes && selected.sizes.length > 0 && (
                  <>
                    <Text style={styles.inputLabel}>Size *</Text>
                    <View style={styles.sizeWrap}>
                      {selected.sizes.map(s => (
                        <TouchableOpacity
                          key={s}
                          style={[styles.sizePill, size === s && styles.sizePillActive]}
                          onPress={() => setSize(s)}
                        >
                          <Text style={[styles.sizePillText, size === s && styles.sizePillTextActive]}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <Text style={styles.inputLabel}>తేదీ (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="2026-10-05"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  placeholderTextColor={Colors.textMuted}
                />

                <Text style={styles.inputLabel}>గమనిక (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={note}
                  onChangeText={setNote}
                  placeholder="e.g. DEO supply"
                  maxLength={80}
                  placeholderTextColor={Colors.textMuted}
                />

                <View style={styles.formActions}>
                  {editingId ? (
                    <TouchableOpacity style={styles.cancelEditBtn} onPress={resetForm}>
                      <Text style={styles.cancelEditText}>వద్దు</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={[styles.saveBtn, busy && { opacity: 0.6 }]} onPress={handleSaveEntry} disabled={busy}>
                    {busy
                      ? <ActivityIndicator color={Colors.primaryText} />
                      : <Text style={styles.saveBtnText}>{editingId ? '✅  Update' : '＋  Add Stock'}</Text>}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Size-wise Received / Given / Balance (items with sizes) */}
              {selected?.sizes && selected.sizes.length > 0 && (received.bySize[selected.id] || (given.bySize || {})[selected.id]) && (() => {
                const rs = received.bySize[selected.id] || {};
                const gs = (given.bySize || {})[selected.id] || {};
                const sizeList = [...selected.sizes];
                [...Object.keys(rs), ...Object.keys(gs)].forEach(s => { if (!sizeList.includes(s)) sizeList.push(s); });
                const lines = sizeList
                  .filter(s => (rs[s] || 0) !== 0 || (gs[s] || 0) !== 0)
                  .map(s => ({ s, r: rs[s] || 0, g: gs[s] || 0 }));
                const sumR = Object.values(rs).reduce((a, b) => a + b, 0);
                const sumG = Object.values(gs).reduce((a, b) => a + b, 0);
                const otherR = recOf(selected.id) - sumR, otherG = givOf(selected.id) - sumG;   // entered / given without a size
                return (
                  <>
                    <Text style={styles.sectionTitle}>📏  Size వారీ</Text>
                    <View style={styles.sizeTable}>
                      <View style={styles.sizeTr}>
                        <Text style={[styles.sizeTh, { flex: 1.2 }]}>Size</Text>
                        <Text style={styles.sizeTh}>Received</Text>
                        <Text style={styles.sizeTh}>Given</Text>
                        <Text style={styles.sizeTh}>Balance</Text>
                      </View>
                      {lines.map(l => (
                        <View key={l.s} style={styles.sizeTr}>
                          <Text style={[styles.sizeTd, { flex: 1.2, fontWeight: '800' }]}>{l.s}</Text>
                          <Text style={styles.sizeTd}>{l.r}</Text>
                          <Text style={styles.sizeTd}>{l.g}</Text>
                          <Text style={[styles.sizeTd, balStyle(l.r - l.g)]}>{l.r - l.g}</Text>
                        </View>
                      ))}
                      {(otherR !== 0 || otherG !== 0) && (
                        <View style={styles.sizeTr}>
                          <Text style={[styles.sizeTd, { flex: 1.2 }]}>Size లేనివి</Text>
                          <Text style={styles.sizeTd}>{otherR}</Text>
                          <Text style={styles.sizeTd}>{otherG}</Text>
                          <Text style={[styles.sizeTd, balStyle(otherR - otherG)]}>{otherR - otherG}</Text>
                        </View>
                      )}
                    </View>
                  </>
                );
              })()}

              {/* Entries */}
              <Text style={styles.sectionTitle}>📥  Received entries ({itemEntries.length})</Text>
              {itemEntries.length === 0 ? (
                <Text style={styles.mutedText}>ఇంకా ఏ entry లేదు.</Text>
              ) : itemEntries.map(e => (
                <View key={e.id} style={[styles.entryRow, editingId === e.id && styles.entryRowEditing]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.entryMain}>
                      {e.qty}{e.size ? `   ·   size ${e.size}` : ''}
                    </Text>
                    <Text style={styles.entryMeta}>📅 {e.date}{e.note ? `   ·   ${e.note}` : ''}</Text>
                  </View>
                  <TouchableOpacity style={styles.editBtn} onPress={() => startEdit(e)}>
                    <Text style={{ fontSize: 15 }}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteEntry(e)}>
                    <Text style={{ fontSize: 15 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Given by school */}
              <Text style={styles.sectionTitle}>🏫  ఇచ్చినవి (schools వారీగా)</Text>
              {givenBySchool.length === 0 ? (
                <Text style={styles.mutedText}>ఇంకా ఎవరికీ ఇవ్వలేదు.</Text>
              ) : givenBySchool.map(r => (
                <View key={r.sid} style={styles.givenRow}>
                  <Text style={styles.givenName} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.givenQty}>{r.qty}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* ── Bulk add: all items of one Type at once ──────────────────────── */}
      <Modal visible={bulkOpen} animationType="slide" transparent onRequestClose={() => setBulkOpen(false)}>
        {/* plain View: KeyboardAvoidingView makes sheets shake on Android */}
        <View style={styles.modalKAV}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setBulkOpen(false)} />
          <View style={[styles.modalSheet, { height: '92%' }, { paddingBottom: Spacing.lg + insets.bottom }]}>
            <View style={styles.modalHandle} />
            <View style={styles.sheetTop}>
              <Text style={styles.modalTitle}>📥  Bulk Stock Add</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setBulkOpen(false)}>
                <Text style={styles.closeBtnText}>✕  Close</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.bulkHint}>Type ఎంచుకుని, వచ్చిన items సంఖ్య మాత్రమే రాయండి. ఖాళీ లేదా 0 ఉంటే ఆ item skip అవుతుంది.</Text>

            <View style={{ height: 44 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Spacing.xs, alignItems: 'center' }}>
                {bulkTypes.map(t => (
                  <TouchableOpacity key={t} style={[styles.typeChip, bulkType === t && styles.typeChipActive]} onPress={() => setBulkType(t)}>
                    <Text style={[styles.typeChipText, bulkType === t && styles.typeChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 260 }}>
              <View style={styles.formBox}>
                <Text style={styles.inputLabel}>తేదీ (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={bulkDate}
                  onChangeText={setBulkDate}
                  placeholder="2026-10-05"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  placeholderTextColor={Colors.textMuted}
                  {...bulkInput('date')}
                />
                <Text style={styles.inputLabel}>గమనిక (optional, అన్నిటికీ)</Text>
                <TextInput
                  style={styles.input}
                  value={bulkNote}
                  onChangeText={setBulkNote}
                  placeholder="e.g. DEO supply"
                  maxLength={80}
                  placeholderTextColor={Colors.textMuted}
                  {...bulkInput('note')}
                />
              </View>

              {bulkItems.length === 0 ? (
                <Text style={styles.mutedText}>ఈ Type లో items లేవు.</Text>
              ) : bulkItems.map(it => {
                const sizes = Array.isArray(it.sizes) ? it.sizes : [];
                return (
                  <View key={it.id} style={styles.bulkItem}>
                    <View style={styles.bulkItemHead}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{it.name}</Text>
                        <Text style={styles.itemSub}>Balance {balOf(it.id)}{it.code ? `  ·  🔖 ${it.code}` : ''}</Text>
                      </View>
                      {sizes.length === 0 && (
                        <TextInput
                          style={styles.bulkQtyInput}
                          value={bulkQty[`${it.id}|`] || ''}
                          onChangeText={v => setBulkQ(`${it.id}|`, v)}
                          placeholder="సంఖ్య"
                          keyboardType="numeric"
                          maxLength={7}
                          placeholderTextColor={Colors.textMuted}
                          {...bulkInput(`${it.id}|`)}
                        />
                      )}
                    </View>
                    {sizes.length > 0 && (
                      <View style={styles.sizeWrap}>
                        {sizes.map(sz => (
                          <View key={sz} style={styles.sizeCell}>
                            <Text style={styles.sizeCellLabel}>{sz}</Text>
                            <TextInput
                              style={styles.sizeCellInput}
                              value={bulkQty[`${it.id}|${sz}`] || ''}
                              onChangeText={v => setBulkQ(`${it.id}|${sz}`, v)}
                              keyboardType="numeric"
                              maxLength={7}
                              {...bulkInput(`${it.id}|${sz}`)}
                            />
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelEditBtn} onPress={() => setBulkOpen(false)}>
                <Text style={styles.cancelEditText}>వద్దు</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, (bulkBusy || bulkFilled === 0) && { opacity: 0.6 }]} onPress={handleBulkSave} disabled={bulkBusy || bulkFilled === 0}>
                {bulkBusy
                  ? <ActivityIndicator color={Colors.primaryText} />
                  : <Text style={styles.saveBtnText}>✅  Save ({bulkFilled})</Text>}
              </TouchableOpacity>
            </View>
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

  topRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bulkBtn:     { borderWidth: 1.5, borderColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.lg },
  bulkBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  bulkHint:    { fontSize: 12, color: Colors.textMuted, marginBottom: Spacing.sm },
  typeChip:    { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.surface },
  typeChipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText:       { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  typeChipTextActive: { color: Colors.primaryText },
  bulkItem:     { paddingVertical: Spacing.sm, borderBottomWidth: 0.5, borderBottomColor: Colors.cardBorder },
  bulkItemHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  bulkQtyInput: { width: 110, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: Radius.md, padding: Spacing.sm, fontSize: 14, color: Colors.textPrimary, backgroundColor: Colors.surface, textAlign: 'center' },
  sizeCell:      { width: 62, alignItems: 'center', marginTop: Spacing.xs },
  sizeCellLabel: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, marginBottom: 2 },
  sizeCellInput: { width: 58, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: Radius.md, paddingVertical: 6, paddingHorizontal: 4, fontSize: 13, color: Colors.textPrimary, backgroundColor: Colors.surface, textAlign: 'center' },
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
  balNeg:   { color: Colors.danger },
  balZero:  { color: Colors.textMuted },
  balPos:   { color: Colors.success },

  emptyEmoji: { fontSize: 52, marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.xs },
  emptyHint:  { ...Typography.bodySm, textAlign: 'center' },
  retryBtn:     { marginTop: Spacing.md, backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  retryBtnText: { color: Colors.primary, fontWeight: '700' },

  // Sheet
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

  formBox:   { backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  formTitle: { fontSize: 13, fontWeight: '800', color: Colors.primary, marginBottom: Spacing.xs },
  inputLabel:{ ...Typography.label, marginBottom: Spacing.xs, marginTop: Spacing.xs },
  input: {
    borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: Radius.md,
    padding: Spacing.sm, fontSize: 14, color: Colors.textPrimary,
    marginBottom: Spacing.xs, backgroundColor: Colors.surface,
  },
  sizeWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.xs },
  sizePill:  { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.surface },
  sizePillActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sizePillText:       { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  sizePillTextActive: { color: Colors.primaryText },

  formActions:   { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelEditBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.surface },
  cancelEditText:{ color: Colors.textSecondary, fontWeight: '600' },
  saveBtn:       { flex: 2, backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  saveBtnText:   { color: Colors.primaryText, fontWeight: '700' },

  sectionTitle: { ...Typography.label, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.md, marginBottom: Spacing.xs },
  mutedText:    { fontSize: 12, color: Colors.textMuted },
  sizeTable: { borderWidth: 0.5, borderColor: Colors.cardBorder, borderRadius: Radius.md, overflow: 'hidden', marginBottom: Spacing.sm },
  sizeTr:    { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: Spacing.sm, borderBottomWidth: 0.5, borderBottomColor: Colors.cardBorder },
  sizeTh:    { flex: 1, fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textAlign: 'center' },
  sizeTd:    { flex: 1, fontSize: 13, color: Colors.textPrimary, textAlign: 'center' },
  bySizeText:   { fontSize: 13, color: Colors.textPrimary, fontWeight: '600', lineHeight: 22 },

  entryRow:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, borderBottomWidth: 0.5, borderBottomColor: Colors.cardBorder },
  entryRowEditing: { backgroundColor: Colors.primaryLight },
  entryMain:       { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  entryMeta:       { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  editBtn:         { backgroundColor: Colors.primaryLight, padding: Spacing.sm, borderRadius: Radius.sm },
  deleteBtn:       { backgroundColor: Colors.dangerBg, padding: Spacing.sm, borderRadius: Radius.sm },

  givenRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 0.5, borderBottomColor: Colors.cardBorder },
  givenName: { flex: 1, fontSize: 13, color: Colors.textPrimary },
  givenQty:  { fontSize: 13, fontWeight: '800', color: Colors.primary },
});