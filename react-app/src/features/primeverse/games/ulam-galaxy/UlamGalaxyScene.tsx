import { Line, Sparkles, Stars, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { QualityLevel, QualityProfile } from '../../graphics/useQualitySettings'
import { createUlamSpiral, getMissionPath, ULAM_DIRECTIONS } from './ulamLogic'
import { useUlamGalaxyStore } from './ulamStore'
import type { UlamCell, UlamDirectionId } from './types'

const CYAN = '#5df4df'
const VIOLET = '#a58cff'
const AMBER = '#ffc75b'
const RED = '#ff718c'

interface UlamGalaxySceneProps {
  quality: QualityLevel
  profile: QualityProfile
  reducedMotion: boolean
}

function cellPoint(cell: Pick<UlamCell, 'x' | 'y' | 'value' | 'prime'>, spacing: number): THREE.Vector3 {
  return new THREE.Vector3(
    cell.x * spacing,
    cell.y * spacing,
    cell.prime ? 0.08 + Math.sin(cell.value * 1.73) * 0.035 : 0,
  )
}

function InstancedCells({
  cells,
  spacing,
  prime,
  scannerEnabled,
  lowDetail,
}: {
  cells: readonly UlamCell[]
  spacing: number
  prime: boolean
  scannerEnabled: boolean
  lowDetail: boolean
}): JSX.Element {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const filtered = useMemo(() => cells.filter((cell) => cell.prime === prime), [cells, prime])
  const matrix = useMemo(() => new THREE.Matrix4(), [])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    filtered.forEach((cell, index) => {
      const point = cellPoint(cell, spacing)
      const scale = prime ? 0.085 + (cell.value % 5) * 0.008 : 0.032
      matrix.compose(point, new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale))
      mesh.setMatrixAt(index, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [filtered, matrix, prime, spacing])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, filtered.length]} frustumCulled={false}>
      <sphereGeometry args={[1, prime ? (lowDetail ? 6 : 10) : 5, prime ? (lowDetail ? 5 : 8) : 4]} />
      <meshBasicMaterial
        color={prime ? CYAN : '#6b7885'}
        transparent
        opacity={prime ? (scannerEnabled ? 0.94 : 0.28) : 0.2}
        depthWrite={false}
      />
    </instancedMesh>
  )
}

function DirectionRay({
  direction,
  points,
  selected,
  disabled,
  onSelect,
}: {
  direction: UlamDirectionId
  points: readonly THREE.Vector3[]
  selected: boolean
  disabled: boolean
  onSelect: (direction: UlamDirectionId) => void
}): JSX.Element {
  const descriptor = ULAM_DIRECTIONS.find((candidate) => candidate.id === direction)
  const endpoint = points[points.length - 1]
  if (!descriptor || !endpoint) return <></>

  return (
    <group>
      <Line
        points={points}
        color={selected ? AMBER : VIOLET}
        transparent
        opacity={selected ? 0.9 : 0.19}
        lineWidth={selected ? 2.1 : 0.7}
        depthWrite={false}
      />
      <group
        position={[endpoint.x, endpoint.y, 0.17]}
        onClick={(event) => {
          event.stopPropagation()
          if (!disabled) onSelect(direction)
        }}
      >
        <mesh>
          <circleGeometry args={[selected ? 0.25 : 0.2, 24]} />
          <meshBasicMaterial
            color={selected ? AMBER : '#111a2c'}
            transparent
            opacity={selected ? 0.95 : 0.8}
          />
        </mesh>
        <Text
          position={[0, 0, 0.03]}
          fontSize={0.16}
          color={selected ? '#071014' : '#cfc8ff'}
          anchorX="center"
          anchorY="middle"
        >
          {descriptor.symbol}
        </Text>
      </group>
    </group>
  )
}

function SelectedPath({
  cells,
  spacing,
  revealing,
  scanning,
  reducedMotion,
}: {
  cells: readonly UlamCell[]
  spacing: number
  revealing: boolean
  scanning: boolean
  reducedMotion: boolean
}): JSX.Element {
  const pulseRef = useRef<THREE.Mesh>(null)
  const points = useMemo(() => cells.map((cell) => cellPoint(cell, spacing)), [cells, spacing])

  useFrame(({ clock }) => {
    if (!pulseRef.current || points.length === 0) return
    const progress = reducedMotion ? 1 : (clock.elapsedTime * 0.62) % 1
    const scaled = progress * Math.max(1, points.length - 1)
    const index = Math.min(points.length - 2, Math.floor(scaled))
    if (points.length === 1) pulseRef.current.position.copy(points[0])
    else pulseRef.current.position.copy(points[index]).lerp(points[index + 1], scaled - index)
  })

  return (
    <group>
      {points.length > 1 ? (
        <Line points={points} color={revealing ? CYAN : AMBER} lineWidth={2.8} transparent opacity={0.88} />
      ) : null}
      {cells.map((cell, index) => {
        const point = points[index]
        const color = revealing ? (cell.prime ? CYAN : RED) : AMBER
        return (
          <group key={cell.value} position={[point.x, point.y, 0.2]}>
            <mesh>
              <ringGeometry args={[0.12, 0.18, 22]} />
              <meshBasicMaterial color={color} transparent opacity={0.95} />
            </mesh>
            {(revealing || cells.length <= 5) ? (
              <Text
                position={[0, index % 2 === 0 ? 0.28 : -0.28, 0.03]}
                fontSize={0.11}
                color={color}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.012}
                outlineColor="#02050b"
              >
                {cell.value}
              </Text>
            ) : null}
          </group>
        )
      })}
      {scanning ? (
        <mesh ref={pulseRef} position={points[0]}>
          <sphereGeometry args={[0.16, 12, 10]} />
          <meshBasicMaterial color="#ffffff" />
          <pointLight color={CYAN} intensity={5} distance={2.4} />
        </mesh>
      ) : null}
    </group>
  )
}

