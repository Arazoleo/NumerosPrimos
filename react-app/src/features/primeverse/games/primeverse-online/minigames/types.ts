export type MinigamePhase = 'idle' | 'countdown' | 'running' | 'won' | 'lost'

export type MinigameWorldPosition = readonly [x: number, y: number, z: number]

export interface PhysicalMinigameTarget<TId extends string> {
  readonly id: TId
  readonly value: number
  readonly position: MinigameWorldPosition
  readonly triggerRadius: number
}

export interface MinigameClockState {
  readonly phase: MinigamePhase
  readonly nowMs: number
  readonly countdownEndsAtMs: number | null
  readonly startedAtMs: number | null
  readonly durationMs: number
  readonly penaltyMs: number
  readonly finishedTimeMs: number | null
  readonly bestTimeMs: number | null
  readonly isNewRecord: boolean
}

export function sanitizeTimestamp(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

export function sanitizeBestTime(value: number | null | undefined): number | null {
  if (!Number.isFinite(value) || value === null || value === undefined || value <= 0) return null
  return Math.round(value)
}

export function elapsedGameTime(state: MinigameClockState, atMs = state.nowMs): number {
  if (state.startedAtMs === null) return 0
  const safeNow = sanitizeTimestamp(atMs, state.nowMs)
  return Math.max(0, safeNow - state.startedAtMs) + state.penaltyMs
}

export function remainingGameTime(state: MinigameClockState, atMs = state.nowMs): number {
  return Math.max(0, state.durationMs - elapsedGameTime(state, atMs))
}

export function countdownNumber(state: MinigameClockState): number | null {
  if (state.phase !== 'countdown' || state.countdownEndsAtMs === null) return null
  return Math.max(1, Math.ceil((state.countdownEndsAtMs - state.nowMs) / 1_000))
}

export function distanceSquaredXZ(a: MinigameWorldPosition, b: MinigameWorldPosition): number {
  const dx = a[0] - b[0]
  const dz = a[2] - b[2]
  return dx * dx + dz * dz
}

