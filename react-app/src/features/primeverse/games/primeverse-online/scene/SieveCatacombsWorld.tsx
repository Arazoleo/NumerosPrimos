import { Billboard, Float, Sparkles, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { QualityLevel, QualityProfile } from '../../../graphics/useQualitySettings'
import {
  HORROR_ALTAR,
  HORROR_SEALS,
  type HorrorSealDefinition,
  type HorrorSealId,
} from '../adventure/adventureState'
import { CATACOMB_CENTER, CATACOMB_WALLS } from '../adventure/catacombsLayout'
import type { AvatarStateRef } from '../types'

interface SieveCatacombsWorldProps {
  readonly quality: QualityLevel
  readonly profile: QualityProfile
  readonly reducedMotion: boolean
  readonly localAvatar: AvatarStateRef
  readonly lanternOn: boolean
  readonly collectedSealIds: readonly HorrorSealId[]
  readonly altarReady: boolean
  readonly altarActivated: boolean
}

function CryptWall({ wall, shadows }: {
  readonly wall: (typeof CATACOMB_WALLS)[number]
  readonly shadows: boolean
}): JSX.Element {
  return (
    <group position={[wall.x, 0, wall.z]}>
      <mesh position={[0, wall.height / 2, 0]} castShadow={shadows} receiveShadow>
        <boxGeometry args={[wall.width, wall.height, wall.depth]} />
        <meshStandardMaterial color="#080d0e" emissive="#10211d" emissiveIntensity={0.13} roughness={0.92} metalness={0.12} />
      </mesh>
      <mesh position={[0, wall.height * 0.54, wall.depth / 2 + 0.006]}>
        <planeGeometry args={[Math.min(1.2, wall.width * 0.3), 1.15]} />
        <meshBasicMaterial color="#223a32" transparent opacity={0.2} />
      </mesh>
      <Text
        position={[0, wall.height * 0.54, wall.depth / 2 + 0.018]}
        fontSize={0.46}
        color="#6c8f7f"
        anchorX="center"
        anchorY="middle"
      >
        {wall.mark}
      </Text>
    </group>
  )
}

function HorrorSeal({ seal, collected, lanternOn, reducedMotion }: {
  readonly seal: HorrorSealDefinition
  readonly collected: boolean
  readonly lanternOn: boolean
  readonly reducedMotion: boolean
}): JSX.Element {
  const root = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!root.current || reducedMotion || collected) return
    root.current.rotation.y = clock.elapsedTime * 0.32 + seal.prime
  })

  const visibleEnergy = lanternOn ? 1 : 0.2
  return (
    <group position={seal.position as [number, number, number]}>
      <mesh position={[0, -0.58, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.72, 0.9, 0.38, 7]} />
        <meshStandardMaterial color="#090d0d" emissive="#173126" emissiveIntensity={collected ? 0.5 : 0.12} roughness={0.8} />
      </mesh>
      <group ref={root} visible={!collected}>
        <Float speed={reducedMotion ? 0 : 0.65} floatIntensity={reducedMotion ? 0 : 0.16} rotationIntensity={0}>
          <mesh castShadow>
            <octahedronGeometry args={[0.46, 0]} />
            <meshStandardMaterial color="#bdfbd2" emissive="#55cf8a" emissiveIntensity={0.35 + visibleEnergy * 1.65} metalness={0.45} roughness={0.19} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.7, 0.022, 5, 32]} />
            <meshBasicMaterial color="#a8ffca" transparent opacity={0.12 + visibleEnergy * 0.58} />
          </mesh>
        </Float>
      </group>
      <Billboard position={[0, 1.08, 0]} follow>
        <Text fontSize={0.32} color={collected ? '#446458' : lanternOn ? '#eaffef' : '#526c61'} outlineColor="#010403" outlineWidth={0.04}>
          {collected ? `${seal.prime} · RECUPERADO` : seal.prime}
        </Text>
      </Billboard>
      {lanternOn && !collected && <pointLight color="#8bffc0" intensity={5.5} distance={5.5} decay={2} />}
    </group>
  )
}

