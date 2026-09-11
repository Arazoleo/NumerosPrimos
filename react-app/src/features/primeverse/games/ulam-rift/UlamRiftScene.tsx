import { Billboard, Sparkles, Stars } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { QualityLevel, QualityProfile } from '../../graphics/useQualitySettings'
import {
  ULAM_RIFT_HAZARDS,
  ULAM_RIFT_PLATFORMS,
  ULAM_RIFT_PRIMES,
  ULAM_RIFT_SECTORS,
  ULAM_RIFT_SPAWN,
  ULAM_RIFT_TERMS,
  ULAM_RIFT_TOWERS,
  getUlamRiftBarrierNode,
  getUlamRiftCheckpoint,
  getUlamRiftObjective,
  sectorAtRiftPosition,
  type RiftPlatform,
  type RiftTerm,
  type RiftTower,
  type RiftVec3,
  type UlamRiftAction,
  type UlamRiftState,
} from './ulamRiftLogic'

export interface UlamRiftInput {
  readonly keys: Set<string>
  touchX: number
  touchZ: number
  sprintHeld: boolean
  jumpQueued: boolean
  interactQueued: boolean
}

export interface UlamRiftLook {
  yaw: number
  pitch: number
}

export interface UlamRiftTelemetry {
  readonly position: RiftVec3
  readonly yaw: number
  readonly sector: string
  readonly speed: number
  readonly grounded: boolean
  readonly objectiveDistance: number
}

export interface UlamRiftSceneProps {
  readonly state: UlamRiftState
  readonly dispatch: React.Dispatch<UlamRiftAction>
  readonly input: React.MutableRefObject<UlamRiftInput>
  readonly look: React.MutableRefObject<UlamRiftLook>
  readonly paused: boolean
  readonly reducedMotion: boolean
  readonly quality: QualityLevel
  readonly profile: QualityProfile
  readonly onTelemetry: (telemetry: UlamRiftTelemetry) => void
  readonly onInteraction: (label: string | null) => void
}

const PLAYER_RADIUS = 0.34
const FALL_LEVEL = -13
const UP = new THREE.Vector3(0, 1, 0)
const CAMERA_TARGET = new THREE.Vector3()
const CAMERA_DESIRED = new THREE.Vector3()
const TEMP_POSITION = new THREE.Vector3()
const TEMP_PREVIOUS_POSITION = new THREE.Vector3()
const TEMP_REQUESTED_POSITION = new THREE.Vector3()

const DIGIT_SEGMENTS: Readonly<Record<string, readonly string[]>> = {
  '0': ['a', 'b', 'c', 'd', 'e', 'f'],
  '1': ['b', 'c'],
  '2': ['a', 'b', 'g', 'e', 'd'],
  '3': ['a', 'b', 'g', 'c', 'd'],
  '4': ['f', 'g', 'b', 'c'],
  '5': ['a', 'f', 'g', 'c', 'd'],
  '6': ['a', 'f', 'g', 'e', 'c', 'd'],
  '7': ['a', 'b', 'c'],
  '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '9': ['a', 'b', 'c', 'd', 'f', 'g'],
}

const SEGMENT_TRANSFORMS: Readonly<Record<string, { position: readonly [number, number, number]; rotation: number }>> = {
  a: { position: [0, 0.62, 0], rotation: 0 },
  b: { position: [0.34, 0.31, 0], rotation: Math.PI / 2 },
  c: { position: [0.34, -0.31, 0], rotation: Math.PI / 2 },
  d: { position: [0, -0.62, 0], rotation: 0 },
  e: { position: [-0.34, -0.31, 0], rotation: Math.PI / 2 },
  f: { position: [-0.34, 0.31, 0], rotation: Math.PI / 2 },
  g: { position: [0, 0, 0], rotation: 0 },
}

