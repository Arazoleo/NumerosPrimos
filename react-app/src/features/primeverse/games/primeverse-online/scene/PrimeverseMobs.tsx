import { Billboard, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { QualityLevel } from '../../../graphics/useQualitySettings'
import type { RealmId } from '../shared/realms'
import type { AvatarStateRef } from '../types'

export const PRIMEVERSE_MOB_IDS = [
  'ulam-composite-4',
  'ulam-composite-6',
  'ulam-composite-9',
  'forge-warden-2',
  'forge-warden-3',
  'forge-warden-5',
  'catacomb-null-alpha',
  'catacomb-null-beta',
  'catacomb-null-gamma',
  'catacomb-null-omega',
] as const

export type PrimeverseMobId = (typeof PRIMEVERSE_MOB_IDS)[number]
export type PrimeverseMobRealmId = RealmId | 'sieve-catacombs'
export type PrimeverseMobArchetype = 'composite-drone' | 'factor-warden' | 'null-stalker'
export type PrimeverseMobMode = 'patrol' | 'alert' | 'chase' | 'attack' | 'cooldown'
export type MobPosition = readonly [number, number, number]

export interface PrimeverseMobDefinition {
  readonly id: PrimeverseMobId
  readonly realmId: PrimeverseMobRealmId
  readonly archetype: PrimeverseMobArchetype
  readonly name: string
  readonly family: string
  readonly sigil: string
  readonly home: MobPosition
  readonly accent: string
  readonly patrolRadius: number
  readonly patrolSpeed: number
  readonly chaseSpeed: number
  readonly detectionRadius: number
  readonly lanternDetectionBonus: number
  readonly disengageRadius: number
  readonly attackRange: number
  readonly alertDurationMs: number
  readonly attackCooldownMs: number
  readonly damage: number
}

const createMob = (definition: PrimeverseMobDefinition): PrimeverseMobDefinition => Object.freeze(definition)

/**
 * Canonical encounter roster. Positions are deliberately spaced away from realm
 * spawns and portals so players always get a readable introduction before combat.
 */
export const PRIMEVERSE_MOBS: readonly PrimeverseMobDefinition[] = Object.freeze([
  createMob({
    id: 'ulam-composite-4', realmId: 'ulam-run', archetype: 'composite-drone',
    name: 'Drone Quadrado', family: 'COMPOSTO 2²', sigil: '4', home: [65.5, 0.72, -1.5], accent: '#ff5bc8',
    patrolRadius: 2.3, patrolSpeed: 0.72, chaseSpeed: 2.8, detectionRadius: 5.6,
    lanternDetectionBonus: 0, disengageRadius: 8.4, attackRange: 1.18,
    alertDurationMs: 520, attackCooldownMs: 1_650, damage: 7,
  }),
  createMob({
    id: 'ulam-composite-6', realmId: 'ulam-run', archetype: 'composite-drone',
    name: 'Drone Semiprimo', family: 'COMPOSTO 2×3', sigil: '6', home: [78.2, 0.72, -4.8], accent: '#b873ff',
    patrolRadius: 2.5, patrolSpeed: 0.66, chaseSpeed: 2.9, detectionRadius: 5.8,
    lanternDetectionBonus: 0, disengageRadius: 8.7, attackRange: 1.18,
    alertDurationMs: 560, attackCooldownMs: 1_720, damage: 8,
  }),
  createMob({
    id: 'ulam-composite-9', realmId: 'ulam-run', archetype: 'composite-drone',
    name: 'Drone Ímpar', family: 'COMPOSTO 3²', sigil: '9', home: [70.4, 0.72, -10.3], accent: '#ff7d8f',
    patrolRadius: 2.15, patrolSpeed: 0.76, chaseSpeed: 3, detectionRadius: 5.5,
    lanternDetectionBonus: 0, disengageRadius: 8.5, attackRange: 1.18,
    alertDurationMs: 490, attackCooldownMs: 1_600, damage: 9,
  }),
  createMob({
    id: 'forge-warden-2', realmId: 'factor-forge', archetype: 'factor-warden',
    name: 'Guardião Binário', family: 'FATOR 2', sigil: '2', home: [-78.4, 0.04, -2.2], accent: '#ffb35c',
    patrolRadius: 2.05, patrolSpeed: 0.46, chaseSpeed: 2.25, detectionRadius: 5.2,
    lanternDetectionBonus: 0, disengageRadius: 8, attackRange: 1.2,
    alertDurationMs: 680, attackCooldownMs: 2_050, damage: 11,
  }),
  createMob({
    id: 'forge-warden-3', realmId: 'factor-forge', archetype: 'factor-warden',
    name: 'Guardião Ternário', family: 'FATOR 3', sigil: '3', home: [-66.5, 0.04, -6.4], accent: '#ff7f50',
    patrolRadius: 2.25, patrolSpeed: 0.5, chaseSpeed: 2.35, detectionRadius: 5.4,
    lanternDetectionBonus: 0, disengageRadius: 8.2, attackRange: 1.2,
    alertDurationMs: 650, attackCooldownMs: 1_950, damage: 12,
  }),
  createMob({
    id: 'forge-warden-5', realmId: 'factor-forge', archetype: 'factor-warden',
    name: 'Guardião Pentagonal', family: 'FATOR 5', sigil: '5', home: [-74.1, 0.04, -11.2], accent: '#ffd166',
    patrolRadius: 1.9, patrolSpeed: 0.43, chaseSpeed: 2.15, detectionRadius: 5.1,
    lanternDetectionBonus: 0, disengageRadius: 7.9, attackRange: 1.2,
    alertDurationMs: 720, attackCooldownMs: 2_150, damage: 13,
  }),
  createMob({
    id: 'catacomb-null-alpha', realmId: 'sieve-catacombs', archetype: 'null-stalker',
    name: 'Nulo Alfa', family: 'FORA DA PENEIRA', sigil: '∅', home: [-8, 0.04, -104], accent: '#ff334f',
    patrolRadius: 2.7, patrolSpeed: 0.3, chaseSpeed: 3.45, detectionRadius: 5.8,
    lanternDetectionBonus: 7.8, disengageRadius: 16, attackRange: 1.16,
    alertDurationMs: 820, attackCooldownMs: 2_300, damage: 15,
  }),
  createMob({
    id: 'catacomb-null-beta', realmId: 'sieve-catacombs', archetype: 'null-stalker',
    name: 'Nulo Beta', family: 'FORA DA PENEIRA', sigil: '∅', home: [8, 0.04, -109], accent: '#ff416c',
    patrolRadius: 2.45, patrolSpeed: 0.33, chaseSpeed: 3.55, detectionRadius: 6,
    lanternDetectionBonus: 7.5, disengageRadius: 16, attackRange: 1.16,
    alertDurationMs: 760, attackCooldownMs: 2_200, damage: 16,
  }),
  createMob({
    id: 'catacomb-null-gamma', realmId: 'sieve-catacombs', archetype: 'null-stalker',
    name: 'Nulo Gama', family: 'RESÍDUO ZERO', sigil: '0', home: [-5, 0.04, -115], accent: '#f94172',
    patrolRadius: 2.2, patrolSpeed: 0.28, chaseSpeed: 3.6, detectionRadius: 5.6,
    lanternDetectionBonus: 8.1, disengageRadius: 16.4, attackRange: 1.16,
    alertDurationMs: 880, attackCooldownMs: 2_350, damage: 17,
  }),
  createMob({
    id: 'catacomb-null-omega', realmId: 'sieve-catacombs', archetype: 'null-stalker',
    name: 'Nulo Ômega', family: 'ÚLTIMO RESÍDUO', sigil: 'Ω', home: [6, 0.04, -117], accent: '#ff1744',
    patrolRadius: 1.85, patrolSpeed: 0.24, chaseSpeed: 3.75, detectionRadius: 6.2,
    lanternDetectionBonus: 8.4, disengageRadius: 17, attackRange: 1.18,
    alertDurationMs: 940, attackCooldownMs: 2_500, damage: 19,
  }),
])

export const PRIMEVERSE_MOBS_BY_REALM: Readonly<Record<PrimeverseMobRealmId, readonly PrimeverseMobDefinition[]>> = Object.freeze({
  nexus: Object.freeze([]),
  'ulam-run': Object.freeze(PRIMEVERSE_MOBS.filter((mob) => mob.realmId === 'ulam-run')),
  'factor-forge': Object.freeze(PRIMEVERSE_MOBS.filter((mob) => mob.realmId === 'factor-forge')),
  'sieve-catacombs': Object.freeze(PRIMEVERSE_MOBS.filter((mob) => mob.realmId === 'sieve-catacombs')),
})

export const PRIME_PULSE_RANGE = 6.2
export const MOB_ATTACK_ANIMATION_MS = 240

export interface PrimeverseMobRuntime {
  readonly mode: PrimeverseMobMode
  readonly position: MobPosition
  readonly yaw: number
  readonly modeSinceMs: number
  readonly nextAttackAtMs: number
  readonly defeated: boolean
}

export interface PrimeverseMobStepResult {
  readonly runtime: PrimeverseMobRuntime
  readonly attacked: boolean
}

function stablePhase(id: PrimeverseMobId): number {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0
  return (hash % 6_283) / 1_000
}

function horizontalDistance(a: MobPosition, b: MobPosition): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2])
}

