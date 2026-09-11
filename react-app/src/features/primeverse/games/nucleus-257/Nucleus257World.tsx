import { Billboard, Float, Sparkles, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { QualityLevel } from '../../graphics/useQualitySettings'
import {
  ARENA_COVERS,
  ARENA_PYLONS,
  ARENA_RADIUS,
  type ArenaCover,
  type ArenaPylon,
} from './arenaWorld'

const TAU = Math.PI * 2
const CORE_BLUE = '#58e7ff'
const CORE_VIOLET = '#806dff'
const VOID = '#050b16'

interface QualityTuning {
  readonly circleSegments: number
  readonly standSections: number
  readonly audience: number
  readonly particles: number
  readonly shadows: boolean
}

const QUALITY_TUNING: Readonly<Record<QualityLevel, QualityTuning>> = {
  low: { circleSegments: 40, standSections: 14, audience: 28, particles: 18, shadows: false },
  medium: { circleSegments: 64, standSections: 22, audience: 58, particles: 38, shadows: false },
  high: { circleSegments: 96, standSections: 30, audience: 96, particles: 68, shadows: true },
}

export interface Nucleus257WorldProps {
  readonly quality: QualityLevel
  readonly reducedMotion: boolean
  readonly activePrime: 2 | 3 | 5 | 7
  readonly capturedPrimes: readonly number[]
  readonly captureProgress: number
}

interface StandTransform {
  readonly angle: number
  readonly radius: number
  readonly height: number
  readonly width: number
  readonly depth: number
}

interface AudienceTransform {
  readonly angle: number
  readonly radius: number
  readonly height: number
  readonly color: THREE.Color
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return THREE.MathUtils.clamp(value, 0, 1)
}

function ArenaFloor({ tuning }: { readonly tuning: QualityTuning }): JSX.Element {
  const spokes = tuning.circleSegments <= 40 ? 12 : 20

  return (
    <group name="arena-floor">
      <mesh position={[0, -0.38, 0]} receiveShadow>
        <cylinderGeometry args={[ARENA_RADIUS, ARENA_RADIUS + 0.28, 0.76, tuning.circleSegments]} />
        <meshStandardMaterial color="#0d1c2d" emissive="#0b2940" emissiveIntensity={0.24} metalness={0.68} roughness={0.48} />
      </mesh>

      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[ARENA_RADIUS - 0.3, tuning.circleSegments]} />
        <meshStandardMaterial color="#102338" emissive="#0d3450" emissiveIntensity={0.18} metalness={0.64} roughness={0.5} />
      </mesh>

      {[4.7, 9.4, 16.8, 23.7, 27.08].map((radius, index) => (
        <mesh key={radius} position={[0, 0.032 + index * 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius - (index === 4 ? 0.12 : 0.035), radius + (index === 4 ? 0.12 : 0.035), tuning.circleSegments]} />
          <meshBasicMaterial
            color={index === 4 ? '#63caff' : index % 2 === 0 ? '#245f82' : '#31386f'}
            transparent
            opacity={index === 4 ? 0.72 : 0.38}
            toneMapped={false}
          />
        </mesh>
      ))}

      {Array.from({ length: spokes }, (_, index) => {
        const angle = index / spokes * TAU
        const length = index % 5 === 0 ? 24.8 : 21.8
        const color = index % 5 === 0 ? CORE_BLUE : '#334b77'
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * length * 0.5, 0.038, Math.sin(angle) * length * 0.5]}
            rotation={[0, Math.PI / 2 - angle, 0]}
          >
            <boxGeometry args={[index % 5 === 0 ? 0.075 : 0.035, 0.018, length]} />
            <meshBasicMaterial color={color} transparent opacity={index % 5 === 0 ? 0.5 : 0.25} toneMapped={false} />
          </mesh>
        )
      })}

      {ARENA_PYLONS.map((pylon) => {
        const angle = Math.atan2(pylon.position.z, pylon.position.x)
        return (
          <mesh
            key={`route-${pylon.prime}`}
            position={[Math.cos(angle) * 10.4, 0.052, Math.sin(angle) * 10.4]}
            rotation={[0, Math.PI / 2 - angle, 0]}
          >
            <boxGeometry args={[0.17, 0.025, 12.5]} />
            <meshBasicMaterial color={pylon.color} transparent opacity={0.42} toneMapped={false} />
          </mesh>
        )
      })}

      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.65, 4.25, tuning.circleSegments]} />
        <meshStandardMaterial color="#101b2d" emissive={CORE_VIOLET} emissiveIntensity={0.14} metalness={0.88} roughness={0.27} />
      </mesh>
    </group>
  )
}

