import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'

import {
  PROTOCOL_VERSION,
  createAvatarAppearance,
  parseServerMessage,
  type ServerMessage,
} from '../../src/features/primeverse/games/primeverse-online/shared/index.js'
import { PORTAL_ROUTES } from '../../src/features/primeverse/games/primeverse-online/shared/realms.js'
import { MemoryPrimeverseStore } from './memoryStore.js'
import { createPrimeverseServer, type PrimeverseServerRuntime } from './server.js'

const runtimes: PrimeverseServerRuntime[] = []
const sockets: WebSocket[] = []

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate()
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()))
})

describe('Primeverse authoritative activities', () => {
  it('keeps two room peers in one stable run, isolates transforms and clears run on Nexus return', async () => {
    let currentTime = 10_000
    const store = new MemoryPrimeverseStore()
    const firstRuntime = createPrimeverseServer({
      store,
      enableTimers: false,
      instanceId: 'activity-runtime-a',
      now: () => currentTime,
    })
    const secondRuntime = createPrimeverseServer({
      store,
      enableTimers: false,
      instanceId: 'activity-runtime-b',
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

    const first = await connect(`ws://127.0.0.1:${firstAddress.port}/api/primeverse`)
    const second = await connect(`ws://127.0.0.1:${secondAddress.port}/api/primeverse`)
    sockets.push(first, second)
    const firstWelcomePromise = nextMessage(first, 'welcome')
    first.send(JSON.stringify({
      type: 'join',
      version: PROTOCOL_VERSION,
      nickname: 'Ada',
      appearance: createAvatarAppearance(1),
    }))
    const firstWelcome = await firstWelcomePromise

    const secondWelcomePromise = nextMessage(second, 'welcome')
    second.send(JSON.stringify({
      type: 'join',
      version: PROTOCOL_VERSION,
      nickname: 'Gauss',
      appearance: createAvatarAppearance(2),
    }))
    const secondWelcome = await secondWelcomePromise
    expect(secondWelcome.roomId).toBe(firstWelcome.roomId)
    expect(firstWelcome.players[0]).toMatchObject({ activityId: 'nexus', runId: null })

    const uninvitedEntry = nextMessage(first, 'error')
    first.send(JSON.stringify({
      type: 'change_activity',
      activityId: 'nucleus-257',
      portalId: 'portal-nucleus',
    }))
    expect(await uninvitedEntry).toMatchObject({
      code: 'INVALID_PAYLOAD',
      message: 'Chegue mais perto do portal ou siga um colega que já iniciou a expedição.',
    })

    const source = PORTAL_ROUTES['portal-nucleus'].source
    const firstSequence = await walkTo(first, second, source, 0, () => { currentTime += 1_000 })

    currentTime += 1_000
    const firstOwnChange = nextMessage(first, 'activity_changed')
    const firstChangeSeenBySecond = nextMessage(second, 'activity_changed')
    first.send(JSON.stringify({
      type: 'change_activity',
      activityId: 'nucleus-257',
      portalId: 'portal-nucleus',
    }))
    const firstChanged = await firstOwnChange
    expect(await firstChangeSeenBySecond).toEqual(firstChanged)
    expect(firstChanged).toMatchObject({
      playerId: firstWelcome.playerId,
      activityId: 'nucleus-257',
      runId: `run:${firstWelcome.roomId}:nucleus-257`,
      sequence: firstSequence + 1,
    })

    currentTime += 1_000
    const secondOwnChange = nextMessage(second, 'activity_changed')
    const secondChangeSeenByFirst = nextMessage(first, 'activity_changed')
    second.send(JSON.stringify({
      type: 'change_activity',
      activityId: 'nucleus-257',
      portalId: 'portal-nucleus',
    }))
    const secondChanged = await secondOwnChange
    expect(await secondChangeSeenByFirst).toEqual(secondChanged)
    expect(secondChanged).toMatchObject({
      playerId: secondWelcome.playerId,
      activityId: 'nucleus-257',
      runId: firstChanged.runId,
      sequence: 1,
    })
    if (firstChanged.runId === null) throw new Error('Expected Nucleus run id.')

    currentTime += 100
    const firstWaitingState = nextMessage(first, 'nucleus_state')
    first.send(JSON.stringify({
      type: 'nucleus_join', runId: firstChanged.runId, heroId: 'luma-crivo',
    }))
    expect((await firstWaitingState).phase).toBe('waiting')
    currentTime += 100
    const firstActiveState = nextMessage(first, 'nucleus_state')
    second.send(JSON.stringify({
      type: 'nucleus_join', runId: firstChanged.runId, heroId: 'raul-rsa',
    }))
    expect((await firstActiveState).phase).toBe('active')
    const firstCombatSequence = firstChanged.sequence + 1

    const forgedRunError = nextMessage(first, 'error')
    first.send(JSON.stringify({
      type: 'activity_move',
      activityId: 'nucleus-257',
      runId: 'run:primeverse-999:nucleus-257',
      position: { x: 0.2, y: 0.05, z: 20 },
      yaw: 0,
      animation: 'walk',
      sequence: firstCombatSequence + 1,
      clientTime: currentTime,
    }))
    expect(await forgedRunError).toMatchObject({
      code: 'MOVEMENT_REJECTED',
      message: 'Activity or run does not match the authoritative session.',
    })

    currentTime += 1_000
    const activityUpdate = nextMessage(second, 'activity_player_updated')
    first.send(JSON.stringify({
      type: 'activity_move',
      activityId: 'nucleus-257',
      runId: firstChanged.runId,
      position: { x: 0.2, y: 0.05, z: 20 },
      yaw: 0,
      animation: 'walk',
      sequence: firstCombatSequence + 1,
      clientTime: currentTime,
    }))
    expect(await activityUpdate).toMatchObject({
      playerId: firstWelcome.playerId,
      activityId: 'nucleus-257',
      runId: firstChanged.runId,
      position: { x: 0.2, y: 0.05, z: 20 },
    })

    // Echoing an accepted transform back through the local relay must not
    // refill burst credit. Repeated packets eventually hit Luma's real kit
    // speed instead of inheriting the arena-wide fastest-hero envelope.
    let sustainedX = 0.2
    for (let index = 0; index < 5; index += 1) {
      currentTime += 100
      sustainedX += 0.95
      const sustainedUpdate = nextMessage(second, 'activity_player_updated')
      first.send(JSON.stringify({
        type: 'activity_move',
        activityId: 'nucleus-257',
        runId: firstChanged.runId,
        position: { x: sustainedX, y: 0.05, z: 20 },
        yaw: 0,
        animation: 'run',
        sequence: firstCombatSequence + 2 + index,
        clientTime: currentTime,
      }))
      expect((await sustainedUpdate).position.x).toBeCloseTo(sustainedX)
    }
    currentTime += 100
    const sustainedSpeedError = nextMessage(first, 'error')
    first.send(JSON.stringify({
      type: 'activity_move',
      activityId: 'nucleus-257',
      runId: firstChanged.runId,
      position: { x: sustainedX + 0.95, y: 0.05, z: 20 },
      yaw: 0,
      animation: 'run',
      sequence: firstCombatSequence + 7,
      clientTime: currentTime,
    }))
    expect(await sustainedSpeedError).toMatchObject({
      code: 'MOVEMENT_REJECTED',
      message: 'Activity movement rejected: horizontal_speed.',
    })

    // A stationary jump is valid (the cover sweep is horizontal), but a
    // client cannot remain suspended beyond the arena's ballistic window.
    currentTime += 100
    const jumpUpdate = nextMessage(second, 'activity_player_updated')
    first.send(JSON.stringify({
      type: 'activity_move',
      activityId: 'nucleus-257',
      runId: firstChanged.runId,
      position: { x: sustainedX, y: 0.5, z: 20 },
      yaw: 0,
      animation: 'idle',
      sequence: firstCombatSequence + 7,
      clientTime: currentTime,
    }))
    expect((await jumpUpdate).position).toEqual({ x: sustainedX, y: 0.5, z: 20 })

    currentTime += 1_900
    const hoverError = nextMessage(first, 'error')
    first.send(JSON.stringify({
      type: 'activity_move',
      activityId: 'nucleus-257',
      runId: firstChanged.runId,
      position: { x: sustainedX, y: 0.5, z: 20 },
      yaw: 0,
      animation: 'idle',
      sequence: firstCombatSequence + 8,
      clientTime: currentTime,
    }))
    expect(await hoverError).toMatchObject({
      code: 'MOVEMENT_REJECTED',
      message: 'Tempo de salto inválido para a arena.',
    })

    currentTime += 100
    const blinkError = nextMessage(first, 'error')
    first.send(JSON.stringify({
      type: 'activity_move',
      activityId: 'nucleus-257',
      runId: firstChanged.runId,
      position: { x: sustainedX, y: 0.05, z: 2 },
      yaw: 0,
      animation: 'run',
      sequence: firstCombatSequence + 8,
      clientTime: currentTime,
    }))
    expect(await blinkError).toMatchObject({
      code: 'MOVEMENT_REJECTED',
      message: 'Activity movement rejected: position_delta.',
    })

    // Nucleus ability displacement is never accepted from raw movement,
    // including after a cooldown. nucleus_cast computes and commits its
    // collision-safe destination on the server instead.
    currentTime += 100
    const repeatedBlinkError = nextMessage(first, 'error')
    first.send(JSON.stringify({
      type: 'activity_move',
      activityId: 'nucleus-257',
      runId: firstChanged.runId,
      position: { x: sustainedX, y: 0.05, z: 2 },
      yaw: 0,
      animation: 'run',
      sequence: firstCombatSequence + 8,
      clientTime: currentTime,
    }))
    expect(await repeatedBlinkError).toMatchObject({
      code: 'MOVEMENT_REJECTED',
      message: 'Activity movement rejected: position_delta.',
    })

    const outsideBoundsError = nextMessage(first, 'error')
    first.send(JSON.stringify({
      type: 'activity_move',
      activityId: 'nucleus-257',
      runId: firstChanged.runId,
      position: { x: 41, y: 0.05, z: 2 },
      yaw: 0,
      animation: 'run',
      sequence: firstCombatSequence + 9,
      clientTime: currentTime,
    }))
    expect(await outsideBoundsError).toMatchObject({
      code: 'INVALID_PAYLOAD',
      message: 'Activity movement position is outside its world.',
    })

    currentTime += 3_000
    const cooldownCannotAuthorizeBlink = nextMessage(first, 'error')
    first.send(JSON.stringify({
      type: 'activity_move',
      activityId: 'nucleus-257',
      runId: firstChanged.runId,
      position: { x: sustainedX, y: 0.05, z: 2 },
      yaw: 0,
      animation: 'run',
      sequence: firstCombatSequence + 8,
      clientTime: currentTime,
    }))
    expect(await cooldownCannotAuthorizeBlink).toMatchObject({
      code: 'MOVEMENT_REJECTED',
      message: 'Activity movement rejected: position_delta.',
    })

    currentTime += 1_000
    const nexusAck = nextMessage(first, 'activity_changed')
    const nexusSeenBySecond = nextMessage(second, 'activity_changed')
    first.send(JSON.stringify({ type: 'change_activity', activityId: 'nexus' }))
    const returned = await nexusAck
    expect(await nexusSeenBySecond).toEqual(returned)
    expect(returned).toMatchObject({
      playerId: firstWelcome.playerId,
      activityId: 'nexus',
      runId: null,
    })

    const persisted = await store.getSnapshot(firstWelcome.roomId, currentTime)
    expect(persisted.players).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: firstWelcome.playerId,
        activityId: 'nexus',
        runId: null,
      }),
      expect.objectContaining({
        id: secondWelcome.playerId,
        activityId: 'nucleus-257',
        runId: firstChanged.runId,
      }),
    ]))

    const ulamSource = PORTAL_ROUTES['portal-ulam'].source
    const atUlamPortalSequence = await walkTo(
      first,
      second,
      ulamSource,
      returned.sequence,
      () => { currentTime += 1_000 },
    )
    currentTime += 1_000
    const ulamAck = nextMessage(first, 'activity_changed')
    const ulamSeenBySecond = nextMessage(second, 'activity_changed')
    first.send(JSON.stringify({
      type: 'change_activity',
      activityId: 'ulam-rift',
      portalId: 'portal-ulam',
    }))
    const ulamChanged = await ulamAck
    expect(await ulamSeenBySecond).toEqual(ulamChanged)
    expect(ulamChanged).toMatchObject({
      activityId: 'ulam-rift',
      sequence: atUlamPortalSequence + 1,
    })

    currentTime += 200
    const impulseUpdate = nextMessage(second, 'activity_player_updated')
    first.send(JSON.stringify({
      type: 'activity_move',
      activityId: 'ulam-rift',
      runId: ulamChanged.runId,
      position: { x: 2.94, y: 1.12, z: 14 },
      yaw: -Math.PI / 2,
      animation: 'run',
      sequence: ulamChanged.sequence + 1,
      clientTime: currentTime,
    }))
    expect(await impulseUpdate).toMatchObject({
      playerId: firstWelcome.playerId,
      position: { x: 2.94, y: 1.12, z: 14 },
    })

    let expectedX = 2.94
    for (let index = 0; index < 24; index += 1) {
      currentTime += 67
      expectedX += 9.2 * 0.067
      const runUpdate = nextMessage(second, 'activity_player_updated')
      first.send(JSON.stringify({
        type: 'activity_move',
        activityId: 'ulam-rift',
        runId: ulamChanged.runId,
        position: { x: expectedX, y: 1.12, z: 14 },
        yaw: -Math.PI / 2,
        animation: 'run',
        sequence: ulamChanged.sequence + index + 2,
        clientTime: currentTime,
      }))
      expect(await runUpdate).toMatchObject({
        playerId: firstWelcome.playerId,
        activityId: 'ulam-rift',
        position: { x: expectedX, y: 1.12, z: 14 },
      })
    }

    currentTime += 100
    const respawnUpdate = nextMessage(second, 'activity_player_updated')
    first.send(JSON.stringify({
      type: 'activity_move',
      activityId: 'ulam-rift',
      runId: ulamChanged.runId,
      position: { x: -3.21885, y: 10.5, z: -33.75 },
      yaw: Math.PI,
      animation: 'idle',
      sequence: ulamChanged.sequence + 26,
      clientTime: currentTime,
    }))
    expect(await respawnUpdate).toMatchObject({
      playerId: firstWelcome.playerId,
      position: { x: -3.21885, y: 10.5, z: -33.75 },
      sequence: ulamChanged.sequence + 26,
    })

    first.terminate()
    await waitFor(35)
    currentTime += 1
    const resumed = await connect(`ws://127.0.0.1:${secondAddress.port}/api/primeverse`)
    sockets.push(resumed)
    const resumedWelcomePromise = nextMessage(resumed, 'welcome')
    resumed.send(JSON.stringify({
      type: 'join',
      version: PROTOCOL_VERSION,
      nickname: 'Ada Retornada',
      appearance: createAvatarAppearance(1),
      resumeToken: firstWelcome.resumeToken,
    }))
    const resumedWelcome = await resumedWelcomePromise
    expect(resumedWelcome).toMatchObject({
      playerId: firstWelcome.playerId,
      roomId: firstWelcome.roomId,
    })
    expect(resumedWelcome.players).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: firstWelcome.playerId,
        activityId: 'ulam-rift',
        runId: ulamChanged.runId,
        position: { x: -3.21885, y: 10.5, z: -33.75 },
      }),
    ]))

    // Resume must restore Ulam's 1.5 m impulse budget, rather than Nexus's
    // smaller default, or this first legitimate packet would be rejected.
    currentTime += 200
    const resumedImpulseUpdate = nextMessage(second, 'activity_player_updated')
    resumed.send(JSON.stringify({
      type: 'activity_move',
      activityId: 'ulam-rift',
      runId: ulamChanged.runId,
      position: { x: -0.27885, y: 10.5, z: -33.75 },
      yaw: -Math.PI / 2,
      animation: 'run',
      sequence: ulamChanged.sequence + 27,
      clientTime: currentTime,
    }))
    expect(await resumedImpulseUpdate).toMatchObject({
      playerId: firstWelcome.playerId,
      position: { x: -0.27885, y: 10.5, z: -33.75 },
      sequence: ulamChanged.sequence + 27,
    })
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
    const update = nextMessage(observer, 'player_updated')
    actor.send(JSON.stringify({
      type: 'move',
      sequence: initialSequence + index + 1,
      clientTime: Date.now(),
      position,
      yaw: 0,
      animation: 'run',
    }))
    expect((await update).position).toEqual(position)
  }
  return initialSequence + steps
}

async function listen(runtime: PrimeverseServerRuntime): Promise<void> {
  await new Promise<void>((resolve) => runtime.server.listen(0, '127.0.0.1', resolve))
}

async function connect(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
  })
}

async function waitFor(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function nextMessage<T extends ServerMessage['type']>(
  socket: WebSocket,
  type: T,
): Promise<Extract<ServerMessage, { type: T }>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('message', onMessage)
      reject(new Error(`Timed out waiting for ${type}.`))
    }, 2_000)
    const onMessage = (raw: WebSocket.RawData) => {
      const parsed = parseServerMessage(raw instanceof Buffer ? new Uint8Array(raw) : String(raw))
      if (!parsed.ok || parsed.value.type !== type) return
      clearTimeout(timeout)
      socket.off('message', onMessage)
      resolve(parsed.value as Extract<ServerMessage, { type: T }>)
    }
    socket.on('message', onMessage)
  })
}
