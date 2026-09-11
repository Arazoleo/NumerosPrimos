import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import {
  BACKROOMS_CEILING_Y,
  BACKROOMS_FLOOR_Y,
  BACKROOMS_POINTS_OF_INTEREST,
  DEFAULT_BACKROOMS_ORIGIN,
  type BackroomsOrigin,
  type BackroomsPointOfInterest,
  type BackroomsPointOfInterestKind,
} from './backroomsLayout'

export interface BackroomsPointsOfInterestProps {
  readonly origin?: BackroomsOrigin
  readonly discoveredIds?: readonly BackroomsPointOfInterestKind[]
  readonly onInteract?: (point: BackroomsPointOfInterest) => void
}

function ReceptionDesk(): JSX.Element {
  return (
    <group>
      <mesh position={[0, BACKROOMS_FLOOR_Y + 0.82, 0]} castShadow>
        <boxGeometry args={[3.4, 1.55, 1.35]} />
        <meshStandardMaterial color="#66582e" roughness={0.86} />
      </mesh>
      <mesh position={[0, BACKROOMS_FLOOR_Y + 1.63, 0]}>
        <boxGeometry args={[3.7, 0.12, 1.55]} />
        <meshStandardMaterial color="#8b7a43" roughness={0.68} />
      </mesh>
      <mesh position={[-0.8, BACKROOMS_FLOOR_Y + 1.73, -0.1]} rotation={[-0.08, 0.18, 0]}>
        <boxGeometry args={[0.9, 0.035, 0.65]} />
        <meshStandardMaterial color="#d8cc92" roughness={0.95} />
      </mesh>
    </group>
  )
}

function SilentPhone(): JSX.Element {
  const handset = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (handset.current) handset.current.rotation.z = Math.sin(clock.elapsedTime * 0.9) * 0.015
  })
  return (
    <group position={[0, BACKROOMS_FLOOR_Y + 0.68, 0]}>
      <mesh position={[0, -0.47, 0]} castShadow>
        <cylinderGeometry args={[0.44, 0.5, 0.88, 10]} />
        <meshStandardMaterial color="#605a38" roughness={0.88} />
      </mesh>
      <mesh castShadow><boxGeometry args={[0.72, 0.22, 0.6]} /><meshStandardMaterial color="#29291f" roughness={0.62} /></mesh>
      <group ref={handset} position={[0, 0.2, 0]}>
        <mesh><capsuleGeometry args={[0.09, 0.52, 5, 9]} /><meshStandardMaterial color="#171913" roughness={0.7} /></mesh>
      </group>
      <mesh position={[0, 0.13, -0.31]}><circleGeometry args={[0.06, 10]} /><meshBasicMaterial color="#d8bd64" /></mesh>
    </group>
  )
}

function FalseWindow({ discovered }: { readonly discovered: boolean }): JSX.Element {
  const glow = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    if (glow.current) glow.current.opacity = discovered ? 0.75 : 0.47 + Math.sin(clock.elapsedTime * 0.28) * 0.06
  })
  return (
    <group position={[0, 0.3, -1.46]}>
      <mesh position={[0, 0, 0.08]}>
        <boxGeometry args={[3.15, 2.55, 0.14]} />
        <meshStandardMaterial color="#675f3d" metalness={0.1} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[2.74, 2.14]} />
        <meshBasicMaterial ref={glow} color="#e5ecbd" transparent opacity={0.5} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.03]}><boxGeometry args={[0.055, 2.16, 0.04]} /><meshBasicMaterial color="#777451" /></mesh>
      <mesh position={[0, 0, -0.03]}><boxGeometry args={[2.76, 0.055, 0.04]} /><meshBasicMaterial color="#777451" /></mesh>
      <pointLight position={[0, 0, -0.5]} color="#e8f2bd" intensity={discovered ? 4.5 : 2.2} distance={7} />
    </group>
  )
}

