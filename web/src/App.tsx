import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { BuildingSelector } from './components/BuildingSelector'
import { ErrorBoundary } from './components/ErrorBoundary'
import { MonthlyConsumptionChart } from './components/MonthlyConsumptionChart'
import { WindFarmPredictor } from './components/WindFarmPredictor'
import { CAMPUS_TOTAL_KEY, type BuildingMonthlyPayload } from './lib/dataTypes'
import { loadBuildingData, orderedBuildingCodes } from './lib/loadBuildingData'

function seriesTotalKwh(series: (number | null)[]): { sum: number; count: number } {
  let sum = 0
  let count = 0
  for (const v of series) {
    if (v !== null && Number.isFinite(v)) {
      sum += v
      count += 1
    }
  }
  return { sum, count }
}

function App() {
  const [data, setData] = useState<BuildingMonthlyPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedCode, setSelectedCode] = useState<string>(CAMPUS_TOTAL_KEY)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await loadBuildingData()
        if (cancelled) return
        setData(d)
        const codes = orderedBuildingCodes(d.buildings)
        if (!codes.includes(CAMPUS_TOTAL_KEY) && codes.length > 0) {
          setSelectedCode(codes[0]!)
        }
        setLoadError(null)
      } catch (e) {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const codes = useMemo(() => (data ? orderedBuildingCodes(data.buildings) : []), [data])

  const selectedSeries = useMemo(() => {
    if (!data) return []
    return data.buildings[selectedCode] ?? []
  }, [data, selectedCode])

  const campusSeries = useMemo(() => {
    if (!data) return []
    return data.buildings[CAMPUS_TOTAL_KEY] ?? []
  }, [data])

  const stats = useMemo(() => seriesTotalKwh(selectedSeries), [selectedSeries])
  const avg =
    stats.count > 0 ? stats.sum / stats.count : 0

  if (loadError) {
    return (
      <div className="app-shell">
        <header className="header">
          <h1>Campus electricity</h1>
        </header>
        <main className="main">
          <div className="card error-card">
            <h2>Could not load data</h2>
            <p>{loadError}</p>
            <p className="muted">
              From the <code>web</code> folder run: <code>npm run build:data</code>
            </p>
          </div>
        </main>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="app-shell">
        <header className="header">
          <h1>Campus electricity</h1>
        </header>
        <main className="main">
          <p className="muted">Loading data…</p>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="header">
        <h1>Campus electricity</h1>
        <p className="subtitle">
          Monthly use by building (2015–2024). <code>{CAMPUS_TOTAL_KEY}</code> is the sum of all
          buildings in the CSV each month—not the same as UWP alone.
        </p>
      </header>

      <main className="main">
        <section className="card card-consumption">
          <h2 className="card-title">Consumption</h2>
          <div className="toolbar">
            <BuildingSelector
              id="building-select"
              value={selectedCode}
              codes={codes}
              onChange={setSelectedCode}
            />
          </div>

          <div className="summary-grid summary-grid--compact">
            <div className="summary-card">
              <div className="summary-label">Sum ({stats.count} months with data)</div>
              <div className="summary-value">
                {stats.sum.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Average per month</div>
              <div className="summary-value">
                {avg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh
              </div>
            </div>
          </div>

          <ErrorBoundary>
            <MonthlyConsumptionChart
              months={data.months}
              series={selectedSeries}
              title={`Monthly electricity — ${selectedCode}`}
            />
          </ErrorBoundary>
        </section>

        <ErrorBoundary>
          <WindFarmPredictor months={data.months} campusConsumption={campusSeries} />
        </ErrorBoundary>
      </main>

      <footer className="footer muted">
        Source CSV → <code>web/public/data/buildingMonthly.json</code> (<code>npm run build:data</code>)
      </footer>
    </div>
  )
}

export default App
