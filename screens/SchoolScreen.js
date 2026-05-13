// screens/SchoolScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import SchoolService from '../services/SchoolService';
import { Colors, Radius, Spacing, Typography } from '../constants/Theme'; 
import { ScreenHeader, Card } from '../components/ui';

const EMPTY_FORM = { name: '', udise: '', address: '' };

export default function SchoolScreen({ navigation }) {
  const [schools, setSchools]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modalVisible, setModal]    = useState(false);
  const [editSchool, setEditSchool] = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [search, setSearch]         = useState('');

  useFocusEffect(useCallback(() => { loadSchools(); }, []));

  const loadSchools = async () => {
    setLoading(true);
    setSchools(await SchoolService.getAll());
    setLoading(false);
  };

  const openAdd  = () => { setEditSchool(null); setForm(EMPTY_FORM); setModal(true); };
  const openEdit = (s) => { setEditSchool(s); setForm({ name: s.name, udise: s.udise, address: s.address }); setModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Validation', 'School name required.'); return; }
    editSchool ? await SchoolService.update(editSchool.id, form) : await SchoolService.add(form);
    setModal(false);
    loadSchools();
  };

  const handleDelete = (id) => {
    Alert.alert('Delete', 'School delete చేయాలా?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await SchoolService.delete(id); loadSchools(); } },
    ]);
  };

  const filtered = schools.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.udise.includes(search)
  );

  const renderSchool = ({ item }) => (
    // ui.js → Card
    <Card style={styles.schoolCard}>
      <View style={styles.cardLeft}>
        <View style={styles.schoolIcon}>
          <Text style={{ fontSize: 22 }}>🏫</Text>
        </View>
        <View style={styles.schoolInfo}>
          <Text style={styles.schoolName}>{item.name}</Text>
          {item.udise ? (
            <View style={styles.udiseBadge}>
              <Text style={styles.udiseText}>📋 UDISE: {item.udise}</Text>
            </View>
          ) : null}
          {item.address ? <Text style={styles.addressText}>📍 {item.address}</Text> : null}
          <Text style={styles.itemCount}>📦 {item.items?.length || 0} kit items saved</Text>
        </View>
      </View>
      <View style={styles.cardActions}>
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
        <ScreenHeader title="Schools" subtitle="Manage school list" />
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
        title="Schools"
        subtitle={`${schools.length} schools registered`}
      />

      <View style={styles.container}>

        {/* Top action row */}
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>‹  Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Text style={styles.addBtnIcon}>＋</Text>
            <Text style={styles.addBtnText}>Add School</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or UDISE..."
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
            <Text style={styles.emptyEmoji}>🏫</Text>
            <Text style={styles.emptyTitle}>No schools yet</Text>
            <Text style={styles.emptyHint}>+ Add School button తో schools add చేయండి</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={renderSchool}
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
              {editSchool ? '✏️  Edit School' : '🏫  Add School'}
            </Text>

            <Text style={styles.inputLabel}>School Name *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={v => setForm({ ...form, name: v })}
              placeholder="e.g. ZP High School Rajanagaram"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.inputLabel}>UDISE Code</Text>
            <TextInput
              style={styles.input}
              value={form.udise}
              onChangeText={v => setForm({ ...form, udise: v })}
              placeholder="e.g. 36XXXXXXXXXX"
              keyboardType="numeric"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.inputLabel}>Address</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={form.address}
              onChangeText={v => setForm({ ...form, address: v })}
              placeholder="Village, Mandal, District"
              multiline
              placeholderTextColor={Colors.textMuted}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>{editSchool ? '✅  Update' : '➕  Add School'}</Text>
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

  // School card
  schoolCard:   { marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'flex-start' },
  cardLeft:     { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  schoolIcon:   { width: 44, height: 44, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  schoolInfo:   { flex: 1, gap: 4 },
  schoolName:   { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  udiseBadge:   { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm, alignSelf: 'flex-start' },
  udiseText:    { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  addressText:  { fontSize: 11, color: Colors.textMuted },
  itemCount:    { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  cardActions:  { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  editBtn:      { backgroundColor: Colors.primaryLight, padding: Spacing.sm, borderRadius: Radius.sm },
  deleteBtn:    { backgroundColor: Colors.dangerBg, padding: Spacing.sm, borderRadius: Radius.sm },

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
  inputMultiline:{ height: 72, textAlignVertical: 'top' },
  modalActions:  { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn:     { flex: 1, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  saveBtn:       { flex: 1, backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  saveBtnText:   { color: Colors.primaryText, fontWeight: '700' },
});