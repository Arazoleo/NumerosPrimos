import { Edges, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import { MathUtils } from 'three'

import type { PrimeBoxStep, RingDirection } from '../types'
import { PRIME_BOX_POSITION, type WorldPosition } from './layout'

const CYAN = '#5df4e6'
const AMBER = '#ffc553'
const VIOLET = '#a28cff'

const STEP_ORDER: Readonly<Record<PrimeBoxStep, number>> = {
  rings: 0,
  latches: 1,
  lid: 2,
  drawer: 3,
  rotor: 4,
  complete: 5,
}

const STEP_LABEL: Readonly<Record<PrimeBoxStep, string>> = {
  rings: 'ALINHE OS ANEIS',
  latches: 'LIBERE AS DUAS TRAVAS',
  lid: 'TAMPA DESTRAVADA',
  drawer: 'PUXE A GAVETA',
  rotor: 'COLETE O ROTOR',
  complete: 'SELO PRIMO LIBERADO',
}

export interface PrimeMechanismProps {
  ringValues: readonly number[]
  step: PrimeBoxStep
  latches: readonly [boolean, boolean]
  active: boolean
  interactive?: boolean
  onRotateRing?: (index: number, direction: RingDirection) => void
  onCalibrate?: () => void
  onReleaseLatch?: (index: 0 | 1) => void
  onOpenLid?: () => void
  onOpenDrawer?: () => void
  onCollectRotor?: () => void
  reducedMotion?: boolean
  position?: WorldPosition
}

interface CipherRingProps {
  index: number
  value: number
  active: boolean
  aligned: boolean
  interactive: boolean
  reducedMotion: boolean
  onRotate?: (index: number, direction: RingDirection) => void
}

interface RingPaddleProps {
  direction: RingDirection
  onActivate: (direction: RingDirection) => void
}

function normalizeDigit(value: number): number {
  if (!Number.isFinite(value)) return 0
  return ((Math.round(value) % 10) + 10) % 10
}

function RingPaddle({ direction, onActivate }: RingPaddleProps): JSX.Element {
  const y = direction === 1 ? 0.49 : -0.49

  return (
    <group
      position={[0, y, 0.18]}
          onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onActivate(direction)
      }}
    >
      <mesh castShadow>
        <boxGeometry args={[0.42, 0.16, 0.11]} />
        <meshStandardMaterial
          color="#26353a"
          emissive={AMBER}
          emissiveIntensity={0.34}
          metalness={0.86}
          roughness={0.25}
        />
        <Edges color={AMBER} threshold={18} />
      </mesh>
      <mesh position={[0, 0, 0.09]}>
        <boxGeometry args={[0.58, 0.25, 0.08]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Text
        position={[0, 0, 0.16]}
        fontSize={0.13}
        color="#fff4c7"
        anchorX="center"
        anchorY="middle"
      >
        {direction === 1 ? '+' : '-'}
      </Text>
    </group>
  )
}

