// Single source of truth for all design tokens.
// Import from here — never declare NAVY/INK/CREAM locally in a module.

export const colors = {
  brand: {
    navy:      '#1A2744',
    navySoft:  '#243359',
    navyDark:  '#111C35',
  },
  text: {
    ink:       '#1E3A5F',
    inkSoft:   '#475569',
    muted:     '#94A3B8',
  },
  surface: {
    bg:        '#F4F5F7',
    card:      '#FFFFFF',
    elevated:  '#EAECF0',
  },
  border: {
    default:   'rgba(0,0,0,0.08)',
    medium:    'rgba(0,0,0,0.12)',
    strong:    'rgba(0,0,0,0.16)',
  },
  state: {
    success:   '#16A34A',
    successBg: '#F0FDF4',
    warning:   '#D97706',
    warningBg: '#FFFBEB',
    danger:    '#DC2626',
    dangerBg:  '#FEF2F2',
    info:      '#2563EB',
    infoBg:    '#EFF6FF',
  },
  overlay: {
    navy08:   'rgba(255,255,255,0.08)',
    navy12:   'rgba(255,255,255,0.12)',
  },
} as const

export const spacing = {
  1:       4,
  2:       8,
  3:       12,
  4:       16,
  5:       20,
  6:       24,
  8:       32,
  12:      48,
  layout:  28,   // page content horizontal padding
  header:  64,   // unified header height (px)
  sidebar: 260,  // unified sidebar width (px)
} as const

export const radius = {
  sm:   6,
  md:   10,
  lg:   12,
  xl:   16,
  '2xl': 20,
  full: 9999,
} as const

export const shadows = {
  card:       '0 2px 8px rgba(15,23,42,0.05)',
  cardHover:  '0 8px 24px rgba(15,23,42,0.10)',
  elevated:   '0 4px 16px rgba(15,23,42,0.08)',
  sidebar:    '4px 0 24px rgba(10,18,40,0.22)',
  button:     '0 4px 14px rgba(26,39,68,0.25)',
} as const

export const typography = {
  display:    { fontSize: 28, fontWeight: 800 },
  h1:         { fontSize: 24, fontWeight: 800 },
  h2:         { fontSize: 20, fontWeight: 700 },
  h3:         { fontSize: 16, fontWeight: 700 },
  pageTitle:  { fontSize: 18, fontWeight: 700 },
  bodyLg:     { fontSize: 15, fontWeight: 400 },
  body:       { fontSize: 14, fontWeight: 400 },
  bodySm:     { fontSize: 13, fontWeight: 400 },
  caption:    { fontSize: 12, fontWeight: 500 },
  micro:      { fontSize: 11, fontWeight: 600 },
  tiny:       { fontSize: 10, fontWeight: 700 },
} as const

// Shorthand aliases used most frequently
export const NAVY    = colors.brand.navy
export const INK     = colors.text.ink
export const INK_SFT = colors.text.inkSoft
export const MUTED   = colors.text.muted
export const CREAM   = colors.surface.bg
export const BORDER  = colors.border.default