function moveToward(from: MobPosition, to: MobPosition, distance: number): MobPosition {
  const dx = to[0] - from[0]
  const dz = to[2] - from[2]
  const length = Math.hypot(dx, dz)
  if (length <= 0.0001 || distance <= 0) return from
  const ratio = Math.min(1, distance / length)
  return [from[0] + dx * ratio, from[1], from[2] + dz * ratio]
}

function faceTarget(from: MobPosition, target: MobPosition, fallback: number): number {
  const dx = target[0] - from[0]
  const dz = target[2] - from[2]
  if (Math.abs(dx) + Math.abs(dz) < 0.0001) return fallback
  return Math.atan2(dx, dz)
}

export function mobDetectionRadius(definition: PrimeverseMobDefinition, lanternOn: boolean): number {
  return definition.detectionRadius + (lanternOn ? definition.lanternDetectionBonus : 0)
}

export function isMobInsidePrimePulse(
  mobPosition: MobPosition,
  playerPosition: MobPosition,
  radius = PRIME_PULSE_RANGE,
): boolean {
  return Number.isFinite(radius) && radius >= 0 && horizontalDistance(mobPosition, playerPosition) <= radius
}

export function createPrimeverseMobRuntime(
  definition: PrimeverseMobDefinition,
  nowMs = 0,
  defeated = false,
): PrimeverseMobRuntime {
  return {
    mode: 'patrol',
    position: [...definition.home],
    yaw: stablePhase(definition.id),
    modeSinceMs: nowMs,
    nextAttackAtMs: nowMs,
    defeated,
  }
}

