import { Line, Sparkles, Stars, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { QualityProfile } from '../../graphics/useQualitySettings'
import { useDiffieHellmanStore } from './diffieHellmanStore'
import type { RelayPacket } from './types'

const CYAN = '#5ff7dc'
const VIOLET = '#b28cff'
const AMBER = '#ffc857'
const RED = '#ff627f'

interface DiffieHellmanSceneProps {
  readonly profile: QualityProfile
  readonly reducedMotion: boolean
}

function RelayBackdrop({
  profile,
  reducedMotion,
}: DiffieHellmanSceneProps): JSX.Element {
  const gridRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!reducedMotion && gridRef.current) {
      gridRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.13) * 0.025
    }
  })

  return (
    <>
      <color attach="background" args={['#03070c']} />
      <fog attach="fog" args={['#03070c', 12, 27]} />
      <ambientLight intensity={0.34} />
      <directionalLight position={[-5, 8, 8]} intensity={1.6} color="#dffefa" />
      <pointLight position={[-4, 1, 3]} intensity={18} distance={10} color={CYAN} />
      <pointLight position={[4, 1, 2]} intensity={16} distance={10} color={VIOLET} />
      <pointLight position={[0, 4, -1]} intensity={13} distance={9} color={RED} />
      <Stars
        radius={42}
        depth={24}
        count={Math.round(profile.stars * 0.72)}
        factor={2.5}
        saturation={0.18}
        fade
        speed={reducedMotion ? 0 : 0.18}
      />
      <Sparkles
        count={Math.max(14, Math.round(profile.particles * 0.65))}
        scale={[15, 8, 9]}
        size={1.15}
        speed={reducedMotion ? 0 : 0.18}
        color={CYAN}
        opacity={0.28}
      />
      <group ref={gridRef} position={[0, -2.3, -1.4]}>
        <gridHelper args={[28, 28, '#21424c', '#101c27']} />
        {[3.3, 5.4, 7.4].map((radius) => (
          <mesh key={radius} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[radius, 0.012, 4, 96]} />
            <meshBasicMaterial color={CYAN} transparent opacity={0.1} />
          </mesh>
        ))}
      </group>
    </>
  )
}

function LockCore({
  color,
  active,
  reducedMotion,
}: {
  color: string
  active: boolean
  reducedMotion: boolean
}): JSX.Element {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }, delta) => {
    if (!ref.current) return
    if (!reducedMotion) ref.current.rotation.y += delta * (active ? 0.7 : 0.18)
    const scale = active && !reducedMotion ? 1 + Math.sin(clock.elapsedTime * 3) * 0.04 : 1
    ref.current.scale.setScalar(scale)
  })

  return (
    <group ref={ref}>
      <mesh>
        <octahedronGeometry args={[0.38, 0]} />
        <meshStandardMaterial
          color="#071019"
          emissive={color}
          emissiveIntensity={active ? 2.2 : 0.35}
          metalness={0.86}
          roughness={0.18}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.55, 0.025, 6, 48]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.9 : 0.24} />
      </mesh>
      {active ? <pointLight intensity={7} distance={2.3} color={color} /> : null}
    </group>
  )
}

function ParticipantStation({
  side,
  privateValue,
  sharedSecret,
  reducedMotion,
}: {
  side: 'alice' | 'bob'
  privateValue: number | null
  sharedSecret: number | null
  reducedMotion: boolean
}): JSX.Element {
  const alice = side === 'alice'
  const x = alice ? -4.25 : 4.25
  const color = alice ? CYAN : VIOLET

  return (
    <group position={[x, -0.1, 0]}>
      <mesh position={[0, -1.25, 0]}>
        <cylinderGeometry args={[1.2, 1.42, 0.28, 8]} />
        <meshStandardMaterial color="#08121b" metalness={0.78} roughness={0.28} />
      </mesh>
      <mesh position={[0, -1.1, 0]}>
        <torusGeometry args={[0.92, 0.045, 7, 52]} />
        <meshBasicMaterial color={color} transparent opacity={0.48} />
      </mesh>
      <group position={[0, -0.25, 0]}>
        <LockCore color={color} active={sharedSecret !== null} reducedMotion={reducedMotion} />
      </group>
      <Text position={[0, 1.15, 0]} fontSize={0.34} color="#f3fffd" anchorX="center">
        {alice ? 'ALICE' : 'BOB'}
      </Text>
      <Text position={[0, 0.76, 0]} fontSize={0.13} color={color} anchorX="center">
        TERMINAL PRIVADO
      </Text>
      <mesh position={[0, 0.33, -0.02]}>
        <planeGeometry args={[1.72, 0.55]} />
        <meshBasicMaterial color="#08131c" transparent opacity={0.94} />
      </mesh>
      <Text position={[0, 0.4, 0.01]} fontSize={0.16} color={color} anchorX="center">
        {alice && privateValue !== null ? `[LOCK] a = ${privateValue}` : '[LOCK] expoente protegido'}
      </Text>
      <Text position={[0, 0.13, 0.01]} fontSize={0.135} color={sharedSecret !== null ? AMBER : '#71828c'} anchorX="center">
        {sharedSecret !== null ? `[LOCK] K = ${sharedSecret}` : 'K = aguardando'}
      </Text>
    </group>
  )
}

