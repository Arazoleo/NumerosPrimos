import { randomUUID } from 'node:crypto'
import { createServer, type Server as HttpServer } from 'node:http'
import express, { type Express, type Request, type Response } from 'express'
import WebSocket, { WebSocketServer, type RawData } from 'ws'
import {
  EMOTE_DURATION_MS,
  HEARTBEAT_INTERVAL_MS,
  MAX_MESSAGE_BYTES,
  NETWORK_HZ,
  PLAYER_TIMEOUT_MS,
  PROTOCOL_VERSION,
  ACTIVITY_MOVEMENT_PROFILES,
  ACTIVITY_SPAWNS,
  createActivityRunId,
  castPrimeSequenceVote,
  choiceFromInteractionTarget,
  parseClientMessage,
  removePrimeSequenceVoter,
  updateWorldCore,
  advancePrimeSequence,
  createMovementBudget,
  isValidInteractionPair,
  isPositionInActivity,
  validateMovement,
  type ActivityMoveMessage,
  type ActivityRunId,
  type ClientMessage,
  type ChangeActivityMessage,
  type Emote,
  type ExpeditionActivityId,
  type InteractionMessage,
  type MoveMessage,
  type MovementBudget,
  type NucleusCastMessage,
  type NucleusCombatPlayer,
  type NucleusCombatEvent,
  type NucleusJoinMessage,
  type NucleusLeaveMessage,
  type PlayerLeftReason,
  type PlayerSnapshot,
  type ProtocolErrorCode,
  type ServerMessage,
  type WorldEvent,
  type WorldState,
} from '../../src/features/primeverse/games/primeverse-online/shared/index.js'
import { getHeroKit } from '../../src/features/primeverse/games/nucleus-257/classKits.js'
import {
  PORTAL_IDS,
  PORTAL_ROUTES,
  type PortalId,
} from '../../src/features/primeverse/games/primeverse-online/shared/realms.js'
import {
  createLobby,
  isLobbyExpired,
  joinLobby,
  launchLobby,
  leaveLobby,
  lobbyCodeFromSeed,
  setLobbyReady,
  toLobbyView,
  type LobbyFailure,
  type LobbyRecord,
} from './lobby'
import { createStoreFromEnvironment } from './createStore.js'
import type { RelayEnvelope, StoredPlayer, WorldRecord } from './model.js'
import {
  ConnectionSupersededError,
  RoomCapacityError,
  StoreUnavailableError,
  type PrimeverseStore,
} from './store.js'
import {
  castNucleusAbility,
  joinNucleusCombat,
  leaveNucleusCombat,
  synchronizeCombatPoses,
  tickNucleusCombat,
  toNucleusCombatState,
  type NucleusCombatRejection,
  type NucleusMutationResult,
} from './nucleusCombat.js'
import {
  collidesWithCover,
  isInsideArena,
  resolveArenaAbilityMovement,
} from '../../src/features/primeverse/games/nucleus-257/arenaWorld.js'

const SPAWN_POSITION = Object.freeze({ x: 0, y: 0.04, z: 13 })
const WORLD_TICK_MS = 500
const JOIN_TIMEOUT_MS = 10_000
const MOVE_MIN_INTERVAL_MS = 1_000 / (NETWORK_HZ * 1.35)
const MAX_PROTOCOL_VIOLATIONS = 10
const PORTAL_INTERACTION_DISTANCE = 4
const NUCLEUS_MAX_PLAYER_Y = 2
const NUCLEUS_GROUND_Y = 0.05
const NUCLEUS_MAX_AIRBORNE_MS = 1_800

interface ClientSession {
  readonly socket: WebSocket
  playerId: string
  roomId: string | null
  player: StoredPlayer | null
  joined: boolean
  closing: boolean
  lastPongAt: number
  lastMoveAt: number
  lastActivityDiscontinuityAt: number
  lastEmoteAt: number
  lastInteractionAt: number
  lastNucleusCastAt: number
  lastPartyStateAt: number
  lastPartyActionAt: number
  nucleusCombatRunId: ActivityRunId | null
  /** Code of the expedition lobby this session is gathered in, if any. */
  lobbyCode: string | null
  nucleusAlive: boolean | null
  nucleusCombatant: NucleusCombatPlayer | null
  nucleusAirborneSince: number | null
  nucleusStateRevision: number
  movementBudget: MovementBudget
  protocolViolations: number
  messageTimes: number[]
  queue: Promise<void>
}

export interface PrimeverseServerOptions {
  readonly store?: PrimeverseStore
  readonly instanceId?: string
  readonly websocketPath?: string
  readonly allowedOrigins?: readonly string[]
  readonly now?: () => number
  readonly enableTimers?: boolean
}

export interface PrimeverseServerRuntime {
  readonly app: Express
  readonly server: HttpServer
  readonly wss: WebSocketServer
  readonly store: PrimeverseStore
  readonly instanceId: string
  close(): Promise<void>
}

