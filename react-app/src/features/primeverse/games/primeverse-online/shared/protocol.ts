/**
 * Primeverse Online wire protocol.
 *
 * Keep this module platform-neutral: it is imported by both the browser and
 * the Node WebSocket endpoint. All values crossing the network are rebuilt
 * from validated primitives so untrusted extra properties are never forwarded.
 */

import {
  ACTIVITY_MOVEMENT_PROFILES,
  isActivityId,
  isActivityPortalPair,
  isActivityRunId,
  isActivityRunPair,
  isExpeditionActivityId,
  isPortalId,
  isPositionInActivity,
  type ActivityId,
  type ActivityMovementProfile,
  type ActivityRunId,
  type ExpeditionActivityId,
} from './activities'
import { isInsideRealm, PORTAL_IDS, type PortalId } from './realms'

export const PROTOCOL_VERSION = 2 as const
export const NETWORK_HZ = 15
export const SERVER_TICK_RATE = NETWORK_HZ
export const NETWORK_INTERVAL_MS = 1_000 / NETWORK_HZ
export const ROOM_CAPACITY = 20
export const MAX_MESSAGE_BYTES = 4_096
/** Welcome snapshots are larger than client commands (up to 20 players). */
export const MAX_SERVER_MESSAGE_BYTES = 128 * 1_024
export const HEARTBEAT_INTERVAL_MS = 15_000
export const PLAYER_TIMEOUT_MS = 45_000
export const RESUME_LEASE_MS = 60_000
export const EMOTE_DURATION_MS = 2_000

export const MIN_NICKNAME_LENGTH = 2
export const MAX_NICKNAME_LENGTH = 16
export const MAX_RESUME_TOKEN_LENGTH = 128

export const MAX_WALK_SPEED = 5
export const MAX_RUN_SPEED = 9
export const MAX_JUMP_SPEED = 11
export const MAX_FALL_SPEED = 18
export const MAX_POSITION_DELTA = 12
/**
 * One-off movement credit for packet jitter. The server carries the remaining
 * credit between packets; it must never be reapplied in full on every tick.
 */
export const MOVEMENT_GRACE_DISTANCE = 0.35
export const VERTICAL_MOVEMENT_GRACE_DISTANCE = 0.5
export const MAX_MOVEMENT_ELAPSED_MS = 1_000

export const WORLD_BOUNDS = Object.freeze({
  min: Object.freeze({ x: -120, y: -30, z: -132 }),
  max: Object.freeze({ x: 120, y: 60, z: 120 }),
})

export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

export const PLAYER_ANIMATIONS = ['idle', 'walk', 'run', 'jump'] as const
export type PlayerAnimation = (typeof PLAYER_ANIMATIONS)[number]

export const AVATAR_ACCENT_COLORS = [
  '#5ceee5',
  '#8d7dff',
  '#f0c35a',
  '#ff759f',
  '#72e59a',
] as const
export type AvatarAccentColor = (typeof AVATAR_ACCENT_COLORS)[number]
/** Backwards-friendly semantic alias: the accent is the avatar's energy color. */
export const AVATAR_ENERGY_COLORS = AVATAR_ACCENT_COLORS
export type AvatarEnergyColor = AvatarAccentColor

export const AVATAR_BODY_COLORS = [
  '#172b3a',
  '#2c254b',
  '#323943',
  '#3a2430',
  '#22372f',
] as const
export type AvatarBodyColor = (typeof AVATAR_BODY_COLORS)[number]
export type HexColor = `#${string}`

export const AVATAR_VISOR_STYLES = ['slit', 'halo', 'triad'] as const
export type AvatarVisorStyle = (typeof AVATAR_VISOR_STYLES)[number]

export const AVATAR_AURA_STYLES = ['none', 'orbit', 'pulse'] as const
export type AvatarAuraStyle = (typeof AVATAR_AURA_STYLES)[number]

export const AVATAR_ACCENT_STYLES = ['prime', 'factor', 'cipher'] as const
export type AvatarAccentStyle = (typeof AVATAR_ACCENT_STYLES)[number]

export interface AvatarAppearance {
  readonly bodyColor: HexColor
  readonly accentColor: HexColor
  readonly visorColor: HexColor
  readonly visorStyle?: AvatarVisorStyle
  readonly auraStyle?: AvatarAuraStyle
  readonly accentStyle?: AvatarAccentStyle
}

export const DEFAULT_AVATAR_APPEARANCE: AvatarAppearance = Object.freeze({
  bodyColor: AVATAR_BODY_COLORS[0],
  accentColor: AVATAR_ACCENT_COLORS[0],
  visorColor: AVATAR_ACCENT_COLORS[0],
  visorStyle: AVATAR_VISOR_STYLES[0],
  auraStyle: AVATAR_AURA_STYLES[0],
  accentStyle: AVATAR_ACCENT_STYLES[0],
})

export const EMOTES = ['wave', 'celebrate', 'heart', 'question', 'spark'] as const
export type Emote = (typeof EMOTES)[number]

export const EMOTE_GLYPHS = Object.freeze({
  wave: '👋',
  celebrate: '🎉',
  heart: '❤️',
  question: '❓',
  spark: '⚡',
} as const satisfies Readonly<Record<Emote, string>>)

export interface ActiveEmote {
  readonly kind: Emote
  readonly startedAt: number
}

export const PRIME_SEQUENCE_CHOICES = [12, 13, 15, 17] as const
export type PrimeSequenceChoice = (typeof PRIME_SEQUENCE_CHOICES)[number]
export const PRIME_SEQUENCE_ANSWER = 13 as const satisfies PrimeSequenceChoice

export const INTERACTION_TARGETS = [
  'prime-core',
  'pedestal-12',
  'pedestal-13',
  'pedestal-15',
  'pedestal-17',
  'secret-997',
  'secret-constellation',
  'secret-mersenne',
  'spawn-plaza',
  ...PORTAL_IDS,
] as const
export type InteractionTarget = (typeof INTERACTION_TARGETS)[number]

export const INTERACTION_ACTIONS = ['activate', 'vote', 'discover', 'respawn', 'travel'] as const
export type InteractionAction = (typeof INTERACTION_ACTIONS)[number]

export const INTERACTION_ACTION_BY_TARGET = Object.freeze({
  'prime-core': 'activate',
  'pedestal-12': 'vote',
  'pedestal-13': 'vote',
  'pedestal-15': 'vote',
  'pedestal-17': 'vote',
  'secret-997': 'discover',
  'secret-constellation': 'discover',
  'secret-mersenne': 'discover',
  'spawn-plaza': 'respawn',
  'portal-ulam': 'travel',
  'portal-forge': 'travel',
  'portal-nexus-ulam': 'travel',
  'portal-nexus-forge': 'travel',
  'portal-catacombs': 'travel',
  'portal-nucleus': 'travel',
  'portal-nexus-catacombs': 'travel',
  'portal-primebound': 'travel',
} as const satisfies Readonly<Record<InteractionTarget, InteractionAction>>)

export interface PlayerSnapshot {
  readonly id: string
  readonly nickname: string
  readonly activityId: ActivityId
  readonly runId: ActivityRunId | null
  readonly position: Vec3
  readonly yaw: number
  readonly animation: PlayerAnimation
  readonly appearance: AvatarAppearance
  readonly emote: ActiveEmote | null
  readonly sequence: number
  readonly updatedAt: number
}

export interface PlayerMovement {
  readonly position: Vec3
  readonly yaw: number
  readonly animation: PlayerAnimation
  readonly sequence: number
  readonly clientTime: number
}

export type PrimeCoreEnergyLevel =
  | 'dormant'
  | 'awakened'
  | 'resonant'
  | 'accelerated'
  | 'overcharged'

export interface PrimeCoreState {
  readonly nearbyPlayers: number
  readonly energyLevel: PrimeCoreEnergyLevel
  readonly intensity: number
  readonly ringSpeed: number
}

export type PrimeSequencePhase = 'idle' | 'voting' | 'revealed' | 'cooldown'

export type PrimeSequenceVoteCounts = Readonly<Record<PrimeSequenceChoice, number>>
export type PrimeSequenceVotes = Readonly<Record<string, PrimeSequenceChoice>>

export interface PrimeSequenceState {
  readonly round: number
  readonly phase: PrimeSequencePhase
  readonly startedAt: number | null
  readonly phaseEndsAt: number | null
  readonly votesByPlayer: PrimeSequenceVotes
  readonly voteCounts: PrimeSequenceVoteCounts
  readonly totalVotes: number
  readonly winningChoice: PrimeSequenceChoice | null
  readonly revealedAnswer: PrimeSequenceChoice | null
  readonly success: boolean | null
}

export interface WorldState {
  readonly serverTime: number
  readonly core: PrimeCoreState
  readonly sequence: PrimeSequenceState
}

export type WorldEvent =
  | {
      readonly kind: 'sequence_started'
      readonly round: number
      readonly phaseEndsAt: number
      readonly at: number
    }
  | {
      readonly kind: 'sequence_vote'
      readonly round: number
      readonly playerId: string
      readonly choice: PrimeSequenceChoice
      readonly voteCounts: PrimeSequenceVoteCounts
      readonly at: number
    }
  | {
      readonly kind: 'sequence_revealed'
      readonly round: number
      readonly answer: typeof PRIME_SEQUENCE_ANSWER
      readonly winningChoice: PrimeSequenceChoice | null
      readonly success: boolean
      readonly effect: 'prime-wave' | null
      readonly at: number
    }
  | {
      readonly kind: 'sequence_cooldown'
      readonly round: number
      readonly phaseEndsAt: number
      readonly at: number
    }
  | {
      readonly kind: 'sequence_reset'
      readonly round: number
      readonly at: number
    }
  | {
      readonly kind: 'core_energy_changed'
      readonly core: PrimeCoreState
      readonly at: number
    }

