import { Billboard, Sparkles, Stars, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import type { QualityLevel } from '../../graphics/useQualitySettings'
import {
  createSiegeInput,
  SELECTABLE_PRIMES,
  SIEGE_SECTORS,
  stepSiege,
  type SiegeEnemy,
  type SiegeEvent,
  type SiegeInput,
  type SiegePrime,
  type SiegeState,
} from './siegeLogic'

const TAU = Math.PI * 2

export interface MutableSiegeControls {
  moveX: number
  moveZ: number
  guarding: boolean
  attackQueued: boolean
  factorQueued: boolean
  pulseQueued: boolean
  selectedPrime?: SiegePrime
}

export function createMutableSiegeControls(): MutableSiegeControls {
  return { ...createSiegeInput() }
}

export type SiegeQueuedAction = 'attack' | 'factor' | 'pulse'

export function queueSiegeAction(controls: MutableSiegeControls, action: SiegeQueuedAction): void {
  if (action === 'attack') controls.attackQueued = true
  else if (action === 'factor') controls.factorQueued = true
  else controls.pulseQueued = true
}

function ArenaFloor({ quality }: { readonly quality: QualityLevel }): JSX.Element {
  const wallCount = quality === 'low' ? 30 : 48
  const wallBlocks = useMemo(() => Array.from({ length: wallCount }, (_, index) => {
    const angle = index / wallCount * TAU
    const gateGap = SIEGE_SECTORS.some((sector) => {
      const delta = Math.atan2(Math.sin(angle - sector.angle), Math.cos(angle - sector.angle))
      return Math.abs(delta) < 0.085
    })
    return {
      angle,
      height: 2.8 + (index % 4) * 0.48,
      visible: !gateGap,
    }
  }), [wallCount])

  return (
    <group>
      <mesh position={[0, -0.52, 0]} receiveShadow>
        <cylinderGeometry args={[44.2, 45.8, 1.1, quality === 'low' ? 56 : 112]} />
        <meshStandardMaterial color="#110b0b" metalness={0.28} roughness={0.84} />
      </mesh>

      {SIEGE_SECTORS.map((sector, index) => (
        <group key={sector.id}>
          <mesh position={[0, 0.015 + index * 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[43.2, quality === 'low' ? 40 : 80, sector.angle - Math.PI / 6 + 0.025, Math.PI / 3 - 0.05]} />
            <meshStandardMaterial
              color={index % 2 === 0 ? '#1c1110' : '#26150f'}
              emissive={sector.accent}
              emissiveIntensity={0.035}
              metalness={0.44}
              roughness={0.76}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[Math.cos(sector.angle - Math.PI / 6) * 20.8, 0.045, Math.sin(sector.angle - Math.PI / 6) * 20.8]} rotation={[0, -(sector.angle - Math.PI / 6), 0]}>
            <boxGeometry args={[0.075, 0.04, 41.6]} />
            <meshBasicMaterial color={sector.accent} transparent opacity={0.26} />
          </mesh>
          {[11.5, 22.5, 33.5, 40.5].map((radius) => (
            <mesh key={radius} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[radius - 0.035, radius + 0.035, quality === 'low' ? 48 : 96]} />
              <meshBasicMaterial color={sector.accent} transparent opacity={0.2} />
            </mesh>
          ))}
        </group>
      ))}

      {Array.from({ length: quality === 'low' ? 7 : 13 }, (_, index) => {
        const angle = (index / (quality === 'low' ? 7 : 13)) * TAU + 0.12
        const length = 12 + (index % 4) * 5.1
        return (
          <mesh key={index} position={[Math.cos(angle) * length * 0.52, 0.065, Math.sin(angle) * length * 0.52]} rotation={[0, -angle, 0]}>
            <boxGeometry args={[0.12 + (index % 2) * 0.06, 0.035, length]} />
            <meshBasicMaterial color={index % 3 === 0 ? '#fff09a' : '#ff5a24'} transparent opacity={0.48} />
          </mesh>
        )
      })}

      <mesh position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[44.2, 56.5, quality === 'low' ? 72 : 144]} />
        <meshStandardMaterial color="#d43316" emissive="#ff3a10" emissiveIntensity={1.8} roughness={0.55} />
      </mesh>

      {wallBlocks.map(({ angle, height, visible }, index) => visible && (
        <group key={index} position={[Math.cos(angle) * 43.9, height / 2, Math.sin(angle) * 43.9]} rotation={[0, -angle, 0]}>
          <mesh castShadow={quality === 'high'} receiveShadow>
            <boxGeometry args={[2.1, height, 2.4]} />
            <meshStandardMaterial color="#211713" metalness={0.48} roughness={0.66} />
          </mesh>
          <mesh position={[0, height / 2 + 0.16, 0]}>
            <boxGeometry args={[2.24, 0.28, 2.58]} />
            <meshStandardMaterial color="#7b4c20" emissive="#ffb22e" emissiveIntensity={0.22} metalness={0.72} roughness={0.36} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function SectorGate({ sector, quality }: {
  readonly sector: (typeof SIEGE_SECTORS)[number]
  readonly quality: QualityLevel
}): JSX.Element {
  const radius = 42.2
  return (
    <group position={[Math.cos(sector.angle) * radius, 0, Math.sin(sector.angle) * radius]} rotation={[0, -sector.angle + Math.PI / 2, 0]}>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 2.15, 2.8, 0]}>
          <mesh castShadow={quality === 'high'}>
            <boxGeometry args={[1.35, 5.6, 2.4]} />
            <meshStandardMaterial color="#231714" emissive={sector.accent} emissiveIntensity={0.12} metalness={0.6} roughness={0.5} />
          </mesh>
          <mesh position={[0, 2.95, 0]}>
            <coneGeometry args={[1.05, 1.5, 4]} />
            <meshStandardMaterial color="#8e5c27" emissive={sector.accent} emissiveIntensity={0.48} metalness={0.72} roughness={0.33} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 5.15, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[1.05, 5.4, 1.5]} />
        <meshStandardMaterial color="#4a2d1b" emissive={sector.accent} emissiveIntensity={0.2} metalness={0.62} roughness={0.4} />
      </mesh>
      <Billboard position={[0, 7.25, 0]} follow>
        <Text fontSize={0.48} color={sector.accent} outlineColor="#0d0706" outlineWidth={0.06}>{sector.shortName}</Text>
      </Billboard>
    </group>
  )
}

function OuterVolcanoes({ quality }: { readonly quality: QualityLevel }): JSX.Element {
  const count = quality === 'high' ? 24 : quality === 'medium' ? 15 : 9
  return (
    <group>
      {Array.from({ length: count }, (_, index) => {
        const angle = index / count * TAU + 0.08
        const radius = 61 + (index % 4) * 6
        const height = 10 + (index * 7 % 10)
        return (
          <group key={index} position={[Math.cos(angle) * radius, height * 0.5 - 1.2, Math.sin(angle) * radius]}>
            <mesh rotation={[0.03 * (index % 2 ? 1 : -1), angle, 0]}>
              <coneGeometry args={[4.2 + index % 3, height, 5]} />
              <meshStandardMaterial color="#130a0b" emissive="#4b1008" emissiveIntensity={0.2} roughness={0.9} />
            </mesh>
            {index % 3 === 0 && (
              <mesh position={[0, height * 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.72, 12]} />
                <meshBasicMaterial color="#ff4a1d" transparent opacity={0.76} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

function ForgeHeart({ stateRef, quality, reducedMotion }: {
  readonly stateRef: React.MutableRefObject<SiegeState>
  readonly quality: QualityLevel
  readonly reducedMotion: boolean
}): JSX.Element {
  const rings = useRef<THREE.Group>(null)
  const heart = useRef<THREE.Mesh>(null)
  const heartMaterial = useRef<THREE.MeshStandardMaterial>(null)

  useFrame(({ clock }, delta) => {
    const integrity = stateRef.current.forgeHp / stateRef.current.forgeMaxHp
    if (rings.current && !reducedMotion) rings.current.rotation.y += delta * (0.35 + integrity * 0.65)
    if (heart.current) {
      const pulse = reducedMotion ? 1 : 1 + Math.sin(clock.elapsedTime * (2.4 + integrity * 1.5)) * 0.06
      heart.current.scale.setScalar(pulse)
    }
    if (heartMaterial.current) heartMaterial.current.emissiveIntensity = 0.8 + integrity * 1.65
  })

  return (
    <group>
      <mesh position={[0, 0.55, 0]} receiveShadow castShadow={quality === 'high'}>
        <cylinderGeometry args={[3.15, 4.25, 1.1, 12]} />
        <meshStandardMaterial color="#25160f" metalness={0.82} roughness={0.36} />
      </mesh>
      <mesh ref={heart} position={[0, 2.25, 0]} castShadow={quality === 'high'}>
        <dodecahedronGeometry args={[1.35, quality === 'low' ? 0 : 1]} />
        <meshStandardMaterial ref={heartMaterial} color="#ffdf72" emissive="#ff5a18" emissiveIntensity={2} metalness={0.56} roughness={0.2} />
      </mesh>
      <group ref={rings} position={[0, 2.25, 0]}>
        {[2.1, 2.75, 3.35].map((radius, index) => (
          <mesh key={radius} rotation={[index % 2 ? Math.PI / 2 : 0.55, index * 0.8, index * 0.44]}>
            <torusGeometry args={[radius, 0.055 + index * 0.012, 6, quality === 'low' ? 32 : 64]} />
            <meshBasicMaterial color={index === 1 ? '#fff2a2' : '#ff8a31'} transparent opacity={0.72 - index * 0.12} />
          </mesh>
        ))}
      </group>
      {quality !== 'low' && <pointLight position={[0, 4, 0]} color="#ff8d3c" intensity={18} distance={22} decay={2} />}
      <Billboard position={[0, 5.2, 0]} follow>
        <Text fontSize={0.44} letterSpacing={0.16} color="#ffe9a1" outlineColor="#120806" outlineWidth={0.045}>CORAÇÃO DE EUCLIDES</Text>
      </Billboard>
    </group>
  )
}

function GoldenArtificer({ stateRef, quality, reducedMotion }: {
  readonly stateRef: React.MutableRefObject<SiegeState>
  readonly quality: QualityLevel
  readonly reducedMotion: boolean
}): JSX.Element {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const aegis = useRef<THREE.Group>(null)
  const weapon = useRef<THREE.Group>(null)

  useFrame(({ clock }, delta) => {
    const player = stateRef.current.player
    if (root.current) {
      root.current.position.x = THREE.MathUtils.damp(root.current.position.x, player.position[0], 18, delta)
      root.current.position.z = THREE.MathUtils.damp(root.current.position.z, player.position[1], 18, delta)
      root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, player.yaw, 16, delta)
    }
    if (body.current) body.current.position.y = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 4.5) * 0.035
    if (aegis.current) {
      aegis.current.visible = player.guarding
      if (!reducedMotion) aegis.current.rotation.z -= delta * 1.8
    }
    if (weapon.current) weapon.current.rotation.z = THREE.MathUtils.damp(weapon.current.rotation.z, player.guarding ? -0.2 : -0.7, 12, delta)
  })

  return (
    <group ref={root} position={[0, 0.05, 7.5]}>
      <group ref={body}>
        <mesh position={[0, 1.15, 0]} castShadow={quality === 'high'}>
          <cylinderGeometry args={[0.36, 0.5, 1.15, 7]} />
          <meshStandardMaterial color="#38261a" emissive="#ffb340" emissiveIntensity={0.22} metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.92, 0]} castShadow={quality === 'high'}>
          <icosahedronGeometry args={[0.43, 1]} />
          <meshStandardMaterial color="#e9aa42" emissive="#ffcb65" emissiveIntensity={0.36} metalness={0.82} roughness={0.25} />
        </mesh>
        <mesh position={[0, 1.93, 0.38]}>
          <boxGeometry args={[0.52, 0.12, 0.08]} />
          <meshBasicMaterial color="#fff4bc" />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.55, 1.28, 0]} rotation={[0, 0, side * -0.14]} castShadow={quality === 'high'}>
              <boxGeometry args={[0.25, 0.85, 0.29]} />
              <meshStandardMaterial color="#9a6329" metalness={0.8} roughness={0.32} />
            </mesh>
            <mesh position={[side * 0.26, 0.42, 0]}>
              <boxGeometry args={[0.3, 0.75, 0.34]} />
              <meshStandardMaterial color="#291d17" metalness={0.65} roughness={0.46} />
            </mesh>
          </group>
        ))}
        <group ref={weapon} position={[0.74, 1.1, 0.1]} rotation={[0, 0, -0.7]}>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.055, 0.055, 1.6, 8]} />
            <meshStandardMaterial color="#6f4527" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.4, 0]}>
            <boxGeometry args={[0.72, 0.34, 0.36]} />
            <meshStandardMaterial color="#ffc757" emissive="#ff8a27" emissiveIntensity={0.65} metalness={0.9} roughness={0.18} />
          </mesh>
        </group>
      </group>
      <group ref={aegis} visible={false} position={[0, 1.15, 0.7]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <torusGeometry args={[1.15, 0.065, 8, 48]} />
          <meshBasicMaterial color="#fff19b" transparent opacity={0.82} />
        </mesh>
        <mesh>
          <circleGeometry args={[1.08, 48]} />
          <meshBasicMaterial color="#ffce61" transparent opacity={0.13} depthWrite={false} />
        </mesh>
      </group>
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.72, 0.82, 32]} />
        <meshBasicMaterial color="#ffe680" transparent opacity={0.7} />
      </mesh>
    </group>
  )
}