export function createPrimeverseServer(options: PrimeverseServerOptions = {}): PrimeverseServerRuntime {
  const now = options.now ?? Date.now
  const instanceId = options.instanceId ?? randomUUID()
  const websocketPath = options.websocketPath ?? '/api/primeverse'
  const store = options.store ?? createStoreFromEnvironment()
  const allowedOrigins = options.allowedOrigins ?? originsFromEnvironment(process.env.PRIMEVERSE_ALLOWED_ORIGINS)
  const app = express()
  app.disable('x-powered-by')
  app.use((_request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'same-origin')
    next()
  })
  app.use(express.json({ limit: '8kb' }))
  app.get('/health', (_request, response) => {
    void sendHealth(store, instanceId, response)
  })
  app.get(websocketPath, (_request, response) => {
    response.status(426).json({
      ok: false,
      error: 'Upgrade Required',
      websocketPath,
    })
  })

  const server = createServer(app)
  const wss = new WebSocketServer({
    server,
    path: websocketPath,
    maxPayload: MAX_MESSAGE_BYTES,
    perMessageDeflate: false,
    clientTracking: true,
    verifyClient: ({ origin, req }, done) => {
      if (isOriginAllowed(origin, req.headers.host, allowedOrigins)) done(true)
      else done(false, 403, 'Origin not allowed')
    },
  })

  const sessions = new Map<WebSocket, ClientSession>()
  const activeRooms = new Map<string, Set<ClientSession>>()
  const knownPlayers = new Map<string, Set<string>>()
  const observedWorlds = new Map<string, { revision: number | null; state: WorldState }>()
  const observedNucleusRevisions = new Map<string, number>()
  /**
   * Expedition lobbies live in this process. They are short-lived, hold no
   * gameplay authority — the launch just hands everyone the same run id and seed —
   * and a lobby is therefore never worth replicating across instances.
   */
  const lobbies = new Map<string, LobbyRecord>()

  function sessionsForLobby(lobby: LobbyRecord): ClientSession[] {
    const memberIds = new Set(lobby.members.map((member) => member.playerId))
    return [...sessions.values()].filter((candidate) => memberIds.has(candidate.playerId))
  }

  function broadcastLobby(lobby: LobbyRecord): void {
    const snapshot = toLobbyView(lobby)
    for (const target of sessionsForLobby(lobby)) {
      send(target, { type: 'lobby_state', lobby: snapshot })
    }
  }

  function detachFromLobby(session: ClientSession, nowMs: number): void {
    const code = session.lobbyCode
    if (!code) return
    session.lobbyCode = null
    const lobby = lobbies.get(code)
    if (!lobby) return
    const result = leaveLobby(lobby, session.playerId, nowMs)
    if (!result.lobby) return
    if (result.lobby.phase === 'closed') {
      lobbies.delete(code)
      return
    }
    lobbies.set(code, result.lobby)
    broadcastLobby(result.lobby)
  }

  function allocateLobbyCode(nowMs: number): string {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const code = lobbyCodeFromSeed(Math.floor(Math.random() * 0xffffff) + attempt * 7 + nowMs % 977)
      const existing = lobbies.get(code)
      if (!existing || isLobbyExpired(existing, nowMs)) return code
    }
    return lobbyCodeFromSeed(nowMs)
  }

  function collectExpiredLobbies(nowMs: number): void {
    for (const [code, lobby] of lobbies) {
      if (isLobbyExpired(lobby, nowMs)) lobbies.delete(code)
    }
  }
  const tickingRooms = new Set<string>()
  let closed = false

  const unsubscribeRelay = store.subscribe((envelope) => {
    if (envelope.instanceId === instanceId) return
    observePlayerPacket(knownPlayers, envelope.roomId, envelope.packet)
    observeWorldPacket(observedWorlds, envelope.roomId, envelope.packet)
    observeNucleusPacket(observedNucleusRevisions, envelope.roomId, envelope.packet)
    applyAuthoritativePacket(activeRooms, envelope.roomId, envelope.packet, envelope.sentAt)
    broadcastLocal(activeRooms, envelope.roomId, envelope.packet)
  })

  wss.on('connection', (socket) => {
    const connectedAt = now()
    const session: ClientSession = {
      socket,
      playerId: randomUUID(),
      roomId: null,
      player: null,
      joined: false,
      closing: false,
      lastPongAt: connectedAt,
      lastMoveAt: connectedAt,
      lastActivityDiscontinuityAt: Number.NEGATIVE_INFINITY,
      lastEmoteAt: 0,
      lastInteractionAt: 0,
      lastNucleusCastAt: Number.NEGATIVE_INFINITY,
      lastPartyStateAt: Number.NEGATIVE_INFINITY,
      lastPartyActionAt: Number.NEGATIVE_INFINITY,
      nucleusCombatRunId: null,
      lobbyCode: null,
      nucleusAlive: null,
      nucleusCombatant: null,
      nucleusAirborneSince: null,
      nucleusStateRevision: 0,
      movementBudget: createMovementBudget(),
      protocolViolations: 0,
      messageTimes: [],
      queue: Promise.resolve(),
    }
    sessions.set(socket, session)

    // Registered synchronously: no client frame can be lost while storage connects.
    socket.on('message', (raw) => {
      session.queue = session.queue
        .then(() => handleRawMessage(session, raw))
        .catch((error: unknown) => failSession(session, error))
    })
    socket.on('pong', () => {
      session.lastPongAt = now()
      void touchSession(session, session.lastPongAt).catch((error: unknown) => failSession(session, error))
    })
    socket.on('error', () => {
      void disconnect(session, 'disconnect')
    })
    socket.on('close', (code) => {
      const resumableClose = code !== 1000 && code !== 1008 && code !== 4001
      void disconnect(session, 'disconnect', resumableClose)
    })

    const joinTimer = setTimeout(() => {
      if (!session.joined && socket.readyState === WebSocket.OPEN) {
        sendError(session, 'NOT_JOINED', 'A conexão expirou antes da entrada na sala.', false)
        socket.close(1008, 'join timeout')
      }
    }, JOIN_TIMEOUT_MS)
    joinTimer.unref()
    socket.once('close', () => clearTimeout(joinTimer))
    void store.start().catch((error: unknown) => failSession(session, error))
  })

  const heartbeatTimer = setInterval(() => {
    const currentTime = now()
    for (const session of sessions.values()) {
      if (currentTime - session.lastPongAt > PLAYER_TIMEOUT_MS) {
        void disconnect(session, 'timeout')
        session.socket.terminate()
        continue
      }
      if (session.socket.readyState === WebSocket.OPEN) session.socket.ping()
      void touchSession(session, currentTime).catch((error: unknown) => failSession(session, error))
    }
  }, HEARTBEAT_INTERVAL_MS)

  const worldTimer = setInterval(() => {
    for (const roomId of activeRooms.keys()) void tickWorld(roomId)
  }, WORLD_TICK_MS)
  if (options.enableTimers === false) {
    clearInterval(heartbeatTimer)
    clearInterval(worldTimer)
  } else {
    heartbeatTimer.unref()
    worldTimer.unref()
  }

  async function handleRawMessage(session: ClientSession, raw: RawData): Promise<void> {
    if (session.closing || session.socket.readyState !== WebSocket.OPEN) return
    const receivedAt = now()
    session.lastPongAt = receivedAt
    if (!consumeGeneralRate(session, receivedAt)) {
      registerViolation(session, 'RATE_LIMITED', 'Muitas mensagens em pouco tempo.')
      return
    }

    const decoded = normalizeRawData(raw)
    const result = parseClientMessage(decoded)
    if (!result.ok) {
      registerViolation(session, result.error.code, result.error.message)
      return
    }
    await handleMessage(session, result.value, receivedAt)
  }

  async function touchSession(session: ClientSession, touchedAt: number): Promise<void> {
    if (!session.joined || !session.roomId || !session.player || session.closing) return
    const touched = await store.touch(
      session.roomId,
      session.playerId,
      session.player.resumeToken,
      touchedAt,
    )
    if (!touched) closeSupersededSession(session)
  }

  async function handleMessage(
    session: ClientSession,
    message: ClientMessage,
    receivedAt: number,
  ): Promise<void> {
    if (message.type === 'join') {
      if (session.joined) {
        registerViolation(session, 'ALREADY_JOINED', 'Você já entrou em uma sala.')
        return
      }
      let player: StoredPlayer = {
        id: session.playerId,
        nickname: message.nickname,
        appearance: message.appearance,
        activityId: 'nexus',
        runId: null,
        position: { ...SPAWN_POSITION },
        yaw: Math.PI,
        animation: 'idle',
        emote: null,
        sequence: 0,
        joinedAt: receivedAt,
        resumeToken: randomUUID(),
        nucleusAirborneSince: null,
        updatedAt: receivedAt,
      }
      try {
        const resumedSnapshot = message.resumeToken
          ? await store.resume(player, message.resumeToken, receivedAt)
          : null
        const snapshot = resumedSnapshot ?? await store.join(player, receivedAt)
        if (resumedSnapshot) {
          const resumedPlayer = snapshot.players.find(
            (candidate) => candidate.resumeToken === player.resumeToken,
          )
          if (!resumedPlayer) throw new Error('A sessão retomada não apareceu no snapshot da sala.')
          player = resumedPlayer
          session.playerId = player.id
          closeSupersededLocalSessions(sessions, session)
        }
        const reconciledWorld = await reconcileJoinExpirations(
          snapshot.roomId,
          snapshot.world,
          snapshot.expiredPlayerIds,
          receivedAt,
        )
        session.player = player
        session.roomId = snapshot.roomId
        session.joined = true
        session.lastMoveAt = receivedAt
        session.lastActivityDiscontinuityAt = Number.NEGATIVE_INFINITY
        session.nucleusAirborneSince = restoredNucleusAirborneSince(player, receivedAt)
        const resumedNucleus = resumedSnapshot !== null && player.activityId === 'nucleus-257'
        session.movementBudget = createMovementBudget(
          !resumedNucleus,
          ACTIVITY_MOVEMENT_PROFILES[player.activityId],
        )
        recoverDurableWorld(activeRooms, observedWorlds, snapshot.roomId, reconciledWorld)
        addToLocalRoom(activeRooms, snapshot.roomId, session)
        const knownInRoom = knownPlayers.get(snapshot.roomId) ?? new Set<string>()
        for (const known of snapshot.players) knownInRoom.add(known.id)
        knownPlayers.set(snapshot.roomId, knownInRoom)
        send(session, {
          type: 'welcome',
          version: PROTOCOL_VERSION,
          playerId: session.playerId,
          roomId: snapshot.roomId,
          resumeToken: player.resumeToken,
          players: snapshot.players.map(toPlayerSnapshot),
          world: { ...reconciledWorld.state, serverTime: receivedAt },
          serverTime: receivedAt,
        })
        if (player.activityId === 'nucleus-257' && player.runId !== null) {
          const combat = await store.getNucleusCombat(snapshot.roomId, player.runId, receivedAt)
          const combatState = toNucleusCombatState(combat, receivedAt)
          applyAuthoritativePacket(activeRooms, snapshot.roomId, combatState, receivedAt)
          send(session, combatState)
          observeNucleusPacket(observedNucleusRevisions, snapshot.roomId, combatState)
        }
        await relay(snapshot.roomId, { type: 'player_joined', player: toPlayerSnapshot(player) }, session)
        void tickWorld(snapshot.roomId)
      } catch (error) {
        if (error instanceof RoomCapacityError) {
          sendError(session, 'ROOM_FULL', error.message, true)
          return
        }
        throw error
      }
      return
    }

    if (message.type === 'lobby_create') {
      if (!session.joined) {
        registerViolation(session, 'NOT_JOINED', 'Entre na sala antes de abrir um lobby.')
        return
      }
      collectExpiredLobbies(receivedAt)
      detachFromLobby(session, receivedAt)
      const code = allocateLobbyCode(receivedAt)
      const lobby = createLobby({
        code,
        activityId: message.activityId,
        hostId: session.playerId,
        hostName: session.player?.nickname ?? 'Explorador',
        nowMs: receivedAt,
      })
      lobbies.set(code, lobby)
      session.lobbyCode = code
      broadcastLobby(lobby)
      return
    }

    if (message.type === 'lobby_join') {
      if (!session.joined) {
        registerViolation(session, 'NOT_JOINED', 'Entre na sala antes de usar um código.')
        return
      }
      collectExpiredLobbies(receivedAt)
      const target = lobbies.get(message.code)
      const result = joinLobby(target ?? null, {
        playerId: session.playerId,
        name: session.player?.nickname ?? 'Explorador',
      }, receivedAt)
      if (!result.lobby) {
        sendError(session, 'INVALID_PAYLOAD', lobbyErrorMessage(result.error), false)
        return
      }
      if (session.lobbyCode && session.lobbyCode !== message.code) {
        detachFromLobby(session, receivedAt)
      }
      lobbies.set(message.code, result.lobby)
      session.lobbyCode = message.code
      broadcastLobby(result.lobby)
      return
    }

    if (message.type === 'lobby_ready') {
      const lobby = session.lobbyCode ? lobbies.get(session.lobbyCode) ?? null : null
      const result = setLobbyReady(lobby, session.playerId, message.ready, receivedAt)
      if (!result.lobby) {
        sendError(session, 'INVALID_PAYLOAD', lobbyErrorMessage(result.error), false)
        return
      }
      lobbies.set(result.lobby.code, result.lobby)
      broadcastLobby(result.lobby)
      return
    }

    if (message.type === 'lobby_leave') {
      const code = session.lobbyCode
      detachFromLobby(session, receivedAt)
      if (code) send(session, { type: 'lobby_closed', code })
      return
    }

    if (message.type === 'lobby_launch') {
      const lobby = session.lobbyCode ? lobbies.get(session.lobbyCode) ?? null : null
      const runId = `run:${randomUUID()}:${lobby?.activityId ?? 'sieve-catacombs'}`
      const result = launchLobby(lobby, session.playerId, {
        runId,
        // The seed is what makes it the same expedition, not just the same room.
        seed: Math.floor(Math.random() * 0xffffffff),
        nowMs: receivedAt,
      })
      if (!result.lobby) {
        sendError(session, 'INVALID_PAYLOAD', lobbyErrorMessage(result.error), false)
        return
      }
      lobbies.set(result.lobby.code, result.lobby)
      const snapshot = toLobbyView(result.lobby)
      for (const target of sessionsForLobby(result.lobby)) {
        send(target, {
          type: 'lobby_launched',
          lobby: snapshot,
          runId: result.lobby.runId ?? runId,
          seed: result.lobby.seed ?? 0,
        })
        target.lobbyCode = null
      }
      lobbies.delete(result.lobby.code)
      return
    }

    if (message.type === 'ping') {
      send(session, { type: 'pong', clientTime: message.clientTime, serverTime: receivedAt })
      await touchSession(session, receivedAt)
      return
    }
    if (!session.joined || !session.player || !session.roomId) {
      registerViolation(session, 'NOT_JOINED', 'Entre em uma sala antes de enviar esta mensagem.')
      return
    }

    if (message.type === 'party_state' || message.type === 'party_action') {
      await handlePartyRelay(session, message, receivedAt)
      return
    }
    if (message.type === 'move') await handleMovement(session, message, receivedAt)
    else if (message.type === 'activity_move') await handleActivityMovement(session, message, receivedAt)
    else if (message.type === 'change_activity') await handleActivityChange(session, message, receivedAt)
    else if (message.type === 'nucleus_join') await handleNucleusJoin(session, message, receivedAt)
    else if (message.type === 'nucleus_leave') await handleNucleusLeave(session, message, receivedAt)
    else if (message.type === 'nucleus_cast') await handleNucleusCast(session, message, receivedAt)
    else if (message.type === 'emote') await handleEmote(session, message.emote, receivedAt)
    else await handleInteraction(session, message, receivedAt)
  }

  async function handleMovement(
    session: ClientSession,
    message: MoveMessage,
    receivedAt: number,
  ): Promise<void> {
    const previous = session.player
    const roomId = session.roomId
    if (!previous || !roomId) return
    if (previous.activityId !== 'nexus') {
      sendError(session, 'MOVEMENT_REJECTED', 'Use movement scoped to the active expedition.', true)
      send(session, toActivityPlayerUpdate(previous, receivedAt))
      return
    }
    const elapsedMs = receivedAt - session.lastMoveAt
    if (elapsedMs < MOVE_MIN_INTERVAL_MS) return
    const validation = validateMovement(previous, message, elapsedMs, session.movementBudget)
    if (!validation.ok) {
      sendError(session, 'MOVEMENT_REJECTED', `Movimento rejeitado: ${validation.reason}.`, true)
      send(session, toPlayerUpdate(previous, receivedAt))
      return
    }
    session.lastMoveAt = receivedAt
    session.movementBudget = validation.nextBudget
    const player: StoredPlayer = {
      ...previous,
      position: { ...message.position },
      yaw: message.yaw,
      animation: message.animation,
      emote: expiredEmote(previous, receivedAt),
      sequence: message.sequence,
      nucleusAirborneSince: null,
      updatedAt: receivedAt,
    }
    const updated = await store.updatePlayer(roomId, player, receivedAt)
    if (!updated) {
      closeSupersededSession(session)
      return
    }
    session.player = player
    await relay(roomId, {
      type: 'player_updated',
      playerId: player.id,
      position: player.position,
      yaw: player.yaw,
      animation: player.animation,
      sequence: player.sequence,
      serverTime: receivedAt,
    }, session)
  }

  async function handleActivityMovement(
    session: ClientSession,
    message: ActivityMoveMessage,
    receivedAt: number,
  ): Promise<void> {
    const previous = session.player
    const roomId = session.roomId
    if (!previous || !roomId) return
    if (previous.activityId !== message.activityId
      || previous.runId === null
      || previous.runId !== message.runId) {
      sendError(session, 'MOVEMENT_REJECTED', 'Activity or run does not match the authoritative session.', true)
      if (previous.activityId !== 'nexus') {
        send(session, toActivityPlayerUpdate(previous, receivedAt))
      } else {
        send(session, toPlayerUpdate(previous, receivedAt))
      }
      return
    }

    const elapsedMs = receivedAt - session.lastMoveAt
    if (elapsedMs < MOVE_MIN_INTERVAL_MS) return
    const nucleusArenaMovement = message.activityId === 'nucleus-257'
    const nucleusCombatMovement = nucleusArenaMovement
      && session.nucleusCombatRunId === message.runId
    if (nucleusArenaMovement && !nucleusCombatMovement) {
      sendError(session, 'MOVEMENT_REJECTED', 'Escolha um operador antes de se mover na arena.', true)
      send(session, toActivityPlayerUpdate(previous, receivedAt))
      return
    }
    if (nucleusCombatMovement && session.nucleusAlive === false) {
      sendError(session, 'MOVEMENT_REJECTED', 'Operadores eliminados não podem se mover.', true)
      send(session, toActivityPlayerUpdate(previous, receivedAt))
      return
    }
    const movementProfile = nucleusArenaMovement && session.nucleusCombatant
      ? nucleusMovementProfile(session.nucleusCombatant, receivedAt)
      : ACTIVITY_MOVEMENT_PROFILES[message.activityId]
    const nucleusRadius = session.nucleusCombatant
      ? getHeroKit(session.nucleusCombatant.heroId).stats.hitRadius
      : 0.35
    const nextAirborneSince = nucleusArenaMovement
      ? nextNucleusAirborneSince(
          session.nucleusAirborneSince,
          previous.position.y,
          message.position.y,
          receivedAt,
        )
      : null
    if (nextAirborneSince === undefined) {
      sendError(session, 'MOVEMENT_REJECTED', 'Tempo de salto inválido para a arena.', true)
      send(session, toActivityPlayerUpdate(previous, receivedAt))
      return
    }
    const discontinuityReady = receivedAt - session.lastActivityDiscontinuityAt
      >= movementProfile.discontinuityCooldownMs
    const validation = validateMovement(
      previous,
      message,
      elapsedMs,
      session.movementBudget,
      (position) => isPositionInActivity(message.activityId, position)
        && (!nucleusArenaMovement
          || (isInsideArena(position, nucleusRadius)
            && position.y >= NUCLEUS_GROUND_Y - 0.01
            && position.y <= NUCLEUS_MAX_PLAYER_Y
            && !collidesWithCover(position, nucleusRadius)
            && horizontalPositionsNear(
              resolveArenaAbilityMovement(
                previous.position,
                { ...position, y: previous.position.y },
                nucleusRadius,
                false,
              ),
              position,
              0.02,
            ))),
      movementProfile,
      discontinuityReady && !nucleusArenaMovement,
    )
    if (!validation.ok) {
      sendError(session, 'MOVEMENT_REJECTED', `Activity movement rejected: ${validation.reason}.`, true)
      send(session, toActivityPlayerUpdate(previous, receivedAt))
      return
    }

    session.lastMoveAt = receivedAt
    session.nucleusAirborneSince = nextAirborneSince
    if (validation.discontinuity) session.lastActivityDiscontinuityAt = receivedAt
    session.movementBudget = validation.nextBudget
    const player: StoredPlayer = {
      ...previous,
      position: { ...message.position },
      yaw: message.yaw,
      animation: message.animation,
      emote: expiredEmote(previous, receivedAt),
      sequence: message.sequence,
      nucleusAirborneSince: nextAirborneSince,
      updatedAt: receivedAt,
    }
    const updated = await store.updatePlayer(roomId, player, receivedAt)
    if (!updated) {
      closeSupersededSession(session)
      return
    }
    session.player = player
    await relay(roomId, toActivityPlayerUpdate(player, receivedAt), session)
  }

  async function handleActivityChange(
    session: ClientSession,
    message: ChangeActivityMessage,
    receivedAt: number,
  ): Promise<void> {
    if (receivedAt - session.lastInteractionAt < 250) {
      sendError(session, 'RATE_LIMITED', 'Espere um instante antes de trocar de atividade.', true)
      return
    }
    const previous = session.player
    const roomId = session.roomId
    if (!previous || !roomId) return
    session.lastInteractionAt = receivedAt

    if (previous.activityId === message.activityId) {
      const expectedRunId = createActivityRunId(roomId, message.activityId)
      if (previous.runId !== expectedRunId) {
        sendError(session, 'INVALID_PAYLOAD', 'Stored activity run is inconsistent.', true)
        return
      }
      send(session, toActivityChanged(previous, receivedAt))
      return
    }

    const runId = createActivityRunId(roomId, message.activityId)
    if (message.activityId !== 'nexus') {
      if (previous.activityId !== 'nexus') {
        sendError(session, 'INVALID_PAYLOAD', 'Return to the Nexus before entering another expedition.', true)
        return
      }
      const nearPortal = Boolean(
        message.portalId && validInteractionDistance(previous.position, message.portalId),
      )
      let followingRoomPeer = false
      if (!nearPortal && runId !== null) {
        const snapshot = await store.getSnapshot(roomId, receivedAt)
        followingRoomPeer = snapshot.players.some((candidate) => (
          candidate.id !== previous.id
            && candidate.activityId === message.activityId
            && candidate.runId === runId
        ))
      }
      if (!nearPortal && !followingRoomPeer) {
        sendError(
          session,
          'INVALID_PAYLOAD',
          'Chegue mais perto do portal ou siga um colega que já iniciou a expedição.',
          true,
        )
        return
      }
    }

    const spawn = ACTIVITY_SPAWNS[message.activityId]
    const player: StoredPlayer = {
      ...previous,
      activityId: message.activityId,
      runId,
      position: { ...spawn },
      yaw: Math.PI,
      animation: 'idle',
      emote: expiredEmote(previous, receivedAt),
      sequence: previous.sequence + 1,
      nucleusAirborneSince: null,
      updatedAt: receivedAt,
    }
    session.lastMoveAt = receivedAt
    session.lastActivityDiscontinuityAt = Number.NEGATIVE_INFINITY
    session.movementBudget = createMovementBudget(
      true,
      ACTIVITY_MOVEMENT_PROFILES[message.activityId],
    )
    if (previous.activityId === 'nucleus-257' && previous.runId !== null) {
      await deactivateNucleusParticipant(
        roomId,
        previous.runId,
        previous.id,
        'activity_change',
        receivedAt,
        previous,
      )
    }
    const updated = await store.updatePlayer(roomId, player, receivedAt)
    if (!updated) {
      closeSupersededSession(session)
      return
    }
    session.player = player
    session.nucleusAirborneSince = null
    if (previous.activityId === 'nucleus-257' && previous.runId !== null) {
      session.nucleusCombatRunId = null
      session.nucleusAlive = null
      session.nucleusCombatant = null
      session.nucleusStateRevision = 0
    }
    await relay(roomId, toActivityChanged(player, receivedAt))
    await relay(
      roomId,
      player.activityId === 'nexus'
        ? toPlayerUpdate(player, receivedAt)
        : toActivityPlayerUpdate(player, receivedAt),
    )
  }

  async function handleNucleusJoin(
    session: ClientSession,
    message: NucleusJoinMessage,
    receivedAt: number,
  ): Promise<void> {
    const scope = await nucleusScope(session, message.runId, receivedAt)
    if (!scope) return
    const holder: { outcome?: NucleusMutationResult } = {}
    const record = await store.mutateNucleusCombat(
      scope.roomId,
      message.runId,
      receivedAt,
      (current) => {
        const outcome = joinNucleusCombat(current, scope.player, message.heroId, receivedAt)
        holder.outcome = outcome
        return outcome.record
      },
      scope.player,
    )
    const outcome = holder.outcome
    if (!outcome) throw new Error('Nucleus join completed without a mutation result.')
    if (outcome.rejection) {
      sendError(
        session,
        'COMBAT_REJECTED',
        outcome.rejection === 'arena-full'
          ? 'A arena Núcleo 257 já tem 12 operadores ativos.'
          : nucleusRejectionMessage(outcome.rejection),
        true,
      )
      return
    }

    session.nucleusCombatRunId = message.runId
    session.nucleusStateRevision = record.revision
    const combatant = record.players.find((candidate) => candidate.id === session.playerId)
    session.nucleusAlive = combatant?.alive ?? null
    session.nucleusCombatant = combatant ?? null
    if (combatant && !samePosition(scope.player.position, combatant.position)) {
      await commitSessionActivityPosition(session, combatant.position, receivedAt)
    }
    if (outcome.event) {
      await relayNucleusMutation(scope.roomId, record, outcome.event, receivedAt)
    } else {
      send(session, toNucleusCombatState(record, receivedAt))
    }
  }

  async function handleNucleusLeave(
    session: ClientSession,
    message: NucleusLeaveMessage,
    receivedAt: number,
  ): Promise<void> {
    const scope = await nucleusScope(session, message.runId, receivedAt)
    if (!scope) return
    const holder: { outcome?: NucleusMutationResult } = {}
    const record = await store.mutateNucleusCombat(
      scope.roomId,
      message.runId,
      receivedAt,
      (current) => {
        const outcome = leaveNucleusCombat(current, session.playerId, 'selection', receivedAt)
        holder.outcome = outcome
        return outcome.record
      },
      scope.player,
    )
    const outcome = holder.outcome
    if (outcome?.movementDestination) {
      await commitSessionActivityPosition(session, outcome.movementDestination, receivedAt)
    }
    session.nucleusCombatRunId = null
    session.nucleusAlive = null
    session.nucleusCombatant = null
    session.nucleusStateRevision = 0
    if (outcome?.event) await relayNucleusMutation(scope.roomId, record, outcome.event, receivedAt)
    else send(session, toNucleusCombatState(record, receivedAt))
  }

  async function handleNucleusCast(
    session: ClientSession,
    message: NucleusCastMessage,
    receivedAt: number,
  ): Promise<void> {
    if (receivedAt - session.lastNucleusCastAt < 80) {
      sendError(session, 'RATE_LIMITED', 'Comandos de poder rápidos demais.', true)
      return
    }
    session.lastNucleusCastAt = receivedAt
    const scope = await nucleusScope(session, message.runId, receivedAt)
    if (!scope) return
    if (session.nucleusCombatRunId !== message.runId) {
      sendError(session, 'COMBAT_REJECTED', 'Escolha um operador antes de usar poderes.', true)
      return
    }
    const holder: { outcome?: NucleusMutationResult } = {}
    const record = await store.mutateNucleusCombat(
      scope.roomId,
      message.runId,
      receivedAt,
      (current) => {
        const outcome = castNucleusAbility(
          current,
          scope.players,
          session.playerId,
          message,
          receivedAt,
        )
        holder.outcome = outcome
        return outcome.record
      },
      scope.player,
    )
    const outcome = holder.outcome
    if (!outcome) throw new Error('Nucleus cast completed without a mutation result.')
    if (outcome.rejection === 'duplicate-cast') {
      // Idempotent retry: converge the sender without replaying damage or VFX.
      send(session, toNucleusCombatState(record, receivedAt))
      return
    }
    if (outcome.rejection) {
      sendError(session, 'COMBAT_REJECTED', nucleusRejectionMessage(outcome.rejection), true)
      send(session, toNucleusCombatState(record, receivedAt))
      return
    }
    if (!outcome.event) throw new Error('Accepted Nucleus cast did not produce an event.')
    if (outcome.movementDestination) {
      await commitSessionActivityPosition(session, outcome.movementDestination, receivedAt)
    }
    await relayNucleusMutation(scope.roomId, record, outcome.event, receivedAt)
  }

  async function nucleusScope(
    session: ClientSession,
    runId: ActivityRunId,
    currentTime: number,
  ): Promise<{
    readonly roomId: string
    readonly player: StoredPlayer
    readonly players: readonly StoredPlayer[]
  } | null> {
    const player = session.player
    const roomId = session.roomId
    if (!player || !roomId || player.activityId !== 'nucleus-257' || player.runId !== runId) {
      sendError(session, 'COMBAT_REJECTED', 'Este comando não pertence à sua arena ativa.', true)
      return null
    }
    const snapshot = await store.getSnapshot(roomId, currentTime)
    const authoritative = snapshot.players.find((candidate) => candidate.id === session.playerId)
    if (!authoritative
      || authoritative.resumeToken !== player.resumeToken
      || authoritative.activityId !== 'nucleus-257'
      || authoritative.runId !== runId) {
      sendError(session, 'COMBAT_REJECTED', 'Esta conexão não controla mais o operador.', false)
      closeSupersededSession(session)
      return null
    }
    session.player = authoritative
    return { roomId, player: authoritative, players: snapshot.players }
  }

  async function commitSessionActivityPosition(
    session: ClientSession,
    position: Readonly<{ x: number; y: number; z: number }>,
    receivedAt: number,
  ): Promise<void> {
    const previous = session.player
    const roomId = session.roomId
    if (!previous || !roomId || previous.activityId !== 'nucleus-257') return
    const airborneSince = position.y > NUCLEUS_GROUND_Y + 0.025
      ? previous.nucleusAirborneSince ?? session.nucleusAirborneSince ?? receivedAt
      : null
    const player: StoredPlayer = {
      ...previous,
      position: { ...position },
      animation: 'idle',
      sequence: previous.sequence + 1,
      nucleusAirborneSince: airborneSince,
      updatedAt: receivedAt,
    }
    const updated = await store.updatePlayer(roomId, player, receivedAt)
    if (!updated) {
      closeSupersededSession(session)
      return
    }
    session.player = player
    session.lastMoveAt = receivedAt
    session.lastActivityDiscontinuityAt = receivedAt
    session.nucleusAirborneSince = airborneSince
    session.movementBudget = createMovementBudget(
      true,
      session.nucleusCombatant
        ? nucleusMovementProfile(session.nucleusCombatant, receivedAt)
        : ACTIVITY_MOVEMENT_PROFILES['nucleus-257'],
    )
    await relay(roomId, toActivityPlayerUpdate(player, receivedAt))
  }

  async function handleEmote(
    session: ClientSession,
    emote: Emote,
    receivedAt: number,
  ): Promise<void> {
    if (receivedAt - session.lastEmoteAt < 650) {
      sendError(session, 'RATE_LIMITED', 'Espere um instante antes de usar outro emote.', true)
      return
    }
    if (!session.player || !session.roomId) return
    session.lastEmoteAt = receivedAt
    const player: StoredPlayer = {
      ...session.player,
      emote: { kind: emote, startedAt: receivedAt },
      updatedAt: receivedAt,
    }
    const updated = await store.updatePlayer(session.roomId, player, receivedAt)
    if (!updated) {
      closeSupersededSession(session)
      return
    }
    session.player = player
    await relay(session.roomId, {
      type: 'player_emote',
      playerId: session.playerId,
      emote,
      startedAt: receivedAt,
      durationMs: EMOTE_DURATION_MS,
    })
  }

  async function handleInteraction(
    session: ClientSession,
    message: InteractionMessage,
    receivedAt: number,
  ): Promise<void> {
    if (receivedAt - session.lastInteractionAt < 250) {
      sendError(session, 'RATE_LIMITED', 'Interações rápidas demais.', true)
      return
    }
    if (!session.player || !session.roomId) return
    session.lastInteractionAt = receivedAt

    if (session.player.activityId !== 'nexus') {
      sendError(session, 'INVALID_PAYLOAD', 'Nexus interactions are unavailable inside an expedition.', true)
      return
    }

    if (!isValidInteractionPair(message.target, message.action)) {
      sendError(session, 'INVALID_PAYLOAD', 'Esta ação não é válida para o objeto escolhido.', true)
      return
    }

    if (message.action === 'respawn' && message.target === 'spawn-plaza') {
      const player: StoredPlayer = {
        ...session.player,
        position: { ...SPAWN_POSITION },
        yaw: Math.PI,
        animation: 'idle',
        sequence: session.player.sequence + 1,
        updatedAt: receivedAt,
      }
      session.lastMoveAt = receivedAt
      session.movementBudget = createMovementBudget()
      const updated = await store.updatePlayer(session.roomId, player, receivedAt)
      if (!updated) {
        closeSupersededSession(session)
        return
      }
      session.player = player
      const correction = toPlayerUpdate(player, receivedAt)
      // Corrections are explicit to the origin even if the shared relay fails.
      send(session, correction)
      await relay(session.roomId, correction, session)
      return
    }

    if (!validInteractionDistance(session.player.position, message.target)) {
      sendError(session, 'INVALID_PAYLOAD', 'Chegue mais perto para interagir.', true)
      return
    }

    if (message.action === 'travel') {
      const portalId = portalIdFromInteractionTarget(message.target)
      if (!portalId) {
        sendError(session, 'INVALID_PAYLOAD', 'O portal escolhido não existe.', true)
        return
      }
      const route = PORTAL_ROUTES[portalId]
      const player: StoredPlayer = {
        ...session.player,
        position: {
          x: route.destination[0],
          y: route.destination[1],
          z: route.destination[2],
        },
        animation: 'idle',
        emote: expiredEmote(session.player, receivedAt),
        sequence: session.player.sequence + 1,
        updatedAt: receivedAt,
      }
      session.lastMoveAt = receivedAt
      session.movementBudget = createMovementBudget()
      const updated = await store.updatePlayer(session.roomId, player, receivedAt)
      if (!updated) {
        closeSupersededSession(session)
        return
      }
      session.player = player
      const correction = toPlayerUpdate(player, receivedAt)
      // The requester and every peer converge on the same persisted destination.
      send(session, correction)
      await relay(session.roomId, correction, session)
      return
    }
    const choice = choiceFromInteractionTarget(message.target)
    if (message.action === 'vote' && choice !== null) {
      const events: WorldEvent[] = []
      let accepted = false
      const world = await store.mutateWorld(session.roomId, receivedAt, (current) => {
        const result = castPrimeSequenceVote(current.state.sequence, session.playerId, choice, receivedAt)
        events.push(...result.events)
        accepted = result.accepted
        if (!result.accepted && result.state === current.state.sequence) return current
        return {
          revision: current.revision + 1,
          state: { ...current.state, serverTime: receivedAt, sequence: result.state },
        }
      })
      if (!accepted) {
        sendError(session, 'INVALID_PAYLOAD', 'Seu voto já foi registrado ou a votação fechou.', true)
        return
      }
      await relayWorld(session.roomId, world, events)
      return
    }

    if (message.target === 'prime-core' && message.action === 'activate') {
      await tickWorld(session.roomId)
    }
  }

  async function reconcileJoinExpirations(
    roomId: string,
    fallbackWorld: WorldRecord,
    expiredPlayerIds: readonly string[],
    currentTime: number,
  ): Promise<WorldRecord> {
    const expired = [...new Set(expiredPlayerIds)]
    if (expired.length === 0) return fallbackWorld

    let worldChanged = false
    const world = await store.mutateWorld(roomId, currentTime, (current) => {
      let sequence = current.state.sequence
      for (const playerId of expired) sequence = removePrimeSequenceVoter(sequence, playerId)
      if (sequence === current.state.sequence) return current
      worldChanged = true
      return {
        revision: current.revision + 1,
        state: { ...current.state, serverTime: currentTime, sequence },
      }
    })
    for (const playerId of expired) {
      knownPlayers.get(roomId)?.delete(playerId)
      const nucleusRunId = createActivityRunId(roomId, 'nucleus-257')
      if (nucleusRunId) {
        await deactivateNucleusParticipant(roomId, nucleusRunId, playerId, 'timeout', currentTime)
      }
      await relay(roomId, { type: 'player_left', playerId, reason: 'timeout' })
    }
    if (worldChanged) await relay(roomId, { type: 'world_state', state: world.state })
    return world
  }

  async function tickWorld(roomId: string): Promise<void> {
    if (tickingRooms.has(roomId) || !activeRooms.has(roomId)) return
    tickingRooms.add(roomId)
    try {
      const currentTime = now()
      const snapshot = await store.getSnapshot(roomId, currentTime)
      const activePlayerIds = new Set(snapshot.players.map((player) => player.id))
      const knownInRoom = knownPlayers.get(roomId) ?? new Set<string>()
      const discoveredPlayers = snapshot.players.filter((player) => !knownInRoom.has(player.id))
      const expiredIds = [...new Set([
        ...snapshot.expiredPlayerIds,
        ...[...knownInRoom].filter((playerId) => !activePlayerIds.has(playerId)),
      ])]
      knownPlayers.set(roomId, activePlayerIds)
      for (const player of discoveredPlayers) {
        broadcastLocal(activeRooms, roomId, {
          type: 'player_joined',
          player: toPlayerSnapshot(player),
        })
      }
      for (const playerId of expiredIds) {
        const nucleusRunId = createActivityRunId(roomId, 'nucleus-257')
        if (nucleusRunId) {
          await deactivateNucleusParticipant(roomId, nucleusRunId, playerId, 'timeout', currentTime)
        }
        await relay(roomId, { type: 'player_left', playerId, reason: 'timeout' })
      }
      const events: WorldEvent[] = []
      let changed = false
      const world = await store.mutateWorld(roomId, currentTime, (current) => {
        let sequence = current.state.sequence
        for (const playerId of expiredIds) sequence = removePrimeSequenceVoter(sequence, playerId)
        const voteChanged = sequence !== current.state.sequence
        const coreResult = updateWorldCore(
          voteChanged ? { ...current.state, sequence } : current.state,
          snapshot.players.filter((player) => player.activityId === 'nexus'),
          currentTime,
        )
        if (coreResult.event) events.push(coreResult.event)
        const sequenceResult = advancePrimeSequence(coreResult.state.sequence, currentTime)
        events.push(...sequenceResult.events)
        changed = voteChanged || coreResult.event !== null || sequenceResult.events.length > 0
        if (!changed) return current
        return {
          revision: current.revision + 1,
          state: { ...coreResult.state, serverTime: currentTime, sequence: sequenceResult.state },
        }
      })
      if (changed) await relayWorld(roomId, world, events)
      else recoverDurableWorld(activeRooms, observedWorlds, roomId, world)
      if (snapshot.players.some((player) => player.activityId === 'nucleus-257')) {
        await tickNucleusRoom(roomId, snapshot.players, currentTime)
      }
    } catch (error) {
      notifyRoomFailure(roomId, error)
    } finally {
      tickingRooms.delete(roomId)
    }
  }

  async function relayWorld(roomId: string, world: WorldRecord, events: readonly WorldEvent[]): Promise<void> {
    for (const event of events) await relay(roomId, { type: 'world_event', event })
    await relay(roomId, { type: 'world_state', state: world.state })
    observedWorlds.set(roomId, { revision: world.revision, state: structuredClone(world.state) })
  }

  async function deactivateNucleusParticipant(
    roomId: string,
    runId: ActivityRunId,
    playerId: string,
    reason: Extract<NucleusCombatEvent, { kind: 'left' }>['reason'],
    currentTime: number,
    authority?: StoredPlayer,
  ): Promise<NucleusMutationResult | null> {
    const holder: { outcome?: NucleusMutationResult } = {}
    const record = await store.mutateNucleusCombat(roomId, runId, currentTime, (current) => {
      const outcome = leaveNucleusCombat(current, playerId, reason, currentTime)
      holder.outcome = outcome
      return outcome.record
    }, authority)
    if (holder.outcome?.event) {
      await relayNucleusMutation(roomId, record, holder.outcome.event, currentTime)
    }
    return holder.outcome ?? null
  }

  async function tickNucleusRoom(
    roomId: string,
    roomPlayers: readonly StoredPlayer[],
    currentTime: number,
  ): Promise<void> {
    const runId = createActivityRunId(roomId, 'nucleus-257')
    if (!runId) return
    let previousRevision = 0
    let combatEvents: readonly NucleusCombatEvent[] = []
    const record = await store.mutateNucleusCombat(roomId, runId, currentTime, (current) => {
      previousRevision = current.revision
      const synchronized = synchronizeCombatPoses(current, roomPlayers, currentTime)
      const ticked = tickNucleusCombat(synchronized, currentTime)
      combatEvents = ticked.events
      return ticked.record
    })
    if (record.revision === previousRevision) {
      if (observedNucleusRevisions.get(roomId) !== record.revision) {
        const state = toNucleusCombatState(record, currentTime)
        applyAuthoritativePacket(activeRooms, roomId, state, currentTime)
        broadcastLocal(activeRooms, roomId, state)
        observeNucleusPacket(observedNucleusRevisions, roomId, state)
      }
      return
    }

    for (const event of combatEvents) {
      if (event.kind !== 'respawned') continue
      const player = roomPlayers.find((candidate) => candidate.id === event.playerId)
      if (player?.activityId === 'nucleus-257' && player.runId === runId) {
        await commitStoredActivityPosition(roomId, player, event.position, currentTime)
      }
    }
    for (const event of combatEvents) {
      await relayNucleusEvent(roomId, record, event, currentTime)
    }
    await relay(roomId, toNucleusCombatState(record, currentTime))
  }

  async function commitStoredActivityPosition(
    roomId: string,
    expectedPlayer: StoredPlayer,
    position: Readonly<{ x: number; y: number; z: number }>,
    currentTime: number,
  ): Promise<void> {
    const snapshot = await store.getSnapshot(roomId, currentTime)
    const previous = snapshot.players.find((candidate) => candidate.id === expectedPlayer.id)
    if (!previous
      || previous.activityId !== 'nucleus-257'
      || previous.runId === null
      || previous.runId !== expectedPlayer.runId) return
    const player: StoredPlayer = {
      ...previous,
      position: { ...position },
      animation: 'idle',
      sequence: previous.sequence + 1,
      nucleusAirborneSince: position.y > NUCLEUS_GROUND_Y + 0.025
        ? previous.nucleusAirborneSince ?? currentTime
        : null,
      updatedAt: currentTime,
    }
    if (!await store.updatePlayerIfCurrent(roomId, previous, player, currentTime)) return
    await relay(roomId, toActivityPlayerUpdate(player, currentTime))
  }

  async function relayNucleusMutation(
    roomId: string,
    record: Parameters<typeof toNucleusCombatState>[0],
    event: NucleusCombatEvent,
    currentTime: number,
  ): Promise<void> {
    await relayNucleusEvent(roomId, record, event, currentTime)
    await relay(roomId, toNucleusCombatState(record, currentTime))
  }

  async function relayNucleusEvent(
    roomId: string,
    record: Parameters<typeof toNucleusCombatState>[0],
    event: NucleusCombatEvent,
    currentTime: number,
  ): Promise<void> {
    await relay(roomId, {
      type: 'nucleus_event',
      runId: record.runId,
      revision: record.revision,
      eventId: `nucleus:${record.revision}:${randomUUID()}`,
      serverTime: currentTime,
      event,
    })
  }

  /**
   * Co-op relay: opaque game payloads between members of the same run. The
   * server verifies only membership, size (already parser-capped) and rate —
   * simulation truth belongs to the run's host client.
   */
  async function handlePartyRelay(
    session: ClientSession,
    message: Extract<ClientMessage, { type: 'party_state' | 'party_action' }>,
    receivedAt: number,
  ): Promise<void> {
    const roomId = session.roomId
    if (!roomId || !session.joined || session.player?.runId !== message.runId) {
      registerViolation(session, 'INVALID_PAYLOAD', 'Você não está nesta expedição.')
      return
    }
    if (message.type === 'party_state') {
      // 12 Hz of world state is plenty; anything faster is a bug or abuse.
      if (receivedAt - session.lastPartyStateAt < 70) return
      session.lastPartyStateAt = receivedAt
    } else {
      if (receivedAt - session.lastPartyActionAt < 90) return
      session.lastPartyActionAt = receivedAt
    }
    await relay(roomId, {
      type: message.type,
      runId: message.runId,
      fromId: session.playerId,
      seq: message.seq,
      data: message.data,
      serverTime: receivedAt,
    }, session)
  }

  async function relay(roomId: string, packet: ServerMessage, excluded?: ClientSession): Promise<void> {
    observePlayerPacket(knownPlayers, roomId, packet)
    observeWorldPacket(observedWorlds, roomId, packet)
    observeNucleusPacket(observedNucleusRevisions, roomId, packet)
    applyAuthoritativePacket(activeRooms, roomId, packet, now())
    broadcastLocal(activeRooms, roomId, packet, excluded)
    const envelope: RelayEnvelope = { instanceId, roomId, sentAt: now(), packet }
    await store.publish(envelope)
  }

  async function disconnect(
    session: ClientSession,
    reason: PlayerLeftReason,
    retainResumeLease = true,
  ): Promise<void> {
    if (session.closing) return
    session.closing = true
    sessions.delete(session.socket)
    // Dropping out takes you out of the lobby too, and hands it to whoever is left.
    detachFromLobby(session, now())
    const roomId = session.roomId
    if (!roomId) return
    removeFromLocalRoom(activeRooms, roomId, session)
    try {
      const resumeToken = session.player?.resumeToken
      if (!resumeToken) return
      const currentTime = now()
      const combatRunId = session.nucleusCombatRunId
        ?? (session.player?.activityId === 'nucleus-257' ? session.player.runId : null)
      if (combatRunId !== null && session.player) {
        const combatLeave = await deactivateNucleusParticipant(
          roomId,
          combatRunId,
          session.playerId,
          reason === 'timeout' ? 'timeout' : 'disconnect',
          currentTime,
          session.player,
        )
        if (combatLeave?.movementDestination) {
          await commitStoredActivityPosition(
            roomId,
            session.player,
            combatLeave.movementDestination,
            currentTime,
          )
        }
      }
      const removed = await store.leave(
        roomId,
        session.playerId,
        resumeToken,
        currentTime,
        retainResumeLease,
      )
      if (!removed) return
      knownPlayers.get(roomId)?.delete(session.playerId)
      if (combatRunId !== null) {
        session.nucleusCombatRunId = null
        session.nucleusAlive = null
        session.nucleusCombatant = null
        session.nucleusStateRevision = 0
      }
      let worldChanged = false
      const world = await store.mutateWorld(roomId, currentTime, (current) => {
        const sequence = removePrimeSequenceVoter(current.state.sequence, session.playerId)
        if (sequence === current.state.sequence) return current
        worldChanged = true
        return {
          revision: current.revision + 1,
          state: { ...current.state, serverTime: currentTime, sequence },
        }
      })
      await relay(roomId, { type: 'player_left', playerId: session.playerId, reason })
      if (worldChanged) await relay(roomId, { type: 'world_state', state: world.state })
      if (!activeRooms.has(roomId)) {
        knownPlayers.delete(roomId)
        observedWorlds.delete(roomId)
        observedNucleusRevisions.delete(roomId)
      }
    } catch {
      // Presence expiry is the final cleanup path when Redis/network disappears.
    }
  }

  function failSession(session: ClientSession, error: unknown): void {
    if (session.closing) return
    if (error instanceof ConnectionSupersededError) {
      closeSupersededSession(session)
      return
    }
    const unavailable = error instanceof StoreUnavailableError || store.mode === 'unavailable'
    sendError(
      session,
      unavailable ? 'SERVER_UNAVAILABLE' : 'SERVER_UNAVAILABLE',
      unavailable ? errorMessage(error) : 'O servidor multiplayer encontrou uma falha temporária.',
      true,
    )
    if (session.socket.readyState === WebSocket.OPEN) session.socket.close(1013, 'try again later')
  }

  function notifyRoomFailure(roomId: string, error: unknown): void {
    const message = store.mode === 'unavailable'
      ? errorMessage(error)
      : 'Sincronização temporariamente indisponível.'
    broadcastLocal(activeRooms, roomId, {
      type: 'error',
      code: 'SERVER_UNAVAILABLE',
      message,
      recoverable: true,
    })
  }

  async function close(): Promise<void> {
    if (closed) return
    closed = true
    clearInterval(heartbeatTimer)
    clearInterval(worldTimer)
    unsubscribeRelay()
    observedWorlds.clear()
    observedNucleusRevisions.clear()
    for (const session of sessions.values()) session.socket.close(1001, 'server shutdown')
    await Promise.allSettled([...sessions.values()].map((session) => disconnect(session, 'disconnect')))
    await new Promise<void>((resolve) => {
      wss.close(() => resolve())
      if (wss.clients.size === 0) queueMicrotask(resolve)
    })
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve())
      })
    }
    await store.close()
  }

  return { app, server, wss, store, instanceId, close }
}

