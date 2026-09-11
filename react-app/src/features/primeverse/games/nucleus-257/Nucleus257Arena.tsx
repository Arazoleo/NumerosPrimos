import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'

import type { QualityLevel, QualityProfile } from '../../graphics/useQualitySettings'
import { SceneBoundary } from '../../ui/SceneBoundary'
import QualityControl from '../../ui/QualityControl'
import type { PrimeverseExpeditionParty } from '../primeverse-online/party'
import { PYLON_SEQUENCE, RESPAWN_DELAY_MS } from './arenaLogic'
import { createMusicDirector, startMusicOnFirstGesture } from '../../audio/proceduralMusic'
import { useAudioResource } from '../../audio/useAudioResource'
import { NUCLEUS_TRACK } from '../../audio/tracks'
import { getHeroKit } from './classKits'
import {
  parseDefeatPresentation,
  respawnPhaseLabel,
  respawnProgress,
  type DefeatPresentation,
} from './defeatPresentation'
import { canUseNucleusOnlineControls, cinematicLocksArenaControls } from './nucleusMultiplayer'
import Nucleus257Scene, {
  NUCLEUS_MATCH_DURATION_MS,
  createArenaControls,
  createInitialArenaSnapshot,
  type ArenaControls,
  type ArenaEnding,
  type ArenaHudSnapshot,
  type ArenaLook,
} from './Nucleus257Scene'
import type { AbilityDefinition, AbilitySlot, HeroId } from './types'
import { useNucleusMultiplayer } from './useNucleusMultiplayer'

interface Nucleus257ArenaProps {
  readonly heroId: HeroId
  readonly quality: QualityLevel
  readonly profile: QualityProfile
  readonly party: PrimeverseExpeditionParty
  readonly onQualityChange: (quality: QualityLevel) => void
  readonly onExit: () => void
}

interface ArenaResult {
  readonly ending: ArenaEnding
  readonly snapshot: ArenaHudSnapshot
}

const SLOT_KEY: Readonly<Record<AbilitySlot, string>> = {
  primary: 'M1',
  signature: 'Q',
  mobility: 'E',
  ultimate: 'R',
}

const ROLE_LABEL = {
  controller: 'CONTROLADORA',
  tank: 'VANGUARDA',
  assault: 'ASSALTO',
  infiltrator: 'INFILTRADORA',
} as const

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

function formatTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1_000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function percent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  return Math.max(0, Math.min(100, value / max * 100))
}

function cooldownStyle(remaining: number, total: number): CSSProperties {
  return { '--cooldown': `${percent(remaining, total)}%` } as CSSProperties
}

function valueStyle(value: number): CSSProperties {
  return { '--value': `${Math.max(0, Math.min(100, value))}%` } as CSSProperties
}

function objectiveStyle(progress: number): CSSProperties {
  return { '--progress': `${Math.max(0, Math.min(100, progress * 100))}%` } as CSSProperties
}

function damageStyle(degrees: number): CSSProperties {
  return { '--damage-bearing': `${degrees}deg` } as CSSProperties
}

function statusLabel(id: string, magnitude: number): string | null {
  if (id === 'cloaked') return 'CAMUFLAGEM'
  if (id === 'damage-guard') return `ANTI-RAJADA ${Math.round(magnitude * 100)}%`
  if (id === 'reflecting') return `REFLEXÃO ${Math.round(magnitude * 100)}%`
  if (id === 'silenced') return 'SILENCIADO'
  if (id === 'slowed') return 'DESACELERADO'
  if (id === 'marked') return 'MARCA PRIMA'
  if (id === 'revealed') return 'REVELADO'
  if (id === 'spawn-protected') return 'PROTEÇÃO DE SPAWN'
  if (id === 'shield-recharging') return 'ESCUDO RECOMPONDO'
  return null
}

