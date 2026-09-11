import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  countConnectedPlayers,
  normalizeNetworkYaw,
  PrimeverseOnlineClient,
} from './PrimeverseOnlineClient'
import { PROTOCOL_VERSION } from '../shared/protocol'

type SocketListener = (event: { data?: string }) => void

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static readonly instances: FakeWebSocket[] = []

  readyState = FakeWebSocket.CONNECTING
  readonly sent: string[] = []
  closeCode: number | null = null
  closeReason: string | null = null
  private readonly listeners = new Map<string, Set<SocketListener>>()

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this)
  }

  addEventListener(type: string, listener: SocketListener): void {
    const listeners = this.listeners.get(type) ?? new Set<SocketListener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  send(message: string): void {
    this.sent.push(message)
  }

  close(code?: number, reason?: string): void {
    if (this.readyState === FakeWebSocket.CLOSED) return
    this.closeCode = code ?? null
    this.closeReason = reason ?? null
    this.readyState = FakeWebSocket.CLOSED
    this.dispatch('close')
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN
    this.dispatch('open')
  }

  receive(message: unknown): void {
    this.dispatch('message', { data: JSON.stringify(message) })
  }

  private dispatch(type: string, event: { data?: string } = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

describe('PrimeverseOnlineClient reconnection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeWebSocket.instances.length = 0
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not count the local player before the server confirms its id', () => {
    expect(countConnectedPlayers({ playerId: null, players: [] })).toBe(0)
    expect(countConnectedPlayers({ playerId: 'player-1', players: [] })).toBe(1)
  })

  it('wraps accumulated camera turns instead of pinning remote yaw at PI', () => {
    expect(normalizeNetworkYaw(Math.PI * 4 + 0.25)).toBeCloseTo(0.25)
    expect(normalizeNetworkYaw(-Math.PI * 4 - 0.4)).toBeCloseTo(-0.4)
    expect(normalizeNetworkYaw(Number.NaN)).toBe(0)
  })

  it('suppresses automatic reconnect after a fatal server error but permits manual retry', () => {
    const client = new PrimeverseOnlineClient({
      nickname: 'Euclides',
      appearance: { bodyColor: '#172b3a', accentColor: '#5ceee5', visorColor: '#f0c35a' },
      url: 'ws://primeverse.test/api/primeverse',
    })

    client.connect()
    const firstSocket = FakeWebSocket.instances[0]
    firstSocket.open()
    firstSocket.receive({
      type: 'error',
      code: 'PROTOCOL_MISMATCH',
      message: 'Sessão substituída.',
      recoverable: false,
    })

    expect(client.getSnapshot().status).toBe('error')
    expect(client.getSnapshot().errorCode).toBe('PROTOCOL_MISMATCH')
    vi.advanceTimersByTime(30_000)
    expect(FakeWebSocket.instances).toHaveLength(1)

    client.retry()
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(client.getSnapshot().status).toBe('connecting')
    client.destroy()
  })

  it('stops after the four bounded automatic retries', () => {
    const client = new PrimeverseOnlineClient({
      nickname: 'Euclides',
      appearance: { bodyColor: '#172b3a', accentColor: '#5ceee5', visorColor: '#f0c35a' },
      url: 'ws://primeverse.test/api/primeverse',
    })

    client.connect()
    const delays = [1_000, 2_000, 4_000, 8_000]
    for (const [index, delay] of delays.entries()) {
      FakeWebSocket.instances[index].close()
      expect(client.getSnapshot()).toMatchObject({
        status: 'reconnecting',
        reconnectAttempt: index + 1,
      })
      vi.advanceTimersByTime(delay)
      expect(FakeWebSocket.instances).toHaveLength(index + 2)
    }

    FakeWebSocket.instances[FakeWebSocket.instances.length - 1].close()
    expect(client.getSnapshot()).toMatchObject({ status: 'offline', reconnectAttempt: 4 })
    vi.advanceTimersByTime(60_000)
    expect(FakeWebSocket.instances).toHaveLength(5)
    client.destroy()
  })

  it('cancels a queued automatic retry when the user retries manually', () => {
    const client = new PrimeverseOnlineClient({
      nickname: 'Euclides',
      appearance: { bodyColor: '#172b3a', accentColor: '#5ceee5', visorColor: '#f0c35a' },
      url: 'ws://primeverse.test/api/primeverse',
    })

    client.connect()
    FakeWebSocket.instances[0].close()
    client.retry()

    expect(client.getSnapshot()).toMatchObject({ status: 'connecting', reconnectAttempt: 0 })
    expect(FakeWebSocket.instances).toHaveLength(2)
    vi.advanceTimersByTime(1_000)
    expect(FakeWebSocket.instances).toHaveLength(2)
    client.destroy()
  })

  it('distinguishes a resumable app suspension from an explicit leave', () => {
    const createClient = () => new PrimeverseOnlineClient({
      nickname: 'Euclides',
      appearance: { bodyColor: '#172b3a', accentColor: '#5ceee5', visorColor: '#f0c35a' },
      url: 'ws://primeverse.test/api/primeverse',
    })

    const suspended = createClient()
    suspended.connect()
    FakeWebSocket.instances[0].open()
    suspended.destroy({ preserveResumeLease: true })
    expect(FakeWebSocket.instances[0]).toMatchObject({
      closeCode: 4000,
      closeReason: 'session-suspended',
    })

    const explicitlyLeft = createClient()
    explicitlyLeft.connect()
    FakeWebSocket.instances[1].open()
    explicitlyLeft.destroy()
    expect(FakeWebSocket.instances[1]).toMatchObject({
      closeCode: 1000,
      closeReason: 'client-left',
    })
  })

  it('restores a resume token, persists the replacement and tracks activity acknowledgements', () => {
    const onResumeTokenChange = vi.fn()
    const client = new PrimeverseOnlineClient({
      nickname: 'Euclides',
      appearance: { bodyColor: '#172b3a', accentColor: '#5ceee5', visorColor: '#f0c35a' },
      url: 'ws://primeverse.test/api/primeverse',
      resumeToken: 'resume_token_1234567890',
      onResumeTokenChange,
    })

    client.connect()
    const socket = FakeWebSocket.instances[0]
    socket.open()
    expect(JSON.parse(socket.sent[0])).toMatchObject({
      type: 'join',
      version: PROTOCOL_VERSION,
      resumeToken: 'resume_token_1234567890',
    })

    socket.receive({
      type: 'welcome',
      version: PROTOCOL_VERSION,
      playerId: 'player-1',
      roomId: 'primeverse-001',
      resumeToken: 'replacement_token_123456',
      players: [{
        id: 'player-1',
        nickname: 'Euclides',
        activityId: 'nexus',
        runId: null,
        position: { x: 0, y: 0.04, z: 13 },
        yaw: 0,
        animation: 'idle',
        appearance: { bodyColor: '#172b3a', accentColor: '#5ceee5', visorColor: '#f0c35a' },
        emote: null,
        sequence: 0,
        updatedAt: 1_000,
      }],
      world: {
        serverTime: 1_000,
        core: { nearbyPlayers: 1, energyLevel: 'awakened', intensity: 0.36, ringSpeed: 0.82 },
        sequence: {
          round: 0,
          phase: 'idle',
          startedAt: null,
          phaseEndsAt: null,
          votesByPlayer: {},
          voteCounts: { 12: 0, 13: 0, 15: 0, 17: 0 },
          totalVotes: 0,
          winningChoice: null,
          revealedAnswer: null,
          success: null,
        },
      },
      serverTime: 1_000,
    })

    expect(onResumeTokenChange).toHaveBeenCalledWith('replacement_token_123456')
    client.changeActivity('ulam-rift', 'portal-ulam')
    expect(JSON.parse(socket.sent[socket.sent.length - 1] ?? '{}')).toEqual({
      type: 'change_activity',
      activityId: 'ulam-rift',
      portalId: 'portal-ulam',
    })

    socket.receive({
      type: 'activity_changed',
      playerId: 'player-1',
      activityId: 'ulam-rift',
      runId: 'run:primeverse-001:ulam-rift',
      serverTime: 1_100,
      sequence: 1,
    })
    expect(client.getSnapshot()).toMatchObject({
      activityId: 'ulam-rift',
      runId: 'run:primeverse-001:ulam-rift',
    })
    client.destroy()
  })

  it('joins, tracks and leaves an authoritative Nucleus battle without trusting a client origin', () => {
    const client = new PrimeverseOnlineClient({
      nickname: 'Ada',
      appearance: { bodyColor: '#172b3a', accentColor: '#5ceee5', visorColor: '#f0c35a' },
      url: 'ws://primeverse.test/api/primeverse',
    })
    client.connect()
    const socket = FakeWebSocket.instances[0]
    socket.open()
    socket.receive({
      type: 'welcome',
      version: PROTOCOL_VERSION,
      playerId: 'player-1',
      roomId: 'primeverse-001',
      resumeToken: 'replacement_token_123456',
      players: [{
        id: 'player-1',
        nickname: 'Ada',
        activityId: 'nucleus-257',
        runId: 'run:primeverse-001:nucleus-257',
        position: { x: 0, y: 0.05, z: 20 },
        yaw: 0,
        animation: 'idle',
        appearance: { bodyColor: '#172b3a', accentColor: '#5ceee5', visorColor: '#f0c35a' },
        emote: null,
        sequence: 0,
        updatedAt: 1_000,
      }],
      world: {
        serverTime: 1_000,
        core: { nearbyPlayers: 0, energyLevel: 'dormant', intensity: 0.2, ringSpeed: 0.5 },
        sequence: {
          round: 0,
          phase: 'idle',
          startedAt: null,
          phaseEndsAt: null,
          votesByPlayer: {},
          voteCounts: { 12: 0, 13: 0, 15: 0, 17: 0 },
          totalVotes: 0,
          winningChoice: null,
          revealedAnswer: null,
          success: null,
        },
      },
      serverTime: 1_000,
    })

    const runId = 'run:primeverse-001:nucleus-257' as const
    expect(client.joinNucleus(runId, 'luma-crivo')).toBe(true)
    expect(JSON.parse(socket.sent[socket.sent.length - 1] ?? '{}')).toEqual({
      type: 'nucleus_join',
      runId,
      heroId: 'luma-crivo',
    })

    socket.receive({
      type: 'error',
      code: 'COMBAT_REJECTED',
      message: 'A arena Núcleo 257 já tem 12 operadores ativos.',
      recoverable: true,
    })
    expect(client.getSnapshot()).toMatchObject({
      status: 'online',
      errorCode: 'COMBAT_REJECTED',
      error: 'A arena Núcleo 257 já tem 12 operadores ativos.',
    })
    expect(client.joinNucleus(runId, 'luma-crivo')).toBe(true)
    expect(client.getSnapshot()).toMatchObject({ error: null, errorCode: null })

    socket.receive({
      type: 'nucleus_state',
      runId,
      revision: 1,
      serverTime: 1_100,
      phase: 'waiting',
      objective: null,
      players: [{
        id: 'player-1', nickname: 'Ada', heroId: 'luma-crivo', team: 'cipher', connected: true,
        position: { x: 0, y: 0.05, z: 20 }, yaw: 0,
        health: 240, maxHealth: 240, shield: 80, maxShield: 80, alive: true,
        cooldownReadyAt: { primary: 0, signature: 0, mobility: 0, ultimate: 0 },
        ultimateCharge: 0, eliminations: 0, deaths: 0, respawnAt: null, statuses: [],
      }],
    })
    expect(client.getSnapshot().nucleusState).toMatchObject({ revision: 1, phase: 'waiting' })

    const castId = client.castNucleus(runId, 'primary', {
      direction: { x: 0, y: 0, z: -1 },
      point: { x: 0, y: 0.05, z: -8 },
    })
    expect(castId).not.toBeNull()
    expect(JSON.parse(socket.sent[socket.sent.length - 1] ?? '{}')).toMatchObject({
      type: 'nucleus_cast',
      runId,
      castId,
      slot: 'primary',
      aim: { direction: { x: 0, y: 0, z: -1 }, point: { x: 0, y: 0.05, z: -8 } },
    })
    expect(JSON.parse(socket.sent[socket.sent.length - 1] ?? '{}')).not.toHaveProperty('origin')

    socket.receive({
      type: 'nucleus_event',
      runId,
      revision: 2,
      eventId: 'event-2',
      serverTime: 1_200,
      event: { kind: 'joined', playerId: 'player-1', heroId: 'luma-crivo', team: 'cipher' },
    })
    expect(client.getSnapshot().nucleusEvents).toHaveLength(1)
    expect(client.getSnapshot().nucleusEvents[0]).toMatchObject({ eventId: 'event-2' })

    socket.receive({
      type: 'nucleus_event', runId, revision: 1, eventId: 'late-event-1', serverTime: 1_150,
      event: { kind: 'respawned', playerId: 'player-1', position: { x: 0, y: 0.05, z: 20 } },
    })
    expect(client.getSnapshot().nucleusEvents.some((event) => event.eventId === 'late-event-1')).toBe(true)

    // A bounded queue keeps simultaneous casts/events even when React batches
    // several WebSocket messages before a render, while ignoring retransmits.
    socket.receive({
      type: 'nucleus_event', runId, revision: 2, eventId: 'event-2', serverTime: 1_200,
      event: { kind: 'joined', playerId: 'player-1', heroId: 'luma-crivo', team: 'cipher' },
    })
    for (let revision = 3; revision <= 40; revision += 1) {
      socket.receive({
        type: 'nucleus_event', runId, revision, eventId: `event-${revision}`, serverTime: 1_200 + revision,
        event: { kind: 'respawned', playerId: 'player-1', position: { x: 0, y: 0.05, z: 20 } },
      })
    }
    expect(client.getSnapshot().nucleusEvents).toHaveLength(32)
    expect(client.getSnapshot().nucleusEvents[0]?.eventId).toBe('event-9')
    expect(client.getSnapshot().nucleusEvents[31]?.eventId).toBe('event-40')
    socket.receive({
      type: 'nucleus_event', runId, revision: 8, eventId: 'late-event-8', serverTime: 1_500,
      event: { kind: 'respawned', playerId: 'player-1', position: { x: 0, y: 0.05, z: 20 } },
    })
    expect(client.getSnapshot().nucleusEvents[0]?.eventId).toBe('event-9')
    expect(client.getSnapshot().nucleusEvents.some((event) => event.eventId === 'late-event-8')).toBe(false)
    const queueSize = client.getSnapshot().nucleusEvents.length
    socket.receive({
      type: 'nucleus_event', runId, revision: 8, eventId: 'late-event-8', serverTime: 1_500,
      event: { kind: 'respawned', playerId: 'player-1', position: { x: 0, y: 0.05, z: 20 } },
    })
    expect(client.getSnapshot().nucleusEvents).toHaveLength(queueSize)

    expect(client.leaveNucleus(runId)).toBe(true)
    expect(JSON.parse(socket.sent[socket.sent.length - 1] ?? '{}')).toEqual({ type: 'nucleus_leave', runId })
    expect(client.getSnapshot()).toMatchObject({ nucleusState: null, nucleusEvents: [] })
    client.destroy()
  })
})
