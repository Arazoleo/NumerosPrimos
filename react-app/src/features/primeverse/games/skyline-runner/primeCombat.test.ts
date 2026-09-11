import { describe, expect, it } from 'vitest'

import {
  PRIME_POWERS,
  PRIME_POWER_VALUES,
  calculatePrimeDamage,
  doesPrimeFactorComposite,
  getMatchingPrimePowers,
  getPrimePower,
  isCompositeNumber,
  isPrimeNumber,
  resolvePrimeShot,
  selectPrimeTarget,
  type PrimeCombatTarget,
} from './primeCombat'

function target(
  id: string,
  compositeNumber: number,
  x: number,
  z: number,
  health = 100,
): PrimeCombatTarget {
  return {
    id,
    compositeNumber,
    position: { x, y: 1, z },
    health,
  }
}

const ORIGIN = { x: 0, y: 1, z: 0 } as const
const FORWARD = { x: 0, y: 0, z: -1 } as const

describe('Skyline prime power definitions', () => {
  it('defines distinct, immutable powers for 2, 3 and 5', () => {
    expect(PRIME_POWER_VALUES).toEqual([2, 3, 5])
    expect(Object.keys(PRIME_POWERS)).toEqual(['2', '3', '5'])

    const powers = PRIME_POWER_VALUES.map(getPrimePower)
    expect(new Set(powers.map((power) => power.label)).size).toBe(3)
    expect(new Set(powers.map((power) => power.color)).size).toBe(3)
    expect(powers.every((power) => power.cadenceMs > 0)).toBe(true)
    expect(powers.every((power) => power.damage > 0)).toBe(true)
    expect(powers.every((power) => power.range > 0)).toBe(true)
    expect(Object.isFrozen(PRIME_POWERS)).toBe(true)
    expect(Object.isFrozen(PRIME_POWERS[2])).toBe(true)
  })

  it('rejects powers outside the collected 2/3/5 set', () => {
    expect(() => getPrimePower(7)).toThrow(/unsupported prime power/i)
    expect(() => calculatePrimeDamage(11, 22)).toThrow(RangeError)
  })
})

describe('prime factor weaknesses', () => {
  it('recognizes prime and composite integers without misclassifying boundaries', () => {
    expect(isPrimeNumber(2)).toBe(true)
    expect(isPrimeNumber(97)).toBe(true)
    expect(isPrimeNumber(1)).toBe(false)
    expect(isPrimeNumber(9)).toBe(false)
    expect(isPrimeNumber(2.5)).toBe(false)
    expect(isCompositeNumber(4)).toBe(true)
    expect(isCompositeNumber(9)).toBe(true)
    expect(isCompositeNumber(3)).toBe(false)
  })

  it('maps the four sentinels to their correct available powers', () => {
    expect(getMatchingPrimePowers(4)).toEqual([2])
    expect(getMatchingPrimePowers(6)).toEqual([2, 3])
    expect(getMatchingPrimePowers(9)).toEqual([3])
    expect(getMatchingPrimePowers(10)).toEqual([2, 5])
  })

  it('checks the mathematical factor instead of only a lookup table', () => {
    expect(doesPrimeFactorComposite(7, 49)).toBe(true)
    expect(doesPrimeFactorComposite(5, 12)).toBe(false)
    expect(doesPrimeFactorComposite(4, 12)).toBe(false)
    expect(doesPrimeFactorComposite(2, 2)).toBe(false)
    expect(doesPrimeFactorComposite(Number.NaN, 10)).toBe(false)
  })

  it('deals damage only when the selected prime actually factors the enemy', () => {
    expect(calculatePrimeDamage(2, 4)).toBe(PRIME_POWERS[2].damage)
    expect(calculatePrimeDamage(3, 9, 1.5)).toBe(
      PRIME_POWERS[3].damage * 1.5,
    )
    expect(calculatePrimeDamage(5, 9)).toBe(0)
    expect(() => calculatePrimeDamage(2, 4, -1)).toThrow(/non-negative/)
  })
})

