import {
  RESPAWN_DELAY_MS,
  SPAWN_PROTECTION_MS,
  castAbility,
  clearExpiredStatuses,
  createCombatant,
  normalizeDirection,
  rechargeCombatantShield,
  tickCombatants,
} from '../../src/features/primeverse/games/nucleus-257/arenaLogic.js'
import {
  PLAYER_HEIGHT,
  hasArenaLineOfSight,
  resolveArenaAbilityMovement,
} from '../../src/features/primeverse/games/nucleus-257/arenaWorld.js'
import { getHeroKit } from '../../src/features/primeverse/games/nucleus-257/classKits.js'
import type {
  AbilitySlot,
  CombatantState,
  CombatStatusState,
  HeroId,
  TimedCombatStatus,
} from '../../src/features/primeverse/games/nucleus-257/types.js'
import {
  nucleusCombatPhaseFor,
  type NucleusAimInput,
  type NucleusCastMessage,
  type NucleusCombatEvent,
  type NucleusCombatPlayer,
  type NucleusCombatState,
  type NucleusHeroId,
  type NucleusTeamId,
  type Vec3,
} from '../../src/features/primeverse/games/primeverse-online/shared/index.js'
import type {
  NucleusCombatRecord,
  StoredPlayer,
  StoredNucleusCombatPlayer,
} from './model.js'

export const NUCLEUS_MAX_COMBATANTS = 12
export const NUCLEUS_INACTIVE_RETENTION_MS = 5 * 60_000
export const NUCLEUS_REJOIN_LOCK_MS = 5_000
const NUCLEUS_MAX_STORED_COMBATANTS = 64
const RECENT_CAST_LIMIT = 128
const EYE_HEIGHT = PLAYER_HEIGHT
const BODY_TARGET_HEIGHT = 1.18

export type NucleusCombatRejection =
  | 'already-joined'
  | 'arena-full'
  | 'duplicate-cast'
  | 'not-participating'
  | 'dead'
  | 'cooldown'
  | 'silenced'
  | 'ultimate-not-ready'
  | 'unknown-combatant'
  | 'waiting-for-opponent'
  | 'rejoin-locked'

export interface NucleusMutationResult {
  readonly record: NucleusCombatRecord
  readonly event: NucleusCombatEvent | null
  readonly rejection: NucleusCombatRejection | null
  readonly movementDestination: Vec3 | null
}

export function joinNucleusCombat(
  current: NucleusCombatRecord,
  player: StoredPlayer,
  heroId: NucleusHeroId,
  now: number,
): NucleusMutationResult {
  const rawExisting = current.players.find((candidate) => candidate.id === player.id)
  if (rawExisting?.connected) {
    return {
      record: current,
      event: null,
      rejection: rawExisting.heroId === heroId ? null : 'already-joined',
      movementDestination: null,
    }
  }
  if (rawExisting && now < rawExisting.rejoinLockedUntil) {
    return { ...unchanged(current), rejection: 'rejoin-locked' }
  }
  if (current.players.filter((candidate) => candidate.connected).length >= NUCLEUS_MAX_COMBATANTS) {
    return { record: current, event: null, rejection: 'arena-full', movementDestination: null }
  }

  // Keep reconnect data bounded below the durable model limit. A churn attack
  // cannot grow the Redis JSON beyond validation limits, while the most recent
  // inactive operators still retain their build for a short reconnect window.
  const retainedPlayers = retainJoinCandidates(current.players, player.id, now)
  const prepared = retainedPlayers === current.players
    ? current
    : { ...current, players: retainedPlayers }
  const index = prepared.players.findIndex((candidate) => candidate.id === player.id)
  const existing = prepared.players[index]

  const team = balancedTeam(prepared.players)
  const switchingTeam = existing !== undefined && existing.team !== team
  const penalizedRejoin = (existing?.rejoinLockedUntil ?? 0) > 0
  const spawnPosition = existing && !switchingTeam
    ? existing.spawnPosition
    : spawnForTeam(prepared.players, team)
  let combatant = existing
    ? switchHeroPreservingVitals(existing, heroId, player, now)
    : createStoredCombatant(player, heroId, team, spawnPosition, now)
  if (switchingTeam || penalizedRejoin) {
    combatant = {
      ...combatant,
      team,
      position: { ...spawnPosition },
      spawnPosition: { ...spawnPosition },
      poseSequence: player.sequence + (sameVec3(player.position, spawnPosition) ? 0 : 1),
      rejoinLockedUntil: 0,
      statuses: [spawnProtection(now)],
    }
  }
  const players = [...prepared.players]
  if (index >= 0) players[index] = combatant
  else players.push(combatant)
  const record = incrementRecord(prepared, players, now)
  return {
    record,
    event: { kind: 'joined', playerId: player.id, heroId: combatant.heroId, team },
    rejection: null,
    movementDestination: null,
  }
}

