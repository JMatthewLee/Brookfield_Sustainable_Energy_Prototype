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

  const weatherEfficiencySeries = useMemo(() => {
    if (!data) return []
    return data.weather?.monthlyEfficiency ?? data.months.map(() => null)
  }, [data])

  const weatherSpeedSeries = useMemo(() => {
    if (!data) return []
    return data.weather?.monthlyAvgWindKmh ?? data.months.map(() => null)
  }, [data])

  const stats = useMemo(() => seriesTotalKwh(selectedSeries), [selectedSeries])
  const avg =
    stats.count > 0 ? stats.sum / stats.count : 0

  if (loadError) {
    return (
      <div className="app-shell">
        <header className="header header--simple">
          <h1>UWaterloo Energy Dashboard</h1>
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
        <header className="header header--simple">
          <h1>UWaterloo Energy Dashboard</h1>
        </header>
        <main className="main">
          <p className="muted">Loading data…</p>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="brand-strip">
        <div className="brand-strip-inner">
          <div className="brand-logo" aria-hidden="true">
            UW
          </div>
          <div>
            <div className="brand-kicker">University of Waterloo inspired</div>
            <h1 className="brand-title">Campus Energy and Wind Impact</h1>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-content">
          <h2>Understand campus demand and on-site wind potential</h2>
          <p>
            Monthly use by building from 2015–2024. <code>{CAMPUS_TOTAL_KEY}</code> represents the
            full campus sum in the dataset, and wind performance uses weather-derived efficiency.
          </p>
        </div>
      </section>

      <header className="header">
        <nav className="quick-nav" aria-label="Dashboard sections">
          <span>Campus consumption</span>
          <span>Wind impact</span>
          <span>Weather efficiency overlay</span>
        </nav>
      </header>

      <main className="main">
        <section className="card card-consumption">
          <h2 className="card-title">Campus Consumption</h2>
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
          <WindFarmPredictor
            months={data.months}
            campusConsumption={campusSeries}
            monthlyWeatherEfficiency={weatherEfficiencySeries}
            monthlyAvgWindKmh={weatherSpeedSeries}
          />
        </ErrorBoundary>
      </main>

      <footer className="footer muted">
        Source CSVs build into <code>web/public/data/buildingMonthly.json</code> using{' '}
        <code>npm run build:data</code>.
      </footer>
    </div>
  )
}

export default App
