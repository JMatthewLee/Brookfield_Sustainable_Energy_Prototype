import type { BuildingMonthlyPayload } from './dataTypes'
import { CAMPUS_TOTAL_KEY } from './dataTypes'

export async function loadBuildingData(): Promise<BuildingMonthlyPayload> {
  const res = await fetch('/data/buildingMonthly.json')
  if (!res.ok) {
    throw new Error(
      `Failed to load building data (${res.status}). Run: cd web && npm run build:data`,
    )
  }
  return (await res.json()) as BuildingMonthlyPayload
}

/** Hours in each calendar month for months like "YYYY-MM". */
export function hoursInMonthFromKeys(months: string[]): number[] {
  return months.map((key) => {
    const [y, m] = key.split('-').map(Number)
    return new Date(Date.UTC(y, m, 0)).getUTCDate() * 24
  })
}

export function sortedBuildingCodes(buildings: Record<string, unknown>): string[] {
  return Object.keys(buildings).sort((a, b) => a.localeCompare(b))
}

/** `CAMPUS_TOTAL` first, then other building codes A–Z. */
export function orderedBuildingCodes(buildings: Record<string, unknown>): string[] {
  const rest = Object.keys(buildings)
    .filter((k) => k !== CAMPUS_TOTAL_KEY)
    .sort((a, b) => a.localeCompare(b))
  return buildings[CAMPUS_TOTAL_KEY] !== undefined ? [CAMPUS_TOTAL_KEY, ...rest] : rest
}