export interface JoinMessage {
  readonly type: 'join'
  readonly version: typeof PROTOCOL_VERSION
  readonly nickname: string
  readonly appearance: AvatarAppearance
  readonly resumeToken?: string
}

export interface ChangeActivityMessage {
  readonly type: 'change_activity'
  readonly activityId: ActivityId
  /** Required for an expedition entry; optional when returning to the Nexus. */
  readonly portalId?: PortalId
}

export interface MoveMessage extends PlayerMovement {
  readonly type: 'move'
}

export interface ActivityMoveMessage extends PlayerMovement {
  readonly type: 'activity_move'
  readonly activityId: ExpeditionActivityId
  readonly runId: ActivityRunId
}

export const NUCLEUS_HERO_IDS = [
  'luma-crivo',
  'raul-rsa',
  'teo-gemeos',
  'yara-diffie',
  'iris-mersenne',
] as const
export type NucleusHeroId = (typeof NUCLEUS_HERO_IDS)[number]

export const NUCLEUS_ABILITY_SLOTS = [
  'primary',
  'signature',
  'mobility',
  'ultimate',
] as const
export type NucleusAbilitySlot = (typeof NUCLEUS_ABILITY_SLOTS)[number]
export type NucleusTeamId = 'cipher' | 'fracture'

export const NUCLEUS_COMBAT_STATUS_IDS = [
  'cloaked',
  'damage-guard',
  'marked',
  'reflecting',
  'revealed',
  'shield-recharging',
  'silenced',
  'slowed',
  'spawn-protected',
] as const
export type NucleusCombatStatusId = (typeof NUCLEUS_COMBAT_STATUS_IDS)[number]

export interface NucleusJoinMessage {
  readonly type: 'nucleus_join'
  readonly runId: ActivityRunId
  readonly heroId: NucleusHeroId
}

export interface NucleusLeaveMessage {
  readonly type: 'nucleus_leave'
  readonly runId: ActivityRunId
}

export interface NucleusAimInput {
  readonly direction: Vec3
  readonly point?: Vec3
}

export interface NucleusCastMessage {
  readonly type: 'nucleus_cast'
  readonly runId: ActivityRunId
  /** Idempotency key generated once for a player input and reused on retry. */
  readonly castId: string
  readonly slot: NucleusAbilitySlot
  readonly aim: NucleusAimInput
  readonly clientTime: number
}

export interface NucleusCombatStatus {
  readonly id: NucleusCombatStatusId
  readonly expiresAt: number
  readonly magnitude: number
}

export type NucleusCooldownState = Readonly<Record<NucleusAbilitySlot, number>>

export interface NucleusCombatPlayer {
  readonly id: string
  readonly nickname: string
  readonly heroId: NucleusHeroId
  readonly team: NucleusTeamId
  /** False while selecting a hero, outside the activity, or disconnected. */
  readonly connected: boolean
  readonly position: Vec3
  readonly yaw: number
  readonly health: number
  readonly maxHealth: number
  readonly shield: number
  readonly maxShield: number
  readonly alive: boolean
  readonly cooldownReadyAt: NucleusCooldownState
  readonly ultimateCharge: number
  readonly eliminations: number
  readonly deaths: number
  readonly respawnAt: number | null
  readonly statuses: readonly NucleusCombatStatus[]
}

export type NucleusCombatPhase = 'waiting' | 'active'

export function nucleusCombatPhaseFor(
  players: readonly Pick<NucleusCombatPlayer, 'connected' | 'team'>[],
): NucleusCombatPhase {
  let cipher = false
  let fracture = false
  for (const player of players) {
    if (!player.connected) continue
    if (player.team === 'cipher') cipher = true
    else fracture = true
    if (cipher && fracture) return 'active'
  }
  return 'waiting'
}

export interface NucleusCombatState {
  readonly type: 'nucleus_state'
  readonly runId: ActivityRunId
  readonly revision: number
  readonly serverTime: number
  readonly phase: NucleusCombatPhase
  readonly players: readonly NucleusCombatPlayer[]
  /** Reserved for the future server-authoritative pylon mode. */
  readonly objective: null
}

export interface NucleusDamageEvent {
  /** Effective damage owner (the reflector for returned damage). */
  readonly sourceId: string
  readonly targetId: string
  readonly amount: number
  readonly absorbedByShield: number
  readonly health: number
  readonly shield: number
  readonly eliminated: boolean
}

export type NucleusCombatEvent =
  | {
      readonly kind: 'joined'
      readonly playerId: string
      readonly heroId: NucleusHeroId
      readonly team: NucleusTeamId
    }
  | {
      readonly kind: 'left'
      readonly playerId: string
      readonly reason: 'selection' | 'activity_change' | 'disconnect' | 'timeout'
    }
  | {
      readonly kind: 'cast'
      readonly casterId: string
      readonly castId: string
      readonly abilityId: string
      readonly slot: NucleusAbilitySlot
      readonly origin: Vec3
      readonly direction: Vec3
      readonly point?: Vec3
      /** Server-computed endpoint for dash/blink abilities. */
      readonly destination?: Vec3
      readonly hitIds: readonly string[]
      readonly damages: readonly NucleusDamageEvent[]
      readonly eliminatedIds: readonly string[]
    }
  | {
      readonly kind: 'respawned'
      readonly playerId: string
      readonly position: Vec3
    }

export interface NucleusCombatEventMessage {
  readonly type: 'nucleus_event'
  readonly runId: ActivityRunId
  readonly revision: number
  readonly eventId: string
  readonly serverTime: number
  readonly event: NucleusCombatEvent
}

export interface EmoteMessage {
  readonly type: 'emote'
  readonly emote: Emote
}

export interface InteractionMessage {
  readonly type: 'interaction'
  readonly target: InteractionTarget
  readonly action: InteractionAction
}

export interface PingMessage {
  readonly type: 'ping'
  readonly clientTime: number
}

/**
 * Expedition lobbies: gather friends behind a short code and enter the same run
 * together, instead of changing activity and hoping to meet.
 */
export interface LobbyCreateMessage {
  readonly type: 'lobby_create'
  readonly activityId: ExpeditionActivityId
}

export interface LobbyJoinMessage {
  readonly type: 'lobby_join'
  readonly code: string
}

export interface LobbyReadyMessage {
  readonly type: 'lobby_ready'
  readonly ready: boolean
}

export interface LobbyLeaveMessage {
  readonly type: 'lobby_leave'
}

export interface LobbyLaunchMessage {
  readonly type: 'lobby_launch'
}

export const LOBBY_CODE_PATTERN = /^[A-Z2-9]{4}$/

export interface LobbyMemberSnapshot {
  readonly playerId: string
  readonly name: string
  readonly ready: boolean
}

export interface LobbySnapshot {
  readonly code: string
  readonly activityId: ExpeditionActivityId
  readonly hostId: string
  readonly phase: 'gathering' | 'launched' | 'closed'
  readonly members: readonly LobbyMemberSnapshot[]
  readonly runId: string | null
  readonly seed: number | null
  readonly canLaunch: boolean
}

/**
 * Co-op simulation channel.
 *
 * PvE expeditions share enemies and pickups through host authority: one member of
 * the run simulates the world and broadcasts `party_state`; the others render it
 * and send their intents back as `party_action`. The server does not understand
 * either payload — it only checks that sender and receivers share the same run,
 * caps size and rate, and relays. Each game owns its own payload schema.
 */
export interface PartyStateMessage {
  readonly type: 'party_state'
  readonly runId: ActivityRunId
  readonly seq: number
  readonly data: unknown
}

export interface PartyActionMessage {
  readonly type: 'party_action'
  readonly runId: ActivityRunId
  readonly seq: number
  readonly data: unknown
}

export const MAX_PARTY_STATE_BYTES = 8_192
export const MAX_PARTY_ACTION_BYTES = 1_024

export type ClientMessage =
  | PartyStateMessage
  | PartyActionMessage
  | LobbyCreateMessage
  | LobbyJoinMessage
  | LobbyReadyMessage
  | LobbyLeaveMessage
  | LobbyLaunchMessage
  | JoinMessage
  | ChangeActivityMessage
  | MoveMessage
  | ActivityMoveMessage
  | NucleusJoinMessage
  | NucleusLeaveMessage
  | NucleusCastMessage
  | EmoteMessage
  | InteractionMessage
  | PingMessage

export type PlayerLeftReason = 'disconnect' | 'timeout' | 'room_change'

export type ProtocolErrorCode =
  | 'MALFORMED_JSON'
  | 'MESSAGE_TOO_LARGE'
  | 'UNKNOWN_MESSAGE'
  | 'INVALID_PAYLOAD'
  | 'PROTOCOL_MISMATCH'
  | 'ALREADY_JOINED'
  | 'NOT_JOINED'
  | 'RATE_LIMITED'
  | 'MOVEMENT_REJECTED'
  | 'COMBAT_REJECTED'
  | 'ROOM_FULL'
  | 'SERVER_UNAVAILABLE'

