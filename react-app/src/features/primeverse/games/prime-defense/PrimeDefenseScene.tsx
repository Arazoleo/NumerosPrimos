import { Line, Sparkles, Stars, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { QualityProfile } from '../../graphics/useQualitySettings'
import { getDefenseTravelDuration } from './animation'
import {
  DEFENSE_LANES,
  DEFENSE_WAVES,
  evaluateDefenseEnemy,
} from './defenseLogic'
import { usePrimeDefenseStore } from './defenseStore'
import type {
  DefenseDivisor,
  DefenseEnemy,
  DefenseLane,
  DefenseOutcome,
  TowerPlacement,
} from './types'

const LANE_X: Readonly<Record<DefenseLane, number>> = { 0: -3.35, 1: 0, 2: 3.35 }
const SLOT_Z = [-2.1, 0.15, 2.25] as const
const ENTRY_Z = -8.1
const CORE_Z = 4.65
const CYAN = '#50f0dd'
const GOLD = '#ffd15a'
const DANGER = '#ff5c76'

const DIVISOR_COLORS: Readonly<Record<DefenseDivisor, string>> = {
  2: '#54e8ff',
  3: '#9b8cff',
  5: '#ffcb58',
  7: '#ff769d',
}

export interface PrimeDefenseSceneProps {
  profile: QualityProfile
  reducedMotion: boolean
}

function DefenseArena({ profile, reducedMotion }: PrimeDefenseSceneProps): JSX.Element {
  const sweepRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (reducedMotion || !sweepRef.current) return
    sweepRef.current.position.z = -7.8 + ((clock.elapsedTime * 1.15) % 12.5)
  })

  return (
    <>
      <color attach="background" args={['#02070b']} />
      <fog attach="fog" args={['#02070b', 13, 31]} />
      <ambientLight intensity={0.38} color="#b6d8e8" />
      <directionalLight position={[-4, 9, 7]} intensity={1.7} color="#e9ffff" />
      <pointLight position={[0, 4, 3.8]} intensity={38} distance={15} color={CYAN} />
      <pointLight position={[-6, 1, -5]} intensity={16} distance={11} color="#735dff" />
      <Stars
        radius={48}
        depth={28}
        count={Math.round(profile.stars * 0.74)}
        factor={2.2}
        saturation={0.22}
        fade
        speed={reducedMotion ? 0 : 0.18}
      />
      <Sparkles
        count={Math.max(12, Math.round(profile.particles * 0.7))}
        scale={[15, 8, 22]}
        size={1.1}
        speed={reducedMotion ? 0 : 0.2}
        color={CYAN}
        opacity={0.28}
      />

      <mesh position={[0, -0.48, -1.75]} receiveShadow={profile.shadows}>
        <boxGeometry args={[11.6, 0.32, 17.2]} />
        <meshStandardMaterial color="#07121a" metalness={0.78} roughness={0.47} />
      </mesh>
      <gridHelper args={[17, 34, '#214a57', '#0d2730']} position={[0, -0.3, -1.75]} />

      {DEFENSE_LANES.map((lane) => {
        const x = LANE_X[lane]
        return (
          <group key={lane}>
            <mesh position={[x, -0.22, -1.7]}>
              <boxGeometry args={[2.42, 0.08, 14.2]} />
              <meshStandardMaterial
                color="#0a1a23"
                emissive={lane === 1 ? '#16404a' : '#102c38'}
                emissiveIntensity={0.42}
                metalness={0.65}
                roughness={0.38}
              />
            </mesh>
            {([-1, 1] as const).map((side) => (
              <Line
                key={side}
                points={[
                  new THREE.Vector3(x + side * 1.12, -0.14, ENTRY_Z),
                  new THREE.Vector3(x + side * 1.12, -0.14, CORE_Z - 0.3),
                ]}
                color={CYAN}
                transparent
                opacity={0.16}
                lineWidth={0.7}
              />
            ))}
            <Text
              position={[x, 0.01, ENTRY_Z - 0.35]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.34}
              color="#6fa6b7"
              anchorX="center"
            >
              {`PISTA 0${lane + 1}`}
            </Text>
          </group>
        )
      })}

      <group ref={sweepRef} position={[0, -0.02, ENTRY_Z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10.6, 0.5]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.045} depthWrite={false} />
        </mesh>
      </group>

      <mesh position={[-5.65, 1.4, -1.7]}>
        <boxGeometry args={[0.18, 3.4, 16]} />
        <meshStandardMaterial color="#0b1820" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[5.65, 1.4, -1.7]}>
        <boxGeometry args={[0.18, 3.4, 16]} />
        <meshStandardMaterial color="#0b1820" metalness={0.85} roughness={0.3} />
      </mesh>
    </>
  )
}

