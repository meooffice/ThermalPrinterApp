// constants/Theme.js
export const Colors = {
  // Primary
  primary:      '#4f46e5',
  primaryDark:  '#1e1b4b',
  primaryLight: '#ede9fe',
  primaryMid:   '#a5b4fc',

  // Backgrounds
  bgPage:   '#f5f5f5',
  bgCard:   '#ffffff',
  bgHeader: '#4f46e5',

  // Text
  textPrimary:   '#111827',
  textSecondary: '#6b7280',
  textHint:      '#9ca3af',
  textOnPrimary: '#ffffff',
  textOnLight:   '#1e1b4b',

  // Status
  success:     '#d1fae5',
  successText: '#065f46',
  successDot:  '#10b981',
  danger:      '#fee2e2',
  dangerText:  '#991b1b',
  dangerDot:   '#ef4444',

  // Border
  border:      '#f0f0f0',
  borderLight: '#e5e7eb',
  borderInput: '#e5e7eb',

  // Nav
  navBg:      '#1e1b4b',
  navActive:  '#4f46e5',
  navInactive:'#a5b4fc',
};

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
};

export const Radius = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  pill: 28,
};

export const Typography = {
  pageTitle:   { fontSize: 28, fontWeight: '800', color: '#1e1b4b' },
  pageSub:     { fontSize: 12, color: '#6b7280' },
  sectionTitle:{ fontSize: 13, fontWeight: '700', color: '#6b7280',
                 textTransform: 'uppercase', letterSpacing: 0.5 },
  cardTitle:   { fontSize: 14, fontWeight: '700', color: '#111827' },
  cardSub:     { fontSize: 11, color: '#9ca3af' },
  label:       { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  body:        { fontSize: 14, color: '#374151' },
  small:       { fontSize: 11, color: '#6b7280' },
  btnPrimary:  { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  btnSecondary:{ fontSize: 15, fontWeight: '700', color: '#4f46e5' },
};

export const Shadow = {
  card: {
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  nav: {
    elevation: 8,
    shadowColor: '#1e1b4b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
};