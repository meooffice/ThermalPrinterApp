// screens/SchoolScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import SchoolService from '../services/SchoolService';
import { Colors, Radius, Spacing, Shadow } from '../constants/Theme';

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
  const openEdit = (s)  => { setEditSchool(s); setForm({ name: s.name, udise: s.udise, address: s.address }); setModal(true); };

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
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.schoolIcon}>
          <Text style={{ fontSize: 20 }}>🏫</Text>
        </View>
        <View style={styles.schoolInfo}>
          <Text style={styles.schoolName}>{item.name}</Text>
          {item.udise ? (
            <View style={styles.udiseBadge}>
              <Text style={styles.udiseText}>UDISE: {item.udise}</Text>
            </View>
          ) : null}
          {item.address ? (
            <Text style={styles.addressText}>{item.address}</Text>
          ) : null}
          <Text style={styles.itemCount}>
            {item.items?.length || 0} kit items saved
          </Text>
        </View>
      </View>
      <View style={styles.cardActions}>
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

        <Text style={styles.headerSub}>{schools.length} schools registered</Text>
        <Text style={styles.headerTitle}>Schools</Text>

        {/* Search */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or UDISE..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={Colors.textHint}
          />
        </View>

        {/* List */}
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 52, marginBottom: 12 }}>🏫</Text>
            <Text style={styles.emptyTitle}>No schools yet</Text>
            <Text style={styles.emptyHint}>+ Add button తో schools add చేయండి</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={renderSchool}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}

        {/* Add/Edit Modal */}
        <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editSchool ? '✏️ Edit School' : '🏫 Add School'}</Text>

              <Text style={styles.label}>School Name *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={v => setForm({ ...form, name: v })}
                placeholder="e.g. ZP High School Rajanagaram"
                placeholderTextColor={Colors.textHint}
              />

              <Text style={styles.label}>UDISE Code</Text>
              <TextInput
                style={styles.input}
                value={form.udise}
                onChangeText={v => setForm({ ...form, udise: v })}
                placeholder="e.g. 36XXXXXXXXXX"
                keyboardType="numeric"
                placeholderTextColor={Colors.textHint}
              />

              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
                value={form.address}
                onChangeText={v => setForm({ ...form, address: v })}
                placeholder="Village, Mandal, District"
                multiline
                placeholderTextColor={Colors.textHint}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>{editSchool ? 'Update' : 'Add School'}</Text>
                </TouchableOpacity>
              </View>
            </View>
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
  cardLeft:   { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  schoolIcon: { width: 44, height: 44, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  schoolInfo: { flex: 1 },
  schoolName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  udiseBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 4 },
  udiseText:  { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  addressText:{ fontSize: 11, color: Colors.textHint, marginBottom: 4 },
  itemCount:  { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  cardActions:{ flexDirection: 'row', gap: 6, alignItems: 'center' },
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
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn:    { flex: 1, padding: 14, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight },
  cancelBtnText:{ color: Colors.textSecondary, fontWeight: '600' },
  saveBtn:      { flex: 1, backgroundColor: Colors.primary, padding: 14, borderRadius: Radius.md, alignItems: 'center' },
  saveBtnText:  { color: '#fff', fontWeight: '700' },
});