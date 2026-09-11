import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import type { QualityLevel, QualityProfile } from '../../graphics/useQualitySettings'
import { SceneBoundary } from '../../ui/SceneBoundary'
import {
  SKYLINE_LOCATIONS,
  SKYLINE_NPCS,
  SKYLINE_PRIME_CORE_VALUES,
  SKYLINE_PRIME_CORES,
  SKYLINE_SENTINEL_IDS,
  SKYLINE_SENTINELS,
  type SkylinePrimeCoreValue,
  type SkylineSentinelId,
} from './missionData'
import { getNextSkylineObjective } from './missionLogic'
import {
  calculateGrapplePull,
  canJumpWithCoyoteTime,
  detectWallRunSurface,
  findSweptLanding,
  hasLineOfSight,
  integratePlayerMotion,
  respawnAtCheckpoint,
  selectGrappleAnchor,
  selectGrappleSurface,
  selectReachedCheckpoint,
  shouldRespawn,
} from './parkourLogic'
import {
  PRIME_POWERS,
  selectPrimeTarget,
  type PrimePowerValue,
} from './primeCombat'
import RunnerHandModel from './RunnerHandModel'
import { createSkylineAudio, type SkylineAudioController } from './skylineAudio'
import SkylineRunnerHud, { type TouchAction } from './SkylineRunnerHud'
import {
  type RunnerMovementState,
  type SkylineRunnerResult,
  useSkylineRunnerStore,
} from './skylineRunnerStore'
import SkylineWorld from './SkylineWorld'
import type { Aabb, GrappleAnchor, PlayerMotion, Vec3 } from './types'
import {
  PLAYER_SPAWN,
  SKYLINE_ANCHORS,
  SKYLINE_BUILDINGS,
  SKYLINE_CHECKPOINTS,
  SKYLINE_COLLIDERS,
  SKYLINE_WORLD_BOUNDS,
} from './world'

export type SkylineRunResult = SkylineRunnerResult

interface SkylineRunnerExperienceProps {
  readonly paused: boolean
  readonly profile: QualityProfile
  readonly quality: QualityLevel
  readonly onQualityChange: (quality: QualityLevel) => void
  readonly onPauseChange: (paused: boolean) => void
  readonly onVictory: (result: SkylineRunResult) => void
  readonly onDefeat: (result: SkylineRunResult) => void
}

interface RunnerInput {
  readonly keys: Set<string>
  readonly grappleSources: Set<'keyboard' | 'mouse' | 'touch'>
  touchX: number
  touchZ: number
  jumpQueued: boolean
  jumpHeld: boolean
  slideHeld: boolean
  attackQueued: boolean
  sprintHeld: boolean
}

interface LookState {
  yaw: number
  pitch: number
}

interface SceneProps {
  readonly paused: boolean
  readonly quality: QualityLevel
  readonly profile: QualityProfile
  readonly reducedMotion: boolean
  readonly input: React.MutableRefObject<RunnerInput>
  readonly look: React.MutableRefObject<LookState>
  readonly audio: SkylineAudioController
  readonly selectedPrime: SkylinePrimeCoreValue
}

const PLAYER_RADIUS = .36
const PLAYER_HALF_HEIGHT = 1.1
import {
  IDLE_SLIDE,
  calculateWallJump,
  detectMantleLedge,
  flowFieldOfView,
  flowSpeedMultiplier,
  updateFlow,
  updateSlide,
  type SlideState,
} from './movementFlow'

const MANTLE_DURATION_MS = 260
const EYE_OFFSET = .58
const COYOTE_WINDOW_MS = 155
const GRAPPLE_RANGE = 52
const GRAPPLE_SURFACE_OFFSET = .06
const PRIME_AIM_ALIGNMENT = .97
const TEMP_VECTOR = new THREE.Vector3()
const GRAPPLE_OBSTACLES = SKYLINE_COLLIDERS.map((platform) => platform.bounds)

function cloneMotion(motion: PlayerMotion): PlayerMotion {
  return {
    position: { ...motion.position },
    velocity: { ...motion.velocity },
    grounded: motion.grounded,
    lastGroundedAtMs: motion.lastGroundedAtMs,
  }
}

function vectorDistance(first: Vec3, second: Vec3): number {
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z)
}

function tupleDistance(position: Vec3, target: readonly [number, number, number]): number {
  return Math.hypot(position.x - target[0], position.y - target[1], position.z - target[2])
}

function horizontalDirection(input: RunnerInput, yaw: number): { x: number; z: number; length: number } {
  const keyboardX = (input.keys.has('KeyD') ? 1 : 0) - (input.keys.has('KeyA') ? 1 : 0)
  const keyboardZ = (input.keys.has('KeyW') ? 1 : 0) - (input.keys.has('KeyS') ? 1 : 0)
  const localX = Math.max(-1, Math.min(1, keyboardX + input.touchX))
  const localZ = Math.max(-1, Math.min(1, keyboardZ + input.touchZ))
  const length = Math.hypot(localX, localZ)
  if (length <= .001) return { x: 0, z: 0, length: 0 }
  const normalizedX = localX / Math.max(1, length)
  const normalizedZ = localZ / Math.max(1, length)
  const forwardX = -Math.sin(yaw)
  const forwardZ = -Math.cos(yaw)
  const rightX = Math.cos(yaw)
  const rightZ = -Math.sin(yaw)
  return {
    x: forwardX * normalizedZ + rightX * normalizedX,
    z: forwardZ * normalizedZ + rightZ * normalizedX,
    length: Math.min(1, length),
  }
}

function bodyOverlaps(position: Vec3, bounds: Aabb): boolean {
  const bottom = position.y - PLAYER_HALF_HEIGHT
  const top = position.y + PLAYER_HALF_HEIGHT
  return bottom < bounds.max.y - .12 && top > bounds.min.y + .035
    && position.x + PLAYER_RADIUS > bounds.min.x
    && position.x - PLAYER_RADIUS < bounds.max.x
    && position.z + PLAYER_RADIUS > bounds.min.z
    && position.z - PLAYER_RADIUS < bounds.max.z
}

function resolveHorizontalCollision(
  previous: Vec3,
  requested: Vec3,
  velocity: Vec3,
  wantsVault: boolean,
): { position: Vec3; velocity: Vec3; vaulted: boolean } {
  const position = { ...requested }
  const nextVelocity = { ...velocity }
  let vaulted = false
  const feet = previous.y - PLAYER_HALF_HEIGHT

  const resolveAxis = (axis: 'x' | 'z') => {
    for (const platform of SKYLINE_COLLIDERS) {
      if (!bodyOverlaps(position, platform.bounds)) continue
      const climb = platform.bounds.max.y - feet
      if (wantsVault && climb > .08 && climb <= 1.72) {
        position.y = platform.bounds.max.y + PLAYER_HALF_HEIGHT + .025
        nextVelocity.y = Math.max(3.2, nextVelocity.y)
        vaulted = true
        continue
      }
      position[axis] = previous[axis]
      nextVelocity[axis] = 0
      break
    }
  }
  resolveAxis('x')
  resolveAxis('z')
  return { position, velocity: nextVelocity, vaulted }
}

function findGroundTop(position: Vec3): number | null {
  const feet = position.y - PLAYER_HALF_HEIGHT
  let ground: number | null = null
  for (const platform of SKYLINE_COLLIDERS) {
    const top = platform.bounds.max.y
    if (Math.abs(feet - top) > .14) continue
    if (
      position.x < platform.bounds.min.x - PLAYER_RADIUS * .45
      || position.x > platform.bounds.max.x + PLAYER_RADIUS * .45
      || position.z < platform.bounds.min.z - PLAYER_RADIUS * .45
      || position.z > platform.bounds.max.z + PLAYER_RADIUS * .45
    ) continue
    ground = ground === null ? top : Math.max(ground, top)
  }
  return ground
}

function sectorAt(position: Vec3): string {
  let best = SKYLINE_BUILDINGS[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const building of SKYLINE_BUILDINGS) {
    const x = (building.bounds.min.x + building.bounds.max.x) / 2
    const z = (building.bounds.min.z + building.bounds.max.z) / 2
    const distance = Math.hypot(position.x - x, position.z - z)
    if (distance < bestDistance) {
      best = building
      bestDistance = distance
    }
  }
  return best.sector
}