export function leaveNucleusCombat(
  current: NucleusCombatRecord,
  playerId: string,
  reason: Extract<NucleusCombatEvent, { kind: 'left' }>['reason'],
  now: number,
): NucleusMutationResult {
  const index = current.players.findIndex((candidate) => candidate.id === playerId)
  const existing = current.players[index]
  if (!existing?.connected) return unchanged(current)
  const forfeited = existing.alive
    && nucleusCombatPhaseFor(current.players.filter((candidate) => candidate.connected)) === 'active'
  const players = [...current.players]
  players[index] = {
    ...existing,
    connected: false,
    // Leaving the combat roster is never an evasive movement. Disconnects,
    // timeouts and operator selection all pay the same short spawn penalty.
    position: { ...existing.spawnPosition },
    statuses: [],
    poseSequence: existing.poseSequence + 1,
    rejoinLockedUntil: Math.max(existing.rejoinLockedUntil, now + NUCLEUS_REJOIN_LOCK_MS),
    health: forfeited ? 0 : existing.health,
    shield: forfeited ? 0 : existing.shield,
    alive: forfeited ? false : existing.alive,
    deaths: existing.deaths + (forfeited ? 1 : 0),
    respawnAt: forfeited ? now + RESPAWN_DELAY_MS : existing.respawnAt,
    lastSeenAt: now,
  }
  return {
    record: incrementRecord(current, players, now),
    event: { kind: 'left', playerId, reason },
    rejection: null,
    movementDestination: { ...existing.spawnPosition },
  }
}

