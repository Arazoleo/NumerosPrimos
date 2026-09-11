import { Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { MathUtils, Object3D, PerspectiveCamera, Vector3, type PointLight, type SpotLight } from 'three'

import type { QualityProfile } from '../../graphics/useQualitySettings'
import type { QualityLevel } from '../../graphics/useQualitySettings'
import {
  BackroomsEntity,
  BackroomsEnvironment,
  backroomsGridToLocal,
  useBackroomsRuntime,
} from './backrooms'
import {
  CAESAR_POSITION,
  CaesarMechanism,
  ESCAPE_EXIT_POSITION,
  getStoryCharacterFocus,
  HiddenLens,
  LENS_POSITION,
  MODULAR_POSITION,
  ModularMechanism,
  PRIME_BOX_POSITION,
  PrimeMechanism,
  RSA_VAULT_POSITION,
  RsaVault,
  SPECTRAL_PLAQUE_POSITION,
  SpectralPlaque,
  StoryCharacters,
} from './components'
import { getDialogueLine } from './dialogue'
import { evaluateModularLock, parseIntegerInput } from './escapeLogic'
import { useEscapeStore } from './escapeStore'
import FlashlightViewModel from './components/FlashlightViewModel'
import { reportEscapeViewBob, resetEscapeViewBob } from './viewBob'
import {
  addEscapeLookDelta,
  consumeEscapeLookDelta,
  isEscapeMovePressed,
  resetEscapeInput,
  setEscapeMove,
  type EscapeMoveCommand,
} from './explorationInput'
import {
  distanceSquared2D,
  ESCAPE_PLAYER_START,
  isWithinInteractionCone,
  resolveEscapeMovement,
  type EscapePosition2D,
} from './navigation'
import type { EscapeInteractableId, EscapePhase, PrimeBoxStep } from './types'

const EYE_HEIGHT = 0.22
const BASE_FOV = 61
const MOVE_SPEED = 2.8
const SPRINT_MULTIPLIER = 1.58
const KEYBOARD_TURN_SPEED = 1.62
const POINTER_SENSITIVITY = 0.0028
const INTERACTION_RADIUS = 2.55
const INTERACTION_MIN_ALIGNMENT = 0.24
const MAX_PITCH = Math.PI * 0.34
const GATE_OPENING_MS = 900
const EXIT_THRESHOLD_POSITION = ESCAPE_EXIT_POSITION

const KEY_COMMANDS: Readonly<Partial<Record<string, EscapeMoveCommand>>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  KeyD: 'right',
  ArrowLeft: 'turn-left',
  ArrowRight: 'turn-right',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
}

interface InteractablePoint extends EscapePosition2D {
  readonly id: EscapeInteractableId
}

interface InspectionPose {
  readonly camera: readonly [number, number, number]
  readonly target: readonly [number, number, number]
}

const INSPECTION_POSES: Readonly<Record<EscapeInteractableId, InspectionPose>> = {
  lens: {
    camera: [LENS_POSITION[0] + 1.15, 0.28, LENS_POSITION[2] + 2.25],
    target: [LENS_POSITION[0], 0.02, LENS_POSITION[2]],
  },
  'prime-box': {
    camera: [PRIME_BOX_POSITION[0] + 0.55, 1.1, PRIME_BOX_POSITION[2] + 3.25],
    target: [PRIME_BOX_POSITION[0] + 0.75, 0.72, PRIME_BOX_POSITION[2]],
  },
  'caesar-console': {
    camera: [CAESAR_POSITION[0] + 0.55, 0.55, CAESAR_POSITION[2] + 4.5],
    target: [CAESAR_POSITION[0], 0.75, CAESAR_POSITION[2]],
  },
  'modular-console': {
    camera: [MODULAR_POSITION[0] + 0.55, 0.2, MODULAR_POSITION[2] + 3.25],
    target: [MODULAR_POSITION[0] + 0.85, -0.15, MODULAR_POSITION[2]],
  },
  'hidden-plaque': {
    camera: [SPECTRAL_PLAQUE_POSITION[0] + 0.5, 0.18, SPECTRAL_PLAQUE_POSITION[2] + 3.1],
    target: [SPECTRAL_PLAQUE_POSITION[0] + 0.85, -0.15, SPECTRAL_PLAQUE_POSITION[2]],
  },
  'rsa-vault': {
    camera: [RSA_VAULT_POSITION[0] - 0.65, 0.28, RSA_VAULT_POSITION[2] - 4.35],
    target: [RSA_VAULT_POSITION[0] - 1.05, -0.05, RSA_VAULT_POSITION[2]],
  },
  'exit-door': {
    camera: [RSA_VAULT_POSITION[0] - 0.65, 0.28, RSA_VAULT_POSITION[2] - 4.35],
    target: [RSA_VAULT_POSITION[0] - 1.05, -0.05, RSA_VAULT_POSITION[2]],
  },
}

