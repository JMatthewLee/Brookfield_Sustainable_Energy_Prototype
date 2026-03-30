import { CAMPUS_TOTAL_KEY } from '../lib/dataTypes'

type Props = {
  value: string
  codes: string[]
  onChange: (code: string) => void
  id?: string
}

function labelForCode(code: string): string {
  if (code === CAMPUS_TOTAL_KEY) return `${code} (sum of all buildings)`
  return code
}

export function BuildingSelector({ value, codes, onChange, id }: Props) {
  return (
    <label className="field">
      <span className="field-label">Building</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="select"
      >
        {codes.map((c) => (
          <option key={c} value={c}>
            {labelForCode(c)}
          </option>
        ))}
      </select>
    </label>
  )
}
