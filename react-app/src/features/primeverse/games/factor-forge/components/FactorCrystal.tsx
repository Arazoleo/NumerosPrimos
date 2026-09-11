import { Edges, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import type { Group, Mesh, MeshPhysicalMaterial } from 'three'
import { MathUtils } from 'three'

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
  const groupRef = useRef<Group>(null)
  const crystalRef = useRef<Mesh>(null)
  const materialRef = useRef<MeshPhysicalMaterial>(null)
  const bornScaleRef = useRef(0.01)
  const [hovered, setHovered] = useState(false)
  const isResolved = node.children !== null
  const accent = isPrime ? '#ffc83d' : isSelected ? '#7ff4ff' : '#25cbea'
  const baseScale = node.depth === 0 ? 1.18 : 0.9

  useEffect(() => () => {
    if (hovered) document.body.style.cursor = ''
  }, [hovered])

  useFrame((state, delta) => {
    const group = groupRef.current
    const crystal = crystalRef.current
    if (!group || !crystal) return

    bornScaleRef.current = MathUtils.damp(bornScaleRef.current, 1, 7, delta)
    const pulse = isSelected ? 1 + Math.sin(state.clock.elapsedTime * 3.4) * 0.055 : 1
    const hoverScale = hovered ? 1.08 : 1
    const resolvedScale = isResolved ? 0.68 : 1
    const scale = bornScaleRef.current * baseScale * pulse * hoverScale * resolvedScale
    group.scale.setScalar(scale)
    crystal.rotation.y += delta * (isPrime ? 0.22 : 0.36)
    crystal.rotation.x = Math.sin(state.clock.elapsedTime * 0.45 + node.depth) * 0.08

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
    <group ref={groupRef} position={position}>
      {isSelected && !isResolved ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.18, 0.025, 8, 64]} />
          <meshBasicMaterial color="#9ff8ff" transparent opacity={0.7} />
        </mesh>
      ) : null}

      <mesh
        ref={crystalRef}
        castShadow={quality !== 'low'}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(node.id)
        }}
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
          emissiveIntensity={0.5}
          metalness={0.38}
          roughness={0.2}
          transmission={isResolved ? 0.08 : 0.22}
          thickness={1.2}
          transparent
          opacity={isResolved ? 0.42 : 0.92}
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
  )
}
