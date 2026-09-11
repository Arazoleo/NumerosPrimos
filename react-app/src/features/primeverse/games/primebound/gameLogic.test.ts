import { describe, expect, it } from 'vitest'

import {
  aabbsIntersect,
  applyDamage,
  calculateScore,
  canDash,
  circleIntersectsAabb,
  circlesIntersect,
  clamp,
  directionVector,
  distance,
  evaluateRuneOrder,
  isSwordAttackHit,
  normalizeMovement,
  SCORE_RULES,
  verifyRuneOrder,
} from './gameLogic'
import type { DashEligibilityInput, SwordAttack } from './types'

describe('Primebound vector and collision logic', () => {
  it('clamps values and rejects malformed intervals', () => {
    expect(clamp(-4, 0, 10)).toBe(0)
    expect(clamp(4, 0, 10)).toBe(4)
    expect(clamp(14, 0, 10)).toBe(10)
    expect(() => clamp(2, 4, 3)).toThrow(RangeError)
    expect(() => clamp(Number.NaN, 0, 1)).toThrow(RangeError)
  })

  it('measures distance and normalizes diagonal movement without accelerating it', () => {
    expect(distance({ x: 1, y: 2 }, { x: 4, y: 6 })).toBe(5)
    expect(normalizeMovement({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 })

    const diagonal = normalizeMovement({ x: 1, y: 1 })
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1)
    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2)
    expect(directionVector('up')).toEqual({ x: 0, y: -1 })
    expect(directionVector('right')).toEqual({ x: 1, y: 0 })
    expect(() => distance({ x: Number.POSITIVE_INFINITY, y: 0 }, { x: 0, y: 0 })).toThrow(RangeError)
  })

  it('detects inclusive circle and AABB contacts, including corners', () => {
    expect(circlesIntersect(
      { center: { x: 0, y: 0 }, radius: 2 },
      { center: { x: 5, y: 0 }, radius: 3 },
    )).toBe(true)
    expect(circlesIntersect(
      { center: { x: 0, y: 0 }, radius: 2 },
      { center: { x: 5.01, y: 0 }, radius: 3 },
    )).toBe(false)

    const wall = { x: 3, y: 3, width: 4, height: 2 }
    expect(circleIntersectsAabb({ center: { x: 4, y: 4 }, radius: 0 }, wall)).toBe(true)
    expect(circleIntersectsAabb({ center: { x: 2, y: 3 }, radius: 1 }, wall)).toBe(true)
    expect(circleIntersectsAabb({ center: { x: 2, y: 2 }, radius: Math.SQRT2 }, wall)).toBe(true)
    expect(circleIntersectsAabb({ center: { x: 1.9, y: 1.9 }, radius: 1.5 }, wall)).toBe(false)
    expect(() => circleIntersectsAabb(
      { center: { x: 0, y: 0 }, radius: -1 },
      wall,
    )).toThrow(RangeError)
  })

  it('detects inclusive overlap between axis-aligned trigger regions', () => {
    expect(aabbsIntersect(
      { x: 0, y: 0, width: 2, height: 2 },
      { x: 2, y: 1, width: 1, height: 1 },
    )).toBe(true)
    expect(aabbsIntersect(
      { x: 0, y: 0, width: 2, height: 2 },
      { x: 2.01, y: 1, width: 1, height: 1 },
    )).toBe(false)
  })
})

describe('Primebound combat logic', () => {
  it('applies damage, grants invulnerability and clamps lethal hits', () => {
    const firstHit = applyDamage(
      { health: 5, invulnerableUntilMs: 0 },
      { amount: 2, nowMs: 1_000, invulnerabilityMs: 500 },
    )
    expect(firstHit).toEqual({
      health: 3,
      invulnerableUntilMs: 1_500,
      applied: true,
      damageTaken: 2,
      defeated: false,
    })

    const ignoredHit = applyDamage(firstHit, {
      amount: 3,
      nowMs: 1_499,
      invulnerabilityMs: 500,
    })
    expect(ignoredHit).toMatchObject({ health: 3, applied: false, damageTaken: 0 })

    const lethalHit = applyDamage(firstHit, {
      amount: 99,
      nowMs: 1_500,
      invulnerabilityMs: 500,
    })
    expect(lethalHit).toMatchObject({ health: 0, applied: true, damageTaken: 3, defeated: true })
  })

  it('does not consume invulnerability for zero damage and validates combat values', () => {
    expect(applyDamage(
      { health: 4, invulnerableUntilMs: 0 },
      { amount: 0, nowMs: 100, invulnerabilityMs: 400 },
    )).toEqual({
      health: 4,
      invulnerableUntilMs: 0,
      applied: false,
      damageTaken: 0,
      defeated: false,
    })
    expect(() => applyDamage(
      { health: 4, invulnerableUntilMs: 0 },
      { amount: -1, nowMs: 100, invulnerabilityMs: 400 },
    )).toThrow(RangeError)
  })

  it('hits targets inside the sword range and facing arc', () => {
    const attack: SwordAttack = {
      origin: { x: 10, y: 10 },
      facing: 'right',
      range: 3,
      arcRadians: Math.PI / 2,
    }

    expect(isSwordAttackHit(attack, {
      center: { x: 13.5, y: 10 },
      radius: 0.5,
    })).toBe(true)
    expect(isSwordAttackHit(attack, {
      center: { x: 10, y: 7.5 },
      radius: 0.25,
    })).toBe(false)
    expect(isSwordAttackHit(attack, {
      center: { x: 6.5, y: 10 },
      radius: 0.5,
    })).toBe(false)
    expect(isSwordAttackHit(attack, {
      center: { x: 10.1, y: 10 },
      radius: 0.2,
    })).toBe(true)
  })

  it('accounts for a target radius that overlaps the edge of the sword arc', () => {
    const attack: SwordAttack = {
      origin: { x: 0, y: 0 },
      facing: 'right',
      range: 5,
      arcRadians: Math.PI / 3,
    }
    expect(isSwordAttackHit(attack, {
      center: { x: 3, y: 2.5 },
      radius: 1,
    })).toBe(true)
    expect(() => isSwordAttackHit(
      { ...attack, arcRadians: Math.PI * 2 + 0.01 },
      { center: { x: 1, y: 0 }, radius: 0.2 },
    )).toThrow(RangeError)
  })
})

