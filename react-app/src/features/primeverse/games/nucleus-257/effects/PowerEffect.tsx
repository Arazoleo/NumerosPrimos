import { useMemo } from 'react'

import { getHeroKit } from '../classKits'
import {
  QUALITY_TUNING,
  assertNever,
  makeEffectFrame,
  powerEffectPalette,
  type EffectVisualProps,
  type PowerEffectProps,
} from './effectCore'
import { AreaEffect } from './AreaEffect'
import { BarrierEffect } from './BarrierEffect'
import { ConeEffect } from './ConeEffect'
import { DashEffect } from './DashEffect'
import { ProjectileEffect } from './ProjectileEffect'
import { UltimateEffect } from './UltimateEffect'

/**
 * One short-lived, fully procedural arena cast visual. The owning arena keeps an
 * array keyed by `effect.id`; `onComplete` is invoked exactly once when this
 * visual's imperative timeline ends.
 */
export function PowerEffect(props: PowerEffectProps): JSX.Element {
  const { effect, quality } = props
  const kit = getHeroKit(effect.heroId)
  const ability = kit.abilities[effect.slot]
  const palette = powerEffectPalette(effect.mechanic, effect.sourceTeam)
  const fallbackColor = effect.color.trim() || kit.accent
  const color = effect.sourceTeam === undefined ? fallbackColor : palette.primary
  const highlight = palette.highlight
  const tuning = QUALITY_TUNING[quality]
  const frame = useMemo(() => makeEffectFrame(effect), [effect])
  const visualProps: EffectVisualProps = { ...props, ability, color, highlight, frame, tuning }

  switch (effect.mechanic) {
    case 'precision-shot':
    case 'paired-burst':
    case 'suppressed-shot':
    case 'mersenne-lance':
      return <ProjectileEffect {...visualProps} />
    case 'scatter-shot':
    case 'twin-detonation':
      return <ConeEffect {...visualProps} />
    case 'sieve-field':
    case 'public-key-decoy':
    case 'perfect-trap':
      return <AreaEffect {...visualProps} />
    case 'rsa-barrier':
      return <BarrierEffect {...visualProps} />
    case 'residue-dash':
    case 'modular-charge':
    case 'echo-step':
    case 'key-exchange':
    case 'exponent-leap':
      return <DashEffect {...visualProps} />
    case 'sieve-domain':
    case 'rsa-bastion':
    case 'twin-conjecture':
    case 'shared-secret':
    case 'mersenne-cascade':
      return <UltimateEffect {...visualProps} />
    default:
      return assertNever(effect.mechanic)
  }
}

