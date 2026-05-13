// theme.js — T-Print Android Design Tokens
// Place this file at: src/theme.js (or constants/theme.js)

export const Colors = {
  primary: '#4338ca',       // Indigo-700 — main brand
  primaryDark: '#3730a3',   // Indigo-800 — header/status bar
  primaryLight: '#ede9fe',  // Indigo-100 — chips, step buttons
  primaryText: '#fff',

  surface: '#ffffff',
  background: '#f3f4f6',    // Gray-100 — screen bg
  cardBorder: '#e5e7eb',    // Gray-200

  textPrimary: '#111827',
  textSecondary: '#374151',
  textMuted: '#9ca3af',
  textAccent: '#4338ca',

  success: '#16a34a',
  successBg: '#dcfce7',
  successText: '#166534',

  danger: '#dc2626',
  dangerBg: '#fee2e2',

  navActive: '#4338ca',
  navInactive: '#9ca3af',
  navActiveBg: '#ede9fe',
  navBar: '#ffffff',
  navBorder: '#e5e7eb',

  statusBar: '#3730a3',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
};

export const Radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 16,
  full: 999,
};

export const Typography = {
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.primaryText },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '400' },
  label: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  labelSmall: { fontSize: 9, color: Colors.textMuted },
  bodyMd: { fontSize: 13, color: Colors.textPrimary },
  bodySm: { fontSize: 11, color: Colors.textSecondary },
  accent: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  navLabel: { fontSize: 10, fontWeight: '500' },
};