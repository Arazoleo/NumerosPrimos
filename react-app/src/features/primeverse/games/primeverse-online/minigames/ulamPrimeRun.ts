import {
  distanceSquaredXZ,
  elapsedGameTime,
  remainingGameTime,
  sanitizeBestTime,
  sanitizeTimestamp,
  type MinigameClockState,
  type MinigameWorldPosition,
  type PhysicalMinigameTarget,
} from './types'

export const ULAM_COUNTDOWN_MS = 3_000
export const ULAM_DURATION_MS = 35_000
export const ULAM_COMPOSITE_PENALTY_MS = 2_500
export const ULAM_HIT_COOLDOWN_MS = 650
export const ULAM_PRIME_SEQUENCE = [2, 3, 5, 7, 11, 13, 17] as const

export const ULAM_TARGET_IDS = [
  'ulam-2', 'ulam-4', 'ulam-3', 'ulam-6', 'ulam-5', 'ulam-9', 'ulam-7',
  'ulam-10', 'ulam-11', 'ulam-12', 'ulam-13', 'ulam-15', 'ulam-17',
] as const

export type UlamTargetId = (typeof ULAM_TARGET_IDS)[number]

export interface UlamPrimeTarget extends PhysicalMinigameTarget<UlamTargetId> {
  readonly kind: 'prime' | 'composite'
  readonly sequenceIndex: number | null
}

export const ULAM_START_CONSOLE = Object.freeze({
  id: 'ulam-run-console' as const,
  position: [72, 0.8, 8.1] as MinigameWorldPosition,
  interactionRadius: 2.2,
})

export const ULAM_TARGETS: readonly UlamPrimeTarget[] = Object.freeze([
  { id: 'ulam-2', value: 2, kind: 'prime', sequenceIndex: 0, position: [68, 0.45, 6], triggerRadius: 1.15 },
  { id: 'ulam-4', value: 4, kind: 'composite', sequenceIndex: null, position: [71, 0.45, 4.8], triggerRadius: 1.05 },
  { id: 'ulam-3', value: 3, kind: 'prime', sequenceIndex: 1, position: [64.5, 0.45, 1.2], triggerRadius: 1.15 },
  { id: 'ulam-6', value: 6, kind: 'composite', sequenceIndex: null, position: [67.2, 0.45, 0.2], triggerRadius: 1.05 },
  { id: 'ulam-5', value: 5, kind: 'prime', sequenceIndex: 2, position: [67, 0.45, -5], triggerRadius: 1.15 },
  { id: 'ulam-9', value: 9, kind: 'composite', sequenceIndex: null, position: [70.3, 0.45, -3.9], triggerRadius: 1.05 },
  { id: 'ulam-7', value: 7, kind: 'prime', sequenceIndex: 3, position: [72, 0.45, -8], triggerRadius: 1.15 },
  { id: 'ulam-10', value: 10, kind: 'composite', sequenceIndex: null, position: [73.8, 0.45, -5], triggerRadius: 1.05 },
  { id: 'ulam-11', value: 11, kind: 'prime', sequenceIndex: 4, position: [77, 0.45, -5], triggerRadius: 1.15 },
  { id: 'ulam-12', value: 12, kind: 'composite', sequenceIndex: null, position: [76.6, 0.45, -1.8], triggerRadius: 1.05 },
  { id: 'ulam-13', value: 13, kind: 'prime', sequenceIndex: 5, position: [79.5, 0.45, 1.2], triggerRadius: 1.15 },
  { id: 'ulam-15', value: 15, kind: 'composite', sequenceIndex: null, position: [76.4, 0.45, 3.2], triggerRadius: 1.05 },
  { id: 'ulam-17', value: 17, kind: 'prime', sequenceIndex: 6, position: [76, 0.45, 6], triggerRadius: 1.15 },
])

const TARGET_BY_ID = new Map(ULAM_TARGETS.map((target) => [target.id, target]))

export type UlamFeedbackKind = 'correct' | 'composite' | 'out-of-order'

export interface UlamFeedback {
  readonly kind: UlamFeedbackKind
  readonly value: number
  readonly atMs: number
  readonly message: string
}

export interface UlamPrimeRunState extends MinigameClockState {
  readonly nextPrimeIndex: number
  readonly collectedTargetIds: readonly UlamTargetId[]
  readonly mistakes: number
  readonly lastHitTargetId: UlamTargetId | null
  readonly lastHitAtMs: number | null
  readonly feedback: UlamFeedback | null
}

export type UlamPrimeRunAction =
  | { readonly type: 'start'; readonly nowMs: number }
  | { readonly type: 'tick'; readonly nowMs: number }
  | { readonly type: 'hit'; readonly targetId: string; readonly nowMs: number }
  | { readonly type: 'reset' }

export type UlamTargetStatus = 'current' | 'queued' | 'cleared' | 'composite'

export function createUlamPrimeRunState(bestTimeMs: number | null = null): UlamPrimeRunState {
  return {
    phase: 'idle',
    nowMs: 0,
    countdownEndsAtMs: null,
    startedAtMs: null,
    durationMs: ULAM_DURATION_MS,
    penaltyMs: 0,
    finishedTimeMs: null,
    bestTimeMs: sanitizeBestTime(bestTimeMs),
    isNewRecord: false,
    nextPrimeIndex: 0,
    collectedTargetIds: [],
    mistakes: 0,
    lastHitTargetId: null,
    lastHitAtMs: null,
    feedback: null,
  }
}

