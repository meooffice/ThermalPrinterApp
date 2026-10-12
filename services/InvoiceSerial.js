// services/InvoiceSerial.js
// Invoice numbers per ACADEMIC year: "2026-27/0001". The counter only moves forward when a receipt
// has really been issued: nextNumber() just LOOKS at the next number; the receipt screen saves the
// receipt and the counter together (commitPair) after printing succeeded.
// Storage key: 'invoice_serial_<academicYear>' (old calendar-year keys 'invoice_serial_2026' are no longer used).
import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (ay) => `invoice_serial_${ay}`;

const InvoiceSerial = {
  format(ay, n) {
    return `${ay}/${String(n).padStart(4, '0')}`;
  },

  /** Last number issued in this academic year (0 if none). Read errors are thrown, never treated as 0. */
  async current(ay) {
    const stored = await AsyncStorage.getItem(key(ay));
    const n = stored ? parseInt(stored, 10) : 0;
    if (isNaN(n)) throw new Error('Invoice counter పాడైంది.');
    return n;
  },

  /** The number the next receipt will use. Does NOT save anything. */
  async nextNumber(ay) {
    return (await this.current(ay)) + 1;
  },

  /** [key, value] pair to be written in the same multiSet as the receipt (atomic). */
  commitPair(ay, n) {
    return [key(ay), String(n)];
  },

  /** Fallback: move the counter forward on its own (never backwards). */
  async commit(ay, n) {
    if (n > (await this.current(ay))) await AsyncStorage.setItem(key(ay), String(n));
  },

  /** Manual correction (admin). */
  async set(ay, number) {
    await AsyncStorage.setItem(key(ay), String(number));
  },
};

export default InvoiceSerial;