function CipherRing({
  index,
  value,
  active,
  aligned,
  interactive,
  reducedMotion,
  onRotate,
}: CipherRingProps): JSX.Element {
  const ringRef = useRef<Group>(null)
  const digit = normalizeDigit(value)

  useFrame(({ clock }, delta) => {
    if (!ringRef.current) return
    const target = -(digit / 10) * Math.PI * 2
    if (reducedMotion) {
      ringRef.current.rotation.z = target
    } else {
      const current = ringRef.current.rotation.z
      const shortest = MathUtils.euclideanModulo(
        target - current + Math.PI,
        Math.PI * 2,
      ) - Math.PI
      ringRef.current.rotation.z = MathUtils.damp(
        current,
        current + shortest,
        7.5,
        delta,
      )
    }
    const targetDepth = aligned ? 0.13 : 0
    ringRef.current.position.z = reducedMotion
      ? targetDepth
      : MathUtils.damp(ringRef.current.position.z, targetDepth, 5, delta)
    ringRef.current.scale.setScalar(active && !aligned && !reducedMotion
      ? 1 + Math.sin(clock.elapsedTime * 2.2 + index) * 0.018
      : 1)
  })

  const rotate = (direction: RingDirection) => onRotate?.(index, direction)

  return (
    <group position={[(index - 1.5) * 0.78, 0.1, 1.26]}>
      <group ref={ringRef}>
        <mesh castShadow>
          <torusGeometry args={[0.32, 0.115, 10, 34]} />
          <meshStandardMaterial
            color={active && !aligned ? '#233943' : '#17262e'}
            emissive={active && !aligned ? CYAN : '#071317'}
            emissiveIntensity={active && !aligned ? 0.38 : 0.12}
            metalness={0.92}
            roughness={0.24}
          />
        </mesh>
        {Array.from({ length: 10 }, (_, marker) => {
          const angle = (marker / 10) * Math.PI * 2
          return (
            <mesh
              key={marker}
              position={[Math.sin(angle) * 0.32, Math.cos(angle) * 0.32, 0.12]}
              rotation={[0, 0, -angle]}
            >
              <boxGeometry args={[marker === digit ? 0.055 : 0.026, 0.095, 0.028]} />
              <meshBasicMaterial color={marker === digit ? AMBER : '#78909b'} />
            </mesh>
          )
        })}
      </group>
      <mesh position={[0, 0.46, 0.14]}>
        <boxGeometry args={[0.5, 0.05, 0.06]} />
        <meshBasicMaterial color={AMBER} transparent opacity={active && !aligned ? 0.92 : 0.38} />
      </mesh>
      <Text
        position={[0, 0.1, 0.17]}
        fontSize={0.23}
        color={aligned ? '#79959c' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.018}
        outlineColor="#041014"
      >
        {digit}
      </Text>
      {interactive && onRotate ? (
        <>
          <RingPaddle direction={1} onActivate={rotate} />
          <RingPaddle direction={-1} onActivate={rotate} />
        </>
      ) : null}
    </group>
  )
}

interface BoxLatchProps {
  index: 0 | 1
  released: boolean
  active: boolean
  interactive: boolean
  reducedMotion: boolean
  onRelease?: (index: 0 | 1) => void
}

function BoxLatch({
  index,
  released,
  active,
  interactive,
  reducedMotion,
  onRelease,
}: BoxLatchProps): JSX.Element {
  const leverRef = useRef<Group>(null)
  const side = index === 0 ? -1 : 1

  useFrame((_, delta) => {
    if (!leverRef.current) return
    const targetRotation = released ? side * 0.92 : 0
    const targetX = released ? side * 0.11 : 0
    leverRef.current.rotation.z = reducedMotion
      ? targetRotation
      : MathUtils.damp(leverRef.current.rotation.z, targetRotation, 7, delta)
    leverRef.current.position.x = reducedMotion
      ? targetX
      : MathUtils.damp(leverRef.current.position.x, targetX, 7, delta)
  })

  const canRelease = interactive && !released && Boolean(onRelease)

  return (
    <group position={[side * 1.66, 0.08, 1.39]}>
      <mesh castShadow position={[0, 0, -0.055]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.2, 0.13, 16]} />
        <meshStandardMaterial color="#16262d" metalness={0.95} roughness={0.22} />
      </mesh>
      <group ref={leverRef}>
        <mesh castShadow position={[0, 0.2, 0]}>
          <boxGeometry args={[0.16, 0.48, 0.16]} />
          <meshStandardMaterial
            color={released ? '#26343a' : '#4b3921'}
            emissive={active && !released ? AMBER : '#080a0b'}
            emissiveIntensity={active && !released ? 0.72 : 0.08}
            metalness={0.9}
            roughness={0.22}
          />
          <Edges color={released ? '#546a72' : AMBER} threshold={18} />
        </mesh>
        <mesh position={[0, 0.47, 0]}>
          <sphereGeometry args={[0.15, 12, 8]} />
          <meshStandardMaterial color={released ? '#26343a' : '#6a4b25'} metalness={0.88} roughness={0.2} />
        </mesh>
      </group>
      {canRelease ? (
        <mesh
          position={[0, 0.25, 0.08]}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onRelease?.(index)
          }}
        >
          <boxGeometry args={[0.5, 0.9, 0.28]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  )
}