function RunnerHands({
  grappled,
  reducedMotion,
  quality,
  selectedPrime,
  castSerial,
  spellUnlocked,
  grappleMuzzleRef,
  spellMuzzleRef,
}: {
  grappled: boolean
  reducedMotion: boolean
  quality: QualityLevel
  selectedPrime: PrimePowerValue
  castSerial: number
  spellUnlocked: boolean
  grappleMuzzleRef: React.RefObject<THREE.Group>
  spellMuzzleRef: React.RefObject<THREE.Group>
}): JSX.Element {
  const { camera, size } = useThree()
  const root = useRef<THREE.Group>(null)
  const sway = useRef<THREE.Group>(null)
  const leftHand = useRef<THREE.Group>(null)
  const rightHand = useRef<THREE.Group>(null)
  const leftSigil = useRef<THREE.Group>(null)
  const rightSigil = useRef<THREE.Group>(null)
  const spellLight = useRef<THREE.PointLight>(null)
  const seenCast = useRef(castSerial)
  const castStartedAt = useRef(-10)
  const hookBlend = useRef(grappled ? 1 : 0)
  const articulationRef = useRef({ cast: 0, hook: hookBlend.current })
  const [articulation, setArticulation] = useState(articulationRef.current)
  const telemetry = useSkylineRunnerStore((state) => state.telemetry)
  const compact = size.width < 720 || size.width / Math.max(1, size.height) < .85
  const power = PRIME_POWERS[selectedPrime]
  const clearViewmodelDepth = useCallback((renderer: THREE.WebGLRenderer) => {
    renderer.clearDepth()
  }, [])

  useFrame(({ clock }, delta) => {
    if (!root.current || !sway.current) return
    if (seenCast.current !== castSerial) {
      seenCast.current = castSerial
      castStartedAt.current = clock.elapsedTime
    }
    root.current.position.copy(camera.position)
    root.current.quaternion.copy(camera.quaternion)
    const fovCompensation = camera instanceof THREE.PerspectiveCamera
      ? Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.tan(THREE.MathUtils.degToRad(75 / 2))
      : 1
    root.current.scale.setScalar((compact ? .78 : 1) * fovCompensation)
    root.current.translateY(compact ? -.27 : -.31)
    root.current.translateZ(compact ? -.68 : -.57)
    const stride = reducedMotion ? 0 : Math.min(1, telemetry.speed / 11)
    const castAge = clock.elapsedTime - castStartedAt.current
    const castEnergy = castAge < 0 || castAge > .48
      ? 0
      : castAge < .12
        ? Math.sin(castAge / .12 * Math.PI / 2)
        : Math.max(0, 1 - (castAge - .12) / .36)
    const motionEnergy = reducedMotion ? 0 : castEnergy
    const castRecoil = !reducedMotion && castAge >= .1 && castAge < .28
      ? Math.sin((castAge - .1) / .18 * Math.PI)
      : 0
    sway.current.position.y = Math.sin(clock.elapsedTime * 10) * .014 * stride - castRecoil * .018
    sway.current.rotation.z = Math.sin(clock.elapsedTime * 5) * .022 * stride

    const hookTarget = grappled ? 1 : 0
    const hookRate = grappled ? 14 : 9
    hookBlend.current = THREE.MathUtils.lerp(
      hookBlend.current,
      hookTarget,
      1 - Math.exp(-delta * hookRate),
    )
    if (Math.abs(hookBlend.current - hookTarget) < .006) hookBlend.current = hookTarget

    const leftCast = motionEnergy
    const rightCast = motionEnergy * (1 - hookBlend.current)
    const leftIdlePosition = [-.3, -.03, -.03] as const
    const leftCastPosition = [-.15, .14, -.19] as const
    const leftIdleRotation = [-.28, -.12, -.3] as const
    const leftCastRotation = [-.62, -.03, -.1] as const
    const rightIdlePosition = [.31, -.04, -.05] as const
    const rightHookPosition = [.21, .1, -.22] as const
    const rightCastPosition = [.15, .15, -.23] as const
    const rightIdleRotation = [-.24, .12, .32] as const
    const rightHookRotation = [-.7, .04, .09] as const
    const rightCastRotation = [-.68, .03, .1] as const

    if (leftHand.current) {
      leftHand.current.position.set(
        THREE.MathUtils.lerp(leftIdlePosition[0], leftCastPosition[0], leftCast),
        THREE.MathUtils.lerp(leftIdlePosition[1], leftCastPosition[1], leftCast),
        THREE.MathUtils.lerp(leftIdlePosition[2], leftCastPosition[2], leftCast) - castRecoil * .035,
      )
      leftHand.current.rotation.set(
        THREE.MathUtils.lerp(leftIdleRotation[0], leftCastRotation[0], leftCast),
        THREE.MathUtils.lerp(leftIdleRotation[1], leftCastRotation[1], leftCast),
        THREE.MathUtils.lerp(leftIdleRotation[2], leftCastRotation[2], leftCast),
      )
    }
    if (rightHand.current) {
      const baseX = THREE.MathUtils.lerp(rightIdlePosition[0], rightHookPosition[0], hookBlend.current)
      const baseY = THREE.MathUtils.lerp(rightIdlePosition[1], rightHookPosition[1], hookBlend.current)
      const baseZ = THREE.MathUtils.lerp(rightIdlePosition[2], rightHookPosition[2], hookBlend.current)
      const baseRotationX = THREE.MathUtils.lerp(rightIdleRotation[0], rightHookRotation[0], hookBlend.current)
      const baseRotationY = THREE.MathUtils.lerp(rightIdleRotation[1], rightHookRotation[1], hookBlend.current)
      const baseRotationZ = THREE.MathUtils.lerp(rightIdleRotation[2], rightHookRotation[2], hookBlend.current)
      rightHand.current.position.set(
        THREE.MathUtils.lerp(baseX, rightCastPosition[0], rightCast),
        THREE.MathUtils.lerp(baseY, rightCastPosition[1], rightCast),
        THREE.MathUtils.lerp(baseZ, rightCastPosition[2], rightCast) - castRecoil * .04,
      )
      rightHand.current.rotation.set(
        THREE.MathUtils.lerp(baseRotationX, rightCastRotation[0], rightCast),
        THREE.MathUtils.lerp(baseRotationY, rightCastRotation[1], rightCast),
        THREE.MathUtils.lerp(baseRotationZ, rightCastRotation[2], rightCast),
      )
    }
    const sigils: ReadonlyArray<readonly [THREE.Group | null, number]> = [
      [leftSigil.current, -1],
      [rightSigil.current, 1],
    ]
    for (const [sigil, direction] of sigils) {
      if (!sigil) continue
      sigil.rotation.z = clock.elapsedTime * direction * (reducedMotion ? .18 : .72) + castEnergy * direction * 1.4
    }
    if (spellLight.current) spellLight.current.intensity = spellUnlocked ? .35 + castEnergy * (reducedMotion ? .55 : 3.2) : .05

    const nextArticulation = {
      cast: Math.round(motionEnergy * 6) / 6,
      hook: Math.round(hookBlend.current * 6) / 6,
    }
    if (
      Math.abs(nextArticulation.cast - articulationRef.current.cast) > .08
      || Math.abs(nextArticulation.hook - articulationRef.current.hook) > .08
    ) {
      articulationRef.current = nextArticulation
      setArticulation(nextArticulation)
    }
  }, -.5)

  return (
    <group ref={root} frustumCulled={false}>
      <group ref={sway}>
        <mesh
          position={[0, 0, -.1]}
          renderOrder={999}
          frustumCulled={false}
          onBeforeRender={clearViewmodelDepth}
        >
          <planeGeometry args={[.001, .001]} />
          <meshBasicMaterial colorWrite={false} depthTest={false} depthWrite={false} />
        </mesh>
        <group ref={leftHand} position={[-.3, -.03, -.03]} rotation={[-.28, -.12, -.3]}>
          <RunnerHandModel
            side="left"
            skinColor="#c98d6f"
            gloveColor="#294b58"
            sleeveColor="#142d38"
            nailColor="#e9bea5"
            runePrime={selectedPrime}
            runeColor={power.color}
            runeUnlocked={spellUnlocked}
            fingerCurl={[.24, .2, .28, .38]}
            thumbCurl={.16}
            spread={.3}
            castStrength={articulation.cast}
            detail={quality === 'low' ? 'low' : 'high'}
            renderOrder={1000}
            sigilRef={leftSigil}
          />
          <group ref={spellMuzzleRef} name="prime-spell-muzzle" position={[0, .18, -.1]} />
        </group>
        <group ref={rightHand} position={[.31, -.04, -.05]} rotation={[-.24, .12, .32]}>
          <RunnerHandModel
            side="right"
            skinColor="#c98d6f"
            gloveColor="#294b58"
            sleeveColor="#142d38"
            nailColor="#e9bea5"
            runePrime={selectedPrime}
            runeColor={power.color}
            runeUnlocked={spellUnlocked}
            fingerCurl={[
              THREE.MathUtils.lerp(.24, .66, articulation.hook),
              THREE.MathUtils.lerp(.2, .94, articulation.hook),
              THREE.MathUtils.lerp(.28, .98, articulation.hook),
              THREE.MathUtils.lerp(.38, .9, articulation.hook),
            ]}
            thumbCurl={THREE.MathUtils.lerp(.16, .78, articulation.hook)}
            spread={THREE.MathUtils.lerp(.3, .04, articulation.hook)}
            castStrength={articulation.cast * (1 - articulation.hook)}
            detail={quality === 'low' ? 'low' : 'high'}
            renderOrder={1000}
            sigilRef={rightSigil}
          />
          <group name="grapple-bracer" position={[0, -.025, .075]}>
            <mesh renderOrder={1012} frustumCulled={false}>
              <boxGeometry args={[.15, .105, .045]} />
              <meshStandardMaterial color="#17343e" emissive="#08252a" emissiveIntensity={1.1} metalness={.76} roughness={.32} toneMapped={false} />
            </mesh>
            <mesh position={[0, .09, -.13]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1013} frustumCulled={false}>
              <cylinderGeometry args={[.032, .044, .17, 10]} />
              <meshStandardMaterial color={grappled ? '#d9ffff' : '#ffbd72'} emissive={grappled ? '#62e8ed' : '#8a3b12'} emissiveIntensity={grappled ? 5 : 2} metalness={.48} roughness={.22} toneMapped={false} />
            </mesh>
            <group ref={grappleMuzzleRef} name="grapple-muzzle" position={[0, .09, -.215]} />
          </group>
        </group>
        <pointLight position={[.28, .05, -.2]} color={grappled ? '#6becef' : '#ecb05e'} intensity={grappled ? .8 : .2} distance={1.2} />
        <pointLight ref={spellLight} position={[0, .16, -.3]} color={power.color} intensity={0} distance={2.2} decay={2} />
      </group>
    </group>
  )
}

