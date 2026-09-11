import { Billboard, Float, Sparkles, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { QualityLevel, QualityProfile } from '../../../graphics/useQualitySettings'
import {
  FACTOR_NODES,
  FACTOR_REACTOR_CONSOLE,
  FACTOR_REACTOR_CORE,
  FACTOR_REACTOR_TARGETS,
  findFactorNodeAtPosition,
  type FactorNode,
} from '../minigames/factorReactor'
import {
  findUlamTargetAtPosition,
  ULAM_PRIME_SEQUENCE,
  ULAM_START_CONSOLE,
  ULAM_TARGETS,
  type UlamPrimeTarget,
  type UlamTargetId,
} from '../minigames/ulamPrimeRun'
import {
  PORTAL_ROUTES,
  REALMS,
  type PortalId,
  type PortalRoute,
  type RealmDefinition,
  type RealmId,
  type RealmPosition,
} from '../shared/realms'

const TAU = Math.PI * 2
const GROUND_Y = 0.04
export const ULAM_RUN_TILE_HEIGHT = 0.12
export const GAME_WORLD_CONSOLE_RADIUS = 0.86
export const PORTAL_TRIGGER_RADIUS = 2.25

function requireRealm(id: RealmId): RealmDefinition {
  const realm = REALMS.find((candidate) => candidate.id === id)
  if (!realm) throw new Error(`Missing Primeverse realm definition: ${id}`)
  return realm
}

const ULAM_REALM = requireRealm('ulam-run')
const FORGE_REALM = requireRealm('factor-forge')

export interface RealmPlayArea {
  readonly realmId: RealmId
  readonly center: RealmPosition
  readonly radius: number
  readonly groundY: number
  readonly fallY: number
}

export interface RealmCircleBlocker {
  readonly id: string
  readonly realmId: RealmId
  readonly x: number
  readonly z: number
  readonly radius: number
}

export type UlamRunTileDefinition = UlamPrimeTarget

export type EuclidPylonDefinition = FactorNode

export interface RealmGameConsoleDefinition {
  readonly id: string
  readonly position: RealmPosition
  readonly interactionRadius: number
}

/** Realm boundaries shared by rendering, falling/respawn logic and server validation. */
export const GAME_WORLD_PLAY_AREAS: Readonly<Record<'ulam-run' | 'factor-forge', RealmPlayArea>> = Object.freeze({
  'ulam-run': Object.freeze({
    realmId: 'ulam-run',
    center: ULAM_REALM.center,
    radius: ULAM_REALM.radius,
    groundY: GROUND_Y,
    fallY: -8,
  }),
  'factor-forge': Object.freeze({
    realmId: 'factor-forge',
    center: FORGE_REALM.center,
    radius: FORGE_REALM.radius,
    groundY: GROUND_Y,
    fallY: -8,
  }),
})

/** Rendering aliases: minigames remain the single source of IDs, values and positions. */
export const ULAM_RUN_TILES: readonly UlamRunTileDefinition[] = ULAM_TARGETS

export const ULAM_RUN_CHECKPOINTS = Object.freeze(
  ULAM_PRIME_SEQUENCE.map((prime, checkpoint) => Object.freeze({
    checkpoint,
    correctTileId: ULAM_RUN_TILES.find((tile) => tile.value === prime)?.id ?? '',
    prime,
  })),
)

export const ULAM_RUN_START_CONSOLE: RealmGameConsoleDefinition = ULAM_START_CONSOLE

export const EUCLID_REACTOR_POSITION = FACTOR_REACTOR_CORE.position

export const EUCLID_FORGE_CONSOLE: RealmGameConsoleDefinition = FACTOR_REACTOR_CONSOLE

export const EUCLID_PYLONS: readonly EuclidPylonDefinition[] = FACTOR_NODES

/** Solid silhouettes deliberately match the visible reactor, pylons and race gate posts. */
export const GAME_WORLD_BLOCKERS: readonly RealmCircleBlocker[] = Object.freeze([
  Object.freeze({ id: ULAM_RUN_START_CONSOLE.id, realmId: 'ulam-run', x: ULAM_RUN_START_CONSOLE.position[0], z: ULAM_RUN_START_CONSOLE.position[2], radius: GAME_WORLD_CONSOLE_RADIUS }),
  Object.freeze({ id: EUCLID_FORGE_CONSOLE.id, realmId: 'factor-forge', x: EUCLID_FORGE_CONSOLE.position[0], z: EUCLID_FORGE_CONSOLE.position[2], radius: GAME_WORLD_CONSOLE_RADIUS }),
  Object.freeze({ id: FACTOR_REACTOR_CORE.id, realmId: 'factor-forge', x: EUCLID_REACTOR_POSITION[0], z: EUCLID_REACTOR_POSITION[2], radius: FACTOR_REACTOR_CORE.collisionRadius }),
  ...EUCLID_PYLONS.map((pylon) => Object.freeze({
    id: pylon.id,
    realmId: 'factor-forge' as const,
    x: pylon.position[0],
    z: pylon.position[2],
    radius: 0.82,
  })),
])

export const ulamTileAtPosition = findUlamTargetAtPosition
export const euclidPylonAtPosition = findFactorNodeAtPosition

interface WorldRenderingProps {
  readonly quality: QualityLevel
  readonly profile: QualityProfile
  readonly reducedMotion: boolean
}

interface RealmTitleProps {
  readonly position: RealmPosition
  readonly name: string
  readonly subtitle: string
  readonly accent: string
  readonly compact?: boolean
}

function RealmTitle({ position, name, subtitle, accent, compact = false }: RealmTitleProps): JSX.Element {
  return (
    <Billboard position={[position[0], position[1], position[2]]} follow>
      <Text
        fontSize={compact ? 0.36 : 0.56}
        color="#f5f8ff"
        anchorY="bottom"
        outlineColor="#050711"
        outlineWidth={0.04}
      >
        {name.toUpperCase()}
      </Text>
      <Text position={[0, -0.14, 0]} fontSize={compact ? 0.105 : 0.14} letterSpacing={0.22} color={accent} anchorY="top">
        {subtitle}
      </Text>
    </Billboard>
  )
}

function RealmGameConsole({ definition, title, detail, accent, active, shadows, onSelect }: {
  readonly definition: RealmGameConsoleDefinition
  readonly title: string
  readonly detail: string
  readonly accent: string
  readonly active: boolean
  readonly shadows: boolean
  readonly onSelect?: () => void
}): JSX.Element {
  return (
    <group
      position={[definition.position[0], 0, definition.position[2]]}
      onClick={onSelect ? (event) => {
        event.stopPropagation()
        onSelect()
      } : undefined}
    >
      <mesh position={[0, 0.45, 0]} castShadow={shadows} receiveShadow>
        <cylinderGeometry args={[0.66, 0.84, 0.9, 6]} />
        <meshStandardMaterial color="#111626" emissive={accent} emissiveIntensity={active ? 0.9 : 0.26} metalness={0.76} roughness={0.28} />
      </mesh>
      <mesh position={[0, 1.08, 0.05]} rotation={[-0.22, 0, 0]}>
        <boxGeometry args={[1.44, 0.82, 0.12]} />
        <meshStandardMaterial color="#07101c" emissive={accent} emissiveIntensity={active ? 1.35 : 0.52} metalness={0.62} roughness={0.25} />
      </mesh>
      <Billboard position={[0, 1.96, 0]} follow>
        <Text fontSize={0.2} color={active ? '#ffffff' : accent} outlineColor="#060812" outlineWidth={0.025}>{title}</Text>
        <Text position={[0, -0.26, 0]} fontSize={0.1} letterSpacing={0.15} color="#aab6cc">{detail}</Text>
      </Billboard>
      <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.82, 0.88, 24]} />
        <meshBasicMaterial color={accent} transparent opacity={active ? 0.8 : 0.38} />
      </mesh>
    </group>
  )
}

