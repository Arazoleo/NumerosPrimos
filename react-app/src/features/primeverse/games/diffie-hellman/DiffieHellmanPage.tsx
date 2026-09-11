import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'

import { audioBus, type AudioCue } from '../../audio/audioBus'
import { useQualitySettings } from '../../graphics/useQualitySettings'
import { SceneBoundary } from '../../ui/SceneBoundary'
import { useDocumentTitle } from '../../useDocumentTitle'
import { DiffieHellmanHud } from './DiffieHellmanHud'
import { DiffieHellmanScene } from './DiffieHellmanScene'
import { useDiffieHellmanStore } from './diffieHellmanStore'
import type { DiffieHellmanSoundEvent } from './types'
import '../../primeverse.css'
import './diffie-hellman.css'

const DH_AUDIO_CUES: Readonly<Record<DiffieHellmanSoundEvent, AudioCue>> = {
  select: 'impact',
  send: 'laser',
  error: 'error',
  secure: 'correct',
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

export default function DiffieHellmanPage(): JSX.Element {
  useDocumentTitle('Diffie–Hellman Relay · Primeverse')
  const { quality, setQuality, profile } = useQualitySettings()
  const reducedMotion = useReducedMotionPreference()
  const phase = useDiffieHellmanStore((state) => state.phase)
  const pendingPacket = useDiffieHellmanStore((state) => state.pendingPacket)
  const resolvePublicTransit = useDiffieHellmanStore((state) => state.resolvePublicTransit)
  const resolveSecretTransit = useDiffieHellmanStore((state) => state.resolveSecretTransit)
  const lastSound = useDiffieHellmanStore((state) => state.lastSound)
  const playedSoundId = useRef(0)

  useEffect(() => {
    const returnToIntro = useDiffieHellmanStore.getState().returnToIntro
    returnToIntro()
    return returnToIntro
  }, [])

  useEffect(() => {
    if (!pendingPacket) return undefined
    const duration = reducedMotion ? 220 : 1_320
    const timer = window.setTimeout(() => {
      if (phase === 'public-transit') resolvePublicTransit()
      if (phase === 'secret-transit') resolveSecretTransit()
    }, duration)
    return () => window.clearTimeout(timer)
  }, [pendingPacket, phase, reducedMotion, resolvePublicTransit, resolveSecretTransit])

  useEffect(() => {
    if (!lastSound) {
      playedSoundId.current = 0
      return
    }
    if (lastSound.id === playedSoundId.current) return
    playedSoundId.current = lastSound.id
    audioBus.play(DH_AUDIO_CUES[lastSound.event])
  }, [lastSound])

  return (
    <main className="diffie-hellman" data-quality={quality}>
      <div className="dh-canvas">
        <SceneBoundary>
          <Canvas
            aria-label="Relay tridimensional entre Alice e Bob observado por Eve"
            camera={{ position: [0, 1.2, 11.7], fov: 48, near: 0.1, far: 60 }}
            dpr={profile.dpr}
            shadows={profile.shadows}
            gl={{
              antialias: profile.antialias,
              alpha: false,
              powerPreference: quality === 'low' ? 'low-power' : 'high-performance',
            }}
            fallback={(
              <div className="dh-fallback" role="alert">
                <strong>Visualização 3D indisponível.</strong>
                <span>O protocolo textual abaixo continua totalmente jogável.</span>
              </div>
            )}
          >
            <Suspense fallback={null}>
              <DiffieHellmanScene profile={profile} reducedMotion={reducedMotion} />
            </Suspense>
          </Canvas>
        </SceneBoundary>
      </div>
      <DiffieHellmanHud quality={quality} onQualityChange={setQuality} />
    </main>
  )
}