/**
 * The Prime Box is inspected layer by layer: each step pushes the camera closer to
 * the part that can be operated, the way a physical puzzle box is examined.
 */
const PRIME_BOX_STAGE_POSES: Readonly<Record<PrimeBoxStep, InspectionPose>> = {
  rings: {
    camera: [PRIME_BOX_POSITION[0] + 0.55, 1.1, PRIME_BOX_POSITION[2] + 3.25],
    target: [PRIME_BOX_POSITION[0] + 0.75, 0.72, PRIME_BOX_POSITION[2]],
  },
  latches: {
    camera: [PRIME_BOX_POSITION[0] + 0.35, 0.92, PRIME_BOX_POSITION[2] + 2.75],
    target: [PRIME_BOX_POSITION[0] + 0.75, 0.58, PRIME_BOX_POSITION[2]],
  },
  lid: {
    camera: [PRIME_BOX_POSITION[0] + 0.4, 1.42, PRIME_BOX_POSITION[2] + 2.6],
    target: [PRIME_BOX_POSITION[0] + 0.75, 0.82, PRIME_BOX_POSITION[2]],
  },
  drawer: {
    camera: [PRIME_BOX_POSITION[0] + 0.4, 0.66, PRIME_BOX_POSITION[2] + 2.5],
    target: [PRIME_BOX_POSITION[0] + 0.75, 0.12, PRIME_BOX_POSITION[2] + 0.4],
  },
  rotor: {
    camera: [PRIME_BOX_POSITION[0] + 0.4, 0.58, PRIME_BOX_POSITION[2] + 2.2],
    target: [PRIME_BOX_POSITION[0] + 0.75, 0.06, PRIME_BOX_POSITION[2] + 0.6],
  },
  complete: {
    camera: [PRIME_BOX_POSITION[0] + 0.55, 1.1, PRIME_BOX_POSITION[2] + 3.25],
    target: [PRIME_BOX_POSITION[0] + 0.75, 0.72, PRIME_BOX_POSITION[2]],
  },
}

const INSPECTION_ORBIT_LIMITS: Readonly<
  Record<EscapeInteractableId, readonly [minimum: number, maximum: number]>
> = {
  lens: [-0.72, 0.72],
  'prime-box': [-0.68, 0.46],
  'caesar-console': [-0.78, 0.78],
  'modular-console': [-0.92, 0.92],
  'hidden-plaque': [-0.38, 0.7],
  'rsa-vault': [-0.88, 0.88],
  'exit-door': [-0.88, 0.88],
}

export interface EscapeRoomSceneProps {
  quality: QualityLevel
  profile: QualityProfile
  reducedMotion: boolean
}

function position2D(position: readonly [number, number, number]): EscapePosition2D {
  return { x: position[0], z: position[2] }
}

function ExitThreshold({ active, onInteract }: { active: boolean; onInteract: () => void }): JSX.Element {
  const color = active ? '#9afff5' : '#55ebdf'

  return (
    <group
      position={EXIT_THRESHOLD_POSITION}
      rotation={[0, Math.PI, 0]}
      onClick={(event) => {
        event.stopPropagation()
        if (active) onInteract()
      }}
    >
      {([-1, 1] as const).map((side) => (
        <mesh key={side} position={[side * 2.25, 0, 0]}>
          <boxGeometry args={[0.12, 5.05, 0.12]} />
          <meshBasicMaterial color={color} transparent opacity={active ? 0.9 : 0.48} />
        </mesh>
      ))}
      <mesh position={[0, 2.48, 0]}>
        <boxGeometry args={[4.62, 0.12, 0.12]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.9 : 0.48} />
      </mesh>
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[4.3, 4.85]} />
        <meshBasicMaterial color="#55ebdf" transparent opacity={active ? 0.08 : 0.035} depthWrite={false} />
      </mesh>
      <Text position={[0, 2.72, 0.04]} fontSize={0.2} color={color} anchorX="center" letterSpacing={0.18}>
        SAÍDA // PROTOCOLO LIVRE
      </Text>
      {active ? <pointLight position={[0, 0, 1.2]} color="#55ebdf" intensity={6} distance={5} /> : null}
    </group>
  )
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('input, textarea, select, button, a, summary, [contenteditable="true"]'))
}

function isInteractionKey(code: string): boolean {
  return code === 'KeyE' || code === 'Enter' || code === 'Space'
}

