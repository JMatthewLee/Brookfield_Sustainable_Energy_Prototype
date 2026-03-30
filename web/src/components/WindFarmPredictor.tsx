import { useMemo, useState } from 'react'
import { Plot } from '../lib/plotlyPlot'
import { CAMPUS_TOTAL_KEY } from '../lib/dataTypes'
import { hoursInMonthFromKeys } from '../lib/loadBuildingData'
import {
  getDefaultMonthlyShape,
  monthlyShapeFromKeys,
  WIND_MONTHLY_SHAPE_META,
} from '../lib/windMonthlyShape'

type Props = {
  months: string[]
  campusConsumption: (number | null)[]
}

const DEFAULT_RATED_KW = 3000
const DEFAULT_CF = 0.25
const DEFAULT_WEATHER_EFFICIENCY = 1
const MAX_SCENARIO_TURBINES = 60

const STATIC_MONTHLY_SHAPE = getDefaultMonthlyShape()

const chartLayoutBase = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  autosize: true,
} as const

function sumFinite(values: number[]): number {
  let s = 0
  for (const v of values) {
    if (Number.isFinite(v)) s += v
  }
  return s
}

export function WindFarmPredictor({ months, campusConsumption }: Props) {
  const hours = useMemo(() => hoursInMonthFromKeys(months), [months])

  const [turbineCount, setTurbineCount] = useState(8)
  const [ratedPowerKw, setRatedPowerKw] = useState(DEFAULT_RATED_KW)
  const [capacityFactor, setCapacityFactor] = useState(DEFAULT_CF)
  const [weatherEfficiency, setWeatherEfficiency] = useState(DEFAULT_WEATHER_EFFICIENCY)
  const [useSeasonalWindShape, setUseSeasonalWindShape] = useState(true)
  const [clampNetAtZero, setClampNetAtZero] = useState(true)

  const shapePerMonth = useMemo(
    () =>
      useSeasonalWindShape
        ? monthlyShapeFromKeys(months, STATIC_MONTHLY_SHAPE)
        : months.map(() => 1),
    [months, useSeasonalWindShape],
  )

  const campusNumeric = useMemo(
    () => campusConsumption.map((v) => (v === null ? NaN : v)),
    [campusConsumption],
  )

  const scenario = useMemo(() => {
    const cf = Math.min(1, Math.max(0, capacityFactor))
    const p = Math.max(0, ratedPowerKw)
    const we = Math.min(1, Math.max(0, weatherEfficiency))

    const annualForTurbines = (n: number) => {
      const gen: number[] = []
      const offset: number[] = []
      const net: number[] = []

      for (let i = 0; i < months.length; i++) {
        const c = campusNumeric[i]
        const h = hours[i]
        const shape = shapePerMonth[i] ?? 1
        const g = n * p * cf * h * we * shape
        if (!Number.isFinite(c)) {
          gen.push(NaN)
          offset.push(NaN)
          net.push(NaN)
          continue
        }
        const off = Math.min(c, g)
        const netVal = clampNetAtZero ? Math.max(0, c - g) : c - g
        gen.push(g)
        offset.push(off)
        net.push(netVal)
      }

      const annualGeneration = sumFinite(gen)
      const annualOffset = sumFinite(offset)
      const annualNet = sumFinite(net)
      return { annualGeneration, annualOffset, annualNet, gen, offset, net }
    }

    const turbineAxis = Array.from({ length: MAX_SCENARIO_TURBINES + 1 }, (_, i) => i)
    const annualOffsets: number[] = []
    const annualNets: number[] = []
    for (const n of turbineAxis) {
      const a = annualForTurbines(n)
      annualOffsets.push(a.annualOffset)
      annualNets.push(a.annualNet)
    }

    const cur = annualForTurbines(turbineCount)
    const customMonthly = months.map((month, i) => {
      const c = campusNumeric[i]
      const g = cur.gen[i]
      const off = cur.offset[i]
      const net = cur.net[i]
      const fmt = (x: number) =>
        Number.isFinite(x) ? x.toLocaleString(undefined, { maximumFractionDigits: 0 }) : 'N/A'
      const sh = shapePerMonth[i]
      const shapeNote =
        useSeasonalWindShape && Number.isFinite(sh)
          ? `<br>Month wind shape: ×${sh.toFixed(3)}`
          : ''
      return `${month}<br>Campus use: ${fmt(c)} kWh<br>Wind gen: ${fmt(g)} kWh<br>Offset: ${fmt(off)} kWh<br>Net: ${fmt(net)} kWh${shapeNote}`
    })

    return {
      turbineAxis,
      annualOffsets,
      annualNets,
      cur,
      customMonthly,
    }
  }, [
    campusNumeric,
    months,
    hours,
    ratedPowerKw,
    capacityFactor,
    weatherEfficiency,
    shapePerMonth,
    useSeasonalWindShape,
    clampNetAtZero,
    turbineCount,
  ])

  return (
    <section className="card card-wind">
      <h2 className="card-title">Wind vs campus ({CAMPUS_TOTAL_KEY})</h2>
      <p className="muted intro-narrow">
        Generation = turbines × kW × capacity factor × hours × weather efficiency
        {useSeasonalWindShape ? ' × monthly shape.' : '.'} Replace shape factors in{' '}
        <code>src/data/waterlooWindMonthlyMultipliers.json</code> if you have local wind data.
      </p>

      <details className="meta-details">
        <summary>About the monthly wind shape</summary>
        <p className="muted">{WIND_MONTHLY_SHAPE_META}</p>
      </details>

      <div className="predictor-controls">
        <label className="field">
          <span className="field-label">Turbines</span>
          <div className="slider-row">
            <input
              type="range"
              min={0}
              max={MAX_SCENARIO_TURBINES}
              value={turbineCount}
              onChange={(e) => setTurbineCount(Number(e.target.value))}
            />
            <span className="value-pill">{turbineCount}</span>
          </div>
        </label>

        <label className="field">
          <span className="field-label">Rated power (kW)</span>
          <input
            type="number"
            min={0}
            step={50}
            value={ratedPowerKw}
            onChange={(e) => setRatedPowerKw(Number(e.target.value))}
          />
        </label>

        <label className="field">
          <span className="field-label">Capacity factor</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={capacityFactor}
            onChange={(e) => setCapacityFactor(Number(e.target.value))}
          />
        </label>

        <label className="field">
          <span className="field-label">Weather efficiency</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={weatherEfficiency}
            onChange={(e) => setWeatherEfficiency(Number(e.target.value))}
          />
        </label>

        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={useSeasonalWindShape}
            onChange={(e) => setUseSeasonalWindShape(e.target.checked)}
          />
          <span>Monthly wind shape</span>
        </label>

        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={clampNetAtZero}
            onChange={(e) => setClampNetAtZero(e.target.checked)}
          />
          <span>Clamp net use at zero</span>
        </label>
      </div>

      <div className="summary-grid summary-grid--compact">
        <div className="summary-card">
          <div className="summary-label">Annual offset</div>
          <div className="summary-value">
            {scenario.cur.annualOffset.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Annual net</div>
          <div className="summary-value">
            {scenario.cur.annualNet.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Annual generation</div>
          <div className="summary-value">
            {scenario.cur.annualGeneration.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
            kWh
          </div>
        </div>
      </div>

      <div className="wind-charts-row">
        <div className="chart-panel">
          <Plot
            data={[
              {
                x: scenario.turbineAxis,
                y: scenario.annualOffsets,
                name: 'Offset',
                type: 'scatter',
                mode: 'lines+markers',
                hovertemplate: 'Turbines: %{x}<br>Offset: %{y:,} kWh/yr<extra></extra>',
              },
              {
                x: scenario.turbineAxis,
                y: scenario.annualNets,
                name: 'Net campus',
                type: 'scatter',
                mode: 'lines+markers',
                hovertemplate: 'Turbines: %{x}<br>Net: %{y:,} kWh/yr<extra></extra>',
              },
            ]}
            layout={{
              ...chartLayoutBase,
              title: { text: 'Annual impact vs turbines', font: { size: 14 } },
              xaxis: { title: { text: 'Turbines' } },
              yaxis: { title: { text: 'kWh / year' } },
              margin: { t: 40, r: 16, l: 56, b: 48 },
              legend: { orientation: 'h' as const, y: 1.08, x: 0, font: { size: 11 } },
            }}
            config={{ responsive: true, displaylogo: false }}
            style={{ width: '100%', height: '360px' }}
          />
        </div>
        <div className="chart-panel">
          <Plot
            data={[
              {
                x: months,
                y: scenario.cur.net,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Net',
                connectgaps: false,
                customdata: scenario.customMonthly,
                hovertemplate: '%{customdata}<extra></extra>',
              },
            ]}
            layout={{
              ...chartLayoutBase,
              title: {
                text: `Monthly net @ ${turbineCount} turbine(s)`,
                font: { size: 14 },
              },
              xaxis: { title: { text: 'Month' } },
              yaxis: { title: { text: 'kWh' } },
              margin: { t: 40, r: 16, l: 52, b: 72 },
              showlegend: false,
            }}
            config={{ responsive: true, displaylogo: false }}
            style={{ width: '100%', height: '360px' }}
          />
        </div>
      </div>
    </section>
  )
}
