// screens/SettingsScreen.js
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Switch,
  Modal,
  Linking,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import SettingsService from "../services/SettingsService";
import { Colors, Radius, Spacing, Typography } from "../constants/Theme";
import BackupService from "../services/BackupService";
import DriveBackupService from "../services/DriveBackupService";
import BackupReminder from "../services/BackupReminder";
import AppLockService from "../services/AppLockService";
import PinPad from "../components/PinPad";
import { isValidAcademicYear } from "../services/AcademicYear";
import { APP_VERSION, APP_CREDITS } from "../constants/AppInfo";

const SUPPORT_EMAIL = "splpdevelopers@gmail.com";
const STALE_DAYS = 3; // red warning when the last Drive backup is this many days old
// Google blocks the Drive permission for accounts that are not registered (app is in Testing mode): the Drive call then fails with 401/403
const isDriveDenied = (e) => /Drive error (401|403)|access_denied|insufficient|403/i.test((e && e.message) || "");
// When Google shows "Access blocked" the sign-in simply comes back as cancelled, so a cancel cannot be told apart from a refusal
const isSignInCancelled = (e) => /రద్దు|cancel/i.test((e && e.message) || "");

// Defined OUTSIDE the screen so inputs keep focus while typing (no remount on each state change)
const Field = ({ icon, label, children }) => (
  <View style={styles.field}>
    <View style={styles.labelRow}>
      <MaterialCommunityIcons name={icon} size={15} color={Colors.textSecondary} />
      <Text style={styles.labelText}>{label}</Text>
    </View>
    {children}
  </View>
);

