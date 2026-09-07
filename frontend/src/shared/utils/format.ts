/** Format salary range as human-readable string (e.g. "₹12–20 LPA") */
export function formatSalary(min?: number | null, max?: number | null): string {
  if (!min && !max) return 'Salary not disclosed'
  if (min && max) return `₹${min}–${max} LPA`
  if (min) return `₹${min}+ LPA`
  return `Up to ₹${max} LPA`
}

/** Format a number with Indian locale (1,00,000 style) */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-IN')
}

/** Format paise to rupees (₹1,00,000) */
export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`
}

/** Format a date string or Date to "12 Aug 2026" */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Format a date to relative time ("2 days ago", "just now") */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const ms = Date.now() - new Date(date).getTime()
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(date)
}

/** Truncate a string to maxLen with ellipsis */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}

/** Format percentage (0–100) to "67%" */
export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`
}

/** Capitalize first letter of each word */
export function titleCase(str: string): string {
  return str.replace(/\b\w/g, l => l.toUpperCase())
}

/** Convert snake_case or kebab-case to "Title Case" */
export function humanize(str: string): string {
  return str.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}
