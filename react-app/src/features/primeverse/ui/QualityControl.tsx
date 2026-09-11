import type { QualityLevel } from '../graphics/useQualitySettings'

interface QualityControlProps {
  value: QualityLevel
  onChange: (quality: QualityLevel) => void
}

export default function QualityControl({ value, onChange }: QualityControlProps) {
  return (
    <label className="pv-quality">
      <span>Qualidade</span>
      <select value={value} onChange={(event) => onChange(event.target.value as QualityLevel)}>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </label>
  )
}
