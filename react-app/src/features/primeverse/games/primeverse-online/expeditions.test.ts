import { describe, expect, it } from 'vitest'

import { EXPEDITION_BY_PORTAL, PRIMEVERSE_EXPEDITIONS } from './expeditions'

describe('Primeverse standalone expeditions', () => {
  it('maps every Nexus launch portal to a unique local game route', () => {
    expect(PRIMEVERSE_EXPEDITIONS).toHaveLength(5)
    expect(new Set(PRIMEVERSE_EXPEDITIONS.map((expedition) => expedition.path)).size).toBe(5)
    expect(EXPEDITION_BY_PORTAL['portal-ulam']?.path).toBe('/jogos/fenda-de-ulam')
    expect(EXPEDITION_BY_PORTAL['portal-forge']?.path).toBe('/jogos/cerco-de-euclides')
    expect(EXPEDITION_BY_PORTAL['portal-catacombs']?.path).toBe('/jogos/cripta-do-crivo')
    expect(EXPEDITION_BY_PORTAL['portal-nucleus']?.path).toBe('/jogos/nucleo-257')
    expect(EXPEDITION_BY_PORTAL['portal-primebound']?.path).toBe('/jogos/primebound')
  })

  it('does not turn return portals into recursive game launches', () => {
    expect(EXPEDITION_BY_PORTAL['portal-nexus-ulam']).toBeUndefined()
    expect(EXPEDITION_BY_PORTAL['portal-nexus-forge']).toBeUndefined()
    expect(EXPEDITION_BY_PORTAL['portal-nexus-catacombs']).toBeUndefined()
  })
})
