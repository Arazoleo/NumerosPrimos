import { describe, expect, it } from 'vitest'

import {
  ULAM_RIFT_PRIMES,
  ULAM_RIFT_PLATFORMS,
  ULAM_RIFT_SECTORS,
  ULAM_RIFT_TERMS,
  ULAM_RIFT_TOWER_IDS,
  createUlamRiftState,
  formatRiftTime,
  getUlamRiftBarrierNode,
  getUlamRiftCheckpoint,
  getUlamRiftObjective,
  sectorAtRiftPosition,
  ulamRiftReducer,
  type UlamRiftAction,
  type UlamRiftState,
} from './ulamRiftLogic'

function reduce(state: UlamRiftState, ...actions: readonly UlamRiftAction[]): UlamRiftState {
  return actions.reduce(ulamRiftReducer, state)
}

function started(): UlamRiftState {
  return ulamRiftReducer(createUlamRiftState(), { type: 'start', nowMs: 1_000 })
}

describe('Fenda de Ulam standalone progression', () => {
  it('starts a fresh timed expedition', () => {
    const state = reduce(started(), { type: 'tick', nowMs: 4_450 })
    expect(state).toMatchObject({ phase: 'running', elapsedMs: 3_450, integrity: 100, runSerial: 1 })
    expect(getUlamRiftObjective(state)).toMatchObject({ kind: 'prime', title: 'Encontre o termo 2' })
  })

  it('accepts prime terms only in canonical order', () => {
    const wrongPrime = ulamRiftReducer(started(), { type: 'collect-term', termId: 'rift-prime-5' })
    expect(wrongPrime.nextPrimeIndex).toBe(0)
    expect(wrongPrime.feedback?.message).toContain('2')

    const first = ulamRiftReducer(wrongPrime, { type: 'collect-term', termId: 'rift-prime-2' })
    const repeated = ulamRiftReducer(first, { type: 'collect-term', termId: 'rift-prime-2' })
    expect(first.nextPrimeIndex).toBe(1)
    expect(repeated).toBe(first)
  })

  it('makes composite decoys dangerous without advancing the sequence', () => {
    const state = ulamRiftReducer(started(), { type: 'collect-term', termId: 'rift-composite-4' })
    expect(state.nextPrimeIndex).toBe(0)
    expect(state.integrity).toBe(92)
    expect(state.hits).toBe(1)
  })

  it('gates each checkpoint tower behind terms and the previous tower', () => {
    const early = ulamRiftReducer(started(), { type: 'activate-tower', towerId: 'tower-twins' })
    expect(early.activatedTowerIds).toEqual([])

    const terms = reduce(
      early,
      { type: 'collect-term', termId: 'rift-prime-2' },
      { type: 'collect-term', termId: 'rift-prime-3' },
    )
    expect(getUlamRiftObjective(terms).kind).toBe('tower')
    const tower = ulamRiftReducer(terms, { type: 'activate-tower', towerId: 'tower-twins' })
    expect(tower.activatedTowerIds).toEqual(['tower-twins'])
    expect(getUlamRiftCheckpoint(tower)).not.toEqual(getUlamRiftCheckpoint(terms))
    expect(getUlamRiftBarrierNode(tower)).toBe(15)
  })

  it('damages on hazards and falls, and loses at zero integrity', () => {
    const hurt = reduce(
      started(),
      { type: 'hit-hazard', hazardId: 'pulse-1', damage: 40 },
      { type: 'fall' },
      { type: 'hit-hazard', hazardId: 'pulse-2', damage: 80 },
    )
    expect(hurt).toMatchObject({ phase: 'lost', integrity: 0, falls: 1, hits: 3 })
  })

  it('completes all eight terms and four towers before victory', () => {
    let state = started()
    for (let index = 0; index < ULAM_RIFT_PRIMES.length; index += 1) {
      const value = ULAM_RIFT_PRIMES[index]
      state = ulamRiftReducer(state, { type: 'collect-term', termId: `rift-prime-${value}` })
      const towerIndex = [1, 3, 5, 7].indexOf(index)
      if (towerIndex >= 0) {
        state = ulamRiftReducer(state, { type: 'activate-tower', towerId: ULAM_RIFT_TOWER_IDS[towerIndex] })
      }
    }
    expect(state.phase).toBe('won')
    expect(state.nextPrimeIndex).toBe(8)
    expect(state.activatedTowerIds).toHaveLength(4)
    expect(getUlamRiftObjective(state).current).toBe(12)
  })

  it('restarts every progression field while preserving a monotonic run serial', () => {
    const changed = reduce(
      started(),
      { type: 'collect-term', termId: 'rift-prime-2' },
      { type: 'hit-hazard', hazardId: 'pulse-1', damage: 12 },
      { type: 'restart', nowMs: 8_000 },
    )
    expect(changed).toMatchObject({
      phase: 'running',
      runSerial: 2,
      startedAtMs: 8_000,
      integrity: 100,
      nextPrimeIndex: 0,
      collectedTermIds: [],
      activatedTowerIds: [],
    })
  })

  it('provides stable world metadata and readable timing', () => {
    expect(ULAM_RIFT_TERMS).toHaveLength(18)
    expect(ULAM_RIFT_PLATFORMS).toHaveLength(33)
    expect(ULAM_RIFT_PLATFORMS[0].position[2] - ULAM_RIFT_PLATFORMS[32].position[2]).toBeGreaterThan(220)
    expect(ULAM_RIFT_PLATFORMS[32].position[1] - ULAM_RIFT_PLATFORMS[0].position[1]).toBeGreaterThan(40)
    expect(new Set(ULAM_RIFT_PLATFORMS.map((platform) => platform.sector))).toEqual(
      new Set(ULAM_RIFT_SECTORS.map((sector) => sector.id)),
    )
    expect(sectorAtRiftPosition([0, 0, -120]).id).toBe('broken-sieve')
    expect(sectorAtRiftPosition([0, 0, -210]).id).toBe('irredutible-crown')
    expect(formatRiftTime(65_430)).toBe('01:05.43')
  })
})
