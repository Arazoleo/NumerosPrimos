/**
 * Energy animation components for Primeverse Online character customization.
 * 
 * Each energy type has a unique visual animation rendered with CSS.
 * Animations have two states: idle (ambient) and active (triggered by "Test Power").
 */

import type { CSSProperties } from 'react'
import type { EnergyType } from '../shared/protocol'
import './energy-animations.css'

interface EnergyAnimationProps {
  readonly type: EnergyType
  readonly color: string
  readonly active?: boolean
}

export function EnergyAnimation({ type, color, active = false }: EnergyAnimationProps): JSX.Element {
  const style = { '--energy-color': color } as CSSProperties

  switch (type) {
    case 'prime-ring':
      return (
        <div className={`energy-anim energy-anim--prime-ring ${active ? 'active' : ''}`} style={style}>
          <div className="prime-ring__orbit prime-ring__orbit--1">
            <span className="prime-ring__prime">2</span>
            <span className="prime-ring__prime">3</span>
          </div>
          <div className="prime-ring__orbit prime-ring__orbit--2">
            <span className="prime-ring__prime">5</span>
            <span className="prime-ring__prime">7</span>
          </div>
          <div className="prime-ring__orbit prime-ring__orbit--3">
            <span className="prime-ring__prime">11</span>
          </div>
        </div>
      )

    case 'crypto-matrix':
      return (
        <div className={`energy-anim energy-anim--crypto-matrix ${active ? 'active' : ''}`} style={style}>
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="matrix__pixel" style={{ '--delay': `${i * 0.05}s` } as CSSProperties} />
          ))}
        </div>
      )

    case 'factor-net':
      return (
        <div className={`energy-anim energy-anim--factor-net ${active ? 'active' : ''}`} style={style}>
          <svg viewBox="0 0 100 100" className="factor-net__svg">
            <circle cx="50" cy="50" r="3" className="factor-net__node factor-net__node--center" />
            <circle cx="30" cy="30" r="2.5" className="factor-net__node" />
            <circle cx="70" cy="30" r="2.5" className="factor-net__node" />
            <circle cx="30" cy="70" r="2.5" className="factor-net__node" />
            <circle cx="70" cy="70" r="2.5" className="factor-net__node" />
            <circle cx="15" cy="50" r="2" className="factor-net__node" />
            <circle cx="85" cy="50" r="2" className="factor-net__node" />
            <line x1="50" y1="50" x2="30" y2="30" className="factor-net__line" />
            <line x1="50" y1="50" x2="70" y2="30" className="factor-net__line" />
            <line x1="50" y1="50" x2="30" y2="70" className="factor-net__line" />
            <line x1="50" y1="50" x2="70" y2="70" className="factor-net__line" />
            <line x1="50" y1="50" x2="15" y2="50" className="factor-net__line" />
            <line x1="50" y1="50" x2="85" y2="50" className="factor-net__line" />
          </svg>
        </div>
      )

    case 'cipher-lock':
      return (
        <div className={`energy-anim energy-anim--cipher-lock ${active ? 'active' : ''}`} style={style}>
          <div className="cipher-lock__ring cipher-lock__ring--1" />
          <div className="cipher-lock__ring cipher-lock__ring--2" />
          <div className="cipher-lock__ring cipher-lock__ring--3" />
          <div className="cipher-lock__keyhole">⚿</div>
        </div>
      )

    default:
      return <div className="energy-anim" style={style} />
  }
}
