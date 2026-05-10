// screens/SchoolScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import SchoolService from '../services/SchoolService';

const EMPTY_FORM = { name: '', udise: '', address: '' };

export default function SchoolScreen() {
  const [schools, setSchools]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modalVisible, setModal]    = useState(false);
  const [editSchool, setEditSchool] = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [search, setSearch]         = useState('');

  useFocusEffect(
    useCallback(() => { loadSchools(); }, [])
  );

  const loadSchools = async () => {
    setLoading(true);
    const all = await SchoolService.getAll();
    setSchools(all);
    setLoading(false);
  };

  const openAdd = () => {
    setEditSchool(null);
    setForm(EMPTY_FORM);
    setModal(true);
  };

  const openEdit = (school) => {
    setEditSchool(school);
    setForm({ name: school.name, udise: school.udise, address: school.address });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Validation', 'School name is required.');
      return;
    }
    if (editSchool) {
      await SchoolService.update(editSchool.id, form);
    } else {
      await SchoolService.add(form);
    }
    setModal(false);
    loadSchools();
  };

  const handleDelete = (id) => {
    Alert.alert(
      'Delete School',
      'Remove this school and its item list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await SchoolService.delete(id);
            loadSchools();
          },
        },
      ]
    );
  };

  const filtered = schools.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.udise.includes(search)
  );

  const renderSchool = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.schoolName}>{item.name}</Text>
        {item.udise ? (
          <Text style={styles.udise}>UDISE: {item.udise}</Text>
        ) : null}
        {item.address ? (
          <Text style={styles.address}>{item.address}</Text>
        ) : null}
        <Text style={styles.itemCount}>
          {item.items?.length || 0} item(s) in kit
        </Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => openEdit(item)}
        >
          <Text style={styles.editBtnText}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item.id)}
        >
          <Text style={styles.deleteBtnText}>🗑️</Text>
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
        <Text style={styles.headerTitle}>🏫 Schools</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="🔍  Search by name or UDISE..."
        value={search}
        onChangeText={setSearch}
      />

      {filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🏫</Text>
          <Text style={styles.emptyText}>No schools yet</Text>
          <Text style={styles.emptyHint}>Tap + Add to add your first school</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderSchool}
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
              {editSchool ? 'Edit School' : 'Add School'}
            </Text>

            <Text style={styles.label}>School Name *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={v => setForm({ ...form, name: v })}
              placeholder="e.g. ZP High School Rajanagaram"
            />

            <Text style={styles.label}>UDISE Code</Text>
            <TextInput
              style={styles.input}
              value={form.udise}
              onChangeText={v => setForm({ ...form, udise: v })}
              placeholder="e.g. 36XXXXXXXXXX"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, { height: 64, textAlignVertical: 'top' }]}
              value={form.address}
              onChangeText={v => setForm({ ...form, address: v })}
              placeholder="Village, Mandal, District"
              multiline
            />

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
                  {editSchool ? 'Update' : 'Add School'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
  },
  cardInfo: { flex: 1 },
  schoolName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  udise: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  address: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 2,
  },
  itemCount: {
    fontSize: 12,
    color: '#4f46e5',
    fontWeight: '600',
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  editBtn: {
    backgroundColor: '#ede9fe',
    padding: 8,
    borderRadius: 8,
  },
  editBtnText: { fontSize: 14 },
  deleteBtn: {
    backgroundColor: '#fee2e2',
    padding: 8,
    borderRadius: 8,
  },
  deleteBtnText: { fontSize: 14 },
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
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  emptyHint: { fontSize: 14, color: '#9ca3af' },
});