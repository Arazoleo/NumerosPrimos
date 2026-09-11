import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'

import {
  PROTOCOL_VERSION,
  createAvatarAppearance,
  parseServerMessage,
  type NucleusCombatEventMessage,
  type NucleusCombatState,
  type ServerMessage,
} from '../../src/features/primeverse/games/primeverse-online/shared/index.js'
import { PORTAL_ROUTES } from '../../src/features/primeverse/games/primeverse-online/shared/realms.js'
import { MemoryPrimeverseStore } from './memoryStore.js'
import { createPrimeverseServer, type PrimeverseServerRuntime } from './server.js'
import type { PrimeverseStore } from './store.js'

const runtimes: PrimeverseServerRuntime[] = []
const sockets: WebSocket[] = []

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate()
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()))
})

describe('Nucleus 257 online arena', () => {
  it('authoritatively joins room peers, resolves damage, persists state and respawns', async () => {
    let currentTime = 10_000
    const store = new MemoryPrimeverseStore()
    const firstRuntime = createPrimeverseServer({
      store,
      instanceId: 'nucleus-runtime-a',
      now: () => currentTime,
    })
    const secondRuntime = createPrimeverseServer({
      store,
      instanceId: 'nucleus-runtime-b',
      now: () => currentTime,
    })
    runtimes.push(firstRuntime, secondRuntime)
    await Promise.all([listen(firstRuntime), listen(secondRuntime)])
    const first = await connectTo(firstRuntime)
    let second = await connectTo(secondRuntime)
    sockets.push(first, second)

    const firstWelcome = await join(first, 'Ada', 1)
    const secondWelcome = await join(second, 'Gauss', 2)
    expect(secondWelcome.roomId).toBe(firstWelcome.roomId)

    const portal = PORTAL_ROUTES['portal-nucleus'].source
    const sequence = await walkTo(first, second, portal, 0, () => { currentTime += 1_000 })
    currentTime += 300
    const firstActivity = waitForMessage(first, (packet) => (
      packet.type === 'activity_changed'
        && packet.playerId === firstWelcome.playerId
        && packet.activityId === 'nucleus-257'
    ))
    first.send(JSON.stringify({
      type: 'change_activity', activityId: 'nucleus-257', portalId: 'portal-nucleus',
    }))
    const firstChanged = await firstActivity
    if (firstChanged.type !== 'activity_changed' || firstChanged.runId === null) {
      throw new Error('Expected first Nucleus activity change.')
    }
    const nucleusRunId = firstChanged.runId
    expect(firstChanged.sequence).toBe(sequence + 1)

    currentTime += 300
    const secondActivity = waitForMessage(second, (packet) => (
      packet.type === 'activity_changed'
        && packet.playerId === secondWelcome.playerId
        && packet.activityId === 'nucleus-257'
    ))
    second.send(JSON.stringify({
      type: 'change_activity', activityId: 'nucleus-257', portalId: 'portal-nucleus',
    }))
    const secondChanged = await secondActivity
    expect(secondChanged).toMatchObject({ type: 'activity_changed', runId: firstChanged.runId })

    currentTime += 100
    const firstStatePromise = waitForNucleusState(first, 1)
    first.send(JSON.stringify({
      type: 'nucleus_join', runId: firstChanged.runId, heroId: 'luma-crivo',
    }))
    const firstState = await firstStatePromise
    expect(firstState).toMatchObject({ phase: 'waiting' })
    expect(firstState.players).toEqual([
      expect.objectContaining({ id: firstWelcome.playerId, team: 'cipher', connected: true }),
    ])

    currentTime += 100
    const activeStatePromise = waitForNucleusState(first, 2)
    second.send(JSON.stringify({
      type: 'nucleus_join', runId: firstChanged.runId, heroId: 'raul-rsa',
    }))
    const activeState = await activeStatePromise
    expect(activeState.phase).toBe('active')
    expect(activeState.players).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: firstWelcome.playerId, team: 'cipher', heroId: 'luma-crivo' }),
      expect.objectContaining({ id: secondWelcome.playerId, team: 'fracture', heroId: 'raul-rsa' }),
    ]))

    // The second operator gets a brief server-side spawn shield before combat
    // damage can land, even though the phase became active in the join commit.
    currentTime += 2_100
    const castEventPromise = waitForMessage<NucleusCombatEventMessage>(second, (packet) => (
      packet.type === 'nucleus_event'
        && packet.event.kind === 'cast'
        && packet.event.castId === 'ada:first'
    ))
    const damagedStatePromise = waitForNucleusState(second, 2, activeState.revision + 1)
    first.send(JSON.stringify({
      type: 'nucleus_cast',
      runId: firstChanged.runId,
      castId: 'ada:first',
      slot: 'primary',
      aim: { direction: { x: 0, y: 0, z: -1 } },
      clientTime: currentTime,
      // These authority-looking extras must be ignored by the protocol.
      targetId: secondWelcome.playerId,
      damage: 999,
    }))
    const castPacket = await castEventPromise
    if (castPacket.event.kind !== 'cast') throw new Error('Expected cast event.')
    expect(castPacket.event).toMatchObject({
      casterId: firstWelcome.playerId,
      abilityId: 'agulha-prima',
      hitIds: [secondWelcome.playerId],
      damages: [expect.objectContaining({ targetId: secondWelcome.playerId, amount: 17 })],
    })
    const damagedState = await damagedStatePromise
    const damaged = damagedState.players.find(({ id }) => id === secondWelcome.playerId)
    expect(damaged).toMatchObject({ health: 325, shield: 158, alive: true })

    currentTime += 100
    const cooldownError = waitForMessage(first, (packet) => (
      packet.type === 'error' && packet.code === 'COMBAT_REJECTED'
    ))
    first.send(JSON.stringify({
      type: 'nucleus_cast', runId: firstChanged.runId, castId: 'ada:too-soon',
      slot: 'primary', aim: { direction: { x: 0, y: 0, z: -1 } }, clientTime: currentTime,
    }))
    expect(await cooldownError).toMatchObject({ message: 'Esse poder ainda está recarregando.' })

    // A dropped transport cannot be toggled into combat invulnerability. The
    // durable combat slot is moved to spawn and locked briefly, while the valid
    // resume token still recovers the same player identity.
    const disconnectedAt = currentTime
    second.terminate()
    await waitUntil(async () => {
      const combat = await store.getNucleusCombat(
        firstWelcome.roomId,
        nucleusRunId,
        currentTime,
      )
      return combat.players.find(({ id }) => id === secondWelcome.playerId)?.connected === false
    })
    const disconnectedCombatant = (await store.getNucleusCombat(
      firstWelcome.roomId,
      nucleusRunId,
      currentTime,
    )).players.find(({ id }) => id === secondWelcome.playerId)
    expect(disconnectedCombatant?.position).toEqual(disconnectedCombatant?.spawnPosition)
    expect(disconnectedCombatant?.rejoinLockedUntil).toBe(disconnectedAt + 5_000)

    second = await connectTo(secondRuntime)
    sockets.push(second)
    const resumedWelcomePromise = waitForMessage(second, (packet) => (
      packet.type === 'welcome' || packet.type === 'error'
    ))
    second.send(JSON.stringify({
      type: 'join',
      version: PROTOCOL_VERSION,
      nickname: 'Gauss Re',
      appearance: createAvatarAppearance(2),
      resumeToken: secondWelcome.resumeToken,
    }))
    const resumedWelcome = await resumedWelcomePromise
    if (resumedWelcome.type === 'error') {
      throw new Error(`Resume failed: ${resumedWelcome.code}: ${resumedWelcome.message}`)
    }
    expect(resumedWelcome).toMatchObject({
      type: 'welcome',
      playerId: secondWelcome.playerId,
      roomId: secondWelcome.roomId,
    })
    const lockedError = waitForMessage(second, (packet) => (
      packet.type === 'error' && packet.code === 'COMBAT_REJECTED'
    ))
    second.send(JSON.stringify({
      type: 'nucleus_join', runId: firstChanged.runId, heroId: 'raul-rsa',
    }))
    expect(await lockedError).toMatchObject({
      message: 'O retorno à arena estará disponível em alguns segundos.',
    })

    currentTime = disconnectedAt + 5_000
    const rejoinedStatePromise = waitForNucleusState(second, 2)
    second.send(JSON.stringify({
      type: 'nucleus_join', runId: firstChanged.runId, heroId: 'raul-rsa',
    }))
    expect((await rejoinedStatePromise).phase).toBe('active')

    // Force a durable death without a relay. Either runtime's authoritative
    // tick must discover it, respawn once, and heal clients from store state.
    currentTime += 1_000
    await store.mutateNucleusCombat(firstWelcome.roomId, firstChanged.runId, currentTime, (record) => ({
      ...record,
      revision: record.revision + 1,
      players: record.players.map((combatant) => combatant.id === secondWelcome.playerId
        ? {
            ...combatant,
            health: 0,
            shield: 0,
            alive: false,
            deaths: combatant.deaths + 1,
            respawnAt: currentTime + 100,
            statuses: [],
          }
        : combatant),
      updatedAt: currentTime,
    }))
    currentTime += 101
    const respawnEvent = waitForMessage<NucleusCombatEventMessage>(first, (packet) => (
      packet.type === 'nucleus_event'
        && packet.event.kind === 'respawned'
        && packet.event.playerId === secondWelcome.playerId
    ), 2_500)
    const respawned = await respawnEvent
    expect(respawned.event).toMatchObject({ kind: 'respawned', playerId: secondWelcome.playerId })
    const persisted = await store.getNucleusCombat(firstWelcome.roomId, firstChanged.runId, currentTime)
    const restored = persisted.players.find(({ id }) => id === secondWelcome.playerId)
    expect(restored).toMatchObject({ alive: true, health: 325, shield: 175, respawnAt: null })
    expect(restored?.statuses).toEqual([
      expect.objectContaining({ id: 'spawn-protected', expiresAt: currentTime + 2_000 }),
    ])

    const beforeFlankMove = (await store.getSnapshot(firstWelcome.roomId, currentTime)).players
      .find(({ id }) => id === secondWelcome.playerId)
    if (!beforeFlankMove) throw new Error('Expected second player before flank move.')
    currentTime += 1_000
    const flankMoveSeen = waitForMessage(first, (packet) => (
      packet.type === 'activity_player_updated'
        && packet.playerId === secondWelcome.playerId
        && packet.sequence === beforeFlankMove.sequence + 1
    ))
    second.send(JSON.stringify({
      type: 'activity_move',
      activityId: 'nucleus-257',
      runId: firstChanged.runId,
      position: { ...beforeFlankMove.position, x: beforeFlankMove.position.x + 1 },
      yaw: beforeFlankMove.yaw,
      animation: 'walk',
      sequence: beforeFlankMove.sequence + 1,
      clientTime: currentTime,
    }))
    await flankMoveSeen

    currentTime += 100
    const waitingStatePromise = waitForNucleusState(first, 1)
    second.send(JSON.stringify({ type: 'nucleus_leave', runId: firstChanged.runId }))
    const waitingState = await waitingStatePromise
    expect(waitingState.phase).toBe('waiting')
    expect(waitingState.players.map(({ id }) => id)).toEqual([firstWelcome.playerId])
    const afterSelectionLeave = (await store.getSnapshot(firstWelcome.roomId, currentTime)).players
      .find(({ id }) => id === secondWelcome.playerId)
    const leftCombat = (await store.getNucleusCombat(
      firstWelcome.roomId,
      firstChanged.runId,
      currentTime,
    )).players.find(({ id }) => id === secondWelcome.playerId)
    expect(afterSelectionLeave?.position).toEqual(leftCombat?.spawnPosition)
    expect(afterSelectionLeave?.position).not.toEqual({
      ...beforeFlankMove.position,
      x: beforeFlankMove.position.x + 1,
    })

    const beforeSelectionMove = afterSelectionLeave
    if (!beforeSelectionMove) throw new Error('Expected second persisted player.')
    currentTime += 100
    const selectionMoveError = waitForMessage(second, (packet) => (
      packet.type === 'error' && packet.code === 'MOVEMENT_REJECTED'
    ))
    second.send(JSON.stringify({
      type: 'activity_move',
      activityId: 'nucleus-257',
      runId: firstChanged.runId,
      position: {
        ...beforeSelectionMove.position,
        x: beforeSelectionMove.position.x + 0.1,
      },
      yaw: beforeSelectionMove.yaw,
      animation: 'walk',
      sequence: beforeSelectionMove.sequence + 1,
      clientTime: currentTime,
    }))
    expect(await selectionMoveError).toMatchObject({
      message: 'Escolha um operador antes de se mover na arena.',
    })
    expect((await store.getSnapshot(firstWelcome.roomId, currentTime)).players
      .find(({ id }) => id === secondWelcome.playerId)?.position)
      .toEqual(beforeSelectionMove.position)
  })

  it('recovers a durable combat snapshot when cross-runtime Pub/Sub is missed', async () => {
    let currentTime = 30_000
    const sharedStore = new MemoryPrimeverseStore()
    const firstRuntime = createPrimeverseServer({
      store: sharedStore,
      instanceId: 'nucleus-publisher',
      now: () => currentTime,
    })
    const recoveringRuntime = createPrimeverseServer({
      store: withoutSubscriptions(sharedStore),
      instanceId: 'nucleus-recovering',
      now: () => currentTime,
    })
    runtimes.push(firstRuntime, recoveringRuntime)
    await Promise.all([listen(firstRuntime), listen(recoveringRuntime)])
    const first = await connectTo(firstRuntime)
    const recovering = await connectTo(recoveringRuntime)
    sockets.push(first, recovering)

    const firstWelcome = await join(first, 'Ada', 1)
    const recoveringWelcome = await join(recovering, 'Gauss', 2)
    expect(recoveringWelcome.roomId).toBe(firstWelcome.roomId)
    const portal = PORTAL_ROUTES['portal-nucleus'].source
    const firstSequence = await walkToStore(
      first,
      sharedStore,
      firstWelcome.roomId,
      firstWelcome.playerId,
      portal,
      0,
      () => { currentTime += 1_000 },
    )
    const recoveringSequence = await walkToStore(
      recovering,
      sharedStore,
      recoveringWelcome.roomId,
      recoveringWelcome.playerId,
      portal,
      0,
      () => { currentTime += 1_000 },
    )
    expect(firstSequence).toBeGreaterThan(0)
    expect(recoveringSequence).toBeGreaterThan(0)

    currentTime += 300
    const firstChangedPromise = waitForMessage(first, (packet) => (
      packet.type === 'activity_changed'
        && packet.playerId === firstWelcome.playerId
        && packet.activityId === 'nucleus-257'
    ))
    first.send(JSON.stringify({
      type: 'change_activity', activityId: 'nucleus-257', portalId: 'portal-nucleus',
    }))
    const firstChanged = await firstChangedPromise
    if (firstChanged.type !== 'activity_changed' || firstChanged.runId === null) {
      throw new Error('Expected publisher activity change.')
    }

    currentTime += 300
    const recoveringChangedPromise = waitForMessage(recovering, (packet) => (
      packet.type === 'activity_changed'
        && packet.playerId === recoveringWelcome.playerId
        && packet.activityId === 'nucleus-257'
    ))
    recovering.send(JSON.stringify({
      type: 'change_activity', activityId: 'nucleus-257', portalId: 'portal-nucleus',
    }))
    const recoveringChanged = await recoveringChangedPromise
    expect(recoveringChanged).toMatchObject({ runId: firstChanged.runId })

    currentTime += 100
    const waitingPromise = waitForNucleusState(recovering, 1)
    recovering.send(JSON.stringify({
      type: 'nucleus_join', runId: firstChanged.runId, heroId: 'raul-rsa',
    }))
    const waiting = await waitingPromise
    expect(waiting.phase).toBe('waiting')

    currentTime += 100
    const recoveredPromise = waitForNucleusState(
      recovering,
      2,
      waiting.revision + 1,
      2_500,
    )
    first.send(JSON.stringify({
      type: 'nucleus_join', runId: firstChanged.runId, heroId: 'luma-crivo',
    }))
    const recovered = await recoveredPromise
    expect(recovered.phase).toBe('active')
    expect(recovered.players.map(({ id }) => id)).toEqual(expect.arrayContaining([
      firstWelcome.playerId,
      recoveringWelcome.playerId,
    ]))
  })
})