function startRun(state: UlamPrimeRunState, nowMs: number): UlamPrimeRunState {
  const now = sanitizeTimestamp(nowMs, state.nowMs)
  return {
    ...createUlamPrimeRunState(state.bestTimeMs),
    phase: 'countdown',
    nowMs: now,
    countdownEndsAtMs: now + ULAM_COUNTDOWN_MS,
  }
}

function advanceClock(state: UlamPrimeRunState, nowMs: number): UlamPrimeRunState {
  const now = Math.max(state.nowMs, sanitizeTimestamp(nowMs, state.nowMs))
  if (state.phase === 'countdown' && state.countdownEndsAtMs !== null && now >= state.countdownEndsAtMs) {
    const running = {
      ...state,
      phase: 'running' as const,
      nowMs: now,
      startedAtMs: state.countdownEndsAtMs,
    }
    return remainingGameTime(running) > 0 ? running : { ...running, phase: 'lost' }
  }
  if (state.phase === 'running') {
    const running = { ...state, nowMs: now }
    return remainingGameTime(running) > 0 ? running : { ...running, phase: 'lost' }
  }
  if (state.phase === 'countdown') return { ...state, nowMs: now }
  return state
}

function completeRun(state: UlamPrimeRunState, nowMs: number): UlamPrimeRunState {
  const finishedTimeMs = elapsedGameTime(state, nowMs)
  const isNewRecord = state.bestTimeMs === null || finishedTimeMs < state.bestTimeMs
  return {
    ...state,
    phase: 'won',
    nowMs,
    finishedTimeMs,
    bestTimeMs: isNewRecord ? finishedTimeMs : state.bestTimeMs,
    isNewRecord,
  }
}

function hitTarget(state: UlamPrimeRunState, targetId: string, nowMs: number): UlamPrimeRunState {
  const advanced = advanceClock(state, nowMs)
  if (advanced.phase !== 'running') return advanced
  const target = TARGET_BY_ID.get(targetId as UlamTargetId)
  if (!target) return advanced
  if (advanced.lastHitTargetId === target.id
    && advanced.lastHitAtMs !== null
    && advanced.nowMs - advanced.lastHitAtMs < ULAM_HIT_COOLDOWN_MS) return advanced

  if (target.kind === 'composite') {
    const penalized: UlamPrimeRunState = {
      ...advanced,
      penaltyMs: advanced.penaltyMs + ULAM_COMPOSITE_PENALTY_MS,
      mistakes: advanced.mistakes + 1,
      lastHitTargetId: target.id,
      lastHitAtMs: advanced.nowMs,
      feedback: {
        kind: 'composite',
        value: target.value,
        atMs: advanced.nowMs,
        message: `${target.value} é composto: +2,5 s`,
      },
    }
    return remainingGameTime(penalized) > 0 ? penalized : { ...penalized, phase: 'lost' }
  }

  if (target.sequenceIndex !== advanced.nextPrimeIndex) {
    return {
      ...advanced,
      mistakes: advanced.mistakes + 1,
      lastHitTargetId: target.id,
      lastHitAtMs: advanced.nowMs,
      feedback: {
        kind: 'out-of-order',
        value: target.value,
        atMs: advanced.nowMs,
        message: `${target.value} ainda não é o próximo alvo`,
      },
    }
  }

  const nextPrimeIndex = advanced.nextPrimeIndex + 1
  const correct: UlamPrimeRunState = {
    ...advanced,
    nextPrimeIndex,
    collectedTargetIds: [...advanced.collectedTargetIds, target.id],
    lastHitTargetId: target.id,
    lastHitAtMs: advanced.nowMs,
    feedback: {
      kind: 'correct',
      value: target.value,
      atMs: advanced.nowMs,
      message: `${target.value} confirmado`,
    },
  }
  return nextPrimeIndex === ULAM_PRIME_SEQUENCE.length
    ? completeRun(correct, advanced.nowMs)
    : correct
}

export function ulamPrimeRunReducer(
  state: UlamPrimeRunState,
  action: UlamPrimeRunAction,
): UlamPrimeRunState {
  switch (action.type) {
    case 'start': return startRun(state, action.nowMs)
    case 'tick': return advanceClock(state, action.nowMs)
    case 'hit': return hitTarget(state, action.targetId, action.nowMs)
    case 'reset': return createUlamPrimeRunState(state.bestTimeMs)
  }
}

export function getUlamTarget(targetId: string): UlamPrimeTarget | null {
  return TARGET_BY_ID.get(targetId as UlamTargetId) ?? null
}

export function getUlamTargetStatus(state: UlamPrimeRunState, targetId: UlamTargetId): UlamTargetStatus {
  const target = TARGET_BY_ID.get(targetId)
  if (!target || target.kind === 'composite') return 'composite'
  if (target.sequenceIndex !== null && target.sequenceIndex < state.nextPrimeIndex) return 'cleared'
  return target.sequenceIndex === state.nextPrimeIndex ? 'current' : 'queued'
}

export function findUlamTargetAtPosition(position: MinigameWorldPosition): UlamPrimeTarget | null {
  let closest: UlamPrimeTarget | null = null
  let closestDistance = Number.POSITIVE_INFINITY
  for (const target of ULAM_TARGETS) {
    const distance = distanceSquaredXZ(position, target.position)
    if (distance <= target.triggerRadius ** 2 && distance < closestDistance) {
      closest = target
      closestDistance = distance
    }
  }
  return closest
}
