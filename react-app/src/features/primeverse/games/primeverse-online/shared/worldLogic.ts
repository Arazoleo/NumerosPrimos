import {
  PRIME_SEQUENCE_ANSWER,
  PRIME_SEQUENCE_CHOICES,
  ROOM_CAPACITY,
  type PlayerSnapshot,
  type PrimeCoreEnergyLevel,
  type PrimeCoreState,
  type PrimeSequenceChoice,
  type PrimeSequenceState,
  type PrimeSequenceVoteCounts,
  type PrimeSequenceVotes,
  type Vec3,
  type WorldEvent,
  type WorldState,
} from './protocol'

export const PRIME_CORE_POSITION: Vec3 = Object.freeze({ x: 0, y: 2.5, z: 0 })
export const PRIME_CORE_PROXIMITY_RADIUS = 11
export const PRIME_SEQUENCE_VOTE_DURATION_MS = 8_000
export const PRIME_SEQUENCE_REVEAL_DURATION_MS = 5_000
export const PRIME_SEQUENCE_COOLDOWN_MS = 10_000

export const EMPTY_VOTE_COUNTS: PrimeSequenceVoteCounts = Object.freeze({
  12: 0,
  13: 0,
  15: 0,
  17: 0,
})

export interface RoomSummary {
  readonly id: string
  readonly playerCount: number
}

export interface RoomRegistry {
  readonly rooms: Readonly<Record<string, readonly string[]>>
}

export interface RoomAssignment {
  readonly registry: RoomRegistry
  readonly roomId: string
  readonly joined: boolean
}

export interface RoomRemoval {
  readonly registry: RoomRegistry
  readonly roomId: string | null
  readonly removed: boolean
}

export interface SequenceTransition {
  readonly state: PrimeSequenceState
  readonly events: readonly WorldEvent[]
}

export type VoteRejectionReason = 'not_voting' | 'already_voted' | 'vote_closed'

export interface PrimeSequenceVoteResult extends SequenceTransition {
  readonly accepted: boolean
  readonly reason: VoteRejectionReason | null
}

function assertTimestamp(nowMs: number): void {
  if (!Number.isFinite(nowMs) || nowMs < 0 || nowMs > Number.MAX_SAFE_INTEGER) {
    throw new RangeError('nowMs must be a finite, non-negative safe timestamp.')
  }
}

function assertPlayerId(playerId: string): void {
  if (typeof playerId !== 'string' || playerId.length === 0) {
    throw new TypeError('playerId must be a non-empty string.')
  }
}

function cloneVotes(votes: PrimeSequenceVotes): Record<string, PrimeSequenceChoice> {
  return { ...votes }
}

function countVotes(votes: PrimeSequenceVotes): PrimeSequenceVoteCounts {
  const counts: Record<PrimeSequenceChoice, number> = { 12: 0, 13: 0, 15: 0, 17: 0 }
  for (const choice of Object.values(votes)) {
    if (PRIME_SEQUENCE_CHOICES.includes(choice)) counts[choice] += 1
  }
  return counts
}

function winningChoiceFor(
  counts: PrimeSequenceVoteCounts,
  totalVotes: number,
): PrimeSequenceChoice | null {
  if (totalVotes === 0) return null

  let winner: PrimeSequenceChoice = PRIME_SEQUENCE_CHOICES[0]
  for (const choice of PRIME_SEQUENCE_CHOICES.slice(1)) {
    if (counts[choice] > counts[winner]) winner = choice
  }
  return winner
}

export function createPrimeSequenceState(round = 0): PrimeSequenceState {
  if (!Number.isSafeInteger(round) || round < 0) {
    throw new RangeError('round must be a non-negative safe integer.')
  }
  return {
    round,
    phase: 'idle',
    startedAt: null,
    phaseEndsAt: null,
    votesByPlayer: {},
    voteCounts: { ...EMPTY_VOTE_COUNTS },
    totalVotes: 0,
    winningChoice: null,
    revealedAnswer: null,
    success: null,
  }
}

export function startPrimeSequence(
  state: PrimeSequenceState,
  nowMs: number,
): SequenceTransition {
  assertTimestamp(nowMs)
  if (state.phase !== 'idle') return { state, events: [] }

  const phaseEndsAt = nowMs + PRIME_SEQUENCE_VOTE_DURATION_MS
  const next: PrimeSequenceState = {
    ...createPrimeSequenceState(state.round + 1),
    phase: 'voting',
    startedAt: nowMs,
    phaseEndsAt,
  }
  return {
    state: next,
    events: [{ kind: 'sequence_started', round: next.round, phaseEndsAt, at: nowMs }],
  }
}

/**
 * Register one physical-pedestal vote per player. Calling this repeatedly with
 * the same player is idempotent and never mutates the tally a second time.
 * An idle sequence begins automatically on the first valid vote.
 */
