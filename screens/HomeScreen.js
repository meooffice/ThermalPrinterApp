// screens/HomeScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import BluetoothService from '../services/BluetoothService';
import EscPosEncoder from '../services/EscPosEncoder';

const HELP_STEPS = [
  {
    icon: '⚙️',
    en_title: 'Step 1 — Settings',
    te_title: 'అడుగు 1 — Settings',
    en: 'Go to ⚙️ Settings tab. Enter your Mandal Name, phone number and address. Optionally add a logo. Tap Save.',
    te: '⚙️ Settings tab కి వెళ్ళండి. మండల పేరు, phone number, address enter చేయండి. లోగో add చేయవచ్చు. Save చేయండి.',
  },
  {
    icon: '📦',
    en_title: 'Step 2 — Add Kit Items',
    te_title: 'అడుగు 2 — Kit Items',
    en: 'Go to 📦 Catalog tab. Tap + Add and enter item names (e.g. Note Books, Pencils). Repeat for all kit items.',
    te: '📦 Catalog tab కి వెళ్ళండి. + Add tap చేసి item పేర్లు enter చేయండి (ఉదా: Note Books, Pencils). అన్ని items add చేయండి.',
  },
  {
    icon: '🏫',
    en_title: 'Step 3 — Add Schools',
    te_title: 'అడుగు 3 — Schools',
    en: 'Go to 🏫 Schools tab. Tap + Add and enter school name, UDISE code and address. Repeat for all schools.',
    te: '🏫 Schools tab కి వెళ్ళండి. + Add tap చేసి school పేరు, UDISE code, address enter చేయండి. అన్ని schools add చేయండి.',
  },
  {
    icon: '🔍',
    en_title: 'Step 4 — Connect Printer',
    te_title: 'అడుగు 4 — Printer Connect',
    en: 'Turn on EC-58 printer. Go to phone Bluetooth Settings and pair it. Then open 🔍 Connect tab and tap the printer name.',
    te: 'EC-58 printer on చేయండి. Phone Bluetooth Settings లో pair చేయండి. తర్వాత 🔍 Connect tab లో printer పేరు tap చేయండి.',
  },
  {
    icon: '🧾',
    en_title: 'Step 5 — Print Receipt',
    te_title: 'అడుగు 5 — Receipt Print',
    en: 'Go to 🧾 Receipt tab. Select school, set Spell number, tick ☑️ items and enter counts. Tap Print and choose copies.',
    te: '🧾 Receipt tab కి వెళ్ళండి. School select చేయండి, Spell number set చేయండి, items ☑️ tick చేసి counts enter చేయండి. Print tap చేయండి.',
  },
  {
    icon: '📄',
    en_title: 'Step 6 — Share as PDF',
    te_title: 'అడుగు 6 — PDF Share',
    te: 'Receipt screen లో 📄 PDF Share tap చేయండి. WhatsApp, Gmail, Drive లో share చేయవచ్చు.',
    en: 'In Receipt screen tap 📄 PDF Share. You can share to WhatsApp, Gmail, Google Drive etc.',
  },
  {
    icon: '📋',
    en_title: 'Step 7 — History & Reprint',
    te_title: 'అడుగు 7 — History',
    en: 'Go to 📋 History tab to see all past receipts. Tap Reprint to print again or Delete to remove.',
    te: '📋 History tab లో past receipts అన్నీ కనిపిస్తాయి. Reprint tap చేస్తే మళ్ళీ print అవుతుంది.',
  },
];

const TROUBLE = [
  {
    problem: 'Printer connect కావడం లేదు',
    solution: 'Printer off/on చేయండి, Bluetooth re-pair చేయండి',
  },
  {
    problem: 'Print చదవడం కష్టంగా ఉంది',
    solution: 'Settings లో Paper Width 32 గా set చేయండి',
  },
  {
    problem: 'Catalog items కనిపించడం లేదు',
    solution: 'School select చేసిన తర్వాత checklist వస్తుంది',
  },
  {
    problem: 'Receipt history లేదు',
    solution: 'Print చేసిన తర్వాత automatically save అవుతుంది',
  },
];

