// screens/HelpScreen.js
// App Guide: every feature of the app with a short "how to use". Static content only (no storage, no services).
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Hero from '../components/Hero';
import { Colors, Radius, Spacing } from '../constants/Theme';
import { APP_VERSION, APP_CREDITS } from '../constants/AppInfo';

const GUIDE = [
  {
    id: 'printer', icon: 'bluetooth-connect', title: 'Printer Connect', where: 'Home',
    what: 'Bluetooth thermal printer ని app కి connect చేయడం. Connect అయితేనే receipt print అవుతుంది.',
    steps: [
      'Printer ఆన్ చేసి, phone Bluetooth ఆన్ చేయండి.',
      'Home లో Connect నొక్కి, Bluetooth permission ఇవ్వండి.',
      'జాబితాలో మీ printer ఎంచుకుని connect చేయండి.',
      'Home లో Test print పంపి చూడవచ్చు. అక్కడే Disconnect కూడా ఉంది.',
    ],
    tip: 'Printer జాబితాలో కనబడకపోతే printer ఆన్ లో ఉందో, Bluetooth ఆన్ లో ఉందో చూడండి.',
  },
  {
    id: 'receipt', icon: 'receipt-text-outline', title: 'Receipt', where: 'Receipt tab',
    what: 'ఒక school కి ఇచ్చిన kit items రశీదు తయారు చేసి print చేయడం.',
    steps: [
      'School ఎంచుకోండి.',
      'Roll (పిల్లల సంఖ్య) నమోదు చేయండి.',
      'ఇచ్చే items ని tick చేసి సంఖ్య ఇవ్వండి. Sizes ఉన్న items కు size వారీగా సంఖ్య ఇవ్వండి.',
      'Print నొక్కితే thermal printer లో వస్తుంది. PDF లేదా System Print తో A4 లో కూడా తీయవచ్చు (ఒక పేజీలో రెండు A5 copies).',
    ],
    tip: 'ఇప్పటికే ఇచ్చినవి లెక్కలో ఉంటాయి. Semester ఎంచుకుంటే ఆ Semester items మాత్రమే కనిపిస్తాయి. Return, ఇచ్చినదాని కంటే ఎక్కువ ఇవ్వలేరు.',
  },
  {
    id: 'history', icon: 'history', title: 'History', where: 'History tab',
    what: 'ఇంతవరకు print చేసిన రశీదుల జాబితా.',
    steps: [
      'ప్రతి రశీదు కార్డులో school, invoice number కనిపిస్తాయి.',
      'Printer connect అయి ఉంటే Reprint నొక్కి మళ్ళీ print చేయవచ్చు.',
      'తప్పు రశీదును Cancel చేయవచ్చు. అది జాబితాలోనే ఉంటుంది కానీ లెక్కలోకి రాదు, తిరిగి మార్చలేరు.',
      'పాత (legacy) రశీదులను మాత్రమే Delete చేయవచ్చు.',
    ],
  },
  {
    id: 'stock', icon: 'warehouse', title: 'Stock & Balance', where: 'Home → Stock',
    what: 'వచ్చిన stock నమోదు చేయడం, Received − Given = Balance చూడటం.',
    steps: [
      'ఒక item కు stock జోడించడానికి item ఎంచుకుని సంఖ్య, size, తేదీ, గమనిక నమోదు చేయండి.',
      'చాలా items ఒకేసారి కావాలంటే Bulk Add నొక్కండి. Type ఎంచుకుని, వచ్చిన సంఖ్యలు మాత్రమే రాయండి. ఖాళీ లేదా 0 ఉంటే ఆ item skip అవుతుంది.',
      'పైన Semester chips తో Semester వారీగా చూడవచ్చు (Bulk Add లో కూడా).',
      'Balance ఋణం లేదా Stock నమోదు కాని items పైన చూపిస్తుంది.',
    ],
  },
  {
    id: 'req', icon: 'chart-line-variant', title: 'Defficit & Requirement', where: 'Home → కొరత',
    what: 'Schools roll ప్రకారం కావలసిన items, వచ్చిన stock తో పోల్చి కొరత చూపిస్తుంది. ఇక్కడ మార్పులు చేయలేరు, చూడటానికి మాత్రమే.',
    steps: [
      'Home లో Defficit నొక్కండి.',
      'ప్రతి item కు Required, Received, కొరత చూడండి.',
      'Semester chips తో Semester వారీగా చూడండి.',
      'Roll లేని schools ఉంటే హెచ్చరిక వస్తుంది. Schools లో roll నమోదు చేయండి.',
    ],
  },
  {
    id: 'reports', icon: 'file-chart-outline', title: 'Reports', where: 'Home → Reports',
    what: 'Stock, Requirement, School-wise, Receipts reports ని A4 PDF లేదా Excel గా తీయడం.',
    steps: [
      'కావలసిన report ఎంచుకోండి.',
      'Semester వారీగా కావాలంటే Semester ఎంచుకోండి (Receipts list కు వర్తించదు).',
      'PDF లేదా Excel ఎంచుకుంటే share చేయడానికి file తయారవుతుంది.',
    ],
    tip: 'ప్రస్తుత Academic Year data తో report వస్తుంది.',
  },
  {
    id: 'schools', icon: 'school-outline', title: 'Schools', where: 'Home → Schools',
    what: 'Schools జాబితా నిర్వహణ: చేర్చడం, మార్చడం, తొలగించడం, Excel నుంచి upload.',
    steps: [
      'Add తో ఒక school ను చేర్చవచ్చు. Edit లేదా Delete కూడా ఉన్నాయి.',
      'చాలా schools కావాలంటే Template తీసుకుని నింపి, .xlsx లేదా .csv upload చేయండి.',
      'ప్రతి school కు roll, Min–Max class నమోదు చేస్తే Requirement సరిగ్గా వస్తుంది.',
    ],
  },
  {
    id: 'catalog', icon: 'bag-personal-outline', title: 'Item Catalog', where: 'Home → Items',
    what: 'Kit items జాబితా (Type, class పరిధి, Semester, Sizes, Barcode) నిర్వహణ. మొదటిసారి 121 default items ఉంటాయి, వాటిని మార్చవచ్చు లేదా తొలగించవచ్చు.',
    steps: [
      'Add తో కొత్త item చేర్చండి. Edit లేదా Delete కూడా ఉన్నాయి.',
      'Types (Prime Textbook, Notebooks ...) ను నిర్వహించవచ్చు.',
      'Barcode ను camera తో scan చేసి నమోదు చేయవచ్చు.',
      'Excel Template తో చాలా items ఒకేసారి upload చేయవచ్చు. Code ఒకటే అయితే ఉన్న item update అవుతుంది, రెండోసారి చేరదు.',
    ],
  },
  {
    id: 'year', icon: 'lock-outline', title: 'Academic Year Close', where: 'Home → Year Close',
    what: 'సంవత్సరం ముగింపు: కొత్త సంవత్సరానికి మారడం.',
    steps: [
      'ముందు Backup తీసుకోవడం తప్పనిసరి.',
      'Roll promotion preview చూడండి.',
      'CLOSE అని టైప్ చేసి నిర్ధారించండి.',
    ],
    tip: 'ఏదైనా తప్పు జరిగితే మొదట తీసిన Backup తో Restore చేసుకోవచ్చు.',
  },
  {
    id: 'settings', icon: 'cog-outline', title: 'Settings', where: 'Settings tab',
    what: 'Mandal వివరాలు, Academic Year, Receipt footer, printer paper width.',
    steps: [
      'Mandal name, phone, address నమోదు చేయండి. ఇవి రశీదులో వస్తాయి.',
      'Academic Year ఇలా ఇవ్వండి: 2026-27.',
      'Paper width: 58mm లేదా 80mm ఎంచుకోండి.',
      'మార్పులు చేశాక Save నొక్కండి.',
    ],
  },
  {
    id: 'backup', icon: 'database-outline', title: 'Backup & Restore', where: 'Settings → Backup',
    what: 'Data భద్రత. App uninstall చేసే ముందు తప్పనిసరిగా Backup తీసుకోండి.',
    steps: [
      'Backup: Schools, Items, Receipts, Settings, Invoice counter అన్నీ ఒక file గా save అవుతాయి. Restore తో వెనక్కి తెచ్చుకోవచ్చు.',
      'Google Drive auto backup: ఆన్ చేస్తే రోజూ సాయంత్రం 7 తర్వాత app తెరిచినప్పుడు Drive కి backup అవుతుంది.',
      'చివరి 15 backups Drive లో ఉంటాయి. Drive Restore లో ఏ తేదీది కావాలో ఎంచుకోవచ్చు.',
      'Restore చేసే ముందు ప్రస్తుత data కూడా Drive లో భద్రపరుస్తుంది.',
      'రోజూ 7 PM కి reminder notification వస్తుంది. ఆ రోజు backup అయి ఉంటే రాదు.',
      'Drive Backup fecility కావాలి అంటే మీ gmial-idతో splpdevelopers@gmail.com ని సంప్రదించండి.',
    ],
    tip: 'Notification రావాలంటే Android లో notification permission ఇవ్వాలి.',
  },
];

