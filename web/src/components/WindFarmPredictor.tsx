import { useMemo, useState } from 'react'
import { Plot } from '../lib/plotlyPlot'
import { CAMPUS_TOTAL_KEY } from '../lib/dataTypes'
import { hoursInMonthFromKeys } from '../lib/loadBuildingData'

type Props = {
  months: string[]
  campusConsumption: (number | null)[]
  monthlyWeatherEfficiency: (number | null)[]
  monthlyAvgWindKmh: (number | null)[]
}

const DEFAULT_RATED_KW = 3000
const DEFAULT_CF = 0.25
const MAX_SCENARIO_TURBINES = 5
const DEFAULT_GRID_PRICE_PER_KWH = 0.117
const DEFAULT_OM_CAD_PER_KW_YEAR = 50
const DEFAULT_PROJECTION_YEARS = 20

const chartLayoutBase = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  autosize: true,
  font: { color: '#334155' },
} as const

const BASE_OUTER_CARBON_INTENSITY = {
  carbonIntensive: 56,
  lowCarbon: 44,
} as const

const BASE_INNER_SOURCES = [
  { name: 'Carbon-intensive', value: 63, color: '#2b2b2b' },
  { name: 'Grid Nuclear Power', value: 23, color: '#e58db3' },
  { name: 'Grid Hydro Power', value: 11, color: '#55a8ff' },
  { name: 'Grid Wind Power', value: 4, color: '#43c76f' },
  { name: 'Grid Gas Power', value: 6, color: '#ef9b4e' },
  { name: 'Grid Solar Power', value: 0, color: '#f4d03f' },
] as const

function sumFinite(values: number[]): number {
  let s = 0
  for (const v of values) {
    if (Number.isFinite(v)) s += v
  }
  return s
}

function meanFinite(values: number[]): number {
  let sum = 0
  let count = 0
  for (const v of values) {
    if (Number.isFinite(v)) {
      sum += v
      count += 1
    }
  }
  return count > 0 ? sum / count : 0
}