function StadiumRing({ quality, tuning }: {
  readonly quality: QualityLevel
  readonly tuning: QualityTuning
}): JSX.Element {
  const standsRef = useRef<THREE.InstancedMesh>(null)
  const spectatorsRef = useRef<THREE.InstancedMesh>(null)

  const stands = useMemo<readonly StandTransform[]>(() => (
    Array.from({ length: tuning.standSections * 3 }, (_, index) => {
      const tier = index % 3
      const section = Math.floor(index / 3)
      const angle = section / tuning.standSections * TAU
      const radius = 29.35 + tier * 2.05
      const height = 1.05 + tier * 1.18
      return {
        angle,
        radius,
        height,
        width: Math.max(2.4, TAU * radius / tuning.standSections * 0.88),
        depth: 1.86,
      }
    })
  ), [tuning.standSections])

  const spectators = useMemo<readonly AudienceTransform[]>(() => (
    Array.from({ length: tuning.audience }, (_, index) => {
      const angle = index / tuning.audience * TAU + (index % 3) * 0.035
      const tier = index % 3
      const pylonColor = ARENA_PYLONS[Math.floor((angle / TAU * 4 + 4) % 4)]?.color ?? CORE_BLUE
      return {
        angle,
        radius: 29.25 + tier * 2.05,
        height: 1.38 + tier * 1.18 + (index % 4) * 0.07,
        color: new THREE.Color(index % 5 === 0 ? '#effbff' : pylonColor),
      }
    })
  ), [tuning.audience])

  useLayoutEffect(() => {
    const standsMesh = standsRef.current
    if (!standsMesh) return
    const dummy = new THREE.Object3D()
    stands.forEach((stand, index) => {
      dummy.position.set(
        Math.cos(stand.angle) * stand.radius,
        stand.height * 0.5 - 0.02,
        Math.sin(stand.angle) * stand.radius,
      )
      dummy.rotation.set(0, Math.PI / 2 - stand.angle, 0)
      dummy.scale.set(stand.width, stand.height, stand.depth)
      dummy.updateMatrix()
      standsMesh.setMatrixAt(index, dummy.matrix)
    })
    standsMesh.instanceMatrix.needsUpdate = true
    standsMesh.computeBoundingSphere()
  }, [stands])

  useLayoutEffect(() => {
    const audienceMesh = spectatorsRef.current
    if (!audienceMesh) return
    const dummy = new THREE.Object3D()
    spectators.forEach((spectator, index) => {
      dummy.position.set(
        Math.cos(spectator.angle) * spectator.radius,
        spectator.height,
        Math.sin(spectator.angle) * spectator.radius,
      )
      dummy.scale.setScalar(index % 4 === 0 ? 0.14 : 0.1)
      dummy.updateMatrix()
      audienceMesh.setMatrixAt(index, dummy.matrix)
      audienceMesh.setColorAt(index, spectator.color)
    })
    audienceMesh.instanceMatrix.needsUpdate = true
    if (audienceMesh.instanceColor) audienceMesh.instanceColor.needsUpdate = true
    audienceMesh.computeBoundingSphere()
  }, [spectators])

  return (
    <group name="stadium-ring">
      <mesh position={[0, 1.28, 0]}>
        <cylinderGeometry args={[27.86, 27.86, 2.5, tuning.circleSegments, 1, true]} />
        <meshStandardMaterial
          color="#0c1724"
          emissive="#174b6b"
          emissiveIntensity={0.2}
          metalness={0.78}
          roughness={0.38}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 2.36, 0]}>
        <cylinderGeometry args={[27.48, 27.48, 3.7, tuning.circleSegments, 1, true]} />
        <meshPhysicalMaterial
          color="#75d6ff"
          emissive="#2188c0"
          emissiveIntensity={0.35}
          transparent
          opacity={0.1}
          roughness={0.15}
          metalness={0.15}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {[27.7, 34.35].map((radius, index) => (
        <mesh key={radius} position={[0, index === 0 ? 2.95 : 4.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, index === 0 ? 0.12 : 0.2, 8, tuning.circleSegments]} />
          <meshStandardMaterial color="#203450" emissive={index === 0 ? CORE_BLUE : CORE_VIOLET} emissiveIntensity={0.55} metalness={0.86} roughness={0.28} />
        </mesh>
      ))}

      <instancedMesh
        ref={standsRef}
        args={[undefined, undefined, stands.length]}
        castShadow={tuning.shadows}
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#111c2b" emissive="#172a42" emissiveIntensity={0.18} metalness={0.65} roughness={0.58} />
      </instancedMesh>

      <instancedMesh ref={spectatorsRef} args={[undefined, undefined, spectators.length]}>
        <sphereGeometry args={[1, quality === 'low' ? 4 : 6, quality === 'low' ? 3 : 5]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>

      {ARENA_PYLONS.map((pylon, index) => {
        const angle = Math.atan2(pylon.position.z, pylon.position.x)
        const radius = 32.9
        return (
          <group
            key={`banner-${pylon.prime}`}
            position={[Math.cos(angle) * radius, 5.25, Math.sin(angle) * radius]}
            rotation={[0, -angle - Math.PI / 2, 0]}
          >
            <mesh>
              <boxGeometry args={[4.8, 1.4, 0.16]} />
              <meshStandardMaterial color="#07101c" emissive={pylon.color} emissiveIntensity={0.16} metalness={0.72} roughness={0.38} />
            </mesh>
            <Text position={[0, 0, -0.095]} rotation={[0, Math.PI, 0]} fontSize={0.62} color={pylon.color} outlineColor={VOID} outlineWidth={0.035}>
              {index === 0 ? 'NÚCLEO 257' : `SETOR P${pylon.prime}`}
            </Text>
          </group>
        )
      })}
    </group>
  )
}

