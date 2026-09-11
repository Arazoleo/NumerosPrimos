export type DefensePhase =
  | 'intro'
  | 'planning'
  | 'running'
  | 'wave-result'
  | 'victory'
  | 'defeat'

export type DefenseLane = 0 | 1 | 2
export type DefenseSlot = 0 | 1 | 2
export type DefenseDivisor = 2 | 3 | 5 | 7
export type DefenseOutcomeKind = 'intercepted' | 'prime-passed' | 'breach'
export type DefenseFeedbackKind = 'info' | 'success' | 'error'

export interface DefenseEnemySeed {
  readonly value: number
}

export interface DefenseEnemy extends DefenseEnemySeed {
  readonly id: string
  readonly lane: DefenseLane
  readonly laneOrder: number
  readonly travelOrder: number
}

export interface DefenseWave {
  readonly id: string
  readonly name: string
  readonly briefing: string
  readonly energy: number
  readonly lanes: readonly [
    readonly DefenseEnemySeed[],
    readonly DefenseEnemySeed[],
    readonly DefenseEnemySeed[],
  ]
}

export interface TowerPlacement {
  readonly id: string
  readonly lane: DefenseLane
  readonly slot: DefenseSlot
  readonly divisor: DefenseDivisor
}

export interface DefenseOutcome {
  readonly enemy: DefenseEnemy
  readonly kind: DefenseOutcomeKind
  readonly divisor: DefenseDivisor | null
  readonly towerId: string | null
  readonly factors: readonly number[]
  readonly points: number
  readonly lifeDelta: number
  readonly chargeDelta: number
  readonly explanation: string
}

export interface DefensePlanAnalysis {
  readonly outcomes: readonly DefenseOutcome[]
  readonly intercepted: number
  readonly primes: number
  readonly breaches: number
}

export interface DefenseWaveSummary {
  readonly waveIndex: number
  readonly intercepted: number
  readonly primesPassed: number
  readonly breaches: number
  readonly points: number
  readonly perfect: boolean
}

export interface DefenseResult {
  readonly victory: boolean
  readonly score: number
  readonly xp: number
  readonly elapsedMs: number
  readonly wavesCleared: number
  readonly intercepted: number
  readonly primesPassed: number
  readonly breaches: number
  readonly livesRemaining: number
  readonly coreCharge: number
  readonly isNewBest: boolean
}

export interface DefenseFeedback {
  readonly id: number
  readonly kind: DefenseFeedbackKind
  readonly title: string
  readonly detail: string
}

export interface DefenseProgressInput {
  readonly score: number
  readonly xp: number
}

export type DefenseSoundEvent =
  | 'select'
  | 'place'
  | 'launch'
  | 'intercept'
  | 'prime'
  | 'breach'
  | 'wave-complete'
  | 'complete'