function getClosestInteractable(
  player: EscapePosition2D,
  yaw: number,
  lensCollected: boolean,
  rsaSolved: boolean,
): EscapeInteractableId | null {
  const points: InteractablePoint[] = [
    { id: 'prime-box', ...position2D(PRIME_BOX_POSITION) },
    { id: 'caesar-console', ...position2D(CAESAR_POSITION) },
    { id: 'modular-console', ...position2D(MODULAR_POSITION) },
    { id: 'hidden-plaque', ...position2D(SPECTRAL_PLAQUE_POSITION) },
    {
      id: rsaSolved ? 'exit-door' : 'rsa-vault',
      ...position2D(rsaSolved ? EXIT_THRESHOLD_POSITION : RSA_VAULT_POSITION),
    },
  ]

  if (!lensCollected) {
    points.unshift({ id: 'lens', ...position2D(LENS_POSITION) })
  }

  const radiusSquared = INTERACTION_RADIUS * INTERACTION_RADIUS
  let closest: EscapeInteractableId | null = null
  let closestDistance = radiusSquared
  points.forEach((point) => {
    const distance = distanceSquared2D(player, point)
    if (distance > closestDistance) return
    if (!isWithinInteractionCone(
      player,
      point,
      yaw,
      INTERACTION_RADIUS,
      INTERACTION_MIN_ALIGNMENT,
    )) return

    closest = point.id
    closestDistance = distance
  })

  return closest
}

function useExplorationControls(): void {
  const gl = useThree((state) => state.gl)
  const draggingRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)
  const previousPointerRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = gl.domElement
    const previousTouchAction = canvas.style.touchAction
    canvas.style.touchAction = 'none'

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      const state = useEscapeStore.getState()
      // While inspecting, dragging orbits the mechanism; a click without drag is
      // still delivered to the meshes, so parts stay directly operable.
      if (state.activeDialogue) return
      // Mouse look is locked like a first-person game: the pointer disappears and
      // the view follows the mouse directly, instead of only while dragging.
      if (
        event.pointerType === 'mouse'
        && !state.inspection
        && document.pointerLockElement !== canvas
      ) {
        void canvas.requestPointerLock?.()
      }
      draggingRef.current = true
      pointerIdRef.current = event.pointerId
      previousPointerRef.current = { x: event.clientX, y: event.clientY }
      canvas.setPointerCapture?.(event.pointerId)
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return
      if (useEscapeStore.getState().activeDialogue) return
      addEscapeLookDelta(event.movementX, event.movementY)
    }

    const handlePointerMove = (event: PointerEvent) => {
      // Locked pointers deliver movement through mousemove instead.
      if (document.pointerLockElement === canvas) return
      if (!draggingRef.current || event.pointerId !== pointerIdRef.current) return
      const previous = previousPointerRef.current
      addEscapeLookDelta(event.clientX - previous.x, event.clientY - previous.y)
      previousPointerRef.current = { x: event.clientX, y: event.clientY }
      event.preventDefault()
    }

    const handleLockChange = () => {
      if (document.pointerLockElement !== canvas) resetEscapeInput()
    }

    const stopDragging = (event: PointerEvent) => {
      if (event.pointerId !== pointerIdRef.current) return
      draggingRef.current = false
      pointerIdRef.current = null
      if (canvas.hasPointerCapture?.(event.pointerId)) {
        canvas.releasePointerCapture?.(event.pointerId)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const state = useEscapeStore.getState()
      const running = state.phase !== 'intro' && state.phase !== 'escaped'
      if (!running) return
      if (isEditableTarget(event.target) || state.inspection || state.activeDialogue) return

      if (event.code === 'KeyF') {
        event.preventDefault()
        if (!event.repeat) state.toggleFlashlight()
        return
      }

      const command = KEY_COMMANDS[event.code]
      if (command) {
        event.preventDefault()
        setEscapeMove(command, true)
        return
      }

      if (isInteractionKey(event.code)) {
        event.preventDefault()
        if (!event.repeat) state.interact()
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const command = KEY_COMMANDS[event.code]
      if (!command) return
      setEscapeMove(command, false)
      if (!isEditableTarget(event.target)) event.preventDefault()
    }

    const handleBlur = () => resetEscapeInput()

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('pointerlockchange', handleLockChange)
    canvas.addEventListener('pointerup', stopDragging)
    canvas.addEventListener('pointercancel', stopDragging)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      canvas.style.touchAction = previousTouchAction
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('pointerlockchange', handleLockChange)
      if (document.pointerLockElement === canvas) document.exitPointerLock?.()
      canvas.removeEventListener('pointerup', stopDragging)
      canvas.removeEventListener('pointercancel', stopDragging)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      resetEscapeInput()
    }
  }, [gl])
}