function ArenaSpines({ quality, accent }: { readonly quality: QualityLevel; readonly accent: string }): JSX.Element {
  const count = quality === 'high' ? 24 : quality === 'medium' ? 14 : 8
  const bodies = useRef<THREE.InstancedMesh>(null)
  const caps = useRef<THREE.InstancedMesh>(null)
  const entries = useMemo(() => Array.from({ length: count }, (_, index) => {
    const angle = index / count * TAU
    const height = 1.2 + ((index * 7) % 5) * 0.42
    return { angle, height, radius: 16.35 + (index % 2) * 0.5 }
  }), [count])

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    entries.forEach(({ angle, height, radius }, index) => {
      dummy.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius)
      dummy.rotation.set(0.08 * Math.sin(index), -angle, (index % 2 ? -1 : 1) * 0.09)
      dummy.scale.set(0.42, height, 0.7)
      dummy.updateMatrix()
      bodies.current?.setMatrixAt(index, dummy.matrix)

      dummy.position.y = height + 0.08
      dummy.scale.set(0.49, 0.08, 0.76)
      dummy.updateMatrix()
      caps.current?.setMatrixAt(index, dummy.matrix)
    })
    if (bodies.current) {
      bodies.current.instanceMatrix.needsUpdate = true
      bodies.current.computeBoundingSphere()
    }
    if (caps.current) {
      caps.current.instanceMatrix.needsUpdate = true
      caps.current.computeBoundingSphere()
    }
  }, [entries])

  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, entries.length]} castShadow={quality === 'high'}>
        <coneGeometry args={[1, 1, 5]} />
        <meshStandardMaterial color="#171226" metalness={0.64} roughness={0.42} />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, entries.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={accent} transparent opacity={0.55} />
      </instancedMesh>
    </group>
  )
}

