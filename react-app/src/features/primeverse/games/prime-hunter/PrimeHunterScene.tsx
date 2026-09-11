import { Line, Sparkles, Stars, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { QualityProfile } from '../../graphics/useQualitySettings'
import AsteroidPool from './AsteroidPool'

export interface HunterShot {
  id: number
  target: [number, number, number]
  kind: 'prime' | 'composite' | 'miss'
}

interface PrimeHunterSceneProps {
  profile: QualityProfile
  playing: boolean
  runId: number
  score: number
  shot: HunterShot | null
  onHit: (value: number, prime: boolean, position: [number, number, number]) => void
  onBreach: (value: number) => void
  onStageChange: (stage: number) => void
}

function FlightCamera({ playing }: { playing: boolean }) {
  const { camera, pointer } = useThree()
  const desired = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }) => {
    const idle = playing ? 1 : 0.35
    desired.set(pointer.x * 0.24 * idle, pointer.y * 0.16 * idle + Math.sin(clock.elapsedTime * 0.4) * 0.025, 8)
    camera.position.lerp(desired, 0.045)
    target.set(pointer.x * 0.32 * idle, pointer.y * 0.22 * idle, -5)
    camera.lookAt(target)
  })
  return null
}

function Cockpit() {
  const rigRef = useRef<THREE.Group>(null)
  const { pointer } = useThree()
  useFrame(() => {
    if (!rigRef.current) return
    rigRef.current.rotation.y = THREE.MathUtils.lerp(rigRef.current.rotation.y, -pointer.x * 0.14, 0.12)
    rigRef.current.rotation.x = THREE.MathUtils.lerp(rigRef.current.rotation.x, pointer.y * 0.08, 0.12)
  })

  return (
    <group ref={rigRef} position={[0, -2.75, 5.35]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.22, 1.4, 5]} />
        <meshStandardMaterial color="#171d27" emissive="#2563eb" emissiveIntensity={0.38} metalness={0.9} roughness={0.26} />
      </mesh>
      <mesh position={[-1.1, -0.08, 0]} rotation={[0.05, 0, -0.12]}>
        <boxGeometry args={[1.65, 0.08, 0.42]} />
        <meshStandardMaterial color="#111722" metalness={0.88} roughness={0.3} />
      </mesh>
      <mesh position={[1.1, -0.08, 0]} rotation={[0.05, 0, 0.12]}>
        <boxGeometry args={[1.65, 0.08, 0.42]} />
        <meshStandardMaterial color="#111722" metalness={0.88} roughness={0.3} />
      </mesh>
      <pointLight position={[0, 0.15, -0.2]} color="#ffcc1a" intensity={5} distance={4} />
    </group>
  )
}

function TargetingGrid() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.z += delta * 0.012
  })
  return (
    <group ref={groupRef} position={[0, 0, -12]}>
      {[2.6, 5, 7.8, 11].map((radius, index) => (
        <mesh key={radius}>
          <torusGeometry args={[radius, 0.012 + index * 0.004, 3, 96]} />
          <meshBasicMaterial color={index % 2 === 0 ? '#2563eb' : '#ffcc1a'} transparent opacity={0.1 - index * 0.012} />
        </mesh>
      ))}
      <Line points={[[-14, 0, 0], [14, 0, 0]]} color="#2563eb" transparent opacity={0.075} lineWidth={0.45} />
      <Line points={[[0, -8, 0], [0, 8, 0]]} color="#2563eb" transparent opacity={0.075} lineWidth={0.45} />
    </group>
  )
}

function PrimeConstellation() {
  const groupRef = useRef<THREE.Group>(null)
  const points = useMemo(() => [
    new THREE.Vector3(-7, 3.1, -18), new THREE.Vector3(-4.8, 4.2, -18), new THREE.Vector3(-2.7, 3.4, -18),
    new THREE.Vector3(0, 4.5, -18), new THREE.Vector3(2.3, 3.2, -18), new THREE.Vector3(5.2, 4, -18), new THREE.Vector3(7.3, 2.8, -18),
  ], [])
  useFrame(({ clock }) => {
    if (groupRef.current) groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.18) * 0.12
  })
  return (
    <group ref={groupRef}>
      <Line points={points} color="#ffcc1a" transparent opacity={0.11} lineWidth={0.6} />
      {[2, 3, 5, 7, 11, 13, 17].map((prime, index) => (
        <Text key={prime} position={points[index]} fontSize={0.2} color="#ffdb4d" fillOpacity={0.3}>{prime}</Text>
      ))}
    </group>
  )
}

function ShotBeam({ shot }: { shot: HunterShot }) {
  const groupRef = useRef<THREE.Group>(null)
  const elapsedRef = useRef(0)
  const color = shot.kind === 'prime' ? '#ffdb4d' : shot.kind === 'composite' ? '#ef7781' : '#5fa8ff'
  const start: [number, number, number] = [0, -2.35, 5.1]

  useFrame((_, delta) => {
    elapsedRef.current += delta
    if (!groupRef.current) return
    const opacity = Math.max(0, 1 - elapsedRef.current / 0.14)
    groupRef.current.visible = opacity > 0
    groupRef.current.scale.x = 0.65 + opacity * 0.35
  })

  return (
    <group ref={groupRef}>
      <Line points={[start, shot.target]} color={color} transparent opacity={0.85} lineWidth={2.1} />
      <mesh position={shot.target}>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
    </group>
  )
}

export default function PrimeHunterScene({ profile, playing, runId, score, shot, onHit, onBreach, onStageChange }: PrimeHunterSceneProps) {
  return (
    <>
      <color attach="background" args={['#05070b']} />
      <fog attach="fog" args={['#05070b', 15, 38]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 7, 5]} color="#fff4c2" intensity={1.25} />
      <pointLight position={[-5, 1, 2]} color="#2563eb" intensity={14} distance={13} />
      <Stars radius={52} depth={30} count={profile.stars} factor={2.9} saturation={0.12} fade speed={playing ? 0.65 : 0.16} />
      <Sparkles count={profile.particles} scale={[16, 8, 25]} size={1.15} color="#ffe988" speed={playing ? 0.3 : 0.08} opacity={0.3} />
      <TargetingGrid />
      <PrimeConstellation />
      <AsteroidPool
        count={profile.asteroidSlots}
        playing={playing}
        runId={runId}
        score={score}
        onHit={onHit}
        onBreach={onBreach}
        onStageChange={onStageChange}
      />
      {shot && <ShotBeam key={shot.id} shot={shot} />}
      <Cockpit />
      <FlightCamera playing={playing} />
    </>
  )
}