function GrappleCable({
  anchor,
  muzzleRef,
}: {
  anchor: GrappleAnchor | null
  muzzleRef: React.RefObject<THREE.Group>
}): JSX.Element {
  const cableOrigin = useMemo(() => new THREE.Vector3(), [])
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    const material = new THREE.LineBasicMaterial({ color: '#a7ffff', transparent: true, opacity: .92 })
    const object = new THREE.Line(geometry, material)
    object.frustumCulled = false
    object.renderOrder = 25
    return object
  }, [])

  useEffect(() => () => {
    line.geometry.dispose()
    ;(line.material as THREE.Material).dispose()
  }, [line])

  useFrame(() => {
    line.visible = Boolean(anchor)
    if (!anchor) return
    const positions = line.geometry.getAttribute('position') as THREE.BufferAttribute
    if (muzzleRef.current) muzzleRef.current.getWorldPosition(cableOrigin)
    positions.setXYZ(0, cableOrigin.x, cableOrigin.y, cableOrigin.z)
    positions.setXYZ(1, anchor.position.x, anchor.position.y, anchor.position.z)
    positions.needsUpdate = true
  })

  return <primitive object={line} />
}

interface ShotTrace {
  readonly id: number
  readonly from: Vec3
  readonly to: Vec3
}

function EnemyTracer({ trace, reducedMotion }: { trace: ShotTrace | null; reducedMotion: boolean }): JSX.Element | null {
  const bornAt = useRef<number | null>(null)
  const group = useRef<THREE.Group>(null)
  const material = useRef<THREE.MeshBasicMaterial>(null)
  const muzzleLight = useRef<THREE.PointLight>(null)
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    const object = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#ff735d', transparent: true, opacity: .9 }))
    object.frustumCulled = false
    return object
  }, [])

  useEffect(() => {
    bornAt.current = null
    if (!trace) return
    const positions = line.geometry.getAttribute('position') as THREE.BufferAttribute
    positions.setXYZ(0, trace.from.x, trace.from.y + .35, trace.from.z)
    positions.setXYZ(1, trace.to.x, trace.to.y + EYE_OFFSET, trace.to.z)
    positions.needsUpdate = true
    ;(line.material as THREE.LineBasicMaterial).opacity = .9
    line.visible = true
    if (group.current) group.current.visible = true
  }, [line, trace])

  useEffect(() => () => {
    line.geometry.dispose()
    ;(line.material as THREE.Material).dispose()
  }, [line])

  useFrame(({ clock }) => {
    if (!trace) {
      line.visible = false
      return
    }
    if (bornAt.current === null) bornAt.current = clock.elapsedTime
    const age = clock.elapsedTime - bornAt.current
    const fade = Math.max(0, 1 - age / (reducedMotion ? .12 : .28))
    ;(line.material as THREE.LineBasicMaterial).opacity = fade * .9
    if (group.current) group.current.scale.setScalar(.65 + fade * .7)
    if (material.current) material.current.opacity = fade
    if (muzzleLight.current) muzzleLight.current.intensity = fade * 3.4
    if (fade === 0) {
      line.visible = false
      if (group.current) group.current.visible = false
    }
  })

  if (!trace) return null
  return (
    <>
      <primitive object={line} />
      <group ref={group} position={[trace.from.x, trace.from.y + .35, trace.from.z]}>
        <mesh>
          <sphereGeometry args={[.15, 8, 6]} />
          <meshBasicMaterial ref={material} color="#ff735d" transparent toneMapped={false} />
        </mesh>
        <pointLight ref={muzzleLight} color="#ff5c48" intensity={3.4} distance={4} />
      </group>
    </>
  )
}

type PrimeShotOutcome = 'pending' | 'hit' | 'resisted' | 'miss' | 'locked'

interface PrimeShotVisualState {
  readonly id: number
  readonly prime: PrimePowerValue
  readonly from: Vec3
  readonly to: Vec3
  readonly targetId: SkylineSentinelId | null
  readonly outcome: PrimeShotOutcome
}

function PrimeProjectile({
  shot,
  reducedMotion,
  quality,
  muzzleRef,
  onImpact,
  onComplete,
}: {
  shot: PrimeShotVisualState
  reducedMotion: boolean
  quality: QualityLevel
  muzzleRef: React.RefObject<THREE.Group>
  onImpact: (shot: PrimeShotVisualState) => void
  onComplete: (id: number) => void
}): JSX.Element {
  const { camera } = useThree()
  const projectile = useRef<THREE.Group>(null)
  const impact = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const impactLight = useRef<THREE.PointLight>(null)
  const impactCoreMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const impactOuterMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const bornAt = useRef<number | null>(null)
  const launched = useRef(false)
  const impacted = useRef(false)
  const completed = useRef(false)
  const lowDetail = quality === 'low'
  const power = PRIME_POWERS[shot.prime]
  const impactColor = shot.outcome === 'resisted' || shot.outcome === 'locked'
    ? '#ff715f'
    : power.color
  const from = useMemo(() => new THREE.Vector3(shot.from.x, shot.from.y, shot.from.z), [shot.from])
  const to = useMemo(() => new THREE.Vector3(shot.to.x, shot.to.y, shot.to.z), [shot.to])
  const current = useMemo(() => new THREE.Vector3(), [])
  const launchFrom = useMemo(() => from.clone(), [from])
  const direction = useMemo(() => to.clone().sub(from).normalize(), [from, to])
  const distance = from.distanceTo(to)
  const launchDistance = useRef(distance)
  const chargeDuration = reducedMotion ? 0 : .1
  const duration = reducedMotion ? .14 : THREE.MathUtils.clamp(.18 + distance / 105, .22, .54)
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    const material = new THREE.LineBasicMaterial({
      color: power.color,
      transparent: true,
      opacity: .82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const object = new THREE.Line(geometry, material)
    object.frustumCulled = false
    object.renderOrder = 28
    return object
  }, [power.color])

  useEffect(() => () => {
    line.geometry.dispose()
    ;(line.material as THREE.Material).dispose()
  }, [line])

  useFrame(({ clock }, delta) => {
    if (bornAt.current === null) bornAt.current = clock.elapsedTime
    const age = clock.elapsedTime - bornAt.current
    const charging = age < chargeDuration
    if (charging) {
      if (muzzleRef.current) muzzleRef.current.getWorldPosition(launchFrom)
    } else if (!launched.current) {
      if (muzzleRef.current) muzzleRef.current.getWorldPosition(launchFrom)
      direction.copy(to).sub(launchFrom).normalize()
      launchDistance.current = launchFrom.distanceTo(to)
      launched.current = true
    }
    const progress = charging
      ? 0
      : THREE.MathUtils.clamp((age - chargeDuration) / duration, 0, 1)
    const travel = 1 - Math.pow(1 - progress, 3)
    current.lerpVectors(launchFrom, to, travel)
    if (!reducedMotion && shot.prime !== 2) current.y += Math.sin(progress * Math.PI) * (shot.prime === 5 ? .42 : .2)

    if (projectile.current) {
      projectile.current.position.copy(current)
      if (!reducedMotion) {
        projectile.current.rotation.x += delta * (shot.prime + 2)
        projectile.current.rotation.z -= delta * (shot.prime + 1)
      }
      projectile.current.visible = progress < .9
      const chargeScale = charging ? .38 + age / Math.max(.001, chargeDuration) * .62 : 1
      const pulse = reducedMotion ? 1 : 1 + Math.sin(clock.elapsedTime * 34) * .12
      projectile.current.scale.setScalar(chargeScale * pulse * (shot.prime === 5 ? 1.22 : 1))
    }
    const positions = line.geometry.getAttribute('position') as THREE.BufferAttribute
    const trailLength = shot.prime === 2 ? 2.4 : shot.prime === 3 ? 1.75 : 1.35
    positions.setXYZ(0, current.x, current.y, current.z)
    positions.setXYZ(
      1,
      current.x - direction.x * Math.min(trailLength, launchDistance.current * travel),
      current.y - direction.y * Math.min(trailLength, launchDistance.current * travel),
      current.z - direction.z * Math.min(trailLength, launchDistance.current * travel),
    )
    positions.needsUpdate = true
    ;(line.material as THREE.LineBasicMaterial).opacity = Math.max(0, .9 - progress * .42)

    if (impact.current) {
      impact.current.visible = progress >= .82
      impact.current.position.copy(to)
      impact.current.quaternion.copy(camera.quaternion)
      const impactProgress = THREE.MathUtils.clamp((progress - .82) / .18, 0, 1)
      impact.current.scale.setScalar(.3 + impactProgress * (shot.outcome === 'hit' ? 2.5 : 1.7))
      if (!reducedMotion) impact.current.rotateZ(impactProgress * 1.15)
      if (impactCoreMaterial.current) impactCoreMaterial.current.opacity = (1 - impactProgress) * .92
      if (impactOuterMaterial.current) impactOuterMaterial.current.opacity = (1 - impactProgress) * .58
      if (impactLight.current) impactLight.current.intensity = (1 - impactProgress) * (shot.outcome === 'hit' ? 8 : 4.5)
    }
    if (light.current) light.current.intensity = progress < .9 ? (charging ? 2.2 : 4.5) : 0

    if (progress >= .82 && !impacted.current) {
      impacted.current = true
      onImpact(shot)
    }

    if (progress >= 1 && !completed.current) {
      completed.current = true
      onComplete(shot.id)
    }
  })

  return (
    <>
      <primitive object={line} />
      <group ref={projectile} position={[shot.from.x, shot.from.y, shot.from.z]}>
        <mesh renderOrder={27}>
          {shot.prime === 2
            ? <octahedronGeometry args={[.14, 0]} />
            : shot.prime === 3
              ? <tetrahedronGeometry args={[.18, 0]} />
              : <dodecahedronGeometry args={[.19, 0]} />}
          <meshBasicMaterial color="#efffff" toneMapped={false} />
        </mesh>
        {!lowDetail && Array.from({ length: shot.prime }, (_, index) => {
          const angle = index / shot.prime * Math.PI * 2
          return (
            <mesh key={index} position={[Math.cos(angle) * .25, Math.sin(angle) * .25, 0]} renderOrder={26}>
              <sphereGeometry args={[shot.prime === 5 ? .035 : .045, 6, 4]} />
              <meshBasicMaterial color={power.color} transparent opacity={.88} toneMapped={false} />
            </mesh>
          )
        })}
        {!lowDetail && <pointLight ref={light} color={power.color} intensity={4.5} distance={5.5} decay={2} />}
      </group>
      <group ref={impact} visible={false} position={[shot.to.x, shot.to.y, shot.to.z]}>
        <mesh renderOrder={29}>
          <ringGeometry args={[.22, .28, shot.prime === 2 ? 4 : shot.prime]} />
          <meshBasicMaterial ref={impactCoreMaterial} color={impactColor} transparent opacity={.92} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh renderOrder={28} rotation={[0, 0, Math.PI / 4]}>
          <ringGeometry args={[.32, .345, 24]} />
          <meshBasicMaterial ref={impactOuterMaterial} color={impactColor} transparent opacity={.58} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
        {!lowDetail && <pointLight ref={impactLight} color={impactColor} intensity={0} distance={6} decay={2} />}
      </group>
    </>
  )
}

