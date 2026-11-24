import { describe, expect, it } from 'vitest'

import { TRAVERSAL_BUDGET } from './worldGenConstants'

/**
 * Physics-derived reference values, recomputed here from the READ-ONLY source
 * constants so the asserted ordering invariants fail loudly if either the
 * budget or the physics ever drift apart.
 */
const JUMP_IMPULSE_VY = 9.3 // SkylineRunnerExperience.tsx
const GRAVITY_AY = 25 // |ay|, SkylineRunnerExperience.tsx
const JUMP_RISE = (JUMP_IMPULSE_VY * JUMP_IMPULSE_VY) / (2 * GRAVITY_AY) // ~= 1.7298
const MANTLE_CLIMB_CEILING = 1.72 // resolveHorizontalCollision climb <= 1.72

describe('TRAVERSAL_BUDGET', () => {
  it('exposes only finite numeric fields', () => {
    for (const value of Object.values(TRAVERSAL_BUDGET)) {
      expect(typeof value).toBe('number')
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('keeps every budget field positive', () => {
    expect(TRAVERSAL_BUDGET.MAX_FREE_HORIZONTAL_GAP).toBeGreaterThan(0)
    expect(TRAVERSAL_BUDGET.MAX_FREE_UP_STEP).toBeGreaterThan(0)
    expect(TRAVERSAL_BUDGET.MAX_FREE_DOWN_STEP).toBeGreaterThan(0)
    expect(TRAVERSAL_BUDGET.GRAPPLE_RANGE).toBeGreaterThan(0)
  })

  it('keeps the free up-step below the jump rise', () => {
    expect(JUMP_RISE).toBeCloseTo(1.7298, 4)
    expect(TRAVERSAL_BUDGET.MAX_FREE_UP_STEP).toBeLessThan(JUMP_RISE)
  })

  it('keeps the free up-step at or below the mantle climb ceiling', () => {
    expect(TRAVERSAL_BUDGET.MAX_FREE_UP_STEP).toBeLessThanOrEqual(MANTLE_CLIMB_CEILING)
  })

  it('keeps the free horizontal gap below grapple range', () => {
    expect(TRAVERSAL_BUDGET.MAX_FREE_HORIZONTAL_GAP).toBeLessThan(TRAVERSAL_BUDGET.GRAPPLE_RANGE)
  })

  it('mirrors the grapple physics constants exactly', () => {
    expect(TRAVERSAL_BUDGET.GRAPPLE_RANGE).toBe(52)
    expect(TRAVERSAL_BUDGET.GRAPPLE_MIN_ALIGNMENT).toBe(0.54)
    expect(TRAVERSAL_BUDGET.GRAPPLE_MIN_ALIGNMENT).toBeGreaterThanOrEqual(-1)
    expect(TRAVERSAL_BUDGET.GRAPPLE_MIN_ALIGNMENT).toBeLessThanOrEqual(1)
  })

  it('is frozen so the generator cannot mutate shared limits', () => {
    expect(Object.isFrozen(TRAVERSAL_BUDGET)).toBe(true)
    expect(() => {
      // @ts-expect-error runtime mutation must throw in strict mode / be a no-op
      TRAVERSAL_BUDGET.MAX_FREE_UP_STEP = 99
    }).toThrow()
    expect(TRAVERSAL_BUDGET.MAX_FREE_UP_STEP).toBe(1.5)
  })
})
