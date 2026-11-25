import {
  SKYLINE_MISSION_IDS,
  SKYLINE_MISSIONS,
  SKYLINE_NPCS,
  SKYLINE_OBJECTIVES,
  SKYLINE_PRIME_CORE_VALUES,
  SKYLINE_SENTINEL_IDS,
  SKYLINE_SENTINELS,
  type SkylineMissionId,
  type SkylineMissionStatus,
  type SkylineNpcId,
  type SkylineObjective,
  type SkylineObjectiveId,
  type SkylinePrimeCoreValue,
  type SkylineSentinelId,
} from './missionData'

export type SkylineMissionStatusMap = Readonly<
  Record<SkylineMissionId, SkylineMissionStatus>
>

export interface SkylineMissionProgress {
  /** Per-mission activation state for the open-world contract registry. */
  readonly missionStatuses: SkylineMissionStatusMap
  readonly spokenNpcIds: readonly SkylineNpcId[]
  readonly collectedPrimeCores: readonly SkylinePrimeCoreValue[]
  readonly coresDeliveredToNilo: boolean
  readonly defeatedSentinelIds: readonly SkylineSentinelId[]
  readonly apexReached: boolean
  readonly beaconActivated: boolean
}

/**
 * Seeds every contract from the registry: the LIA tutorial auto-activates,
 * every other mission starts `available` and must be activated by the player.
 */
const INITIAL_MISSION_STATUSES: SkylineMissionStatusMap =
  SKYLINE_MISSION_IDS.reduce((statuses, missionId) => {
    statuses[missionId] = SKYLINE_MISSIONS[missionId].autoActivate
      ? 'active'
      : 'available'
    return statuses
  }, {} as Record<SkylineMissionId, SkylineMissionStatus>)