function CoverShell({ cover, shadows }: {
  readonly cover: ArenaCover
  readonly shadows: boolean
}): JSX.Element {
  const width = cover.half.x * 2
  const height = cover.half.y * 2
  const depth = cover.half.z * 2
  const monolith = cover.id.includes('monolith')
  const accent = cover.id.startsWith('west')
    ? '#45ddff'
    : cover.id.startsWith('east')
      ? '#ff61c8'
      : '#8d7dff'

  return (
    <group
      name={`cover-${cover.id}`}
      position={[cover.center.x, cover.center.y, cover.center.z]}
      userData={{ collider: cover.id, halfExtents: [cover.half.x, cover.half.y, cover.half.z] }}
    >
      <mesh castShadow={shadows} receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={monolith ? '#101d2c' : '#132238'} emissive={accent} emissiveIntensity={0.09} metalness={0.76} roughness={0.38} />
      </mesh>

      <mesh position={[0, height * 0.14, depth / 2 + 0.012]}>
        <boxGeometry args={[width * (monolith ? 0.62 : 0.82), monolith ? height * 0.6 : height * 0.42, 0.025]} />
        <meshBasicMaterial color={accent} transparent opacity={monolith ? 0.17 : 0.28} toneMapped={false} />
      </mesh>

      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (width / 2 - 0.07), 0, depth / 2 + 0.035]}>
          <boxGeometry args={[0.1, height * 0.86, 0.08]} />
          <meshStandardMaterial color="#8aa6bd" emissive={accent} emissiveIntensity={0.85} metalness={0.88} roughness={0.24} />
        </mesh>
      ))}

      {monolith ? (
        <>
          <mesh position={[0, height / 2 - 0.09, 0]} rotation={[0, cover.rotation ?? 0, 0]}>
            <boxGeometry args={[width * 0.74, 0.16, depth * 0.8]} />
            <meshStandardMaterial color="#253b50" emissive={accent} emissiveIntensity={0.28} metalness={0.9} roughness={0.22} />
          </mesh>
          <mesh position={[0, 0.32, depth / 2 + 0.052]} rotation={[0, 0, cover.rotation ?? 0]}>
            <ringGeometry args={[0.38, 0.48, 6]} />
            <meshBasicMaterial color={accent} transparent opacity={0.72} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, height / 2 - 0.055, 0]}>
            <boxGeometry args={[width * 0.92, 0.1, depth * 0.9]} />
            <meshStandardMaterial color="#40536e" emissive={accent} emissiveIntensity={0.35} metalness={0.9} roughness={0.2} />
          </mesh>
          {[-0.28, 0, 0.28].map((offset) => (
            <mesh key={offset} position={[width * offset, -height * 0.08, depth / 2 + 0.06]}>
              <boxGeometry args={[0.06, height * 0.5, 0.045]} />
              <meshBasicMaterial color={accent} transparent opacity={0.58} toneMapped={false} />
            </mesh>
          ))}
        </>
      )}
    </group>
  )
}

