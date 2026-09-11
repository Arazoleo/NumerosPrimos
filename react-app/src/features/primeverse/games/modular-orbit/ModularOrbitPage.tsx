import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useState } from 'react'

import { audioBus, type AudioCue } from '../../audio/audioBus'
import { useQualitySettings } from '../../graphics/useQualitySettings'
import { SceneBoundary } from '../../ui/SceneBoundary'
import { useDocumentTitle } from '../../useDocumentTitle'
import { getOrbitLaunchDuration } from './animation'
import { MODULAR_ORBIT_ROUNDS } from './modularOrbitLogic'
import { ModularOrbitHud } from './ModularOrbitHud'
import { ModularOrbitScene } from './ModularOrbitScene'
import { useModularOrbitStore } from './modularOrbitStore'
import type { OrbitSoundEvent } from './types'
import '../../primeverse.css'
import './modular-orbit.css'

const ORBIT_AUDIO_CUES: Record<OrbitSoundEvent, AudioCue> = {
  select: 'impact',
  launch: 'laser',
  miss: 'error',
  dock: 'correct',
  complete: 'complete',
}

function useReducedMotionPreference(): boolean {
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reducedMotion
}

export default function ModularOrbitPage(): JSX.Element {
  useDocumentTitle('Modular Orbit · Primeverse')
  const { quality, setQuality, profile } = useQualitySettings()
  const reducedMotion = useReducedMotionPreference()
  const pendingLaunch = useModularOrbitStore((state) => state.pendingLaunch)
  const roundIndex = useModularOrbitStore((state) => state.roundIndex)
  const resolveLaunch = useModularOrbitStore((state) => state.resolveLaunch)

  useEffect(() => {
    const reset = useModularOrbitStore.getState().returnToIntro
    reset()
    return reset
  }, [])

  useEffect(() => {
    if (!pendingLaunch) return undefined
    const duration = getOrbitLaunchDuration(pendingLaunch.trace.length, reducedMotion)
    const isFinalDock = pendingLaunch.isCorrect && roundIndex === MODULAR_ORBIT_ROUNDS - 1

    const timer = window.setTimeout(() => {
      resolveLaunch()
      audioBus.play(
        pendingLaunch.isCorrect ? (isFinalDock ? 'complete' : 'correct') : 'error',
      )
    }, duration)

    return () => window.clearTimeout(timer)
  }, [pendingLaunch, reducedMotion, resolveLaunch, roundIndex])

  const handleSound = useCallback((event: OrbitSoundEvent) => {
    audioBus.play(ORBIT_AUDIO_CUES[event])
  }, [])

  return (
    <main className="modular-orbit" data-quality={quality}>
      <div className="modular-orbit__canvas">
        <SceneBoundary>
          <Canvas
            aria-label="Órbita tridimensional de resíduos modulares"
            camera={{ position: [0, 0.4, 10.8], fov: 47, near: 0.1, far: 80 }}
            dpr={profile.dpr}
            gl={{
              antialias: profile.antialias,
              alpha: false,
              powerPreference: quality === 'low' ? 'low-power' : 'high-performance',
            }}
            fallback={
              <div className="modular-orbit__fallback" role="alert">
                Visualização 3D indisponível. O console de navegação continua funcional.
              </div>
            }
          >
            <Suspense fallback={null}>
              <ModularOrbitScene profile={profile} reducedMotion={reducedMotion} />
            </Suspense>
          </Canvas>
        </SceneBoundary>
      </div>
      <ModularOrbitHud
        quality={quality}
        onQualityChange={setQuality}
        onSoundEvent={handleSound}
      />
    </main>
  )
}
