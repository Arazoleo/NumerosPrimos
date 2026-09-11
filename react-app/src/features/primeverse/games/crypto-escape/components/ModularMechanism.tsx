import { Edges, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, Mesh } from 'three'
import { MathUtils } from 'three'

import { MODULAR_POSITION, type WorldPosition } from './layout'

const RESIDUE_COUNT = 12
const CYAN = '#58f4e4'
const VIOLET = '#a28aff'
const AMBER = '#ffc34f'

export interface ModularMechanismProps {
  guess: number | null
  active: boolean
  solved: boolean
  reducedMotion?: boolean
  position?: WorldPosition
}

function normalizeResidue(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0
  return ((Math.round(value) % RESIDUE_COUNT) + RESIDUE_COUNT) % RESIDUE_COUNT
}

function residuePosition(residue: number, radius: number): readonly [number, number, number] {
  const angle = Math.PI / 2 - (residue / RESIDUE_COUNT) * Math.PI * 2
  return [Math.cos(angle) * radius, Math.sin(angle) * radius, 0.16]
}

function DialPointer({
  guess,
  solved,
  reducedMotion,
}: {
  guess: number | null
  solved: boolean
  reducedMotion: boolean
}): JSX.Element {
  const pointerRef = useRef<Group>(null)
  const residue = normalizeResidue(guess)

  useFrame((_, delta) => {
    if (!pointerRef.current) return
    const desired = -(residue / RESIDUE_COUNT) * Math.PI * 2
    if (reducedMotion) {
      pointerRef.current.rotation.z = desired
      return
    }
    const current = pointerRef.current.rotation.z
    const shortest = MathUtils.euclideanModulo(desired - current + Math.PI, Math.PI * 2) - Math.PI
    pointerRef.current.rotation.z = MathUtils.damp(current, current + shortest, 8, delta)
  })

  return (
    <group ref={pointerRef}>
      <mesh position={[0, 1.18, 0.39]}>
        <coneGeometry args={[0.15, 0.65, 5]} />
        <meshStandardMaterial
          color={solved ? '#ffffff' : AMBER}
          emissive={solved ? CYAN : AMBER}
          emissiveIntensity={solved ? 2.1 : 1.2}
          metalness={0.7}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 0.5, 0.3]}>
        <boxGeometry args={[0.055, 0.95, 0.055]} />
        <meshBasicMaterial color={solved ? CYAN : AMBER} />
      </mesh>
    </group>
  )
}

function InnerIris({ solved, reducedMotion }: { solved: boolean; reducedMotion: boolean }): JSX.Element {
  const irisRef = useRef<Group>(null)

  useFrame(({ clock }, delta) => {
    if (!irisRef.current) return
    const scale = solved ? 0.16 : 1
    const next = reducedMotion ? scale : MathUtils.damp(irisRef.current.scale.x, scale, 4.8, delta)
    irisRef.current.scale.setScalar(next)
    irisRef.current.rotation.z = reducedMotion ? 0 : clock.elapsedTime * (solved ? 0.7 : 0.12)
  })

  return (
    <group ref={irisRef}>
      {Array.from({ length: 8 }, (_, index) => (
        <mesh key={index} rotation={[0, 0, (index / 8) * Math.PI * 2]} position={[0, 0, 0.08]}>
          <circleGeometry args={[0.82, 3, 0, Math.PI * 0.72]} />
          <meshStandardMaterial
            color={index % 2 === 0 ? '#173440' : '#10242e'}
            emissive={VIOLET}
            emissiveIntensity={0.14}
            metalness={0.9}
            roughness={0.28}
            side={2}
          />
        </mesh>
      ))}
    </group>
  )
}

export function ModularMechanism({
  guess,
  active,
  solved,
  reducedMotion = false,
  position = MODULAR_POSITION,
}: ModularMechanismProps): JSX.Element {
  const haloRef = useRef<Mesh>(null)
  const selectedResidue = normalizeResidue(guess)

  useFrame(({ clock }) => {
    if (!haloRef.current) return
    haloRef.current.rotation.z = reducedMotion ? 0 : -clock.elapsedTime * 0.075
  })

  return (
    <group position={position}>
      <mesh position={[0, 0, -0.18]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <cylinderGeometry args={[2.45, 2.45, 0.36, 48]} />
        <meshStandardMaterial color="#08151d" metalness={0.91} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <torusGeometry args={[1.72, 0.16, 10, 64]} />
        <meshStandardMaterial
          color={solved ? '#285750' : '#1b3340'}
          emissive={solved ? CYAN : active ? VIOLET : '#07131a'}
          emissiveIntensity={solved ? 1.05 : active ? 0.44 : 0.12}
          metalness={0.88}
          roughness={0.22}
        />
      </mesh>
      <mesh ref={haloRef} position={[0, 0, 0.02]}>
        <torusGeometry args={[2.16, 0.025, 5, 80]} />
        <meshBasicMaterial color={active ? CYAN : '#4b6470'} transparent opacity={active ? 0.62 : 0.2} />
      </mesh>

      {Array.from({ length: RESIDUE_COUNT }, (_, residue) => {
        const selected = guess !== null && residue === selectedResidue
        const position = residuePosition(residue, 1.72)
        const color = solved ? CYAN : selected ? AMBER : active ? '#c6d9df' : '#667d87'
        return (
          <group key={residue} position={position}>
            <mesh>
              <sphereGeometry args={[selected ? 0.19 : 0.135, 12, 10]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={selected || solved ? 1.35 : 0.12}
                metalness={0.62}
                roughness={0.28}
              />
            </mesh>
            <Text
              position={[0, 0, 0.2]}
              fontSize={0.16}
              color={selected ? '#071116' : '#ffffff'}
              anchorX="center"
              anchorY="middle"
              outlineWidth={selected ? 0 : 0.012}
              outlineColor="#02070a"
            >
              {residue}
            </Text>
          </group>
        )
      })}

      <InnerIris solved={solved} reducedMotion={reducedMotion} />
      <DialPointer guess={guess} solved={solved} reducedMotion={reducedMotion} />
      <mesh position={[0, 0, -0.37]}>
        <circleGeometry args={[0.63, 32]} />
        <meshStandardMaterial
          color="#071116"
          emissive={solved ? CYAN : VIOLET}
          emissiveIntensity={solved ? 1.8 : 0.22}
          metalness={0.8}
          roughness={0.3}
        />
        <Edges color={solved ? CYAN : VIOLET} />
      </mesh>
      <Text
        position={[0, -0.03, 0.44]}
        fontSize={0.21}
        color={solved ? '#e9fffb' : active ? '#ffffff' : '#78909a'}
        anchorX="center"
        anchorY="middle"
      >
        {solved ? 'CONGRUENTE' : 'mod 12'}
      </Text>
      <Text
        position={[0, -2.63, 0.06]}
        fontSize={0.18}
        color={active ? CYAN : '#617985'}
        anchorX="center"
        letterSpacing={0.15}
      >
        CÂMARA DE RESÍDUOS
      </Text>
      {active ? <pointLight position={[0, 0, 2]} color={solved ? CYAN : VIOLET} intensity={8} distance={6} /> : null}
    </group>
  )
}
