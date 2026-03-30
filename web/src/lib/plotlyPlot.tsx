/**
 * Vite ESM + CJS interop can leave `import Plot from 'react-plotly.js'` as a nested
 * `{ default: ... }` object, which triggers "Element type is invalid ... got: object".
 * This unwraps until we get the real component.
 */
import * as ReactPlotlyModule from 'react-plotly.js'
import type { PlotParams } from 'react-plotly.js'
import type { ComponentType } from 'react'

function resolvePlotComponent(): ComponentType<PlotParams> {
  let x: unknown = ReactPlotlyModule
  for (let i = 0; i < 4; i++) {
    if (typeof x === 'function') return x as ComponentType<PlotParams>
    if (x !== null && typeof x === 'object' && 'default' in x) {
      x = (x as { default: unknown }).default
      continue
    }
    break
  }
  if (typeof x === 'function') return x as ComponentType<PlotParams>
  throw new Error('react-plotly.js: could not resolve Plot component')
}

export const Plot = resolvePlotComponent()