function toPlayerSnapshot(player: StoredPlayer): PlayerSnapshot {
  return {
    id: player.id,
    nickname: player.nickname,
    activityId: player.activityId,
    runId: player.runId,
    position: { ...player.position },
    yaw: player.yaw,
    animation: player.animation,
    appearance: { ...player.appearance },
    emote: player.emote ? { ...player.emote } : null,
    sequence: player.sequence,
    updatedAt: player.updatedAt,
  }
}

function toActivityChanged(
  player: StoredPlayer,
  serverTime: number,
): Extract<ServerMessage, { type: 'activity_changed' }> {
  return {
    type: 'activity_changed',
    playerId: player.id,
    activityId: player.activityId,
    runId: player.runId,
    serverTime,
    sequence: player.sequence,
  }
}

function toActivityPlayerUpdate(
  player: StoredPlayer,
  serverTime: number,
): Extract<ServerMessage, { type: 'activity_player_updated' }> {
  if (player.activityId === 'nexus' || player.runId === null) {
    throw new TypeError('Nexus players do not have activity-scoped transforms.')
  }
  return {
    type: 'activity_player_updated',
    playerId: player.id,
    activityId: player.activityId as ExpeditionActivityId,
    runId: player.runId as ActivityRunId,
    position: { ...player.position },
    yaw: player.yaw,
    animation: player.animation,
    sequence: player.sequence,
    serverTime,
  }
}

