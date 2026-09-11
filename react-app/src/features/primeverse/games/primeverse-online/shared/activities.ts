import { PORTAL_IDS, type PortalId } from './realms'

export const ACTIVITY_IDS = [
  'nexus',
  'ulam-rift',
  'euclid-siege',
  'sieve-catacombs',
  'nucleus-257',
  'primebound',
] as const

export type ActivityId = (typeof ACTIVITY_IDS)[number]
export type ExpeditionActivityId = Exclude<ActivityId, 'nexus'>
export type ActivityRunId = `run:${string}:${ExpeditionActivityId}`

export interface ActivityPosition {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface ActivityBounds {
  readonly min: ActivityPosition
  readonly max: ActivityPosition
}

export interface ActivityMovementLanding {
  readonly center: ActivityPosition
  readonly radius: number
}

/**
 * Server-side movement envelope for presence replication. These values do not
 * replace a game's collision or combat rules; they only keep a legitimate
 * local transform from becoming permanently desynchronised.
 *
 * A discontinuity is still sequence-, rate-, run- and bounds-checked. The
 * cooldown prevents it from becoming sustained arbitrary movement, while
 * optional landing zones restrict checkpoint/level transitions to known
 * destinations.
 */
export interface ActivityMovementProfile {
  readonly maxWalkSpeed: number
  readonly maxRunSpeed: number
  readonly maxJumpSpeed: number
  readonly maxFallSpeed: number
  readonly maxPositionDelta: number
  readonly horizontalGraceDistance: number
  readonly verticalGraceDistance: number
  /** Distance that may land anywhere (for explicit short dashes/blinks). */
  readonly unrestrictedDiscontinuityDistance?: number
  /** Maximum distance when the destination matches a known landing. */
  readonly maxDiscontinuityDistance: number
  readonly discontinuityCooldownMs: number
  readonly discontinuityLandings?: readonly ActivityMovementLanding[]
}

/**
 * Authoritative activity reached by every Primeverse portal. Legacy return
 * portals remain represented so old realm travel and the v2 activity protocol
 * can coexist while standalone games are migrated.
 */
export const ACTIVITY_BY_PORTAL = Object.freeze({
  'portal-ulam': 'ulam-rift',
  'portal-forge': 'euclid-siege',
  'portal-nexus-ulam': 'nexus',
  'portal-nexus-forge': 'nexus',
  'portal-catacombs': 'sieve-catacombs',
  'portal-nucleus': 'nucleus-257',
  'portal-nexus-catacombs': 'nexus',
  'portal-primebound': 'primebound',
} as const satisfies Readonly<Record<PortalId, ActivityId>>)

export const ENTRY_PORTAL_BY_ACTIVITY = Object.freeze({
  'ulam-rift': 'portal-ulam',
  'euclid-siege': 'portal-forge',
  'sieve-catacombs': 'portal-catacombs',
  'nucleus-257': 'portal-nucleus',
  primebound: 'portal-primebound',
} as const satisfies Readonly<Record<ExpeditionActivityId, PortalId>>)

export const ACTIVITY_SPAWNS = Object.freeze({
  nexus: Object.freeze({ x: 0, y: 0.04, z: 13 }),
  'ulam-rift': Object.freeze({ x: 0, y: 1.12, z: 14 }),
  'euclid-siege': Object.freeze({ x: 0, y: 0.05, z: 7.5 }),
  'sieve-catacombs': Object.freeze({ x: 0, y: 0.04, z: 24 }),
  'nucleus-257': Object.freeze({ x: 0, y: 0.05, z: 20 }),
  // Primebound presence maps its 2D pixel world onto the plane at 1/24 scale:
  // x stays x, the pixel y axis becomes z, and everyone stands at ground level.
  primebound: Object.freeze({ x: 4, y: 0, z: 10 }),
} as const satisfies Readonly<Record<ActivityId, ActivityPosition>>)

/**
 * Broad network envelopes, not collision geometry. Individual games continue
 * to resolve walls and floors locally; the server rejects impossible/world-
 * scale transforms before relaying them.
 */
export const ACTIVITY_BOUNDS = Object.freeze({
  nexus: Object.freeze({
    min: Object.freeze({ x: -120, y: -30, z: -132 }),
    max: Object.freeze({ x: 120, y: 60, z: 120 }),
  }),
  'ulam-rift': Object.freeze({
    min: Object.freeze({ x: -40, y: -40, z: -260 }),
    max: Object.freeze({ x: 40, y: 80, z: 40 }),
  }),
  'euclid-siege': Object.freeze({
    min: Object.freeze({ x: -55, y: -20, z: -55 }),
    max: Object.freeze({ x: 55, y: 45, z: 55 }),
  }),
  'sieve-catacombs': Object.freeze({
    min: Object.freeze({ x: -80, y: -20, z: -110 }),
    max: Object.freeze({ x: 80, y: 35, z: 60 }),
  }),
  'nucleus-257': Object.freeze({
    min: Object.freeze({ x: -40, y: -12, z: -40 }),
    max: Object.freeze({ x: 40, y: 35, z: 40 }),
  }),
  primebound: Object.freeze({
    min: Object.freeze({ x: -10, y: -2, z: -10 }),
    max: Object.freeze({ x: 310, y: 6, z: 60 }),
  }),
} as const satisfies Readonly<Record<ActivityId, ActivityBounds>>)

const ULAM_RESPAWN_LANDINGS = Object.freeze([
  Object.freeze({ center: ACTIVITY_SPAWNS['ulam-rift'], radius: 2 }),
  Object.freeze({ center: Object.freeze({ x: -3.21885, y: 10.5, z: -33.75 }), radius: 2 }),
  Object.freeze({ center: Object.freeze({ x: -1.32448, y: 21.22, z: -90.95 }), radius: 2 }),
  Object.freeze({ center: Object.freeze({ x: 0.97641, y: 31.94, z: -148.15 }), radius: 2 }),
  Object.freeze({ center: Object.freeze({ x: 2.97223, y: 44, z: -212.5 }), radius: 2 }),
] as const satisfies readonly ActivityMovementLanding[])

const CATACOMBS_LEVEL_LANDINGS = Object.freeze([
  Object.freeze({ center: Object.freeze({ x: 0, y: 0, z: 24 }), radius: 2 }),
  Object.freeze({ center: Object.freeze({ x: 0, y: 0, z: 26 }), radius: 2 }),
  Object.freeze({ center: Object.freeze({ x: 0, y: 0, z: 27 }), radius: 2 }),
  Object.freeze({ center: Object.freeze({ x: 0, y: 0, z: 20 }), radius: 2 }),
] as const satisfies readonly ActivityMovementLanding[])

const EUCLID_RESTART_LANDINGS = Object.freeze([
  Object.freeze({ center: ACTIVITY_SPAWNS['euclid-siege'], radius: 1.25 }),
] as const satisfies readonly ActivityMovementLanding[])

const NUCLEUS_RESPAWN_LANDINGS = Object.freeze([
  Object.freeze({ center: Object.freeze({ x: 0, y: 0.05, z: 20 }), radius: 1.25 }),
  Object.freeze({ center: Object.freeze({ x: -19, y: 0.05, z: -2 }), radius: 1.25 }),
  Object.freeze({ center: Object.freeze({ x: 18, y: 0.05, z: -7 }), radius: 1.25 }),
  Object.freeze({ center: Object.freeze({ x: 3, y: 0.05, z: -21 }), radius: 1.25 }),
] as const satisfies readonly ActivityMovementLanding[])

/**
 * Activity-specific authoritative movement profiles. Ulam accounts for its
 * 9.2 m/s sprint, hazard impulse and long fall. Nucleus accounts for every
 * hero's sprint and the 18-unit cryptographic blink. Large Ulam/Catacombs
 * transitions and Euclid/Nucleus restarts must land at a known destination;
 * all discontinuities are cooldown-gated by the server.
 */
export const ACTIVITY_MOVEMENT_PROFILES = Object.freeze({
  nexus: Object.freeze({
    maxWalkSpeed: 5,
    maxRunSpeed: 9,
    maxJumpSpeed: 11,
    maxFallSpeed: 18,
    maxPositionDelta: 12,
    horizontalGraceDistance: 0.35,
    verticalGraceDistance: 0.5,
    maxDiscontinuityDistance: 0,
    discontinuityCooldownMs: Number.POSITIVE_INFINITY,
  }),
  'ulam-rift': Object.freeze({
    maxWalkSpeed: 6,
    maxRunSpeed: 10,
    maxJumpSpeed: 12,
    maxFallSpeed: 55,
    maxPositionDelta: 14,
    horizontalGraceDistance: 1.5,
    verticalGraceDistance: 0.75,
    maxDiscontinuityDistance: 320,
    discontinuityCooldownMs: 750,
    discontinuityLandings: ULAM_RESPAWN_LANDINGS,
  }),
  'euclid-siege': Object.freeze({
    maxWalkSpeed: 5,
    maxRunSpeed: 9,
    maxJumpSpeed: 11,
    maxFallSpeed: 18,
    maxPositionDelta: 12,
    horizontalGraceDistance: 0.35,
    verticalGraceDistance: 0.5,
    maxDiscontinuityDistance: 50,
    discontinuityCooldownMs: 2_500,
    discontinuityLandings: EUCLID_RESTART_LANDINGS,
  }),
  'sieve-catacombs': Object.freeze({
    maxWalkSpeed: 5,
    maxRunSpeed: 9,
    maxJumpSpeed: 11,
    maxFallSpeed: 18,
    maxPositionDelta: 12,
    horizontalGraceDistance: 0.35,
    verticalGraceDistance: 0.5,
    maxDiscontinuityDistance: 100,
    discontinuityCooldownMs: 2_500,
    discontinuityLandings: CATACOMBS_LEVEL_LANDINGS,
  }),
  'nucleus-257': Object.freeze({
    maxWalkSpeed: 7.75,
    maxRunSpeed: 10.25,
    maxJumpSpeed: 9,
    maxFallSpeed: 22,
    maxPositionDelta: 12,
    horizontalGraceDistance: 0.5,
    verticalGraceDistance: 0.5,
    unrestrictedDiscontinuityDistance: 18.05,
    maxDiscontinuityDistance: 60,
    discontinuityCooldownMs: 3_000,
    discontinuityLandings: NUCLEUS_RESPAWN_LANDINGS,
  }),
  primebound: Object.freeze({
    // 72 px/s walk and roughly 3x dash, divided by the 24 px/unit presence scale.
    maxWalkSpeed: 3.4,
    maxRunSpeed: 9.5,
    maxJumpSpeed: 4,
    maxFallSpeed: 8,
    maxPositionDelta: 11,
    horizontalGraceDistance: 0.4,
    verticalGraceDistance: 0.5,
    // Area gates teleport across the map; each region entrance is a landing.
    maxDiscontinuityDistance: 220,
    discontinuityCooldownMs: 2_500,
  }),
} as const satisfies Readonly<Record<ActivityId, ActivityMovementProfile>>)

const RUN_ID_PATTERN = /^run:([a-zA-Z0-9_-]{1,64}):(ulam-rift|euclid-siege|sieve-catacombs|nucleus-257)$/
const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/

export function isActivityId(value: unknown): value is ActivityId {
  return typeof value === 'string' && (ACTIVITY_IDS as readonly string[]).includes(value)
}

export function isExpeditionActivityId(value: unknown): value is ExpeditionActivityId {
  return isActivityId(value) && value !== 'nexus'
}

export function isPortalId(value: unknown): value is PortalId {
  return typeof value === 'string' && (PORTAL_IDS as readonly string[]).includes(value)
}

export function activityForPortal(portalId: PortalId): ActivityId {
  return ACTIVITY_BY_PORTAL[portalId]
}

export function isActivityPortalPair(activityId: ActivityId, portalId: PortalId): boolean {
  return ACTIVITY_BY_PORTAL[portalId] === activityId
}

export function createActivityRunId(
  roomId: string,
  activityId: ActivityId,
): ActivityRunId | null {
  if (activityId === 'nexus') return null
  if (!ROOM_ID_PATTERN.test(roomId)) throw new TypeError('roomId is not safe for an activity run id.')
  return `run:${roomId}:${activityId}`
}

export function isActivityRunId(value: unknown): value is ActivityRunId {
  return typeof value === 'string' && RUN_ID_PATTERN.test(value)
}

export function isActivityRunPair(activityId: unknown, runId: unknown): boolean {
  if (!isActivityId(activityId)) return false
  if (activityId === 'nexus') return runId === null
  if (!isActivityRunId(runId)) return false
  const match = RUN_ID_PATTERN.exec(runId)
  return match?.[2] === activityId
}

export function isPositionInActivity(
  activityId: ActivityId,
  position: ActivityPosition,
): boolean {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) {
    return false
  }
  const bounds = ACTIVITY_BOUNDS[activityId]
  return position.x >= bounds.min.x
    && position.x <= bounds.max.x
    && position.y >= bounds.min.y
    && position.y <= bounds.max.y
    && position.z >= bounds.min.z
    && position.z <= bounds.max.z
}