function PublicRelay({
  prime,
  generator,
  alicePublic,
  bobPublic,
  reducedMotion,
}: {
  prime: number
  generator: number
  alicePublic: number | null
  bobPublic: number
  reducedMotion: boolean
}): JSX.Element {
  const rings = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (!reducedMotion && rings.current) rings.current.rotation.z += delta * 0.18
  })

  return (
    <group position={[0, -0.1, 0]}>
      <mesh position={[0, -1.1, 0]}>
        <cylinderGeometry args={[1.05, 1.35, 0.38, 10]} />
        <meshStandardMaterial color="#0a111a" metalness={0.9} roughness={0.2} />
      </mesh>
      <group ref={rings} position={[0, -0.25, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.73, 0.055, 7, 64]} />
          <meshStandardMaterial color="#122632" emissive={CYAN} emissiveIntensity={1.15} metalness={0.8} roughness={0.24} />
        </mesh>
        <mesh rotation={[Math.PI / 2.6, 0.3, 0]}>
          <torusGeometry args={[0.48, 0.028, 6, 54]} />
          <meshBasicMaterial color={VIOLET} transparent opacity={0.82} />
        </mesh>
      </group>
      <Text position={[0, 1.33, 0]} fontSize={0.24} color={CYAN} anchorX="center">
        RELAY PÚBLICO
      </Text>
      <mesh position={[0, 0.75, 0]}>
        <planeGeometry args={[2.35, 0.78]} />
        <meshBasicMaterial color="#06131a" transparent opacity={0.94} />
      </mesh>
      <Text position={[0, 0.93, 0.02]} fontSize={0.14} color="#95aaaF" anchorX="center">
        TODOS PODEM VER
      </Text>
      <Text position={[0, 0.66, 0.02]} fontSize={0.19} color="#effffc" anchorX="center">
        {`p = ${prime}   ·   g = ${generator}`}
      </Text>
      <Text position={[0, 0.39, 0.02]} fontSize={0.16} color={CYAN} anchorX="center">
        {`A = ${alicePublic ?? '?'}   ·   B = ${bobPublic}`}
      </Text>
    </group>
  )
}

function EveObserver({ active }: { active: boolean }): JSX.Element {
  return (
    <group position={[0, 3.15, -0.35]}>
      <mesh>
        <sphereGeometry args={[0.43, 16, 12]} />
        <meshStandardMaterial color="#17090f" emissive={RED} emissiveIntensity={active ? 2.4 : 0.7} metalness={0.72} roughness={0.24} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.7, 0.025, 5, 50]} />
        <meshBasicMaterial color={RED} transparent opacity={active ? 0.82 : 0.32} />
      </mesh>
      <Text position={[0, 0.75, 0]} fontSize={0.25} color={RED} anchorX="center">EVE</Text>
      <Text position={[0, 0.48, 0]} fontSize={0.12} color="#d28a99" anchorX="center">OBSERVA O CANAL</Text>
      <Text position={[0, -0.72, 0]} fontSize={0.15} color="#ffb1be" anchorX="center">K = ?</Text>
      <Line
        points={[[0, -0.45, 0], [0, -2.2, 0]]}
        color={RED}
        transparent
        opacity={active ? 0.58 : 0.14}
        lineWidth={1}
      />
    </group>
  )
}