function CompositeInvader({ enemy, stateRef, quality, reducedMotion }: {
  readonly enemy: SiegeEnemy
  readonly stateRef: React.MutableRefObject<SiegeState>
  readonly quality: QualityLevel
  readonly reducedMotion: boolean
}): JSX.Element {
  const root = useRef<THREE.Group>(null)
  const armor = useRef<THREE.Group>(null)
  const shield = useRef<THREE.Group>(null)
  const sector = SIEGE_SECTORS.find((candidate) => candidate.id === enemy.sector) ?? SIEGE_SECTORS[0]

  useFrame(({ clock }, delta) => {
    const live = stateRef.current.enemies.find((candidate) => candidate.id === enemy.id)
    if (!root.current) return
    if (!live) {
      root.current.visible = false
      return
    }
    root.current.visible = true
    root.current.position.x = THREE.MathUtils.damp(root.current.position.x, live.position[0], 18, delta)
    root.current.position.z = THREE.MathUtils.damp(root.current.position.z, live.position[1], 18, delta)
    root.current.rotation.y = Math.atan2(-live.position[0], -live.position[1])
    const stunned = stateRef.current.elapsedMs < live.stunnedUntilMs
    if (armor.current) {
      const bob = reducedMotion ? 0 : Math.sin(clock.elapsedTime * (live.boss ? 1.8 : 3.5) + live.composite) * 0.045
      armor.current.position.y = bob
      armor.current.rotation.z = reducedMotion || !stunned ? 0 : Math.sin(clock.elapsedTime * 25) * 0.055
    }
    if (shield.current) {
      shield.current.visible = live.shieldRemaining > 1
      if (!reducedMotion) {
        shield.current.rotation.y += delta * (live.enragedUntilMs > stateRef.current.elapsedMs ? 2.8 : 0.75)
        shield.current.rotation.x += delta * 0.18
      }
    }
  })

  const scale = enemy.boss ? 1.82 : enemy.elite ? 1.2 : 1
  const hpRatio = Math.max(0, enemy.hp / enemy.maxHp)

  return (
    <group ref={root} position={[enemy.position[0], 0.03, enemy.position[1]]} scale={scale}>
      <group ref={armor}>
        <mesh position={[0, 0.95, 0]} castShadow={quality === 'high'}>
          <dodecahedronGeometry args={[0.72, quality === 'low' ? 0 : 1]} />
          <meshStandardMaterial color="#25151b" emissive={sector.accent} emissiveIntensity={enemy.elite ? 0.58 : 0.32} metalness={0.72} roughness={0.32} />
        </mesh>
        <mesh position={[0, 1.68, 0]} castShadow={quality === 'high'}>
          <octahedronGeometry args={[0.44, 0]} />
          <meshStandardMaterial color="#0d0b10" emissive={sector.accent} emissiveIntensity={0.5} metalness={0.78} roughness={0.28} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.55, 0.25, 0]} rotation={[0, 0, side * 0.08]}>
              <boxGeometry args={[0.32, 0.72, 0.42]} />
              <meshStandardMaterial color="#160f12" metalness={0.64} roughness={0.48} />
            </mesh>
            <mesh position={[side * 0.74, 1.18, 0]} rotation={[0, 0, side * 0.32]}>
              <coneGeometry args={[0.25, 0.85, 5]} />
              <meshStandardMaterial color="#5b3021" emissive={sector.accent} emissiveIntensity={0.28} metalness={0.72} roughness={0.35} />
            </mesh>
          </group>
        ))}
        <Billboard position={[0, 1.02, 0.7]} follow>
          <Text fontSize={0.44} color="#fff4d0" outlineColor="#16090a" outlineWidth={0.045}>{enemy.composite}</Text>
        </Billboard>
      </group>

      <group ref={shield}>
        <mesh rotation={[Math.PI / 2, 0.2, 0]}>
          <torusGeometry args={[1.12, 0.055, 6, quality === 'low' ? 28 : 52]} />
          <meshBasicMaterial color={sector.accent} transparent opacity={0.72} />
        </mesh>
        <mesh rotation={[0.4, Math.PI / 2, 0.5]}>
          <torusGeometry args={[1, 0.035, 6, quality === 'low' ? 24 : 44]} />
          <meshBasicMaterial color="#ffd676" transparent opacity={0.55} />
        </mesh>
      </group>

      <Billboard position={[0, enemy.boss ? 2.9 : 2.42, 0]} follow>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[1.55, 0.13]} />
          <meshBasicMaterial color="#160b0d" transparent opacity={0.86} />
        </mesh>
        <mesh position={[-0.77 + 0.77 * hpRatio, 0, 0]} scale={[hpRatio, 1, 1]}>
          <planeGeometry args={[1.5, 0.075]} />
          <meshBasicMaterial color={enemy.shieldRemaining > 1 ? sector.accent : '#ffe990'} />
        </mesh>
        <Text position={[0, 0.3, 0]} fontSize={0.14} color={enemy.shieldRemaining > 1 ? '#ffca75' : '#fff3b2'} outlineColor="#100609" outlineWidth={0.025}>
          {enemy.shieldRemaining > 1 ? `ESCUDO ${enemy.shieldRemaining}` : 'NÚCLEO EXPOSTO'}
        </Text>
      </Billboard>
    </group>
  )
}

