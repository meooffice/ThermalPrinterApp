// components/LockScreen.js
// Full-screen PIN prompt shown over the app while it is locked. Forgot PIN -> recovery code (given when the PIN was set).
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PinPad from './PinPad';
import AppLockService from '../services/AppLockService';
import { Colors, Radius, Spacing } from '../constants/Theme';
import { APP_VERSION } from '../constants/AppInfo';

export default function LockScreen({ onUnlock }) {
  const [mode, setMode]   = useState('pin');     // 'pin' | 'forgot'
  const [error, setError] = useState('');
  const [wait, setWait]   = useState(false);
  const [code, setCode]   = useState('');
  const [busy, setBusy]   = useState(false);

  const tryPin = async (pin) => {
    const r = await AppLockService.verify(pin);
    if (r.ok) { setError(''); onUnlock(); return; }
    if (r.wait) {
      setWait(true);
      setError(`చాలా తప్పు ప్రయత్నాలు. ${r.wait} సెకన్ల తర్వాత మళ్ళీ ప్రయత్నించండి.`);
      setTimeout(() => { setWait(false); setError(''); }, r.wait * 1000);
    } else {
      setError(`తప్పు PIN${r.left != null ? ` (${r.left} ప్రయత్నాలు మిగిలాయి)` : ''}`);
    }
  };

  const tryRecovery = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (await AppLockService.verifyRecovery(code)) {
        Alert.alert('PIN తొలగించబడింది', 'Settings → App Lock లో కొత్త PIN పెట్టుకోండి.');
        onUnlock();
      } else {
        setError('Recovery code సరిపోలలేదు.');
      }
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.top}>
        <View style={styles.badge}><MaterialCommunityIcons name="lock-outline" size={30} color={Colors.primaryText} /></View>
        <Text style={styles.brand}>SRKVM</Text>
        <Text style={styles.ver}>v{APP_VERSION}</Text>
      </View>

      {mode === 'pin' ? (
        <View style={styles.body}>
          <PinPad title="PIN నమోదు చేయండి" subtitle="App ను తెరవడానికి 6 అంకెల PIN" error={error} disabled={wait} onComplete={tryPin} />
          <TouchableOpacity onPress={() => { setError(''); setMode('forgot'); }} style={styles.link}>
            <Text style={styles.linkText}>PIN మర్చిపోయారా?</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={styles.fTitle}>Recovery code</Text>
          <Text style={styles.fSub}>PIN పెట్టినప్పుడు చూపించిన 8 అక్షరాల code ఇక్కడ ఇవ్వండి (ఉదా: ABCD-EFGH).</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(v) => { setCode(v); setError(''); }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={9}
            placeholder="XXXX-XXXX"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.err}>{error || ' '}</Text>
          <TouchableOpacity style={[styles.btn, (!code || busy) && { opacity: 0.5 }]} onPress={tryRecovery} disabled={!code || busy}>
            <Text style={styles.btnText}>PIN తొలగించు</Text>
          </TouchableOpacity>
          <Text style={styles.note}>Code కూడా లేకపోతే: app ను uninstall చేసి, మళ్ళీ install చేసి, Google Drive లేదా file Backup నుంచి Restore చేయండి.</Text>
          <TouchableOpacity onPress={() => { setError(''); setCode(''); setMode('pin'); }} style={styles.link}>
            <Text style={styles.linkText}>‹  వెనక్కి</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:  { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.background, zIndex: 900, elevation: 900 },
  top:   { alignItems: 'center', paddingTop: Spacing.xl * 2 },
  badge: { width: 64, height: 64, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 24, fontWeight: '800', color: Colors.primaryDark, marginTop: Spacing.md },
  ver:   { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  body:  { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl },
  link:  { padding: Spacing.md, marginTop: Spacing.sm },
  linkText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  fTitle: { fontSize: 18, fontWeight: '800', color: Colors.primaryDark },
  fSub:   { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 4, marginBottom: Spacing.lg },
  input:  { alignSelf: 'stretch', borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: Radius.lg, backgroundColor: Colors.surface, padding: Spacing.md, fontSize: 20, fontWeight: '700', letterSpacing: 3, textAlign: 'center', color: Colors.textPrimary },
  err:    { fontSize: 12, color: Colors.danger, marginTop: Spacing.sm, minHeight: 18, textAlign: 'center' },
  btn:    { alignSelf: 'stretch', backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: Radius.lg, alignItems: 'center', marginTop: Spacing.sm },
  btnText:{ color: Colors.primaryText, fontWeight: '800', fontSize: 15 },
  note:   { fontSize: 11, color: Colors.textMuted, textAlign: 'center', lineHeight: 17, marginTop: Spacing.lg },
});