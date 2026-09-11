import {
  MAX_SERVER_MESSAGE_BYTES,
  PRIME_SEQUENCE_CHOICES,
  isAvatarAppearance,
  isEmote,
  isPlayerAnimation,
  sanitizeNickname,
  parseServerMessage,
  nucleusCombatPhaseFor,
  isResumeToken,
  type PlayerSnapshot,
  type NucleusCombatPlayer,
  type PrimeSequenceChoice,
  type PrimeSequencePhase,
  type ServerMessage,
  type WorldState,
} from '../../src/features/primeverse/games/primeverse-online/shared/protocol.js'
import { createWorldState } from '../../src/features/primeverse/games/primeverse-online/shared/worldLogic.js'
import {
  isActivityId,
  isActivityRunPair,
  isPositionInActivity,
  type ActivityRunId,
} from '../../src/features/primeverse/games/primeverse-online/shared/activities.js'

export interface StoredPlayer extends PlayerSnapshot {
  readonly joinedAt: number
  /** Secret connection generation token; never included in PlayerSnapshot. */
  readonly resumeToken: string
  /** Server-only jump clock retained across a resumable transport drop. */
  readonly nucleusAirborneSince?: number | null
}

export interface WorldRecord {
  readonly revision: number
  readonly state: WorldState
}

export interface StoredNucleusCombatPlayer extends NucleusCombatPlayer {
  readonly spawnPosition: NucleusCombatPlayer['position']
  readonly hitRadius: number
  /** Player movement sequence that supplied the stored combat pose. */
  readonly poseSequence: number
  /** Every arena exit has a short, durable re-entry penalty. */
  readonly rejoinLockedUntil: number
  readonly lastSeenAt: number
}

export interface NucleusCombatRecord {
  readonly runId: ActivityRunId
  readonly revision: number
  readonly players: readonly StoredNucleusCombatPlayer[]
  /** Bounded idempotency window shared by every runtime serving the room. */
  readonly recentCastIds: readonly string[]
  readonly updatedAt: number
}

export interface RoomSnapshot {
  readonly roomId: string
  readonly players: StoredPlayer[]
  readonly world: WorldRecord
  /** Presence entries removed by this read/join so the server can announce them. */
  readonly expiredPlayerIds: readonly string[]
}

export interface RelayEnvelope {
  readonly instanceId: string
  readonly roomId: string
  readonly sentAt: number
  readonly packet: ServerMessage
}

export function createInitialWorld(now = Date.now()): WorldRecord {
  return { revision: 0, state: createWorldState(now) }
}

export function createInitialNucleusCombat(runId: ActivityRunId, now = Date.now()): NucleusCombatRecord {
  if (!isActivityRunPair('nucleus-257', runId)) throw new TypeError('Invalid Nucleus run id.')
  return { runId, revision: 0, players: [], recentCastIds: [], updatedAt: now }
}

export function isNucleusCombatRecord(value: unknown): value is NucleusCombatRecord {
  if (!isRecord(value)
    || !isActivityRunPair('nucleus-257', value.runId)
    || !isNonNegativeSafeInteger(value.revision)
    || !isSafeTimestamp(value.updatedAt)
    || !Array.isArray(value.players)
    || value.players.length > 64
    || !Array.isArray(value.recentCastIds)
    || value.recentCastIds.length > 128
    || value.recentCastIds.some((castId) => (
      typeof castId !== 'string' || !/^[a-zA-Z0-9:_-]{1,193}$/.test(castId)
    ))) return false

  const phasePlayers: Array<Pick<NucleusCombatPlayer, 'connected' | 'team'>> = []
  for (const candidate of value.players) {
    if (isRecord(candidate)
      && candidate.connected === true
      && (candidate.team === 'cipher' || candidate.team === 'fracture')) {
      phasePlayers.push({ connected: true, team: candidate.team })
    }
  }
  const parsed = parseServerMessage({
    type: 'nucleus_state',
    runId: value.runId,
    revision: value.revision,
    serverTime: value.updatedAt,
    phase: nucleusCombatPhaseFor(phasePlayers),
    players: value.players.filter((candidate) => (
      isRecord(candidate) && candidate.connected === true
    )),
    objective: null,
  })
  if (!parsed.ok || parsed.value.type !== 'nucleus_state') return false

  const ids = new Set<string>()
  for (const candidate of value.players) {
    if (!isRecord(candidate)
      || typeof candidate.id !== 'string'
      || ids.has(candidate.id)
      || !isVector3(candidate.spawnPosition)
      || !isPositionInActivity('nucleus-257', candidate.spawnPosition)
      || !isFiniteNumber(candidate.hitRadius)
      || candidate.hitRadius <= 0
      || candidate.hitRadius > 2
      || !isNonNegativeSafeInteger(candidate.poseSequence)
      || !isSafeTimestamp(candidate.rejoinLockedUntil)
      || !isSafeTimestamp(candidate.lastSeenAt)) return false
    ids.add(candidate.id)
  }
  return new Set(value.recentCastIds).size === value.recentCastIds.length
}