function RiftVein({ accent, offset = 0 }: { readonly accent: string; readonly offset?: number }): JSX.Element {
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(-14.8, 0.026, -5.8 + offset),
    new THREE.Vector3(-9.2, 0.035, -3.4 + offset),
    new THREE.Vector3(-4.5, 0.028, -5 + offset),
    new THREE.Vector3(0.8, 0.04, -3.7 + offset),
    new THREE.Vector3(5.2, 0.03, -5.3 + offset),
    new THREE.Vector3(10.1, 0.035, -3.1 + offset),
    new THREE.Vector3(14.7, 0.025, -4.8 + offset),
  ]), [offset])

  return (
    <mesh>
      <tubeGeometry args={[curve, 42, offset === 0 ? 0.1 : 0.045, 5, false]} />
      <meshBasicMaterial color={accent} transparent opacity={offset === 0 ? 0.72 : 0.34} depthWrite={false} />
    </mesh>
  )
}

function UlamTile({
  tile,
  selected,
  targeted,
  failed,
  completed,
  revealSolution,
  shadows,
  onSelect,
}: {
  readonly tile: UlamRunTileDefinition
  readonly selected: boolean
  readonly targeted: boolean
  readonly failed: boolean
  readonly completed: boolean
  readonly revealSolution: boolean
  readonly shadows: boolean
  readonly onSelect?: (tile: UlamRunTileDefinition) => void
}): JSX.Element {
  const solved = completed && tile.kind === 'prime'
  const revealed = revealSolution && tile.kind === 'prime'
  const accent = failed ? '#ff496f' : solved ? '#74ffbb' : targeted ? '#ffffff' : selected ? '#a9f7ff' : revealed ? '#ff6ec7' : '#70558f'
  const emissive = failed ? '#e30d45' : solved ? '#16b96c' : targeted ? '#7c44d6' : selected ? '#42dff5' : revealed ? '#d72394' : '#24163d'

  return (
    <group
      position={[tile.position[0], 0.08, tile.position[2]]}
      onClick={onSelect ? (event) => {
        event.stopPropagation()
        onSelect(tile)
      } : undefined}
    >
      <mesh castShadow={shadows} receiveShadow>
        <cylinderGeometry args={[tile.triggerRadius * 0.86, tile.triggerRadius, ULAM_RUN_TILE_HEIGHT, 6]} />
        <meshStandardMaterial
          color={failed ? '#401020' : '#171427'}
          emissive={emissive}
          emissiveIntensity={selected || targeted || solved ? 1.8 : failed || revealed ? 1.25 : 0.45}
          metalness={0.62}
          roughness={0.34}
        />
      </mesh>
      <mesh position={[0, ULAM_RUN_TILE_HEIGHT / 2 + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[tile.triggerRadius * 0.67, tile.triggerRadius * 0.73, 6]} />
        <meshBasicMaterial color={accent} transparent opacity={0.82} depthWrite={false} />
      </mesh>
      <Text position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.58} color={accent} outlineColor="#080511" outlineWidth={0.025}>
        {tile.value}
      </Text>
      {targeted && (
        <Billboard position={[0, 1.05, 0]} follow>
          <Text fontSize={0.15} letterSpacing={0.16} color="#ffffff">PRÓXIMO</Text>
        </Billboard>
      )}
    </group>
  )
}

