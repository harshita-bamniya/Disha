// Single source of truth for color, typography, spacing, radius, and shadow
// values across the app. Introduced to close audit findings C-03 (color
// constants re-declared per file) and to back the typography/spacing/radius/
// shadow scales proposed in the frontend architecture audit (Aug 2026).
//
// Any token change here affects every consumer — treat edits as a full
// visual review, not a local tweak.

export const color = {
  brand: {
    navy:     '#1A2744', // Primary brand color, sidebar accent, primary button
    navySoft: '#243359', // Sidebar gradient end, hover state for navy elements
    navyDark: '#111C35', // Sidebar gradient deepest point
    ink:      '#1E3A5F', // Primary text on light backgrounds
    inkSoft:  '#475569', // Secondary text, subtitles
    muted:    '#94A3B8', // Placeholder text, disabled states
    border:   'rgba(0,0,0,0.08)', // Card borders, dividers on white
  },
  surface: {
    bg:       '#F4F5F7', // Page background — unified across all modules
    card:     '#FFFFFF', // Card / panel background
    elevated: '#EAECF0', // Chip backgrounds, subtle highlights
  },
  state: {
    success: '#16A34A', // Success badges, confirmations
    warning: '#D97706', // Warning badges, medium ATS risk
    danger:  '#DC2626', // Error states, delete actions
    info:    '#2563EB', // Info badges, active chips in profile
  },
  overlay: {
    navy08: 'rgba(255,255,255,0.08)', // Sidebar item hover (on dark bg)
    navy12: 'rgba(255,255,255,0.12)', // Sidebar item active (on dark bg)
  },
} as const

export const typography = {
  display:    { size: 28, weight: 800 }, // Auth panel headings, landing sections
  h1:         { size: 24, weight: 800 }, // Page-level headings (inside cards/forms)
  h2:         { size: 20, weight: 700 }, // Section headings within pages
  h3:         { size: 16, weight: 700 }, // Card titles, group labels
  bodyLg:     { size: 15, weight: 400 }, // Long-form body text, descriptions
  body:       { size: 14, weight: 400 }, // Standard body text
  bodySm:     { size: 13, weight: 400 }, // Secondary body text, nav labels
  caption:    { size: 12, weight: 500 }, // Meta information, timestamps
  micro:      { size: 11, weight: 600 }, // Badges, chips, uppercase labels
  tiny:       { size: 10, weight: 700 }, // Section group headers (UPPERCASE)
  pageTitle:  { size: 18, weight: 700 }, // Unified page header title (all pages)
} as const

export const space = {
  1: 4,   // Tight gaps inside chips
  2: 8,   // Icon-to-text gap, chip padding
  3: 12,  // Button padding horizontal
  4: 16,  // Card inner padding, list item padding
  5: 20,  // Card padding standard
  6: 24,  // Section spacing, page header padding
  8: 32,  // Card padding generous
  12: 48, // Section gap
  layout: 28, // Page content horizontal padding
  header: 64, // Unified header height (all pages)
  sidebar: 260, // Unified sidebar width (all modules)
} as const

export const radius = {
  sm:   6,    // Small tags, inner chip elements
  md:   10,   // Buttons (sm), nav items, input height tokens
  lg:   12,   // Standard buttons, avatars, icon containers
  xl:   16,   // Cards (standard)
  '2xl': 20,  // Large cards, modals, auth card
  full: 9999, // Badges, pills, status dots
} as const

export const shadow = {
  card:      '0 2px 8px rgba(15,23,42,0.05)',    // Default card shadow
  cardHover: '0 8px 24px rgba(15,23,42,0.10)',   // Card on hover
  elevated:  '0 4px 16px rgba(15,23,42,0.08)',   // Modals, drawers, dropdowns
  sidebar:   '4px 0 24px rgba(10,18,40,0.22)',   // Sidebar drop shadow
  button:    '0 4px 14px rgba(26,39,68,0.25)',   // Primary button shadow
} as const

export const tokens = { color, typography, space, radius, shadow } as const
