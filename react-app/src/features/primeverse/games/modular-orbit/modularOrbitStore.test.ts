import { describe, expect, it, vi } from 'vitest'

import {
  createModularOrbitChallenges,
  createSeededOrbitRandom,
  MODULAR_ORBIT_ROUNDS,
} from './modularOrbitLogic'
import { createModularOrbitStore } from './modularOrbitStore'

const mission = createModularOrbitChallenges(createSeededOrbitRandom(84))

function createTestStore(now = () => 1_000) {
  const recordProgress = vi.fn(() => true)
  const store = createModularOrbitStore({
    now,
    challengeGenerator: () => mission,
    recordProgress,
  })

  return { store, recordProgress }
}

describe('Modular Orbit store', () => {
  it('keeps the same round after a wrong launch', () => {
    const { store } = createTestStore()
    store.getState().start()

    const solution = store.getState().challenge.solution
    expect(store.getState().launch(solution + 1)).toBe(true)
    expect(store.getState()).toMatchObject({
      phase: 'launching',
      roundIndex: 0,
      attempts: 1,
    })

    expect(store.getState().resolveLaunch()).toBe(false)
    expect(store.getState()).toMatchObject({
      phase: 'playing',
      roundIndex: 0,
      mistakes: 1,
      roundMistakes: 1,
    })
  })

  it('advances only after the minimal pulse count is confirmed', () => {
    const { store } = createTestStore()
    store.getState().start()
    const first = store.getState().challenge

    store.getState().launch(first.solution + first.period)
    expect(store.getState().resolveLaunch()).toBe(false)
    expect(store.getState().feedback?.title).toBe('Rota não mínima')

    store.getState().launch(first.solution)
    expect(store.getState().resolveLaunch()).toBe(true)
    expect(store.getState()).toMatchObject({
      phase: 'round-complete',
      roundIndex: 0,
    })

    expect(store.getState().nextRound()).toBe(true)
    expect(store.getState()).toMatchObject({ phase: 'playing', roundIndex: 1 })
  })

  it('completes five rounds and records progression exactly once', () => {
    let clock = 2_000
    const { store, recordProgress } = createTestStore(() => clock)
    store.getState().start()

    for (let round = 0; round < MODULAR_ORBIT_ROUNDS; round += 1) {
      const challenge = store.getState().challenge
      expect(store.getState().launch(challenge.solution)).toBe(true)
      clock += 250
      expect(store.getState().resolveLaunch()).toBe(true)

      if (round < MODULAR_ORBIT_ROUNDS - 1) {
        expect(store.getState().nextRound()).toBe(true)
      }
    }

    const finished = store.getState()
    expect(finished.phase).toBe('complete')
    expect(finished.roundResults).toHaveLength(5)
    expect(finished.result).toMatchObject({
      attempts: 5,
      mistakes: 0,
      elapsedMs: 1_250,
      isNewBest: true,
    })
    expect(finished.result?.score).toBe(finished.score)
    expect(finished.result?.xp).toBeGreaterThan(0)
    expect(recordProgress).toHaveBeenCalledOnce()

    expect(store.getState().resolveLaunch()).toBe(false)
    expect(recordProgress).toHaveBeenCalledOnce()
  })

  it('rejects malformed input without consuming an attempt', () => {
    const { store } = createTestStore()
    store.getState().start()
    store.getState().setGuess('3.5')

    expect(store.getState().launch()).toBe(false)
    expect(store.getState()).toMatchObject({
      phase: 'playing',
      attempts: 0,
      roundAttempts: 0,
    })
    expect(store.getState().feedback?.title).toBe('Pulso inválido')
  })

  it('keeps score and XP independent from wall-clock duration', () => {
    const fast = createTestStore(() => 100).store
    const slow = createTestStore(() => 999_999).store

    for (const store of [fast, slow]) {
      store.getState().start()
      for (let round = 0; round < MODULAR_ORBIT_ROUNDS; round += 1) {
        store.getState().launch(store.getState().challenge.solution)
        store.getState().resolveLaunch()
        if (round < MODULAR_ORBIT_ROUNDS - 1) store.getState().nextRound()
      }
    }

    expect(fast.getState().result?.score).toBe(slow.getState().result?.score)
    expect(fast.getState().result?.xp).toBe(slow.getState().result?.xp)
  })
})
