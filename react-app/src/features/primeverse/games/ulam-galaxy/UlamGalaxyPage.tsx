import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useState } from 'react'

import { useQualitySettings } from '../../graphics/useQualitySettings'
import { UlamGalaxyScene } from './UlamGalaxyScene'
import { useUlamGalaxyStore } from './ulamStore'
import { DEFAULT_VIEWPORT, ULAM_ZOOM, type UlamCellSelection, type UlamViewport } from './ulamInput'
import type { UlamCell } from './types'
import './ulam-galaxy.css'

export function UlamGalaxyPage(): JSX.Element {
  const { quality, profile, setQuality } = useQualitySettings()
  const [reducedMotion, setReducedMotion] = useState(false)
  const [selectedCell, setSelectedCell] = useState<UlamCellSelection | null>(null)
  const [viewport, setViewport] = useState<UlamViewport>(DEFAULT_VIEWPORT)

  const phase = useUlamGalaxyStore((state) => state.phase)
  const scanPath = useUlamGalaxyStore((state) => state.scanPath)
  const resetGame = useUlamGalaxyStore((state) => state.resetGame)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches)
    }

    setReducedMotion(mediaQuery.matches)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    } else {
      mediaQuery.addListener(handleChange)
      return () => mediaQuery.removeListener(handleChange)
    }
  }, [])

  const handlePan = useCallback((dx: number, dy: number) => {
    setViewport((prev) => ({
      ...prev,
      panX: prev.panX + dx,
      panY: prev.panY + dy,
    }))
  }, [])

  const handleZoom = useCallback((delta: number) => {
    setViewport((prev) => ({
      ...prev,
      zoom: Math.min(ULAM_ZOOM.max, Math.max(ULAM_ZOOM.min, prev.zoom + delta)),
    }))
  }, [])

  const handleResetViewport = useCallback(() => {
    setViewport(DEFAULT_VIEWPORT)
  }, [])

  const handleSelectCell = useCallback((cell: UlamCell) => {
    setSelectedCell({
      value: cell.value,
      x: cell.x,
      y: cell.y,
      prime: cell.prime,
    })
  }, [])

  return (
    <main className="ulam-galaxy" data-quality={quality}>
      <div className="ulam-canvas">
        <Canvas gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }}>
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
        </Canvas>
      </div>

      <div className="ulam-hud">
        <header className="ulam-topbar">
          <a href="#" className="ulam-brand">
            <span className="ulam-brand__mark">U</span>
            <span>
              <strong>GALÁXIA DE ULAM</strong>
              <small>RECONHECIMENTO DE PADRÕES</small>
            </span>
          </a>

          <div className="ulam-progress">
            <i className="done" />
            <i className="current" />
            <i />
            <span>FASE DE EXPLORAÇÃO</span>
          </div>

          <div className="ulam-topbar__actions">
            <div className="pv-quality">
              <select value={quality} onChange={(e) => setQuality(e.target.value as typeof quality)}>
                <option value="low">Baixo</option>
                <option value="medium">Médio</option>
                <option value="high">Alto</option>
              </select>
            </div>
            <button type="button" onClick={resetGame}>
              Reiniciar
            </button>
          </div>
        </header>

        <section className="ulam-console">
          <span className="ulam-console__label">CONSOLA DE NAVEGAÇÃO</span>
          <h2>
            Espiral Primária <em>Análise Numérica</em>
          </h2>
          <p>
            Selecione uma direção orbital para analisar densidades numéricas e padrões de primos.
          </p>

          <button
            type="button"
            className="ulam-primary ulam-scan"
            disabled={phase !== 'playing'}
            onClick={() => scanPath()}
          >
            Analisar Trajetória
          </button>

          {selectedCell && (
            <div className="ulam-selected-cell">
              Célula focada: <strong>#{selectedCell.value}</strong> ({selectedCell.x}, {selectedCell.y}) -{' '}
              {selectedCell.prime ? 'Primo' : 'Composto'}
            </div>
          )}

          <div className="ulam-viewport-controls">
            <span>ZOOM</span>
            <output>{Math.round(viewport.zoom * 100)}%</output>
            <button type="button" onClick={() => handleZoom(ULAM_ZOOM.step)}>
              +
            </button>
            <button type="button" onClick={() => handleZoom(-ULAM_ZOOM.step)}>
              -
            </button>
            <button type="button" onClick={handleResetViewport}>
              Reset
            </button>
          </div>

          <div className="ulam-device-hint">
            <span className="ulam-device-hint__mouse">
              Arraste para mover o mapa. Roda do mouse para zoom.
            </span>
            <span className="ulam-device-hint__touch">Arraste para mover. Toque nas células.</span>
            <span className="ulam-device-hint__keyboard">Teclas direcionais para atalhos.</span>
          </div>
        </section>
      </div>
    </main>
  )
}