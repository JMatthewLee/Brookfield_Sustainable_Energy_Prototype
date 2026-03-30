/** Monthly aligned dataset loaded from `public/data/buildingMonthly.json`. */
export type BuildingMonthlyPayload = {
  months: string[]
  buildings: Record<string, (number | null)[]>
}

/** Synthetic series: sum of all building codes in the CSV for each month. */
export const CAMPUS_TOTAL_KEY = 'CAMPUS_TOTAL' as const
