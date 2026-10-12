// services/PrinterFilter.js
// Decides whether a Bluetooth device looks like a (thermal) printer. Display-only helper:
// it never touches the connection or the print path.
//
// 1) Bluetooth major class "Imaging" (0x0600 = 1536) is what printers report.
// 2) Many cheap thermal printers report a wrong class, so the name is checked as well.
// Devices that match neither can still be shown with the "show all devices" toggle.

const IMAGING_MAJOR_CLASS = 0x0600;

const NAME_PATTERNS = [
  /print/i, /thermal/i, /receipt/i, /\bpos\b/i,
  /^ec[-_ ]?\d/i, /^bt[-_ ]?\d/i, /^bt[-_ ]?print/i,
  /^(mpt|mtp|rpp|rp|pt|xp|gp|zj|hm|spp|mht|kp|sp)[-_ ]?\d/i,
  /^(mpt|mtp|rpp|mht)/i,
  /\b(58|80)\s?mm\b/i,
];

export function isPrinterDevice(device) {
  if (!device) return false;
  const major = device.deviceClass?.majorClass;
  if (major === IMAGING_MAJOR_CLASS) return true;
  const name = (device.name || '').trim();
  return name.length > 0 && NAME_PATTERNS.some(re => re.test(name));
}