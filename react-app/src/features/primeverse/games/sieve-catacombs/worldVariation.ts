import type { CatacombsLevelWorld } from './levelWorld'
import type { Position2D } from './gameLogic'

/**
 * Seeded variation of a hand-drawn floor.
 *
 * The corridors never change — they were tuned by hand and validated. What a seed
 * reshuffles is everything the player hunts for: where the seal waits, which rooms
 * hold the supply cells, which cabinets stand where, and which way the creatures
 * circulate. Every position is drawn from the floor's own validated pool, so a
 * varied world inherits the original's walkability and reachability guarantees
 * instead of needing its own validation pass.
 *
 * Two players with the same seed get the same floor: that is what makes a lobby
 * expedition the same expedition.
 */

/** Small, fast, deterministic PRNG (mulberry32). */
export function createSeededRandom(seed: number): () => number {
  let state = (Number.isFinite(seed) ? Math.trunc(seed) : 0) >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

function clonePosition(position: Position2D): Position2D {
  return { x: position.x, z: position.z }
}

export function varyWorldWithSeed(world: CatacombsLevelWorld, seed: number): CatacombsLevelWorld {
  const random = createSeededRandom(seed)

  // The seal trades places with one of the supply cells (all validated at the same
  // clearance), so "where is the seal this run" is a genuine question.
  const lightSlots = shuffled(
    [clonePosition(world.seal.position), ...world.supplies.map((supply) => clonePosition(supply.position))],
    random,
  )
  const seal = Object.freeze({ ...world.seal, position: lightSlots[0] })
  const supplies = Object.freeze(world.supplies.map((supply, index) => Object.freeze({
    ...supply,
    position: lightSlots[index + 1],
  })))

  // Cabinets swap among cabinet spots: contents (clues, tools, medkits) travel
  // with their cabinet, positions do not.
  const cabinetSlots = shuffled(
    world.cabinets.map((cabinet) => ({ position: clonePosition(cabinet.position), rotation: cabinet.rotation })),
    random,
  )
  const cabinets = Object.freeze(world.cabinets.map((cabinet, index) => Object.freeze({
    ...cabinet,
    position: cabinetSlots[index].position,
    rotation: cabinetSlots[index].rotation,
  })))

  // Creatures may walk their route backwards and start anywhere along it. A
  // reversed loop passes the same straight-line checks in the other direction.
  const enemies = Object.freeze(world.enemies.map((enemy) => {
    const reversedRoute = random() < 0.5
    const patrol = reversedRoute ? [...enemy.patrol].reverse() : [...enemy.patrol]
    const offset = Math.floor(random() * patrol.length)
    const rotated = Object.freeze([...patrol.slice(offset), ...patrol.slice(0, offset)])
    return Object.freeze({ ...enemy, patrol: rotated, spawn: clonePosition(rotated[0]) })
  }))

  return Object.freeze({ ...world, seal, supplies, cabinets, enemies })
}
