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

export const FACTOR_COUNTDOWN_MS = 3_000
export const FACTOR_DURATION_MS = 45_000
export const FACTOR_ERROR_PENALTY_MS = 3_000
export const FACTOR_REACTOR_TARGETS = [30, 42, 66] as const
export const FACTOR_VALUES = [2, 3, 5, 7, 11] as const

export type FactorValue = (typeof FACTOR_VALUES)[number]
export type FactorNodeId = `factor-node-${FactorValue}`
export type FactorReactorInteractableId = 'factor-reactor-console' | FactorNodeId

export interface FactorNode extends PhysicalMinigameTarget<FactorNodeId> {
  readonly factor: FactorValue
}

export const FACTOR_REACTOR_CONSOLE = Object.freeze({
  id: 'factor-reactor-console' as const,
  position: [-72, 0.8, 5.6] as MinigameWorldPosition,
  interactionRadius: 2.2,
})

export const FACTOR_REACTOR_CORE = Object.freeze({
  id: 'factor-reactor-core' as const,
  position: [-72, 0, -2.4] as MinigameWorldPosition,
  collisionRadius: 2.15,
})

export const FACTOR_NODES: readonly FactorNode[] = Object.freeze([
  { id: 'factor-node-2', value: 2, factor: 2, position: [-78, 0.55, -1.5], triggerRadius: 1.3 },
  { id: 'factor-node-3', value: 3, factor: 3, position: [-75, 0.55, -5.8], triggerRadius: 1.3 },
  { id: 'factor-node-5', value: 5, factor: 5, position: [-72, 0.55, -7.3], triggerRadius: 1.3 },
  { id: 'factor-node-7', value: 7, factor: 7, position: [-69, 0.55, -5.8], triggerRadius: 1.3 },
  { id: 'factor-node-11', value: 11, factor: 11, position: [-66, 0.55, -1.5], triggerRadius: 1.3 },
])

const NODE_BY_ID = new Map(FACTOR_NODES.map((node) => [node.id, node]))

export type FactorFeedbackKind = 'correct' | 'error' | 'round-complete'

export interface FactorFeedback {
  readonly kind: FactorFeedbackKind
  readonly factor: FactorValue
  readonly atMs: number
  readonly message: string
}

export interface SolvedFactorRound {
  readonly target: number
  readonly factors: readonly FactorValue[]
}

export interface FactorReactorState extends MinigameClockState {
  readonly roundIndex: number
  readonly remainingTarget: number
  readonly selectedFactors: readonly FactorValue[]
  readonly solvedRounds: readonly SolvedFactorRound[]
  readonly errors: number
  readonly feedback: FactorFeedback | null
}

export type FactorReactorAction =
  | { readonly type: 'start'; readonly nowMs: number }
  | { readonly type: 'tick'; readonly nowMs: number }
  | { readonly type: 'select-factor'; readonly factor: number; readonly nowMs: number }
  | { readonly type: 'interact'; readonly targetId: string; readonly nowMs: number }
  | { readonly type: 'reset' }

export function createFactorReactorState(bestTimeMs: number | null = null): FactorReactorState {
  return {
    phase: 'idle',
    nowMs: 0,
    countdownEndsAtMs: null,
    startedAtMs: null,
    durationMs: FACTOR_DURATION_MS,
    penaltyMs: 0,
    finishedTimeMs: null,
    bestTimeMs: sanitizeBestTime(bestTimeMs),
    isNewRecord: false,
    roundIndex: 0,
    remainingTarget: FACTOR_REACTOR_TARGETS[0],
    selectedFactors: [],
    solvedRounds: [],
    errors: 0,
    feedback: null,
  }
}

function startReactor(state: FactorReactorState, nowMs: number): FactorReactorState {
  const now = sanitizeTimestamp(nowMs, state.nowMs)
  return {
    ...createFactorReactorState(state.bestTimeMs),
    phase: 'countdown',
    nowMs: now,
    countdownEndsAtMs: now + FACTOR_COUNTDOWN_MS,
  }
}

