// screens/CatalogScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import CatalogService from '../services/CatalogService';

const EMPTY_FORM = { name: '', category: 'General', barcode: '' };

export default function CatalogScreen() {
  const [items, setItems]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [modalVisible, setModal]        = useState(false);
  const [editItem, setEditItem]         = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [scanning, setScanning]         = useState(false);
  const [search, setSearch]             = useState('');
  const [permission, requestPermission] = useCameraPermissions();

  useFocusEffect(
    useCallback(() => { loadItems(); }, [])
  );

  const loadItems = async () => {
    setLoading(true);
    const all = await CatalogService.getAll();
    setItems(all);
    setLoading(false);
  };

  const openAdd = () => {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      name:     item.name,
      category: item.category || 'General',
      barcode:  item.barcode || '',
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Item name is required.');
      return;
    }
    if (editItem) {
      await CatalogService.updateItem(editItem.id, form);
    } else {
      await CatalogService.addItem(form);
    }
    setModal(false);
    loadItems();
  };

  const handleDelete = (id) => {
    Alert.alert(
      'Delete Item',
      'Remove this item from catalog?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await CatalogService.deleteItem(id);
            loadItems();
          },
        },
      ]
    );
  };

  const handleScan = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permission', 'Camera permission is required.');
        return;
      }
    }
    setScanning(true);
  };

  const handleBarcodeScan = ({ data }) => {
    setScanning(false);
    setForm(prev => ({ ...prev, barcode: data }));
  };

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.barcode && i.barcode.includes(search))
  );

  const renderItem = ({ item }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={styles.itemMeta}>
          <Text style={styles.itemCategory}>{item.category}</Text>
          {item.barcode ? (
            <Text style={styles.itemBarcode}>📦 {item.barcode}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => openEdit(item)}
        >
          <Text>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item.id)}
        >
          <Text>🗑️</Text>
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
    <View style={styles.container}>

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>📦 Item Catalog</Text>
          <Text style={styles.headerSub}>
            {items.length} item(s) available for kit
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="🔍  Search items..."
        value={search}
        onChangeText={setSearch}
      />

      {filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>No items yet</Text>
          <Text style={styles.emptyHint}>
            Tap + Add to create kit items
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editItem ? 'Edit Item' : 'Add Item'}
            </Text>

            <Text style={styles.label}>Item Name *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={v => setForm({ ...form, name: v })}
              placeholder="e.g. Note Books"
            />

            <Text style={styles.label}>Category</Text>
            <TextInput
              style={styles.input}
              value={form.category}
              onChangeText={v => setForm({ ...form, category: v })}
              placeholder="e.g. Stationery, Books"
            />

            <Text style={styles.label}>Barcode (optional)</Text>
            <View style={styles.barcodeRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={form.barcode}
                onChangeText={v => setForm({ ...form, barcode: v })}
                placeholder="Scan or type barcode"
              />
              <TouchableOpacity
                style={styles.scanBtn}
                onPress={handleScan}
              >
                <Text style={styles.scanBtnText}>📷</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
              >
                <Text style={styles.saveBtnText}>
                  {editItem ? 'Update' : 'Add Item'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Barcode Scanner */}
      <Modal
        visible={scanning}
        animationType="slide"
        onRequestClose={() => setScanning(false)}
      >
        <View style={styles.scannerContainer}>
          <Text style={styles.scannerTitle}>📷 Scan Barcode</Text>
          <CameraView
            style={styles.camera}
            facing="back"
            onBarcodeScanned={handleBarcodeScan}
            barcodeScannerSettings={{
              barcodeTypes: [
                'ean13', 'ean8', 'upc_a', 'upc_e',
                'code39', 'code128', 'qr',
              ],
            }}
          />
          <TouchableOpacity
            style={styles.cancelScanBtn}
            onPress={() => setScanning(false)}
          >
            <Text style={styles.cancelScanText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

    </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1f2937',
  },
  headerSub: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    color: '#111827',
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
  },
  itemInfo: { flex: 1 },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  itemMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  itemCategory: {
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemBarcode: {
    fontSize: 12,
    color: '#9ca3af',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 6,
  },
  editBtn: {
    backgroundColor: '#ede9fe',
    padding: 8,
    borderRadius: 8,
  },
  deleteBtn: {
    backgroundColor: '#fee2e2',
    padding: 8,
    borderRadius: 8,
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
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#111827',
    marginBottom: 12,
    backgroundColor: '#f9fafb',
  },
  barcodeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  scanBtn: {
    backgroundColor: '#ede9fe',
    padding: 10,
    borderRadius: 8,
  },
  scanBtnText: { fontSize: 20 },
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
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  camera: { flex: 1 },
  cancelScanBtn: {
    backgroundColor: '#ef4444',
    padding: 16,
    margin: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelScanText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  emptyHint: { fontSize: 14, color: '#9ca3af' },
});