export interface UlamRunWorldProps extends WorldRenderingProps {
  readonly activeTileId?: UlamTargetId | null
  readonly failedTileId?: UlamTargetId | null
  readonly collectedTargetIds?: readonly UlamTargetId[]
  readonly currentTargetId?: UlamTargetId | null
  readonly revealSolution?: boolean
  readonly startConsoleActive?: boolean
  readonly onTileSelect?: (tile: UlamRunTileDefinition) => void
  readonly onStartSelect?: () => void
}

/** Fenda de Ulam: a short, readable three-lane race where composites are physical decoys. */
export function UlamRunWorld({
  quality,
  profile,
  reducedMotion,
  activeTileId = null,
  failedTileId = null,
  collectedTargetIds = [],
  currentTargetId = null,
  revealSolution = false,
  startConsoleActive = false,
  onTileSelect,
  onStartSelect,
}: UlamRunWorldProps): JSX.Element {
  const collected = useMemo(() => new Set(collectedTargetIds), [collectedTargetIds])

  return (
    <group>
      <pointLight position={[ULAM_REALM.center[0], 5.5, ULAM_REALM.center[2] - 2]} color="#ff4fbd" intensity={quality === 'low' ? 7 : 12} distance={25} decay={2} />
      <group position={ULAM_REALM.center as [number, number, number]}>
        <mesh position={[0, -0.22, 0]} receiveShadow>
          <cylinderGeometry args={[17.25, 18.1, 0.44, quality === 'low' ? 32 : 64]} />
          <meshStandardMaterial color="#090713" roughness={0.82} metalness={0.35} />
        </mesh>
        {[11.6, 15.3, 17.3].map((radius, index) => (
          <mesh key={radius} position={[0, 0.008 + index * 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[radius - 0.035, radius + 0.035, quality === 'low' ? 48 : 96]} />
            <meshBasicMaterial color={index === 1 ? '#5e377e' : '#bb3e91'} transparent opacity={0.3 - index * 0.045} />
          </mesh>
        ))}
        <ArenaSpines quality={quality} accent="#ff6ec7" />
        <RiftVein accent="#ff39b3" />
        {quality === 'high' && <RiftVein accent="#7055ff" offset={1.1} />}
        {quality !== 'low' && (
          <Sparkles
            count={quality === 'high' ? 34 : 18}
            scale={[31, 7, 31]}
            position={[0, 2.4, 0]}
            size={1.45}
            speed={reducedMotion ? 0 : 0.13}
            color="#ff85d1"
            opacity={0.42}
          />
        )}
        <RealmTitle position={[0, 5.1, 11.4]} name={ULAM_REALM.name} subtitle={ULAM_REALM.subtitle} accent={ULAM_REALM.accent} />
        <Billboard position={[0, 2.25, 9.4]} follow>
          <Text fontSize={0.17} letterSpacing={0.18} color="#d0abc8">ATRAVESSE OS PRIMOS NA ORDEM</Text>
        </Billboard>
      </group>

      {ULAM_RUN_TILES.map((tile) => (
        <UlamTile
          key={tile.id}
          tile={tile}
          selected={activeTileId === tile.id}
          targeted={currentTargetId === tile.id}
          failed={failedTileId === tile.id}
          completed={collected.has(tile.id)}
          revealSolution={revealSolution}
          shadows={profile.shadows}
          onSelect={onTileSelect}
        />
      ))}
      <RealmGameConsole
        definition={ULAM_RUN_START_CONSOLE}
        title={startConsoleActive ? 'CORRIDA ATIVA' : 'INICIAR CORRIDA'}
        detail={`${ULAM_PRIME_SEQUENCE.length} PRIMOS · 35 SEGUNDOS`}
        accent={ULAM_REALM.accent}
        active={startConsoleActive}
        shadows={profile.shadows}
        onSelect={onStartSelect}
      />
    </group>
  )
}

function EnergyBeam({ from, to, accent }: {
  readonly from: RealmPosition
  readonly to: RealmPosition
  readonly accent: string
}): JSX.Element {
  const transform = useMemo(() => {
    const start = new THREE.Vector3(...from)
    const end = new THREE.Vector3(...to)
    const direction = end.clone().sub(start)
    const midpoint = start.clone().add(end).multiplyScalar(0.5)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    )
    return { midpoint, quaternion, length: direction.length() }
  }, [from, to])

  return (
    <mesh position={transform.midpoint} quaternion={transform.quaternion}>
      <cylinderGeometry args={[0.035, 0.07, transform.length, 6]} />
      <meshBasicMaterial color={accent} transparent opacity={0.78} depthWrite={false} />
    </mesh>
  )
}