export const PROTOCOL_ERROR_CODES = [
  'MALFORMED_JSON',
  'MESSAGE_TOO_LARGE',
  'UNKNOWN_MESSAGE',
  'INVALID_PAYLOAD',
  'PROTOCOL_MISMATCH',
  'ALREADY_JOINED',
  'NOT_JOINED',
  'RATE_LIMITED',
  'MOVEMENT_REJECTED',
  'COMBAT_REJECTED',
  'ROOM_FULL',
  'SERVER_UNAVAILABLE',
] as const satisfies readonly ProtocolErrorCode[]

export type ServerMessage =
  | {
      readonly type: 'welcome'
      readonly version: typeof PROTOCOL_VERSION
      readonly playerId: string
      readonly roomId: string
      readonly resumeToken: string
      readonly players: readonly PlayerSnapshot[]
      readonly world: WorldState
      readonly serverTime: number
    }
  | { readonly type: 'player_joined'; readonly player: PlayerSnapshot }
  | {
      readonly type: 'player_updated'
      readonly playerId: string
      readonly position: Vec3
      readonly yaw: number
      readonly animation: PlayerAnimation
      readonly sequence: number
      readonly serverTime: number
    }
  | {
      readonly type: 'activity_changed'
      readonly playerId: string
      readonly activityId: ActivityId
      readonly runId: ActivityRunId | null
      readonly serverTime: number
      readonly sequence: number
    }
  | {
      readonly type: 'activity_player_updated'
      readonly playerId: string
      readonly activityId: ExpeditionActivityId
      readonly runId: ActivityRunId
      readonly position: Vec3
      readonly yaw: number
      readonly animation: PlayerAnimation
      readonly sequence: number
      readonly serverTime: number
    }
  | NucleusCombatState
  | NucleusCombatEventMessage
  | {
      readonly type: 'player_left'
      readonly playerId: string
      readonly reason: PlayerLeftReason
    }
  | {
      readonly type: 'player_emote'
      readonly playerId: string
      readonly emote: Emote
      readonly startedAt: number
      readonly durationMs: number
    }
  | {
      readonly type: 'party_state'
      readonly runId: ActivityRunId
      readonly fromId: string
      readonly seq: number
      readonly data: unknown
      readonly serverTime: number
    }
  | {
      readonly type: 'party_action'
      readonly runId: ActivityRunId
      readonly fromId: string
      readonly seq: number
      readonly data: unknown
      readonly serverTime: number
    }
  | { readonly type: 'lobby_state'; readonly lobby: LobbySnapshot }
  | { readonly type: 'lobby_closed'; readonly code: string }
  | {
      readonly type: 'lobby_launched'
      readonly lobby: LobbySnapshot
      readonly runId: string
      readonly seed: number
    }
  | { readonly type: 'world_state'; readonly state: WorldState }
  | { readonly type: 'world_event'; readonly event: WorldEvent }
  | { readonly type: 'pong'; readonly clientTime: number; readonly serverTime: number }
  | {
      readonly type: 'error'
      readonly code: ProtocolErrorCode
      readonly message: string
      readonly recoverable: boolean
    }

export interface ValidationError {
  readonly code: ProtocolErrorCode
  readonly message: string
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ValidationError }

export type MovementRejectionReason =
  | 'invalid_elapsed'
  | 'stale_sequence'
  | 'out_of_bounds'
  | 'position_delta'
  | 'horizontal_speed'
  | 'vertical_speed'

export type MovementValidationResult =
  | {
      readonly ok: true
      readonly horizontalSpeed: number
      readonly verticalSpeed: number
      readonly discontinuity: boolean
      readonly nextBudget: MovementBudget
    }
  | {
      readonly ok: false
      readonly reason: MovementRejectionReason
      readonly horizontalSpeed: number
      readonly verticalSpeed: number
      readonly nextBudget: MovementBudget
    }

export interface MovementBudget {
  readonly horizontal: number
  readonly vertical: number
}

const NICKNAME_PATTERN = /^[\p{L}\p{N} _-]+$/u
const RESUME_TOKEN_PATTERN = /^[a-zA-Z0-9_-]{16,128}$/
const NUCLEUS_CAST_ID_PATTERN = /^[a-zA-Z0-9:_-]{1,64}$/

