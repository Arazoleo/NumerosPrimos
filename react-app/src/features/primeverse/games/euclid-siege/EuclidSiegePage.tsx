import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useQualitySettings } from '../../graphics/useQualitySettings'
import { SceneBoundary } from '../../ui/SceneBoundary'
import { useDocumentTitle } from '../../useDocumentTitle'
import { ExpeditionPartyAvatars, ExpeditionPartyHud, usePrimeverseExpeditionParty } from '../primeverse-online/party'
import { createMusicDirector, startMusicOnFirstGesture } from '../../audio/proceduralMusic'
import { EUCLID_SIEGE_TRACK } from '../../audio/tracks'
import { useAudioResource } from '../../audio/useAudioResource'
import GameIntro from '../../ui/GameIntro'
import EuclidSiegeHud, { type SiegeMoveDirection } from './EuclidSiegeHud'
import EuclidSiegeScene, {
  createMutableSiegeControls,
  queueSiegeAction,
  type SiegeQueuedAction,
} from './EuclidSiegeScene'
import {
  createSiegeState,
  formatSiegeTime,
  type SiegePrime,
  type SiegeState,
} from './siegeLogic'
import './euclid-siege.css'

type EuclidSiegePagePhase = 'intro' | 'playing' | 'paused' | 'victory' | 'defeat'

