import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import { readEscapeViewBob } from '../viewBob'

const GLOVE = '#1d1a18'
const SKIN = '#a97c60'

/** World scale of this level is roughly 1/7 of a metre, so the prop is tiny. */
const RIG_SCALE = 0.135

function Finger({
  position,
  rotation,
  length,
}: {
  readonly position: readonly [number, number, number]
  readonly rotation: readonly [number, number, number]
  readonly length: number
}): JSX.Element {
  return (
    <group position={position as [number, number, number]} rotation={rotation as [number, number, number]}>
      <mesh>
        <capsuleGeometry args={[0.013, length, 3, 6]} />
        <meshStandardMaterial color={GLOVE} roughness={0.92} />
      </mesh>
      <group position={[0, -length / 2 - 0.012, 0]} rotation={[0.95, 0, 0]}>
        <mesh position={[0, -length / 2.6, 0]}>
          <capsuleGeometry args={[0.012, length * 0.7, 3, 6]} />
          <meshStandardMaterial color={SKIN} roughness={0.78} />
        </mesh>
      </group>
    </group>
  )
}

/**
 * The hand that holds the torch. It hangs off the camera, sways with the stride and
 * dips when the beam is off, so the flashlight reads as carried rather than as a
 * floating spotlight.
 */
export function FlashlightViewModel({
  enabled,
  reducedMotion,
}: {
  readonly enabled: boolean
  readonly reducedMotion: boolean
}): JSX.Element {
  const root = useRef<THREE.Group>(null)
  const arm = useRef<THREE.Group>(null)
  const emitter = useRef<THREE.MeshStandardMaterial>(null)
  const camera = useThree((state) => state.camera)
  const offset = useMemo(() => new THREE.Vector3(), [])
  const previousYaw = useRef(0)
  const sway = useRef(0)

  useFrame((_, delta) => {
    if (!root.current) return
    const bob = readEscapeViewBob()
    const amplitude = bob.walk * (1 + bob.sprint * 0.5)
    const bobY = reducedMotion ? 0 : Math.sin(bob.stride * 2) * 0.012 * amplitude
    const bobX = reducedMotion ? 0 : Math.sin(bob.stride) * 0.01 * amplitude

    // The hand lags behind the turn, then catches up: weight.
    const yawDelta = THREE.MathUtils.euclideanModulo(
      camera.rotation.y - previousYaw.current + Math.PI,
      Math.PI * 2,
    ) - Math.PI
    previousYaw.current = camera.rotation.y
    sway.current = reducedMotion
      ? 0
      : THREE.MathUtils.damp(sway.current, THREE.MathUtils.clamp(yawDelta * 2.2, -0.14, 0.14), 6, delta)

    offset.set(0.052 + bobX * 0.4, -0.05 + bobY, -0.11)
    camera.localToWorld(offset)
    root.current.position.copy(offset)
    root.current.quaternion.copy(camera.quaternion)
    root.current.rotateY(sway.current)
    root.current.rotateZ(-sway.current * 0.4)

    if (arm.current) {
      // Lowered while the torch is off.
      const restY = enabled ? 0 : -0.045
      arm.current.position.y = reducedMotion
        ? restY
        : THREE.MathUtils.damp(arm.current.position.y, restY, 7, delta)
      arm.current.rotation.x = reducedMotion
        ? (enabled ? 0 : 0.5)
        : THREE.MathUtils.damp(arm.current.rotation.x, enabled ? 0 : 0.5, 7, delta)
    }
    if (emitter.current) {
      emitter.current.emissiveIntensity = enabled ? 2.4 : 0.05
      emitter.current.color.set(enabled ? '#e6fffb' : '#33403f')
    }
  })

  return (
    <group ref={root} scale={RIG_SCALE}>
      <group ref={arm}>
        <mesh position={[0.02, -0.13, 0.17]} rotation={[0.34, 0, -0.08]}>
          <capsuleGeometry args={[0.048, 0.26, 4, 8]} />
          <meshStandardMaterial color="#171412" roughness={0.95} />
        </mesh>
        <mesh position={[0.01, -0.035, 0.06]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.092, 0.052, 0.12]} />
          <meshStandardMaterial color={GLOVE} roughness={0.9} />
        </mesh>
        {[0, 1, 2, 3].map((finger) => (
          <Finger
            key={finger}
            position={[-0.018 + finger * 0.025, 0.012, 0.014]}
            rotation={[-1.12, 0, 0]}
            length={0.052 - finger * 0.004}
          />
        ))}
        <Finger position={[0.054, -0.024, 0.048]} rotation={[-0.5, 0, -1.1]} length={0.044} />

        <mesh position={[0, 0.006, -0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.033, 0.21, 14]} />
          <meshStandardMaterial color="#20292c" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.006, -0.152]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.053, 0.032, 0.062, 16]} />
          <meshStandardMaterial color="#2b3639" metalness={0.76} roughness={0.26} />
        </mesh>
        <mesh position={[0, 0.006, -0.184]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.049, 0.049, 0.012, 16]} />
          <meshStandardMaterial ref={emitter} color="#e6fffb" emissive="#9ff2ff" emissiveIntensity={2.4} />
        </mesh>
        <mesh position={[0.028, 0.032, -0.022]}>
          <boxGeometry args={[0.012, 0.012, 0.032]} />
          <meshStandardMaterial color="#1f5f68" emissive="#0d3238" emissiveIntensity={0.5} roughness={0.6} />
        </mesh>
      </group>
    </group>
  )
}

export default FlashlightViewModel
