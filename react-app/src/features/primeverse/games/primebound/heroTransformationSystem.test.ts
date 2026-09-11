import { describe, expect, it } from 'vitest'

import { HERO_CLASS_IDS } from './heroClassSystem'
import {
  HERO_TRANSFORMATION_CLASS_IDS,
  HERO_TRANSFORMATION_DURATION_MS,
  HERO_TRANSFORMATIONS,
  getHeroTransformationElapsedMs,
  getHeroTransformationProgress,
  getHeroTransformationRemainingMs,
  isHeroTransformationActive,
  isHeroTransformationExpired,
  resolveHeroTransformationDefinition,
  startHeroTransformation,
  type HeroTransformationState,
} from './heroTransformationSystem'

describe('hero transformation definitions', () => {
  it('defines one exclusive 40-second transformation for all eight hero classes', () => {
    expect(HERO_TRANSFORMATION_DURATION_MS).toBe(40_000)
    expect(HERO_TRANSFORMATION_CLASS_IDS).toEqual(HERO_CLASS_IDS)
    expect(Object.keys(HERO_TRANSFORMATIONS).sort()).toEqual([...HERO_CLASS_IDS].sort())

    for (const classId of HERO_CLASS_IDS) {
      const definition = resolveHeroTransformationDefinition(classId)
      expect(definition.classId).toBe(classId)
      expect(definition.name.length).toBeGreaterThan(12)
      expect(definition.title.length).toBeGreaterThan(12)
      expect(definition.battleCry.length).toBeGreaterThan(30)
      expect(definition.formula.length).toBeGreaterThan(6)
      expect(definition.description.length).toBeGreaterThan(40)
      expect(Object.isFrozen(definition)).toBe(true)
      expect(Object.isFrozen(definition.palette)).toBe(true)
      expect(Object.isFrozen(definition.aura)).toBe(true)
      expect(Object.isFrozen(definition.aura.particleGlyphs)).toBe(true)
      expect(Object.isFrozen(definition.identity)).toBe(true)
      expect(Object.isFrozen(definition.modifiers)).toBe(true)
      expect(Object.isFrozen(definition.uniqueEffect)).toBe(true)
      expect(Object.isFrozen(definition.cinematic)).toBe(true)
    }
  })

  it('gives every class a distinct anime identity and signature mechanic', () => {
    const definitions = HERO_CLASS_IDS.map(resolveHeroTransformationDefinition)

    expect(new Set(definitions.map(({ name }) => name))).toHaveLength(HERO_CLASS_IDS.length)
    expect(new Set(definitions.map(({ formula }) => formula))).toHaveLength(HERO_CLASS_IDS.length)
    expect(new Set(definitions.map(({ aura }) => aura.style))).toHaveLength(HERO_CLASS_IDS.length)
    expect(new Set(definitions.map(({ identity }) => identity.silhouette))).toHaveLength(HERO_CLASS_IDS.length)
    expect(new Set(definitions.map(({ cinematic }) => cinematic.style))).toHaveLength(HERO_CLASS_IDS.length)
    expect(new Set(definitions.map(({ uniqueEffect }) => uniqueEffect.id))).toHaveLength(HERO_CLASS_IDS.length)
    expect(new Set(definitions.map(({ palette }) => palette.primary))).toHaveLength(HERO_CLASS_IDS.length)
    expect(new Set(definitions.map(({ palette }) => palette.eyeGlow))).toHaveLength(HERO_CLASS_IDS.length)
  })

  it('keeps the common modifier budget strong without erasing class tradeoffs', () => {
    for (const definition of Object.values(HERO_TRANSFORMATIONS)) {
      const modifiers = definition.modifiers
      expect(modifiers.damageMultiplier).toBeGreaterThan(1)
      expect(modifiers.damageMultiplier).toBeLessThanOrEqual(1.7)
      expect(modifiers.movementSpeedMultiplier).toBeGreaterThan(1)
      expect(modifiers.movementSpeedMultiplier).toBeLessThanOrEqual(1.45)
      expect(modifiers.cooldownMultiplier).toBeGreaterThanOrEqual(.5)
      expect(modifiers.cooldownMultiplier).toBeLessThan(1)
      expect(modifiers.damageTakenMultiplier).toBeGreaterThanOrEqual(.65)
      expect(modifiers.damageTakenMultiplier).toBeLessThanOrEqual(1.05)
      expect(modifiers.rangeMultiplier).toBeGreaterThan(1)
      expect(modifiers.rangeMultiplier).toBeLessThanOrEqual(1.5)
    }

    expect(HERO_TRANSFORMATIONS['prime-warrior'].modifiers.damageTakenMultiplier)
      .toBeLessThan(HERO_TRANSFORMATIONS['rsa-cryptographer'].modifiers.damageTakenMultiplier)
    expect(HERO_TRANSFORMATIONS['rsa-cryptographer'].modifiers.cooldownMultiplier)
      .toBeLessThan(HERO_TRANSFORMATIONS['prime-warrior'].modifiers.cooldownMultiplier)
    expect(HERO_TRANSFORMATIONS['modular-ranger'].modifiers.movementSpeedMultiplier)
      .toBeGreaterThan(HERO_TRANSFORMATIONS['mersenne-arcanist'].modifiers.movementSpeedMultiplier)
    expect(HERO_TRANSFORMATIONS['mersenne-arcanist'].modifiers.damageMultiplier)
      .toBeGreaterThan(HERO_TRANSFORMATIONS['modular-ranger'].modifiers.damageMultiplier)
    expect(HERO_TRANSFORMATIONS['mersenne-arcanist'].modifiers.damageTakenMultiplier)
      .toBeGreaterThan(1)
  })

  it('provides complete, bounded cinematic direction for every awakening', () => {
    for (const definition of Object.values(HERO_TRANSFORMATIONS)) {
      const cinematic = definition.cinematic
      expect(cinematic.reducedMotionDurationMs).toBeLessThan(cinematic.durationMs)
      expect(cinematic.impactAtMs).toBeGreaterThan(0)
      expect(cinematic.impactAtMs).toBeLessThan(cinematic.durationMs)
      expect(cinematic.hitStopMs).toBeGreaterThanOrEqual(100)
      expect(cinematic.peakZoom).toBeGreaterThan(1)
      expect(cinematic.maxDarkness).toBeGreaterThan(0)
      expect(cinematic.maxDarkness).toBeLessThanOrEqual(1)
      expect(cinematic.shakeAmplitude).toBeGreaterThan(0)
      expect(cinematic.rayCount).toBeGreaterThan(7)
      expect(cinematic.afterimageCount).toBeGreaterThan(4)
      expect(cinematic.openingLine.length).toBeGreaterThan(12)
      expect(cinematic.releaseLine).toMatch(/!$/)
      expect(cinematic.aftermathLine.length).toBeGreaterThan(10)
    }
  })

  it('exposes typed, class-specific transformation mechanics', () => {
    expect(HERO_TRANSFORMATIONS['prime-warrior'].uniqueEffect).toMatchObject({
      id: 'irreducible-counter', guaranteedGuards: 3,
    })
    expect(HERO_TRANSFORMATIONS['rsa-cryptographer'].uniqueEffect).toMatchObject({
      id: 'rsa-key-overflow', simultaneousMarks: 8,
    })
    expect(HERO_TRANSFORMATIONS['modular-ranger'].uniqueEffect).toMatchObject({
      id: 'modular-residue-step', echoShots: 3,
    })
    expect(HERO_TRANSFORMATIONS['mersenne-arcanist'].uniqueEffect).toMatchObject({
      id: 'mersenne-supernova', novaProjectiles: 31,
    })
    expect(HERO_TRANSFORMATIONS['mobius-assassin'].uniqueEffect).toMatchObject({
      id: 'mobius-afterimage', dashEchoDamageMultiplier: .48, dashEchoRadius: 64,
    })
    expect(HERO_TRANSFORMATIONS['goldbach-berserker'].uniqueEffect).toMatchObject({
      id: 'goldbach-overdrive', missingHealthDamageMultiplier: 1.8, impactRadius: 112,
    })
    expect(HERO_TRANSFORMATIONS['sieve-engineer'].uniqueEffect).toMatchObject({
      id: 'sieve-autoforge', pulseIntervalMs: 2_800, turretDamageMultiplier: 1.55,
    })
    expect(HERO_TRANSFORMATIONS['elliptic-oracle'].uniqueEffect).toMatchObject({
      id: 'elliptic-apotheosis', orbIntervalMs: 1_800, orbCount: 7,
    })
  })
})