function WaterStain(): JSX.Element {
  const rings = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (rings.current) rings.current.rotation.z = clock.elapsedTime * 0.018
  })
  return (
    <group position={[0, BACKROOMS_FLOOR_Y + 0.09, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.1, 40]} />
        <meshStandardMaterial color="#3d5138" emissive="#506442" emissiveIntensity={0.08} transparent opacity={0.75} roughness={0.28} />
      </mesh>
      <group ref={rings} rotation={[-Math.PI / 2, 0, 0]}>
        {[0.38, 0.75, 1.2, 1.68].map((radius, index) => (
          <mesh key={radius} position={[index * 0.08, -index * 0.05, -0.015]}>
            <ringGeometry args={[radius, radius + 0.025, 36]} />
            <meshBasicMaterial color="#a8b86d" transparent opacity={0.18} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function AbandonedCart(): JSX.Element {
  return (
    <group position={[0, BACKROOMS_FLOOR_Y + 0.72, 0]} rotation={[0, 0.22, 0]}>
      <mesh castShadow><boxGeometry args={[1.25, 1.45, 1.9]} /><meshStandardMaterial color="#5d543b" metalness={0.38} roughness={0.58} /></mesh>
      {[0.45, 0, -0.45].map((y) => <mesh key={y} position={[0.64, y, 0]}><boxGeometry args={[0.04, 0.055, 1.6]} /><meshBasicMaterial color="#ae9b63" /></mesh>)}
      {[-0.48, 0.48].flatMap((x) => [-0.68, 0.68].map((z) => (
        <mesh key={`${x}:${z}`} position={[x, -0.85, z]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.13, 0.045, 6, 12]} /><meshStandardMaterial color="#1c1d17" roughness={0.82} />
        </mesh>
      )))}
      {[0.45, 0.12, -0.2].map((y, index) => (
        <mesh key={y} position={[0, y, 0.1 - index * 0.18]} rotation={[0.03 * index, 0, 0]}>
          <boxGeometry args={[1.05, 0.12, 1.35]} /><meshStandardMaterial color="#c1ae72" roughness={0.94} />
        </mesh>
      ))}
    </group>
  )
}

function RedExit({ discovered }: { readonly discovered: boolean }): JSX.Element {
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.z = discovered ? clock.elapsedTime * 0.12 : 0
  })
  return (
    <group position={[0, (BACKROOMS_FLOOR_Y + BACKROOMS_CEILING_Y) / 2, 1.45]}>
      <mesh castShadow><boxGeometry args={[2.8, 4.7, 0.28]} /><meshStandardMaterial color="#7e2821" emissive="#4b0c09" emissiveIntensity={0.35} roughness={0.65} metalness={0.15} /></mesh>
      <mesh ref={ring} position={[0, 0.15, -0.17]}><torusGeometry args={[0.82, 0.055, 8, 42]} /><meshBasicMaterial color="#ef6754" transparent opacity={discovered ? 0.9 : 0.45} /></mesh>
      <mesh position={[0.92, -0.15, -0.2]}><sphereGeometry args={[0.09, 10, 8]} /><meshStandardMaterial color="#e8d283" metalness={0.8} roughness={0.2} /></mesh>
      <pointLight position={[0, 0, -0.5]} color="#b72e24" intensity={discovered ? 5 : 2.2} distance={6} />
    </group>
  )
}

function PointModel({ point, discovered }: {
  readonly point: BackroomsPointOfInterest
  readonly discovered: boolean
}): JSX.Element {
  switch (point.id) {
    case 'reception-desk': return <ReceptionDesk />
    case 'silent-phone': return <SilentPhone />
    case 'false-window': return <FalseWindow discovered={discovered} />
    case 'water-stain': return <WaterStain />
    case 'abandoned-cart': return <AbandonedCart />
    case 'red-exit': return <RedExit discovered={discovered} />
  }
}

/** Visual POIs are individually clickable and share their canonical layout data. */
export function BackroomsPointsOfInterest({
  origin = DEFAULT_BACKROOMS_ORIGIN,
  discoveredIds = [],
  onInteract,
}: BackroomsPointsOfInterestProps): JSX.Element {
  const discovered = useMemo(() => new Set(discoveredIds), [discoveredIds])
  return (
    <group position={origin as [number, number, number]}>
      {BACKROOMS_POINTS_OF_INTEREST.map((point) => (
        <group
          key={point.id}
          position={[point.position.x, 0, point.position.z]}
          onClick={onInteract ? (event) => { event.stopPropagation(); onInteract(point) } : undefined}
        >
          <PointModel point={point} discovered={discovered.has(point.id)} />
          {!discovered.has(point.id) && (
            <mesh position={[0, BACKROOMS_FLOOR_Y + 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.05, 1.11, 32]} />
              <meshBasicMaterial color="#e5d47f" transparent opacity={0.18} depthWrite={false} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

export default BackroomsPointsOfInterest
