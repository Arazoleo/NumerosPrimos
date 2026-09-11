import { describe, expect, it } from 'vitest'

import {
  isInsideOnlineWorld,
  nearestInteraction,
  onlineLocationName,
  resolveOnlineCollision,
} from './world'

describe('Primeverse world topology', () => {
  it('keeps the multiplayer simulation inside the Nexus hub', () => {
    expect(isInsideOnlineWorld([0, 0, 0])).toBe(true)
    expect(isInsideOnlineWorld([40, 0, 0])).toBe(true)
    expect(isInsideOnlineWorld([72, 0, 0])).toBe(false)
    expect(isInsideOnlineWorld([-72, 0, 0])).toBe(false)
    expect(isInsideOnlineWorld([0, 0, -104])).toBe(false)
    expect(isInsideOnlineWorld([50, 0, 0])).toBe(false)
  })

  it('exposes only the three launch portals from the Nexus', () => {
    expect(nearestInteraction([-18, 0.04, -19.4])?.id).toBe('portal-ulam')
    expect(nearestInteraction([15.1, 0.04, -5])?.id).toBe('portal-forge')
    expect(nearestInteraction([0, 0.04, -30.5])?.id).toBe('portal-catacombs')
    expect(nearestInteraction([18, 0.04, -19.4])?.id).toBe('portal-nucleus')
    expect(nearestInteraction([72, 0.04, 15.2])).toBeNull()
    expect(nearestInteraction([-72, 0.04, 15.2])).toBeNull()
    expect(nearestInteraction([0, 0.04, -87])).toBeNull()
  })

  it('does not leak objectives from standalone games into the shared hub', () => {
    expect(nearestInteraction([-10, 0.8, -104])).toBeNull()
    expect(nearestInteraction([72, 0.8, 8.1])).toBeNull()
    expect(nearestInteraction([-72, 0.8, 5.6])).toBeNull()
    expect(nearestInteraction([-78, 0.55, -1.5])).toBeNull()
  })

  it('blocks movement through the physical Nexus landmarks', () => {
    expect(resolveOnlineCollision([0, 0, 5], [0, 0, 2])).toEqual([0, 0, 5])
    expect(resolveOnlineCollision([14, 0, -5], [18, 0, -5])).toEqual([14, 0, -5])
    expect(resolveOnlineCollision([-21, 0, -1], [-21, 0, -4])).toEqual([-21, 0, -1])
  })

  it('names Nexus sectors and treats expeditions as separate routes', () => {
    expect(onlineLocationName([0, 0, 13])).toBe('Praça de Spawn')
    expect(onlineLocationName([72, 0, 0])).toBe('Fora do Nexus')
    expect(onlineLocationName([-72, 0, 0])).toBe('Fora do Nexus')
    expect(onlineLocationName([0, 0, -104])).toBe('Fora do Nexus')
    expect(onlineLocationName([50, 0, 0])).toBe('Fora do Nexus')
  })
})