describe('prime target selection', () => {
  it('selects the target closest to the reticle and reports its weakness', () => {
    const closeButOffAxis = target('four', 4, 4.2, -10)
    const centered = target('six', 6, 0.1, -15)
    const selection = selectPrimeTarget({
      power: 3,
      origin: ORIGIN,
      viewDirection: FORWARD,
      targets: [closeButOffAxis, centered],
      minimumAlignment: 0.75,
    })

    expect(selection?.target.id).toBe('six')
    expect(selection?.factorMatch).toBe(true)
    expect(selection?.alignment).toBeGreaterThan(0.99)
  })

  it('respects health, enabled state, range, alignment and line of sight', () => {
    const dead = target('dead', 4, 0, -5, 0)
    const disabled = { ...target('disabled', 4, 0, -6), enabled: false }
    const behind = target('behind', 4, 0, 5)
    const blocked = target('blocked', 4, 0, -7)
    const tooFar = target('far', 4, 0, -100)

    expect(selectPrimeTarget({
      power: 2,
      origin: ORIGIN,
      viewDirection: FORWARD,
      targets: [dead, disabled, behind, blocked, tooFar],
      hasLineOfSight: (_origin, candidate) => candidate.id !== 'blocked',
    })).toBeNull()
  })

  it('can limit aim assist to factor-compatible targets', () => {
    const nine = target('nine', 9, 0, -6)
    const ten = target('ten', 10, 0.25, -8)

    expect(selectPrimeTarget({
      power: 5,
      origin: ORIGIN,
      viewDirection: FORWARD,
      targets: [nine, ten],
    })?.target.id).toBe('nine')

    expect(selectPrimeTarget({
      power: 5,
      origin: ORIGIN,
      viewDirection: FORWARD,
      targets: [nine, ten],
      factorMatchesOnly: true,
    })?.target.id).toBe('ten')
  })

  it('uses the power range as a hard cap and validates targeting inputs', () => {
    const beyondBinary = target('distant-four', 4, 0, -30)
    expect(selectPrimeTarget({
      power: 2,
      origin: ORIGIN,
      viewDirection: FORWARD,
      targets: [beyondBinary],
      maxRange: 1_000,
    })).toBeNull()
    expect(selectPrimeTarget({
      power: 5,
      origin: ORIGIN,
      viewDirection: FORWARD,
      targets: [beyondBinary],
    })?.target.id).toBe('distant-four')

    expect(() => selectPrimeTarget({
      power: 2,
      origin: ORIGIN,
      viewDirection: { x: 0, y: 0, z: 0 },
      targets: [],
    })).toThrow(/zero vector/)
    expect(() => selectPrimeTarget({
      power: 2,
      origin: ORIGIN,
      viewDirection: FORWARD,
      targets: [],
      minimumAlignment: 1.1,
    })).toThrow(/between 0 and 1/)
  })
})

describe('prime shot resolution', () => {
  it('applies the matching power, clamps overkill and reports defeat', () => {
    const sentinel = target('sentinel-nine', 9, 0, -12, 20)
    const result = resolvePrimeShot({
      power: 3,
      origin: ORIGIN,
      target: sentinel,
      nowMs: 1_000,
    })

    expect(result.reason).toBe('hit')
    expect(result.fired).toBe(true)
    expect(result.hit).toBe(true)
    expect(result.factorMatch).toBe(true)
    expect(result.damage).toBe(20)
    expect(result.remainingHealth).toBe(0)
    expect(result.defeated).toBe(true)
    expect(result.nextReadyAtMs).toBe(1_000 + PRIME_POWERS[3].cadenceMs)
  })

  it('fires without damaging an enemy when the factor is wrong', () => {
    const sentinel = target('sentinel-nine', 9, 0, -8)
    const result = resolvePrimeShot({
      power: 5,
      origin: ORIGIN,
      target: sentinel,
      nowMs: 500,
    })

    expect(result.reason).toBe('wrong-factor')
    expect(result.fired).toBe(true)
    expect(result.hit).toBe(false)
    expect(result.factorMatch).toBe(false)
    expect(result.damage).toBe(0)
    expect(result.remainingHealth).toBe(100)
  })

  it('blocks repeated casts until cadence has elapsed, including exact edge', () => {
    const sentinel = target('sentinel-four', 4, 0, -8)
    const cooling = resolvePrimeShot({
      power: 2,
      origin: ORIGIN,
      target: sentinel,
      nowMs: 1_219,
      lastFiredAtMs: 1_000,
    })
    expect(cooling.reason).toBe('cooldown')
    expect(cooling.fired).toBe(false)
    expect(cooling.cooldownRemainingMs).toBe(1)

    const ready = resolvePrimeShot({
      power: 2,
      origin: ORIGIN,
      target: sentinel,
      nowMs: 1_220,
      lastFiredAtMs: 1_000,
    })
    expect(ready.reason).toBe('hit')
    expect(ready.fired).toBe(true)
  })

  it('consumes a cast outside range but does not hit', () => {
    const sentinel = target('sentinel-four', 4, 0, -40)
    const result = resolvePrimeShot({
      power: 2,
      origin: ORIGIN,
      target: sentinel,
      nowMs: 10,
    })

    expect(result.reason).toBe('out-of-range')
    expect(result.fired).toBe(true)
    expect(result.hit).toBe(false)
    expect(result.damage).toBe(0)
    expect(result.cooldownRemainingMs).toBe(PRIME_POWERS[2].cadenceMs)
  })

  it('does not fire at defeated or disabled targets and validates state', () => {
    const defeated = target('sentinel-ten', 10, 0, -4, 0)
    expect(resolvePrimeShot({
      power: 5,
      origin: ORIGIN,
      target: defeated,
      nowMs: 200,
    }).reason).toBe('target-unavailable')

    expect(() => resolvePrimeShot({
      power: 2,
      origin: ORIGIN,
      target: target('bad', 7, 0, -4),
      nowMs: 200,
    })).toThrow(/must be composite/)
    expect(() => resolvePrimeShot({
      power: 2,
      origin: ORIGIN,
      target: target('four', 4, 0, -4),
      nowMs: Number.NaN,
    })).toThrow(/finite/)
  })
})
