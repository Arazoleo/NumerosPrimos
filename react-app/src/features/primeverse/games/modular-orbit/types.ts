export type ModularOrbitPhase =
  | 'intro'
  | 'playing'
  | 'launching'
  | 'round-complete'
  | 'complete'

export type OrbitFeedbackKind = 'info' | 'success' | 'error'

export interface ModularOrbitChallenge {
  readonly id: string
  readonly difficulty: 1 | 2 | 3 | 4 | 5
  readonly modulus: number
  readonly start: number
  readonly step: number
  readonly target: number
  /** The smallest non-negative number of pulses that reaches the target. */
  readonly solution: number
  readonly period: number
}

export interface OrbitLaunch {
  readonly pulses: number
  /** Includes the starting residue and the landing after every pulse. */
  readonly trace: readonly number[]
  readonly landing: number
  readonly reachesTarget: boolean
  /** True only for the smallest solution, not an extra lap around the orbit. */
  readonly isCorrect: boolean
}

export interface OrbitFeedback {
  readonly id: number
  readonly kind: OrbitFeedbackKind
  readonly title: string
  readonly detail: string
}

export interface OrbitRoundResult {
  readonly roundIndex: number
  readonly challengeId: string
  readonly attempts: number
  readonly mistakes: number
  readonly score: number
}

export interface ModularOrbitResult {
  readonly score: number
  readonly xp: number
  readonly elapsedMs: number
  readonly attempts: number
  readonly mistakes: number
  readonly rounds: readonly OrbitRoundResult[]
  readonly isNewBest: boolean
}

export interface ModularOrbitProgressInput {
  readonly score: number
  readonly xp: number
}

export type OrbitSoundEvent =
  | 'select'
  | 'launch'
  | 'miss'
  | 'dock'
  | 'complete'