function toPlayerUpdate(player: StoredPlayer, serverTime: number): Extract<ServerMessage, { type: 'player_updated' }> {
  return {
    type: 'player_updated',
    playerId: player.id,
    position: { ...player.position },
    yaw: player.yaw,
    animation: player.animation,
    sequence: player.sequence,
    serverTime,
  }
}

function expiredEmote(player: StoredPlayer, now: number): PlayerSnapshot['emote'] {
  if (!player.emote || now - player.emote.startedAt > EMOTE_DURATION_MS) return null
  return player.emote
}

/** Player-facing wording for a lobby rule that said no. */
function lobbyErrorMessage(error: LobbyFailure | null): string {
  switch (error) {
    case 'lobby-full': return 'Este lobby já está cheio.'
    case 'already-launched': return 'A expedição deste lobby já começou.'
    case 'not-host': return 'Só quem abriu o lobby pode iniciar.'
    case 'not-member': return 'Você não está neste lobby.'
    case 'not-everyone-ready': return 'Nem todo mundo está pronto.'
    case 'alone': return 'Chame alguém antes de iniciar.'
    default: return 'Lobby não encontrado. Confira o código.'
  }
}

function send(session: ClientSession, packet: ServerMessage): void {
  if (session.socket.readyState !== WebSocket.OPEN) return
  session.socket.send(JSON.stringify(packet))
}