async function walkTo(
  actor: WebSocket,
  observer: WebSocket,
  destination: readonly [number, number, number],
  initialSequence: number,
  advanceClock: () => void,
): Promise<number> {
  const start = { x: 0, y: 0.04, z: 13 }
  const distance = Math.hypot(destination[0] - start.x, destination[2] - start.z)
  const steps = Math.ceil(distance / 7.5)
  for (let index = 0; index < steps; index += 1) {
    advanceClock()
    const progress = (index + 1) / steps
    const position = {
      x: start.x + (destination[0] - start.x) * progress,
      y: destination[1],
      z: start.z + (destination[2] - start.z) * progress,
    }
    const update = waitForMessage(observer, (packet) => (
      packet.type === 'player_updated'
        && packet.sequence === initialSequence + index + 1
    ))
    actor.send(JSON.stringify({
      type: 'move',
      sequence: initialSequence + index + 1,
      clientTime: Date.now(),
      position,
      yaw: 0,
      animation: 'run',
    }))
    await update
  }
  return initialSequence + steps
}

async function walkToStore(
  actor: WebSocket,
  store: PrimeverseStore,
  roomId: string,
  playerId: string,
  destination: readonly [number, number, number],
  initialSequence: number,
  advanceClock: () => void,
): Promise<number> {
  const start = { x: 0, y: 0.04, z: 13 }
  const distance = Math.hypot(destination[0] - start.x, destination[2] - start.z)
  const steps = Math.ceil(distance / 7.5)
  for (let index = 0; index < steps; index += 1) {
    advanceClock()
    const sequence = initialSequence + index + 1
    const progress = (index + 1) / steps
    actor.send(JSON.stringify({
      type: 'move',
      sequence,
      clientTime: Date.now(),
      position: {
        x: start.x + (destination[0] - start.x) * progress,
        y: destination[1],
        z: start.z + (destination[2] - start.z) * progress,
      },
      yaw: 0,
      animation: 'run',
    }))
    await waitUntil(async () => (
      (await store.getSnapshot(roomId, 0)).players
        .find(({ id }) => id === playerId)?.sequence === sequence
    ))
  }
  return initialSequence + steps
}

