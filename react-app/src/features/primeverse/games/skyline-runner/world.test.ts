import { describe, expect, it } from 'vitest'

import { SKYLINE_PRIME_CORES, SKYLINE_PRIME_CORE_VALUES } from './missionData'
import { selectGrappleAnchor } from './parkourLogic'
import {
  PLAYER_SPAWN,
  SKYLINE_ANCHORS,
  SKYLINE_BUILDINGS,
  SKYLINE_COLLIDERS,
  SKYLINE_WORLD_BOUNDS,
} from './world'

const ORIGINAL_MISSION_BUILDINGS = [
  { id: 'relay-base', bounds: { min: { x: -8, y: -29, z: 8 }, max: { x: 8, y: 0, z: 23 } } },
  { id: 'binary-terrace', bounds: { min: { x: 0, y: -28, z: -1 }, max: { x: 9, y: 1.6, z: 6.2 } } },
  { id: 'triad-fanway', bounds: { min: { x: -8.2, y: -27, z: -13.3 }, max: { x: 1.2, y: 3.8, z: -5 } } },
  { id: 'nilo-relay', bounds: { min: { x: -6.4, y: -26, z: -32 }, max: { x: 7, y: 6.1, z: -17 } } },
  { id: 'sentinel-four-roof', bounds: { min: { x: -8.2, y: -25, z: -41.5 }, max: { x: 1, y: 6.1, z: -33 } } },
  { id: 'sentinel-six-roof', bounds: { min: { x: 0, y: -24, z: -49.2 }, max: { x: 9, y: 7.6, z: -40.8 } } },
  { id: 'sentinel-nine-roof', bounds: { min: { x: -8.2, y: -23, z: -57.3 }, max: { x: 1, y: 9.2, z: -48.8 } } },
  { id: 'sentinel-ten-roof', bounds: { min: { x: 0, y: -22, z: -65.2 }, max: { x: 9, y: 10.7, z: -56.8 } } },
  { id: 'apex-spire', bounds: { min: { x: -6.2, y: -20, z: -79 }, max: { x: 6.2, y: 12.1, z: -66 } } },
] as const

