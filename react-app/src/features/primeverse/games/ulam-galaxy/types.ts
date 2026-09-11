export type UlamDirectionId = 'ne' | 'nw' | 'sw' | 'se'

export type UlamPhase =
  | 'intro'
  | 'playing'
  | 'scanning'
  | 'round-complete'
  | 'complete'

export interface UlamCell {
  readonly value: number
  readonly x: number
  readonly y: number
  readonly prime: boolean
}

export interface UlamDirection {
  readonly id: UlamDirectionId
  readonly label: string
  readonly symbol: string
  readonly dx: -1 | 1
  readonly dy: -1 | 1
}

export interface UlamPath {
  readonly direction: UlamDirection
  readonly cells: readonly UlamCell[]
  readonly primeCount: number
}

export interface UlamMission {
  readonly id: string
  readonly difficulty: number
  readonly size: number
  readonly pathLength: number
  readonly anchor: UlamCell
  readonly paths: readonly UlamPath[]
  readonly correctDirection: UlamDirectionId
}

export interface UlamScan {
  readonly direction: UlamDirectionId
  readonly isCorrect: boolean
  readonly primeCount: number
}

export interface UlamRoundResult extends UlamScan {
  readonly missionId: string
  readonly points: number
  readonly mistakes: number
}

export interface UlamResult {
  readonly score: number
  readonly xp: number
  readonly elapsedMs: number
  readonly mistakes: number
  readonly rounds: readonly UlamRoundResult[]
  readonly isNewBest: boolean
}

export interface UlamFeedback {
  readonly id: number
  readonly kind: 'info' | 'success' | 'error'
  readonly title: string
  readonly detail: string
}

export type UlamSoundEvent = 'select' | 'scan' | 'error' | 'correct' | 'complete'

export interface UlamSoundCue {
  readonly id: number
  readonly event: UlamSoundEvent
}

export interface UlamProgressInput {
  readonly score: number
  readonly xp: number
}