function advanceClock(state: FactorReactorState, nowMs: number): FactorReactorState {
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

function isFactorValue(value: number): value is FactorValue {
  return FACTOR_VALUES.some((factor) => factor === value)
}

function completeReactor(state: FactorReactorState, nowMs: number): FactorReactorState {
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

function selectFactor(state: FactorReactorState, factorInput: number, nowMs: number): FactorReactorState {
  const advanced = advanceClock(state, nowMs)
  if (advanced.phase !== 'running' || !isFactorValue(factorInput)) return advanced
  const factor = factorInput

  if (advanced.remainingTarget % factor !== 0) {
    const penalized: FactorReactorState = {
      ...advanced,
      penaltyMs: advanced.penaltyMs + FACTOR_ERROR_PENALTY_MS,
      errors: advanced.errors + 1,
      feedback: {
        kind: 'error',
        factor,
        atMs: advanced.nowMs,
        message: `${factor} não divide ${advanced.remainingTarget}: +3 s`,
      },
    }
    return remainingGameTime(penalized) > 0 ? penalized : { ...penalized, phase: 'lost' }
  }

  const selectedFactors = [...advanced.selectedFactors, factor]
  const remainingTarget = advanced.remainingTarget / factor
  if (remainingTarget !== 1) {
    return {
      ...advanced,
      remainingTarget,
      selectedFactors,
      feedback: {
        kind: 'correct',
        factor,
        atMs: advanced.nowMs,
        message: `${factor} encaixado · resta ${remainingTarget}`,
      },
    }
  }

  const target = FACTOR_REACTOR_TARGETS[advanced.roundIndex]
  const solvedRounds = [...advanced.solvedRounds, { target, factors: selectedFactors }]
  const nextRoundIndex = advanced.roundIndex + 1
  const roundComplete: FactorReactorState = {
    ...advanced,
    roundIndex: nextRoundIndex,
    remainingTarget: FACTOR_REACTOR_TARGETS[nextRoundIndex] ?? 1,
    selectedFactors: [],
    solvedRounds,
    feedback: {
      kind: 'round-complete',
      factor,
      atMs: advanced.nowMs,
      message: `${target} estabilizado`,
    },
  }
  return nextRoundIndex === FACTOR_REACTOR_TARGETS.length
    ? completeReactor(roundComplete, advanced.nowMs)
    : roundComplete
}

export function factorReactorReducer(
  state: FactorReactorState,
  action: FactorReactorAction,
): FactorReactorState {
  switch (action.type) {
    case 'start': return startReactor(state, action.nowMs)
    case 'tick': return advanceClock(state, action.nowMs)
    case 'select-factor': return selectFactor(state, action.factor, action.nowMs)
    case 'interact': {
      if (action.targetId === FACTOR_REACTOR_CONSOLE.id) {
        return state.phase === 'running' || state.phase === 'countdown'
          ? advanceClock(state, action.nowMs)
          : startReactor(state, action.nowMs)
      }
      const node = NODE_BY_ID.get(action.targetId as FactorNodeId)
      return node ? selectFactor(state, node.factor, action.nowMs) : advanceClock(state, action.nowMs)
    }
    case 'reset': return createFactorReactorState(state.bestTimeMs)
  }
}

export function getFactorNode(targetId: string): FactorNode | null {
  return NODE_BY_ID.get(targetId as FactorNodeId) ?? null
}

export function findFactorNodeAtPosition(position: MinigameWorldPosition): FactorNode | null {
  let closest: FactorNode | null = null
  let closestDistance = Number.POSITIVE_INFINITY
  for (const node of FACTOR_NODES) {
    const distance = distanceSquaredXZ(position, node.position)
    if (distance <= node.triggerRadius ** 2 && distance < closestDistance) {
      closest = node
      closestDistance = distance
    }
  }
  return closest
}