function NucleusCore({
  quality,
  tuning,
  reducedMotion,
  activeColor,
  captureProgress,
  capturedCount,
}: {
  readonly quality: QualityLevel
  readonly tuning: QualityTuning
  readonly reducedMotion: boolean
  readonly activeColor: string
  readonly captureProgress: number
  readonly capturedCount: number
}): JSX.Element {
  const ringsRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const coreMaterialRef = useRef<THREE.MeshStandardMaterial>(null)
  const coreCover = ARENA_COVERS.find((cover) => cover.id === 'core')

  useFrame(({ clock }, delta) => {
    if (ringsRef.current && !reducedMotion) {
      ringsRef.current.rotation.y += delta * (0.32 + captureProgress * 0.65)
      ringsRef.current.rotation.z -= delta * 0.1
    }
    if (coreRef.current) {
      const pulse = reducedMotion ? 1 : 1 + Math.sin(clock.elapsedTime * 2.25) * (0.025 + captureProgress * 0.035)
      coreRef.current.scale.setScalar(pulse)
    }
    if (coreMaterialRef.current) {
      const pulse = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 2.25) * 0.18
      coreMaterialRef.current.emissiveIntensity = 1.35 + capturedCount * 0.24 + captureProgress * 0.72 + pulse
    }
  })

  if (!coreCover) return <></>
  const width = coreCover.half.x * 2
  const height = coreCover.half.y * 2
  const depth = coreCover.half.z * 2

  return (
    <group
      name="cover-core"
      position={[coreCover.center.x, coreCover.center.y, coreCover.center.z]}
      userData={{ collider: coreCover.id, halfExtents: [coreCover.half.x, coreCover.half.y, coreCover.half.z] }}
    >
      <mesh castShadow={tuning.shadows} receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#091321" emissive="#163e61" emissiveIntensity={0.18} metalness={0.84} roughness={0.3} />
      </mesh>

      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (width / 2 + 0.018), -0.22, 0]} rotation={[0, Math.PI / 2, 0]}>
          <ringGeometry args={[0.7, 0.82, 8]} />
          <meshBasicMaterial color={activeColor} transparent opacity={0.68} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}

      <mesh ref={coreRef} position={[0, 0.32, 0]} castShadow={tuning.shadows}>
        <icosahedronGeometry args={[1.08, quality === 'high' ? 2 : quality === 'medium' ? 1 : 0]} />
        <meshStandardMaterial
          ref={coreMaterialRef}
          color="#e5fbff"
          emissive={activeColor}
          emissiveIntensity={1.7}
          metalness={0.38}
          roughness={0.13}
        />
      </mesh>

      <group ref={ringsRef} position={[0, 0.32, 0]}>
        <mesh rotation={[Math.PI / 2, 0.25, 0]}>
          <torusGeometry args={[1.48, 0.055, 7, tuning.circleSegments]} />
          <meshBasicMaterial color={CORE_BLUE} transparent opacity={0.84} toneMapped={false} />
        </mesh>
        <mesh rotation={[0.35, 0, Math.PI / 2]}>
          <torusGeometry args={[1.82, 0.04, 6, tuning.circleSegments]} />
          <meshBasicMaterial color={activeColor} transparent opacity={0.68} toneMapped={false} />
        </mesh>
        {quality !== 'low' && (
          <mesh rotation={[1.06, 0.4, 0.2]}>
            <torusGeometry args={[2.04, 0.022, 5, tuning.circleSegments]} />
            <meshBasicMaterial color="#c9a9ff" transparent opacity={0.4} toneMapped={false} />
          </mesh>
        )}
      </group>

      <Billboard position={[0, 3.92, 0]} follow>
        <Text fontSize={0.9} color="#f2fdff" outlineColor="#07152a" outlineWidth={0.055}>257</Text>
        <Text position={[0, -0.7, 0]} fontSize={0.17} letterSpacing={0.2} color={activeColor} outlineColor={VOID} outlineWidth={0.02}>
          2⁸ + 1 · PRIMO DE FERMAT
        </Text>
      </Billboard>

      {quality !== 'low' && (
        <Sparkles
          count={quality === 'high' ? 24 : 12}
          scale={[4.2, 3.1, 4.2]}
          position={[0, 0.5, 0]}
          size={1.45}
          speed={reducedMotion ? 0 : 0.3}
          color={activeColor}
          opacity={0.72}
        />
      )}
      <pointLight position={[0, 1.25, 0]} color={activeColor} intensity={quality === 'low' ? 8 : 18} distance={14} decay={2} />
    </group>
  )
}

