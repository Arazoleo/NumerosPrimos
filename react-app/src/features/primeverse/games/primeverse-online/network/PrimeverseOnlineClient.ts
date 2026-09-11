import type { ExpeditionActivityId } from '../shared/activities'
import type { LobbySnapshot } from '../shared/protocol'
import {
  HEARTBEAT_INTERVAL_MS,
  EMOTE_DURATION_MS,
  NETWORK_INTERVAL_MS,
  PROTOCOL_VERSION,
  parseServerMessage,
  type AvatarAppearance,
  type ClientMessage,
  type Emote,
  type InteractionAction,
  type InteractionTarget,
  type NucleusAbilitySlot,
  type NucleusAimInput,
  type NucleusCombatEventMessage,
  type NucleusCombatState,
  type NucleusHeroId,
  type PlayerAnimation,
  type PlayerSnapshot,
  type ProtocolErrorCode,
  type ServerMessage,
  type WorldEvent,
  type WorldState,
} from '../shared/protocol'
import {
  type ActivityId,
  type ActivityRunId,
} from '../shared/activities'
import type { PortalId } from '../shared/realms'
import { RemoteInterpolationBuffer, type InterpolatedTransform } from './interpolation'

export type OnlineConnectionStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline' | 'error'

export interface RemotePlayer {
  readonly id: string
  nickname: string
  appearance: AvatarAppearance
  activityId: ActivityId
  runId: ActivityRunId | null
  emote: null | {
    readonly kind: Emote
    readonly startedAt: number
    readonly durationMs: number
  }
  readonly interpolation: RemoteInterpolationBuffer
}

export interface OnlineClientSnapshot {
  readonly status: OnlineConnectionStatus
  readonly playerId: string | null
  readonly roomId: string | null
  readonly activityId: ActivityId
  readonly runId: ActivityRunId | null
  readonly players: readonly RemotePlayer[]
  readonly world: WorldState | null
  readonly lastWorldEvent: WorldEvent | null
  readonly nucleusState: NucleusCombatState | null
  readonly nucleusEvents: readonly NucleusCombatEventMessage[]
  /** The expedition lobby this player is gathered in, if any. */
  /** Latest co-op world state per sender, newest wins. */
  readonly partyState: { readonly fromId: string; readonly seq: number; readonly data: unknown; readonly serverTime: number } | null
  /** Bounded queue of co-op intents; the host consumes them in order. */
  readonly partyActions: readonly { readonly fromId: string; readonly seq: number; readonly data: unknown; readonly serverTime: number }[]
  readonly lobby: LobbySnapshot | null
  /** Set once the host launches; consumed by the UI to navigate everyone together. */
  readonly lobbyLaunch: { readonly runId: string; readonly seed: number; readonly activityId: ExpeditionActivityId } | null
  readonly latencyMs: number | null
  readonly networkRate: number
  readonly clockOffsetMs: number
  readonly reconnectAttempt: number
  readonly error: string | null
  readonly errorCode: ProtocolErrorCode | null
  readonly revision: number
}

export function countConnectedPlayers(snapshot: Pick<OnlineClientSnapshot, 'playerId' | 'players'>): number {
  return snapshot.players.length + (snapshot.playerId === null ? 0 : 1)
}

export interface PrimeverseClientOptions {
  readonly nickname: string
  readonly appearance: AvatarAppearance
  readonly url?: string
  readonly resumeToken?: string | null
  readonly onResumeTokenChange?: (resumeToken: string) => void
}

interface DestroyOptions {
  readonly preserveResumeLease?: boolean
}

type Listener = () => void

const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000] as const
export const PRIMEVERSE_RECONNECT_ATTEMPTS = RETRY_DELAYS_MS.length

/** Preserve continuous camera turns while keeping the wire yaw in protocol bounds. */
export function normalizeNetworkYaw(yaw: number): number {
  if (!Number.isFinite(yaw)) return 0
  return Math.atan2(Math.sin(yaw), Math.cos(yaw))
}

function deriveWebSocketUrl(): string {
  const environment = import.meta.env as Record<string, string | undefined>
  const configured = environment.VITE_PRIMEVERSE_WS_URL
  if (configured) return configured
  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${scheme}//${window.location.host}/api/primeverse`
}

