import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

import type { QualityLevel } from '../../../graphics/useQualitySettings'
import type { AbilityDefinition, AbilityMechanic, AbilitySlot, HeroId, TeamId, Vec3 } from '../types'

export const TAU = Math.PI * 2
export const FORWARD = new THREE.Vector3(0, 0, 1)
export const WORLD_UP = new THREE.Vector3(0, 1, 0)

export const CIPHER_TEAM_COLOR = '#55e6ff'
export const FRACTURE_TEAM_COLOR = '#ff4167'

export interface PowerPalette {
  readonly primary: string
  readonly highlight: string
}

/**
 * Each mechanic keeps a recognisable two-colour signature. Hostile casts always
 * gain the warm Fracture edge, so threat recognition does not depend on knowing
 * which hero fired it.
 */
const POWER_PALETTES: Readonly<Record<AbilityMechanic, PowerPalette>> = Object.freeze({
  'precision-shot': { primary: '#71ffe0', highlight: '#f2fffb' },
  'sieve-field': { primary: '#3dffc0', highlight: '#ffe875' },
  'residue-dash': { primary: '#42e8ca', highlight: '#b8fff1' },
  'sieve-domain': { primary: '#43ffc0', highlight: '#fff18d' },
  'scatter-shot': { primary: '#ffb84f', highlight: '#fff0b7' },
  'rsa-barrier': { primary: '#ffc857', highlight: '#66dfff' },
  'modular-charge': { primary: '#ff9b42', highlight: '#fff1b5' },
  'rsa-bastion': { primary: '#ffd568', highlight: '#7cecff' },
  'paired-burst': { primary: '#ff61da', highlight: '#65eaff' },
  'twin-detonation': { primary: '#ff4fbf', highlight: '#8cf4ff' },
  'echo-step': { primary: '#de59ff', highlight: '#59e8ff' },
  'twin-conjecture': { primary: '#ff4fd2', highlight: '#8af5ff' },
  'suppressed-shot': { primary: '#a98aff', highlight: '#e9e1ff' },
  'public-key-decoy': { primary: '#896cff', highlight: '#ffca65' },
  'key-exchange': { primary: '#765cff', highlight: '#55e6ff' },
  'shared-secret': { primary: '#9a72ff', highlight: '#ff5ebf' },
  'mersenne-lance': { primary: '#7dff8f', highlight: '#eaffe4' },
  'perfect-trap': { primary: '#4dd97a', highlight: '#d7ff9c' },
  'exponent-leap': { primary: '#63f0a8', highlight: '#c8fff0' },
  'mersenne-cascade': { primary: '#8bff9d', highlight: '#fff59b' },
})

export function powerEffectPalette(
  mechanic: AbilityMechanic,
  sourceTeam?: TeamId,
): PowerPalette {
  const identity = POWER_PALETTES[mechanic]
  if (sourceTeam === 'fracture') {
    return Object.freeze({ primary: FRACTURE_TEAM_COLOR, highlight: identity.primary })
  }
  if (sourceTeam === 'cipher') {
    return Object.freeze({ primary: identity.primary, highlight: CIPHER_TEAM_COLOR })
  }
  return identity
}

export interface ArenaPowerEffect {
  readonly id: number
  readonly heroId: HeroId
  readonly slot: AbilitySlot
  readonly mechanic: AbilityMechanic
  readonly origin: Vec3
  readonly target: Vec3
  readonly direction: Vec3
  readonly color: string
  /** Optional in solo mode; required by network combat for instant team readability. */
  readonly sourceTeam?: TeamId
  readonly hit: boolean
}

export interface PowerEffectProps {
  readonly effect: ArenaPowerEffect
  readonly reducedMotion: boolean
  readonly quality: QualityLevel
  readonly onComplete: (id: number) => void
}

export interface CastSignal {
  readonly serial: number
  readonly slot: AbilitySlot
  readonly atMs: number
}

export interface FirstPersonHandsProps {
  readonly heroId: HeroId
  readonly movementSpeed: number
  readonly reducedMotion: boolean
  readonly castSignal: React.MutableRefObject<CastSignal>
}

export interface QualityTuning {
  readonly segments: number
  readonly coneRays: number
  readonly sparkles: number
  readonly ultimateMarks: number
  readonly lights: boolean
}

export const QUALITY_TUNING: Readonly<Record<QualityLevel, QualityTuning>> = {
  low: { segments: 12, coneRays: 5, sparkles: 0, ultimateMarks: 7, lights: false },
  medium: { segments: 24, coneRays: 7, sparkles: 8, ultimateMarks: 11, lights: true },
  high: { segments: 40, coneRays: 11, sparkles: 16, ultimateMarks: 17, lights: true },
}

