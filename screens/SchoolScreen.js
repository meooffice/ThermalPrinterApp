// screens/SchoolScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { read, utils } from 'xlsx';
import SchoolService from '../services/SchoolService';
import CatalogService from '../services/CatalogService';
import SettingsService from '../services/SettingsService';
import LedgerService from '../services/LedgerService';
import { rollConflicts } from '../services/RequirementModel';
import TemplateService from '../services/TemplateService';
import { parseCsvRows } from '../services/ItemModel';
import { SCHOOL_TYPES, buildSchoolData, rowsToSchools, classRange, rollSummary, parseUdiseEnrolment, udiseToSchools } from '../services/SchoolModel';
import { Colors, Radius, Spacing, Typography } from '../constants/Theme';
import { Card } from '../components/ui';
import Hero from '../components/Hero';

const EMPTY_FORM = { name: '', udise: '', address: '', type: '', minClass: '', maxClass: '', roll: {} };

// ─────────────────────────────────────────────────────────────────────────────

export default function SchoolScreen({ navigation }) {
  const insets = useSafeAreaInsets(); // keep sheet buttons above the Android navigation bar
  const [schools, setSchools]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [modalVisible, setModal]      = useState(false);
  const [editSchool, setEditSchool]   = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [search, setSearch]           = useState('');

  // Upload state
  const [uploading, setUploading]     = useState(false);
  const [previewRows, setPreviewRows] = useState(null);   // rows to confirm
  const [previewModal, setPreviewModal] = useState(false);
  const [udiseNote, setUdiseNote]   = useState(null);   // set when the file is a UDISE+ Enrolment Excel: { ay, ayMismatch, unchanged, missing }
  const [templateBusy, setTemplateBusy] = useState(false);

  useFocusEffect(useCallback(() => { loadSchools(); }, []));

  const loadSchools = async () => {
    setLoading(true);
    setSchools(await SchoolService.getAll());
    setLoading(false);
  };

  const openAdd  = () => { setEditSchool(null); setForm(EMPTY_FORM); setModal(true); };
  const openEdit = (s) => {
    setEditSchool(s);
    setForm({
      name: s.name, udise: s.udise, address: s.address,
      type: s.type || '',
      minClass: s.minClass ? String(s.minClass) : '',
      maxClass: s.maxClass ? String(s.maxClass) : '',
      roll: Object.fromEntries(Object.entries(s.roll || {}).map(([k, v]) => [k, { b: String(v.b ?? ''), g: String(v.g ?? '') }])),
    });
    setModal(true);
  };

  const doSave = async (data) => {
    try {
      editSchool
        ? await SchoolService.update(editSchool.id, data)
        : await SchoolService.add(data);
      setModal(false);
      loadSchools();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleSave = async () => {
    const built = buildSchoolData(form, schools, editSchool?.id);
    if (built.error) { Alert.alert('Validation', built.error); return; }
    if (built.dropped.length > 0) {
      Alert.alert(
        'Roll తొలగిపోతుంది',
        `తరగతి ${built.dropped.join(', ')} Min–Max బయట ఉన్నాయి. వాటి Roll తొలగిపోతుంది. కొనసాగించాలా?`,
        [
          { text: 'వెనక్కి', style: 'cancel' },
          { text: 'కొనసాగించు', style: 'destructive', onPress: () => checkGivenThenSave(built.data) },
        ],
      );
      return;
    }
    await checkGivenThenSave(built.data);
  };

  // Editing a school: warn (but allow) if the new roll is lower than what was already given
  const checkGivenThenSave = async (data) => {
    if (editSchool) {
      try {
        const settings  = await SettingsService.get();
        const [catalog, sum] = await Promise.all([
          CatalogService.getAll(),
          LedgerService.schoolSummary(settings.academicYear, editSchool.id),
        ]);
        const conflicts = rollConflicts(catalog, data, sum.given);
        if (conflicts.length > 0) {
          const lines = conflicts.slice(0, 8)
            .map(c => `• ${c.name}: ఇచ్చినవి ${c.given}, కొత్త roll ప్రకారం అవసరం ${c.required}`).join('\n');
          const more = conflicts.length > 8 ? `\n… +${conflicts.length - 8} మరిన్ని` : '';
          Alert.alert(
            'Roll తగ్గింది',
            `${lines}${more}\n\nఇప్పటికే ఇచ్చినవి కొత్త roll కంటే ఎక్కువ. అయినా save చేయాలా?`,
            [
              { text: 'వెనక్కి', style: 'cancel' },
              { text: 'Save చేయి', onPress: () => doSave(data) },
            ],
          );
          return;
        }
      } catch { /* ledger unreadable: do not block saving the school */ }
    }
    await doSave(data);
  };

  const setRoll = (cl, key, v) =>
    setForm(prev => ({
      ...prev,
      roll: { ...prev.roll, [cl]: { ...(prev.roll?.[cl] || {}), [key]: v.replace(/[^0-9]/g, '') } },
    }));

  const handleTemplate = async () => {
    try {
      setTemplateBusy(true);
      await TemplateService.shareSchoolsTemplate();
    } catch (e) {
      Alert.alert('Template', e.message);
    } finally {
      setTemplateBusy(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete', 'School delete చేయాలా?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive',
        onPress: async () => { await SchoolService.delete(id); loadSchools(); } },
    ]);
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
        // ── CSV ── (UTF-8 default, no encoding param needed)
        const text = await FileSystem.readAsStringAsync(asset.uri);
        rawRows = parseCsvRows(text);

      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // ── Excel ── use plain string 'base64' instead of EncodingType enum
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: 'base64',
        });
        const workbook = read(base64, { type: 'base64' });
        const sheetName = workbook.SheetNames.includes('Schools') ? 'Schools' : workbook.SheetNames[0];
        // UDISE+ "Enrolment Details" Excel (title rows + Class N(Boys)/(Girls) columns) → Roll update
        const parsed = parseUdiseEnrolment(utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' }));
        if (parsed) {
          const result = udiseToSchools(parsed, schools);
          let ayMismatch = null;
          try {
            const st = await SettingsService.get();
            if (parsed.ay && st.academicYear && parsed.ay !== st.academicYear) ayMismatch = st.academicYear;
          } catch { /* settings unreadable: skip the warning */ }
          setUploading(false);
          if (result.rows.length === 0) {
            Alert.alert('మార్పులు లేవు', `UDISE file ప్రకారం అన్ని schools roll ఇప్పటికే సరిపోతున్నాయి.${result.missing ? `\nFile లో లేని schools: ${result.missing}` : ''}`);
            return;
          }
          setUdiseNote({ ay: parsed.ay, ayMismatch, unchanged: result.unchanged, missing: result.missing });
          setPreviewRows(result.rows);
          setPreviewModal(true);
          return;
        }
        rawRows = utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

      } else {
        Alert.alert('Unsupported File', 'దయచేసి .csv లేదా .xlsx file select చేయండి.');
        setUploading(false);
        return;
      }

      setUploading(false);

      const rows = rowsToSchools(rawRows, schools);
      if (rows.length === 0) {
        Alert.alert('Empty File', 'File లో valid data లేదు.\nColumns: UDISE, School Name, Type, Address, MinClass, MaxClass, C1_B, C1_G …');
        return;
      }

      // Show preview before saving
      setUdiseNote(null);
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
    // UDISE roll update: warn if already-given items exceed the new roll requirement (same check as Edit School)
    if (udiseNote) {
      try {
        const settings = await SettingsService.get();
        const catalog  = await CatalogService.getAll();
        const bad = [];
        for (const r of ok.filter(x => x.status === 'update')) {
          const sc = schools.find(x => x.id === r.id);
          if (!sc) continue;
          const sum = await LedgerService.schoolSummary(settings.academicYear, r.id);
          const c = rollConflicts(catalog, { ...sc, ...r.data }, sum.given);
          if (c.length) bad.push(`• ${sc.name}: ${c.slice(0, 2).map(x => `${x.name} (ఇచ్చినవి ${x.given}, అవసరం ${x.required})`).join(', ')}${c.length > 2 ? ` +${c.length - 2}` : ''}`);
        }
        if (bad.length > 0) {
          Alert.alert(
            'Roll తగ్గింది',
            `${bad.slice(0, 8).join('\n')}${bad.length > 8 ? `\n… +${bad.length - 8} schools` : ''}\n\nఇప్పటికే ఇచ్చినవి కొత్త roll కంటే ఎక్కువ. అయినా import చేయాలా?`,
            [
              { text: 'వెనక్కి', style: 'cancel' },
              { text: 'Import చేయి', onPress: () => doImport(ok) },
            ],
          );
          return;
        }
      } catch { /* ledger unreadable: do not block the import */ }
    }
    await doImport(ok);
  };

  const doImport = async (ok) => {
    setPreviewModal(false);
    setUploading(true);
    try {
      const { added, updated } = await SchoolService.bulkUpsert(ok.map(r => ({ id: r.id, data: r.data })));
      const skipped = previewRows.length - ok.length;
      await loadSchools();
      Alert.alert(
        'Upload Complete ✅',
        `${added} కొత్త schools add, ${updated} schools update అయ్యాయి.${skipped ? `\n${skipped} rows లో తప్పులు ఉన్నాయి, అవి skip అయ్యాయి.` : ''}`,
      );
    } catch (err) {
      Alert.alert('❌ Import Failed', err.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const rollClasses = classRange(form.minClass, form.maxClass);
  const formBoys  = rollClasses.reduce((t, cl) => t + (parseInt(form.roll?.[cl]?.b, 10) || 0), 0);
  const formGirls = rollClasses.reduce((t, cl) => t + (parseInt(form.roll?.[cl]?.g, 10) || 0), 0);
  const pvNew = (previewRows || []).filter(r => r.status === 'new').length;
  const pvUpd = (previewRows || []).filter(r => r.status === 'update').length;
  const pvErr = (previewRows || []).filter(r => r.status === 'error').length;

  const filtered = schools.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.udise.includes(search),
  );

  const renderSchool = ({ item }) => (
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
          {item.type || item.minClass ? (
            <Text style={styles.addressText}>
              🏷️ {item.type || '—'}{item.minClass ? `  ·  🎓 తరగతులు ${item.minClass}–${item.maxClass}` : ''}
            </Text>
          ) : null}
          {(() => {
            const r = rollSummary(item);
            return r.total > 0
              ? <Text style={styles.itemCount}>👦 {r.boys} · 👧 {r.girls} · మొత్తం {r.total}</Text>
              : <Text style={styles.rollWarn}>⚠️ Roll నమోదు చేయండి</Text>;
          })()}
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
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <Hero title="Schools" subtitle="Manage school list" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Hero title="Schools" subtitle="Manage school list" info={`${schools.length} schools registered`} />

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
                : <Text style={styles.uploadBtnText}>📂  Upload</Text>
              }
            </TouchableOpacity>
            {/* Add button */}
            <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
              <Text style={styles.addBtnIcon}>＋</Text>
              <Text style={styles.addBtnText}>Add School</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Format hint */}
        <Text style={styles.uploadHint}>
          📄 CSV / Excel upload · Columns: UDISE, School Name, Type, Address, MinClass, MaxClass, C1_B, C1_G … C12_G
          · UDISE+ Enrolment Excel నేరుగా upload చేస్తే Roll update అవుతుంది
        </Text>
        <TouchableOpacity style={styles.tplLink} onPress={handleTemplate} disabled={templateBusy}>
          {templateBusy
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <Text style={styles.tplLinkText}>📥  Excel Template Download</Text>}
        </TouchableOpacity>

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
            <Text style={styles.emptyHint}>+ Add School లేదా 📂 Upload తో add చేయండి</Text>
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

      {/* ── Add / Edit Modal ──────────────────────────────────────────────── */}
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
            onPress={() => setModal(false)}
          />
          <View style={[styles.modalSheet, styles.modalSheetTall, { paddingBottom: Spacing.lg + insets.bottom }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {editSchool ? '✏️  Edit School' : '🏫  Add School'}
            </Text>
            <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>School Name *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={v => setForm({ ...form, name: v })}
                placeholder="e.g. ZP High School Rajanagaram"
                placeholderTextColor={Colors.textMuted}
                returnKeyType="next"
              />
              <Text style={styles.inputLabel}>UDISE Code</Text>
              <TextInput
                style={styles.input}
                value={form.udise}
                onChangeText={v => setForm({ ...form, udise: v })}
                placeholder="e.g. 36XXXXXXXXXX"
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
                returnKeyType="next"
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

              <Text style={styles.inputLabel}>School Type (label)</Text>
              <View style={styles.pillsRow}>
                {SCHOOL_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typePill, form.type === t && styles.typePillActive]}
                    onPress={() => setForm({ ...form, type: form.type === t ? '' : t })}
                  >
                    <Text style={[styles.typePillText, form.type === t && styles.typePillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>తరగతులు Min – Max</Text>
              <View style={styles.rangeRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={form.minClass}
                  onChangeText={v => setForm({ ...form, minClass: v.replace(/[^0-9]/g, '') })}
                  placeholder="Min (1-12)"
                  keyboardType="numeric"
                  maxLength={2}
                  placeholderTextColor={Colors.textMuted}
                />
                <Text style={styles.rangeDash}>–</Text>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={form.maxClass}
                  onChangeText={v => setForm({ ...form, maxClass: v.replace(/[^0-9]/g, '') })}
                  placeholder="Max (1-12)"
                  keyboardType="numeric"
                  maxLength={2}
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <Text style={styles.inputLabel}>తరగతి వారీ Roll</Text>
              {rollClasses.length > 0 ? (
                <View style={styles.rollPanel}>
                  <View style={styles.rollRow}>
                    <Text style={[styles.rollClass, styles.rollHeadText]}>తరగతి</Text>
                    <Text style={[styles.rollHeadCell, styles.rollHeadText]}>👦 Boys</Text>
                    <Text style={[styles.rollHeadCell, styles.rollHeadText]}>👧 Girls</Text>
                  </View>
                  {rollClasses.map(cl => (
                    <View key={cl} style={styles.rollRow}>
                      <Text style={styles.rollClass}>{cl}</Text>
                      <TextInput
                        style={styles.rollInput}
                        value={String(form.roll?.[cl]?.b ?? '')}
                        onChangeText={v => setRoll(cl, 'b', v)}
                        keyboardType="numeric" maxLength={3} placeholder="0"
                        placeholderTextColor={Colors.textMuted}
                      />
                      <TextInput
                        style={styles.rollInput}
                        value={String(form.roll?.[cl]?.g ?? '')}
                        onChangeText={v => setRoll(cl, 'g', v)}
                        keyboardType="numeric" maxLength={3} placeholder="0"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                  ))}
                  <Text style={styles.rollTotal}>👦 {formBoys} · 👧 {formGirls} · మొత్తం {formBoys + formGirls}</Text>
                </View>
              ) : (
                <Text style={styles.rollInfo}>Roll నమోదు చేయడానికి ముందు Min–Max తరగతులు ఇవ్వండి.</Text>
              )}
            </ScrollView>
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
            <Text style={styles.modalTitle}>
              📋  Preview — {previewRows?.length} rows
            </Text>
            <Text style={styles.previewHint}>
              దిగువ schools add / update అవుతాయి. ఎరుపు rows (తప్పులు) skip అవుతాయి.
            </Text>

            {udiseNote ? (
              <Text style={styles.previewHint}>
                📥 UDISE+ file{udiseNote.ay ? ` (AY ${udiseNote.ay})` : ''} · Roll update (పేర్లు, items, address మారవు)
                {udiseNote.unchanged ? `\nమార్పు లేనివి: ${udiseNote.unchanged}` : ''}
                {udiseNote.missing ? `\nFile లో లేని schools (మార్పు లేదు): ${udiseNote.missing}` : ''}
                {udiseNote.ayMismatch ? `\n⚠️ File AY ${udiseNote.ay}, App AY ${udiseNote.ayMismatch}` : ''}
              </Text>
            ) : null}
            <Text style={styles.previewSummary}>
              🆕 కొత్తవి {pvNew}  ·  🔄 Update {pvUpd}  ·  ❌ తప్పులు {pvErr}
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
                <Text style={styles.saveBtnText}>✅  Confirm Import</Text>
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
              renderItem={({ item: row, index: i }) => {
                const rs = row.status !== 'error' && row.data.roll && row.newTotal === undefined ? rollSummary(row.data) : null;
                return (
                  <View key={i} style={styles.previewRow}>
                    <Text style={styles.previewIndex}>{row.rowNo || i + 1}</Text>
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
                      {row.udise ? <Text style={styles.previewMeta}>📋 {row.udise}</Text> : null}
                      {row.status === 'error' ? (
                        <Text style={styles.previewError}>{row.error}</Text>
                      ) : (
                        <>
                          {row.data.type ? (
                            <Text style={styles.previewMeta}>🏷️ {row.data.type} · 🎓 {row.data.minClass}–{row.data.maxClass}</Text>
                          ) : null}
                          {rs ? <Text style={styles.previewMeta}>👦 {rs.boys} · 👧 {rs.girls} · మొత్తం {rs.total}</Text> : null}
                          {row.newTotal !== undefined ? (
                            <Text style={[styles.previewMeta, row.oldTotal !== null && row.newTotal < row.oldTotal && { color: Colors.danger, fontWeight: '700' }]}>
                              {row.oldTotal === null
                                ? `👥 Roll ${row.newTotal} (కొత్త)`
                                : `👥 Roll ${row.oldTotal} → ${row.newTotal} (${row.newTotal - row.oldTotal >= 0 ? '+' : ''}${row.newTotal - row.oldTotal})`}
                            </Text>
                          ) : null}
                          {(row.warnings || []).map((w, wi) => (
                            <Text key={wi} style={[styles.previewMeta, { color: Colors.danger }]}>⚠️ {w}</Text>
                          ))}
                          {row.data.address ? <Text style={styles.previewMeta}>📍 {row.data.address}</Text> : null}
                        </>
                      )}
                    </View>
                  </View>
                );
              }}
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

  topRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md },
  backBtn:     { flexDirection: 'row', alignItems: 'center' },
  backBtnText: { fontSize: 16, color: Colors.primary, fontWeight: '600' },
  topActions:  { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },

  uploadBtn:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.lg },
  uploadBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },

  addBtn:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.lg },
  addBtnIcon: { fontSize: 14, color: Colors.primaryText, fontWeight: '700' },
  addBtnText: { color: Colors.primaryText, fontWeight: '700', fontSize: 13 },

  uploadHint: { fontSize: 11, color: Colors.textMuted, marginBottom: Spacing.sm },
  tplLink:     { alignSelf: 'flex-start', marginBottom: Spacing.sm },
  tplLinkText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  pillsRow:    { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  typePill:    { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', backgroundColor: Colors.background },
  typePillActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  typePillText:   { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  typePillTextActive: { color: Colors.primary },
  rangeRow:    { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginBottom: Spacing.sm },
  rangeDash:   { fontSize: 18, color: Colors.textMuted },
  rollPanel:   { backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  rollRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  rollClass:   { width: 56, fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  rollHeadText:{ fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  rollHeadCell:{ flex: 1, textAlign: 'center' },
  rollInput:   { flex: 1, borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.sm, paddingVertical: Spacing.xs, textAlign: 'center', fontSize: 14, fontWeight: '700', color: Colors.primary, backgroundColor: Colors.surface },
  rollTotal:   { fontSize: 12, fontWeight: '700', color: Colors.primary, marginTop: Spacing.xs, textAlign: 'center' },
  rollInfo:    { fontSize: 11, color: Colors.textMuted, marginBottom: Spacing.sm },
  rollWarn:    { fontSize: 11, color: Colors.danger, fontWeight: '600' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 0.5, borderColor: Colors.cardBorder, gap: Spacing.sm,
  },
  searchIcon:  { fontSize: 16 },
  searchInput: { flex: 1, paddingVertical: Spacing.md, fontSize: 14, color: Colors.textPrimary },

  schoolCard:  { marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'flex-start' },
  cardLeft:    { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  schoolIcon:  { width: 44, height: 44, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  schoolInfo:  { flex: 1, gap: 4 },
  schoolName:  { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  udiseBadge:  { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm, alignSelf: 'flex-start' },
  udiseText:   { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  addressText: { fontSize: 11, color: Colors.textMuted },
  itemCount:   { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  editBtn:     { backgroundColor: Colors.primaryLight, padding: Spacing.sm, borderRadius: Radius.sm },
  deleteBtn:   { backgroundColor: Colors.dangerBg, padding: Spacing.sm, borderRadius: Radius.sm },

  emptyEmoji: { fontSize: 52, marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.xs },
  emptyHint:  { ...Typography.bodySm, textAlign: 'center' },

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
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.cardBorder, alignSelf: 'center', marginBottom: Spacing.md },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: Colors.primaryDark, marginBottom: Spacing.md },
  inputLabel:   { ...Typography.label, marginBottom: Spacing.xs, marginTop: Spacing.xs },
  input: {
    borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: Radius.md,
    padding: Spacing.sm, fontSize: 14, color: Colors.textPrimary,
    marginBottom: Spacing.sm, backgroundColor: Colors.background,
  },
  inputMultiline: { height: 72, textAlignVertical: 'top' },
  modalActions:   { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn:      { flex: 1, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder },
  cancelBtnText:  { color: Colors.textSecondary, fontWeight: '600' },
  saveBtn:        { flex: 1, backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  saveBtnText:    { color: Colors.primaryText, fontWeight: '700' },

  // Preview modal
  previewHint: { fontSize: 12, color: Colors.textMuted, marginBottom: Spacing.sm },
  previewRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 0.5, borderBottomColor: Colors.cardBorder },
  previewIndex: { fontSize: 12, color: Colors.textMuted, width: 24, paddingTop: 2 },
  previewName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  previewMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  previewError: { fontSize: 11, color: Colors.danger, marginTop: 2 },
  previewSummary: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm },
  badge:        { paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.sm, alignSelf: 'flex-start', marginBottom: 2 },
  badgeText:    { fontSize: 10, fontWeight: '700' },
  saveBtnOff:   { backgroundColor: '#a5b4fc' },
});