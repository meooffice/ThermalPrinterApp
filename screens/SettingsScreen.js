// screens/SettingsScreen.js
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Switch,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import SettingsService from "../services/SettingsService";
import { Colors, Radius, Spacing, Typography } from "../constants/Theme";
import BackupService from "../services/BackupService";
import DriveBackupService from "../services/DriveBackupService";
import BackupReminder from "../services/BackupReminder";
import { isValidAcademicYear } from "../services/AcademicYear";

// Defined OUTSIDE the screen so inputs keep focus while typing (no remount on each state change)
const Field = ({ icon, label, children }) => (
  <View style={styles.field}>
    <Text style={styles.inputLabel}>{icon}  {label}</Text>
    {children}
  </View>
);

const Section = ({ icon, bg, title, children }) => (
  <View style={styles.section}>
    <View style={styles.sectionHead}>
      <View style={[styles.sectionBadge, { backgroundColor: bg }]}>
        <Text style={styles.sectionBadgeIcon}>{icon}</Text>
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

export default function SettingsScreen({ navigation }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAY, setSavedAY] = useState(null); // Academic Year as saved
  const [backupBusy, setBackupBusy] = useState(null); // null | 'export' | 'restore'
  const [drive, setDrive] = useState(null); // Drive auto-backup meta
  const [driveBusy, setDriveBusy] = useState(null); // null | 'toggle' | 'now' | 'restore'
  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, []),
  );

  const loadSettings = async () => {
    const s = await SettingsService.get();
    setSettings(s);
    setSavedAY(s.academicYear);
    setDrive(await DriveBackupService.getMeta());
  };

  const update = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const doSave = async () => {
    try {
      setSaving(true);
      await SettingsService.save(settings);
      setSavedAY(settings.academicYear);
      Alert.alert("✅ Saved", "Settings saved successfully!");
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
      Alert.alert(
        "✅ Backup సిద్ధం",
        `${fileName}\n\nSchools: ${summary.schools}\nItems: ${summary.items}\nReceipts: ${summary.receipts}\n\nShare లో Drive/WhatsApp/Files లో Save చేశారో చూసుకోండి.`,
      );
    } catch (error) {
      Alert.alert("❌ Backup Failed", error.message);
    } finally {
      setBackupBusy(null);
    }
  };

  // Confirm + restore a validated backup ({payload, summary, fileName, exportedAt}) - used by file and Drive restore
  const confirmRestore = (picked) => {
    const { summary, fileName, exportedAt } = picked;
    const when = exportedAt ? new Date(exportedAt).toLocaleString() : "తెలియదు";
    Alert.alert(
      "Restore చేయాలా?",
      `${fileName}\nBackup తేదీ: ${when}\n\nSchools: ${summary.schools}\nItems: ${summary.items}\nReceipts: ${summary.receipts}\nInvoice counters: ${summary.serials}\n\n⚠️ ప్రస్తుత data మొత్తం ఈ backup తో replace అవుతుంది.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            try {
              setBackupBusy("restore");
              await BackupService.restore(picked.payload);
              await loadSettings();
              Alert.alert("✅ Restore అయింది", "Data తిరిగి వచ్చింది.");
            } catch (e) {
              Alert.alert("❌ Restore Failed", e.message);
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
      Alert.alert("❌ File Error", error.message);
    } finally {
      setBackupBusy(null);
    }
  };

  // ── Google Drive auto backup ──
  const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

  const driveBackupNow = async (quiet) => {
    try {
      setDriveBusy("now");
      const { summary } = await DriveBackupService.backupNow();
      setDrive(await DriveBackupService.getMeta());
      if (!quiet) {
        Alert.alert("✅ Drive Backup అయింది", `Schools: ${summary.schools}\nItems: ${summary.items}\nReceipts: ${summary.receipts}`);
      }
    } catch (e) {
      setDrive(await DriveBackupService.getMeta());
      Alert.alert("❌ Drive Backup Failed", e.message);
    } finally {
      setDriveBusy(null);
    }
  };

  const enableDrive = async () => {
    try {
      setDriveBusy("toggle");
      const email = await DriveBackupService.signIn();
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
                confirmRestore(picked);
              } catch (e) {
                Alert.alert("❌ Drive Restore Failed", e.message);
              } finally {
                setDriveBusy(null);
              }
            },
          },
          { text: "Replace చేయి", style: "destructive", onPress: () => finish(true) },
        ],
      );
    } catch (e) {
      Alert.alert("❌ Google Sign in Failed", e.message);
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
      const picked = await DriveBackupService.downloadBackup();
      confirmRestore(picked);
    } catch (e) {
      Alert.alert("❌ Drive Restore Failed", e.message);
    } finally {
      setDriveBusy(null);
    }
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
        </SafeAreaView>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.body}>
          {/* ── Mandal Info ── */}
          <Section icon="🏢" bg="#EEF2FF" title="Mandal Information">
            <View style={styles.card}>
              <Field icon="🏛️" label="Mandal Name">
                <TextInput
                  style={styles.input}
                  value={settings.shopName}
                  onChangeText={(v) => update("shopName", v)}
                  placeholder="e.g. Rajanagaram"
                  placeholderTextColor={Colors.textMuted}
                />
              </Field>
              <Field icon="📞" label="Phone Number">
                <TextInput
                  style={styles.input}
                  value={settings.shopPhone}
                  onChangeText={(v) => update("shopPhone", v)}
                  placeholder="9999999999"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                />
              </Field>
              <Field icon="📍" label="Address">
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={settings.shopAddress}
                  onChangeText={(v) => update("shopAddress", v)}
                  placeholder="Mandal, District"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                />
              </Field>
              <Field icon="📅" label="Academic Year (ఏప్రిల్–మార్చి)">
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
              <Field icon="🧾" label="Receipt Footer">
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
          <Section icon="🖨️" bg="#ECFDF5" title="Printer Settings">
            <View style={styles.card}>
              <Text style={styles.inputLabel}>📏  Paper Width</Text>
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

          {/* ── Manage ── */}
          <Section icon="⚙️" bg="#FFF7ED" title="Manage">
            <View style={styles.manageRow}>
              <TouchableOpacity
                style={styles.manageTile}
                onPress={() => navigation.navigate("Schools")}
                activeOpacity={0.8}
              >
                <View style={[styles.manageIcon, { backgroundColor: "#EEF2FF" }]}>
                  <Text style={styles.manageEmoji}>🏫</Text>
                </View>
                <Text style={styles.manageTitle}>Schools</Text>
                <Text style={styles.manageSub}>Add · Edit · Upload</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.manageTile}
                onPress={() => navigation.navigate("Catalog")}
                activeOpacity={0.8}
              >
                <View style={[styles.manageIcon, { backgroundColor: "#F0FDF4" }]}>
                  <Text style={styles.manageEmoji}>🎒</Text>
                </View>
                <Text style={styles.manageTitle}>Item Catalog</Text>
                <Text style={styles.manageSub}>Add · Edit · Upload</Text>
              </TouchableOpacity>
            </View>
          </Section>

          {/* ── Backup & Restore ── */}
          <Section icon="💾" bg="#FEF3C7" title="Backup & Restore">
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
                      <Text style={styles.logoBtnIcon}>📤</Text>
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
                      <Text style={styles.logoBtnIcon}>📥</Text>
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
                  <Text style={styles.driveTitle}>☁️ Google Drive Auto Backup</Text>
                  <Text style={styles.backupHint}>
                    ప్రతిరోజూ రాత్రి 7 తర్వాత (App తెరిచినప్పుడు) latest backup మాత్రమే Drive లో ఉంటుంది.
                  </Text>
                </View>
                {driveBusy === "toggle" ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Switch
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
                    <Text style={[styles.driveInfo, { color: Colors.danger || "#DC2626" }]}>⚠️ {drive.lastError}</Text>
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
                        <Text style={styles.logoBtnText}>☁️ ఇప్పుడే Backup</Text>
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
                        <Text style={styles.logoBtnText}>📥 Drive Restore</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </Section>

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
                <Text style={styles.saveBtnIcon}>💾</Text>
                <Text style={styles.saveBtnText}>Save Settings</Text>
              </>
            )}
          </TouchableOpacity>
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
  heroTitle: { fontSize: 24, fontWeight: "800", color: "#fff", marginTop: 2 },
  heroInfo: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 4 },

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
  sectionBadgeIcon: { fontSize: 15 },
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
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: Spacing.xs + 2,
  },
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

  // Manage tiles
  manageRow: { flexDirection: "row", gap: Spacing.sm },
  manageTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  manageIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  manageEmoji: { fontSize: 24 },
  manageTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  manageSub: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

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
  logoBtnIcon: { fontSize: 15 },
  logoBtnText: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  driveRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  driveTitle: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary, marginBottom: 2 },
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
  saveBtnDisabled: { backgroundColor: "#a5b4fc" },
  saveBtnIcon: { fontSize: 16 },
  saveBtnText: { color: Colors.primaryText, fontWeight: "800", fontSize: 15 },
});