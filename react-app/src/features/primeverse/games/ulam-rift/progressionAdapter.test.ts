import { describe, expect, it, vi } from 'vitest'

import {
  ULAM_RIFT_PRIMES,
  ULAM_RIFT_TOWER_IDS,
  createUlamRiftState,
  ulamRiftReducer,
  type UlamRiftAction,
  type UlamRiftState,
} from './ulamRiftLogic'
import {
  ULAM_RIFT_GAME_ID,
  createUlamRiftProgressRecorder,
  type UlamRiftProgressionWriter,
} from './progressionAdapter'

function reduce(state: UlamRiftState, ...actions: readonly UlamRiftAction[]): UlamRiftState {
  return actions.reduce(ulamRiftReducer, state)
}

function started(nowMs = 1_000): UlamRiftState {
  return ulamRiftReducer(createUlamRiftState(), { type: 'start', nowMs })
}

function wonRun(): UlamRiftState {
  let state = started()
  for (let index = 0; index < ULAM_RIFT_PRIMES.length; index += 1) {
    state = ulamRiftReducer(state, { type: 'collect-term', termId: `rift-prime-${ULAM_RIFT_PRIMES[index]}` })
    const towerIndex = [1, 3, 5, 7].indexOf(index)
    if (towerIndex >= 0) {
      state = ulamRiftReducer(state, { type: 'activate-tower', towerId: ULAM_RIFT_TOWER_IDS[towerIndex] })
    }
  }
  return state
}

function lostRun(): UlamRiftState {
  return reduce(
    started(),
    { type: 'collect-term', termId: 'rift-prime-2' },
    { type: 'hit-hazard', hazardId: 'pulse-1', damage: 100 },
  )
}

function fakeWriter(isNewBest = true): UlamRiftProgressionWriter {
  return {
    updateBestScore: vi.fn((_gameId: string, _score: number) => isNewBest),
    awardXp: vi.fn((_amount: number) => undefined),
  }
}

describe('Fenda de Ulam progression adapter', () => {
  it('records a victory once under the ulam-rift id with score and xp', () => {
    const writer = fakeWriter()
    const recorder = createUlamRiftProgressRecorder(() => writer)
    const state = wonRun()

    const record = recorder.record(state)

    expect(record).not.toBeNull()
    expect(record?.outcome).toBe('won')
    expect(record?.score).toBeGreaterThan(0)
    expect(record?.xp).toBeGreaterThan(0)
    expect(record?.isNewBest).toBe(true)
    expect(writer.updateBestScore).toHaveBeenCalledWith(ULAM_RIFT_GAME_ID, record?.score)
    expect(writer.awardXp).toHaveBeenCalledWith(record?.xp)
  })

  it('is idempotent: the same run is written only once', () => {
    const writer = fakeWriter()
    const recorder = createUlamRiftProgressRecorder(() => writer)
    const state = wonRun()

    const first = recorder.record(state)
    const second = recorder.record(state)
    const third = recorder.record({ ...state, elapsedMs: state.elapsedMs + 5_000 })

    expect(first).not.toBeNull()
    expect(second).toBeNull()
    expect(third).toBeNull()
    expect(writer.updateBestScore).toHaveBeenCalledOnce()
    expect(writer.awardXp).toHaveBeenCalledOnce()
  })

  it('records a lost run (fall / zero integrity) exactly once', () => {
    const writer = fakeWriter()
    const recorder = createUlamRiftProgressRecorder(() => writer)
    const state = lostRun()
    expect(state.phase).toBe('lost')

    const record = recorder.record(state)

    expect(record?.outcome).toBe('lost')
    expect(record?.xp).toBeGreaterThan(0)
    expect(recorder.record(state)).toBeNull()
    expect(writer.awardXp).toHaveBeenCalledOnce()
  })

  it('persists a menu exit: a terminal run written once even if the page records on unmount', () => {
    const writer = fakeWriter()
    const recorder = createUlamRiftProgressRecorder(() => writer)
    const state = wonRun()

    recorder.record(state)
    recorder.record(state)

    expect(writer.awardXp).toHaveBeenCalledOnce()
  })

  it('writes separate records for distinct runs', () => {
    const writer = fakeWriter()
    const recorder = createUlamRiftProgressRecorder(() => writer)

    recorder.record(wonRun())
    const secondRun = reduce(
      wonRun(),
      { type: 'restart', nowMs: 20_000 },
      { type: 'collect-term', termId: 'rift-prime-2' },
      { type: 'hit-hazard', hazardId: 'pulse-1', damage: 100 },
    )
    expect(secondRun.runSerial).toBeGreaterThan(1)
    const second = recorder.record(secondRun)

    expect(second?.outcome).toBe('lost')
    expect(writer.awardXp).toHaveBeenCalledTimes(2)
  })

  it('ignores non-terminal states', () => {
    const writer = fakeWriter()
    const recorder = createUlamRiftProgressRecorder(() => writer)

    expect(recorder.record(createUlamRiftState())).toBeNull()
    expect(recorder.record(started())).toBeNull()
    expect(writer.awardXp).not.toHaveBeenCalled()
  })
})
