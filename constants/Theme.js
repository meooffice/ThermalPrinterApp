// constants/Theme.js — SRKVM design tokens (uniform / bag greens). Themes.js re-exports this file.

export const Colors = {
  primary: '#3F6B45',       // Uniform / bag green — main brand (buttons, header, active)
  primaryDark: '#2B4A31',   // Deep forest green — titles, splash, status bar
  primaryLight: '#E4F3EC',  // Mint — chips, icon circles, step buttons
  primaryText: '#fff',

  surface: '#ffffff',
  background: '#F3F6EE',    // Soft sage-cream — screen bg
  cardBorder: '#E3E8DC',    // Soft green-grey

  textPrimary: '#1F2A22',
  textSecondary: '#3E4A41',
  textMuted: '#6F7D72',
  textAccent: '#3F6B45',

  success: '#2E7D32',
  successBg: '#DDEFD8',
  successText: '#1E5B2A',

  danger: '#dc2626',        // unchanged: Cancel / Delete / errors
  dangerBg: '#fee2e2',

  navActive: '#3F6B45',
  navInactive: '#6F7D72',
  navActiveBg: '#E4F3EC',
  navBar: '#ffffff',
  navBorder: '#E3E8DC',

  statusBar: '#2B4A31',

  // extra tokens (new, nothing existing uses them yet)
  accent: '#89A869',        // notebook leaf green
  highlight: '#F9E68D',     // banner yellow
  highlightText: '#6B5200',
  warm: '#F6F3E4',          // light khaki surface
  khaki: '#BEB291',
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