function DivisorTower({
  placement,
  active,
  reducedMotion,
}: {
  placement: TowerPlacement
  active: boolean
  reducedMotion: boolean
}): JSX.Element {
  const rotorRef = useRef<THREE.Group>(null)
  const color = DIVISOR_COLORS[placement.divisor]

  useFrame((_, delta) => {
    if (reducedMotion || !rotorRef.current) return
    rotorRef.current.rotation.y += delta * (active ? 3.2 : 0.65)
  })

  return (
    <group position={[LANE_X[placement.lane], 0, SLOT_Z[placement.slot]]}>
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.78, 0.98, 0.35, 8]} />
        <meshStandardMaterial color="#0c1b24" metalness={0.88} roughness={0.26} />
      </mesh>
      <mesh position={[0, 0.51, 0]} castShadow>
        <cylinderGeometry args={[0.38, 0.52, 0.78, 8]} />
        <meshStandardMaterial
          color="#12262f"
          emissive={color}
          emissiveIntensity={active ? 1.65 : 0.42}
          metalness={0.8}
          roughness={0.24}
        />
      </mesh>
      <group ref={rotorRef} position={[0, 0.84, 0]} rotation={[0.2, 0, 0.1]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.56, 0.055, 7, 32]} />
          <meshBasicMaterial color={color} transparent opacity={active ? 1 : 0.72} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.45, 0.025, 6, 28]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} />
        </mesh>
      </group>
      <Text
        position={[0, 0.59, 0.41]}
        fontSize={0.35}
        color="#f4ffff"
        anchorX="center"
        anchorY="middle"
      >
        {placement.divisor}
      </Text>
      {active ? <pointLight position={[0, 0.8, 0]} intensity={10} distance={3.2} color={color} /> : null}
    </group>
  )
}

function EmptySlots({ placements }: { placements: readonly TowerPlacement[] }): JSX.Element {
  return (
    <>
      {DEFENSE_LANES.flatMap((lane) => SLOT_Z.map((z, slot) => {
        const occupied = placements.some(
          (placement) => placement.lane === lane && placement.slot === slot,
        )
        if (occupied) return null
        return (
          <group key={`${lane}-${slot}`} position={[LANE_X[lane], -0.05, z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.57, 0.69, 24]} />
              <meshBasicMaterial color="#407282" transparent opacity={0.28} />
            </mesh>
            <Text
              position={[0, 0.015, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.18}
              color="#3d6975"
              anchorX="center"
            >
              SLOT
            </Text>
          </group>
        )
      }))}
    </>
  )
}

function PrimeCore({ charge, danger, reducedMotion }: {
  charge: number
  danger: boolean
  reducedMotion: boolean
}): JSX.Element {
  const shellRef = useRef<THREE.Group>(null)
  const glow = danger ? DANGER : CYAN

  useFrame(({ clock }, delta) => {
    if (!shellRef.current) return
    if (!reducedMotion) shellRef.current.rotation.y += delta * 0.24
    const scale = reducedMotion ? 1 : 1 + Math.sin(clock.elapsedTime * 1.7) * 0.035
    shellRef.current.scale.setScalar(scale)
  })

  return (
    <group position={[0, 0.45, CORE_Z]}>
      <group ref={shellRef}>
        <mesh castShadow>
          <icosahedronGeometry args={[1.05, 2]} />
          <meshStandardMaterial
            color="#091d24"
            emissive={glow}
            emissiveIntensity={1 + Math.min(1.7, charge * 0.08)}
            metalness={0.75}
            roughness={0.18}
          />
        </mesh>
        {[1.45, 1.72].map((radius, index) => (
          <mesh key={radius} rotation={[Math.PI / (2.6 + index), index * 0.7, 0]}>
            <torusGeometry args={[radius, 0.035, 7, 54]} />
            <meshBasicMaterial color={index ? GOLD : glow} transparent opacity={0.62} />
          </mesh>
        ))}
      </group>
      <Text position={[0, 1.75, 0]} fontSize={0.22} color="#dffffb" anchorX="center">
        {`NÚCLEO PRIMO // ${charge}`}
      </Text>
      <pointLight position={[0, 0.4, 0]} color={glow} intensity={18 + charge} distance={7} />
    </group>
  )
}

function IncomingNumber({
  enemy,
  outcome,
  reducedMotion,
}: {
  enemy: DefenseEnemy
  outcome: DefenseOutcome
  reducedMotion: boolean
}): JSX.Element {
  const groupRef = useRef<THREE.Group>(null)
  const haloRef = useRef<THREE.Mesh>(null)
  const startRef = useRef(performance.now())
  const duration = getDefenseTravelDuration(reducedMotion)
  const targetZ = outcome.towerId
    ? SLOT_Z[Number(outcome.towerId.slice(-1)) as 0 | 1 | 2]
    : CORE_Z - 0.85
  const color = outcome.kind === 'intercepted'
    ? DIVISOR_COLORS[outcome.divisor ?? 2]
    : outcome.kind === 'prime-passed' ? CYAN : DANGER

  useEffect(() => {
    startRef.current = performance.now()
  }, [enemy.id])

  useFrame(({ clock }) => {
    const group = groupRef.current
    if (!group) return
    const raw = THREE.MathUtils.clamp((performance.now() - startRef.current) / duration, 0, 1)
    const progress = THREE.MathUtils.smoothstep(raw, 0, 1)
    group.position.z = THREE.MathUtils.lerp(ENTRY_Z, targetZ, progress)
    group.position.y = 0.74 + Math.sin(progress * Math.PI) * 0.32
    group.rotation.y = reducedMotion ? 0 : clock.elapsedTime * 0.8
    const endingPulse = raw > 0.72 ? 1 + Math.sin((raw - 0.72) * 24) * 0.12 : 1
    group.scale.setScalar(endingPulse)
    if (haloRef.current) haloRef.current.rotation.z = reducedMotion ? 0 : -clock.elapsedTime * 1.5
  })

  return (
    <group ref={groupRef} position={[LANE_X[enemy.lane], 0.74, ENTRY_Z]}>
      <mesh castShadow>
        <dodecahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial
          color="#10242e"
          emissive={color}
          emissiveIntensity={1.35}
          metalness={0.7}
          roughness={0.2}
        />
      </mesh>
      <mesh ref={haloRef}>
        <torusGeometry args={[0.78, 0.028, 6, 34]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>
      <Text position={[0, 0.02, 0.57]} fontSize={0.34} color="#ffffff" anchorX="center" anchorY="middle">
        {enemy.value}
      </Text>
      <pointLight color={color} intensity={7} distance={2.8} />
    </group>
  )
}

function QueuePreview({ waveIndex }: { waveIndex: number }): JSX.Element {
  const wave = DEFENSE_WAVES[waveIndex] ?? DEFENSE_WAVES[0]

  return (
    <group>
      {wave.lanes.flatMap((lane, laneIndex) => lane.map((enemy, index) => (
        <group
          key={`${laneIndex}-${index}-${enemy.value}`}
          position={[
            LANE_X[laneIndex as DefenseLane] + (index % 2 ? 0.38 : -0.38),
            0.32,
            ENTRY_Z - 0.65 - index * 0.72,
          ]}
        >
          <mesh>
            <sphereGeometry args={[0.3, 10, 10]} />
            <meshStandardMaterial
              color="#10232c"
              emissive="#376072"
              emissiveIntensity={0.46}
              metalness={0.7}
              roughness={0.28}
            />
          </mesh>
          <Text position={[0, 0, 0.31]} fontSize={0.17} color="#d7f1f5" anchorX="center" anchorY="middle">
            {enemy.value}
          </Text>
        </group>
      )))}
    </group>
  )
}

function DefenseCamera({ reducedMotion }: { reducedMotion: boolean }): null {
  const camera = useThree((state) => state.camera)
  const pointer = useThree((state) => state.pointer)
  const desired = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(0, 0.15, -1.65), [])

  useEffect(() => {
    camera.position.set(0, 8.2, 12.4)
    camera.lookAt(target)
  }, [camera, target])

  useFrame((_, delta) => {
    if (reducedMotion) return
    desired.set(pointer.x * 0.34, 8.2 + pointer.y * 0.18, 12.4)
    camera.position.x = THREE.MathUtils.damp(camera.position.x, desired.x, 2.6, delta)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, desired.y, 2.6, delta)
    camera.lookAt(target.x + pointer.x * 0.14, target.y, target.z)
  })
  return null
}

