import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import {
  PROTOCOL_VERSION,
  castPrimeSequenceVote,
  createAvatarAppearance,
  parseServerMessage,
  type ServerMessage,
  type ActivityRunId,
  type WorldEvent,
  type WorldState,
} from '../../src/features/primeverse/games/primeverse-online/shared/index.js'
import { PORTAL_ROUTES } from '../../src/features/primeverse/games/primeverse-online/shared/realms.js'
import { MemoryPrimeverseStore } from './memoryStore.js'
import type {
  NucleusCombatRecord,
  RelayEnvelope,
  RoomSnapshot,
  StoredPlayer,
  WorldRecord,
} from './model.js'
import { createPrimeverseServer, type PrimeverseServerRuntime } from './server.js'
import type { CombatMutationAuthority, PrimeverseStore, StoreHealth } from './store.js'

const runtimes: PrimeverseServerRuntime[] = []
const sockets: WebSocket[] = []

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate()
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()))
})

describe('Primeverse WebSocket server', () => {
  it('synchronizes movement and emotes between two real clients', async () => {
    const runtime = createPrimeverseServer({
      store: new MemoryPrimeverseStore(),
      enableTimers: false,
      instanceId: 'test-instance',
    })
    runtimes.push(runtime)
    await listen(runtime)
    const address = runtime.server.address()
    if (!address || typeof address === 'string') throw new Error('Test server has no TCP address.')
    const endpoint = `ws://127.0.0.1:${address.port}/api/primeverse`

    const first = await connect(endpoint)
    sockets.push(first)
    const firstWelcomePromise = nextMessage(first, 'welcome')
    first.send(JSON.stringify({
      type: 'join',
      version: PROTOCOL_VERSION,
      nickname: 'Ada',
      appearance: createAvatarAppearance(1),
    }))
    const firstWelcome = await firstWelcomePromise

    const second = await connect(endpoint)
    sockets.push(second)
    const joinedOnFirst = nextMessage(first, 'player_joined')
    const secondWelcomePromise = nextMessage(second, 'welcome')
    second.send(JSON.stringify({
      type: 'join',
      version: PROTOCOL_VERSION,
      nickname: 'Gauss',
      appearance: createAvatarAppearance(2),
    }))
    const secondWelcome = await secondWelcomePromise
    const joined = await joinedOnFirst

    expect(firstWelcome.roomId).toBe(secondWelcome.roomId)
    expect(firstWelcome.playerId).not.toBe(secondWelcome.playerId)
    expect(secondWelcome.players).toHaveLength(2)
    expect(joined.player.nickname).toBe('Gauss')

    await wait(55)
    const updateOnSecond = nextMessage(second, 'player_updated')
    first.send(JSON.stringify({
      type: 'move',
      sequence: 1,
      clientTime: Date.now(),
      position: { x: 0.2, y: 0.04, z: 13 },
      yaw: 2.9,
      animation: 'walk',
    }))
    const update = await updateOnSecond
    expect(update.playerId).toBe(firstWelcome.playerId)
    expect(update.position.x).toBeCloseTo(0.2)

    const emoteOnFirst = nextMessage(first, 'player_emote')
    second.send(JSON.stringify({ type: 'emote', emote: 'wave' }))
    const emote = await emoteOnFirst
    expect(emote.playerId).toBe(secondWelcome.playerId)
    expect(emote.emote).toBe('wave')
  })

  it('rejects unvalidated messages instead of forwarding them', async () => {
    const runtime = createPrimeverseServer({
      store: new MemoryPrimeverseStore(),
      enableTimers: false,
    })
    runtimes.push(runtime)
    await listen(runtime)
    const address = runtime.server.address()
    if (!address || typeof address === 'string') throw new Error('Test server has no TCP address.')
    const socket = await connect(`ws://127.0.0.1:${address.port}/api/primeverse`)
    sockets.push(socket)
    const errorPromise = nextMessage(socket, 'error')
    socket.send('{bad json')
    const error = await errorPromise
    expect(error.code).toBe('MALFORMED_JSON')
    expect(error.recoverable).toBe(true)
  })

  it('returns authoritative corrections to the origin after a rejected move and respawn', async () => {
    const runtime = createPrimeverseServer({
      store: new MemoryPrimeverseStore(),
      enableTimers: false,
    })
    runtimes.push(runtime)
    await listen(runtime)
    const address = runtime.server.address()
    if (!address || typeof address === 'string') throw new Error('Test server has no TCP address.')
    const socket = await connect(`ws://127.0.0.1:${address.port}/api/primeverse`)
    sockets.push(socket)
    const welcomePromise = nextMessage(socket, 'welcome')
    socket.send(JSON.stringify({
      type: 'join',
      version: PROTOCOL_VERSION,
      nickname: 'Ada',
      appearance: createAvatarAppearance(1),
    }))
    const welcome = await welcomePromise

    await wait(55)
    const rejectionPromise = nextMessage(socket, 'error')
    const correctionPromise = nextMessage(socket, 'player_updated')
    socket.send(JSON.stringify({
      type: 'move',
      sequence: 1,
      clientTime: Date.now(),
      position: { x: 11, y: 0.04, z: 13 },
      yaw: 0,
      animation: 'run',
    }))
    expect((await rejectionPromise).code).toBe('MOVEMENT_REJECTED')
    expect(await correctionPromise).toMatchObject({
      playerId: welcome.playerId,
      position: { x: 0, y: 0.04, z: 13 },
      sequence: 0,
    })

    const respawnCorrectionPromise = nextMessage(socket, 'player_updated')
    socket.send(JSON.stringify({ type: 'interaction', target: 'spawn-plaza', action: 'respawn' }))
    expect(await respawnCorrectionPromise).toMatchObject({
      playerId: welcome.playerId,
      position: { x: 0, y: 0.04, z: 13 },
      animation: 'idle',
      sequence: 1,
    })
  })

  it('announces stale players and removes their pending vote from synchronized world state', async () => {
    let currentTime = 1_000
    const store = new MemoryPrimeverseStore({ playerTimeoutMs: 100 })
    const runtime = createPrimeverseServer({
      store,
      now: () => currentTime,
      enableTimers: true,
    })
    runtimes.push(runtime)
    await listen(runtime)
    const address = runtime.server.address()
    if (!address || typeof address === 'string') throw new Error('Test server has no TCP address.')
    const socket = await connect(`ws://127.0.0.1:${address.port}/api/primeverse`)
    sockets.push(socket)
    const welcomePromise = nextMessage(socket, 'welcome')
    socket.send(JSON.stringify({
      type: 'join',
      version: PROTOCOL_VERSION,
      nickname: 'Ghost',
      appearance: createAvatarAppearance(4),
    }))
    const welcome = await welcomePromise
    await wait(40)
    await store.mutateWorld(welcome.roomId, currentTime, (world) => {
      const vote = castPrimeSequenceVote(world.state.sequence, welcome.playerId, 13, currentTime)
      return {
        revision: world.revision + 1,
        state: { ...world.state, sequence: vote.state },
      }
    })

    const leftPromise = nextMessage(socket, 'player_left')
    const worldPromise = nextMessage(socket, 'world_state')
    currentTime = 1_101
    expect(await leftPromise).toMatchObject({ playerId: welcome.playerId, reason: 'timeout' })
    expect((await worldPromise).state.sequence).toMatchObject({
      totalVotes: 0,
      voteCounts: { 12: 0, 13: 0, 15: 0, 17: 0 },
    })
  })

  it('rotates a reconnect token and reclaims the same player and room without a ghost slot', async () => {
    const store = new MemoryPrimeverseStore()
    const firstRuntime = createPrimeverseServer({
      store, enableTimers: false, instanceId: 'resume-runtime-a',
    })
    const secondRuntime = createPrimeverseServer({
      store, enableTimers: false, instanceId: 'resume-runtime-b',
    })
    runtimes.push(firstRuntime, secondRuntime)
    await Promise.all([listen(firstRuntime), listen(secondRuntime)])
    const firstAddress = firstRuntime.server.address()
    const secondAddress = secondRuntime.server.address()
    if (!firstAddress || typeof firstAddress === 'string'
      || !secondAddress || typeof secondAddress === 'string') {
      throw new Error('Test servers have no TCP address.')
    }

    const first = await connect(`ws://127.0.0.1:${firstAddress.port}/api/primeverse`)
    sockets.push(first)
    const firstWelcomePromise = nextMessage(first, 'welcome')
    first.send(JSON.stringify({
      type: 'join', version: PROTOCOL_VERSION, nickname: 'Ada', appearance: createAvatarAppearance(1),
    }))
    const firstWelcome = await firstWelcomePromise
    await wait(55)
    first.send(JSON.stringify({
      type: 'move', sequence: 1, clientTime: Date.now(),
      position: { x: 0.2, y: 0.04, z: 13 }, yaw: 3, animation: 'walk',
    }))
    await wait(20)

    first.terminate()
    await wait(35)
    expect((await store.getSnapshot(firstWelcome.roomId, Date.now())).players).toEqual([])
    const second = await connect(`ws://127.0.0.1:${secondAddress.port}/api/primeverse`)
    sockets.push(second)
    const secondWelcomePromise = nextMessage(second, 'welcome')
    second.send(JSON.stringify({
      type: 'join',
      version: PROTOCOL_VERSION,
      nickname: 'Ada Prime',
      appearance: createAvatarAppearance(3),
      resumeToken: firstWelcome.resumeToken,
    }))
    const secondWelcome = await secondWelcomePromise
    expect(secondWelcome).toMatchObject({
      playerId: firstWelcome.playerId,
      roomId: firstWelcome.roomId,
    })
    expect(secondWelcome.resumeToken).not.toBe(firstWelcome.resumeToken)
    expect(secondWelcome.players).toHaveLength(1)
    expect(secondWelcome.players[0]).toMatchObject({
      id: firstWelcome.playerId,
      nickname: 'Ada Prime',
      position: { x: 0.2, y: 0.04, z: 13 },
      sequence: 1,
    })
    expect('resumeToken' in secondWelcome.players[0]).toBe(false)

    await wait(25)
    const durable = await store.getSnapshot(secondWelcome.roomId, Date.now())
    expect(durable.players).toHaveLength(1)
    expect(durable.players[0].resumeToken).toBe(secondWelcome.resumeToken)
  })

  it('relays movement between clients connected to two server runtimes', async () => {
    const sharedStore = new MemoryPrimeverseStore()
    const firstRuntime = createPrimeverseServer({
      store: sharedStore, enableTimers: false, instanceId: 'runtime-a',
    })
    const secondRuntime = createPrimeverseServer({
      store: sharedStore, enableTimers: false, instanceId: 'runtime-b',
    })
    runtimes.push(firstRuntime, secondRuntime)
    await Promise.all([listen(firstRuntime), listen(secondRuntime)])
    const firstAddress = firstRuntime.server.address()
    const secondAddress = secondRuntime.server.address()
    if (!firstAddress || typeof firstAddress === 'string'
      || !secondAddress || typeof secondAddress === 'string') {
      throw new Error('Test servers have no TCP address.')
    }
    const first = await connect(`ws://127.0.0.1:${firstAddress.port}/api/primeverse`)
    const second = await connect(`ws://127.0.0.1:${secondAddress.port}/api/primeverse`)
    sockets.push(first, second)
    const firstWelcomePromise = nextMessage(first, 'welcome')
    first.send(JSON.stringify({
      type: 'join', version: PROTOCOL_VERSION, nickname: 'Ada', appearance: createAvatarAppearance(1),
    }))
    const firstWelcome = await firstWelcomePromise
    const joinedPromise = nextMessage(first, 'player_joined')
    const secondWelcomePromise = nextMessage(second, 'welcome')
    second.send(JSON.stringify({
      type: 'join', version: PROTOCOL_VERSION, nickname: 'Gauss', appearance: createAvatarAppearance(2),
    }))
    expect((await secondWelcomePromise).roomId).toBe(firstWelcome.roomId)
    expect((await joinedPromise).player.nickname).toBe('Gauss')

    await wait(55)
    const updatePromise = nextMessage(second, 'player_updated')
    first.send(JSON.stringify({
      type: 'move', sequence: 1, clientTime: Date.now(),
      position: { x: 0.2, y: 0.04, z: 13 }, yaw: 3, animation: 'walk',
    }))
    expect(await updatePromise).toMatchObject({
      playerId: firstWelcome.playerId,
      position: { x: 0.2, y: 0.04, z: 13 },
    })
  })

  it('validates portal distance, persists authoritative travel and relays it across runtimes', async () => {
    let currentTime = 1_000
    const sharedStore = new MemoryPrimeverseStore()
    const firstRuntime = createPrimeverseServer({
      store: sharedStore,
      enableTimers: false,
      instanceId: 'portal-runtime-a',
      now: () => currentTime,
    })
    const secondRuntime = createPrimeverseServer({
      store: sharedStore,
      enableTimers: false,
      instanceId: 'portal-runtime-b',
      now: () => currentTime,
    })
    runtimes.push(firstRuntime, secondRuntime)
    await Promise.all([listen(firstRuntime), listen(secondRuntime)])
    const firstAddress = firstRuntime.server.address()
    const secondAddress = secondRuntime.server.address()
    if (!firstAddress || typeof firstAddress === 'string'
      || !secondAddress || typeof secondAddress === 'string') {
      throw new Error('Test servers have no TCP address.')
    }

    const traveller = await connect(`ws://127.0.0.1:${firstAddress.port}/api/primeverse`)
    sockets.push(traveller)
    const travellerWelcomePromise = nextMessage(traveller, 'welcome')
    traveller.send(JSON.stringify({
      type: 'join', version: PROTOCOL_VERSION, nickname: 'Ada', appearance: createAvatarAppearance(1),
    }))
    const travellerWelcome = await travellerWelcomePromise

    const observer = await connect(`ws://127.0.0.1:${secondAddress.port}/api/primeverse`)
    sockets.push(observer)
    const observerWelcomePromise = nextMessage(observer, 'welcome')
    observer.send(JSON.stringify({
      type: 'join', version: PROTOCOL_VERSION, nickname: 'Gauss', appearance: createAvatarAppearance(2),
    }))
    expect((await observerWelcomePromise).roomId).toBe(travellerWelcome.roomId)

    const distantErrorPromise = nextMessage(traveller, 'error')
    traveller.send(JSON.stringify({ type: 'interaction', target: 'portal-catacombs', action: 'travel' }))
    expect(await distantErrorPromise).toMatchObject({
      code: 'INVALID_PAYLOAD',
      message: 'Chegue mais perto para interagir.',
    })

    const source = PORTAL_ROUTES['portal-catacombs'].source
    const sourceDistance = Math.hypot(source[0], source[2] - 13)
    const waypointCount = Math.ceil(sourceDistance / 8)
    const waypoints = Array.from({ length: waypointCount }, (_, index) => {
      const progress = (index + 1) / waypointCount
      return {
        x: source[0] * progress,
        y: source[1],
        z: 13 + (source[2] - 13) * progress,
      }
    })
    for (const [index, position] of waypoints.entries()) {
      currentTime += 1_000
      const relayedMovePromise = nextMessage(observer, 'player_updated')
      traveller.send(JSON.stringify({
        type: 'move',
        sequence: index + 1,
        clientTime: currentTime,
        position,
        yaw: 0.5,
        animation: 'run',
      }))
      expect((await relayedMovePromise).position).toEqual(position)
    }

    currentTime += 1_000
    const correctionPromise = nextMessage(traveller, 'player_updated')
    const relayedTravelPromise = nextMessage(observer, 'player_updated')
    traveller.send(JSON.stringify({ type: 'interaction', target: 'portal-catacombs', action: 'travel' }))
    const destination = PORTAL_ROUTES['portal-catacombs'].destination
    const expectedDestination = { x: destination[0], y: destination[1], z: destination[2] }
    const travelSequence = waypoints.length + 1
    expect(await correctionPromise).toMatchObject({
      playerId: travellerWelcome.playerId,
      position: expectedDestination,
      animation: 'idle',
      sequence: travelSequence,
    })
    expect(await relayedTravelPromise).toMatchObject({
      playerId: travellerWelcome.playerId,
      position: expectedDestination,
      animation: 'idle',
      sequence: travelSequence,
    })
    expect((await sharedStore.getSnapshot(travellerWelcome.roomId, currentTime)).players)
      .toContainEqual(expect.objectContaining({
        id: travellerWelcome.playerId,
        position: expectedDestination,
        sequence: travelSequence,
      }))

    traveller.terminate()
    await wait(35)
    currentTime += 1
    const resumed = await connect(`ws://127.0.0.1:${secondAddress.port}/api/primeverse`)
    sockets.push(resumed)
    const resumedWelcomePromise = nextMessage(resumed, 'welcome')
    resumed.send(JSON.stringify({
      type: 'join',
      version: PROTOCOL_VERSION,
      nickname: 'Ada Retornada',
      appearance: createAvatarAppearance(3),
      resumeToken: travellerWelcome.resumeToken,
    }))
    expect(await resumedWelcomePromise).toMatchObject({
      playerId: travellerWelcome.playerId,
      roomId: travellerWelcome.roomId,
      players: expect.arrayContaining([
        expect.objectContaining({
          id: travellerWelcome.playerId,
          position: expectedDestination,
          sequence: travelSequence,
        }),
      ]),
    })
  })

  it('recovers durable world state and reconstructable events after a missed relay', async () => {
    const sharedStore = new MemoryPrimeverseStore()
    const firstRuntime = createPrimeverseServer({
      store: sharedStore, enableTimers: true, instanceId: 'publisher-runtime',
    })
    const secondRuntime = createPrimeverseServer({
      store: new SilentSubscriptionStore(sharedStore),
      enableTimers: true,
      instanceId: 'recovering-runtime',
    })
    runtimes.push(firstRuntime, secondRuntime)
    await Promise.all([listen(firstRuntime), listen(secondRuntime)])
    const firstAddress = firstRuntime.server.address()
    const secondAddress = secondRuntime.server.address()
    if (!firstAddress || typeof firstAddress === 'string'
      || !secondAddress || typeof secondAddress === 'string') {
      throw new Error('Test servers have no TCP address.')
    }
    const first = await connect(`ws://127.0.0.1:${firstAddress.port}/api/primeverse`)
    const second = await connect(`ws://127.0.0.1:${secondAddress.port}/api/primeverse`)
    sockets.push(first, second)
    const secondWelcomePromise = nextMessage(second, 'welcome')
    second.send(JSON.stringify({
      type: 'join', version: PROTOCOL_VERSION, nickname: 'Gauss', appearance: createAvatarAppearance(2),
    }))
    await secondWelcomePromise
    await wait(80)

    const recoveredJoinPromise = nextMessage(second, 'player_joined')
    const firstWelcomePromise = nextMessage(first, 'welcome')
    first.send(JSON.stringify({
      type: 'join', version: PROTOCOL_VERSION, nickname: 'Ada', appearance: createAvatarAppearance(1),
    }))
    const firstWelcome = await firstWelcomePromise
    expect((await recoveredJoinPromise).player).toMatchObject({
      id: firstWelcome.playerId,
      nickname: 'Ada',
    })

    const startedPromise = nextWorldEvent(second, 'sequence_started')
    const votingStatePromise = nextWorldState(second, 'voting')
    const eventAt = Date.now()
    await sharedStore.mutateWorld(firstWelcome.roomId, eventAt, (world) => {
      const vote = castPrimeSequenceVote(world.state.sequence, firstWelcome.playerId, 13, eventAt)
      return {
        revision: world.revision + 1,
        state: { ...world.state, serverTime: eventAt, sequence: vote.state },
      }
    })

    expect(await startedPromise).toMatchObject({ round: 1 })
    expect((await votingStatePromise).sequence).toMatchObject({
      phase: 'voting',
      totalVotes: 1,
      voteCounts: { 13: 1 },
    })
  })
  it('gathers a party in a lobby and launches everyone into the same run', async () => {
    const runtime = createPrimeverseServer({
      store: new MemoryPrimeverseStore(),
      enableTimers: false,
      instanceId: 'lobby-instance',
    })
    runtimes.push(runtime)
    await listen(runtime)
    const address = runtime.server.address()
    if (!address || typeof address === 'string') throw new Error('Test server has no TCP address.')
    const endpoint = `ws://127.0.0.1:${address.port}/api/primeverse`

    const host = await connect(endpoint)
    sockets.push(host)
    const hostWelcome = nextMessage(host, 'welcome')
    host.send(JSON.stringify({
      type: 'join',
      version: PROTOCOL_VERSION,
      nickname: 'Ada',
      appearance: createAvatarAppearance(1),
    }))
    await hostWelcome

    const guest = await connect(endpoint)
    sockets.push(guest)
    const guestWelcome = nextMessage(guest, 'welcome')
    guest.send(JSON.stringify({
      type: 'join',
      version: PROTOCOL_VERSION,
      nickname: 'Gauss',
      appearance: createAvatarAppearance(2),
    }))
    await guestWelcome

    // The host opens a lobby and reads out the code.
    const opened = nextMessage(host, 'lobby_state')
    host.send(JSON.stringify({ type: 'lobby_create', activityId: 'sieve-catacombs' }))
    const lobbyState = await opened
    expect(lobbyState.lobby.code).toMatch(/^[A-Z2-9]{4}$/)
    expect(lobbyState.lobby.members).toHaveLength(1)
    expect(lobbyState.lobby.canLaunch).toBe(false)

    // The friend joins with it; both sides see the same party.
    const hostSeesGuest = nextMessage(host, 'lobby_state')
    guest.send(JSON.stringify({ type: 'lobby_join', code: lobbyState.lobby.code }))
    const withGuest = await hostSeesGuest
    expect(withGuest.lobby.members).toHaveLength(2)
    expect(withGuest.lobby.canLaunch).toBe(false)

    // Launching is refused until the guest is ready.
    const refusal = nextMessage(host, 'error')
    host.send(JSON.stringify({ type: 'lobby_launch' }))
    expect((await refusal).message).toContain('pronto')

    const readyBroadcast = nextMessage(host, 'lobby_state')
    guest.send(JSON.stringify({ type: 'lobby_ready', ready: true }))
    expect((await readyBroadcast).lobby.canLaunch).toBe(true)

    // Both members receive the same run id and seed.
    const hostLaunch = nextMessage(host, 'lobby_launched')
    const guestLaunch = nextMessage(guest, 'lobby_launched')
    host.send(JSON.stringify({ type: 'lobby_launch' }))
    const [launchedForHost, launchedForGuest] = await Promise.all([hostLaunch, guestLaunch])
    expect(launchedForHost.runId).toBe(launchedForGuest.runId)
    expect(launchedForHost.seed).toBe(launchedForGuest.seed)
    expect(launchedForHost.runId).toContain('sieve-catacombs')
  })
})

