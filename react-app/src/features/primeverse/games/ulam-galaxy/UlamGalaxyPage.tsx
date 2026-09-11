import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'

import { audioBus, type AudioCue } from '../../audio/audioBus'
import { useQualitySettings } from '../../graphics/useQualitySettings'
import { SceneBoundary } from '../../ui/SceneBoundary'
import { useDocumentTitle } from '../../useDocumentTitle'
import '../../primeverse.css'
import { UlamGalaxyHud } from './UlamGalaxyHud'
import { UlamGalaxyScene } from './UlamGalaxyScene'
import { useUlamGalaxyStore } from './ulamStore'
import type { UlamSoundEvent } from './types'
import './ulam-galaxy.css'

const SOUND_CUES: Readonly<Record<UlamSoundEvent, AudioCue>> = {
  select: 'impact',
  scan: 'laser',
  error: 'error',
  correct: 'correct',
  complete: 'complete',
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}

export default function UlamGalaxyPage(): JSX.Element {
  useDocumentTitle('Ulam Galaxy · Primeverse')
  const { quality, setQuality, profile } = useQualitySettings()
  const reducedMotion = useReducedMotion()
  const phase = useUlamGalaxyStore((state) => state.phase)
  const pendingScan = useUlamGalaxyStore((state) => state.pendingScan)
  const lastSound = useUlamGalaxyStore((state) => state.lastSound)
  const playedSound = useRef(0)

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

  return (
    <main className="ulam-galaxy" data-quality={quality}>
      <div className="ulam-canvas">
        <SceneBoundary>
          <Canvas
            aria-label="Mapa tridimensional interativo da espiral de Ulam"
            camera={{ position: [0, 0, 11.6], fov: 44, near: 0.1, far: 60 }}
            dpr={profile.dpr}
            gl={{ antialias: profile.antialias, alpha: false, powerPreference: quality === 'low' ? 'low-power' : 'high-performance' }}
            fallback={<div className="ulam-fallback" role="alert">Cena 3D indisponível. Use a leitura tabular para continuar a missão.</div>}
          >
            <Suspense fallback={null}>
              <UlamGalaxyScene quality={quality} profile={profile} reducedMotion={reducedMotion} />
            </Suspense>
          </Canvas>
        </SceneBoundary>
      </div>
      <UlamGalaxyHud quality={quality} onQualityChange={setQuality} />
    </main>
  )
}