/**
 * A deterministic finite-state machine: given the same runtime, time and player
 * position, it always emits the same next frame. It performs no React or Three.js
 * work, which keeps gameplay easy to test and later move to an authoritative host.
 */
export function stepPrimeverseMob(
  current: PrimeverseMobRuntime,
  definition: PrimeverseMobDefinition,
  playerPosition: MobPosition,
  nowMs: number,
  rawDeltaSeconds: number,
  lanternOn: boolean,
): PrimeverseMobStepResult {
  if (current.defeated) return { runtime: current, attacked: false }

  const deltaSeconds = Math.max(0, Math.min(Number.isFinite(rawDeltaSeconds) ? rawDeltaSeconds : 0, 0.1))
  const distanceToPlayer = horizontalDistance(current.position, playerPosition)
  const detectsPlayer = distanceToPlayer <= mobDetectionRadius(definition, lanternOn)
  let mode = current.mode
  let modeSinceMs = current.modeSinceMs
  let nextAttackAtMs = current.nextAttackAtMs
  let attacked = false

  if (mode === 'patrol' && detectsPlayer) {
    mode = 'alert'
    modeSinceMs = nowMs
  } else if (mode === 'alert') {
    if (distanceToPlayer > definition.disengageRadius) {
      mode = 'patrol'
      modeSinceMs = nowMs
    } else if (nowMs - current.modeSinceMs >= definition.alertDurationMs) {
      mode = 'chase'
      modeSinceMs = nowMs
    }
  } else if (mode === 'chase') {
    if (distanceToPlayer > definition.disengageRadius) {
      mode = 'patrol'
      modeSinceMs = nowMs
    } else if (distanceToPlayer <= definition.attackRange && nowMs >= current.nextAttackAtMs) {
      mode = 'attack'
      modeSinceMs = nowMs
      nextAttackAtMs = nowMs + definition.attackCooldownMs
      attacked = true
    }
  } else if (mode === 'attack' && nowMs - current.modeSinceMs >= MOB_ATTACK_ANIMATION_MS) {
    mode = 'cooldown'
    modeSinceMs = nowMs
  } else if (mode === 'cooldown') {
    if (distanceToPlayer > definition.disengageRadius) {
      mode = 'patrol'
      modeSinceMs = nowMs
    } else if (nowMs >= current.nextAttackAtMs) {
      mode = distanceToPlayer <= definition.attackRange ? 'attack' : 'chase'
      modeSinceMs = nowMs
      if (mode === 'attack') {
        nextAttackAtMs = nowMs + definition.attackCooldownMs
        attacked = true
      }
    }
  }

  let position = current.position
  let facingTarget = current.position
  let moveSpeed = 0

  if (mode === 'patrol') {
    const phase = stablePhase(definition.id) + nowMs / 1_000 * definition.patrolSpeed / Math.max(definition.patrolRadius, 0.1)
    facingTarget = [
      definition.home[0] + Math.cos(phase) * definition.patrolRadius,
      definition.home[1],
      definition.home[2] + Math.sin(phase) * definition.patrolRadius,
    ]
    moveSpeed = definition.patrolSpeed
  } else if (mode === 'chase') {
    facingTarget = playerPosition
    moveSpeed = definition.chaseSpeed
  } else if (mode === 'cooldown' && distanceToPlayer > definition.attackRange * 1.35) {
    facingTarget = playerPosition
    moveSpeed = definition.chaseSpeed * 0.58
  } else if (mode === 'alert' || mode === 'attack' || mode === 'cooldown') {
    facingTarget = playerPosition
  }

  if (moveSpeed > 0) position = moveToward(current.position, facingTarget, moveSpeed * deltaSeconds)
  const yaw = faceTarget(position, facingTarget, current.yaw)

  return {
    runtime: { mode, position, yaw, modeSinceMs, nextAttackAtMs, defeated: false },
    attacked,
  }
}

