import {
  createInitialWorld,
  createInitialNucleusCombat,
  type NucleusCombatRecord,
  type RelayEnvelope,
  type RoomSnapshot,
  type StoredPlayer,
  type WorldRecord,
} from './model.js'
import {
  ConnectionSupersededError,
  RoomCapacityError,
  type CombatMutationAuthority,
  type PrimeverseStore,
  type StoreHealth,
} from './store.js'
import { RESUME_LEASE_MS } from '../../src/features/primeverse/games/primeverse-online/shared/protocol.js'
import type { ActivityRunId } from '../../src/features/primeverse/games/primeverse-online/shared/activities.js'

interface MemoryRoom {
  players: Map<string, StoredPlayer>
  presence: Map<string, number>
  resumeLeases: Map<string, number>
  world: WorldRecord
  nucleusCombat: Map<ActivityRunId, NucleusCombatRecord>
}

export interface MemoryStoreOptions {
  roomCapacity?: number
  maxRooms?: number
  playerTimeoutMs?: number
}

/** Local development/test store. It is deliberately never selected in production. */
export class MemoryPrimeverseStore implements PrimeverseStore {
  readonly mode = 'memory' as const
  private readonly rooms = new Map<string, MemoryRoom>()
  private readonly listeners = new Set<(envelope: RelayEnvelope) => void>()
  private readonly roomCapacity: number
  private readonly maxRooms: number
  private readonly playerTimeoutMs: number

  constructor(options: MemoryStoreOptions = {}) {
    this.roomCapacity = options.roomCapacity ?? 20
    this.maxRooms = options.maxRooms ?? 100
    this.playerTimeoutMs = options.playerTimeoutMs ?? 45_000
  }

  async start(): Promise<void> {}

  async health(): Promise<StoreHealth> {
    return { ok: true, mode: this.mode, detail: 'Somente desenvolvimento/teste; sem coordenação multi-instância.' }
  }

  async join(player: StoredPlayer, now: number): Promise<RoomSnapshot> {
    for (let index = 1; index <= this.maxRooms; index += 1) {
      const roomId = roomName(index)
      const room = this.getOrCreateRoom(roomId, now)
      const expiredPlayerIds = this.cleanupRoom(room, now)
      if (room.presence.size >= this.roomCapacity) continue
      room.players.set(player.id, clonePlayer(player))
      room.presence.set(player.id, now)
      room.resumeLeases.delete(player.id)
      return this.snapshot(roomId, room, expiredPlayerIds)
    }
    throw new RoomCapacityError()
  }

  async resume(
    player: StoredPlayer,
    previousResumeToken: string,
    now: number,
  ): Promise<RoomSnapshot | null> {
    for (const [roomId, room] of this.rooms) {
      const expiredPlayerIds = this.cleanupRoom(room, now)
      const previous = [...room.players.values()].find(
        (candidate) => candidate.resumeToken === previousResumeToken,
      )
      if (!previous) continue
      const active = room.presence.has(previous.id)
      const leaseUntil = room.resumeLeases.get(previous.id)
      if (!active && (leaseUntil === undefined || leaseUntil < now)) continue
      if (!active && room.presence.size >= this.roomCapacity) return null
      const resumed: StoredPlayer = {
        ...previous,
        nickname: player.nickname,
        appearance: { ...player.appearance },
        emote: null,
        resumeToken: player.resumeToken,
        updatedAt: now,
      }
      room.players.set(previous.id, resumed)
      room.presence.set(previous.id, now)
      room.resumeLeases.delete(previous.id)
      return this.snapshot(roomId, room, expiredPlayerIds)
    }
    return null
  }

  async updatePlayer(roomId: string, player: StoredPlayer, now: number): Promise<boolean> {
    const room = this.rooms.get(roomId)
    const current = room?.players.get(player.id)
    if (!room
      || !current
      || !room.presence.has(player.id)
      || current.resumeToken !== player.resumeToken) return false
    room.players.set(player.id, clonePlayer(player))
    room.presence.set(player.id, now)
    return true
  }

  async updatePlayerIfCurrent(
    roomId: string,
    expected: Pick<StoredPlayer, 'id' | 'resumeToken' | 'sequence' | 'activityId' | 'runId'>,
    player: StoredPlayer,
    now: number,
  ): Promise<boolean> {
    const room = this.rooms.get(roomId)
    const current = room?.players.get(expected.id)
    if (!room
      || !current
      || !room.presence.has(expected.id)
      || current.resumeToken !== expected.resumeToken
      || current.sequence !== expected.sequence
      || current.activityId !== expected.activityId
      || current.runId !== expected.runId) return false
    room.players.set(player.id, clonePlayer(player))
    room.presence.set(player.id, now)
    return true
  }

  async touch(roomId: string, playerId: string, resumeToken: string, now: number): Promise<boolean> {
    const room = this.rooms.get(roomId)
    const player = room?.players.get(playerId)
    if (!room
      || !player
      || !room.presence.has(playerId)
      || player.resumeToken !== resumeToken) return false
    room.presence.set(playerId, now)
    return true
  }