function EuclidReactor({ activeCount, reducedMotion, quality }: {
  readonly activeCount: number
  readonly reducedMotion: boolean
  readonly quality: QualityLevel
}): JSX.Element {
  const orbit = useRef<THREE.Group>(null)
  const core = useRef<THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial>>(null)
  const energy = activeCount / EUCLID_PYLONS.length

  useFrame(({ clock }, delta) => {
    if (orbit.current && !reducedMotion) orbit.current.rotation.y += delta * (0.22 + energy * 0.68)
    if (core.current) {
      const pulse = reducedMotion ? 1 : 1 + Math.sin(clock.elapsedTime * (2.2 + energy * 4)) * (0.025 + energy * 0.055)
      core.current.scale.setScalar(pulse)
      core.current.material.emissiveIntensity = 1.3 + energy * 2.4
    }
  })

  return (
    <group position={EUCLID_REACTOR_POSITION as [number, number, number]}>
      <mesh position={[0, 0.44, 0]} castShadow={quality === 'high'} receiveShadow>
        <cylinderGeometry args={[2.02, 2.18, 0.88, 12]} />
        <meshStandardMaterial color="#211711" emissive="#5b2f13" emissiveIntensity={0.55} metalness={0.78} roughness={0.29} />
      </mesh>
      <mesh position={[0, 0.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.42, 1.72, 48]} />
        <meshBasicMaterial color="#ffac5d" transparent opacity={0.72} depthWrite={false} />
      </mesh>
      <group ref={orbit} position={[0, 2.42, 0]}>
        <mesh ref={core}>
          <icosahedronGeometry args={[1.05, quality === 'low' ? 0 : 1]} />
          <meshStandardMaterial color="#ffd28d" emissive="#f06b23" emissiveIntensity={1.3} metalness={0.66} roughness={0.16} />
        </mesh>
        {[1.55, 2.05].map((radius, index) => (
          <mesh key={radius} rotation={[index * 0.72, index * 0.44, Math.PI / 2]}>
            <torusGeometry args={[radius, 0.035, 6, quality === 'low' ? 32 : 64]} />
            <meshBasicMaterial color={index ? '#ffe0a3' : '#ff8b48'} transparent opacity={0.72} />
          </mesh>
        ))}
      </group>
      <pointLight position={[0, 2.5, 0]} color="#ff944d" intensity={quality === 'low' ? 9 : 15 + energy * 9} distance={18} decay={2} />
    </group>
  )
}

function euclidPylonVisualHeight(pylon: EuclidPylonDefinition): number {
  const index = FACTOR_NODES.findIndex((candidate) => candidate.id === pylon.id)
  return 2.3 + Math.max(0, index) * 0.27
}

function FactorPylon({ pylon, active, targeted, shadows, reducedMotion, onSelect }: {
  readonly pylon: EuclidPylonDefinition
  readonly active: boolean
  readonly targeted: boolean
  readonly shadows: boolean
  readonly reducedMotion: boolean
  readonly onSelect?: (pylon: EuclidPylonDefinition) => void
}): JSX.Element {
  const accent = active ? '#fff2ad' : targeted ? '#ffffff' : '#ffba6c'
  const height = euclidPylonVisualHeight(pylon)
  return (
    <group
      position={[pylon.position[0], 0, pylon.position[2]]}
      onClick={onSelect ? (event) => {
        event.stopPropagation()
        onSelect(pylon)
      } : undefined}
    >
      <mesh position={[0, 0.21, 0]} castShadow={shadows} receiveShadow>
        <cylinderGeometry args={[0.7, 0.82, 0.42, 8]} />
        <meshStandardMaterial color="#241a14" emissive="#613819" emissiveIntensity={active ? 1.15 : targeted ? 0.78 : 0.42} metalness={0.72} roughness={0.32} />
      </mesh>
      <mesh position={[0, height / 2 + 0.38, 0]} castShadow={shadows}>
        <cylinderGeometry args={[0.26, 0.43, height, 6]} />
        <meshStandardMaterial color={active ? '#8a5a22' : '#38261b'} emissive={active ? '#ff8c32' : '#512c16'} emissiveIntensity={active ? 1.65 : 0.58} metalness={0.75} roughness={0.25} />
      </mesh>
      <Float speed={reducedMotion ? 0 : 1.25} floatIntensity={reducedMotion ? 0 : 0.18} rotationIntensity={reducedMotion ? 0 : 0.08}>
        <mesh position={[0, height + 0.63, 0]}>
          <octahedronGeometry args={[0.42, 0]} />
          <meshStandardMaterial color={accent} emissive={active ? '#ffbb2f' : '#bf5b24'} emissiveIntensity={active ? 2.8 : 1.15} roughness={0.17} />
        </mesh>
      </Float>
      <Billboard position={[0, height + 1.36, 0]} follow>
        <Text fontSize={0.48} color={accent} outlineColor="#120a05" outlineWidth={0.035}>{pylon.factor}</Text>
      </Billboard>
      <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.81, 0.87, 32]} />
        <meshBasicMaterial color={accent} transparent opacity={active ? 0.82 : targeted ? 0.68 : 0.36} />
      </mesh>
    </group>
  )
}

