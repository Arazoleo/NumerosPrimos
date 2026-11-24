import { describe, expect, it } from 'vitest'

import type { Aabb } from './types'
import type { SkylineBuilding } from './world'
import { generateSkylineWorld, type SkylineWorldData } from './worldGen'
import { TRAVERSAL_BUDGET } from './worldGenConstants'
import {
  buildRoofGraph,
  isFreeTraversable,
  isWorldTraversable,
  reachableRoofIds,
} from './worldReachability'

const SEEDS = ['skyline-alpha', 'skyline-beta', 'orbital-7', 42, 1337] as const

function roof(id: string, minX: number, minZ: number, maxX: number, maxZ: number, roofY: number): SkylineBuilding {
  const bounds: Aabb = { min: { x: minX, y: -30, z: minZ }, max: { x: maxX, y: roofY, z: maxZ } }
  return {
    id,
    name: id,
    sector: 'TEST',
    bounds,
    wallRunnable: true,
    detail: 'simple',
    color: '#000000',
    roofColor: '#111111',
    accent: '#222222',
  }
}

function worldFrom(buildings: readonly SkylineBuilding[], spawn = buildings[0]): SkylineWorldData {
  const center = {
    x: (spawn.bounds.min.x + spawn.bounds.max.x) / 2,
    y: spawn.bounds.max.y + 1.1,
    z: (spawn.bounds.min.z + spawn.bounds.max.z) / 2,
  }
  return {
    seed: 'hand-built',
    buildings,
    colliders: buildings,
    anchors: [],
    checkpoints: [],
    spawn: center,
    extents: { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 },
    killPlaneY: -60,
  }
}

describe('worldReachability', () => {
  it('reaches every target roof from the spawn roof for every tested seed', () => {
    for (const seed of SEEDS) {
      const world = generateSkylineWorld({ seed })
      const targets = world.buildings.map((b) => b.id)
      expect(isWorldTraversable(world, targets)).toBe(true)
    }
  })

  it('stays fully traversable across a large seed sweep (>=25 distinct seeds)', () => {
    // Round 4 DOUBLED roof-height deltas (ROOF_STEP_DELTA 6->12) and the roof
    // ceiling (ROOF_MAX_Y 13.5->24), so nearly every upward step now exceeds the
    // free-jump budget and relies on grapple anchors. That makes anchor
    // placement the load-bearing guarantee of connectivity. This sweep is the
    // hard proof the taller world stays fully connected: it is widened to ~100
    // distinct seeds (more numeric + more string). Every generated world must
    // prove spawn->all-roofs connectivity, so any regression in the hardened
    // anchor ladder or connect pass fails loudly here.
    const sweepSeeds: Array<string | number> = []
    for (let i = 0; i < 50; i += 1) sweepSeeds.push(i * 101 + 7)
    for (let i = 0; i < 50; i += 1) sweepSeeds.push(`sweep-seed-${i}`)
    expect(sweepSeeds.length).toBeGreaterThanOrEqual(25)
    for (const seed of sweepSeeds) {
      const world = generateSkylineWorld({ seed })
      const targets = world.buildings.map((b) => b.id)
      expect(isWorldTraversable(world, targets)).toBe(true)
    }
  })

  it('reachableRoofIds covers the whole generated city from spawn', () => {
    const world = generateSkylineWorld({ seed: 'coverage' })
    const graph = buildRoofGraph(world)
    const reachable = reachableRoofIds(world, graph.spawnRoofId)
    expect(reachable.size).toBe(world.buildings.length)
  })

  it('reports a world with an isolated far roof and no anchor as NOT traversable', () => {
    // Two adjacent roofs the player can jump between, plus one roof placed far
    // away (well beyond jump and grapple range) with no anchor bridging it.
    const near = roof('near', -2, -2, 2, 2, 2)
    const neighbour = roof('neighbour', 4, -2, 8, 2, 2) // gap ~2u, free
    const isolated = roof('isolated', 400, 400, 404, 404, 2) // unreachable
    const world = worldFrom([near, neighbour, isolated], near)
    expect(isWorldTraversable(world, ['neighbour'])).toBe(true)
    expect(isWorldTraversable(world, ['isolated'])).toBe(false)
    expect(isWorldTraversable(world, ['near', 'neighbour', 'isolated'])).toBe(false)
  })

  it('bridges an over-budget gap when (and only when) an anchor is in range + line-of-sight', () => {
    const start = roof('start', -2, -2, 2, 2, 2)
    // 20u horizontal gap: far beyond MAX_FREE_HORIZONTAL_GAP, needs a grapple.
    const far = roof('far', 22, -2, 26, 2, 2)
    const base = worldFrom([start, far], start)
    expect(isWorldTraversable(base, ['far'])).toBe(false)

    const withAnchor: SkylineWorldData = {
      ...base,
      anchors: [{ id: 'bridge', position: { x: 12, y: 6, z: 0 } }],
    }
    expect(isWorldTraversable(withAnchor, ['far'])).toBe(true)
  })

  it('never emits a FREE edge that violates the traversal budget', () => {
    for (const seed of SEEDS) {
      const world = generateSkylineWorld({ seed })
      const byId = new Map(world.buildings.map((b) => [b.id, b.bounds]))
      const graph = buildRoofGraph(world)
      for (const [from, edges] of graph.edges) {
        for (const edge of edges) {
          if (edge.kind !== 'free') continue
          const a = byId.get(from)
          const b = byId.get(edge.to)
          expect(a && b).toBeTruthy()
          if (a && b) expect(isFreeTraversable(a, b)).toBe(true)
        }
      }
    }
  })

  it('isFreeTraversable rejects gaps and rises beyond the budget', () => {
    const base = roof('a', 0, 0, 4, 4, 2).bounds
    const tooFar = roof('b', 4 + TRAVERSAL_BUDGET.MAX_FREE_HORIZONTAL_GAP + 1, 0, 20, 4, 2).bounds
    expect(isFreeTraversable(base, tooFar)).toBe(false)
    const tooHigh = roof('c', 5, 0, 9, 4, 2 + TRAVERSAL_BUDGET.MAX_FREE_UP_STEP + 1).bounds
    expect(isFreeTraversable(base, tooHigh)).toBe(false)
  })
})