function failure(code: ProtocolErrorCode, message: string): ValidationResult<never> {
  return { ok: false, error: { code, message } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isSafeHexColor(value: unknown): value is HexColor {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

function includesValue<const Values extends readonly unknown[]>(
  values: Values,
  value: unknown,
): value is Values[number] {
  return values.includes(value)
}

function isSafeTimestamp(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER
}

export function sanitizeNickname(value: unknown): ValidationResult<string> {
  if (typeof value !== 'string') {
    return failure('INVALID_PAYLOAD', 'Nickname must be text.')
  }

  const nickname = value.trim()
  const length = Array.from(nickname).length
  if (length < MIN_NICKNAME_LENGTH || length > MAX_NICKNAME_LENGTH) {
    return failure(
      'INVALID_PAYLOAD',
      `Nickname must contain ${MIN_NICKNAME_LENGTH} to ${MAX_NICKNAME_LENGTH} characters.`,
    )
  }
  if (!NICKNAME_PATTERN.test(nickname)) {
    return failure(
      'INVALID_PAYLOAD',
      'Nickname may only contain letters, numbers, spaces, underscores and hyphens.',
    )
  }
  return { ok: true, value: nickname }
}

export function isValidNickname(value: unknown): value is string {
  return sanitizeNickname(value).ok
}

export function isResumeToken(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= MAX_RESUME_TOKEN_LENGTH
    && RESUME_TOKEN_PATTERN.test(value)
}

export function isVec3(value: unknown): value is Vec3 {
  return isRecord(value)
    && isFiniteNumber(value.x)
    && isFiniteNumber(value.y)
    && isFiniteNumber(value.z)
}

export function isPositionInWorld(position: Vec3): boolean {
  return position.x >= WORLD_BOUNDS.min.x
    && position.x <= WORLD_BOUNDS.max.x
    && position.y >= WORLD_BOUNDS.min.y
    && position.y <= WORLD_BOUNDS.max.y
    && position.z >= WORLD_BOUNDS.min.z
    && position.z <= WORLD_BOUNDS.max.z
}

export function isPlayerAnimation(value: unknown): value is PlayerAnimation {
  return includesValue(PLAYER_ANIMATIONS, value)
}

export function isNucleusHeroId(value: unknown): value is NucleusHeroId {
  return includesValue(NUCLEUS_HERO_IDS, value)
}

export function isNucleusAbilitySlot(value: unknown): value is NucleusAbilitySlot {
  return includesValue(NUCLEUS_ABILITY_SLOTS, value)
}

export function isEmote(value: unknown): value is Emote {
  return includesValue(EMOTES, value)
}

export function isInteractionTarget(value: unknown): value is InteractionTarget {
  return includesValue(INTERACTION_TARGETS, value)
}

export function isInteractionAction(value: unknown): value is InteractionAction {
  return includesValue(INTERACTION_ACTIONS, value)
}

/** The protocol rejects valid-looking actions when they target the wrong object. */
export function isValidInteractionPair(
  target: unknown,
  action: unknown,
): target is InteractionTarget {
  return isInteractionTarget(target)
    && isInteractionAction(action)
    && INTERACTION_ACTION_BY_TARGET[target] === action
}

export function isAvatarAppearance(value: unknown): value is AvatarAppearance {
  return isRecord(value)
    && isSafeHexColor(value.bodyColor)
    && isSafeHexColor(value.accentColor)
    && isSafeHexColor(value.visorColor)
    && (value.visorStyle === undefined || includesValue(AVATAR_VISOR_STYLES, value.visorStyle))
    && (value.auraStyle === undefined || includesValue(AVATAR_AURA_STYLES, value.auraStyle))
    && (value.accentStyle === undefined || includesValue(AVATAR_ACCENT_STYLES, value.accentStyle))
}

function copyAppearance(appearance: AvatarAppearance): AvatarAppearance {
  return {
    bodyColor: appearance.bodyColor,
    accentColor: appearance.accentColor,
    visorColor: appearance.visorColor,
    ...(appearance.visorStyle === undefined ? {} : { visorStyle: appearance.visorStyle }),
    ...(appearance.auraStyle === undefined ? {} : { auraStyle: appearance.auraStyle }),
    ...(appearance.accentStyle === undefined ? {} : { accentStyle: appearance.accentStyle }),
  }
}

function parseObjectMessage(value: unknown): ValidationResult<ClientMessage> {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return failure('INVALID_PAYLOAD', 'Message must be an object with a type.')
  }

  switch (value.type) {
    case 'join': {
      if (value.version !== PROTOCOL_VERSION) {
        return failure('PROTOCOL_MISMATCH', `Protocol v${PROTOCOL_VERSION} is required.`)
      }
      const nickname = sanitizeNickname(value.nickname)
      if (!nickname.ok) return nickname
      if (!isAvatarAppearance(value.appearance)) {
        return failure('INVALID_PAYLOAD', 'Avatar appearance is invalid.')
      }
      if (value.resumeToken !== undefined && !isResumeToken(value.resumeToken)) {
        return failure('INVALID_PAYLOAD', 'Resume token is invalid.')
      }
      return {
        ok: true,
        value: {
          type: 'join',
          version: PROTOCOL_VERSION,
          nickname: nickname.value,
          appearance: copyAppearance(value.appearance),
          ...(value.resumeToken === undefined ? {} : { resumeToken: value.resumeToken }),
        },
      }
    }

    case 'change_activity': {
      if (!isActivityId(value.activityId)) {
        return failure('INVALID_PAYLOAD', 'Activity is invalid.')
      }
      if (value.portalId !== undefined && !isPortalId(value.portalId)) {
        return failure('INVALID_PAYLOAD', 'Activity portal is invalid.')
      }
      if (value.activityId !== 'nexus'
        && (value.portalId === undefined || !isActivityPortalPair(value.activityId, value.portalId))) {
        return failure('INVALID_PAYLOAD', 'Expedition activity requires its matching portal.')
      }
      if (value.activityId === 'nexus'
        && value.portalId !== undefined
        && !isActivityPortalPair(value.activityId, value.portalId)) {
        return failure('INVALID_PAYLOAD', 'Return portal does not lead to the Nexus.')
      }
      return {
        ok: true,
        value: {
          type: 'change_activity',
          activityId: value.activityId,
          ...(value.portalId === undefined ? {} : { portalId: value.portalId }),
        },
      }
    }

    case 'move': {
      if (!isVec3(value.position) || !isPositionInWorld(value.position)) {
        return failure('INVALID_PAYLOAD', 'Movement position is invalid or outside the world.')
      }
      if (!isFiniteNumber(value.yaw) || value.yaw < -Math.PI || value.yaw > Math.PI) {
        return failure('INVALID_PAYLOAD', 'Movement yaw must be between -PI and PI.')
      }
      if (!isPlayerAnimation(value.animation)) {
        return failure('INVALID_PAYLOAD', 'Movement animation is invalid.')
      }
      if (!Number.isSafeInteger(value.sequence) || (value.sequence as number) < 0) {
        return failure('INVALID_PAYLOAD', 'Movement sequence is invalid.')
      }
      if (!isSafeTimestamp(value.clientTime)) {
        return failure('INVALID_PAYLOAD', 'Movement timestamp is invalid.')
      }
      return {
        ok: true,
        value: {
          type: 'move',
          position: { x: value.position.x, y: value.position.y, z: value.position.z },
          yaw: value.yaw,
          animation: value.animation,
          sequence: value.sequence as number,
          clientTime: value.clientTime,
        },
      }
    }

    case 'activity_move': {
      if (!isExpeditionActivityId(value.activityId)
        || !isActivityRunPair(value.activityId, value.runId)) {
        return failure('INVALID_PAYLOAD', 'Activity movement identity is invalid.')
      }
      if (!isVec3(value.position) || !isPositionInActivity(value.activityId, value.position)) {
        return failure('INVALID_PAYLOAD', 'Activity movement position is outside its world.')
      }
      if (!isFiniteNumber(value.yaw) || value.yaw < -Math.PI || value.yaw > Math.PI) {
        return failure('INVALID_PAYLOAD', 'Activity movement yaw must be between -PI and PI.')
      }
      if (!isPlayerAnimation(value.animation)) {
        return failure('INVALID_PAYLOAD', 'Activity movement animation is invalid.')
      }
      if (!Number.isSafeInteger(value.sequence) || (value.sequence as number) < 0) {
        return failure('INVALID_PAYLOAD', 'Activity movement sequence is invalid.')
      }
      if (!isSafeTimestamp(value.clientTime)) {
        return failure('INVALID_PAYLOAD', 'Activity movement timestamp is invalid.')
      }
      return {
        ok: true,
        value: {
          type: 'activity_move',
          activityId: value.activityId,
          runId: value.runId as ActivityRunId,
          position: { x: value.position.x, y: value.position.y, z: value.position.z },
          yaw: value.yaw,
          animation: value.animation,
          sequence: value.sequence as number,
          clientTime: value.clientTime,
        },
      }
    }

    case 'nucleus_join': {
      if (!isActivityRunPair('nucleus-257', value.runId)) {
        return failure('INVALID_PAYLOAD', 'Nucleus combat run is invalid.')
      }
      if (!isNucleusHeroId(value.heroId)) {
        return failure('INVALID_PAYLOAD', 'Nucleus hero is invalid.')
      }
      return {
        ok: true,
        value: {
          type: 'nucleus_join',
          runId: value.runId as ActivityRunId,
          heroId: value.heroId,
        },
      }
    }

    case 'nucleus_leave': {
      if (!isActivityRunPair('nucleus-257', value.runId)) {
        return failure('INVALID_PAYLOAD', 'Nucleus combat run is invalid.')
      }
      return {
        ok: true,
        value: { type: 'nucleus_leave', runId: value.runId as ActivityRunId },
      }
    }

    case 'nucleus_cast': {
      if (!isActivityRunPair('nucleus-257', value.runId)) {
        return failure('INVALID_PAYLOAD', 'Nucleus combat run is invalid.')
      }
      if (typeof value.castId !== 'string' || !NUCLEUS_CAST_ID_PATTERN.test(value.castId)) {
        return failure('INVALID_PAYLOAD', 'Nucleus cast id is invalid.')
      }
      if (!isNucleusAbilitySlot(value.slot)) {
        return failure('INVALID_PAYLOAD', 'Nucleus ability slot is invalid.')
      }
      if (!isRecord(value.aim)
        || !isVec3(value.aim.direction)
        || !isUsableAimDirection(value.aim.direction)
        || (value.aim.point !== undefined
          && (!isVec3(value.aim.point)
            || !isPositionInActivity('nucleus-257', value.aim.point)))) {
        return failure('INVALID_PAYLOAD', 'Nucleus cast aim is invalid.')
      }
      if (!isSafeTimestamp(value.clientTime)) {
        return failure('INVALID_PAYLOAD', 'Nucleus cast timestamp is invalid.')
      }
      return {
        ok: true,
        value: {
          type: 'nucleus_cast',
          runId: value.runId as ActivityRunId,
          castId: value.castId,
          slot: value.slot,
          aim: {
            direction: copyVec3(value.aim.direction),
            ...(value.aim.point === undefined ? {} : { point: copyVec3(value.aim.point) }),
          },
          clientTime: value.clientTime,
        },
      }
    }

    case 'emote':
      if (!isEmote(value.emote)) {
        return failure('INVALID_PAYLOAD', 'Unknown emote.')
      }
      return { ok: true, value: { type: 'emote', emote: value.emote } }

    case 'interaction':
      if (!isValidInteractionPair(value.target, value.action)) {
        return failure('INVALID_PAYLOAD', 'Interaction action is invalid for this target.')
      }
      return {
        ok: true,
        value: {
          type: 'interaction',
          target: value.target,
          action: INTERACTION_ACTION_BY_TARGET[value.target],
        },
      }

    case 'party_state':
    case 'party_action': {
      if (!isActivityRunId(value.runId)) {
        return failure('INVALID_PAYLOAD', 'Party run id is invalid.')
      }
      if (typeof value.seq !== 'number' || !Number.isFinite(value.seq) || value.seq < 0) {
        return failure('INVALID_PAYLOAD', 'Party sequence is invalid.')
      }
      const limit = value.type === 'party_state' ? MAX_PARTY_STATE_BYTES : MAX_PARTY_ACTION_BYTES
      let encoded: string
      try {
        encoded = JSON.stringify(value.data)
      } catch {
        return failure('INVALID_PAYLOAD', 'Party payload is not serialisable.')
      }
      if (encoded === undefined || encoded.length > limit) {
        return failure('INVALID_PAYLOAD', 'Party payload is missing or too large.')
      }
      return {
        ok: true,
        value: {
          type: value.type,
          runId: value.runId as ActivityRunId,
          seq: value.seq,
          data: value.data,
        },
      }
    }

    case 'lobby_create': {
      if (!isExpeditionActivityId(value.activityId)) {
        return failure('INVALID_PAYLOAD', 'Lobby activity is invalid.')
      }
      return { ok: true, value: { type: 'lobby_create', activityId: value.activityId } }
    }

    case 'lobby_join': {
      if (typeof value.code !== 'string' || !LOBBY_CODE_PATTERN.test(value.code.toUpperCase())) {
        return failure('INVALID_PAYLOAD', 'Lobby code is invalid.')
      }
      return { ok: true, value: { type: 'lobby_join', code: value.code.toUpperCase() } }
    }

    case 'lobby_ready': {
      if (typeof value.ready !== 'boolean') {
        return failure('INVALID_PAYLOAD', 'Lobby readiness is invalid.')
      }
      return { ok: true, value: { type: 'lobby_ready', ready: value.ready } }
    }

    case 'lobby_leave':
      return { ok: true, value: { type: 'lobby_leave' } }

    case 'lobby_launch':
      return { ok: true, value: { type: 'lobby_launch' } }

    case 'ping':
      if (!isSafeTimestamp(value.clientTime)) {
        return failure('INVALID_PAYLOAD', 'Ping timestamp is invalid.')
      }
      return { ok: true, value: { type: 'ping', clientTime: value.clientTime } }

    default:
      return failure('UNKNOWN_MESSAGE', 'Unknown message type.')
  }
}

function decodeWireValue(raw: unknown, maxBytes: number): ValidationResult<unknown> {
  if (typeof raw === 'string') {
    if (new TextEncoder().encode(raw).byteLength > maxBytes) {
      return failure('MESSAGE_TOO_LARGE', `Messages are limited to ${maxBytes} bytes.`)
    }
    try {
      const decoded: unknown = JSON.parse(raw)
      return { ok: true, value: decoded }
    } catch {
      return failure('MALFORMED_JSON', 'Message is not valid JSON.')
    }
  }

  if (raw instanceof Uint8Array) {
    if (raw.byteLength > maxBytes) {
      return failure('MESSAGE_TOO_LARGE', `Messages are limited to ${maxBytes} bytes.`)
    }
    try {
      const decoded: unknown = JSON.parse(new TextDecoder().decode(raw))
      return { ok: true, value: decoded }
    } catch {
      return failure('MALFORMED_JSON', 'Message is not valid UTF-8 JSON.')
    }
  }

  return { ok: true, value: raw }
}

/** Parse and validate an untrusted client message (JSON text, bytes or value). */
export function parseClientMessage(raw: unknown): ValidationResult<ClientMessage> {
  const decoded = decodeWireValue(raw, MAX_MESSAGE_BYTES)
  if (!decoded.ok) return decoded
  return parseObjectMessage(decoded.value)
}

const PRIME_CORE_ENERGY_LEVELS = [
  'dormant',
  'awakened',
  'resonant',
  'accelerated',
  'overcharged',
] as const satisfies readonly PrimeCoreEnergyLevel[]
const PRIME_SEQUENCE_PHASES = [
  'idle',
  'voting',
  'revealed',
  'cooldown',
] as const satisfies readonly PrimeSequencePhase[]
const PLAYER_LEFT_REASONS = [
  'disconnect',
  'timeout',
  'room_change',
] as const satisfies readonly PlayerLeftReason[]
const SAFE_SERVER_ID_PATTERN = /^[a-zA-Z0-9:_-]{1,128}$/
const MAX_PROTOCOL_ERROR_LENGTH = 512

/** Parse, deeply validate and rebuild an untrusted server message. */
function rebuildLobbySnapshot(value: unknown): LobbySnapshot | null {
  if (!isRecord(value)) return null
  if (typeof value.code !== 'string' || !LOBBY_CODE_PATTERN.test(value.code)) return null
  if (!isExpeditionActivityId(value.activityId)) return null
  if (typeof value.hostId !== 'string') return null
  if (value.phase !== 'gathering' && value.phase !== 'launched' && value.phase !== 'closed') return null
  if (!Array.isArray(value.members) || value.members.length > 8) return null
  const members: LobbyMemberSnapshot[] = []
  for (const candidate of value.members) {
    if (!isRecord(candidate)
      || typeof candidate.playerId !== 'string'
      || typeof candidate.name !== 'string'
      || typeof candidate.ready !== 'boolean') return null
    members.push({ playerId: candidate.playerId, name: candidate.name, ready: candidate.ready })
  }
  return {
    code: value.code,
    activityId: value.activityId,
    hostId: value.hostId,
    phase: value.phase,
    members,
    runId: typeof value.runId === 'string' ? value.runId : null,
    seed: typeof value.seed === 'number' && Number.isFinite(value.seed) ? value.seed : null,
    canLaunch: value.canLaunch === true,
  }
}

export function parseServerMessage(raw: unknown): ValidationResult<ServerMessage> {
  const decoded = decodeWireValue(raw, MAX_SERVER_MESSAGE_BYTES)
  if (!decoded.ok) return decoded
  return parseServerObjectMessage(decoded.value)
}

function parseServerObjectMessage(value: unknown): ValidationResult<ServerMessage> {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return failure('INVALID_PAYLOAD', 'Server message must be an object with a type.')
  }

  switch (value.type) {
    case 'party_state':
    case 'party_action': {
      if (!isActivityRunId(value.runId)
        || typeof value.fromId !== 'string'
        || typeof value.seq !== 'number'
        || !Number.isFinite(value.seq)
        || !isSafeTimestamp(value.serverTime)) {
        return failure('INVALID_PAYLOAD', 'Party relay payload is invalid.')
      }
      return {
        ok: true,
        value: {
          type: value.type,
          runId: value.runId as ActivityRunId,
          fromId: value.fromId,
          seq: value.seq,
          data: value.data,
          serverTime: value.serverTime,
        },
      }
    }

    case 'lobby_state':
    case 'lobby_launched': {
      const lobby = rebuildLobbySnapshot(value.lobby)
      if (!lobby) return failure('INVALID_PAYLOAD', 'Lobby snapshot is invalid.')
      if (value.type === 'lobby_state') return { ok: true, value: { type: 'lobby_state', lobby } }
      if (typeof value.runId !== 'string' || !Number.isFinite(value.seed)) {
        return failure('INVALID_PAYLOAD', 'Lobby launch payload is invalid.')
      }
      return {
        ok: true,
        value: { type: 'lobby_launched', lobby, runId: value.runId, seed: value.seed as number },
      }
    }

    case 'lobby_closed': {
      if (typeof value.code !== 'string') return failure('INVALID_PAYLOAD', 'Lobby code is invalid.')
      return { ok: true, value: { type: 'lobby_closed', code: value.code } }
    }

    case 'welcome': {
      if (value.version !== PROTOCOL_VERSION) {
        return failure('PROTOCOL_MISMATCH', `Protocol v${PROTOCOL_VERSION} is required.`)
      }
      if (!isSafeServerId(value.playerId)
        || !isPrimeverseRoomId(value.roomId)
        || !isResumeToken(value.resumeToken)) {
        return failure('INVALID_PAYLOAD', 'Welcome player, room id or resume token is invalid.')
      }
      if (!Array.isArray(value.players) || value.players.length > ROOM_CAPACITY) {
        return failure('INVALID_PAYLOAD', 'Welcome player list is invalid.')
      }
      const players: PlayerSnapshot[] = []
      const playerIds = new Set<string>()
      for (const candidate of value.players) {
        const player = rebuildPlayerSnapshot(candidate)
        if (!player || playerIds.has(player.id)) {
          return failure('INVALID_PAYLOAD', 'Welcome player snapshot is invalid or duplicated.')
        }
        players.push(player)
        playerIds.add(player.id)
      }
      const world = rebuildWorldState(value.world)
      if (!world || !isSafeTimestamp(value.serverTime)) {
        return failure('INVALID_PAYLOAD', 'Welcome world state or timestamp is invalid.')
      }
      return {
        ok: true,
        value: {
          type: 'welcome',
          version: PROTOCOL_VERSION,
          playerId: value.playerId,
          roomId: value.roomId,
          resumeToken: value.resumeToken,
          players,
          world,
          serverTime: value.serverTime,
        },
      }
    }

    case 'player_joined': {
      const player = rebuildPlayerSnapshot(value.player)
      return player
        ? { ok: true, value: { type: 'player_joined', player } }
        : failure('INVALID_PAYLOAD', 'Joined player snapshot is invalid.')
    }

    case 'player_updated': {
      if (!isSafeServerId(value.playerId)
        || !isVec3(value.position)
        || !isPositionInWorld(value.position)
        || !isValidYaw(value.yaw)
        || !isPlayerAnimation(value.animation)
        || !isNonNegativeSafeInteger(value.sequence)
        || !isSafeTimestamp(value.serverTime)) {
        return failure('INVALID_PAYLOAD', 'Player update is invalid.')
      }
      return {
        ok: true,
        value: {
          type: 'player_updated',
          playerId: value.playerId,
          position: copyVec3(value.position),
          yaw: value.yaw,
          animation: value.animation,
          sequence: value.sequence,
          serverTime: value.serverTime,
        },
      }
    }

    case 'activity_changed': {
      if (!isSafeServerId(value.playerId)
        || !isActivityId(value.activityId)
        || !isActivityRunPair(value.activityId, value.runId)
        || !isSafeTimestamp(value.serverTime)
        || !isNonNegativeSafeInteger(value.sequence)) {
        return failure('INVALID_PAYLOAD', 'Player activity transition is invalid.')
      }
      return {
        ok: true,
        value: {
          type: 'activity_changed',
          playerId: value.playerId,
          activityId: value.activityId,
          runId: value.runId as ActivityRunId | null,
          serverTime: value.serverTime,
          sequence: value.sequence,
        },
      }
    }

    case 'activity_player_updated': {
      if (!isSafeServerId(value.playerId)
        || !isExpeditionActivityId(value.activityId)
        || !isActivityRunId(value.runId)
        || !isActivityRunPair(value.activityId, value.runId)
        || !isVec3(value.position)
        || !isPositionInActivity(value.activityId, value.position)
        || !isValidYaw(value.yaw)
        || !isPlayerAnimation(value.animation)
        || !isNonNegativeSafeInteger(value.sequence)
        || !isSafeTimestamp(value.serverTime)) {
        return failure('INVALID_PAYLOAD', 'Activity player update is invalid.')
      }
      return {
        ok: true,
        value: {
          type: 'activity_player_updated',
          playerId: value.playerId,
          activityId: value.activityId,
          runId: value.runId,
          position: copyVec3(value.position),
          yaw: value.yaw,
          animation: value.animation,
          sequence: value.sequence,
          serverTime: value.serverTime,
        },
      }
    }

    case 'nucleus_state': {
      const state = rebuildNucleusCombatState(value)
      return state
        ? { ok: true, value: state }
        : failure('INVALID_PAYLOAD', 'Nucleus combat state is invalid.')
    }

    case 'nucleus_event': {
      const event = rebuildNucleusCombatEventMessage(value)
      return event
        ? { ok: true, value: event }
        : failure('INVALID_PAYLOAD', 'Nucleus combat event is invalid.')
    }

    case 'player_left':
      if (!isSafeServerId(value.playerId) || !includesValue(PLAYER_LEFT_REASONS, value.reason)) {
        return failure('INVALID_PAYLOAD', 'Player departure is invalid.')
      }
      return {
        ok: true,
        value: { type: 'player_left', playerId: value.playerId, reason: value.reason },
      }

    case 'player_emote':
      if (!isSafeServerId(value.playerId)
        || !isEmote(value.emote)
        || !isSafeTimestamp(value.startedAt)
        || !isFiniteNumber(value.durationMs)
        || value.durationMs <= 0
        || value.durationMs > 60_000) {
        return failure('INVALID_PAYLOAD', 'Player emote is invalid.')
      }
      return {
        ok: true,
        value: {
          type: 'player_emote',
          playerId: value.playerId,
          emote: value.emote,
          startedAt: value.startedAt,
          durationMs: value.durationMs,
        },
      }

    case 'world_state': {
      const state = rebuildWorldState(value.state)
      return state
        ? { ok: true, value: { type: 'world_state', state } }
        : failure('INVALID_PAYLOAD', 'World state is invalid.')
    }

    case 'world_event': {
      const event = rebuildWorldEvent(value.event)
      return event
        ? { ok: true, value: { type: 'world_event', event } }
        : failure('INVALID_PAYLOAD', 'World event is invalid.')
    }

    case 'pong':
      if (!isSafeTimestamp(value.clientTime) || !isSafeTimestamp(value.serverTime)) {
        return failure('INVALID_PAYLOAD', 'Pong timestamps are invalid.')
      }
      return {
        ok: true,
        value: { type: 'pong', clientTime: value.clientTime, serverTime: value.serverTime },
      }

    case 'error':
      if (!includesValue(PROTOCOL_ERROR_CODES, value.code)
        || typeof value.message !== 'string'
        || value.message.length === 0
        || value.message.length > MAX_PROTOCOL_ERROR_LENGTH
        || typeof value.recoverable !== 'boolean') {
        return failure('INVALID_PAYLOAD', 'Protocol error packet is invalid.')
      }
      return {
        ok: true,
        value: {
          type: 'error',
          code: value.code,
          message: value.message,
          recoverable: value.recoverable,
        },
      }

    default:
      return failure('UNKNOWN_MESSAGE', 'Unknown server message type.')
  }
}

function rebuildPlayerSnapshot(value: unknown): PlayerSnapshot | null {
  if (!isRecord(value) || !isSafeServerId(value.id)) return null
  const nickname = sanitizeNickname(value.nickname)
  if (!nickname.ok
    || !isActivityId(value.activityId)
    || !isActivityRunPair(value.activityId, value.runId)
    || !isVec3(value.position)
    || !isPositionInActivity(value.activityId, value.position)
    || !isValidYaw(value.yaw)
    || !isPlayerAnimation(value.animation)
    || !isAvatarAppearance(value.appearance)
    || !isNonNegativeSafeInteger(value.sequence)
    || !isSafeTimestamp(value.updatedAt)) return null

  let emote: ActiveEmote | null = null
  if (value.emote !== null) {
    if (!isRecord(value.emote)
      || !isEmote(value.emote.kind)
      || !isSafeTimestamp(value.emote.startedAt)) return null
    emote = { kind: value.emote.kind, startedAt: value.emote.startedAt }
  }

  return {
    id: value.id,
    nickname: nickname.value,
    activityId: value.activityId,
    runId: value.runId as ActivityRunId | null,
    position: copyVec3(value.position),
    yaw: value.yaw,
    animation: value.animation,
    appearance: copyAppearance(value.appearance),
    emote,
    sequence: value.sequence,
    updatedAt: value.updatedAt,
  }
}

function rebuildNucleusCombatState(value: Record<string, unknown>): NucleusCombatState | null {
  if (!isActivityRunPair('nucleus-257', value.runId)
    || !isNonNegativeSafeInteger(value.revision)
    || !isSafeTimestamp(value.serverTime)
    || (value.phase !== 'waiting' && value.phase !== 'active')
    || !Array.isArray(value.players)
    || value.players.length > ROOM_CAPACITY
    || value.objective !== null) return null

  const players: NucleusCombatPlayer[] = []
  const ids = new Set<string>()
  for (const candidate of value.players) {
    const player = rebuildNucleusCombatPlayer(candidate)
    if (!player || ids.has(player.id)) return null
    ids.add(player.id)
    players.push(player)
  }
  if (value.phase !== nucleusCombatPhaseFor(players)) return null
  return {
    type: 'nucleus_state',
    runId: value.runId as ActivityRunId,
    revision: value.revision,
    serverTime: value.serverTime,
    phase: value.phase,
    players,
    objective: null,
  }
}

function rebuildNucleusCombatPlayer(value: unknown): NucleusCombatPlayer | null {
  if (!isRecord(value)
    || !isSafeServerId(value.id)
    || !isNucleusHeroId(value.heroId)
    || (value.team !== 'cipher' && value.team !== 'fracture')
    || typeof value.connected !== 'boolean'
    || !isVec3(value.position)
    || !isPositionInActivity('nucleus-257', value.position)
    || !isValidYaw(value.yaw)
    || !isBoundedCombatNumber(value.health, 0, 1_000)
    || !isBoundedCombatNumber(value.maxHealth, 1, 1_000)
    || value.health > value.maxHealth
    || !isBoundedCombatNumber(value.shield, 0, 1_000)
    || !isBoundedCombatNumber(value.maxShield, 0, 1_000)
    || value.shield > value.maxShield
    || typeof value.alive !== 'boolean'
    || value.alive !== (value.health > 0)
    || !isRecord(value.cooldownReadyAt)
    || !isBoundedCombatNumber(value.ultimateCharge, 0, 100)
    || !isNonNegativeSafeInteger(value.eliminations)
    || !isNonNegativeSafeInteger(value.deaths)
    || !isNullableSafeTimestamp(value.respawnAt)
    || !Array.isArray(value.statuses)
    || value.statuses.length > NUCLEUS_COMBAT_STATUS_IDS.length) return null

  const nickname = sanitizeNickname(value.nickname)
  if (!nickname.ok) return null
  const cooldownReadyAt = rebuildNucleusCooldownState(value.cooldownReadyAt)
  if (!cooldownReadyAt) return null
  const statuses: NucleusCombatStatus[] = []
  const statusIds = new Set<NucleusCombatStatusId>()
  for (const candidate of value.statuses) {
    if (!isRecord(candidate)
      || !includesValue(NUCLEUS_COMBAT_STATUS_IDS, candidate.id)
      || statusIds.has(candidate.id)
      || !isSafeTimestamp(candidate.expiresAt)
      || !isBoundedCombatNumber(candidate.magnitude, 0, 10)) return null
    statusIds.add(candidate.id)
    statuses.push({
      id: candidate.id,
      expiresAt: candidate.expiresAt,
      magnitude: candidate.magnitude,
    })
  }
  return {
    id: value.id,
    nickname: nickname.value,
    heroId: value.heroId,
    team: value.team,
    connected: value.connected,
    position: copyVec3(value.position),
    yaw: value.yaw,
    health: value.health,
    maxHealth: value.maxHealth,
    shield: value.shield,
    maxShield: value.maxShield,
    alive: value.alive,
    cooldownReadyAt,
    ultimateCharge: value.ultimateCharge,
    eliminations: value.eliminations,
    deaths: value.deaths,
    respawnAt: value.respawnAt,
    statuses,
  }
}

function rebuildNucleusCooldownState(
  value: Record<string, unknown>,
): NucleusCooldownState | null {
  if (Object.keys(value).length !== NUCLEUS_ABILITY_SLOTS.length) return null
  const result = {} as Record<NucleusAbilitySlot, number>
  for (const slot of NUCLEUS_ABILITY_SLOTS) {
    if (!isSafeTimestamp(value[slot])) return null
    result[slot] = value[slot]
  }
  return result
}

function rebuildNucleusCombatEventMessage(
  value: Record<string, unknown>,
): NucleusCombatEventMessage | null {
  if (!isActivityRunPair('nucleus-257', value.runId)
    || !isNonNegativeSafeInteger(value.revision)
    || !isSafeServerId(value.eventId)
    || !isSafeTimestamp(value.serverTime)) return null
  const event = rebuildNucleusCombatEvent(value.event)
  if (!event) return null
  return {
    type: 'nucleus_event',
    runId: value.runId as ActivityRunId,
    revision: value.revision,
    eventId: value.eventId,
    serverTime: value.serverTime,
    event,
  }
}

function rebuildNucleusCombatEvent(value: unknown): NucleusCombatEvent | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null
  if (value.kind === 'joined') {
    if (!isSafeServerId(value.playerId)
      || !isNucleusHeroId(value.heroId)
      || (value.team !== 'cipher' && value.team !== 'fracture')) return null
    return { kind: 'joined', playerId: value.playerId, heroId: value.heroId, team: value.team }
  }
  if (value.kind === 'left') {
    if (!isSafeServerId(value.playerId)
      || !includesValue(['selection', 'activity_change', 'disconnect', 'timeout'] as const, value.reason)) {
      return null
    }
    return { kind: 'left', playerId: value.playerId, reason: value.reason }
  }
  if (value.kind === 'respawned') {
    if (!isSafeServerId(value.playerId)
      || !isVec3(value.position)
      || !isPositionInActivity('nucleus-257', value.position)) return null
    return { kind: 'respawned', playerId: value.playerId, position: copyVec3(value.position) }
  }
  if (value.kind !== 'cast'
    || !isSafeServerId(value.casterId)
    || typeof value.castId !== 'string'
    || !NUCLEUS_CAST_ID_PATTERN.test(value.castId)
    || typeof value.abilityId !== 'string'
    || !/^[a-z0-9-]{1,64}$/.test(value.abilityId)
    || !isNucleusAbilitySlot(value.slot)
    || !isVec3(value.origin)
    || !isPositionInActivity('nucleus-257', value.origin)
    || !isVec3(value.direction)
    || !isUsableAimDirection(value.direction)
    || (value.point !== undefined
      && (!isVec3(value.point) || !isPositionInActivity('nucleus-257', value.point)))
    || (value.destination !== undefined
      && (!isVec3(value.destination) || !isPositionInActivity('nucleus-257', value.destination)))
    || !Array.isArray(value.hitIds)
    || value.hitIds.length > ROOM_CAPACITY
    || !Array.isArray(value.damages)
    || value.damages.length > ROOM_CAPACITY
    || !Array.isArray(value.eliminatedIds)
    || value.eliminatedIds.length > ROOM_CAPACITY) return null

  const hitIds = rebuildUniquePlayerIds(value.hitIds)
  const eliminatedIds = rebuildUniquePlayerIds(value.eliminatedIds)
  if (!hitIds || !eliminatedIds) return null
  const damages: NucleusDamageEvent[] = []
  const damagedIds = new Set<string>()
  for (const candidate of value.damages) {
    if (!isRecord(candidate)
      || !isSafeServerId(candidate.sourceId)
      || !isSafeServerId(candidate.targetId)
      || damagedIds.has(candidate.targetId)
      || !isBoundedCombatNumber(candidate.amount, 0, 1_000)
      || !isBoundedCombatNumber(candidate.absorbedByShield, 0, 1_000)
      || !isBoundedCombatNumber(candidate.health, 0, 1_000)
      || !isBoundedCombatNumber(candidate.shield, 0, 1_000)
      || typeof candidate.eliminated !== 'boolean') return null
    damagedIds.add(candidate.targetId)
    damages.push({
      sourceId: candidate.sourceId,
      targetId: candidate.targetId,
      amount: candidate.amount,
      absorbedByShield: candidate.absorbedByShield,
      health: candidate.health,
      shield: candidate.shield,
      eliminated: candidate.eliminated,
    })
  }
  return {
    kind: 'cast',
    casterId: value.casterId,
    castId: value.castId,
    abilityId: value.abilityId,
    slot: value.slot,
    origin: copyVec3(value.origin),
    direction: copyVec3(value.direction),
    ...(value.point === undefined ? {} : { point: copyVec3(value.point) }),
    ...(value.destination === undefined ? {} : { destination: copyVec3(value.destination) }),
    hitIds,
    damages,
    eliminatedIds,
  }
}

