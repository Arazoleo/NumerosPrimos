import { describe, expect, it } from 'vitest'

import { remainingGameTime } from './types'
import {
  ULAM_COMPOSITE_PENALTY_MS,
  ULAM_DURATION_MS,
  ULAM_PRIME_SEQUENCE,
  createUlamPrimeRunState,
  findUlamTargetAtPosition,
  getUlamTargetStatus,
  ulamPrimeRunReducer,
  type UlamPrimeRunState,
} from './ulamPrimeRun'

function beginRun(bestTimeMs: number | null = null): UlamPrimeRunState {
  let state = createUlamPrimeRunState(bestTimeMs)
  state = ulamPrimeRunReducer(state, { type: 'start', nowMs: 1_000 })
  return ulamPrimeRunReducer(state, { type: 'tick', nowMs: 4_000 })
}

describe('Ulam Prime Run', () => {
  it('runs a deterministic three-second countdown into a 35-second race', () => {
    let state = createUlamPrimeRunState()
    state = ulamPrimeRunReducer(state, { type: 'start', nowMs: 1_000 })
    expect(state.phase).toBe('countdown')
    expect(state.countdownEndsAtMs).toBe(4_000)

    state = ulamPrimeRunReducer(state, { type: 'tick', nowMs: 3_999 })
    expect(state.phase).toBe('countdown')
    state = ulamPrimeRunReducer(state, { type: 'tick', nowMs: 4_000 })
    expect(state.phase).toBe('running')
    expect(state.startedAtMs).toBe(4_000)
    expect(remainingGameTime(state)).toBe(ULAM_DURATION_MS)
  })

  it('ignores targets before the run and unknown physical IDs', () => {
    let state = createUlamPrimeRunState()
    state = ulamPrimeRunReducer(state, { type: 'hit', targetId: 'ulam-2', nowMs: 50 })
    expect(state.nextPrimeIndex).toBe(0)
    state = beginRun()
    const afterUnknown = ulamPrimeRunReducer(state, { type: 'hit', targetId: 'other-world-object', nowMs: 4_100 })
    expect(afterUnknown.nextPrimeIndex).toBe(0)
    expect(afterUnknown.mistakes).toBe(0)
  })

  it('requires primes in sequence without punishing an early prime', () => {
    let state = beginRun()
    state = ulamPrimeRunReducer(state, { type: 'hit', targetId: 'ulam-3', nowMs: 4_100 })
    expect(state.nextPrimeIndex).toBe(0)
    expect(state.penaltyMs).toBe(0)
    expect(state.mistakes).toBe(1)
    expect(state.feedback?.kind).toBe('out-of-order')

    state = ulamPrimeRunReducer(state, { type: 'hit', targetId: 'ulam-2', nowMs: 4_200 })
    expect(state.nextPrimeIndex).toBe(1)
    expect(state.collectedTargetIds).toEqual(['ulam-2'])
    expect(getUlamTargetStatus(state, 'ulam-2')).toBe('cleared')
    expect(getUlamTargetStatus(state, 'ulam-3')).toBe('current')
    expect(getUlamTargetStatus(state, 'ulam-17')).toBe('queued')
  })

  it('charges composites against the clock and debounces the same plate', () => {
    let state = beginRun()
    state = ulamPrimeRunReducer(state, { type: 'hit', targetId: 'ulam-4', nowMs: 5_000 })
    expect(state.penaltyMs).toBe(ULAM_COMPOSITE_PENALTY_MS)
    expect(state.feedback?.message).toContain('+2,5 s')
    const once = state

    state = ulamPrimeRunReducer(state, { type: 'hit', targetId: 'ulam-4', nowMs: 5_500 })
    expect(state.penaltyMs).toBe(once.penaltyMs)
    expect(state.mistakes).toBe(once.mistakes)

    state = ulamPrimeRunReducer(state, { type: 'hit', targetId: 'ulam-4', nowMs: 5_650 })
    expect(state.penaltyMs).toBe(ULAM_COMPOSITE_PENALTY_MS * 2)
  })

  it('wins after all seven targets and replaces a slower record', () => {
    let state = beginRun(12_000)
    ULAM_PRIME_SEQUENCE.forEach((prime, index) => {
      state = ulamPrimeRunReducer(state, {
        type: 'hit',
        targetId: `ulam-${prime}`,
        nowMs: 5_000 + index * 900,
      })
    })
    expect(state.phase).toBe('won')
    expect(state.nextPrimeIndex).toBe(ULAM_PRIME_SEQUENCE.length)
    expect(state.finishedTimeMs).toBe(6_400)
    expect(state.bestTimeMs).toBe(6_400)
    expect(state.isNewRecord).toBe(true)
  })

  it('keeps a faster existing record', () => {
    let state = beginRun(2_000)
    ULAM_PRIME_SEQUENCE.forEach((prime, index) => {
      state = ulamPrimeRunReducer(state, {
        type: 'hit',
        targetId: `ulam-${prime}`,
        nowMs: 5_000 + index * 900,
      })
    })
    expect(state.phase).toBe('won')
    expect(state.bestTimeMs).toBe(2_000)
    expect(state.isNewRecord).toBe(false)
  })

  it('loses when elapsed time plus penalties reaches the limit', () => {
    let state = beginRun()
    state = ulamPrimeRunReducer(state, {
      type: 'tick',
      nowMs: 4_000 + ULAM_DURATION_MS,
    })
    expect(state.phase).toBe('lost')

    state = beginRun()
    state = ulamPrimeRunReducer(state, { type: 'hit', targetId: 'ulam-6', nowMs: 36_600 })
    expect(state.phase).toBe('lost')
  })

  it('never allows a late or invalid timestamp to rewind the run', () => {
    let state = beginRun()
    state = ulamPrimeRunReducer(state, { type: 'tick', nowMs: 8_000 })
    state = ulamPrimeRunReducer(state, { type: 'tick', nowMs: 7_000 })
    expect(state.nowMs).toBe(8_000)
    state = ulamPrimeRunReducer(state, { type: 'tick', nowMs: Number.NaN })
    expect(state.nowMs).toBe(8_000)
  })

  it('locates physical plates by XZ radius', () => {
    expect(findUlamTargetAtPosition([68, 12, 6])?.id).toBe('ulam-2')
    expect(findUlamTargetAtPosition([68.8, -2, 6])?.id).toBe('ulam-2')
    expect(findUlamTargetAtPosition([72, 0, 12])).toBeNull()
  })
})

