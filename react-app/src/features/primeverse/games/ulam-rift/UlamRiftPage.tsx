import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import { audioBus, type AudioCue } from '../../audio/audioBus'
import { useQualitySettings } from '../../graphics/useQualitySettings'
import { useDocumentTitle } from '../../useDocumentTitle'
import { ExpeditionPartyHud, usePrimeverseExpeditionParty } from '../primeverse-online/party'
import { createMusicDirector, startMusicOnFirstGesture } from '../../audio/proceduralMusic'
import { ULAM_RIFT_TRACK } from '../../audio/tracks'
import { useAudioResource } from '../../audio/useAudioResource'
import UlamRiftCanvas, { useUlamRiftControls } from './UlamRiftCanvas'
import UlamRiftHud from './UlamRiftHud'
import type { UlamRiftTelemetry } from './UlamRiftScene'
import {
  ULAM_RIFT_SPAWN,
  createUlamRiftState,
  sectorAtRiftPosition,
  ulamRiftReducer,
} from './ulamRiftLogic'
import './ulam-rift.css'

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ))
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}

function clock(): number {
  if (typeof performance !== 'undefined') return performance.now()
  return Date.now()
}

const INITIAL_TELEMETRY: UlamRiftTelemetry = {
  position: ULAM_RIFT_SPAWN,
  yaw: Math.PI,
  sector: sectorAtRiftPosition(ULAM_RIFT_SPAWN).name,
  speed: 0,
  grounded: false,
  objectiveDistance: 0,
}

export default function UlamRiftPage(): JSX.Element {
  useDocumentTitle('Fenda de Ulam · Primeverse')
  const { quality, setQuality, profile } = useQualitySettings()
  const reducedMotion = useReducedMotion()
  const [state, dispatch] = useReducer(ulamRiftReducer, undefined, () => createUlamRiftState())
  const [telemetry, setTelemetry] = useState<UlamRiftTelemetry>(INITIAL_TELEMETRY)
  const [interaction, setInteraction] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const playedFeedback = useRef(0)

  const togglePause = useCallback(() => {
    setPaused((current) => state.phase === 'running' ? !current : false)
  }, [state.phase])
  const controls = useUlamRiftControls(paused, togglePause)
  const party = usePrimeverseExpeditionParty('ulam-rift')
  const getMusic = useAudioResource(() => createMusicDirector(ULAM_RIFT_TRACK))

  useEffect(() => {
    if (state.phase !== 'running' || paused) {
      getMusic().stop()
      return undefined
    }
    void getMusic().start()
    return startMusicOnFirstGesture(getMusic())
  }, [getMusic, paused, state.phase])

  useEffect(() => {
    // Speed and airtime push the arrangement; the lead belongs to full flight.
    const pace = Math.min(1, telemetry.speed / 9.2)
    getMusic().setIntensity(0.18 + pace * 0.6 + (telemetry.grounded ? 0 : 0.2))
  }, [getMusic, telemetry.grounded, telemetry.speed])
  const sendPartyTransform = party.sendTransform

  const start = useCallback(() => {
    setPaused(false)
    dispatch({ type: 'start', nowMs: clock() })
  }, [])
  const restart = useCallback(() => {
    setPaused(false)
    setInteraction(null)
    dispatch({ type: 'restart', nowMs: clock() })
  }, [])

  useEffect(() => {
    if (!state.feedback || playedFeedback.current === state.feedback.serial) return undefined
    playedFeedback.current = state.feedback.serial
    const cue: AudioCue = state.feedback.kind === 'success'
      ? state.phase === 'won' ? 'complete' : 'correct'
      : state.feedback.kind === 'danger' ? 'error' : 'impact'
    audioBus.play(cue)
    const timer = window.setTimeout(
      () => dispatch({ type: 'clear-feedback', serial: state.feedback?.serial ?? -1 }),
      2_900,
    )
    return () => window.clearTimeout(timer)
  }, [state.feedback, state.phase])

  useEffect(() => {
    const animation = state.phase !== 'running' || paused
      ? 'idle'
      : !telemetry.grounded
        ? 'jump'
        : telemetry.speed > 7
          ? 'run'
          : telemetry.speed > 0.2 ? 'walk' : 'idle'
    sendPartyTransform(telemetry.position, telemetry.yaw, animation)
  }, [paused, sendPartyTransform, state.phase, telemetry])

  return (
    <main className="ulam-rift" data-quality={quality} data-phase={state.phase}>
      <UlamRiftCanvas
        state={state}
        dispatch={dispatch}
        controls={controls}
        paused={paused || state.phase !== 'running'}
        reducedMotion={reducedMotion}
        quality={quality}
        profile={profile}
        onTelemetry={setTelemetry}
        onInteraction={setInteraction}
        partyPeers={party.peers}
        samplePartyRemote={party.sampleRemote}
      />
      <UlamRiftHud
        state={state}
        telemetry={telemetry}
        interaction={interaction}
        paused={paused}
        quality={quality}
        onQualityChange={setQuality}
        onStart={start}
        onRestart={restart}
        onPauseChange={setPaused}
        onTouchMove={controls.setTouchMove}
        onSprint={controls.setSprint}
        onJump={controls.queueJump}
        onInteract={controls.queueInteraction}
      />
      <ExpeditionPartyHud party={party} className="pep-hud--ulam" />
    </main>
  )
}
