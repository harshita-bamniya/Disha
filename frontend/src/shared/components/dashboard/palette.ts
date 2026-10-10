/** Accent pairs for dashboard cards: a strong colour for the icon and a very light tint behind it. */
export const accents = {
  indigo: { fg: '#4F46E5', bg: '#EEF2FF' },
  sky: { fg: '#0284C7', bg: '#F0F9FF' },
  violet: { fg: '#7C3AED', bg: '#F5F3FF' },
  emerald: { fg: '#059669', bg: '#ECFDF5' },
  amber: { fg: '#D97706', bg: '#FFFBEB' },
  teal: { fg: '#0D9488', bg: '#F0FDFA' },
  rose: { fg: '#E11D48', bg: '#FFF1F2' },
  slate: { fg: '#475569', bg: '#F1F5F9' },
} as const

export type Accent = keyof typeof accents

/** One shade per hiring stage, light to dark, so a stacked bar reads left to right as progress. */
export const stageColors = { new: '#93C5FD', screening: '#60A5FA', interview: '#2563EB', offer: '#1E3A8A' } as const
