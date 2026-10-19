// services/BackupReminder.js
// 7 PM local notification: "Backup సమయం - App తెరవండి". Tapping it opens the app, and App.js then runs
// DriveBackupService.runIfDue(). The notification itself does not upload anything.
// Scheduled as one notification per day for the next DAYS days (re-created on every app start and after every backup),
// so that today's reminder can be skipped when a backup was already taken today.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const OLD_ID  = 'daily-backup-reminder';   // earlier versions used one repeating (DAILY) notification
const PREFIX  = 'backup-reminder-';
const CHANNEL = 'backup';
const HOUR    = 19;
const MINUTE  = 0;
const DAYS    = 14;

let handlerSet = false;
const setup = async () => {
  if (!handlerSet) {
    // App open at 7 PM: backup runs by itself, so no banner is needed
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
    });
    handlerSet = true;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Daily Backup Reminder',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
};

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const ours = async () => {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.filter(n => n.identifier === OLD_ID || String(n.identifier).startsWith(PREFIX));
};

const cancelAll = async () => {
  for (const n of await ours()) {
    await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
  }
};

// lastBackupAt: ISO string of the last successful Drive backup (or null). A backup taken today skips today's reminder.
const schedule = async (lastBackupAt) => {
  await cancelAll();
  const now = new Date();
  const doneToday = !!lastBackupAt && sameDay(new Date(lastBackupAt), now);
  for (let i = 0; i < DAYS; i++) {
    const when = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, HOUR, MINUTE, 0, 0);
    if (when.getTime() <= now.getTime()) continue;          // 7 PM already passed today
    if (i === 0 && doneToday) continue;                     // backup already taken today
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIX}${i}`,
      content: {
        title: 'SRKVM Backup సమయం',
        body: 'Data సురక్షితంగా ఉండాలంటే App తెరవండి, Drive కి Backup అవుతుంది.',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
    });
  }
};

class BackupReminder {
  // Called when the user turns Auto Backup ON (asks permission once). Returns true if scheduled.
  async enable(lastBackupAt = null) {
    try {
      await setup();
      let { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
      if (status !== 'granted') return false;
      await schedule(lastBackupAt);
      return true;
    } catch {
      return false; // reminder is optional; backup itself must never fail because of it
    }
  }

  // Called when the user turns Auto Backup OFF
  async disable() {
    try { await cancelAll(); } catch { /* ignore */ }
  }

  // On every app start: re-create the schedule if Auto Backup is ON and permission already exists (no prompt)
  async sync(enabled, lastBackupAt = null) {
    try {
      await setup();
      if (!enabled) { await this.disable(); return; }
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') await schedule(lastBackupAt);
    } catch { /* ignore */ }
  }

  // After every successful Drive backup: if reminders are currently scheduled, rebuild them (skips today's if still pending)
  async onBackedUp(at) {
    try {
      if ((await ours()).length === 0) return;               // reminders are off (or no permission): leave as is
      await schedule(at);
    } catch { /* ignore */ }
  }
}

export default new BackupReminder();