export function castPrimeSequenceVote(
  currentState: PrimeSequenceState,
  playerId: string,
  choice: PrimeSequenceChoice,
  nowMs: number,
): PrimeSequenceVoteResult {
  assertTimestamp(nowMs)
  assertPlayerId(playerId)
  if (!PRIME_SEQUENCE_CHOICES.includes(choice)) {
    throw new RangeError('choice must be a Prime Sequence pedestal value.')
  }

  let state = currentState
  let events: readonly WorldEvent[] = []
  if (state.phase === 'idle') {
    const started = startPrimeSequence(state, nowMs)
    state = started.state
    events = started.events
  }

  if (state.phase !== 'voting') {
    return { state, events, accepted: false, reason: 'not_voting' }
  }
  if (state.phaseEndsAt !== null && nowMs >= state.phaseEndsAt) {
    return { state, events, accepted: false, reason: 'vote_closed' }
  }
  if (Object.prototype.hasOwnProperty.call(state.votesByPlayer, playerId)) {
    return { state, events, accepted: false, reason: 'already_voted' }
  }

  const votesByPlayer = cloneVotes(state.votesByPlayer)
  votesByPlayer[playerId] = choice
  const voteCounts = countVotes(votesByPlayer)
  const totalVotes = Object.keys(votesByPlayer).length
  const next: PrimeSequenceState = {
    ...state,
    votesByPlayer,
    voteCounts,
    totalVotes,
  }
  const voteEvent: WorldEvent = {
    kind: 'sequence_vote',
    round: next.round,
    playerId,
    choice,
    voteCounts,
    at: nowMs,
  }
  return { state: next, events: [...events, voteEvent], accepted: true, reason: null }
}

/** Remove a disconnected player's still-pending vote, preventing ghost votes. */
export function removePrimeSequenceVoter(
  state: PrimeSequenceState,
  playerId: string,
): PrimeSequenceState {
  assertPlayerId(playerId)
  if (state.phase !== 'voting'
    || !Object.prototype.hasOwnProperty.call(state.votesByPlayer, playerId)) {
    return state
  }

  const votesByPlayer = cloneVotes(state.votesByPlayer)
  delete votesByPlayer[playerId]
  return {
    ...state,
    votesByPlayer,
    voteCounts: countVotes(votesByPlayer),
    totalVotes: Object.keys(votesByPlayer).length,
  }
}

/** Advance at most one phase; callers can broadcast every returned event. */
export function advancePrimeSequence(
  state: PrimeSequenceState,
  nowMs: number,
): SequenceTransition {
  assertTimestamp(nowMs)
  if (state.phaseEndsAt === null || nowMs < state.phaseEndsAt) {
    return { state, events: [] }
  }

  if (state.phase === 'voting') {
    const winningChoice = winningChoiceFor(state.voteCounts, state.totalVotes)
    const success = state.voteCounts[PRIME_SEQUENCE_ANSWER] > state.totalVotes / 2
    const next: PrimeSequenceState = {
      ...state,
      phase: 'revealed',
      phaseEndsAt: nowMs + PRIME_SEQUENCE_REVEAL_DURATION_MS,
      winningChoice,
      revealedAnswer: PRIME_SEQUENCE_ANSWER,
      success,
    }
    return {
      state: next,
      events: [{
        kind: 'sequence_revealed',
        round: state.round,
        answer: PRIME_SEQUENCE_ANSWER,
        winningChoice,
        success,
        effect: success ? 'prime-wave' : null,
        at: nowMs,
      }],
    }
  }

  if (state.phase === 'revealed') {
    const phaseEndsAt = nowMs + PRIME_SEQUENCE_COOLDOWN_MS
    return {
      state: { ...state, phase: 'cooldown', phaseEndsAt },
      events: [{
        kind: 'sequence_cooldown',
        round: state.round,
        phaseEndsAt,
        at: nowMs,
      }],
    }
  }

  if (state.phase === 'cooldown') {
    return {
      state: createPrimeSequenceState(state.round),
      events: [{ kind: 'sequence_reset', round: state.round, at: nowMs }],
    }
  }

  return { state, events: [] }
}

function coreBand(nearbyPlayers: number): {
  readonly energyLevel: PrimeCoreEnergyLevel
  readonly intensity: number
  readonly ringSpeed: number
} {
  if (nearbyPlayers <= 0) {
    return { energyLevel: 'dormant', intensity: 0.2, ringSpeed: 0.65 }
  }
  if (nearbyPlayers === 1) {
    return { energyLevel: 'awakened', intensity: 0.4, ringSpeed: 0.9 }
  }
  if (nearbyPlayers === 2) {
    return { energyLevel: 'resonant', intensity: 0.58, ringSpeed: 1.25 }
  }
  if (nearbyPlayers < 5) {
    return { energyLevel: 'accelerated', intensity: 0.78, ringSpeed: 1.75 }
  }
  return { energyLevel: 'overcharged', intensity: 1, ringSpeed: 2.4 }
}

