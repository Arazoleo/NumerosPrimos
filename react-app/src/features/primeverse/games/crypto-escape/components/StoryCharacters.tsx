import { Edges, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, Mesh } from 'three'

import type { EscapePhase } from '../types'

const CYAN = '#5df4e6'
const CYAN_SOFT = '#a8fff8'
const VIOLET = '#9a79ff'
const VESPER_RED = '#ff5579'
const FLOOR_Y = -2.02

export type EscapeStorySpeaker = 'nora' | 'vesper'

export interface StoryCharactersProps {
  phase: EscapePhase
  activeSpeaker?: EscapeStorySpeaker | null
  reducedMotion: boolean
}

interface CharacterProps {
  active: boolean
  reducedMotion: boolean
  position: readonly [x: number, z: number]
}

const NORA_POSITION_BY_PHASE: Readonly<Record<EscapePhase, readonly [number, number]>> = {
  intro: [-34.2, -22.8],
  searching: [-34.2, -22.8],
  'prime-box': [-34.2, -22.8],
  'caesar-lock': [26.6, -22.8],
  'modular-lock': [-7.6, 3.8],
  'spectral-clue': [-34.2, 22.8],
  'rsa-vault': [26.6, 22.8],
  escaped: [30.4, 30.4],
}

const VESPER_POSITION_BY_PHASE: Readonly<Record<EscapePhase, readonly [number, number]>> = {
  intro: [-22.8, -34.2],
  searching: [-22.8, -34.2],
  'prime-box': [-22.8, -34.2],
  'caesar-lock': [38, -19],
  'modular-lock': [7.6, -3.8],
  'spectral-clue': [-19, 34.2],
  'rsa-vault': [38, 19],
  escaped: [38, 30.4],
}

export function getStoryCharacterFocus(
  phase: EscapePhase,
  speaker: EscapeStorySpeaker,
): readonly [number, number, number] {
  const [x, z] = speaker === 'nora'
    ? NORA_POSITION_BY_PHASE[phase]
    : VESPER_POSITION_BY_PHASE[phase]
  return [x, speaker === 'nora' ? -0.06 : 0.08, z]
}