function CompositeDroneVisual({ definition, quality }: {
  readonly definition: PrimeverseMobDefinition
  readonly quality: QualityLevel
}): JSX.Element {
  return (
    <group>
      <mesh castShadow={quality === 'high'}>
        <octahedronGeometry args={[0.58, quality === 'low' ? 0 : 1]} />
        <meshStandardMaterial color="#1a1026" emissive={definition.accent} emissiveIntensity={0.75} metalness={0.72} roughness={0.22} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.78, 0.055, 6, quality === 'low' ? 20 : 36]} />
        <meshBasicMaterial color={definition.accent} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.68, 0.035, 6, quality === 'low' ? 18 : 32]} />
        <meshBasicMaterial color="#7eeeff" transparent opacity={0.72} />
      </mesh>
      <Billboard position={[0, 0.02, 0.6]} follow>
        <Text fontSize={0.42} color="#ffffff" outlineColor="#18061b" outlineWidth={0.035}>{definition.sigil}</Text>
      </Billboard>
      {quality !== 'low' && <pointLight color={definition.accent} intensity={2.6} distance={3.8} decay={2} />}
    </group>
  )
}

function FactorWardenVisual({ definition, quality }: {
  readonly definition: PrimeverseMobDefinition
  readonly quality: QualityLevel
}): JSX.Element {
  return (
    <group>
      <mesh position={[0, 1.18, 0]} castShadow={quality === 'high'}>
        <cylinderGeometry args={[0.38, 0.5, 1.15, 6]} />
        <meshStandardMaterial color="#291b18" emissive={definition.accent} emissiveIntensity={0.28} metalness={0.82} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.94, 0]} castShadow={quality === 'high'}>
        <dodecahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial color="#12141c" emissive={definition.accent} emissiveIntensity={0.55} metalness={0.88} roughness={0.24} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.58, 1.42, 0]} rotation={[0, 0, side * 0.18]} castShadow={quality === 'high'}>
            <boxGeometry args={[0.32, 0.92, 0.34]} />
            <meshStandardMaterial color="#352522" metalness={0.76} roughness={0.34} />
          </mesh>
          <mesh position={[side * 0.28, 0.42, 0]} castShadow={quality === 'high'}>
            <boxGeometry args={[0.34, 0.78, 0.4]} />
            <meshStandardMaterial color="#20191a" metalness={0.7} roughness={0.42} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.55, 0.48]}>
        <circleGeometry args={[0.24, quality === 'low' ? 12 : 24]} />
        <meshBasicMaterial color={definition.accent} />
      </mesh>
      <Billboard position={[0, 1.53, 0.5]} follow>
        <Text fontSize={0.25} color="#1a0c05">{definition.sigil}</Text>
      </Billboard>
    </group>
  )
}

