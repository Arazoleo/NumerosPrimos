import { describe, expect, it } from 'vitest'

import {
  PRIME_CHAIN_LIMIT,
  PRIME_CHAIN_PRIMES,
  PRIME_STAGE_MECHANICS,
  advancePrimeChainCount,
  getPrimeStageMechanic,
  isPrimeChainCount,
  resolvePrimeStageHitEffect,
} from './primeStageMechanics'

describe('Primebound prime-chain arithmetic', () => {
  it('advances from zero through 13 and then wraps back to one', () => {
    let count = 0
    const sequence = Array.from({ length: PRIME_CHAIN_LIMIT + 1 }, () => {
      count = advancePrimeChainCount(count)
      return count
    })

    expect(sequence).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 1])
  })

  it('recognizes only the primes available in the 1..13 chain', () => {
    const detected = Array.from({ length: PRIME_CHAIN_LIMIT }, (_, index) => index + 1)
      .filter(isPrimeChainCount)

    expect(detected).toEqual(PRIME_CHAIN_PRIMES)
    expect(isPrimeChainCount(0)).toBe(false)
    expect(isPrimeChainCount(14)).toBe(false)
  })

  it('rejects invalid chain state instead of silently corrupting the combo', () => {
    expect(() => advancePrimeChainCount(-1)).toThrow(RangeError)
    expect(() => advancePrimeChainCount(2.5)).toThrow(RangeError)
    expect(() => advancePrimeChainCount(14)).toThrow(RangeError)
    expect(() => resolvePrimeStageHitEffect('echo-woods', 0)).toThrow(RangeError)
  })
})

describe('Primebound stage mechanic metadata', () => {
  it('exposes player-facing labels and formulas for every mathematical stage', () => {
    expect(PRIME_STAGE_MECHANICS['eratosthenes-garden']).toMatchObject({
      label: 'Crivo de Eratóstenes',
      formula: '2, 3, 5, 7, 11, 13',
      trigger: 'prime-chain',
    })
    expect(PRIME_STAGE_MECHANICS['goldbach-citadel'].formula).toBe('2n = p + q')
    expect(PRIME_STAGE_MECHANICS['wilson-observatory'].formula).toContain('mod p')
    expect(Object.isFrozen(PRIME_STAGE_MECHANICS)).toBe(true)
    expect(Object.isFrozen(PRIME_STAGE_MECHANICS['eratosthenes-garden'])).toBe(true)
  })

  it('returns no mechanic outside the three special stages', () => {
    expect(getPrimeStageMechanic('echo-woods')).toBeNull()
    expect(getPrimeStageMechanic('prime-sanctuary')).toBeNull()
    expect(getPrimeStageMechanic('goldbach-citadel')?.id).toBe('goldbach-pair')
  })
})

describe('Primebound per-stage hit rules', () => {
  it('lets prime counts pass through the Eratosthenes sieve with bonus damage', () => {
    for (const count of PRIME_CHAIN_PRIMES) {
      expect(resolvePrimeStageHitEffect('eratosthenes-garden', count)).toMatchObject({
        mechanicId: 'eratosthenes-sieve',
        triggered: true,
        damageMultiplier: 1.3,
        partnerEchoRatio: 0,
        stunDurationMs: 0,
      })
    }

    expect(resolvePrimeStageHitEffect('eratosthenes-garden', 9)).toMatchObject({
      mechanicId: 'eratosthenes-sieve',
      triggered: false,
      damageMultiplier: 1,
    })
  })

  it('echoes Goldbach damage to a partner only on a prime count', () => {
    expect(resolvePrimeStageHitEffect('goldbach-citadel', 7)).toMatchObject({
      mechanicId: 'goldbach-pair',
      triggered: true,
      damageMultiplier: 1,
      partnerEchoRatio: 0.4,
      callout: 'GOLDBACH: DANO EM PAR!',
    })
    expect(resolvePrimeStageHitEffect('goldbach-citadel', 8)).toMatchObject({
      mechanicId: 'goldbach-pair',
      triggered: false,
      partnerEchoRatio: 0,
    })
  })

  it('releases Wilson full damage and stun exactly on the thirteenth hit', () => {
    expect(resolvePrimeStageHitEffect('wilson-observatory', 13)).toEqual({
      mechanicId: 'wilson-verdict',
      triggered: true,
      damageMultiplier: 2.25,
      partnerEchoRatio: 0,
      stunDurationMs: 1_600,
      callout: 'WILSON: 13 CONFIRMADO!',
    })
    expect(resolvePrimeStageHitEffect('wilson-observatory', 11)).toMatchObject({
      mechanicId: 'wilson-verdict',
      triggered: false,
      damageMultiplier: 1,
      stunDurationMs: 0,
    })
  })

  it('keeps ordinary areas neutral', () => {
    expect(resolvePrimeStageHitEffect('composite-crypt', 13)).toEqual({
      mechanicId: null,
      triggered: false,
      damageMultiplier: 1,
      partnerEchoRatio: 0,
      stunDurationMs: 0,
      callout: null,
    })
  })
})
