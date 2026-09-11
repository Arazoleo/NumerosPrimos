import type { MutableRefObject } from 'react'

import type { AvatarAppearance, Emote, PlayerAnimation } from './shared/protocol'
import type { Vec3Tuple } from './world'

export type AvatarAnimation = PlayerAnimation
export type OnlineEmote = Emote
export type OnlineAppearance = AvatarAppearance

export interface AvatarRenderState {
  position: [number, number, number]
  yaw: number
  animation: AvatarAnimation
  speed: number
  nickname: string
  appearance: OnlineAppearance
  emote: null | { kind: OnlineEmote; startedAt: number; durationMs?: number }
}

export interface MovementInput {
  readonly keys: Set<string>
  touchX: number
  touchZ: number
  jumpQueued: boolean
  sprintHeld: boolean
}

export interface CameraLook {
  yaw: number
  pitch: number
}

export interface InteractionTarget {
  readonly id: string
  readonly label: string
  readonly distance: number
}

export type AvatarStateRef = MutableRefObject<AvatarRenderState>

export const DEFAULT_APPEARANCE: OnlineAppearance = {
  bodyColor: '#3155a4',
  accentColor: '#76edff',
  visorColor: '#dffcff',
}

export function toMutablePosition(position: Vec3Tuple): [number, number, number] {
  return [position[0], position[1], position[2]]
}
