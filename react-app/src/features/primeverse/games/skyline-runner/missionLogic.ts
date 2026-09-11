import {
  SKYLINE_NPCS,
  SKYLINE_OBJECTIVES,
  SKYLINE_PRIME_CORE_VALUES,
  SKYLINE_SENTINEL_IDS,
  SKYLINE_SENTINELS,
  type SkylineNpcId,
  type SkylineObjective,
  type SkylinePrimeCoreValue,
  type SkylineSentinelId,
} from './missionData'

export interface SkylineMissionProgress {
  readonly spokenNpcIds: readonly SkylineNpcId[]
  readonly collectedPrimeCores: readonly SkylinePrimeCoreValue[]
  readonly coresDeliveredToNilo: boolean
  readonly defeatedSentinelIds: readonly SkylineSentinelId[]
  readonly apexReached: boolean
  readonly beaconActivated: boolean
}

export const INITIAL_SKYLINE_MISSION_PROGRESS: SkylineMissionProgress = {
  spokenNpcIds: [],
  collectedPrimeCores: [],
  coresDeliveredToNilo: false,
  defeatedSentinelIds: [],
  apexReached: false,
  beaconActivated: false,
}

function includesAll<T>(values: readonly T[], required: readonly T[]): boolean {
  return required.every((value) => values.includes(value))
}

function isKnownNpcId(npcId: string): npcId is SkylineNpcId {
  return Object.prototype.hasOwnProperty.call(SKYLINE_NPCS, npcId)
}

function isPrimeCoreValue(value: number): value is SkylinePrimeCoreValue {
  return SKYLINE_PRIME_CORE_VALUES.some((candidate) => candidate === value)
}

function isKnownSentinelId(
  sentinelId: string,
): sentinelId is SkylineSentinelId {
  return Object.prototype.hasOwnProperty.call(SKYLINE_SENTINELS, sentinelId)
}

export function hasAllPrimeCores(progress: SkylineMissionProgress): boolean {
  return includesAll(
    progress.collectedPrimeCores,
    SKYLINE_PRIME_CORE_VALUES,
  )
}

export function hasDefeatedAllSentinels(
  progress: SkylineMissionProgress,
): boolean {
  return includesAll(
    progress.defeatedSentinelIds,
    SKYLINE_SENTINEL_IDS,
  )
}

/** Records a conversation once and preserves strict campaign order. */
export function recordNpcConversation(
  progress: SkylineMissionProgress,
  npcId: SkylineNpcId | string,
): SkylineMissionProgress {
  if (!isKnownNpcId(npcId) || progress.spokenNpcIds.includes(npcId)) {
    return progress
  }

  const canSpeak = npcId === 'lia' || (
    progress.spokenNpcIds.includes('lia') && hasAllPrimeCores(progress)
  )
  if (!canSpeak) return progress

  return {
    ...progress,
    spokenNpcIds: [...progress.spokenNpcIds, npcId],
  }
}

/** Collects each prime core at most once, after LIA has opened the mission. */
export function collectPrimeCore(
  progress: SkylineMissionProgress,
  value: SkylinePrimeCoreValue | number,
): SkylineMissionProgress {
  if (
    !isPrimeCoreValue(value)
    || !progress.spokenNpcIds.includes('lia')
    || progress.coresDeliveredToNilo
    || progress.collectedPrimeCores.includes(value)
  ) return progress

  return {
    ...progress,
    collectedPrimeCores: [...progress.collectedPrimeCores, value],
  }
}

export function canDeliverPrimeCores(
  progress: SkylineMissionProgress,
): boolean {
  return !progress.coresDeliveredToNilo
    && progress.spokenNpcIds.includes('nilo')
    && hasAllPrimeCores(progress)
}

/** Hands the complete 2/3/5 set to NILO; partial deliveries are ignored. */
export function deliverPrimeCores(
  progress: SkylineMissionProgress,
): SkylineMissionProgress {
  if (!canDeliverPrimeCores(progress)) return progress
  return { ...progress, coresDeliveredToNilo: true }
}

export function recordSentinelDefeat(
  progress: SkylineMissionProgress,
  sentinelId: SkylineSentinelId | string,
): SkylineMissionProgress {
  if (
    !isKnownSentinelId(sentinelId)
    || !progress.coresDeliveredToNilo
    || progress.defeatedSentinelIds.includes(sentinelId)
  ) return progress

  return {
    ...progress,
    defeatedSentinelIds: [...progress.defeatedSentinelIds, sentinelId],
  }
}

export function canReachApexSpire(
  progress: SkylineMissionProgress,
): boolean {
  return progress.coresDeliveredToNilo
    && hasDefeatedAllSentinels(progress)
}

export function reachApexSpire(
  progress: SkylineMissionProgress,
): SkylineMissionProgress {
  if (progress.apexReached || !canReachApexSpire(progress)) return progress
  return { ...progress, apexReached: true }
}

export function canActivateApexBeacon(
  progress: SkylineMissionProgress,
): boolean {
  return progress.apexReached
    && hasAllPrimeCores(progress)
    && hasDefeatedAllSentinels(progress)
}

/** Activating the Apex beacon also completes the extraction. */
export function activateApexBeacon(
  progress: SkylineMissionProgress,
): SkylineMissionProgress {
  if (
    progress.beaconActivated
    || !canActivateApexBeacon(progress)
  ) return progress

  return { ...progress, beaconActivated: true }
}

export function isSkylineMissionComplete(
  progress: SkylineMissionProgress,
): boolean {
  return progress.beaconActivated
    && canActivateApexBeacon(progress)
}

/** Returns the first unfinished stage, or the terminal victory objective. */
export function getNextSkylineObjective(
  progress: SkylineMissionProgress,
): SkylineObjective {
  if (!progress.spokenNpcIds.includes('lia')) {
    return SKYLINE_OBJECTIVES['talk-to-lia']
  }
  if (!hasAllPrimeCores(progress)) {
    return SKYLINE_OBJECTIVES['collect-prime-cores']
  }
  if (!progress.coresDeliveredToNilo) {
    return SKYLINE_OBJECTIVES['deliver-cores-to-nilo']
  }
  if (!hasDefeatedAllSentinels(progress)) {
    return SKYLINE_OBJECTIVES['defeat-composite-sentinels']
  }
  if (!progress.apexReached) {
    return SKYLINE_OBJECTIVES['reach-apex-spire']
  }
  if (!progress.beaconActivated) {
    return SKYLINE_OBJECTIVES['activate-apex-beacon']
  }
  return SKYLINE_OBJECTIVES['mission-complete']
}