function withoutSubscriptions(delegate: PrimeverseStore): PrimeverseStore {
  return new Proxy(delegate, {
    get(target, property) {
      if (property === 'subscribe') return () => () => undefined
      if (property === 'close') return async () => undefined
      const value = Reflect.get(target, property, target) as unknown
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

async function waitUntil(predicate: () => Promise<boolean>, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for durable state.')
}

async function listen(runtime: PrimeverseServerRuntime): Promise<void> {
  await new Promise<void>((resolve) => runtime.server.listen(0, '127.0.0.1', resolve))
}

async function connectTo(runtime: PrimeverseServerRuntime): Promise<WebSocket> {
  const address = runtime.server.address()
  if (!address || typeof address === 'string') throw new Error('Test server has no TCP address.')
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/primeverse`)
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
  })
}

async function join(socket: WebSocket, nickname: string, appearanceIndex: number) {
  const welcome = waitForMessage(socket, (packet) => packet.type === 'welcome')
  socket.send(JSON.stringify({
    type: 'join', version: PROTOCOL_VERSION, nickname,
    appearance: createAvatarAppearance(appearanceIndex),
  }))
  const packet = await welcome
  if (packet.type !== 'welcome') throw new Error('Expected welcome packet.')
  return packet
}

function waitForNucleusState(
  socket: WebSocket,
  connectedPlayers: number,
  minimumRevision = 0,
  timeoutMs = 2_000,
): Promise<NucleusCombatState> {
  return waitForMessage<NucleusCombatState>(socket, (packet) => (
    packet.type === 'nucleus_state'
      && packet.players.length === connectedPlayers
      && packet.revision >= minimumRevision
  ), timeoutMs)
}

function waitForMessage<T extends ServerMessage = ServerMessage>(
  socket: WebSocket,
  predicate: (packet: ServerMessage) => boolean,
  timeoutMs = 2_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for matching server packet.'))
    }, timeoutMs)
    const onMessage = (raw: WebSocket.RawData) => {
      const parsed = parseServerMessage(raw instanceof Buffer ? new Uint8Array(raw) : String(raw))
      if (!parsed.ok || !predicate(parsed.value)) return
      cleanup()
      resolve(parsed.value as T)
    }
    const cleanup = () => {
      clearTimeout(timeout)
      socket.off('message', onMessage)
    }
    socket.on('message', onMessage)
  })
}