  async leave(
    roomId: string,
    playerId: string,
    resumeToken: string,
    now: number,
    retainResumeLease: boolean,
  ): Promise<boolean> {
    const room = this.rooms.get(roomId)
    const player = room?.players.get(playerId)
    if (!room || !player || player.resumeToken !== resumeToken) return false
    room.presence.delete(playerId)
    if (retainResumeLease) room.resumeLeases.set(playerId, now + RESUME_LEASE_MS)
    else {
      room.players.delete(playerId)
      room.resumeLeases.delete(playerId)
    }
    if (room.presence.size === 0
      && room.resumeLeases.size === 0
      && room.world.state.sequence.phase === 'idle') this.rooms.delete(roomId)
    return true
  }

  async getSnapshot(roomId: string, now: number): Promise<RoomSnapshot> {
    const room = this.getOrCreateRoom(roomId, now)
    const expiredPlayerIds = this.cleanupRoom(room, now)
    return this.snapshot(roomId, room, expiredPlayerIds)
  }

  async mutateWorld(
    roomId: string,
    now: number,
    mutate: (current: WorldRecord) => WorldRecord,
  ): Promise<WorldRecord> {
    const room = this.getOrCreateRoom(roomId, now)
    const next = mutate(structuredClone(room.world))
    room.world = structuredClone(next)
    return structuredClone(next)
  }

  async getNucleusCombat(
    roomId: string,
    runId: ActivityRunId,
    now: number,
  ): Promise<NucleusCombatRecord> {
    const room = this.getOrCreateRoom(roomId, now)
    const record = room.nucleusCombat.get(runId) ?? createInitialNucleusCombat(runId, now)
    if (!room.nucleusCombat.has(runId)) room.nucleusCombat.set(runId, structuredClone(record))
    return structuredClone(record)
  }

  async mutateNucleusCombat(
    roomId: string,
    runId: ActivityRunId,
    now: number,
    mutate: (current: NucleusCombatRecord) => NucleusCombatRecord,
    authority?: CombatMutationAuthority,
  ): Promise<NucleusCombatRecord> {
    const room = this.getOrCreateRoom(roomId, now)
    if (authority) {
      const player = room.players.get(authority.id)
      if (!player
        || !room.presence.has(authority.id)
        || player.resumeToken !== authority.resumeToken
        || player.activityId !== authority.activityId
        || player.runId !== authority.runId) throw new ConnectionSupersededError()
    }
    const current = room.nucleusCombat.get(runId) ?? createInitialNucleusCombat(runId, now)
    const next = mutate(structuredClone(current))
    room.nucleusCombat.set(runId, structuredClone(next))
    return structuredClone(next)
  }

  async publish(envelope: RelayEnvelope): Promise<void> {
    for (const listener of this.listeners) queueMicrotask(() => listener(envelope))
  }

  subscribe(listener: (envelope: RelayEnvelope) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async close(): Promise<void> {
    this.listeners.clear()
    this.rooms.clear()
  }

  private getOrCreateRoom(roomId: string, now: number): MemoryRoom {
    const current = this.rooms.get(roomId)
    if (current) return current
    const room: MemoryRoom = {
      players: new Map(),
      presence: new Map(),
      resumeLeases: new Map(),
      world: createInitialWorld(now),
      nucleusCombat: new Map(),
    }
    this.rooms.set(roomId, room)
    return room
  }

  private cleanupRoom(room: MemoryRoom, now: number): readonly string[] {
    const cutoff = now - this.playerTimeoutMs
    const expiredPlayerIds: string[] = []
    for (const [playerId, leaseUntil] of room.resumeLeases) {
      if (leaseUntil >= now) continue
      room.resumeLeases.delete(playerId)
      if (!room.presence.has(playerId)) room.players.delete(playerId)
    }
    for (const [playerId, lastSeen] of room.presence) {
      if (lastSeen >= cutoff) continue
      room.presence.delete(playerId)
      room.players.delete(playerId)
      room.resumeLeases.delete(playerId)
      expiredPlayerIds.push(playerId)
    }
    return expiredPlayerIds
  }

  private snapshot(
    roomId: string,
    room: MemoryRoom,
    expiredPlayerIds: readonly string[] = [],
  ): RoomSnapshot {
    return {
      roomId,
      players: [...room.presence.keys()].flatMap((playerId) => {
        const player = room.players.get(playerId)
        return player ? [clonePlayer(player)] : []
      }),
      world: structuredClone(room.world),
      expiredPlayerIds: [...expiredPlayerIds],
    }
  }
}

function roomName(index: number): string {
  return `primeverse-${String(index).padStart(3, '0')}`
}

function clonePlayer(player: StoredPlayer): StoredPlayer {
  return structuredClone(player)
}