function sendError(
  session: ClientSession,
  code: ProtocolErrorCode,
  message: string,
  recoverable: boolean,
): void {
  send(session, { type: 'error', code, message, recoverable })
}

function registerViolation(
  session: ClientSession,
  code: ProtocolErrorCode,
  message: string,
): void {
  session.protocolViolations += 1
  sendError(session, code, message, session.protocolViolations < MAX_PROTOCOL_VIOLATIONS)
  if (session.protocolViolations >= MAX_PROTOCOL_VIOLATIONS) {
    session.socket.close(1008, 'protocol violations')
  }
}

function consumeGeneralRate(session: ClientSession, now: number): boolean {
  const cutoff = now - 10_000
  while (session.messageTimes.length > 0 && session.messageTimes[0] < cutoff) session.messageTimes.shift()
  let recent = 0
  for (let index = session.messageTimes.length - 1; index >= 0; index -= 1) {
    if (session.messageTimes[index] < now - 1_000) break
    recent += 1
  }
  if (session.messageTimes.length >= 240 || recent >= 35) return false
  session.messageTimes.push(now)
  return true
}

function observePlayerPacket(
  knownPlayers: Map<string, Set<string>>,
  roomId: string,
  packet: ServerMessage,
): void {
  const room = knownPlayers.get(roomId) ?? new Set<string>()
  if (packet.type === 'player_joined') room.add(packet.player.id)
  else if (packet.type === 'player_left') room.delete(packet.playerId)
  knownPlayers.set(roomId, room)
}

