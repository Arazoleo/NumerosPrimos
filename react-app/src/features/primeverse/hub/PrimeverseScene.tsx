import { Line, Sparkles, Stars, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import * as THREE from 'three'
import { PRIMEVERSE_GAMES, type PrimeverseGame } from '../catalog'
import type { QualityProfile } from '../graphics/useQualitySettings'
import { carouselStep, nearestEquivalentAngle } from './carouselMath'
import GamePortal from './GamePortal'

interface PrimeverseSceneProps {
  profile: QualityProfile
  selectedId: string
  travelTarget: PrimeverseGame | null
  rotationOffsetRef: MutableRefObject<number>
  rotationValueRef: MutableRefObject<number>
  draggingRef: MutableRefObject<boolean>
  suppressPortalClickRef: MutableRefObject<boolean>
  isDragging: boolean
  reducedMotion: boolean
  onSelect: (game: PrimeverseGame) => void
}

function CameraRig({
  travelTarget,
  draggingRef,
  reducedMotion,
}: Pick<PrimeverseSceneProps, 'travelTarget' | 'draggingRef' | 'reducedMotion'>) {
  const { camera, pointer } = useThree()
  const desired = useMemo(() => new THREE.Vector3(), [])
  const lookTarget = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (travelTarget) {
      desired.set(0, .72, 5.4)
      lookTarget.set(0, .2, 1.1)
      camera.position.lerp(desired, reducedMotion ? 1 : 0.055)
      camera.lookAt(lookTarget)
      return
    }

    const allowParallax = !draggingRef.current && !reducedMotion
    desired.set(allowParallax ? pointer.x * .5 : 0, 1.1 + (allowParallax ? pointer.y * .22 : 0), 11.2)
    camera.position.lerp(desired, reducedMotion ? 1 : 0.028)
    lookTarget.set(allowParallax ? pointer.x * .2 : 0, -.05 + (allowParallax ? pointer.y * .1 : 0), -2.7)
    camera.lookAt(lookTarget)
  })

  return null
}

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 9283.17 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function FloatingNumbers({ count, reducedMotion }: { count: number; reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const values = useMemo(() => {
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]
    return Array.from({ length: count }, (_, index) => ({
      value: primes[index % primes.length],
      position: [
        (seeded(index, 1) - 0.5) * 22,
        (seeded(index, 2) - 0.5) * 9,
        -5 - seeded(index, 3) * 18,
      ] as [number, number, number],
      size: 0.13 + seeded(index, 4) * 0.2,
    }))
  }, [count])

  useFrame(({ clock }) => {
    if (groupRef.current && !reducedMotion) groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.045) * 0.045
  })

  return (
    <group ref={groupRef}>
      {values.map((item, index) => (
        <Text
          key={`${item.value}-${index}`}
          position={item.position}
          fontSize={item.size}
          color="#f5b800"
          fillOpacity={0.14 + seeded(index, 5) * 0.18}
          anchorX="center"
        >
          {item.value}
        </Text>
      ))}
    </group>
  )
}

function PrimeCore({ reducedMotion }: { reducedMotion: boolean }) {
  const coreRef = useRef<THREE.Mesh>(null)
  const orbitRef = useRef<THREE.Group>(null)

  useFrame(({ clock }, delta) => {
    if (reducedMotion) return
    if (coreRef.current) {
      coreRef.current.rotation.x += delta * 0.08
      coreRef.current.rotation.y += delta * 0.14
    }
    if (orbitRef.current) orbitRef.current.rotation.z = clock.elapsedTime * 0.18
  })

  return (
    <group position={[0, -1.05, -3.4]}>
      <mesh ref={coreRef}>
        <dodecahedronGeometry args={[0.67, 1]} />
        <meshStandardMaterial color="#17191d" emissive="#ffcc1a" emissiveIntensity={1.1} metalness={0.72} roughness={0.22} />
      </mesh>
      <Text position={[0, 0, 0.7]} fontSize={0.25} color="#fff4c2">2</Text>
      <group ref={orbitRef}>
        <mesh rotation={[Math.PI / 2.3, 0, 0]}>
          <torusGeometry args={[1.15, 0.012, 4, 72]} />
          <meshBasicMaterial color="#ffcc1a" transparent opacity={0.34} />
        </mesh>
        <mesh position={[1.06, 0.32, 0]}>
          <sphereGeometry args={[0.075, 10, 10]} />
          <meshBasicMaterial color="#5fa8ff" />
        </mesh>
      </group>
    </group>
  )
}