function SiegeEffectVisual({ event, reducedMotion }: { readonly event: SiegeEvent; readonly reducedMotion: boolean }): JSX.Element {
  const root = useRef<THREE.Group>(null)
  const material = useRef<THREE.MeshBasicMaterial>(null)
  const text = useRef<THREE.Group>(null)
  const bornAt = useRef<number | null>(null)
  const isPulse = event.kind === 'pulse' || event.kind === 'wave-start'

  useFrame(({ clock }) => {
    if (bornAt.current === null) bornAt.current = clock.elapsedTime
    const duration = reducedMotion ? 0.38 : isPulse ? 1.15 : 0.82
    const progress = Math.min(1, (clock.elapsedTime - bornAt.current) / duration)
    if (root.current) {
      root.current.visible = progress < 1
      const scale = isPulse ? 0.5 + progress * (event.kind === 'wave-start' ? 18 : 10.5) : 0.65 + progress * 2.2
      root.current.scale.setScalar(scale)
    }
    if (material.current) material.current.opacity = Math.max(0, (1 - progress) * (isPulse ? 0.68 : 0.82))
    if (text.current) text.current.position.y = 1.8 + progress * (reducedMotion ? 0.25 : 1.35)
  })

  const danger = event.kind === 'factor-miss' || event.kind === 'player-hit' || event.kind === 'forge-hit'
  const color = event.accent ?? (danger ? '#ff4a32' : '#ffe589')
  return (
    <group position={[event.position[0], 0.08, event.position[1]]}>
      <group ref={root}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.72, 0.9, 36]} />
          <meshBasicMaterial ref={material} color={color} transparent opacity={0.75} depthWrite={false} />
        </mesh>
      </group>
      {event.label && (
        <group ref={text} position={[0, 1.8, 0]}>
          <Billboard follow>
            <Text fontSize={event.kind === 'wave-start' ? 0.9 : 0.34} color={color} outlineColor="#160609" outlineWidth={0.05}>
              {event.label}
            </Text>
          </Billboard>
        </group>
      )}
    </group>
  )
}

