import { randomUUID } from 'node:crypto'
import { Redis } from 'ioredis'
import {
  RESUME_LEASE_MS,
  type ActivityRunId,
} from '../../src/features/primeverse/games/primeverse-online/shared/index.js'
import {
  createInitialNucleusCombat,
  createInitialWorld,
  isNucleusCombatRecord,
  isStoredPlayer,
  isWorldRecord,
  parseRelayEnvelope,
  type RelayEnvelope,
  type NucleusCombatRecord,
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

const JOIN_ROOM_SCRIPT = `
local stale = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
if #stale > 0 then
  redis.call('ZREM', KEYS[1], unpack(stale))
  redis.call('HDEL', KEYS[2], unpack(stale))
end
local exists = redis.call('ZSCORE', KEYS[1], ARGV[2])
if not exists and redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then
  local rejected = {0}
  for _, playerId in ipairs(stale) do table.insert(rejected, playerId) end
  return rejected
end
redis.call('ZADD', KEYS[1], ARGV[4], ARGV[2])
redis.call('HSET', KEYS[2], ARGV[2], ARGV[5])
redis.call('EXPIRE', KEYS[1], ARGV[6])
redis.call('EXPIRE', KEYS[2], ARGV[6])
local joined = {1}
for _, playerId in ipairs(stale) do table.insert(joined, playerId) end
return joined
`

const RELEASE_LOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`

const SET_NUCLEUS_IF_AUTHORIZED_SCRIPT = `
if redis.call('GET', KEYS[4]) ~= ARGV[7] then return -1 end
local active = redis.call('ZSCORE', KEYS[1], ARGV[1])
if not active then return 0 end
local raw = redis.call('HGET', KEYS[2], ARGV[1])
if not raw then return 0 end
local ok, stored = pcall(cjson.decode, raw)
if not ok
  or stored.resumeToken ~= ARGV[2]
  or stored.activityId ~= ARGV[3]
  or stored.runId ~= ARGV[4] then return 0 end
redis.call('SET', KEYS[3], ARGV[5], 'EX', ARGV[6])
return 1
`

const SET_NUCLEUS_IF_LOCK_OWNER_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
return 1
`

const UPDATE_PLAYER_SCRIPT = `
local active = redis.call('ZSCORE', KEYS[1], ARGV[1])
if not active then return 0 end
local raw = redis.call('HGET', KEYS[2], ARGV[1])
if not raw then return 0 end
local ok, stored = pcall(cjson.decode, raw)
if not ok or stored.resumeToken ~= ARGV[2] then return 0 end
redis.call('ZADD', KEYS[1], ARGV[3], ARGV[1])
redis.call('HSET', KEYS[2], ARGV[1], ARGV[4])
redis.call('EXPIRE', KEYS[1], ARGV[5])
redis.call('EXPIRE', KEYS[2], ARGV[5])
return 1
`

const UPDATE_PLAYER_IF_CURRENT_SCRIPT = `
local active = redis.call('ZSCORE', KEYS[1], ARGV[1])
if not active then return 0 end
local raw = redis.call('HGET', KEYS[2], ARGV[1])
if not raw then return 0 end
local ok, stored = pcall(cjson.decode, raw)
local storedRunId = ''
if ok and stored.runId ~= cjson.null then storedRunId = stored.runId end
if not ok
  or stored.resumeToken ~= ARGV[2]
  or tonumber(stored.sequence) ~= tonumber(ARGV[3])
  or stored.activityId ~= ARGV[4]
  or storedRunId ~= ARGV[5] then return 0 end
redis.call('ZADD', KEYS[1], ARGV[6], ARGV[1])
redis.call('HSET', KEYS[2], ARGV[1], ARGV[7])
redis.call('EXPIRE', KEYS[1], ARGV[8])
redis.call('EXPIRE', KEYS[2], ARGV[8])
return 1
`

const RESUME_PLAYER_SCRIPT = `
local raw = redis.call('HGET', KEYS[2], ARGV[1])
if not raw then return 0 end
local ok, stored = pcall(cjson.decode, raw)
if not ok or stored.resumeToken ~= ARGV[2] then return 0 end
local active = redis.call('ZSCORE', KEYS[1], ARGV[1])
if not active then
  local leaseUntil = redis.call('ZSCORE', KEYS[3], ARGV[1])
  if not leaseUntil or tonumber(leaseUntil) < tonumber(ARGV[3]) then return 0 end
  if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[6]) then return -1 end
end
redis.call('ZADD', KEYS[1], ARGV[3], ARGV[1])
redis.call('HSET', KEYS[2], ARGV[1], ARGV[4])
redis.call('ZREM', KEYS[3], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[5])
redis.call('EXPIRE', KEYS[2], ARGV[5])
redis.call('EXPIRE', KEYS[3], ARGV[5])
return 1
`

const TOUCH_PLAYER_SCRIPT = `
local active = redis.call('ZSCORE', KEYS[1], ARGV[1])
if not active then return 0 end
local raw = redis.call('HGET', KEYS[2], ARGV[1])
if not raw then return 0 end
local ok, stored = pcall(cjson.decode, raw)
if not ok or stored.resumeToken ~= ARGV[2] then return 0 end
redis.call('ZADD', KEYS[1], ARGV[3], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[4])
redis.call('EXPIRE', KEYS[2], ARGV[4])
return 1
`

const LEAVE_PLAYER_SCRIPT = `
local raw = redis.call('HGET', KEYS[2], ARGV[1])
if not raw then return 0 end
local ok, stored = pcall(cjson.decode, raw)
if not ok or stored.resumeToken ~= ARGV[2] then return 0 end
redis.call('ZREM', KEYS[1], ARGV[1])
if ARGV[3] == '1' then
  redis.call('ZADD', KEYS[3], ARGV[4], ARGV[1])
  redis.call('EXPIRE', KEYS[3], ARGV[5])
else
  redis.call('ZREM', KEYS[3], ARGV[1])
  redis.call('HDEL', KEYS[2], ARGV[1])
end
return 1
`

const CLEANUP_STALE_PLAYERS_SCRIPT = `
local candidates = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
local removed = {}
for _, playerId in ipairs(candidates) do
  local score = redis.call('ZSCORE', KEYS[1], playerId)
  if score and tonumber(score) <= tonumber(ARGV[1]) then
    redis.call('ZREM', KEYS[1], playerId)
    redis.call('HDEL', KEYS[2], playerId)
    redis.call('ZREM', KEYS[3], playerId)
    table.insert(removed, playerId)
  end
end
return removed
`

const CLEANUP_EXPIRED_LEASES_SCRIPT = `
local candidates = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
for _, playerId in ipairs(candidates) do
  local leaseUntil = redis.call('ZSCORE', KEYS[1], playerId)
  local active = redis.call('ZSCORE', KEYS[2], playerId)
  if leaseUntil and tonumber(leaseUntil) <= tonumber(ARGV[1]) and not active then
    redis.call('ZREM', KEYS[1], playerId)
    redis.call('HDEL', KEYS[3], playerId)
  end
end
return #candidates
`

export interface RedisStoreOptions {
  url: string
  roomCapacity?: number
  maxRooms?: number
  playerTimeoutMs?: number
  keyPrefix?: string
}

/** Shared production store: durable snapshots plus Pub/Sub relay between Vercel instances. */
export class RedisPrimeverseStore implements PrimeverseStore {
  readonly mode = 'redis' as const
  private readonly command: Redis
  private readonly subscriber: Redis
  private readonly listeners = new Set<(envelope: RelayEnvelope) => void>()
  private readonly roomCapacity: number
  private readonly maxRooms: number
  private readonly playerTimeoutMs: number
  private readonly keyPrefix: string
  private startPromise: Promise<void> | null = null
  private subscribed = false

  constructor(options: RedisStoreOptions) {
    this.roomCapacity = options.roomCapacity ?? 20
    this.maxRooms = options.maxRooms ?? 100
    this.playerTimeoutMs = options.playerTimeoutMs ?? 45_000
    this.keyPrefix = normalizePrefix(options.keyPrefix ?? 'primeverse:v1')
    const redisOptions = {
      lazyConnect: true,
      enableReadyCheck: true,
      maxRetriesPerRequest: 2,
      connectTimeout: 5_000,
    } as const
    this.command = new Redis(options.url, {
      ...redisOptions,
      connectionName: 'primeverse-command',
    })
    this.subscriber = new Redis(options.url, {
      ...redisOptions,
      connectionName: 'primeverse-subscriber',
    })
    this.subscriber.on('pmessage', (_pattern: string, _channel: string, raw: string) => {
      const envelope = parseRelayEnvelope(raw)
      if (!envelope) return
      for (const listener of this.listeners) listener(envelope)
    })
  }

  async start(): Promise<void> {
    this.startPromise ??= this.connect().catch((error: unknown) => {
      this.startPromise = null
      throw error
    })
    await this.startPromise
  }

  async health(): Promise<StoreHealth> {
    try {
      // Health probes need one command connection, not the long-lived Pub/Sub
      // subscriber used by the WebSocket runtime.
      await connectRedis(this.command)
      const pong = await this.command.ping()
      return pong === 'PONG'
        ? { ok: true, mode: this.mode }
        : { ok: false, mode: this.mode, detail: `PING inesperado: ${pong}` }
    } catch (error) {
      return { ok: false, mode: this.mode, detail: errorMessage(error) }
    }
  }

  async join(player: StoredPlayer, now: number): Promise<RoomSnapshot> {
    await this.start()
    const cutoff = now - this.playerTimeoutMs
    const ttlSeconds = 86_400
    for (let index = 1; index <= this.maxRooms; index += 1) {
      const roomId = roomName(index)
      const keys = this.roomKeys(roomId)
      const result = await this.command.eval(
        JOIN_ROOM_SCRIPT,
        2,
        keys.presence,
        keys.players,
        String(cutoff),
        player.id,
        String(this.roomCapacity),
        String(now),
        JSON.stringify(player),
        String(ttlSeconds),
      )
      const response = Array.isArray(result) ? result : [result]
      if (Number(response[0]) !== 1) continue
      const expiredPlayerIds = response.slice(1).filter((value): value is string => typeof value === 'string')
      await this.command.pipeline()
        .set(keys.world, JSON.stringify(createInitialWorld(now)), 'EX', ttlSeconds, 'NX')
        .set(this.resumeKey(player.resumeToken), resumeMapping(roomId, player.id), 'EX', ttlSeconds)
        .exec()
      const snapshot = await this.getSnapshot(roomId, now)
      return {
        ...snapshot,
        expiredPlayerIds: [...new Set([...expiredPlayerIds, ...snapshot.expiredPlayerIds])],
      }
    }
    throw new RoomCapacityError()
  }

  async resume(
    player: StoredPlayer,
    previousResumeToken: string,
    now: number,
  ): Promise<RoomSnapshot | null> {
    await this.start()
    const rawMapping = await this.command.get(this.resumeKey(previousResumeToken))
    const mapping = parseResumeMapping(rawMapping)
    if (!mapping) return null
    const keys = this.roomKeys(mapping.roomId)
    const rawPrevious = await this.command.hget(keys.players, mapping.playerId)
    const previous = rawPrevious === null ? null : safeJson(rawPrevious)
    if (!isStoredPlayer(previous) || previous.resumeToken !== previousResumeToken) {
      await this.command.del(this.resumeKey(previousResumeToken))
      return null
    }
    const resumed: StoredPlayer = {
      ...previous,
      nickname: player.nickname,
      appearance: { ...player.appearance },
      emote: null,
      resumeToken: player.resumeToken,
      updatedAt: now,
    }
    const ttlSeconds = 86_400
    const resumedResult = await this.command.eval(
      RESUME_PLAYER_SCRIPT,
      3,
      keys.presence,
      keys.players,
      keys.resumeLeases,
      mapping.playerId,
      previousResumeToken,
      String(now),
      JSON.stringify(resumed),
      String(ttlSeconds),
      String(this.roomCapacity),
    )
    if (Number(resumedResult) !== 1) return null
    await this.command.pipeline()
      .del(this.resumeKey(previousResumeToken))
      .set(
        this.resumeKey(player.resumeToken),
        resumeMapping(mapping.roomId, mapping.playerId),
        'EX',
        ttlSeconds,
      )
      .exec()
    return this.getSnapshot(mapping.roomId, now)
  }

  async updatePlayer(roomId: string, player: StoredPlayer, now: number): Promise<boolean> {
    await this.start()
    const keys = this.roomKeys(roomId)
    const ttlSeconds = Math.max(120, Math.ceil(this.playerTimeoutMs / 1_000) * 4)
    const updated = await this.command.eval(
      UPDATE_PLAYER_SCRIPT,
      2,
      keys.presence,
      keys.players,
      player.id,
      player.resumeToken,
      String(now),
      JSON.stringify(player),
      String(ttlSeconds),
    )
    return Number(updated) === 1
  }

  async updatePlayerIfCurrent(
    roomId: string,
    expected: Pick<StoredPlayer, 'id' | 'resumeToken' | 'sequence' | 'activityId' | 'runId'>,
    player: StoredPlayer,
    now: number,
  ): Promise<boolean> {
    await this.start()
    const keys = this.roomKeys(roomId)
    const ttlSeconds = Math.max(120, Math.ceil(this.playerTimeoutMs / 1_000) * 4)
    const updated = await this.command.eval(
      UPDATE_PLAYER_IF_CURRENT_SCRIPT,
      2,
      keys.presence,
      keys.players,
      expected.id,
      expected.resumeToken,
      String(expected.sequence),
      expected.activityId,
      expected.runId ?? '',
      String(now),
      JSON.stringify(player),
      String(ttlSeconds),
    )
    return Number(updated) === 1
  }

  async touch(roomId: string, playerId: string, resumeToken: string, now: number): Promise<boolean> {
    await this.start()
    const keys = this.roomKeys(roomId)
    const ttlSeconds = Math.max(120, Math.ceil(this.playerTimeoutMs / 1_000) * 4)
    const touched = await this.command.eval(
      TOUCH_PLAYER_SCRIPT,
      2,
      keys.presence,
      keys.players,
      playerId,
      resumeToken,
      String(now),
      String(ttlSeconds),
    )
    if (Number(touched) === 1) await this.command.expire(keys.world, 86_400)
    if (Number(touched) === 1) await this.command.expire(keys.nucleusCombat, 86_400)
    return Number(touched) === 1
  }

  async leave(
    roomId: string,
    playerId: string,
    resumeToken: string,
    now: number,
    retainResumeLease: boolean,
  ): Promise<boolean> {
    await this.start()
    const keys = this.roomKeys(roomId)
    const removed = await this.command.eval(
      LEAVE_PLAYER_SCRIPT,
      3,
      keys.presence,
      keys.players,
      keys.resumeLeases,
      playerId,
      resumeToken,
      retainResumeLease ? '1' : '0',
      String(now + RESUME_LEASE_MS),
      String(Math.ceil((RESUME_LEASE_MS * 4) / 1_000)),
    )
    if (Number(removed) !== 1) return false
    if (retainResumeLease) {
      await this.command.expire(this.resumeKey(resumeToken), Math.ceil(RESUME_LEASE_MS / 1_000))
    } else {
      await this.command.del(this.resumeKey(resumeToken))
    }
    return true
  }

  async getSnapshot(roomId: string, now: number): Promise<RoomSnapshot> {
    await this.start()
    const keys = this.roomKeys(roomId)
    await this.removeExpiredResumeLeases(keys, now)
    const expiredPlayerIds = await this.removeStalePlayers(keys, now)
    const [activeIds, rawPlayers, rawWorld] = await Promise.all([
      this.command.zrange(keys.presence, '0', '-1'),
      this.command.hgetall(keys.players),
      this.command.get(keys.world),
    ])
    const active = new Set(activeIds)
    const invalidPlayerIds: string[] = []
    const players = Object.entries(rawPlayers).flatMap(([id, raw]) => {
      if (!active.has(id)) return []
      const parsed = safeJson(raw)
      if (isStoredPlayer(parsed)) return [parsed]
      invalidPlayerIds.push(id)
      return []
    })
    if (invalidPlayerIds.length > 0) {
      await this.command.pipeline()
        .zrem(keys.presence, ...invalidPlayerIds)
        .hdel(keys.players, ...invalidPlayerIds)
        .exec()
    }
    const parsedWorld = rawWorld === null ? null : safeJson(rawWorld)
    const world = isWorldRecord(parsedWorld) ? parsedWorld : createInitialWorld(now)
    if (!isWorldRecord(parsedWorld)) await this.command.set(keys.world, JSON.stringify(world))
    return {
      roomId,
      players,
      world,
      expiredPlayerIds: [...new Set([...expiredPlayerIds, ...invalidPlayerIds])],
    }
  }

  async mutateWorld(
    roomId: string,
    now: number,
    mutate: (current: WorldRecord) => WorldRecord,
  ): Promise<WorldRecord> {
    await this.start()
    const keys = this.roomKeys(roomId)
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const token = randomUUID()
      const acquired = await this.command.set(keys.lock, token, 'PX', 1_500, 'NX')
      if (acquired !== 'OK') {
        await shortDelay(8 + attempt * 7)
        continue
      }
      try {
        const raw = await this.command.get(keys.world)
        const parsed = raw === null ? null : safeJson(raw)
        const current = isWorldRecord(parsed) ? parsed : createInitialWorld(now)
        const next = mutate(structuredClone(current))
        await this.command.set(keys.world, JSON.stringify(next), 'EX', 86_400)
        return next
      } finally {
        await this.command.eval(RELEASE_LOCK_SCRIPT, 1, keys.lock, token)
      }
    }
    throw new Error('Não foi possível obter o lock do estado da sala.')
  }

  async getNucleusCombat(
    roomId: string,
    runId: ActivityRunId,
    now: number,
  ): Promise<NucleusCombatRecord> {
    await this.start()
    const keys = this.roomKeys(roomId)
    const raw = await this.command.get(keys.nucleusCombat)
    const parsed = raw === null ? null : safeJson(raw)
    if (isNucleusCombatRecord(parsed) && parsed.runId === runId) {
      return structuredClone(parsed)
    }
    const initial = createInitialNucleusCombat(runId, now)
    if (raw === null) {
      const initialized = await this.command.set(
        keys.nucleusCombat,
        JSON.stringify(initial),
        'EX',
        86_400,
        'NX',
      )
      if (initialized === 'OK') return structuredClone(initial)
      const winnerRaw = await this.command.get(keys.nucleusCombat)
      const winner = winnerRaw === null ? null : safeJson(winnerRaw)
      if (isNucleusCombatRecord(winner) && winner.runId === runId) {
        return structuredClone(winner)
      }
    }
    // Corrupt/legacy data is repaired through the same fenced mutation path;
    // an unlocked read can never overwrite a concurrent join with revision 0.
    return this.mutateNucleusCombat(roomId, runId, now, (current) => current)
  }

  async mutateNucleusCombat(
    roomId: string,
    runId: ActivityRunId,
    now: number,
    mutate: (current: NucleusCombatRecord) => NucleusCombatRecord,
    authority?: CombatMutationAuthority,
  ): Promise<NucleusCombatRecord> {
    await this.start()
    const keys = this.roomKeys(roomId)
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const token = randomUUID()
      const acquired = await this.command.set(keys.nucleusLock, token, 'PX', 3_000, 'NX')
      if (acquired !== 'OK') {
        await shortDelay(8 + attempt * 7)
        continue
      }
      try {
        const raw = await this.command.get(keys.nucleusCombat)
        const parsed = raw === null ? null : safeJson(raw)
        const current = isNucleusCombatRecord(parsed) && parsed.runId === runId
          ? parsed
          : createInitialNucleusCombat(runId, now)
        const next = mutate(structuredClone(current))
        if (!isNucleusCombatRecord(next) || next.runId !== runId) {
          throw new TypeError('Nucleus combat mutation returned an invalid record.')
        }
        if (authority) {
          const committed = await this.command.eval(
            SET_NUCLEUS_IF_AUTHORIZED_SCRIPT,
            4,
            keys.presence,
            keys.players,
            keys.nucleusCombat,
            keys.nucleusLock,
            authority.id,
            authority.resumeToken,
            authority.activityId,
            authority.runId ?? '',
            JSON.stringify(next),
            '86400',
            token,
          )
          if (Number(committed) < 0) continue
          if (Number(committed) !== 1) throw new ConnectionSupersededError()
        } else {
          const committed = await this.command.eval(
            SET_NUCLEUS_IF_LOCK_OWNER_SCRIPT,
            2,
            keys.nucleusLock,
            keys.nucleusCombat,
            token,
            JSON.stringify(next),
            '86400',
          )
          if (Number(committed) !== 1) continue
        }
        return structuredClone(next)
      } finally {
        await this.command.eval(RELEASE_LOCK_SCRIPT, 1, keys.nucleusLock, token)
      }
    }
    throw new Error('Não foi possível obter o lock do combate Núcleo 257.')
  }

  async publish(envelope: RelayEnvelope): Promise<void> {
    await this.start()
    await this.command.publish(this.roomChannel(envelope.roomId), JSON.stringify(envelope))
  }

  subscribe(listener: (envelope: RelayEnvelope) => void): () => void {
    this.listeners.add(listener)
    void this.start().catch(() => undefined)
    return () => this.listeners.delete(listener)
  }

  async close(): Promise<void> {
    this.listeners.clear()
    await Promise.allSettled([this.command.quit(), this.subscriber.quit()])
  }

  private async connect(): Promise<void> {
    await Promise.all([connectRedis(this.command), connectRedis(this.subscriber)])
    if (!this.subscribed) {
      await this.subscriber.psubscribe(`${this.keyPrefix}:room:*:events`)
      this.subscribed = true
    }
  }

  private async removeStalePlayers(keys: RoomKeys, now: number): Promise<readonly string[]> {
    const cutoff = now - this.playerTimeoutMs
    const removed = await this.command.eval(
      CLEANUP_STALE_PLAYERS_SCRIPT,
      3,
      keys.presence,
      keys.players,
      keys.resumeLeases,
      String(cutoff),
    )
    return Array.isArray(removed)
      ? removed.filter((value): value is string => typeof value === 'string')
      : []
  }

  private roomKeys(roomId: string): RoomKeys {
    const namespace = `${this.keyPrefix}:{${roomId}}`
    return {
      presence: `${namespace}:presence`,
      players: `${namespace}:players`,
      resumeLeases: `${namespace}:resume-leases`,
      world: `${namespace}:world`,
      lock: `${namespace}:world-lock`,
      nucleusCombat: `${namespace}:nucleus-combat`,
      nucleusLock: `${namespace}:nucleus-combat-lock`,
    }
  }

  private roomChannel(roomId: string): string {
    return `${this.keyPrefix}:room:${roomId}:events`
  }

  private resumeKey(resumeToken: string): string {
    return `${this.keyPrefix}:resume:${resumeToken}`
  }

  private async removeExpiredResumeLeases(keys: RoomKeys, now: number): Promise<void> {
    await this.command.eval(
      CLEANUP_EXPIRED_LEASES_SCRIPT,
      3,
      keys.resumeLeases,
      keys.presence,
      keys.players,
      String(now),
    )
  }
}

