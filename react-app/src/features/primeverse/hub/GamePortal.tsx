import { Float, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import * as THREE from 'three'
import type { PrimeverseGame } from '../catalog'

interface GamePortalProps {
  game: PrimeverseGame
  position: [number, number, number]
  rotationY: number
  selected: boolean
  isDragging: boolean
  reducedMotion: boolean
  suppressClickRef: MutableRefObject<boolean>
  onSelect: (game: PrimeverseGame) => void
}

export default function GamePortal({
  game,
  position,
  rotationY,
  selected,
  isDragging,
  reducedMotion,
  suppressClickRef,
  onSelect,
}: GamePortalProps) {
  const groupRef = useRef<THREE.Group>(null)
  const innerRingRef = useRef<THREE.Mesh>(null)
  const energyRef = useRef<THREE.MeshBasicMaterial>(null)
  const [hovered, setHovered] = useState(false)
  const active = game.status === 'available'
  const engaged = !isDragging && (selected || hovered)

  useEffect(() => {
    if (isDragging) setHovered(false)
  }, [isDragging])

  useFrame(({ clock }, delta) => {
    if (!groupRef.current || !innerRingRef.current) return
    const phase = clock.elapsedTime + rotationY * 1.7
    if (reducedMotion) {
      groupRef.current.rotation.y = 0
    } else {
      innerRingRef.current.rotation.z += delta * (active ? 0.38 : 0.1)
      groupRef.current.rotation.y = Math.sin(phase * 0.32) * 0.055
    }
    const targetScale = engaged ? 1.07 : .94
    groupRef.current.scale.setScalar(
      reducedMotion ? targetScale : THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, 0.09),
    )
    if (energyRef.current) {
      const targetOpacity = active ? (engaged ? 0.3 : 0.055) : 0.035
      energyRef.current.opacity = reducedMotion
        ? targetOpacity
        : THREE.MathUtils.lerp(energyRef.current.opacity, targetOpacity, 0.08)
    }
  })

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Float
        speed={reducedMotion ? 0 : active ? 1.35 : 0.45}
        rotationIntensity={reducedMotion ? 0 : active ? 0.08 : 0.02}
        floatIntensity={reducedMotion ? 0 : active ? 0.22 : 0.08}
      >
        <group
          ref={groupRef}
          onPointerEnter={(event) => {
            event.stopPropagation()
            setHovered(true)
          }}
          onPointerLeave={() => setHovered(false)}
          onClick={(event) => {
            event.stopPropagation()
            if (!suppressClickRef.current) onSelect(game)
          }}
        >
        <mesh>
          <torusGeometry args={[1.03, 0.105, 10, 56]} />
          <meshStandardMaterial
            color={active && engaged ? game.accent : '#46505e'}
            emissive={active ? game.accent : '#151b23'}
            emissiveIntensity={engaged ? 2.15 : active ? 0.28 : 0.12}
            roughness={0.28}
            metalness={0.76}
          />
        </mesh>
        <mesh ref={innerRingRef} rotation={[0, 0, Math.PI / 8]}>
          <torusGeometry args={[0.78, 0.026, 7, 32]} />
          <meshBasicMaterial color={engaged ? '#fff0a8' : '#536174'} transparent opacity={engaged ? 0.82 : 0.22} />
        </mesh>
        <mesh position={[0, 0, -0.025]}>
          <circleGeometry args={[0.93, 48]} />
          <meshBasicMaterial
            ref={energyRef}
            color={active ? game.accent : '#526071'}
            transparent
            opacity={engaged ? 0.22 : 0.045}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0, -0.035]}>
          <ringGeometry args={[0.28, 0.9, 6]} />
          <meshBasicMaterial color={engaged ? game.accent : '#465365'} transparent opacity={engaged ? 0.1 : 0.035} wireframe />
        </mesh>
        <Text
          position={[0, 0.04, 0.08]}
          fontSize={0.48}
          color={engaged ? '#fff7d0' : '#8793a2'}
          anchorX="center"
          anchorY="middle"
        >
          {active ? game.glyph : '⌁'}
        </Text>
        {selected && (
          <>
            <Text position={[0, -1.34, 0]} fontSize={0.27} color="#faf6ec" anchorX="center">
              {game.title.toUpperCase()}
            </Text>
            <Text
              position={[0, -1.67, 0]}
              fontSize={0.115}
              letterSpacing={0.16}
              color={active ? game.accent : '#526071'}
              anchorX="center"
            >
              {active ? 'PORTAL SELECIONADO' : 'EM BREVE'}
            </Text>
          </>
        )}
        {!active && (
          <group position={[0, 0.45, 0.1]} scale={0.22}>
            <mesh position={[0, -0.18, 0]}>
              <boxGeometry args={[1, 0.78, 0.12]} />
              <meshStandardMaterial color="#536174" metalness={0.8} roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.3, 0]}>
              <torusGeometry args={[0.34, 0.1, 8, 22, Math.PI]} />
              <meshStandardMaterial color="#536174" metalness={0.8} roughness={0.35} />
            </mesh>
          </group>
        )}
        </group>
      </Float>
    </group>
  )
}
