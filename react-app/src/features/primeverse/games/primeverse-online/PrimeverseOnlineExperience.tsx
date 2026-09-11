import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import type { QualityLevel, QualityProfile } from '../../graphics/useQualitySettings'
import { SceneBoundary } from '../../ui/SceneBoundary'
import ExpeditionLobbyPanel from './party/ExpeditionLobbyPanel'
import { storeLobbyTicket } from './party/lobbyTicket'
import DiscoveryTrail from './discovery/DiscoveryTrail'
import { describeDiscovery } from './discovery/discoveryProgress'
import { useDiscoveryProgress } from './discovery/useDiscoveryProgress'
import { EXPEDITION_BY_PORTAL, PRIMEVERSE_EXPEDITIONS } from './expeditions'
import {
  countConnectedPlayers,
  PRIMEVERSE_RECONNECT_ATTEMPTS,
  type OnlineClientSnapshot,
  type PrimeverseOnlineClient,
} from './network/PrimeverseOnlineClient'
import OnlineHud from './OnlineHud'
import PrimeverseOnlineScene from './scene/PrimeverseOnlineScene'
import { usePrimeverseSession } from './session/PrimeverseSessionProvider'
import { type PortalId, type RealmId } from './shared/realms'
import { EMOTE_DURATION_MS, type AvatarAppearance, type Emote } from './shared/protocol'
import type { AvatarRenderState, CameraLook, MovementInput } from './types'
import { ONLINE_SPAWN } from './world'

interface PrimeverseOnlineExperienceProps {
  readonly quality: QualityLevel
  readonly profile: QualityProfile
  readonly onQualityChange: (quality: QualityLevel) => void
  readonly onLeave: () => void
}

