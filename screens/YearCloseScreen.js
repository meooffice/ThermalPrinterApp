// screens/YearCloseScreen.js
// Academic Year Close: Backup (required) -> roll promotion preview -> type CLOSE -> run.
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import YearCloseService from '../services/YearCloseService';
import BackupService from '../services/BackupService';
import { Colors, Radius, Spacing, Typography } from '../constants/Theme';
import { Card } from '../components/ui';
import Hero from '../components/Hero';

const CONFIRM_WORD = 'CLOSE';

export default function YearCloseScreen({ navigation }) {
  const [info, setInfo]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [backupFile, setBackupFile] = useState(null);   // set after the backup was shared
  const [backupBusy, setBackupBusy] = useState(false);
  const [expanded, setExpanded]     = useState({});
  const [typed, setTyped]     = useState('');
  const [running, setRunning] = useState(false);
  const [doneYear, setDoneYear] = useState(null);

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setInfo(await YearCloseService.preview());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const doBackup = async () => {
    if (backupBusy) return;
    try {
      setBackupBusy(true);
      const res = await BackupService.exportAndShare();
      setBackupFile(res.fileName);
    } catch (e) {
      Alert.alert('Backup కాలేదు', e.message);
    } finally {
      setBackupBusy(false);
    }
  };

  const canClose = !!backupFile && typed.trim() === CONFIRM_WORD && !running && !!info;

  const doClose = () => {
    if (!canClose) return;
    Alert.alert(
      'చివరి హెచ్చరిక',
      `${info.academicYear} close అవుతుంది.\n• ${info.receipts} receipts, ${info.stockEntries} stock entries తొలగిపోతాయి\n• Roll లు promote అవుతాయి\n• కొత్త సంవత్సరం ${info.nextYear}\n\nఇది తిరిగి మార్చలేరు (Backup నుండి Restore తప్ప).`,
      [
        { text: 'వెనక్కి', style: 'cancel' },
        { text: 'Close చేయి', style: 'destructive', onPress: run },
      ],
    );
  };

  const run = async () => {
    try {
      setRunning(true);
      const res = await YearCloseService.execute();
      setDoneYear(res.nextYear);
      setBackupFile(null); setTyped('');
      await load();
    } catch (e) {
      Alert.alert('Close కాలేదు', `${e.message}\n\nBackup file తో Restore చేసుకోవచ్చు. యాప్ ను మూసి మళ్ళీ తెరిచి స్థితి చూడండి.`);
    } finally {
      setRunning(false);
    }
  };

  const rollText = (plan, roll) =>
    plan.classes.map(c => `${c}: ${(roll?.[c]?.b ?? 0)}/${(roll?.[c]?.g ?? 0)}`).join('   ');

  if (loading && !info) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <Hero title="Academic Year Close" subtitle="సంవత్సరం ముగింపు" />
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Hero title="Academic Year Close" subtitle="సంవత్సరం ముగింపు" info={info ? `${info.academicYear}  →  ${info.nextYear}` : undefined} />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹  Back</Text>
        </TouchableOpacity>

        {error ? (
          <View style={styles.centeredBox}>
            <Text style={styles.emptyEmoji}>⚠️</Text>
            <Text style={styles.emptyTitle}>చదవలేకపోయాను</Text>
            <Text style={styles.emptyHint}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryBtnText}>మళ్ళీ ప్రయత్నించు</Text>
            </TouchableOpacity>
          </View>
        ) : info && (
          <>
            {doneYear && (
              <Card style={styles.okCard}>
                <Text style={styles.okText}>✅ {doneYear} మొదలైంది. Invoice numbers 0001 నుండి, Roll లు promote అయ్యాయి.</Text>
              </Card>
            )}

            <Card>
              <Text style={styles.cardTitle}>ఏం జరుగుతుంది</Text>
              <Text style={styles.line}>• {info.receipts} receipts మరియు {info.stockEntries} stock entries తొలగిపోతాయి</Text>
              <Text style={styles.line}>• Roll లు promote అవుతాయి (కింద preview)</Text>
              <Text style={styles.line}>• Academic Year → {info.nextYear}, Invoice 0001 నుండి</Text>
              <Text style={styles.line}>• Items, Schools, Settings అలాగే ఉంటాయి</Text>
            </Card>

            <Text style={styles.sectionTitle}>1️⃣  Backup (తప్పనిసరి)</Text>
            <Card>
              <TouchableOpacity style={[styles.primaryBtn, backupBusy && styles.btnOff]} disabled={backupBusy} onPress={doBackup}>
                {backupBusy ? <ActivityIndicator color={Colors.primaryText} /> : <Text style={styles.primaryBtnText}>💾 Backup తీసుకో & Save చేయి</Text>}
              </TouchableOpacity>
              {backupFile ? <Text style={styles.okLine}>✅ Backup share అయింది: {backupFile}</Text>
                          : <Text style={styles.warnLine}>Backup అయ్యే వరకు Close అనుమతించదు.</Text>}
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('Reports')}>
                <Text style={styles.secondaryBtnText}>🗂️ Reports (PDF / Excel) తీసుకోవడానికి వెళ్ళు</Text>
              </TouchableOpacity>
              <Text style={styles.small}>Reports తీసుకుని తిరిగి ఇక్కడికి రండి. (ఇది ఐచ్ఛికం, కానీ close తర్వాత ఈ సంవత్సరం reports తీయలేరు.)</Text>
            </Card>

            <Text style={styles.sectionTitle}>2️⃣  Roll Promotion Preview</Text>
            {info.plans.length === 0 ? (
              <Card><Text style={styles.small}>Schools లేవు.</Text></Card>
            ) : info.plans.map(p => (
              <TouchableOpacity key={p.id} activeOpacity={0.8} onPress={() => setExpanded(prev => ({ ...prev, [p.id]: !prev[p.id] }))}>
                <Card style={styles.schoolCard}>
                  <View style={styles.schoolHead}>
                    <Text style={styles.schoolName} numberOfLines={2}>{p.name}</Text>
                    <Text style={styles.schoolTotals}>
                      {p.newRoll ? `${p.oldTotal} → ${p.newTotal}` : 'Min–Max లేదు (మారదు)'}
                    </Text>
                  </View>
                  {expanded[p.id] && p.newRoll && (
                    <View style={{ marginTop: Spacing.xs }}>
                      <Text style={styles.small}>ముందు (Boys/Girls):  {rollText(p, p.oldRoll)}</Text>
                      <Text style={[styles.small, { color: Colors.primary }]}>తర్వాత:  {rollText(p, p.newRoll)}</Text>
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
            ))}
            <Text style={styles.small}>Class N కి పాత N−1 roll వస్తుంది. అతి చిన్న class roll అలాగే ఉంటుంది. అతి పెద్ద class roll తొలగిపోతుంది. Close తర్వాత Schools లో సరిచేయవచ్చు. (school పేరు నొక్కితే class వారీగా చూడవచ్చు)</Text>

            <Text style={styles.sectionTitle}>3️⃣  Confirm</Text>
            <Card>
              <Text style={styles.small}>కొనసాగడానికి  {CONFIRM_WORD}  అని టైప్ చేయండి</Text>
              <TextInput style={styles.input} value={typed} onChangeText={setTyped} autoCapitalize="characters"
                autoCorrect={false} placeholder={CONFIRM_WORD} placeholderTextColor={Colors.textMuted} />
              <TouchableOpacity style={[styles.dangerBtn, !canClose && styles.btnOff]} disabled={!canClose} onPress={doClose}>
                {running ? <ActivityIndicator color="#fff" /> : <Text style={styles.dangerBtnText}>🔒 {info.academicYear} Close చేయి</Text>}
              </TouchableOpacity>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingHorizontal: Spacing.lg },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centeredBox: { alignItems: 'center', paddingVertical: Spacing.xl },
  backBtn:     { paddingVertical: Spacing.md },
  backBtnText: { fontSize: 16, color: Colors.primary, fontWeight: '600' },
  sectionTitle: { ...Typography.label, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.md, marginBottom: Spacing.xs },
  cardTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.xs },
  line:  { fontSize: 13, color: Colors.textPrimary, lineHeight: 20 },
  small: { fontSize: 12, color: Colors.textMuted, marginTop: Spacing.xs },
  okLine:   { fontSize: 13, color: Colors.success, fontWeight: '700', marginTop: Spacing.sm },
  warnLine: { fontSize: 12, color: Colors.danger, marginTop: Spacing.sm },
  okCard: { marginBottom: Spacing.sm, backgroundColor: Colors.primaryLight },
  okText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  primaryBtn:     { backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  primaryBtnText: { color: Colors.primaryText, fontWeight: '700' },
  secondaryBtn:   { marginTop: Spacing.sm, backgroundColor: Colors.primaryLight, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  secondaryBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  dangerBtn:     { marginTop: Spacing.sm, backgroundColor: Colors.danger, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  dangerBtnText: { color: '#fff', fontWeight: '800' },
  btnOff: { opacity: 0.4 },

  schoolCard:  { marginBottom: Spacing.xs },
  schoolHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  schoolName:  { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  schoolTotals:{ fontSize: 13, fontWeight: '800', color: Colors.primary },

  input: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: Radius.md, padding: Spacing.md, fontSize: 16, fontWeight: '700',
           color: Colors.textPrimary, backgroundColor: Colors.surface, marginTop: Spacing.xs, textAlign: 'center' },

  emptyEmoji: { fontSize: 52, marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.xs },
  emptyHint:  { ...Typography.bodySm, textAlign: 'center' },
  retryBtn:     { marginTop: Spacing.md, backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  retryBtnText: { color: Colors.primary, fontWeight: '700' },
});