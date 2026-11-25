import { describe, expect, it } from 'vitest'

import {
  SKYLINE_PRIME_CORE_VALUES,
  SKYLINE_SENTINEL_IDS,
  type SkylinePrimeCoreValue,
} from './missionData'
import {
  activateApexBeacon,
  activateMission,
  areAllMissionsComplete,
  canActivateApexBeacon,
  canDeliverPrimeCores,
  canReachApexSpire,
  collectPrimeCore,
  deliverPrimeCores,
  getMissionStatus,
  getNextSkylineObjective,
  hasAllPrimeCores,
  hasDefeatedAllSentinels,
  INITIAL_SKYLINE_MISSION_PROGRESS,
  isMissionActive,
  isSkylineMissionComplete,
  reachApexSpire,
  recordNpcConversation,
  recordSentinelDefeat,
  type SkylineMissionProgress,
} from './missionLogic'

function collectAllCores(
  progress: SkylineMissionProgress,
): SkylineMissionProgress {
  return SKYLINE_PRIME_CORE_VALUES.reduce(
    (current, value) => collectPrimeCore(current, value),
    progress,
  )
}

function defeatAllSentinels(
  progress: SkylineMissionProgress,
): SkylineMissionProgress {
  return SKYLINE_SENTINEL_IDS.reduce(
    (current, sentinelId) => recordSentinelDefeat(current, sentinelId),
    progress,
  )
}

/** Fully plays out the prime-cores contract (activate -> collect -> deliver). */
function completePrimeCores(
  progress: SkylineMissionProgress,
): SkylineMissionProgress {
  let next = activateMission(progress, 'prime-cores')
  next = collectAllCores(next)
  next = recordNpcConversation(next, 'nilo')
  return deliverPrimeCores(next)
}

function completeSentinels(
  progress: SkylineMissionProgress,
): SkylineMissionProgress {
  return defeatAllSentinels(activateMission(progress, 'composite-sentinels'))
}

function completeApex(
  progress: SkylineMissionProgress,
): SkylineMissionProgress {
  let next = activateMission(progress, 'apex-extraction')
  next = reachApexSpire(next)
  return activateApexBeacon(next)
}

function completeTutorial(
  progress: SkylineMissionProgress,
): SkylineMissionProgress {
  return recordNpcConversation(progress, 'lia')
}

