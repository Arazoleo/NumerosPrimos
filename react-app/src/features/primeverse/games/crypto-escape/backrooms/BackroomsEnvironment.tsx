import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import BackroomsLighting, { type BackroomsQuality } from './BackroomsLighting'
import BackroomsMaze from './BackroomsMaze'
import BackroomsPointsOfInterest from './BackroomsPointsOfInterest'
import {
  BACKROOMS_CEILING_Y,
  BACKROOMS_FLOOR_Y,
  BACKROOMS_OPEN_CELLS,
  DEFAULT_BACKROOMS_ORIGIN,
  type BackroomsOrigin,
  type BackroomsPointOfInterest,
  type BackroomsPointOfInterestKind,
} from './backroomsLayout'

export interface BackroomsEnvironmentProps {
  readonly origin?: BackroomsOrigin
  readonly quality?: BackroomsQuality
  readonly reducedMotion?: boolean
  readonly shadows?: boolean
  readonly withAtmosphere?: boolean
  readonly discoveredPointIds?: readonly BackroomsPointOfInterestKind[]
  readonly onPointInteract?: (point: BackroomsPointOfInterest) => void
}

function LiminalDust({
  origin,
  quality,
  reducedMotion,
}: {
  readonly origin: BackroomsOrigin
  readonly quality: BackroomsQuality
  readonly reducedMotion: boolean
}): JSX.Element {
  const points = useRef<THREE.Points>(null)
  const count = quality === 'high' ? 420 : quality === 'medium' ? 260 : 120
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) {
      const cell = BACKROOMS_OPEN_CELLS[(index * 47 + 13) % BACKROOMS_OPEN_CELLS.length]
      const first = ((index * 73 + 29) % 101) / 101 - 0.5
      const second = ((index * 43 + 71) % 103) / 103 - 0.5
      const height = ((index * 89 + 17) % 107) / 107
      values[index * 3] = cell.x + first * 3.2
      values[index * 3 + 1] = BACKROOMS_FLOOR_Y + 0.25 + height * (BACKROOMS_CEILING_Y - BACKROOMS_FLOOR_Y - 0.5)
      values[index * 3 + 2] = cell.z + second * 3.2
    }
    return values
  }, [count])

  useFrame((_, delta) => {
    if (!points.current || reducedMotion) return
    points.current.rotation.y += delta * 0.0007
    points.current.position.y = origin[1] + Math.sin(performance.now() * 0.00014) * 0.018
  })

  return (
    <points ref={points} position={origin as [number, number, number]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#e4dca4" size={quality === 'low' ? 0.025 : 0.035} transparent opacity={0.2} depthWrite={false} />
    </points>
  )
}

/**
 * Complete liminal scene module. `origin` translates rendering and is also
 * accepted by the collision helpers exported from `backroomsLayout`.
 */
export function BackroomsEnvironment({
  origin = DEFAULT_BACKROOMS_ORIGIN,
  quality = 'medium',
  reducedMotion = false,
  shadows = quality !== 'low',
  withAtmosphere = true,
  discoveredPointIds = [],
  onPointInteract,
}: BackroomsEnvironmentProps): JSX.Element {
  return (
    <>
      {withAtmosphere && (
        <>
          <color attach="background" args={['#14110a']} />
          <fog attach="fog" args={['#241f12', 5, quality === 'low' ? 26 : 34]} />
          {/* Deliberately near-black: the flashlight has to be the reason you can
              see, otherwise switching it off changes nothing. */}
          <ambientLight color="#d6cb8b" intensity={0.07} />
          <hemisphereLight color="#efe5ad" groundColor="#1a180f" intensity={0.11} />
        </>
      )}
      <BackroomsMaze origin={origin} shadows={shadows} detailed={quality !== 'low'} />
      <BackroomsLighting origin={origin} quality={quality} reducedMotion={reducedMotion} />
      <BackroomsPointsOfInterest origin={origin} discoveredIds={discoveredPointIds} onInteract={onPointInteract} />
      <LiminalDust origin={origin} quality={quality} reducedMotion={reducedMotion} />
    </>
  )
}

export default BackroomsEnvironment

