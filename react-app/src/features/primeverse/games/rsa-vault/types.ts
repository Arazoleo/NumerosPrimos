export type RsaVaultPhase =
  | 'intro'
  | 'playing'
  | 'unlocking'
  | 'vault-open'
  | 'complete'

export const RSA_TUTORIAL_LAST_STEP = 7 as const

export type RsaTutorialStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

export type RsaStage = 'factor' | 'totient' | 'inverse' | 'decrypt'

export type RsaInputField = 'p' | 'q' | 'totient' | 'privateExponent' | 'message'

export type RsaFeedbackKind = 'info' | 'success' | 'error'

export interface RsaVaultChallenge {
  readonly id: string
  readonly level: 1 | 2 | 3 | 4
  readonly codename: string
  readonly modulus: bigint
  readonly publicExponent: bigint
  readonly primeP: bigint
  readonly primeQ: bigint
  readonly totient: bigint
  readonly privateExponent: bigint
  readonly encryptedBlocks: readonly bigint[]
  readonly plaintextBlocks: readonly bigint[]
  readonly message: string
}

export interface RsaVaultInputs {
  readonly p: string
  readonly q: string
  readonly totient: string
  readonly privateExponent: string
  readonly message: string
}

export interface RsaFeedback {
  readonly id: number
  readonly kind: RsaFeedbackKind
  readonly title: string
  readonly detail: string
}

export interface RsaVaultRoundResult {
  readonly vaultIndex: number
  readonly challengeId: string
  readonly attempts: number
  readonly mistakes: number
  readonly score: number
  readonly message: string
}

export interface RsaVaultResult {
  readonly score: number
  readonly xp: number
  readonly elapsedMs: number
  readonly attempts: number
  readonly mistakes: number
  readonly vaults: readonly RsaVaultRoundResult[]
  readonly isNewBest: boolean
}

export interface RsaVaultProgressInput {
  readonly score: number
  readonly xp: number
}

export type RsaVaultSoundEvent =
  | 'select'
  | 'stage'
  | 'error'
  | 'unlock'
  | 'complete'

export interface RsaVaultSoundSignal {
  readonly id: number
  readonly event: RsaVaultSoundEvent
}