function rebuildUniquePlayerIds(value: readonly unknown[]): string[] | null {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const candidate of value) {
    if (!isSafeServerId(candidate) || seen.has(candidate)) return null
    seen.add(candidate)
    ids.push(candidate)
  }
  return ids
}

function rebuildWorldState(value: unknown): WorldState | null {
  if (!isRecord(value) || !isSafeTimestamp(value.serverTime)) return null
  const core = rebuildPrimeCoreState(value.core)
  const sequence = rebuildPrimeSequenceState(value.sequence)
  if (!core || !sequence) return null
  return { serverTime: value.serverTime, core, sequence }
}

function rebuildPrimeCoreState(value: unknown): PrimeCoreState | null {
  if (!isRecord(value)
    || !isNonNegativeSafeInteger(value.nearbyPlayers)
    || value.nearbyPlayers > ROOM_CAPACITY
    || !includesValue(PRIME_CORE_ENERGY_LEVELS, value.energyLevel)
    || !isFiniteNumber(value.intensity)
    || value.intensity < 0
    || value.intensity > 1
    || !isFiniteNumber(value.ringSpeed)
    || value.ringSpeed < 0
    || value.ringSpeed > 20) return null
  return {
    nearbyPlayers: value.nearbyPlayers,
    energyLevel: value.energyLevel,
    intensity: value.intensity,
    ringSpeed: value.ringSpeed,
  }
}

