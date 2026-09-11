import { describe, expect, it } from 'vitest'

import { SKYLINE_SENTINEL_IDS } from './missionData'
import { createSkylineRunnerStore } from './skylineRunnerStore'

function finishDialogue(store: ReturnType<typeof createSkylineRunnerStore>, lines = 2) {
  for (let index = 0; index < lines; index += 1) store.getState().advanceDialogue()
}

function unlockPrimePowers(store: ReturnType<typeof createSkylineRunnerStore>) {
  store.getState().setNearby('npc:lia')
  store.getState().interact()
  finishDialogue(store)
  ;([2, 3, 5] as const).forEach((core) => store.getState().collectCore(core))
  finishDialogue(store)
  store.getState().setNearby('npc:nilo')
  store.getState().interact()
  finishDialogue(store)
}

describe('skyline runner store', () => {
  it('runs the campaign gates through dialogue, collection and combat', () => {
    let clock = 1_000
    const store = createSkylineRunnerStore(() => clock)
    store.getState().setNearby('npc:lia')
    expect(store.getState().interact()).toBe(true)
    finishDialogue(store)
    expect(store.getState().mission.spokenNpcIds).toContain('lia')

    ;([2, 3, 5] as const).forEach((core) => store.getState().collectCore(core))
    finishDialogue(store)
    store.getState().setNearby('npc:nilo')
    store.getState().interact()
    finishDialogue(store)
    expect(store.getState().mission.coresDeliveredToNilo).toBe(true)

    SKYLINE_SENTINEL_IDS.forEach((id) => {
      store.getState().damageEnemy(id, 100)
    })
    expect(store.getState().mission.defeatedSentinelIds).toHaveLength(4)
    expect(store.getState().reachApex()).toBe(true)
    finishDialogue(store, 3)
    store.getState().setNearby('beacon')
    clock = 61_000
    expect(store.getState().interact()).toBe(true)
    expect(store.getState().result?.enemiesDefeated).toBe(4)
  })

  it('does not damage enemies before the factor pulse is unlocked', () => {
    const store = createSkylineRunnerStore()
    expect(store.getState().damageEnemy('sentinel-four', 100)).toBe('locked')
    expect(store.getState().enemyHealth['sentinel-four']).toBe(100)
  })

  it('locks prime casts until the cores are delivered to NILO', () => {
    const store = createSkylineRunnerStore()

    expect(store.getState().castPrimeAtEnemy('sentinel-four', 2)).toBe('locked')
    expect(store.getState().enemyFactors['sentinel-four']).toEqual([2, 2])
    expect(store.getState().enemyHealth['sentinel-four']).toBe(100)
    expect(store.getState().toast).toMatchObject({ title: 'BLINDAGEM COMPOSTA' })
  })

  it('resists a prime that is not a remaining factor without changing combat progress', () => {
    const store = createSkylineRunnerStore()
    unlockPrimePowers(store)
    const stylePoints = store.getState().stylePoints

    expect(store.getState().castPrimeAtEnemy('sentinel-nine', 5)).toBe('resisted')
    expect(store.getState().enemyFactors['sentinel-nine']).toEqual([3, 3])
    expect(store.getState().enemyHealth['sentinel-nine']).toBe(100)
    expect(store.getState().mission.defeatedSentinelIds).not.toContain('sentinel-nine')
    expect(store.getState().stylePoints).toBe(stylePoints)
    expect(store.getState().toast).toMatchObject({
      title: 'FATOR REJEITADO',
      detail: '5 não divide 9. A blindagem resistiu ao disparo.',
    })
  })

  it('removes one factor per correct cast, including duplicated factors', () => {
    const store = createSkylineRunnerStore()
    unlockPrimePowers(store)

    expect(store.getState().castPrimeAtEnemy('sentinel-four', 2)).toBe('hit')
    expect(store.getState().enemyFactors['sentinel-four']).toEqual([2])
    expect(store.getState().enemyHealth['sentinel-four']).toBe(50)
    expect(store.getState().castPrimeAtEnemy('sentinel-four', 2)).toBe('defeated')
    expect(store.getState().enemyFactors['sentinel-four']).toEqual([])
    expect(store.getState().enemyHealth['sentinel-four']).toBe(0)
    expect(store.getState().castPrimeAtEnemy('sentinel-four', 2)).toBe('ignored')

    expect(store.getState().castPrimeAtEnemy('sentinel-six', 3)).toBe('hit')
    expect(store.getState().enemyFactors['sentinel-six']).toEqual([2])
    expect(store.getState().castPrimeAtEnemy('sentinel-six', 3)).toBe('resisted')
    expect(store.getState().toast).toMatchObject({ title: 'SELO JÁ ROMPIDO' })
    expect(store.getState().castPrimeAtEnemy('sentinel-six', 2)).toBe('defeated')

    expect(store.getState().castPrimeAtEnemy('sentinel-nine', 3)).toBe('hit')
    expect(store.getState().enemyFactors['sentinel-nine']).toEqual([3])
    expect(store.getState().castPrimeAtEnemy('sentinel-nine', 3)).toBe('defeated')

    expect(store.getState().castPrimeAtEnemy('sentinel-ten', 5)).toBe('hit')
    expect(store.getState().enemyFactors['sentinel-ten']).toEqual([2])
    expect(store.getState().castPrimeAtEnemy('sentinel-ten', 2)).toBe('defeated')
    expect(store.getState().mission.defeatedSentinelIds).toEqual(SKYLINE_SENTINEL_IDS)
  })

  it('restores every enemy factor and health when the run resets', () => {
    const store = createSkylineRunnerStore()
    unlockPrimePowers(store)
    store.getState().castPrimeAtEnemy('sentinel-four', 2)
    store.getState().castPrimeAtEnemy('sentinel-six', 3)
    store.getState().damageEnemy('sentinel-ten', 100)

    store.getState().reset()

    expect(store.getState().enemyFactors).toEqual({
      'sentinel-four': [2, 2],
      'sentinel-six': [2, 3],
      'sentinel-nine': [3, 3],
      'sentinel-ten': [2, 5],
    })
    SKYLINE_SENTINEL_IDS.forEach((id) => {
      expect(store.getState().enemyHealth[id]).toBe(100)
    })
    expect(store.getState().mission.defeatedSentinelIds).toEqual([])
    expect(store.getState().mission.coresDeliveredToNilo).toBe(false)
  })
})
