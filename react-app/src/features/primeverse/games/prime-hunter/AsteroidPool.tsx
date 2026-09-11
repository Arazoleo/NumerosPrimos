import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { generateChallengeNumber, isPrime, primeFactorization } from '../../../../lib/math'
import { getHunterDifficulty } from './difficulty'

type AsteroidPhase = 'idle' | 'alive' | 'prime-impact' | 'composite-impact'

interface AsteroidDisplay {
  value: number
  phase: AsteroidPhase
  factorText: string
}

interface SpawnConfig {
  value: number
  position: [number, number, number]
  speed: number
  drift: number
  spin: number
}

export interface AsteroidHandle {
  available: () => boolean
  spawn: (config: SpawnConfig) => void
  reset: () => void
}

interface AsteroidSlotProps {
  playing: boolean
  onHit: (value: number, prime: boolean, position: [number, number, number]) => void
  onBreach: (value: number) => void
}

const AsteroidSlot = forwardRef<AsteroidHandle, AsteroidSlotProps>(function AsteroidSlot(
  { playing, onHit, onBreach },
  forwardedRef,
) {
  const groupRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const shardRef = useRef<THREE.Group>(null)
  const phaseRef = useRef<AsteroidPhase>('idle')
  const valueRef = useRef(2)
  const speedRef = useRef(3)
  const driftRef = useRef(0)
  const spinRef = useRef(0.3)
  const impactTimeRef = useRef(0)
  const originXRef = useRef(0)
  const travelRef = useRef(0)
  const [display, setDisplay] = useState<AsteroidDisplay>({ value: 2, phase: 'idle', factorText: '' })

  const hide = () => {
    phaseRef.current = 'idle'
    if (groupRef.current) groupRef.current.visible = false
    setDisplay((current) => current.phase === 'idle' ? current : { ...current, phase: 'idle' })
  }

  useImperativeHandle(forwardedRef, () => ({
    available: () => phaseRef.current === 'idle',
    spawn: ({ value, position, speed, drift, spin }) => {
      const group = groupRef.current
      if (!group) return
      valueRef.current = value
      speedRef.current = speed
      driftRef.current = drift
      spinRef.current = spin
      originXRef.current = position[0]
      travelRef.current = 0
      impactTimeRef.current = 0
      phaseRef.current = 'alive'
      group.position.set(...position)
      group.rotation.set(Math.random() * 0.6, Math.random() * 0.6, 0)
      group.scale.setScalar(1)
      group.visible = true
      if (coreRef.current) coreRef.current.scale.setScalar(1)
      if (shardRef.current) shardRef.current.scale.setScalar(0.01)
      setDisplay({ value, phase: 'alive', factorText: '' })
    },
    reset: hide,
  }))

  useFrame(({ clock }, delta) => {
    const group = groupRef.current
    if (!group || phaseRef.current === 'idle') return

    if (phaseRef.current === 'alive') {
      if (!playing) return
      travelRef.current += delta
      group.position.z += speedRef.current * delta
      group.position.x = originXRef.current + Math.sin(clock.elapsedTime * 0.8 + originXRef.current) * driftRef.current
      group.rotation.x += delta * spinRef.current
      group.rotation.y += delta * spinRef.current * 0.72

      if (group.position.z > 6.2) {
        const escapedValue = valueRef.current
        hide()
        onBreach(escapedValue)
      }
      return
    }

    impactTimeRef.current += delta
    const progress = Math.min(1, impactTimeRef.current / 0.5)
    if (coreRef.current) coreRef.current.scale.setScalar(Math.max(0.01, 1 - progress * 1.45))
    if (shardRef.current) {
      shardRef.current.scale.setScalar(0.1 + progress * 2.5)
      shardRef.current.rotation.z += delta * 2.4
    }
    group.position.z -= delta * 0.5
    if (progress >= 1) hide()
  })

  const shoot = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    if (!playing || phaseRef.current !== 'alive' || !groupRef.current) return
    const prime = isPrime(valueRef.current)
    phaseRef.current = prime ? 'prime-impact' : 'composite-impact'
    impactTimeRef.current = 0
    const world = new THREE.Vector3()
    groupRef.current.getWorldPosition(world)
    setDisplay({
      value: valueRef.current,
      phase: phaseRef.current,
      factorText: prime ? 'PRIMO' : primeFactorization(valueRef.current).join(' × '),
    })
    onHit(valueRef.current, prime, [world.x, world.y, world.z])
  }

  const impacted = display.phase === 'prime-impact' || display.phase === 'composite-impact'
  const primeImpact = display.phase === 'prime-impact'

  return (
    <group ref={groupRef} visible={false} onClick={shoot}>
      <mesh ref={coreRef}>
        <dodecahedronGeometry args={[0.68, 1]} />
        <meshStandardMaterial
          color={impacted ? (primeImpact ? '#ffcc1a' : '#ef6b72') : '#202733'}
          emissive={impacted ? (primeImpact ? '#ffcc1a' : '#b62f43') : '#c99300'}
          emissiveIntensity={impacted ? 2.2 : 0.42}
          roughness={0.55}
          metalness={0.48}
          flatShading
        />
      </mesh>
      <mesh scale={1.045}>
        <icosahedronGeometry args={[0.69, 1]} />
        <meshBasicMaterial color="#ffe988" transparent opacity={0.18} wireframe />
      </mesh>
      <Text position={[0, 0, 0.74]} fontSize={display.value >= 100 ? 0.3 : 0.38} color="#fffbea" anchorX="center" anchorY="middle">
        {display.value}
      </Text>
      <group ref={shardRef} scale={0.01}>
        {[
          [-0.46, 0.28, 0.05], [0.44, 0.34, 0], [-0.32, -0.42, 0.08], [0.38, -0.38, -0.04], [0, 0.56, -0.08],
        ].map((position, index) => (
          <mesh key={index} position={position as [number, number, number]} scale={0.2 + index * 0.025}>
            <tetrahedronGeometry args={[0.55, 0]} />
            <meshBasicMaterial color={primeImpact ? '#ffdb4d' : '#ef7781'} transparent opacity={0.8} />
          </mesh>
        ))}
      </group>
      {impacted && (
        <Text position={[0, -1.03, 0.5]} fontSize={0.2} color={primeImpact ? '#ffdb4d' : '#ff9aa1'} anchorX="center">
          {primeImpact ? display.factorText : `${display.value} = ${display.factorText}`}
        </Text>
      )}
    </group>
  )
})

