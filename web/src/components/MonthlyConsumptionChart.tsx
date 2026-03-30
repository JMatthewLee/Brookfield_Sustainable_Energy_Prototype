import { Plot } from '../lib/plotlyPlot'

type Props = {
  months: string[]
  series: (number | null)[]
  title: string
}

function formatConsumption(v: number | null): string {
  if (v === null || Number.isNaN(v)) return 'N/A'
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function MonthlyConsumptionChart({ months, series, title }: Props) {
  const y = series.map((v) => (v === undefined ? null : v))
  const customdata = y.map((v) => formatConsumption(v))

  return (
    <Plot
      data={[
        {
          x: months,
          y,
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Consumption',
          line: { width: 3, color: '#2563eb' },
          marker: { size: 5, color: '#2563eb' },
          connectgaps: false,
          customdata,
          hovertemplate:
            '<b>%{fullData.name}</b><br>Month: %{x}<br>Consumption: %{customdata} kWh<extra></extra>',
        },
      ]}
      layout={{
        title: { text: title, font: { size: 14 } },
        xaxis: { title: { text: 'Month' }, gridcolor: '#e2e8f0' },
        yaxis: {
          title: { text: 'Electricity consumption (kWh)' },
          tickformat: ',.0f',
          gridcolor: '#e2e8f0',
        },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        autosize: true,
        margin: { t: 48, r: 24, l: 56, b: 80 },
        legend: { orientation: 'h' as const, y: 1.08, x: 0, font: { size: 11, color: '#334155' } },
        font: { color: '#334155' },
        hovermode: 'closest' as const,
      }}
      config={{
        responsive: true,
        displaylogo: false,
      }}
      style={{ width: '100%', height: '420px' }}
    />
  )
}