describe('Primebound progression logic', () => {
  const readyDash: DashEligibilityInput = {
    phase: 'playing',
    nowMs: 2_000,
    lastDashAtMs: 1_000,
    cooldownMs: 1_000,
    stamina: 3,
    staminaCost: 3,
    isDashing: false,
  }

  it('allows a dash exactly at the cooldown and stamina boundaries', () => {
    expect(canDash(readyDash)).toBe(true)
    expect(canDash({ ...readyDash, lastDashAtMs: null })).toBe(true)
    expect(canDash({ ...readyDash, nowMs: 1_999 })).toBe(false)
    expect(canDash({ ...readyDash, stamina: 2 })).toBe(false)
    expect(canDash({ ...readyDash, isDashing: true })).toBe(false)
    expect(canDash({ ...readyDash, phase: 'paused' })).toBe(false)
  })

  it('tracks valid rune prefixes and only accepts the six-rune campaign order', () => {
    expect(evaluateRuneOrder([])).toEqual({
      status: 'in-progress',
      validPrefix: true,
      complete: false,
      nextExpected: 2,
      mismatchIndex: null,
    })
    expect(evaluateRuneOrder([2, 3])).toMatchObject({
      status: 'in-progress', nextExpected: 5, mismatchIndex: null,
    })
    expect(evaluateRuneOrder([2, 3, 5])).toMatchObject({
      status: 'in-progress', complete: false, nextExpected: 7,
    })
    expect(evaluateRuneOrder([2, 5])).toMatchObject({
      status: 'incorrect', validPrefix: false, mismatchIndex: 1,
    })
    expect(evaluateRuneOrder([2, 3, 5, 7, 11, 13])).toMatchObject({
      status: 'complete', complete: true, nextExpected: null,
    })
    expect(evaluateRuneOrder([2, 3, 5, 11])).toMatchObject({
      status: 'incorrect', validPrefix: false, mismatchIndex: 3,
    })
    expect(verifyRuneOrder([2, 3, 5, 7, 11, 13])).toBe(true)
    expect(verifyRuneOrder([2, 3])).toBe(false)
  })

  it('computes a deterministic non-negative score with victory and time bonuses', () => {
    const score = calculateScore({
      enemiesDefeated: 8,
      runesActivated: 3,
      damageTaken: 2,
      elapsedMs: 30_000,
      victory: true,
    })
    expect(score).toBe(
      8 * SCORE_RULES.enemy +
      3 * SCORE_RULES.rune +
      SCORE_RULES.victory +
      (SCORE_RULES.maxTimeBonus - 30 * SCORE_RULES.timePenaltyPerSecond) -
      2 * SCORE_RULES.damagePenalty,
    )
    expect(calculateScore({
      enemiesDefeated: 0,
      runesActivated: 0,
      damageTaken: 99,
      elapsedMs: 999_000,
      victory: false,
    })).toBe(0)
  })

  it('rejects impossible score inputs and caps huge valid scores safely', () => {
    expect(() => calculateScore({
      enemiesDefeated: 0,
      runesActivated: 7,
      damageTaken: 0,
      elapsedMs: 0,
      victory: true,
    })).toThrow(RangeError)
    expect(() => calculateScore({
      enemiesDefeated: 1.5,
      runesActivated: 0,
      damageTaken: 0,
      elapsedMs: 0,
      victory: false,
    })).toThrow(RangeError)
    expect(calculateScore({
      enemiesDefeated: Number.MAX_SAFE_INTEGER,
      runesActivated: 3,
      damageTaken: 0,
      elapsedMs: 0,
      victory: true,
    })).toBe(Number.MAX_SAFE_INTEGER)
  })
})
