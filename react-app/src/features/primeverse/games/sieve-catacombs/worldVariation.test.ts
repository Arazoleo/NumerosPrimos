import { describe, expect, it } from 'vitest'

import { getCatacombsLevelWorld, isLevelWalkable } from './levelWorld'
import { createSeededRandom, varyWorldWithSeed } from './worldVariation'

describe('seeded floor variation', () => {
  it('is deterministic: the same seed builds the same expedition', () => {
    const world = getCatacombsLevelWorld('yellow-offices')
    const first = varyWorldWithSeed(world, 4_242)
    const second = varyWorldWithSeed(world, 4_242)
    expect(first.seal.position).toEqual(second.seal.position)
    expect(first.supplies.map((supply) => supply.position))
      .toEqual(second.supplies.map((supply) => supply.position))
    expect(first.cabinets.map((cabinet) => cabinet.position))
      .toEqual(second.cabinets.map((cabinet) => cabinet.position))
    expect(first.enemies.map((enemy) => enemy.patrol))
      .toEqual(second.enemies.map((enemy) => enemy.patrol))
  })

  it('actually changes something between different seeds', () => {
    const world = getCatacombsLevelWorld('modular-pools')
    const layouts = new Set(
      Array.from({ length: 12 }, (_, seed) => JSON.stringify(varyWorldWithSeed(world, seed).seal.position)),
    )
    expect(layouts.size).toBeGreaterThan(1)
  })

  it('only redistributes validated positions, so every landmark stays walkable', () => {
    for (const id of ['yellow-offices', 'modular-pools', 'crypt-49', 'cold-vault-13'] as const) {
      const world = getCatacombsLevelWorld(id)
      const pool = new Set([
        JSON.stringify(world.seal.position),
        ...world.supplies.map((supply) => JSON.stringify(supply.position)),
      ])
      for (const seed of [1, 99, 123_456]) {
        const varied = varyWorldWithSeed(world, seed)
        expect(pool.has(JSON.stringify(varied.seal.position))).toBe(true)
        for (const supply of varied.supplies) {
          expect(pool.has(JSON.stringify(supply.position))).toBe(true)
          expect(isLevelWalkable(world, supply.position, 0.2)).toBe(true)
        }
        // Contents stay glued to their cabinet id even when the furniture moves.
        expect(varied.cabinets.map((cabinet) => cabinet.drawers))
          .toEqual(world.cabinets.map((cabinet) => cabinet.drawers))
        for (const enemy of varied.enemies) {
          const original = world.enemies.find((candidate) => candidate.id === enemy.id)!
          expect([...enemy.patrol].sort((a, b) => a.x - b.x || a.z - b.z))
            .toEqual([...original.patrol].sort((a, b) => a.x - b.x || a.z - b.z))
          expect(enemy.spawn).toEqual(enemy.patrol[0])
        }
      }
    }
  })

  it('keeps the PRNG stable across runs', () => {
    const first = createSeededRandom(7)
    const second = createSeededRandom(7)
    const sequenceA = Array.from({ length: 5 }, () => first())
    const sequenceB = Array.from({ length: 5 }, () => second())
    expect(sequenceA).toEqual(sequenceB)
    for (const value of sequenceA) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})