function NullStalkerVisual({ definition, quality }: {
  readonly definition: PrimeverseMobDefinition
  readonly quality: QualityLevel
}): JSX.Element {
  return (
    <group>
      <mesh position={[0, 1.35, 0]} scale={[0.58, 1.75, 0.48]} castShadow={quality === 'high'}>
        <octahedronGeometry args={[0.66, 0]} />
        <meshStandardMaterial color="#030307" emissive="#160008" emissiveIntensity={0.52} roughness={0.82} />
      </mesh>
      <mesh position={[0, 2.52, 0]} scale={[0.48, 0.72, 0.42]}>
        <icosahedronGeometry args={[0.54, 0]} />
        <meshStandardMaterial color="#010104" emissive="#240008" emissiveIntensity={0.44} roughness={0.9} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.2, 2.58, 0.47]} scale={[0.075, 0.045, 0.03]}>
            <sphereGeometry args={[1, 10, 6]} />
            <meshBasicMaterial color={definition.accent} />
          </mesh>
          <mesh position={[side * 0.57, 1.08, 0]} rotation={[0, 0, side * -0.14]}>
            <cylinderGeometry args={[0.08, 0.13, 2.2, 5]} />
            <meshStandardMaterial color="#050509" roughness={0.92} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.5, 0.47]}>
        <ringGeometry args={[0.15, 0.19, 12]} />
        <meshBasicMaterial color={definition.accent} transparent opacity={0.8} />
      </mesh>
      {quality === 'high' && <pointLight position={[0, 2.55, 0.55]} color={definition.accent} intensity={2.4} distance={3.2} decay={2} />}
    </group>
  )
}

function MobVisual({ definition, quality }: {
  readonly definition: PrimeverseMobDefinition
  readonly quality: QualityLevel
}): JSX.Element {
  if (definition.archetype === 'composite-drone') return <CompositeDroneVisual definition={definition} quality={quality} />
  if (definition.archetype === 'factor-warden') return <FactorWardenVisual definition={definition} quality={quality} />
  return <NullStalkerVisual definition={definition} quality={quality} />
}

type MobRuntimeRef = React.MutableRefObject<PrimeverseMobRuntime>

