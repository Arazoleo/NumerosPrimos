import { Html } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useState } from 'react'

import { audioBus, type AudioCue } from '../../audio/audioBus'
import { useDocumentTitle } from '../../useDocumentTitle'
import { FactorForgeBoundary } from './FactorForgeBoundary'
import { FactorForgeHud } from './FactorForgeHud'
import { FactorForgeScene } from './FactorForgeScene'
import { useFactorForgeStore } from './factorForgeStore'
import type { ForgeQuality, ForgeSoundEvent } from './types'
import { QUALITY_SETTINGS, saveForgeQuality, useForgeQuality } from './useForgeQuality'
import './factor-forge.css'

const FORGE_AUDIO_CUES: Record<ForgeSoundEvent, AudioCue> = {
  select: 'impact',
  split: 'impact',
  invalid: 'error',
  prime: 'correct',
  complete: 'complete',
}

export interface FactorForgeProps {
  quality?: ForgeQuality
  onBack?: () => void
  onSoundEvent?: (event: ForgeSoundEvent) => void
}

export default function FactorForge({
  quality: requestedQuality,
  onBack,
  onSoundEvent,
}: FactorForgeProps): JSX.Element {
  useDocumentTitle('Factor Forge · Primeverse')
  const detectedQuality = useForgeQuality()
  const [manualQuality, setManualQuality] = useState<ForgeQuality | null>(null)
  const quality = manualQuality ?? requestedQuality ?? detectedQuality
  const settings = QUALITY_SETTINGS[quality]

  useEffect(() => {
    const reset = useFactorForgeStore.getState().returnToIntro
    reset()
    return reset
  }, [])
  const handleQualityChange = useCallback((nextQuality: ForgeQuality) => {
    setManualQuality(nextQuality)
    saveForgeQuality(nextQuality)
  }, [])
  const handleSoundEvent = useCallback((event: ForgeSoundEvent) => {
    audioBus.play(FORGE_AUDIO_CUES[event])
    onSoundEvent?.(event)
  }, [onSoundEvent])

  return (
    <main className="factor-forge" data-quality={quality}>
      <div className="factor-forge__canvas">
        <FactorForgeBoundary>
          <Canvas
            aria-hidden="true"
            camera={{ position: [0, 0.5, 11], fov: 46, near: 0.1, far: 110 }}
            dpr={[settings.dpr[0], settings.dpr[1]]}
            shadows={settings.shadows}
            gl={{
              antialias: quality !== 'low',
              alpha: false,
              powerPreference: quality === 'low' ? 'low-power' : 'high-performance',
            }}
            fallback={
              <div className="factor-forge__webgl-fallback" role="alert">
                A visualização 3D não está disponível neste dispositivo. Use o console para
                continuar a fatoração.
              </div>
            }
          >
            <Suspense
              fallback={
                <Html center>
                  <div className="factor-forge__loading">CALIBRANDO FORJA…</div>
                </Html>
              }
            >
              <FactorForgeScene quality={quality} />
            </Suspense>
          </Canvas>
        </FactorForgeBoundary>
      </div>
      <FactorForgeHud
        quality={quality}
        onQualityChange={handleQualityChange}
        onBack={onBack}
        onSoundEvent={handleSoundEvent}
      />
    </main>
  )
}
