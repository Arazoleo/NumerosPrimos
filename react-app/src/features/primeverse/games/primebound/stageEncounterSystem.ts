import type { PrimeboundAreaId } from './world'

/** Reinforcements keep the arena populated; combat progress, never elapsed time, unlocks the guardian. */
export const PRIMEBOUND_STAGE_REINFORCEMENT_ACTIVE_THRESHOLD = 3
export const PRIMEBOUND_STAGE_REINFORCEMENT_BASE_DELAY_MS = 650
export const PRIMEBOUND_STAGE_REINFORCEMENT_JITTER_MS = 550
export const PRIMEBOUND_STAGE_CHECKPOINT_RESPAWNS = 2

export const PRIMEBOUND_STAGE_REINFORCEMENT_QUOTAS: Readonly<
  Record<PrimeboundAreaId, number>
> = Object.freeze({
  'echo-woods': 3,
  'composite-crypt': 4,
  'twin-peaks': 5,
  'residue-forge': 6,
  'eratosthenes-garden': 7,
  'goldbach-citadel': 8,
  'wilson-observatory': 9,
  'mobius-labyrinth': 10,
  'fermat-bastion': 11,
  'sieve-foundry': 12,
  'elliptic-nexus': 13,
  'prime-sanctuary': 15,
})

export type StageEncounterStatus =
  | 'engaged'
  | 'reinforcement-inbound'
  | 'guardian-ready'
  | 'complete'

export interface StageEncounterState {
  readonly areaId: PrimeboundAreaId
  readonly startedAtMs: number
  readonly reinforcementQuota: number
  readonly reinforcementsDeployed: number
  readonly nextReinforcementAtMs: number | null
  readonly minionsDefeated: number
  readonly checkpointRespawnsRemaining: number
  readonly completedAtMs: number | null
}

export interface StageEncounterSnapshot {
  readonly status: StageEncounterStatus
  readonly elapsedMs: number
  readonly progress: number
  readonly reinforcementQuota: number
  readonly reinforcementsDeployed: number
  readonly reinforcementsRemaining: number
  readonly nextReinforcementInMs: number
  readonly minionsDefeated: number
  readonly activeMinionCount: number
  readonly checkpointRespawnsRemaining: number
  readonly completed: boolean
}

function assertTime(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite, non-negative time.`)
  }
}

function assertCount(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer.`)
  }
}

function freezeState(state: StageEncounterState): StageEncounterState {
  return Object.freeze({ ...state })
}

