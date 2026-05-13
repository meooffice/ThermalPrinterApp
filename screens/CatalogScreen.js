// screens/CatalogScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import CatalogService from '../services/CatalogService';
import { Colors, Radius, Spacing, Typography } from '../constants/Theme'; 
import { ScreenHeader, Card } from '../components/ui';

const EMPTY_FORM = { name: '', category: 'General', barcode: '' };

export default function CatalogScreen({ navigation }) {
  const [items, setItems]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [modalVisible, setModal]        = useState(false);
  const [editItem, setEditItem]         = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [scanning, setScanning]         = useState(false);
  const [search, setSearch]             = useState('');
  const [permission, requestPermission] = useCameraPermissions();

  useFocusEffect(useCallback(() => { loadItems(); }, []));

  const loadItems = async () => {
    setLoading(true);
    setItems(await CatalogService.getAll());
    setLoading(false);
  };

  const openAdd  = () => { setEditItem(null); setForm(EMPTY_FORM); setModal(true); };
  const openEdit = (item) => {
    setEditItem(item);
    setForm({ name: item.name, category: item.category || 'General', barcode: item.barcode || '' });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Validation', 'Item name required.'); return; }
    editItem ? await CatalogService.updateItem(editItem.id, form) : await CatalogService.addItem(form);
    setModal(false);
    loadItems();
  };

  const handleDelete = (id) => {
    Alert.alert('Delete', 'Item delete చేయాలా?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await CatalogService.deleteItem(id); loadItems(); } },
    ]);
  };

  const handleScan = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) { Alert.alert('Permission', 'Camera permission required.'); return; }
    }
    setScanning(true);
  };

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.barcode && i.barcode.includes(search))
  );

  const renderItem = ({ item }) => (
    // ui.js → Card
    <Card style={styles.itemCard}>
      <View style={styles.cardLeft}>
        <View style={styles.itemIcon}>
          <Text style={{ fontSize: 22 }}>📦</Text>
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <View style={styles.itemMeta}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>🏷️ {item.category}</Text>
            </View>
            {item.barcode ? (
              <Text style={styles.barcodeText}>📷 {item.barcode}</Text>
            ) : null}
          </View>
        </View>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
          <Text style={{ fontSize: 16 }}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
          <Text style={{ fontSize: 16 }}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Item Catalog" subtitle="Manage kit items" />
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
        title="Item Catalog"
        subtitle={`${items.length} items available`}
      />

      <View style={styles.container}>

        {/* Top action row */}
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>‹  Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Text style={styles.addBtnIcon}>＋</Text>
            <Text style={styles.addBtnText}>Add Item</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search items or barcode..."
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

        {/* List */}
        {filtered.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>No items yet</Text>
            <Text style={styles.emptyHint}>+ Add Item button తో items add చేయండి</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Spacing.xl }}
          />
        )}
      </View>

      {/* ── Add/Edit Modal ── */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editItem ? '✏️  Edit Item' : '📦  Add Item'}
            </Text>

            <Text style={styles.inputLabel}>Item Name *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={v => setForm({ ...form, name: v })}
              placeholder="e.g. Note Books"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.inputLabel}>Category</Text>
            <TextInput
              style={styles.input}
              value={form.category}
              onChangeText={v => setForm({ ...form, category: v })}
              placeholder="e.g. Stationery, Books"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.inputLabel}>Barcode (optional)</Text>
            <View style={styles.barcodeRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={form.barcode}
                onChangeText={v => setForm({ ...form, barcode: v })}
                placeholder="Scan or type barcode"
                placeholderTextColor={Colors.textMuted}
              />
              <TouchableOpacity style={styles.scanBtn} onPress={handleScan}>
                <Text style={{ fontSize: 22 }}>📷</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>{editItem ? '✅  Update' : '➕  Add Item'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Barcode Scanner Modal ── */}
      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>📷  Scan Barcode</Text>
            <Text style={styles.scannerHint}>Barcode camera కి చూపించండి</Text>
          </View>
          <CameraView
            style={styles.camera}
            facing="back"
            onBarcodeScanned={({ data }) => {
              setScanning(false);
              setForm(prev => ({ ...prev, barcode: data }));
            }}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'code39', 'code128', 'qr'] }}
          />
          <TouchableOpacity style={styles.cancelScanBtn} onPress={() => setScanning(false)}>
            <Text style={styles.cancelScanText}>✕  Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingHorizontal: Spacing.lg },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md },
  backBtn:     { flexDirection: 'row', alignItems: 'center' },
  backBtnText: { fontSize: 16, color: Colors.primary, fontWeight: '600' },
  addBtn:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.lg },
  addBtnIcon:  { fontSize: 14, color: Colors.primaryText, fontWeight: '700' },
  addBtnText:  { color: Colors.primaryText, fontWeight: '700', fontSize: 13 },

  // Search
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    gap: Spacing.sm,
  },
  searchIcon:  { fontSize: 16 },
  searchInput: { flex: 1, paddingVertical: Spacing.md, fontSize: 14, color: Colors.textPrimary },

  // Item card
  itemCard:    { marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center' },
  cardLeft:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemIcon:    { width: 44, height: 44, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  itemInfo:    { flex: 1 },
  itemName:    { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  itemMeta:    { flexDirection: 'row', gap: Spacing.sm, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' },
  categoryBadge: { backgroundColor: Colors.background, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
  categoryText:  { fontSize: 11, color: Colors.textSecondary },
  barcodeText:   { fontSize: 11, color: Colors.textMuted },
  itemActions:   { flexDirection: 'row', gap: Spacing.xs },
  editBtn:       { backgroundColor: Colors.primaryLight, padding: Spacing.sm, borderRadius: Radius.sm },
  deleteBtn:     { backgroundColor: Colors.dangerBg, padding: Spacing.sm, borderRadius: Radius.sm },

  // Empty
  emptyEmoji: { fontSize: 52, marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.xs },
  emptyHint:  { ...Typography.bodySm, textAlign: 'center' },

  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent:  { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: 36 },
  modalTitle:    { fontSize: 20, fontWeight: '800', color: Colors.primaryDark, marginBottom: Spacing.md },
  inputLabel:    { ...Typography.label, marginBottom: Spacing.xs, marginTop: Spacing.xs },
  input:         { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: Radius.md, padding: Spacing.sm, fontSize: 14, color: Colors.textPrimary, marginBottom: Spacing.sm, backgroundColor: Colors.background },
  barcodeRow:    { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginBottom: Spacing.sm },
  scanBtn:       { backgroundColor: Colors.primaryLight, padding: Spacing.sm, borderRadius: Radius.md },
  modalActions:  { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn:     { flex: 1, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  saveBtn:       { flex: 1, backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  saveBtnText:   { color: Colors.primaryText, fontWeight: '700' },

  // Scanner
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  scannerHeader:    { paddingTop: 60, paddingBottom: Spacing.lg, alignItems: 'center' },
  scannerTitle:     { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: Spacing.xs },
  scannerHint:      { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  camera:           { flex: 1 },
  cancelScanBtn:    { backgroundColor: Colors.danger, padding: Spacing.md, margin: Spacing.lg, borderRadius: Radius.lg, alignItems: 'center' },
  cancelScanText:   { color: '#fff', fontWeight: '700', fontSize: 16 },
});