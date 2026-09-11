import { Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { MathUtils, Vector3, type Group, type MeshStandardMaterial } from 'three'

import type { EscapePhase } from '../types'
import {
  createBackroomsEntityRuntime,
  DEFAULT_BACKROOMS_ENTITY_CONFIG,
  stepBackroomsEntity,
  type BackroomsEntityConfig,
  type BackroomsEntityRuntime,
} from './backroomsEntityLogic'
import {
  BACKROOMS_FLOOR_Y,
  BACKROOMS_POINTS_OF_INTEREST,
  isBackroomsPositionWalkable,
} from './backroomsLayout'
import { useBackroomsRuntime, type BackroomsThreatLevel } from './backroomsRuntime'

export interface BackroomsEntityProps {
  readonly active: boolean
  readonly phase: EscapePhase
  readonly flashlightOn: boolean
  readonly reducedMotion: boolean
  readonly runId: number
}

const [phone, windowPoint, stain, cart, exit] = [1, 2, 3, 4, 5].map(
  (index) => BACKROOMS_POINTS_OF_INTEREST[index].position,
)

const ENTITY_CONFIG: BackroomsEntityConfig = Object.freeze({
  ...DEFAULT_BACKROOMS_ENTITY_CONFIG,
  spawn: { ...stain },
  patrolWaypoints: Object.freeze([
    { ...stain },
    { ...cart },
    { ...exit },
    { ...windowPoint },
    { ...phone },
  ]),
  patrolSpeed: 1.05,
  investigateSpeed: 1.65,
  chaseSpeed: 3.25,
  attackDamage: 38,
  attackCooldownMs: 2_400,
  chaseMemoryMs: 1_800,
})

function hasMazeLineOfSight(
  from: { readonly x: number; readonly z: number },
  to: { readonly x: number; readonly z: number },
): boolean {
  const distance = Math.hypot(to.x - from.x, to.z - from.z)
  if (distance > 17) return false
  const steps = Math.max(1, Math.ceil(distance / 0.48))
  for (let index = 1; index < steps; index += 1) {
    const ratio = index / steps
    if (!isBackroomsPositionWalkable({
      x: MathUtils.lerp(from.x, to.x, ratio),
      z: MathUtils.lerp(from.z, to.z, ratio),
    }, 0.04)) return false
  }
  return true
}

function threatFromRuntime(runtime: BackroomsEntityRuntime): BackroomsThreatLevel {
  if (runtime.state === 'chase') return 'chase'
  if (runtime.state === 'investigate' || (runtime.state === 'dormant' && runtime.awakenStartedAtMs !== null)) {
    return 'listening'
  }
  if (runtime.state === 'stunned') return 'stunned'
  return 'quiet'
}

/** A deterministic stalker: visible enough to read, but never an unavoidable jump scare. */
export function BackroomsEntity({
  active,
  phase,
  flashlightOn,
  reducedMotion,
  runId,
}: BackroomsEntityProps): JSX.Element {
  const camera = useThree((state) => state.camera)
  const root = useRef<Group>(null)
  const bodyMaterial = useRef<MeshStandardMaterial>(null)
  const runtime = useRef(createBackroomsEntityRuntime(ENTITY_CONFIG))
  const previousCamera = useRef(new Vector3())
  const lastReportAt = useRef(0)
  const previousPhase = useRef<EscapePhase>(phase)
  const pendingStun = useRef(false)
  const observedCapture = useRef(0)
  const beamDirection = useMemo(() => new Vector3(), [])
  const toEntity = useMemo(() => new Vector3(), [])

  useEffect(() => {
    runtime.current = createBackroomsEntityRuntime(ENTITY_CONFIG)
    previousCamera.current.copy(camera.position)
    observedCapture.current = useBackroomsRuntime.getState().captureSerial
    pendingStun.current = false
  }, [camera, runId])

  useFrame(({ clock }, delta) => {
    const playerPosition = { x: camera.position.x, z: camera.position.z }
    const travelled = camera.position.distanceTo(previousCamera.current)
    const speed = delta > 0 ? travelled / delta : 0
    const entityPosition = runtime.current.position
    const lineOfSight = hasMazeLineOfSight(entityPosition, playerPosition)
    camera.getWorldDirection(beamDirection)
    toEntity.set(
      entityPosition.x - camera.position.x,
      0,
      entityPosition.z - camera.position.z,
    )
    const entityDistance = Math.max(0.001, toEntity.length())
    toEntity.divideScalar(entityDistance)
    const flashlightHitsEntity = flashlightOn && lineOfSight &&
      beamDirection.x * toEntity.x + beamDirection.z * toEntity.z > 0.82
    if (previousPhase.current === 'modular-lock' && phase === 'spectral-clue') pendingStun.current = true
    const stunRequested = active && pendingStun.current
    previousPhase.current = phase

    const result = stepBackroomsEntity(runtime.current, ENTITY_CONFIG, {
      active,
      playerPosition,
      hasLineOfSight: lineOfSight,
      ambientLight: 0.34,
      flashlightOn,
      flashlightHitsEntity,
      noise: speed > 0.32 ? {
        level: speed > 2.9 ? 0.72 : 0.28,
        position: playerPosition,
        ageMs: 0,
      } : null,
      stunRequested,
    }, delta * 1_000)
    runtime.current = result.runtime
    if (result.runtime.state === 'stunned') pendingStun.current = false

    if (result.attacked) useBackroomsRuntime.getState().takeHit(ENTITY_CONFIG.attackDamage)

    const captureSerial = useBackroomsRuntime.getState().captureSerial
    if (captureSerial !== observedCapture.current) {
      observedCapture.current = captureSerial
      runtime.current = createBackroomsEntityRuntime(ENTITY_CONFIG)
    }

    const nextPosition = runtime.current.position
    if (root.current) {
      root.current.visible = active && Math.hypot(
        nextPosition.x - playerPosition.x,
        nextPosition.z - playerPosition.z,
      ) < 42
      root.current.position.set(nextPosition.x, BACKROOMS_FLOOR_Y, nextPosition.z)
      root.current.rotation.y = runtime.current.yaw
      root.current.position.y += reducedMotion
        ? 0
        : Math.sin(clock.elapsedTime * (runtime.current.state === 'chase' ? 7 : 2.1)) * 0.045
    }
    if (bodyMaterial.current) {
      bodyMaterial.current.emissiveIntensity = runtime.current.state === 'chase'
        ? 0.2 + Math.sin(clock.elapsedTime * 9) * 0.08
        : 0.035
    }

    const now = clock.elapsedTime * 1_000
    if (now - lastReportAt.current > 125) {
      lastReportAt.current = now
      useBackroomsRuntime.getState().reportThreat(
        active ? threatFromRuntime(runtime.current) : 'quiet',
        active ? entityDistance : null,
      )
    }
    previousCamera.current.copy(camera.position)
  })

  return (
    <group ref={root} visible={false}>
      <mesh position={[0, 1.42, 0]} castShadow>
        <capsuleGeometry args={[0.3, 1.56, 5, 9]} />
        <meshStandardMaterial
          ref={bodyMaterial}
          color="#090a07"
          emissive="#54150d"
          emissiveIntensity={0.035}
          roughness={0.92}
        />
      </mesh>
      <mesh position={[0, 2.62, 0.01]} scale={[0.72, 1.08, 0.58]} castShadow>
        <sphereGeometry args={[0.48, 9, 7]} />
        <meshStandardMaterial color="#070806" roughness={0.96} />
      </mesh>
      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * 0.43, 1.72, 0]} rotation={[0, 0, side * -0.1]}>
          <mesh position={[side * 0.14, -0.62, 0]}>
            <capsuleGeometry args={[0.105, 1.28, 4, 7]} />
            <meshStandardMaterial color="#080906" roughness={0.95} />
          </mesh>
          <mesh position={[side * 0.28, -1.36, 0.03]}>
            <sphereGeometry args={[0.16, 7, 6]} />
            <meshStandardMaterial color="#070806" roughness={1} />
          </mesh>
        </group>
      ))}
      {([-1, 1] as const).map((side) => (
        <mesh key={side} position={[side * 0.15, 2.7, 0.43]}>
          <sphereGeometry args={[0.045, 7, 6]} />
          <meshBasicMaterial color="#ff3a22" toneMapped={false} />
        </mesh>
      ))}
      <Text
        position={[0, 1.55, 0.32]}
        fontSize={0.22}
        color="#a62417"
        anchorX="center"
        outlineWidth={0.012}
        outlineColor="#140300"
      >
        RESTO 1
      </Text>
      <pointLight position={[0, 2.45, 0.7]} color="#bd2818" intensity={1.6} distance={3.2} />
    </group>
  )
}

export default BackroomsEntity
