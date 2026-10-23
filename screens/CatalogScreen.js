// screens/CatalogScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { read, utils } from 'xlsx';
import CatalogService from '../services/CatalogService';
import ItemTypeService from '../services/ItemTypeService';
import TemplateService from '../services/TemplateService';
import { buildItemData, SUBTYPES, SUBTYPE_LABEL, effectiveClasses, formatSizes, parseSizes, parseCsvRows, rowsToItems } from '../services/ItemModel';
import { Colors, Radius, Spacing, Typography } from '../constants/Theme';
import useFieldScroll from '../components/useFieldScroll';
import { Card } from '../components/ui';
import Hero from '../components/Hero';
import { itemIconName } from '../components/itemIcon';

const EMPTY_FORM = {
  name: '', category: 'Others', barcode: '',
  code: '', subType: 'Common', classFrom: '', classTo: '', semester: '',
  sizesText: '', useNorms: false, norms: {},
};

// ─────────────────────────────────────────────────────────────────────────────

// Small icon + text row (display only)
function IconText({ icon, size = 12, color = Colors.textMuted, style, children }) {
  return (
    <View style={styles.iconText}>
      <MaterialCommunityIcons name={icon} size={size} color={color} />
      <Text style={[style, { flexShrink: 1 }]}>{children}</Text>
    </View>
  );
}