interface BoxLidProps {
  open: boolean
  active: boolean
  interactive: boolean
  reducedMotion: boolean
  onOpen?: () => void
}

function BoxLid({ open, active, interactive, reducedMotion, onOpen }: BoxLidProps): JSX.Element {
  const lidRef = useRef<Group>(null)

  useFrame((_, delta) => {
    if (!lidRef.current) return
    const target = open ? -1.34 : 0
    lidRef.current.rotation.x = reducedMotion
      ? target
      : MathUtils.damp(lidRef.current.rotation.x, target, 4.7, delta)
  })

  return (
    <group ref={lidRef} position={[0, 0.67, -1.13]}>
      <mesh castShadow position={[0, 0, 1.13]}>
        <boxGeometry args={[3.7, 0.28, 2.42]} />
        <meshStandardMaterial color="#12242c" metalness={0.9} roughness={0.25} />
        <Edges color={active && !open ? AMBER : '#5d8390'} threshold={22} />
      </mesh>
      <mesh position={[0, 0.155, 1.12]}>
        <boxGeometry args={[2.96, 0.035, 1.72]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.1} />
      </mesh>
      <mesh castShadow position={[0, 0.25, 2.16]}>
        <boxGeometry args={[0.88, 0.19, 0.2]} />
        <meshStandardMaterial
          color="#26353a"
          emissive={active && !open ? AMBER : '#071317'}
          emissiveIntensity={active && !open ? 0.56 : 0.08}
          metalness={0.9}
          roughness={0.22}
        />
        <Edges color={active && !open ? AMBER : '#5d8390'} threshold={18} />
      </mesh>
      {interactive && !open && onOpen ? (
        <mesh
          position={[0, 0.25, 2.18]}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onOpen()
          }}
        >
          <boxGeometry args={[1.3, 0.52, 0.34]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  )
}

interface CaesarRotorProps {
  collected: boolean
  active: boolean
  interactive: boolean
  reducedMotion: boolean
  onCollect?: () => void
}

function CaesarRotor({
  collected,
  active,
  interactive,
  reducedMotion,
  onCollect,
}: CaesarRotorProps): JSX.Element {
  const rotorRef = useRef<Group>(null)

  useFrame(({ clock }, delta) => {
    if (!rotorRef.current) return
    const targetY = collected ? 1.24 : 0.3
    const targetScale = collected ? 0.04 : 1
    rotorRef.current.position.y = reducedMotion
      ? targetY
      : MathUtils.damp(rotorRef.current.position.y, targetY, 5.5, delta)
    const scale = reducedMotion
      ? targetScale
      : MathUtils.damp(rotorRef.current.scale.x, targetScale, 7, delta)
    rotorRef.current.scale.setScalar(scale)
    rotorRef.current.rotation.z = collected || reducedMotion
      ? rotorRef.current.rotation.z
      : clock.elapsedTime * 0.55
  })

  return (
    <group ref={rotorRef} position={[0, 0.3, 0.72]}>
      <mesh castShadow>
        <torusGeometry args={[0.43, 0.12, 12, 40]} />
        <meshStandardMaterial
          color="#5b4426"
          emissive={active ? AMBER : '#211607'}
          emissiveIntensity={active ? 1.05 : 0.25}
          metalness={0.9}
          roughness={0.18}
        />
      </mesh>
      <mesh castShadow position={[0, 0, -0.015]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.11, 24]} />
        <meshStandardMaterial color="#18282e" metalness={0.88} roughness={0.22} />
      </mesh>
      {Array.from({ length: 8 }, (_, marker) => {
        const angle = marker * Math.PI / 4
        return (
          <mesh
            key={marker}
            position={[Math.sin(angle) * 0.43, Math.cos(angle) * 0.43, 0.09]}
            rotation={[0, 0, -angle]}
          >
            <boxGeometry args={[0.035, 0.12, 0.035]} />
            <meshBasicMaterial color={marker < 3 ? CYAN : '#d2a552'} />
          </mesh>
        )
      })}
      <Text
        position={[0, 0, 0.095]}
        fontSize={0.15}
        color="#fff1bf"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="#151006"
      >
        A/N
      </Text>
      {interactive && !collected && onCollect ? (
        <mesh
          position={[0, 0, 0.13]}
          rotation={[Math.PI / 2, 0, 0]}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onCollect()
          }}
        >
          <cylinderGeometry args={[0.62, 0.62, 0.22, 24]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}
      {!collected && active ? <pointLight position={[0, 0, 0.45]} color={AMBER} intensity={4.8} distance={3.5} /> : null}
    </group>
  )
}