export function castNucleusAbility(
  current: NucleusCombatRecord,
  roomPlayers: readonly StoredPlayer[],
  playerId: string,
  message: NucleusCastMessage,
  now: number,
): NucleusMutationResult {
  let record = synchronizeCombatPoses(current, roomPlayers, now)
  const casterRecord = record.players.find((candidate) => candidate.id === playerId)
  if (!casterRecord?.connected) {
    return { ...unchanged(record), rejection: 'not-participating' }
  }
  const idempotencyKey = `${playerId}:${message.castId}`
  if (record.recentCastIds.includes(idempotencyKey)) {
    return { ...unchanged(record), rejection: 'duplicate-cast' }
  }

  const connected = record.players.filter((candidate) => candidate.connected)
  if (nucleusCombatPhaseFor(connected) !== 'active') {
    return { ...unchanged(record), rejection: 'waiting-for-opponent' }
  }
  // Bring continuous, non-respawn state to the cast timestamp. This keeps
  // shield recovery equally precise in the frame-driven solo simulation and
  // the 500 ms server tick without violating the explicit-respawn invariant.
  const beforeCombatants = connected.map(toCombatantState).map((combatant) => (
    clearExpiredStatuses(rechargeCombatantShield(combatant, now), now)
  ))
  const ability = getHeroKit(casterRecord.heroId).abilities[message.slot]
  // A movement cast has one authoritative vector. In particular, a Raul dash
  // cannot damage along direction while moving toward an unrelated aim.point.
  const aim = sanitizeAim(message.aim, ability.movement !== undefined)
  const result = castAbility(
    beforeCombatants,
    playerId,
    message.slot as AbilitySlot,
    aim,
    now,
    {
      nowMs: now,
      hitOrigin: raised(casterRecord.position, EYE_HEIGHT),
      hitPoint: (target) => raised(target.position, BODY_TARGET_HEIGHT),
      hasLineOfSight: hasArenaLineOfSight,
    },
  )
  if (!result.ok || !result.ability) {
    return {
      ...unchanged(record),
      rejection: result.reason ?? 'unknown-combatant',
    }
  }

  const beforeById = new Map(beforeCombatants.map((candidate) => [candidate.id, candidate]))
  const resultById = new Map(result.combatants.map((candidate) => [candidate.id, candidate]))
  const rawCasterAfter = resultById.get(playerId) ?? beforeById.get(playerId)
  let movementDestination: Vec3 | null = null
  if (result.ability.movement && rawCasterAfter) {
    const horizontalDestination = {
      ...rawCasterAfter.position,
      // Every current arena mobility skill is a ground-plane dash/blink. Aim
      // pitch controls targeting, never client-selected altitude.
      y: casterRecord.position.y,
    }
    movementDestination = resolveArenaAbilityMovement(
      casterRecord.position,
      horizontalDestination,
      casterRecord.hitRadius,
      result.ability.movement.kind === 'blink',
    )
  }

  const players = record.players.map((stored) => {
    if (!stored.connected) return stored
    const next = resultById.get(stored.id)
    if (!next) return stored
    // The endpoint is derived from server-known pose, kit range and collision;
    // the WebSocket handler then commits the same pose to shared presence.
    const authoritativePose = beforeById.get(stored.id)
    const nextStored = fromCombatantState(
      next,
      stored,
      now,
      stored.id === playerId && movementDestination
        ? movementDestination
        : authoritativePose?.position ?? stored.position,
    )
    return stored.id === playerId && movementDestination
      ? { ...nextStored, poseSequence: stored.poseSequence + 1 }
      : nextStored
  })
  const recentCastIds = [...record.recentCastIds, idempotencyKey].slice(-RECENT_CAST_LIMIT)
  record = {
    ...incrementRecord(record, players, now),
    recentCastIds,
  }

  const reflectedSourceId = dominantReflectionSource(
    playerId,
    result.hitIds,
    beforeById,
    resultById,
    now,
  )
  const damages = connected.flatMap((stored) => {
    const before = beforeById.get(stored.id)
    const after = resultById.get(stored.id)
    if (!before || !after) return []
    const beforePool = before.health + before.shield
    const afterPool = after.health + after.shield
    const amount = Math.max(0, beforePool - afterPool)
    if (amount <= 0) return []
    return [{
      sourceId: stored.id === playerId ? reflectedSourceId : playerId,
      targetId: stored.id,
      amount,
      absorbedByShield: Math.max(0, before.shield - after.shield),
      health: after.health,
      shield: after.shield,
      eliminated: before.alive && !after.alive,
    }]
  })
  // arenaLogic credits these eliminations to the caster. A caster killed by a
  // reflected shot is represented in damages with the reflector as sourceId,
  // and must never be announced as a self-elimination here.
  const eliminatedIds = [...result.eliminatedIds]
  return {
    record,
    event: {
      kind: 'cast',
      casterId: playerId,
      castId: message.castId,
      abilityId: result.ability.id,
      slot: message.slot,
      origin: raised(casterRecord.position, EYE_HEIGHT),
      direction: { ...aim.direction },
      ...(aim.point === undefined ? {} : { point: { ...aim.point } }),
      ...(movementDestination === null ? {} : { destination: { ...movementDestination } }),
      hitIds: [...result.hitIds],
      damages,
      eliminatedIds,
    },
    rejection: null,
    movementDestination,
  }
}

function dominantReflectionSource(
  casterId: string,
  hitIds: readonly string[],
  beforeById: ReadonlyMap<string, CombatantState>,
  afterById: ReadonlyMap<string, CombatantState>,
  now: number,
): string {
  let sourceId = casterId
  let contribution = 0
  for (const targetId of hitIds) {
    if (targetId === casterId) continue
    const before = beforeById.get(targetId)
    const after = afterById.get(targetId)
    const reflecting = before?.statuses.reflecting
    if (!before || !after || !reflecting || reflecting.expiresAtMs <= now) continue
    const applied = Math.max(
      0,
      before.health + before.shield - after.health - after.shield,
    )
    const reflected = applied * reflecting.magnitude
    if (reflected > contribution
      || (reflected === contribution && reflected > 0 && targetId.localeCompare(sourceId) < 0)) {
      sourceId = targetId
      contribution = reflected
    }
  }
  return sourceId
}

export function tickNucleusCombat(
  current: NucleusCombatRecord,
  now: number,
): { readonly record: NucleusCombatRecord; readonly events: readonly NucleusCombatEvent[] } {
  return tickRecord(current, now)
}

