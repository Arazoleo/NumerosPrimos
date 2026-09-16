import { describe, expect, it, vi } from 'vitest'

import { DEFENSE_WAVES } from './defenseLogic'
import { createPrimeDefenseStore, type PrimeDefenseStore } from './defenseStore'
import type { DefenseDivisor, DefenseLane, DefenseSlot } from './types'

type Plan = readonly [DefenseLane, DefenseSlot, DefenseDivisor][]

const PERFECT_PLANS: readonly Plan[] = [
  // tutorial (energy 4): lanes [2] / [3, 4] / [9]
  [[1, 0, 2], [2, 0, 3]],
  // parity-signal (energy 6): lanes [11, 6, 13] / [15, 17] / [10, 19]
  [[0, 0, 2], [1, 0, 3], [2, 0, 2]],
  // crossed-factors (energy 10): lanes [21, 23, 35] / [22, 25, 29] / [27, 31, 33]
  [[0, 0, 7], [1, 0, 2], [1, 1, 5], [2, 0, 3]],
  // dual-front (energy 14): lanes [26, 39, 41] / [49, 43, 45] / [46, 55, 47]
  [[0, 0, 2], [0, 1, 3], [1, 0, 7], [1, 1, 3], [2, 0, 2], [2, 1, 5]],
  // compression-field (energy 12): lanes [51, 53, 65, 67] / [70, 71, 77] / [57, 59, 58, 61]
  [[0, 0, 3], [0, 1, 5], [1, 0, 7], [2, 0, 3], [2, 1, 2]],
  // factor-storm (energy 19): lanes [82, 83, 85, 87] / [91, 89, 93, 95] / [94, 97, 98, 99]
  [[0, 0, 2], [0, 1, 5], [0, 2, 3], [1, 0, 7], [1, 1, 3], [1, 2, 5], [2, 0, 2], [2, 1, 3]],
]

function runCurrentWave(store: PrimeDefenseStore): void {
  expect(store.getState().launchWave()).toBe(true)
  while (store.getState().phase === 'running') {
    expect(store.getState().resolveNextEnemy()).not.toBeNull()
  }
}

describe('Prime Defense store', () => {
  it('starts a clean campaign and enforces the wave energy budget', () => {
    const store = createPrimeDefenseStore({ now: () => 1_000, initialBestScore: 0 })
    store.getState().start()
    expect(store.getState()).toMatchObject({
      phase: 'planning',
      waveIndex: 0,
      lives: 6,
      startedAt: 1_000,
    })

    expect(store.getState().placeTower(0, 0, 7)).toBe(true)
    expect(store.getState().placeTower(1, 0, 2)).toBe(false)
    expect(store.getState().placements).toHaveLength(1)
    expect(store.getState().feedback?.title).toBe('Energia insuficiente')
  })

  it('replaces towers with refund accounting and toggles the same filter off', () => {
    const store = createPrimeDefenseStore({ initialBestScore: 0 })
    store.getState().start()
    store.getState().placeTower(0, 0, 7)
    expect(store.getState().placeTower(0, 0, 2)).toBe(true)
    expect(store.getState().placements).toMatchObject([{ divisor: 2 }])
    expect(store.getState().placeTower(0, 0, 2)).toBe(true)
    expect(store.getState().placements).toEqual([])
  })

  it('resolves prime, interception and breach outcomes one at a time', () => {
    const store = createPrimeDefenseStore({ initialBestScore: 0 })
    store.getState().start()
    store.getState().placeTower(0, 0, 2)
    store.getState().launchWave()

    expect(store.getState().resolveNextEnemy()?.kind).toBe('prime-passed')
    expect(store.getState()).toMatchObject({ coreCharge: 1, lives: 6 })
    expect(store.getState().resolveNextEnemy()?.kind).toBe('prime-passed')
    expect(store.getState()).toMatchObject({ coreCharge: 2, lives: 6 })
    expect(store.getState().resolveNextEnemy()?.kind).toBe('breach')
    expect(store.getState().lives).toBe(5)
  })

  it('completes all six waves with a perfect strategy and records progression once', () => {
    let clock = 10_000
    const recordProgress = vi.fn(() => true)
    const saveBestScore = vi.fn()
    const store = createPrimeDefenseStore({
      now: () => clock,
      recordProgress,
      initialBestScore: 100,
      saveBestScore,
    })
    store.getState().start()

    PERFECT_PLANS.forEach((plan, waveIndex) => {
      expect(store.getState().waveIndex).toBe(waveIndex)
      plan.forEach(([lane, slot, divisor]) => {
        expect(store.getState().placeTower(lane, slot, divisor)).toBe(true)
      })
      clock += 1_000
      runCurrentWave(store)
      if (waveIndex < DEFENSE_WAVES.length - 1) {
        expect(store.getState().phase).toBe('wave-result')
        expect(store.getState().nextWave()).toBe(true)
      }
    })

    const state = store.getState()
    expect(state.phase).toBe('victory')
    expect(state.lives).toBe(6)
    expect(state.breaches).toBe(0)
    expect(state.waveSummaries).toHaveLength(6)
    expect(state.waveSummaries.every((summary) => summary.perfect)).toBe(true)
    expect(state.result).toMatchObject({
      victory: true,
      wavesCleared: 6,
      isNewBest: true,
    })
    expect(state.result?.elapsedMs).toBe(6_000)
    expect(state.result?.xp).toBeGreaterThan(0)
    expect(recordProgress).toHaveBeenCalledOnce()
    expect(saveBestScore).toHaveBeenCalledOnce()
  })

  it('ends the campaign once when the final core life is lost', () => {
    const recordProgress = vi.fn(() => false)
    const store = createPrimeDefenseStore({ recordProgress, initialBestScore: 9_999 })
    store.getState().start()

    while (store.getState().phase !== 'defeat') {
      const { phase } = store.getState()
      if (phase === 'planning') {
        store.getState().launchWave()
      } else if (phase === 'running') {
        store.getState().resolveNextEnemy()
      } else if (phase === 'wave-result') {
        store.getState().nextWave()
      } else {
        break
      }
    }

    expect(store.getState().phase).toBe('defeat')
    expect(store.getState().result?.victory).toBe(false)
    expect(recordProgress).toHaveBeenCalledOnce()
    expect(store.getState().resolveNextEnemy()).toBeNull()
    expect(recordProgress).toHaveBeenCalledOnce()
  })

  it('still reaches a terminal state when local best-score persistence fails', () => {
    const store = createPrimeDefenseStore({
      initialBestScore: 0,
      recordProgress: () => false,
      saveBestScore: () => { throw new Error('storage unavailable') },
    })
    store.getState().start()
    let guard = 100

    expect(() => {
      while (guard > 0 && !['victory', 'defeat'].includes(store.getState().phase)) {
        guard -= 1
        const { phase } = store.getState()
        if (phase === 'planning') store.getState().launchWave()
        else if (phase === 'running') store.getState().resolveNextEnemy()
        else if (phase === 'wave-result') store.getState().nextWave()
      }
    }).not.toThrow()

    expect(store.getState().phase).toBe('defeat')
    expect(guard).toBeGreaterThan(0)
  })
})