interface PrimeDrawerProps {
  open: boolean
  rotorRevealed: boolean
  rotorCollected: boolean
  active: boolean
  interactive: boolean
  reducedMotion: boolean
  onOpen?: () => void
  onCollectRotor?: () => void
}

function PrimeDrawer({
  open,
  rotorRevealed,
  rotorCollected,
  active,
  interactive,
  reducedMotion,
  onOpen,
  onCollectRotor,
}: PrimeDrawerProps): JSX.Element {
  const drawerRef = useRef<Group>(null)

  useFrame((_, delta) => {
    if (!drawerRef.current) return
    const target = open ? 1.3 : 0
    drawerRef.current.position.z = reducedMotion
      ? target
      : MathUtils.damp(drawerRef.current.position.z, target, 5.2, delta)
  })

  return (
    <group ref={drawerRef} position={[0, -0.58, 0]}>
      <mesh castShadow receiveShadow position={[0, 0, 0.4]}>
        <boxGeometry args={[2.7, 0.56, 1.72]} />
        <meshStandardMaterial color="#0d1b22" metalness={0.84} roughness={0.31} />
        <Edges color={open ? '#567985' : '#263d46'} threshold={18} />
      </mesh>
      <mesh castShadow position={[0, 0, 1.29]}>
        <boxGeometry args={[2.92, 0.7, 0.14]} />
        <meshStandardMaterial
          color="#13252d"
          emissive={active && !open ? CYAN : '#061014'}
          emissiveIntensity={active && !open ? 0.24 : 0.06}
          metalness={0.9}
          roughness={0.25}
        />
        <Edges color={active && !open ? CYAN : '#405e69'} threshold={18} />
      </mesh>
      <mesh castShadow position={[0, 0.08, 1.42]}>
        <boxGeometry args={[0.94, 0.18, 0.16]} />
        <meshStandardMaterial
          color="#304149"
          emissive={active && !open ? CYAN : '#071317'}
          emissiveIntensity={active && !open ? 0.52 : 0.08}
          metalness={0.88}
          roughness={0.22}
        />
      </mesh>
      {interactive && !open && onOpen ? (
        <mesh
          position={[0, 0.08, 1.48]}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onOpen()
          }}
        >
          <boxGeometry args={[1.36, 0.5, 0.32]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}
      {rotorRevealed ? (
        <CaesarRotor
          collected={rotorCollected}
          active={active}
          interactive={interactive}
          onCollect={onCollectRotor}
          reducedMotion={reducedMotion}
        />
      ) : null}
      <Text
        position={[0, -0.15, 1.38]}
        fontSize={0.1}
        color={open ? VIOLET : '#50656d'}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.12}
      >
        ROTOR // A-N
      </Text>
    </group>
  )
}