export function calculatePrimeCoreState(
  players: readonly Pick<PlayerSnapshot, 'id' | 'position'>[],
  corePosition: Vec3 = PRIME_CORE_POSITION,
  radius = PRIME_CORE_PROXIMITY_RADIUS,
): PrimeCoreState {
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new RangeError('Prime Core radius must be positive and finite.')
  }

  const nearbyIds = new Set<string>()
  const radiusSquared = radius * radius
  for (const player of players) {
    const dx = player.position.x - corePosition.x
    const dy = player.position.y - corePosition.y
    const dz = player.position.z - corePosition.z
    if (dx * dx + dy * dy + dz * dz <= radiusSquared) nearbyIds.add(player.id)
  }

  const nearbyPlayers = nearbyIds.size
  return { nearbyPlayers, ...coreBand(nearbyPlayers) }
}

export function createWorldState(nowMs = 0): WorldState {
  assertTimestamp(nowMs)
  return {
    serverTime: nowMs,
    core: { nearbyPlayers: 0, ...coreBand(0) },
    sequence: createPrimeSequenceState(),
  }
}

export function updateWorldCore(
  world: WorldState,
  players: readonly Pick<PlayerSnapshot, 'id' | 'position'>[],
  nowMs: number,
): { readonly state: WorldState; readonly event: WorldEvent | null } {
  assertTimestamp(nowMs)
  const core = calculatePrimeCoreState(players)
  const changed = core.energyLevel !== world.core.energyLevel
    || core.nearbyPlayers !== world.core.nearbyPlayers
  return {
    state: { ...world, serverTime: nowMs, core },
    event: changed ? { kind: 'core_energy_changed', core, at: nowMs } : null,
  }
}

export function createRoomRegistry(): RoomRegistry {
  return { rooms: {} }
}

function roomOrdinal(roomId: string, prefix: string): number | null {
  const match = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`).exec(roomId)
  if (!match) return null
  const ordinal = Number(match[1])
  return Number.isSafeInteger(ordinal) && ordinal > 0 ? ordinal : null
}

/** Pick the lowest numbered non-full room, or the lowest unused room number. */
export function selectRoom(
  rooms: readonly RoomSummary[],
  prefix = 'primeverse',
  capacity = ROOM_CAPACITY,
): string {
  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new RangeError('Room capacity must be a positive safe integer.')
  }

  const compatible = rooms
    .map((room) => ({ ...room, ordinal: roomOrdinal(room.id, prefix) }))
    .filter((room): room is RoomSummary & { readonly ordinal: number } => room.ordinal !== null)
  for (const room of compatible) {
    if (!Number.isSafeInteger(room.playerCount) || room.playerCount < 0) {
      throw new RangeError('Room player counts must be non-negative safe integers.')
    }
  }
  compatible.sort((a, b) => a.ordinal - b.ordinal || a.id.localeCompare(b.id))

  const available = compatible.find((room) => room.playerCount < capacity)
  if (available) return available.id

  const used = new Set(compatible.map((room) => room.ordinal))
  let ordinal = 1
  while (used.has(ordinal)) ordinal += 1
  return `${prefix}-${ordinal}`
}

export function roomSummaries(registry: RoomRegistry): readonly RoomSummary[] {
  return Object.entries(registry.rooms).map(([id, playerIds]) => ({
    id,
    playerCount: playerIds.length,
  }))
}

export function assignPlayerToRoom(
  registry: RoomRegistry,
  playerId: string,
  prefix = 'primeverse',
  capacity = ROOM_CAPACITY,
): RoomAssignment {
  assertPlayerId(playerId)
  for (const [roomId, playerIds] of Object.entries(registry.rooms)) {
    if (playerIds.includes(playerId)) return { registry, roomId, joined: false }
  }

  const roomId = selectRoom(roomSummaries(registry), prefix, capacity)
  const currentPlayers = registry.rooms[roomId] ?? []
  if (currentPlayers.length >= capacity) {
    throw new RangeError(`Room ${roomId} has reached capacity.`)
  }
  return {
    roomId,
    joined: true,
    registry: {
      rooms: { ...registry.rooms, [roomId]: [...currentPlayers, playerId] },
    },
  }
}

/** Remove a player and discard the empty room, which also cleans ghost presence. */
export function removePlayerFromRooms(
  registry: RoomRegistry,
  playerId: string,
): RoomRemoval {
  assertPlayerId(playerId)
  for (const [roomId, playerIds] of Object.entries(registry.rooms)) {
    if (!playerIds.includes(playerId)) continue

    const remaining = playerIds.filter((id) => id !== playerId)
    const rooms: Record<string, readonly string[]> = { ...registry.rooms }
    if (remaining.length === 0) delete rooms[roomId]
    else rooms[roomId] = remaining
    return { registry: { rooms }, roomId, removed: true }
  }
  return { registry, roomId: null, removed: false }
}
