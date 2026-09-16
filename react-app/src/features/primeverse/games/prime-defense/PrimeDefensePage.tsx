import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useState } from 'react'

import { audioBus, type AudioCue } from '../../audio/audioBus'
import { useQualitySettings } from '../../graphics/useQualitySettings'
import { SceneBoundary } from '../../ui/SceneBoundary'
import { useDocumentTitle } from '../../useDocumentTitle'
import { getDefenseTravelDuration } from './animation'
import { PrimeDefenseHud } from './PrimeDefenseHud'
import { PrimeDefenseScene } from './PrimeDefenseScene'
import { usePrimeDefenseStore } from './defenseStore'
import type { DefenseSoundEvent } from './types'
import '../../primeverse.css'
import './prime-defense.css'

const DEFENSE_AUDIO_CUES: Readonly<Record<DefenseSoundEvent, AudioCue>> = {
  select: 'impact',
  place: 'impact',
  launch: 'laser',
  intercept: 'correct',
  prime: 'portal',
  breach: 'error',
  'wave-complete': 'portal',
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

export default function PrimeDefensePage(): JSX.Element {
  useDocumentTitle('Prime Defense · Primeverse')
  const { quality, setQuality, profile } = useQualitySettings()
  const reducedMotion = useReducedMotionPreference()
  const phase = usePrimeDefenseStore((state) => state.phase)
  const activeEnemyIndex = usePrimeDefenseStore((state) => state.activeEnemyIndex)
  const activeEnemyId = usePrimeDefenseStore(
    (state) => state.runQueue[state.activeEnemyIndex]?.id ?? null,
  )
  const resolveNextEnemy = usePrimeDefenseStore((state) => state.resolveNextEnemy)

  useEffect(() => {
    const returnToIntro = usePrimeDefenseStore.getState().returnToIntro
    returnToIntro()
    return returnToIntro
  }, [])

  useEffect(() => {
    if (phase !== 'running' || !activeEnemyId) return undefined

    const timer = window.setTimeout(() => {
      const outcome = resolveNextEnemy()
      if (!outcome) return
      const nextPhase = usePrimeDefenseStore.getState().phase

      if (nextPhase === 'victory') {
        audioBus.play('complete')
      } else if (outcome.kind === 'intercepted') {
        audioBus.play('correct')
      } else if (outcome.kind === 'prime-passed') {
        audioBus.play('portal')
      } else {
        audioBus.play('error')
      }
    }, getDefenseTravelDuration(reducedMotion) + 40)

    return () => window.clearTimeout(timer)
  }, [activeEnemyId, activeEnemyIndex, phase, reducedMotion, resolveNextEnemy])

  const handleSound = useCallback((event: DefenseSoundEvent) => {
    audioBus.play(DEFENSE_AUDIO_CUES[event])
  }, [])

  return (
    <main className="prime-defense" data-quality={quality}>
      <div className="prime-defense__canvas">
        <SceneBoundary>
          <Canvas
            aria-label="Arena tridimensional de defesa por divisibilidade"
            camera={{ position: [0, 9.4, 14.6], fov: 42, near: 0.1, far: 70 }}
            dpr={profile.dpr}
            shadows={profile.shadows}
            gl={{
              antialias: profile.antialias,
              alpha: false,
              powerPreference: quality === 'low' ? 'low-power' : 'high-performance',
            }}
            fallback={(
              <div className="prime-defense__fallback" role="alert">
                <strong>Arena 3D indisponível.</strong>
                <span>O tabuleiro estratégico abaixo continua totalmente funcional.</span>
              </div>
            )}
          >
            <Suspense fallback={null}>
              <PrimeDefenseScene profile={profile} reducedMotion={reducedMotion} />
            </Suspense>
          </Canvas>
        </SceneBoundary>
      </div>
      <PrimeDefenseHud
        quality={quality}
        onQualityChange={setQuality}
        onSoundEvent={handleSound}
      />
    </main>
  )
}