function ExitAltar({ ready, activated, quality, reducedMotion }: {
  readonly ready: boolean
  readonly activated: boolean
  readonly quality: QualityLevel
  readonly reducedMotion: boolean
}): JSX.Element {
  const rings = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (rings.current && !reducedMotion && (ready || activated)) rings.current.rotation.z += delta * (activated ? 0.9 : 0.24)
  })
  const accent = activated ? '#f5ffba' : ready ? '#9bf0bd' : '#394c46'

  return (
    <group position={HORROR_ALTAR.position as [number, number, number]}>
      <mesh position={[0, -0.48, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.8, 2.15, 0.72, 9]} />
        <meshStandardMaterial color="#090d0d" emissive={accent} emissiveIntensity={ready ? 0.35 : 0.08} roughness={0.75} />
      </mesh>
      <group ref={rings} position={[0, 1.65, 0]}>
        {[1.05, 1.48].map((radius, index) => (
          <mesh key={radius} rotation={[0, 0, index * Math.PI / 4]}>
            <torusGeometry args={[radius, index ? 0.035 : 0.07, 6, quality === 'low' ? 28 : 56]} />
            <meshStandardMaterial color="#17221f" emissive={accent} emissiveIntensity={ready || activated ? 1.7 : 0.24} metalness={0.68} roughness={0.22} />
          </mesh>
        ))}
        <Text fontSize={0.62} color={accent} outlineColor="#020403" outlineWidth={0.05}>23·29·31</Text>
      </group>
      <Billboard position={[0, 3.72, 0]} follow>
        <Text fontSize={0.28} color={accent} outlineColor="#020403" outlineWidth={0.035}>
          {activated ? 'A PENEIRA FOI ABERTA' : ready ? 'ATIVE O ALTAR' : 'O ALTAR PERMANECE MUDO'}
        </Text>
      </Billboard>
      {(ready || activated) && <pointLight position={[0, 1.7, 0]} color={accent} intensity={activated ? 18 : 8} distance={12} decay={2} />}
      {activated && (
        <mesh position={[0, 5.2, 0]}>
          <cylinderGeometry args={[0.12, 1.25, 9, 24, 1, true]} />
          <meshBasicMaterial color="#dffff0" transparent opacity={0.2} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

function PlayerLantern({ localAvatar, active, quality }: {
  readonly localAvatar: AvatarStateRef
  readonly active: boolean
  readonly quality: QualityLevel
}): JSX.Element | null {
  const root = useRef<THREE.Group>(null)
  const light = useRef<THREE.SpotLight>(null)
  const target = useRef<THREE.Object3D>(null)

  useEffect(() => {
    if (active && light.current && target.current) light.current.target = target.current
  }, [active])

  useFrame(() => {
    if (!root.current) return
    const state = localAvatar.current
    root.current.position.set(state.position[0], state.position[1], state.position[2])
    root.current.rotation.y = state.yaw
  })

  if (!active) return null
  return (
    <group ref={root}>
      <spotLight
        ref={light}
        position={[0, 2.1, 0.4]}
        color="#d9ffe6"
        intensity={quality === 'low' ? 38 : 62}
        distance={20}
        angle={0.48}
        penumbra={0.72}
        decay={1.7}
        castShadow={quality === 'high'}
      />
      <object3D ref={target} position={[0, 1.1, 10]} />
      <pointLight position={[0, 1.45, 0.55]} color="#bafbd0" intensity={5} distance={4.8} decay={2} />
      <mesh position={[0, 1.65, 5.1]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[3.5, 10, quality === 'low' ? 16 : 28, 1, true]} />
        <meshBasicMaterial color="#caffdc" transparent opacity={0.035} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}

export default function SieveCatacombsWorld({
  quality,
  profile,
  reducedMotion,
  localAvatar,
  lanternOn,
  collectedSealIds,
  altarReady,
  altarActivated,
}: SieveCatacombsWorldProps): JSX.Element {
  const collected = useMemo(() => new Set(collectedSealIds), [collectedSealIds])
  const graveCount = quality === 'high' ? 34 : quality === 'medium' ? 22 : 14

  return (
    <group>
      <group position={CATACOMB_CENTER as [number, number, number]}>
        <mesh position={[0, -0.24, 0]} receiveShadow>
          <cylinderGeometry args={[20.2, 21.1, 0.5, quality === 'low' ? 40 : 72]} />
          <meshStandardMaterial color="#050909" emissive="#0b1713" emissiveIntensity={0.16} roughness={0.96} />
        </mesh>
        {[5.2, 11.3, 19.8].map((radius, index) => (
          <mesh key={radius} position={[0, 0.012 + index * 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[radius - 0.04, radius + 0.04, quality === 'low' ? 40 : 80]} />
            <meshBasicMaterial color={index === 2 ? '#315b49' : '#172d25'} transparent opacity={0.42 - index * 0.07} />
          </mesh>
        ))}
        {Array.from({ length: graveCount }, (_, index) => {
          const angle = index / graveCount * Math.PI * 2 + (index % 3) * 0.09
          const radius = 15.4 + (index % 3) * 1.25
          const height = 0.7 + (index % 5) * 0.19
          return (
            <mesh
              key={index}
              position={[Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius]}
              rotation={[0.04 * (index % 2 ? 1 : -1), -angle, 0.08 * (index % 3 - 1)]}
              castShadow={profile.shadows}
            >
              <boxGeometry args={[0.46, height, 0.2]} />
              <meshStandardMaterial color="#0a1010" emissive="#163026" emissiveIntensity={0.1} roughness={0.9} />
            </mesh>
          )
        })}
        <Billboard position={[0, 5.6, 10.3]} follow>
          <Text fontSize={0.52} color="#e8fff0" outlineColor="#010303" outlineWidth={0.055}>CRIPTA DO CRIVO</Text>
          <Text position={[0, -0.43, 0]} fontSize={0.13} letterSpacing={0.18} color="#9bf0bd">A LUZ REVELA · A LUZ DENUNCIA</Text>
        </Billboard>
        {quality !== 'low' && (
          <Sparkles count={quality === 'high' ? 42 : 24} scale={[36, 7, 39]} position={[0, 2.4, 0]} size={1.15} speed={reducedMotion ? 0 : 0.045} color="#91cbaa" opacity={0.22} />
        )}
      </group>

      {CATACOMB_WALLS.map((wall) => <CryptWall key={wall.id} wall={wall} shadows={profile.shadows} />)}
      {HORROR_SEALS.map((seal) => (
        <HorrorSeal key={seal.id} seal={seal} collected={collected.has(seal.id)} lanternOn={lanternOn} reducedMotion={reducedMotion} />
      ))}
      <ExitAltar ready={altarReady} activated={altarActivated} quality={quality} reducedMotion={reducedMotion} />
      <PlayerLantern localAvatar={localAvatar} active={lanternOn} quality={quality} />

      {([[-14, 2.2, -102], [14, 2.2, -110], [-7, 1.7, -118]] as const).map((position, index) => (
        <pointLight key={index} position={position as [number, number, number]} color={index === 2 ? '#7bdba0' : '#82344a'} intensity={quality === 'low' ? 2.8 : 5} distance={8} decay={2} />
      ))}
    </group>
  )
}