function fmtCad(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function WindFarmPredictor({
  months,
  campusConsumption,
  monthlyWeatherEfficiency,
  monthlyAvgWindKmh,
}: Props) {
  const hours = useMemo(() => hoursInMonthFromKeys(months), [months])

  const [turbineCount, setTurbineCount] = useState(2)
  const [ratedPowerKw, setRatedPowerKw] = useState(DEFAULT_RATED_KW)
  const [capacityFactor, setCapacityFactor] = useState(DEFAULT_CF)
  const [clampNetAtZero, setClampNetAtZero] = useState(true)
  const [gridPricePerKwh, setGridPricePerKwh] = useState(DEFAULT_GRID_PRICE_PER_KWH)
  const [omCadPerKwYear, setOmCadPerKwYear] = useState(DEFAULT_OM_CAD_PER_KW_YEAR)
  const [projectionYears, setProjectionYears] = useState(DEFAULT_PROJECTION_YEARS)

  const campusNumeric = useMemo(
    () => campusConsumption.map((v) => (v === null ? NaN : v)),
    [campusConsumption],
  )

  const weatherEfficiencyNumeric = useMemo(
    () => monthlyWeatherEfficiency.map((v) => (v === null ? 1 : Math.max(0, v))),
    [monthlyWeatherEfficiency],
  )

  const efficiencyOverlayPercent = useMemo(
    () => weatherEfficiencyNumeric.map((v) => v * 100),
    [weatherEfficiencyNumeric],
  )

  const scenario = useMemo(() => {
    const cf = Math.min(1, Math.max(0, capacityFactor))
    const p = Math.max(0, ratedPowerKw)

    const annualForTurbines = (n: number) => {
      const gen: number[] = []
      const offset: number[] = []
      const net: number[] = []

      for (let i = 0; i < months.length; i++) {
        const c = campusNumeric[i]
        const h = hours[i]
        const weatherEff = weatherEfficiencyNumeric[i] ?? 1
        const g = n * p * cf * h * weatherEff
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
    const annualSavingsUsd: number[] = []
    const annualGrossSavingsCad: number[] = []
    const annualUpkeepCad: number[] = []
    const annualNetSavingsCad: number[] = []
    const longRunSavingsUsd: number[] = []
    const safeGridPrice = Math.max(0, gridPricePerKwh)
    const safeOmCadPerKwYear = Math.max(0, omCadPerKwYear)
    const safeProjectionYears = Math.max(1, Math.round(projectionYears))
    for (const n of turbineAxis) {
      const a = annualForTurbines(n)
      annualOffsets.push(a.annualOffset)
      annualNets.push(a.annualNet)
      const grossSaved = a.annualOffset * safeGridPrice
      const upkeep = n * p * safeOmCadPerKwYear
      const netSaved = grossSaved - upkeep
      annualSavingsUsd.push(netSaved)
      annualGrossSavingsCad.push(grossSaved)
      annualUpkeepCad.push(upkeep)
      annualNetSavingsCad.push(netSaved)
      longRunSavingsUsd.push(netSaved * safeProjectionYears)
    }

    const cur = annualForTurbines(turbineCount)
    const customMonthly = months.map((month, i) => {
      const c = campusNumeric[i]
      const g = cur.gen[i]
      const off = cur.offset[i]
      const net = cur.net[i]
      const fmt = (x: number) =>
        Number.isFinite(x) ? x.toLocaleString(undefined, { maximumFractionDigits: 0 }) : 'N/A'
      const eff = efficiencyOverlayPercent[i]
      const ws = monthlyAvgWindKmh[i]
      const effText = Number.isFinite(eff) ? `${eff.toFixed(1)}%` : 'N/A'
      const wsText = ws !== null && Number.isFinite(ws) ? ws.toFixed(2) : 'N/A'
      return `${month}<br>Campus use: ${fmt(c)} kWh<br>Wind gen: ${fmt(g)} kWh<br>Offset: ${fmt(off)} kWh<br>Net: ${fmt(net)} kWh<br>Weather efficiency: ${effText}<br>Avg wind: ${wsText} km/h`
    })

    const totalCampus = sumFinite(campusNumeric)
    const offsetRatio = totalCampus > 0 ? (cur.annualOffset / totalCampus) * 100 : 0
    const avgWeatherEfficiency = meanFinite(efficiencyOverlayPercent)

    const displacedByWind = Math.min(offsetRatio, BASE_OUTER_CARBON_INTENSITY.carbonIntensive)
    const projectedOuterCarbon = {
      carbonIntensive: Math.max(0, BASE_OUTER_CARBON_INTENSITY.carbonIntensive - displacedByWind),
      lowCarbon: Math.min(100, BASE_OUTER_CARBON_INTENSITY.lowCarbon + displacedByWind),
    }

    const baseInnerTotal = BASE_INNER_SOURCES.reduce((sum, s) => sum + s.value, 0)
    const baseInnerCarbon = BASE_INNER_SOURCES.find((s) => s.name === 'Carbon-intensive')?.value ?? 0
    const baseInnerWind = BASE_INNER_SOURCES.find((s) => s.name === 'Grid Wind Power')?.value ?? 0
    const addedWind = Math.min(offsetRatio, baseInnerCarbon)
    const projectedInnerRaw = BASE_INNER_SOURCES.map((s) => {
      if (s.name === 'Carbon-intensive') return { ...s, value: Math.max(0, s.value - addedWind) }
      if (s.name === 'Grid Wind Power') return { ...s, value: s.value + addedWind }
      return { ...s }
    })
    const projectedInnerTotal = projectedInnerRaw.reduce((sum, s) => sum + s.value, 0)
    const projectedInner = projectedInnerRaw.map((s) => ({
      ...s,
      value: projectedInnerTotal > 0 ? (s.value / projectedInnerTotal) * 100 : 0,
    }))

    return {
      turbineAxis,
      annualOffsets,
      annualNets,
      annualSavingsUsd,
      annualGrossSavingsCad,
      annualUpkeepCad,
      annualNetSavingsCad,
      longRunSavingsUsd,
      safeProjectionYears,
      cur,
      customMonthly,
      offsetRatio,
      avgWeatherEfficiency,
      projectedOuterCarbon,
      projectedInner,
      baseInnerWind,
      baseInnerCarbon,
      displacedByWind,
      baseInnerTotal,
    }
  }, [
    campusNumeric,
    months,
    hours,
    ratedPowerKw,
    capacityFactor,
    gridPricePerKwh,
    omCadPerKwYear,
    projectionYears,
    weatherEfficiencyNumeric,
    efficiencyOverlayPercent,
    monthlyAvgWindKmh,
    clampNetAtZero,
    turbineCount,
  ])

  return (
    <section className="card card-wind">
      <h2 className="card-title">Wind vs campus ({CAMPUS_TOTAL_KEY})</h2>
      <p className="muted intro-narrow">
        Generation = turbines × kW × capacity factor × hours × weather efficiency index. Monthly
        weather efficiency is derived from hourly wind speed data (km/h) and overlaid on the
        monthly chart. Financial chart uses net savings: avoided grid purchases minus yearly wind
        O&M upkeep.
      </p>

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
          <span className="field-label">Grid energy price (CAD/kWh)</span>
          <input
            type="number"
            min={0}
            step={0.005}
            value={gridPricePerKwh}
            onChange={(e) => setGridPricePerKwh(Number(e.target.value))}
          />
          <span className="field-hint">
            Default 0.117 CAD/kWh based on Ontario commodity + global adjustment style pricing.
          </span>
        </label>

        <label className="field">
          <span className="field-label">Wind O&M upkeep (CAD/kW-year)</span>
          <input
            type="number"
            min={0}
            step={1}
            value={omCadPerKwYear}
            onChange={(e) => setOmCadPerKwYear(Number(e.target.value))}
          />
          <span className="field-hint">
            Default 50 CAD/kW-year (benchmark range is roughly 33-59 USD/kW-year).
          </span>
        </label>

        <label className="field">
          <span className="field-label">Projection horizon (years)</span>
          <input
            type="number"
            min={1}
            step={1}
            value={projectionYears}
            onChange={(e) => setProjectionYears(Number(e.target.value))}
          />
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

      <div className="numbered-outputs-grid">
        <div className="summary-card numbered-output-card">
          <div className="summary-label">#1 Annual generation</div>
          <div className="summary-value">
            {scenario.cur.annualGeneration.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
            kWh
          </div>
        </div>
        <div className="summary-card numbered-output-card">
          <div className="summary-label">#2 Annual offset</div>
          <div className="summary-value">
            {scenario.cur.annualOffset.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh
          </div>
        </div>
        <div className="summary-card numbered-output-card">
          <div className="summary-label">#3 Annual net campus use</div>
          <div className="summary-value">
            {scenario.cur.annualNet.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh
          </div>
        </div>
        <div className="summary-card numbered-output-card">
          <div className="summary-label">#4 Offset ratio</div>
          <div className="summary-value">
            {scenario.offsetRatio.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
          </div>
        </div>
        <div className="summary-card numbered-output-card">
          <div className="summary-label">#5 Avg weather efficiency</div>
          <div className="summary-value">
            {scenario.avgWeatherEfficiency.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
          </div>
        </div>
      </div>

      <div className="wind-charts-row">
        <div className="chart-panel">
          <Plot
            data={[
              {
                x: scenario.turbineAxis,
                y: scenario.annualSavingsUsd,
                name: 'Yearly net savings (CAD)',
                type: 'scatter',
                mode: 'lines+markers',
                marker: { size: 9, color: '#f5c518' },
                line: { width: 3, color: '#f5c518' },
                customdata: scenario.turbineAxis.map((_, i) => [
                  fmtCad(scenario.annualGrossSavingsCad[i] ?? 0),
                  fmtCad(scenario.annualUpkeepCad[i] ?? 0),
                  fmtCad(scenario.annualNetSavingsCad[i] ?? 0),
                ]),
                hovertemplate:
                  'Turbines: %{x}<br>Gross saved: %{customdata[0]}<br>Upkeep: %{customdata[1]}<br>Net saved: %{customdata[2]}<extra></extra>',
              },
              {
                x: scenario.turbineAxis,
                y: scenario.longRunSavingsUsd,
                name: `Long-run net savings (${scenario.safeProjectionYears}y, CAD)`,
                type: 'scatter',
                mode: 'lines+markers',
                marker: { size: 9, color: '#2563eb' },
                line: { width: 3, color: '#2563eb' },
                customdata: scenario.longRunSavingsUsd.map((v) => fmtCad(v)),
                hovertemplate: 'Turbines: %{x}<br>Projected saved: %{customdata}<extra></extra>',
              },
            ]}
            layout={{
              ...chartLayoutBase,
              title: { text: 'Financial impact vs turbines (net of upkeep)', font: { size: 14 } },
              xaxis: {
                title: { text: 'Turbines' },
                dtick: 1,
                range: [-0.1, MAX_SCENARIO_TURBINES + 0.1],
                gridcolor: '#e2e8f0',
              },
              yaxis: { title: { text: 'CAD ($)' }, tickprefix: '$', gridcolor: '#e2e8f0' },
              margin: { t: 40, r: 16, l: 56, b: 48 },
              legend: { orientation: 'h' as const, y: 1.08, x: 0, font: { size: 11, color: '#334155' } },
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
                line: { width: 3, color: '#2563eb' },
                marker: { size: 5, color: '#2563eb' },
                connectgaps: false,
                customdata: scenario.customMonthly,
                hovertemplate: '%{customdata}<extra></extra>',
              },
              {
                x: months,
                y: efficiencyOverlayPercent,
                type: 'scatter',
                mode: 'lines',
                name: 'Weather efficiency (%)',
                yaxis: 'y2',
                line: { dash: 'dot', width: 3, color: '#f5c518' },
                hovertemplate:
                  'Month: %{x}<br>Weather efficiency: %{y:.1f}%<br>Avg wind: %{customdata:.2f} km/h<extra></extra>',
                customdata: monthlyAvgWindKmh.map((v) => (v ?? NaN)),
              },
            ]}
            layout={{
              ...chartLayoutBase,
              title: {
                text: `Monthly net and weather efficiency @ ${turbineCount} turbine(s)`,
                font: { size: 14 },
              },
              xaxis: { title: { text: 'Month' }, gridcolor: '#e2e8f0' },
              yaxis: { title: { text: 'kWh' }, gridcolor: '#e2e8f0' },
              yaxis2: {
                title: { text: 'Efficiency index (%)' },
                overlaying: 'y',
                side: 'right',
                showgrid: false,
              },
              margin: { t: 40, r: 16, l: 52, b: 72 },
              legend: { orientation: 'h' as const, y: 1.08, x: 0, font: { size: 11, color: '#334155' } },
            }}
            config={{ responsive: true, displaylogo: false }}
            style={{ width: '100%', height: '360px' }}
          />
        </div>
      </div>

      <div className="chart-panel mix-panel">
        <h3 className="mix-title">Projected carbon intensity and source mix</h3>
        <div className="mix-grid">
          <div className="mix-table-wrap">
            <table className="mix-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Base</th>
                  <th>Projected</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Carbon-intensive (outer ring)</td>
                  <td>56%</td>
                  <td>{scenario.projectedOuterCarbon.carbonIntensive.toFixed(1)}%</td>
                </tr>
                <tr>
                  <td>Low Carbon (outer ring)</td>
                  <td>44%</td>
                  <td>{scenario.projectedOuterCarbon.lowCarbon.toFixed(1)}%</td>
                </tr>
                {scenario.projectedInner.map((source) => {
                  const base = BASE_INNER_SOURCES.find((s) => s.name === source.name)?.value ?? 0
                  const basePct = scenario.baseInnerTotal > 0 ? (base / scenario.baseInnerTotal) * 100 : 0
                  return (
                    <tr key={source.name}>
                      <td>{source.name}</td>
                      <td>{basePct.toFixed(1)}%</td>
                      <td>{source.value.toFixed(1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="muted mix-note">
              Projection rule: added on-site wind first displaces the carbon-intensive share.
            </p>
          </div>
          <div className="mix-viz-wrap">
            <Plot
              data={[
                {
                  type: 'pie',
                  labels: ['Carbon-intensive', 'Low Carbon'],
                  values: [
                    scenario.projectedOuterCarbon.carbonIntensive,
                    scenario.projectedOuterCarbon.lowCarbon,
                  ],
                  marker: { colors: ['#334155', '#22c55e'], line: { color: '#ffffff', width: 2 } },
                  textinfo: 'none',
                  hole: 0.68,
                  sort: false,
                  direction: 'clockwise',
                  domain: { x: [0.02, 0.98], y: [0.02, 0.98] },
                  hovertemplate: '%{label}: %{value:.1f}%<extra></extra>',
                  showlegend: false,
                },
                {
                  type: 'pie',
                  labels: scenario.projectedInner.map((s) => s.name),
                  values: scenario.projectedInner.map((s) => s.value),
                  marker: {
                    colors: scenario.projectedInner.map((s) => s.color),
                    line: { color: '#ffffff', width: 1.5 },
                  },
                  textinfo: 'none',
                  hole: 0.36,
                  sort: false,
                  direction: 'clockwise',
                  domain: { x: [0.2, 0.8], y: [0.2, 0.8] },
                  hovertemplate: '%{label}: %{value:.1f}%<extra></extra>',
                  showlegend: false,
                },
              ]}
              layout={{
                ...chartLayoutBase,
                title: { text: 'Projected donut mix', font: { size: 15 } },
                margin: { t: 40, r: 10, l: 10, b: 8 },
                annotations: [
                  {
                    x: 0.5,
                    y: 0.5,
                    xref: 'paper',
                    yref: 'paper',
                    text: `<b>${turbineCount} turbine(s)</b><br>${scenario.displacedByWind.toFixed(1)}% displaced`,
                    showarrow: false,
                    font: { size: 11, color: '#334155' },
                  },
                ],
              }}
              config={{ responsive: true, displaylogo: false }}
              style={{ width: '100%', height: '355px' }}
            />
            <div className="mix-legend">
              {scenario.projectedInner.map((item) => (
                <div key={item.name} className="mix-legend-item">
                  <span className="mix-swatch" style={{ backgroundColor: item.color }} />
                  <span className="mix-legend-label">{item.name}</span>
                  <span className="mix-legend-value">{item.value.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