describe('Prime Runner mission activation model', () => {
  it('seeds the LIA tutorial active and every other contract available', () => {
    const initial = INITIAL_SKYLINE_MISSION_PROGRESS
    expect(getMissionStatus(initial, 'lia-tutorial')).toBe('active')
    expect(getMissionStatus(initial, 'prime-cores')).toBe('available')
    expect(getMissionStatus(initial, 'composite-sentinels')).toBe('available')
    expect(getMissionStatus(initial, 'apex-extraction')).toBe('available')
    expect(getNextSkylineObjective(initial).id).toBe('talk-to-lia')
  })

  it('transitions available->active only and is an idempotent no-op otherwise', () => {
    const initial = INITIAL_SKYLINE_MISSION_PROGRESS

    const activated = activateMission(initial, 'prime-cores')
    expect(activated).not.toBe(initial)
    expect(isMissionActive(activated, 'prime-cores')).toBe(true)

    expect(activateMission(activated, 'prime-cores')).toBe(activated)
    expect(activateMission(initial, 'lia-tutorial')).toBe(initial)
    expect(activateMission(initial, 'unknown-mission')).toBe(initial)
  })

  it('keeps objective functions inert until the owning contract is active', () => {
    const started = completeTutorial(INITIAL_SKYLINE_MISSION_PROGRESS)

    expect(collectPrimeCore(started, 2)).toBe(started)
    expect(recordNpcConversation(started, 'nilo')).toBe(started)
    expect(recordSentinelDefeat(started, 'sentinel-four')).toBe(started)
    expect(reachApexSpire(started)).toBe(started)
    expect(activateApexBeacon(started)).toBe(started)

    const coresActive = activateMission(started, 'prime-cores')
    expect(collectPrimeCore(coresActive, 2)).not.toBe(coresActive)
  })

  it('reaches a fully completed state regardless of contract order', () => {
    const start = completeTutorial(INITIAL_SKYLINE_MISSION_PROGRESS)

    // Ordering A: cores -> sentinels -> apex
    let orderA = completePrimeCores(start)
    orderA = completeSentinels(orderA)
    orderA = completeApex(orderA)

    // Ordering B: sentinels -> apex -> cores
    let orderB = completeSentinels(start)
    orderB = completeApex(orderB)
    orderB = completePrimeCores(orderB)

    for (const final of [orderA, orderB]) {
      expect(areAllMissionsComplete(final)).toBe(true)
      expect(isSkylineMissionComplete(final)).toBe(true)
      expect(getNextSkylineObjective(final).id).toBe('mission-complete')
      expect(getMissionStatus(final, 'lia-tutorial')).toBe('completed')
      expect(getMissionStatus(final, 'prime-cores')).toBe('completed')
      expect(getMissionStatus(final, 'composite-sentinels')).toBe('completed')
      expect(getMissionStatus(final, 'apex-extraction')).toBe('completed')
    }
  })

  it('completes the LIA tutorial as soon as the conversation is recorded', () => {
    const initial = INITIAL_SKYLINE_MISSION_PROGRESS
    const talked = completeTutorial(initial)
    expect(talked).not.toBe(initial)
    expect(getMissionStatus(talked, 'lia-tutorial')).toBe('completed')
    expect(talked.spokenNpcIds).toEqual(['lia'])
    expect(recordNpcConversation(talked, 'lia')).toBe(talked)
    expect(recordNpcConversation(initial, 'unknown')).toBe(initial)
  })

  it('collects only 2, 3 and 5 once without mutating prior state', () => {
    const started = activateMission(
      INITIAL_SKYLINE_MISSION_PROGRESS,
      'prime-cores',
    )
    const withTwo = collectPrimeCore(started, 2)
    expect(withTwo.collectedPrimeCores).toEqual([2])
    expect(started.collectedPrimeCores).toEqual([])
    expect(collectPrimeCore(withTwo, 2)).toBe(withTwo)
    expect(collectPrimeCore(withTwo, 7 as SkylinePrimeCoreValue)).toBe(withTwo)

    const complete = collectAllCores(started)
    expect(hasAllPrimeCores(complete)).toBe(true)
    expect(new Set(complete.collectedPrimeCores)).toEqual(new Set([2, 3, 5]))
  })

  it('requires the full set, an active contract and NILO before delivery', () => {
    const started = activateMission(
      INITIAL_SKYLINE_MISSION_PROGRESS,
      'prime-cores',
    )
    const partial = collectPrimeCore(started, 2)
    expect(recordNpcConversation(partial, 'nilo')).toBe(partial)
    expect(deliverPrimeCores(partial)).toBe(partial)

    const complete = collectAllCores(started)
    expect(canDeliverPrimeCores(complete)).toBe(false)
    const metNilo = recordNpcConversation(complete, 'nilo')
    expect(canDeliverPrimeCores(metNilo)).toBe(true)
    const delivered = deliverPrimeCores(metNilo)
    expect(delivered.coresDeliveredToNilo).toBe(true)
    expect(getMissionStatus(delivered, 'prime-cores')).toBe('completed')
    expect(deliverPrimeCores(delivered)).toBe(delivered)
  })

  it('counts each known sentinel once and only while the contract is active', () => {
    const initial = INITIAL_SKYLINE_MISSION_PROGRESS
    const blocked = recordSentinelDefeat(initial, 'sentinel-four')
    expect(blocked).toBe(initial)

    const ready = activateMission(initial, 'composite-sentinels')
    const firstKill = recordSentinelDefeat(ready, 'sentinel-four')
    expect(firstKill.defeatedSentinelIds).toEqual(['sentinel-four'])
    expect(recordSentinelDefeat(firstKill, 'sentinel-four')).toBe(firstKill)
    expect(recordSentinelDefeat(firstKill, 'missing-sentinel')).toBe(firstKill)

    const cleared = defeatAllSentinels(ready)
    expect(hasDefeatedAllSentinels(cleared)).toBe(true)
    expect(cleared.defeatedSentinelIds).toHaveLength(4)
    expect(getMissionStatus(cleared, 'composite-sentinels')).toBe('completed')
  })

  it('gates the Apex and beacon and treats repeated triggers idempotently', () => {
    const initial = INITIAL_SKYLINE_MISSION_PROGRESS
    expect(canReachApexSpire(initial)).toBe(false)
    expect(reachApexSpire(initial)).toBe(initial)
    expect(canActivateApexBeacon(initial)).toBe(false)
    expect(activateApexBeacon(initial)).toBe(initial)
    expect(isSkylineMissionComplete(initial)).toBe(false)

    const active = activateMission(initial, 'apex-extraction')
    expect(canReachApexSpire(active)).toBe(true)
    // Beacon still gated until the spire is reached.
    expect(canActivateApexBeacon(active)).toBe(false)
    expect(activateApexBeacon(active)).toBe(active)

    const atApex = reachApexSpire(active)
    expect(reachApexSpire(atApex)).toBe(atApex)
    expect(canActivateApexBeacon(atApex)).toBe(true)

    const done = activateApexBeacon(atApex)
    expect(done.beaconActivated).toBe(true)
    expect(getMissionStatus(done, 'apex-extraction')).toBe('completed')
    expect(activateApexBeacon(done)).toBe(done)
  })
})
