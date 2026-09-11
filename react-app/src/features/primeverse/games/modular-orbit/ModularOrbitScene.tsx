import { Line, Sparkles, Stars, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { QualityProfile } from '../../graphics/useQualitySettings'
import { useModularOrbitStore } from './modularOrbitStore'
import { getOrbitTravelDuration } from './animation'

const ORBIT_RADIUS = 3.35
const CYAN = '#65f1db'
const AMBER = '#ffcc1a'
const VIOLET = '#9a8cff'

function residuePoint(residue: number, modulus: number, z = 0): THREE.Vector3 {
  const angle = Math.PI / 2 - (residue / modulus) * Math.PI * 2
  return new THREE.Vector3(
    Math.cos(angle) * ORBIT_RADIUS,
    Math.sin(angle) * ORBIT_RADIUS,
    z,
  )
}

function OrbitBackdrop({
  profile,
  reducedMotion,
}: {
  profile: QualityProfile
  reducedMotion: boolean
}): JSX.Element {
  const latticeRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (reducedMotion) return
    if (latticeRef.current) latticeRef.current.rotation.z = clock.elapsedTime * 0.012
  })

  return (
    <>
      <color attach="background" args={['#04070d']} />
      <fog attach="fog" args={['#04070d', 12, 30]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[-4, 8, 9]} intensity={1.5} color="#dffefa" />
      <pointLight position={[4, -1, 4]} intensity={28} distance={13} color={CYAN} />
      <pointLight position={[-4, 2, 2]} intensity={19} distance={11} color={VIOLET} />
      <Stars
        radius={48}
        depth={26}
        count={Math.round(profile.stars * 0.78)}
        factor={2.7}
        saturation={0.16}
        fade
        speed={reducedMotion ? 0 : 0.24}
      />
      <Sparkles
        count={Math.max(12, Math.round(profile.particles * 0.72))}
        scale={[15, 9, 12]}
        size={1.1}
        speed={reducedMotion ? 0 : 0.15}
        color={CYAN}
        opacity={0.32}
      />
      <group ref={latticeRef} position={[0, 0, -2.3]}>
        {[5.1, 5.8, 6.55].map((radius, index) => (
          <mesh key={radius} rotation={[0, 0, index * 0.21]}>
            <torusGeometry args={[radius, 0.008, 3, 112]} />
            <meshBasicMaterial color={index === 1 ? VIOLET : CYAN} transparent opacity={0.1} />
          </mesh>
        ))}
      </group>
      <gridHelper
        args={[34, 34, '#17344a', '#0d1724']}
        position={[0, -5.15, -3]}
        rotation={[0, 0, 0]}
      />
    </>
  )
}

function CentralModulo({
  modulus,
  step,
  reducedMotion,
}: {
  modulus: number
  step: number
  reducedMotion: boolean
}): JSX.Element {
  const coreRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (reducedMotion) return
    if (coreRef.current) {
      coreRef.current.rotation.x += delta * 0.11
      coreRef.current.rotation.y += delta * 0.17
    }
    if (ringRef.current) ringRef.current.rotation.z -= delta * 0.14
  })

  return (
    <group>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.78, 1]} />
        <meshStandardMaterial
          color="#0a1820"
          emissive={CYAN}
          emissiveIntensity={1.45}
          metalness={0.82}
          roughness={0.2}
        />
      </mesh>
      <group ref={ringRef}>
        <mesh rotation={[Math.PI / 2.35, 0, 0]}>
          <torusGeometry args={[1.2, 0.018, 5, 70]} />
          <meshBasicMaterial color={VIOLET} transparent opacity={0.68} />
        </mesh>
      </group>
      <Text position={[0, 0.08, 0.86]} fontSize={0.27} color="#03110f" anchorX="center">
        {`mod ${modulus}`}
      </Text>
      <Text position={[0, -0.28, 0.82]} fontSize={0.13} color="#31266d" anchorX="center">
        {`IMPULSO +${step}`}
      </Text>
    </group>
  )
}