export const INITIAL_SKYLINE_MISSION_PROGRESS: SkylineMissionProgress = {
  missionStatuses: INITIAL_MISSION_STATUSES,
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

function isKnownMissionId(missionId: string): missionId is SkylineMissionId {
  return Object.prototype.hasOwnProperty.call(SKYLINE_MISSIONS, missionId)
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

export function getMissionStatus(
  progress: SkylineMissionProgress,
  missionId: SkylineMissionId | string,
): SkylineMissionStatus | undefined {
  if (!isKnownMissionId(missionId)) return undefined
  return progress.missionStatuses[missionId]
}

export function isMissionAvailable(
  progress: SkylineMissionProgress,
  missionId: SkylineMissionId | string,
): boolean {
  return getMissionStatus(progress, missionId) === 'available'
}

export function isMissionActive(
  progress: SkylineMissionProgress,
  missionId: SkylineMissionId | string,
): boolean {
  return getMissionStatus(progress, missionId) === 'active'
}

export function isMissionCompleted(
  progress: SkylineMissionProgress,
  missionId: SkylineMissionId | string,
): boolean {
  return getMissionStatus(progress, missionId) === 'completed'
}

function withMissionStatus(
  progress: SkylineMissionProgress,
  missionId: SkylineMissionId,
  status: SkylineMissionStatus,
): SkylineMissionProgress {
  if (progress.missionStatuses[missionId] === status) return progress
  return {
    ...progress,
    missionStatuses: { ...progress.missionStatuses, [missionId]: status },
  }
}

/**
 * Picks up an `available` contract and sets it `active`. Unknown ids and
 * missions that are already active or completed are no-ops (same reference).
 */
export function activateMission(
  progress: SkylineMissionProgress,
  missionId: SkylineMissionId | string,
): SkylineMissionProgress {
  if (!isKnownMissionId(missionId)) return progress
  if (progress.missionStatuses[missionId] !== 'available') return progress
  return withMissionStatus(progress, missionId, 'active')
}

/** True once every objective of the given contract is satisfied. */
function areMissionObjectivesDone(
  progress: SkylineMissionProgress,
  missionId: SkylineMissionId,
): boolean {
  return SKYLINE_MISSIONS[missionId].objectiveIds.every((objectiveId) =>
    isObjectiveSatisfied(progress, objectiveId),
  )
}

function isObjectiveSatisfied(
  progress: SkylineMissionProgress,
  objectiveId: SkylineObjectiveId,
): boolean {
  switch (objectiveId) {
    case 'talk-to-lia':
      return progress.spokenNpcIds.includes('lia')
    case 'collect-prime-cores':
      return hasAllPrimeCores(progress)
    case 'deliver-cores-to-nilo':
      return progress.coresDeliveredToNilo
    case 'defeat-composite-sentinels':
      return hasDefeatedAllSentinels(progress)
    case 'reach-apex-spire':
      return progress.apexReached
    case 'activate-apex-beacon':
      return progress.beaconActivated
    case 'mission-complete':
      return true
    default:
      return false
  }
}

/**
 * Marks any `active` contract whose objectives are all satisfied as
 * `completed`. Returns the same reference when nothing transitions.
 */
export function completeMissionsIfDone(
  progress: SkylineMissionProgress,
): SkylineMissionProgress {
  let next = progress
  for (const missionId of SKYLINE_MISSION_IDS) {
    if (
      next.missionStatuses[missionId] === 'active'
      && areMissionObjectivesDone(next, missionId)
    ) {
      next = withMissionStatus(next, missionId, 'completed')
    }
  }
  return next
}

/**
 * Records a conversation once. LIA belongs to the auto-active tutorial, so she
 * can always be approached; NILO only responds once the prime-cores contract
 * is active and the full set has been collected. Completes any finished
 * contract afterwards.
 */
export function recordNpcConversation(
  progress: SkylineMissionProgress,
  npcId: SkylineNpcId | string,
): SkylineMissionProgress {
  if (!isKnownNpcId(npcId) || progress.spokenNpcIds.includes(npcId)) {
    return progress
  }

  const canSpeak = npcId === 'lia'
    ? isMissionActive(progress, 'lia-tutorial')
      || isMissionCompleted(progress, 'lia-tutorial')
    : isMissionActive(progress, 'prime-cores') && hasAllPrimeCores(progress)
  if (!canSpeak) return progress

  const spoken: SkylineMissionProgress = {
    ...progress,
    spokenNpcIds: [...progress.spokenNpcIds, npcId],
  }
  return completeMissionsIfDone(spoken)
}

/** Collects each prime core at most once while the cores contract is active. */
export function collectPrimeCore(
  progress: SkylineMissionProgress,
  value: SkylinePrimeCoreValue | number,
): SkylineMissionProgress {
  if (
    !isPrimeCoreValue(value)
    || !isMissionActive(progress, 'prime-cores')
    || progress.coresDeliveredToNilo
    || progress.collectedPrimeCores.includes(value)
  ) return progress

  const collected: SkylineMissionProgress = {
    ...progress,
    collectedPrimeCores: [...progress.collectedPrimeCores, value],
  }
  return completeMissionsIfDone(collected)
}

export function canDeliverPrimeCores(
  progress: SkylineMissionProgress,
): boolean {
  return !progress.coresDeliveredToNilo
    && isMissionActive(progress, 'prime-cores')
    && progress.spokenNpcIds.includes('nilo')
    && hasAllPrimeCores(progress)
}

/** Hands the complete 2/3/5 set to NILO; partial deliveries are ignored. */
export function deliverPrimeCores(
  progress: SkylineMissionProgress,
): SkylineMissionProgress {
  if (!canDeliverPrimeCores(progress)) return progress
  return completeMissionsIfDone({ ...progress, coresDeliveredToNilo: true })
}

export function recordSentinelDefeat(
  progress: SkylineMissionProgress,
  sentinelId: SkylineSentinelId | string,
): SkylineMissionProgress {
  if (
    !isKnownSentinelId(sentinelId)
    || !isMissionActive(progress, 'composite-sentinels')
    || progress.defeatedSentinelIds.includes(sentinelId)
  ) return progress

  const defeated: SkylineMissionProgress = {
    ...progress,
    defeatedSentinelIds: [...progress.defeatedSentinelIds, sentinelId],
  }
  return completeMissionsIfDone(defeated)
}

export function canReachApexSpire(
  progress: SkylineMissionProgress,
): boolean {
  return isMissionActive(progress, 'apex-extraction')
}

export function reachApexSpire(
  progress: SkylineMissionProgress,
): SkylineMissionProgress {
  if (progress.apexReached || !canReachApexSpire(progress)) return progress
  return completeMissionsIfDone({ ...progress, apexReached: true })
}

export function canActivateApexBeacon(
  progress: SkylineMissionProgress,
): boolean {
  return isMissionActive(progress, 'apex-extraction')
    && progress.apexReached
}

/** Activating the Apex beacon also completes the extraction contract. */
export function activateApexBeacon(
  progress: SkylineMissionProgress,
): SkylineMissionProgress {
  if (
    progress.beaconActivated
    || !canActivateApexBeacon(progress)
  ) return progress

  return completeMissionsIfDone({ ...progress, beaconActivated: true })
}

/** True once every contract in the registry has been completed. */
export function areAllMissionsComplete(
  progress: SkylineMissionProgress,
): boolean {
  return SKYLINE_MISSION_IDS.every(
    (missionId) => progress.missionStatuses[missionId] === 'completed',
  )
}

/**
 * True once every contract EXCEPT the Apex extraction is completed. The runtime
 * treats the Apex beacon as the finale: it must stay inert (and give the player
 * a "finish the others first" hint) until the cores, sentinels and tutorial
 * contracts are done, so lighting it always produces the victory end-state.
 */
export function areApexPrerequisitesComplete(
  progress: SkylineMissionProgress,
): boolean {
  return SKYLINE_MISSION_IDS.every(
    (missionId) =>
      missionId === 'apex-extraction'
      || progress.missionStatuses[missionId] === 'completed',
  )
}

export function isSkylineMissionComplete(
  progress: SkylineMissionProgress,
): boolean {
  return areAllMissionsComplete(progress)
}

/**
 * Returns a sensible current objective for the HUD in the open-world model.
 *
 * Rule: walk SKYLINE_MISSION_IDS and return the first objective that
 * belongs to an ACTIVE contract and is not yet satisfied. When no active
 * contract has pending work, return 'mission-complete' if every contract is
 * done, otherwise fall back to the first objective of an available contract
 * (what the player should go activate next). Deterministic regardless of the
 * order contracts were taken.
 */
export function getNextSkylineObjective(
  progress: SkylineMissionProgress,
): SkylineObjective {
  for (const missionId of SKYLINE_MISSION_IDS) {
    if (progress.missionStatuses[missionId] !== 'active') continue
    for (const objectiveId of SKYLINE_MISSIONS[missionId].objectiveIds) {
      if (!isObjectiveSatisfied(progress, objectiveId)) {
        return SKYLINE_OBJECTIVES[objectiveId]
      }
    }
  }

  if (areAllMissionsComplete(progress)) {
    return SKYLINE_OBJECTIVES['mission-complete']
  }

  for (const missionId of SKYLINE_MISSION_IDS) {
    if (progress.missionStatuses[missionId] === 'available') {
      return SKYLINE_OBJECTIVES[SKYLINE_MISSIONS[missionId].objectiveIds[0]]
    }
  }

  return SKYLINE_OBJECTIVES['mission-complete']
}