function rebuildPrimeSequenceState(value: unknown): PrimeSequenceState | null {
  if (!isRecord(value)
    || !isNonNegativeSafeInteger(value.round)
    || !includesValue(PRIME_SEQUENCE_PHASES, value.phase)
    || !isNullableSafeTimestamp(value.startedAt)
    || !isNullableSafeTimestamp(value.phaseEndsAt)
    || !isRecord(value.votesByPlayer)
    || !isRecord(value.voteCounts)
    || !isNonNegativeSafeInteger(value.totalVotes)
    || !isNullablePrimeChoice(value.winningChoice)
    || !isNullablePrimeChoice(value.revealedAnswer)
    || (value.success !== null && typeof value.success !== 'boolean')) return null

  const votesByPlayer: Record<string, PrimeSequenceChoice> = {}
  const calculatedCounts: Record<PrimeSequenceChoice, number> = { 12: 0, 13: 0, 15: 0, 17: 0 }
  for (const [playerId, rawChoice] of Object.entries(value.votesByPlayer)) {
    if (!isSafeServerId(playerId) || !includesValue(PRIME_SEQUENCE_CHOICES, rawChoice)) return null
    votesByPlayer[playerId] = rawChoice
    calculatedCounts[rawChoice] += 1
  }
  if (Object.keys(votesByPlayer).length > ROOM_CAPACITY
    || Object.keys(votesByPlayer).length !== value.totalVotes) return null

  const voteCounts: Record<PrimeSequenceChoice, number> = { 12: 0, 13: 0, 15: 0, 17: 0 }
  for (const choice of PRIME_SEQUENCE_CHOICES) {
    const count = value.voteCounts[String(choice)]
    if (!isNonNegativeSafeInteger(count) || count !== calculatedCounts[choice]) return null
    voteCounts[choice] = count
  }
  if (Object.keys(value.voteCounts).some((key) => !PRIME_SEQUENCE_CHOICES.includes(Number(key) as PrimeSequenceChoice))) {
    return null
  }

  return {
    round: value.round,
    phase: value.phase,
    startedAt: value.startedAt,
    phaseEndsAt: value.phaseEndsAt,
    votesByPlayer,
    voteCounts,
    totalVotes: value.totalVotes,
    winningChoice: value.winningChoice,
    revealedAnswer: value.revealedAnswer,
    success: value.success,
  }
}