export class PrimeverseOnlineClient {
  private readonly nickname: string
  private readonly appearance: AvatarAppearance
  private readonly url: string
  private socket: WebSocket | null = null
  private destroyed = false
  private autoReconnect = true
  private generation = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private retryIndex = 0
  private sequence = 0
  private nucleusCastSequence = 0
  private lastMovementSentAt = 0
  private lastMessageAt = 0
  private serverClockOffsetMs = 0
  private resumeToken: string | null
  private readonly onResumeTokenChange: ((resumeToken: string) => void) | undefined
  private invalidServerFrames = 0
  private packetsInRateWindow = 0
  private rateWindowStartedAt = Date.now()
  private pendingCorrection: InterpolatedTransform | null = null
  private readonly listeners = new Set<Listener>()
  private readonly remotes = new Map<string, RemotePlayer>()
  private snapshot: OnlineClientSnapshot = {
    status: 'idle', playerId: null, roomId: null, activityId: 'nexus', runId: null, players: [], world: null,
    lastWorldEvent: null, nucleusState: null, nucleusEvents: [], partyState: null, partyActions: [], lobby: null, lobbyLaunch: null,
    latencyMs: null, networkRate: 0, clockOffsetMs: 0,
    reconnectAttempt: 0, error: null, errorCode: null, revision: 0,
  }

  constructor(options: PrimeverseClientOptions) {
    this.nickname = options.nickname
    this.appearance = options.appearance
    this.url = options.url ?? deriveWebSocketUrl()
    this.resumeToken = options.resumeToken ?? null
    this.onResumeTokenChange = options.onResumeTokenChange
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): OnlineClientSnapshot => this.snapshot

  getServerNow(): number {
    return Date.now() + this.serverClockOffsetMs
  }

  connect(): void {
    this.destroyed = false
    this.autoReconnect = true
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return
    const generation = ++this.generation
    this.patchSnapshot({
      status: this.retryIndex > 0 ? 'reconnecting' : 'connecting',
      error: null,
      errorCode: null,
      reconnectAttempt: this.retryIndex,
    })

    let socket: WebSocket
    try {
      socket = new WebSocket(this.url)
    } catch {
      this.scheduleReconnect('Não foi possível abrir a conexão em tempo real.')
      return
    }
    this.socket = socket

    socket.addEventListener('open', () => {
      if (this.destroyed || generation !== this.generation) return
      this.lastMessageAt = Date.now()
      this.send({
        type: 'join',
        version: PROTOCOL_VERSION,
        nickname: this.nickname,
        appearance: this.appearance,
        ...(this.resumeToken ? { resumeToken: this.resumeToken } : {}),
      })
      this.startHeartbeat()
    })
    socket.addEventListener('message', (event) => {
      if (generation !== this.generation) return
      this.lastMessageAt = Date.now()
      this.receive(event.data)
    })
    socket.addEventListener('close', () => {
      if (generation !== this.generation) return
      this.stopHeartbeat()
      this.socket = null
      if (!this.destroyed && this.autoReconnect) {
        this.scheduleReconnect('A conexão caiu; tentando reencontrar a sala.')
      }
    })
    socket.addEventListener('error', () => {
      if (generation !== this.generation || this.destroyed) return
      // close owns retry scheduling; browsers intentionally expose no useful WS error details.
      socket.close()
    })
  }

  retry(): void {
    if (this.destroyed) return
    this.autoReconnect = true
    this.retryIndex = 0
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    this.connect()
  }

