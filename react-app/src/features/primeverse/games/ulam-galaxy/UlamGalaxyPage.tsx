import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { audioBus, type AudioCue } from '../../audio/audioBus'
import { useQualitySettings } from '../../graphics/useQualitySettings'
import { SceneBoundary } from '../../ui/SceneBoundary'
import { useDocumentTitle } from '../../useDocumentTitle'
import '../../primeverse.css'
import { UlamGalaxyHud } from './UlamGalaxyHud'
import { UlamGalaxyScene } from './UlamGalaxyScene'
import {
  actionFromKey,
  changeZoom,
  DEFAULT_VIEWPORT,
  moveCellSelection,
  moveViewport,
  resetViewport,
  type UlamCellSelection,
  type UlamInputAction,
  type UlamViewport,
} from './ulamInput'
import { createUlamSpiral } from './ulamLogic'
import { useUlamGalaxyStore } from './ulamStore'
import type { UlamCell, UlamSoundEvent } from './types'
import './ulam-galaxy.css'

const SOUND_CUES: Readonly<Record<UlamSoundEvent, AudioCue>> = {
  select: 'impact',
  scan: 'laser',
  error: 'error',
  correct: 'correct',
  complete: 'complete',
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update()

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update)
      return () => media.removeEventListener('change', update)
    }

    media.addListener(update)
    return () => media.removeListener(update)
  }, [])

  return reduced
}

function useUlamKeyboard(
  enabled: boolean,
  onAction: (action: UlamInputAction) => void,
): void {
  useEffect(() => {
    if (!enabled) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return
      }

      const action = actionFromKey(event.key)
      if (!action) return

      if (action.type !== 'confirm') event.preventDefault()
      onAction(action)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onAction])
}

export default function UlamGalaxyPage(): JSX.Element {
  useDocumentTitle('Ulam Galaxy · Primeverse')

  const { quality, setQuality, profile } = useQualitySettings()
  const reducedMotion = useReducedMotion()
  const phase = useUlamGalaxyStore((state) => state.phase)
  const mission = useUlamGalaxyStore((state) => state.mission)
  const pendingScan = useUlamGalaxyStore((state) => state.pendingScan)
  const lastSound = useUlamGalaxyStore((state) => state.lastSound)
  const playedSound = useRef(0)

  const [selectedCell, setSelectedCell] = useState<UlamCellSelection | null>(null)
  const [viewport, setViewport] = useState<UlamViewport>(DEFAULT_VIEWPORT)

  const cells = useMemo(() => createUlamSpiral(mission.size), [mission.size])

  useEffect(() => {
    const reset = useUlamGalaxyStore.getState().returnToIntro
    reset()
    return reset
  }, [])

  useEffect(() => {
    if (phase !== 'scanning' || !pendingScan) return undefined

    const timer = window.setTimeout(
      () => useUlamGalaxyStore.getState().resolveScan(),
      reducedMotion ? 180 : 1_050,
    )

    return () => window.clearTimeout(timer)
  }, [pendingScan, phase, reducedMotion])

  useEffect(() => {
    if (!lastSound) {
      playedSound.current = 0
      return
    }
    if (lastSound.id === playedSound.current) return

    playedSound.current = lastSound.id
    audioBus.play(SOUND_CUES[lastSound.event])
  }, [lastSound])

  useEffect(() => {
    if (phase === 'intro' || phase === 'round-complete' || phase === 'complete') {
      setSelectedCell(null)
      setViewport(resetViewport())
    }
  }, [phase])

  const handlePan = useCallback((dx: number, dy: number) => {
    setViewport((previous) => moveViewport(previous, dx, dy))
  }, [])

  const handleZoom = useCallback((delta: number) => {
    setViewport((previous) => changeZoom(previous, delta))
  }, [])

  const handleResetViewport = useCallback(() => {
    setViewport(resetViewport())
  }, [])

  const handleSelectCell = useCallback((cell: UlamCell) => {
    setSelectedCell({
      value: cell.value,
      x: cell.x,
      y: cell.y,
      prime: cell.prime,
    })
  }, [])

  const handleKeyboardAction = useCallback(
    (action: UlamInputAction) => {
      switch (action.type) {
        case 'move-cell':
          setSelectedCell((previous) =>
            moveCellSelection(cells, previous, action.dx, action.dy),
          )
          return
        case 'zoom':
          handleZoom(action.delta)
          return
        case 'reset-viewport':
          handleResetViewport()
          return
        case 'clear-cell':
          setSelectedCell(null)
          return
        case 'confirm':
          return
      }
    },
    [cells, handleResetViewport, handleZoom],
  )

  useUlamKeyboard(phase === 'playing' || phase === 'scanning', handleKeyboardAction)

  return (
    <main className="ulam-galaxy" data-quality={quality}>
      <div className="ulam-canvas">
        <SceneBoundary>
          <Canvas
            aria-label="Mapa tridimensional interativo da espiral de Ulam"
            camera={{ position: [0, 0, 11.6], fov: 44, near: 0.1, far: 60 }}
            dpr={profile.dpr}
            gl={{
              antialias: profile.antialias,
              alpha: false,
              powerPreference: quality === 'low' ? 'low-power' : 'high-performance',
            }}
            fallback={
              <div className="ulam-fallback" role="alert">
                Cena 3D indisponível. Use a leitura tabular para continuar a missão.
              </div>
            }
          >
            <Suspense fallback={null}>
              <UlamGalaxyScene
                quality={quality}
                profile={profile}
                reducedMotion={reducedMotion}
                selectedCell={selectedCell}
                onSelectCell={handleSelectCell}
                viewport={viewport}
                onPan={handlePan}
                onZoom={handleZoom}
              />
            </Suspense>
          </Canvas>
        </SceneBoundary>
      </div>

      <UlamGalaxyHud
        quality={quality}
        onQualityChange={setQuality}
        selectedCell={selectedCell}
        viewport={viewport}
        onZoom={handleZoom}
        onPan={handlePan}
        onResetViewport={handleResetViewport}
      />
    </main>
  )
}