import { describe, expect, it, vi } from 'vitest'

import { createUlamMissions, ULAM_ROUNDS } from './ulamLogic'
import { createUlamGalaxyStore } from './ulamStore'

describe('Ulam Galaxy store', () => {
  it('runs all five scans and records a completed map', () => {
    let clock = 1_000
    const recordProgress = vi.fn(() => true)
    const store = createUlamGalaxyStore({
      now: () => clock,
      recordProgress,
      missions: createUlamMissions(),
    })

    store.getState().start()
    for (let round = 0; round < ULAM_ROUNDS; round += 1) {
      const mission = store.getState().mission
      expect(store.getState().selectDirection(mission.correctDirection)).toBe(true)
      expect(store.getState().scan()).toBe(true)
      clock += 500
      expect(store.getState().resolveScan()).toBe(true)
      if (round < ULAM_ROUNDS - 1) expect(store.getState().nextRound()).toBe(true)
    }

    expect(store.getState()).toMatchObject({
      phase: 'complete',
      mistakes: 0,
      result: { elapsedMs: 2_500, isNewBest: true },
    })
    expect(store.getState().roundResults).toHaveLength(ULAM_ROUNDS)
    expect(recordProgress).toHaveBeenCalledOnce()
  })

  it('rejects a sparse diagonal and lets the player try again', () => {
    const store = createUlamGalaxyStore({ missions: createUlamMissions() })
    store.getState().start()
    const mission = store.getState().mission
    const wrong = mission.paths.find((path) => path.direction.id !== mission.correctDirection)
    if (!wrong) throw new Error('missing wrong direction')

    store.getState().selectDirection(wrong.direction.id)
    store.getState().scan()
    expect(store.getState().resolveScan()).toBe(false)
    expect(store.getState()).toMatchObject({
      phase: 'playing',
      mistakes: 1,
      roundMistakes: 1,
      selectedDirection: null,
    })
  })

  it('guards actions outside their phase and resets cleanly', () => {
    const store = createUlamGalaxyStore({ missions: createUlamMissions() })
    expect(store.getState().scan()).toBe(false)
    store.getState().start()
    const enabled = store.getState().scannerEnabled
    store.getState().toggleScanner()
    expect(store.getState().scannerEnabled).toBe(!enabled)
    store.getState().returnToIntro()
    expect(store.getState()).toMatchObject({ phase: 'intro', score: 0, result: null })
  })

  it('rejects duplicate or mathematically inconsistent mission paths', () => {
    const missions = createUlamMissions()
    const duplicatePaths = [
      {
        ...missions[0],
        paths: [
          missions[0].paths[0],
          missions[0].paths[0],
          missions[0].paths[2],
          missions[0].paths[3],
        ],
      },
      ...missions.slice(1),
    ]
    const wrongWinner = [
      { ...missions[0], correctDirection: missions[0].paths[1].direction.id },
      ...missions.slice(1),
    ]
    const dishonestCount = [
      {
        ...missions[0],
        paths: missions[0].paths.map((path) => path.direction.id === missions[0].correctDirection
          ? { ...path, primeCount: path.primeCount + 1 }
          : path),
      },
      ...missions.slice(1),
    ]

    expect(() => createUlamGalaxyStore({ missions: duplicatePaths })).toThrow()
    expect(() => createUlamGalaxyStore({ missions: wrongWinner })).toThrow()
    expect(() => createUlamGalaxyStore({ missions: dishonestCount })).toThrow()
  })
})
