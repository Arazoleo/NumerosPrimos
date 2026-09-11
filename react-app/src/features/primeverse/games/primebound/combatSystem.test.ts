import { describe, expect, it } from 'vitest'

import {
  IRREDUCIBLE_AEGIS,
  OFFENSIVE_ACTIONS,
  PRIME_FAMILIES,
  TECHNIQUE_IDS,
  ULTIMATE_MAX_CHARGE,
  addUltimateCharge,
  applyCombatDamage,
  beginDefense,
  calculateActionDamage,
  consumeUltimateCharge,
  createDefenseState,
  gainUltimateCharge,
  gainUltimateChargeFromAction,
  getCooldownRemaining,
  getDefenseStatus,
  getOffensiveActionAvailability,
  getOffensiveAction,
  getPrimeFamily,
  isCooldownReady,
  isUltimateReady,
  resolveDefenseHit,
  startCooldown,
} from './combatSystem'

describe('Primebound combat metadata', () => {
  it('defines a basic strike, three prime-family techniques and an ultimate', () => {
    expect(TECHNIQUE_IDS).toEqual(['twin-blades', 'sophie-chain', 'mersenne-burst'])
    expect(OFFENSIVE_ACTIONS['basic-strike'].kind).toBe('basic')
    expect(OFFENSIVE_ACTIONS['prime-infinity'].kind).toBe('ultimate')

    const techniqueFamilies = TECHNIQUE_IDS.map(
      (techniqueId) => OFFENSIVE_ACTIONS[techniqueId].family,
    )
    expect(techniqueFamilies).toEqual(['twin-primes', 'sophie-germain', 'mersenne'])
    expect(new Set(TECHNIQUE_IDS.map(
      (techniqueId) => OFFENSIVE_ACTIONS[techniqueId].spokenName,
    )).size).toBe(3)
    expect(Object.isFrozen(OFFENSIVE_ACTIONS)).toBe(true)
    expect(Object.isFrozen(OFFENSIVE_ACTIONS['twin-blades'].hitDamages)).toBe(true)
  })

  it('keeps the formulas and Portuguese names available for dialogue and tutorials', () => {
    expect(PRIME_FAMILIES['twin-primes'].formula).toContain('p + 2')
    expect(PRIME_FAMILIES['sophie-germain'].formula).toContain('2p + 1')
    expect(PRIME_FAMILIES.mersenne.formula).toContain('2^p − 1')
    expect(getPrimeFamily('twin-primes').name).toBe('Primos Gêmeos')
    expect(IRREDUCIBLE_AEGIS).toMatchObject({
      id: 'irreducible-aegis',
      name: 'Guarda de Wilson',
      spokenName: 'Guarda de Wilson!',
      parrySpokenName: 'Teorema de Wilson!',
      formula: '(p − 1)! ≡ −1 (mod p)',
    })
    expect(IRREDUCIBLE_AEGIS.description).toContain('fatorial anterior')
    expect(() => getPrimeFamily('unknown' as 'mersenne')).toThrow(RangeError)
    expect(() => getOffensiveAction('unknown' as 'basic-strike')).toThrow(RangeError)
  })
})

describe('Primebound action damage', () => {
  it('resolves the normal attack and the characteristic hit pattern of each family', () => {
    expect(calculateActionDamage('basic-strike').hits).toEqual([14])
    expect(calculateActionDamage('twin-blades').hits).toEqual([18, 18])
    expect(calculateActionDamage('sophie-chain').hits).toEqual([16, 32])
    expect(calculateActionDamage('mersenne-burst').hits).toEqual([16, 22, 30])
    expect(calculateActionDamage('prime-infinity').totalDamage).toBe(110)
  })

  it('applies multipliers and armor per hit without producing negative damage', () => {
    expect(calculateActionDamage('twin-blades', {
      multiplier: 1.5,
      armorPerHit: 2,
    })).toMatchObject({ hits: [25, 25], totalDamage: 50 })
    expect(calculateActionDamage('basic-strike', { armorPerHit: 99 }).totalDamage).toBe(0)
    expect(() => calculateActionDamage('basic-strike', { multiplier: -1 })).toThrow(RangeError)
  })

  it('clamps overkill and reports a defeated target', () => {
    expect(applyCombatDamage(30, 110)).toEqual({
      previousHealth: 30,
      health: 0,
      requestedDamage: 110,
      damageTaken: 30,
      defeated: true,
    })
    expect(applyCombatDamage(30, 12)).toMatchObject({ health: 18, defeated: false })
    expect(() => applyCombatDamage(-1, 4)).toThrow(RangeError)
  })
})