function Digit({ value, color, offset }: { readonly value: string; readonly color: string; readonly offset: number }): JSX.Element {
  return (
    <group position={[offset, 0, 0]}>
      {(DIGIT_SEGMENTS[value] ?? []).map((segment) => {
        const transform = SEGMENT_TRANSFORMS[segment]
        return (
          <mesh key={segment} position={transform.position} rotation={[0, 0, transform.rotation]}>
            <boxGeometry args={[0.48, 0.085, 0.045]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}

function NumberGlyph({ value, color, scale = 1 }: { readonly value: number; readonly color: string; readonly scale?: number }): JSX.Element {
  const characters = String(value).split('')
  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false}>
      <group scale={scale}>
        {characters.map((character, index) => (
          <Digit
            key={`${character}-${index}`}
            value={character}
            color={color}
            offset={(index - (characters.length - 1) / 2) * 0.92}
          />
        ))}
      </group>
    </Billboard>
  )
}

function RiftPlatformVisual({ platform, shadows, lowDetail }: {
  readonly platform: RiftPlatform
  readonly shadows: boolean
  readonly lowDetail: boolean
}): JSX.Element {
  const [x, y, z] = platform.position
  const [width, height, depth] = platform.size
  return (
    <group position={[x, y, z]}>
      <mesh receiveShadow={shadows} castShadow={shadows}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#091421" emissive={platform.accent} emissiveIntensity={0.12} metalness={0.55} roughness={0.7} />
      </mesh>
      <mesh position={[0, height / 2 + 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width * 0.92, depth * 0.9]} />
        <meshStandardMaterial color="#122838" emissive={platform.accent} emissiveIntensity={0.075} roughness={0.83} />
      </mesh>
      <mesh position={[0, height / 2 + 0.046, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.62, 0.68, lowDetail ? 12 : 28]} />
        <meshBasicMaterial color={platform.accent} transparent opacity={0.46} toneMapped={false} />
      </mesh>
      {!lowDetail && ([-1, 1] as const).map((side) => (
        <mesh key={side} position={[side * (width / 2 - 0.09), 0.08, 0]}>
          <boxGeometry args={[0.08, height + 0.12, depth * 0.86]} />
          <meshBasicMaterial color={platform.accent} transparent opacity={0.38} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, -height / 2 - 1.65, 0]}>
        <coneGeometry args={[Math.max(1.4, width * 0.34), 3.3, lowDetail ? 5 : 7]} />
        <meshStandardMaterial color="#071019" emissive={platform.accent} emissiveIntensity={0.035} roughness={0.95} />
      </mesh>
    </group>
  )
}

function TermOrb({ term, collected, expected, reducedMotion }: {
  readonly term: RiftTerm
  readonly collected: boolean
  readonly expected: boolean
  readonly reducedMotion: boolean
}): JSX.Element | null {
  const root = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const color = term.prime ? (expected ? '#fff482' : '#68ddff') : '#ff5478'

  useFrame(({ clock }, delta) => {
    if (!root.current || collected) return
    if (!reducedMotion) root.current.position.y = term.position[1] + Math.sin(clock.elapsedTime * 2.1 + term.value) * 0.22
    if (ring.current && !reducedMotion) ring.current.rotation.z += delta * (term.prime ? 0.75 : -1.2)
  })

  if (collected) return null
  return (
    <group ref={root} position={term.position} name={term.id}>
      <mesh>
        <sphereGeometry args={[0.72, 16, 12]} />
        <meshStandardMaterial color="#07131d" emissive={color} emissiveIntensity={expected ? 1.25 : 0.45} transparent opacity={0.88} />
      </mesh>
      <mesh ref={ring}>
        <torusGeometry args={[1.02, 0.045, 7, 38]} />
        <meshBasicMaterial color={color} transparent opacity={expected ? 0.95 : 0.48} toneMapped={false} />
      </mesh>
      <NumberGlyph value={term.value} color={color} scale={0.62} />
      {expected && <pointLight color={color} intensity={2.2} distance={8} />}
    </group>
  )
}

function RiftTowerVisual({ tower, active, next, lowDetail, reducedMotion }: {
  readonly tower: RiftTower
  readonly active: boolean
  readonly next: boolean
  readonly lowDetail: boolean
  readonly reducedMotion: boolean
}): JSX.Element {
  const crown = useRef<THREE.Group>(null)
  const beam = useRef<THREE.Mesh>(null)
  useFrame(({ clock }, delta) => {
    if (crown.current && !reducedMotion) crown.current.rotation.y += delta * (active ? 0.78 : 0.22)
    if (beam.current && active && !reducedMotion) {
      beam.current.scale.y = 1 + Math.sin(clock.elapsedTime * 2.2) * 0.07
    }
  })
  return (
    <group position={tower.position} name={tower.id}>
      <mesh position={[0, 2.2, 0]} castShadow>
        <cylinderGeometry args={[0.82, 1.22, 4.4, lowDetail ? 6 : 10]} />
        <meshStandardMaterial color="#0a1621" emissive={tower.accent} emissiveIntensity={active ? 0.5 : 0.08} metalness={0.72} roughness={0.38} />
      </mesh>
      <group ref={crown} position={[0, 4.7, 0]}>
        {[0, 1, 2].map((index) => (
          <mesh key={index} rotation={[Math.PI / 2, index * Math.PI / 3, 0]}>
            <torusGeometry args={[1.18 + index * 0.17, 0.055, 6, lowDetail ? 20 : 42]} />
            <meshBasicMaterial color={tower.accent} transparent opacity={active ? 0.92 : next ? 0.55 : 0.2} toneMapped={false} />
          </mesh>
        ))}
        <mesh>
          <octahedronGeometry args={[0.62, 0]} />
          <meshStandardMaterial color={active ? '#ffffff' : tower.accent} emissive={tower.accent} emissiveIntensity={active ? 2.8 : 0.55} />
        </mesh>
      </group>
      {active && (
        <mesh ref={beam} position={[0, 11, 0]}>
          <cylinderGeometry args={[0.05, 0.38, 13, 8, 1, true]} />
          <meshBasicMaterial color={tower.accent} transparent opacity={0.32} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {next && !active && <pointLight position={[0, 4.7, 0]} color={tower.accent} intensity={2.5} distance={13} />}
    </group>
  )
}

function EnergyGate({ tower, active, lowDetail, reducedMotion }: {
  readonly tower: RiftTower
  readonly active: boolean
  readonly lowDetail: boolean
  readonly reducedMotion: boolean
}): JSX.Element | null {
  const field = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!field.current || reducedMotion) return
    const material = field.current.material as THREE.MeshBasicMaterial
    material.opacity = 0.18 + Math.sin(clock.elapsedTime * 5 + tower.node) * 0.08
  })
  if (active || tower.id === 'tower-crown') return null
  const platform = ULAM_RIFT_PLATFORMS[tower.node]
  return (
    <group position={[platform.position[0], platform.position[1] + 1.8, tower.position[2] - 4.1]}>
      <mesh ref={field}>
        <boxGeometry args={[lowDetail ? 8.8 : 10.4, 3.5, 0.08]} />
        <meshBasicMaterial color={tower.accent} transparent opacity={0.22} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[1.1, 0.07, 7, 32]} />
        <meshBasicMaterial color={tower.accent} transparent opacity={0.85} toneMapped={false} />
      </mesh>
    </group>
  )
}

function RiftHazardVisual({ hazard, reducedMotion }: {
  readonly hazard: (typeof ULAM_RIFT_HAZARDS)[number]
  readonly reducedMotion: boolean
}): JSX.Element {
  const root = useRef<THREE.Group>(null)
  useFrame(({ clock }, delta) => {
    if (!root.current || reducedMotion) return
    root.current.rotation.y += delta * (hazard.kind === 'pulse' ? 1.8 : -1.15)
    root.current.position.y = hazard.position[1] + Math.sin(clock.elapsedTime * 2.7 + hazard.position[2]) * 0.17
  })
  const color = hazard.kind === 'pulse' ? '#ff4f91' : '#ff744f'
  return (
    <group ref={root} position={hazard.position}>
      {hazard.kind === 'pulse' ? (
        <>
          {[0, 1, 2].map((index) => (
            <mesh key={index} rotation={[index * Math.PI / 3, index * 0.7, 0]}>
              <torusGeometry args={[0.74 + index * 0.21, 0.052, 6, 30]} />
              <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.78 - index * 0.15} />
            </mesh>
          ))}
        </>
      ) : (
        <>
          <mesh rotation={[0.5, 0.3, 0.2]}>
            <octahedronGeometry args={[1.05, 0]} />
            <meshStandardMaterial color="#2d0713" emissive={color} emissiveIntensity={1.2} roughness={0.34} />
          </mesh>
          <mesh scale={1.35}>
            <octahedronGeometry args={[1.05, 0]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.38} toneMapped={false} />
          </mesh>
        </>
      )}
    </group>
  )
}

function ObjectiveBeacon({ position, color, reducedMotion }: {
  readonly position: RiftVec3
  readonly color: string
  readonly reducedMotion: boolean
}): JSX.Element {
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }, delta) => {
    if (!ring.current || reducedMotion) return
    ring.current.rotation.z += delta * 0.9
    const scale = 1 + Math.sin(clock.elapsedTime * 2.5) * 0.12
    ring.current.scale.setScalar(scale)
  })
  return (
    <group position={[position[0], position[1] + 3.2, position[2]]}>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.25, 0.06, 6, 38]} />
        <meshBasicMaterial color={color} transparent opacity={0.72} toneMapped={false} />
      </mesh>
      <mesh position={[0, 5, 0]}>
        <cylinderGeometry args={[0.025, 0.22, 10, 7, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

interface RiftCrystal {
  readonly id: number
  readonly position: RiftVec3
  readonly scale: number
  readonly color: string
}

function CrystalInstances({ crystals, color }: {
  readonly crystals: readonly RiftCrystal[]
  readonly color: string
}): JSX.Element {
  const instances = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = instances.current
    if (!mesh) return
    const transform = new THREE.Object3D()
    crystals.forEach((crystal, index) => {
      transform.position.set(...crystal.position)
      transform.rotation.set(0.12, crystal.id * 1.7, 0.15)
      transform.scale.setScalar(crystal.scale)
      transform.updateMatrix()
      mesh.setMatrixAt(index, transform.matrix)
    })
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingBox()
    mesh.computeBoundingSphere()
  }, [crystals])

  return (
    <instancedMesh ref={instances} args={[undefined, undefined, crystals.length]}>
      <coneGeometry args={[0.25, 1.55, 5]} />
      <meshStandardMaterial color="#07151d" emissive={color} emissiveIntensity={0.58} roughness={0.45} />
    </instancedMesh>
  )
}

