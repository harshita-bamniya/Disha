// Number formatting shared by the command-center charts.

const IN = new Intl.NumberFormat('en-IN')

/** Indian digit grouping: 12,480 / 1,24,800. */
export const formatCount = (n: number): string => IN.format(n)

/** 0.5526 -> "55%" (whole percent). */
export const formatPct = (rate: number | null | undefined, digits = 0): string =>
  rate == null ? '—' : `${(rate * 100).toFixed(digits)}%`

/** 0.034, 0.126 -> "3.4–12.6" (percent, one decimal). */
export const formatCI = (low: number | null | undefined, high: number | null | undefined): string =>
  low == null || high == null ? '—' : `${(low * 100).toFixed(1)}–${(high * 100).toFixed(1)}`

export const trendGlyph = (delta: number | null | undefined): string =>
  delta == null ? '◌' : delta > 0 ? '▲' : delta < 0 ? '▼' : '▬'
