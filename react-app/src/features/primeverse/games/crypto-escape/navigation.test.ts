import { describe, expect, it } from 'vitest'

import {
  distanceSquared2D,
  ESCAPE_PLAYER_START,
  isWithinInteractionCone,
  resolveEscapeMovement,
  resolveEscapePosition,
} from './navigation'

describe('resolveEscapePosition', () => {
  it('rejects positions outside the generated maze', () => {
    expect(resolveEscapePosition({ x: 99, z: 99 }, 'escaped')).toEqual(ESCAPE_PLAYER_START)
    expect(resolveEscapePosition({ x: -99, z: -99 }, 'escaped')).toEqual(ESCAPE_PLAYER_START)
  })

  it('lets the player revisit open sectors regardless of puzzle phase', () => {
    const openPosition = { x: 0, z: -7.6 }
    expect(resolveEscapePosition(openPosition, 'searching')).toEqual(openPosition)
    expect(resolveEscapePosition(openPosition, 'prime-box')).toEqual(openPosition)
    expect(resolveEscapePosition(openPosition, 'rsa-vault')).toEqual(openPosition)
  })

  it('recovers from non-finite coordinates', () => {
    expect(resolveEscapePosition({ x: Number.NaN, z: Number.POSITIVE_INFINITY }, 'searching'))
      .toEqual(ESCAPE_PLAYER_START)
  })
})

describe('distanceSquared2D', () => {
  it('measures proximity without a square root', () => {
    expect(distanceSquared2D({ x: 1, z: 1 }, { x: 4, z: 5 })).toBe(25)
  })
})

describe('isWithinInteractionCone', () => {
  it('accepts a nearby target in front of the reticle', () => {
    expect(isWithinInteractionCone(
      { x: 0, z: 3 },
      { x: 0.5, z: 1 },
      0,
      2.55,
      0.24,
    )).toBe(true)
  })

  it('rejects a nearby target behind the player', () => {
    expect(isWithinInteractionCone(
      { x: 0, z: 3 },
      { x: 0, z: 4 },
      0,
      2.55,
      0.24,
    )).toBe(false)
  })
})

describe('resolveEscapeMovement', () => {
  it('stops at the Caesar mechanism instead of crossing through it', () => {
    expect(resolveEscapeMovement(
      { x: 30.4, z: -26.6 },
      { x: 30.4, z: -30 },
      'caesar-lock',
    )).toEqual({ x: 30.4, z: -26.6 })
  })

  it('keeps a side route around the modular console', () => {
    expect(resolveEscapeMovement(
      { x: 4, z: 0 },
      { x: 4, z: -4 },
      'spectral-clue',
    )).toEqual({ x: 4, z: -4 })
  })

  it('slides along a box edge when only one axis is obstructed', () => {
    expect(resolveEscapeMovement(
      { x: -33, z: -24.8 },
      { x: -31.5, z: -25.8 },
      'prime-box',
    )).toEqual({ x: -31.5, z: -24.8 })
  })

  it('opens a physical route through the RSA bulkhead only after solving it', () => {
    const current = { x: 34.2, z: 29 }
    const requested = { x: 34.2, z: 32 }

    expect(resolveEscapeMovement(current, requested, 'rsa-vault')).toEqual(current)
    expect(resolveEscapeMovement(current, requested, 'rsa-vault', true)).toEqual(requested)
  })
})