async function listen(runtime: PrimeverseServerRuntime): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    runtime.server.once('error', reject)
    runtime.server.listen(0, '127.0.0.1', () => {
      runtime.server.off('error', reject)
      resolve()
    })
  })
}

async function connect(endpoint: string): Promise<WebSocket> {
  const socket = new WebSocket(endpoint)
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve)
    socket.once('error', reject)
  })
  return socket
}

async function nextMessage<Type extends ServerMessage['type']>(
  socket: WebSocket,
  type: Type,
): Promise<Extract<ServerMessage, { type: Type }>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for ${type}.`))
    }, 2_000)
    const onMessage = (raw: WebSocket.RawData) => {
      const parsed = JSON.parse(raw.toString()) as unknown
      if (!isServerMessageType(parsed, type)) return
      cleanup()
      resolve(parsed)
    }
    const cleanup = () => {
      clearTimeout(timeout)
      socket.off('message', onMessage)
    }
    socket.on('message', onMessage)
  })
}

function isServerMessageType<Type extends ServerMessage['type']>(
  value: unknown,
  type: Type,
): value is Extract<ServerMessage, { type: Type }> {
  return typeof value === 'object'
    && value !== null
    && 'type' in value
    && value.type === type
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function nextWorldEvent<Kind extends WorldEvent['kind']>(
  socket: WebSocket,
  kind: Kind,
): Promise<Extract<WorldEvent, { kind: Kind }>> {
  const packet = await nextMatchingMessage(
    socket,
    (candidate): candidate is Extract<ServerMessage, { type: 'world_event' }> => (
      candidate.type === 'world_event' && candidate.event.kind === kind
    ),
  )
  return packet.event as Extract<WorldEvent, { kind: Kind }>
}

async function nextWorldState(
  socket: WebSocket,
  phase: WorldState['sequence']['phase'],
): Promise<WorldState> {
  const packet = await nextMatchingMessage(
    socket,
    (candidate): candidate is Extract<ServerMessage, { type: 'world_state' }> => (
      candidate.type === 'world_state' && candidate.state.sequence.phase === phase
    ),
  )
  return packet.state
}

function nextMatchingMessage<Packet extends ServerMessage>(
  socket: WebSocket,
  predicate: (packet: ServerMessage) => packet is Packet,
): Promise<Packet> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for matching server packet.'))
    }, 2_000)
    const onMessage = (raw: WebSocket.RawData) => {
      const parsed = parseServerMessage(raw.toString())
      if (!parsed.ok || !predicate(parsed.value)) return
      cleanup()
      resolve(parsed.value)
    }
    const cleanup = () => {
      clearTimeout(timeout)
      socket.off('message', onMessage)
    }
    socket.on('message', onMessage)
  })
}

/** Shares durable state and publish writes while simulating a dropped subscriber. */
class SilentSubscriptionStore implements PrimeverseStore {
  readonly mode: PrimeverseStore['mode']

  constructor(private readonly delegate: PrimeverseStore) {
    this.mode = delegate.mode
  }

  start(): Promise<void> { return this.delegate.start() }
  health(): Promise<StoreHealth> { return this.delegate.health() }
  join(player: StoredPlayer, now: number): Promise<RoomSnapshot> {
    return this.delegate.join(player, now)
  }
  resume(player: StoredPlayer, previousResumeToken: string, now: number): Promise<RoomSnapshot | null> {
    return this.delegate.resume(player, previousResumeToken, now)
  }
  updatePlayer(roomId: string, player: StoredPlayer, now: number): Promise<boolean> {
    return this.delegate.updatePlayer(roomId, player, now)
  }
  updatePlayerIfCurrent(
    roomId: string,
    expected: Pick<StoredPlayer, 'id' | 'resumeToken' | 'sequence' | 'activityId' | 'runId'>,
    player: StoredPlayer,
    now: number,
  ): Promise<boolean> {
    return this.delegate.updatePlayerIfCurrent(roomId, expected, player, now)
  }
  touch(roomId: string, playerId: string, resumeToken: string, now: number): Promise<boolean> {
    return this.delegate.touch(roomId, playerId, resumeToken, now)
  }
  leave(
    roomId: string,
    playerId: string,
    resumeToken: string,
    now: number,
    retainResumeLease: boolean,
  ): Promise<boolean> {
    return this.delegate.leave(roomId, playerId, resumeToken, now, retainResumeLease)
  }
  getSnapshot(roomId: string, now: number): Promise<RoomSnapshot> {
    return this.delegate.getSnapshot(roomId, now)
  }
  mutateWorld(
    roomId: string,
    now: number,
    mutate: (current: WorldRecord) => WorldRecord,
  ): Promise<WorldRecord> {
    return this.delegate.mutateWorld(roomId, now, mutate)
  }
  getNucleusCombat(
    roomId: string,
    runId: ActivityRunId,
    now: number,
  ): Promise<NucleusCombatRecord> {
    return this.delegate.getNucleusCombat(roomId, runId, now)
  }
  mutateNucleusCombat(
    roomId: string,
    runId: ActivityRunId,
    now: number,
    mutate: (current: NucleusCombatRecord) => NucleusCombatRecord,
    authority?: CombatMutationAuthority,
  ): Promise<NucleusCombatRecord> {
    return this.delegate.mutateNucleusCombat(roomId, runId, now, mutate, authority)
  }
  publish(envelope: RelayEnvelope): Promise<void> { return this.delegate.publish(envelope) }
  subscribe(_listener: (envelope: RelayEnvelope) => void): () => void { return () => undefined }
  async close(): Promise<void> {}
}
