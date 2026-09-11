import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'

import { audioBus, type AudioCue } from '../../audio/audioBus'
import { useQualitySettings } from '../../graphics/useQualitySettings'
import { SceneBoundary } from '../../ui/SceneBoundary'
import { useDocumentTitle } from '../../useDocumentTitle'
import { EscapeRoomHud } from './EscapeRoomHud'
import { EscapeRoomScene } from './EscapeRoomScene'
import { useBackroomsRuntime } from './backrooms'
import { resetEscapeInput } from './explorationInput'
import { useEscapeStore } from './escapeStore'
import type { EscapeSoundEvent } from './types'
import '../../primeverse.css'
import './crypto-escape.css'

const ESCAPE_AUDIO_CUES: Readonly<Record<EscapeSoundEvent, AudioCue>> = {
  discover: 'portal',
  inspect: 'impact',
  rotate: 'impact',
  error: 'error',
  unlock: 'correct',
  escape: 'complete',
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

/**
 * A full-screen liminal maze at device pixel ratio 2 quadruples the pixel cost on a
 * retina display for almost no visible gain, so the render scale is capped here.
 */
const MAX_ESCAPE_RENDER_SCALE = 1.55

export default function CryptoEscapePage(): JSX.Element {
  useDocumentTitle('Crypto Liminal · Primeverse')
  const { quality, setQuality, profile } = useQualitySettings()
  const reducedMotion = useReducedMotionPreference()
  const renderScale = useMemo<[number, number]>(
    () => [profile.dpr[0], Math.min(profile.dpr[1], MAX_ESCAPE_RENDER_SCALE)],
    [profile.dpr],
  )
  const lastSound = useEscapeStore((state) => state.lastSound)
  const playedSoundId = useRef(0)

  useEffect(() => {
    const returnToIntro = useEscapeStore.getState().returnToIntro
    returnToIntro()
    resetEscapeInput()

    return () => {
      resetEscapeInput()
      useBackroomsRuntime.getState().reset()
      returnToIntro()
    }
  }, [])

  useEffect(() => {
    if (!lastSound) {
      playedSoundId.current = 0
      return
    }
    if (lastSound.id === playedSoundId.current) return
    playedSoundId.current = lastSound.id
    audioBus.play(ESCAPE_AUDIO_CUES[lastSound.event])
  }, [lastSound])

  return (
    <main className="crypto-escape" data-quality={quality}>
      <div className="escape-room__canvas">
        <SceneBoundary>
          <Canvas
            aria-label="Labirinto liminal tridimensional com cinco setores e enigmas criptográficos"
            tabIndex={0}
            camera={{ position: [-38, 0.22, -26.6], fov: 61, near: 0.05, far: 100 }}
            dpr={renderScale}
            shadows={profile.shadows}
            gl={{
              antialias: profile.antialias && renderScale[1] <= 1.35,
              alpha: false,
              powerPreference: quality === 'low' ? 'low-power' : 'high-performance',
            }}
            fallback={(
              <div className="escape-room__fallback" role="alert">
                <strong>Visualização 3D indisponível.</strong>
                <span>Abra “Acessibilidade” para continuar pelos controles assistidos.</span>
              </div>
            )}
          >
            <Suspense fallback={null}>
              <EscapeRoomScene quality={quality} profile={profile} reducedMotion={reducedMotion} />
            </Suspense>
          </Canvas>
        </SceneBoundary>
      </div>
      <EscapeRoomHud quality={quality} onQualityChange={setQuality} />
    </main>
  )
}
