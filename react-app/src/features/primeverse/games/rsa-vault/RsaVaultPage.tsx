import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'

import { audioBus, type AudioCue } from '../../audio/audioBus'
import { useQualitySettings } from '../../graphics/useQualitySettings'
import { SceneBoundary } from '../../ui/SceneBoundary'
import { useDocumentTitle } from '../../useDocumentTitle'
import { RsaVaultHud } from './RsaVaultHud'
import { RsaVaultScene } from './RsaVaultScene'
import { useRsaVaultStore } from './rsaVaultStore'
import type { RsaVaultSoundEvent } from './types'
import '../../primeverse.css'
import './rsa-vault.css'

const RSA_AUDIO_CUES: Readonly<Record<RsaVaultSoundEvent, AudioCue>> = {
  select: 'impact',
  stage: 'correct',
  error: 'error',
  unlock: 'portal',
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

export default function RsaVaultPage(): JSX.Element {
  useDocumentTitle('RSA Vault · Primeverse')
  const { quality, setQuality, profile } = useQualitySettings()
  const reducedMotion = useReducedMotionPreference()
  const phase = useRsaVaultStore((state) => state.phase)
  const resolveVault = useRsaVaultStore((state) => state.resolveVault)
  const lastSound = useRsaVaultStore((state) => state.lastSound)
  const playedSoundId = useRef(0)

  useEffect(() => {
    const returnToIntro = useRsaVaultStore.getState().returnToIntro
    returnToIntro()
    return returnToIntro
  }, [])

  useEffect(() => {
    if (phase !== 'unlocking') return undefined
    const timer = window.setTimeout(resolveVault, reducedMotion ? 260 : 1_850)
    return () => window.clearTimeout(timer)
  }, [phase, reducedMotion, resolveVault])

  useEffect(() => {
    if (!lastSound || playedSoundId.current === lastSound.id) return
    playedSoundId.current = lastSound.id
    audioBus.play(RSA_AUDIO_CUES[lastSound.event])
  }, [lastSound])

  return (
    <main className="rsa-vault" data-quality={quality}>
      <div className="rsa-vault__canvas">
        <SceneBoundary>
          <Canvas
            aria-label="Cofre RSA tridimensional com anéis matemáticos"
            camera={{ position: [0, 0.1, 11.4], fov: 47, near: 0.1, far: 70 }}
            dpr={profile.dpr}
            shadows={profile.shadows}
            gl={{
              antialias: profile.antialias,
              alpha: false,
              powerPreference: quality === 'low' ? 'low-power' : 'high-performance',
            }}
            fallback={(
              <div className="rsa-vault__fallback" role="alert">
                <strong>Mecanismo 3D indisponível.</strong>
                <span>A bancada matemática abaixo continua totalmente funcional.</span>
              </div>
            )}
          >
            <Suspense fallback={null}>
              <RsaVaultScene quality={quality} profile={profile} reducedMotion={reducedMotion} />
            </Suspense>
          </Canvas>
        </SceneBoundary>
      </div>
      <RsaVaultHud quality={quality} onQualityChange={setQuality} />
    </main>
  )
}