interface AsteroidPoolProps {
  count: number
  playing: boolean
  runId: number
  score: number
  onHit: AsteroidSlotProps['onHit']
  onBreach: AsteroidSlotProps['onBreach']
  onStageChange: (stage: number) => void
}

export default function AsteroidPool({ count, playing, runId, score, onHit, onBreach, onStageChange }: AsteroidPoolProps) {
  const handles = useRef<Array<AsteroidHandle | null>>([])
  const elapsedRef = useRef(0)
  const spawnCountdownRef = useRef(0.65)
  const stageRef = useRef(-1)
  const runRef = useRef(runId)

  useFrame((_, delta) => {
    if (runRef.current !== runId) {
      runRef.current = runId
      elapsedRef.current = 0
      spawnCountdownRef.current = 0.65
      stageRef.current = -1
      handles.current.forEach((handle) => handle?.reset())
    }
    if (!playing) return

    elapsedRef.current += delta
    const difficulty = getHunterDifficulty(score, elapsedRef.current)
    if (difficulty.stage !== stageRef.current) {
      stageRef.current = difficulty.stage
      onStageChange(difficulty.stage)
    }

    spawnCountdownRef.current -= delta
    if (spawnCountdownRef.current > 0) return
    const target = handles.current.find((handle) => handle?.available())
    spawnCountdownRef.current = difficulty.spawnInterval * (0.86 + Math.random() * 0.28)
    if (!target) return

    target.spawn({
      value: generateChallengeNumber(difficulty.challenge),
      position: [(Math.random() - 0.5) * 8.5, (Math.random() - 0.5) * 4.1 + 0.15, -15 - Math.random() * 3],
      speed: difficulty.speed * (0.9 + Math.random() * 0.18),
      drift: (Math.random() - 0.5) * 0.9,
      spin: 0.18 + Math.random() * 0.52,
    })
  })

  return (
    <group>
      {Array.from({ length: count }, (_, index) => (
        <AsteroidSlot
          key={index}
          ref={(handle) => { handles.current[index] = handle }}
          playing={playing}
          onHit={onHit}
          onBreach={onBreach}
        />
      ))}
    </group>
  )
}
