import type { AbilityMechanic, HeroId } from './types'

export type NucleusVfxLanguage = 'sieve' | 'rsa' | 'twins' | 'diffie' | 'mersenne'

export interface NucleusVfxProfile {
  readonly language: NucleusVfxLanguage
  /** End of the readable wind-up, expressed on the normalized effect timeline. */
  readonly anticipationEnd: number
  /** Moment the damaging shape arrives or finishes assembling. */
  readonly impactStart: number
  /** Moment the effect stops communicating danger and begins to clear. */
  readonly dissolveStart: number
}

export interface NucleusVfxPhase {
  readonly progress: number
  readonly charge: number
  readonly action: number
  readonly impact: number
  readonly dissolve: number
  readonly opacity: number
}

const HERO_LANGUAGES: Readonly<Record<HeroId, NucleusVfxLanguage>> = Object.freeze({
  'luma-crivo': 'sieve',
  'raul-rsa': 'rsa',
  'teo-gemeos': 'twins',
  'yara-diffie': 'diffie',
  'iris-mersenne': 'mersenne',
})

const MECHANIC_PROFILES: Readonly<Record<AbilityMechanic, NucleusVfxProfile>> = Object.freeze({
  'mersenne-lance': { language: 'mersenne', anticipationEnd: 0.14, impactStart: 0.72, dissolveStart: 0.86 },
  'perfect-trap': { language: 'mersenne', anticipationEnd: 0.18, impactStart: 0.5, dissolveStart: 0.7 },
  'exponent-leap': { language: 'mersenne', anticipationEnd: 0.07, impactStart: 0.6, dissolveStart: 0.74 },
  'mersenne-cascade': { language: 'mersenne', anticipationEnd: 0.22, impactStart: 0.52, dissolveStart: 0.72 },
  'precision-shot': { language: 'sieve', anticipationEnd: 0.1, impactStart: 0.7, dissolveStart: 0.82 },
  'sieve-field': { language: 'sieve', anticipationEnd: 0.16, impactStart: 0.52, dissolveStart: 0.72 },
  'residue-dash': { language: 'sieve', anticipationEnd: 0.08, impactStart: 0.64, dissolveStart: 0.76 },
  'sieve-domain': { language: 'sieve', anticipationEnd: 0.2, impactStart: 0.54, dissolveStart: 0.74 },
  'scatter-shot': { language: 'rsa', anticipationEnd: 0.14, impactStart: 0.5, dissolveStart: 0.7 },
  'rsa-barrier': { language: 'rsa', anticipationEnd: 0.22, impactStart: 0.48, dissolveStart: 0.74 },
  'modular-charge': { language: 'rsa', anticipationEnd: 0.18, impactStart: 0.66, dissolveStart: 0.8 },
  'rsa-bastion': { language: 'rsa', anticipationEnd: 0.22, impactStart: 0.55, dissolveStart: 0.78 },
  'paired-burst': { language: 'twins', anticipationEnd: 0.08, impactStart: 0.68, dissolveStart: 0.82 },
  'twin-detonation': { language: 'twins', anticipationEnd: 0.12, impactStart: 0.52, dissolveStart: 0.72 },
  'echo-step': { language: 'twins', anticipationEnd: 0.08, impactStart: 0.58, dissolveStart: 0.76 },
  'twin-conjecture': { language: 'twins', anticipationEnd: 0.18, impactStart: 0.55, dissolveStart: 0.75 },
  'suppressed-shot': { language: 'diffie', anticipationEnd: 0.07, impactStart: 0.68, dissolveStart: 0.78 },
  'public-key-decoy': { language: 'diffie', anticipationEnd: 0.14, impactStart: 0.48, dissolveStart: 0.68 },
  'key-exchange': { language: 'diffie', anticipationEnd: 0.18, impactStart: 0.58, dissolveStart: 0.74 },
  'shared-secret': { language: 'diffie', anticipationEnd: 0.23, impactStart: 0.57, dissolveStart: 0.77 },
})

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function normalizedRange(value: number, start: number, end: number): number {
  return clamp01((value - start) / Math.max(0.001, end - start))
}

export function heroVfxLanguage(heroId: HeroId): NucleusVfxLanguage {
  return HERO_LANGUAGES[heroId]
}

export function nucleusVfxProfile(mechanic: AbilityMechanic): NucleusVfxProfile {
  return MECHANIC_PROFILES[mechanic]
}

/**
 * Converts a single normalized lifetime into stable visual phases. Keeping this
 * pure makes every renderer use the same anticipation/impact/dissolve grammar.
 */
export function resolveNucleusVfxPhase(
  mechanic: AbilityMechanic,
  rawProgress: number,
): NucleusVfxPhase {
  const profile = nucleusVfxProfile(mechanic)
  const progress = clamp01(rawProgress)
  const chargeIn = normalizedRange(progress, 0, profile.anticipationEnd)
  const chargeOut = 1 - normalizedRange(
    progress,
    profile.anticipationEnd,
    Math.min(profile.impactStart, profile.anticipationEnd + 0.1),
  )
  const charge = Math.sin(chargeIn * Math.PI * 0.5) * chargeOut
  const action = normalizedRange(progress, profile.anticipationEnd, profile.impactStart)
  const impact = normalizedRange(progress, profile.impactStart, profile.dissolveStart)
  const dissolve = normalizedRange(progress, profile.dissolveStart, 1)

  return {
    progress,
    charge,
    action,
    impact,
    dissolve,
    opacity: 1 - dissolve,
  }
}