function ResidueStations({
  modulus,
  start,
  target,
  visited,
}: {
  modulus: number
  start: number
  target: number
  visited: ReadonlySet<number>
}): JSX.Element {
  const circle = useMemo(
    () => Array.from({ length: 97 }, (_, index) => {
      const angle = (index / 96) * Math.PI * 2
      return new THREE.Vector3(
        Math.cos(angle) * ORBIT_RADIUS,
        Math.sin(angle) * ORBIT_RADIUS,
        -0.03,
      )
    }),
    [],
  )

  return (
    <group>
      <Line points={circle} color="#5289a4" transparent opacity={0.38} lineWidth={0.8} />
      {Array.from({ length: modulus }, (_, residue) => {
        const position = residuePoint(residue, modulus, 0)
        const isTarget = residue === target
        const isStart = residue === start
        const isVisited = visited.has(residue)
        const color = isTarget ? CYAN : isStart ? AMBER : isVisited ? VIOLET : '#4c6475'
        const scale = isTarget ? 1.34 : isStart ? 1.16 : 1

        return (
          <group key={residue} position={position} scale={scale}>
            <mesh>
              <sphereGeometry args={[0.14, 12, 12]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={isTarget ? 2.8 : isVisited || isStart ? 1.25 : 0.2}
                metalness={0.55}
                roughness={0.3}
              />
            </mesh>
            {isTarget ? (
              <mesh>
                <ringGeometry args={[0.25, 0.29, 30]} />
                <meshBasicMaterial color={CYAN} transparent opacity={0.72} side={THREE.DoubleSide} />
              </mesh>
            ) : null}
            <Text
              position={[0, 0.35, 0.08]}
              fontSize={modulus > 16 ? 0.17 : 0.21}
              color={isTarget || isStart ? '#ffffff' : '#a8bcc8'}
              anchorX="center"
              anchorY="middle"
            >
              {residue}
            </Text>
          </group>
        )
      })}
    </group>
  )
}

function JumpTrace({ trace, modulus }: { trace: readonly number[]; modulus: number }): JSX.Element | null {
  if (trace.length < 2) return null

  const points: THREE.Vector3[] = [residuePoint(trace[0], modulus, 0.12)]
  for (let index = 1; index < trace.length; index += 1) {
    const from = residuePoint(trace[index - 1], modulus, 0.12)
    const to = residuePoint(trace[index], modulus, 0.12)
    const midpoint = from.clone().lerp(to, 0.5)
    midpoint.z += 0.35 + Math.min(0.55, from.distanceTo(to) * 0.07)
    points.push(midpoint, to)
  }

  return (
    <Line
      points={points}
      color={VIOLET}
      transparent
      opacity={0.68}
      lineWidth={1.25}
    />
  )
}

function OrbitalProbe({
  start,
  modulus,
  trace,
  animationKey,
  reducedMotion,
}: {
  start: number
  modulus: number
  trace: readonly number[] | null
  animationKey: string
  reducedMotion: boolean
}): JSX.Element {
  const probeRef = useRef<THREE.Group>(null)
  const startedAtRef = useRef(0)

  useEffect(() => {
    startedAtRef.current = performance.now()
  }, [animationKey])

  useFrame(({ clock }, delta) => {
    const probe = probeRef.current
    if (!probe) return

    let desired = residuePoint(start, modulus, 0.34)
    if (trace && trace.length > 1) {
      const duration = getOrbitTravelDuration(trace.length, reducedMotion)
      const progress = THREE.MathUtils.clamp((performance.now() - startedAtRef.current) / duration, 0, 1)
      const scaled = progress * (trace.length - 1)
      const segment = Math.min(trace.length - 2, Math.floor(scaled))
      const local = THREE.MathUtils.smoothstep(scaled - segment, 0, 1)
      const from = residuePoint(trace[segment], modulus, 0.34)
      const to = residuePoint(trace[segment + 1], modulus, 0.34)
      desired = from.lerp(to, local)
      desired.z += Math.sin(local * Math.PI) * 0.65
    }

    if (reducedMotion) {
      probe.position.copy(desired)
      probe.rotation.z = 0
      return
    }

    const damping = trace ? 18 : 7
    probe.position.x = THREE.MathUtils.damp(probe.position.x, desired.x, damping, delta)
    probe.position.y = THREE.MathUtils.damp(probe.position.y, desired.y, damping, delta)
    probe.position.z = THREE.MathUtils.damp(probe.position.z, desired.z, damping, delta)
    probe.rotation.z = clock.elapsedTime * 0.8
  })

  return (
    <group ref={probeRef} position={residuePoint(start, modulus, 0.34)}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.18, 0.52, 5]} />
        <meshStandardMaterial color="#f2fffd" emissive={CYAN} emissiveIntensity={1.75} metalness={0.7} roughness={0.2} />
      </mesh>
      <pointLight intensity={7} distance={2.6} color={CYAN} />
    </group>
  )
}

