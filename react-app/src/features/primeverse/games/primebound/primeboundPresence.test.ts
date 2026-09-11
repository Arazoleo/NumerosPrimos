import { describe, expect, it } from 'vitest'

import { ACTIVITY_BOUNDS } from '../primeverse-online/shared/activities'
import {
  PRIMEBOUND_AREA_ORDER,
  PRESENCE_SLOT,
  decodePrimeboundPresence,
  encodePrimeboundPresence,
} from './primeboundPresence'

describe('Primebound presence encoding', () => {
  it('round-trips a position through the wire format', () => {
    for (const areaId of PRIMEBOUND_AREA_ORDER) {
      const [px, py, pz] = encodePrimeboundPresence(areaId, 300, 180)
      expect(py).toBe(0)
      const decoded = decodePrimeboundPresence({ x: px, z: pz })
      expect(decoded.areaId).toBe(areaId)
      expect(decoded.x).toBeCloseTo(300, 0)
      expect(decoded.y).toBeCloseTo(180, 0)
    }
  })

  it('separates areas into disjoint slots so peers never bleed across regions', () => {
    const first = encodePrimeboundPresence(PRIMEBOUND_AREA_ORDER[0], 10_000, 0)
    const second = encodePrimeboundPresence(PRIMEBOUND_AREA_ORDER[1], 0, 0)
    expect(first[0]).toBeLessThan(second[0])
    expect(second[0] - first[0]).toBeGreaterThanOrEqual(PRESENCE_SLOT - 20)
  })

  it("always lands inside the activity's network bounds", () => {
    const bounds = ACTIVITY_BOUNDS.primebound
    for (const areaId of PRIMEBOUND_AREA_ORDER) {
      for (const [x, y] of [[0, 0], [99_999, 99_999], [-50, -50]] as const) {
        const [px, , pz] = encodePrimeboundPresence(areaId, x, y)
        expect(px).toBeGreaterThanOrEqual(bounds.min.x)
        expect(px).toBeLessThanOrEqual(bounds.max.x)
        expect(pz).toBeGreaterThanOrEqual(bounds.min.z)
        expect(pz).toBeLessThanOrEqual(bounds.max.z)
      }
    }
  })
})