export default function Nucleus257Arena({
  heroId,
  quality,
  profile,
  party,
  onQualityChange,
  onExit,
}: Nucleus257ArenaProps): JSX.Element {
  const multiplayer = useNucleusMultiplayer(party, heroId)
  // A running online match never silently turns into a local bot simulation
  // when its socket drops. Re-entering the arena starts a fresh mode choice.
  const arenaMode = useRef(multiplayer.mode).current
  const arenaMultiplayer = useMemo(() => ({ ...multiplayer, mode: arenaMode }), [arenaMode, multiplayer])
  const reducedMotion = useReducedMotion()
  const shellRef = useRef<HTMLDivElement>(null)
  const controls = useRef<ArenaControls>(createArenaControls())
  const look = useRef<ArenaLook>({ yaw: 0, pitch: -0.04 })
  const touchLook = useRef({ pointerId: -1, x: 0, y: 0 })
  const desktopPointerSession = useRef(false)
  const cinematicTimer = useRef<number | null>(null)
  const [runKey, setRunKey] = useState(1)
  const [snapshot, setSnapshot] = useState<ArenaHudSnapshot>(() => {
    const initial = createInitialArenaSnapshot(heroId, arenaMode === 'online' ? multiplayer.getServerNow() : performance.now())
    return arenaMode === 'online'
      ? {
          ...initial,
          online: true,
          onlinePhase: 'connecting',
          connectedPlayers: 0,
          message: 'CONECTANDO AO COMBATE AUTORITATIVO...',
          messageUntil: Number.POSITIVE_INFINITY,
        }
      : initial
  })
  const getMusic = useAudioResource(() => createMusicDirector(NUCLEUS_TRACK))
  const [paused, setPaused] = useState(false)
  const [engaged, setEngaged] = useState(false)
  const [captured, setCaptured] = useState(false)
  const [result, setResult] = useState<ArenaResult | null>(null)
  const [cinematic, setCinematic] = useState<AbilityDefinition | null>(null)
  const lastAlive = useRef(snapshot.player.alive)
  const [defeat, setDefeat] = useState<DefeatPresentation | null>(null)
  const [reformingUntil, setReformingUntil] = useState(0)
  const activeHero = useMemo(() => getHeroKit(snapshot.player.heroId), [snapshot.player.heroId])
  const arenaControlsReady = arenaMode !== 'online'
    || canUseNucleusOnlineControls(multiplayer.ready, multiplayer.connectionStatus)
  const cinematicLocksControls = cinematicLocksArenaControls(arenaMode, cinematic !== null)

  // Soundtrack: starts with the first engagement and tracks how hot the fight is.
  useEffect(() => {
    if (engaged && !paused && !result) void getMusic().start()
    else if (paused || result) getMusic().stop()
  }, [engaged, getMusic, paused, result])

  useEffect(() => {
    if (!engaged) return undefined
    return startMusicOnFirstGesture(getMusic())
  }, [engaged, getMusic])

  useEffect(() => {
    const player = snapshot.player
    const health = player.maxHealth > 0 ? player.health / player.maxHealth : 1
    const threat = Math.min(1, snapshot.livingEnemies / 3)
    const pressure = (1 - health) * 0.45
      + threat * 0.35
      + (snapshot.playerInsideObjective ? 0.18 : 0)
      + (snapshot.captureContested ? 0.14 : 0)
      + (player.ultimateCharge >= 100 ? 0.18 : 0)
    // The last pylon of the sequence is the finale: full band regardless.
    const finale = snapshot.activePrime === 7 && snapshot.playerInsideObjective ? 1 : 0
    getMusic().setIntensity(player.alive ? Math.max(finale, Math.min(1, 0.24 + pressure)) : 0.15)
  }, [getMusic, snapshot])

  useEffect(() => {
    if (!arenaControlsReady) return
    const position = snapshot.player.position
    const keys = controls.current.keys
    const moving = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
      .some((code) => keys.has(code))
    const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight')
    const animation = !snapshot.player.alive
      ? 'idle'
      : position.y > 0.2 ? 'jump' : moving ? sprinting ? 'run' : 'walk' : 'idle'
    party.sendTransform(
      [position.x, position.y, position.z],
      look.current.yaw,
      animation,
    )
  }, [arenaControlsReady, party, snapshot.player])

  const clearControls = useCallback(() => {
    controls.current.keys.clear()
    controls.current.primaryHeld = false
  }, [])

  useEffect(() => {
    const alive = snapshot.player.alive
    if (lastAlive.current && !alive) {
      clearControls()
      setDefeat(parseDefeatPresentation(snapshot.message))
      setReformingUntil(0)
    } else if (!alive && (
      snapshot.message.includes('FATORADO POR ')
      || snapshot.message.includes('VETOR FOI REFLETIDO')
    )) {
      // The authoritative state and its combat event can arrive on adjacent
      // frames. Refresh the dossier when the precise attacker arrives later.
      const parsed = parseDefeatPresentation(snapshot.message)
      setDefeat((current) => (
        current?.headline === parsed.headline
        && current.source === parsed.source
        && current.cause === parsed.cause
          ? current
          : parsed
      ))
    } else if (!lastAlive.current && alive) {
      setReformingUntil(snapshot.nowMs + (reducedMotion ? 250 : 900))
    }
    lastAlive.current = alive
  }, [clearControls, reducedMotion, snapshot.message, snapshot.nowMs, snapshot.player.alive])

  useEffect(() => {
    if (!arenaControlsReady) clearControls()
  }, [arenaControlsReady, clearControls])

  const exitPointerLock = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock?.()
  }, [])

  const capturePointer = useCallback(() => {
    if (paused || result || cinematicLocksControls || !arenaControlsReady) return
    const canvas = shellRef.current?.querySelector('canvas')
    if (!canvas || typeof canvas.requestPointerLock !== 'function') return
    if (document.pointerLockElement === canvas) {
      setEngaged(true)
      return
    }
    const request = canvas.requestPointerLock()
    request?.catch?.(() => {
      setCaptured(false)
      setEngaged(false)
    })
  }, [arenaControlsReady, cinematicLocksControls, paused, result])

  const queueAbility = useCallback((slot: AbilitySlot) => {
    if (paused || result || cinematicLocksControls || !snapshot.player.alive || !arenaControlsReady) return
    if (slot === 'primary') controls.current.primaryPulse += 1
    else if (slot === 'signature') controls.current.signaturePulse += 1
    else if (slot === 'mobility') controls.current.mobilityPulse += 1
    else controls.current.ultimatePulse += 1
  }, [arenaControlsReady, cinematicLocksControls, paused, result, snapshot.player.alive])

  const togglePause = useCallback(() => {
    setPaused((current) => {
      const next = !current
      if (next) {
        clearControls()
        exitPointerLock()
      }
      return next
    })
  }, [clearControls, exitPointerLock])

  const restart = useCallback(() => {
    clearControls()
    exitPointerLock()
    controls.current = createArenaControls()
    look.current = { yaw: 0, pitch: -0.04 }
    setSnapshot(createInitialArenaSnapshot(heroId, performance.now()))
    setResult(null)
    setPaused(false)
    setEngaged(false)
    setCinematic(null)
    lastAlive.current = true
    setDefeat(null)
    setReformingUntil(0)
    setRunKey((current) => current + 1)
  }, [clearControls, exitPointerLock, heroId])

  const beginCinematic = useCallback((ability: AbilityDefinition) => {
    if (arenaMode === 'solo') clearControls()
    setCinematic(ability)
    if (cinematicTimer.current !== null) window.clearTimeout(cinematicTimer.current)
    cinematicTimer.current = window.setTimeout(() => setCinematic(null), reducedMotion ? 300 : 1_900)
  }, [arenaMode, clearControls, reducedMotion])

  const finishArena = useCallback((ending: ArenaEnding, finalSnapshot: ArenaHudSnapshot) => {
    clearControls()
    exitPointerLock()
    setResult((current) => current ?? { ending, snapshot: finalSnapshot })
  }, [clearControls, exitPointerLock])

  const exitArena = useCallback(() => {
    multiplayer.leave()
    onExit()
  }, [multiplayer, onExit])

  useEffect(() => () => {
    if (cinematicTimer.current !== null) window.clearTimeout(cinematicTimer.current)
    exitPointerLock()
  }, [exitPointerLock])

  useEffect(() => {
    const pointerLockChanged = () => {
      const canvas = shellRef.current?.querySelector('canvas')
      const locked = Boolean(canvas && document.pointerLockElement === canvas)
      setCaptured(locked)
      if (locked) {
        desktopPointerSession.current = true
        setEngaged(true)
        return
      }
      clearControls()
      if (desktopPointerSession.current) {
        desktopPointerSession.current = false
        setEngaged(false)
      }
    }
    const mouseMove = (event: MouseEvent) => {
      const canvas = shellRef.current?.querySelector('canvas')
      if (!canvas || document.pointerLockElement !== canvas || paused || result || cinematicLocksControls) return
      look.current.yaw -= event.movementX * 0.00225
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - event.movementY * 0.00195, -1.18, 1.05)
    }
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('input, select, textarea, [contenteditable="true"]')) return
      if (cinematicLocksControls) return
      if (event.code === 'KeyP' && !event.repeat) {
        event.preventDefault()
        togglePause()
        return
      }
      if (paused || result || !snapshot.player.alive || !arenaControlsReady) return
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyQ', 'KeyE', 'KeyR'].includes(event.code)) event.preventDefault()
      controls.current.keys.add(event.code)
      if (event.repeat) return
      if (event.code === 'Space') controls.current.jumpPulse += 1
      if (event.code === 'KeyQ') queueAbility('signature')
      if (event.code === 'KeyE') queueAbility('mobility')
      if (event.code === 'KeyR') queueAbility('ultimate')
    }
    const keyUp = (event: KeyboardEvent) => controls.current.keys.delete(event.code)
    const mouseDown = (event: MouseEvent) => {
      const canvas = shellRef.current?.querySelector('canvas')
      if (!canvas || document.pointerLockElement !== canvas || event.button !== 0 || cinematicLocksControls || !snapshot.player.alive || !arenaControlsReady) return
      controls.current.primaryHeld = true
    }
    const mouseUp = (event: MouseEvent) => {
      if (event.button === 0) controls.current.primaryHeld = false
    }
    const preventMenu = (event: MouseEvent) => {
      const canvas = shellRef.current?.querySelector('canvas')
      if (event.target === canvas) event.preventDefault()
    }
    const blur = () => clearControls()

    document.addEventListener('pointerlockchange', pointerLockChanged)
    document.addEventListener('mousemove', mouseMove)
    document.addEventListener('keydown', keyDown, { passive: false })
    document.addEventListener('keyup', keyUp)
    document.addEventListener('mousedown', mouseDown)
    document.addEventListener('mouseup', mouseUp)
    document.addEventListener('contextmenu', preventMenu)
    window.addEventListener('blur', blur)
    return () => {
      document.removeEventListener('pointerlockchange', pointerLockChanged)
      document.removeEventListener('mousemove', mouseMove)
      document.removeEventListener('keydown', keyDown)
      document.removeEventListener('keyup', keyUp)
      document.removeEventListener('mousedown', mouseDown)
      document.removeEventListener('mouseup', mouseUp)
      document.removeEventListener('contextmenu', preventMenu)
      window.removeEventListener('blur', blur)
    }
  }, [arenaControlsReady, cinematicLocksControls, clearControls, paused, queueAbility, result, snapshot.player.alive, togglePause])

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (cinematicLocksControls || !arenaControlsReady) return
    const target = event.target
    if (target instanceof Element && target.closest('button, a, select')) return
    if (event.pointerType === 'mouse') {
      capturePointer()
      return
    }
    touchLook.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    setEngaged(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (touchLook.current.pointerId !== event.pointerId || paused || result || cinematicLocksControls) return
    const dx = event.clientX - touchLook.current.x
    const dy = event.clientY - touchLook.current.y
    touchLook.current.x = event.clientX
    touchLook.current.y = event.clientY
    look.current.yaw -= dx * 0.006
    look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - dy * 0.0048, -1.05, 0.95)
  }

  const releaseTouchLook = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (touchLook.current.pointerId === event.pointerId) touchLook.current.pointerId = -1
  }

  const setMobileMove = (code: string, held: boolean) => {
    if (held) {
      if (cinematicLocksControls || !snapshot.player.alive || !arenaControlsReady) return
      setEngaged(true)
      controls.current.keys.add(code)
    }
    else controls.current.keys.delete(code)
  }

  const activePrimeIndex = Math.max(0, PYLON_SEQUENCE.indexOf(snapshot.activePrime))
  const capturedPrimes = new Set(snapshot.objective.captures.map((capture) => capture.prime))
  const objectiveText = snapshot.online
    ? snapshot.onlinePhase === 'active'
      ? `BATALHA EM EQUIPE — ${snapshot.livingEnemies} OPONENTE${snapshot.livingEnemies === 1 ? '' : 'S'} ATIVO${snapshot.livingEnemies === 1 ? '' : 'S'}`
      : snapshot.onlinePhase === 'waiting'
        ? 'AGUARDANDO MAIS 1 OPERADOR DA SALA'
        : snapshot.onlinePhase === 'reconnecting'
          ? 'RECONECTANDO À MESMA BATALHA'
          : snapshot.onlinePhase === 'offline'
            ? 'CONEXÃO PERDIDA — RETORNE AO NEXUS'
            : snapshot.onlinePhase === 'blocked'
              ? 'ENTRADA BLOQUEADA — USE O PORTAL DO NEXUS'
              : 'SINCRONIZANDO COM A ARENA ONLINE'
    : snapshot.captureContested
      ? `PYLON ${snapshot.activePrime} CONTESTADO — FATURE OS RIVAIS`
      : snapshot.playerInsideObjective
        ? `SINCRONIZANDO PYLON ${snapshot.activePrime}`
        : `ALCANCE O PYLON ${snapshot.activePrime}`
  const respawnSeconds = snapshot.player.respawnAtMs === null
    ? 0
    : Math.max(0, Math.ceil((snapshot.player.respawnAtMs - snapshot.nowMs) / 1_000))
  const reconstructionProgress = respawnProgress(
    snapshot.player.respawnAtMs,
    snapshot.nowMs,
    RESPAWN_DELAY_MS,
  )
  const defeatPresentation = defeat ?? parseDefeatPresentation(snapshot.message)
  const reforming = snapshot.player.alive && reformingUntil > snapshot.nowMs
  const hitActive = snapshot.hitMarkerUntil > snapshot.nowMs
  const damageActive = snapshot.damageFlashUntil > snapshot.nowMs
  const silenced = Boolean(snapshot.player.statuses.silenced?.expiresAtMs
    && snapshot.player.statuses.silenced.expiresAtMs > snapshot.nowMs)
  const activeStatuses = Object.entries(snapshot.player.statuses).flatMap(([id, status]) => {
    if (!status || status.expiresAtMs <= snapshot.nowMs) return []
    const label = statusLabel(id, status.magnitude)
    return label ? [{ id, label, seconds: Math.max(0.1, (status.expiresAtMs - snapshot.nowMs) / 1_000) }] : []
  })
  const effectivePool = snapshot.player.health + snapshot.player.shield
  const maximumPool = snapshot.player.maxHealth + snapshot.player.maxShield
  const critical = effectivePool / Math.max(1, maximumPool) <= 0.3

  return (
    <section
      ref={shellRef}
      className={`n257-arena${damageActive ? ' is-hit' : ''}${critical ? ' is-critical' : ''}${!snapshot.player.alive ? ' is-defeated' : ''}${reforming ? ' is-reforming' : ''}`}
      aria-label="Núcleo 257, arena de superpoderes em primeira pessoa"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={releaseTouchLook}
      onPointerCancel={releaseTouchLook}
    >
      <div className="n257-canvas-shell">
        <SceneBoundary>
          <Canvas
            key={runKey}
            className="n257-canvas"
            shadows={profile.shadows}
            dpr={profile.dpr}
            camera={{ fov: 72, near: 0.055, far: 130, position: [0, 1.8, 20] }}
            gl={{ antialias: profile.antialias, alpha: false, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => {
              gl.outputColorSpace = THREE.SRGBColorSpace
              gl.toneMapping = THREE.ACESFilmicToneMapping
              gl.toneMappingExposure = 1.12
            }}
          >
            <Suspense fallback={null}>
              <Nucleus257Scene
                heroId={heroId}
                controls={controls}
                look={look}
                active={engaged && !paused && !result && !cinematicLocksControls}
                quality={quality}
                reducedMotion={reducedMotion}
                multiplayer={arenaMultiplayer}
                onSnapshot={setSnapshot}
                onCinematic={beginCinematic}
                onEnd={finishArena}
              />
            </Suspense>
          </Canvas>
        </SceneBoundary>
      </div>

      <div className="n257-hud">
        <header className="n257-hud__top">
          <div className="n257-match-brand">
            <i><b>257</b></i>
            <span>NÚCLEO 257<small>{snapshot.online ? 'ARENA AUTORITATIVA // PVP ONLINE' : 'CÂMARA DE COMBATE // PVE'}</small></span>
          </div>
          <section className="n257-objective" aria-label={objectiveText}>
            <small>{snapshot.online ? `SALA AO VIVO · ${snapshot.connectedPlayers} JOGADOR${snapshot.connectedPlayers === 1 ? '' : 'ES'} · EQUIPE ${snapshot.localTeam.toUpperCase()}` : `PROTOCOLO DE DOMÍNIO · ${formatTime(snapshot.remainingMs)}`}</small>
            <strong>{objectiveText}</strong>
            {!snapshot.online && <div className="n257-prime-track" aria-label={`${snapshot.objective.activeIndex} de 4 pylons dominados`}>
              {PYLON_SEQUENCE.map((prime, index) => (
                <span
                  key={prime}
                  className={capturedPrimes.has(prime) ? 'is-done' : index === activePrimeIndex ? 'is-active' : ''}
                  style={index === activePrimeIndex ? objectiveStyle(snapshot.captureProgress) : undefined}
                  title={`Pylon ${prime}`}
                >{prime}</span>
              ))}
            </div>}
          </section>
          <div className="n257-score">
            <span>ELIMINAÇÕES<br />MORTES</span>
            <strong>{String(snapshot.player.eliminations).padStart(2, '0')}</strong>
            <i />
            <strong>{String(snapshot.player.deaths).padStart(2, '0')}</strong>
          </div>
        </header>

        {snapshot.messageUntil > snapshot.nowMs && (
          <div className="n257-center-message" role="status">
            <small>SISTEMA DE ARENA</small>
            <strong>{snapshot.message}</strong>
          </div>
        )}

        {critical && snapshot.player.alive && (
          <div className="n257-critical-warning" role="status" aria-live="polite">
            <i aria-hidden="true" />
            <span>INTEGRIDADE CRÍTICA</span>
            <small>ROMPA A LINHA DE VISÃO · AGUARDE A RECARGA DO ESCUDO</small>
          </div>
        )}

        {snapshot.online && snapshot.killFeed.length > 0 && (
          <aside className="n257-kill-feed" aria-label="Eliminações recentes" aria-live="polite">
            {snapshot.killFeed.map((entry) => <span key={entry.id}>{entry.text}</span>)}
          </aside>
        )}

        <div className={`n257-crosshair${snapshot.targetId ? ' is-target' : ''}${hitActive ? ' is-hit' : ''}`} aria-hidden="true" />

        <div className="n257-damage-numbers" aria-hidden="true">
          {snapshot.damageNumbers
            .filter((entry) => snapshot.nowMs - entry.atMs < 900)
            .map((entry) => (
              <span
                key={entry.id}
                className={`n257-damage${entry.combo ? ' is-combo' : ''}${entry.lethal ? ' is-lethal' : ''}`}
                style={{ '--drift': `${(entry.id % 5 - 2) * 18}px` } as CSSProperties}
              >
                {Math.round(entry.amount)}
              </span>
            ))}
        </div>

        {snapshot.comboUntil > snapshot.nowMs && (
          <div className="n257-combo" role="status">
            <b>COMBO</b><span>MARCA DETONADA</span>
          </div>
        )}
        {damageActive && <div className="n257-damage-direction" style={damageStyle(snapshot.damageBearingDegrees)} aria-hidden="true" />}
        {!snapshot.online && snapshot.playerInsideObjective && (
          <div className="n257-capture-ring" style={{ '--capture-angle': `${snapshot.captureProgress * 360}deg` } as CSSProperties} aria-hidden="true">
            <span>{snapshot.captureContested ? 'CONTESTADO' : `${Math.floor(snapshot.captureProgress * 100)}%`}</span>
          </div>
        )}

        <section className={`n257-vitals${critical ? ' is-critical' : ''}`} aria-label="Estado do operador">
          <div className="n257-vitals__identity">
            <div><small>{ROLE_LABEL[activeHero.role]}</small><strong>{activeHero.characterName}</strong></div>
            <small>{snapshot.online ? `EQUIPE ${snapshot.localTeam.toUpperCase()} · ${snapshot.connectedPlayers} ONLINE` : `${snapshot.livingEnemies} RIVAIS`}</small>
          </div>
          {activeStatuses.length > 0 && (
            <div className="n257-statuses" aria-label="Efeitos ativos">
              {activeStatuses.map((status) => (
                <span key={status.id}>{status.label}<b>{status.seconds.toFixed(1)}S</b></span>
              ))}
            </div>
          )}
          <div className="n257-bar" style={{ '--value': `${percent(snapshot.player.health, snapshot.player.maxHealth)}%`, '--bar-color': '#ff526b' } as CSSProperties}><i /></div>
          <div className="n257-bar-label"><span>INTEGRIDADE</span><b>{Math.ceil(snapshot.player.health)} / {snapshot.player.maxHealth}</b></div>
          <div className="n257-bar" style={{ '--value': `${percent(snapshot.player.shield, snapshot.player.maxShield)}%`, '--bar-color': activeHero.accent } as CSSProperties}><i /></div>
          <div className="n257-bar-label"><span>ESCUDO</span><b>{Math.ceil(snapshot.player.shield)} / {snapshot.player.maxShield}</b></div>
          <div className={`n257-ultimate-meter${snapshot.player.ultimateCharge >= 100 ? ' is-ready' : ''}`}>
            <kbd>R</kbd><span><i style={valueStyle(snapshot.player.ultimateCharge)} /></span><b>{Math.floor(snapshot.player.ultimateCharge)}%</b>
          </div>
        </section>

        <section className="n257-powers" aria-label="Poderes">
          {(['primary', 'signature', 'mobility', 'ultimate'] as const).map((slot) => {
            const ability = activeHero.abilities[slot]
            const remaining = snapshot.cooldowns[slot]
            const ultimateLocked = slot === 'ultimate' && snapshot.player.ultimateCharge < (ability.ultimateCost ?? 100)
            const silenceLocked = silenced && slot !== 'primary'
            const ready = remaining <= 0 && !ultimateLocked && !silenceLocked
            return (
              <button
                key={slot}
                type="button"
                className={`n257-power${slot === 'ultimate' ? ' is-ultimate' : ''}${ready ? ' is-ready' : ''}${silenceLocked ? ' is-blocked' : ''}`}
                style={cooldownStyle(remaining, ability.cooldownMs)}
                onClick={(event) => { event.stopPropagation(); if (slot !== 'primary') queueAbility(slot) }}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  if (event.pointerType !== 'mouse') setEngaged(true)
                  if (slot === 'primary') {
                    controls.current.primaryPulse += 1
                    controls.current.primaryHeld = true
                    event.currentTarget.setPointerCapture(event.pointerId)
                  }
                }}
                onPointerUp={(event) => {
                  event.stopPropagation()
                  if (slot === 'primary') {
                    controls.current.primaryHeld = false
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId)
                    }
                  }
                }}
                onPointerCancel={() => {
                  if (slot === 'primary') controls.current.primaryHeld = false
                }}
                onLostPointerCapture={() => {
                  if (slot === 'primary') controls.current.primaryHeld = false
                }}
                disabled={!snapshot.player.alive || cinematicLocksControls || !arenaControlsReady}
                aria-label={`${ability.name}${ready ? ', pronto' : silenceLocked ? ', silenciado' : ultimateLocked ? ', carregando' : ', recarregando'}`}
              >
                <kbd>{SLOT_KEY[slot]}</kbd>
                <strong>{ability.name}</strong>
                <small>{silenceLocked ? 'SILENCIADO' : ultimateLocked ? `${Math.floor(snapshot.player.ultimateCharge)}% CARGA` : remaining > 0 ? `${(remaining / 1_000).toFixed(1)} S` : 'PRONTO'}</small>
              </button>
            )
          })}
        </section>

        <div className="n257-mobile-controls" aria-label="Movimento por toque">
          {[
            ['KeyW', '↑', 'Frente'],
            ['KeyA', '←', 'Esquerda'],
            ['KeyS', '↓', 'Trás'],
            ['KeyD', '→', 'Direita'],
          ].map(([code, glyph, label]) => (
            <button
              key={code}
              type="button"
              disabled={!snapshot.player.alive || !arenaControlsReady}
              aria-label={label}
              onPointerDown={(event) => {
                event.stopPropagation()
                setMobileMove(code, true)
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerUp={(event) => {
                event.stopPropagation()
                setMobileMove(code, false)
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId)
                }
              }}
              onPointerCancel={() => setMobileMove(code, false)}
              onLostPointerCapture={() => setMobileMove(code, false)}
            >{glyph}</button>
          ))}
        </div>

        {!cinematicLocksControls && (
          <button className="n257-menu-button" type="button" onClick={(event) => { event.stopPropagation(); togglePause() }}>P · PAUSA</button>
        )}

        {snapshot.online && !multiplayer.ready && multiplayer.joinError && !paused && !result && (
          <button
            className="n257-lock-prompt"
            type="button"
            onClick={(event) => { event.stopPropagation(); multiplayer.retryJoin() }}
          >TENTAR ENTRAR NOVAMENTE</button>
        )}

        {arenaControlsReady && !captured && !paused && !result && !cinematicLocksControls && (
          <button className="n257-lock-prompt" type="button" onClick={(event) => { event.stopPropagation(); capturePointer() }}>
            CLIQUE PARA VINCULAR A MIRA
          </button>
        )}

        {!snapshot.player.alive && !result && (
          <div
            className="n257-defeat"
            role="status"
            aria-live="polite"
            style={{ '--respawn-progress': `${reconstructionProgress * 100}%` } as CSSProperties}
          >
            <div className="n257-defeat__fracture" aria-hidden="true">
              <i /><i /><i /><i />
            </div>
            <div className="n257-defeat__core">
              <small>DERROTA {String(snapshot.player.deaths).padStart(2, '0')} // ANÁLISE TÁTICA</small>
              <h2>{defeatPresentation.headline}</h2>
              <p><span>{defeatPresentation.source}</span><b>{defeatPresentation.cause}</b></p>
              <div
                className="n257-defeat__progress"
                role="progressbar"
                aria-label="Reconstrução do operador"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(reconstructionProgress * 100)}
              ><i /></div>
              <div className="n257-defeat__timeline" aria-hidden="true">
                {[2, 3, 5, 7].map((prime, index) => (
                  <span key={prime} className={reconstructionProgress >= (index + 1) / 4 ? 'is-restored' : ''}>{prime}</span>
                ))}
              </div>
              <strong>{respawnPhaseLabel(reconstructionProgress)} · {respawnSeconds}S</strong>
              <em>A arena continua ativa. Leia a direção do último impacto e mude sua rota.</em>
            </div>
          </div>
        )}
      </div>

      {cinematic && (
        <div className="n257-cinematic" aria-live="assertive">
          <small>{activeHero.codename.toUpperCase()} // LIMITE IRREDUTÍVEL</small>
          <strong>{cinematic.spokenName}</strong>
          <p>{cinematic.description}</p>
        </div>
      )}

      {paused && !result && (
        <div className="n257-modal" role="dialog" aria-modal="true" aria-labelledby="n257-pause-title">
          <div className="n257-modal__card">
            <small>PROTOCOLO SUSPENSO</small>
            <h2 id="n257-pause-title">Arena pausada</h2>
            <p>{snapshot.online
              ? 'Seus controles estão suspensos, mas a batalha online continua. Retome para voltar a se defender.'
              : 'O relógio e os rivais estão congelados. Retome quando estiver pronto para reconectar a mira.'}</p>
            <QualityControl value={quality} onChange={onQualityChange} />
            <div className="n257-modal__actions">
              <button type="button" className="is-primary" onClick={() => setPaused(false)}>RETOMAR</button>
              {!snapshot.online && <button type="button" onClick={restart}>REINICIAR</button>}
              <button type="button" onClick={exitArena}>TROCAR OPERADOR</button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="n257-modal" role="dialog" aria-modal="true" aria-labelledby="n257-result-title">
          <div className="n257-modal__card">
            <small>{result.ending === 'victory' ? 'SEQUÊNCIA 2 · 3 · 5 · 7 COMPLETA' : 'JANELA DE DOMÍNIO ENCERRADA'}</small>
            <h2 id="n257-result-title">{result.ending === 'victory' ? 'Núcleo dominado.' : 'O Núcleo resistiu.'}</h2>
            <p>
              {result.snapshot.player.eliminations} eliminações · {result.snapshot.player.deaths} reconstruções · {result.snapshot.objective.activeIndex}/4 pylons.
              A arena durou {formatTime(Math.min(NUCLEUS_MATCH_DURATION_MS, result.snapshot.elapsedMs))}.
            </p>
            <div className="n257-modal__actions">
              <button type="button" className="is-primary" onClick={restart}>NOVA BATALHA</button>
              <button type="button" onClick={exitArena}>TROCAR OPERADOR</button>
              <Link to="/jogos/primeverse-online">PRIMEVERSE ONLINE</Link>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
