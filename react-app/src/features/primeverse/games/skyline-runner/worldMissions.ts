/**
 * Seeded, reachable mission PLACEMENT for the procedural Skyline world (Round 2).
 *
 * The three playable world contracts (`prime-cores`, `composite-sentinels`,
 * `apex-extraction`) are the SAME contracts missionData.ts already defines; this
 * module only decides WHERE their content sits in a {@link SkylineWorldData}:
 *
 *  - prime cores 2/3/5  -> one per generated rooftop, y = roof.max.y + 1.1
 *    (matching what world.test.ts expects for cores).
 *  - the 4 composite sentinels -> one per generated rooftop.
 *  - apex spire + beacon -> a high reachable rooftop.
 *  - an activation anchor per contract -> on a rooftop (reused from the content
 *    it unlocks, like the static registry does).
 *
 * This is a PURE module: no React / @react-three / three imports. All randomness
 * comes from a single {@link createRng} instance keyed off the world seed, so the
 * placement is deterministic per seed.
 *
 * Reachability guarantee: every placement roof is drawn ONLY from the set of
 * roofs reachable from the spawn roof (per worldReachability), and the result is
 * re-validated with {@link isWorldTraversable}. If a draw somehow fails the
 * check (it cannot, given the draw set, but the guard keeps the invariant
 * explicit and future-proof) the placement deterministically re-rolls by
 * advancing the same rng until traversable. The generator never returns a world
 * where a mission element is unreachable.
 */
import { createRng } from './seededRng'
import type { SkylinePosition3D } from './missionData'
import {
  SKYLINE_PRIME_CORE_VALUES,
  SKYLINE_SENTINEL_IDS,
  type SkylinePrimeCoreValue,
  type SkylineSentinelId,
} from './missionData'
import type { Aabb, Vec3 } from './types'
import type { SkylineBuilding } from './world'
import type { SkylineWorldData } from './worldGen'
import { isWorldTraversable, reachableRoofIds, buildRoofGraph } from './worldReachability'

/** Y offset placed collectibles/markers sit above the roof surface. */
const CORE_ROOF_OFFSET = 1.1

/** A single placement bound to the generated rooftop it sits on. */
export interface PlacedElement {
  readonly roofId: string
  readonly position: SkylinePosition3D
}

export interface PlacedCore extends PlacedElement {
  readonly value: SkylinePrimeCoreValue
}

export interface PlacedSentinel extends PlacedElement {
  readonly id: SkylineSentinelId
}

/**
 * The full set of seeded mission placements for a generated world. Every roofId
 * is reachable from `spawnRoofId` per worldReachability.
 */
export interface SkylineWorldMissions {
  readonly seed: string | number
  readonly spawnRoofId: string
  readonly cores: readonly PlacedCore[]
  readonly sentinels: readonly PlacedSentinel[]
  readonly apexSpire: PlacedElement
  readonly apexBeacon: PlacedElement
  /** Activation anchors for the three world contracts. */
  readonly activation: {
    readonly primeCores: PlacedElement
    readonly compositeSentinels: PlacedElement
    readonly apexExtraction: PlacedElement
  }
}

function roofCenter(bounds: Aabb): Vec3 {
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: bounds.max.y,
    z: (bounds.min.z + bounds.max.z) / 2,
  }
}

/** A marker that sits CORE_ROOF_OFFSET above the centre of a roof. */
function placeOnRoof(building: SkylineBuilding): PlacedElement {
  const center = roofCenter(building.bounds)
  return {
    roofId: building.id,
    position: [center.x, center.y + CORE_ROOF_OFFSET, center.z],
  }
}

/**
 * All roof ids reachable from the spawn roof. These are the only roofs any
 * mission element may be placed on, which is what guarantees traversability.
 */
function reachableRoofs(world: SkylineWorldData): {
  spawnRoofId: string
  candidates: SkylineBuilding[]
} {
  const graph = buildRoofGraph(world)
  const reachable = reachableRoofIds(world, graph.spawnRoofId)
  const byId = new Map(world.buildings.map((b) => [b.id, b]))
  const candidates: SkylineBuilding[] = []
  for (const id of reachable) {
    const building = byId.get(id)
    if (building) candidates.push(building)
  }
  // Stable order (building order) so a given reachable set + rng is deterministic.
  candidates.sort((a, b) => world.buildings.indexOf(a) - world.buildings.indexOf(b))
  return { spawnRoofId: graph.spawnRoofId, candidates }
}

/**
 * Draws `count` DISTINCT buildings from `pool` using `rng`. The spawn roof is
 * never selected (it is reserved for the teleport landing) unless the pool would
 * otherwise be exhausted. Deterministic for a given rng sequence + pool order.
 */
function drawDistinct(
  rng: ReturnType<typeof createRng>,
  pool: readonly SkylineBuilding[],
  count: number,
  excludeIds: ReadonlySet<string>,
): SkylineBuilding[] {
  const available = pool.filter((b) => !excludeIds.has(b.id))
  const source = available.length >= count ? available : pool.slice()
  // Fisher-Yates over a copy, then take the prefix. Uses rng for every swap so
  // the selection is deterministic and advances the shared sequence on re-roll.
  const items = source.slice()
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i + 1)
    const tmp = items[i]
    items[i] = items[j]
    items[j] = tmp
  }
  return items.slice(0, Math.min(count, items.length))
}

