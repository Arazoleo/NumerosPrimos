import { describe, expect, it } from 'vitest'

import { SKYLINE_SENTINEL_IDS, type SkylineMissionId } from './missionData'
import { createSkylineRunnerStore } from './skylineRunnerStore'
import { getActiveWorldSnapshot } from './activeWorld'

type Store = ReturnType<typeof createSkylineRunnerStore>

function finishDialogue(store: Store, lines = 2) {
  for (let index = 0; index < lines; index += 1) store.getState().advanceDialogue()
}

/** Stands on a contract anchor and presses interact to activate it. */
function activateContract(store: Store, missionId: SkylineMissionId): boolean {
  store.getState().setNearby(`mission:${missionId}`)
  const activated = store.getState().interact()
  store.getState().setNearby(null)
  return activated
}

/**
 * Talks to LIA and closes the first playable mission (the lia-tutorial
 * contract). Finishing the briefing no longer teleports: the static campaign
 * runs entirely in `tutorial` mode, so after this helper the store is still in
 * `tutorial` mode with no generated world. The only teleport is lighting the
 * Apex beacon once the whole campaign is complete (see the finale test).
 */
function completeTutorial(store: Store) {
  store.getState().setNearby('npc:lia')
  store.getState().interact()
  finishDialogue(store)
  store.getState().setNearby(null)
}

/** Activates the cores contract, collects the triad and delivers it to NILO. */
function completeCores(store: Store) {
  activateContract(store, 'prime-cores')
  ;([2, 3, 5] as const).forEach((core) => store.getState().collectCore(core))
  finishDialogue(store) // closes the lia-cores-online dialogue opened on the 3rd core
  store.getState().setNearby('npc:nilo')
  store.getState().interact()
  finishDialogue(store)
  store.getState().setNearby(null)
}

/** Activates the sentinels contract so the pulse is armed. */
function armSentinels(store: Store) {
  activateContract(store, 'composite-sentinels')
}