export default function HomeScreen({ navigation }) {
  const [connected, setConnected]   = useState(false);
  const [deviceName, setDeviceName] = useState(null);
  const [testing, setTesting]       = useState(false);
  const [helpModal, setHelpModal]   = useState(false);
  const [helpLang, setHelpLang]     = useState('both'); // 'both' | 'te' | 'en'

  useFocusEffect(
    useCallback(() => { checkConnection(); }, [])
  );

  const checkConnection = async () => {
    const isConnected = await BluetoothService.isConnected();
    setConnected(isConnected);
    if (isConnected) {
      const device = BluetoothService.getConnectedDevice();
      setDeviceName(device?.name || device?.address || 'Unknown');
    } else {
      setDeviceName(null);
    }
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect', 'Disconnect చేయాలా?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          await BluetoothService.disconnect();
          setConnected(false);
          setDeviceName(null);
        },
      },
    ]);
  };

  const handleTestPrint = async () => {
    try {
      setTesting(true);
      const encoder = new EscPosEncoder();
      encoder
        .initialize()
        .align('center')
        .bold(true).size('double')
        .text('T-Print').newline()
        .size('normal').bold(false)
        .text('Test Print').newline()
        .divider('=')
        .align('left')
        .text('Normal text line').newline()
        .bold(true).text('Bold text line').bold(false).newline()
        .underline(true).text('Underlined text').underline(false).newline()
        .align('center')
        .divider()
        .text('Printer is working!').newline()
        .newline(3)
        .cut();
      await BluetoothService.sendBase64(encoder.encodeBase64());
      Alert.alert('Success ✅', 'Test print అయింది!');
    } catch (error) {
      Alert.alert('Test Print Failed', error.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🖨️ T-Print</Text>
          <Text style={styles.headerSub}>SRKVM Kit Distribution</Text>
        </View>
        <TouchableOpacity
          style={styles.helpBtn}
          onPress={() => setHelpModal(true)}
        >
          <Text style={styles.helpBtnText}>❓ Help</Text>
        </TouchableOpacity>
      </View>

      {/* Connection Status */}
      <View style={[
        styles.statusCard,
        connected ? styles.statusConnected : styles.statusDisconnected,
      ]}>
        <View style={styles.statusRow}>
          <View style={[
            styles.dot,
            connected ? styles.dotConnected : styles.dotDisconnected,
          ]} />
          <Text style={styles.statusText}>
            {connected
              ? `Connected · ${deviceName}`
              : 'Printer connected లేదు'}
          </Text>
        </View>
        {connected && (
          <TouchableOpacity onPress={handleDisconnect}>
            <Text style={styles.disconnectText}>Disconnect</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {!connected ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('Scan')}
          >
            <Text style={styles.primaryBtnText}>🔍  Printer Connect చేయండి</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.testBtn, testing && styles.btnDisabled]}
              onPress={handleTestPrint}
              disabled={testing}
            >
              {testing ? (
                <ActivityIndicator color="#4f46e5" />
              ) : (
                <Text style={styles.testBtnText}>🧪  Test Print</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('Receipt')}
            >
              <Text style={styles.primaryBtnText}>
                🧾  Kit Distribution Receipt
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('Scan')}
            >
              <Text style={styles.secondaryBtnText}>⚙️  Printer మార్చండి</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Quick Guide */}
      <View style={styles.quickGuide}>
        <Text style={styles.quickGuideTitle}>⚡ Quick Steps</Text>

        <View style={styles.quickStep}>
          <Text style={styles.quickNum}>1</Text>
          <Text style={styles.quickText}>
            ⚙️ Settings లో Mandal పేరు save చేయండి
          </Text>
        </View>
        <View style={styles.quickStep}>
          <Text style={styles.quickNum}>2</Text>
          <Text style={styles.quickText}>
            📦 Catalog లో Kit items add చేయండి
          </Text>
        </View>
        <View style={styles.quickStep}>
          <Text style={styles.quickNum}>3</Text>
          <Text style={styles.quickText}>
            🏫 Schools లో school details add చేయండి
          </Text>
        </View>
        <View style={styles.quickStep}>
          <Text style={styles.quickNum}>4</Text>
          <Text style={styles.quickText}>
            🔍 Connect లో Bluetooth printer connect చేయండి
          </Text>
        </View>
        <View style={styles.quickStep}>
          <Text style={styles.quickNum}>5</Text>
          <Text style={styles.quickText}>
            🧾 Receipt లో school select చేసి print చేయండి
          </Text>
        </View>

        <TouchableOpacity
          style={styles.fullGuideBtn}
          onPress={() => setHelpModal(true)}
        >
          <Text style={styles.fullGuideBtnText}>
            📖 Full Guide చదవండి (తెలుగు / English)
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 30 }} />

      {/* Help Modal */}
      <Modal
        visible={helpModal}
        animationType="slide"
        onRequestClose={() => setHelpModal(false)}
      >
        <View style={styles.helpContainer}>

          {/* Modal Header */}
          <View style={styles.helpHeader}>
            <Text style={styles.helpHeaderTitle}>📖 How To Use</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setHelpModal(false)}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Language Toggle */}
          <View style={styles.langRow}>
            {['both', 'te', 'en'].map(lang => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.langBtn,
                  helpLang === lang && styles.langBtnActive,
                ]}
                onPress={() => setHelpLang(lang)}
              >
                <Text style={[
                  styles.langBtnText,
                  helpLang === lang && styles.langBtnTextActive,
                ]}>
                  {lang === 'both' ? '🌐 Both' :
                   lang === 'te'   ? '🇮🇳 తెలుగు' : '🇬🇧 English'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.helpScroll}>

            {/* Steps */}
            <Text style={styles.helpSection}>📋 Steps / అడుగులు</Text>

            {HELP_STEPS.map((step, i) => (
              <View key={i} style={styles.helpCard}>
                <View style={styles.helpCardHeader}>
                  <Text style={styles.helpIcon}>{step.icon}</Text>
                  <View style={{ flex: 1 }}>
                    {(helpLang === 'en' || helpLang === 'both') && (
                      <Text style={styles.helpEnTitle}>{step.en_title}</Text>
                    )}
                    {(helpLang === 'te' || helpLang === 'both') && (
                      <Text style={styles.helpTeTitle}>{step.te_title}</Text>
                    )}
                  </View>
                </View>
                {(helpLang === 'en' || helpLang === 'both') && (
                  <Text style={styles.helpEnText}>{step.en}</Text>
                )}
                {helpLang === 'both' && (
                  <View style={styles.helpDivider} />
                )}
                {(helpLang === 'te' || helpLang === 'both') && (
                  <Text style={styles.helpTeText}>{step.te}</Text>
                )}
              </View>
            ))}

            {/* Troubleshooting */}
            <Text style={styles.helpSection}>🔧 Troubleshooting / సమస్యలు</Text>

            {TROUBLE.map((t, i) => (
              <View key={i} style={styles.troubleCard}>
                <Text style={styles.troubleProblem}>❓ {t.problem}</Text>
                <Text style={styles.troubleSolution}>✅ {t.solution}</Text>
              </View>
            ))}

            {/* App Info */}
            <View style={styles.appInfo}>
              <Text style={styles.appInfoText}>
                🖨️ T-Print v1.0.0
              </Text>
              <Text style={styles.appInfoSub}>
                SRKVM Kit Distribution System{'\n'}
                Andhra Pradesh 🇮🇳
              </Text>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
  },
  headerSub: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  helpBtn: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  helpBtnText: {
    color: '#4f46e5',
    fontWeight: '700',
    fontSize: 14,
  },
  statusCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusConnected:    { backgroundColor: '#d1fae5' },
  statusDisconnected: { backgroundColor: '#fee2e2' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotConnected:    { backgroundColor: '#10b981' },
  dotDisconnected: { backgroundColor: '#ef4444' },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  disconnectText: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '600',
  },
  actions: { gap: 12 },
  primaryBtn: {
    backgroundColor: '#4f46e5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  testBtn: {
    backgroundColor: '#ede9fe',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  testBtnText: {
    color: '#4f46e5',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  secondaryBtnText: {
    color: '#4f46e5',
    fontWeight: '700',
    fontSize: 15,
  },
  btnDisabled: { opacity: 0.6 },

  // Quick Guide
  quickGuide: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    elevation: 1,
  },
  quickGuideTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 12,
  },
  quickStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  quickNum: {
    backgroundColor: '#4f46e5',
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  quickText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  fullGuideBtn: {
    backgroundColor: '#ede9fe',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  fullGuideBtnText: {
    color: '#4f46e5',
    fontWeight: '700',
    fontSize: 14,
  },

  // Help Modal
  helpContainer: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  helpHeader: {
    backgroundColor: '#4f46e5',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
  },
  helpHeaderTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  langRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  langBtn: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  langBtnActive: {
    backgroundColor: '#4f46e5',
  },
  langBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  langBtnTextActive: {
    color: '#fff',
  },
  helpScroll: {
    flex: 1,
    padding: 16,
  },
  helpSection: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2937',
    marginTop: 8,
    marginBottom: 10,
  },
  helpCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
  },
  helpCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  helpIcon: {
    fontSize: 24,
  },
  helpEnTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1f2937',
  },
  helpTeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4f46e5',
    marginTop: 2,
  },
  helpEnText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  helpTeText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
  },
  helpDivider: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginVertical: 6,
  },
  troubleCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
  },
  troubleProblem: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 4,
  },
  troubleSolution: {
    fontSize: 13,
    color: '#059669',
    lineHeight: 20,
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  appInfoText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4f46e5',
    marginBottom: 4,
  },
  appInfoSub: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
});