describe('hero transformation lifetime', () => {
  it('starts an immutable state with an exact 40-second deadline', () => {
    const state = startHeroTransformation('prime-warrior', 12_345)

    expect(state).toEqual({
      classId: 'prime-warrior',
      startedAtMs: 12_345,
      expiresAtMs: 52_345,
      durationMs: 40_000,
    })
    expect(Object.isFrozen(state)).toBe(true)
  })

  it('reports awakening, ascended, waning, and expired progress', () => {
    const state = startHeroTransformation('rsa-cryptographer', 1_000)

    expect(getHeroTransformationProgress(state, 1_000)).toMatchObject({
      phase: 'awakening', active: true, expired: false,
      elapsedMs: 0, remainingMs: 40_000, progress: 0,
    })
    expect(getHeroTransformationProgress(state, 11_000)).toMatchObject({
      phase: 'ascended', elapsedMs: 10_000, remainingMs: 30_000, progress: .25,
    })
    expect(getHeroTransformationProgress(state, 33_000)).toMatchObject({
      phase: 'waning', elapsedMs: 32_000, remainingMs: 8_000, progress: .8,
    })
    expect(getHeroTransformationProgress(state, 41_000)).toMatchObject({
      phase: 'expired', active: false, expired: true,
      elapsedMs: 40_000, remainingMs: 0, progress: 1,
    })
  })

  it('provides direct elapsed, remaining, active, and expiration queries', () => {
    const state = startHeroTransformation('modular-ranger', 5_000)

    expect(getHeroTransformationElapsedMs(state, 20_000)).toBe(15_000)
    expect(getHeroTransformationRemainingMs(state, 20_000)).toBe(25_000)
    expect(isHeroTransformationActive(state, 44_999)).toBe(true)
    expect(isHeroTransformationExpired(state, 44_999)).toBe(false)
    expect(isHeroTransformationActive(state, 45_000)).toBe(false)
    expect(isHeroTransformationExpired(state, 45_000)).toBe(true)
    expect(getHeroTransformationElapsedMs(state, 99_000)).toBe(40_000)
    expect(getHeroTransformationRemainingMs(state, 99_000)).toBe(0)
  })

  it('rejects unknown classes, invalid clocks, time travel, and forged states', () => {
    expect(() => resolveHeroTransformationDefinition('unknown' as never)).toThrow(RangeError)
    expect(() => startHeroTransformation('prime-warrior', Number.NaN)).toThrow(RangeError)
    expect(() => startHeroTransformation('prime-warrior', -1)).toThrow(RangeError)

    const state = startHeroTransformation('mersenne-arcanist', 10_000)
    expect(() => getHeroTransformationProgress(state, 9_999)).toThrow(RangeError)
    expect(() => getHeroTransformationProgress(state, Number.POSITIVE_INFINITY)).toThrow(RangeError)

    const forgedState = {
      ...state,
      expiresAtMs: state.expiresAtMs + 1,
    } as HeroTransformationState
    expect(() => isHeroTransformationActive(forgedState, 10_000)).toThrow(RangeError)
  })

  it('survives fractional animation clocks across repeated transformations', () => {
    let clockMs = 0
    for (let frame = 0; frame < 1_533; frame += 1) clockMs += 1_000 / 60

    for (let activation = 0; activation < 24; activation += 1) {
      const state = startHeroTransformation('prime-warrior', clockMs)
      expect(isHeroTransformationActive(state, clockMs + 20_000.125)).toBe(true)
      expect(getHeroTransformationRemainingMs(state, state.expiresAtMs)).toBe(0)
      expect(isHeroTransformationExpired(state, state.expiresAtMs)).toBe(true)
      clockMs = state.expiresAtMs + 1_337.3333333333
    }
  })
})