function PlayerFlashlight({ enabled, castShadow }: { enabled: boolean; castShadow: boolean }): JSX.Element {
  const camera = useThree((state) => state.camera)
  const lightRef = useRef<SpotLight>(null)
  const haloRef = useRef<SpotLight>(null)
  const darkAdaptedRef = useRef<PointLight>(null)
  const target = useMemo(() => new Object3D(), [])
  const direction = useMemo(() => new Vector3(), [])

  useFrame(({ clock }) => {
    const light = lightRef.current
    if (!light) return
    light.position.copy(camera.position)
    light.position.y -= 0.04
    camera.getWorldDirection(direction)
    target.position.copy(camera.position).addScaledVector(direction, 12)
    target.updateMatrixWorld()
    const threat = useBackroomsRuntime.getState().threat
    const interference = threat === 'chase'
      ? 0.78 + Math.sin(clock.elapsedTime * 17) * 0.11
      : threat === 'listening'
        ? 0.94 + Math.sin(clock.elapsedTime * 5.4) * 0.035
        : 1
    light.intensity = 52 * interference
    if (haloRef.current) haloRef.current.intensity = 9 * interference
    if (darkAdaptedRef.current) {
      // Eyes adjust: with the torch off you keep a metre of vision, not blindness.
      darkAdaptedRef.current.position.copy(camera.position)
      darkAdaptedRef.current.intensity = enabled ? 0 : 1.6
    }
  }, -1)

  return (
    <>
      <primitive object={target} />
      <spotLight
        ref={lightRef}
        target={target}
        visible={enabled}
        color="#d8fffa"
        intensity={52}
        distance={26}
        angle={0.47}
        penumbra={0.78}
        decay={1.25}
        castShadow={castShadow}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-bias={-0.0004}
        shadow-normalBias={0.015}
        shadow-camera-near={0.2}
        shadow-camera-far={26}
      />
      {/* Wide, shadowless spill so the beam has an edge instead of a hard circle. */}
      <pointLight ref={darkAdaptedRef} color="#7fa8b8" intensity={0} distance={5.5} decay={2.2} />
      <spotLight
        ref={haloRef}
        target={target}
        visible={enabled}
        color="#9fd8ff"
        intensity={9}
        distance={9}
        angle={1.05}
        penumbra={1}
        decay={2}
      />
    </>
  )
}