function SkylineRunnerScene({ paused, quality, profile, reducedMotion, input, look, audio, selectedPrime }: SceneProps): JSX.Element {
  const { camera } = useThree()
  const perspectiveCamera = camera as THREE.PerspectiveCamera
  const mission = useSkylineRunnerStore((state) => state.mission)
  const enemyHealth = useSkylineRunnerStore((state) => state.enemyHealth)
  const enemyFactors = useSkylineRunnerStore((state) => state.enemyFactors)
  const nearby = useSkylineRunnerStore((state) => state.nearby)
  const activeDialogue = useSkylineRunnerStore((state) => state.activeDialogue)
  const [activeAnchor, setActiveAnchor] = useState<GrappleAnchor | null>(null)
  const [aimedAnchorId, setAimedAnchorId] = useState<string | null>(null)
  const [shotTrace, setShotTrace] = useState<ShotTrace | null>(null)
  const [primeShots, setPrimeShots] = useState<readonly PrimeShotVisualState[]>([])
  const [castSerial, setCastSerial] = useState(0)
  const grappleMuzzleRef = useRef<THREE.Group>(null)
  const spellMuzzleRef = useRef<THREE.Group>(null)
  const motion = useRef<PlayerMotion>({
    position: { ...PLAYER_SPAWN },
    velocity: { x: 0, y: 0, z: 0 },
    grounded: true,
    lastGroundedAtMs: 0,
  })
  const jumpConsumed = useRef(false)
  const ropeLength = useRef(0)
  const activeAnchorRef = useRef<GrappleAnchor | null>(null)
  const activeCheckpoint = useRef(SKYLINE_CHECKPOINTS[0])
  const wallRoll = useRef(0)
  const lastTelemetryAt = useRef(0)
  const simulationTimeMs = useRef(0)
  const primeShotId = useRef(0)
  const lastCastAtMs = useRef<Record<PrimePowerValue, number>>({
    2: Number.NEGATIVE_INFINITY,
    3: Number.NEGATIVE_INFINITY,
    5: Number.NEGATIVE_INFINITY,
  })
  const enemyFireAt = useRef<Record<SkylineSentinelId, number>>({
    'sentinel-four': 0,
    'sentinel-six': .45,
    'sentinel-nine': .9,
    'sentinel-ten': 1.35,
  })
  const stamina = useRef(100)
  /** Momentum meter in 0..1; the HUD shows it as a percentage. */
  const flow = useRef(0)
  const flowTrick = useRef(0)
  const slideState = useRef<SlideState>(IDLE_SLIDE)
  const mantle = useRef<{ readonly from: Vec3; readonly to: Vec3; readonly untilMs: number } | null>(null)
  const grappleStyleAwarded = useRef(false)
  const collectedCores = useMemo(() => new Set(mission.collectedPrimeCores), [mission.collectedPrimeCores])
  const defeatedSentinels = useMemo(() => new Set(mission.defeatedSentinelIds), [mission.defeatedSentinelIds])
  const objective = getNextSkylineObjective(mission)
  const objectiveNpc = objective.id === 'talk-to-lia'
    ? 'lia'
    : objective.id === 'deliver-cores-to-nilo'
      ? 'nilo'
      : null
  const highlightedCore = objective.id === 'collect-prime-cores'
    ? SKYLINE_PRIME_CORE_VALUES.find((value) => !collectedCores.has(value)) ?? null
    : null
  const removePrimeShot = useCallback((id: number) => {
    setPrimeShots((shots) => shots.filter((shot) => shot.id !== id))
  }, [])
  const resolvePrimeShotImpact = useCallback((shot: PrimeShotVisualState) => {
    if (!shot.targetId) return
    const state = useSkylineRunnerStore.getState()
    if (state.defeated || state.result) return
    const hit = state.castPrimeAtEnemy(shot.targetId, shot.prime)
    const outcome: PrimeShotOutcome = hit === 'hit' || hit === 'defeated'
      ? 'hit'
      : hit === 'resisted'
        ? 'resisted'
        : hit === 'locked'
          ? 'locked'
          : 'miss'
    if (hit === 'hit' || hit === 'defeated') {
      audio.play('hit', hit === 'defeated' ? 1.45 : 1 + shot.prime * .04)
    }
    setPrimeShots((shots) => shots.map((candidate) => (
      candidate.id === shot.id ? { ...candidate, outcome } : candidate
    )))
  }, [audio])

  useEffect(() => {
    if (!paused && !activeDialogue) return
    activeAnchorRef.current = null
    setActiveAnchor(null)
    grappleStyleAwarded.current = false
    input.current.grappleSources.clear()
    setPrimeShots([])
  }, [activeDialogue, input, paused])

  useEffect(() => {
    camera.position.set(PLAYER_SPAWN.x, PLAYER_SPAWN.y + EYE_OFFSET, PLAYER_SPAWN.z)
    camera.rotation.order = 'YXZ'
    perspectiveCamera.fov = 75
    perspectiveCamera.updateProjectionMatrix()
  }, [camera, perspectiveCamera])

  useFrame(({ clock }, rawDelta) => {
    const state = useSkylineRunnerStore.getState()
    const frozen = paused || Boolean(state.activeDialogue) || Boolean(state.result) || state.defeated
    const dt = Math.min(.04, Math.max(0, rawDelta))

    camera.rotation.order = 'YXZ'
    camera.rotation.x = look.current.pitch
    camera.rotation.y = look.current.yaw

    if (frozen || dt === 0) {
      camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, 0, .15)
      input.current.attackQueued = false
      input.current.jumpQueued = false
      return
    }

    simulationTimeMs.current += dt * 1_000
    const nowMs = simulationTimeMs.current
    let current = cloneMotion(motion.current)
    const previousPosition = { ...current.position }
    const move = horizontalDirection(input.current, look.current.yaw)
    const currentSpeed = Math.hypot(current.velocity.x, current.velocity.z)
    const wantsSlide = input.current.slideHeld
      || input.current.keys.has('ControlLeft')
      || input.current.keys.has('KeyC')
    const slide = updateSlide({
      state: slideState.current,
      wantsSlide,
      grounded: current.grounded,
      horizontalSpeed: currentSpeed,
      nowMs,
    })
    slideState.current = slide.state
    if (slide.started && currentSpeed > 0) {
      // The boost goes along the current heading, so sliding keeps a line, not turns it.
      const scale = (currentSpeed + slide.boost) / currentSpeed
      current = {
        ...current,
        velocity: { ...current.velocity, x: current.velocity.x * scale, z: current.velocity.z * scale },
      }
      audio.play('jump', .7)
      useSkylineRunnerStore.getState().addStylePoints(35)
    }
    const sliding = slide.state.active
    const wantsSprint = (input.current.keys.has('ShiftLeft') || input.current.sprintHeld)
      && move.length > .1 && stamina.current > 1
    const targetSpeed = sliding ? 15.5 : wantsSprint ? 13.4 : 8.4
    // A slide keeps its line: steering and braking barely bite until it ends.
    const accelerationRate = sliding ? 1.4 : current.grounded ? (move.length > .1 ? 11 : 15) : 3.6
    let acceleration: Vec3 = {
      x: (move.x * targetSpeed - current.velocity.x) * accelerationRate,
      y: -25,
      z: (move.z * targetSpeed - current.velocity.z) * accelerationRate,
    }

    const wall = !current.grounded && move.length > .2 && stamina.current > 0
      ? detectWallRunSurface({
          position: current.position,
          velocity: current.velocity,
          playerRadius: PLAYER_RADIUS,
          playerHalfHeight: PLAYER_HALF_HEIGHT,
          platforms: SKYLINE_BUILDINGS,
          maxDistance: .6,
          minAlongWallSpeed: 4.2,
        })
      : null
    const wallRunning = Boolean(wall && current.velocity.y < 3.5)

    if (wallRunning && wall) {
      acceleration = {
        x: (wall.tangent.x * Math.max(9, wall.alongWallSpeed) - current.velocity.x) * 5 - wall.normal.x * 4,
        y: current.velocity.y < -1.15 ? 20 : -3.2,
        z: (wall.tangent.z * Math.max(9, wall.alongWallSpeed) - current.velocity.z) * 5 - wall.normal.z * 4,
      }
      stamina.current = Math.max(0, stamina.current - dt * 17)
      wallRoll.current = THREE.MathUtils.lerp(wallRoll.current, wall.normal.x * .105 - wall.normal.z * .04, .15)
    } else {
      wallRoll.current = THREE.MathUtils.lerp(wallRoll.current, 0, .11)
    }

    const jumpAllowed = canJumpWithCoyoteTime({
      grounded: current.grounded,
      jumpConsumed: jumpConsumed.current,
      nowMs,
      lastGroundedAtMs: current.lastGroundedAtMs,
      coyoteWindowMs: COYOTE_WINDOW_MS,
    })
    if (input.current.jumpQueued) {
      if (wallRunning && wall) {
        current = {
          ...current,
          velocity: calculateWallJump({
            velocity: current.velocity,
            wallNormal: wall.normal,
            facing: { x: move.x, y: 0, z: move.z },
            flow: flow.current * 100,
          }),
          grounded: false,
        }
        flowTrick.current += .16
        jumpConsumed.current = true
        audio.play('jump', 1.2)
        useSkylineRunnerStore.getState().addStylePoints(90)
      } else if (jumpAllowed) {
        current = { ...current, velocity: { ...current.velocity, y: 9.3 }, grounded: false }
        jumpConsumed.current = true
        audio.play('jump')
      }
      input.current.jumpQueued = false
    }

    camera.getWorldDirection(TEMP_VECTOR)
    const viewDirection = { x: TEMP_VECTOR.x, y: TEMP_VECTOR.y, z: TEMP_VECTOR.z }
    const grappleOrigin = { ...current.position, y: current.position.y + EYE_OFFSET }
    const surfaceCandidate = selectGrappleSurface({
      origin: grappleOrigin,
      viewDirection,
      surfaces: SKYLINE_COLLIDERS,
      obstacles: SKYLINE_COLLIDERS,
      maxRange: GRAPPLE_RANGE,
      obstaclePadding: .02,
      surfaceOffset: GRAPPLE_SURFACE_OFFSET,
    })
    const guideCandidate = selectGrappleAnchor({
      origin: grappleOrigin,
      viewDirection,
      anchors: SKYLINE_ANCHORS,
      obstacles: GRAPPLE_OBSTACLES,
      maxRange: GRAPPLE_RANGE,
      minimumAlignment: .54,
      alignmentWeight: .84,
      lineOfSightPadding: .03,
    })
    const grappleCandidate = surfaceCandidate ?? guideCandidate
    const grappleHeld = input.current.grappleSources.size > 0

    let attached = activeAnchorRef.current
    if (grappleHeld && !attached && grappleCandidate && stamina.current > 3) {
      attached = {
        ...grappleCandidate.anchor,
        position: { ...grappleCandidate.anchor.position },
      }
      activeAnchorRef.current = attached
      setActiveAnchor(attached)
      ropeLength.current = Math.max(3.8, grappleCandidate.distance * .62)
      grappleStyleAwarded.current = false
      audio.play('hook', Math.min(1.4, grappleCandidate.distance / 16))
    } else if (!grappleHeld && attached) {
      attached = null
      activeAnchorRef.current = null
      setActiveAnchor(null)
      grappleStyleAwarded.current = false
    }

    if (attached && grappleHeld && stamina.current > 0) {
      const cableClear = hasLineOfSight(grappleOrigin, attached.position, GRAPPLE_OBSTACLES, .02)
      if (!cableClear) {
        attached = null
        activeAnchorRef.current = null
        setActiveAnchor(null)
        grappleStyleAwarded.current = false
      } else {
        ropeLength.current = Math.max(3.5, ropeLength.current - dt * 2.4)
        const pull = calculateGrapplePull({
          playerPosition: current.position,
          playerVelocity: current.velocity,
          anchorPosition: attached.position,
          ropeLength: ropeLength.current,
          stiffness: 9.2,
          damping: 1.2,
          maxAcceleration: 42,
        })
        acceleration = {
          x: acceleration.x * .38 + pull.acceleration.x,
          y: acceleration.y * .3 + pull.acceleration.y + 2.2,
          z: acceleration.z * .38 + pull.acceleration.z,
        }
        stamina.current = Math.max(0, stamina.current - dt * 14)
        if (pull.taut && !grappleStyleAwarded.current) {
          grappleStyleAwarded.current = true
          useSkylineRunnerStore.getState().addStylePoints(120)
        }
        if (stamina.current <= 0) {
          attached = null
          activeAnchorRef.current = null
          setActiveAnchor(null)
        }
      }
    }

    if (wantsSprint) stamina.current = Math.max(0, stamina.current - dt * 11)
    else if (!wallRunning && !attached) stamina.current = Math.min(100, stamina.current + dt * (current.grounded ? 25 : 12))

    let next = integratePlayerMotion({
      motion: current,
      acceleration,
      deltaSeconds: dt,
      maxHorizontalSpeed: (attached ? 23 : sliding ? 17 : wantsSprint || wallRunning ? 14.5 : 10.5)
        * flowSpeedMultiplier(flow.current),
      maxFallSpeed: 31,
    })

    const collision = resolveHorizontalCollision(
      current.position,
      next.position,
      next.velocity,
      input.current.jumpHeld || input.current.keys.has('Space'),
    )
    next = { ...next, position: collision.position, velocity: collision.velocity }
    if (collision.vaulted) {
      next = { ...next, grounded: false }
      flowTrick.current += .12
      useSkylineRunnerStore.getState().addStylePoints(45)
    }

    // A grounded sweep starts on the roof at t=0 and would restore the old X/Z,
    // cancelling every horizontal step. Sweeps are only needed while airborne;
    // findGroundTop below keeps an already grounded runner supported.
    const landing = !current.grounded && next.velocity.y <= 0
      ? findSweptLanding({
          previousPosition: current.position,
          nextPosition: next.position,
          playerRadius: PLAYER_RADIUS,
          playerHalfHeight: PLAYER_HALF_HEIGHT,
          platforms: SKYLINE_COLLIDERS,
        })
      : null
    if (landing) {
      if (!current.grounded && current.velocity.y < -2.5) audio.play('land', Math.min(1.5, Math.abs(current.velocity.y) / 11))
      next = {
        ...next,
        position: landing.position,
        velocity: { ...next.velocity, y: 0 },
        grounded: true,
        lastGroundedAtMs: nowMs,
      }
      jumpConsumed.current = false
    } else {
      const groundTop = findGroundTop(next.position)
      if (groundTop !== null && next.velocity.y <= .1) {
        next = {
          ...next,
          position: { ...next.position, y: groundTop + PLAYER_HALF_HEIGHT },
          velocity: { ...next.velocity, y: 0 },
          grounded: true,
          lastGroundedAtMs: nowMs,
        }
        jumpConsumed.current = false
      } else {
        next = {
          ...next,
          grounded: false,
          lastGroundedAtMs: current.grounded ? nowMs : current.lastGroundedAtMs,
        }
      }
    }

    if (shouldRespawn(next.position, SKYLINE_WORLD_BOUNDS.killPlaneY)) {
      const defeated = useSkylineRunnerStore.getState().recordFall()
      audio.play('damage', 1.3)
      if (!defeated) {
        next = respawnAtCheckpoint({ checkpoint: activeCheckpoint.current, fallbackPosition: PLAYER_SPAWN }).motion
        look.current.pitch = 0
      }
      attached = null
      activeAnchorRef.current = null
      setActiveAnchor(null)
    }

    const reachedCheckpoint = selectReachedCheckpoint({
      position: next.position,
      previousPosition,
      checkpoints: SKYLINE_CHECKPOINTS,
      currentOrder: activeCheckpoint.current.order,
      triggerPadding: PLAYER_RADIUS,
    })
    if (reachedCheckpoint) {
      activeCheckpoint.current = reachedCheckpoint
      useSkylineRunnerStore.getState().reachCheckpoint(reachedCheckpoint.id, reachedCheckpoint.order)
      audio.play('checkpoint')
    }

    const liveState = useSkylineRunnerStore.getState()
    if (!liveState.activeDialogue) {
      let near: 'npc:lia' | 'npc:nilo' | 'beacon' | null = null
      if (tupleDistance(next.position, SKYLINE_NPCS.lia.position) <= SKYLINE_WORLD_BOUNDS.npcInteractionRadius) near = 'npc:lia'
      else if (tupleDistance(next.position, SKYLINE_NPCS.nilo.position) <= SKYLINE_WORLD_BOUNDS.npcInteractionRadius) near = 'npc:nilo'
      else if (tupleDistance(next.position, SKYLINE_LOCATIONS.apexBeacon) <= 2.8) near = 'beacon'
      liveState.setNearby(near)
    }

    if (liveState.mission.spokenNpcIds.includes('lia') && !liveState.mission.coresDeliveredToNilo) {
      for (const value of SKYLINE_PRIME_CORE_VALUES) {
        if (!liveState.mission.collectedPrimeCores.includes(value)
          && tupleDistance(next.position, SKYLINE_PRIME_CORES[value].position) <= SKYLINE_WORLD_BOUNDS.coreCollectionRadius) {
          if (liveState.collectCore(value)) audio.play('collect')
          break
        }
      }
    }

    if (!liveState.mission.apexReached && tupleDistance(next.position, SKYLINE_LOCATIONS.apexSpire) < 4.2) {
      liveState.reachApex()
    }

    const playerEye = { ...next.position, y: next.position.y + EYE_OFFSET }
    const primeTargets = SKYLINE_SENTINEL_IDS.map((id) => {
      const definition = SKYLINE_SENTINELS[id]
      return {
        id,
        compositeNumber: definition.compositeNumber,
        position: {
          x: definition.position[0],
          y: definition.position[1] + .24,
          z: definition.position[2],
        },
        health: liveState.enemyHealth[id],
        enabled: !liveState.mission.defeatedSentinelIds.includes(id),
      }
    })
    const targetSelection = selectPrimeTarget({
      power: selectedPrime,
      origin: playerEye,
      viewDirection,
      targets: primeTargets,
      minimumAlignment: PRIME_AIM_ALIGNMENT,
      hasLineOfSight: (origin, target) => hasLineOfSight(origin, target.position, GRAPPLE_OBSTACLES, .025),
    })
    const enemyTarget: SkylineSentinelId | null = targetSelection?.target.id ?? null

    if (input.current.attackQueued) {
      const power = PRIME_POWERS[selectedPrime]
      const ready = nowMs - lastCastAtMs.current[selectedPrime] >= power.cadenceMs
      if (!liveState.mission.coresDeliveredToNilo && enemyTarget) {
        liveState.castPrimeAtEnemy(enemyTarget, selectedPrime)
      } else if (ready && liveState.mission.coresDeliveredToNilo) {
        lastCastAtMs.current[selectedPrime] = nowMs
        setCastSerial((serial) => serial + 1)
        audio.play('pulse', selectedPrime === 5 ? 1.35 : selectedPrime === 3 ? 1.08 : .88)

        const originVector = spellMuzzleRef.current
          ? spellMuzzleRef.current.getWorldPosition(new THREE.Vector3())
          : new THREE.Vector3(0, -.12, -.72)
              .applyQuaternion(camera.quaternion)
              .add(new THREE.Vector3(playerEye.x, playerEye.y, playerEye.z))
        const destination = targetSelection
          ? targetSelection.target.position
          : surfaceCandidate && surfaceCandidate.distance <= power.range
            ? surfaceCandidate.contactPoint
            : {
                x: playerEye.x + viewDirection.x * power.range,
                y: playerEye.y + viewDirection.y * power.range,
                z: playerEye.z + viewDirection.z * power.range,
              }
        const shot: PrimeShotVisualState = {
          id: ++primeShotId.current,
          prime: selectedPrime,
          from: { x: originVector.x, y: originVector.y, z: originVector.z },
          to: { ...destination },
          targetId: enemyTarget,
          outcome: enemyTarget ? 'pending' : 'miss',
        }
        setPrimeShots((shots) => [...shots.slice(-5), shot])
      }
      input.current.attackQueued = false
    }

    const combatState = useSkylineRunnerStore.getState()
    if (combatState.mission.coresDeliveredToNilo) {
      for (const id of SKYLINE_SENTINEL_IDS) {
        if (useSkylineRunnerStore.getState().defeated) break
        if (combatState.mission.defeatedSentinelIds.includes(id)) continue
        const definition = SKYLINE_SENTINELS[id]
        const enemyPosition: Vec3 = { x: definition.position[0], y: definition.position[1], z: definition.position[2] }
        const distance = vectorDistance(next.position, enemyPosition)
        const playerEye = { ...next.position, y: next.position.y + EYE_OFFSET }
        if (distance < 11.5
          && hasLineOfSight(enemyPosition, playerEye, GRAPPLE_OBSTACLES, .025)
          && clock.elapsedTime >= enemyFireAt.current[id]) {
          enemyFireAt.current[id] = clock.elapsedTime + 1.45 + definition.compositeNumber * .035
          combatState.takeDamage(distance < 5 ? 9 : 6)
          audio.play('damage', distance < 5 ? 1.1 : .72)
          setShotTrace({ id: Math.round(clock.elapsedTime * 1_000), from: enemyPosition, to: { ...next.position } })
          const pushX = next.position.x - enemyPosition.x
          const pushZ = next.position.z - enemyPosition.z
          const pushLength = Math.max(.01, Math.hypot(pushX, pushZ))
          next = {
            ...next,
            velocity: {
              x: next.velocity.x + pushX / pushLength * 1.25,
              y: Math.max(1, next.velocity.y),
              z: next.velocity.z + pushZ / pushLength * 1.25,
            },
          }
        }
      }
    }

    for (const id of SKYLINE_SENTINEL_IDS) {
      if (combatState.mission.defeatedSentinelIds.includes(id)) continue
      const enemy = SKYLINE_SENTINELS[id].position
      if (Math.abs(next.position.y - enemy[1]) > 1.8) continue
      const offsetX = next.position.x - enemy[0]
      const offsetZ = next.position.z - enemy[2]
      const distance = Math.hypot(offsetX, offsetZ)
      if (distance >= .86) continue
      const normalX = distance > .001 ? offsetX / distance : 1
      const normalZ = distance > .001 ? offsetZ / distance : 0
      const previousBeforePush = { ...next.position }
      const pushed = {
        ...next,
        position: {
          ...next.position,
          x: next.position.x + normalX * (.86 - distance),
          z: next.position.z + normalZ * (.86 - distance),
        },
        velocity: {
          ...next.velocity,
          x: next.velocity.x * .35,
          z: next.velocity.z * .35,
        },
      }
      const resolvedPush = resolveHorizontalCollision(
        previousBeforePush,
        pushed.position,
        pushed.velocity,
        false,
      )
      next = { ...pushed, position: resolvedPush.position, velocity: resolvedPush.velocity }
    }

    // Ledge grab: pull up onto an edge between waist and head height.
    if (!mantle.current && !next.grounded && next.velocity.y <= 0 && move.length > .2) {
      const ledge = detectMantleLedge({
        position: next.position,
        velocity: next.velocity,
        facing: { x: move.x, y: 0, z: move.z },
        playerRadius: PLAYER_RADIUS,
        playerHalfHeight: PLAYER_HALF_HEIGHT,
        platforms: SKYLINE_COLLIDERS.map((platform) => platform.bounds),
      })
      if (ledge) {
        mantle.current = { from: { ...next.position }, to: ledge.target, untilMs: nowMs + MANTLE_DURATION_MS }
        flowTrick.current += .14
        audio.play('jump', .9)
        useSkylineRunnerStore.getState().addStylePoints(70)
      }
    }
    if (mantle.current) {
      const climb = mantle.current
      const progress = THREE.MathUtils.clamp(1 - (climb.untilMs - nowMs) / MANTLE_DURATION_MS, 0, 1)
      const eased = progress * progress * (3 - 2 * progress)
      next = {
        ...next,
        position: {
          x: THREE.MathUtils.lerp(climb.from.x, climb.to.x, eased),
          y: THREE.MathUtils.lerp(climb.from.y, climb.to.y, eased),
          z: THREE.MathUtils.lerp(climb.from.z, climb.to.z, eased),
        },
        velocity: { x: 0, y: 0, z: 0 },
        grounded: progress >= 1,
      }
      if (progress >= 1) mantle.current = null
    }

    motion.current = next
    const nextHorizontalSpeed = Math.hypot(next.velocity.x, next.velocity.z)
    const bob = !reducedMotion && next.grounded && nextHorizontalSpeed > 1
      ? Math.sin(clock.elapsedTime * (wantsSprint ? 13 : 9)) * .035 * Math.min(1, nextHorizontalSpeed / 8)
      : 0
    const eyeHeight = THREE.MathUtils.lerp(
      camera.position.y - next.position.y,
      EYE_OFFSET * slide.cameraHeightScale + bob,
      reducedMotion ? 1 : .28,
    )
    camera.position.set(next.position.x, next.position.y + eyeHeight, next.position.z)
    camera.rotation.z = reducedMotion ? 0 : wallRoll.current
    const targetFov = reducedMotion
      ? 75
      : flowFieldOfView(75, flow.current) + Math.min(7, Math.max(0, nextHorizontalSpeed - 7) * .75)
    const nextFov = THREE.MathUtils.lerp(perspectiveCamera.fov, targetFov, .08)
    if (Math.abs(nextFov - perspectiveCamera.fov) > .005) {
      perspectiveCamera.fov = nextFov
      perspectiveCamera.updateProjectionMatrix()
    }

    flow.current = updateFlow({
      flow: flow.current,
      deltaSeconds: dt,
      grounded: next.grounded,
      horizontalSpeed: nextHorizontalSpeed,
      wallRunning,
      grappling: Boolean(attached),
      sliding,
      trickBonus: flowTrick.current,
    })
    flowTrick.current = 0

    if (clock.elapsedTime - lastTelemetryAt.current > .09) {
      lastTelemetryAt.current = clock.elapsedTime
      let movement: RunnerMovementState = 'PARADO'
      if (mantle.current) movement = 'ESCALADA'
      else if (attached) movement = 'GRAPPLE'
      else if (sliding) movement = 'SLIDE'
      else if (wallRunning) movement = 'WALL RUN'
      else if (!next.grounded && next.velocity.y < -1.5) movement = 'QUEDA'
      else if (!next.grounded) movement = 'SALTO'
      else if (wantsSprint && nextHorizontalSpeed > 5) movement = 'SPRINT'
      else if (nextHorizontalSpeed > .7) movement = 'CORRIDA'
      const shownAnchor = attached ?? grappleCandidate?.anchor ?? null
      useSkylineRunnerStore.getState().updateTelemetry({
        elapsedMs: simulationTimeMs.current,
        speed: nextHorizontalSpeed,
        stamina: stamina.current,
        flow: flow.current,
        movement,
        grappleTarget: shownAnchor?.id ?? null,
        grappleDistance: shownAnchor ? vectorDistance(next.position, shownAnchor.position) : null,
        grappleAttached: Boolean(attached),
        enemyTarget,
        spellCooldown: THREE.MathUtils.clamp(
          (lastCastAtMs.current[selectedPrime] + PRIME_POWERS[selectedPrime].cadenceMs - nowMs)
            / PRIME_POWERS[selectedPrime].cadenceMs,
          0,
          1,
        ),
        sector: sectorAt(next.position),
      })
      const nextAimedId = grappleCandidate?.anchor.id ?? null
      if (nextAimedId !== aimedAnchorId) setAimedAnchorId(nextAimedId)
    }
  }, -1)

  return (
    <>
      <SkylineWorld
        profile={profile}
        quality={quality}
        reducedMotion={reducedMotion}
        collectedCores={collectedCores}
        defeatedSentinels={defeatedSentinels}
        activeEnemyHealth={enemyHealth}
        remainingEnemyFactors={enemyFactors}
        activeAnchorId={activeAnchor?.id ?? aimedAnchorId}
        activeNpcId={objectiveNpc ?? (nearby?.startsWith('npc:') ? nearby.slice(4) as 'lia' | 'nilo' : null)}
        highlightedCore={highlightedCore}
        beaconActive={mission.apexReached}
      />
      <EnemyTracer trace={shotTrace} reducedMotion={reducedMotion} />
      {primeShots.map((shot) => (
        <PrimeProjectile
          key={shot.id}
          shot={shot}
          reducedMotion={reducedMotion}
          quality={quality}
          muzzleRef={spellMuzzleRef}
          onImpact={resolvePrimeShotImpact}
          onComplete={removePrimeShot}
        />
      ))}
      <GrappleCable anchor={activeAnchor} muzzleRef={grappleMuzzleRef} />
      <RunnerHands
        grappled={Boolean(activeAnchor)}
        reducedMotion={reducedMotion}
        quality={quality}
        selectedPrime={selectedPrime}
        castSerial={castSerial}
        spellUnlocked={mission.coresDeliveredToNilo}
        grappleMuzzleRef={grappleMuzzleRef}
        spellMuzzleRef={spellMuzzleRef}
      />
    </>
  )
}

