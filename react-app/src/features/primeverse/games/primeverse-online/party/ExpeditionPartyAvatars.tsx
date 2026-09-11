import { Billboard, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { InterpolatedTransform } from '../network/interpolation'
import type { RemotePlayer } from '../network/PrimeverseOnlineClient'

interface ExpeditionPartyAvatarsProps {
  readonly peers: readonly RemotePlayer[]
  readonly sampleRemote: (playerId: string) => InterpolatedTransform | null
  readonly reducedMotion?: boolean
}

const BODY_GEOMETRY = new THREE.CapsuleGeometry(0.34, 0.72, 4, 8)
const HEAD_GEOMETRY = new THREE.SphereGeometry(0.31, 10, 7)
const LIMB_GEOMETRY = new THREE.CapsuleGeometry(0.075, 0.54, 3, 6)
const CORE_GEOMETRY = new THREE.OctahedronGeometry(0.13, 0)
const RING_GEOMETRY = new THREE.RingGeometry(0.52, 0.57, 28)

function HolographicRemoteAvatar({
  peer,
  sampleRemote,
  reducedMotion,
}: {
  readonly peer: RemotePlayer
  readonly sampleRemote: (playerId: string) => InterpolatedTransform | null
  readonly reducedMotion: boolean
}): JSX.Element {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const leftArm = useRef<THREE.Mesh>(null)
  const rightArm = useRef<THREE.Mesh>(null)
  const leftLeg = useRef<THREE.Mesh>(null)
  const rightLeg = useRef<THREE.Mesh>(null)
  const target = useMemo(() => new THREE.Vector3(), [])
  const lastPosition = useRef(new THREE.Vector3())
  const hasSample = useRef(false)

  useFrame(({ clock }, delta) => {
    if (!root.current) return
    const sample = sampleRemote(peer.id)
    if (!sample) {
      root.current.visible = false
      return
    }
    root.current.visible = true
    target.set(...sample.position)
    if (!hasSample.current || target.distanceToSquared(lastPosition.current) > 324) {
      root.current.position.copy(target)
      hasSample.current = true
    } else {
      root.current.position.lerp(target, 1 - Math.exp(-delta * 18))
    }
    lastPosition.current.copy(target)

    let yawDelta = sample.yaw - root.current.rotation.y
    while (yawDelta > Math.PI) yawDelta -= Math.PI * 2
    while (yawDelta < -Math.PI) yawDelta += Math.PI * 2
    root.current.rotation.y += yawDelta * Math.min(1, delta * 18)

    const moving = sample.animation === 'walk' || sample.animation === 'run'
    const stride = moving && !reducedMotion
      ? Math.sin(clock.elapsedTime * (sample.animation === 'run' ? 10 : 7)) * (sample.animation === 'run' ? 0.68 : 0.46)
      : 0
    if (leftArm.current) leftArm.current.rotation.x = stride
    if (rightArm.current) rightArm.current.rotation.x = -stride
    if (leftLeg.current) leftLeg.current.rotation.x = -stride * 0.76
    if (rightLeg.current) rightLeg.current.rotation.x = stride * 0.76
    if (body.current) {
      body.current.position.y = sample.animation === 'jump'
        ? 0.08
        : moving && !reducedMotion ? Math.abs(Math.sin(clock.elapsedTime * 8)) * 0.035 : 0
    }
  })

  const accent = peer.appearance.accentColor
  const bodyColor = peer.appearance.bodyColor
  return (
    <group ref={root} visible={false} dispose={null}>
      <mesh geometry={RING_GEOMETRY} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <meshBasicMaterial color={accent} transparent opacity={0.42} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <group ref={body}>
        <mesh geometry={BODY_GEOMETRY} position={[0, 1.18, 0]}>
          <meshStandardMaterial color={bodyColor} emissive={accent} emissiveIntensity={0.42} transparent opacity={0.68} roughness={0.35} metalness={0.5} depthWrite={false} />
        </mesh>
        <mesh geometry={HEAD_GEOMETRY} position={[0, 2.02, 0]}>
          <meshStandardMaterial color={bodyColor} emissive={accent} emissiveIntensity={0.48} transparent opacity={0.72} roughness={0.28} metalness={0.55} depthWrite={false} />
        </mesh>
        <mesh geometry={CORE_GEOMETRY} position={[0, 1.35, 0.34]}>
          <meshBasicMaterial color={peer.appearance.visorColor} transparent opacity={0.92} toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh ref={leftArm} geometry={LIMB_GEOMETRY} position={[-0.45, 1.25, 0]}>
          <meshBasicMaterial color={accent} transparent opacity={0.54} wireframe depthWrite={false} />
        </mesh>
        <mesh ref={rightArm} geometry={LIMB_GEOMETRY} position={[0.45, 1.25, 0]}>
          <meshBasicMaterial color={accent} transparent opacity={0.54} wireframe depthWrite={false} />
        </mesh>
        <mesh ref={leftLeg} geometry={LIMB_GEOMETRY} position={[-0.18, 0.48, 0]}>
          <meshBasicMaterial color={accent} transparent opacity={0.54} wireframe depthWrite={false} />
        </mesh>
        <mesh ref={rightLeg} geometry={LIMB_GEOMETRY} position={[0.18, 0.48, 0]}>
          <meshBasicMaterial color={accent} transparent opacity={0.54} wireframe depthWrite={false} />
        </mesh>
      </group>
      <Billboard position={[0, 2.72, 0]} follow>
        <Text fontSize={0.22} color={accent} outlineColor="#02050b" outlineWidth={0.025} anchorX="center">
          {peer.nickname}
        </Text>
        <Text position={[0, -0.25, 0]} fontSize={0.085} color="#bcd7df" letterSpacing={0.12} anchorX="center">
          ECO DE EQUIPE
        </Text>
      </Billboard>
    </group>
  )
}

export default function ExpeditionPartyAvatars({
  peers,
  sampleRemote,
  reducedMotion = false,
}: ExpeditionPartyAvatarsProps): JSX.Element | null {
  if (peers.length === 0) return null
  return (
    <group name="primeverse-expedition-party">
      {peers.map((peer) => (
        <HolographicRemoteAvatar
          key={`${peer.id}:${peer.runId ?? 'solo'}`}
          peer={peer}
          sampleRemote={sampleRemote}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  )
}
