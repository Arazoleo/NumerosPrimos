import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MathUtils, Vector3 } from 'three'

import { useFactorForgeStore } from './factorForgeStore'
import type { FactorNodeLayout, ForgeQuality } from './types'
import { FactorTree } from './components/FactorTree'
import { ForgeEnvironment } from './components/ForgeEnvironment'

interface FactorForgeSceneProps {
  quality: ForgeQuality
}

function SmoothForgeCamera({
  layout,
  selectedNodeId,
}: {
  layout: readonly FactorNodeLayout[]
  selectedNodeId: string | null
}): null {
  const camera = useThree((state) => state.camera)
  const canvasWidth = useThree((state) => state.size.width)
  const desiredPositionRef = useRef(new Vector3(0, 0.5, 11))
  const desiredTargetRef = useRef(new Vector3(0, 0, 0))
  const currentTargetRef = useRef(new Vector3(0, 0, 0))

  const framing = useMemo(() => {
    if (layout.length === 0) return { centerX: 0, centerY: 0, distance: 11 }

    const xs = layout.map((item) => item.position[0])
    const ys = layout.map((item) => item.position[1] + 2.2)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const selected = layout.find((item) => item.id === selectedNodeId)
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const width = maxX - minX
    const height = maxY - minY

    const compact = canvasWidth < 680
    return {
      centerX: MathUtils.lerp(centerX, selected?.position[0] ?? centerX, 0.12),
      centerY:
        MathUtils.lerp(centerY, (selected?.position[1] ?? centerY) + 2.2, 0.08) -
        (compact ? 0.85 : 0),
      distance: Math.max(10.5, 9.4 + width * 0.72 + height * 0.3) + (compact ? 1.2 : 0),
    }
  }, [canvasWidth, layout, selectedNodeId])

  useEffect(() => {
    desiredTargetRef.current.set(framing.centerX, framing.centerY, 0)
    desiredPositionRef.current.set(framing.centerX * 0.3, framing.centerY + 0.5, framing.distance)
  }, [framing])

  useFrame((_, delta) => {
    camera.position.x = MathUtils.damp(camera.position.x, desiredPositionRef.current.x, 3.2, delta)
    camera.position.y = MathUtils.damp(camera.position.y, desiredPositionRef.current.y, 3.2, delta)
    camera.position.z = MathUtils.damp(camera.position.z, desiredPositionRef.current.z, 3.2, delta)
    currentTargetRef.current.x = MathUtils.damp(
      currentTargetRef.current.x,
      desiredTargetRef.current.x,
      3.6,
      delta,
    )
    currentTargetRef.current.y = MathUtils.damp(
      currentTargetRef.current.y,
      desiredTargetRef.current.y,
      3.6,
      delta,
    )
    camera.lookAt(currentTargetRef.current)
  })

  return null
}

export function FactorForgeScene({ quality }: FactorForgeSceneProps): JSX.Element {
  const nodes = useFactorForgeStore((state) => state.nodes)
  const selectedNodeId = useFactorForgeStore((state) => state.selectedNodeId)
  const selectNode = useFactorForgeStore((state) => state.selectNode)
  const [layout, setLayout] = useState<readonly FactorNodeLayout[]>([])
  const handleLayout = useCallback((nextLayout: readonly FactorNodeLayout[]) => {
    setLayout(nextLayout)
  }, [])

  return (
    <>
      <ForgeEnvironment quality={quality} />
      <FactorTree
        nodes={nodes}
        selectedNodeId={selectedNodeId}
        quality={quality}
        onSelect={selectNode}
        onLayout={handleLayout}
      />
      <SmoothForgeCamera layout={layout} selectedNodeId={selectedNodeId} />
    </>
  )
}