function HologramProjector({ color }: { color: string }): JSX.Element {
  return (
    <group>
      <mesh castShadow position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.64, 0.78, 0.18, 24]} />
        <meshStandardMaterial color="#111d25" metalness={0.92} roughness={0.24} />
        <Edges color={color} threshold={18} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.48, 0.58, 0.08, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          transparent
          opacity={0.5}
        />
      </mesh>
      <mesh position={[0, 1.18, 0]}>
        <cylinderGeometry args={[0.38, 0.58, 1.95, 24, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.045} depthWrite={false} />
      </mesh>
      {[0.32, 0.68, 1.04].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.43, 0.46, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

function NoraDrone({ active, reducedMotion, position }: CharacterProps): JSX.Element {
  const droneRef = useRef<Group>(null)
  const orbitRef = useRef<Group>(null)
  const antennaRef = useRef<Group>(null)

  useFrame(({ clock }, delta) => {
    const drone = droneRef.current
    const orbit = orbitRef.current
    const antenna = antennaRef.current
    if (!drone || !orbit || !antenna) return

    if (reducedMotion) {
      drone.position.y = 1.75
      drone.rotation.y = 0
      orbit.rotation.set(0.18, 0, 0.12)
      antenna.rotation.z = 0
      return
    }

    const time = clock.elapsedTime
    drone.position.y = 1.75 + Math.sin(time * 1.45) * (active ? 0.09 : 0.055)
    drone.rotation.y += delta * (active ? 0.42 : 0.2)
    orbit.rotation.x = 0.18 + Math.sin(time * 0.62) * 0.13
    orbit.rotation.z += delta * (active ? -0.62 : -0.28)
    antenna.rotation.z = Math.sin(time * 2.1) * 0.08
  })

  return (
    <group position={[position[0], FLOOR_Y, position[1]]}>
      <HologramProjector color={CYAN} />

      <group ref={droneRef} position={[0, 1.75, 0]}>
        <group ref={orbitRef} rotation={[0.18, 0, 0.12]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.55, 0.035, 8, 38]} />
            <meshBasicMaterial color={CYAN} transparent opacity={active ? 0.92 : 0.5} />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.47, 0.018, 6, 32]} />
            <meshBasicMaterial color={CYAN_SOFT} transparent opacity={0.34} />
          </mesh>
        </group>

        <mesh castShadow scale={[1, 0.78, 0.86]}>
          <icosahedronGeometry args={[0.42, 1]} />
          <meshStandardMaterial
            color="#183e49"
            emissive={CYAN}
            emissiveIntensity={active ? 0.95 : 0.42}
            metalness={0.78}
            roughness={0.24}
            transparent
            opacity={0.9}
          />
          <Edges color={CYAN} threshold={16} />
        </mesh>

        <mesh position={[0, 0, 0.37]} scale={[1.15, 0.68, 0.4]}>
          <sphereGeometry args={[0.19, 18, 12]} />
          <meshStandardMaterial
            color={CYAN_SOFT}
            emissive={CYAN}
            emissiveIntensity={active ? 3.2 : 1.8}
            roughness={0.12}
          />
        </mesh>

        {([-1, 1] as const).map((side) => (
          <group key={side} position={[side * 0.58, 0.02, 0]}>
            <mesh rotation={[0, 0, side * 0.12]}>
              <boxGeometry args={[0.36, 0.12, 0.22]} />
              <meshStandardMaterial
                color="#17333e"
                emissive={CYAN}
                emissiveIntensity={active ? 0.7 : 0.28}
                metalness={0.86}
                roughness={0.25}
              />
              <Edges color={CYAN} threshold={18} />
            </mesh>
            <mesh position={[side * 0.19, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.12, 0.025, 6, 20]} />
              <meshBasicMaterial color={CYAN_SOFT} transparent opacity={0.7} />
            </mesh>
          </group>
        ))}

        <group ref={antennaRef} position={[0, 0.43, 0]}>
          <mesh position={[0, 0.17, 0]}>
            <cylinderGeometry args={[0.018, 0.025, 0.34, 8]} />
            <meshBasicMaterial color={CYAN} />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <sphereGeometry args={[0.055, 10, 8]} />
            <meshBasicMaterial color={CYAN_SOFT} />
          </mesh>
        </group>

        <pointLight color={CYAN} intensity={active ? 5.5 : 2.1} distance={3.4} />
      </group>

      <Text
        position={[0, 2.63, 0.02]}
        fontSize={0.16}
        color={active ? CYAN_SOFT : CYAN}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.13}
        outlineWidth={0.008}
        outlineColor="#021014"
      >
        {active ? 'NORA // TRANSMITINDO' : 'NORA // GUIA'}
      </Text>
    </group>
  )
}