function OrbitalArchitecture() {
  const points = useMemo(() => {
    return Array.from({ length: 97 }, (_, index) => {
      const angle = (index / 96) * Math.PI * 2
      return new THREE.Vector3(Math.cos(angle) * 8.3, -2.65, Math.sin(angle) * 5.7 - 5)
    })
  }, [])

  return (
    <group>
      <Line points={points} color="#ffcc1a" transparent opacity={0.14} lineWidth={0.55} />
      <gridHelper args={[34, 34, '#1c3455', '#121923']} position={[0, -2.7, -7]} />
      <mesh position={[0, -2.58, -8]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.9, 4.02, 96]} />
        <meshBasicMaterial color="#2563eb" transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

const CAROUSEL_RADIUS = 6.15

function PortalCarousel({
  selectedId,
  rotationOffsetRef,
  rotationValueRef,
  draggingRef,
  suppressPortalClickRef,
  isDragging,
  reducedMotion,
  onSelect,
}: Pick<PrimeverseSceneProps, 'selectedId' | 'rotationOffsetRef' | 'rotationValueRef' | 'draggingRef' | 'suppressPortalClickRef' | 'isDragging' | 'reducedMotion' | 'onSelect'>) {
  const groupRef = useRef<THREE.Group>(null)
  const step = carouselStep(PRIMEVERSE_GAMES.length)
  const selectedIndex = Math.max(0, PRIMEVERSE_GAMES.findIndex((game) => game.id === selectedId))

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const current = groupRef.current.rotation.y
    const selectedAngle = -selectedIndex * step
    const target = nearestEquivalentAngle(selectedAngle, current) + rotationOffsetRef.current

    const nextRotation = draggingRef.current || reducedMotion
      ? target
      : THREE.MathUtils.damp(current, target, 8, delta)
    groupRef.current.rotation.y = nextRotation
    rotationValueRef.current = nextRotation
  })

  return (
    <group ref={groupRef} position={[0, .28, -4.9]}>
      {PRIMEVERSE_GAMES.map((game, index) => {
        const angle = index * step
        const position: [number, number, number] = [
          Math.sin(angle) * CAROUSEL_RADIUS,
          Math.sin(angle * 2) * .16,
          Math.cos(angle) * CAROUSEL_RADIUS,
        ]

        return (
          <GamePortal
            key={game.id}
            game={game}
            position={position}
            rotationY={angle}
            selected={!isDragging && selectedId === game.id}
            isDragging={isDragging}
            reducedMotion={reducedMotion}
            suppressClickRef={suppressPortalClickRef}
            onSelect={onSelect}
          />
        )
      })}
    </group>
  )
}

export default function PrimeverseScene(props: PrimeverseSceneProps) {
  const {
    profile,
    selectedId,
    travelTarget,
    rotationOffsetRef,
    rotationValueRef,
    draggingRef,
    suppressPortalClickRef,
    isDragging,
    reducedMotion,
    onSelect,
  } = props
  return (
    <>
      <color attach="background" args={['#06080d']} />
      <fog attach="fog" args={['#06080d', 12, 35]} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[2, 7, 8]} intensity={1.35} color="#fff3c0" />
      <pointLight position={[-5, 1, 3]} intensity={22} distance={11} color="#ffcc1a" />
      <pointLight position={[5, 0, 1]} intensity={18} distance={12} color="#2563eb" />
      <Stars radius={55} depth={28} count={Math.round(profile.stars * .72)} factor={3.1} saturation={0.1} fade speed={reducedMotion ? 0 : 0.26} />
      <Sparkles count={Math.round(profile.particles * .55)} scale={[18, 8, 20]} size={1.1} speed={reducedMotion ? 0 : 0.14} color="#ffe988" opacity={0.28} />
      <FloatingNumbers count={Math.max(4, Math.round(profile.floatingNumbers * .65))} reducedMotion={reducedMotion} />
      <OrbitalArchitecture />
      <PrimeCore reducedMotion={reducedMotion} />
      <PortalCarousel
        selectedId={selectedId}
        rotationOffsetRef={rotationOffsetRef}
        rotationValueRef={rotationValueRef}
        draggingRef={draggingRef}
        suppressPortalClickRef={suppressPortalClickRef}
        isDragging={isDragging}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      />
      <CameraRig travelTarget={travelTarget} draggingRef={draggingRef} reducedMotion={reducedMotion} />
    </>
  )
}