function deterministicReinforcementJitter(
  areaId: PrimeboundAreaId,
  reinforcementIndex: number,
): number {
  let hash = 2_166_136_261
  for (let index = 0; index < areaId.length; index += 1) {
    hash ^= areaId.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  hash ^= Math.imul(reinforcementIndex + 1, -1_640_531_527)
  return (hash >>> 0) % (PRIMEBOUND_STAGE_REINFORCEMENT_JITTER_MS + 1)
}

export function getStageReinforcementDelayMs(
  state: StageEncounterState,
): number {
  return PRIMEBOUND_STAGE_REINFORCEMENT_BASE_DELAY_MS + deterministicReinforcementJitter(
    state.areaId,
    state.reinforcementsDeployed,
  )
}

export function startStageEncounter(
  areaId: PrimeboundAreaId,
  startedAtMs: number,
  completed = false,
): StageEncounterState {
  assertTime(startedAtMs, 'startedAtMs')
  return freezeState({
    areaId,
    startedAtMs,
    reinforcementQuota: PRIMEBOUND_STAGE_REINFORCEMENT_QUOTAS[areaId],
    reinforcementsDeployed: 0,
    nextReinforcementAtMs: null,
    minionsDefeated: 0,
    checkpointRespawnsRemaining: PRIMEBOUND_STAGE_CHECKPOINT_RESPAWNS,
    completedAtMs: completed ? startedAtMs : null,
  })
}

export function canAwakenStageGuardian(
  state: StageEncounterState,
  activeMinionCount: number,
): boolean {
  assertCount(activeMinionCount, 'activeMinionCount')
  return (
    state.completedAtMs === null &&
    state.reinforcementsDeployed >= state.reinforcementQuota &&
    state.nextReinforcementAtMs === null &&
    activeMinionCount === 0
  )
}

export function getStageEncounterSnapshot(
  state: StageEncounterState,
  nowMs: number,
  activeMinionCount: number,
): StageEncounterSnapshot {
  assertTime(nowMs, 'nowMs')
  assertCount(activeMinionCount, 'activeMinionCount')
  if (nowMs < state.startedAtMs) {
    throw new RangeError('Stage encounter clock cannot move backwards.')
  }

  const completed = state.completedAtMs !== null
  const elapsedMs = (state.completedAtMs ?? nowMs) - state.startedAtMs
  const reinforcementsRemaining = Math.max(
    0,
    state.reinforcementQuota - state.reinforcementsDeployed,
  )
  const remainingOpposition = activeMinionCount + reinforcementsRemaining
  const totalOpposition = state.minionsDefeated + remainingOpposition
  const guardianReady = canAwakenStageGuardian(state, activeMinionCount)
  const status: StageEncounterStatus = completed
    ? 'complete'
    : guardianReady
      ? 'guardian-ready'
      : state.nextReinforcementAtMs !== null
        ? 'reinforcement-inbound'
        : 'engaged'

  return Object.freeze({
    status,
    elapsedMs,
    progress: completed || guardianReady
      ? 1
      : totalOpposition === 0 ? 0 : state.minionsDefeated / totalOpposition,
    reinforcementQuota: state.reinforcementQuota,
    reinforcementsDeployed: state.reinforcementsDeployed,
    reinforcementsRemaining,
    nextReinforcementInMs: state.nextReinforcementAtMs === null
      ? 0
      : Math.max(0, state.nextReinforcementAtMs - nowMs),
    minionsDefeated: state.minionsDefeated,
    activeMinionCount,
    checkpointRespawnsRemaining: state.checkpointRespawnsRemaining,
    completed,
  })
}

export function shouldScheduleStageReinforcement(
  state: StageEncounterState,
  activeMinionCount: number,
): boolean {
  assertCount(activeMinionCount, 'activeMinionCount')
  return (
    state.completedAtMs === null &&
    state.reinforcementsDeployed < state.reinforcementQuota &&
    activeMinionCount < PRIMEBOUND_STAGE_REINFORCEMENT_ACTIVE_THRESHOLD &&
    state.nextReinforcementAtMs === null
  )
}

export function scheduleStageReinforcement(
  state: StageEncounterState,
  nowMs: number,
  activeMinionCount: number,
): StageEncounterState {
  assertTime(nowMs, 'nowMs')
  if (!shouldScheduleStageReinforcement(state, activeMinionCount)) return state
  return freezeState({
    ...state,
    nextReinforcementAtMs: nowMs + getStageReinforcementDelayMs(state),
  })
}

export function isStageReinforcementReady(
  state: StageEncounterState,
  nowMs: number,
): boolean {
  assertTime(nowMs, 'nowMs')
  return (
    state.completedAtMs === null &&
    state.reinforcementsDeployed < state.reinforcementQuota &&
    state.nextReinforcementAtMs !== null &&
    nowMs >= state.nextReinforcementAtMs
  )
}

export function deployStageReinforcement(
  state: StageEncounterState,
): StageEncounterState {
  if (
    state.completedAtMs !== null ||
    state.nextReinforcementAtMs === null ||
    state.reinforcementsDeployed >= state.reinforcementQuota
  ) return state
  return freezeState({
    ...state,
    reinforcementsDeployed: state.reinforcementsDeployed + 1,
    nextReinforcementAtMs: null,
  })
}

export function cancelStageReinforcement(
  state: StageEncounterState,
): StageEncounterState {
  if (state.nextReinforcementAtMs === null) return state
  return freezeState({ ...state, nextReinforcementAtMs: null })
}

export function recordStageMinionDefeat(
  state: StageEncounterState,
  count = 1,
): StageEncounterState {
  assertCount(count, 'count')
  if (count === 0 || state.completedAtMs !== null) return state
  return freezeState({
    ...state,
    minionsDefeated: state.minionsDefeated + count,
  })
}

export function consumeStageCheckpointRespawn(
  state: StageEncounterState,
): StageEncounterState {
  if (state.checkpointRespawnsRemaining <= 0) return state
  return freezeState({
    ...state,
    checkpointRespawnsRemaining: state.checkpointRespawnsRemaining - 1,
  })
}

export function completeStageEncounter(
  state: StageEncounterState,
  completedAtMs: number,
): StageEncounterState {
  assertTime(completedAtMs, 'completedAtMs')
  if (completedAtMs < state.startedAtMs) {
    throw new RangeError('Stage cannot complete before it starts.')
  }
  if (state.completedAtMs !== null) return state
  return freezeState({
    ...state,
    nextReinforcementAtMs: null,
    completedAtMs,
  })
}
