import { describe, expect, it } from 'vitest'

import { hasLineOfSight } from './parkourLogic'
import type { Aabb, Vec3 } from './types'
import { generateSkylineWorld } from './worldGen'
import { TRAVERSAL_BUDGET } from './worldGenConstants'

const SEEDS = ['skyline-alpha', 'skyline-beta', 'orbital-7', 42, 1337] as const

function roofCenter(bounds: Aabb): Vec3 {
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: bounds.max.y,
    z: (bounds.min.z + bounds.max.z) / 2,
  }
}

describe('generateSkylineWorld', () => {
  it('is deterministic: the same seed yields a deep-equal world', () => {
    const a = generateSkylineWorld({ seed: 'determinism' })
    const b = generateSkylineWorld({ seed: 'determinism' })
    expect(a).toEqual(b)
  })

  it('produces different layouts for different seeds', () => {
    const a = generateSkylineWorld({ seed: 'layout-a' })
    const b = generateSkylineWorld({ seed: 'layout-b' })
    expect(a.buildings.map((x) => x.bounds)).not.toEqual(b.buildings.map((x) => x.bounds))
  })

  it('generates many more buildings than the static grid (~29)', () => {
    const world = generateSkylineWorld({ seed: 'density' })
    expect(world.buildings.length).toBeGreaterThan(50)
  })

  it('spreads roof heights across the tutorial silhouette band for every seed', () => {
    // Round 4 DOUBLES the band: ROOF_STEP_DELTA 6->12 and ROOF_MAX_Y 13.5->24,
    // so the realised city should span roughly ~0.8..~24. The round-3 band
    // (13.5/6.0) realised a spread of ~10-13u; here we assert a much larger
    // spread AND std-dev that the doubled band comfortably satisfies but that
    // the OLD 13.5/6.0 band would fail, so this test genuinely guards the taller
    // silhouette. Robust across every tested seed.
    for (const seed of SEEDS) {
      const world = generateSkylineWorld({ seed })
      const roofYs = world.buildings.map((b) => b.bounds.max.y)
      const minY = Math.min(...roofYs)
      const maxY = Math.max(...roofYs)
      const spread = maxY - minY
      // At least ~18u of total height spread; impossible under the old ~13.5 cap.
      expect(spread).toBeGreaterThan(18)
      const mean = roofYs.reduce((sum, y) => sum + y, 0) / roofYs.length
      const variance =
        roofYs.reduce((sum, y) => sum + (y - mean) * (y - mean), 0) / roofYs.length
      const stdDev = Math.sqrt(variance)
      // A wide spread also implies a large std-dev; >4u is well above the old band.
      expect(stdDev).toBeGreaterThan(4)
    }
  })

  it('honours a requested building count (clamped to sane bounds)', () => {
    const small = generateSkylineWorld({ seed: 'count', buildingCount: 40 })
    expect(small.buildings.length).toBe(40)
    const clampedLow = generateSkylineWorld({ seed: 'count', buildingCount: 1 })
    expect(clampedLow.buildings.length).toBeGreaterThanOrEqual(36)
  })

  it('assigns unique building, anchor and checkpoint ids', () => {
    const world = generateSkylineWorld({ seed: 'unique-ids' })
    const buildingIds = world.buildings.map((b) => b.id)
    expect(new Set(buildingIds).size).toBe(buildingIds.length)
    const anchorIds = world.anchors.map((a) => a.id)
    expect(new Set(anchorIds).size).toBe(anchorIds.length)
    const cpIds = world.checkpoints.map((c) => c.id)
    expect(new Set(cpIds).size).toBe(cpIds.length)
  })

  it('emits well-formed building AABBs with roofs above the kill plane', () => {
    const world = generateSkylineWorld({ seed: 'well-formed' })
    for (const b of world.buildings) {
      expect(b.bounds.min.x).toBeLessThan(b.bounds.max.x)
      expect(b.bounds.min.y).toBeLessThan(b.bounds.max.y)
      expect(b.bounds.min.z).toBeLessThan(b.bounds.max.z)
      expect(b.bounds.max.y).toBeGreaterThan(world.killPlaneY)
    }
  })

  it('places every building inside the padded extents', () => {
    const world = generateSkylineWorld({ seed: 'extents' })
    for (const b of world.buildings) {
      expect(b.bounds.min.x).toBeGreaterThanOrEqual(world.extents.minX)
      expect(b.bounds.max.x).toBeLessThanOrEqual(world.extents.maxX)
      expect(b.bounds.min.z).toBeGreaterThanOrEqual(world.extents.minZ)
      expect(b.bounds.max.z).toBeLessThanOrEqual(world.extents.maxZ)
    }
  })

  it('carries the full SkylineBuilding shape on generated buildings', () => {
    const world = generateSkylineWorld({ seed: 'shape' })
    for (const b of world.buildings) {
      expect(typeof b.name).toBe('string')
      expect(typeof b.sector).toBe('string')
      expect(b.color).toMatch(/^#/)
      expect(b.roofColor).toMatch(/^#/)
      expect(b.accent).toMatch(/^#/)
      expect(b.detail === 'full' || b.detail === 'simple').toBe(true)
    }
  })

  it('spawns the player on a real roof', () => {
    const world = generateSkylineWorld({ seed: 'spawn' })
    const onRoof = world.buildings.some((b) => (
      world.spawn.x >= b.bounds.min.x
      && world.spawn.x <= b.bounds.max.x
      && world.spawn.z >= b.bounds.min.z
      && world.spawn.z <= b.bounds.max.z
      && Math.abs(world.spawn.y - (b.bounds.max.y + 1.1)) < 0.01
    ))
    expect(onRoof).toBe(true)
  })

  it('keeps colliders aligned with buildings', () => {
    const world = generateSkylineWorld({ seed: 'colliders' })
    expect(world.colliders.length).toBeGreaterThanOrEqual(world.buildings.length)
  })

  it('places every anchor within GRAPPLE_RANGE and with line-of-sight from a roof', () => {
    for (const seed of SEEDS) {
      const world = generateSkylineWorld({ seed })
      const obstacles = world.buildings.map((b) => b.bounds)
      for (const anchor of world.anchors) {
        const bridges = world.buildings.some((b, idx) => {
          const center = roofCenter(b.bounds)
          const d = Math.hypot(
            center.x - anchor.position.x,
            center.y - anchor.position.y,
            center.z - anchor.position.z,
          )
          if (d > TRAVERSAL_BUDGET.GRAPPLE_RANGE) return false
          const filtered = obstacles.filter((_, i) => i !== idx)
          return hasLineOfSight(center, anchor.position, filtered)
        })
        expect(bridges).toBe(true)
      }
    }
  })
})