function BioluminescentField({ quality }: {
  readonly quality: QualityLevel
}): JSX.Element {
  const crystals = useMemo(() => {
    const count = quality === 'low' ? 34 : quality === 'medium' ? 64 : 96
    return Array.from({ length: count }, (_, index): RiftCrystal => {
      const node = index % ULAM_RIFT_PLATFORMS.length
      const platform = ULAM_RIFT_PLATFORMS[node]
      const side = index % 2 === 0 ? -1 : 1
      const wave = Math.sin(index * 18.17) * 0.5 + 0.5
      return {
        id: index,
        position: [
          platform.position[0] + side * (platform.size[0] * 0.39 + 1.4 + wave * 3.2),
          platform.position[1] - 0.3 + wave * 1.1,
          platform.position[2] + Math.cos(index * 4.91) * 3.7,
        ] as RiftVec3,
        scale: 0.35 + wave * 1.15,
        color: platform.accent,
      }
    })
  }, [quality])
  const crystalClusters = useMemo(() => ULAM_RIFT_SECTORS.map((sector) => ({
    id: sector.id,
    color: sector.accent,
    crystals: crystals.filter((crystal) => crystal.color === sector.accent),
  })), [crystals])

  return (
    <group>
      {crystalClusters.map((cluster) => (
        <CrystalInstances key={cluster.id} crystals={cluster.crystals} color={cluster.color} />
      ))}
      {ULAM_RIFT_SECTORS.map((sector, index) => {
        const z = (sector.range[0] + sector.range[1]) / 2
        const node = Math.min(32, index * 8 + 4)
        const y = ULAM_RIFT_PLATFORMS[node].position[1]
        return (
          <group key={sector.id} position={[0, y + 8, z]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[12 + index * 1.5, 0.16, 8, quality === 'low' ? 28 : 56, Math.PI * 1.2]} />
              <meshStandardMaterial color="#081522" emissive={sector.accent} emissiveIntensity={0.38} roughness={0.5} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function UlamRiftWorld({ state, quality, profile, reducedMotion }: {
  readonly state: UlamRiftState
  readonly quality: QualityLevel
  readonly profile: QualityProfile
  readonly reducedMotion: boolean
}): JSX.Element {
  const lowDetail = quality === 'low'
  const objective = getUlamRiftObjective(state)
  const nextTower = ULAM_RIFT_TOWERS.find((tower) => !state.activatedTowerIds.includes(tower.id))
  const expectedPrime = ULAM_RIFT_PRIMES[state.nextPrimeIndex]
  const objectiveColor = objective.kind === 'tower' ? '#ffda7b' : '#77f6e1'
  return (
    <>
      <color attach="background" args={['#020711']} />
      <fog attach="fog" args={['#071222', quality === 'low' ? 24 : 31, quality === 'low' ? 88 : 132]} />
      <ambientLight intensity={0.28} color="#82a8cf" />
      <hemisphereLight args={['#506d9b', '#03080d', 0.44]} />
      <directionalLight position={[18, 34, 24]} intensity={1.05} color="#b2deff" castShadow={profile.shadows} />
      <pointLight position={[0, 24, -105]} intensity={12} distance={110} color="#765eff" />
      <Stars radius={150} depth={82} count={quality === 'low' ? 600 : quality === 'medium' ? 1_100 : 1_700} factor={3.2} saturation={0.72} fade speed={reducedMotion ? 0 : 0.35} />
      <Sparkles count={profile.particles * 2} scale={[30, 56, 248]} position={[0, 23, -105]} size={quality === 'low' ? 1.1 : 1.7} speed={reducedMotion ? 0 : 0.22} color="#83ffe0" opacity={0.38} />

      <mesh position={[0, -15, -106]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[110, 270, 1, 1]} />
        <meshStandardMaterial color="#020a13" emissive="#163b52" emissiveIntensity={0.2} roughness={0.16} metalness={0.5} />
      </mesh>

      {ULAM_RIFT_PLATFORMS.map((platform) => (
        <RiftPlatformVisual key={platform.id} platform={platform} shadows={profile.shadows} lowDetail={lowDetail} />
      ))}
      <BioluminescentField quality={quality} />

      {ULAM_RIFT_TERMS.filter((term) => !state.collectedTermIds.includes(term.id)).map((term) => (
        <TermOrb
          key={term.id}
          term={term}
          collected={false}
          expected={term.prime && term.value === expectedPrime}
          reducedMotion={reducedMotion}
        />
      ))}

      {ULAM_RIFT_TOWERS.map((tower) => (
        <group key={tower.id}>
          <RiftTowerVisual
            tower={tower}
            active={state.activatedTowerIds.includes(tower.id)}
            next={tower.id === nextTower?.id}
            lowDetail={lowDetail}
            reducedMotion={reducedMotion}
          />
          {!state.activatedTowerIds.includes(tower.id) && tower.id !== 'tower-crown' && (
            <EnergyGate
              tower={tower}
              active={false}
              lowDetail={lowDetail}
              reducedMotion={reducedMotion}
            />
          )}
        </group>
      ))}

      {ULAM_RIFT_HAZARDS.map((hazard) => (
        <RiftHazardVisual key={hazard.id} hazard={hazard} reducedMotion={reducedMotion} />
      ))}

      {state.phase === 'running' && <ObjectiveBeacon position={objective.targetPosition} color={objectiveColor} reducedMotion={reducedMotion} />}
    </>
  )
}

function RiftRunner({ position, yaw, velocity, grounded, reducedMotion }: {
  readonly position: React.MutableRefObject<THREE.Vector3>
  readonly yaw: React.MutableRefObject<number>
  readonly velocity: React.MutableRefObject<THREE.Vector3>
  readonly grounded: React.MutableRefObject<boolean>
  readonly reducedMotion: boolean
}): JSX.Element {
  const root = useRef<THREE.Group>(null)
  const leftArm = useRef<THREE.Group>(null)
  const rightArm = useRef<THREE.Group>(null)
  const leftLeg = useRef<THREE.Group>(null)
  const rightLeg = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!root.current) return
    const speed = velocity.current.length()
    root.current.position.copy(position.current)
    root.current.rotation.y = yaw.current
    const stride = reducedMotion ? 0 : Math.min(1, speed / 7.5)
    const swing = Math.sin(clock.elapsedTime * (7 + speed * 0.72)) * 0.72 * stride
    if (leftArm.current) leftArm.current.rotation.x = swing
    if (rightArm.current) rightArm.current.rotation.x = -swing
    if (leftLeg.current) leftLeg.current.rotation.x = -swing * 0.72
    if (rightLeg.current) rightLeg.current.rotation.x = swing * 0.72
    root.current.position.y += grounded.current ? Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.035 * stride : 0
  })

  return (
    <group ref={root}>
      <mesh position={[0, 1.25, 0]} castShadow>
        <capsuleGeometry args={[0.38, 0.68, 5, 10]} />
        <meshStandardMaterial color="#071723" emissive="#3fffe0" emissiveIntensity={0.18} metalness={0.48} roughness={0.48} />
      </mesh>
      <mesh position={[0, 2.02, 0]} castShadow>
        <sphereGeometry args={[0.34, 12, 9]} />
        <meshStandardMaterial color="#0b1d29" emissive="#67bfff" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 2.03, -0.29]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.42, 0.12]} />
        <meshBasicMaterial color="#fff88c" toneMapped={false} />
      </mesh>
      <group ref={leftArm} position={[-0.48, 1.55, 0]}>
        <mesh position={[0, -0.42, 0]}><capsuleGeometry args={[0.1, 0.62, 4, 7]} /><meshStandardMaterial color="#17536a" emissive="#55efd6" emissiveIntensity={0.15} /></mesh>
      </group>
      <group ref={rightArm} position={[0.48, 1.55, 0]}>
        <mesh position={[0, -0.42, 0]}><capsuleGeometry args={[0.1, 0.62, 4, 7]} /><meshStandardMaterial color="#17536a" emissive="#55efd6" emissiveIntensity={0.15} /></mesh>
      </group>
      <group ref={leftLeg} position={[-0.2, 0.78, 0]}>
        <mesh position={[0, -0.4, 0]}><capsuleGeometry args={[0.12, 0.58, 4, 7]} /><meshStandardMaterial color="#0d2638" /></mesh>
      </group>
      <group ref={rightLeg} position={[0.2, 0.78, 0]}>
        <mesh position={[0, -0.4, 0]}><capsuleGeometry args={[0.12, 0.58, 4, 7]} /><meshStandardMaterial color="#0d2638" /></mesh>
      </group>
      <pointLight position={[0, 1.4, 0.4]} color="#54ffe0" intensity={0.62} distance={4} />
    </group>
  )
}