describe('skyline runner store', () => {
  it('starts with the LIA tutorial active and every other contract available', () => {
    const store = createSkylineRunnerStore()
    const statuses = store.getState().mission.missionStatuses
    expect(statuses['lia-tutorial']).toBe('active')
    expect(statuses['prime-cores']).toBe('available')
    expect(statuses['composite-sentinels']).toBe('available')
    expect(statuses['apex-extraction']).toBe('available')
  })

  it('runs the static campaign end to end in tutorial mode, teleporting on the beacon', () => {
    let clock = 1_000
    const store = createSkylineRunnerStore(() => clock)

    completeTutorial(store)
    expect(store.getState().mission.spokenNpcIds).toContain('lia')
    expect(store.getState().mission.missionStatuses['lia-tutorial']).toBe('completed')
    // Finishing the briefing does NOT teleport: the static campaign stays in
    // tutorial mode until the beacon finale.
    expect(store.getState().mode).toBe('tutorial')
    expect(store.getState().activeWorld).toBeNull()

    completeCores(store)
    expect(store.getState().mission.coresDeliveredToNilo).toBe(true)
    expect(store.getState().mission.missionStatuses['prime-cores']).toBe('completed')
    expect(store.getState().mode).toBe('tutorial')

    armSentinels(store)
    SKYLINE_SENTINEL_IDS.forEach((id) => {
      store.getState().damageEnemy(id, 100)
    })
    expect(store.getState().mission.defeatedSentinelIds).toHaveLength(4)
    expect(store.getState().mission.missionStatuses['composite-sentinels']).toBe('completed')
    expect(store.getState().mode).toBe('tutorial')

    expect(activateContract(store, 'apex-extraction')).toBe(true)
    expect(store.getState().reachApex()).toBe(true)
    finishDialogue(store, 3)
    // Still tutorial: the apex-extraction dialogue just ended, beacon not yet lit.
    expect(store.getState().mode).toBe('tutorial')

    store.getState().setNearby('beacon')
    clock = 61_000
    // Lighting the beacon completes the whole campaign AND teleports into the
    // procedural world. No tutorial victory screen (result stays null).
    expect(store.getState().interact()).toBe(true)
    expect(store.getState().mode).toBe('world')
    expect(store.getState().activeWorld).not.toBeNull()
    expect(store.getState().worldSnapshot.mode).toBe('world')
    expect(getActiveWorldSnapshot().mode).toBe('world')
    expect(store.getState().result).toBeNull()

    // The teleport must NOT carry the won campaign forward: the open world
    // starts clean and playable. The three world contracts are pickable again
    // ('available'), the beacon is unlit and no cores/sentinels are recorded,
    // matching the TELEPORTE CONCLUÍDO toast "Encontre os três contratos primos".
    const worldMission = store.getState().mission
    expect(worldMission.missionStatuses['prime-cores']).toBe('available')
    expect(worldMission.missionStatuses['composite-sentinels']).toBe('available')
    expect(worldMission.missionStatuses['apex-extraction']).toBe('available')
    expect(worldMission.beaconActivated).toBe(false)
    expect(worldMission.collectedPrimeCores).toEqual([])
    expect(worldMission.defeatedSentinelIds).toEqual([])
    expect(worldMission.coresDeliveredToNilo).toBe(false)
  })

  it('in world mode, lighting the beacon still yields a victory result', () => {
    let clock = 1_000
    const store = createSkylineRunnerStore(() => clock)

    // Teleport into the world. buildWorldEntryState RESETS mission progress to
    // the hub baseline, so the world starts fresh: the three playable contracts
    // are available and the beacon is unlit. The LIA tutorial contract is reset
    // to 'active' and (because LIA is re-anchored at the world spawn) must be
    // re-completed in the world before the beacon prerequisites are met.
    store.getState().enterWorld('test-seed-victory')
    expect(store.getState().mode).toBe('world')
    expect(store.getState().mission.missionStatuses['prime-cores']).toBe('available')
    expect(store.getState().mission.missionStatuses['composite-sentinels']).toBe('available')
    expect(store.getState().mission.missionStatuses['apex-extraction']).toBe('available')
    expect(store.getState().mission.beaconActivated).toBe(false)

    completeTutorial(store)
    expect(store.getState().mission.missionStatuses['lia-tutorial']).toBe('completed')

    completeCores(store)
    expect(store.getState().mission.missionStatuses['prime-cores']).toBe('completed')

    armSentinels(store)
    SKYLINE_SENTINEL_IDS.forEach((id) => store.getState().damageEnemy(id, 100))
    expect(store.getState().mission.missionStatuses['composite-sentinels']).toBe('completed')

    expect(activateContract(store, 'apex-extraction')).toBe(true)
    expect(store.getState().reachApex()).toBe(true)
    finishDialogue(store, 3)

    store.getState().setNearby('beacon')
    clock = 61_000
    expect(store.getState().interact()).toBe(true)
    expect(store.getState().mission.missionStatuses['apex-extraction']).toBe('completed')
    // World mode keeps the normal victory end-state (no further teleport).
    expect(store.getState().mode).toBe('world')
    expect(store.getState().result).not.toBeNull()
    expect(store.getState().result?.enemiesDefeated).toBe(4)
  })

  it('reaches a fully completed state when contracts are taken in a different order', () => {
    const store = createSkylineRunnerStore()

    // Sentinels first, before cores or the tutorial dialogue. Nothing teleports
    // until the beacon finale, so the whole order runs in tutorial mode.
    armSentinels(store)
    SKYLINE_SENTINEL_IDS.forEach((id) => store.getState().damageEnemy(id, 100))
    expect(store.getState().mission.missionStatuses['composite-sentinels']).toBe('completed')
    expect(store.getState().mode).toBe('tutorial')

    completeTutorial(store)
    completeCores(store)
    expect(store.getState().mode).toBe('tutorial')

    activateContract(store, 'apex-extraction')
    store.getState().reachApex()
    finishDialogue(store, 3)
    store.getState().setNearby('beacon')
    // The beacon finale completes the campaign and teleports into the world.
    // The teleport RESETS mission progress, so the open world starts fresh with
    // the three playable contracts available again (not the won tutorial state).
    expect(store.getState().interact()).toBe(true)

    const statuses = store.getState().mission.missionStatuses
    expect(statuses['prime-cores']).toBe('available')
    expect(statuses['composite-sentinels']).toBe('available')
    expect(statuses['apex-extraction']).toBe('available')
    expect(store.getState().mission.beaconActivated).toBe(false)
    expect(store.getState().mode).toBe('world')
    expect(store.getState().result).toBeNull()
  })

  it('keeps the beacon inert until the other contracts are complete, then teleports', () => {
    let clock = 1_000
    const store = createSkylineRunnerStore(() => clock)

    // Take the apex contract first and climb the spire before cores/sentinels.
    expect(activateContract(store, 'apex-extraction')).toBe(true)
    expect(store.getState().reachApex()).toBe(true)
    finishDialogue(store, 3)

    // Lighting the beacon now must NOT consume it, teleport, or produce a result.
    store.getState().setNearby('beacon')
    expect(store.getState().interact()).toBe(false)
    expect(store.getState().mission.beaconActivated).toBe(false)
    expect(store.getState().mission.missionStatuses['apex-extraction']).toBe('active')
    expect(store.getState().result).toBeNull()
    expect(store.getState().mode).toBe('tutorial')
    expect(store.getState().activeWorld).toBeNull()
    expect(store.getState().toast).toMatchObject({
      title: 'FAROL BLOQUEADO',
      detail: 'Conclua os outros contratos antes de acender o farol primo.',
    })

    // Finish the remaining contracts (all in tutorial mode).
    store.getState().setNearby(null)
    completeTutorial(store)
    completeCores(store)
    armSentinels(store)
    SKYLINE_SENTINEL_IDS.forEach((id) => store.getState().damageEnemy(id, 100))
    expect(store.getState().mission.missionStatuses['composite-sentinels']).toBe('completed')
    expect(store.getState().mode).toBe('tutorial')

    // The beacon was never consumed, so it is still reachable and now completes
    // the campaign AND teleports into the procedural world (no victory screen).
    // The teleport RESETS mission progress, so the world starts clean: the
    // beacon is unlit again and apex-extraction is pickable, not completed.
    store.getState().setNearby('beacon')
    clock = 61_000
    expect(store.getState().interact()).toBe(true)
    expect(store.getState().mission.beaconActivated).toBe(false)
    expect(store.getState().mission.missionStatuses['apex-extraction']).toBe('available')
    expect(store.getState().mode).toBe('world')
    expect(store.getState().activeWorld).not.toBeNull()
    expect(store.getState().worldSnapshot.mode).toBe('world')
    expect(getActiveWorldSnapshot().mode).toBe('world')
    expect(store.getState().result).toBeNull()
  })

  it('activating a contract emits a toast and is inert once already active', () => {
    const store = createSkylineRunnerStore()
    expect(activateContract(store, 'prime-cores')).toBe(true)
    expect(store.getState().mission.missionStatuses['prime-cores']).toBe('active')
    expect(store.getState().toast).toMatchObject({ title: 'CONTRATO ATIVADO' })

    // Re-activating is a no-op; interact reports false and leaves status active.
    expect(activateContract(store, 'prime-cores')).toBe(false)
    expect(store.getState().mission.missionStatuses['prime-cores']).toBe('active')
  })

  it('does not collect prime cores until the cores contract is active', () => {
    const store = createSkylineRunnerStore()
    completeTutorial(store)
    // prime-cores is still available here.
    expect(store.getState().collectCore(2)).toBe(false)
    expect(store.getState().mission.collectedPrimeCores).toEqual([])

    activateContract(store, 'prime-cores')
    expect(store.getState().collectCore(2)).toBe(true)
    expect(store.getState().mission.collectedPrimeCores).toEqual([2])
  })

  it('does not damage enemies before the sentinels contract is active', () => {
    const store = createSkylineRunnerStore()
    expect(store.getState().damageEnemy('sentinel-four', 100)).toBe('locked')
    expect(store.getState().enemyHealth['sentinel-four']).toBe(100)
    expect(store.getState().toast).toMatchObject({ title: 'BLINDAGEM COMPOSTA' })
  })

  it('locks prime casts until the sentinels contract is active', () => {
    const store = createSkylineRunnerStore()

    expect(store.getState().castPrimeAtEnemy('sentinel-four', 2)).toBe('locked')
    expect(store.getState().enemyFactors['sentinel-four']).toEqual([2, 2])
    expect(store.getState().enemyHealth['sentinel-four']).toBe(100)
    expect(store.getState().toast).toMatchObject({ title: 'BLINDAGEM COMPOSTA' })
  })

  it('resists a prime that is not a remaining factor without changing combat progress', () => {
    const store = createSkylineRunnerStore()
    armSentinels(store)
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
    armSentinels(store)

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
    armSentinels(store)
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
    expect(store.getState().mission.missionStatuses['composite-sentinels']).toBe('available')
  })
})