function SpiralMap({ reducedMotion, lowDetail }: { reducedMotion: boolean; lowDetail: boolean }): JSX.Element {
  const phase = useUlamGalaxyStore((state) => state.phase)
  const mission = useUlamGalaxyStore((state) => state.mission)
  const selectedDirection = useUlamGalaxyStore((state) => state.selectedDirection)
  const scannerEnabled = useUlamGalaxyStore((state) => state.scannerEnabled)
  const selectDirection = useUlamGalaxyStore((state) => state.selectDirection)
  const groupRef = useRef<THREE.Group>(null)
  const cells = useMemo(() => createUlamSpiral(mission.size), [mission.size])
  const spacing = 7.9 / (mission.size - 1)
  const anchorPoint = useMemo(() => cellPoint(mission.anchor, spacing), [mission.anchor, spacing])
  const spiralPoints = useMemo(() => cells.map((cell) => cellPoint(cell, spacing)), [cells, spacing])
  const selectedPath = selectedDirection ? getMissionPath(mission, selectedDirection) : null

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    groupRef.current.rotation.z = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.17) * 0.008
  })

  return (
    <group ref={groupRef}>
      {lowDetail ? null : (
        <Line points={spiralPoints} color="#7f8ca0" transparent opacity={0.07} lineWidth={0.35} depthWrite={false} />
      )}
      <InstancedCells cells={cells} spacing={spacing} prime={false} scannerEnabled={scannerEnabled} lowDetail={lowDetail} />
      <InstancedCells cells={cells} spacing={spacing} prime scannerEnabled={scannerEnabled} lowDetail={lowDetail} />

      {mission.paths.map((path) => (
        <DirectionRay
          key={path.direction.id}
          direction={path.direction.id}
          points={[anchorPoint, ...path.cells.map((cell) => cellPoint(cell, spacing))]}
          selected={selectedDirection === path.direction.id}
          disabled={phase !== 'playing'}
          onSelect={selectDirection}
        />
      ))}

      <group position={[anchorPoint.x, anchorPoint.y, 0.22]}>
        <mesh>
          <ringGeometry args={[0.2, 0.29, 32]} />
          <meshBasicMaterial color={AMBER} transparent opacity={0.96} />
        </mesh>
        <Text position={[0, 0, 0.03]} fontSize={0.12} color="#fff3c4" anchorX="center" anchorY="middle">
          {mission.anchor.value}
        </Text>
      </group>

      {selectedPath ? (
        <SelectedPath
          cells={selectedPath.cells}
          spacing={spacing}
          revealing={phase === 'round-complete' || phase === 'complete'}
          scanning={phase === 'scanning'}
          reducedMotion={reducedMotion}
        />
      ) : null}
    </group>
  )
}

function CameraRig({ reducedMotion }: { reducedMotion: boolean }): null {
  const camera = useThree((state) => state.camera)
  const pointer = useThree((state) => state.pointer)
  const width = useThree((state) => state.size.width)
  const phase = useUlamGalaxyStore((state) => state.phase)
  const target = useMemo(() => new THREE.Vector3(), [])
  const desired = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    const offset = width > 980 ? (phase === 'intro' ? 1.8 : 0.8) : 0
    desired.set(offset + (reducedMotion ? 0 : pointer.x * 0.18), reducedMotion ? 0 : pointer.y * 0.12, 11.6)
    camera.position.x = THREE.MathUtils.damp(camera.position.x, desired.x, 3.2, delta)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, desired.y, 3.2, delta)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, desired.z, 3.2, delta)
    target.set(offset * 0.18, 0, 0)
    camera.lookAt(target)
  })
  return null
}

export function UlamGalaxyScene({ quality, profile, reducedMotion }: UlamGalaxySceneProps): JSX.Element {
  const width = useThree((state) => state.size.width)
  const viewportWidth = useThree((state) => state.viewport.width)
  const viewportHeight = useThree((state) => state.viewport.height)
  const phase = useUlamGalaxyStore((state) => state.phase)
  const fitScale = Math.min(1, viewportWidth / 8.65, viewportHeight / 8.65)

  return (
    <>
      <color attach="background" args={['#02050b']} />
      <fog attach="fog" args={['#02050b', 10, 30]} />
      <ambientLight intensity={0.2} color="#c9eaff" />
      <pointLight position={[2.5, 3, 5]} intensity={18} distance={14} color={VIOLET} />
      <pointLight position={[-3, -2, 4]} intensity={12} distance={12} color={CYAN} />
      <Stars
        radius={42}
        depth={24}
        count={Math.round(profile.stars * 0.72)}
        factor={2.4}
        saturation={0.2}
        fade
        speed={reducedMotion ? 0 : 0.18}
      />
      <Sparkles
        count={Math.max(8, Math.round(profile.particles * 0.45))}
        scale={[10, 8, 5]}
        color={CYAN}
        opacity={0.28}
        speed={reducedMotion ? 0 : 0.15}
      />
      <group position={[0, phase === 'intro' && width < 800 ? 0.75 : 0, 0]} scale={fitScale}>
        <SpiralMap reducedMotion={reducedMotion} lowDetail={quality === 'low'} />
      </group>
      <CameraRig reducedMotion={reducedMotion} />
    </>
  )
}
