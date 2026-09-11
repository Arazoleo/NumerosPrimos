import { Canvas } from '@react-three/fiber'
import { memo, Suspense, useCallback, useEffect, useMemo, useRef } from 'react'

import type { QualityLevel, QualityProfile } from '../../graphics/useQualitySettings'
import { SceneBoundary } from '../../ui/SceneBoundary'
import type { InterpolatedTransform } from '../primeverse-online/network/interpolation'
import type { RemotePlayer } from '../primeverse-online/network/PrimeverseOnlineClient'
import { ExpeditionPartyAvatars } from '../primeverse-online/party'
import UlamRiftScene, {
  type UlamRiftInput,
  type UlamRiftLook,
  type UlamRiftTelemetry,
} from './UlamRiftScene'
import type { UlamRiftAction, UlamRiftState } from './ulamRiftLogic'

interface UlamRiftControls {
  readonly input: React.MutableRefObject<UlamRiftInput>
  readonly look: React.MutableRefObject<UlamRiftLook>
  readonly setTouchMove: (x: number, z: number) => void
  readonly setSprint: (held: boolean) => void
  readonly queueJump: () => void
  readonly queueInteraction: () => void
}

export function useUlamRiftControls(paused: boolean, onPauseToggle: () => void): UlamRiftControls {
  const input = useRef<UlamRiftInput>({
    keys: new Set<string>(),
    touchX: 0,
    touchZ: 0,
    sprintHeld: false,
    jumpQueued: false,
    interactQueued: false,
  })
  const look = useRef<UlamRiftLook>({ yaw: 0, pitch: 0.08 })
  const pauseToggleRef = useRef(onPauseToggle)
  pauseToggleRef.current = onPauseToggle

  useEffect(() => {
    const clear = () => {
      input.current.keys.clear()
      input.current.touchX = 0
      input.current.touchZ = 0
      input.current.sprintHeld = false
      input.current.jumpQueued = false
      input.current.interactQueued = false
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return
      if (event.code === 'Escape' && !event.repeat) {
        pauseToggleRef.current()
        return
      }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
        input.current.keys.add(event.code)
      }
      if (event.code === 'Space') {
        event.preventDefault()
        if (!event.repeat) input.current.jumpQueued = true
      }
      if (event.code === 'KeyE' && !event.repeat) input.current.interactQueued = true
    }
    const onKeyUp = (event: KeyboardEvent) => input.current.keys.delete(event.code)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', clear)
    return () => {
      clear()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clear)
    }
  }, [])

  useEffect(() => {
    if (!paused) return
    input.current.keys.clear()
    input.current.touchX = 0
    input.current.touchZ = 0
    input.current.sprintHeld = false
  }, [paused])

  const setTouchMove = useCallback((x: number, z: number) => {
    input.current.touchX = Math.max(-1, Math.min(1, x))
    input.current.touchZ = Math.max(-1, Math.min(1, z))
  }, [])
  const setSprint = useCallback((held: boolean) => { input.current.sprintHeld = held }, [])
  const queueJump = useCallback(() => { input.current.jumpQueued = true }, [])
  const queueInteraction = useCallback(() => { input.current.interactQueued = true }, [])

  return useMemo(() => ({
    input,
    look,
    setTouchMove,
    setSprint,
    queueJump,
    queueInteraction,
  }), [queueInteraction, queueJump, setSprint, setTouchMove])
}

export interface UlamRiftCanvasProps {
  readonly state: UlamRiftState
  readonly dispatch: React.Dispatch<UlamRiftAction>
  readonly controls: UlamRiftControls
  readonly paused: boolean
  readonly reducedMotion: boolean
  readonly quality: QualityLevel
  readonly profile: QualityProfile
  readonly onTelemetry: (telemetry: UlamRiftTelemetry) => void
  readonly onInteraction: (label: string | null) => void
  readonly partyPeers: readonly RemotePlayer[]
  readonly samplePartyRemote: (playerId: string) => InterpolatedTransform | null
}

function UlamRiftCanvas({
  state,
  dispatch,
  controls,
  paused,
  reducedMotion,
  quality,
  profile,
  onTelemetry,
  onInteraction,
  partyPeers,
  samplePartyRemote,
}: UlamRiftCanvasProps): JSX.Element {
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null)
  const farPlane = quality === 'low' ? 100 : 150
  const dpr = useMemo<[number, number]>(
    () => quality === 'high' ? [1, 1.5] : profile.dpr,
    [profile.dpr, quality],
  )
  const camera = useMemo(
    () => ({ position: [0, 5.8, 22] as [number, number, number], fov: 58, near: 0.08, far: farPlane }),
    [farPlane],
  )
  const gl = useMemo(() => ({
    antialias: profile.antialias,
    alpha: false,
    powerPreference: 'high-performance' as const,
  }), [profile.antialias])

  const releasePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointer.current?.id !== event.pointerId) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    pointer.current = null
  }

  return (
    <div
      className="ulam-rift__canvas"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (event.button !== 0 || state.phase !== 'running') return
        pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!pointer.current || pointer.current.id !== event.pointerId) return
        const deltaX = event.clientX - pointer.current.x
        const deltaY = event.clientY - pointer.current.y
        pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
        controls.look.current.yaw -= deltaX * 0.0042
        controls.look.current.pitch = Math.max(-0.18, Math.min(0.42, controls.look.current.pitch + deltaY * 0.0032))
      }}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
    >
      <SceneBoundary>
        <Canvas
          aria-label="Travessia tridimensional da Fenda de Ulam"
          camera={camera}
          dpr={dpr}
          shadows={profile.shadows}
          frameloop={paused ? 'demand' : 'always'}
          gl={gl}
          fallback={<div className="ulam-rift__fallback" role="alert">A travessia 3D não pôde ser iniciada neste dispositivo.</div>}
        >
          <Suspense fallback={null}>
            <UlamRiftScene
              state={state}
              dispatch={dispatch}
              input={controls.input}
              look={controls.look}
              paused={paused}
              reducedMotion={reducedMotion}
              quality={quality}
              profile={profile}
              onTelemetry={onTelemetry}
              onInteraction={onInteraction}
            />
            <ExpeditionPartyAvatars
              peers={partyPeers}
              sampleRemote={samplePartyRemote}
              reducedMotion={reducedMotion}
            />
          </Suspense>
        </Canvas>
      </SceneBoundary>
    </div>
  )
}

function sameCanvasState(previous: UlamRiftState, next: UlamRiftState): boolean {
  return previous.phase === next.phase
    && previous.runSerial === next.runSerial
    && previous.nextPrimeIndex === next.nextPrimeIndex
    && previous.collectedTermIds === next.collectedTermIds
    && previous.activatedTowerIds === next.activatedTowerIds
    && previous.checkpointTowerId === next.checkpointTowerId
}

export default memo(UlamRiftCanvas, (previous, next) => (
  sameCanvasState(previous.state, next.state)
  && previous.dispatch === next.dispatch
  && previous.controls === next.controls
  && previous.paused === next.paused
  && previous.reducedMotion === next.reducedMotion
  && previous.quality === next.quality
  && previous.profile === next.profile
  && previous.onTelemetry === next.onTelemetry
  && previous.onInteraction === next.onInteraction
  && previous.partyPeers === next.partyPeers
  && previous.samplePartyRemote === next.samplePartyRemote
))