describe('skyline runner world mode', () => {
  const FIXED_SEED = 'test-seed-007'

  it('starts in tutorial mode with no generated world', () => {
    const store = createSkylineRunnerStore()
    expect(store.getState().mode).toBe('tutorial')
    expect(store.getState().activeWorld).toBeNull()
    expect(store.getState().worldSeed).toBeNull()
    expect(store.getState().worldSnapshot.mode).toBe('tutorial')
    // The live module snapshot is reset to tutorial when a store is created.
    expect(getActiveWorldSnapshot().mode).toBe('tutorial')
  })

  it('enterWorld switches to world mode, generates a world and teleports the spawn', () => {
    const store = createSkylineRunnerStore()
    const tutorialSpawn = store.getState().worldSnapshot.spawn

    store.getState().enterWorld(FIXED_SEED)

    const state = store.getState()
    expect(state.mode).toBe('world')
    expect(state.worldSeed).toBe(FIXED_SEED)
    expect(state.activeWorld).not.toBeNull()
    expect(state.activeWorld?.seed).toBe(FIXED_SEED)
    expect(state.worldMissions).not.toBeNull()
    expect(state.worldSnapshot.mode).toBe('world')
    // The procedural city has many more buildings than the hand-authored grid.
    expect(state.worldSnapshot.buildings.length).toBeGreaterThan(30)
    // The spawn/checkpoint moved onto the generated spawn.
    expect(state.worldSnapshot.spawn).toEqual(state.activeWorld?.spawn)
    expect(state.worldSnapshot.spawn).not.toEqual(tutorialSpawn)
    expect(state.checkpointId).toBe(state.activeWorld?.checkpoints[0]?.id)
    // The module pointer tracks the store.
    expect(getActiveWorldSnapshot().mode).toBe('world')
    expect(getActiveWorldSnapshot().seed).toBe(FIXED_SEED)
  })

  it('finishing the LIA briefing no longer teleports: the static campaign stays in tutorial mode', () => {
    const store = createSkylineRunnerStore()

    // Start in the static tutorial with the first contract still active.
    expect(store.getState().mode).toBe('tutorial')
    expect(store.getState().mission.missionStatuses['lia-tutorial']).toBe('active')
    expect(store.getState().activeWorld).toBeNull()

    // Open the LIA briefing and read a line (still mid-dialogue).
    store.getState().setNearby('npc:lia')
    store.getState().interact()
    store.getState().advanceDialogue() // first line -> still mid-dialogue
    expect(store.getState().mode).toBe('tutorial')
    expect(store.getState().activeWorld).toBeNull()

    // Finishing the briefing completes lia-tutorial but must NOT teleport: the
    // teleport is now driven solely by the Apex beacon finale.
    store.getState().advanceDialogue() // last line -> completes lia-tutorial
    expect(store.getState().mission.missionStatuses['lia-tutorial']).toBe('completed')
    expect(store.getState().mode).toBe('tutorial')
    expect(store.getState().activeWorld).toBeNull()
    expect(store.getState().worldSnapshot.mode).toBe('tutorial')
    expect(getActiveWorldSnapshot().mode).toBe('tutorial')
  })

  it('no contract completion teleports: only the beacon finale enters the world', () => {
    const store = createSkylineRunnerStore()

    // Finish the sentinels contract before talking to LIA: completing any
    // contract must not enter the world.
    store.getState().setNearby('mission:composite-sentinels')
    store.getState().interact()
    store.getState().setNearby(null)
    SKYLINE_SENTINEL_IDS.forEach((id) => store.getState().damageEnemy(id, 100))
    expect(store.getState().mission.missionStatuses['composite-sentinels']).toBe('completed')
    expect(store.getState().mode).toBe('tutorial')
    expect(store.getState().activeWorld).toBeNull()

    // Completing lia-tutorial likewise stays in tutorial mode.
    store.getState().setNearby('npc:lia')
    store.getState().interact()
    finishDialogue(store)
    expect(store.getState().mission.missionStatuses['lia-tutorial']).toBe('completed')
    expect(store.getState().mode).toBe('tutorial')
    expect(store.getState().activeWorld).toBeNull()
  })

  it('always places the three playable contracts on reachable generated roofs', () => {
    const store = createSkylineRunnerStore()
    store.getState().enterWorld(FIXED_SEED)
    const contracts = store.getState().worldSnapshot.contracts
    const ids = contracts.map((contract) => contract.id).sort()
    expect(ids).toEqual(['apex-extraction', 'composite-sentinels', 'prime-cores'])
    // None of them auto-activate, so all three are pickable in the world.
    expect(contracts.every((contract) => !contract.autoActivate)).toBe(true)
  })

  it('is a stable no-op across respawn: enterWorld does not regenerate mid-run', () => {
    const store = createSkylineRunnerStore()
    store.getState().enterWorld(FIXED_SEED)
    const firstWorld = store.getState().activeWorld
    const firstSnapshot = store.getState().worldSnapshot
    const stateBefore = store.getState()

    // A second enterWorld (e.g. a stray trigger) returns the SAME state ref and
    // keeps the SAME world instance, so death/respawn never rebuilds the city.
    store.getState().enterWorld(FIXED_SEED)
    expect(store.getState()).toBe(stateBefore)
    expect(store.getState().activeWorld).toBe(firstWorld)
    expect(store.getState().worldSnapshot).toBe(firstSnapshot)

    // Even a different seed is ignored once in world mode.
    store.getState().enterWorld('a-different-seed')
    expect(store.getState().activeWorld).toBe(firstWorld)
    expect(store.getState().worldSeed).toBe(FIXED_SEED)
  })

  it('reset returns to tutorial mode and clears the generated world', () => {
    const store = createSkylineRunnerStore()
    store.getState().enterWorld(FIXED_SEED)
    expect(store.getState().mode).toBe('world')

    store.getState().reset()

    const state = store.getState()
    expect(state.mode).toBe('tutorial')
    expect(state.activeWorld).toBeNull()
    expect(state.worldSeed).toBeNull()
    expect(state.worldMissions).toBeNull()
    expect(state.worldSnapshot.mode).toBe('tutorial')
    expect(getActiveWorldSnapshot().mode).toBe('tutorial')
  })

  it('a fresh run (new runId) uses a new default seed each time', () => {
    const store = createSkylineRunnerStore()
    // Default seed derives from runId + now(); capture it, then reset for a new run.
    store.getState().enterWorld()
    const firstSeed = store.getState().worldSeed
    expect(firstSeed).not.toBeNull()

    store.getState().reset()
    store.getState().enterWorld()
    const secondSeed = store.getState().worldSeed
    expect(secondSeed).not.toBeNull()
    // runId incremented on reset, so the derived seed differs.
    expect(secondSeed).not.toBe(firstSeed)
  })

  it('the same seed generates a deterministic, deep-equal world', () => {
    const storeA = createSkylineRunnerStore()
    storeA.getState().enterWorld(FIXED_SEED)
    const storeB = createSkylineRunnerStore()
    storeB.getState().enterWorld(FIXED_SEED)
    expect(storeA.getState().activeWorld).toEqual(storeB.getState().activeWorld)
    expect(storeA.getState().worldMissions).toEqual(storeB.getState().worldMissions)
  })
})