function platformTopAt(position: THREE.Vector3, stepUp = 1.5): number | null {
  let top: number | null = null
  for (const platform of ULAM_RIFT_PLATFORMS) {
    const platformTop = platform.position[1] + platform.size[1] / 2
    if (platformTop > position.y + stepUp || platformTop < position.y - 2.1) continue
    if (Math.abs(position.x - platform.position[0]) > platform.size[0] / 2 - PLAYER_RADIUS) continue
    if (Math.abs(position.z - platform.position[2]) > platform.size[2] / 2 - PLAYER_RADIUS) continue
    top = top === null ? platformTop : Math.max(top, platformTop)
  }
  return top
}

function landingTop(previous: THREE.Vector3, requested: THREE.Vector3): number | null {
  let top: number | null = null
  for (const platform of ULAM_RIFT_PLATFORMS) {
    const platformTop = platform.position[1] + platform.size[1] / 2
    if (previous.y < platformTop - 0.08 || requested.y > platformTop + 0.12) continue
    if (Math.abs(requested.x - platform.position[0]) > platform.size[0] / 2 - PLAYER_RADIUS) continue
    if (Math.abs(requested.z - platform.position[2]) > platform.size[2] / 2 - PLAYER_RADIUS) continue
    top = top === null ? platformTop : Math.max(top, platformTop)
  }
  return top
}