function applyAuthoritativePacket(
  rooms: Map<string, Set<ClientSession>>,
  roomId: string,
  packet: ServerMessage,
  receivedAt: number,
): void {
  const sessions = rooms.get(roomId)
  if (!sessions) return
  for (const session of sessions) {
    if (packet.type === 'activity_player_updated'
      && packet.playerId === session.playerId
      && session.player?.activityId === packet.activityId
      && session.player.runId === packet.runId
      && packet.sequence > session.player.sequence) {
      const airborneSince = packet.activityId === 'nucleus-257'
        && packet.position.y > NUCLEUS_GROUND_Y + 0.025
        ? session.player.nucleusAirborneSince ?? session.nucleusAirborneSince ?? receivedAt
        : null
      session.player = {
        ...session.player,
        position: { ...packet.position },
        yaw: packet.yaw,
        animation: packet.animation,
        sequence: packet.sequence,
        nucleusAirborneSince: airborneSince,
        updatedAt: packet.serverTime,
      }
      session.lastMoveAt = receivedAt
      session.movementBudget = createMovementBudget(
        true,
        ACTIVITY_MOVEMENT_PROFILES[packet.activityId],
      )
      session.nucleusAirborneSince = airborneSince
    } else if (packet.type === 'nucleus_state'
      && session.player?.activityId === 'nucleus-257'
      && session.player.runId === packet.runId
      && packet.revision >= session.nucleusStateRevision) {
      const own = packet.players.find((player) => player.id === session.playerId)
      if (own) {
        session.nucleusCombatRunId = packet.runId
        session.nucleusAlive = own.alive
        session.nucleusCombatant = own
        session.nucleusStateRevision = packet.revision
      } else if (session.nucleusCombatRunId === packet.runId) {
        session.nucleusCombatRunId = null
        session.nucleusAlive = null
        session.nucleusCombatant = null
        session.nucleusStateRevision = packet.revision
      }
    } else if (packet.type === 'activity_changed'
      && packet.playerId === session.playerId
      && packet.activityId !== 'nucleus-257') {
      session.nucleusCombatRunId = null
      session.nucleusAlive = null
      session.nucleusCombatant = null
      session.nucleusAirborneSince = null
      session.nucleusStateRevision = 0
    }
  }
}

