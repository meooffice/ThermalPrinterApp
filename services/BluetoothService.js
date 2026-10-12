// services/BluetoothService.js
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNBluetoothClassic from 'react-native-bluetooth-classic';

const LAST_PRINTER_KEY = 'last_printer';   // { name, address } of the last printer connected by the user
const RECONNECT_TIMEOUT_MS = 8000;

class BluetoothService {
  constructor() {
    this.connectedDevice = null;
    this._reconnecting = null;   // running reconnect (shared, so two callers never connect twice)
  }

  // Check if Bluetooth is enabled, prompt if not
  async requestEnable() {
    const enabled = await RNBluetoothClassic.isBluetoothEnabled();
    if (!enabled) {
      await RNBluetoothClassic.requestBluetoothEnabled();
    }
    return await RNBluetoothClassic.isBluetoothEnabled();
  }

  // Get already paired devices
  async getPairedDevices() {
    return await RNBluetoothClassic.getBondedDevices();
  }

  // Scan for new nearby devices
  async startDiscovery() {
    return await RNBluetoothClassic.startDiscovery();
  }

  async cancelDiscovery() {
    return await RNBluetoothClassic.cancelDiscovery();
  }

  // Connect to a device by its address
  async connect(device) {
    try {
      if (this.connectedDevice) {
        await this.disconnect();
      }
      this.connectedDevice = await RNBluetoothClassic.connectToDevice(
        device.address
      );
      // remember it for auto-reconnect (failure to save must never break connecting)
      try {
        await AsyncStorage.setItem(
          LAST_PRINTER_KEY,
          JSON.stringify({ name: device.name || this.connectedDevice?.name || '', address: device.address })
        );
      } catch { /* ignore */ }
      return this.connectedDevice;
    } catch (error) {
      this.connectedDevice = null;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.connectedDevice) {
        await this.connectedDevice.disconnect();
      }
    } finally {
      this.connectedDevice = null;
    }
  }

  // The user chose to disconnect: do not auto-reconnect to this printer any more
  async forgetLastPrinter() {
    try { await AsyncStorage.removeItem(LAST_PRINTER_KEY); } catch { /* ignore */ }
  }

  async isConnected() {
    try {
      if (!this.connectedDevice) return false;
      return await this.connectedDevice.isConnected();
    } catch {
      return false;
    }
  }

  getConnectedDevice() {
    return this.connectedDevice;
  }

  // One silent attempt to connect to the last printer. Never asks for permission or turns Bluetooth on.
  // Returns true / false, never throws.
  reconnectLast() {
    if (this._reconnecting) return this._reconnecting;
    this._reconnecting = this._reconnectLast().finally(() => { this._reconnecting = null; });
    return this._reconnecting;
  }

  async _reconnectLast() {
    try {
      const raw = await AsyncStorage.getItem(LAST_PRINTER_KEY);
      if (!raw) return false;
      const last = JSON.parse(raw);
      if (!last || !last.address) return false;

      if (Platform.OS === 'android' && Platform.Version >= 31) {
        const ok = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
        if (!ok) return false;
      }
      if (!(await RNBluetoothClassic.isBluetoothEnabled())) return false;

      // a dead link may still leave an old device object: drop it first (connect() would throw on it)
      try { await this.disconnect(); } catch { /* ignore */ }

      let timer;
      const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), RECONNECT_TIMEOUT_MS); });
      try {
        await Promise.race([this.connect(last), timeout]);
      } finally {
        clearTimeout(timer);
      }
      return await this.isConnected();
    } catch {
      return false;
    }
  }

  // Already connected, or the last printer could be reconnected
  async ensureConnected() {
    if (await this.isConnected()) return true;
    return await this.reconnectLast();
  }

  // Send raw base64 encoded bytes to the printer
  async sendBase64(base64String) {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }
    const connected = await this.isConnected();
    if (!connected) {
      throw new Error('Device is not connected');
    }
    await this.connectedDevice.write(base64String, 'base64');
  }
}

// Export as singleton
export default new BluetoothService();