export function isStoredPlayer(value: unknown): value is StoredPlayer {
  if (!isRecord(value) || !isRelayId(value.id)) return false
  const nickname = sanitizeNickname(value.nickname)
  if (!nickname.ok || nickname.value !== value.nickname) return false
  if (!isActivityId(value.activityId)
    || !isActivityRunPair(value.activityId, value.runId)
    || !isAvatarAppearance(value.appearance)
    || !isVector3(value.position)
    || !isPositionInActivity(value.activityId, value.position)) return false
  if (!isFiniteNumber(value.yaw)
    || value.yaw < -Math.PI
    || value.yaw > Math.PI
    || !isNonNegativeSafeInteger(value.sequence)) return false
  if (!isSafeTimestamp(value.joinedAt)
    || !isSafeTimestamp(value.updatedAt)
    || !isResumeToken(value.resumeToken)) return false
  if (value.nucleusAirborneSince !== undefined
    && value.nucleusAirborneSince !== null
    && !isSafeTimestamp(value.nucleusAirborneSince)) return false
  if (value.emote !== null && !isActiveEmote(value.emote)) return false
  return isPlayerAnimation(value.animation)
}

export function isWorldRecord(value: unknown): value is WorldRecord {
  return isRecord(value)
    && isNonNegativeSafeInteger(value.revision)
    && isWorldState(value.state)
}

export function isRelayEnvelope(value: unknown): value is RelayEnvelope {
  return parseRelayEnvelope(value) !== null
}

/** Parse and rebuild Pub/Sub input before it reaches local sockets. */
export function parseRelayEnvelope(raw: unknown): RelayEnvelope | null {
  let value = raw
  if (typeof raw === 'string') {
    if (new TextEncoder().encode(raw).byteLength > MAX_SERVER_MESSAGE_BYTES + 2_048) return null
    try {
      value = JSON.parse(raw) as unknown
    } catch {
      return null
    }
  }
  if (!isRecord(value)
    || !isRelayId(value.instanceId)
    || !isRoomId(value.roomId)
    || !Number.isSafeInteger(value.sentAt)
    || (value.sentAt as number) < 0) return null
  const packet = parseServerMessage(value.packet)
  if (!packet.ok) return null
  return {
    instanceId: value.instanceId,
    roomId: value.roomId,
    sentAt: value.sentAt as number,
    packet: packet.value,
  }
}

function isWorldState(value: unknown): value is WorldState {
  if (!isRecord(value) || !isFiniteNumber(value.serverTime)) return false
  if (!isRecord(value.core) || !isRecord(value.sequence)) return false
  if (!Number.isSafeInteger(value.core.nearbyPlayers)
    || !isFiniteNumber(value.core.intensity)
    || !isFiniteNumber(value.core.ringSpeed)) return false
  if (value.core.energyLevel !== 'dormant'
    && value.core.energyLevel !== 'awakened'
    && value.core.energyLevel !== 'resonant'
    && value.core.energyLevel !== 'accelerated'
    && value.core.energyLevel !== 'overcharged') return false
  const sequence = value.sequence
  if (!Number.isSafeInteger(sequence.round) || !isPrimeSequencePhase(sequence.phase)) return false
  if (!nullableNumber(sequence.startedAt) || !nullableNumber(sequence.phaseEndsAt)) return false
  if (!isRecord(sequence.votesByPlayer) || !isRecord(sequence.voteCounts)) return false
  if (!Number.isSafeInteger(sequence.totalVotes)) return false
  if (!nullableChoice(sequence.winningChoice) || !nullableChoice(sequence.revealedAnswer)) return false
  if (sequence.success !== null && typeof sequence.success !== 'boolean') return false
  for (const valueChoice of Object.values(sequence.votesByPlayer)) {
    if (!isChoice(valueChoice)) return false
  }
  for (const choice of PRIME_SEQUENCE_CHOICES) {
    if (!Number.isSafeInteger(sequence.voteCounts[String(choice)])) return false
  }
  return true
}

function isRelayId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,128}$/.test(value)
}

function isRoomId(value: unknown): value is string {
  return typeof value === 'string' && /^primeverse-\d{3}$/.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isSafeTimestamp(value: unknown): value is number {
  return isNonNegativeSafeInteger(value) && (value as number) <= Number.MAX_SAFE_INTEGER
}

function nullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value)
}

function includes<const Values extends readonly unknown[]>(values: Values, value: unknown): value is Values[number] {
  return values.includes(value)
}

function isChoice(value: unknown): value is PrimeSequenceChoice {
  return includes(PRIME_SEQUENCE_CHOICES, value)
}

function nullableChoice(value: unknown): value is PrimeSequenceChoice | null {
  return value === null || isChoice(value)
}

function isPrimeSequencePhase(value: unknown): value is PrimeSequencePhase {
  return value === 'idle' || value === 'voting' || value === 'revealed' || value === 'cooldown'
}

function isVector3(value: unknown): value is { readonly x: number; readonly y: number; readonly z: number } {
  return isRecord(value)
    && isFiniteNumber(value.x)
    && isFiniteNumber(value.y)
    && isFiniteNumber(value.z)
}

function isActiveEmote(value: unknown): boolean {
  return isRecord(value) && isEmote(value.kind) && isSafeTimestamp(value.startedAt)
}
