import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { BufferAttribute, Group, MeshBasicMaterial, Points } from 'three'

import { isPrime } from '../../../../../lib/math/primes'
import { layoutFactorTree } from '../factorLogic'
import type { FactorNodeLayout, ForgeNode, ForgeQuality } from '../types'
import { QUALITY_SETTINGS } from '../useForgeQuality'
import { FactorCrystal } from './FactorCrystal'

interface FactorTreeProps {
  nodes: readonly ForgeNode[]
  selectedNodeId: string | null
  quality: ForgeQuality
  onSelect: (nodeId: string) => void
  onLayout: (layout: readonly FactorNodeLayout[]) => void
}

function SplitBurst({
  position,
  quality,
}: {
  position: readonly [number, number, number]
  quality: ForgeQuality
}): JSX.Element {
  const groupRef = useRef<Group>(null)
  const ringMaterialRef = useRef<MeshBasicMaterial>(null)
  const particlesRef = useRef<Points>(null)
  const startedAtRef = useRef<number | null>(null)
  const count = QUALITY_SETTINGS[quality].particles
  const vectors = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => {
        const angle = (index / count) * Math.PI * 2 + (index % 3) * 0.18
        const lift = ((index % 5) - 2) * 0.16
        return [Math.cos(angle), lift, Math.sin(angle)] as const
      }),
    [count],
  )
  const basePositions = useMemo(() => new Float32Array(count * 3), [count])

  useFrame((state) => {
    if (startedAtRef.current === null) startedAtRef.current = state.clock.elapsedTime
    const age = state.clock.elapsedTime - startedAtRef.current
    const progress = Math.min(1, age / 1.05)

    if (groupRef.current) groupRef.current.visible = progress < 1
    if (ringMaterialRef.current) ringMaterialRef.current.opacity = (1 - progress) * 0.75
    if (progress >= 1) return

    const positionAttribute = particlesRef.current?.geometry.attributes.position as
      | BufferAttribute
      | undefined
    if (!positionAttribute) return

    vectors.forEach((vector, index) => {
      const distance = progress * 2.2
      positionAttribute.setXYZ(
        index,
        vector[0] * distance,
        vector[1] * distance,
        vector[2] * distance,
      )
    })
    positionAttribute.needsUpdate = true
  })

  return (
    <group ref={groupRef} position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.045, 8, 56]} />
        <meshBasicMaterial ref={ringMaterialRef} color="#b6f9ff" transparent opacity={0.75} />
      </mesh>
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[basePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#ffd45a" size={0.09} transparent depthWrite={false} />
      </points>
    </group>
  )
}

export function FactorTree({
  nodes,
  selectedNodeId,
  quality,
  onSelect,
  onLayout,
}: FactorTreeProps): JSX.Element {
  const layout = useMemo(() => layoutFactorTree(nodes), [nodes])
  const positions = useMemo(
    () => new Map(layout.map((item) => [item.id, item.position])),
    [layout],
  )

  useEffect(() => onLayout(layout), [layout, onLayout])

  return (
    <group position={[0, 2.2, 0]}>
      {nodes.map((node) => {
        if (!node.parentId) return null
        const start = positions.get(node.parentId)
        const end = positions.get(node.id)
        if (!start || !end) return null

        return (
          <Line
            key={`branch-${node.id}`}
            points={[start, end]}
            color={isPrime(node.value) ? '#d8a52a' : '#1a7f9c'}
            lineWidth={quality === 'low' ? 0.75 : 1.2}
            transparent
            opacity={0.68}
          />
        )
      })}

      {nodes.map((node) => {
        const position = positions.get(node.id) ?? ([0, 0, 0] as const)
        return (
          <FactorCrystal
            key={`${node.id}-${node.createdAt}`}
            node={node}
            position={position}
            isPrime={isPrime(node.value)}
            isSelected={selectedNodeId === node.id}
            quality={quality}
            onSelect={onSelect}
          />
        )
      })}

      {nodes.map((node) => {
        if (node.splitAt === null) return null
        const position = positions.get(node.id)
        return position ? (
          <SplitBurst key={`burst-${node.id}`} position={position} quality={quality} />
        ) : null
      })}
    </group>
  )
}