function useReducedMotionPreference(): boolean {
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

function EuclidSigil(): JSX.Element {
  return (
    <span className="euclid-sigil" aria-hidden="true">
      <i /><b>∏</b><i />
    </span>
  )
}

export default function EuclidSiegePage(): JSX.Element {
  useDocumentTitle('Cerco de Euclides · Fortaleza Áurea')
  const { quality, setQuality, profile } = useQualitySettings()
  const reducedMotion = useReducedMotionPreference()
  const [phase, setPhase] = useState<EuclidSiegePagePhase>('intro')
  const [runKey, setRunKey] = useState(0)
  const stateRef = useRef<SiegeState>(createSiegeState())
  const controls = useRef(createMutableSiegeControls())
  const touchDirections = useRef(new Set<SiegeMoveDirection>())
  const [snapshot, setSnapshot] = useState<SiegeState>(stateRef.current)
  const getMusic = useAudioResource(() => createMusicDirector(EUCLID_SIEGE_TRACK))

  useEffect(() => {
    if (phase !== 'playing') {
      getMusic().stop()
      return undefined
    }
    void getMusic().start()
    return startMusicOnFirstGesture(getMusic())
  }, [getMusic, phase])

  useEffect(() => {
    // Every wave raises the floor; a bleeding forge and a crowded wall raise the rest.
    const forge = snapshot.forgeMaxHp > 0 ? 1 - snapshot.forgeHp / snapshot.forgeMaxHp : 0
    const pressure = Math.min(1, snapshot.enemies.length / 8)
    getMusic().setIntensity(Math.min(1, 0.2 + snapshot.waveIndex * 0.14 + forge * 0.3 + pressure * 0.3))
  }, [getMusic, snapshot.enemies.length, snapshot.forgeHp, snapshot.forgeMaxHp, snapshot.waveIndex])
  const [result, setResult] = useState<SiegeState | null>(null)
  const modalRef = useRef<HTMLElement>(null)
  const party = usePrimeverseExpeditionParty('euclid-siege')
  const sendPartyTransform = party.sendTransform

  useEffect(() => {
    if (phase !== 'paused' && phase !== 'victory' && phase !== 'defeat') return undefined
    const modal = modalRef.current
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    modal?.querySelector<HTMLElement>('button, a[href]')?.focus()
    return () => {
      if (previous?.isConnected) previous.focus()
    }
  }, [phase])

  const clearControls = useCallback(() => {
    controls.current = createMutableSiegeControls()
    touchDirections.current.clear()
  }, [])

  const beginSiege = useCallback(() => {
    const fresh = createSiegeState()
    stateRef.current = fresh
    clearControls()
    setSnapshot(fresh)
    setResult(null)
    setRunKey((value) => value + 1)
    setPhase('playing')
  }, [clearControls])

  const togglePause = useCallback(() => {
    setPhase((current) => current === 'playing' ? 'paused' : current === 'paused' ? 'playing' : current)
  }, [])

  const handleSelectPrime = useCallback((prime: SiegePrime) => {
    controls.current.selectedPrime = prime
  }, [])

  const handleAction = useCallback((action: SiegeQueuedAction) => {
    queueSiegeAction(controls.current, action)
  }, [])

  const handleMove = useCallback((direction: SiegeMoveDirection, active: boolean) => {
    if (active) touchDirections.current.add(direction)
    else touchDirections.current.delete(direction)
    controls.current.moveX = (touchDirections.current.has('right') ? 1 : 0) - (touchDirections.current.has('left') ? 1 : 0)
    controls.current.moveZ = (touchDirections.current.has('down') ? 1 : 0) - (touchDirections.current.has('up') ? 1 : 0)
  }, [])

  const handleGuard = useCallback((guarding: boolean) => {
    controls.current.guarding = guarding
  }, [])

  const finish = useCallback((ending: 'victory' | 'defeat', state: SiegeState) => {
    clearControls()
    setSnapshot(state)
    setResult(state)
    setPhase(ending)
  }, [clearControls])

  useEffect(() => {
    const moving = Math.hypot(controls.current.moveX, controls.current.moveZ) > 0.1
    sendPartyTransform(
      [snapshot.player.position[0], 0.05, snapshot.player.position[1]],
      snapshot.player.yaw,
      phase === 'playing' && moving ? 'run' : 'idle',
    )
  }, [phase, sendPartyTransform, snapshot.player.position, snapshot.player.yaw])

  if (phase === 'intro') {
    return (
      <main className="euclid-siege euclid-siege--intro">
        <GameIntro
          title="Cerco de Euclides"
          emphasis="de Euclides"
          instruction="Seis portas se romperam. Fatore os escudos compostos com os primos certos e mantenha o coração da forja vivo por cinco ondas."
          actionLabel="Assumir a muralha"
          accent="#ffba6c"
          mark="210"
          keys="WASD mover · 1–6 escolher primo · F fatorar · J lâmina · Q pulso · E égide"
          backTo="/jogos/primeverse-online"
          backLabel="Primeverse Online"
          onStart={beginSiege}
        >
          <label className="euclid-intro__quality">QUALIDADE
            <select value={quality} onChange={(event) => setQuality(event.target.value as typeof quality)}>
              <option value="low">LOW</option><option value="medium">MID</option><option value="high">HIGH</option>
            </select>
          </label>
        </GameIntro>
        <ExpeditionPartyHud party={party} className="pep-hud--euclid" />
      </main>
    )
  }

  const terminal = phase === 'victory' || phase === 'defeat'

  return (
    <main className={`euclid-siege euclid-siege--game euclid-siege--${phase}`} data-quality={quality}>
      <SceneBoundary>
        <Canvas
          key={runKey}
          className="euclid-siege__canvas"
          camera={{ fov: 50, near: 0.1, far: 210, position: [0, 38, 41] }}
          dpr={profile.dpr}
          shadows={profile.shadows}
          gl={{ antialias: profile.antialias, alpha: false, powerPreference: 'high-performance' }}
        >
          <EuclidSiegeScene
            stateRef={stateRef}
            controls={controls}
            paused={phase !== 'playing'}
            quality={quality}
            reducedMotion={reducedMotion}
            onSnapshot={setSnapshot}
            onVictory={(state) => finish('victory', state)}
            onDefeat={(state) => finish('defeat', state)}
            onPauseRequest={togglePause}
          />
          <ExpeditionPartyAvatars
            peers={party.peers}
            sampleRemote={party.sampleRemote}
            reducedMotion={reducedMotion}
          />
        </Canvas>
      </SceneBoundary>

      {!terminal && (
        <EuclidSiegeHud
          state={snapshot}
          quality={quality}
          onQualityChange={setQuality}
          onSelectPrime={handleSelectPrime}
          onAction={handleAction}
          onGuardChange={handleGuard}
          onMove={handleMove}
          onPause={togglePause}
        />
      )}
      <ExpeditionPartyHud party={party} className="pep-hud--euclid" />

      {phase === 'paused' && (
        <div className="euclid-modal-layer">
          <section ref={modalRef} className="euclid-modal" role="dialog" aria-modal="true" aria-labelledby="euclid-pause-title">
            <EuclidSigil />
            <p>PROTOCOLO SUSPENSO</p>
            <h2 id="euclid-pause-title">A muralha aguarda.</h2>
            <span>A simulação, as ondas e todos os cooldowns estão congelados.</span>
            <button type="button" className="primary" onClick={togglePause}>RETOMAR O CERCO <b>→</b></button>
            <button type="button" onClick={beginSiege}>REINICIAR CAMPANHA</button>
            <Link to="/jogos/primeverse-online">VOLTAR AO PRIMEVERSE ONLINE</Link>
          </section>
        </div>
      )}

      {terminal && result && (
        <div className={`euclid-ending euclid-ending--${phase}`}>
          <section ref={modalRef} className="euclid-ending__panel" role="dialog" aria-modal="true" aria-labelledby="euclid-ending-title">
            <EuclidSigil />
            <p>{phase === 'victory' ? 'TEOREMA PRESERVADO' : 'FORTALEZA ROMPIDA'}</p>
            <h2 id="euclid-ending-title">
              {phase === 'victory' ? <>A forja<br /><em>permanece irredutível.</em></> : <>Os compostos<br /><em>tomaram a muralha.</em></>}
            </h2>
            <span>{phase === 'victory'
              ? 'O Titã 210 foi decomposto em 2 × 3 × 5 × 7. As seis portas voltaram a responder ao coração de Euclides.'
              : 'O protocolo registrou todos os fatores encontrados. Reorganize a defesa e tente interceptar os invasores mais cedo.'}</span>
            <div className="euclid-ending__stats">
              <div><small>PONTUAÇÃO</small><strong>{result.score.toLocaleString('pt-BR')}</strong></div>
              <div><small>ONDAS</small><strong>{Math.max(0, result.waveIndex + 1)}/5</strong></div>
              <div><small>ABATES</small><strong>{result.kills}</strong></div>
              <div><small>MELHOR CADEIA</small><strong>×{result.bestCombo}</strong></div>
              <div><small>FORJA</small><strong>{Math.ceil(result.forgeHp)}/{result.forgeMaxHp}</strong></div>
              <div><small>TEMPO</small><strong>{formatSiegeTime(result.elapsedMs)}</strong></div>
            </div>
            <div className="euclid-ending__actions">
              <button type="button" onClick={beginSiege}>{phase === 'victory' ? 'DEFENDER NOVAMENTE' : 'RECONSTRUIR E TENTAR'} <b>↗</b></button>
              <Link to="/jogos/primeverse-online">VOLTAR AO PRIMEVERSE ONLINE</Link>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
