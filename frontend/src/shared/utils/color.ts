const AVATAR_PALETTE: [string, string][] = [
  ['#EEF2FF', '#4F46E5'],
  ['#ECFDF5', '#059669'],
  ['#FFF7ED', '#EA580C'],
  ['#FDF2F8', '#DB2777'],
  ['#F0F9FF', '#0284C7'],
  ['#FAF5FF', '#9333EA'],
  ['#FFF1F2', '#E11D48'],
  ['#ECFEFF', '#0891B2'],
]

/** Returns [bg, fg] colors for an avatar based on name string */
export function avatarColors(name: string): [string, string] {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

/** Get initials from a full name (e.g. "Rahul Sharma" → "RS") */
export function initials(name: string, maxChars = 2): string {
  return name
    .trim()
    .split(/\s+/)
    .map(w => w[0]?.toUpperCase() ?? '')
    .slice(0, maxChars)
    .join('')
}

/** Lighten a hex color by a given amount (0–1) */
export function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, (num >> 16) + Math.round(255 * amount))
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount))
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount))
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

/** Add alpha to a hex color */
export function hexAlpha(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = (num >> 16) & 0xff
  const g = (num >> 8) & 0xff
  const b = num & 0xff
  return `rgba(${r},${g},${b},${alpha})`
}
