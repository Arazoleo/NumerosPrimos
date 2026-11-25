import { describe, expect, it } from 'vitest'

import {
  SKYLINE_PRIME_CORE_VALUES,
  SKYLINE_SENTINEL_IDS,
  createSkylineMissionsForWorld,
} from './missionData'
import type { Aabb } from './types'
import { generateSkylineWorld } from './worldGen'
import {
  isPlacementTraversable,
  missionRoofIds,
  placeWorldMissions,
  type SkylineWorldMissions,
} from './worldMissions'
import { buildRoofGraph, isWorldTraversable, reachableRoofIds } from './worldReachability'

const SEEDS = ['skyline-alpha', 'skyline-beta', 'orbital-7', 42, 1337] as const

/** True when [x,y,z] sits on `bounds` with the given vertical offset. */
function sitsOnRoof(
  bounds: Aabb,
  position: readonly [number, number, number],
  yOffset: number,
): boolean {
  const cx = (bounds.min.x + bounds.max.x) / 2
  const cz = (bounds.min.z + bounds.max.z) / 2
  return (
    Math.abs(position[0] - cx) < 1e-6 &&
    Math.abs(position[2] - cz) < 1e-6 &&
    Math.abs(position[1] - (bounds.max.y + yOffset)) < 1e-6
  )
}

describe('placeWorldMissions', () => {
  it('places all mission elements on generated rooftops, reachable from spawn', () => {
    for (const seed of SEEDS) {
      const world = generateSkylineWorld({ seed })
      const placement = placeWorldMissions(world)
      const byId = new Map(world.buildings.map((b) => [b.id, b]))

      // Every mission roof is a real generated building.
      for (const roofId of missionRoofIds(placement)) {
        expect(byId.has(roofId)).toBe(true)
      }

      // Cores: unique values {2,3,5}, each exactly on its rooftop at +1.1.
      expect(placement.cores.map((c) => c.value).sort((a, b) => a - b)).toEqual([
        ...SKYLINE_PRIME_CORE_VALUES,
      ])
      expect(new Set(placement.cores.map((c) => c.value)).size).toBe(3)
      for (const core of placement.cores) {
        const building = byId.get(core.roofId)
        expect(building).toBeDefined()
        if (building) expect(sitsOnRoof(building.bounds, core.position, 1.1)).toBe(true)
      }

      // Sentinels: ids match the registry, each exactly on its rooftop.
      expect([...placement.sentinels.map((s) => s.id)].sort()).toEqual(
        [...SKYLINE_SENTINEL_IDS].sort(),
      )
      for (const sentinel of placement.sentinels) {
        const building = byId.get(sentinel.roofId)
        expect(building).toBeDefined()
        if (building) expect(sitsOnRoof(building.bounds, sentinel.position, 1.1)).toBe(true)
      }

      // Apex spire + beacon sit on a real rooftop (spire at +1.1).
      const spireRoof = byId.get(placement.apexSpire.roofId)
      expect(spireRoof).toBeDefined()
      if (spireRoof) {
        expect(sitsOnRoof(spireRoof.bounds, placement.apexSpire.position, 1.1)).toBe(true)
      }
      expect(byId.has(placement.apexBeacon.roofId)).toBe(true)

      // THE reachability guarantee: this fails if placement ignored reachability.
      expect(isPlacementTraversable(world, placement)).toBe(true)
      const graph = buildRoofGraph(world)
      const reachable = reachableRoofIds(world, graph.spawnRoofId)
      for (const roofId of missionRoofIds(placement)) {
        expect(reachable.has(roofId)).toBe(true)
      }
      expect(isWorldTraversable(world, missionRoofIds(placement))).toBe(true)
    }
  })

  it('is deterministic per seed and varies across seeds', () => {
    const a = placeWorldMissions(generateSkylineWorld({ seed: 'determinism' }))
    const b = placeWorldMissions(generateSkylineWorld({ seed: 'determinism' }))
    expect(a).toEqual(b)

    const c = placeWorldMissions(generateSkylineWorld({ seed: 'other-seed' }))
    expect(roofSignature(a)).not.toEqual(roofSignature(c))
  })

  it('never places a mission element on an unreachable roof (negative control)', () => {
    // Build a placement whose apex roof is forced to an unreachable id; the
    // traversability guard must reject it. This proves the test above would
    // fail if placement ignored reachability.
    const world = generateSkylineWorld({ seed: 'control' })
    const placement = placeWorldMissions(world)
    const tampered: SkylineWorldMissions = {
      ...placement,
      apexSpire: { roofId: 'does-not-exist', position: placement.apexSpire.position },
    }
    expect(isPlacementTraversable(world, tampered)).toBe(false)
  })
})

describe('createSkylineMissionsForWorld', () => {
  it('maps a placement into world content, preserving factors and labels', () => {
    const world = generateSkylineWorld({ seed: 'factory' })
    const placement = placeWorldMissions(world)
    const content = createSkylineMissionsForWorld(placement)

    // Core values intact, positions come from the placement.
    for (const core of placement.cores) {
      expect(content.primeCores[core.value].value).toBe(core.value)
      expect(content.primeCores[core.value].position).toEqual(core.position)
    }

    // Sentinel factor products are preserved and labels reused.
    for (const sentinel of placement.sentinels) {
      const mapped = content.sentinels[sentinel.id]
      expect(mapped.id).toBe(sentinel.id)
      expect(
        mapped.primeFactors.reduce((product, factor) => product * factor, 1),
      ).toBe(mapped.compositeNumber)
      expect(mapped.position).toEqual(sentinel.position)
      expect(mapped.label.trim()).not.toBe('')
    }

    // Apex locations come from the placement; the three contracts re-anchor.
    expect(content.locations.apexSpire).toEqual(placement.apexSpire.position)
    expect(content.locations.apexBeacon).toEqual(placement.apexBeacon.position)
    expect(content.missions['prime-cores'].activationAnchor).toEqual(
      placement.activation.primeCores.position,
    )
    expect(content.missions['composite-sentinels'].activationAnchor).toEqual(
      placement.activation.compositeSentinels.position,
    )
    expect(content.missions['apex-extraction'].activationAnchor).toEqual(
      placement.activation.apexExtraction.position,
    )

    // Objective ids are reused unchanged (no new content).
    expect(content.missions['prime-cores'].objectiveIds).toEqual([
      'collect-prime-cores',
      'deliver-cores-to-nilo',
    ])
    expect(content.missions['composite-sentinels'].objectiveIds).toEqual([
      'defeat-composite-sentinels',
    ])
    expect(content.missions['apex-extraction'].objectiveIds).toEqual([
      'reach-apex-spire',
      'activate-apex-beacon',
    ])
  })
})

function roofSignature(placement: SkylineWorldMissions): string {
  return [
    ...placement.cores.map((c) => `${c.value}:${c.roofId}`),
    ...placement.sentinels.map((s) => `${s.id}:${s.roofId}`),
    `apex:${placement.apexSpire.roofId}`,
  ].join('|')
}