export default function CatalogScreen({ navigation }) {
  const fsForm = useFieldScroll(); // keyboard auto-scroll of the focused field
  const insets = useSafeAreaInsets(); // keep sheet buttons above the Android navigation bar
  const [items, setItems]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [modalVisible, setModal]        = useState(false);
  const [editItem, setEditItem]         = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [scanning, setScanning]         = useState(false);
  const [search, setSearch]             = useState('');
  const [catDropdown, setCatDropdown]   = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Upload state
  const [uploading, setUploading]       = useState(false);
  const [previewRows, setPreviewRows]   = useState(null);
  const [previewModal, setPreviewModal] = useState(false);

  // Item Types state
  const [types, setTypes]           = useState([]);
  const [typesModal, setTypesModal] = useState(false);
  const [newType, setNewType]       = useState('');
  const [typeBusy, setTypeBusy]     = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);

  useFocusEffect(useCallback(() => { loadItems(); }, []));

  const loadItems = async () => {
    setLoading(true);
    setItems(await CatalogService.getAll());
    setTypes(await ItemTypeService.getAll());
    setLoading(false);
  };

  const openAdd  = () => { setEditItem(null); setForm(EMPTY_FORM); setCatDropdown(false); setModal(true); };
  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      name: item.name, category: item.category || 'Others', barcode: item.barcode || '',
      code: item.code || '', subType: item.subType || 'Common',
      classFrom: item.classFrom ? String(item.classFrom) : '',
      classTo:   item.classTo   ? String(item.classTo)   : '',
      semester:  item.semester  ? String(item.semester)  : '',
      sizesText: formatSizes(item.sizes),
      useNorms:  !!item.perStudent && Object.keys(item.perStudent).length > 0,
      norms:     Object.fromEntries(Object.entries(item.perStudent || {}).map(([k, v]) => [k, String(v)])),
    });
    setCatDropdown(false);
    setModal(true);
  };

  const handleSave = async () => {
    const built = buildItemData(form, items, editItem?.id);
    if (built.error) { Alert.alert('Validation', built.error); return; }
    editItem
      ? await CatalogService.updateItem(editItem.id, built.data)
      : await CatalogService.addItem(built.data);
    setModal(false);
    loadItems();
  };

  const handleDelete = (id) => {
    Alert.alert('Delete', 'Item delete చేయాలా?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive',
        onPress: async () => { await CatalogService.deleteItem(id); loadItems(); } },
    ]);
  };

  const handleTemplate = async () => {
    try {
      setTemplateBusy(true);
      await TemplateService.shareItemsTemplate();
    } catch (e) {
      Alert.alert('Template', e.message);
    } finally {
      setTemplateBusy(false);
    }
  };

  const handleAddType = async () => {
    try {
      setTypeBusy(true);
      setTypes(await ItemTypeService.add(newType));
      setNewType('');
    } catch (e) {
      Alert.alert('Type', e.message);
    } finally {
      setTypeBusy(false);
    }
  };

  const handleDeleteType = (name) => {
    Alert.alert('Delete', `"${name}" Type delete చేయాలా?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { setTypes(await ItemTypeService.remove(name)); }
          catch (e) { Alert.alert('Delete కాదు', e.message); }
        } },
    ]);
  };

  const handleScan = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) { Alert.alert('Permission', 'Camera permission required.'); return; }
    }
    setScanning(true);
  };

  // ── Bulk Upload ─────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset    = result.assets[0];
      const fileName = asset.name?.toLowerCase() ?? '';
      setUploading(true);

      let rawRows = [];

      if (fileName.endsWith('.csv')) {
        const text = await FileSystem.readAsStringAsync(asset.uri);
        rawRows = parseCsvRows(text);

      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: 'base64',
        });
        const workbook = read(base64, { type: 'base64' });
        const sheetName = workbook.SheetNames.includes('Items') ? 'Items' : workbook.SheetNames[0];
        rawRows = utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

      } else {
        Alert.alert('Unsupported File', 'దయచేసి .csv లేదా .xlsx file select చేయండి.');
        setUploading(false);
        return;
      }

      setUploading(false);

      const rows = rowsToItems(rawRows, types, items);
      if (rows.length === 0) {
        Alert.alert('Empty File', 'File లో valid data లేదు.\nColumns: Code, Name, Type, SubType, ClassFrom, ClassTo, Semester, Sizes, Barcode, N1–N12');
        return;
      }

      setPreviewRows(rows);
      setPreviewModal(true);

    } catch (err) {
      setUploading(false);
      Alert.alert('Error', 'File read చేయడంలో error వచ్చింది.\n' + err.message);
    }
  };

  const confirmUpload = async () => {
    const ok = (previewRows || []).filter(r => r.status !== 'error');
    if (ok.length === 0) return;
    setPreviewModal(false);
    setUploading(true);
    try {
      const { added, updated } = await CatalogService.bulkUpsert(ok.map(r => ({ id: r.id, data: r.data })));
      const skipped = previewRows.length - ok.length;
      await loadItems();
      Alert.alert(
        'Upload Complete',
        `${added} కొత్త items add, ${updated} items update అయ్యాయి.${skipped ? `\n${skipped} rows లో తప్పులు ఉన్నాయి, అవి skip అయ్యాయి.` : ''}`,
      );
    } catch (err) {
      Alert.alert('Import Failed', err.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.code && i.code.toLowerCase().includes(search.toLowerCase())) ||
    (i.barcode && i.barcode.includes(search)),
  );

  // Classes shown in the per-class counts table
  const normClasses = (() => {
    const a = parseInt(form.classFrom, 10), b = parseInt(form.classTo, 10);
    return (a >= 1 && b <= 12 && a <= b) ? effectiveClasses(a, b) : effectiveClasses(null, null);
  })();
  const sizesPreview = parseSizes(form.sizesText);
  const pvNew = (previewRows || []).filter(r => r.status === 'new').length;
  const pvUpd = (previewRows || []).filter(r => r.status === 'update').length;
  const pvErr = (previewRows || []).filter(r => r.status === 'error').length;

  const renderItem = ({ item }) => (
    <Card style={styles.itemCard}>
      <View style={styles.cardLeft}>
        <View style={styles.itemIcon}>
          <MaterialCommunityIcons name={itemIconName(item)} size={24} color={Colors.primary} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <View style={styles.itemMeta}>
            <View style={styles.categoryBadge}>
              <IconText icon="tag-outline" color={Colors.textSecondary} style={styles.categoryText}>{item.category}</IconText>
            </View>
            {item.code ? <IconText icon="bookmark-outline" style={styles.barcodeText}>{item.code}</IconText> : null}
            {item.subType && item.subType !== 'Common' ? (
              <View style={styles.categoryBadge}>
                <IconText icon={item.subType === 'Boys' ? 'human-male' : 'human-female'} color={Colors.textSecondary} style={styles.categoryText}>{item.subType === 'Boys' ? 'Boys' : 'Girls'}</IconText>
              </View>
            ) : null}
            {item.classFrom ? (
              <IconText icon="school-outline" style={styles.barcodeText}>{item.classFrom === item.classTo ? item.classFrom : `${item.classFrom}–${item.classTo}`}</IconText>
            ) : null}
            {item.semester ? <Text style={styles.barcodeText}>SEM{item.semester}</Text> : null}
            {item.sizes && item.sizes.length > 0 ? <IconText icon="ruler" style={styles.barcodeText}>{item.sizes.length} sizes</IconText> : null}
            {item.barcode ? <IconText icon="barcode" style={styles.barcodeText}>{item.barcode}</IconText> : null}
          </View>
        </View>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
          <MaterialCommunityIcons name="pencil-outline" size={18} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
          <MaterialCommunityIcons name="trash-can-outline" size={18} color={Colors.danger} />
        </TouchableOpacity>
      </View>
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <Hero title="Item Catalog" subtitle="Manage kit items" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Hero title="Item Catalog" subtitle="Manage kit items" info={`${items.length} items available`} />

      <View style={styles.container}>

        {/* Top action row */}
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>‹  Back</Text>
          </TouchableOpacity>
          <View style={styles.topActions}>
            {/* Upload button */}
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={handleUpload}
              disabled={uploading}
            >
              {uploading
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : (
                  <>
                    <MaterialCommunityIcons name="folder-upload-outline" size={16} color={Colors.primary} />
                    <Text style={styles.uploadBtnText}>Upload</Text>
                  </>
                )
              }
            </TouchableOpacity>
            {/* Add button */}
            <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
              <MaterialCommunityIcons name="plus" size={16} color={Colors.primaryText} />
              <Text style={styles.addBtnText}>Add Item</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Format hint */}
        <Text style={styles.uploadHint}>
          CSV / Excel upload · Columns: Code, Name, Type, SubType, ClassFrom, ClassTo, Semester, Sizes, Barcode, N1–N12
        </Text>
        <TouchableOpacity style={styles.typesLink} onPress={handleTemplate} disabled={templateBusy}>
          {templateBusy
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : (
              <>
                <MaterialCommunityIcons name="file-download-outline" size={16} color={Colors.primary} />
                <Text style={styles.typesLinkText}>Excel Template Download</Text>
              </>
            )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.typesLink} onPress={() => setTypesModal(true)}>
          <MaterialCommunityIcons name="tag-multiple-outline" size={16} color={Colors.primary} />
          <Text style={styles.typesLinkText}>Item Types నిర్వహించు ({types.length})</Text>
        </TouchableOpacity>

        {/* Search */}
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items or barcode..."
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

        {/* List */}
        {filtered.length === 0 ? (
          <View style={styles.centered}>
            <MaterialCommunityIcons name="package-variant-closed" size={52} color={Colors.accent} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No items yet</Text>
            <Text style={styles.emptyHint}>+ Add Item లేదా Upload తో add చేయండి</Text>
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

      {/* ── Add/Edit Modal ────────────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModal(false)}
      >
        <View style={styles.modalKAV}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => { setCatDropdown(false); setModal(false); }}
          />
          <View style={[styles.modalSheet, styles.modalSheetTall, { paddingBottom: Spacing.lg + insets.bottom }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <MaterialCommunityIcons name={editItem ? 'pencil-outline' : 'package-variant-closed'} size={22} color={Colors.primaryDark} />
              <Text style={styles.modalTitle}>{editItem ? 'Edit Item' : 'Add Item'}</Text>
            </View>

            <ScrollView ref={fsForm.ref} contentContainerStyle={fsForm.padStyle} style={styles.sheetScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Item Name *</Text>
              <TextInput onFocus={fsForm.onFocus}
                style={styles.input}
                value={form.name}
                onChangeText={v => setForm({ ...form, name: v })}
                placeholder="e.g. Note Books"
                placeholderTextColor={Colors.textMuted}
                returnKeyType="next"
              />

              {/* Category Dropdown */}
              <Text style={styles.inputLabel}>Category</Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setCatDropdown(prev => !prev)}
                activeOpacity={0.8}
              >
                <View style={styles.dropdownLeft}>
                  <MaterialCommunityIcons name="tag-outline" size={16} color={Colors.primary} />
                  <Text style={styles.dropdownValue}>{form.category}</Text>
                </View>
                <MaterialCommunityIcons name={catDropdown ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.primary} />
              </TouchableOpacity>

              {catDropdown && (
                <View style={styles.dropdownList}>
                  {types.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.dropdownOption,
                        form.category === cat && styles.dropdownOptionActive,
                      ]}
                      onPress={() => { setForm({ ...form, category: cat }); setCatDropdown(false); }}
                    >
                      <Text style={[
                        styles.dropdownOptionText,
                        form.category === cat && styles.dropdownOptionTextActive,
                      ]}>
                        {form.category === cat ? '✓  ' : '      '}{cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.inputLabel}>Code (optional, unique)</Text>
              <TextInput onFocus={fsForm.onFocus}
                style={styles.input}
                value={form.code}
                onChangeText={v => setForm({ ...form, code: v })}
                placeholder="e.g. 1-TELTB-SEM1"
                autoCapitalize="characters"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.inputLabel}>ఎవరికి</Text>
              <View style={styles.subRow}>
                {SUBTYPES.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.subPill, form.subType === s && styles.subPillActive]}
                    onPress={() => setForm({ ...form, subType: s })}
                  >
                    <Text style={[styles.subPillText, form.subType === s && styles.subPillTextActive]}>
                      {SUBTYPE_LABEL[s]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>తరగతి From – To (ఖాళీ = school లోని అన్ని తరగతులు)</Text>
              <View style={styles.barcodeRow}>
                <TextInput onFocus={fsForm.onFocus}
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={form.classFrom}
                  onChangeText={v => setForm({ ...form, classFrom: v.replace(/[^0-9]/g, '') })}
                  placeholder="From (1-12)"
                  keyboardType="numeric"
                  maxLength={2}
                  placeholderTextColor={Colors.textMuted}
                />
                <Text style={styles.rangeDash}>–</Text>
                <TextInput onFocus={fsForm.onFocus}
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={form.classTo}
                  onChangeText={v => setForm({ ...form, classTo: v.replace(/[^0-9]/g, '') })}
                  placeholder="To (1-12)"
                  keyboardType="numeric"
                  maxLength={2}
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <Text style={styles.inputLabel}>Semester (optional, 1-4)</Text>
              <TextInput onFocus={fsForm.onFocus}
                style={styles.input}
                value={form.semester}
                onChangeText={v => setForm({ ...form, semester: v.replace(/[^0-9]/g, '') })}
                placeholder="e.g. 1"
                keyboardType="numeric"
                maxLength={1}
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.inputLabel}>Sizes (optional)</Text>
              <TextInput onFocus={fsForm.onFocus}
                style={[styles.input, { marginBottom: Spacing.xs }]}
                value={form.sizesText}
                onChangeText={v => setForm({ ...form, sizesText: v })}
                placeholder="S,M,L  లేదా  15-32"
                autoCapitalize="characters"
                placeholderTextColor={Colors.textMuted}
              />
              {form.sizesText.trim() ? (
                <Text style={[styles.sizesInfo, sizesPreview.error && { color: Colors.danger }]}>
                  {sizesPreview.error ? sizesPreview.error : `${sizesPreview.list.length} sizes: ${sizesPreview.list.join(', ')}`}
                </Text>
              ) : null}

              <TouchableOpacity
                style={styles.normToggle}
                onPress={() => setForm({ ...form, useNorms: !form.useNorms })}
                activeOpacity={0.8}
              >
                <View style={[styles.normBox, form.useNorms && styles.normBoxActive]}>
                  {form.useNorms ? <Text style={styles.normTick}>✓</Text> : null}
                </View>
                <Text style={styles.normToggleText}>తరగతి వారీ సంఖ్య (ప్రతి విద్యార్థికి)</Text>
              </TouchableOpacity>
              {form.useNorms && (
                <View style={styles.normPanel}>
                  <Text style={styles.normHint}>ఖాళీ = 1 · 0 = ఇవ్వరు</Text>
                  <View style={styles.normGrid}>
                    {normClasses.map(cl => (
                      <View key={cl} style={styles.normCell}>
                        <Text style={styles.normClass}>తరగతి {cl}</Text>
                        <TextInput onFocus={fsForm.onFocus}
                          style={styles.normInput}
                          value={String((form.norms || {})[cl] ?? '')}
                          onChangeText={v => setForm({ ...form, norms: { ...form.norms, [cl]: v.replace(/[^0-9]/g, '') } })}
                          keyboardType="numeric"
                          maxLength={2}
                          placeholder="1"
                          placeholderTextColor={Colors.textMuted}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <Text style={styles.inputLabel}>Barcode (optional)</Text>
              <View style={styles.barcodeRow}>
                <TextInput onFocus={fsForm.onFocus}
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={form.barcode}
                  onChangeText={v => setForm({ ...form, barcode: v })}
                  placeholder="Scan or type barcode"
                  placeholderTextColor={Colors.textMuted}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.scanBtn} onPress={handleScan}>
                  <MaterialCommunityIcons name="barcode-scan" size={24} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </ScrollView>

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

      {/* ── Item Types Modal ──────────────────────────────────────────────── */}
      <Modal visible={typesModal} animationType="slide" transparent onRequestClose={() => setTypesModal(false)}>
        <KeyboardAvoidingView style={styles.modalKAV} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setTypesModal(false)} />
          <View style={[styles.modalSheet, { height: '70%' }, { paddingBottom: Spacing.lg + insets.bottom }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <MaterialCommunityIcons name="tag-multiple-outline" size={22} color={Colors.primaryDark} />
              <Text style={styles.modalTitle}>Item Types</Text>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, marginBottom: Spacing.sm }}>
              {types.map(t => (
                <View key={t} style={styles.typeRow}>
                  <Text style={styles.typeName}>{t}</Text>
                  {t !== 'Others' && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteType(t)}>
                      <MaterialCommunityIcons name="trash-can-outline" size={18} color={Colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={styles.barcodeRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={newType}
                onChangeText={setNewType}
                placeholder="కొత్త Type పేరు"
                placeholderTextColor={Colors.textMuted}
                returnKeyType="done"
                onSubmitEditing={handleAddType}
              />
              <TouchableOpacity style={styles.scanBtn} onPress={handleAddType} disabled={typeBusy}>
                {typeBusy
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : <Text style={styles.addTypeBtnText}>+ Add</Text>}
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.cancelBtn, { marginTop: Spacing.md }]} onPress={() => setTypesModal(false)}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Barcode Scanner Modal ─────────────────────────────────────────── */}
      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Scan Barcode</Text>
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
            <MaterialCommunityIcons name="close" size={18} color="#fff" />
            <Text style={styles.cancelScanText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Upload Preview Modal ──────────────────────────────────────────── */}
      <Modal
        visible={previewModal}
        animationType="slide"
        transparent
        onRequestClose={() => setPreviewModal(false)}
      >
        <View style={styles.modalKAV}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setPreviewModal(false)}
          />
          <View style={[styles.modalSheet, { height: '80%' }, { paddingBottom: Spacing.lg + insets.bottom }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <MaterialCommunityIcons name="clipboard-list-outline" size={22} color={Colors.primaryDark} />
              <Text style={styles.modalTitle}>Preview — {previewRows?.length} rows</Text>
            </View>
            <Text style={styles.previewHint}>
              దిగువ items మీ catalog లో add / update అవుతాయి. ఎరుపు rows (తప్పులు) skip అవుతాయి.
            </Text>

            <Text style={styles.previewSummary}>
              కొత్తవి {pvNew}  ·  Update {pvUpd}  ·  తప్పులు {pvErr}
            </Text>

            <View style={[styles.modalActions, { marginTop: 0, marginBottom: Spacing.sm }]}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPreviewModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, pvNew + pvUpd === 0 && styles.saveBtnOff]}
                onPress={confirmUpload}
                disabled={pvNew + pvUpd === 0}
              >
                <Text style={styles.saveBtnText}>Confirm Import</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={previewRows}
              keyExtractor={(_, i) => String(i)}
              initialNumToRender={6}
              maxToRenderPerBatch={8}
              windowSize={5}
              showsVerticalScrollIndicator
              style={{ flex: 1, marginBottom: Spacing.md }}
              contentContainerStyle={{ paddingBottom: 120 }}
              renderItem={({ item: row, index: i }) => (
                <View key={i} style={styles.previewRow}>
                  <Text style={styles.previewIndex}>{row.rowNo}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={[
                      styles.badge,
                      { backgroundColor: row.status === 'error' ? Colors.dangerBg : row.status === 'update' ? Colors.primaryLight : Colors.successBg },
                    ]}>
                      <Text style={[
                        styles.badgeText,
                        { color: row.status === 'error' ? Colors.danger : row.status === 'update' ? Colors.primary : Colors.successText },
                      ]}>
                        {row.status === 'error' ? 'ERROR' : row.status === 'update' ? 'UPDATE' : 'NEW'}
                      </Text>
                    </View>
                    <Text style={styles.previewName}>{row.name || '(పేరు లేదు)'}</Text>
                    {row.code ? <IconText icon="bookmark-outline" style={styles.previewMeta}>{row.code}</IconText> : null}
                    {row.status !== 'error' ? (
                      <IconText icon="tag-outline" style={styles.previewMeta}>
                        {row.category} · {row.data.subType}
                        {row.data.classFrom ? ` · తరగతులు ${row.data.classFrom}–${row.data.classTo}` : ''}
                        {row.data.sizes && row.data.sizes.length ? ` · ${row.data.sizes.length} sizes` : ''}
                      </IconText>
                    ) : (
                      <Text style={styles.previewError}>{row.error}</Text>
                    )}
                  </View>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingHorizontal: Spacing.lg },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  topRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md },
  backBtn:    { flexDirection: 'row', alignItems: 'center' },
  backBtnText:{ fontSize: 16, color: Colors.primary, fontWeight: '600' },
  topActions: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },

  uploadBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.lg },
  uploadBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },

  addBtn:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.lg },
  addBtnText: { color: Colors.primaryText, fontWeight: '700', fontSize: 13 },

  uploadHint: { fontSize: 11, color: Colors.textMuted, marginBottom: Spacing.sm },
  iconText:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typesLink:     { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  subRow:        { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  subPill:       { flex: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', backgroundColor: Colors.background },
  subPillActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  subPillText:   { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textAlign: 'center' },
  subPillTextActive: { color: Colors.primary },
  rangeDash:     { fontSize: 18, color: Colors.textMuted },
  sizesInfo:     { fontSize: 11, color: Colors.primary, marginBottom: Spacing.sm },
  normToggle:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.sm },
  normBox:       { width: 22, height: 22, borderRadius: Radius.sm, borderWidth: 2, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  normBoxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  normTick:      { color: Colors.primaryText, fontSize: 12, fontWeight: '700' },
  normToggleText:{ flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  normPanel:     { backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  normHint:      { fontSize: 11, color: Colors.textMuted, marginBottom: Spacing.xs },
  normGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  normCell:      { width: '30%', alignItems: 'center' },
  normClass:     { fontSize: 10, color: Colors.textSecondary, marginBottom: 2 },
  normInput:     { borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.sm, width: '100%', paddingVertical: Spacing.xs, textAlign: 'center', fontSize: 14, fontWeight: '700', color: Colors.primary, backgroundColor: Colors.surface },
  typesLinkText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  typeRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 0.5, borderBottomColor: Colors.cardBorder },
  typeName:      { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  addTypeBtnText:{ color: Colors.primary, fontWeight: '700', fontSize: 13 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 0.5, borderColor: Colors.cardBorder, gap: Spacing.sm,
  },
  searchInput: { flex: 1, paddingVertical: Spacing.md, fontSize: 14, color: Colors.textPrimary },

  itemCard:      { marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center' },
  cardLeft:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemIcon:      { width: 44, height: 44, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  itemInfo:      { flex: 1 },
  itemName:      { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  itemMeta:      { flexDirection: 'row', gap: Spacing.sm, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' },
  categoryBadge: { backgroundColor: Colors.background, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
  categoryText:  { fontSize: 11, color: Colors.textSecondary },
  barcodeText:   { fontSize: 11, color: Colors.textMuted },
  itemActions:   { flexDirection: 'row', gap: Spacing.xs },
  editBtn:       { backgroundColor: Colors.primaryLight, padding: Spacing.sm, borderRadius: Radius.sm },
  deleteBtn:     { backgroundColor: Colors.dangerBg, padding: Spacing.sm, borderRadius: Radius.sm },

  emptyIcon:  { marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.xs },
  emptyHint:  { ...Typography.bodySm, textAlign: 'center' },

  // Modal
  modalKAV:      { flex: 1, justifyContent: 'flex-end' },
  modalSheetTall: { height: '85%' },
  sheetScroll:    { flex: 1 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 36 : Spacing.lg,
    maxHeight: '85%',
  },
  modalHandle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.cardBorder, alignSelf: 'center', marginBottom: Spacing.md },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  modalTitle:    { fontSize: 20, fontWeight: '800', color: Colors.primaryDark },
  inputLabel:    { ...Typography.label, marginBottom: Spacing.xs, marginTop: Spacing.xs },
  input: {
    borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: Radius.md,
    padding: Spacing.sm, fontSize: 14, color: Colors.textPrimary,
    marginBottom: Spacing.sm, backgroundColor: Colors.background,
  },

  // Category Dropdown
  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.md,
    padding: Spacing.sm, marginBottom: Spacing.xs, backgroundColor: Colors.primaryLight,
  },
  dropdownLeft:             { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropdownValue:            { fontSize: 14, fontWeight: '600', color: Colors.primary },
  dropdownList: {
    borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: Radius.md,
    backgroundColor: Colors.surface, marginBottom: Spacing.sm,
    overflow: 'hidden', elevation: 3,
  },
  dropdownOption:           { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: Colors.cardBorder },
  dropdownOptionActive:     { backgroundColor: Colors.primaryLight },
  dropdownOptionText:       { fontSize: 14, color: Colors.textPrimary },
  dropdownOptionTextActive: { color: Colors.primary, fontWeight: '700' },

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
  cancelScanBtn:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: Colors.danger, padding: Spacing.md, margin: Spacing.lg, borderRadius: Radius.lg, alignItems: 'center' },
  cancelScanText:   { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Preview modal
  previewHint:  { fontSize: 12, color: Colors.textMuted, marginBottom: Spacing.sm },
  previewRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 0.5, borderBottomColor: Colors.cardBorder },
  previewIndex: { fontSize: 12, color: Colors.textMuted, width: 24, paddingTop: 2 },
  previewName:  { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  previewMeta:  { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  previewError: { fontSize: 11, color: Colors.danger, marginTop: 2 },
  previewSummary: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm },
  badge:        { paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.sm, alignSelf: 'flex-start', marginBottom: 2 },
  badgeText:    { fontSize: 10, fontWeight: '700' },
  saveBtnOff:   { backgroundColor: '#9DB89F' },
});