function ForgeButtresses({ quality, shadows }: { readonly quality: QualityLevel; readonly shadows: boolean }): JSX.Element {
  const count = quality === 'high' ? 12 : quality === 'medium' ? 8 : 6
  return (
    <group position={FORGE_REALM.center as [number, number, number]}>
      {Array.from({ length: count }, (_, index) => {
        const angle = index / count * TAU
        const radius = 15.9
        const height = 2.6 + (index % 3) * 0.62
        return (
          <group key={index} position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]} rotation={[0, -angle, 0]}>
            <mesh position={[0, height / 2, 0]} castShadow={shadows}>
              <boxGeometry args={[0.72, height, 1.22]} />
              <meshStandardMaterial color="#251b16" emissive="#442415" emissiveIntensity={0.35} metalness={0.63} roughness={0.46} />
            </mesh>
            <mesh position={[0, height * 0.72, -0.64]}>
              <boxGeometry args={[0.78, 0.055, 0.08]} />
              <meshBasicMaterial color="#ff9b55" transparent opacity={0.54} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

export interface EuclidForgeWorldProps extends WorldRenderingProps {
  readonly activatedPrimes?: readonly number[]
  readonly currentTargetPrime?: number | null
  readonly targetValue?: number
  readonly consoleActive?: boolean
  readonly onPylonSelect?: (pylon: EuclidPylonDefinition) => void
  readonly onConsoleSelect?: () => void
}

/** Forja de Euclides: a radial co-op reactor with one tactile pylon per prime factor. */
export function EuclidForgeWorld({
  quality,
  profile,
  reducedMotion,
  activatedPrimes = [],
  currentTargetPrime = null,
  targetValue = FACTOR_REACTOR_TARGETS[0],
  consoleActive = false,
  onPylonSelect,
  onConsoleSelect,
}: EuclidForgeWorldProps): JSX.Element {
  const active = useMemo(() => new Set(activatedPrimes), [activatedPrimes])
  const activeCount = EUCLID_PYLONS.filter((pylon) => active.has(pylon.factor)).length

  return (
    <group>
      <group position={FORGE_REALM.center as [number, number, number]}>
        <mesh position={[0, -0.22, 0]} receiveShadow>
          <cylinderGeometry args={[17.2, 18.1, 0.44, quality === 'low' ? 32 : 64]} />
          <meshStandardMaterial color="#100c0a" roughness={0.83} metalness={0.42} />
        </mesh>
        {[6.6, 11.8, 17.2].map((radius, index) => (
          <mesh key={radius} position={[0, 0.01 + index * 0.002, -2.4]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[radius - 0.045, radius + 0.045, quality === 'low' ? 48 : 96]} />
            <meshBasicMaterial color={index === 0 ? '#ffb264' : '#6d3820'} transparent opacity={0.55 - index * 0.12} />
          </mesh>
        ))}
        {EUCLID_PYLONS.map((pylon) => {
          const dx = pylon.position[0] - FORGE_REALM.center[0]
          const dz = pylon.position[2] - FORGE_REALM.center[2]
          return (
            <mesh key={`path-${pylon.id}`} position={[dx / 2, 0.018, (dz - 2.4) / 2]} rotation={[0, -Math.atan2(dz + 2.4, dx), 0]}>
              <boxGeometry args={[Math.hypot(dx, dz + 2.4), 0.025, 0.075]} />
              <meshBasicMaterial color="#a94e27" transparent opacity={0.42} />
            </mesh>
          )
        })}
        <RealmTitle position={[0, 5.45, 11.4]} name={FORGE_REALM.name} subtitle={FORGE_REALM.subtitle} accent={FORGE_REALM.accent} />
        {quality !== 'low' && (
          <Sparkles
            count={quality === 'high' ? 30 : 16}
            scale={[31, 8, 31]}
            position={[0, 2.8, 0]}
            size={1.3}
            speed={reducedMotion ? 0 : 0.1}
            color="#ffac6b"
            opacity={0.35}
          />
        )}
      </group>

      <ForgeButtresses quality={quality} shadows={profile.shadows} />
      <EuclidReactor activeCount={activeCount} reducedMotion={reducedMotion} quality={quality} />
      {EUCLID_PYLONS.map((pylon) => (
        <FactorPylon
          key={pylon.id}
          pylon={pylon}
          active={active.has(pylon.factor)}
          targeted={currentTargetPrime === pylon.factor}
          shadows={profile.shadows}
          reducedMotion={reducedMotion}
          onSelect={onPylonSelect}
        />
      ))}
      <RealmGameConsole
        definition={EUCLID_FORGE_CONSOLE}
        title={consoleActive ? 'REATOR ATIVO' : 'INICIAR REATOR'}
        detail={`ALVO ${targetValue}`}
        accent={FORGE_REALM.accent}
        active={consoleActive}
        shadows={profile.shadows}
        onSelect={onConsoleSelect}
      />
      {EUCLID_PYLONS.filter((pylon) => active.has(pylon.factor)).map((pylon) => (
        <EnergyBeam
          key={`beam-${pylon.id}`}
          from={[pylon.position[0], euclidPylonVisualHeight(pylon) + 0.65, pylon.position[2]]}
          to={[EUCLID_REACTOR_POSITION[0], 2.42, EUCLID_REACTOR_POSITION[2]]}
          accent="#ffd477"
        />
      ))}
      <Billboard position={[FORGE_REALM.center[0], 5.8, FORGE_REALM.center[2] - 2.4]} follow>
        <mesh position={[0, 0, -0.04]}>
          <boxGeometry args={[4.8, 1.1, 0.07]} />
          <meshStandardMaterial color="#160e09" emissive="#6c3215" emissiveIntensity={0.72} transparent opacity={0.88} metalness={0.61} roughness={0.3} />
        </mesh>
        <Text position={[0, 0.23, 0]} fontSize={0.16} letterSpacing={0.18} color="#d89c72">NÚMERO DO REATOR</Text>
        <Text position={[0, -0.17, 0]} fontSize={0.38} color={activeCount === EUCLID_PYLONS.length ? '#fff2ad' : '#ffba6c'}>
          {`${targetValue} = ${activeCount === 0 ? '?' : EUCLID_PYLONS.filter((pylon) => active.has(pylon.factor)).map((pylon) => pylon.factor).join(' × ')}`}
        </Text>
      </Billboard>
    </group>
  )
}

function portalDestinationName(route: PortalRoute): string {
  return route.displayName ?? requireRealm(route.toRealm).name
}

function portalFacing(route: PortalRoute): number {
  const sourceRealm = requireRealm(route.fromRealm)
  const dx = sourceRealm.center[0] - route.source[0]
  const dz = sourceRealm.center[2] - route.source[2]
  return Math.atan2(dx, dz)
}

export interface PrimeversePortalProps {
  readonly route: PortalRoute
  readonly quality: QualityLevel
  readonly reducedMotion: boolean
  readonly active?: boolean
  readonly onSelect?: (route: PortalRoute) => void
}

export function PrimeversePortal({ route, quality, reducedMotion, active = false, onSelect }: PrimeversePortalProps): JSX.Element {
  const rings = useRef<THREE.Group>(null)
  const veil = useRef<THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>>(null)

  useFrame(({ clock }, delta) => {
    if (rings.current && !reducedMotion) rings.current.rotation.z += delta * (active ? 0.72 : 0.28)
    if (veil.current) {
      const pulse = reducedMotion ? 0.37 : 0.34 + Math.sin(clock.elapsedTime * 2.1 + route.source[0]) * 0.07
      veil.current.material.opacity = active ? Math.min(0.64, pulse + 0.18) : pulse
    }
  })

  return (
    <group
      position={route.source as [number, number, number]}
      rotation={[0, portalFacing(route), 0]}
      onClick={onSelect ? (event) => {
        event.stopPropagation()
        onSelect(route)
      } : undefined}
    >
      <mesh position={[0, 0.14, 0]} receiveShadow>
        <boxGeometry args={[4.5, 0.28, 1.42]} />
        <meshStandardMaterial color="#0c1220" emissive={route.accent} emissiveIntensity={active ? 0.55 : 0.18} metalness={0.76} roughness={0.3} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.72, 1.58, 0]}>
          <mesh>
            <boxGeometry args={[0.34, 3.05, 0.52]} />
            <meshStandardMaterial color="#172035" emissive={route.accent} emissiveIntensity={active ? 0.76 : 0.28} metalness={0.8} roughness={0.24} />
          </mesh>
          <mesh position={[-side * 0.03, 0, 0.28]}>
            <boxGeometry args={[0.055, 2.45, 0.04]} />
            <meshBasicMaterial color={route.accent} transparent opacity={0.82} />
          </mesh>
        </group>
      ))}
      <group ref={rings} position={[0, 2.06, 0]}>
        <mesh>
          <torusGeometry args={[1.66, 0.12, quality === 'low' ? 6 : 10, quality === 'low' ? 32 : 64]} />
          <meshStandardMaterial color="#27314c" emissive={route.accent} emissiveIntensity={active ? 1.9 : 0.8} metalness={0.75} roughness={0.2} />
        </mesh>
        {quality !== 'low' && (
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <torusGeometry args={[1.39, 0.025, 5, 48]} />
            <meshBasicMaterial color={route.accent} transparent opacity={0.6} />
          </mesh>
        )}
      </group>
      <mesh ref={veil} position={[0, 2.06, 0.045]}>
        <circleGeometry args={[1.5, quality === 'low' ? 32 : 64]} />
        <meshBasicMaterial color={route.accent} transparent opacity={0.36} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 2.06, 0.065]} rotation={[0, 0, Math.PI / 4]}>
        <ringGeometry args={[0.21, 0.27, 4]} />
        <meshBasicMaterial color="#f3fbff" transparent opacity={0.88} />
      </mesh>
      {active && quality !== 'low' && <pointLight position={[0, 2.1, 0.8]} color={route.accent} intensity={10} distance={8} decay={2} />}
      <RealmTitle
        position={[0, 4.35, 0]}
        name={portalDestinationName(route)}
        subtitle={route.fromRealm === 'nexus' ? 'EXPEDIÇÃO INDEPENDENTE' : 'RETORNO AO NEXUS'}
        accent={route.accent}
        compact
      />
    </group>
  )
}

