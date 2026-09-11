import { describe, expect, it } from 'vitest'

import {
  DEFAULT_HERO_CLASS_ID,
  HERO_ACTION_SLOTS,
  HERO_AFFINITY_IDS,
  HERO_ARCHETYPES,
  HERO_CLASSES,
  HERO_CLASS_IDS,
  HERO_CLASS_LIST,
  HERO_CINEMATIC_SLOTS,
  HERO_SLOT_ACTION_IDS,
  applyHeroClassModifiers,
  getHeroClass,
  getHeroClassAction,
  getHeroClassCinematic,
  isHeroClassId,
} from './heroClassSystem'

describe('Primebound hero class roster', () => {
  it('defines eight distinct playable classes and keeps Cael as the warrior', () => {
    expect(HERO_CLASS_IDS).toHaveLength(8)
    expect(new Set(HERO_CLASS_IDS).size).toBe(HERO_CLASS_IDS.length)
    expect(HERO_CLASS_LIST.map((heroClass) => heroClass.id)).toEqual(HERO_CLASS_IDS)
    expect(HERO_ARCHETYPES).toEqual([
      'warrior',
      'cryptographer',
      'ranger',
      'arcanist',
      'assassin',
      'berserker',
      'engineer',
      'oracle',
    ])
    expect(HERO_AFFINITY_IDS).toEqual([
      'irreducibility',
      'rsa',
      'modular-arithmetic',
      'mersenne-primes',
      'mobius-inversion',
      'goldbach-conjecture',
      'eratosthenes-sieve',
      'elliptic-curves',
    ])
    expect(DEFAULT_HERO_CLASS_ID).toBe('prime-warrior')
    expect(getHeroClass(DEFAULT_HERO_CLASS_ID)).toMatchObject({
      archetype: 'warrior',
      name: 'Guerreiro Primo',
      characterName: 'Cael',
      gender: 'man',
    })
  })

  it('includes women protagonists and complete identity metadata', () => {
    expect(HERO_CLASS_LIST.some(({ gender }) => gender === 'woman')).toBe(true)
    expect(HERO_CLASS_LIST.map(({ characterName }) => characterName)).toEqual([
      'Cael', 'Ada', 'Nara', 'Noa', 'Maia', 'Otto', 'Lena', 'Íris',
    ])

    for (const heroClass of HERO_CLASS_LIST) {
      expect(heroClass.title.length).toBeGreaterThan(0)
      expect(heroClass.lore.length).toBeGreaterThan(20)
      expect(heroClass.pronouns.length).toBeGreaterThan(0)
      expect(heroClass.affinity.name.length).toBeGreaterThan(0)
      expect(heroClass.affinity.formula.length).toBeGreaterThan(0)
      expect(heroClass.affinity.description.length).toBeGreaterThan(20)
    }

    expect(getHeroClass('mersenne-arcanist')).toMatchObject({
      characterName: 'Noa',
      gender: 'man',
      pronouns: 'ele/dele',
    })
    expect(HERO_CLASS_LIST.slice(4).map(({ id, archetype, affinity }) => ({
      id,
      archetype,
      affinityId: affinity.id,
    }))).toEqual([
      {
        id: 'mobius-assassin',
        archetype: 'assassin',
        affinityId: 'mobius-inversion',
      },
      {
        id: 'goldbach-berserker',
        archetype: 'berserker',
        affinityId: 'goldbach-conjecture',
      },
      {
        id: 'sieve-engineer',
        archetype: 'engineer',
        affinityId: 'eratosthenes-sieve',
      },
      {
        id: 'elliptic-oracle',
        archetype: 'oracle',
        affinityId: 'elliptic-curves',
      },
    ])
  })

  it('exposes valid, distinct stats and combat modifiers', () => {
    expect(new Set(HERO_CLASS_LIST.map(({ stats }) => stats.movementSpeed)).size)
      .toBe(HERO_CLASS_LIST.length)
    for (const heroClass of HERO_CLASS_LIST) {
      expect(heroClass.stats.maxHealth).toBeGreaterThan(0)
      expect(heroClass.stats.maxStamina).toBeGreaterThan(0)
      expect(heroClass.stats.movementSpeed).toBeGreaterThan(0)
      expect(Object.values(heroClass.modifiers).every((value) => value > 0)).toBe(true)
      expect(Object.values(heroClass.palette).every((color) => /^#[0-9a-f]{6}$/i.test(color))).toBe(true)
    }
  })
})

describe('Primebound hero action presentations', () => {
  it('maps every class slot to the existing canonical combat action', () => {
    expect(HERO_SLOT_ACTION_IDS).toEqual({
      J: 'basic-strike',
      '1': 'twin-blades',
      '2': 'sophie-chain',
      '3': 'mersenne-burst',
      Q: 'irreducible-aegis',
      R: 'prime-infinity',
    })

    for (const heroClass of HERO_CLASS_LIST) {
      for (const slot of HERO_ACTION_SLOTS) {
        const action = getHeroClassAction(heroClass.id, slot)
        expect(action.slot).toBe(slot)
        expect(action.actionId).toBe(HERO_SLOT_ACTION_IDS[slot])
        expect(action.label.length).toBeGreaterThan(0)
        expect(action.spokenName.endsWith('!')).toBe(true)
        expect(action.description.length).toBeGreaterThan(20)
      }
    }
  })

  it('provides class direction for the Mersenne and ultimate cinematics', () => {
    for (const heroClass of HERO_CLASS_LIST) {
      for (const slot of HERO_CINEMATIC_SLOTS) {
        const cinematic = getHeroClassCinematic(heroClass.id, slot)
        expect(cinematic.slot).toBe(slot)
        expect(cinematic.actionId).toBe(HERO_SLOT_ACTION_IDS[slot])
        expect(cinematic.title.length).toBeGreaterThan(0)
        expect(cinematic.spokenName.endsWith('!')).toBe(true)
        expect(cinematic.motif.length).toBeGreaterThan(20)
        expect(Object.values(cinematic.lines).every((line) => line.length > 0)).toBe(true)
        expect(cinematic.visual.peakZoom).toBeGreaterThanOrEqual(1)
        expect(cinematic.visual.maxDarkness).toBeGreaterThanOrEqual(0)
        expect(cinematic.visual.maxDarkness).toBeLessThanOrEqual(1)
        expect(cinematic.visual.shakeAmplitude).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('Primebound hero class APIs', () => {
  it('looks classes up safely and rejects unsupported IDs', () => {
    expect(isHeroClassId('rsa-cryptographer')).toBe(true)
    expect(isHeroClassId('unknown')).toBe(false)
    expect(getHeroClass('rsa-cryptographer')).toBe(HERO_CLASSES['rsa-cryptographer'])
    expect(() => getHeroClass('unknown' as 'prime-warrior')).toThrow(RangeError)
  })

  it('applies modifiers purely and preserves temporal values as integers', () => {
    const source = {
      damage: 50,
      incomingDamage: 20,
      cooldownMs: 1_001,
      ultimateChargeGain: 10,
      parryWindowMs: 181,
    }
    const result = applyHeroClassModifiers('rsa-cryptographer', source)

    expect(result).toEqual({
      damage: 48,
      incomingDamage: 20.8,
      cooldownMs: 821,
      ultimateChargeGain: 12.2,
      parryWindowMs: 199,
    })
    expect(source).toEqual({
      damage: 50,
      incomingDamage: 20,
      cooldownMs: 1_001,
      ultimateChargeGain: 10,
      parryWindowMs: 181,
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(() => applyHeroClassModifiers('prime-warrior', {
      ...source,
      damage: Number.NaN,
    })).toThrow(RangeError)
  })

  it('deep-freezes definitions exposed to selection and HUD code', () => {
    const heroClass = getHeroClass('mersenne-arcanist')
    expect(Object.isFrozen(HERO_CLASSES)).toBe(true)
    expect(Object.isFrozen(HERO_CLASS_LIST)).toBe(true)
    expect(Object.isFrozen(heroClass)).toBe(true)
    expect(Object.isFrozen(heroClass.affinity)).toBe(true)
    expect(Object.isFrozen(heroClass.palette)).toBe(true)
    expect(Object.isFrozen(heroClass.stats)).toBe(true)
    expect(Object.isFrozen(heroClass.modifiers)).toBe(true)
    expect(Object.isFrozen(heroClass.actions)).toBe(true)
    expect(Object.isFrozen(heroClass.actions.J)).toBe(true)
    expect(Object.isFrozen(heroClass.cinematics)).toBe(true)
    expect(Object.isFrozen(heroClass.cinematics.R.lines)).toBe(true)
    expect(Object.isFrozen(heroClass.cinematics.R.visual)).toBe(true)
  })
})
