import type { MutableRefObject } from 'react'

import type {
  CatacombsCampaignState,
  CatacombsEnemyArchetype,
  CatacombsEventId,
  CatacombsLevelDefinition,
} from './campaignLogic'
import type { ElevatorPuzzle } from './elevatorPuzzle'
import type { Hallucination, HallucinationFrame } from './hallucinations'
import type { CatacombsGameState, EnemyState } from './gameLogic'

export interface CatacombsControls {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  sprint: boolean
  interactPulse: number
  flashlightPulse: number
  /** Last answer typed on the elevator keypad, applied on the next submit pulse. */
  puzzleAnswer: string
  puzzleSubmitPulse: number
  puzzleClosePulse: number
}

export type CatacombsControlRef = MutableRefObject<CatacombsControls>

/** Short, contextual jumpscare: one creature filling the screen for a few frames. */
export interface CatacombsJumpscare {
  readonly id: string
  readonly enemyId: string
  readonly name: string
  readonly archetype: CatacombsEnemyArchetype
  readonly startedAt: number
  readonly until: number
  readonly lethal: boolean
}

/** Live state of the elevator cipher panel while the player is typing on it. */
export interface CatacombsElevatorState {
  readonly puzzle: ElevatorPuzzle
  readonly fragments: readonly string[]
  readonly solved: boolean
  readonly attempts: number
  readonly feedback: string
}

/** A vision playing right now: the scene drives it, the HUD renders it. */
export interface CatacombsHallucinationState {
  readonly vision: Hallucination
  readonly frame: HallucinationFrame
}

export interface CatacombsSnapshot {
  readonly game: CatacombsGameState
  readonly campaign: CatacombsCampaignState
  readonly level: CatacombsLevelDefinition
  /** Player transform exposed for the shared Primeverse expedition layer. */
  readonly playerPosition: Readonly<{ x: number; y: number; z: number }>
  readonly playerYaw: number
  readonly enemies: readonly EnemyState[]
  readonly sector: string
  readonly interactionPrompt: string | null
  readonly objectiveDistance: number
  readonly objectiveBearing: number
  readonly nearestEnemyDistance: number
  readonly pointerLocked: boolean
  readonly fear: number
  readonly jumpscare: CatacombsJumpscare | null
  readonly elevator: CatacombsElevatorState | null
  readonly hallucination: CatacombsHallucinationState | null
  readonly cabinetPrompt: string | null
  /** Items pulled from drawers, e.g. the Caesar cipher disc. */
  readonly tools: readonly string[]
  readonly fragmentsFound: number
  readonly fragmentsTotal: number
  readonly activeEvent: CatacombsEventId | null
  readonly activeEventUntil: number
  readonly levelTransitionUntil: number
  readonly nowMs: number
}

/** Live handles the scene needs for shared-world co-op, refreshed every render. */
export interface CatacombsCoopBridge {
  readonly client: {
    sendPartyState(data: unknown): boolean
    sendPartyAction(data: unknown): boolean
    consumePartyActions(): readonly { readonly fromId: string; readonly data: unknown }[]
  } | null
  readonly playerId: string | null
  readonly peerIds: readonly string[]
  readonly partyState: { readonly fromId: string; readonly seq: number; readonly data: unknown } | null
  /** Party members' world positions, so host creatures hunt the nearest human. */
  readonly peerPositions: readonly { readonly x: number; readonly z: number }[]
  readonly active: boolean
}

export type HeldControl = 'forward' | 'backward' | 'left' | 'right' | 'sprint'
export type PulseControl = 'interact' | 'flashlight'