function rebuildWorldEvent(value: unknown): WorldEvent | null {
  if (!isRecord(value) || typeof value.kind !== 'string' || !isSafeTimestamp(value.at)) return null
  switch (value.kind) {
    case 'sequence_started':
      if (!isNonNegativeSafeInteger(value.round) || !isSafeTimestamp(value.phaseEndsAt)) return null
      return { kind: value.kind, round: value.round, phaseEndsAt: value.phaseEndsAt, at: value.at }
    case 'sequence_vote': {
      if (!isNonNegativeSafeInteger(value.round)
        || !isSafeServerId(value.playerId)
        || !includesValue(PRIME_SEQUENCE_CHOICES, value.choice)) return null
      const voteCounts = rebuildVoteCounts(value.voteCounts)
      if (!voteCounts) return null
      return {
        kind: value.kind,
        round: value.round,
        playerId: value.playerId,
        choice: value.choice,
        voteCounts,
        at: value.at,
      }
    }
    case 'sequence_revealed':
      if (!isNonNegativeSafeInteger(value.round)
        || value.answer !== PRIME_SEQUENCE_ANSWER
        || !isNullablePrimeChoice(value.winningChoice)
        || typeof value.success !== 'boolean'
        || (value.effect !== null && value.effect !== 'prime-wave')) return null
      return {
        kind: value.kind,
        round: value.round,
        answer: PRIME_SEQUENCE_ANSWER,
        winningChoice: value.winningChoice,
        success: value.success,
        effect: value.effect,
        at: value.at,
      }
    case 'sequence_cooldown':
      if (!isNonNegativeSafeInteger(value.round) || !isSafeTimestamp(value.phaseEndsAt)) return null
      return { kind: value.kind, round: value.round, phaseEndsAt: value.phaseEndsAt, at: value.at }
    case 'sequence_reset':
      if (!isNonNegativeSafeInteger(value.round)) return null
      return { kind: value.kind, round: value.round, at: value.at }
    case 'core_energy_changed': {
      const core = rebuildPrimeCoreState(value.core)
      return core ? { kind: value.kind, core, at: value.at } : null
    }
    default:
      return null
  }
}