export function synchronizeCombatPoses(
  current: NucleusCombatRecord,
  roomPlayers: readonly StoredPlayer[],
  now: number,
): NucleusCombatRecord {
  const poses = new Map(roomPlayers
    .filter((player) => player.activityId === 'nucleus-257' && player.runId === current.runId)
    .map((player) => [player.id, player]))
  let changed = false
  const players = current.players.map((combatant) => {
    const normalized = normalizeStoredKitStats(combatant)
    if (normalized !== combatant) changed = true
    if (!normalized.connected) return normalized
    const player = poses.get(normalized.id)
    if (!player) return normalized
    if (player.sequence <= normalized.poseSequence) {
      if (normalized.nickname === player.nickname) return normalized
      changed = true
      return { ...normalized, nickname: player.nickname }
    }
    if (sameVec3(normalized.position, player.position)
      && normalized.yaw === player.yaw
      && normalized.nickname === player.nickname
      && normalized.poseSequence === player.sequence
      && normalized.lastSeenAt === now) return normalized
    changed = true
    return {
      ...normalized,
      nickname: player.nickname,
      position: { ...player.position },
      yaw: player.yaw,
      poseSequence: player.sequence,
      lastSeenAt: now,
    }
  })
  // A low-frequency durable pose revision lets another runtime heal a missed
  // activity_player_updated packet without turning combat state into the
  // high-frequency movement transport.
  return changed ? incrementRecord(current, players, now) : current
}

export function toNucleusCombatState(
  record: NucleusCombatRecord,
  serverTime: number,
): NucleusCombatState {
  const players = record.players.filter((player) => player.connected).map(toWirePlayer)
  return {
    type: 'nucleus_state',
    runId: record.runId,
    revision: record.revision,
    serverTime,
    phase: nucleusCombatPhaseFor(players),
    players,
    objective: null,
  }
}

function retainJoinCandidates(
  players: readonly StoredNucleusCombatPlayer[],
  joiningPlayerId: string,
  now: number,
): readonly StoredNucleusCombatPlayer[] {
  const retained = players.filter((candidate) => (
    candidate.connected
      || now - candidate.lastSeenAt <= NUCLEUS_INACTIVE_RETENTION_MS
  ))
  if (retained.length < NUCLEUS_MAX_STORED_COMBATANTS) {
    return retained.length === players.length ? players : retained
  }

  const protectedIds = new Set(retained
    .filter((candidate) => candidate.connected || candidate.id === joiningPlayerId)
    .map((candidate) => candidate.id))
  const joiningIsRetained = protectedIds.has(joiningPlayerId)
  const slots = Math.max(
    0,
    NUCLEUS_MAX_STORED_COMBATANTS - (joiningIsRetained ? 0 : 1) - protectedIds.size,
  )
  const newestInactiveIds = new Set(retained
    .filter((candidate) => !protectedIds.has(candidate.id))
    .sort((left, right) => right.lastSeenAt - left.lastSeenAt || left.id.localeCompare(right.id))
    .slice(0, slots)
    .map((candidate) => candidate.id))
  const bounded = retained.filter((candidate) => (
    protectedIds.has(candidate.id) || newestInactiveIds.has(candidate.id)
  ))
  return bounded
}

function tickRecord(
  current: NucleusCombatRecord,
  now: number,
): { readonly record: NucleusCombatRecord; readonly events: readonly NucleusCombatEvent[] } {
  const retained = current.players
    .filter((candidate) => (
      candidate.connected || now - candidate.lastSeenAt <= NUCLEUS_INACTIVE_RETENTION_MS
    ))
    .map(normalizeStoredKitStats)
  const connected = retained.filter((candidate) => candidate.connected)
  const beforeCombatants = connected.map(toCombatantState)
  const beforeById = new Map(beforeCombatants.map((candidate) => [candidate.id, candidate]))
  const ticked = tickCombatants(beforeCombatants, now)
  const tickedById = new Map(ticked.map((candidate) => [candidate.id, candidate]))
  const events: NucleusCombatEvent[] = []
  let changed = retained.length !== current.players.length
    || retained.some((candidate, index) => candidate !== current.players[index])
  const players = retained.map((stored) => {
    if (!stored.connected) return stored
    const before = beforeById.get(stored.id)
    const next = tickedById.get(stored.id)
    if (!before || !next || before === next) return stored
    changed = true
    if (!before.alive && next.alive) {
      events.push({ kind: 'respawned', playerId: stored.id, position: { ...next.position } })
    }
    const respawned = !before.alive && next.alive
    return {
      ...fromCombatantState(next, stored, now, next.position),
      poseSequence: stored.poseSequence + (respawned ? 1 : 0),
    }
  })
  return {
    record: changed ? incrementRecord(current, players, now) : current,
    events,
  }
}

