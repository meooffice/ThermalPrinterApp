// services/BluetoothService.js
import RNBluetoothClassic from 'react-native-bluetooth-classic';

class BluetoothService {
  constructor() {
    this.connectedDevice = null;
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