function samePosition(
  left: Readonly<{ x: number; y: number; z: number }>,
  right: Readonly<{ x: number; y: number; z: number }>,
): boolean {
  return left.x === right.x && left.y === right.y && left.z === right.z
}

function horizontalPositionsNear(
  left: Readonly<{ x: number; y: number; z: number }>,
  right: Readonly<{ x: number; y: number; z: number }>,
  tolerance: number,
): boolean {
  return Math.hypot(left.x - right.x, left.z - right.z) <= tolerance
}

function nextNucleusAirborneSince(
  current: number | null,
  previousY: number,
  nextY: number,
  now: number,
): number | null | undefined {
  const grounded = nextY <= NUCLEUS_GROUND_Y + 0.025
  if (grounded) return null
  const startedAt = previousY <= NUCLEUS_GROUND_Y + 0.025
    ? now
    : current ?? now
  return now - startedAt <= NUCLEUS_MAX_AIRBORNE_MS ? startedAt : undefined
}

function restoredNucleusAirborneSince(player: StoredPlayer, now: number): number | null {
  if (player.activityId !== 'nucleus-257'
    || player.position.y <= NUCLEUS_GROUND_Y + 0.025) return null
  const persisted = player.nucleusAirborneSince
  // Legacy snapshots did not persist the jump clock. Treat an airborne legacy
  // pose as already expired so reconnecting can descend, but cannot hover.
  if (persisted === undefined || persisted === null || persisted > now) {
    return Number.NEGATIVE_INFINITY
  }
  return persisted
}

function nucleusMovementProfile(
  combatant: NucleusCombatPlayer,
  now: number,
) {
  const base = ACTIVITY_MOVEMENT_PROFILES['nucleus-257']
  const slow = combatant.statuses.find((status) => (
    status.id === 'slowed' && status.expiresAt > now
  ))?.magnitude ?? 0
  const moveSpeed = getHeroKit(combatant.heroId).stats.moveSpeed
    * (1 - Math.max(0, Math.min(0.9, slow)))
  return {
    ...base,
    maxWalkSpeed: moveSpeed,
    maxRunSpeed: moveSpeed * 1.34,
  }
}

function nucleusRejectionMessage(reason: NucleusCombatRejection): string {
  switch (reason) {
    case 'dead': return 'Aguarde a reconstrução do operador.'
    case 'cooldown': return 'Esse poder ainda está recarregando.'
    case 'silenced': return 'Seu operador está silenciado.'
    case 'ultimate-not-ready': return 'A habilidade suprema ainda não está carregada.'
    case 'arena-full': return 'A arena Núcleo 257 já está cheia.'
    case 'already-joined': return 'Saia da seleção atual antes de trocar de operador.'
    case 'duplicate-cast': return 'Esse disparo já foi processado.'
    case 'not-participating': return 'Escolha um operador antes de usar poderes.'
    case 'unknown-combatant': return 'O operador não pertence mais a esta batalha.'
    case 'waiting-for-opponent': return 'A batalha começa quando houver um oponente no outro time.'
    case 'rejoin-locked': return 'O retorno à arena estará disponível em alguns segundos.'
  }
}

