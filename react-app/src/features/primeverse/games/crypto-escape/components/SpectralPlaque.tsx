import { Edges, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, Mesh } from 'three'
import { MathUtils } from 'three'

import { SPECTRAL_PLAQUE_POSITION, type WorldPosition } from './layout'

const CYAN = '#5df4e6'
const VIOLET = '#9f88ff'

export interface SpectralPlaqueProps {
  revealed: boolean
  active: boolean
  onInteract: () => void
  reducedMotion?: boolean
  position?: WorldPosition
}

export function SpectralPlaque({
  revealed,
  active,
  onInteract,
  reducedMotion = false,
  position = SPECTRAL_PLAQUE_POSITION,
}: SpectralPlaqueProps): JSX.Element {
  const contentRef = useRef<Group>(null)
  const scanRef = useRef<Mesh>(null)

  useFrame(({ clock }, delta) => {
    if (contentRef.current) {
      const targetScale = revealed ? 1 : 0.88
      const scale = reducedMotion
        ? targetScale
        : MathUtils.damp(contentRef.current.scale.x, targetScale, 5.5, delta)
      contentRef.current.scale.setScalar(scale)
    }
    if (scanRef.current) {
      scanRef.current.position.y = reducedMotion
        ? 0
        : -1.02 + ((clock.elapsedTime * 0.42) % 1) * 2.04
    }
  })

  return (
    <group
      position={position}
      onClick={(event) => {
        event.stopPropagation()
        if (active) onInteract()
      }}
    >
      <mesh castShadow>
        <boxGeometry args={[3.45, 2.55, 0.2]} />
        <meshStandardMaterial
          color={revealed ? '#10262e' : '#081217'}
          emissive={revealed ? VIOLET : active ? CYAN : '#020608'}
          emissiveIntensity={revealed ? 0.42 : active ? 0.07 : 0.015}
          metalness={0.78}
          roughness={revealed ? 0.26 : 0.72}
        />
        <Edges color={revealed ? VIOLET : '#15272e'} threshold={15} />
      </mesh>
      <mesh position={[0, 0, 0.115]}>
        <planeGeometry args={[3.05, 2.12]} />
        <meshBasicMaterial
          color={revealed ? '#07171c' : '#071014'}
          transparent
          opacity={revealed ? 0.94 : 0.34}
        />
      </mesh>

      <group ref={contentRef} position={[0, 0, 0.15]}>
        {revealed ? (
          <>
            <Text
              position={[0, 0.75, 0]}
              fontSize={0.16}
              color={CYAN}
              anchorX="center"
              letterSpacing={0.19}
            >
              REGISTRO ESPECTRAL
            </Text>
            <Text
              position={[0, 0.18, 0]}
              fontSize={0.42}
              color="#f4fffd"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.014}
              outlineColor="#061014"
            >
              N = 187
            </Text>
            <Text
              position={[0, -0.42, 0]}
              fontSize={0.35}
              color="#cabfff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.012}
              outlineColor="#061014"
            >
              φ(N) = 160
            </Text>
            <Text
              position={[0, -0.88, 0]}
              fontSize={0.12}
              color="#7bbeb9"
              anchorX="center"
              letterSpacing={0.1}
            >
              DOIS PRIMOS GUARDAM A CHAVE
            </Text>
          </>
        ) : (
          <>
            {[-0.68, -0.22, 0.22, 0.68].map((y, index) => (
              <mesh key={y} position={[index % 2 === 0 ? -0.25 : 0.22, y, 0]}>
                <boxGeometry args={[2.05 - index * 0.16, 0.025, 0.01]} />
                <meshBasicMaterial color="#23363c" transparent opacity={0.28} />
              </mesh>
            ))}
          </>
        )}
      </group>

      {revealed ? (
        <mesh ref={scanRef} position={[0, 0, 0.18]}>
          <planeGeometry args={[2.9, 0.025]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.48} depthWrite={false} />
        </mesh>
      ) : null}
      {active ? <pointLight position={[0, 0, 2]} color={revealed ? VIOLET : CYAN} intensity={5} distance={5} /> : null}
    </group>
  )
}