function createStoredCombatant(
  player: StoredPlayer,
  heroId: NucleusHeroId,
  team: NucleusTeamId,
  spawnPosition: Vec3,
  now: number,
): StoredNucleusCombatPlayer {
  const base = createCombatant({
    id: player.id,
    heroId: heroId as HeroId,
    team,
    position: spawnPosition,
    facing: facingFromYaw(player.yaw),
  })
  return {
    ...fromCombatantState(base, null, now, spawnPosition),
    nickname: player.nickname,
    connected: true,
    yaw: player.yaw,
    spawnPosition: { ...spawnPosition },
    hitRadius: base.hitRadius,
    poseSequence: player.sequence + (sameVec3(player.position, spawnPosition) ? 0 : 1),
    rejoinLockedUntil: 0,
    statuses: [spawnProtection(now)],
    lastSeenAt: now,
  }
}

function normalizeStoredKitStats(
  existing: StoredNucleusCombatPlayer,
): StoredNucleusCombatPlayer {
  const kit = getHeroKit(existing.heroId)
  if (existing.maxHealth === kit.stats.maxHealth
    && existing.maxShield === kit.stats.maxShield
    && existing.hitRadius === kit.stats.hitRadius) return existing

  const healthRatio = existing.maxHealth <= 0 ? 0 : existing.health / existing.maxHealth
  const shieldRatio = existing.maxShield <= 0 ? 0 : existing.shield / existing.maxShield
  return {
    ...existing,
    health: existing.alive ? Math.max(1, kit.stats.maxHealth * healthRatio) : 0,
    maxHealth: kit.stats.maxHealth,
    shield: kit.stats.maxShield * shieldRatio,
    maxShield: kit.stats.maxShield,
    hitRadius: kit.stats.hitRadius,
  }
}

function switchHeroPreservingVitals(
  existing: StoredNucleusCombatPlayer,
  heroId: NucleusHeroId,
  player: StoredPlayer,
  now: number,
): StoredNucleusCombatPlayer {
  if (existing.heroId === heroId) {
    const normalized = normalizeStoredKitStats(existing)
    return {
      ...normalized,
      nickname: player.nickname,
      connected: true,
      position: { ...player.position },
      yaw: player.yaw,
      poseSequence: player.sequence,
      lastSeenAt: now,
    }
  }
  const kit = getHeroKit(heroId)
  const healthRatio = existing.maxHealth <= 0 ? 0 : existing.health / existing.maxHealth
  const shieldRatio = existing.maxShield <= 0 ? 0 : existing.shield / existing.maxShield
  return {
    ...existing,
    nickname: player.nickname,
    heroId,
    connected: true,
    position: { ...player.position },
    yaw: player.yaw,
    health: existing.alive ? Math.max(1, kit.stats.maxHealth * healthRatio) : 0,
    maxHealth: kit.stats.maxHealth,
    shield: kit.stats.maxShield * shieldRatio,
    maxShield: kit.stats.maxShield,
    alive: existing.alive,
    hitRadius: kit.stats.hitRadius,
    cooldownReadyAt: {
      primary: now + kit.abilities.primary.cooldownMs,
      signature: now + kit.abilities.signature.cooldownMs,
      mobility: now + kit.abilities.mobility.cooldownMs,
      ultimate: now + kit.abilities.ultimate.cooldownMs,
    },
    statuses: [],
    ultimateCharge: 0,
    poseSequence: player.sequence,
    lastSeenAt: now,
  }
}

function toCombatantState(stored: StoredNucleusCombatPlayer): CombatantState {
  const statuses = Object.fromEntries(stored.statuses.map((status) => [status.id, {
    id: status.id,
    expiresAtMs: status.expiresAt,
    magnitude: status.magnitude,
  }])) as CombatStatusState
  return {
    id: stored.id,
    heroId: stored.heroId,
    team: stored.team,
    bot: false,
    position: { ...stored.position },
    spawnPosition: { ...stored.spawnPosition },
    facing: facingFromYaw(stored.yaw),
    health: stored.health,
    maxHealth: stored.maxHealth,
    shield: stored.shield,
    maxShield: stored.maxShield,
    hitRadius: stored.hitRadius,
    alive: stored.alive,
    cooldownReadyAtMs: { ...stored.cooldownReadyAt },
    statuses,
    ultimateCharge: stored.ultimateCharge,
    eliminations: stored.eliminations,
    deaths: stored.deaths,
    respawnAtMs: stored.respawnAt,
  }
}

