// screens/ReceiptScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, StyleSheet, ActivityIndicator, Modal, FlatList,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import BluetoothService from '../services/BluetoothService';
import EscPosEncoder from '../services/EscPosEncoder';
import ReceiptHistory from '../services/ReceiptHistory';
import SettingsService from '../services/SettingsService';
import SchoolService from '../services/SchoolService';
import CatalogService from '../services/CatalogService';
import ShareService from '../services/ShareService';
import { Colors, Radius, Spacing, Typography } from '../constants/Theme'; 
import { ScreenHeader, Card, Stepper } from '../components/Ui';

export default function ReceiptScreen() {
  const [settings, setSettings]         = useState(null);
  const [schools, setSchools]           = useState([]);
  const [catalog, setCatalog]           = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [spellNumber, setSpellNumber]   = useState(1);
  const [items, setItems]               = useState([]);
  const [printing, setPrinting]         = useState(false);
  const [schoolModal, setSchoolModal]   = useState(false);
  const [copiesModal, setCopiesModal]   = useState(false);
  const [copies, setCopies]             = useState(1);
  const [pendingPrint, setPendingPrint] = useState(null);
  const [schoolSearch, setSchoolSearch] = useState('');

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    const s  = await SettingsService.get();
    const sc = await SchoolService.getAll();
    const c  = await CatalogService.getAll();
    setSettings(s);
    setSchools(sc);
    setCatalog(c);
  };

  const selectSchool = (school) => {
    setSelectedSchool(school);
    setSchoolModal(false);
    setSchoolSearch('');
    const savedCounts = {};
    if (school.items?.length > 0) {
      school.items.forEach(i => { savedCounts[i.id] = i.count || '0'; });
    }
    const checklist = catalog.map(catItem => ({
      id:      catItem.id,
      name:    catItem.name,
      checked: savedCounts[catItem.id] !== undefined,
      count:   savedCounts[catItem.id] || '0',
    }));
    setItems(checklist);
  };

  const toggleItem  = (id) => setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  const updateCount = (id, v) => setItems(prev => prev.map(i => i.id === id ? { ...i, count: v } : i));
  const checkedItems = items.filter(i => i.checked);
  const getTotalQty  = () => checkedItems.reduce((s, i) => s + parseInt(i.count || 0), 0);

  const saveItemsToSchool = async () => {
    if (!selectedSchool) return;
    await SchoolService.updateItems(
      selectedSchool.id,
      checkedItems.map(i => ({ id: i.id, name: i.name, count: i.count }))
    );
  };

  const buildReceipt = () => {
    const encoder = new EscPosEncoder();
    const width   = settings?.paperWidth || 32;
    const mandal  = settings?.shopName || 'Mandal';
    encoder.initialize()
      .align('center').bold(true).size('double')
      .text('SRKVM Kits').newline()
      .size('normal').text(`${mandal} Mandal`).newline()
      .bold(false).divider('=', width).align('left')
      .text(`Date : ${new Date().toLocaleDateString()}`).newline()
      .text(`Time : ${new Date().toLocaleTimeString()}`).newline()
      .bold(true).text(`Spell: Spell ${spellNumber}`).newline()
      .bold(false).divider('-', width);
    if (selectedSchool) {
      encoder.bold(true).text('School:').bold(false).newline()
        .text(selectedSchool.name).newline();
      if (selectedSchool.udise) encoder.text(`UDISE : ${selectedSchool.udise}`).newline();
      if (selectedSchool.address) encoder.text(selectedSchool.address).newline();
    }
    encoder.divider('-', width);
    const countCol = 6, nameCol = width - countCol - 1;
    encoder.bold(true).text('Item'.padEnd(nameCol) + 'Count').newline().bold(false).divider('-', width);
    checkedItems.forEach(item => {
      encoder.text(item.name.substring(0, nameCol).padEnd(nameCol) + String(item.count || 0).padStart(countCol)).newline();
    });
    encoder.divider('-', width)
      .row('Total Items :', String(checkedItems.length), width)
      .bold(true).row('Total Qty   :', String(getTotalQty()), width).bold(false)
      .divider('=', width).align('left')
      .text('Received By:').newline().newline()
      .text('Name : ____________________').newline().newline()
      .text('Sign : ____________________').newline()
      .divider('=', width).align('center')
      .text(settings?.shopTagline || 'Thank you!').newline()
      .newline(3).cut();
    return encoder.encodeBase64();
  };

  const validateAndAskCopies = (type) => {
    if (!selectedSchool) { Alert.alert('స్కూల్ select చేయండి'); return; }
    if (checkedItems.length === 0) { Alert.alert('Items tick చేయండి'); return; }
    setPendingPrint(type);
    setCopies(1);
    setCopiesModal(true);
  };

  const handlePrint = async () => {
    setCopiesModal(false);
    const numCopies = copies;
    if (pendingPrint === 'thermal') {
      try {
        const connected = await BluetoothService.isConnected();
        if (!connected) { Alert.alert('Not Connected', 'Printer connect చేయండి'); return; }
        setPrinting(true);
        await saveItemsToSchool();
        const data = buildReceipt();
        for (let i = 0; i < numCopies; i++) {
          await BluetoothService.sendBase64(data);
          if (i < numCopies - 1) await new Promise(r => setTimeout(r, 1500));
        }
        await ReceiptHistory.save({
          shopName: `SRKVM Kits - ${settings?.shopName || ''} Mandal`,
          shopPhone: settings?.shopPhone || '',
          school: selectedSchool, spell: spellNumber,
          items: checkedItems, footer: settings?.shopTagline || '',
        });
        Alert.alert('✅ Success', `${numCopies} copy/copies printed!`);
      } catch (error) {
        Alert.alert('❌ Failed', error.message);
      } finally {
        setPrinting(false);
      }
    } else if (pendingPrint === 'pdf') {
      try {
        await saveItemsToSchool();
        await ShareService.sharePDF({ settings, school: selectedSchool, spell: spellNumber, items: checkedItems, totalQty: getTotalQty() });
      } catch (error) { Alert.alert('Error', error.message); }
    } else if (pendingPrint === 'system') {
      try {
        await saveItemsToSchool();
        await ShareService.printViaSystem({ settings, school: selectedSchool, spell: spellNumber, items: checkedItems, totalQty: getTotalQty() });
      } catch (error) { Alert.alert('Error', error.message); }
    }
  };

  const filteredSchools = schools.filter(s =>
    s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
    s.udise.includes(schoolSearch)
  );

  if (!settings) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Kit Distribution" subtitle="SRKVM Kits" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── ui.js → ScreenHeader ── */}
      <ScreenHeader
        title="Kit Distribution"
        subtitle={`SRKVM Kits · ${settings.shopName} Mandal`}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── School Selector ── */}
        <Text style={styles.sectionTitle}>🏫  School</Text>
        <TouchableOpacity style={styles.schoolSelector} onPress={() => setSchoolModal(true)}>
          <View style={styles.schoolSelectorLeft}>
            <View style={styles.schoolSelectorIcon}>
              <Text style={{ fontSize: 20 }}>🏫</Text>
            </View>
            <View>
              {selectedSchool ? (
                <>
                  <Text style={styles.schoolSelectedName}>{selectedSchool.name}</Text>
                  {selectedSchool.udise
                    ? <Text style={styles.schoolSelectedUdise}>UDISE: {selectedSchool.udise}</Text>
                    : null}
                </>
              ) : (
                <Text style={styles.schoolPlaceholder}>స్కూల్ select చేయండి...</Text>
              )}
            </View>
          </View>
          <Text style={styles.arrow}>▼</Text>
        </TouchableOpacity>

        {/* ── Distribution Spell ── ui.js → Card + Stepper ── */}
        <Text style={styles.sectionTitle}>📋  Distribution Spell</Text>
        <Card>
          <View style={styles.spellRow}>
            <Text style={styles.spellLabel}>Spell Number</Text>
            {/* ui.js → Stepper */}
            <Stepper value={spellNumber} onChange={setSpellNumber} min={1} />
          </View>
          <View style={styles.spellBadgeWrap}>
            <View style={styles.spellBadge}>
              <Text style={styles.spellBadgeText}>Spell {spellNumber}</Text>
            </View>
          </View>
        </Card>

        {/* ── Kit Items Checklist ── ui.js → Card ── */}
        <Text style={styles.sectionTitle}>
          📦  Kit Items{selectedSchool ? `  —  ${checkedItems.length} selected` : ''}
        </Text>

        {catalog.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>Catalog లో items లేవు</Text>
            <Text style={styles.emptyHint}>Settings → Item Catalog లో add చేయండి</Text>
          </Card>
        ) : !selectedSchool ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🏫</Text>
            <Text style={styles.emptyHint}>స్కూల్ select చేసిన తర్వాత checklist వస్తుంది</Text>
          </Card>
        ) : (
          items.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.checkItem, item.checked && styles.checkItemActive]}
              onPress={() => toggleItem(item.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, item.checked && styles.checkboxActive]}>
                {item.checked && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.checkItemName, !item.checked && styles.checkItemNameMuted]}>
                {item.name}
              </Text>
              {item.checked && (
                <TextInput
                  style={styles.countInput}
                  value={String(item.count)}
                  onChangeText={v => updateCount(item.id, v)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                />
              )}
            </TouchableOpacity>
          ))
        )}

        {/* ── Summary ── ui.js → Card ── */}
        {checkedItems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>📊  Summary</Text>
            <Card>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Selected Items</Text>
                <Text style={styles.summaryValue}>{checkedItems.length}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Quantity</Text>
                <Text style={styles.totalValue}>{getTotalQty()}</Text>
              </View>
            </Card>
          </>
        )}

        {/* ── Print Button ── */}
        <TouchableOpacity
          style={[styles.printBtn, printing && styles.printBtnDisabled]}
          onPress={() => validateAndAskCopies('thermal')}
          disabled={printing}
        >
          {printing
            ? <ActivityIndicator color={Colors.primaryText} />
            : (
              <View style={styles.printBtnInner}>
                <Text style={styles.printBtnIcon}>🖨️</Text>
                <Text style={styles.printBtnText}>Thermal Printer లో Print</Text>
              </View>
            )}
        </TouchableOpacity>

        {/* ── Share Row ── */}
        <View style={styles.shareRow}>
          <TouchableOpacity style={styles.shareBtn} onPress={() => validateAndAskCopies('pdf')}>
            <Text style={styles.shareBtnIcon}>📄</Text>
            <Text style={styles.shareBtnText}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn} onPress={() => validateAndAskCopies('system')}>
            <Text style={styles.shareBtnIcon}>🖨️</Text>
            <Text style={styles.shareBtnText}>System Print</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: Spacing.xl }} />

        {/* ── School Picker Modal ── */}
        <Modal visible={schoolModal} animationType="slide" transparent onRequestClose={() => setSchoolModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🏫  స్కూల్ Select చేయండి</Text>
              <View style={styles.modalSearchBox}>
                <Text style={{ fontSize: 14 }}>🔍</Text>
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="పేరు లేదా UDISE search..."
                  value={schoolSearch}
                  onChangeText={setSchoolSearch}
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              {filteredSchools.length === 0 ? (
                <Text style={styles.emptyHint}>స్కూళ్ళు లేవు. Settings → Schools లో add చేయండి.</Text>
              ) : (
                <FlatList
                  data={filteredSchools}
                  keyExtractor={item => item.id}
                  style={{ maxHeight: 380 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.schoolItem} onPress={() => selectSchool(item)}>
                      <View style={styles.schoolItemIcon}>
                        <Text style={{ fontSize: 16 }}>🏫</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.schoolItemName}>{item.name}</Text>
                        {item.udise ? <Text style={styles.schoolItemSub}>UDISE: {item.udise}</Text> : null}
                        {item.address ? <Text style={styles.schoolItemSub}>{item.address}</Text> : null}
                      </View>
                      <Text style={styles.arrow}>›</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
              <TouchableOpacity style={styles.closeBtn} onPress={() => setSchoolModal(false)}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── Copies Modal ── ui.js → Stepper ── */}
        <Modal visible={copiesModal} animationType="fade" transparent onRequestClose={() => setCopiesModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.copiesModal}>
              <Text style={styles.modalTitle}>🖨️  Copies</Text>
              <Text style={styles.copiesLabel}>ఎన్ని copies కావాలి?</Text>
              {/* ui.js → Stepper */}
              <View style={styles.copiesStepperWrap}>
                <Stepper value={copies} onChange={setCopies} min={1} />
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setCopiesModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handlePrint}>
                  <Text style={styles.confirmBtnText}>Print {copies} {copies === 1 ? 'Copy' : 'Copies'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sectionTitle: { ...Typography.label, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.xs },

  // School Selector
  schoolSelector: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    elevation: 1,
  },
  schoolSelectorLeft:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  schoolSelectorIcon:  { width: 40, height: 40, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  schoolPlaceholder:   { fontSize: 14, color: Colors.textMuted },
  schoolSelectedName:  { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  schoolSelectedUdise: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  arrow: { color: Colors.textMuted, fontSize: 14, marginLeft: Spacing.sm },

  // Spell — ui.js Stepper used
  spellRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  spellLabel:    { ...Typography.bodyMd, fontWeight: '600' },
  spellBadgeWrap:{ alignItems: 'center', marginTop: Spacing.sm },
  spellBadge:    { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  spellBadgeText:{ fontSize: 15, fontWeight: '800', color: Colors.primary },

  // Checklist items
  checkItem: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    elevation: 1,
  },
  checkItemActive:     { borderColor: Colors.primary, backgroundColor: '#fafafe' },
  checkbox:            { width: 24, height: 24, borderRadius: Radius.sm, borderWidth: 2, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  checkboxActive:      { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark:           { color: Colors.primaryText, fontSize: 13, fontWeight: '700' },
  checkItemName:       { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  checkItemNameMuted:  { color: Colors.textMuted },
  countInput: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.sm,
    padding: Spacing.xs,
    width: 56,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
    backgroundColor: Colors.primaryLight,
  },

  // Empty states
  emptyCard: { alignItems: 'center', gap: Spacing.xs },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.xs },
  emptyText: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  emptyHint: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },

  // Summary
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  summaryLabel: { ...Typography.bodyMd },
  summaryValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  totalRow:     { borderTopWidth: 1, borderTopColor: Colors.cardBorder, marginTop: Spacing.xs, paddingTop: Spacing.sm },
  totalLabel:   { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  totalValue:   { fontSize: 15, fontWeight: '800', color: Colors.primary },

  // Print button
  printBtn: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginTop: Spacing.sm,
    elevation: 2,
  },
  printBtnDisabled: { backgroundColor: '#a5b4fc' },
  printBtnInner:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  printBtnIcon:     { fontSize: 18 },
  printBtnText:     { color: Colors.primaryText, fontWeight: '700', fontSize: 15 },

  // Share row
  shareRow: { flexDirection: 'row', gap: Spacing.sm },
  shareBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  shareBtnIcon: { fontSize: 15 },
  shareBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: 36 },
  copiesModal:  { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: 36, alignItems: 'center' },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: Colors.primaryDark, marginBottom: Spacing.md },
  copiesLabel:  { ...Typography.bodyMd, color: Colors.textSecondary, marginBottom: Spacing.lg },
  copiesStepperWrap: { transform: [{ scale: 1.4 }], marginBottom: Spacing.xl },
  modalSearchBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.background, borderRadius: Radius.md, paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  modalSearchInput: { flex: 1, paddingVertical: Spacing.sm, fontSize: 14, color: Colors.textPrimary },
  schoolItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: Colors.cardBorder },
  schoolItemIcon: { width: 36, height: 36, backgroundColor: Colors.primaryLight, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  schoolItemName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  schoolItemSub:  { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  closeBtn:     { backgroundColor: Colors.background, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center', marginTop: Spacing.md },
  closeBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, width: '100%' },
  cancelBtn:    { flex: 1, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder },
  cancelBtnText:{ color: Colors.textSecondary, fontWeight: '600' },
  confirmBtn:   { flex: 1, backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  confirmBtnText:{ color: Colors.primaryText, fontWeight: '700' },
});