function CameraRig({ compact, reducedMotion }: { compact: boolean; reducedMotion: boolean }): null {
  const camera = useThree((state) => state.camera)
  const pointer = useThree((state) => state.pointer)
  const desired = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    if (!reducedMotion) return
    camera.position.set(0, 0.4, 10.8)
    camera.lookAt(compact ? 0 : 0.65, 0.1, 0)
  }, [camera, compact, reducedMotion])

  useFrame((_, delta) => {
    if (reducedMotion) return
    desired.set(pointer.x * 0.25, 0.4 + pointer.y * 0.16, 10.8)
    camera.position.x = THREE.MathUtils.damp(camera.position.x, desired.x, 2.5, delta)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, desired.y, 2.5, delta)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, desired.z, 2.5, delta)
    target.set((compact ? 0 : 0.65) + pointer.x * 0.12, 0.1, 0)
    camera.lookAt(target)
  })
  return null
}

export function ModularOrbitScene({
  profile,
  reducedMotion,
}: {
  profile: QualityProfile
  reducedMotion: boolean
}): JSX.Element {
  const phase = useModularOrbitStore((state) => state.phase)
  const challenge = useModularOrbitStore((state) => state.challenge)
  const pendingLaunch = useModularOrbitStore((state) => state.pendingLaunch)
  const lastLaunch = useModularOrbitStore((state) => state.lastLaunch)
  const runId = useModularOrbitStore((state) => state.runId)
  const roundIndex = useModularOrbitStore((state) => state.roundIndex)
  const attempts = useModularOrbitStore((state) => state.attempts)
  const width = useThree((state) => state.size.width)
  const height = useThree((state) => state.size.height)
  const compact = width < 760
  const orbitScale = width < 520 ? 0.58 : compact ? 0.72 : height < 600 ? 0.82 : 1

  if (phase === 'intro') {
    return (
      <>
        <OrbitBackdrop profile={profile} reducedMotion={reducedMotion} />
        <group position={[compact ? 0 : 1.2, compact ? 0.5 : -0.25, 0]} scale={orbitScale}>
          <CentralModulo modulus={12} step={5} reducedMotion={reducedMotion} />
          <ResidueStations modulus={12} start={2} target={10} visited={new Set()} />
          <OrbitalProbe
            start={2}
            modulus={12}
            trace={null}
            animationKey="preview"
            reducedMotion={reducedMotion}
          />
        </group>
        <CameraRig compact={compact} reducedMotion={reducedMotion} />
      </>
    )
  }

  const trace = pendingLaunch?.trace ?? lastLaunch?.trace ?? null
  const visited = new Set(trace ?? [challenge.start])
  const animationKey = pendingLaunch || lastLaunch
    ? `launch:${runId}:${attempts}`
    : `idle:${runId}:${roundIndex}`

  return (
    <>
      <OrbitBackdrop profile={profile} reducedMotion={reducedMotion} />
      <group position={[compact ? 0 : 1.25, compact ? 0.5 : -0.25, 0]} scale={orbitScale}>
        <CentralModulo
          modulus={challenge.modulus}
          step={challenge.step}
          reducedMotion={reducedMotion}
        />
        <ResidueStations
          modulus={challenge.modulus}
          start={challenge.start}
          target={challenge.target}
          visited={visited}
        />
        <JumpTrace trace={trace ?? []} modulus={challenge.modulus} />
        <OrbitalProbe
          start={challenge.start}
          modulus={challenge.modulus}
          trace={trace}
          animationKey={animationKey}
          reducedMotion={reducedMotion}
        />
      </group>
      <CameraRig compact={compact} reducedMotion={reducedMotion} />
    </>
  )
}