export interface EffectFrame {
  readonly origin: THREE.Vector3
  readonly target: THREE.Vector3
  readonly direction: THREE.Vector3
  readonly side: THREE.Vector3
  readonly orientation: THREE.Quaternion
  readonly distance: number
}

export interface EffectVisualProps extends PowerEffectProps {
  readonly ability: AbilityDefinition
  readonly color: string
  readonly highlight: string
  readonly frame: EffectFrame
  readonly tuning: QualityTuning
}

export type TimelineUpdate = (
  progress: number,
  elapsed: number,
  delta: number,
  sceneTime: number,
) => void

export function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback
}

export function clamp01(value: number): number {
  return THREE.MathUtils.clamp(finite(value), 0, 1)
}

export function easeOutCubic(value: number): number {
  const inverse = 1 - clamp01(value)
  return 1 - inverse * inverse * inverse
}

export function pulseEnvelope(progress: number, attack = 0.22): number {
  const normalized = clamp01(progress)
  if (normalized <= attack) return Math.sin(normalized / Math.max(0.001, attack) * Math.PI * 0.5)
  return Math.cos((normalized - attack) / Math.max(0.001, 1 - attack) * Math.PI * 0.5)
}

export function safeVector(value: Vec3): THREE.Vector3 {
  return new THREE.Vector3(finite(value.x), finite(value.y), finite(value.z))
}

export function makeEffectFrame(effect: ArenaPowerEffect): EffectFrame {
  const origin = safeVector(effect.origin)
  const target = safeVector(effect.target)
  const suppliedDirection = safeVector(effect.direction)
  const delta = target.clone().sub(origin)
  let distance = delta.length()
  const direction = distance > 0.0001 ? delta.multiplyScalar(1 / distance) : suppliedDirection

  if (direction.lengthSq() < 0.0001) direction.set(0, 0, -1)
  direction.normalize()

  if (distance <= 0.0001) {
    distance = 0.01
    target.copy(origin).addScaledVector(direction, distance)
  }

  const side = new THREE.Vector3().crossVectors(direction, WORLD_UP)
  if (side.lengthSq() < 0.0001) side.set(1, 0, 0)
  else side.normalize()

  return {
    origin,
    target,
    direction,
    side,
    orientation: new THREE.Quaternion().setFromUnitVectors(FORWARD, direction),
    distance,
  }
}

export function useEffectTimeline(
  effectId: number,
  duration: number,
  reducedMotion: boolean,
  onComplete: (id: number) => void,
  update: TimelineUpdate,
): void {
  const elapsedRef = useRef(0)
  const completeRef = useRef(false)
  const updateRef = useRef(update)
  const onCompleteRef = useRef(onComplete)
  updateRef.current = update
  onCompleteRef.current = onComplete

  useEffect(() => {
    elapsedRef.current = 0
    completeRef.current = false
  }, [effectId])

  useFrame(({ clock }, rawDelta) => {
    if (completeRef.current) return
    const delta = Math.min(Math.max(rawDelta, 0), 0.08)
    elapsedRef.current += delta
    const resolvedDuration = Math.max(0.08, duration * (reducedMotion ? 0.58 : 1))
    const progress = clamp01(elapsedRef.current / resolvedDuration)
    updateRef.current(progress, elapsedRef.current, delta, clock.elapsedTime)
    if (progress < 1 || completeRef.current) return
    completeRef.current = true
    onCompleteRef.current(effectId)
  })
}

export function abilityRange(ability: AbilityDefinition, fallback: number): number {
  if (ability.hitShape.kind === 'ray' || ability.hitShape.kind === 'cone') {
    return Math.max(0.1, ability.hitShape.range)
  }
  return Math.max(0.1, ability.hitShape.maxRange ?? ability.hitShape.radius ?? fallback)
}

export function abilityRadius(ability: AbilityDefinition, fallback: number): number {
  return ability.hitShape.kind === 'radius'
    ? Math.max(0.1, ability.hitShape.radius || fallback)
    : fallback
}

export function disposeRecord(record: Readonly<Record<string, { dispose: () => void }>>): void {
  Object.values(record).forEach((resource) => resource.dispose())
}


/** Exhaustiveness guard shared by the effect and viewmodel switches. */
export function assertNever(value: never): never {
  throw new Error(`Unexpected variant: ${JSON.stringify(value)}`)
}