describe('skyline world', () => {
  it('places every prime core over a playable rooftop', () => {
    for (const value of SKYLINE_PRIME_CORE_VALUES) {
      const [x, y, z] = SKYLINE_PRIME_CORES[value].position
      expect(SKYLINE_BUILDINGS.some((building) => (
        x >= building.bounds.min.x
        && x <= building.bounds.max.x
        && z >= building.bounds.min.z
        && z <= building.bounds.max.z
        && Math.abs(y - (building.bounds.max.y + 1.1)) < .01
      ))).toBe(true)
    }
  })

  it('keeps the first grapple anchor visible from the initial roof', () => {
    const anchor = SKYLINE_ANCHORS[0]
    const origin = { ...PLAYER_SPAWN, y: PLAYER_SPAWN.y + .58 }
    const offset = {
      x: anchor.position.x - origin.x,
      y: anchor.position.y - origin.y,
      z: anchor.position.z - origin.z,
    }
    const length = Math.hypot(offset.x, offset.y, offset.z)
    const selection = selectGrappleAnchor({
      origin,
      viewDirection: { x: offset.x / length, y: offset.y / length, z: offset.z / length },
      anchors: SKYLINE_ANCHORS,
      obstacles: SKYLINE_COLLIDERS.map((platform) => platform.bounds),
      maxRange: 27,
      minimumAlignment: .54,
      lineOfSightPadding: .03,
    })
    expect(selection?.anchor.id).toBe('anchor-binary')
  })

  it('keeps every major grapple transfer visible along the critical route', () => {
    const route = [
      { origin: { x: 4.8, y: 2.7, z: 2.5 }, anchorId: 'anchor-triad' },
      { origin: { x: -4.6, y: 4.9, z: -8.5 }, anchorId: 'anchor-relay' },
      { origin: { x: -2.4, y: 7.2, z: -28.5 }, anchorId: 'anchor-four' },
      { origin: { x: -4.6, y: 7.2, z: -37 }, anchorId: 'anchor-six' },
      { origin: { x: 4.2, y: 8.7, z: -45 }, anchorId: 'anchor-nine' },
      { origin: { x: -3.8, y: 10.3, z: -53 }, anchorId: 'anchor-ten' },
      { origin: { x: 4.4, y: 11.8, z: -61 }, anchorId: 'anchor-apex' },
    ] as const

    for (const step of route) {
      const anchor = SKYLINE_ANCHORS.find(({ id }) => id === step.anchorId)
      expect(anchor).toBeDefined()
      if (!anchor) continue
      const origin = { ...step.origin, y: step.origin.y + .58 }
      const offset = {
        x: anchor.position.x - origin.x,
        y: anchor.position.y - origin.y,
        z: anchor.position.z - origin.z,
      }
      const length = Math.hypot(offset.x, offset.y, offset.z)
      const selection = selectGrappleAnchor({
        origin,
        viewDirection: { x: offset.x / length, y: offset.y / length, z: offset.z / length },
        anchors: SKYLINE_ANCHORS,
        obstacles: SKYLINE_COLLIDERS.map((platform) => platform.bounds),
        maxRange: 27,
        minimumAlignment: .54,
        lineOfSightPadding: .03,
      })
      expect(selection?.anchor.id, `from route step to ${step.anchorId}`).toBe(step.anchorId)
    }
  })

  it('uses unique ids for colliders and anchors', () => {
    expect(new Set(SKYLINE_COLLIDERS.map(({ id }) => id)).size).toBe(SKYLINE_COLLIDERS.length)
    expect(new Set(SKYLINE_ANCHORS.map(({ id }) => id)).size).toBe(SKYLINE_ANCHORS.length)
  })

  it('preserves every original mission building with identical bounds', () => {
    for (const original of ORIGINAL_MISSION_BUILDINGS) {
      const building = SKYLINE_BUILDINGS.find(({ id }) => id === original.id)
      expect(building, original.id).toBeDefined()
      expect(building?.bounds).toEqual(original.bounds)
    }
  })

  it('expands the map into an open grid spanning every direction', () => {
    expect(SKYLINE_BUILDINGS.length).toBeGreaterThan(ORIGINAL_MISSION_BUILDINGS.length)

    const centers = SKYLINE_BUILDINGS.map((building) => ({
      x: (building.bounds.min.x + building.bounds.max.x) / 2,
      z: (building.bounds.min.z + building.bounds.max.z) / 2,
    }))

    // A grid, not a single -z corridor: both signs of x and both signs of z.
    expect(centers.some((center) => center.x > 11)).toBe(true)
    expect(centers.some((center) => center.x < -11)).toBe(true)
    expect(centers.some((center) => center.z > 24)).toBe(true)
    expect(centers.some((center) => center.z < -24)).toBe(true)
  })

  it('keeps every building Aabb well-formed and above the kill plane', () => {
    for (const building of SKYLINE_BUILDINGS) {
      expect(building.bounds.min.x, building.id).toBeLessThan(building.bounds.max.x)
      expect(building.bounds.min.y, building.id).toBeLessThan(building.bounds.max.y)
      expect(building.bounds.min.z, building.id).toBeLessThan(building.bounds.max.z)
      // The playable rooftop must sit above the kill plane.
      expect(building.bounds.max.y, building.id).toBeGreaterThan(SKYLINE_WORLD_BOUNDS.killPlaneY)
    }
  })

  it('contains every building inside the widened world extents', () => {
    const { extents } = SKYLINE_WORLD_BOUNDS
    for (const building of SKYLINE_BUILDINGS) {
      expect(building.bounds.min.x, building.id).toBeGreaterThanOrEqual(extents.minX)
      expect(building.bounds.max.x, building.id).toBeLessThanOrEqual(extents.maxX)
      expect(building.bounds.min.z, building.id).toBeGreaterThanOrEqual(extents.minZ)
      expect(building.bounds.max.z, building.id).toBeLessThanOrEqual(extents.maxZ)
    }
  })
})
