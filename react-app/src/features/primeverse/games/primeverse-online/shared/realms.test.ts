import { describe, expect, it } from 'vitest'

import { isInsideRealm, PORTAL_ROUTES, realmForPosition } from './realms'

describe('Primeverse realms', () => {
  it('resolves each world independently', () => {
    expect(realmForPosition([0, 0, 0])?.id).toBe('nexus')
    expect(realmForPosition([72, 0, 0])?.id).toBe('ulam-run')
    expect(realmForPosition([-72, 0, 0])?.id).toBe('factor-forge')
    expect(realmForPosition([0, 0, -104])?.id).toBe('sieve-catacombs')
    expect(realmForPosition([110, 0, 110])).toBeNull()
  })

  it('keeps every portal destination inside its target world', () => {
    for (const route of Object.values(PORTAL_ROUTES)) {
      expect(realmForPosition(route.source)?.id).toBe(route.fromRealm)
      expect(realmForPosition(route.destination)?.id).toBe(route.toRealm)
    }
  })

  it('supports a safety margin at world edges', () => {
    expect(isInsideRealm([43.8, 0, 0])).toBe(true)
    expect(isInsideRealm([43.8, 0, 0], 0.5)).toBe(false)
    expect(isInsideRealm([72, 0, 18], 0.5)).toBe(true)
    expect(isInsideRealm([0, 0, -125.8])).toBe(true)
    expect(isInsideRealm([0, 0, -125.8], 0.5)).toBe(false)
  })
})
