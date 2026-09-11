import { Edges, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import { MathUtils } from 'three'

import { LENS_POSITION, type WorldPosition } from './layout'

const CYAN = '#5df4e6'

export interface HiddenLensProps {
  collected: boolean
  active: boolean
  onInteract: () => void
  reducedMotion?: boolean
  position?: WorldPosition
}

export function HiddenLens({
  collected,
  active,
  onInteract,
  reducedMotion = false,
  position = LENS_POSITION,
}: HiddenLensProps): JSX.Element {
  const lensRef = useRef<Group>(null)

  useFrame(({ clock }, delta) => {
    if (!lensRef.current) return
    const targetScale = collected ? 0.001 : 1
    const scale = reducedMotion
      ? targetScale
      : MathUtils.damp(lensRef.current.scale.x, targetScale, 7.5, delta)
    lensRef.current.scale.setScalar(scale)
    lensRef.current.rotation.y = reducedMotion ? -0.35 : -0.35 + Math.sin(clock.elapsedTime * 0.7) * 0.13
    lensRef.current.position.y = reducedMotion ? 0.85 : 0.85 + Math.sin(clock.elapsedTime * 1.25) * 0.07
  })

  return (
    <group position={position}>
      <mesh position={[0, -0.78, 0]} receiveShadow>
        <cylinderGeometry args={[0.65, 0.82, 0.22, 20]} />
        <meshStandardMaterial color="#0b171c" metalness={0.86} roughness={0.32} />
        <Edges color="#294550" />
      </mesh>
      <group
        ref={lensRef}
        position={[0, 0.85, 0]}
        onClick={(event) => {
          event.stopPropagation()
          if (active && !collected) onInteract()
        }}
      >
        <mesh castShadow>
          <torusGeometry args={[0.47, 0.095, 12, 42]} />
          <meshStandardMaterial
            color={active ? '#8efff4' : '#263d43'}
            emissive={active ? CYAN : '#081214'}
            emissiveIntensity={active ? 1.25 : 0.08}
            metalness={0.82}
            roughness={0.18}
          />
        </mesh>
        <mesh position={[0, 0, 0.015]}>
          <circleGeometry args={[0.39, 36]} />
          <meshPhysicalMaterial
            color="#75f5ea"
            emissive={CYAN}
            emissiveIntensity={active ? 0.42 : 0.05}
            transparent
            opacity={active ? 0.38 : 0.12}
            transmission={0.72}
            roughness={0.08}
            metalness={0.05}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, -0.78, -0.01]} rotation={[0, 0, -0.12]}>
          <boxGeometry args={[0.14, 0.8, 0.14]} />
          <meshStandardMaterial color="#304a52" metalness={0.9} roughness={0.2} />
        </mesh>
        {active && !collected ? <pointLight color={CYAN} intensity={6} distance={3.5} /> : null}
      </group>
      {!collected ? (
        <Text
          position={[0, -1.16, 0.22]}
          fontSize={0.13}
          color={active ? CYAN : '#3e5861'}
          anchorX="center"
          letterSpacing={0.14}
        >
          LENTE ESPECTRAL
        </Text>
      ) : null}
    </group>
  )
}