function BroadcastRail(): JSX.Element {
  const points = useMemo(
    () => [new THREE.Vector3(-4.1, 1.75, 0), new THREE.Vector3(0, 1.95, 0), new THREE.Vector3(4.1, 1.75, 0)],
    [],
  )
  return (
    <group>
      <Line points={points} color="#3e7180" transparent opacity={0.45} lineWidth={1.15} />
      {[-4.1, 0, 4.1].map((x) => (
        <mesh key={x} position={[x, x === 0 ? 1.95 : 1.75, 0]}>
          <ringGeometry args={[0.12, 0.17, 24]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.65} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

function RelayPulse({
  packet,
  reducedMotion,
}: {
  packet: RelayPacket
  reducedMotion: boolean
}): JSX.Element {
  const ref = useRef<THREE.Group>(null)
  const startRef = useRef(0)
  const color = packet.kind === 'public' ? CYAN : VIOLET

  useEffect(() => {
    startRef.current = performance.now()
  }, [packet.id])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const duration = reducedMotion ? 180 : 1_250
    const progress = THREE.MathUtils.clamp((performance.now() - startRef.current) / duration, 0, 1)
    ref.current.position.x = THREE.MathUtils.lerp(-4.1, 4.1, progress)
    ref.current.position.y = 1.78 + Math.sin(progress * Math.PI) * 0.2
    ref.current.rotation.z = reducedMotion ? 0 : clock.elapsedTime * 2
  })

  return (
    <group ref={ref} position={[-4.1, 1.78, 0]}>
      <mesh>
        <icosahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial color="#f7ffff" emissive={color} emissiveIntensity={3} metalness={0.55} roughness={0.15} />
      </mesh>
      <pointLight intensity={10} distance={3} color={color} />
      <Text position={[0, 0.42, 0]} fontSize={0.14} color={color} anchorX="center">
        {packet.label}
      </Text>
    </group>
  )
}

function PrivacyLegend({ encrypted }: { encrypted: boolean }): JSX.Element {
  return (
    <group position={[0, -2, 0]}>
      <Text position={[-2.15, 0, 0]} fontSize={0.13} color={CYAN} anchorX="center">
        ◉ PÚBLICO: p · g · A · B
      </Text>
      <Text position={[2.15, 0, 0]} fontSize={0.13} color={AMBER} anchorX="center">
        {encrypted ? '[LOCK] PRIVADO: a · b · K' : '○ PRIVADO: a · b · K'}
      </Text>
    </group>
  )
}

export function DiffieHellmanScene({
  profile,
  reducedMotion,
}: DiffieHellmanSceneProps): JSX.Element {
  const challenge = useDiffieHellmanStore((state) => state.challenge)
  const privateExponent = useDiffieHellmanStore((state) => state.privateExponent)
  const publicValue = useDiffieHellmanStore((state) => state.publicValue)
  const sharedSecret = useDiffieHellmanStore((state) => state.sharedSecret)
  const pendingPacket = useDiffieHellmanStore((state) => state.pendingPacket)
  const viewportWidth = useThree((state) => state.viewport.width)
  const viewportHeight = useThree((state) => state.viewport.height)
  const sceneScale = Math.min(1, viewportWidth / 11.8, viewportHeight / 7.7)

  return (
    <>
      <RelayBackdrop profile={profile} reducedMotion={reducedMotion} />
      <group position={[0, -0.3, 0]} scale={sceneScale}>
        <BroadcastRail />
        <ParticipantStation
          side="alice"
          privateValue={privateExponent}
          sharedSecret={sharedSecret}
          reducedMotion={reducedMotion}
        />
        <PublicRelay
          prime={challenge.prime}
          generator={challenge.generator}
          alicePublic={publicValue}
          bobPublic={challenge.bobPublic}
          reducedMotion={reducedMotion}
        />
        <ParticipantStation
          side="bob"
          privateValue={null}
          sharedSecret={sharedSecret}
          reducedMotion={reducedMotion}
        />
        <EveObserver active={pendingPacket !== null} />
        <PrivacyLegend encrypted={sharedSecret !== null} />
        {pendingPacket ? (
          <RelayPulse
            key={pendingPacket.id}
            packet={pendingPacket}
            reducedMotion={reducedMotion}
          />
        ) : null}
      </group>
    </>
  )
}