function FirstPersonRig({ runId, reducedMotion }: { runId: number; reducedMotion: boolean }): null {
  const camera = useThree((state) => state.camera)
  const viewportWidth = useThree((state) => state.size.width)
  const playerRef = useRef<EscapePosition2D>({ ...ESCAPE_PLAYER_START })
  const yawRef = useRef(0)
  const pitchRef = useRef(-0.035)
  const velocityRef = useRef({ x: 0, z: 0 })
  const strideRef = useRef(0)
  const walkBlendRef = useRef(0)
  const sprintBlendRef = useRef(0)
  const previousRunIdRef = useRef(runId)
  const inspectionIdRef = useRef<EscapeInteractableId | null>(null)
  const inspectionOffsetRef = useRef({ x: 0, y: 0 })
  const returningFromInspectionRef = useRef(false)
  const observedPhaseRef = useRef<EscapePhase>('intro')
  const collisionPhaseRef = useRef<EscapePhase>('intro')
  const gateReleaseAtRef = useRef(0)
  const observedRsaSolvedRef = useRef(false)
  const rsaPassableRef = useRef(false)
  const vaultReleaseAtRef = useRef(0)
  const observedCaptureRef = useRef(0)
  const telemetryReportedAtRef = useRef(0)
  const forwardVector = useMemo(() => new Vector3(), [])
  const lookTarget = useMemo(() => new Vector3(), [])
  const desiredCameraPosition = useMemo(() => new Vector3(), [])
  const orientationHelper = useMemo(() => new Object3D(), [])

  useLayoutEffect(() => {
    const phase = useEscapeStore.getState().phase
    if (phase === 'intro' || previousRunIdRef.current !== runId) {
      playerRef.current = { ...ESCAPE_PLAYER_START }
      yawRef.current = 1.9
      pitchRef.current = -0.035
      camera.position.set(ESCAPE_PLAYER_START.x, EYE_HEIGHT, ESCAPE_PLAYER_START.z)
      camera.lookAt(ESCAPE_PLAYER_START.x + 0.95, EYE_HEIGHT - 0.035, ESCAPE_PLAYER_START.z + 0.32)
      observedPhaseRef.current = phase
      collisionPhaseRef.current = phase
      gateReleaseAtRef.current = 0
      observedRsaSolvedRef.current = false
      rsaPassableRef.current = false
      vaultReleaseAtRef.current = 0
      returningFromInspectionRef.current = false
      observedCaptureRef.current = useBackroomsRuntime.getState().captureSerial
      useBackroomsRuntime.getState().startRun({
        ...ESCAPE_PLAYER_START,
        yaw: yawRef.current,
      })
    }
    previousRunIdRef.current = runId
  }, [camera, runId])

  useFrame((_, rawDelta) => {
    const state = useEscapeStore.getState()
    const captureSerial = useBackroomsRuntime.getState().captureSerial
    if (captureSerial !== observedCaptureRef.current) {
      observedCaptureRef.current = captureSerial
      const checkpoint = getBackroomsCheckpoint(state.phase)
      playerRef.current = checkpoint
      yawRef.current = checkpoint.yaw
      pitchRef.current = -0.035
      camera.position.set(checkpoint.x, EYE_HEIGHT, checkpoint.z)
      resetEscapeInput()
      resetEscapeViewBob()
    }
    const justExitedInspection = state.inspection === null && inspectionIdRef.current !== null
    if (justExitedInspection) returningFromInspectionRef.current = !reducedMotion
    const paused = state.phase === 'intro' ||
      state.phase === 'escaped' ||
      state.inspection !== null ||
      state.activeDialogue !== null ||
      returningFromInspectionRef.current
    const delta = Math.min(rawDelta, 0.05)

    if (state.phase !== observedPhaseRef.current) {
      const opensGate = state.phase === 'caesar-lock' ||
        state.phase === 'modular-lock' ||
        state.phase === 'spectral-clue' ||
        state.phase === 'rsa-vault'
      observedPhaseRef.current = state.phase
      if (opensGate && !reducedMotion) {
        gateReleaseAtRef.current = performance.now() + GATE_OPENING_MS
      } else {
        collisionPhaseRef.current = state.phase
        gateReleaseAtRef.current = 0
      }
    }
    if (gateReleaseAtRef.current > 0 && performance.now() >= gateReleaseAtRef.current) {
      collisionPhaseRef.current = state.phase
      gateReleaseAtRef.current = 0
    }
    if (state.rsaSolved !== observedRsaSolvedRef.current) {
      observedRsaSolvedRef.current = state.rsaSolved
      if (state.rsaSolved && !reducedMotion) {
        vaultReleaseAtRef.current = performance.now() + GATE_OPENING_MS
      } else {
        rsaPassableRef.current = state.rsaSolved
        vaultReleaseAtRef.current = 0
      }
    }
    if (vaultReleaseAtRef.current > 0 && performance.now() >= vaultReleaseAtRef.current) {
      rsaPassableRef.current = state.rsaSolved
      vaultReleaseAtRef.current = 0
    }

    if (state.inspection) {
      if (document.pointerLockElement !== null) document.exitPointerLock?.()
      returningFromInspectionRef.current = false
      const inspectionId = state.inspection.interactable
      const look = consumeEscapeLookDelta()
      resetEscapeInput()
      if (inspectionIdRef.current !== inspectionId) {
        inspectionIdRef.current = inspectionId
        inspectionOffsetRef.current = { x: 0, y: 0 }
      } else {
        const [minimumOrbit, maximumOrbit] = INSPECTION_ORBIT_LIMITS[inspectionId]
        inspectionOffsetRef.current.x = MathUtils.clamp(
          inspectionOffsetRef.current.x + look.x * 0.004,
          minimumOrbit,
          maximumOrbit,
        )
        inspectionOffsetRef.current.y = MathUtils.clamp(
          inspectionOffsetRef.current.y - look.y * 0.003,
          -0.55,
          0.55,
        )
      }
      const pose = inspectionId === 'prime-box'
        ? PRIME_BOX_STAGE_POSES[state.primeBoxStep]
        : INSPECTION_POSES[inspectionId]
      const [cameraX, cameraY, cameraZ] = pose.camera
      const [targetX, targetY, targetZ] = pose.target
      const orbit = inspectionOffsetRef.current.x
      const baseX = cameraX - targetX
      const baseZ = cameraZ - targetZ
      const desiredX = targetX + baseX * Math.cos(orbit) + baseZ * Math.sin(orbit)
      const desiredY = cameraY + inspectionOffsetRef.current.y
      const desiredZ = targetZ - baseX * Math.sin(orbit) + baseZ * Math.cos(orbit)
      if (reducedMotion) {
        camera.position.set(desiredX, desiredY, desiredZ)
      } else {
        camera.position.x = MathUtils.damp(camera.position.x, desiredX, 5.8, delta)
        camera.position.y = MathUtils.damp(camera.position.y, desiredY, 5.8, delta)
        camera.position.z = MathUtils.damp(camera.position.z, desiredZ, 5.8, delta)
      }
      // Nudge the aim sideways *in screen space* so the docked panel does not cover
      // the mechanism. Offsetting world X instead would swing the object out of frame
      // as soon as the player orbits, and would scale wrong at any distance.
      const toTargetX = targetX - camera.position.x
      const toTargetZ = targetZ - camera.position.z
      const viewDistance = Math.hypot(toTargetX, toTargetZ) || 1
      const panelFraction = viewportWidth >= 1050 ? 0.22 : viewportWidth >= 760 ? 0.14 : 0
      const rightX = -toTargetZ / viewDistance
      const rightZ = toTargetX / viewDistance
      const panelOffset = viewDistance * panelFraction
      lookTarget.set(
        targetX + rightX * panelOffset,
        targetY,
        targetZ + rightZ * panelOffset,
      )
      if (reducedMotion) {
        camera.lookAt(lookTarget)
      } else {
        orientationHelper.position.copy(camera.position)
        orientationHelper.lookAt(lookTarget)
        camera.quaternion.slerp(
          orientationHelper.quaternion,
          1 - Math.exp(-delta * 7.2),
        )
      }
      if (state.nearby !== null) state.setNearby(null)
      return
    }

    inspectionIdRef.current = null

    if (paused) {
      resetEscapeInput()
      consumeEscapeLookDelta()
      velocityRef.current = { x: 0, z: 0 }
      walkBlendRef.current = MathUtils.damp(walkBlendRef.current, 0, 8, delta)
      sprintBlendRef.current = MathUtils.damp(sprintBlendRef.current, 0, 6, delta)
      reportEscapeViewBob({ walk: walkBlendRef.current, sprint: sprintBlendRef.current })
      if (state.activeDialogue) {
        const dialogueLine = getDialogueLine(
          state.activeDialogue.sceneId,
          state.activeDialogue.lineIndex,
        )
        if (dialogueLine && !reducedMotion) {
          const speaker = dialogueLine.speaker === 'NORA' ? 'nora' : 'vesper'
          const [focusX, focusY, focusZ] = getStoryCharacterFocus(state.phase, speaker)
          const player = playerRef.current
          const deltaX = focusX - player.x
          const deltaZ = focusZ - player.z
          const desiredYaw = Math.atan2(deltaX, -deltaZ)
          const horizontalDistance = Math.max(0.001, Math.hypot(deltaX, deltaZ))
          const desiredPitch = Math.atan2(focusY - EYE_HEIGHT, horizontalDistance)
          const response = 1 - Math.exp(-delta * 4.2)
          const yawDifference = Math.atan2(
            Math.sin(desiredYaw - yawRef.current),
            Math.cos(desiredYaw - yawRef.current),
          )
          yawRef.current += yawDifference * response
          pitchRef.current = MathUtils.lerp(pitchRef.current, desiredPitch, response)
        }
      }
    } else {
      const look = consumeEscapeLookDelta()
      yawRef.current += look.x * POINTER_SENSITIVITY
      pitchRef.current = MathUtils.clamp(
        pitchRef.current - look.y * POINTER_SENSITIVITY,
        -MAX_PITCH,
        MAX_PITCH,
      )

      const turn = Number(isEscapeMovePressed('turn-right')) - Number(isEscapeMovePressed('turn-left'))
      yawRef.current += turn * KEYBOARD_TURN_SPEED * delta

      const longitudinal = Number(isEscapeMovePressed('forward')) - Number(isEscapeMovePressed('backward'))
      const lateral = Number(isEscapeMovePressed('right')) - Number(isEscapeMovePressed('left'))
      const inputLength = Math.hypot(longitudinal, lateral)

      const yaw = yawRef.current
      const forwardX = Math.sin(yaw)
      const forwardZ = -Math.cos(yaw)
      const rightX = Math.cos(yaw)
      const rightZ = Math.sin(yaw)
      const sprinting = isEscapeMovePressed('sprint') && inputLength > 0
      const sprintMultiplier = sprinting ? SPRINT_MULTIPLIER : 1
      const normaliser = Math.max(1, inputLength)
      const targetVelocityX = inputLength > 0
        ? (forwardX * longitudinal + rightX * lateral) / normaliser * MOVE_SPEED * sprintMultiplier
        : 0
      const targetVelocityZ = inputLength > 0
        ? (forwardZ * longitudinal + rightZ * lateral) / normaliser * MOVE_SPEED * sprintMultiplier
        : 0
      // Steps have weight: the body accelerates into a walk and coasts to a stop.
      const responsiveness = inputLength > 0 ? 11 : 14
      velocityRef.current = {
        x: MathUtils.damp(velocityRef.current.x, targetVelocityX, responsiveness, delta),
        z: MathUtils.damp(velocityRef.current.z, targetVelocityZ, responsiveness, delta),
      }
      const speed = Math.hypot(velocityRef.current.x, velocityRef.current.z)
      if (speed > 0.0006) {
        playerRef.current = resolveEscapeMovement(
          playerRef.current,
          {
            x: playerRef.current.x + velocityRef.current.x * delta,
            z: playerRef.current.z + velocityRef.current.z * delta,
          },
          collisionPhaseRef.current,
          rsaPassableRef.current,
        )
      }
      strideRef.current = reducedMotion
        ? 0
        : strideRef.current + delta * speed * (sprinting ? 9.4 : 7.6)
      reportEscapeViewBob({
        stride: strideRef.current,
        walk: walkBlendRef.current,
        sprint: sprintBlendRef.current,
      })
      sprintBlendRef.current = MathUtils.damp(
        sprintBlendRef.current,
        sprinting && speed > MOVE_SPEED * 0.5 ? 1 : 0,
        5,
        delta,
      )
      walkBlendRef.current = MathUtils.damp(
        walkBlendRef.current,
        Math.min(1, speed / MOVE_SPEED),
        8,
        delta,
      )
    }

    const player = playerRef.current
    const bobAmount = walkBlendRef.current * (1 + sprintBlendRef.current * 0.5)
    const bobY = reducedMotion ? 0 : Math.sin(strideRef.current * 2) * 0.0085 * bobAmount
    const bobRoll = reducedMotion ? 0 : Math.sin(strideRef.current) * 0.0075 * bobAmount
    desiredCameraPosition.set(player.x, EYE_HEIGHT + bobY, player.z)
    const cosPitch = Math.cos(pitchRef.current)
    forwardVector.set(
      Math.sin(yawRef.current) * cosPitch,
      Math.sin(pitchRef.current),
      -Math.cos(yawRef.current) * cosPitch,
    )
    if (returningFromInspectionRef.current) {
      camera.position.x = MathUtils.damp(camera.position.x, desiredCameraPosition.x, 6.4, delta)
      camera.position.y = MathUtils.damp(camera.position.y, desiredCameraPosition.y, 6.4, delta)
      camera.position.z = MathUtils.damp(camera.position.z, desiredCameraPosition.z, 6.4, delta)
      lookTarget.copy(camera.position).add(forwardVector)
      orientationHelper.position.copy(camera.position)
      orientationHelper.lookAt(lookTarget)
      camera.quaternion.slerp(
        orientationHelper.quaternion,
        1 - Math.exp(-delta * 7.2),
      )
      if (
        camera.position.distanceToSquared(desiredCameraPosition) < 0.0004 &&
        camera.quaternion.angleTo(orientationHelper.quaternion) < 0.006
      ) {
        camera.position.copy(desiredCameraPosition)
        camera.quaternion.copy(orientationHelper.quaternion)
        returningFromInspectionRef.current = false
      }
    } else {
      camera.position.copy(desiredCameraPosition)
      lookTarget.copy(camera.position).add(forwardVector)
      camera.lookAt(lookTarget)
      if (bobRoll !== 0) camera.rotateZ(bobRoll)
    }

    // Field of view opens up slightly while running, which reads as speed.
    if (camera instanceof PerspectiveCamera) {
      const targetFov = BASE_FOV + sprintBlendRef.current * 5.5
      if (Math.abs(camera.fov - targetFov) > 0.01) {
        camera.fov = MathUtils.damp(camera.fov, targetFov, 6, delta)
        camera.updateProjectionMatrix()
      }
    }

    const nearest = paused
      ? null
      : getClosestInteractable(player, yawRef.current, state.lensCollected, state.rsaSolved)
    if (state.nearby !== nearest) state.setNearby(nearest)

    const now = performance.now()
    if (now - telemetryReportedAtRef.current > 125) {
      telemetryReportedAtRef.current = now
      useBackroomsRuntime.getState().reportPlayer({
        x: player.x,
        z: player.z,
        yaw: yawRef.current,
      })
    }
  }, -2)

  return null
}

