export type DiffieHellmanPhase =
  | 'intro'
  | 'select-private'
  | 'calculate-public'
  | 'public-transit'
  | 'calculate-secret'
  | 'secret-transit'
  | 'round-complete'
  | 'complete'

export type DiffieHellmanFeedbackKind = 'info' | 'success' | 'error'

export type RelayPacketKind = 'public' | 'confirmation'

export interface DiffieHellmanChallenge {
  readonly id: string
  readonly round: 1 | 2 | 3 | 4
  readonly title: string
  readonly payload: string
  readonly prime: number
  readonly generator: number
  /** Kept inside the simulator; the interface never exposes Bob's private value. */
  readonly bobPrivate: number
  readonly bobPublic: number
  readonly privateOptions: readonly number[]
}

export interface RelayPacket {
  readonly id: number
  readonly kind: RelayPacketKind
  readonly label: string
  readonly visibleToEve: boolean
}

export interface DiffieHellmanFeedback {
  readonly id: number
  readonly kind: DiffieHellmanFeedbackKind
  readonly title: string
  readonly detail: string
}

export interface TransmissionRecord {
  readonly challengeId: string
  readonly privateExponent: number
  readonly publicValue: number
  readonly sharedSecret: number
  readonly attempts: number
  readonly mistakes: number
  readonly score: number
}

export interface DiffieHellmanResult {
  readonly score: number
  readonly xp: number
  readonly elapsedMs: number
  readonly attempts: number
  readonly mistakes: number
  readonly transmissions: readonly TransmissionRecord[]
  readonly isNewBest: boolean
}

export interface DiffieHellmanProgressInput {
  readonly score: number
  readonly xp: number
}

export type DiffieHellmanSoundEvent =
  | 'select'
  | 'send'
  | 'error'
  | 'secure'
  | 'complete'

export interface DiffieHellmanSoundCue {
  readonly id: number
  readonly event: DiffieHellmanSoundEvent
}

export interface PowerTraceStep {
  readonly multiplication: number
  readonly residue: number
}
