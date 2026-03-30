/**
 * Reads monthly electricity CSV and writes aligned month-indexed JSON for the web app.
 * Run from repo: cd web && npm run build:data
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = join(__dirname, '..')
const repoRoot = join(webRoot, '..')
const csvPath = join(
  repoRoot,
  'Prediction Visualizer',
  'Electricity Consumption Monthly.csv',
)
const outDir = join(webRoot, 'public', 'data')
const outFile = join(outDir, 'buildingMonthly.json')

type Row = {
  monthKey: string
  buildingCode: string
  consumption: number | null
}

function parseCsv(content: string): Row[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) throw new Error('CSV empty or missing header')

  const rows: Row[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    // "Start Date,End Date,Building Code,Consumption" — split first 3 commas; rest is consumption
    const firstComma = line.indexOf(',')
    const secondComma = line.indexOf(',', firstComma + 1)
    const thirdComma = line.indexOf(',', secondComma + 1)
    if (firstComma < 0 || secondComma < 0 || thirdComma < 0) continue

    const startDate = line.slice(0, firstComma).trim()
    const buildingCode = line.slice(secondComma + 1, thirdComma).trim()
    const consumptionRaw = line.slice(thirdComma + 1).trim()

    const monthKey = startDate.slice(0, 7) // YYYY-MM
    let consumption: number | null = null
    if (consumptionRaw.length > 0) {
      const n = Number.parseFloat(consumptionRaw.replace(/,/g, ''))
      consumption = Number.isFinite(n) ? n : null
    }
    rows.push({ monthKey, buildingCode, consumption })
  }
  return rows
}

function main() {
  const raw = readFileSync(csvPath, 'utf8')
  const parsed = parseCsv(raw)

  const monthSet = new Set<string>()
  const codes = new Set<string>()
  for (const r of parsed) {
    monthSet.add(r.monthKey)
    codes.add(r.buildingCode)
  }
  const months = [...monthSet].sort()

  const monthIndex = new Map<string, number>()
  months.forEach((m, i) => monthIndex.set(m, i))

  const buildings: Record<string, (number | null)[]> = {}
  for (const code of codes) {
    buildings[code] = Array.from({ length: months.length }, () => null)
  }

  for (const r of parsed) {
    const idx = monthIndex.get(r.monthKey)
    if (idx === undefined) continue
    const series = buildings[r.buildingCode]
    if (!series) continue
    series[idx] = r.consumption
  }

  /** Sum all CSV building series per month (UWP etc. are individual buildings, not a campus roll-up). */
  const CAMPUS_TOTAL_KEY = 'CAMPUS_TOTAL'
  const sourceCodes = [...codes]
  const campusTotal: (number | null)[] = Array.from({ length: months.length }, (_, i) => {
    let sum = 0
    let any = false
    for (const code of sourceCodes) {
      const v = buildings[code]![i]
      if (v !== null && Number.isFinite(v)) {
        sum += v
        any = true
      }
    }
    return any ? sum : null
  })
  buildings[CAMPUS_TOTAL_KEY] = campusTotal

  const payload = { months, buildings }

  mkdirSync(outDir, { recursive: true })
  writeFileSync(outFile, JSON.stringify(payload, null, 0), 'utf8')
  console.log(
    `Wrote ${outFile} (${months.length} months, ${codes.size} source buildings + ${CAMPUS_TOTAL_KEY})`,
  )
}

main()
