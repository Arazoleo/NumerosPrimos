import { describe, expect, it } from 'vitest'

import {
  SKYLINE_PRIME_CORE_VALUES,
  SKYLINE_SENTINEL_IDS,
  type SkylinePrimeCoreValue,
} from './missionData'
import {
  activateApexBeacon,
  canActivateApexBeacon,
  canDeliverPrimeCores,
  canReachApexSpire,
  collectPrimeCore,
  deliverPrimeCores,
  getNextSkylineObjective,
  hasAllPrimeCores,
  hasDefeatedAllSentinels,
  INITIAL_SKYLINE_MISSION_PROGRESS,
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

describe('Prime Runner mission logic', () => {
  it('reports every objective in campaign order through victory', () => {
    let progress = INITIAL_SKYLINE_MISSION_PROGRESS
    expect(getNextSkylineObjective(progress).id).toBe('talk-to-lia')

    progress = recordNpcConversation(progress, 'lia')
    expect(getNextSkylineObjective(progress).id).toBe('collect-prime-cores')

    progress = collectPrimeCore(progress, 5)
    progress = collectPrimeCore(progress, 2)
    progress = collectPrimeCore(progress, 3)
    expect(getNextSkylineObjective(progress).id).toBe('deliver-cores-to-nilo')

    progress = recordNpcConversation(progress, 'nilo')
    progress = deliverPrimeCores(progress)
    expect(getNextSkylineObjective(progress).id).toBe(
      'defeat-composite-sentinels',
    )

    progress = defeatAllSentinels(progress)
    expect(getNextSkylineObjective(progress).id).toBe('reach-apex-spire')

    progress = reachApexSpire(progress)
    expect(getNextSkylineObjective(progress).id).toBe('activate-apex-beacon')

    progress = activateApexBeacon(progress)
    expect(getNextSkylineObjective(progress).id).toBe('mission-complete')
    expect(isSkylineMissionComplete(progress)).toBe(true)
  })

  it('blocks collection and NILO until LIA starts the protocol', () => {
    const initial = INITIAL_SKYLINE_MISSION_PROGRESS
    expect(collectPrimeCore(initial, 2)).toBe(initial)
    expect(recordNpcConversation(initial, 'nilo')).toBe(initial)
    expect(recordNpcConversation(initial, 'unknown')).toBe(initial)

    const started = recordNpcConversation(initial, 'lia')
    expect(started).not.toBe(initial)
    expect(started.spokenNpcIds).toEqual(['lia'])
    expect(initial.spokenNpcIds).toEqual([])
  })

  it('collects only 2, 3 and 5 once without mutating prior state', () => {
    const started = recordNpcConversation(
      INITIAL_SKYLINE_MISSION_PROGRESS,
      'lia',
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

  it('requires the complete set and a conversation before delivery', () => {
    const started = recordNpcConversation(
      INITIAL_SKYLINE_MISSION_PROGRESS,
      'lia',
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
    expect(deliverPrimeCores(delivered)).toBe(delivered)
  })

  it('counts each known sentinel once and only after delivery', () => {
    const blocked = recordSentinelDefeat(
      INITIAL_SKYLINE_MISSION_PROGRESS,
      'sentinel-four',
    )
    expect(blocked).toBe(INITIAL_SKYLINE_MISSION_PROGRESS)

    let ready = recordNpcConversation(
      INITIAL_SKYLINE_MISSION_PROGRESS,
      'lia',
    )
    ready = collectAllCores(ready)
    ready = recordNpcConversation(ready, 'nilo')
    ready = deliverPrimeCores(ready)

    const firstKill = recordSentinelDefeat(ready, 'sentinel-four')
    expect(firstKill.defeatedSentinelIds).toEqual(['sentinel-four'])
    expect(recordSentinelDefeat(firstKill, 'sentinel-four')).toBe(firstKill)
    expect(recordSentinelDefeat(firstKill, 'missing-sentinel')).toBe(firstKill)

    const cleared = defeatAllSentinels(ready)
    expect(hasDefeatedAllSentinels(cleared)).toBe(true)
    expect(cleared.defeatedSentinelIds).toHaveLength(4)
  })

  it('gates the Apex and beacon and treats repeated triggers idempotently', () => {
    const initial = INITIAL_SKYLINE_MISSION_PROGRESS
    expect(canReachApexSpire(initial)).toBe(false)
    expect(reachApexSpire(initial)).toBe(initial)
    expect(canActivateApexBeacon(initial)).toBe(false)
    expect(activateApexBeacon(initial)).toBe(initial)
    expect(isSkylineMissionComplete(initial)).toBe(false)

    let ready = recordNpcConversation(initial, 'lia')
    ready = collectAllCores(ready)
    ready = recordNpcConversation(ready, 'nilo')
    ready = deliverPrimeCores(ready)
    ready = defeatAllSentinels(ready)
    expect(canReachApexSpire(ready)).toBe(true)

    const atApex = reachApexSpire(ready)
    expect(reachApexSpire(atApex)).toBe(atApex)
    expect(canActivateApexBeacon(atApex)).toBe(true)

    const complete = activateApexBeacon(atApex)
    expect(activateApexBeacon(complete)).toBe(complete)
    expect(isSkylineMissionComplete(complete)).toBe(true)
  })
})