const Section = ({ icon, bg, color, title, children }) => (
  <View style={styles.section}>
    <View style={styles.sectionHead}>
      <View style={[styles.sectionBadge, { backgroundColor: bg }]}>
        <MaterialCommunityIcons name={icon} size={18} color={color || Colors.primary} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets(); // keep the version sheet above the Android navigation bar
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAY, setSavedAY] = useState(null); // Academic Year as saved
  const [backupBusy, setBackupBusy] = useState(null); // null | 'export' | 'restore'
  const [drive, setDrive] = useState(null); // Drive auto-backup meta
  const [driveBusy, setDriveBusy] = useState(null); // null | 'toggle' | 'now' | 'restore'
  const [lockOn, setLockOn] = useState(false); // PIN lock enabled
  const [pinFlow, setPinFlow] = useState(null); // null | { mode: 'set' | 'off' | 'change', step: 'verify' | 'new' | 'confirm' | 'code', first?, code? }
  const [pinErr, setPinErr] = useState("");
  const [dirty, setDirty] = useState(false); // data changed since the last Drive backup
  const [denied, setDenied] = useState(null); // null | { kind: 'denied' | 'cancel', email, detail }: Drive Backup sign-in did not complete
  const [versions, setVersions] = useState(null); // null = closed, else Drive backup history [{ id, modifiedTime, size }]
  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, []),
  );

  const loadSettings = async () => {
    const s = await SettingsService.get();
    setSettings(s);
    setSavedAY(s.academicYear);
    try { setLockOn(await AppLockService.isEnabled()); } catch { /* keep as is */ }
    const m = await DriveBackupService.getMeta();
    setDrive(m);
    setDirty(await DriveBackupService.hasUnsavedChanges());
  };

  const update = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const doSave = async () => {
    try {
      setSaving(true);
      await SettingsService.save(settings);
      setSavedAY(settings.academicYear);
      Alert.alert("Saved", "Settings saved successfully!");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!isValidAcademicYear(settings.academicYear)) {
      Alert.alert(
        "Academic Year",
        "ఇలా రాయండి: 2026-27 (రెండవ భాగం = మొదటి సంవత్సరం + 1).",
      );
      return;
    }
    if (savedAY && settings.academicYear !== savedAY) {
      Alert.alert(
        "Academic Year మారుస్తున్నారు",
        `${savedAY} → ${settings.academicYear}\n\nకొత్త invoice numbering 0001 నుండి మొదలవుతుంది. ${savedAY} రశీదులు లెక్క నుండి పక్కకు వెళ్తాయి. కొనసాగించాలా?`,
        [
          { text: "వెనక్కి", style: "cancel" },
          { text: "మార్చు", style: "destructive", onPress: doSave },
        ],
      );
      return;
    }
    doSave();
  };

  const handleExport = async () => {
    try {
      setBackupBusy("export");
      const { fileName, summary } = await BackupService.exportAndShare();
      await DriveBackupService.markFileBackup(); // file backup date counts in the status banner
      setDrive(await DriveBackupService.getMeta());
      setDirty(await DriveBackupService.hasUnsavedChanges());
      Alert.alert(
        "Backup సిద్ధం",
        `${fileName}\n\nSchools: ${summary.schools}\nItems: ${summary.items}\nReceipts: ${summary.receipts}\n\nShare లో Drive/WhatsApp/Files లో Save చేశారో చూసుకోండి.`,
      );
    } catch (error) {
      Alert.alert("Backup Failed", error.message);
    } finally {
      setBackupBusy(null);
    }
  };

  // Confirm + restore a validated backup ({payload, summary, fileName, exportedAt}) - used by file and Drive restore
  const confirmRestore = (picked, saveCurrentFirst = false, fromDrive = saveCurrentFirst) => {
    const { summary, fileName, exportedAt } = picked;
    const when = exportedAt ? new Date(exportedAt).toLocaleString() : "తెలియదు";
    Alert.alert(
      "Restore చేయాలా?",
      `${fileName}\nBackup తేదీ: ${when}\n\nSchools: ${summary.schools}\nItems: ${summary.items}\nReceipts: ${summary.receipts}\nInvoice counters: ${summary.serials}\n\nగమనిక: ప్రస్తుత data మొత్తం ఈ backup తో replace అవుతుంది.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            try {
              setBackupBusy("restore");
              if (saveCurrentFirst) {
                // Current data is saved to Drive first, so this restore can be undone by restoring that newest version
                try {
                  await DriveBackupService.backupBeforeRestore();
                } catch (e) {
                  const go = await new Promise((resolve) => Alert.alert(
                    "ప్రస్తుత data Drive కి save కాలేదు",
                    `${e.message}\n\nఅయినా Restore చేయాలా? (ప్రస్తుత data పోతుంది)`,
                    [
                      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                      { text: "Restore", style: "destructive", onPress: () => resolve(true) },
                    ],
                    { cancelable: false },
                  ));
                  if (!go) return;
                }
              }
              await BackupService.restore(picked.payload);
              if (fromDrive) await DriveBackupService.markSynced(); // restored data = that Drive backup
              await loadSettings();
              Alert.alert("Restore అయింది", "Data తిరిగి వచ్చింది.");
            } catch (e) {
              Alert.alert("Restore Failed", e.message);
            } finally {
              setBackupBusy(null);
            }
          },
        },
      ],
    );
  };

  const handleRestore = async () => {
    try {
      setBackupBusy("restore");
      const picked = await BackupService.pickBackup();
      if (!picked) return; // cancelled
      confirmRestore(picked);
    } catch (error) {
      Alert.alert("File Error", error.message);
    } finally {
      setBackupBusy(null);
    }
  };

  // ── Google Drive auto backup ──
  const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

  // Backup status banner: ok (green) | dirty = changes not backed up (orange) | old / never (red) | off (amber)
  // The newest of the Drive backup (only when Drive is ON) and the manual file backup counts.
  const backupStatus = (() => {
    if (!drive) return null;
    const srcs = [];
    if (drive.enabled && drive.lastBackupAt) srcs.push({ at: drive.lastBackupAt, label: "Drive" });
    if (drive.fileBackupAt) srcs.push({ at: drive.fileBackupAt, label: "File" });
    const newest = srcs.sort((x, y) => new Date(y.at) - new Date(x.at))[0];
    const act = !!drive.enabled; // "Backup now" button is for Drive only
    if (!newest) {
      if (!drive.enabled) return { kind: "off", icon: "cloud-off-outline", title: "Drive Backup ఆఫ్ లో ఉంది", sub: "Data భద్రత కోసం కింద Google Drive Backup ఆన్ చేయండి, లేదా File Backup తీసుకోండి." };
      return { kind: "bad", icon: "cloud-alert-outline", title: "ఇంకా Drive backup కాలేదు", sub: "ఇప్పుడే ఒకసారి Backup తీసుకోండి.", action: true };
    }
    const L = newest.label;
    const icon = (ok) => (L === "Drive" ? (ok ? "cloud-check-outline" : "cloud-alert-outline") : (ok ? "file-check-outline" : "file-alert-outline"));
    const days = Math.floor((Date.now() - new Date(newest.at).getTime()) / 86400000);
    if (days >= STALE_DAYS) return { kind: "bad", icon: icon(false), title: `చివరి ${L} backup ${days} రోజుల క్రితం`, sub: fmtWhen(newest.at) + (dirty ? " · కొత్త మార్పులూ ఉన్నాయి" : ""), action: act };
    if (dirty) return { kind: "dirty", icon: L === "Drive" ? "cloud-upload-outline" : "file-upload-outline", title: "మార్పులు ఇంకా Backup కాలేదు", sub: `చివరి ${L} backup: ${fmtWhen(newest.at)}. తప్పనిసరిగా Backup తీసుకోండి.`, action: act };
    return { kind: "ok", icon: icon(true), title: days === 0 ? `ఈ రోజు ${L} backup అయింది` : `చివరి ${L} backup ${days} రోజుల క్రితం`, sub: fmtWhen(newest.at) };
  })();

  const driveBackupNow = async (quiet) => {
    try {
      setDriveBusy("now");
      const { summary } = await DriveBackupService.backupNow();
      setDrive(await DriveBackupService.getMeta());
      setDirty(false);
      if (!quiet) {
        Alert.alert("Drive Backup అయింది", `Schools: ${summary.schools}\nItems: ${summary.items}\nReceipts: ${summary.receipts}`);
      }
    } catch (e) {
      setDrive(await DriveBackupService.getMeta());
      Alert.alert("Drive Backup Failed", e.message);
    } finally {
      setDriveBusy(null);
    }
  };

  // ── App Lock (PIN) ──
  const openPinFlow = (mode) => { setPinErr(""); setPinFlow({ mode, step: mode === "set" ? "new" : "verify" }); };
  const onPin = async (pin) => {
    const f = pinFlow;
    if (!f) return;
    try {
      if (f.step === "verify") {
        const r = await AppLockService.verify(pin);
        if (!r.ok) {
          setPinErr(r.wait ? `${r.wait} సెకన్ల తర్వాత ప్రయత్నించండి` : `తప్పు PIN${r.left != null ? ` (${r.left} ప్రయత్నాలు మిగిలాయి)` : ""}`);
          return;
        }
        setPinErr("");
        if (f.mode === "off") {
          await AppLockService.disable();
          setLockOn(false);
          setPinFlow(null);
          Alert.alert("App Lock ఆఫ్ అయింది", "ఇకపై app తెరవడానికి PIN అవసరం లేదు.");
        } else {
          setPinFlow({ mode: f.mode, step: "new" });
        }
      } else if (f.step === "new") {
        setPinErr("");
        setPinFlow({ ...f, step: "confirm", first: pin });
      } else if (f.step === "confirm") {
        if (pin !== f.first) {
          setPinErr("PIN సరిపోలలేదు. మళ్ళీ కొత్త PIN ఇవ్వండి.");
          setPinFlow({ ...f, step: "new", first: null });
          return;
        }
        const code = await AppLockService.enable(pin);
        setLockOn(true);
        setPinErr("");
        setPinFlow({ ...f, step: "code", code });
      }
    } catch (e) {
      Alert.alert("App Lock", e.message);
      setPinFlow(null);
    }
  };
  const pinTitle = () => {
    const s = pinFlow && pinFlow.step;
    return s === "verify" ? "ప్రస్తుత PIN ఇవ్వండి" : s === "new" ? "కొత్త 6 అంకెల PIN" : s === "confirm" ? "PIN మళ్ళీ ఇవ్వండి" : "";
  };

  const mailSupport = async () => {
    try {
      const body = `Drive Backup కోసం ఈ Gmail ఖాతాను నమోదు చేయండి: ${(denied && denied.email) || ""}`;
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("SRKVM Drive Backup access")}&body=${encodeURIComponent(body)}`);
    } catch {
      Alert.alert("Mail app లేదు", `ఈ చిరునామాకు మీ Gmail పంపండి:\n${SUPPORT_EMAIL}`);
    }
  };

  const enableDrive = async () => {
    let triedEmail = null;
    try {
      setDriveBusy("toggle");
      const email = await DriveBackupService.signIn();
      triedEmail = email;
      const remote = await DriveBackupService.remoteInfo();
      const finish = async (doBackup) => {
        setDrive(await DriveBackupService.setMeta({ enabled: true, email, lastError: null }));
        BackupReminder.enable(); // 7 PM daily reminder (asks notification permission once)
        if (doBackup) await driveBackupNow(true);
      };
      if (!remote) {
        await finish(true);
        return;
      }
      Alert.alert(
        "Drive లో backup ఉంది",
        `${email || ""}\nతేదీ: ${fmtWhen(remote.modifiedTime)}\n\nకొత్త phone అయితే ముందు Restore చేయండి. లేకపోతే Drive backup ఈ phone data తో replace అవుతుంది.`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => { DriveBackupService.signOut(); },
          },
          {
            text: "Restore చేయి",
            onPress: async () => {
              try {
                setDriveBusy("restore");
                const picked = await DriveBackupService.downloadBackup();
                await finish(false);
                confirmRestore(picked, false, true);
              } catch (e) {
                Alert.alert("Drive Restore Failed", e.message);
              } finally {
                setDriveBusy(null);
              }
            },
          },
          { text: "Replace చేయి", style: "destructive", onPress: () => finish(true) },
        ],
      );
    } catch (e) {
      if (isDriveDenied(e)) {
        DriveBackupService.signOut();
        setDenied({ kind: "denied", email: triedEmail, detail: e.message });
      } else if (isSignInCancelled(e)) {
        DriveBackupService.signOut();
        setDenied({ kind: "cancel", email: triedEmail, detail: e.message });
      } else {
        Alert.alert("Google Sign in Failed", e.message);
      }
    } finally {
      setDriveBusy(null);
    }
  };

  const toggleDrive = async (on) => {
    if (on) {
      await enableDrive();
    } else {
      setDriveBusy("toggle");
      try {
        setDrive(await DriveBackupService.setMeta({ enabled: false }));
        BackupReminder.disable();
        await DriveBackupService.signOut();
      } finally {
        setDriveBusy(null);
      }
    }
  };

  const driveRestore = async () => {
    try {
      setDriveBusy("restore");
      const list = await DriveBackupService.listBackups();
      if (list.length === 0) throw new Error("Drive లో backup లేదు.");
      setVersions(list);               // choose a version in the sheet below
    } catch (e) {
      Alert.alert("Drive Restore Failed", e.message);
    } finally {
      setDriveBusy(null);
    }
  };

  const pickVersion = async (v) => {
    setVersions(null);
    try {
      setDriveBusy("restore");
      const picked = await DriveBackupService.downloadBackup(v.id);
      confirmRestore(picked, true);
    } catch (e) {
      Alert.alert("Drive Restore Failed", e.message);
    } finally {
      setDriveBusy(null);
    }
  };

  const fmtSize = (n) => {
    const b = Number(n);
    if (!b) return "";
    return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
  };

  // Loading state
  if (!settings) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.hero}>
          <Text style={styles.heroSub}>Manage your app</Text>
          <Text style={styles.heroTitle}>Settings</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      {/* ── Hero (fixed on top) ── */}
        <SafeAreaView style={styles.hero} edges={["top"]}>
          <View style={styles.heroBlob} />
          <Text style={styles.heroSub}>Manage your app</Text>
          <Text style={styles.heroTitle}>Settings</Text>
          <Text style={styles.heroInfo}>
            {settings.shopName ? `${settings.shopName} Mandal` : "Mandal"} · {savedAY || "—"}
          </Text>
          <View style={styles.verPill}>
            <MaterialCommunityIcons name="shield-check-outline" size={13} color={Colors.primaryText} />
            <Text style={styles.verPillText}>SRKVM v{APP_VERSION}</Text>
          </View>
        </SafeAreaView>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.body}>
          {/* ── Status chips + App Guide ── */}
          <View style={styles.statRow}>
            {[
              { icon: "calendar-outline", label: "Academic Year", value: savedAY || "—" },
              { icon: "printer-outline", label: "Paper", value: settings.paperWidth === 42 ? "80mm" : "58mm" },
              { icon: "google-drive", label: "Drive Backup", value: drive && drive.enabled ? "ON" : "OFF", on: !!(drive && drive.enabled) },
            ].map((c) => (
              <View key={c.label} style={styles.statChip}>
                <MaterialCommunityIcons name={c.icon} size={18} color={c.on === false ? Colors.textMuted : Colors.primary} />
                <Text style={[styles.statValue, c.on === false && { color: Colors.textMuted }]}>{c.value}</Text>
                <Text style={styles.statLabel}>{c.label}</Text>
              </View>
            ))}
          </View>

          {backupStatus && (
            <View style={[styles.bkBanner, styles[`bk_${backupStatus.kind}`]]}>
              <MaterialCommunityIcons
                name={backupStatus.icon}
                size={26}
                color={backupStatus.kind === "bad" ? Colors.danger : backupStatus.kind === "dirty" ? "#C2410C" : backupStatus.kind === "off" ? Colors.highlightText : Colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.bkTitle}>{backupStatus.title}</Text>
                <Text style={styles.bkSub}>{backupStatus.sub}</Text>
              </View>
              {backupStatus.action && (
                <TouchableOpacity style={[styles.bkBtn, backupStatus.kind === "dirty" && styles.bkBtnDirty, !!driveBusy && { opacity: 0.55 }]} onPress={() => driveBackupNow(false)} disabled={!!driveBusy} activeOpacity={0.85}>
                  {driveBusy === "now" ? (
                    <ActivityIndicator size="small" color={Colors.primaryText} />
                  ) : (
                    <Text style={styles.bkBtnText}>ఇప్పుడే Backup</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.guideTile} onPress={() => navigation.navigate("Help")} activeOpacity={0.85}>
            <View style={styles.guideIcon}>
              <MaterialCommunityIcons name="book-open-variant" size={26} color={Colors.primaryText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.guideTitle}>App Guide · వాడుక సహాయం</Text>
              <Text style={styles.guideSub}>అన్ని features, వాటి వాడుక</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.primary} />
          </TouchableOpacity>

          {/* ── Mandal Info ── */}
          <Section icon="office-building-outline" bg={Colors.primaryLight} title="Mandal Information">
            <View style={styles.card}>
              <Field icon="bank-outline" label="Mandal Name">
                <TextInput
                  style={styles.input}
                  value={settings.shopName}
                  onChangeText={(v) => update("shopName", v)}
                  placeholder="e.g. Rajanagaram"
                  placeholderTextColor={Colors.textMuted}
                />
              </Field>
              <Field icon="phone-outline" label="Phone Number">
                <TextInput
                  style={styles.input}
                  value={settings.shopPhone}
                  onChangeText={(v) => update("shopPhone", v)}
                  placeholder="9999999999"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                />
              </Field>
              <Field icon="map-marker-outline" label="Address">
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={settings.shopAddress}
                  onChangeText={(v) => update("shopAddress", v)}
                  placeholder="Mandal, District"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                />
              </Field>
              <Field icon="calendar-outline" label="Academic Year (ఏప్రిల్–మార్చి)">
                <TextInput
                  style={styles.input}
                  value={settings.academicYear}
                  onChangeText={(v) =>
                    update("academicYear", v.replace(/[^0-9-]/g, ""))
                  }
                  placeholder="2026-27"
                  keyboardType="numbers-and-punctuation"
                  maxLength={7}
                  placeholderTextColor={Colors.textMuted}
                />
              </Field>
              <Field icon="receipt-text-outline" label="Receipt Footer">
                <TextInput
                  style={[styles.input, { marginBottom: 0 }]}
                  value={settings.shopTagline}
                  onChangeText={(v) => update("shopTagline", v)}
                  placeholder="Thank you! Visit Again."
                  placeholderTextColor={Colors.textMuted}
                />
              </Field>
            </View>
          </Section>

          {/* ── Printer Settings ── */}
          <Section icon="printer" bg="#E9F0DC" color="#5E7F43" title="Printer Settings">
            <View style={styles.card}>
              <View style={styles.labelRow}>
                <MaterialCommunityIcons name="ruler" size={15} color={Colors.textSecondary} />
                <Text style={styles.labelText}>Paper Width</Text>
              </View>
              <View style={styles.pillRow}>
                {[
                  { value: 32, label: "58mm", sub: "32 chars" },
                  { value: 42, label: "80mm", sub: "42 chars" },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.pill,
                      settings.paperWidth === item.value && styles.pillActive,
                    ]}
                    onPress={() => update("paperWidth", item.value)}
                  >
                    <Text
                      style={[
                        styles.pillLabel,
                        settings.paperWidth === item.value &&
                          styles.pillLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[
                        styles.pillSub,
                        settings.paperWidth === item.value && styles.pillSubActive,
                      ]}
                    >
                      {item.sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Section>

          {/* ── App Lock ── */}
          <Section icon="lock-outline" bg="#FBF3C9" color={Colors.highlightText} title="App Lock">
            <View style={styles.card}>
              <View style={styles.lockRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lockTitle}>6 అంకెల PIN తో app లాక్</Text>
                  <Text style={styles.lockSub}>
                    {lockOn ? "ఆన్ లో ఉంది. App తెరిచినప్పుడు, లేదా నిమిషానికి మించి background లో ఉన్నాక PIN అడుగుతుంది." : "ఫోన్ ఇతరుల చేతికి వెళ్ళినా data కనిపించకుండా ఉంటుంది."}
                  </Text>
                </View>
                <Switch value={lockOn} onValueChange={(on) => openPinFlow(on ? "set" : "off")} trackColor={{ true: Colors.primary }} />
              </View>
              {lockOn && (
                <TouchableOpacity style={styles.lockChange} onPress={() => openPinFlow("change")} activeOpacity={0.85}>
                  <MaterialCommunityIcons name="key-change" size={18} color={Colors.primary} />
                  <Text style={styles.lockChangeText}>PIN మార్చు</Text>
                </TouchableOpacity>
              )}
            </View>
          </Section>

          {/* ── Backup & Restore ── */}
          <Section icon="database-outline" bg={Colors.primaryLight} title="Backup & Restore">
            <View style={styles.card}>
              <Text style={styles.backupHint}>
                Schools, Items, Receipts, Settings, Invoice counter అన్నీ ఒక file గా
                Save చేయండి. App uninstall చేసే ముందు తప్పనిసరిగా Backup తీసుకోండి.
              </Text>
              <View style={styles.pillRow}>
                <TouchableOpacity
                  style={[styles.logoBtn, backupBusy && { opacity: 0.55 }]}
                  onPress={handleExport}
                  disabled={!!backupBusy}
                >
                  {backupBusy === "export" ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="upload" size={18} color={Colors.primary} />
                      <Text style={styles.logoBtnText}>Backup</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.logoBtn, backupBusy && { opacity: 0.55 }]}
                  onPress={handleRestore}
                  disabled={!!backupBusy}
                >
                  {backupBusy === "restore" ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="download" size={18} color={Colors.primary} />
                      <Text style={styles.logoBtnText}>Restore</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Google Drive auto backup */}
            <View style={[styles.card, { marginTop: Spacing.md }]}>
              <View style={styles.driveRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.driveTitleRow}>
                    <MaterialCommunityIcons name="cloud-outline" size={18} color={Colors.primary} />
                    <Text style={styles.driveTitle}>Google Drive Auto Backup</Text>
                  </View>
                  <Text style={styles.backupHint}>
                    ప్రతిరోజూ రాత్రి 7 తర్వాత (App తెరిచినప్పుడు) backup అవుతుంది. చివరి 15 backups Drive లో ఉంటాయి; Restore లో ఏ తేదీది కావాలో ఎంచుకోవచ్చు.
                  </Text>
                </View>
                {driveBusy === "toggle" ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Switch
                    trackColor={{ false: "#CFD6C9", true: Colors.accent }}
                    thumbColor={drive && drive.enabled ? Colors.primary : "#F4F4F4"}
                    value={!!(drive && drive.enabled)}
                    onValueChange={toggleDrive}
                    disabled={!!driveBusy}
                  />
                )}
              </View>
              {drive && drive.enabled && (
                <>
                  <Text style={styles.driveInfo}>Account: {drive.email || "—"}</Text>
                  <Text style={styles.driveInfo}>చివరి backup: {fmtWhen(drive.lastBackupAt)}</Text>
                  {!!drive.lastError && (
                    <View style={styles.driveErrRow}>
                      <MaterialCommunityIcons name="alert-outline" size={14} color={Colors.danger} />
                      <Text style={[styles.driveInfo, styles.driveErrText]}>{drive.lastError}</Text>
                    </View>
                  )}
                  <View style={[styles.pillRow, { marginTop: Spacing.sm }]}>
                    <TouchableOpacity
                      style={[styles.logoBtn, driveBusy && { opacity: 0.55 }]}
                      onPress={() => driveBackupNow(false)}
                      disabled={!!driveBusy}
                    >
                      {driveBusy === "now" ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="cloud-upload-outline" size={18} color={Colors.primary} />
                          <Text style={styles.logoBtnText}>ఇప్పుడే Backup</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.logoBtn, driveBusy && { opacity: 0.55 }]}
                      onPress={driveRestore}
                      disabled={!!driveBusy}
                    >
                      {driveBusy === "restore" ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="cloud-download-outline" size={18} color={Colors.primary} />
                          <Text style={styles.logoBtnText}>Drive Restore</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </Section>

          {/* Drive backup history (choose a version to restore) */}
          <Modal visible={!!pinFlow} animationType="fade" transparent onRequestClose={() => setPinFlow(null)}>
            <View style={styles.denOverlay}>
              <View style={styles.denCard}>
                {pinFlow && pinFlow.step === "code" ? (
                  <>
                    <View style={styles.denIcon}>
                      <MaterialCommunityIcons name="shield-key-outline" size={34} color={Colors.highlightText} />
                    </View>
                    <Text style={styles.denTitle}>Recovery code</Text>
                    <Text style={styles.lockCode}>{pinFlow.code}</Text>
                    <Text style={styles.denBody}>
                      ఈ code ను ఇప్పుడే ఒక కాగితం మీద రాసి భద్రంగా పెట్టుకోండి. PIN మర్చిపోతే ఇదే మార్గం. ఇది మళ్ళీ చూపించరు.
                    </Text>
                    <TouchableOpacity style={styles.denPrimary} onPress={() => { setPinFlow(null); Alert.alert("App Lock ఆన్ అయింది", "ఇకపై app తెరిచినప్పుడు PIN అడుగుతుంది."); }} activeOpacity={0.85}>
                      <Text style={styles.denPrimaryText}>రాసుకున్నాను</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <PinPad key={pinFlow ? pinFlow.step : "x"} title={pinTitle()} subtitle={pinFlow && pinFlow.mode === "off" ? "App Lock ఆఫ్ చేయడానికి" : undefined} error={pinErr} onComplete={onPin} />
                    <TouchableOpacity style={styles.denSecondary} onPress={() => setPinFlow(null)} activeOpacity={0.85}>
                      <Text style={styles.denSecondaryText}>రద్దు</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </Modal>

          <Modal visible={!!denied} animationType="fade" transparent onRequestClose={() => setDenied(null)}>
            <View style={styles.denOverlay}>
              <View style={styles.denCard}>
                <View style={styles.denIcon}>
                  <MaterialCommunityIcons name="account-lock-outline" size={34} color={Colors.highlightText} />
                </View>
                <Text style={styles.denTitle}>
                  {denied && denied.kind === "cancel" ? "Google Sign in పూర్తి కాలేదు" : "ఈ సదుపాయం మీ ఖాతాకు ఇంకా ఇవ్వలేదు"}
                </Text>
                {!!(denied && denied.email) && <Text style={styles.denEmail}>{denied.email}</Text>}
                <Text style={styles.denBody}>
                  {denied && denied.kind === "cancel"
                    ? "మీరే sign in రద్దు చేసి ఉంటే మళ్ళీ ప్రయత్నించండి. Google లో \"Access blocked\" అని వచ్చి ఉంటే, ఈ Gmail ఖాతా Drive Backup కోసం నమోదు కాలేదు. ఈ సదుపాయం కావాలంటే ఈ చిరునామాను సంప్రదించండి:"
                    : "ఈ Gmail ఖాతా Drive Backup కోసం నమోదు కాలేదు. ఈ సదుపాయం కావాలంటే ఈ చిరునామాను సంప్రదించండి:"}
                </Text>
                <Text style={styles.denMail}>{SUPPORT_EMAIL}</Text>
                <Text style={styles.denNote}>మీ Gmail చిరునామా చెప్తే నమోదు చేస్తాం. అప్పటివరకు పైన ఉన్న Backup / Restore తో file రూపంలో data భద్రపరచుకోవచ్చు.</Text>
                <TouchableOpacity style={styles.denPrimary} onPress={mailSupport} activeOpacity={0.85}>
                  <MaterialCommunityIcons name="email-outline" size={18} color={Colors.primaryText} />
                  <Text style={styles.denPrimaryText}>Mail పంపండి</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.denSecondary} onPress={() => setDenied(null)} activeOpacity={0.85}>
                  <Text style={styles.denSecondaryText}>సరే</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal visible={!!versions} animationType="slide" transparent onRequestClose={() => setVersions(null)}>
            <View style={styles.verOverlay}>
              <View style={[styles.verSheet, { paddingBottom: Spacing.lg + insets.bottom }]}>
                <View style={styles.verTitleRow}>
                  <MaterialCommunityIcons name="history" size={22} color={Colors.primaryDark} />
                  <Text style={styles.verTitle}>ఏ Backup Restore చేయాలి?</Text>
                </View>
                <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                  {(versions || []).map((v, i) => (
                    <TouchableOpacity key={v.id} style={styles.verRow} onPress={() => pickVersion(v)} activeOpacity={0.8}>
                      <MaterialCommunityIcons name="cloud-outline" size={20} color={Colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.verWhen}>{fmtWhen(v.modifiedTime)}</Text>
                        <Text style={styles.verSub}>{[i === 0 ? "తాజా backup" : "", fmtSize(v.size)].filter(Boolean).join("  ·  ")}</Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.verClose} onPress={() => setVersions(null)}>
                  <Text style={styles.verCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* ── Save Button ── */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.primaryText} />
            ) : (
              <>
                <MaterialCommunityIcons name="content-save-outline" size={20} color={Colors.primaryText} />
                <Text style={styles.saveBtnText}>Save Settings</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.footerCredit}>{APP_CREDITS}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { paddingBottom: Spacing.xl },
  body: { padding: Spacing.lg, gap: Spacing.md },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Hero
  hero: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  heroBlob: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -70,
    right: -50,
  },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.75)" },
  heroTitle: { fontSize: 24, fontWeight: "800", color: Colors.primaryText, marginTop: 2 },
  heroInfo: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 4 },
  verPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  verPillText: { fontSize: 11, fontWeight: "700", color: Colors.primaryText },

  // Status chips + guide tile
  statRow: { flexDirection: "row", gap: Spacing.sm },
  statChip: {
    flex: 1,
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: Spacing.md,
    gap: 2,
  },
  statValue: { fontSize: 14, fontWeight: "800", color: Colors.primary, marginTop: 2 },
  statLabel: { fontSize: 10, color: Colors.textMuted },
  bkBanner: { flexDirection: "row", alignItems: "center", gap: Spacing.md, borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.md },
  bk_ok: { backgroundColor: Colors.primaryLight, borderColor: Colors.cardBorder },
  bk_bad: { backgroundColor: Colors.dangerBg, borderColor: Colors.danger },
  bk_dirty: { backgroundColor: "#FFEDD5", borderColor: "#F97316" },
  bkBtnDirty: { backgroundColor: "#EA580C" },
  bk_off: { backgroundColor: Colors.warm, borderColor: Colors.cardBorder },
  bkTitle: { fontSize: 13, fontWeight: "800", color: Colors.textPrimary },
  bkSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  bkBtn: { backgroundColor: Colors.danger, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.lg, minWidth: 92, alignItems: "center" },
  bkBtnText: { color: Colors.primaryText, fontWeight: "800", fontSize: 12 },
  guideTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
  },
  guideIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  guideTitle: { fontSize: 15, fontWeight: "800", color: Colors.textPrimary },
  guideSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  footerCredit: { textAlign: "center", fontSize: 11, color: Colors.textMuted, marginTop: Spacing.sm },

  // Sections
  section: { gap: Spacing.sm },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  sectionBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: Colors.textPrimary },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
  },

  // Inputs
  field: { marginBottom: Spacing.md },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: Spacing.xs + 2 },
  labelText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  inputMultiline: { height: 70, textAlignVertical: "top" },

  // Pills (paper width)
  pillRow: { flexDirection: "row", gap: Spacing.sm },
  pill: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  pillActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  pillLabel: { fontSize: 15, fontWeight: "800", color: Colors.textMuted },
  pillLabelActive: { color: Colors.primary },
  pillSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  pillSubActive: { color: Colors.primary },

  // Backup / Restore buttons
  logoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    backgroundColor: Colors.primaryLight,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  logoBtnText: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  driveRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  driveTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  driveTitle: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary },
  driveErrRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  driveErrText: { color: Colors.danger, marginTop: 0, flexShrink: 1 },
  lockRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  lockTitle: { fontSize: 14, fontWeight: "800", color: Colors.textPrimary },
  lockSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  lockChange: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, marginTop: Spacing.md, paddingVertical: Spacing.sm + 2, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.primary },
  lockChangeText: { color: Colors.primary, fontWeight: "700", fontSize: 13 },
  lockCode: { fontSize: 28, fontWeight: "800", letterSpacing: 4, color: Colors.primaryDark, marginTop: Spacing.md },
  denOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: Spacing.xl },
  denCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: "center" },
  denIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: Colors.warm, alignItems: "center", justifyContent: "center", marginBottom: Spacing.md },
  denTitle: { fontSize: 17, fontWeight: "800", color: Colors.primaryDark, textAlign: "center" },
  denEmail: { fontSize: 12, color: Colors.textMuted, marginTop: Spacing.xs },
  denBody: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 20, marginTop: Spacing.md },
  denMail: { fontSize: 14, fontWeight: "800", color: Colors.primary, marginTop: Spacing.sm },
  denNote: { fontSize: 11, color: Colors.textMuted, textAlign: "center", lineHeight: 17, marginTop: Spacing.md },
  denPrimary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, alignSelf: "stretch", backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: Radius.lg, marginTop: Spacing.lg },
  denPrimaryText: { color: Colors.primaryText, fontWeight: "800", fontSize: 14 },
  denSecondary: { alignSelf: "stretch", alignItems: "center", backgroundColor: Colors.background, padding: Spacing.md, borderRadius: Radius.lg, marginTop: Spacing.sm },
  denSecondaryText: { color: Colors.textSecondary, fontWeight: "600" },
  verOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  verSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg },
  verTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: Spacing.md },
  verTitle: { fontSize: 18, fontWeight: "800", color: Colors.primaryDark, flexShrink: 1 },
  verRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: Colors.cardBorder },
  verWhen: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary },
  verSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  verClose: { backgroundColor: Colors.background, padding: Spacing.md, borderRadius: Radius.md, alignItems: "center", marginTop: Spacing.md },
  verCloseText: { color: Colors.textSecondary, fontWeight: "600" },
  driveInfo: { ...Typography.bodySm, marginTop: 2 },
  backupHint: { ...Typography.bodySm, marginBottom: Spacing.md, lineHeight: 17 },

  // Save button
  saveBtn: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    marginTop: Spacing.sm,
    elevation: 3,
    marginBottom: 50,
  },
  saveBtnDisabled: { backgroundColor: "#9DB89F" },
  saveBtnText: { color: Colors.primaryText, fontWeight: "800", fontSize: 15 },
});