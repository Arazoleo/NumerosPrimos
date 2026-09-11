import { describe, expect, it } from 'vitest'

import {
  CATACOMBS_LEVELS,
  CATACOMBS_SEAL_ORDER,
  attemptCatacombsLevelExit,
  catacombsCampaignObjective,
  collectCurrentCatacombsSeal,
  createInitialCatacombsCampaign,
  getCurrentCatacombsLevel,
  isCurrentCatacombsExitUnlocked,
  type CatacombsSealPrime,
} from './campaignLogic'

describe('Cripta do Crivo campaign definition', () => {
  it('defines four ordered, readable levels with one unique seal each', () => {
    expect(CATACOMBS_LEVELS.map((level) => level.id)).toEqual([
      'yellow-offices',
      'modular-pools',
      'hotel-23',
      'crypt-49',
      'server-farm-11',
      'cold-vault-13',
    ])
    expect(CATACOMBS_LEVELS.map((level) => level.sealPrime)).toEqual([2, 3, 5, 7, 11, 13])
    expect(CATACOMBS_SEAL_ORDER).toEqual([2, 3, 5, 7, 11, 13])
    expect(CATACOMBS_LEVELS.map((level) => level.index)).toEqual([0, 1, 2, 3, 4, 5])
    expect(new Set(CATACOMBS_LEVELS.map((level) => level.enemy)).size).toBe(6)
    expect(new Set(CATACOMBS_LEVELS.flatMap((level) => level.events)).size).toBe(18)
    for (const level of CATACOMBS_LEVELS) {
      expect(level.light.fogFar).toBeGreaterThan(level.light.fogNear)
      expect(level.light.flashlightFillIntensity).toBeGreaterThanOrEqual(5.4)
      expect(level.light.ambientIntensity).toBeGreaterThanOrEqual(0.28)
    }
  })
})

describe('Cripta do Crivo campaign progression', () => {
  it('keeps each elevator locked until the local seal is collected', () => {
    const initial = createInitialCatacombsCampaign(1_000)
    expect(getCurrentCatacombsLevel(initial).sealPrime).toBe(2)
    expect(isCurrentCatacombsExitUnlocked(initial)).toBe(false)

    const locked = attemptCatacombsLevelExit(initial, 2_000)
    expect(locked.status).toBe('exit-locked')
    expect(locked.state).toBe(initial)

    const wrong = collectCurrentCatacombsSeal(initial, 3)
    expect(wrong.status).toBe('wrong-seal')
    expect(wrong.state).toBe(initial)

    const collected = collectCurrentCatacombsSeal(initial, 2)
    expect(collected.status).toBe('seal-collected')
    expect(isCurrentCatacombsExitUnlocked(collected.state)).toBe(true)
    expect(catacombsCampaignObjective(collected.state)).toContain('ELEVADOR')
  })

  it('advances through every seal and only wins after the last exit', () => {
    let state = createInitialCatacombsCampaign(1_000)
    const primes: readonly CatacombsSealPrime[] = [2, 3, 5, 7, 11, 13]

    for (const [index, prime] of primes.entries()) {
      const collected = collectCurrentCatacombsSeal(state, prime)
      expect(collected.status).toBe('seal-collected')
      const exited = attemptCatacombsLevelExit(collected.state, 2_000 + index * 1_000)
      expect(exited.status).toBe(index === primes.length - 1 ? 'campaign-complete' : 'level-advanced')
      state = exited.state
    }

    expect(state.phase).toBe('won')
    expect(state.levelIndex).toBe(5)
    expect(state.currentLevelId).toBe('cold-vault-13')
    expect(state.collectedPrimes).toEqual(primes)
    expect(state.completedLevels.map((level) => level.levelId)).toEqual(
      CATACOMBS_LEVELS.map((level) => level.id),
    )
    expect(catacombsCampaignObjective(state)).toContain('2 · 3 · 5 · 7')
    expect(catacombsCampaignObjective(state)).toContain('13')
  })

  it('is idempotent for duplicate seals and completed campaigns', () => {
    const initial = createInitialCatacombsCampaign()
    const first = collectCurrentCatacombsSeal(initial, 2)
    const duplicate = collectCurrentCatacombsSeal(first.state, 2)
    expect(duplicate.status).toBe('already-collected')
    expect(duplicate.state).toBe(first.state)

    let state = first.state
    state = attemptCatacombsLevelExit(state, 100).state
    for (const prime of [3, 5, 7, 11, 13] as const) {
      state = collectCurrentCatacombsSeal(state, prime).state
      state = attemptCatacombsLevelExit(state, 200 + prime).state
    }
    const afterWin = attemptCatacombsLevelExit(state, 9_999)
    expect(afterWin.status).toBe('inactive')
    expect(afterWin.state).toBe(state)
  })

  it('does not record negative level durations when the clock moves backwards', () => {
    const initial = createInitialCatacombsCampaign(5_000)
    const ready = collectCurrentCatacombsSeal(initial, 2).state
    const advanced = attemptCatacombsLevelExit(ready, 1_000)
    expect(advanced.state.completedLevels[0]?.elapsedMs).toBe(0)
    expect(advanced.state.levelStartedAtMs).toBe(5_000)
  })

  it('recovers a persisted campaign when its numeric index is stale', () => {
    const initial = createInitialCatacombsCampaign(1_000)
    const restored = {
      ...initial,
      levelIndex: 99,
      currentLevelId: 'hotel-23' as const,
      collectedPrimes: [2, 3, 5] as const,
    }

    expect(getCurrentCatacombsLevel(restored).id).toBe('hotel-23')
    const advanced = attemptCatacombsLevelExit(restored, 2_500)
    expect(advanced.status).toBe('level-advanced')
    expect(advanced.state.levelIndex).toBe(3)
    expect(advanced.state.currentLevelId).toBe('crypt-49')
    expect(getCurrentCatacombsLevel(advanced.state).sealPrime).toBe(7)
  })
})