interface RoomKeys {
  presence: string
  players: string
  resumeLeases: string
  world: string
  lock: string
  nucleusCombat: string
  nucleusLock: string
}

function roomName(index: number): string {
  return `primeverse-${String(index).padStart(3, '0')}`
}

function resumeMapping(roomId: string, playerId: string): string {
  return `${roomId}:${playerId}`
}

function parseResumeMapping(raw: string | null): { roomId: string; playerId: string } | null {
  if (raw === null) return null
  const separator = raw.indexOf(':')
  const roomId = raw.slice(0, separator)
  const playerId = raw.slice(separator + 1)
  if (!/^primeverse-\d{3}$/.test(roomId) || !/^[a-zA-Z0-9_-]{1,128}$/.test(playerId)) return null
  return { roomId, playerId }
}

async function connectRedis(client: Redis): Promise<void> {
  if (client.status === 'ready') return
  if (client.status === 'wait') {
    await client.connect()
    return
  }
  await new Promise<void>((resolve, reject) => {
    const ready = () => {
      cleanup()
      resolve()
    }
    const error = (cause: Error) => {
      cleanup()
      reject(cause)
    }
    const cleanup = () => {
      client.off('ready', ready)
      client.off('error', error)
    }
    client.once('ready', ready)
    client.once('error', error)
  })
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function normalizePrefix(prefix: string): string {
  const normalized = prefix.trim().replace(/[^a-zA-Z0-9:_-]/g, '')
  return normalized || 'primeverse:v1'
}

function shortDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha desconhecida no Redis.'
}