function fromCombatantState(
  combatant: CombatantState,
  previous: StoredNucleusCombatPlayer | null,
  now: number,
  position: Vec3,
): StoredNucleusCombatPlayer {
  const statuses = Object.values(combatant.statuses)
    .filter((status): status is TimedCombatStatus => status !== undefined)
    .map((status) => ({
      id: status.id,
      expiresAt: status.expiresAtMs,
      magnitude: status.magnitude,
    }))
  return {
    id: combatant.id,
    nickname: previous?.nickname ?? 'Operador',
    heroId: combatant.heroId,
    team: combatant.team,
    connected: previous?.connected ?? true,
    position: { ...position },
    yaw: previous?.yaw ?? yawFromFacing(combatant.facing),
    health: combatant.health,
    maxHealth: combatant.maxHealth,
    shield: combatant.shield,
    maxShield: combatant.maxShield,
    alive: combatant.alive,
    cooldownReadyAt: { ...combatant.cooldownReadyAtMs },
    ultimateCharge: combatant.ultimateCharge,
    eliminations: combatant.eliminations,
    deaths: combatant.deaths,
    respawnAt: combatant.respawnAtMs,
    statuses,
    spawnPosition: { ...(previous?.spawnPosition ?? combatant.spawnPosition) },
    hitRadius: combatant.hitRadius,
    poseSequence: previous?.poseSequence ?? 0,
    rejoinLockedUntil: previous?.rejoinLockedUntil ?? 0,
    lastSeenAt: now,
  }
}

function toWirePlayer(player: StoredNucleusCombatPlayer): NucleusCombatPlayer {
  return {
    id: player.id,
    nickname: player.nickname,
    heroId: player.heroId,
    team: player.team,
    connected: player.connected,
    position: { ...player.position },
    yaw: player.yaw,
    health: player.health,
    maxHealth: player.maxHealth,
    shield: player.shield,
    maxShield: player.maxShield,
    alive: player.alive,
    cooldownReadyAt: { ...player.cooldownReadyAt },
    ultimateCharge: player.ultimateCharge,
    eliminations: player.eliminations,
    deaths: player.deaths,
    respawnAt: player.respawnAt,
    statuses: player.statuses.map((status) => ({ ...status })),
  }
}

function incrementRecord(
  current: NucleusCombatRecord,
  players: readonly StoredNucleusCombatPlayer[],
  now: number,
): NucleusCombatRecord {
  return {
    ...current,
    revision: current.revision + 1,
    players,
    updatedAt: now,
  }
}

function balancedTeam(players: readonly StoredNucleusCombatPlayer[]): NucleusTeamId {
  const connected = players.filter((candidate) => candidate.connected)
  const cipher = connected.filter((candidate) => candidate.team === 'cipher').length
  const fracture = connected.length - cipher
  return cipher <= fracture ? 'cipher' : 'fracture'
}

function spawnForTeam(
  players: readonly StoredNucleusCombatPlayer[],
  team: NucleusTeamId,
): Vec3 {
  const index = players.filter((candidate) => candidate.connected && candidate.team === team).length
  const row = Math.floor(index / 3)
  const x = [-6, 0, 6][index % 3] ?? 0
  const zBase = team === 'cipher' ? 20 : -20
  const z = zBase + (team === 'cipher' ? -row * 4 : row * 4)
  return { x, y: 0.05, z }
}

function sanitizeAim(aim: NucleusAimInput, movementAbility: boolean): NucleusAimInput {
  return {
    direction: normalizeDirection(aim.direction),
    ...(movementAbility || aim.point === undefined ? {} : { point: { ...aim.point } }),
  }
}

function raised(position: Vec3, amount: number): Vec3 {
  return { x: position.x, y: position.y + amount, z: position.z }
}

function facingFromYaw(yaw: number): Vec3 {
  return { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) }
}

function yawFromFacing(facing: Vec3): number {
  return Math.atan2(-facing.x, -facing.z)
}

function sameVec3(left: Vec3, right: Vec3): boolean {
  return left.x === right.x && left.y === right.y && left.z === right.z
}

function spawnProtection(now: number): StoredNucleusCombatPlayer['statuses'][number] {
  return {
    id: 'spawn-protected',
    expiresAt: now + SPAWN_PROTECTION_MS,
    magnitude: 1,
  }
}

function unchanged(record: NucleusCombatRecord): NucleusMutationResult {
  return { record, event: null, rejection: null, movementDestination: null }
}
