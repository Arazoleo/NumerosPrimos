import { describe, expect, it } from 'vitest'

import {
  decodePrimeboundCoopDamage,
  decodePrimeboundCoopState,
  electCoopHost,
  encodePrimeboundCoopDamage,
  encodePrimeboundCoopState,
  reinforcementCount,
  reinforcementOffsets,
} from './primeboundCoop'

describe('Primebound co-op wire format', () => {
  it('round-trips the shared enemy state', () => {
    const decoded = decodePrimeboundCoopState(encodePrimeboundCoopState({
      areaId: 'echo-woods',
      enemies: [
        { id: 'four-crawler', x: 120.6, y: 88.2, hp: 34, awake: true },
        { id: 'nine-charger', x: 300, y: 40, hp: 0, awake: false },
      ],
    }))
    expect(decoded?.areaId).toBe('echo-woods')
    expect(decoded?.enemies[0]).toEqual({ id: 'four-crawler', x: 121, y: 88, hp: 34, awake: true })
    expect(decoded?.enemies[1].awake).toBe(false)
  })

  it('accepts real damage and rejects nonsense', () => {
    expect(decodePrimeboundCoopDamage(encodePrimeboundCoopDamage({ kind: 'damage', enemyId: 'four-crawler', amount: 12.6 })))
      .toEqual({ kind: 'damage', enemyId: 'four-crawler', amount: 13 })
    expect(decodePrimeboundCoopDamage({ v: 1, kind: 'damage', enemyId: 'x', amount: -5 })).toBeNull()
    expect(decodePrimeboundCoopDamage({ v: 1, kind: 'damage', enemyId: 'x', amount: 99_999 })).toBeNull()
    expect(decodePrimeboundCoopDamage({ v: 1, kind: 'heal', enemyId: 'x', amount: 5 })).toBeNull()
  })

  it('scales reinforcements with the party and never past a cap', () => {
    expect(reinforcementCount(1)).toBe(0)
    expect(reinforcementCount(2)).toBe(1)
    expect(reinforcementCount(4)).toBe(3)
    expect(reinforcementCount(9)).toBe(3)
    const offsets = reinforcementOffsets(3)
    expect(offsets).toHaveLength(3)
    expect(new Set(offsets.map((offset) => `${offset.x.toFixed(1)}:${offset.y.toFixed(1)}`)).size).toBe(3)
  })

  it('shares the election with the rest of the primeverse', () => {
    expect(electCoopHost(['b', 'a'])).toBe('a')
  })
})