export function PrimeMechanism({
  ringValues,
  step,
  latches,
  active,
  interactive = false,
  onRotateRing,
  onCalibrate,
  onReleaseLatch,
  onOpenLid,
  onOpenDrawer,
  onCollectRotor,
  reducedMotion = false,
  position = PRIME_BOX_POSITION,
}: PrimeMechanismProps): JSX.Element {
  const coreRef = useRef<Group>(null)
  const stepIndex = STEP_ORDER[step]
  const ringsAligned = stepIndex > STEP_ORDER.rings
  const lidOpen = stepIndex > STEP_ORDER.lid
  const drawerOpen = stepIndex > STEP_ORDER.drawer
  const rotorRevealed = stepIndex >= STEP_ORDER.rotor
  const rotorCollected = step === 'complete'

  useFrame(({ clock }, delta) => {
    if (!coreRef.current) return
    const targetY = lidOpen ? 1.28 : 0.12
    coreRef.current.position.y = reducedMotion
      ? targetY
      : MathUtils.damp(coreRef.current.position.y, targetY, 4.5, delta)
    coreRef.current.rotation.y = reducedMotion ? 0 : clock.elapsedTime * 0.26
  })

  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, -0.22, 0]}>
        <boxGeometry args={[3.8, 1.72, 2.5]} />
        <meshStandardMaterial color="#0b171e" metalness={0.84} roughness={0.34} />
        <Edges color={active ? CYAN : '#314b56'} threshold={18} />
      </mesh>
      <mesh position={[0, 0.06, 1.275]}>
        <boxGeometry args={[3.34, 1.08, 0.12]} />
        <meshStandardMaterial
          color="#071116"
          emissive={active ? CYAN : '#000000'}
          emissiveIntensity={active ? 0.12 : 0}
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>
      {[0, 1, 2, 3].map((index) => (
        <CipherRing
          key={index}
          index={index}
          value={ringValues[index] ?? 0}
          active={active}
          aligned={ringsAligned}
          interactive={interactive && step === 'rings'}
          onRotate={onRotateRing}
          reducedMotion={reducedMotion}
        />
      ))}

      {interactive && step === 'rings' && onCalibrate ? (
        <group
          position={[0, -0.78, 1.38]}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onCalibrate()
          }}
        >
          <mesh castShadow>
            <boxGeometry args={[1.08, 0.28, 0.16]} />
            <meshStandardMaterial
              color="#3f3320"
              emissive={AMBER}
              emissiveIntensity={0.42}
              metalness={0.9}
              roughness={0.22}
            />
            <Edges color={AMBER} threshold={18} />
          </mesh>
          <mesh position={[0, 0, 0.13]}>
            <boxGeometry args={[1.35, 0.48, 0.18]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <Text position={[0, 0, 0.17]} fontSize={0.09} color="#fff3c5" anchorX="center" anchorY="middle">
            LIBERAR PINOS
          </Text>
        </group>
      ) : null}

      <BoxLatch
        index={0}
        released={latches[0]}
        active={active && step === 'latches'}
        interactive={interactive && step === 'latches'}
        onRelease={onReleaseLatch}
        reducedMotion={reducedMotion}
      />
      <BoxLatch
        index={1}
        released={latches[1]}
        active={active && step === 'latches'}
        interactive={interactive && step === 'latches'}
        onRelease={onReleaseLatch}
        reducedMotion={reducedMotion}
      />

      <BoxLid
        open={lidOpen}
        active={active && step === 'lid'}
        interactive={interactive && step === 'lid'}
        onOpen={onOpenLid}
        reducedMotion={reducedMotion}
      />

      <PrimeDrawer
        open={drawerOpen}
        rotorRevealed={rotorRevealed}
        rotorCollected={rotorCollected}
        active={active && (step === 'drawer' || step === 'rotor')}
        interactive={interactive && (step === 'drawer' || step === 'rotor')}
        onOpen={step === 'drawer' ? onOpenDrawer : undefined}
        onCollectRotor={step === 'rotor' ? onCollectRotor : undefined}
        reducedMotion={reducedMotion}
      />

      <group ref={coreRef} position={[0, 0.12, 0]}>
        <mesh>
          <octahedronGeometry args={[0.38, 0]} />
          <meshStandardMaterial
            color="#fff4b5"
            emissive={AMBER}
            emissiveIntensity={lidOpen ? 2.3 : 0}
            metalness={0.34}
            roughness={0.18}
          />
        </mesh>
        {lidOpen ? <pointLight color={AMBER} intensity={8} distance={4.5} /> : null}
      </group>

      <Text
        position={[0, -1.25, 1.28]}
        fontSize={0.16}
        color={active ? CYAN : '#66818b'}
        anchorX="center"
        letterSpacing={0.13}
      >
        {STEP_LABEL[step]}
      </Text>
      {active ? <pointLight position={[0, 0.45, 2.4]} color={CYAN} intensity={7} distance={5.5} /> : null}
    </group>
  )
}
