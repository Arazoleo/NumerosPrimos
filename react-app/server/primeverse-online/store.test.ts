import { describe, expect, it } from 'vitest'
import {
  RESUME_LEASE_MS,
  createAvatarAppearance,
} from '../../src/features/primeverse/games/primeverse-online/shared/index.js'
import { createStoreFromEnvironment } from './createStore.js'
import { MemoryPrimeverseStore } from './memoryStore.js'
import type { StoredPlayer } from './model.js'
import { ConnectionSupersededError } from './store.js'

describe('Primeverse storage policy', () => {
  it('never silently falls back to process memory in production', () => {
    const store = createStoreFromEnvironment({ NODE_ENV: 'production' })
    expect(store.mode).toBe('unavailable')
  })

  it('caps rooms at 20 players and allocates the next room', async () => {
    const store = new MemoryPrimeverseStore({ maxRooms: 2 })
    const rooms: string[] = []
    for (let index = 0; index < 21; index += 1) {
      const joined = await store.join(player(index), index + 1)
      rooms.push(joined.roomId)
    }
    expect(new Set(rooms.slice(0, 20))).toEqual(new Set(['primeverse-001']))
    expect(rooms[20]).toBe('primeverse-002')
  })

  it('surfaces stale presence ids so the server can announce cleanup', async () => {
    const store = new MemoryPrimeverseStore({ playerTimeoutMs: 100 })
    await store.join(player(1), 1_000)
    const snapshot = await store.getSnapshot('primeverse-001', 1_101)
    expect(snapshot.players).toEqual([])
    expect(snapshot.expiredPlayerIds).toEqual(['player-1'])
    expect((await store.getSnapshot('primeverse-001', 1_102)).expiredPlayerIds).toEqual([])
  })

  it('atomically persists and isolates Nucleus combat records per room', async () => {
    const store = new MemoryPrimeverseStore()
    const runOne = 'run:primeverse-001:nucleus-257' as const
    const runTwo = 'run:primeverse-002:nucleus-257' as const
    expect((await store.getNucleusCombat('primeverse-001', runOne, 1_000)).revision).toBe(0)
    const mutated = await store.mutateNucleusCombat('primeverse-001', runOne, 1_010, (record) => ({
      ...record,
      revision: record.revision + 1,
      recentCastIds: ['player-1:cast-1'],
      updatedAt: 1_010,
    }))
    expect(mutated.revision).toBe(1)
    expect((await store.getNucleusCombat('primeverse-001', runOne, 1_020)).recentCastIds)
      .toEqual(['player-1:cast-1'])
    expect((await store.getNucleusCombat('primeverse-002', runTwo, 1_020)).revision).toBe(0)
  })

  it('guards combat mutations with the active connection generation', async () => {
    const store = new MemoryPrimeverseStore()
    const original = player(12)
    const joined = await store.join(original, 1_000)
    const runId = 'run:primeverse-001:nucleus-257' as const
    const inArena: StoredPlayer = {
      ...original,
      activityId: 'nucleus-257',
      runId,
      position: { x: 0, y: 0.05, z: 20 },
      sequence: 1,
      updatedAt: 1_010,
    }
    expect(await store.updatePlayer(joined.roomId, inArena, 1_010)).toBe(true)
    await expect(store.mutateNucleusCombat(
      joined.roomId,
      runId,
      1_020,
      (record) => ({ ...record, revision: 1, updatedAt: 1_020 }),
      inArena,
    )).resolves.toMatchObject({ revision: 1 })

    const replacement: StoredPlayer = {
      ...inArena,
      resumeToken: 'replacement_token_1234567890',
      updatedAt: 1_030,
    }
    expect(await store.resume(replacement, inArena.resumeToken, 1_030)).not.toBeNull()
    await expect(store.mutateNucleusCombat(
      joined.roomId,
      runId,
      1_040,
      (record) => ({ ...record, revision: record.revision + 1, updatedAt: 1_040 }),
      inArena,
    )).rejects.toBeInstanceOf(ConnectionSupersededError)
  })

  it('uses sequence, activity and run CAS for background position corrections', async () => {
    const store = new MemoryPrimeverseStore()
    const original = player(13)
    const joined = await store.join(original, 1_000)
    const runId = 'run:primeverse-001:nucleus-257' as const
    const inArena: StoredPlayer = {
      ...original,
      activityId: 'nucleus-257',
      runId,
      position: { x: 0, y: 0.05, z: 20 },
      sequence: 1,
      updatedAt: 1_010,
    }
    expect(await store.updatePlayer(joined.roomId, inArena, 1_010)).toBe(true)
    const corrected: StoredPlayer = {
      ...inArena,
      position: { x: -19, y: 0.05, z: -2 },
      sequence: 2,
      updatedAt: 1_020,
    }
    expect(await store.updatePlayerIfCurrent(
      joined.roomId,
      inArena,
      corrected,
      1_020,
    )).toBe(true)
    expect(await store.updatePlayerIfCurrent(
      joined.roomId,
      inArena,
      { ...corrected, sequence: 3 },
      1_030,
    )).toBe(false)
    expect(await store.updatePlayerIfCurrent(
      joined.roomId,
      { ...corrected, runId: 'run:primeverse-002:nucleus-257' },
      { ...corrected, sequence: 3 },
      1_030,
    )).toBe(false)
  })

  it('rotates resume credentials and prevents an old connection from mutating or leaving', async () => {
    const store = new MemoryPrimeverseStore()
    const original = player(7)
    const joined = await store.join(original, 1_000)
    const replacement = {
      ...player(8),
      nickname: 'Reconnected',
      resumeToken: 'replacement_token_1234567890',
    }
    const resumed = await store.resume(replacement, original.resumeToken, 1_010)
    expect(resumed).not.toBeNull()
    expect(resumed?.roomId).toBe(joined.roomId)
    expect(resumed?.players).toHaveLength(1)
    expect(resumed?.players[0]).toMatchObject({
      id: original.id,
      nickname: 'Reconnected',
      resumeToken: replacement.resumeToken,
    })

    expect(await store.updatePlayer(joined.roomId, original, 1_020)).toBe(false)
    expect(await store.leave(joined.roomId, original.id, original.resumeToken, 1_030, true)).toBe(false)
    expect((await store.getSnapshot(joined.roomId, 1_030)).players).toHaveLength(1)
    expect(await store.leave(joined.roomId, original.id, replacement.resumeToken, 1_040, false)).toBe(true)
  })

  it('hides a dropped player immediately while retaining a short resumable snapshot', async () => {
    const store = new MemoryPrimeverseStore()
    const original = player(3)
    const joined = await store.join(original, 1_000)
    expect(await store.leave(joined.roomId, original.id, original.resumeToken, 1_010, true)).toBe(true)
    expect((await store.getSnapshot(joined.roomId, 1_011)).players).toEqual([])

    const replacement = {
      ...player(4),
      resumeToken: 'resumed_after_drop_123456789',
    }
    const resumed = await store.resume(replacement, original.resumeToken, 1_020)
    expect(resumed?.players).toHaveLength(1)
    expect(resumed?.players[0]).toMatchObject({
      id: original.id,
      resumeToken: replacement.resumeToken,
    })
  })

  it('retains the authoritative Nucleus jump clock across a resume token rotation', async () => {
    const store = new MemoryPrimeverseStore()
    const original: StoredPlayer = {
      ...player(14),
      activityId: 'nucleus-257',
      runId: 'run:primeverse-001:nucleus-257',
      position: { x: 0, y: 0.5, z: 20 },
      nucleusAirborneSince: 1_000,
      updatedAt: 1_000,
    }
    const joined = await store.join(original, 1_000)
    expect(await store.leave(
      joined.roomId,
      original.id,
      original.resumeToken,
      1_100,
      true,
    )).toBe(true)
    const replacement: StoredPlayer = {
      ...player(15),
      resumeToken: 'airborne_replacement_123456789',
    }
    const resumed = await store.resume(replacement, original.resumeToken, 2_900)
    expect(resumed?.players[0]).toMatchObject({
      id: original.id,
      position: original.position,
      nucleusAirborneSince: 1_000,
      resumeToken: replacement.resumeToken,
    })
  })

  it('expires detached resume snapshots and invalidates intentional exits immediately', async () => {
    const expiredStore = new MemoryPrimeverseStore()
    const expiredPlayer = player(5)
    const expiredJoin = await expiredStore.join(expiredPlayer, 1_000)
    await expiredStore.leave(
      expiredJoin.roomId,
      expiredPlayer.id,
      expiredPlayer.resumeToken,
      1_010,
      true,
    )
    expect(await expiredStore.resume(
      { ...player(6), resumeToken: 'expired_replacement_123456789' },
      expiredPlayer.resumeToken,
      1_010 + RESUME_LEASE_MS + 1,
    )).toBeNull()

    const cleanStore = new MemoryPrimeverseStore()
    const cleanPlayer = player(7)
    const cleanJoin = await cleanStore.join(cleanPlayer, 2_000)
    await cleanStore.leave(cleanJoin.roomId, cleanPlayer.id, cleanPlayer.resumeToken, 2_010, false)
    expect(await cleanStore.resume(
      { ...player(8), resumeToken: 'clean_replacement_12345678900' },
      cleanPlayer.resumeToken,
      2_020,
    )).toBeNull()
  })
})

function player(index: number): StoredPlayer {
  return {
    id: `player-${index}`,
    nickname: `Player ${index}`,
    activityId: 'nexus',
    runId: null,
    appearance: createAvatarAppearance(index),
    position: { x: 0, y: 0.04, z: 13 },
    yaw: 0,
    animation: 'idle',
    emote: null,
    sequence: 0,
    joinedAt: index + 1,
    resumeToken: `resume_token_${String(index).padStart(16, '0')}`,
    updatedAt: index + 1,
  }
}
