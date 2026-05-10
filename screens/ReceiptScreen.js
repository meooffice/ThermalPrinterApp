// screens/ReceiptScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, StyleSheet, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import BluetoothService from '../services/BluetoothService';
import EscPosEncoder from '../services/EscPosEncoder';
import ReceiptHistory from '../services/ReceiptHistory';
import SettingsService from '../services/SettingsService';
import SchoolService from '../services/SchoolService';
import CatalogService from '../services/CatalogService';
import ShareService from '../services/ShareService';

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

  // ── School Selection ───────────────────────────────────
  const selectSchool = (school) => {
    setSelectedSchool(school);
    setSchoolModal(false);
    setSchoolSearch('');

    // Load catalog items as checklist
    // If school has saved counts, use them; otherwise default to 0
    const savedCounts = {};
    if (school.items && school.items.length > 0) {
      school.items.forEach(i => {
        savedCounts[i.id] = i.count || '0';
      });
    }

    // Build checklist from catalog
    const checklist = catalog.map(catItem => ({
      id:       catItem.id,
      name:     catItem.name,
      category: catItem.category,
      checked:  savedCounts[catItem.id] !== undefined,
      count:    savedCounts[catItem.id] || '0',
    }));
    setItems(checklist);
  };

  // ── Checklist helpers ──────────────────────────────────
  const toggleItem = (id) => {
    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, checked: !i.checked } : i
    ));
  };

  const updateCount = (id, value) => {
    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, count: value } : i
    ));
  };

  const checkedItems = items.filter(i => i.checked);
  const getTotalQty  = () =>
    checkedItems.reduce((sum, i) => sum + parseInt(i.count || 0), 0);

  // ── Save items to school ───────────────────────────────
  const saveItemsToSchool = async () => {
    if (!selectedSchool) return;
    const toSave = checkedItems.map(i => ({
      id:    i.id,
      name:  i.name,
      count: i.count,
    }));
    await SchoolService.updateItems(selectedSchool.id, toSave);
  };

  // ── Build ESC/POS ──────────────────────────────────────
  const buildReceipt = () => {
    const encoder = new EscPosEncoder();
    const width   = settings?.paperWidth || 32;
    const mandal  = settings?.shopName || 'Mandal';

    encoder.initialize();

    // Header
    encoder
      .align('center')
      .bold(true).size('double')
      .text('SRKVM KITS').newline()
      .size('normal')
      .text(`${mandal} Mandal`).newline()
      .bold(false)
      .divider('=', width);

    // Date & Spell
    const now = new Date();
    encoder
      .align('left')
      .text(`Date : ${now.toLocaleDateString()}`).newline()
      .text(`Time : ${now.toLocaleTimeString()}`).newline()
      .bold(true)
      .text(`Spell: Spell ${spellNumber}`).newline()
      .bold(false)
      .divider('-', width);

    // School info
    if (selectedSchool) {
      encoder
        .bold(true).text('School:').bold(false).newline()
        .text(selectedSchool.name).newline();
      if (selectedSchool.udise) {
        encoder.text(`UDISE : ${selectedSchool.udise}`).newline();
      }
      if (selectedSchool.address) {
        encoder.text(selectedSchool.address).newline();
      }
    }

    encoder.divider('-', width);

    // Items header
    const countCol = 6;
    const nameCol  = width - countCol - 1;
    encoder
      .bold(true)
      .text('Item'.padEnd(nameCol) + 'Count').newline()
      .bold(false)
      .divider('-', width);

    // Checked items only
    checkedItems.forEach(item => {
      const name  = item.name.substring(0, nameCol).padEnd(nameCol);
      const count = String(item.count || 0).padStart(countCol);
      encoder.text(name + count).newline();
    });

    // Totals
    encoder
      .divider('-', width)
      .row('Total Items :', String(checkedItems.length), width)
      .bold(true)
      .row('Total Qty   :', String(getTotalQty()), width)
      .bold(false)
      .divider('=', width);

    // Signature
    encoder
      .align('left')
      .text('Received By:').newline()
      .newline()
      .text('Name : ____________________').newline()
      .newline()
      .text('Sign : ____________________').newline()
      .divider('=', width)
      .align('center')
      .text(settings?.shopTagline || 'Thank you!').newline()
      .newline(3)
      .cut();

    return encoder.encodeBase64();
  };

  // ── Validate before print ──────────────────────────────
  const validateAndAskCopies = (type) => {
    if (!selectedSchool) {
      Alert.alert('స్కూల్ select చేయండి', 'ముందు స్కూల్ సెలెక్ట్ చేయండి.');
      return;
    }
    if (checkedItems.length === 0) {
      Alert.alert('Items లేవు', 'కనీసం ఒక item tick చేయండి.');
      return;
    }
    setPendingPrint(type);
    setCopies('1');
    setCopiesModal(true);
  };

  // ── Print ──────────────────────────────────────────────
  const handlePrint = async () => {
    setCopiesModal(false);
    const numCopies = parseInt(copies) || 1;

    if (pendingPrint === 'thermal') {
      try {
        const connected = await BluetoothService.isConnected();
        if (!connected) {
          Alert.alert('Connected లేదు', 'ముందు printer connect చేయండి.');
          return;
        }
        setPrinting(true);
        await saveItemsToSchool();

        const data = buildReceipt();
        for (let i = 0; i < numCopies; i++) {
          await BluetoothService.sendBase64(data);
          if (i < numCopies - 1) {
            await new Promise(r => setTimeout(r, 1500));
          }
        }

        await ReceiptHistory.save({
          shopName:  `SRKVM KITS - ${settings?.shopName || ''} Mandal`,
          shopPhone: settings?.shopPhone || '',
          school:    selectedSchool,
          spell:     spellNumber,
          items:     checkedItems,
          footer:    settings?.shopTagline || '',
        });

        Alert.alert('Success! ✅', `${numCopies} copy/copies print అయ్యాయి!`);
      } catch (error) {
        Alert.alert('Print Failed', error.message);
      } finally {
        setPrinting(false);
      }

    } else if (pendingPrint === 'pdf') {
      try {
        await saveItemsToSchool();
        const receiptData = {
          settings,
          school:   selectedSchool,
          spell:    spellNumber,
          items:    checkedItems,
          totalQty: getTotalQty(),
        };
        await ShareService.sharePDF(receiptData);
      } catch (error) {
        Alert.alert('Error', error.message);
      }

    } else if (pendingPrint === 'system') {
      try {
        await saveItemsToSchool();
        const receiptData = {
          settings,
          school:   selectedSchool,
          spell:    spellNumber,
          items:    checkedItems,
          totalQty: getTotalQty(),
        };
        await ShareService.printViaSystem(receiptData);
      } catch (error) {
        Alert.alert('Error', error.message);
      }
    }
  };

  const filteredSchools = schools.filter(s =>
    s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
    s.udise.includes(schoolSearch)
  );

  if (!settings) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🧾 Kit Distribution</Text>
        <Text style={styles.headerSub}>
          SRKVM Kits · {settings.shopName} Mandal
        </Text>
      </View>

      {/* School Selector */}
      <Text style={styles.sectionTitle}>School</Text>
      <TouchableOpacity
        style={styles.schoolSelector}
        onPress={() => setSchoolModal(true)}
      >
        {selectedSchool ? (
          <View>
            <Text style={styles.schoolSelectedName}>
              {selectedSchool.name}
            </Text>
            {selectedSchool.udise ? (
              <Text style={styles.schoolSelectedUdise}>
                UDISE: {selectedSchool.udise}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.schoolSelectorPlaceholder}>
            🏫  స్కూల్ select చేయండి...
          </Text>
        )}
        <Text style={styles.schoolSelectorArrow}>▼</Text>
      </TouchableOpacity>

      {/* Spell Number */}
      <Text style={styles.sectionTitle}>Distribution Spell</Text>
      <View style={styles.card}>
        <View style={styles.spellRow}>
          <TouchableOpacity
            style={styles.spellBtn}
            onPress={() => setSpellNumber(Math.max(1, spellNumber - 1))}
          >
            <Text style={styles.spellBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.spellValue}>Spell {spellNumber}</Text>
          <TouchableOpacity
            style={styles.spellBtn}
            onPress={() => setSpellNumber(spellNumber + 1)}
          >
            <Text style={styles.spellBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Items Checklist */}
      <Text style={styles.sectionTitle}>
        Kit Items
        {selectedSchool
          ? ` — ${checkedItems.length} selected`
          : ' — స్కూల్ select చేయండి'}
      </Text>

      {catalog.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            📦 Catalog లో items లేవు
          </Text>
          <Text style={styles.emptyHint}>
            Catalog tab లో items add చేయండి
          </Text>
        </View>
      ) : !selectedSchool ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyHint}>
            స్కూల్ select చేసిన తర్వాత items checklist వస్తుంది
          </Text>
        </View>
      ) : (
        <>
          {items.map((item) => (
            <View key={item.id} style={styles.checklistItem}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => toggleItem(item.id)}
              >
                <Text style={styles.checkboxText}>
                  {item.checked ? '☑️' : '⬜'}
                </Text>
              </TouchableOpacity>
              <Text style={[
                styles.checklistName,
                !item.checked && styles.checklistNameDisabled,
              ]}>
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
            </View>
          ))}
        </>
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
        {printing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.printBtnText}>🖨️  Thermal Printer లో Print</Text>
        )}
      </TouchableOpacity>

      <View style={styles.shareRow}>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => validateAndAskCopies('pdf')}
        >
          <Text style={styles.shareBtnText}>📄 PDF Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => validateAndAskCopies('system')}
        >
          <Text style={styles.shareBtnText}>🖨️ System Print</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />

      {/* School Picker Modal */}
      <Modal
        visible={schoolModal}
        animationType="slide"
        transparent
        onRequestClose={() => setSchoolModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🏫 స్కూల్ Select చేయండి</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="పేరు లేదా UDISE తో search చేయండి..."
              value={schoolSearch}
              onChangeText={setSchoolSearch}
            />
            {filteredSchools.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: '#9ca3af', fontSize: 14 }}>
                  స్కూళ్ళు లేవు. 🏫 Schools tab లో add చేయండి.
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredSchools}
                keyExtractor={item => item.id}
                style={{ maxHeight: 400 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.schoolItem}
                    onPress={() => selectSchool(item)}
                  >
                    <Text style={styles.schoolItemName}>{item.name}</Text>
                    {item.udise ? (
                      <Text style={styles.schoolItemUdise}>
                        UDISE: {item.udise}
                      </Text>
                    ) : null}
                    {item.address ? (
                      <Text style={styles.schoolItemAddress}>
                        {item.address}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setSchoolModal(false)}
            >
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Copies Modal */}
      <Modal
        visible={copiesModal}
        animationType="fade"
        transparent
        onRequestClose={() => setCopiesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.copiesModal}>
            <Text style={styles.modalTitle}>🖨️ Copies</Text>
            <Text style={styles.copiesLabel}>
              ఎన్ని copies కావాలి?
            </Text>
            <View style={styles.copiesRow}>
              <TouchableOpacity
                style={styles.spellBtn}
                onPress={() => setCopies(String(Math.max(1, parseInt(copies||1) - 1)))}
              >
                <Text style={styles.spellBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.copiesInput}
                value={copies}
                onChangeText={setCopies}
                keyboardType="numeric"
                textAlign="center"
              />
              <TouchableOpacity
                style={styles.spellBtn}
                onPress={() => setCopies(String(parseInt(copies||1) + 1))}
              >
                <Text style={styles.spellBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCopiesModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handlePrint}
              >
                <Text style={styles.saveBtnText}>
                  Print {copies} Copy
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginTop: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1f2937',
  },
  headerSub: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  schoolSelector: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 1,
  },
  schoolSelectorPlaceholder: {
    color: '#9ca3af',
    fontSize: 15,
  },
  schoolSelectorArrow: {
    color: '#6b7280',
    fontSize: 12,
  },
  schoolSelectedName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  schoolSelectedUdise: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    elevation: 1,
  },
  spellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  spellBtn: {
    backgroundColor: '#ede9fe',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spellBtnText: {
    fontSize: 24,
    color: '#4f46e5',
    fontWeight: '700',
  },
  spellValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1f2937',
    minWidth: 100,
    textAlign: 'center',
  },
  checklistItem: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 1,
  },
  checkbox: {
    padding: 2,
  },
  checkboxText: {
    fontSize: 22,
  },
  checklistName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  checklistNameDisabled: {
    color: '#9ca3af',
  },
  countInput: {
    borderWidth: 1,
    borderColor: '#4f46e5',
    borderRadius: 8,
    padding: 6,
    width: 60,
    fontSize: 15,
    fontWeight: '700',
    color: '#4f46e5',
    textAlign: 'center',
    backgroundColor: '#f5f3ff',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  emptyHint: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    color: '#6b7280',
    fontSize: 14,
  },
  summaryValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 4,
    paddingTop: 8,
  },
  totalLabel: {
    fontWeight: '700',
    fontSize: 16,
    color: '#111827',
  },
  totalValue: {
    fontWeight: '800',
    fontSize: 16,
    color: '#4f46e5',
  },
  printBtn: {
    backgroundColor: '#4f46e5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  printBtnDisabled: {
    backgroundColor: '#a5b4fc',
  },
  printBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  shareRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  shareBtn: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  shareBtnText: {
    color: '#4f46e5',
    fontWeight: '700',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  copiesModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 12,
  },
  copiesLabel: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  copiesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 20,
  },
  copiesInput: {
    borderWidth: 2,
    borderColor: '#4f46e5',
    borderRadius: 12,
    padding: 10,
    width: 80,
    fontSize: 24,
    fontWeight: '800',
    color: '#4f46e5',
  },
  searchInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    color: '#111827',
  },
  schoolItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  schoolItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  schoolItemUdise: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  schoolItemAddress: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 1,
  },
  closeModalBtn: {
    backgroundColor: '#f3f4f6',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  closeModalText: {
    color: '#6b7280',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cancelBtnText: {
    color: '#6b7280',
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#4f46e5',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});