function CameraRig({ stateRef, reducedMotion }: {
  readonly stateRef: React.MutableRefObject<SiegeState>
  readonly reducedMotion: boolean
}): null {
  const { camera } = useThree()
  const desired = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    camera.position.set(0, 38, 41)
    camera.lookAt(0, 0, 0)
  }, [camera])

  useFrame((_, delta) => {
    const player = stateRef.current.player.position
    desired.set(player[0] * 0.24, 38, 41 + player[1] * 0.18)
    target.set(player[0] * 0.14, 0.8, player[1] * 0.14 - 1.8)
    camera.position.lerp(desired, reducedMotion ? 1 : 1 - Math.exp(-delta * 3.4))
    camera.lookAt(target)
  })
  return null
}

function useKeyboardAndPointerControls(
  controls: React.MutableRefObject<MutableSiegeControls>,
  paused: boolean,
  onPauseRequest: () => void,
): void {
  const { gl } = useThree()

  useEffect(() => {
    const pressed = new Set<string>()
    const refreshMovement = () => {
      controls.current.moveX = (pressed.has('KeyD') || pressed.has('ArrowRight') ? 1 : 0) - (pressed.has('KeyA') || pressed.has('ArrowLeft') ? 1 : 0)
      controls.current.moveZ = (pressed.has('KeyS') || pressed.has('ArrowDown') ? 1 : 0) - (pressed.has('KeyW') || pressed.has('ArrowUp') ? 1 : 0)
      controls.current.guarding = pressed.has('KeyE') || pressed.has('ControlLeft') || pressed.has('ControlRight')
    }
    const release = () => {
      pressed.clear()
      controls.current.moveX = 0
      controls.current.moveZ = 0
      controls.current.guarding = false
    }
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onPauseRequest()
        return
      }
      if (paused || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      const slot = /^Digit([1-6])$/.exec(event.code)
      if (slot) {
        controls.current.selectedPrime = SELECTABLE_PRIMES[Number(slot[1]) - 1]
        event.preventDefault()
      }
      if (!event.repeat) {
        if (event.code === 'KeyJ' || event.code === 'Space') controls.current.attackQueued = true
        if (event.code === 'KeyF') controls.current.factorQueued = true
        if (event.code === 'KeyQ') controls.current.pulseQueued = true
      }
      if (/^(Key[WASDQEJF]|Arrow(Up|Down|Left|Right)|Space|Digit[1-6])$/.test(event.code)) event.preventDefault()
      pressed.add(event.code)
      refreshMovement()
    }
    const keyUp = (event: KeyboardEvent) => {
      pressed.delete(event.code)
      refreshMovement()
    }
    const pointerDown = (event: PointerEvent) => {
      if (paused) return
      if (event.button === 0) controls.current.attackQueued = true
      if (event.button === 2) controls.current.guarding = true
    }
    const pointerUp = (event: PointerEvent) => {
      if (event.button === 2) controls.current.guarding = false
    }
    const contextMenu = (event: MouseEvent) => event.preventDefault()

    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', release)
    gl.domElement.addEventListener('pointerdown', pointerDown)
    window.addEventListener('pointerup', pointerUp)
    gl.domElement.addEventListener('contextmenu', contextMenu)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', release)
      gl.domElement.removeEventListener('pointerdown', pointerDown)
      window.removeEventListener('pointerup', pointerUp)
      gl.domElement.removeEventListener('contextmenu', contextMenu)
      release()
    }
  }, [controls, gl, onPauseRequest, paused])
}