/** Picks the highest-roofed reachable building (ties broken by build order). */
function highestRoof(pool: readonly SkylineBuilding[]): SkylineBuilding {
  let best = pool[0]
  for (const b of pool) {
    if (b.bounds.max.y > best.bounds.max.y) best = b
  }
  return best
}

export interface PlaceWorldMissionsOptions {
  /**
   * Seed for placement randomness. Defaults to the world seed so a world and its
   * missions move together. Pass a distinct seed only for tests.
   */
  readonly seed?: string | number
}

/**
 * Computes seeded, reachable mission placements for a generated world.
 *
 * All placements come from the spawn-reachable roof set, so the returned object
 * always satisfies {@link isWorldTraversable} for every mission roof. A guard
 * re-rolls deterministically (advancing the same rng) in the impossible case
 * that a draw is not traversable, so the invariant can never be violated.
 */
export function placeWorldMissions(
  world: SkylineWorldData,
  options: PlaceWorldMissionsOptions = {},
): SkylineWorldMissions {
  const seed = options.seed ?? world.seed
  const rng = createRng(seed)
  const { spawnRoofId, candidates } = reachableRoofs(world)

  if (candidates.length === 0) {
    throw new Error('placeWorldMissions: no reachable roofs to place missions on')
  }

  const needed =
    SKYLINE_PRIME_CORE_VALUES.length + SKYLINE_SENTINEL_IDS.length + 1 // + apex

  const build = (): SkylineWorldMissions => {
    // Reserve the spawn roof for the landing; only fall back to it if the
    // reachable pool is too small to fill every distinct element.
    const reserve = new Set<string>([spawnRoofId])

    const used = new Set<string>()
    const picks = drawDistinct(rng, candidates, needed, reserve)
    // If the reachable pool is smaller than `needed`, drawDistinct may repeat
    // across calls; de-dupe while preserving order and top up from candidates.
    const distinct: SkylineBuilding[] = []
    for (const b of picks) {
      if (!used.has(b.id)) {
        used.add(b.id)
        distinct.push(b)
      }
    }
    let fillIdx = 0
    while (distinct.length < needed && fillIdx < candidates.length) {
      const b = candidates[fillIdx]
      fillIdx += 1
      if (!used.has(b.id)) {
        used.add(b.id)
        distinct.push(b)
      }
    }

    const coreBuildings = distinct.slice(0, SKYLINE_PRIME_CORE_VALUES.length)
    const sentinelBuildings = distinct.slice(
      SKYLINE_PRIME_CORE_VALUES.length,
      SKYLINE_PRIME_CORE_VALUES.length + SKYLINE_SENTINEL_IDS.length,
    )

    const cores: PlacedCore[] = SKYLINE_PRIME_CORE_VALUES.map((value, i) => {
      const placed = placeOnRoof(coreBuildings[i] ?? candidates[i % candidates.length])
      return { value, roofId: placed.roofId, position: placed.position }
    })

    const sentinels: PlacedSentinel[] = SKYLINE_SENTINEL_IDS.map((id, i) => {
      const placed = placeOnRoof(
        sentinelBuildings[i] ?? candidates[i % candidates.length],
      )
      return { id, roofId: placed.roofId, position: placed.position }
    })

    // Apex sits on the highest reachable roof so the extraction is the climax of
    // the climb. Spire and beacon share that roof; the beacon sits a touch above.
    const apexBuilding = highestRoof(candidates)
    const apexSpire = placeOnRoof(apexBuilding)
    const apexBeacon: PlacedElement = {
      roofId: apexBuilding.id,
      position: [apexSpire.position[0], apexSpire.position[1] + 1.0, apexSpire.position[2]],
    }

    // Contract activation anchors reuse the first element of the content they
    // unlock, mirroring the static SKYLINE_MISSIONS registry.
    const activation = {
      primeCores: { roofId: cores[0].roofId, position: cores[0].position },
      compositeSentinels: {
        roofId: sentinels[0].roofId,
        position: sentinels[0].position,
      },
      apexExtraction: { roofId: apexSpire.roofId, position: apexSpire.position },
    }

    return {
      seed,
      spawnRoofId,
      cores,
      sentinels,
      apexSpire,
      apexBeacon,
      activation,
    }
  }

  // Build, then prove reachable. Re-roll deterministically (the rng has already
  // advanced inside build()) until traversable. Because every roofId is drawn
  // from the spawn-reachable set this passes on the first attempt; the loop is a
  // hard guarantee, capped so it can never spin forever.
  let placement = build()
  let attempts = 0
  const maxAttempts = 64
  while (!isPlacementTraversable(world, placement) && attempts < maxAttempts) {
    placement = build()
    attempts += 1
  }
  if (!isPlacementTraversable(world, placement)) {
    throw new Error(
      `placeWorldMissions: could not place all missions on reachable roofs for seed ${String(seed)}`,
    )
  }
  return placement
}

/** Collects every roof id a placement occupies. */
export function missionRoofIds(placement: SkylineWorldMissions): string[] {
  return [
    placement.spawnRoofId,
    ...placement.cores.map((c) => c.roofId),
    ...placement.sentinels.map((s) => s.roofId),
    placement.apexSpire.roofId,
    placement.apexBeacon.roofId,
    placement.activation.primeCores.roofId,
    placement.activation.compositeSentinels.roofId,
    placement.activation.apexExtraction.roofId,
  ]
}

/** True when every mission roof is reachable from the spawn roof. */
export function isPlacementTraversable(
  world: SkylineWorldData,
  placement: SkylineWorldMissions,
): boolean {
  return isWorldTraversable(world, missionRoofIds(placement))
}