function rebuildVoteCounts(value: unknown): PrimeSequenceVoteCounts | null {
  if (!isRecord(value)) return null
  const result: Record<PrimeSequenceChoice, number> = { 12: 0, 13: 0, 15: 0, 17: 0 }
  let total = 0
  for (const choice of PRIME_SEQUENCE_CHOICES) {
    const count = value[String(choice)]
    if (!isNonNegativeSafeInteger(count)) return null
    result[choice] = count
    total += count
  }
  if (total > ROOM_CAPACITY
    || Object.keys(value).some((key) => !PRIME_SEQUENCE_CHOICES.includes(Number(key) as PrimeSequenceChoice))) {
    return null
  }
  return result
}

function isSafeServerId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_SERVER_ID_PATTERN.test(value)
}

function isPrimeverseRoomId(value: unknown): value is string {
  return typeof value === 'string' && /^primeverse-\d{3}$/.test(value)
}

function isValidYaw(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -Math.PI && value <= Math.PI
}

function isUsableAimDirection(value: Vec3): boolean {
  const magnitude = Math.hypot(value.x, value.y, value.z)
  return magnitude >= 0.5 && magnitude <= 1.5
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isBoundedCombatNumber(value: unknown, minimum: number, maximum: number): value is number {
  return isFiniteNumber(value) && value >= minimum && value <= maximum
}

function isNullableSafeTimestamp(value: unknown): value is number | null {
  return value === null || isSafeTimestamp(value)
}

function isNullablePrimeChoice(value: unknown): value is PrimeSequenceChoice | null {
  return value === null || includesValue(PRIME_SEQUENCE_CHOICES, value)
}

function copyVec3(value: Vec3): Vec3 {
  return { x: value.x, y: value.y, z: value.z }
}

export function validateMovement(
  previous: Pick<PlayerSnapshot, 'position' | 'sequence'>,
  movement: PlayerMovement,
  elapsedMs: number,
  budget: MovementBudget = createMovementBudget(false),
  positionAllowed: (position: Vec3) => boolean = (position) => (
    isPositionInWorld(position)
      && isInsideRealm([position.x, position.y, position.z])
  ),
  profile: ActivityMovementProfile = ACTIVITY_MOVEMENT_PROFILES.nexus,
  allowDiscontinuity = false,
): MovementValidationResult {
  const safeBudget = normalizeMovementBudget(budget, profile)
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return {
      ok: false,
      reason: 'invalid_elapsed',
      horizontalSpeed: 0,
      verticalSpeed: 0,
      nextBudget: safeBudget,
    }
  }

  if (movement.sequence <= previous.sequence) {
    return {
      ok: false,
      reason: 'stale_sequence',
      horizontalSpeed: 0,
      verticalSpeed: 0,
      nextBudget: safeBudget,
    }
  }

  if (!positionAllowed(movement.position)) {
    return {
      ok: false,
      reason: 'out_of_bounds',
      horizontalSpeed: 0,
      verticalSpeed: 0,
      nextBudget: safeBudget,
    }
  }

  const dx = movement.position.x - previous.position.x
  const dy = movement.position.y - previous.position.y
  const dz = movement.position.z - previous.position.z
  const horizontalDistance = Math.hypot(dx, dz)
  const totalDistance = Math.hypot(dx, dy, dz)
  const elapsedSeconds = Math.min(elapsedMs, MAX_MOVEMENT_ELAPSED_MS) / 1_000
  const horizontalSpeed = horizontalDistance / elapsedSeconds
  const verticalSpeed = Math.abs(dy) / elapsedSeconds
  const discontinuityAllowed = allowDiscontinuity
    && isMovementDiscontinuityAllowed(
      previous.position,
      movement.position,
      totalDistance,
      profile,
    )

  if (totalDistance > profile.maxPositionDelta) {
    if (discontinuityAllowed) {
      return acceptedMovementDiscontinuity(horizontalSpeed, verticalSpeed, profile)
    }
    return {
      ok: false,
      reason: 'position_delta',
      horizontalSpeed,
      verticalSpeed,
      nextBudget: safeBudget,
    }
  }

  const horizontalLimit = movement.animation === 'run' || movement.animation === 'jump'
    ? profile.maxRunSpeed
    : profile.maxWalkSpeed
  const horizontalAllowance = horizontalLimit * elapsedSeconds
  if (horizontalDistance > horizontalAllowance + safeBudget.horizontal) {
    if (discontinuityAllowed) {
      return acceptedMovementDiscontinuity(horizontalSpeed, verticalSpeed, profile)
    }
    return {
      ok: false,
      reason: 'horizontal_speed',
      horizontalSpeed,
      verticalSpeed,
      nextBudget: safeBudget,
    }
  }

  const verticalLimit = dy >= 0 ? profile.maxJumpSpeed : profile.maxFallSpeed
  const verticalAllowance = verticalLimit * elapsedSeconds
  if (Math.abs(dy) > verticalAllowance + safeBudget.vertical) {
    if (discontinuityAllowed) {
      return acceptedMovementDiscontinuity(horizontalSpeed, verticalSpeed, profile)
    }
    return {
      ok: false,
      reason: 'vertical_speed',
      horizontalSpeed,
      verticalSpeed,
      nextBudget: safeBudget,
    }
  }

  return {
    ok: true,
    horizontalSpeed,
    verticalSpeed,
    discontinuity: false,
    nextBudget: {
      horizontal: updateMovementCredit(
        safeBudget.horizontal,
        horizontalAllowance,
        horizontalDistance,
        profile.horizontalGraceDistance,
      ),
      vertical: updateMovementCredit(
        safeBudget.vertical,
        verticalAllowance,
        Math.abs(dy),
        profile.verticalGraceDistance,
      ),
    },
  }
}

function isMovementDiscontinuityAllowed(
  previous: Vec3,
  next: Vec3,
  distance: number,
  profile: ActivityMovementProfile,
): boolean {
  if (distance <= 0 || distance > profile.maxDiscontinuityDistance) return false
  const unrestrictedDistance = profile.unrestrictedDiscontinuityDistance
    ?? (profile.discontinuityLandings ? 0 : profile.maxDiscontinuityDistance)
  if (distance <= unrestrictedDistance) return true
  if (!profile.discontinuityLandings || profile.discontinuityLandings.length === 0) return false
  return profile.discontinuityLandings.some(({ center, radius }) => (
    Math.hypot(next.x - center.x, next.y - center.y, next.z - center.z) <= radius
      && Math.hypot(previous.x - next.x, previous.y - next.y, previous.z - next.z) > radius
  ))
}

function acceptedMovementDiscontinuity(
  horizontalSpeed: number,
  verticalSpeed: number,
  profile: ActivityMovementProfile,
): MovementValidationResult {
  return {
    ok: true,
    horizontalSpeed,
    verticalSpeed,
    discontinuity: true,
    // A checkpoint/blink is not allowed to consume or manufacture continuous
    // movement credit. The next ordinary packet starts from a clean budget.
    nextBudget: createMovementBudget(true, profile),
  }
}

/**
 * Creates the per-session burst budget. Set `withInitialCredit` to false for
 * stateless validation; authoritative servers should carry the returned
 * `nextBudget` forward after every accepted movement.
 */
export function createMovementBudget(
  withInitialCredit = true,
  profile: ActivityMovementProfile = ACTIVITY_MOVEMENT_PROFILES.nexus,
): MovementBudget {
  return withInitialCredit
    ? {
        horizontal: profile.horizontalGraceDistance,
        vertical: profile.verticalGraceDistance,
      }
    : { horizontal: 0, vertical: 0 }
}

function normalizeMovementBudget(
  value: MovementBudget,
  profile: ActivityMovementProfile,
): MovementBudget {
  return {
    horizontal: Number.isFinite(value.horizontal)
      ? Math.max(0, Math.min(profile.horizontalGraceDistance, value.horizontal))
      : 0,
    vertical: Number.isFinite(value.vertical)
      ? Math.max(0, Math.min(profile.verticalGraceDistance, value.vertical))
      : 0,
  }
}

function updateMovementCredit(
  current: number,
  baseAllowance: number,
  travelled: number,
  maximum: number,
): number {
  const consumed = Math.max(0, travelled - baseAllowance)
  const restored = Math.max(0, baseAllowance - travelled)
  return Math.max(0, Math.min(maximum, current - consumed + restored))
}

export function createAvatarAppearance(seed: number): AvatarAppearance {
  const safeSeed = Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) : 0
  return {
    bodyColor: AVATAR_BODY_COLORS[safeSeed % AVATAR_BODY_COLORS.length],
    accentColor: AVATAR_ACCENT_COLORS[safeSeed % AVATAR_ACCENT_COLORS.length],
    visorColor: AVATAR_ACCENT_COLORS[(safeSeed + 2) % AVATAR_ACCENT_COLORS.length],
    visorStyle: AVATAR_VISOR_STYLES[safeSeed % AVATAR_VISOR_STYLES.length],
    auraStyle: AVATAR_AURA_STYLES[Math.floor(safeSeed / 3) % AVATAR_AURA_STYLES.length],
    accentStyle: AVATAR_ACCENT_STYLES[Math.floor(safeSeed / 5) % AVATAR_ACCENT_STYLES.length],
  }
}

export function choiceFromInteractionTarget(
  target: InteractionTarget,
): PrimeSequenceChoice | null {
  switch (target) {
    case 'pedestal-12': return 12
    case 'pedestal-13': return 13
    case 'pedestal-15': return 15
    case 'pedestal-17': return 17
    default: return null
  }
}
