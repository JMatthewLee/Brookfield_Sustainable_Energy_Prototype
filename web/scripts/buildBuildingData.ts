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

type WeatherRow = {
  monthKey: string
  windSpeedKmh: number
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

function parseWeatherCsv(content: string): WeatherRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) throw new Error('Weather CSV empty or missing header')

  const rows: WeatherRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(',')
    if (cols.length < 5) continue
    const year = Number.parseInt(cols[0]!.trim(), 10)
    const month = Number.parseInt(cols[1]!.trim(), 10)
    const windSpeedKmh = Number.parseFloat(cols[4]!.trim())
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) continue
    if (!Number.isFinite(windSpeedKmh)) continue
    const monthKey = `${year}-${String(month).padStart(2, '0')}`
    rows.push({ monthKey, windSpeedKmh })
  }
  return rows
}

function main() {
  const raw = readFileSync(csvPath, 'utf8')
  const weatherPath = join(repoRoot, 'Prediction Visualizer', 'Eric D. Soulis.csv')
  const weatherRaw = readFileSync(weatherPath, 'utf8')
  const parsed = parseCsv(raw)
  const weatherParsed = parseWeatherCsv(weatherRaw)

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

  const weatherByMonth = new Map<string, { sum: number; count: number }>()
  for (const row of weatherParsed) {
    const cur = weatherByMonth.get(row.monthKey)
    if (!cur) {
      weatherByMonth.set(row.monthKey, { sum: row.windSpeedKmh, count: 1 })
    } else {
      cur.sum += row.windSpeedKmh
      cur.count += 1
    }
  }

  const monthlyAvgWindKmh: (number | null)[] = months.map((monthKey) => {
    const agg = weatherByMonth.get(monthKey)
    if (!agg || agg.count === 0) return null
    return agg.sum / agg.count
  })

  const monthlyPowerProxy = monthlyAvgWindKmh.map((v) => {
    if (v === null || !Number.isFinite(v) || v < 0) return null
    const ms = v / 3.6
    return ms ** 3
  })
  const proxyVals = monthlyPowerProxy.filter((v): v is number => v !== null && Number.isFinite(v))
  const proxyMean =
    proxyVals.length > 0 ? proxyVals.reduce((a, b) => a + b, 0) / proxyVals.length : 1
  const monthlyEfficiency: (number | null)[] = monthlyPowerProxy.map((v) => {
    if (v === null) return null
    return proxyMean > 0 ? v / proxyMean : 1
  })

  const payload = {
    months,
    buildings,
    weather: {
      source: 'Prediction Visualizer/Eric D. Soulis.csv',
      speedUnit: 'km/h',
      monthlyAvgWindKmh,
      monthlyEfficiency,
    },
  }

  mkdirSync(outDir, { recursive: true })
  writeFileSync(outFile, JSON.stringify(payload, null, 0), 'utf8')
  console.log(
    `Wrote ${outFile} (${months.length} months, ${codes.size} source buildings + ${CAMPUS_TOTAL_KEY}, weather months matched: ${monthlyAvgWindKmh.filter((v) => v !== null).length})`,
  )
}

main()
