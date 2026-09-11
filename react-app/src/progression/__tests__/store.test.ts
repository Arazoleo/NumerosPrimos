import { describe, expect, it } from 'vitest'
import {
  createMemoryProgressionRepository,
  createProgressionStore,
  getLevelProgress,
  levelFromXp,
} from '..'

const FIXED_TIME = '2026-01-15T12:00:00.000Z'

function setup() {
  const repository = createMemoryProgressionRepository()
  const store = createProgressionStore(repository, { now: () => FIXED_TIME })
  return { repository, store }
}

describe('progression levels', () => {
  it('derives deterministic levels and progress from total XP', () => {
    expect(levelFromXp(-10)).toBe(1)
    expect(levelFromXp(499)).toBe(1)
    expect(levelFromXp(500)).toBe(2)
    expect(levelFromXp(1_250)).toBe(3)
    expect(getLevelProgress(1_250)).toEqual({
      level: 3,
      xpInLevel: 250,
      xpForNextLevel: 500,
      ratio: 0.5,
    })
  })
})

describe('progression store', () => {
  it('awards XP, derives level, and persists the result', () => {
    const { repository, store } = setup()

    expect(store.getState().awardXp(750)).toEqual({
      awardedXp: 750,
      previousXp: 0,
      totalXp: 750,
      previousLevel: 1,
      level: 2,
      levelsGained: 1,
    })
    expect(store.getState()).toMatchObject({ xp: 750, level: 2 })
    expect(repository.load()).toMatchObject({ xp: 750, level: 2 })
  })

  it('unlocks Primeiro Primo and Prime Sniper at their exact conditions', () => {
    const { store } = setup()

    const firstHit = store.getState().recordPrimeHit()
    expect(firstHit.unlockedAchievements).toEqual(['first-prime'])
    expect(store.getState().achievements['first-prime']).toEqual({
      unlocked: true,
      unlockedAt: FIXED_TIME,
    })

    store.getState().recordPrimeMiss()
    for (let hit = 0; hit < 9; hit += 1) {
      store.getState().recordPrimeHit()
    }
    expect(store.getState().achievements['prime-sniper'].unlocked).toBe(false)

    const tenthHit = store.getState().recordPrimeHit()
    expect(tenthHit.unlockedAchievements).toEqual(['prime-sniper'])
    expect(store.getState().statistics.bestPrimeStreak).toBe(10)
  })

  it('unlocks factor achievements after one and ten completed factorizations', () => {
    const { store } = setup()

    const first = store
      .getState()
      .recordFactorization({ score: 300, xp: 125, steps: 3 })
    expect(first.unlockedAchievements).toEqual(['factor-apprentice'])
    expect(first.xp.awardedXp).toBe(125)

    for (let completion = 2; completion <= 9; completion += 1) {
      store.getState().recordFactorization({ score: 200 })
    }
    expect(store.getState().achievements['factor-master'].unlocked).toBe(false)

    const tenth = store
      .getState()
      .recordFactorCompletion({ score: 250, elapsedMs: 1_000 })
    expect(tenth.unlockedAchievements).toEqual(['factor-master'])
    expect(store.getState().factorCompletions).toBe(10)
    expect(store.getState().bestScores['factor-forge']).toBe(300)
  })

  it('unlocks Perfect Hunter only for a non-empty, error-free run', () => {
    const { store } = setup()

    store.getState().recordHunterRun({
      score: 0,
      hits: 0,
      misses: 0,
      bestCombo: 0,
    })
    expect(store.getState().achievements['perfect-hunter'].unlocked).toBe(false)

    const imperfect = store.getState().recordHunterRun({
      score: 400,
      hits: 10,
      misses: 1,
      bestCombo: 10,
    })
    expect(imperfect.unlockedAchievements).toEqual([
      'first-prime',
      'prime-sniper',
    ])
    expect(store.getState().achievements['perfect-hunter'].unlocked).toBe(false)

    const perfect = store.getState().recordHunterRun({
      score: 350,
      hits: 7,
      misses: 0,
      bestCombo: 7,
    })
    expect(perfect.unlockedAchievements).toEqual(['perfect-hunter'])
    expect(store.getState().bestScores['prime-hunter']).toBe(400)
  })

  it('can hydrate and reset without exposing repository details to games', () => {
    const { repository, store } = setup()

    store.getState().awardXp(600)
    const secondStore = createProgressionStore(repository, {
      now: () => FIXED_TIME,
    })
    expect(secondStore.getState()).toMatchObject({ xp: 600, level: 2 })

    secondStore.getState().resetProgression()
    expect(secondStore.getState()).toMatchObject({
      xp: 0,
      level: 1,
      factorCompletions: 0,
    })
    expect(repository.load()).toMatchObject({ xp: 0, level: 1 })
  })
})

