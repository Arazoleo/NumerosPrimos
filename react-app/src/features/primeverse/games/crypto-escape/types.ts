export type EscapePhase =
  | 'intro'
  | 'searching'
  | 'prime-box'
  | 'caesar-lock'
  | 'modular-lock'
  | 'spectral-clue'
  | 'rsa-vault'
  | 'escaped'

export type EscapeInteractableId =
  | 'lens'
  | 'prime-box'
  | 'caesar-console'
  | 'modular-console'
  | 'hidden-plaque'
  | 'rsa-vault'
  | 'exit-door'

export type EscapePuzzleId = 'prime-box' | 'caesar-cipher' | 'modular-lock' | 'rsa-vault'

export type EscapeFeedbackKind = 'info' | 'success' | 'error'

export type EscapeInspectionStatus =
  | 'clue'
  | 'puzzle'
  | 'locked'
  | 'solved'

export type RsaField = 'p' | 'q' | 'd'

export type RingDirection = -1 | 1

export type PrimeBoxStep =
  | 'rings'
  | 'latches'
  | 'lid'
  | 'drawer'
  | 'rotor'
  | 'complete'

export interface EscapeProgress {
  readonly lensCollected: boolean
  readonly primeBoxSolved: boolean
  readonly caesarRotorCollected: boolean
  readonly caesarSolved: boolean
  readonly modularSolved: boolean
  readonly clueRevealed: boolean
  readonly rsaSolved: boolean
}

export interface EscapeInteractableDefinition {
  readonly id: EscapeInteractableId
  readonly label: string
  readonly prompt: string
  readonly description: string
}

export interface EscapeInspection {
  readonly interactable: EscapeInteractableId
  readonly status: EscapeInspectionStatus
  readonly title: string
  readonly description: string
}

export interface EscapeFeedback {
  readonly id: number
  readonly kind: EscapeFeedbackKind
  readonly title: string
  readonly detail: string
}

export interface ModularLockEvaluation {
  readonly guess: number
  readonly residue: number
  readonly reachesTarget: boolean
  readonly isMinimal: boolean
  readonly isCorrect: boolean
}

export interface RsaVaultInput {
  readonly p: number
  readonly q: number
  readonly d: number
}

export interface RsaVaultEvaluation {
  readonly factorsCorrect: boolean
  readonly totient: number | null
  readonly inverseCorrect: boolean
  readonly isCorrect: boolean
}

export interface RsaFields {
  readonly p: string
  readonly q: string
  readonly d: string
}

export interface EscapeScoreInput {
  readonly mistakes: number
  readonly elapsedMs: number
}

export interface EscapeResult {
  readonly score: number
  readonly xp: number
  readonly elapsedMs: number
  readonly mistakes: number
  readonly solvedPuzzles: readonly EscapePuzzleId[]
  readonly isNewBest: boolean
}

export interface EscapeProgressInput {
  readonly score: number
  readonly xp: number
}

export type EscapeSoundEvent =
  | 'discover'
  | 'inspect'
  | 'rotate'
  | 'error'
  | 'unlock'
  | 'escape'

export interface EscapeSoundCue {
  readonly id: number
  readonly event: EscapeSoundEvent
}
