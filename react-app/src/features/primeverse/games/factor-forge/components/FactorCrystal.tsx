import { Edges, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import type { Group, Mesh, MeshPhysicalMaterial } from 'three'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'

import type { ForgeNode, ForgeQuality } from '../types'

interface FactorCrystalProps {
  node: ForgeNode
  position: readonly [number, number, number]
  isPrime: boolean
  isSelected: boolean
  quality: ForgeQuality
  onSelect: (id: string) => void
}

export function FactorCrystal({
  node,
  position,
  isPrime,
  isSelected,
  quality,
  onSelect,
}: FactorCrystalProps): JSX.Element {
  const visualGroupRef = useRef<Group>(null)
  const crystalRef = useRef<Mesh>(null)
  const hitTargetRef = useRef<Mesh>(null)
  const materialRef = useRef<MeshPhysicalMaterial>(null)
  const bornScaleRef = useRef(0.01)
  const targetPositionRef = useRef(new Vector3())
  const camera = useThree((state) => state.camera)
  const canvasHeight = useThree((state) => state.size.height)
  const [hovered, setHovered] = useState(false)
  const isResolved = node.children !== null
  const accent = isPrime ? '#ffc83d' : isSelected ? '#7ff4ff' : '#25cbea'
  const baseScale = node.depth === 0 ? 1.18 : 0.9

  useEffect(() => () => {
    if (hovered) document.body.style.cursor = ''
  }, [hovered])

  useFrame((state, delta) => {
    const visualGroup = visualGroupRef.current
    const crystal = crystalRef.current
    if (!visualGroup || !crystal) return

    bornScaleRef.current = MathUtils.damp(bornScaleRef.current, 1, 7, delta)
    const pulse = isSelected ? 1 + Math.sin(state.clock.elapsedTime * 3.4) * 0.055 : 1
    const hoverScale = hovered ? 1.08 : 1
    const resolvedScale = isResolved ? 0.68 : 1
    const scale = bornScaleRef.current * baseScale * pulse * hoverScale * resolvedScale
    visualGroup.scale.setScalar(scale)
    crystal.rotation.y += delta * (isPrime ? 0.22 : 0.36)
    crystal.rotation.x = Math.sin(state.clock.elapsedTime * 0.45 + node.depth) * 0.08

    if (hitTargetRef.current && camera instanceof PerspectiveCamera && canvasHeight > 0) {
      const targetPosition = hitTargetRef.current.getWorldPosition(targetPositionRef.current)
      const distance = camera.position.distanceTo(targetPosition)
      const minimumRadius =
        (44 * distance * Math.tan(MathUtils.degToRad(camera.fov / 2))) / canvasHeight
      hitTargetRef.current.scale.setScalar(Math.max(0.86, minimumRadius))
    }

    if (materialRef.current) {
      materialRef.current.emissiveIntensity = MathUtils.damp(
        materialRef.current.emissiveIntensity,
        isSelected ? 1.5 : hovered ? 0.95 : isPrime ? 0.7 : 0.5,
        6,
        delta,
      )
    }
  })

  return (
    <group position={position}>
      <mesh
        ref={hitTargetRef}
        onPointerDown={(event) => {
          event.stopPropagation()
          onSelect(node.id)
        }}
      >
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group ref={visualGroupRef}>
        {isSelected && !isResolved ? (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.18, 0.025, 8, 64]} />
            <meshBasicMaterial color="#9ff8ff" transparent opacity={0.7} />
          </mesh>
        ) : null}

        <mesh
          ref={crystalRef}
          castShadow={quality !== 'low'}
          onPointerEnter={(event) => {
            event.stopPropagation()
            setHovered(true)
            document.body.style.cursor = 'pointer'
          }}
          onPointerLeave={() => {
            setHovered(false)
            document.body.style.cursor = ''
          }}
        >
          <icosahedronGeometry args={[0.86, quality === 'high' ? 1 : 0]} />
          <meshPhysicalMaterial
            ref={materialRef}
            color={isResolved ? '#143642' : accent}
            emissive={accent}
            emissiveIntensity={quality === 'low' ? 0.8 : 0.5}
            metalness={0.38}
            roughness={0.2}
            transmission={quality === 'low' ? 0 : isResolved ? 0.08 : 0.22}
            thickness={1.2}
            transparent
            opacity={quality === 'low' ? (isResolved ? 0.68 : 1) : isResolved ? 0.42 : 0.92}
          />
          <Edges color={accent} threshold={12} scale={1.015} />
        </mesh>

        <Text
          position={[0, 0, 0.9]}
          fontSize={node.value > 99 ? 0.38 : 0.47}
          color={isResolved ? '#8ca9b0' : '#ffffff'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#041017"
        >
          {node.value}
        </Text>

        {isPrime && !isResolved ? (
          <Text
            position={[0, -1.05, 0.1]}
            fontSize={0.16}
            color="#ffd869"
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.12}
          >
            PRIMO
          </Text>
        ) : null}
      </group>
    </group>
  )
}
