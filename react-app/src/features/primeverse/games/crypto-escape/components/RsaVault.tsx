import { Edges, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import { MathUtils } from 'three'

import { RSA_VAULT_POSITION, type WorldPosition } from './layout'

const CYAN = '#5df4e6'
const AMBER = '#ffc14f'
const RED = '#ff6688'

export interface RsaVaultProps {
  open: boolean
  active: boolean
  reducedMotion?: boolean
  position?: WorldPosition
}

function VaultDoor({ open, active, reducedMotion }: Omit<RsaVaultProps, 'position'>): JSX.Element {
  const hingeRef = useRef<Group>(null)
  const wheelRef = useRef<Group>(null)

  useFrame(({ clock }, delta) => {
    if (hingeRef.current) {
      const target = open ? -1.42 : 0
      hingeRef.current.rotation.y = reducedMotion
        ? target
        : MathUtils.damp(hingeRef.current.rotation.y, target, 3.7, delta)
    }
    if (wheelRef.current) {
      const target = open ? -Math.PI * 1.35 : active ? Math.sin(clock.elapsedTime * 0.45) * 0.04 : 0
      wheelRef.current.rotation.z = reducedMotion
        ? (open ? -Math.PI * 1.35 : 0)
        : MathUtils.damp(wheelRef.current.rotation.z, target, open ? 4.5 : 2.6, delta)
    }
  })

  return (
    <group ref={hingeRef} position={[-2.18, 0, 0.18]}>
      <group position={[2.18, 0, 0]}>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[2.35, 2.35, 0.48, 48]} />
          <meshStandardMaterial color="#122630" metalness={0.93} roughness={0.24} />
          <Edges color={active ? CYAN : '#56717a'} threshold={18} />
        </mesh>
        <mesh position={[0, 0, 0.27]}>
          <torusGeometry args={[1.83, 0.13, 10, 64]} />
          <meshStandardMaterial
            color="#243e48"
            emissive={active ? CYAN : '#061014'}
            emissiveIntensity={active ? 0.36 : 0.08}
            metalness={0.9}
            roughness={0.22}
          />
        </mesh>
        <group ref={wheelRef} position={[0, 0, 0.47]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.5, 0.5, 0.3, 24]} />
            <meshStandardMaterial
              color="#304c55"
              emissive={open ? CYAN : active ? AMBER : '#071014'}
              emissiveIntensity={open ? 1.4 : active ? 0.28 : 0.06}
              metalness={0.94}
              roughness={0.18}
            />
          </mesh>
          {Array.from({ length: 6 }, (_, index) => (
            <group key={index} rotation={[0, 0, (index / 6) * Math.PI * 2]}>
              <mesh position={[0, 0.91, 0]}>
                <boxGeometry args={[0.12, 1.12, 0.14]} />
                <meshStandardMaterial color="#496772" metalness={0.95} roughness={0.2} />
              </mesh>
              <mesh position={[0, 1.48, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.16, 0.16, 0.34, 12]} />
                <meshStandardMaterial color="#77919a" metalness={0.95} roughness={0.16} />
              </mesh>
            </group>
          ))}
        </group>
        <Text
          position={[0, -0.05, 0.67]}
          fontSize={0.28}
          color={open ? '#eafffb' : active ? '#fff2bd' : '#9ab0b7'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.018}
          outlineColor="#071014"
        >
          RSA
        </Text>
      </group>
    </group>
  )
}

export function RsaVault({
  open,
  active,
  reducedMotion = false,
  position = RSA_VAULT_POSITION,
}: RsaVaultProps): JSX.Element {
  return (
    <group position={position}>
      {open ? (
        <group position={[0, 0, -0.3]}>
          {([-1, 1] as const).map((side) => (
            <mesh key={`side-${side}`} position={[side * 2.86, 0, 0]}>
              <boxGeometry args={[0.54, 6.35, 0.68]} />
              <meshStandardMaterial color="#07131a" metalness={0.86} roughness={0.32} />
              <Edges color="#304e5a" threshold={20} />
            </mesh>
          ))}
          {([-1, 1] as const).map((side) => (
            <mesh key={`cap-${side}`} position={[0, side * 2.9, 0]}>
              <boxGeometry args={[5.2, 0.55, 0.68]} />
              <meshStandardMaterial color="#07131a" metalness={0.86} roughness={0.32} />
              <Edges color="#304e5a" threshold={20} />
            </mesh>
          ))}
        </group>
      ) : (
        <mesh position={[0, 0, -0.3]}>
          <boxGeometry args={[6.25, 6.35, 0.68]} />
          <meshStandardMaterial color="#07131a" metalness={0.86} roughness={0.32} />
          <Edges color="#304e5a" threshold={20} />
        </mesh>
      )}
      <mesh position={[0, 0, 0.06]}>
        <torusGeometry args={[2.72, 0.3, 12, 64]} />
        <meshStandardMaterial
          color="#182f39"
          emissive={active ? (open ? CYAN : RED) : '#061014'}
          emissiveIntensity={active ? 0.26 : 0.06}
          metalness={0.93}
          roughness={0.24}
        />
      </mesh>
      {!open ? (
        <mesh position={[0, 0, -0.01]}>
          <circleGeometry args={[2.42, 48]} />
          <meshBasicMaterial color="#071014" />
        </mesh>
      ) : null}
      <VaultDoor open={open} active={active} reducedMotion={reducedMotion} />

      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * 2.83, 0, 0.13]}>
          {[-1.8, 0, 1.8].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <boxGeometry args={[0.18, 0.72, 0.2]} />
              <meshBasicMaterial color={open ? CYAN : active ? RED : '#47606a'} />
            </mesh>
          ))}
        </group>
      ))}
      <Text
        position={[0, 3.6, 0.1]}
        fontSize={0.24}
        color={open ? CYAN : active ? '#ffb0c1' : '#718992'}
        anchorX="center"
        letterSpacing={0.2}
      >
        {open ? 'ACESSO AO NÚCLEO CONCEDIDO' : 'COFRE CRIPTOGRÁFICO'}
      </Text>
      {active ? (
        <pointLight
          position={[0, 1, 3]}
          color={open ? CYAN : RED}
          intensity={open ? 14 : 8}
          distance={8}
        />
      ) : null}
    </group>
  )
}