  destroy(options: DestroyOptions = {}): void {
    if (this.destroyed) return
    this.destroyed = true
    this.autoReconnect = false
    this.generation += 1
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    this.stopHeartbeat()
    const socket = this.socket
    this.socket = null
    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
      if (options.preserveResumeLease) socket.close(4000, 'session-suspended')
      else socket.close(1000, 'client-left')
    }
    this.remotes.clear()
  }

  sendMovement(position: readonly [number, number, number], yaw: number, animation: PlayerAnimation): void {
    const now = performance.now()
    if (now - this.lastMovementSentAt < NETWORK_INTERVAL_MS) return
    this.lastMovementSentAt = now
    this.sequence += 1
    this.send({
      type: 'move',
      sequence: this.sequence,
      clientTime: Date.now(),
      position: { x: position[0], y: position[1], z: position[2] },
      yaw: normalizeNetworkYaw(yaw),
      animation,
    })
  }

  sendActivityMovement(
    position: readonly [number, number, number],
    yaw: number,
    animation: PlayerAnimation,
  ): void {
    const activityId = this.snapshot.activityId
    const runId = this.snapshot.runId
    if (activityId === 'nexus' || runId === null) return
    const now = performance.now()
    if (now - this.lastMovementSentAt < NETWORK_INTERVAL_MS) return
    this.lastMovementSentAt = now
    this.sequence += 1
    this.send({
      type: 'activity_move',
      activityId,
      runId,
      sequence: this.sequence,
      clientTime: Date.now(),
      position: { x: position[0], y: position[1], z: position[2] },
      yaw: normalizeNetworkYaw(yaw),
      animation,
    })
  }

  changeActivity(activityId: ActivityId, portalId?: PortalId): boolean {
    this.patchSnapshot({ error: null, errorCode: null })
    return this.send({
      type: 'change_activity',
      activityId,
      ...(portalId ? { portalId } : {}),
    })
  }

  joinNucleus(runId: ActivityRunId, heroId: NucleusHeroId): boolean {
    if (this.snapshot.status !== 'online'
      || this.snapshot.activityId !== 'nucleus-257'
      || this.snapshot.runId !== runId) return false
    const sent = this.send({ type: 'nucleus_join', runId, heroId })
    if (sent) this.patchSnapshot({ nucleusState: null, nucleusEvents: [], error: null, errorCode: null })
    return sent
  }

  leaveNucleus(runId: ActivityRunId): boolean {
    if (this.snapshot.status !== 'online'
      || this.snapshot.activityId !== 'nucleus-257'
      || this.snapshot.runId !== runId) return false
    const sent = this.send({ type: 'nucleus_leave', runId })
    if (sent) this.patchSnapshot({ nucleusState: null, nucleusEvents: [] })
    return sent
  }

  castNucleus(
    runId: ActivityRunId,
    slot: NucleusAbilitySlot,
    aim: NucleusAimInput,
  ): string | null {
    if (this.snapshot.status !== 'online'
      || this.snapshot.activityId !== 'nucleus-257'
      || this.snapshot.runId !== runId) return null
    this.nucleusCastSequence += 1
    const actorSuffix = (this.snapshot.playerId ?? 'operator').slice(-12)
    const castId = `n:${Date.now().toString(36)}:${this.nucleusCastSequence.toString(36)}:${actorSuffix}`
    return this.send({
      type: 'nucleus_cast',
      runId,
      castId,
      slot,
      aim,
      clientTime: Date.now(),
    }) ? castId : null
  }

  private partySeq = 0

  sendPartyState(data: unknown): boolean {
    const runId = this.snapshot.runId
    if (!runId) return false
    this.partySeq += 1
    return this.send({ type: 'party_state', runId, seq: this.partySeq, data })
  }

  sendPartyAction(data: unknown): boolean {
    const runId = this.snapshot.runId
    if (!runId) return false
    this.partySeq += 1
    return this.send({ type: 'party_action', runId, seq: this.partySeq, data })
  }

  /** The host drains intents; each is delivered exactly once. */
  consumePartyActions(): readonly { readonly fromId: string; readonly seq: number; readonly data: unknown; readonly serverTime: number }[] {
    const actions = this.snapshot.partyActions
    if (actions.length > 0) this.patchSnapshot({ partyActions: [] })
    return actions
  }

  createLobby(activityId: ExpeditionActivityId): boolean {
    return this.send({ type: 'lobby_create', activityId })
  }

  joinLobby(code: string): boolean {
    return this.send({ type: 'lobby_join', code: code.toUpperCase() })
  }

  setLobbyReady(ready: boolean): boolean {
    return this.send({ type: 'lobby_ready', ready })
  }

  leaveLobby(): boolean {
    this.patchSnapshot({ lobby: null })
    return this.send({ type: 'lobby_leave' })
  }

  launchLobby(): boolean {
    return this.send({ type: 'lobby_launch' })
  }

  /** The UI navigates on launch exactly once; this hands the ticket over. */
  consumeLobbyLaunch(): OnlineClientSnapshot['lobbyLaunch'] {
    const launch = this.snapshot.lobbyLaunch
    if (launch) this.patchSnapshot({ lobbyLaunch: null })
    return launch
  }

  sendEmote(emote: Emote): void {
    this.send({ type: 'emote', emote })
  }

  sendInteraction(target: InteractionTarget, action: InteractionAction): void {
    this.send({ type: 'interaction', target, action })
  }

  sampleRemote(playerId: string): InterpolatedTransform | null {
    return this.remotes.get(playerId)?.interpolation.sample(this.getServerNow()) ?? null
  }

  consumeAuthoritativeCorrection(): InterpolatedTransform | null {
    const correction = this.pendingCorrection
    this.pendingCorrection = null
    return correction
  }

  private send(message: ClientMessage): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false
    this.socket.send(JSON.stringify(message))
    return true
  }

  private receive(raw: unknown): void {
    const result = parseServerMessage(raw)
    if (!result.ok) {
      this.invalidServerFrames += 1
      if (this.invalidServerFrames >= 3) this.socket?.close(1002, 'invalid server protocol')
      return
    }
    this.invalidServerFrames = 0
    this.recordPacketRate()
    const parsed: ServerMessage = result.value

    switch (parsed.type) {
      case 'welcome': {
        this.retryIndex = 0
        this.sequence = 0
        this.nucleusCastSequence = 0
        this.resumeToken = parsed.resumeToken
        this.onResumeTokenChange?.(parsed.resumeToken)
        this.serverClockOffsetMs = parsed.serverTime - Date.now()
        this.remotes.clear()
        let activityId: ActivityId = 'nexus'
        let runId: ActivityRunId | null = null
        for (const player of parsed.players) {
          if (player.id !== parsed.playerId) this.addRemote(player)
          else {
            activityId = player.activityId
            runId = player.runId
            this.sequence = Math.max(this.sequence, player.sequence)
            this.pendingCorrection = {
              position: [player.position.x, player.position.y, player.position.z],
              yaw: player.yaw,
              animation: player.animation,
              serverTime: player.updatedAt,
              sequence: player.sequence,
            }
          }
        }
        this.patchSnapshot({
          status: 'online', playerId: parsed.playerId, roomId: parsed.roomId,
          activityId, runId,
          players: [...this.remotes.values()], world: parsed.world,
          nucleusState: null, nucleusEvents: [],
          reconnectAttempt: 0, error: null, errorCode: null, clockOffsetMs: this.serverClockOffsetMs,
        })
        break
      }
      case 'player_joined':
        if (parsed.player.id !== this.snapshot.playerId) {
          this.addRemote(parsed.player)
          this.patchSnapshot({ players: [...this.remotes.values()] })
        }
        break
      case 'player_updated': {
        if (parsed.playerId === this.snapshot.playerId) {
          this.sequence = Math.max(this.sequence, parsed.sequence)
          this.pendingCorrection = {
            position: [parsed.position.x, parsed.position.y, parsed.position.z],
            yaw: parsed.yaw,
            animation: parsed.animation,
            serverTime: parsed.serverTime,
            sequence: parsed.sequence,
          }
          this.patchSnapshot({ activityId: 'nexus', runId: null })
          break
        }
        const remote = this.remotes.get(parsed.playerId)
        if (remote && remote.activityId !== 'nexus') remote.interpolation.clear()
        if (remote) {
          remote.activityId = 'nexus'
          remote.runId = null
        }
        remote?.interpolation.push({
          position: [parsed.position.x, parsed.position.y, parsed.position.z], yaw: parsed.yaw,
          animation: parsed.animation, serverTime: parsed.serverTime, sequence: parsed.sequence,
        })
        break
      }
      case 'activity_changed': {
        if (parsed.playerId === this.snapshot.playerId) {
          this.sequence = Math.max(this.sequence, parsed.sequence)
          this.pendingCorrection = null
          const remainsInNucleus = parsed.activityId === 'nucleus-257'
            && parsed.runId !== null
            && this.snapshot.nucleusState?.runId === parsed.runId
          this.patchSnapshot({
            activityId: parsed.activityId,
            runId: parsed.runId,
            ...(!remainsInNucleus ? { nucleusState: null, nucleusEvents: [] } : {}),
          })
          break
        }
        const remote = this.remotes.get(parsed.playerId)
        if (remote) {
          if (remote.activityId !== parsed.activityId || remote.runId !== parsed.runId) {
            remote.interpolation.clear()
          }
          remote.activityId = parsed.activityId
          remote.runId = parsed.runId
          this.patchSnapshot({ players: [...this.remotes.values()] })
        }
        break
      }
      case 'activity_player_updated': {
        if (parsed.playerId === this.snapshot.playerId) {
          this.sequence = Math.max(this.sequence, parsed.sequence)
          this.pendingCorrection = {
            position: [parsed.position.x, parsed.position.y, parsed.position.z],
            yaw: parsed.yaw,
            animation: parsed.animation,
            serverTime: parsed.serverTime,
            sequence: parsed.sequence,
          }
          this.patchSnapshot({ activityId: parsed.activityId, runId: parsed.runId })
          break
        }
        const remote = this.remotes.get(parsed.playerId)
        if (!remote) break
        const activityChanged = remote.activityId !== parsed.activityId || remote.runId !== parsed.runId
        if (activityChanged) {
          remote.interpolation.clear()
        }
        remote.activityId = parsed.activityId
        remote.runId = parsed.runId
        remote.interpolation.push({
          position: [parsed.position.x, parsed.position.y, parsed.position.z],
          yaw: parsed.yaw,
          animation: parsed.animation,
          serverTime: parsed.serverTime,
          sequence: parsed.sequence,
        })
        if (activityChanged) this.patchSnapshot({ players: [...this.remotes.values()] })
        break
      }
      case 'nucleus_state':
        if (parsed.runId === this.snapshot.runId && this.snapshot.activityId === 'nucleus-257') {
          const currentRevision = this.snapshot.nucleusState?.revision ?? -1
          if (parsed.revision >= currentRevision) this.patchSnapshot({ nucleusState: parsed })
        }
        break
      case 'nucleus_event':
        if (parsed.runId === this.snapshot.runId && this.snapshot.activityId === 'nucleus-257') {
          // Pub/Sub relays from distinct runtimes can arrive out of revision
          // order. eventId is the idempotency boundary; the scene separately
          // applies a short server-time freshness window before showing it.
          // Keep the newest revisions when a burst exceeds the bounded queue:
          // an old delayed relay must not evict a newer cast that React has not
          // consumed yet.
          if (!this.snapshot.nucleusEvents.some((event) => event.eventId === parsed.eventId)) {
            const nucleusEvents = [...this.snapshot.nucleusEvents, parsed]
              .sort((left, right) => (
                left.revision - right.revision
                || left.serverTime - right.serverTime
                || left.eventId.localeCompare(right.eventId)
              ))
              .slice(-32)
            this.patchSnapshot({ nucleusEvents })
          }
        }
        break
      case 'player_left':
        if (this.remotes.delete(parsed.playerId)) this.patchSnapshot({ players: [...this.remotes.values()] })
        break
      case 'player_emote': {
        const remote = this.remotes.get(parsed.playerId)
        if (remote) {
          remote.emote = {
            kind: parsed.emote,
            startedAt: parsed.startedAt - this.serverClockOffsetMs,
            durationMs: parsed.durationMs,
          }
          this.patchSnapshot({ players: [...this.remotes.values()] })
        }
        break
      }
      case 'party_state':
        if (parsed.runId === this.snapshot.runId
          && (this.snapshot.partyState === null
            || parsed.fromId !== this.snapshot.partyState.fromId
            || parsed.seq > this.snapshot.partyState.seq)) {
          this.patchSnapshot({
            partyState: { fromId: parsed.fromId, seq: parsed.seq, data: parsed.data, serverTime: parsed.serverTime },
          })
        }
        break
      case 'party_action':
        if (parsed.runId === this.snapshot.runId) {
          this.patchSnapshot({
            partyActions: [
              ...this.snapshot.partyActions,
              { fromId: parsed.fromId, seq: parsed.seq, data: parsed.data, serverTime: parsed.serverTime },
            ].slice(-24),
          })
        }
        break
      case 'lobby_state':
        this.patchSnapshot({ lobby: parsed.lobby })
        break
      case 'lobby_closed':
        if (this.snapshot.lobby?.code === parsed.code) this.patchSnapshot({ lobby: null })
        break
      case 'lobby_launched':
        this.patchSnapshot({
          lobby: null,
          lobbyLaunch: { runId: parsed.runId, seed: parsed.seed, activityId: parsed.lobby.activityId },
        })
        break
      case 'world_state':
        this.serverClockOffsetMs += ((parsed.state.serverTime - Date.now()) - this.serverClockOffsetMs) * 0.08
        this.patchSnapshot({ world: parsed.state, clockOffsetMs: this.serverClockOffsetMs })
        break
      case 'world_event':
        this.patchSnapshot({ lastWorldEvent: parsed.event })
        break
      case 'pong': {
        const latencyMs = Math.max(0, Date.now() - parsed.clientTime)
        const midpoint = parsed.clientTime + latencyMs / 2
        this.serverClockOffsetMs += ((parsed.serverTime - midpoint) - this.serverClockOffsetMs) * 0.3
        this.patchSnapshot({ latencyMs: Math.round(latencyMs), clockOffsetMs: this.serverClockOffsetMs })
        break
      }
      case 'error': {
        if (!parsed.recoverable) {
          this.autoReconnect = false
          const failedSocket = this.socket
          this.patchSnapshot({ error: parsed.message, errorCode: parsed.code, status: 'error' })
          failedSocket?.close(1008, parsed.code)
        } else {
          this.patchSnapshot({ error: parsed.message, errorCode: parsed.code })
        }
        break
      }
    }
  }

  private addRemote(player: PlayerSnapshot): void {
    this.remotes.set(player.id, {
      id: player.id,
      nickname: player.nickname,
      appearance: player.appearance,
      activityId: player.activityId,
      runId: player.runId,
      emote: player.emote
        ? {
            ...player.emote,
            startedAt: player.emote.startedAt - this.serverClockOffsetMs,
            durationMs: EMOTE_DURATION_MS,
          }
        : null,
      interpolation: new RemoteInterpolationBuffer(player),
    })
  }

  private patchSnapshot(patch: Partial<OnlineClientSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch, revision: this.snapshot.revision + 1 }
    for (const listener of this.listeners) listener()
  }

  private recordPacketRate(): void {
    this.packetsInRateWindow += 1
    const now = Date.now()
    const elapsed = now - this.rateWindowStartedAt
    if (elapsed < 1_000) return
    const networkRate = Math.round(this.packetsInRateWindow * 1_000 / Math.max(1, elapsed))
    this.packetsInRateWindow = 0
    this.rateWindowStartedAt = now
    this.patchSnapshot({ networkRate })
  }

  private scheduleReconnect(reason: string): void {
    if (this.destroyed || !this.autoReconnect) return
    if (this.retryIndex >= RETRY_DELAYS_MS.length) {
      this.patchSnapshot({
        status: 'offline',
        error: 'Não conseguimos reconectar. Verifique sua rede e tente novamente.',
        errorCode: null,
        reconnectAttempt: this.retryIndex,
      })
      return
    }
    const delay = RETRY_DELAYS_MS[this.retryIndex]
    this.retryIndex += 1
    this.patchSnapshot({ status: 'reconnecting', error: reason, errorCode: null, reconnectAttempt: this.retryIndex })
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.connect()
    }, delay)
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (Date.now() - this.lastMessageAt > HEARTBEAT_INTERVAL_MS * 2.5) {
        this.socket?.close(4000, 'heartbeat-timeout')
        return
      }
      this.send({ type: 'ping', clientTime: Date.now() })
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = null
  }
}