interface ConnectedExperienceProps extends PrimeverseOnlineExperienceProps {
  readonly nickname: string
  readonly appearance: AvatarAppearance
  readonly client: PrimeverseOnlineClient
  readonly snapshot: OnlineClientSnapshot
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

function PrimeverseOnlineExperienceConnected({
  nickname,
  appearance,
  client,
  snapshot,
  quality,
  profile,
  onQualityChange,
  onLeave,
}: ConnectedExperienceProps): JSX.Element {
  const navigate = useNavigate()
  const localAvatar = useRef<AvatarRenderState>({
    position: [...ONLINE_SPAWN], yaw: 0, animation: 'idle', speed: 0,
    nickname, appearance, emote: null,
  })
  const input = useRef<MovementInput>({ keys: new Set(), touchX: 0, touchZ: 0, jumpQueued: false, sprintHeld: false })
  const look = useRef<CameraLook>({ yaw: 0, pitch: 0.08 })
  const drag = useRef({ active: false, pointerId: -1, x: 0, y: 0 })
  const shellRef = useRef<HTMLDivElement>(null)
  const [graphicsReady, setGraphicsReady] = useState(false)
  const [minimumLoadDone, setMinimumLoadDone] = useState(false)
  const [interaction, setInteraction] = useState<ReturnType<typeof import('./world').nearestInteraction>>(null)
  const [location, setLocation] = useState('Praça de Spawn')
  const [realmId, setRealmId] = useState<RealmId>('nexus')
  const [emoteOpen, setEmoteOpen] = useState(false)
  const [voidActive, setVoidActive] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [discoveryCelebration, setDiscoveryCelebration] = useState(false)
  const [portalTravel, setPortalTravel] = useState<PortalId | null>(null)
  const [fps, setFps] = useState(60)
  const { progress: discoveryProgress, discover } = useDiscoveryProgress()
  const reducedMotion = useReducedMotion()
  const debug = useMemo(() => new URLSearchParams(window.location.search).get('debug') === 'true', [])
  const toastTimer = useRef<number | null>(null)
  const discoveryTimer = useRef<number | null>(null)
  const portalTimer = useRef<number | null>(null)
  const knownRemotes = useRef<Map<string, string> | null>(null)
  const reconnecting = snapshot.status === 'reconnecting'
  const loading = !graphicsReady || snapshot.status === 'connecting' || snapshot.status === 'idle'
    || snapshot.status === 'offline' || snapshot.status === 'error'
    || (reconnecting && snapshot.playerId === null) || !minimumLoadDone
  const simulationPaused = loading || reconnecting || portalTravel !== null || snapshot.activityId !== 'nexus'
  const sequence = snapshot.world?.sequence
  const signalCount = countConnectedPlayers(snapshot)
  const isNexus = realmId === 'nexus'
  const showNexusWorldEvent = isNexus
  const usesLocalMultiplayer = import.meta.env.DEV && !import.meta.env.VITE_PRIMEVERSE_WS_URL
  const loaderDetail = !graphicsReady
    ? 'Preparando os elementos visuais'
    : snapshot.status === 'connecting' || snapshot.status === 'idle'
      ? 'Abrindo conexão com o servidor em tempo real'
      : snapshot.status === 'reconnecting'
        ? `Tentativa automática ${snapshot.reconnectAttempt} de ${PRIMEVERSE_RECONNECT_ATTEMPTS}`
        : snapshot.status === 'offline'
          ? usesLocalMultiplayer
            ? 'Servidor multiplayer local indisponível. Execute npm run dev:multiplayer em outro terminal.'
            : snapshot.error ?? 'Verifique sua rede e tente novamente.'
          : snapshot.status === 'error'
            ? snapshot.error ?? 'O servidor recusou a entrada nesta sessão.'
            : `${signalCount} sinal(is) detectado(s)`

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3_200)
  }, [])

  const triggerEmote = useCallback((emote: Emote) => {
    localAvatar.current.emote = { kind: emote, startedAt: Date.now(), durationMs: EMOTE_DURATION_MS }
    client.sendEmote(emote)
    setEmoteOpen(false)
  }, [client])

  const queueInteract = useCallback(() => {
    input.current.keys.add('InteractQueued')
  }, [])

  const handleSecret = useCallback((id: string) => {
    const result = discover(id)
    showToast(describeDiscovery(result))
    if (result.outcome === 'completed') {
      setDiscoveryCelebration(true)
      if (discoveryTimer.current) window.clearTimeout(discoveryTimer.current)
      discoveryTimer.current = window.setTimeout(() => setDiscoveryCelebration(false), 4_200)
    }
  }, [discover, showToast])

  const handlePortalTravel = useCallback((portalId: PortalId) => {
    const expedition = EXPEDITION_BY_PORTAL[portalId]
    if (!expedition) return false
    setPortalTravel(portalId)
    if (portalTimer.current) window.clearTimeout(portalTimer.current)
    portalTimer.current = null
    if (!client.changeActivity(expedition.id, portalId)) {
      setPortalTravel(null)
      showToast('PORTAL SEM SINAL // Reconecte ao Primeverse e tente novamente.')
      return false
    }
    return true
  }, [client, showToast])

  const handleVoidState = useCallback((active: boolean) => {
    setVoidActive(active)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumLoadDone(true), reducedMotion ? 80 : 650)
    return () => window.clearTimeout(timer)
  }, [reducedMotion])

  // A new hub mount means the player returned from a standalone expedition.
  // Keep requesting the Nexus until the authoritative activity ack arrives:
  // the first request can legitimately be rate-limited when a player returns
  // immediately after crossing a portal. Delaying the first send also avoids a
  // duplicate request during React StrictMode's development effect replay.
  useEffect(() => {
    if (snapshot.status !== 'online' || snapshot.activityId === 'nexus') return undefined

    let retryTimer: number | null = null
    const requestNexus = () => {
      const current = client.getSnapshot()
      if (current.status !== 'online' || current.activityId === 'nexus') return
      client.changeActivity('nexus')
    }
    const initialTimer = window.setTimeout(() => {
      requestNexus()
      retryTimer = window.setInterval(requestNexus, 500)
    }, 0)

    return () => {
      window.clearTimeout(initialTimer)
      if (retryTimer !== null) window.clearInterval(retryTimer)
    }
  }, [client, snapshot.activityId, snapshot.status])

  // A lobby launch is a group portal: store the shared ticket (run + seed) and
  // take every member to the expedition at the same moment.
  useEffect(() => {
    if (!snapshot.lobbyLaunch) return
    const launch = client.consumeLobbyLaunch()
    if (!launch) return
    const expedition = PRIMEVERSE_EXPEDITIONS.find((candidate) => candidate.id === launch.activityId)
    if (!expedition) return
    storeLobbyTicket(launch)
    navigate(expedition.path)
  }, [client, navigate, snapshot.lobbyLaunch])

  // Route handoff only happens after the authoritative activity/run ack. This
  // keeps every player who crossed the portal attached to the same room run.
  useEffect(() => {
    if (!portalTravel) return
    const expedition = EXPEDITION_BY_PORTAL[portalTravel]
    if (!expedition || snapshot.activityId !== expedition.id || snapshot.runId === null) return
    if (portalTimer.current) window.clearTimeout(portalTimer.current)
    portalTimer.current = window.setTimeout(
      () => navigate(expedition.path),
      reducedMotion ? 80 : 620,
    )
  }, [navigate, portalTravel, reducedMotion, snapshot.activityId, snapshot.runId])

  useEffect(() => {
    if (!portalTravel) return
    if (snapshot.status === 'reconnecting' || snapshot.status === 'offline') {
      if (portalTimer.current) window.clearTimeout(portalTimer.current)
      portalTimer.current = null
      // The server may not have received the request. Drop the visual handoff
      // so a successful reconnect cannot leave the Nexus permanently paused.
      setPortalTravel(null)
      return
    }
    if (snapshot.status === 'error') {
      if (portalTimer.current) window.clearTimeout(portalTimer.current)
      portalTimer.current = null
      setPortalTravel(null)
      showToast(snapshot.error ?? 'PORTAL INTERROMPIDO // Tente novamente.')
      return
    }
    if (snapshot.status === 'online' && snapshot.error) {
      if (portalTimer.current) window.clearTimeout(portalTimer.current)
      portalTimer.current = null
      setPortalTravel(null)
      showToast(`PORTAL RECUSADO // ${snapshot.error}`)
    }
  }, [portalTravel, showToast, snapshot.error, snapshot.status])

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    if (discoveryTimer.current) window.clearTimeout(discoveryTimer.current)
    if (portalTimer.current) window.clearTimeout(portalTimer.current)
  }, [])

  useEffect(() => {
    if (snapshot.status !== 'online') return
    const current = new Map(snapshot.players.map((player) => [player.id, player.nickname]))
    const previous = knownRemotes.current
    knownRemotes.current = current

    if (previous === null) {
      showToast('NEXUS ONLINE // Sua sala continua unida em Ulam · Euclides · Cripta · Núcleo 257.')
      return
    }

    const joined = [...current].filter(([id]) => !previous.has(id))
    const departed = [...previous].filter(([id]) => !current.has(id))
    if (joined.length === 1) showToast(`PRIMEIRO CONTATO // ${joined[0][1]} entrou no Primeverse.`)
    else if (joined.length > 1) showToast(`${joined.length} novos sinais entraram nesta sala.`)
    else if (departed.length === 1) showToast(`${departed[0][1]} deixou esta expedição.`)
  }, [showToast, snapshot.players, snapshot.status])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.repeat && ['KeyE', 'KeyQ', 'Space', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(event.code)) return
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Space'].includes(event.code)) event.preventDefault()
      input.current.keys.add(event.code)
      if (event.code === 'Space') input.current.jumpQueued = true
      if (event.code === 'KeyE') queueInteract()
      if (event.code === 'KeyQ') setEmoteOpen((open) => !open)
      if (event.code === 'Escape') onLeave()
      const emoteIndex = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(event.code)
      if (emoteIndex >= 0) triggerEmote((['wave', 'celebrate', 'heart', 'question', 'spark'] as const)[emoteIndex])
    }
    const up = (event: KeyboardEvent) => input.current.keys.delete(event.code)
    const reset = () => {
      input.current.keys.clear()
      input.current.touchX = 0
      input.current.touchZ = 0
      input.current.sprintHeld = false
    }
    window.addEventListener('keydown', down, { passive: false })
    window.addEventListener('keyup', up)
    window.addEventListener('blur', reset)
    document.addEventListener('visibilitychange', reset)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', reset)
      document.removeEventListener('visibilitychange', reset)
    }
  }, [onLeave, queueInteract, triggerEmote])

  useEffect(() => {
    if (snapshot.status === 'online') return
    input.current.keys.clear()
    input.current.touchX = 0
    input.current.touchZ = 0
    input.current.jumpQueued = false
    input.current.sprintHeld = false
  }, [snapshot.status])

  useEffect(() => {
    const joystick = shellRef.current?.querySelector<HTMLElement>('[data-pvo-joystick]')
    const stick = joystick?.querySelector<HTMLElement>('[data-pvo-stick]')
    if (!joystick || !stick) return undefined
    let activePointer = -1
    const update = (event: PointerEvent) => {
      if (event.pointerId !== activePointer) return
      const bounds = joystick.getBoundingClientRect()
      const radius = bounds.width * 0.34
      let x = event.clientX - (bounds.left + bounds.width / 2)
      let y = event.clientY - (bounds.top + bounds.height / 2)
      const distance = Math.hypot(x, y)
      if (distance > radius) { x *= radius / distance; y *= radius / distance }
      input.current.touchX = x / radius
      input.current.touchZ = -y / radius
      stick.style.transform = `translate(${x}px, ${y}px)`
    }
    const start = (event: PointerEvent) => {
      activePointer = event.pointerId
      joystick.setPointerCapture(event.pointerId)
      update(event)
    }
    const end = (event: PointerEvent) => {
      if (event.pointerId !== activePointer) return
      activePointer = -1
      input.current.touchX = 0
      input.current.touchZ = 0
      stick.style.transform = 'translate(0, 0)'
    }
    joystick.addEventListener('pointerdown', start)
    joystick.addEventListener('pointermove', update)
    joystick.addEventListener('pointerup', end)
    joystick.addEventListener('pointercancel', end)
    return () => {
      joystick.removeEventListener('pointerdown', start)
      joystick.removeEventListener('pointermove', update)
      joystick.removeEventListener('pointerup', end)
      joystick.removeEventListener('pointercancel', end)
    }
  }, [])

  useEffect(() => {
    if (!debug) return undefined
    let frame = 0
    let previous = performance.now()
    let raf = 0
    const tick = (now: number) => {
      frame += 1
      if (now - previous >= 1_000) {
        setFps(Math.round(frame * 1_000 / (now - previous)))
        frame = 0
        previous = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [debug])

  useEffect(() => {
    if (!showNexusWorldEvent) return
    const event = snapshot.lastWorldEvent
    if (!event) return
    if (event.kind === 'sequence_started') showToast('Sequência ativada. Escolham juntos um pedestal.')
    if (event.kind === 'sequence_revealed') showToast(event.success ? 'RESSONÂNCIA PRIMA! A onda percorreu o mundo.' : 'O Núcleo revelou 13. Tentem unir os votos na próxima rodada.')
  }, [showNexusWorldEvent, showToast, snapshot.lastWorldEvent])

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button, select, a, [data-pvo-joystick]')) return
    drag.current = { active: true, pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active || drag.current.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.current.x
    const dy = event.clientY - drag.current.y
    drag.current.x = event.clientX
    drag.current.y = event.clientY
    look.current.yaw -= dx * 0.0042
    look.current.pitch = Math.max(-0.2, Math.min(0.48, look.current.pitch + dy * 0.0032))
  }
  const pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current.pointerId === event.pointerId) drag.current.active = false
  }

  return (
    <div
      ref={shellRef}
      className={`pvo-experience ${voidActive ? 'pvo-experience--void' : ''} ${realmId === 'sieve-catacombs' ? 'pvo-experience--horror' : ''}`}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
    >
      <div className="pvo-canvas-shell">
        <SceneBoundary>
          <Canvas
            shadows={profile.shadows}
            dpr={profile.dpr}
            camera={{ position: [0, 4.2, 20], fov: 56, near: 0.08, far: 150 }}
            gl={{ antialias: profile.antialias, alpha: false, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => {
              gl.outputColorSpace = 'srgb'
              gl.toneMapping = 4
              gl.toneMappingExposure = 1.08
              setGraphicsReady(true)
            }}
          >
            <Suspense fallback={null}>
              <PrimeverseOnlineScene
                client={client}
                localAvatar={localAvatar}
                remotes={snapshot.players.filter((player) => player.activityId === 'nexus' && player.runId === null)}
                input={input}
                look={look}
                quality={quality}
                profile={profile}
                reducedMotion={reducedMotion}
                paused={simulationPaused}
                eventPhase={sequence?.phase ?? 'idle'}
                winningValue={sequence?.revealedAnswer ?? sequence?.winningChoice}
                eventSuccess={sequence?.success}
                serverCoreIntensity={snapshot.world?.core.intensity ?? 0}
                serverCoreRingSpeed={snapshot.world?.core.ringSpeed ?? 0.65}
                discoveredSecrets={discoveryProgress.discovered}
                currentRealmId={realmId}
                activePortalId={interaction?.id.startsWith('portal-') ? interaction.id as PortalId : null}
                onPortalTravel={handlePortalTravel}
                onInteractionTarget={setInteraction}
                onLocation={setLocation}
                onRealm={setRealmId}
                onVoidState={handleVoidState}
                onSecret={handleSecret}
              />
            </Suspense>
          </Canvas>
        </SceneBoundary>
      </div>

      {isNexus && <DiscoveryTrail progress={discoveryProgress} />}

      {discoveryCelebration && (
        <div className="pvo-discovery-complete" role="status">
          <i aria-hidden="true" />
          <div>
            <small>CÓDICE PRIMO // 03 ASSINATURAS</small>
            <strong>EMBLEMA IRREDUTÍVEL</strong>
            <span>997 · 2³¹−1 · CONSTELAÇÃO PRIMA</span>
          </div>
        </div>
      )}

      {portalTravel && (
        <div className="pvo-portal-transition" aria-live="polite">
          <i aria-hidden="true" />
          <small>INICIANDO JOGO INDEPENDENTE</small>
          <strong>{EXPEDITION_BY_PORTAL[portalTravel]?.title}</strong>
        </div>
      )}

      {snapshot.status === 'online' && (
        <ExpeditionLobbyPanel client={client} lobby={snapshot.lobby} playerId={snapshot.playerId} />
      )}

      <OnlineHud
        network={snapshot}
        world={snapshot.world}
        quality={quality}
        onQualityChange={onQualityChange}
        location={location}
        showWorldEvent={showNexusWorldEvent}
        interaction={interaction}
        emoteOpen={emoteOpen}
        onEmoteOpenChange={setEmoteOpen}
        onEmote={triggerEmote}
        onInteract={queueInteract}
        onJump={() => { input.current.jumpQueued = true }}
        onSprintChange={(held) => { input.current.sprintHeld = held }}
        debug={debug}
        fps={fps}
        toast={toast}
        onLeave={onLeave}
      />

      {loading && (
        <div className="pvo-loader" aria-live="polite">
          <div className="pvo-loader__core"><i /><i /><i /><b>13</b></div>
          <p>PRIMEVERSE ONLINE</p>
          <h2>{!graphicsReady
            ? 'Construindo a geometria do mundo'
            : snapshot.status === 'offline' || snapshot.status === 'error'
              ? 'Não foi possível entrar no Primeverse.'
              : snapshot.status === 'connecting'
                ? 'Encontrando uma sala segura'
                : snapshot.status === 'reconnecting'
                  ? 'Reconectando ao Primeverse'
                  : 'Sincronizando exploradores'}</h2>
          <div className="pvo-loader__bar"><i style={{ width: `${!graphicsReady ? 34 : snapshot.status !== 'online' ? 68 : 100}%` }} /></div>
          <small>{loaderDetail}</small>
          {(snapshot.status === 'offline' || snapshot.status === 'error') && (
            <>
              <div className="pvo-loader__actions"><button type="button" onClick={() => client.retry()}>TENTAR NOVAMENTE</button><button type="button" onClick={onLeave}>VOLTAR</button></div>
              <nav className="pvo-loader__expeditions" aria-label="Jogos solo disponíveis">
                <small>O NEXUS ESTÁ OFFLINE, MAS AS EXPEDIÇÕES SOLO ESTÃO DISPONÍVEIS</small>
                <div>{PRIMEVERSE_EXPEDITIONS.map((expedition) => (
                  <Link key={expedition.id} to={expedition.path} style={{ '--expedition-accent': expedition.accent } as React.CSSProperties}>
                    <i>{expedition.glyph}</i>{expedition.title}<b>↗</b>
                  </Link>
                ))}</div>
              </nav>
            </>
          )}
        </div>
      )}
      <div className="pvo-void-fade" aria-hidden="true"><span>RECALCULANDO POSIÇÃO…</span></div>
    </div>
  )
}

export default function PrimeverseOnlineExperience(
  props: PrimeverseOnlineExperienceProps,
): JSX.Element {
  const { activeIdentity, client, snapshot } = usePrimeverseSession()
  if (!activeIdentity || !client) {
    return (
      <div className="pvo-experience">
        <div className="pvo-loader" role="status">
          <div className="pvo-loader__core"><i /><i /><i /><b>13</b></div>
          <p>PRIMEVERSE ONLINE</p>
          <h2>Preparando sua sessão</h2>
        </div>
      </div>
    )
  }
  return (
    <PrimeverseOnlineExperienceConnected
      {...props}
      nickname={activeIdentity.nickname}
      appearance={activeIdentity.appearance}
      client={client}
      snapshot={snapshot}
    />
  )
}