// Module-level (not defined inside the screen) so rows do not remount on every state change
const Item = ({ g, open, onToggle }) => (
  <View style={styles.card}>
    <TouchableOpacity style={styles.head} onPress={onToggle} activeOpacity={0.8}>
      <View style={styles.badge}>
        <MaterialCommunityIcons name={g.icon} size={22} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{g.title}</Text>
        <Text style={styles.where}>{g.where}</Text>
      </View>
      <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={Colors.textMuted} />
    </TouchableOpacity>
    {open && (
      <View style={styles.bodyBox}>
        <Text style={styles.what}>{g.what}</Text>
        {g.steps.map((s, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepNo}><Text style={styles.stepNoText}>{i + 1}</Text></View>
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}
        {!!g.tip && (
          <View style={styles.tipBox}>
            <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color={Colors.highlightText} />
            <Text style={styles.tipText}>{g.tip}</Text>
          </View>
        )}
      </View>
    )}
  </View>
);

export default function HelpScreen({ navigation }) {
  const [openId, setOpenId] = useState(null);   // one section open at a time
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Hero title="App Guide" subtitle="వాడుక సహాయం" info={`${GUIDE.length} features · SRKVM v${APP_VERSION}`} />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹  Back</Text>
        </TouchableOpacity>
        <Text style={styles.intro}>ఏ feature మీదైనా నొక్కితే దాని వాడుక తెలుస్తుంది.</Text>
        {GUIDE.map(g => (
          <Item key={g.id} g={g} open={openId === g.id} onToggle={() => setOpenId(openId === g.id ? null : g.id)} />
        ))}
        <Text style={styles.credits}>{APP_CREDITS}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingHorizontal: Spacing.lg },
  backBtn:     { paddingVertical: Spacing.md },
  backBtnText: { fontSize: 16, color: Colors.primary, fontWeight: '600' },
  intro:     { fontSize: 12, color: Colors.textMuted, marginBottom: Spacing.md },
  card:      { backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: Spacing.sm, overflow: 'hidden' },
  head:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  badge:     { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title:     { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  where:     { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  bodyBox:   { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, borderTopWidth: 0.5, borderTopColor: Colors.cardBorder },
  what:      { fontSize: 13, color: Colors.textPrimary, lineHeight: 20, marginTop: Spacing.md, marginBottom: Spacing.sm },
  stepRow:   { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  stepNo:    { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNoText:{ fontSize: 11, fontWeight: '800', color: Colors.primaryText },
  stepText:  { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  tipBox:    { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', backgroundColor: Colors.warm, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md },
  tipText:   { flex: 1, fontSize: 12, color: Colors.highlightText, lineHeight: 18 },
  credits:   { textAlign: 'center', fontSize: 11, color: Colors.textMuted, marginTop: Spacing.lg },
});