function PrimePylon({
  pylon,
  quality,
  tuning,
  reducedMotion,
  active,
  captured,
  progress,
}: {
  readonly pylon: ArenaPylon
  readonly quality: QualityLevel
  readonly tuning: QualityTuning
  readonly reducedMotion: boolean
  readonly active: boolean
  readonly captured: boolean
  readonly progress: number
}): JSX.Element {
  const rotorRef = useRef<THREE.Group>(null)
  const crystalRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  const charge = captured ? 1 : active ? progress : 0
  const displayColor = captured ? '#d8fff5' : pylon.color
  const progressGeometry = useMemo(
    () => new THREE.RingGeometry(0.94, 1.15, tuning.circleSegments, 1, -Math.PI / 2, TAU),
    [tuning.circleSegments],
  )
  const facing = Math.atan2(-pylon.position.x, -pylon.position.z)

  useLayoutEffect(() => {
    const count = progressGeometry.index?.count ?? 0
    const visibleSegments = Math.round(tuning.circleSegments * clamp01(charge))
    progressGeometry.setDrawRange(0, Math.min(count, visibleSegments * 6))
  }, [charge, progressGeometry, tuning.circleSegments])

  useLayoutEffect(() => () => progressGeometry.dispose(), [progressGeometry])

  useFrame(({ clock }, delta) => {
    if (rotorRef.current && !reducedMotion) {
      rotorRef.current.rotation.y += delta * (active ? 1.15 : captured ? 0.48 : 0.18)
    }
    if (crystalRef.current) {
      const pulse = reducedMotion ? 1 : 1 + Math.sin(clock.elapsedTime * (active ? 4 : 1.65) + pylon.prime) * (active ? 0.09 : 0.035)
      crystalRef.current.scale.setScalar(pulse)
    }
    if (materialRef.current) {
      const pulse = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 3.1 + pylon.prime) * 0.12
      materialRef.current.emissiveIntensity = 0.45 + charge * 1.8 + (active ? 0.55 : 0) + pulse
    }
  })

  return (
    <group
      name={`prime-pylon-${pylon.prime}`}
      position={[pylon.position.x, pylon.position.y, pylon.position.z]}
      rotation={[0, facing, 0]}
      userData={{ prime: pylon.prime, active, captured }}
    >
      <mesh position={[0, 0.18, 0]} receiveShadow castShadow={tuning.shadows}>
        <cylinderGeometry args={[1.12, 1.38, 0.36, quality === 'low' ? 8 : 12]} />
        <meshStandardMaterial color="#0b1422" emissive={pylon.color} emissiveIntensity={0.16 + charge * 0.28} metalness={0.86} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.39, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.19, tuning.circleSegments, 1, 0, TAU]} />
        <meshBasicMaterial color="#263954" transparent opacity={0.68} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={progressGeometry} position={[0, 0.405, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color={displayColor} transparent opacity={charge > 0 ? 0.96 : 0} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[0, 1.65, 0]} castShadow={tuning.shadows}>
        <cylinderGeometry args={[0.42, 0.78, 2.55, pylon.prime === 2 ? 6 : pylon.prime + 3]} />
        <meshStandardMaterial color="#14243a" emissive={pylon.color} emissiveIntensity={0.18 + charge * 0.4} metalness={0.82} roughness={0.26} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.52, 1.42, 0]} rotation={[0, 0, side * 0.13]}>
          <boxGeometry args={[0.08, 1.65, 0.14]} />
          <meshBasicMaterial color={displayColor} transparent opacity={0.38 + charge * 0.48} toneMapped={false} />
        </mesh>
      ))}

      <group ref={rotorRef} position={[0, 3.03, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.86, 0.045, 6, tuning.circleSegments]} />
          <meshBasicMaterial color={displayColor} transparent opacity={active || captured ? 0.88 : 0.42} toneMapped={false} />
        </mesh>
        {quality !== 'low' && (
          <mesh rotation={[0.7, 0, Math.PI / 2]}>
            <torusGeometry args={[0.68, 0.025, 5, tuning.circleSegments]} />
            <meshBasicMaterial color={pylon.color} transparent opacity={0.58} toneMapped={false} />
          </mesh>
        )}
      </group>

      <Float speed={reducedMotion ? 0 : active ? 2.1 : 0.8} floatIntensity={reducedMotion ? 0 : active ? 0.2 : 0.08} rotationIntensity={0}>
        <mesh ref={crystalRef} position={[0, 3.12, 0]} castShadow={tuning.shadows}>
          <octahedronGeometry args={[0.48, quality === 'high' ? 1 : 0]} />
          <meshStandardMaterial
            ref={materialRef}
            color={captured ? '#ffffff' : pylon.color}
            emissive={displayColor}
            emissiveIntensity={1.1}
            metalness={0.34}
            roughness={0.12}
          />
        </mesh>
      </Float>

      <Billboard position={[0, 4.35, 0]} follow>
        <Text fontSize={0.72} color={displayColor} outlineColor={VOID} outlineWidth={0.055}>{pylon.prime}</Text>
        <Text position={[0, -0.53, 0]} fontSize={0.13} letterSpacing={0.14} color={displayColor} outlineColor={VOID} outlineWidth={0.018}>
          {captured ? 'CAPTURADO' : active ? `SINCRONIA ${Math.round(progress * 100)}%` : 'AGUARDANDO'}
        </Text>
      </Billboard>

      {active && (
        <>
          <mesh position={[0, 6.0, 0]}>
            <cylinderGeometry args={[0.05, 0.38, 5.4, quality === 'low' ? 8 : 16, 1, true]} />
            <meshBasicMaterial
              color={pylon.color}
              transparent
              opacity={0.08 + progress * 0.14}
              depthWrite={false}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          {quality !== 'low' && (
            <Sparkles
              count={quality === 'high' ? 18 : 9}
              scale={[2.4, 5.2, 2.4]}
              position={[0, 3.15, 0]}
              size={1.35}
              speed={reducedMotion ? 0 : 0.38}
              color={pylon.color}
              opacity={0.78}
            />
          )}
        </>
      )}

      {(active || captured) && (
        <pointLight position={[0, 2.8, 0]} color={displayColor} intensity={quality === 'low' ? 4 : active ? 10 : 6} distance={active ? 10 : 7} decay={2} />
      )}
    </group>
  )
}