function VesperSentinel({ active, reducedMotion, position }: CharacterProps): JSX.Element {
  const sentinelRef = useRef<Group>(null)
  const headRef = useRef<Group>(null)
  const scanRef = useRef<Mesh>(null)

  useFrame(({ clock }, delta) => {
    const sentinel = sentinelRef.current
    const head = headRef.current
    const scan = scanRef.current
    if (!sentinel || !head || !scan) return

    if (reducedMotion) {
      sentinel.position.y = 0.27
      sentinel.rotation.y = 0
      head.rotation.y = 0
      scan.position.y = 1.55
      return
    }

    const time = clock.elapsedTime
    sentinel.position.y = 0.27 + Math.sin(time * 0.72) * 0.025
    sentinel.rotation.y = Math.sin(time * 0.38) * 0.035
    head.rotation.y = Math.sin(time * 0.48) * (active ? 0.22 : 0.11)
    scan.position.y = 0.55 + ((time * (active ? 0.82 : 0.46)) % 2.15)
    scan.rotation.y += delta * 0.2
  })

  return (
    <group position={[position[0], FLOOR_Y, position[1]]}>
      <HologramProjector color={VIOLET} />

      <group ref={sentinelRef} position={[0, 0.27, 0]}>
        <mesh position={[0, 0.72, 0]}>
          <cylinderGeometry args={[0.3, 0.52, 1.12, 7]} />
          <meshStandardMaterial
            color="#281f46"
            emissive={VIOLET}
            emissiveIntensity={active ? 1.15 : 0.5}
            metalness={0.66}
            roughness={0.3}
            transparent
            opacity={0.72}
          />
          <Edges color={VIOLET} threshold={18} />
        </mesh>

        <mesh position={[0, 1.22, -0.03]} scale={[0.67, 0.32, 0.46]}>
          <octahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial
            color="#342954"
            emissive={VIOLET}
            emissiveIntensity={active ? 1 : 0.38}
            transparent
            opacity={0.78}
          />
          <Edges color={VIOLET} threshold={15} />
        </mesh>

        {([-1, 1] as const).map((side) => (
          <group key={side} position={[side * 0.56, 1.25, 0]}>
            <mesh rotation={[0, 0, side * -0.2]}>
              <coneGeometry args={[0.27, 0.62, 4]} />
              <meshStandardMaterial
                color="#2d2448"
                emissive={side === 1 ? VESPER_RED : VIOLET}
                emissiveIntensity={active ? 0.85 : 0.35}
                transparent
                opacity={0.76}
              />
              <Edges color={side === 1 ? VESPER_RED : VIOLET} threshold={16} />
            </mesh>
            <mesh position={[side * 0.03, -0.62, 0]} rotation={[0, 0, side * 0.08]}>
              <cylinderGeometry args={[0.09, 0.13, 0.82, 6]} />
              <meshBasicMaterial color={VIOLET} transparent opacity={0.5} />
            </mesh>
          </group>
        ))}

        <group ref={headRef} position={[0, 1.84, 0]}>
          <mesh scale={[0.72, 0.9, 0.68]}>
            <dodecahedronGeometry args={[0.34, 0]} />
            <meshStandardMaterial
              color="#241d3b"
              emissive={VIOLET}
              emissiveIntensity={active ? 0.85 : 0.34}
              metalness={0.58}
              roughness={0.24}
              transparent
              opacity={0.86}
            />
            <Edges color={VIOLET} threshold={15} />
          </mesh>
          <mesh position={[0, 0.015, 0.245]} scale={[1, 0.2, 0.28]}>
            <boxGeometry args={[0.42, 0.16, 0.09]} />
            <meshStandardMaterial
              color="#ffccdb"
              emissive={VESPER_RED}
              emissiveIntensity={active ? 4 : 2.1}
              roughness={0.08}
            />
          </mesh>
          {([-1, 1] as const).map((side) => (
            <mesh key={side} position={[side * 0.24, 0.28, -0.01]} rotation={[0, 0, side * -0.28]}>
              <coneGeometry args={[0.07, 0.42, 5]} />
              <meshBasicMaterial color={side === 1 ? VESPER_RED : VIOLET} transparent opacity={0.78} />
            </mesh>
          ))}
        </group>

        <mesh ref={scanRef} position={[0, 1.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.57, 0.012, 5, 28]} />
          <meshBasicMaterial color={VESPER_RED} transparent opacity={active ? 0.92 : 0.45} depthWrite={false} />
        </mesh>
        <pointLight position={[0, 1.84, 0.35]} color={VESPER_RED} intensity={active ? 5.8 : 1.8} distance={3.2} />
      </group>

      <Text
        position={[0, 2.72, 0.02]}
        fontSize={0.15}
        color={active ? '#ffd1dc' : VESPER_RED}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.11}
        outlineWidth={0.008}
        outlineColor="#10030a"
      >
        {active ? 'VESPER // CANAL ABERTO' : 'VESPER // SENTINELA'}
      </Text>
    </group>
  )
}

export function StoryCharacters({
  phase,
  activeSpeaker = null,
  reducedMotion,
}: StoryCharactersProps): JSX.Element {
  const vesperVisible = activeSpeaker === 'vesper' || (
    phase !== 'intro' && phase !== 'searching' && phase !== 'prime-box'
  )

  return (
    <group>
      <NoraDrone
        active={activeSpeaker === 'nora'}
        reducedMotion={reducedMotion}
        position={NORA_POSITION_BY_PHASE[phase]}
      />
      <group visible={vesperVisible}>
        <VesperSentinel
          active={activeSpeaker === 'vesper'}
          reducedMotion={reducedMotion}
          position={VESPER_POSITION_BY_PHASE[phase]}
        />
      </group>
    </group>
  )
}