export interface PrimeversePortalSourcesProps {
  readonly quality: QualityLevel
  readonly reducedMotion: boolean
  readonly activePortalId?: PortalId | null
  readonly fromRealm?: RealmId
  readonly onPortalSelect?: (route: PortalRoute) => void
}

/** Renders every gate exactly at its canonical source coordinate from shared/realms.ts. */
export function PrimeversePortalSources({
  quality,
  reducedMotion,
  activePortalId = null,
  fromRealm,
  onPortalSelect,
}: PrimeversePortalSourcesProps): JSX.Element {
  return (
    <group>
      {Object.values(PORTAL_ROUTES).filter((route) => !fromRealm || route.fromRealm === fromRealm).map((route) => (
        <PrimeversePortal
          key={route.id}
          route={route}
          quality={quality}
          reducedMotion={reducedMotion}
          active={route.id === activePortalId}
          onSelect={onPortalSelect}
        />
      ))}
    </group>
  )
}

export interface PrimeverseGameWorldsProps extends WorldRenderingProps {
  readonly ulam?: Omit<UlamRunWorldProps, keyof WorldRenderingProps>
  readonly forge?: Omit<EuclidForgeWorldProps, keyof WorldRenderingProps>
  readonly activePortalId?: PortalId | null
  readonly onPortalSelect?: (route: PortalRoute) => void
}

/** Complete visual layer for the two minigame realms and their outbound/return portals. */
export default function PrimeverseGameWorlds({
  quality,
  profile,
  reducedMotion,
  ulam,
  forge,
  activePortalId,
  onPortalSelect,
}: PrimeverseGameWorldsProps): JSX.Element {
  return (
    <>
      <UlamRunWorld quality={quality} profile={profile} reducedMotion={reducedMotion} {...ulam} />
      <EuclidForgeWorld quality={quality} profile={profile} reducedMotion={reducedMotion} {...forge} />
      <PrimeversePortalSources
        quality={quality}
        reducedMotion={reducedMotion}
        activePortalId={activePortalId}
        onPortalSelect={onPortalSelect}
      />
    </>
  )
}