function distanceToTuple(position: THREE.Vector3, target: RiftVec3): number {
  return Math.hypot(position.x - target[0], position.y - target[1], position.z - target[2])
}

function RiftPlayerController({ state, dispatch, input, look, paused, reducedMotion, onTelemetry, onInteraction }: Omit<UlamRiftSceneProps, 'quality' | 'profile'>): JSX.Element {
  const { camera } = useThree()
  const position = useRef(new THREE.Vector3(...ULAM_RIFT_SPAWN))
  const velocity = useRef(new THREE.Vector3())
  const grounded = useRef(false)
  const playerYaw = useRef(Math.PI)
  const lastRunSerial = useRef(state.runSerial)
  const lastTerm = useRef<string | null>(null)
  const hazardCooldowns = useRef(new Map<string, number>())
  const lastTickAt = useRef(0)
  const lastTelemetryAt = useRef(0)
  const lastInteraction = useRef<string | null>(null)
  const respawnLockUntil = useRef(0)
  const objective = getUlamRiftObjective(state)

  useEffect(() => {
    if (lastRunSerial.current === state.runSerial) return
    lastRunSerial.current = state.runSerial
    position.current.set(...ULAM_RIFT_SPAWN)
    velocity.current.set(0, 0, 0)
    grounded.current = false
    lastTerm.current = null
    hazardCooldowns.current.clear()
    camera.position.set(0, 5.8, 22)
    camera.lookAt(0, 1.2, 7)
  }, [camera, state.runSerial])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.045)
    const nowMs = performance.now()
    const canMove = state.phase === 'running' && !paused
    let planarSpeed = 0

    if (canMove && nowMs >= respawnLockUntil.current) {
      const keyboardX = (input.current.keys.has('KeyD') ? 1 : 0) - (input.current.keys.has('KeyA') ? 1 : 0)
      const keyboardZ = (input.current.keys.has('KeyW') ? 1 : 0) - (input.current.keys.has('KeyS') ? 1 : 0)
      const localX = THREE.MathUtils.clamp(keyboardX + input.current.touchX, -1, 1)
      const localZ = THREE.MathUtils.clamp(keyboardZ + input.current.touchZ, -1, 1)
      const magnitude = Math.min(1, Math.hypot(localX, localZ))
      const sprinting = input.current.sprintHeld || input.current.keys.has('ShiftLeft') || input.current.keys.has('ShiftRight')
      const targetSpeed = magnitude > 0 ? (sprinting ? 9.2 : 5.6) : 0
      const normalized = Math.max(1, Math.hypot(localX, localZ))
      const forwardX = -Math.sin(look.current.yaw)
      const forwardZ = -Math.cos(look.current.yaw)
      const rightX = Math.cos(look.current.yaw)
      const rightZ = -Math.sin(look.current.yaw)
      const moveX = (forwardX * localZ + rightX * localX) / normalized
      const moveZ = (forwardZ * localZ + rightZ * localX) / normalized
      const acceleration = grounded.current ? 14 : 5.5
      velocity.current.x = THREE.MathUtils.damp(velocity.current.x, moveX * targetSpeed, acceleration, delta)
      velocity.current.z = THREE.MathUtils.damp(velocity.current.z, moveZ * targetSpeed, acceleration, delta)

      if (input.current.jumpQueued && grounded.current) {
        velocity.current.y = 8.4
        grounded.current = false
      }
      input.current.jumpQueued = false

      const previous = TEMP_PREVIOUS_POSITION.copy(position.current)
      const requested = TEMP_REQUESTED_POSITION.copy(position.current)
      requested.x = THREE.MathUtils.clamp(requested.x + velocity.current.x * delta, -19, 19)
      requested.z += velocity.current.z * delta

      const barrierNode = getUlamRiftBarrierNode(state)
      if (barrierNode !== null) {
        const tower = ULAM_RIFT_TOWERS.find((candidate) => candidate.node === barrierNode)
        if (tower) {
          const gateZ = tower.position[2] - 4.05
          if (previous.z >= gateZ && requested.z < gateZ) {
            requested.z = gateZ + 0.12
            velocity.current.z = Math.max(0, velocity.current.z)
          }
        }
      }

      const support = grounded.current ? platformTopAt(requested, 1.52) : null
      if (support !== null) {
        requested.y = support + 0.035
        velocity.current.y = 0
        grounded.current = true
      } else {
        grounded.current = false
        velocity.current.y -= 20.5 * delta
        requested.y += velocity.current.y * delta
        if (velocity.current.y <= 0) {
          const landed = landingTop(previous, requested)
          if (landed !== null) {
            requested.y = landed + 0.035
            velocity.current.y = 0
            grounded.current = true
          }
        }
      }
      position.current.copy(requested)
      planarSpeed = Math.hypot(velocity.current.x, velocity.current.z)
      if (planarSpeed > 0.18) playerYaw.current = Math.atan2(-velocity.current.x, -velocity.current.z)

      if (position.current.y < FALL_LEVEL) {
        dispatch({ type: 'fall' })
        position.current.set(...getUlamRiftCheckpoint(state))
        velocity.current.set(0, 0, 0)
        grounded.current = false
        respawnLockUntil.current = nowMs + (reducedMotion ? 80 : 420)
      }

      let touchingTerm: string | null = null
      for (const term of ULAM_RIFT_TERMS) {
        if (state.collectedTermIds.includes(term.id)) continue
        if (distanceToTuple(position.current, term.position) <= 1.72) {
          touchingTerm = term.id
          if (lastTerm.current !== term.id) dispatch({ type: 'collect-term', termId: term.id })
          break
        }
      }
      lastTerm.current = touchingTerm

      for (const hazard of ULAM_RIFT_HAZARDS) {
        if (distanceToTuple(position.current, hazard.position) > hazard.radius + 0.5) continue
        if ((hazardCooldowns.current.get(hazard.id) ?? 0) > nowMs) continue
        hazardCooldowns.current.set(hazard.id, nowMs + 1_450)
        dispatch({ type: 'hit-hazard', hazardId: hazard.id, damage: hazard.damage })
        const push = TEMP_POSITION.set(
          position.current.x - hazard.position[0],
          0,
          position.current.z - hazard.position[2],
        )
        if (push.lengthSq() < 0.01) push.set(0, 0, 1)
        push.normalize()
        velocity.current.x += push.x * 5.5
        velocity.current.z += push.z * 5.5
        velocity.current.y = Math.max(velocity.current.y, 3.5)
        grounded.current = false
      }

      let nearbyTower: RiftTower | null = null
      for (const tower of ULAM_RIFT_TOWERS) {
        if (state.activatedTowerIds.includes(tower.id)) continue
        if (distanceToTuple(position.current, tower.position) < 3.5) {
          nearbyTower = tower
          break
        }
      }
      const interactionLabel = nearbyTower ? `ATIVAR ${nearbyTower.name.toUpperCase()}` : null
      if (interactionLabel !== lastInteraction.current) {
        lastInteraction.current = interactionLabel
        onInteraction(interactionLabel)
      }
      if (input.current.interactQueued) {
        input.current.interactQueued = false
        if (nearbyTower) dispatch({ type: 'activate-tower', towerId: nearbyTower.id })
      }

      if (nowMs - lastTickAt.current >= 250) {
        lastTickAt.current = nowMs
        dispatch({ type: 'tick', nowMs })
      }
    } else {
      velocity.current.x = THREE.MathUtils.damp(velocity.current.x, 0, 12, delta)
      velocity.current.z = THREE.MathUtils.damp(velocity.current.z, 0, 12, delta)
      input.current.jumpQueued = false
      input.current.interactQueued = false
      planarSpeed = Math.hypot(velocity.current.x, velocity.current.z)
    }

    CAMERA_TARGET.set(position.current.x, position.current.y + 1.25, position.current.z)
    const distance = 7.2
    CAMERA_DESIRED.set(
      CAMERA_TARGET.x + Math.sin(look.current.yaw) * Math.cos(look.current.pitch) * distance,
      CAMERA_TARGET.y + 2.25 + Math.sin(look.current.pitch) * distance,
      CAMERA_TARGET.z + Math.cos(look.current.yaw) * Math.cos(look.current.pitch) * distance,
    )
    camera.position.lerp(CAMERA_DESIRED, 1 - Math.exp(-delta * (reducedMotion ? 18 : 8.2)))
    camera.up.copy(UP)
    camera.lookAt(CAMERA_TARGET)

    if (nowMs - lastTelemetryAt.current >= 200) {
      lastTelemetryAt.current = nowMs
      onTelemetry({
        position: [position.current.x, position.current.y, position.current.z],
        yaw: playerYaw.current,
        sector: sectorAtRiftPosition([position.current.x, position.current.y, position.current.z]).name,
        speed: planarSpeed,
        grounded: grounded.current,
        objectiveDistance: distanceToTuple(position.current, objective.targetPosition),
      })
    }
  })

  return <RiftRunner position={position} yaw={playerYaw} velocity={velocity} grounded={grounded} reducedMotion={reducedMotion} />
}