export interface EuclidSiegeSceneProps {
  readonly stateRef: React.MutableRefObject<SiegeState>
  readonly controls: React.MutableRefObject<MutableSiegeControls>
  readonly paused: boolean
  readonly quality: QualityLevel
  readonly reducedMotion: boolean
  readonly onSnapshot: (state: SiegeState) => void
  readonly onVictory: (state: SiegeState) => void
  readonly onDefeat: (state: SiegeState) => void
  readonly onPauseRequest: () => void
}

export default function EuclidSiegeScene({
  stateRef,
  controls,
  paused,
  quality,
  reducedMotion,
  onSnapshot,
  onVictory,
  onDefeat,
  onPauseRequest,
}: EuclidSiegeSceneProps): JSX.Element {
  const [enemyVisuals, setEnemyVisuals] = useState<readonly SiegeEnemy[]>(stateRef.current.enemies)
  const [effects, setEffects] = useState<readonly SiegeEvent[]>([])
  const visualSignature = useRef('')
  const lastSnapshotAt = useRef(-1_000)
  const finished = useRef(false)

  useKeyboardAndPointerControls(controls, paused, onPauseRequest)

  const syncEnemyVisuals = useCallback((state: SiegeState) => {
    const signature = state.enemies.map((enemy) => `${enemy.id}:${enemy.shieldRemaining}:${Math.ceil(enemy.hp)}`).join('|')
    if (signature === visualSignature.current) return
    visualSignature.current = signature
    setEnemyVisuals(state.enemies)
  }, [])

  useFrame(({ clock }, deltaSeconds) => {
    if (paused || finished.current) return
    const queued: SiegeInput = {
      moveX: controls.current.moveX,
      moveZ: controls.current.moveZ,
      guarding: controls.current.guarding,
      attackQueued: controls.current.attackQueued,
      factorQueued: controls.current.factorQueued,
      pulseQueued: controls.current.pulseQueued,
      selectedPrime: controls.current.selectedPrime,
    }
    controls.current.attackQueued = false
    controls.current.factorQueued = false
    controls.current.pulseQueued = false
    controls.current.selectedPrime = undefined

    const result = stepSiege(stateRef.current, queued, deltaSeconds * 1_000)
    stateRef.current = result.state
    syncEnemyVisuals(result.state)
    if (result.events.length > 0) setEffects((current) => [...current, ...result.events].slice(-24))

    if (clock.elapsedTime * 1_000 - lastSnapshotAt.current >= 90 || result.events.length > 0) {
      lastSnapshotAt.current = clock.elapsedTime * 1_000
      onSnapshot(result.state)
    }
    if (result.state.phase === 'victory') {
      finished.current = true
      onSnapshot(result.state)
      onVictory(result.state)
    } else if (result.state.phase === 'defeat') {
      finished.current = true
      onSnapshot(result.state)
      onDefeat(result.state)
    }
  })

  return (
    <>
      <color attach="background" args={['#080304']} />
      <fog attach="fog" args={['#100405', 46, quality === 'low' ? 104 : 142]} />
      <ambientLight intensity={0.48} color="#8fa4d6" />
      <hemisphereLight args={['#38385a', '#4b1007', 0.72]} />
      <directionalLight
        position={[18, 32, 16]}
        intensity={2.6}
        color="#ffe6a7"
        castShadow={quality === 'high'}
        shadow-mapSize-width={quality === 'high' ? 1536 : 768}
        shadow-mapSize-height={quality === 'high' ? 1536 : 768}
      />
      <pointLight position={[0, 9, 0]} intensity={quality === 'low' ? 12 : 24} distance={64} decay={2} color="#ff6a22" />

      <Stars radius={112} depth={58} count={quality === 'high' ? 1_300 : quality === 'medium' ? 700 : 280} factor={3.2} saturation={0.7} fade speed={reducedMotion ? 0 : 0.22} />
      {quality !== 'low' && (
        <Sparkles count={quality === 'high' ? 90 : 46} scale={[108, 28, 108]} size={1.8} speed={reducedMotion ? 0 : 0.18} color="#ff9b46" opacity={0.48} />
      )}

      <ArenaFloor quality={quality} />
      <OuterVolcanoes quality={quality} />
      {SIEGE_SECTORS.map((sector) => <SectorGate key={sector.id} sector={sector} quality={quality} />)}
      <ForgeHeart stateRef={stateRef} quality={quality} reducedMotion={reducedMotion} />
      <GoldenArtificer stateRef={stateRef} quality={quality} reducedMotion={reducedMotion} />

      {enemyVisuals.map((enemy) => (
        <CompositeInvader
          key={enemy.id}
          enemy={enemy}
          stateRef={stateRef}
          quality={quality}
          reducedMotion={reducedMotion}
        />
      ))}
      {effects.map((event) => <SiegeEffectVisual key={event.serial} event={event} reducedMotion={reducedMotion} />)}

      <CameraRig stateRef={stateRef} reducedMotion={reducedMotion} />
    </>
  )
}
