import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { audioBus, type AudioCue } from '../../audio/audioBus'
import { useQualitySettings } from '../../graphics/useQualitySettings'
import { SceneBoundary } from '../../ui/SceneBoundary'
import { useDocumentTitle } from '../../useDocumentTitle'
import '../../primeverse.css'
import { UlamGalaxyHud } from './UlamGalaxyHud'
import { UlamGalaxyScene } from './UlamGalaxyScene'
import { createUlamSpiral } from './ulamLogic'
import {
  INITIAL_ULAM_VIEWPORT,
  actionFromKey,
  changeZoom,
  moveCellSelection,
  moveViewport,
  resetViewport,
  selectCell,
  type UlamCellSelection,
  type UlamInputAction,
  type UlamViewport,
} from './ulamInput'
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
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}

function useUlamKeyboard(
  enabled: boolean,
  onAction: (action: UlamInputAction) => void,
): void {
  useEffect(() => {
    if (!enabled) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
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
      if (['move-cell', 'zoom', 'reset-viewport', 'clear-cell'].includes(action.type)) {
        event.preventDefault()
      }
      onAction(action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, onAction])
}

export default function UlamGalaxyPage(): JSX.Element {
  useDocumentTitle('Ulam Galaxy · Primeverse')
  const { quality, setQuality, profile } = useQualitySettings()
  const reducedMotion = useReducedMotion()
  const phase = useUlamGalaxyStore((state) => state.phase)
  const pendingScan = useUlamGalaxyStore((state) => state.pendingScan)
  const lastSound = useUlamGalaxyStore((state) => state.lastSound)
  const playedSound = useRef(0)

  const [selectedCell, setSelectedCell] = useState<UlamCellSelection | null>(null)
  const [viewport, setViewport] = useState<UlamViewport>(INITIAL_ULAM_VIEWPORT)

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

  const handleSelectCell = useCallback((cell: UlamCell) => {
    const missionSize = useUlamGalaxyStore.getState().mission.size
    setSelectedCell(selectCell(createUlamSpiral(missionSize), cell.value))
  }, [])

  const handleZoom = useCallback((delta: number) => {
    setViewport((prev) => changeZoom(prev, delta))
  }, [])

  const handlePan = useCallback((dx: number, dy: number) => {
    setViewport((prev) => moveViewport(prev, dx, dy))
  }, [])

  const handleResetViewport = useCallback(() => {
    setViewport(resetViewport())
  }, [])

  const handleKeyboardAction = useCallback(
    (action: UlamInputAction) => {
      const state = useUlamGalaxyStore.getState()
      if (state.phase === 'intro' || state.phase === 'complete') return

      switch (action.type) {
        case 'move-cell': {
          const cells = createUlamSpiral(state.mission.size)
          setSelectedCell((current) => moveCellSelection(cells, current, action.dx, action.dy))
          break
        }
        case 'zoom':
          handleZoom(action.delta)
          break
        case 'reset-viewport':
          handleResetViewport()
          break
        case 'clear-cell':
          setSelectedCell(null)
          break
        case 'confirm':
          if (state.phase === 'playing' && state.selectedDirection) {
            state.scan()
          }
          break
        default:
          break
      }
    },
    [handleZoom, handleResetViewport],
  )

  useUlamKeyboard(phase === 'playing' || phase === 'scanning' || phase === 'round-complete', handleKeyboardAction)

  useEffect(() => {
    if (phase === 'intro' || phase === 'complete') {
      setSelectedCell(null)
      setViewport(INITIAL_ULAM_VIEWPORT)
    }
  }, [phase])

  return (
    <main className="ulam-galaxy" data-quality={quality}>
      <div className="ulam-canvas">
        <SceneBoundary>
          <Canvas
            aria-label="Mapa tridimensional interativo da espiral de Ulam"
            style={{ touchAction: 'none' }}
            camera={{ position: [0, 0, 11.6], fov: 44, near: 0.1, far: 60 }}
            dpr={profile.dpr}
            gl={{ antialias: profile.antialias, alpha: false, powerPreference: quality === 'low' ? 'low-power' : 'high-performance' }}
            fallback={<div className="ulam-fallback" role="alert">Cena 3D indisponível. Use a leitura tabular para continuar a missão.</div>}
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