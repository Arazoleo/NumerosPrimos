import type { PrimeboundAreaId } from './world'

/**
 * Pure, renderer-independent rules for the prime-themed combat stages.
 *
 * The game engine owns hit detection and enemy state. This module only turns
 * an area and a chain count into immutable combat modifiers that the engine
 * can apply and the HUD can describe.
 */

export const PRIME_CHAIN_LIMIT = 13

export const PRIME_CHAIN_PRIMES = Object.freeze([2, 3, 5, 7, 11, 13] as const)

export const PRIME_STAGE_MECHANIC_IDS = [
  'eratosthenes-sieve',
  'goldbach-pair',
  'wilson-verdict',
] as const

export type PrimeStageMechanicId = (typeof PRIME_STAGE_MECHANIC_IDS)[number]

export type PrimeStageAreaId = Extract<
  PrimeboundAreaId,
  'eratosthenes-garden' | 'goldbach-citadel' | 'wilson-observatory'
>

export type PrimeStageTrigger = 'prime-chain' | 'thirteenth-hit'

export interface PrimeStageMechanicDefinition {
  readonly id: PrimeStageMechanicId
  readonly areaId: PrimeStageAreaId
  readonly label: string
  readonly shortLabel: string
  readonly formula: string
  readonly trigger: PrimeStageTrigger
  readonly detail: string
}

export interface PrimeStageHitEffect {
  readonly mechanicId: PrimeStageMechanicId | null
  readonly triggered: boolean
  readonly damageMultiplier: number
  /** Fraction of the resolved damage repeated on the nearest living partner. */
  readonly partnerEchoRatio: number
  readonly stunDurationMs: number
  readonly callout: string | null
}

export const PRIME_STAGE_MECHANICS: Readonly<
  Record<PrimeStageAreaId, PrimeStageMechanicDefinition>
> = Object.freeze({
  'eratosthenes-garden': Object.freeze({
    id: 'eratosthenes-sieve',
    areaId: 'eratosthenes-garden',
    label: 'Crivo de Eratóstenes',
    shortLabel: 'CRIVO',
    formula: '2, 3, 5, 7, 11, 13',
    trigger: 'prime-chain',
    detail: 'Golpes em contagens primas atravessam o crivo e causam 30% mais dano.',
  }),
  'goldbach-citadel': Object.freeze({
    id: 'goldbach-pair',
    areaId: 'goldbach-citadel',
    label: 'Par de Goldbach',
    shortLabel: 'PAR',
    formula: '2n = p + q',
    trigger: 'prime-chain',
    detail: 'Em contagens primas, 40% do dano ecoa no aliado mais próximo do alvo.',
  }),
  'wilson-observatory': Object.freeze({
    id: 'wilson-verdict',
    areaId: 'wilson-observatory',
    label: 'Veredito de Wilson',
    shortLabel: 'WILSON',
    formula: '(p − 1)! ≡ −1 (mod p)',
    trigger: 'thirteenth-hit',
    detail: 'A 13ª contagem confirma o primo: o golpe causa 125% mais dano e paralisa.',
  }),
})

const NEUTRAL_STAGE_HIT_EFFECT: PrimeStageHitEffect = Object.freeze({
  mechanicId: null,
  triggered: false,
  damageMultiplier: 1,
  partnerEchoRatio: 0,
  stunDurationMs: 0,
  callout: null,
})

function assertChainCount(chainCount: number): void {
  if (!Number.isInteger(chainCount) || chainCount < 1 || chainCount > PRIME_CHAIN_LIMIT) {
    throw new RangeError(`Prime chain count must be an integer from 1 to ${PRIME_CHAIN_LIMIT}.`)
  }
}

export function advancePrimeChainCount(currentCount: number): number {
  if (!Number.isInteger(currentCount) || currentCount < 0 || currentCount > PRIME_CHAIN_LIMIT) {
    throw new RangeError(`Current prime chain count must be an integer from 0 to ${PRIME_CHAIN_LIMIT}.`)
  }

  return currentCount === PRIME_CHAIN_LIMIT ? 1 : currentCount + 1
}

export function isPrimeChainCount(chainCount: number): boolean {
  return PRIME_CHAIN_PRIMES.some((prime) => prime === chainCount)
}

export function getPrimeStageMechanic(
  areaId: PrimeboundAreaId,
): PrimeStageMechanicDefinition | null {
  if (!(areaId in PRIME_STAGE_MECHANICS)) return null
  return PRIME_STAGE_MECHANICS[areaId as PrimeStageAreaId]
}

export function resolvePrimeStageHitEffect(
  areaId: PrimeboundAreaId,
  chainCount: number,
): PrimeStageHitEffect {
  assertChainCount(chainCount)

  if (areaId === 'eratosthenes-garden' && isPrimeChainCount(chainCount)) {
    return Object.freeze({
      mechanicId: 'eratosthenes-sieve',
      triggered: true,
      damageMultiplier: 1.3,
      partnerEchoRatio: 0,
      stunDurationMs: 0,
      callout: `CRIVO: ${chainCount} É PRIMO!`,
    })
  }

  if (areaId === 'goldbach-citadel' && isPrimeChainCount(chainCount)) {
    return Object.freeze({
      mechanicId: 'goldbach-pair',
      triggered: true,
      damageMultiplier: 1,
      partnerEchoRatio: 0.4,
      stunDurationMs: 0,
      callout: 'GOLDBACH: DANO EM PAR!',
    })
  }

  if (areaId === 'wilson-observatory' && chainCount === PRIME_CHAIN_LIMIT) {
    return Object.freeze({
      mechanicId: 'wilson-verdict',
      triggered: true,
      damageMultiplier: 2.25,
      partnerEchoRatio: 0,
      stunDurationMs: 1_600,
      callout: 'WILSON: 13 CONFIRMADO!',
    })
  }

  const mechanic = getPrimeStageMechanic(areaId)
  if (!mechanic) return NEUTRAL_STAGE_HIT_EFFECT

  return Object.freeze({
    ...NEUTRAL_STAGE_HIT_EFFECT,
    mechanicId: mechanic.id,
  })
}