function getBackroomsCheckpoint(phase: EscapePhase): EscapePosition2D & { readonly yaw: number } {
  const grid = phase === 'caesar-lock'
    ? backroomsGridToLocal(17, 5)
    : phase === 'modular-lock'
      ? backroomsGridToLocal(12, 8)
      : phase === 'spectral-clue'
        ? backroomsGridToLocal(4, 15)
        : phase === 'rsa-vault' || phase === 'escaped'
          ? backroomsGridToLocal(18, 15)
          : ESCAPE_PLAYER_START
  return { ...grid, yaw: phase === 'rsa-vault' ? 2.45 : 1.9 }
}

export function EscapeRoomScene({ quality, profile, reducedMotion }: EscapeRoomSceneProps): JSX.Element {
  const phase = useEscapeStore((state) => state.phase)
  const runId = useEscapeStore((state) => state.runId)
  const nearby = useEscapeStore((state) => state.nearby)
  const inspection = useEscapeStore((state) => state.inspection)
  const lensCollected = useEscapeStore((state) => state.lensCollected)
  const primeBoxRings = useEscapeStore((state) => state.primeBoxRings)
  const primeBoxStep = useEscapeStore((state) => state.primeBoxStep)
  const primeBoxLatches = useEscapeStore((state) => state.primeBoxLatches)
  const primeBoxSolved = useEscapeStore((state) => state.primeBoxSolved)
  const caesarShift = useEscapeStore((state) => state.caesarShift)
  const caesarSolved = useEscapeStore((state) => state.caesarSolved)
  const modularGuess = useEscapeStore((state) => state.modularGuess)
  const modularSolved = useEscapeStore((state) => state.modularSolved)
  const clueRevealed = useEscapeStore((state) => state.clueRevealed)
  const rsaSolved = useEscapeStore((state) => state.rsaSolved)
  const flashlightOn = useEscapeStore((state) => state.flashlightOn)
  const activeDialogue = useEscapeStore((state) => state.activeDialogue)
  const dialogueLine = activeDialogue
    ? getDialogueLine(activeDialogue.sceneId, activeDialogue.lineIndex)
    : null
  const activeSpeaker = dialogueLine?.speaker === 'NORA'
    ? 'nora'
    : dialogueLine?.speaker === 'VESPER'
      ? 'vesper'
      : null
  const parsedModularGuess = parseIntegerInput(modularGuess)
  const modularEvaluation = parsedModularGuess === null
    ? null
    : evaluateModularLock(parsedModularGuess)
  const discoveredPointIds = [
    ...(primeBoxSolved ? ['reception-desk' as const] : []),
    ...(lensCollected ? ['silent-phone' as const] : []),
    ...(caesarSolved ? ['false-window' as const] : []),
    ...(modularSolved ? ['water-stain' as const] : []),
    ...(clueRevealed ? ['abandoned-cart' as const] : []),
    ...(rsaSolved ? ['red-exit' as const] : []),
  ]

  useExplorationControls()

  const interactIfNearby = (interactable: EscapeInteractableId) => {
    const state = useEscapeStore.getState()
    if (state.nearby === interactable) state.interact(interactable)
  }

  const vaultInteractable: EscapeInteractableId = rsaSolved ? 'exit-door' : 'rsa-vault'
  const activeRun = phase !== 'intro' && phase !== 'escaped'

  return (
    <>
      <BackroomsEnvironment
        quality={quality}
        shadows={profile.shadows}
        reducedMotion={reducedMotion}
        discoveredPointIds={discoveredPointIds}
      />
      <PlayerFlashlight enabled={activeRun && flashlightOn} castShadow={profile.shadows} />
      {activeRun && !inspection && !activeDialogue && (
        <FlashlightViewModel enabled={flashlightOn} reducedMotion={reducedMotion} />
      )}
      <StoryCharacters
        phase={phase}
        activeSpeaker={activeSpeaker}
        reducedMotion={reducedMotion}
      />
      <BackroomsEntity
        active={activeRun && caesarSolved && !inspection && !activeDialogue}
        phase={phase}
        flashlightOn={flashlightOn}
        reducedMotion={reducedMotion}
        runId={runId}
      />

      <HiddenLens
        collected={lensCollected && inspection?.interactable !== 'lens'}
        active={activeRun && nearby === 'lens'}
        onInteract={() => interactIfNearby('lens')}
        reducedMotion={reducedMotion}
      />

      <group
        onClick={(event) => {
          event.stopPropagation()
          if (!inspection) interactIfNearby('prime-box')
        }}
      >
        <PrimeMechanism
          ringValues={primeBoxRings}
          step={primeBoxStep}
          latches={primeBoxLatches}
          active={activeRun && (nearby === 'prime-box' || inspection?.interactable === 'prime-box')}
          interactive={inspection?.interactable === 'prime-box' && inspection.status === 'puzzle'}
          onRotateRing={(index, direction) => useEscapeStore.getState().rotateRing(index, direction)}
          onCalibrate={() => useEscapeStore.getState().submitPrimeBox()}
          onReleaseLatch={(index) => useEscapeStore.getState().releasePrimeLatch(index)}
          onOpenLid={() => useEscapeStore.getState().openPrimeLid()}
          onOpenDrawer={() => useEscapeStore.getState().openPrimeDrawer()}
          onCollectRotor={() => useEscapeStore.getState().collectCaesarRotor()}
          reducedMotion={reducedMotion}
        />
      </group>

      <CaesarMechanism
        shift={caesarShift}
        active={activeRun && (nearby === 'caesar-console' || inspection?.interactable === 'caesar-console')}
        solved={caesarSolved}
        reducedMotion={reducedMotion}
        position={CAESAR_POSITION}
        onRotate={inspection?.interactable === 'caesar-console' && inspection.status === 'puzzle'
          ? (direction) => useEscapeStore.getState().rotateCaesarWheel(direction)
          : undefined}
        onSubmit={inspection?.interactable === 'caesar-console' && inspection.status === 'puzzle'
          ? () => useEscapeStore.getState().submitCaesar()
          : undefined}
        onInteract={() => interactIfNearby('caesar-console')}
      />

      <group onClick={(event) => {
        event.stopPropagation()
        interactIfNearby('modular-console')
      }}>
        <ModularMechanism
          guess={modularEvaluation?.residue ?? null}
          active={activeRun && nearby === 'modular-console'}
          solved={modularSolved}
          reducedMotion={reducedMotion}
        />
      </group>

      <SpectralPlaque
        revealed={clueRevealed}
        active={activeRun && nearby === 'hidden-plaque'}
        onInteract={() => interactIfNearby('hidden-plaque')}
        reducedMotion={reducedMotion}
      />

      <group
        position={RSA_VAULT_POSITION}
        rotation={[0, Math.PI, 0]}
        onClick={(event) => {
          event.stopPropagation()
          interactIfNearby(vaultInteractable)
        }}
      >
        <RsaVault
          open={rsaSolved}
          active={activeRun && (nearby === 'rsa-vault' || nearby === 'exit-door')}
          reducedMotion={reducedMotion}
          position={[0, 0, 0]}
        />
      </group>

      {rsaSolved ? (
        <ExitThreshold
          active={activeRun && nearby === 'exit-door'}
          onInteract={() => interactIfNearby('exit-door')}
        />
      ) : null}

      <FirstPersonRig runId={runId} reducedMotion={reducedMotion} />
    </>
  )
}
