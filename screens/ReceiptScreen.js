// screens/ReceiptScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, StyleSheet, ActivityIndicator, Modal, FlatList,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import BluetoothService from '../services/BluetoothService';
import EscPosEncoder from '../services/EscPosEncoder';
import ReceiptHistory from '../services/ReceiptHistory';
import SettingsService from '../services/SettingsService';
import SchoolService from '../services/SchoolService';
import CatalogService from '../services/CatalogService';
import ShareService from '../services/ShareService';
import { Colors, Radius, Spacing, Shadow } from '../constants/Theme';

export default function ReceiptScreen() {
  const [settings, setSettings]             = useState(null);
  const [schools, setSchools]               = useState([]);
  const [catalog, setCatalog]               = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [spellNumber, setSpellNumber]       = useState(1);
  const [items, setItems]                   = useState([]);
  const [printing, setPrinting]             = useState(false);
  const [schoolModal, setSchoolModal]       = useState(false);
  const [copiesModal, setCopiesModal]       = useState(false);
  const [copies, setCopies]                 = useState('1');
  const [pendingPrint, setPendingPrint]     = useState(null);
  const [schoolSearch, setSchoolSearch]     = useState('');
  const [permission, requestPermission]     = useCameraPermissions();

  useFocusEffect(
    useCallback(() => { loadData(); }, [])
  );

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

  const toggleItem   = (id) => setItems(prev => prev.map(i =>
    i.id === id ? { ...i, checked: !i.checked } : i
  ));
  const updateCount  = (id, v) => setItems(prev => prev.map(i =>
    i.id === id ? { ...i, count: v } : i
  ));
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
    setCopies('1');
    setCopiesModal(true);
  };

  const handlePrint = async () => {
    setCopiesModal(false);
    const numCopies = parseInt(copies) || 1;
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
    return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>SRKVM Kits · {settings.shopName} Mandal</Text>
            <Text style={styles.headerTitle}>Kit Distribution</Text>
          </View>
          <View style={styles.headerIcon}>
            <Text style={{ fontSize: 26 }}>🧾</Text>
          </View>
        </View>

        {/* School Selector */}
        <Text style={styles.sectionTitle}>School</Text>
        <TouchableOpacity style={styles.schoolSelector} onPress={() => setSchoolModal(true)}>
          {selectedSchool ? (
            <View>
              <Text style={styles.schoolSelectedName}>{selectedSchool.name}</Text>
              {selectedSchool.udise ? <Text style={styles.schoolSelectedUdise}>UDISE: {selectedSchool.udise}</Text> : null}
            </View>
          ) : (
            <Text style={styles.schoolPlaceholder}>🏫  స్కూల్ select చేయండి...</Text>
          )}
          <Text style={styles.arrow}>▼</Text>
        </TouchableOpacity>

        {/* Spell */}
        <Text style={styles.sectionTitle}>Distribution Spell</Text>
        <View style={styles.card}>
          <View style={styles.spellRow}>
            <TouchableOpacity style={styles.spellBtn} onPress={() => setSpellNumber(Math.max(1, spellNumber - 1))}>
              <Text style={styles.spellBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.spellValue}>Spell {spellNumber}</Text>
            <TouchableOpacity style={styles.spellBtn} onPress={() => setSpellNumber(spellNumber + 1)}>
              <Text style={styles.spellBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Items Checklist */}
        <Text style={styles.sectionTitle}>
          Kit Items {selectedSchool ? `— ${checkedItems.length} selected` : '— స్కూల్ select చేయండి'}
        </Text>

        {catalog.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>📦 Catalog లో items లేవు</Text>
            <Text style={styles.emptyHint}>Settings → Item Catalog లో add చేయండి</Text>
          </View>
        ) : !selectedSchool ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyHint}>స్కూల్ select చేసిన తర్వాత checklist వస్తుంది</Text>
          </View>
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
                />
              )}
            </TouchableOpacity>
          ))
        )}

        {/* Summary */}
        {checkedItems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.card}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Selected Items</Text>
                <Text style={styles.summaryValue}>{checkedItems.length}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Quantity</Text>
                <Text style={styles.totalValue}>{getTotalQty()}</Text>
              </View>
            </View>
          </>
        )}

        {/* Print Buttons */}
        <TouchableOpacity
          style={[styles.printBtn, printing && styles.printBtnDisabled]}
          onPress={() => validateAndAskCopies('thermal')}
          disabled={printing}
        >
          {printing ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.printBtnText}>🖨️  Thermal Printer లో Print</Text>
          )}
        </TouchableOpacity>

        <View style={styles.shareRow}>
          <TouchableOpacity style={styles.shareBtn} onPress={() => validateAndAskCopies('pdf')}>
            <Text style={styles.shareBtnText}>📄 PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn} onPress={() => validateAndAskCopies('system')}>
            <Text style={styles.shareBtnText}>🖨️ System</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />

        {/* School Modal */}
        <Modal visible={schoolModal} animationType="slide" transparent onRequestClose={() => setSchoolModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🏫 స్కూల్ Select చేయండి</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="పేరు లేదా UDISE search..."
                value={schoolSearch}
                onChangeText={setSchoolSearch}
              />
              {filteredSchools.length === 0 ? (
                <Text style={styles.emptyHint}>స్కూళ్ళు లేవు. Settings → Schools లో add చేయండి.</Text>
              ) : (
                <FlatList
                  data={filteredSchools}
                  keyExtractor={item => item.id}
                  style={{ maxHeight: 400 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.schoolItem} onPress={() => selectSchool(item)}>
                      <Text style={styles.schoolItemName}>{item.name}</Text>
                      {item.udise ? <Text style={styles.schoolItemSub}>UDISE: {item.udise}</Text> : null}
                      {item.address ? <Text style={styles.schoolItemSub}>{item.address}</Text> : null}
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

        {/* Copies Modal */}
        <Modal visible={copiesModal} animationType="fade" transparent onRequestClose={() => setCopiesModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.copiesModal}>
              <Text style={styles.modalTitle}>🖨️ Copies</Text>
              <Text style={styles.copiesLabel}>ఎన్ని copies కావాలి?</Text>
              <View style={styles.copiesRow}>
                <TouchableOpacity style={styles.spellBtn} onPress={() => setCopies(String(Math.max(1, parseInt(copies || 1) - 1)))}>
                  <Text style={styles.spellBtnText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.copiesInput}
                  value={copies}
                  onChangeText={setCopies}
                  keyboardType="numeric"
                  textAlign="center"
                />
                <TouchableOpacity style={styles.spellBtn} onPress={() => setCopies(String(parseInt(copies || 1) + 1))}>
                  <Text style={styles.spellBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setCopiesModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handlePrint}>
                  <Text style={styles.confirmBtnText}>Print {copies} Copy</Text>
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
  safe:      { flex: 1, backgroundColor: Colors.bgPage },
  container: { flex: 1 },
  content:   { padding: Spacing.xl, paddingTop: 52, paddingBottom: 20 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xxl },
  headerSub:   { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.primaryDark },
  headerIcon:  { width: 52, height: 52, backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  schoolSelector: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 8, ...Shadow.card },
  schoolPlaceholder:   { color: Colors.textHint, fontSize: 15 },
  schoolSelectedName:  { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  schoolSelectedUdise: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  arrow: { color: Colors.textSecondary, fontSize: 12 },

  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: Colors.border, ...Shadow.card },

  spellRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  spellBtn:    { width: 44, height: 44, backgroundColor: Colors.primaryLight, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  spellBtnText:{ fontSize: 24, color: Colors.primary, fontWeight: '700' },
  spellValue:  { fontSize: 22, fontWeight: '800', color: Colors.primaryDark, minWidth: 100, textAlign: 'center' },

  checkItem: { backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.borderLight, ...Shadow.card },
  checkItemActive: { borderColor: Colors.primary, backgroundColor: '#fafafe' },
  checkbox:   { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark:  { color: '#fff', fontSize: 14, fontWeight: '700' },
  checkItemName: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  checkItemNameMuted: { color: Colors.textHint },
  countInput: { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.sm, padding: 6, width: 60, fontSize: 15, fontWeight: '700', color: Colors.primary, textAlign: 'center', backgroundColor: Colors.primaryLight },

  emptyCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 20, alignItems: 'center', marginBottom: 8 },
  emptyText: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  emptyHint: { fontSize: 12, color: Colors.textHint, textAlign: 'center' },

  summaryRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel:{ color: Colors.textSecondary, fontSize: 14 },
  summaryValue:{ color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  totalRow:    { borderTopWidth: 1, borderTopColor: Colors.borderLight, marginTop: 4, paddingTop: 8 },
  totalLabel:  { fontWeight: '700', fontSize: 16, color: Colors.textPrimary },
  totalValue:  { fontWeight: '800', fontSize: 16, color: Colors.primary },

  printBtn:        { backgroundColor: Colors.primary, padding: 16, borderRadius: Radius.lg, alignItems: 'center', marginTop: 16, ...Shadow.card },
  printBtnDisabled:{ backgroundColor: Colors.primaryMid },
  printBtnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },

  shareRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  shareBtn: { flex: 1, backgroundColor: Colors.bgCard, padding: 14, borderRadius: Radius.lg, alignItems: 'center', borderWidth: 1, borderColor: Colors.primary },
  shareBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: 20, paddingBottom: 36 },
  copiesModal:  { backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: 24, paddingBottom: 36 },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: Colors.primaryDark, marginBottom: 12 },
  copiesLabel:  { fontSize: 15, color: Colors.textSecondary, marginBottom: 16, textAlign: 'center' },
  copiesRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 20 },
  copiesInput:  { borderWidth: 2, borderColor: Colors.primary, borderRadius: Radius.md, padding: 10, width: 80, fontSize: 24, fontWeight: '800', color: Colors.primary },
  searchInput:  { backgroundColor: Colors.bgPage, borderRadius: Radius.md, padding: 12, fontSize: 14, marginBottom: 12, color: Colors.textPrimary },
  schoolItem:   { paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: Colors.borderLight },
  schoolItemName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  schoolItemSub:  { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  closeBtn:     { backgroundColor: Colors.bgPage, padding: 14, borderRadius: Radius.md, alignItems: 'center', marginTop: 12 },
  closeBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn:    { flex: 1, padding: 14, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight },
  cancelBtnText:{ color: Colors.textSecondary, fontWeight: '600' },
  confirmBtn:   { flex: 1, backgroundColor: Colors.primary, padding: 14, borderRadius: Radius.md, alignItems: 'center' },
  confirmBtnText:{ color: '#fff', fontWeight: '700' },
});