export function PrimeDefenseScene({ profile, reducedMotion }: PrimeDefenseSceneProps): JSX.Element {
  const phase = usePrimeDefenseStore((state) => state.phase)
  const waveIndex = usePrimeDefenseStore((state) => state.waveIndex)
  const placements = usePrimeDefenseStore((state) => state.placements)
  const runQueue = usePrimeDefenseStore((state) => state.runQueue)
  const activeEnemyIndex = usePrimeDefenseStore((state) => state.activeEnemyIndex)
  const coreCharge = usePrimeDefenseStore((state) => state.coreCharge)
  const lives = usePrimeDefenseStore((state) => state.lives)
  const activeEnemy = phase === 'running' ? runQueue[activeEnemyIndex] : null
  const activeOutcome = activeEnemy ? evaluateDefenseEnemy(activeEnemy, placements) : null

  return (
    <>
      <DefenseArena profile={profile} reducedMotion={reducedMotion} />
      <DefenseCamera reducedMotion={reducedMotion} />
      <PrimeCore charge={coreCharge} danger={lives <= 2} reducedMotion={reducedMotion} />
      <EmptySlots placements={placements} />
      {placements.map((placement) => (
        <DivisorTower
          key={placement.id}
          placement={placement}
          active={activeOutcome?.towerId === placement.id}
          reducedMotion={reducedMotion}
        />
      ))}
      {phase === 'planning' || phase === 'intro' ? <QueuePreview waveIndex={waveIndex} /> : null}
      {activeEnemy && activeOutcome ? (
        <IncomingNumber
          key={activeEnemy.id}
          enemy={activeEnemy}
          outcome={activeOutcome}
          reducedMotion={reducedMotion}
        />
      ) : null}
    </>
  )
}
