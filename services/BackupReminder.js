// services/BackupReminder.js
// Daily 7 PM local notification: "Backup సమయం - App తెరవండి". Tapping it opens the app, and App.js then runs
// DriveBackupService.runIfDue(). The notification itself does not upload anything.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const ID      = 'daily-backup-reminder';
const CHANNEL = 'backup';
const HOUR    = 19;
const MINUTE  = 0;

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

const schedule = async () => {
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: {
      title: 'SRKVM Backup సమయం',
      body: 'Data సురక్షితంగా ఉండాలంటే App తెరవండి, Drive కి Backup అవుతుంది.',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: HOUR, minute: MINUTE, channelId: CHANNEL },
  });
};

class BackupReminder {
  // Called when the user turns Auto Backup ON (asks permission once). Returns true if scheduled.
  async enable() {
    try {
      await setup();
      let { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
      if (status !== 'granted') return false;
      await schedule();
      return true;
    } catch {
      return false; // reminder is optional; backup itself must never fail because of it
    }
  }

  // Called when the user turns Auto Backup OFF
  async disable() {
    try { await Notifications.cancelScheduledNotificationAsync(ID); } catch { /* ignore */ }
  }

  // On every app start: re-create the schedule if Auto Backup is ON and permission already exists (no prompt)
  async sync(enabled) {
    try {
      await setup();
      if (!enabled) { await this.disable(); return; }
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') await schedule();
    } catch { /* ignore */ }
  }
}

export default new BackupReminder();