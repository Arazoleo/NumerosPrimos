import { describe, expect, it } from 'vitest'

import {
  coopEnemiesToLocal,
  decodeCoopAction,
  decodeCoopState,
  electCoopHost,
  encodeCoopAction,
  encodeCoopState,
  type CatacombsCoopState,
} from './catacombsCoop'

const state: CatacombsCoopState = {
  levelIndex: 2,
  enemies: [
    { id: 'mitm-23', x: 12.34, z: -8.71, mode: 'chase' },
    { id: 'mitm-46', x: -20, z: 4, mode: 'patrol' },
  ],
  openedDrawers: ['hotel-front-1'],
  collectedPrimes: [2, 3],
  collectedSupplies: ['hotel-cell-05'],
  solvedPuzzles: ['yellow-offices', 'modular-pools'],
}

describe('catacombs co-op wire format', () => {
  it('round-trips world state through the opaque relay payload', () => {
    const decoded = decodeCoopState(encodeCoopState(state))
    expect(decoded).not.toBeNull()
    expect(decoded?.levelIndex).toBe(2)
    expect(decoded?.enemies[0].mode).toBe('chase')
    expect(decoded?.enemies[0].x).toBeCloseTo(12.3, 1)
    expect(decoded?.collectedPrimes).toEqual([2, 3])
    expect(decoded?.solvedPuzzles).toEqual(['yellow-offices', 'modular-pools'])
  })

  it('rejects malformed or hostile payloads instead of throwing', () => {
    expect(decodeCoopState(null)).toBeNull()
    expect(decodeCoopState({ v: 2 })).toBeNull()
    expect(decodeCoopState({ v: 1, l: 0, e: [['x', 1, 2, 'flying']], d: [], p: [], s: [], z: [] })).toBeNull()
    expect(decodeCoopState({ v: 1, l: 0, e: 'nope', d: [], p: [], s: [], z: [] })).toBeNull()
    expect(decodeCoopAction({ v: 1, kind: 'detonate-everything' })).toBeNull()
  })

  it('round-trips every action kind', () => {
    const actions = [
      { kind: 'open-drawer', cabinetId: 'office-cabinet-hr' },
      { kind: 'collect-supply', supplyId: 'office-cell-west' },
      { kind: 'collect-seal', prime: 5 },
      { kind: 'solve-puzzle', levelId: 'hotel-23' },
    ] as const
    for (const action of actions) {
      expect(decodeCoopAction(encodeCoopAction(action))).toEqual(action)
    }
  })

  it('elects the same host on every client and survives the host leaving', () => {
    expect(electCoopHost(['zeta', 'alpha', 'mid'])).toBe('alpha')
    expect(electCoopHost(['zeta', 'mid'])).toBe('mid')
    expect(electCoopHost([])).toBeNull()
  })

  it('converts replicated creatures into inert local enemies', () => {
    const locals = coopEnemiesToLocal(state.enemies, [])
    expect(locals).toHaveLength(2)
    expect(locals[0].mode).toBe('chase')
    expect(locals[0].huntCooldownUntil).toBe(0)
    expect(locals[0].lastKnown).toEqual({ x: locals[0].x, z: locals[0].z })
  })
})