function UlamRiftScene(props: UlamRiftSceneProps): JSX.Element {
  return (
    <>
      <UlamRiftWorld
        state={props.state}
        quality={props.quality}
        profile={props.profile}
        reducedMotion={props.reducedMotion}
      />
      <RiftPlayerController
        state={props.state}
        dispatch={props.dispatch}
        input={props.input}
        look={props.look}
        paused={props.paused}
        reducedMotion={props.reducedMotion}
        onTelemetry={props.onTelemetry}
        onInteraction={props.onInteraction}
      />
    </>
  )
}

function sameSceneState(previous: UlamRiftState, next: UlamRiftState): boolean {
  return previous.phase === next.phase
    && previous.runSerial === next.runSerial
    && previous.nextPrimeIndex === next.nextPrimeIndex
    && previous.collectedTermIds === next.collectedTermIds
    && previous.activatedTowerIds === next.activatedTowerIds
    && previous.checkpointTowerId === next.checkpointTowerId
}

export default memo(UlamRiftScene, (previous, next) => (
  sameSceneState(previous.state, next.state)
  && previous.dispatch === next.dispatch
  && previous.input === next.input
  && previous.look === next.look
  && previous.paused === next.paused
  && previous.reducedMotion === next.reducedMotion
  && previous.quality === next.quality
  && previous.profile === next.profile
  && previous.onTelemetry === next.onTelemetry
  && previous.onInteraction === next.onInteraction
))
