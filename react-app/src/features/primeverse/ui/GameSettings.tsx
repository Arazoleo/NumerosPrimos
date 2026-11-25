import type { QualityLevel } from '../graphics/useQualitySettings'
import QualityControl from './QualityControl'
import VolumeControl from './VolumeControl'

export default function GameSettings({ value, onChange }: { value: QualityLevel; onChange: (value: QualityLevel) => void }) {
  return <div className="pv-game-settings"><QualityControl value={value} onChange={onChange} /><VolumeControl /></div>
}