describe('Primebound cooldown rules', () => {
  it('starts independent cooldowns and becomes ready on the exact boundary', () => {
    const first = startCooldown({}, 'twin-blades', 1_000)
    expect(first['twin-blades']).toBe(4_200)
    expect(getCooldownRemaining(first, 'twin-blades', 1_100)).toBe(3_100)
    expect(isCooldownReady(first, 'twin-blades', 4_199)).toBe(false)
    expect(isCooldownReady(first, 'twin-blades', 4_200)).toBe(true)
    expect(isCooldownReady(first, 'sophie-chain', 1_100)).toBe(true)
  })

  it('never shortens an active cooldown and validates temporal state', () => {
    const cooling = { 'mersenne-burst': 10_000 } as const
    expect(startCooldown(cooling, 'mersenne-burst', 1_000)['mersenne-burst']).toBe(10_000)
    expect(() => getCooldownRemaining({ 'basic-strike': -1 }, 'basic-strike', 0)).toThrow(RangeError)
    expect(() => startCooldown({}, 'basic-strike', Number.NaN)).toThrow(RangeError)
  })

  it('reports unlock, cooldown and ultimate-meter gates through one UI-safe result', () => {
    expect(getOffensiveActionAvailability({
      actionId: 'sophie-chain',
      nowMs: 1_000,
      cooldowns: {},
      collectedRuneCount: 1,
      ultimateCharge: 100,
    })).toMatchObject({ available: false, reason: 'locked', missingRuneCount: 1 })

    expect(getOffensiveActionAvailability({
      actionId: 'prime-infinity',
      nowMs: 1_000,
      cooldowns: {},
      collectedRuneCount: 3,
      ultimateCharge: 75,
    })).toMatchObject({
      available: false,
      reason: 'ultimate-not-ready',
      missingUltimateCharge: 25,
    })

    expect(getOffensiveActionAvailability({
      actionId: 'prime-infinity',
      nowMs: 1_000,
      cooldowns: {},
      collectedRuneCount: 3,
      ultimateCharge: 100,
    })).toMatchObject({ available: true, reason: 'ready' })
  })
})

describe('Primebound ultimate meter', () => {
  it('gains charge from combat events and clamps it between zero and one hundred', () => {
    expect(gainUltimateCharge(0, 'basic-hit')).toBe(6)
    expect(gainUltimateCharge(80, 'perfect-parry')).toBe(100)
    expect(gainUltimateCharge(10, 'enemy-defeated', 2)).toBe(46)
    expect(gainUltimateChargeFromAction(10, 'mersenne-burst')).toBe(30)
    expect(addUltimateCharge(98, 20)).toBe(ULTIMATE_MAX_CHARGE)
    expect(isUltimateReady(99.99)).toBe(false)
    expect(isUltimateReady(100)).toBe(true)
    expect(() => addUltimateCharge(0, -1)).toThrow(RangeError)
  })

  it('only consumes a complete meter and preserves partial charge', () => {
    expect(consumeUltimateCharge(72)).toEqual({ activated: false, charge: 72 })
    expect(consumeUltimateCharge(100)).toEqual({ activated: true, charge: 0 })
    expect(consumeUltimateCharge(140)).toEqual({ activated: true, charge: 0 })
  })
})

describe('Primebound defense and parry', () => {
  it('opens an exact parry window followed by guard and cooldown phases', () => {
    const initial = createDefenseState()
    const defense = beginDefense(initial, 1_000)
    expect(defense.activated).toBe(true)
    expect(defense.state).toEqual({
      startedAtMs: 1_000,
      parryUntilMs: 1_180,
      guardUntilMs: 1_680,
      cooldownUntilMs: 2_400,
    })
    expect(getDefenseStatus(defense.state, 1_180)).toBe('parry')
    expect(getDefenseStatus(defense.state, 1_181)).toBe('guard')
    expect(getDefenseStatus(defense.state, 1_681)).toBe('cooldown')
    expect(getDefenseStatus(defense.state, 2_400)).toBe('ready')
  })

  it('prevents, reflects, staggers and charges the ultimate on a perfect parry', () => {
    const defense = beginDefense(createDefenseState(), 1_000).state
    const result = resolveDefenseHit(defense, 40, 1_100)
    expect(result).toMatchObject({
      outcome: 'parried',
      damageTaken: 0,
      damagePrevented: 40,
      reflectedDamage: 28,
      staggerMs: 620,
      ultimateChargeGained: 24,
      spokenName: 'Teorema de Wilson!',
    })
    expect(getDefenseStatus(result.state, 1_101)).toBe('cooldown')
  })

  it('does not grant a perfect parry or consume the posture for zero damage', () => {
    const defense = beginDefense(createDefenseState(), 0).state
    const result = resolveDefenseHit(defense, 0, 100)
    expect(result).toMatchObject({
      outcome: 'hit',
      damageTaken: 0,
      reflectedDamage: 0,
      ultimateChargeGained: 0,
    })
    expect(getDefenseStatus(result.state, 100)).toBe('parry')
  })

  it('reduces damage during guard and lets hits through outside the posture', () => {
    const defense = beginDefense(createDefenseState(), 500).state
    expect(resolveDefenseHit(defense, 20, 900)).toMatchObject({
      outcome: 'blocked',
      damageTaken: 6,
      damagePrevented: 14,
      reflectedDamage: 0,
    })
    expect(resolveDefenseHit(defense, 20, 1_181)).toMatchObject({
      outcome: 'hit',
      damageTaken: 20,
      damagePrevented: 0,
    })
  })

  it('rejects a repeated defense until cooldown has ended', () => {
    const defense = beginDefense(createDefenseState(), 1_000).state
    const repeated = beginDefense(defense, 1_900)
    expect(repeated).toMatchObject({
      activated: false,
      status: 'cooldown',
      cooldownRemainingMs: 500,
    })
    expect(beginDefense(defense, 2_400).activated).toBe(true)
  })
})
