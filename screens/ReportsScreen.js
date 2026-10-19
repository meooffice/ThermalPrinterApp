// screens/ReportsScreen.js
// Reports: Stock, Requirement, School-wise, Receipts. Each exports to A4 PDF or Excel. Read-only.
import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, Modal, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ReportService, { REPORTS } from '../services/ReportService';
import SchoolService from '../services/SchoolService';
import CatalogService from '../services/CatalogService';
import { semesterList } from '../services/ItemModel';
import { Colors, Radius, Spacing, Typography } from '../constants/Theme';
import { Card } from '../components/ui';
import Hero from '../components/Hero';
import SemesterChips from '../components/SemesterChips';

// Icon for a report card (display only). Falls back to the emoji given by ReportService.
function reportIcon(r) {
  const k = `${r.key || ''} ${r.title || ''}`.toLowerCase();
  if (k.includes('stock')) return 'package-variant-closed';
  if (k.includes('requirement') || k.includes('deficit') || k.includes('కొరత')) return 'trending-down';
  if (k.includes('receipt')) return 'receipt-text-outline';
  if (k.includes('school')) return 'school-outline';
  return null;
}

export default function ReportsScreen({ navigation }) {
  const insets = useSafeAreaInsets(); // keep sheet buttons above the Android navigation bar
  const [busy, setBusy] = useState(null);   // 'stock:pdf' etc.

  const [pick, setPick]       = useState(null);   // { key, kind } waiting for a school to be chosen
  const [schools, setSchools] = useState([]);
  const [q, setQ]             = useState('');
  const [sem, setSem]         = useState(null);     // Semester filter: null = All
  const [semList, setSemList] = useState([]);

  useFocusEffect(useCallback(() => {
    CatalogService.getAll().then(items => setSemList(semesterList(items))).catch(() => {});   // filter row is simply hidden on a read error
  }, []));

  const run = async (key, kind, opts) => {
    if (busy) return;
    setBusy(`${key}:${kind}`);
    try {
      const o = { ...(opts || {}), semester: sem };
      if (kind === 'pdf') await ReportService.exportPDF(key, o);
      else                await ReportService.exportExcel(key, o);
    } catch (e) {
      Alert.alert('Report', e.message);
    } finally {
      setBusy(null);
    }
  };

  // Reports that are about one school first ask which school
  const start = async (rep, kind) => {
    if (!rep.needsSchool) { run(rep.key, kind); return; }
    try {
      setSchools(await SchoolService.getAll());
      setQ('');
      setPick({ key: rep.key, kind });
    } catch (e) {
      Alert.alert('Schools', e.message);
    }
  };
  const choose = (school) => {
    const p = pick;
    setPick(null);
    run(p.key, p.kind, { schoolId: school.id });
  };
  const shown = schools.filter(s =>
    (s.name || '').toLowerCase().includes(q.toLowerCase()) || String(s.udise || '').includes(q));

  const Btn = ({ rep, kind, label, icon }) => {
    const k = rep.key;
    const on = busy === `${k}:${kind}`;
    return (
      <TouchableOpacity style={[styles.btn, !!busy && styles.btnOff]} disabled={!!busy} onPress={() => start(rep, kind)}>
        {on ? <ActivityIndicator size="small" color={Colors.primary} /> : (
          <>
            <MaterialCommunityIcons name={icon} size={18} color={Colors.primary} />
            <Text style={styles.btnText}>{label}</Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Hero title="Reports" subtitle="PDF (A4) · Excel" />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹  Back</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>ప్రస్తుత Academic Year data తో report తయారవుతుంది. Cancelled / legacy receipts లెక్కలోకి రావు.</Text>
        <SemesterChips list={semList} value={sem} onChange={setSem} />
        {sem !== null ? <Text style={styles.hint}>Semester {sem} filter: Receipts List కి వర్తించదు.</Text> : null}
        {REPORTS.map(r => (
          <Card key={r.key} style={styles.card}>
            <View style={styles.head}>
              <View style={styles.iconWrap}>
                {reportIcon(r)
                  ? <MaterialCommunityIcons name={reportIcon(r)} size={24} color={Colors.primary} />
                  : <Text style={styles.icon}>{r.icon}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{r.title}</Text>
                <Text style={styles.sub}>{r.sub}</Text>
              </View>
            </View>
            <View style={styles.btnRow}>
              <Btn rep={r} kind="pdf"  label="PDF" icon="file-pdf-box" />
              <Btn rep={r} kind="xlsx" label="Excel" icon="file-excel-outline" />
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* School picker (Selected School Report) */}
      <Modal visible={!!pick} animationType="slide" transparent onRequestClose={() => setPick(null)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: Spacing.lg + insets.bottom }]}>
            <View style={styles.sheetTitleRow}>
              <MaterialCommunityIcons name="school-outline" size={22} color={Colors.primaryDark} />
              <Text style={styles.sheetTitle}>School ఎంచుకోండి</Text>
            </View>
            <TextInput
              style={styles.search} value={q} onChangeText={setQ}
              placeholder="School పేరు లేదా UDISE..." placeholderTextColor={Colors.textMuted} />
            {shown.length === 0 ? (
              <Text style={styles.empty}>{schools.length === 0 ? 'Schools లేవు. ముందు Schools Data లో add చేయండి.' : 'ఏ school కనబడలేదు.'}</Text>
            ) : (
              <FlatList
                data={shown} keyExtractor={s => String(s.id)} keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.schoolRow} onPress={() => choose(item)}>
                    <Text style={styles.schoolName}>{item.name}</Text>
                    {item.udise ? <Text style={styles.schoolSub}>UDISE {item.udise}</Text> : null}
                  </TouchableOpacity>
                )} />
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setPick(null)}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingHorizontal: Spacing.lg },
  backBtn:     { paddingVertical: Spacing.md },
  backBtnText: { fontSize: 16, color: Colors.primary, fontWeight: '600' },
  hint:  { ...Typography.bodySm, marginBottom: Spacing.sm },
  card:  { marginBottom: Spacing.sm },
  head:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  icon:  { fontSize: 22 },
  title: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  sub:   { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  btn:    { flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', backgroundColor: Colors.primaryLight, paddingVertical: Spacing.md, borderRadius: Radius.lg, alignItems: 'center' },
  btnOff: { opacity: 0.6 },
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:      { height: '80%', backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.primaryDark },
  search:     { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: Radius.md, padding: Spacing.sm, fontSize: 14, color: Colors.textPrimary, backgroundColor: Colors.background, marginBottom: Spacing.sm },
  empty:      { ...Typography.bodySm, textAlign: 'center', marginVertical: Spacing.lg },
  schoolRow:  { paddingVertical: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: Colors.cardBorder },
  schoolName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  schoolSub:  { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  closeBtn:   { padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center', marginTop: Spacing.sm, backgroundColor: Colors.background },
  closeBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  btnText:{ color: Colors.primary, fontWeight: '700' },
});