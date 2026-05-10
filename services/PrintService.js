// services/PrintService.js
import * as Notifications from 'expo-notifications';
import BluetoothService from './BluetoothService';
import EscPosEncoder from './EscPosEncoder';
import SettingsService from './SettingsService';

// Notification channels setup
export async function setupNotifications() {
  await Notifications.setNotificationChannelAsync('print-status', {
    name: 'Print Status',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4f46e5',
  });
}

// Show notification helper
async function showNotification(title, body, type = 'default') {
  const channelId = 'print-status';
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      color: type === 'error' ? '#ef4444' : '#4f46e5',
    },
    trigger: null, // immediate
    identifier: channelId,
  });
}

// Build ESC/POS receipt from intent data
function buildReceiptFromData(data, settings) {
  const encoder = new EscPosEncoder();
  const width = settings?.paperWidth || 32;
  const mandal = settings?.shopName || 'Mandal';

  encoder.initialize();

  // Header
  encoder
    .align('center')
    .bold(true).size('double')
    .text('SRKVM Kits').newline()
    .size('normal')
    .text(`${mandal} Mandal`).newline()
    .bold(false)
    .divider('=', width);

  // Date & Spell
  const now = new Date();
  encoder
    .align('left')
    .text(`Date : ${now.toLocaleDateString()}`).newline()
    .text(`Time : ${now.toLocaleTimeString()}`).newline()
    .bold(true)
    .text(`Spell: Spell ${data.spell || 1}`).newline()
    .bold(false)
    .divider('-', width);

  // School info
  encoder
    .bold(true).text('School:').bold(false).newline()
    .text(data.school_name || '').newline();

  if (data.udise) {
    encoder.text(`UDISE : ${data.udise}`).newline();
  }

  encoder.divider('-', width);

  // Items
  const countCol = 6;
  const nameCol  = width - countCol - 1;
  encoder
    .bold(true)
    .text('Item'.padEnd(nameCol) + 'Count').newline()
    .bold(false)
    .divider('-', width);

  const items = data.items || [];
  items.forEach(item => {
    const name  = (item.name || '').substring(0, nameCol).padEnd(nameCol);
    const count = String(item.count || 0).padStart(countCol);
    encoder.text(name + count).newline();
  });

  // Totals
  const totalQty = items.reduce((sum, i) => sum + parseInt(i.count || 0), 0);
  encoder
    .divider('-', width)
    .row('Total Items :', String(items.length), width)
    .bold(true)
    .row('Total Qty   :', String(totalQty), width)
    .bold(false)
    .divider('=', width);

  // Signature
  encoder
    .align('left')
    .text('Received By:').newline()
    .newline()
    .text('Name : ____________________').newline()
    .newline()
    .text('Sign : ____________________').newline()
    .divider('=', width)
    .align('center')
    .text(settings?.shopTagline || 'Thank you!').newline()
    .newline(3)
    .cut();

  return encoder.encodeBase64();
}

// Main silent print function
export async function silentPrint(jsonData) {
  try {
    // Parse data
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    const copies = parseInt(data.copies || 1);
    const schoolName = data.school_name || 'Unknown School';

    // Notification: Print starting
    await showNotification(
      '🖨️ Printing Started',
      `${schoolName} — Spell ${data.spell || 1}`,
      'info'
    );

    // Check bluetooth connection
    const connected = await BluetoothService.isConnected();
    if (!connected) {
      await showNotification(
        '❌ Print Failed',
        'Printer not connected. Please connect in T-Print app.',
        'error'
      );
      return { success: false, error: 'Printer not connected' };
    }

    // Load settings
    const settings = await SettingsService.get();

    // Build receipt
    const receiptData = buildReceiptFromData(data, settings);

    // Print copies
    for (let i = 0; i < copies; i++) {
      await BluetoothService.sendBase64(receiptData);
      if (i < copies - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // Notification: Success
    await showNotification(
      '✅ Print Successful',
      `${schoolName} — ${copies} copy printed successfully!`,
      'success'
    );

    return { success: true };

  } catch (error) {
    // Notification: Error
    await showNotification(
      '❌ Print Failed',
      `Error: ${error.message}`,
      'error'
    );
    return { success: false, error: error.message };
  }
}