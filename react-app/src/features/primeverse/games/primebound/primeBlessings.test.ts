import { describe, expect, it } from 'vitest'

import { PRIMEBOUND_AREAS } from './world'
import {
  PRIME_BLESSINGS,
  PRIME_BLESSING_IDS,
  blessingEffects,
  enemyScaleForRunes,
  findShrineTile,
  offerBlessings,
} from './primeBlessings'

describe('prime blessings', () => {
  it('aggregates stacked effects and honours stack caps', () => {
    const none = blessingEffects([])
    expect(none.damageMultiplier).toBe(1)
    expect(none.damageTakenReduction).toBe(0)

    const built = blessingEffects([
      'gume-do-tres', 'gume-do-tres', 'vigor-do-dois', 'celeridade-do-cinco', 'pele-do-treze',
    ])
    expect(built.damageMultiplier).toBeCloseTo(1.24)
    expect(built.bonusMaxHealth).toBe(2)
    expect(built.speedMultiplier).toBeCloseTo(1.08)
    expect(built.damageTakenReduction).toBe(1)
  })

  it('offers three distinct choices, deterministic per seed, never a maxed one', () => {
    const first = offerBlessings(42, [])
    expect(first).toHaveLength(3)
    expect(new Set(first).size).toBe(3)
    expect(offerBlessings(42, [])).toEqual(first)
    expect(offerBlessings(43, [])).not.toEqual(first)

    const maxedEdge = Array<'gume-do-tres'>(PRIME_BLESSINGS['gume-do-tres'].maxStacks).fill('gume-do-tres')
    for (let seed = 0; seed < 24; seed += 1) {
      expect(offerBlessings(seed, maxedEdge)).not.toContain('gume-do-tres')
    }
  })

  it('runs dry gracefully when almost everything is maxed', () => {
    const everything = PRIME_BLESSING_IDS.flatMap((id) => (
      Array(PRIME_BLESSINGS[id].maxStacks).fill(id)
    )) as never[]
    expect(offerBlessings(7, everything)).toHaveLength(0)
  })

  it('hardens enemies per rune with a ceiling', () => {
    expect(enemyScaleForRunes(0)).toEqual({ hpMultiplier: 1, speedMultiplier: 1 })
    expect(enemyScaleForRunes(3).hpMultiplier).toBeCloseTo(1.42)
    expect(enemyScaleForRunes(99).hpMultiplier).toBe(1.9)
    expect(enemyScaleForRunes(99).speedMultiplier).toBe(1.28)
  })

  it('finds a real floor tile for the shrine in every region', () => {
    for (const area of Object.values(PRIMEBOUND_AREAS)) {
      const tile = findShrineTile(area.tileMap)
      expect(tile, area.id).not.toBeNull()
      expect(area.tileMap[tile!.y][tile!.x]).toBe('.')
    }
  })
})
