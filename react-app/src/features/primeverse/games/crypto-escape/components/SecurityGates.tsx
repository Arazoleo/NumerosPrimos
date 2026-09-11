import { Edges, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import { MathUtils } from 'three'

import { GATE_Z_POSITIONS, type WorldPosition } from './layout'

const CYAN = '#5df4e6'
const RED = '#ff5d7e'

export interface SecurityGatesProps {
  unlocked: number
  reducedMotion?: boolean
  positions?: readonly WorldPosition[]
}

interface SecurityGateProps {
  index: number
  position: WorldPosition
  open: boolean
  reducedMotion: boolean
  lit: boolean
}

export const DEFAULT_GATE_POSITIONS: readonly WorldPosition[] = GATE_Z_POSITIONS.map(
  (z) => [0, 0.72, z] as const,
)

function SecurityGate({ index, position, open, reducedMotion, lit }: SecurityGateProps): JSX.Element {
  const leftRef = useRef<Group>(null)
  const rightRef = useRef<Group>(null)

  useFrame((_, delta) => {
    const leftTarget = open ? -7 : -2.08
    const rightTarget = open ? 7 : 2.08
    if (leftRef.current) {
      leftRef.current.position.x = reducedMotion
        ? leftTarget
        : MathUtils.damp(leftRef.current.position.x, leftTarget, 4.8, delta)
    }
    if (rightRef.current) {
      rightRef.current.position.x = reducedMotion
        ? rightTarget
        : MathUtils.damp(rightRef.current.position.x, rightTarget, 4.8, delta)
    }
  })

  return (
    <group position={position}>
      <group ref={leftRef} position={[-2.08, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[4.16, 5.25, 0.34]} />
          <meshStandardMaterial
            color="#10212a"
            emissive={open ? CYAN : RED}
            emissiveIntensity={open ? 0.14 : 0.18}
            metalness={0.9}
            roughness={0.27}
          />
          <Edges color={open ? CYAN : '#9f4055'} threshold={18} />
        </mesh>
        {[0.78, 0, -0.78].map((y) => (
          <mesh key={y} position={[0.2, y, 0.19]} rotation={[0, 0, -0.25]}>
            <boxGeometry args={[3.42, 0.045, 0.04]} />
            <meshBasicMaterial color={open ? CYAN : RED} transparent opacity={0.38} />
          </mesh>
        ))}
      </group>
      <group ref={rightRef} position={[2.08, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[4.16, 5.25, 0.34]} />
          <meshStandardMaterial
            color="#10212a"
            emissive={open ? CYAN : RED}
            emissiveIntensity={open ? 0.14 : 0.18}
            metalness={0.9}
            roughness={0.27}
          />
          <Edges color={open ? CYAN : '#9f4055'} threshold={18} />
        </mesh>
        {[0.78, 0, -0.78].map((y) => (
          <mesh key={y} position={[-0.2, y, 0.19]} rotation={[0, 0, 0.25]}>
            <boxGeometry args={[3.42, 0.045, 0.04]} />
            <meshBasicMaterial color={open ? CYAN : RED} transparent opacity={0.38} />
          </mesh>
        ))}
      </group>

      <mesh position={[0, 3.05, 0.2]}>
        <boxGeometry args={[2.5, 0.46, 0.22]} />
        <meshStandardMaterial
          color="#0a171d"
          emissive={open ? CYAN : RED}
          emissiveIntensity={open ? 0.7 : 0.42}
          metalness={0.82}
          roughness={0.25}
        />
      </mesh>
      <Text
        position={[0, 3.06, 0.34]}
        fontSize={0.16}
        color={open ? '#dffff9' : '#ffd9e1'}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.13}
      >
        {open ? `PORTÃO 0${index + 1} · ABERTO` : `PORTÃO 0${index + 1} · SELADO`}
      </Text>
      <pointLight
        visible={lit}
        position={[0, 2.65, 1.15]}
        color={open ? CYAN : RED}
        intensity={open ? 5 : 3}
        distance={4.5}
      />
    </group>
  )
}

export function SecurityGates({
  unlocked,
  reducedMotion = false,
  positions = DEFAULT_GATE_POSITIONS,
}: SecurityGatesProps): JSX.Element {
  const safeUnlocked = MathUtils.clamp(Math.floor(unlocked), 0, GATE_Z_POSITIONS.length)

  return (
    <group>
      {GATE_Z_POSITIONS.map((z, index) => (
        <SecurityGate
          key={z}
          index={index}
          position={positions[index] ?? DEFAULT_GATE_POSITIONS[index]}
          open={index < safeUnlocked}
          lit={index === Math.min(safeUnlocked, GATE_Z_POSITIONS.length - 1)}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  )
}