interface PrimeverseMobActorProps {
  readonly definition: PrimeverseMobDefinition
  readonly localAvatar: AvatarStateRef
  readonly quality: QualityLevel
  readonly reducedMotion: boolean
  readonly lanternOn: boolean
  readonly externallyDefeated: boolean
  readonly registerRuntime: (id: PrimeverseMobId, runtime: MobRuntimeRef | null) => void
  readonly onMobAttack: (id: PrimeverseMobId, damage: number) => void
}

function PrimeverseMobActor({
  definition,
  localAvatar,
  quality,
  reducedMotion,
  lanternOn,
  externallyDefeated,
  registerRuntime,
  onMobAttack,
}: PrimeverseMobActorProps): JSX.Element {
  const runtime = useRef(createPrimeverseMobRuntime(definition, 0, externallyDefeated))
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const alert = useRef<THREE.Group>(null)
  const telegraph = useRef<THREE.Mesh>(null)
  const telegraphMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const previousExternalDefeated = useRef(externallyDefeated)

  useEffect(() => {
    registerRuntime(definition.id, runtime)
    return () => registerRuntime(definition.id, null)
  }, [definition.id, registerRuntime])

  useEffect(() => {
    if (externallyDefeated) {
      runtime.current = { ...runtime.current, defeated: true }
    } else if (previousExternalDefeated.current) {
      runtime.current = createPrimeverseMobRuntime(definition)
      if (root.current) {
        root.current.visible = true
        root.current.scale.setScalar(1)
      }
    }
    previousExternalDefeated.current = externallyDefeated
  }, [definition, externallyDefeated])

  useFrame(({ clock }, rawDelta) => {
    const nowMs = clock.elapsedTime * 1_000
    const current = runtime.current

    if (current.defeated) {
      if (root.current) {
        const nextScale = THREE.MathUtils.damp(root.current.scale.x, 0, reducedMotion ? 24 : 8, rawDelta)
        root.current.scale.setScalar(nextScale)
        root.current.rotation.z += (reducedMotion ? 0 : rawDelta * 3.2)
        if (nextScale < 0.018) root.current.visible = false
      }
      return
    }

    const player = localAvatar.current.position
    const result = stepPrimeverseMob(current, definition, player, nowMs, rawDelta, lanternOn)
    runtime.current = result.runtime

    if (result.attacked) onMobAttack(definition.id, definition.damage)

    if (root.current) {
      root.current.position.set(...result.runtime.position)
      root.current.rotation.y = result.runtime.yaw
    }

    if (body.current) {
      const stateLift = result.runtime.mode === 'alert' ? 0.13 : result.runtime.mode === 'attack' ? -0.12 : 0
      const idleLift = reducedMotion ? 0 : Math.sin(clock.elapsedTime * (definition.archetype === 'null-stalker' ? 1.7 : 3.2) + stablePhase(definition.id)) * 0.07
      body.current.position.y = stateLift + idleLift
      const attackScale = result.runtime.mode === 'attack' ? 1.13 : result.runtime.mode === 'alert' ? 1.06 : 1
      body.current.scale.setScalar(THREE.MathUtils.damp(body.current.scale.x, attackScale, 13, rawDelta))
    }

    if (alert.current) {
      alert.current.visible = result.runtime.mode === 'alert' || result.runtime.mode === 'chase'
      alert.current.position.y = reducedMotion ? 3.18 : 3.18 + Math.sin(clock.elapsedTime * 5) * 0.08
    }

    if (telegraph.current && telegraphMaterial.current) {
      const attacking = result.runtime.mode === 'attack'
      const charging = result.runtime.mode === 'alert'
      telegraph.current.visible = attacking || charging
      const elapsed = Math.max(0, nowMs - result.runtime.modeSinceMs)
      const progress = attacking
        ? Math.min(1, elapsed / MOB_ATTACK_ANIMATION_MS)
        : Math.min(1, elapsed / Math.max(1, definition.alertDurationMs))
      telegraph.current.scale.setScalar(attacking ? 0.65 + progress * 1.7 : 1.5 - progress * 0.72)
      telegraphMaterial.current.opacity = attacking ? 0.78 * (1 - progress) : 0.24 + progress * 0.42
    }
  })

  const labelHeight = definition.archetype === 'null-stalker' ? 3.65 : definition.archetype === 'factor-warden' ? 2.78 : 1.72

  return (
    <group ref={root} position={[definition.home[0], definition.home[1], definition.home[2]]}>
      <group ref={body}>
        <MobVisual definition={definition} quality={quality} />
      </group>
      <group ref={alert} visible={false} position={[0, labelHeight, 0]}>
        <Billboard follow>
          <Text fontSize={0.48} color="#ffdc67" outlineColor="#170804" outlineWidth={0.055}>!</Text>
          <Text position={[0, -0.42, 0]} fontSize={0.105} letterSpacing={0.11} color={definition.accent} outlineColor="#050509" outlineWidth={0.018}>
            {definition.family}
          </Text>
        </Billboard>
      </group>
      <mesh ref={telegraph} visible={false} position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.78, 0.9, quality === 'low' ? 20 : 40]} />
        <meshBasicMaterial ref={telegraphMaterial} color={definition.accent} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