function OverheadCrown({
  quality,
  reducedMotion,
  activeColor,
}: {
  readonly quality: QualityLevel
  readonly reducedMotion: boolean
  readonly activeColor: string
}): JSX.Element {
  const crownRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (crownRef.current && !reducedMotion) crownRef.current.rotation.y -= delta * 0.045
  })

  if (quality === 'low') return <></>

  return (
    <group ref={crownRef} position={[0, 12.5, 0]} name="overhead-prime-crown">
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[14.5, 0.08, 6, quality === 'high' ? 96 : 64]} />
        <meshBasicMaterial color={activeColor} transparent opacity={0.22} toneMapped={false} />
      </mesh>
      {ARENA_PYLONS.map((pylon) => {
        const angle = Math.atan2(pylon.position.z, pylon.position.x)
        return (
          <mesh key={pylon.prime} position={[Math.cos(angle) * 14.5, 0, Math.sin(angle) * 14.5]} rotation={[0, -angle, Math.PI / 2]}>
            <coneGeometry args={[0.28, 2.1, 6]} />
            <meshBasicMaterial color={pylon.color} transparent opacity={0.52} toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}

function ArenaLighting({ quality, activeColor }: {
  readonly quality: QualityLevel
  readonly activeColor: string
}): JSX.Element {
  return (
    <group name="arena-lighting">
      <ambientLight intensity={quality === 'low' ? 0.58 : 0.48} color="#b8d8ff" />
      <hemisphereLight args={['#7caeff', '#07101c', quality === 'low' ? 0.92 : 0.76]} />
      <directionalLight
        position={[10, 20, 8]}
        color="#d7ecff"
        intensity={quality === 'high' ? 1.55 : 1.2}
        castShadow={quality === 'high'}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={3}
        shadow-camera-far={52}
        shadow-camera-left={-29}
        shadow-camera-right={29}
        shadow-camera-top={29}
        shadow-camera-bottom={-29}
      />
      <pointLight position={[0, 11, 0]} color={activeColor} intensity={quality === 'low' ? 10 : 18} distance={42} decay={2} />
      {quality !== 'low' ? (
        <>
          <spotLight position={[-22, 15, 18]} color="#55e6ff" intensity={34} distance={56} angle={0.7} penumbra={0.86} decay={2} />
          <spotLight position={[22, 13, -17]} color="#ff4167" intensity={25} distance={52} angle={0.66} penumbra={0.9} decay={2} />
        </>
      ) : null}
    </group>
  )
}

export default function Nucleus257World({
  quality,
  reducedMotion,
  activePrime,
  capturedPrimes,
  captureProgress,
}: Nucleus257WorldProps): JSX.Element {
  const tuning = QUALITY_TUNING[quality]
  const progress = clamp01(captureProgress)
  const captured = useMemo(() => new Set(capturedPrimes), [capturedPrimes])
  const activePylon = ARENA_PYLONS.find((pylon) => pylon.prime === activePrime)
  const activeColor = activePylon?.color ?? CORE_BLUE
  const capturedCount = ARENA_PYLONS.reduce((count, pylon) => count + Number(captured.has(pylon.prime)), 0)

  return (
    <>
      <color attach="background" args={[VOID]} />
      <fog attach="fog" args={['#07101e', 48, quality === 'low' ? 88 : 112]} />

      <group name="nucleus-257-world">
        <ArenaLighting quality={quality} activeColor={activeColor} />
        <ArenaFloor tuning={tuning} />
        <StadiumRing quality={quality} tuning={tuning} />

        {ARENA_COVERS.filter((cover) => cover.id !== 'core').map((cover) => (
          <CoverShell key={cover.id} cover={cover} shadows={tuning.shadows} />
        ))}

        <NucleusCore
          quality={quality}
          tuning={tuning}
          reducedMotion={reducedMotion}
          activeColor={activeColor}
          captureProgress={progress}
          capturedCount={capturedCount}
        />

        {ARENA_PYLONS.map((pylon) => (
          <PrimePylon
            key={pylon.prime}
            pylon={pylon}
            quality={quality}
            tuning={tuning}
            reducedMotion={reducedMotion}
            active={pylon.prime === activePrime}
            captured={captured.has(pylon.prime)}
            progress={pylon.prime === activePrime ? progress : captured.has(pylon.prime) ? 1 : 0}
          />
        ))}

        <OverheadCrown quality={quality} reducedMotion={reducedMotion} activeColor={activeColor} />

        <Sparkles
          count={tuning.particles}
          scale={[49, quality === 'low' ? 7 : 12, 49]}
          position={[0, 5.5, 0]}
          size={quality === 'low' ? 0.7 : 1.05}
          speed={reducedMotion ? 0 : 0.08}
          color="#73c9ff"
          opacity={quality === 'low' ? 0.18 : 0.3}
        />
      </group>
    </>
  )
}