export default function SkylineRunnerExperience({
  paused,
  profile,
  quality,
  onQualityChange,
  onPauseChange,
  onVictory,
  onDefeat,
}: SkylineRunnerExperienceProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const input = useRef<RunnerInput>({
    keys: new Set(),
    grappleSources: new Set(),
    touchX: 0,
    touchZ: 0,
    jumpQueued: false,
    jumpHeld: false,
    slideHeld: false,
    attackQueued: false,
    sprintHeld: false,
  })
  const look = useRef<LookState>({ yaw: 0, pitch: 0 })
  const result = useSkylineRunnerStore((state) => state.result)
  const defeated = useSkylineRunnerStore((state) => state.defeated)
  const activeDialogueForLock = useSkylineRunnerStore((state) => state.activeDialogue)
  const completedCallback = useRef(false)
  const endingTimer = useRef<number | null>(null)
  const [sceneKey, setSceneKey] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [selectedPrime, setSelectedPrime] = useState<SkylinePrimeCoreValue>(2)
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const audioRef = useRef<SkylineAudioController | null>(null)
  if (!audioRef.current) audioRef.current = createSkylineAudio({ volume: .46, reducedMotion })
  const audio = audioRef.current
  const audioDisposal = useMemo<{ timer: number | null }>(() => ({ timer: null }), [])

  const unlockAudio = useCallback(() => {
    void audio.unlock().then((unlocked) => {
      if (unlocked) audio.startWind()
    })
  }, [audio])

  const clearInputs = useCallback(() => {
    input.current.keys.clear()
    input.current.touchX = 0
    input.current.touchZ = 0
    input.current.jumpHeld = false
    input.current.slideHeld = false
    input.current.jumpQueued = false
    input.current.attackQueued = false
    input.current.grappleSources.clear()
    input.current.sprintHeld = false
  }, [])

  const captureControls = useCallback(() => {
    unlockAudio()
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    const canvas = containerRef.current?.querySelector('canvas')
    if (!canvas) return
    if (document.pointerLockElement === canvas) return
    if (typeof canvas.requestPointerLock !== 'function') {
      useSkylineRunnerStore.getState().setControlsCaptured(true)
      return
    }
    const result = canvas.requestPointerLock()
    if (result && typeof result.catch === 'function') {
      result.catch(() => useSkylineRunnerStore.getState().setControlsCaptured(false))
    }
  }, [unlockAudio])

  const restart = useCallback(() => {
    if (endingTimer.current !== null) {
      window.clearTimeout(endingTimer.current)
      endingTimer.current = null
    }
    if (document.pointerLockElement) document.exitPointerLock()
    clearInputs()
    look.current = { yaw: 0, pitch: 0 }
    setSelectedPrime(2)
    completedCallback.current = false
    useSkylineRunnerStore.getState().reset()
    setSceneKey((value) => value + 1)
  }, [clearInputs])

  const handleTouchAction = useCallback((action: TouchAction, pressed: boolean) => {
    if (pressed) unlockAudio()
    if (action === 'jump') {
      if (pressed) input.current.jumpQueued = true
      input.current.jumpHeld = pressed
    } else if (action === 'grapple') {
      if (pressed) input.current.grappleSources.add('touch')
      else input.current.grappleSources.delete('touch')
    }
    else if (action === 'sprint') input.current.sprintHeld = pressed
    else if (action === 'attack' && pressed) input.current.attackQueued = true
    else if (action === 'interact' && pressed) useSkylineRunnerStore.getState().interact()
  }, [unlockAudio])

  useEffect(() => {
    restart()
    const coarse = window.matchMedia('(pointer: coarse)').matches
    if (coarse) useSkylineRunnerStore.getState().setControlsCaptured(true)
    // The restart above intentionally defines the fresh run mounted by this experience.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    audio.setReducedMotion(reducedMotion)
  }, [audio, reducedMotion])

  useEffect(() => {
    if (audioDisposal.timer !== null) window.clearTimeout(audioDisposal.timer)
    return () => {
      audioDisposal.timer = window.setTimeout(() => void audio.dispose(), 0)
    }
  }, [audio, audioDisposal])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!paused) return
    clearInputs()
    audio.stopWind()
    if (document.pointerLockElement) document.exitPointerLock()
  }, [audio, clearInputs, paused])

  useEffect(() => {
    const onPointerLockChange = () => {
      const canvas = containerRef.current?.querySelector('canvas')
      useSkylineRunnerStore.getState().setControlsCaptured(Boolean(canvas && document.pointerLockElement === canvas))
      if (!document.pointerLockElement) clearInputs()
    }
    const onMouseMove = (event: MouseEvent) => {
      const canvas = containerRef.current?.querySelector('canvas')
      if (!canvas || document.pointerLockElement !== canvas || paused) return
      look.current.yaw -= event.movementX * .00215
      look.current.pitch = Math.max(-1.32, Math.min(1.32, look.current.pitch - event.movementY * .0019))
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const state = useSkylineRunnerStore.getState()
      const target = event.target
      if (!state.controlsCaptured
        && target instanceof Element
        && target.closest('button, a, input, select, textarea, [contenteditable="true"]')) return
      unlockAudio()
      if (event.code === 'KeyP' && !event.repeat) {
        onPauseChange(true)
        return
      }
      if (state.activeDialogue || paused || state.result || state.defeated) return
      const primeByKey: Partial<Record<string, SkylinePrimeCoreValue>> = {
        Digit2: 2,
        Numpad2: 2,
        Digit3: 3,
        Numpad3: 3,
        Digit5: 5,
        Numpad5: 5,
      }
      const selected = primeByKey[event.code]
      if (selected && !event.repeat) setSelectedPrime(selected)
      if (event.code === 'Space') {
        event.preventDefault()
        if (!event.repeat) input.current.jumpQueued = true
        input.current.jumpHeld = true
      }
      if (event.code === 'KeyF' && !event.repeat) input.current.attackQueued = true
      if (event.code === 'KeyE' && !event.repeat) state.interact()
      if (event.code === 'KeyQ') input.current.grappleSources.add('keyboard')
      input.current.keys.add(event.code)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      input.current.keys.delete(event.code)
      if (event.code === 'Space') input.current.jumpHeld = false
      if (event.code === 'KeyQ') input.current.grappleSources.delete('keyboard')
    }
    const onMouseDown = (event: MouseEvent) => {
      const canvas = containerRef.current?.querySelector('canvas')
      if (!canvas || document.pointerLockElement !== canvas || paused) return
      if (event.button === 0) input.current.attackQueued = true
      if (event.button === 2) input.current.grappleSources.add('mouse')
    }
    const onMouseUp = (event: MouseEvent) => {
      if (event.button === 2) input.current.grappleSources.delete('mouse')
    }
    const preventMenu = (event: MouseEvent) => {
      if (event.target === containerRef.current?.querySelector('canvas')) event.preventDefault()
    }
    document.addEventListener('pointerlockchange', onPointerLockChange)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('contextmenu', preventMenu)
    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('contextmenu', preventMenu)
      clearInputs()
    }
  }, [clearInputs, onPauseChange, paused, unlockAudio])

  useEffect(() => {
    const canvas = containerRef.current?.querySelector('canvas')
    if (!canvas) return undefined
    let pointerId: number | null = null
    let previousX = 0
    let previousY = 0
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || event.clientX < window.innerWidth * .3) return
      pointerId = event.pointerId
      previousX = event.clientX
      previousY = event.clientY
      canvas.setPointerCapture?.(pointerId)
    }
    const move = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return
      const dx = event.clientX - previousX
      const dy = event.clientY - previousY
      previousX = event.clientX
      previousY = event.clientY
      look.current.yaw -= dx * .006
      look.current.pitch = Math.max(-1.25, Math.min(1.25, look.current.pitch - dy * .005))
    }
    const up = (event: PointerEvent) => {
      if (pointerId === event.pointerId) pointerId = null
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
    }
  }, [sceneKey])

  useEffect(() => {
    if (activeDialogueForLock && document.pointerLockElement) document.exitPointerLock()
  }, [activeDialogueForLock])

  useEffect(() => {
    if (!result || completedCallback.current) return
    completedCallback.current = true
    audio.stopWind()
    audio.play('victory', 1.25)
    if (document.pointerLockElement) document.exitPointerLock()
    endingTimer.current = window.setTimeout(() => {
      endingTimer.current = null
      onVictory(result)
    }, 750)
    return () => {
      if (endingTimer.current !== null) window.clearTimeout(endingTimer.current)
      endingTimer.current = null
    }
  }, [audio, onVictory, result])

  useEffect(() => {
    if (!defeated || completedCallback.current) return
    completedCallback.current = true
    audio.stopWind()
    if (document.pointerLockElement) document.exitPointerLock()
    const state = useSkylineRunnerStore.getState()
    const elapsedMs = Math.max(0, state.telemetry.elapsedMs)
    endingTimer.current = window.setTimeout(() => {
      endingTimer.current = null
      onDefeat({
      score: 0,
      xp: 0,
      elapsedMs,
      maxFlow: state.telemetry.maxFlow,
      enemiesDefeated: state.mission.defeatedSentinelIds.length,
      falls: state.falls,
      })
    }, 500)
    return () => {
      if (endingTimer.current !== null) window.clearTimeout(endingTimer.current)
      endingTimer.current = null
    }
  }, [audio, defeated, onDefeat])

  return (
    <div ref={containerRef} className="skyline-experience">
      <div
        className="skyline-canvas"
        onPointerDown={(event) => {
          if (event.pointerType !== 'mouse' || (event.button !== 0 && event.button !== 2)) return
          if (event.button === 2) input.current.grappleSources.add('mouse')
          captureControls()
        }}
      >
        <SceneBoundary>
          <Canvas
            key={sceneKey}
            aria-label="Cidade 3D em primeira pessoa para parkour entre telhados"
            camera={{ position: [PLAYER_SPAWN.x, PLAYER_SPAWN.y + EYE_OFFSET, PLAYER_SPAWN.z], fov: 75, near: .045, far: 520 }}
            dpr={profile.dpr}
            gl={{ antialias: profile.antialias, alpha: false, powerPreference: quality === 'low' ? 'low-power' : 'high-performance' }}
            shadows={profile.shadows}
            frameloop={paused ? 'demand' : 'always'}
            fallback={<div className="skyline-webgl-fallback"><div><strong>O horizonte não carregou.</strong><p>Ative a aceleração gráfica do navegador e tente novamente.</p></div></div>}
            onCreated={({ gl }) => {
              gl.domElement.style.touchAction = 'none'
              gl.outputColorSpace = THREE.SRGBColorSpace
              gl.toneMapping = THREE.ACESFilmicToneMapping
              gl.toneMappingExposure = 1.12
            }}
          >
            <Suspense fallback={null}>
              <SkylineRunnerScene
                paused={paused}
                quality={quality}
                profile={profile}
                reducedMotion={reducedMotion}
                input={input}
                look={look}
                audio={audio}
                selectedPrime={selectedPrime}
              />
            </Suspense>
          </Canvas>
        </SceneBoundary>
      </div>
      <SkylineRunnerHud
        quality={quality}
        onQualityChange={onQualityChange}
        onCapture={captureControls}
        onPause={() => onPauseChange(true)}
        onRestart={restart}
        soundEnabled={soundEnabled}
        selectedPrime={selectedPrime}
        onPrimeSelect={setSelectedPrime}
        onSoundToggle={() => {
          const next = !soundEnabled
          setSoundEnabled(next)
          audio.setEnabled(next)
          if (next) unlockAudio()
        }}
        onTouchAction={handleTouchAction}
        onTouchMove={(x, z) => {
          input.current.touchX = x
          input.current.touchZ = z
          input.current.sprintHeld = Math.hypot(x, z) > .86
        }}
      />
    </div>
  )
}