export interface PrimeverseMobsProps {
  readonly localAvatar: AvatarStateRef
  readonly currentRealmId: PrimeverseMobRealmId | null
  readonly quality?: QualityLevel
  readonly reducedMotion: boolean
  readonly lanternOn: boolean
  readonly pulseSerial: number
  readonly defeatedMobIds: readonly string[]
  readonly onMobAttack: (id: PrimeverseMobId, damage: number) => void
  readonly onMobDefeated: (id: PrimeverseMobId) => void
}

/**
 * Client-side encounter renderer. Only the current realm's tiny roster mounts and
 * simulates. The parent owns health/quest persistence through the two callbacks.
 */
export default function PrimeverseMobs({
  localAvatar,
  currentRealmId,
  quality = 'medium',
  reducedMotion,
  lanternOn,
  pulseSerial,
  defeatedMobIds,
  onMobAttack,
  onMobDefeated,
}: PrimeverseMobsProps): JSX.Element | null {
  const runtimeById = useRef(new Map<PrimeverseMobId, MobRuntimeRef>())
  const lastPulseSerial = useRef(pulseSerial)
  const defeated = useMemo(() => new Set(defeatedMobIds), [defeatedMobIds])
  const activeDefinitions = useMemo(
    () => currentRealmId ? PRIMEVERSE_MOBS_BY_REALM[currentRealmId] : [],
    [currentRealmId],
  )

  const registerRuntime = useMemo(() => (
    (id: PrimeverseMobId, mobRuntime: MobRuntimeRef | null) => {
      if (mobRuntime) runtimeById.current.set(id, mobRuntime)
      else runtimeById.current.delete(id)
    }
  ), [])

  useFrame(() => {
    if (lastPulseSerial.current === pulseSerial) return
    lastPulseSerial.current = pulseSerial
    const playerPosition = localAvatar.current.position

    for (const definition of activeDefinitions) {
      const mobRuntime = runtimeById.current.get(definition.id)
      if (!mobRuntime || mobRuntime.current.defeated || defeated.has(definition.id)) continue
      if (!isMobInsidePrimePulse(mobRuntime.current.position, playerPosition)) continue

      mobRuntime.current = { ...mobRuntime.current, defeated: true }
      onMobDefeated(definition.id)
    }
  })

  if (!currentRealmId || activeDefinitions.length === 0) return null

  return (
    <group name={`primeverse-mobs-${currentRealmId}`}>
      {activeDefinitions.map((definition) => (
        <PrimeverseMobActor
          key={definition.id}
          definition={definition}
          localAvatar={localAvatar}
          quality={quality}
          reducedMotion={reducedMotion}
          lanternOn={lanternOn}
          externallyDefeated={defeated.has(definition.id)}
          registerRuntime={registerRuntime}
          onMobAttack={onMobAttack}
        />
      ))}
    </group>
  )
}
