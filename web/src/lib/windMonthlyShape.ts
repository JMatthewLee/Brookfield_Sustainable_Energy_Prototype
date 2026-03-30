import rawProfile from '../data/waterlooWindMonthlyMultipliers.json'

/** Calendar month 1–12 → array index 0–11 */
export function monthIndexFromYYYYMM(key: string): number {
  const m = Number.parseInt(key.slice(5, 7), 10)
  if (!Number.isFinite(m) || m < 1 || m > 12) return 0
  return m - 1
}

/** Normalize 12 factors so their mean is 1 (shape-only multiplier on top of annual CF). */
export function normalizeMonthlyShape(factors: number[]): number[] {
  const clean = factors.map((v) => (Number.isFinite(v) ? v : 0))
  const sum = clean.reduce((a, b) => a + b, 0)
  if (sum === 0) return Array(12).fill(1)
  return clean.map((v) => (v * 12) / sum)
}

export function getDefaultMonthlyShape(): number[] {
  const arr = rawProfile.factors
  if (!Array.isArray(arr) || arr.length !== 12) return Array(12).fill(1)
  return normalizeMonthlyShape(arr.map((x) => Number(x)))
}

export function monthlyShapeFromKeys(months: string[], shape12: number[]): number[] {
  return months.map((key) => {
    const idx = monthIndexFromYYYYMM(key)
    return shape12[idx] ?? 1
  })
}

export const WIND_MONTHLY_SHAPE_META = rawProfile.source as string
