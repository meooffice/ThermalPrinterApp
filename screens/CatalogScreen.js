// screens/CatalogScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import CatalogService from '../services/CatalogService';
import { Colors, Radius, Spacing, Shadow } from '../constants/Theme';

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
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.itemIcon}>
          <Text style={{ fontSize: 20 }}>📦</Text>
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <View style={styles.itemMeta}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
            {item.barcode ? (
              <Text style={styles.barcodeText}>📷 {item.barcode}</Text>
            ) : null}
          </View>
        </View>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
          <Text style={{ fontSize: 15 }}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
          <Text style={{ fontSize: 15 }}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>‹ Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.headerSub}>{items.length} items available</Text>
        <Text style={styles.headerTitle}>Item Catalog</Text>

        {/* Search */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search items..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={Colors.textHint}
          />
        </View>

        {/* List */}
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 52, marginBottom: 12 }}>📦</Text>
            <Text style={styles.emptyTitle}>No items yet</Text>
            <Text style={styles.emptyHint}>+ Add button తో items add చేయండి</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}

        {/* Add/Edit Modal */}
        <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editItem ? '✏️ Edit Item' : '📦 Add Item'}</Text>

              <Text style={styles.label}>Item Name *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={v => setForm({ ...form, name: v })}
                placeholder="e.g. Note Books"
                placeholderTextColor={Colors.textHint}
              />

              <Text style={styles.label}>Category</Text>
              <TextInput
                style={styles.input}
                value={form.category}
                onChangeText={v => setForm({ ...form, category: v })}
                placeholder="e.g. Stationery, Books"
                placeholderTextColor={Colors.textHint}
              />

              <Text style={styles.label}>Barcode (optional)</Text>
              <View style={styles.barcodeRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={form.barcode}
                  onChangeText={v => setForm({ ...form, barcode: v })}
                  placeholder="Scan or type barcode"
                  placeholderTextColor={Colors.textHint}
                />
                <TouchableOpacity style={styles.scanBtn} onPress={handleScan}>
                  <Text style={{ fontSize: 20 }}>📷</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>{editItem ? 'Update' : 'Add Item'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Barcode Scanner */}
        <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
          <View style={styles.scannerContainer}>
            <Text style={styles.scannerTitle}>📷 Scan Barcode</Text>
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={({ data }) => { setScanning(false); setForm(prev => ({ ...prev, barcode: data })); }}
              barcodeScannerSettings={{ barcodeTypes: ['ean13','ean8','upc_a','code39','code128','qr'] }}
            />
            <TouchableOpacity style={styles.cancelScanBtn} onPress={() => setScanning(false)}>
              <Text style={styles.cancelScanText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bgPage },
  container: { flex: 1, padding: Spacing.xl, paddingTop: 52 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  backBtn:     { paddingVertical: 8, paddingRight: 16 },
  backBtnText: { fontSize: 16, color: Colors.primary, fontWeight: '600' },
  addBtn:      { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.md },
  addBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  headerSub:   { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.primaryDark, marginBottom: Spacing.lg },

  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgCard, borderRadius: Radius.lg, paddingHorizontal: 12, marginBottom: 12, borderWidth: 0.5, borderColor: Colors.border },
  searchIcon:  { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: Colors.textPrimary },

  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border, ...Shadow.card },
  cardLeft:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemIcon:    { width: 44, height: 44, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  itemInfo:    { flex: 1 },
  itemName:    { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  itemMeta:    { flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center' },
  categoryBadge: { backgroundColor: Colors.bgPage, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  categoryText:  { fontSize: 11, color: Colors.textSecondary },
  barcodeText:   { fontSize: 11, color: Colors.textHint },
  itemActions:   { flexDirection: 'row', gap: 6 },
  editBtn:    { backgroundColor: Colors.primaryLight, padding: 8, borderRadius: Radius.sm },
  deleteBtn:  { backgroundColor: Colors.danger, padding: 8, borderRadius: Radius.sm },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  emptyHint:  { fontSize: 13, color: Colors.textHint },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: 20, paddingBottom: 36 },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: Colors.primaryDark, marginBottom: 16 },
  label:        { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  input:        { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: Radius.md, padding: 10, fontSize: 14, color: Colors.textPrimary, marginBottom: 12, backgroundColor: Colors.bgPage },
  barcodeRow:   { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },
  scanBtn:      { backgroundColor: Colors.primaryLight, padding: 10, borderRadius: Radius.md },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn:    { flex: 1, padding: 14, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight },
  cancelBtnText:{ color: Colors.textSecondary, fontWeight: '600' },
  saveBtn:      { flex: 1, backgroundColor: Colors.primary, padding: 14, borderRadius: Radius.md, alignItems: 'center' },
  saveBtnText:  { color: '#fff', fontWeight: '700' },

  scannerContainer: { flex: 1, backgroundColor: '#000' },
  scannerTitle:     { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', paddingTop: 60, paddingBottom: 20 },
  camera:           { flex: 1 },
  cancelScanBtn:    { backgroundColor: Colors.dangerDot, padding: 16, margin: 20, borderRadius: Radius.lg, alignItems: 'center' },
  cancelScanText:   { color: '#fff', fontWeight: '700', fontSize: 16 },
});