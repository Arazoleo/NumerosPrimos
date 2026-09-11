import { describe, expect, it } from 'vitest'

import {
  analyzeDefensePlan,
  calculateDefenseXp,
  createWaveEnemies,
  DEFENSE_WAVES,
  evaluateDefenseEnemy,
  getCoveringDivisors,
  getPlacementEnergy,
  towerId,
} from './defenseLogic'
import type { TowerPlacement } from './types'

function placement(
  lane: 0 | 1 | 2,
  slot: 0 | 1 | 2,
  divisor: 2 | 3 | 5 | 7,
): TowerPlacement {
  return { id: towerId(lane, slot), lane, slot, divisor }
}

describe('Prime Defense logic', () => {
  it('interleaves the three lanes without changing their internal order', () => {
    const enemies = createWaveEnemies(DEFENSE_WAVES[0], 0)
    expect(enemies.map((enemy) => [enemy.lane, enemy.value])).toEqual([
      [0, 11], [1, 15], [2, 10],
      [0, 6], [1, 17], [2, 19],
      [0, 13],
    ])
    expect(enemies.map((enemy) => enemy.travelOrder)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('lets primes pass even when their own value equals a tower divisor', () => {
    const enemy = {
      id: 'prime-2', value: 2, lane: 0 as const, laneOrder: 0, travelOrder: 0,
    }
    const outcome = evaluateDefenseEnemy(enemy, [placement(0, 0, 2)])
    expect(outcome).toMatchObject({
      kind: 'prime-passed',
      divisor: null,
      chargeDelta: 1,
      lifeDelta: 0,
    })
  })

  it('uses the first matching tower in travel order and explains the factorization', () => {
    const enemy = {
      id: 'composite-30', value: 30, lane: 1 as const, laneOrder: 0, travelOrder: 0,
    }
    const outcome = evaluateDefenseEnemy(enemy, [
      placement(1, 2, 5),
      placement(1, 0, 3),
      placement(0, 0, 2),
    ])
    expect(outcome).toMatchObject({
      kind: 'intercepted',
      divisor: 3,
      towerId: towerId(1, 0),
      factors: [2, 3, 5],
    })
    expect(outcome.explanation).toContain('30 = 2 × 3 × 5')
  })

  it('marks an uncovered composite as a breach with a useful divisor hint', () => {
    const enemy = {
      id: 'composite-35', value: 35, lane: 2 as const, laneOrder: 0, travelOrder: 0,
    }
    const outcome = evaluateDefenseEnemy(enemy, [placement(1, 0, 5)])
    expect(outcome).toMatchObject({ kind: 'breach', lifeDelta: -1, points: 0 })
    expect(outcome.explanation).toContain('5 ou 7')
    expect(getCoveringDivisors(35)).toEqual([5, 7])
  })

  it('analyzes a perfect first-wave plan within its energy budget', () => {
    const placements = [placement(0, 0, 2), placement(1, 0, 3), placement(2, 0, 2)]
    const analysis = analyzeDefensePlan(DEFENSE_WAVES[0], 0, placements)
    expect(getPlacementEnergy(placements)).toBe(6)
    expect(analysis).toMatchObject({ intercepted: 3, primes: 4, breaches: 0 })
  })

  it('keeps XP finite and rewards campaign completion', () => {
    expect(calculateDefenseXp(0, false)).toBe(20)
    expect(calculateDefenseXp(4_000, true)).toBeGreaterThan(calculateDefenseXp(4_000, false))
    expect(calculateDefenseXp(99_999, true)).toBe(450)
  })
})