function observeWorldPacket(
  observedWorlds: Map<string, { revision: number | null; state: WorldState }>,
  roomId: string,
  packet: ServerMessage,
): void {
  if (packet.type !== 'world_state') return
  const previous = observedWorlds.get(roomId)
  observedWorlds.set(roomId, {
    revision: previous?.revision ?? null,
    state: structuredClone(packet.state),
  })
}

function observeNucleusPacket(
  observed: Map<string, number>,
  roomId: string,
  packet: ServerMessage,
): void {
  if (packet.type !== 'nucleus_state') return
  observed.set(roomId, Math.max(observed.get(roomId) ?? 0, packet.revision))
}

/**
 * Pub/Sub is intentionally low-latency/best-effort. The durable room record is
 * polled by active runtimes and heals missed state plus reconstructable events.
 */
function recoverDurableWorld(
  rooms: Map<string, Set<ClientSession>>,
  observedWorlds: Map<string, { revision: number | null; state: WorldState }>,
  roomId: string,
  world: WorldRecord,
): void {
  const observed = observedWorlds.get(roomId)
  if (!observed) {
    observedWorlds.set(roomId, { revision: world.revision, state: structuredClone(world.state) })
    return
  }
  if (worldStatesEqual(observed.state, world.state)) {
    observedWorlds.set(roomId, { revision: world.revision, state: structuredClone(world.state) })
    return
  }

  for (const event of reconstructWorldEvents(observed.state, world.state)) {
    broadcastLocal(rooms, roomId, { type: 'world_event', event })
  }
  broadcastLocal(rooms, roomId, { type: 'world_state', state: world.state })
  observedWorlds.set(roomId, { revision: world.revision, state: structuredClone(world.state) })
}

function reconstructWorldEvents(previous: WorldState, current: WorldState): readonly WorldEvent[] {
  const events: WorldEvent[] = []
  const at = current.serverTime
  if (previous.core.energyLevel !== current.core.energyLevel
    || previous.core.nearbyPlayers !== current.core.nearbyPlayers) {
    events.push({ kind: 'core_energy_changed', core: current.core, at })
  }

  const before = previous.sequence
  const after = current.sequence
  const changedRoundOrPhase = before.round !== after.round || before.phase !== after.phase
  if (changedRoundOrPhase) {
    if (after.phase === 'voting' && after.phaseEndsAt !== null) {
      events.push({
        kind: 'sequence_started',
        round: after.round,
        phaseEndsAt: after.phaseEndsAt,
        at: after.startedAt ?? at,
      })
    } else if (after.phase === 'revealed'
      && after.revealedAnswer === 13
      && after.success !== null) {
      events.push({
        kind: 'sequence_revealed',
        round: after.round,
        answer: 13,
        winningChoice: after.winningChoice,
        success: after.success,
        effect: after.success ? 'prime-wave' : null,
        at,
      })
    } else if (after.phase === 'cooldown' && after.phaseEndsAt !== null) {
      events.push({
        kind: 'sequence_cooldown',
        round: after.round,
        phaseEndsAt: after.phaseEndsAt,
        at,
      })
    } else if (after.phase === 'idle' && before.phase !== 'idle') {
      events.push({ kind: 'sequence_reset', round: after.round, at })
    }
  }

  if (after.phase === 'voting') {
    for (const [playerId, choice] of Object.entries(after.votesByPlayer)) {
      if (before.votesByPlayer[playerId] === choice) continue
      events.push({
        kind: 'sequence_vote',
        round: after.round,
        playerId,
        choice,
        voteCounts: after.voteCounts,
        at,
      })
    }
  }
  return events
}

function worldStatesEqual(left: WorldState, right: WorldState): boolean {
  if (left.serverTime !== right.serverTime
    || left.core.nearbyPlayers !== right.core.nearbyPlayers
    || left.core.energyLevel !== right.core.energyLevel
    || left.core.intensity !== right.core.intensity
    || left.core.ringSpeed !== right.core.ringSpeed) return false
  const before = left.sequence
  const after = right.sequence
  if (before.round !== after.round
    || before.phase !== after.phase
    || before.startedAt !== after.startedAt
    || before.phaseEndsAt !== after.phaseEndsAt
    || before.totalVotes !== after.totalVotes
    || before.winningChoice !== after.winningChoice
    || before.revealedAnswer !== after.revealedAnswer
    || before.success !== after.success) return false
  for (const choice of [12, 13, 15, 17] as const) {
    if (before.voteCounts[choice] !== after.voteCounts[choice]) return false
  }
  const beforeVotes = Object.entries(before.votesByPlayer)
  const afterVotes = Object.entries(after.votesByPlayer)
  return beforeVotes.length === afterVotes.length
    && beforeVotes.every(([playerId, choice]) => after.votesByPlayer[playerId] === choice)
}

function addToLocalRoom(
  rooms: Map<string, Set<ClientSession>>,
  roomId: string,
  session: ClientSession,
): void {
  const room = rooms.get(roomId) ?? new Set<ClientSession>()
  room.add(session)
  rooms.set(roomId, room)
}

function removeFromLocalRoom(
  rooms: Map<string, Set<ClientSession>>,
  roomId: string,
  session: ClientSession,
): void {
  const room = rooms.get(roomId)
  if (!room) return
  room.delete(session)
  if (room.size === 0) rooms.delete(roomId)
}

function broadcastLocal(
  rooms: Map<string, Set<ClientSession>>,
  roomId: string,
  packet: ServerMessage,
  excluded?: ClientSession,
): void {
  for (const session of rooms.get(roomId) ?? []) {
    if (session !== excluded) send(session, packet)
  }
}

function closeSupersededLocalSessions(
  sessions: ReadonlyMap<WebSocket, ClientSession>,
  current: ClientSession,
): void {
  for (const session of sessions.values()) {
    if (session !== current && session.joined && session.playerId === current.playerId) {
      closeSupersededSession(session)
    }
  }
}

function closeSupersededSession(session: ClientSession): void {
  if (session.closing || session.socket.readyState !== WebSocket.OPEN) return
  sendError(session, 'NOT_JOINED', 'Esta sessão foi retomada por uma conexão mais recente.', false)
  session.socket.close(4001, 'session resumed')
}

function normalizeRawData(raw: RawData): string | Uint8Array {
  if (typeof raw === 'string') return raw
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw)
  if (Array.isArray(raw)) {
    const size = raw.reduce((total, item) => total + item.byteLength, 0)
    const output = new Uint8Array(size)
    let offset = 0
    for (const item of raw) {
      output.set(item, offset)
      offset += item.byteLength
    }
    return output
  }
  return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
}

function validInteractionDistance(position: PlayerSnapshot['position'], target: InteractionMessage['target']): boolean {
  const targets: Partial<Record<InteractionMessage['target'], readonly [number, number, number, number]>> = {
    'prime-core': [0, 2.5, 0, 6],
    'pedestal-12': [-3.45, 0, 17.5, 3],
    'pedestal-13': [-1.15, 0, 19.2, 3],
    'pedestal-15': [1.15, 0, 19.2, 3],
    'pedestal-17': [3.45, 0, 17.5, 3],
    'secret-997': [-23.6, 1.2, -9.3, 3],
    'secret-mersenne': [20.6, 1.5, -28.1, 3],
    'secret-constellation': [0, 1, -39, 3],
  }
  const portalId = portalIdFromInteractionTarget(target)
  if (portalId) {
    const source = PORTAL_ROUTES[portalId].source
    return Math.hypot(
      position.x - source[0],
      position.y - source[1],
      position.z - source[2],
    ) <= PORTAL_INTERACTION_DISTANCE
  }
  const data = targets[target]
  if (!data) return false
  return Math.hypot(position.x - data[0], position.y - data[1], position.z - data[2]) <= data[3]
}

function portalIdFromInteractionTarget(target: InteractionMessage['target']): PortalId | null {
  return (PORTAL_IDS as readonly string[]).includes(target) ? target as PortalId : null
}

function originsFromEnvironment(raw: string | undefined): readonly string[] {
  return raw?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? []
}

function isOriginAllowed(origin: string | undefined, host: string | undefined, allowed: readonly string[]): boolean {
  if (!origin) return true
  if (allowed.includes('*') || allowed.includes(origin)) return true
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

async function sendHealth(store: PrimeverseStore, instanceId: string, response: Response): Promise<void> {
  const health = await store.health()
  response.setHeader('Cache-Control', 'no-store')
  response.status(health.ok ? 200 : 503).json({
    status: health.ok ? 'ok' : 'error',
    ok: health.ok,
    service: 'primeverse-online',
    protocol: PROTOCOL_VERSION,
    instanceId,
    storage: health.mode,
    detail: health.detail,
    now: Date.now(),
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha desconhecida.'
}

export function createHealthHandler(store: PrimeverseStore = createStoreFromEnvironment()) {
  const instanceId = randomUUID()
  return (_request: Request, response: Response): void => {
    void sendHealth(store, instanceId, response)
  }
}
