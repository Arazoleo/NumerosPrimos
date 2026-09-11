import {
  BACKROOMS_LIMITS,
  BACKROOMS_PLAYER_RADIUS,
  BACKROOMS_START,
  isBackroomsPositionWalkable,
  resolveBackroomsMovement,
} from './backrooms'
import {
  CAESAR_POSITION,
  MODULAR_POSITION,
  PRIME_BOX_POSITION,
  RSA_VAULT_POSITION,
  SPECTRAL_PLAQUE_POSITION,
} from './components/layout'
import type { EscapePhase } from './types'

export interface EscapePosition2D {
  readonly x: number
  readonly z: number
}

export const ESCAPE_PLAYER_START: EscapePosition2D = {
  x: BACKROOMS_START.x,
  z: BACKROOMS_START.z,
}

export const ESCAPE_WORLD_BOUNDS = BACKROOMS_LIMITS

interface EscapeObstacle {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

function around(
  position: readonly [number, number, number],
  halfWidth: number,
  halfDepth: number,
): EscapeObstacle {
  return {
    minX: position[0] - halfWidth,
    maxX: position[0] + halfWidth,
    minZ: position[2] - halfDepth,
    maxZ: position[2] + halfDepth,
  }
}

// The maze owns wall collision; these keep the player from crossing through
// the physical puzzle props while preserving a comfortable interaction ring.
const ESCAPE_OBSTACLES: readonly EscapeObstacle[] = [
  around(PRIME_BOX_POSITION, 2.15, 1.15),
  around(CAESAR_POSITION, 2.8, 0.58),
  around(MODULAR_POSITION, 2.55, 0.52),
  around(SPECTRAL_PLAQUE_POSITION, 1.9, 0.36),
]

const RSA_BULKHEAD = around(RSA_VAULT_POSITION, 3.18, 0.52)

function collidesWithObstacle(position: EscapePosition2D, rsaOpen: boolean): boolean {
  const radius = BACKROOMS_PLAYER_RADIUS
  const collides = (obstacle: EscapeObstacle) => (
    position.x + radius >= obstacle.minX &&
    position.x - radius <= obstacle.maxX &&
    position.z + radius >= obstacle.minZ &&
    position.z - radius <= obstacle.maxZ
  )
  return ESCAPE_OBSTACLES.some(collides) || (!rsaOpen && collides(RSA_BULKHEAD))
}

function finitePosition(
  requested: EscapePosition2D,
  fallback: EscapePosition2D,
): EscapePosition2D {
  return {
    x: Number.isFinite(requested.x) ? requested.x : fallback.x,
    z: Number.isFinite(requested.z) ? requested.z : fallback.z,
  }
}

/**
 * Sanitizes a position against the generated maze. Puzzle order is enforced by
 * the mechanisms themselves, so the player can get lost and revisit sectors.
 */
export function resolveEscapePosition(
  requested: EscapePosition2D,
  _phase: EscapePhase,
): EscapePosition2D {
  const candidate = finitePosition(requested, ESCAPE_PLAYER_START)
  return isBackroomsPositionWalkable(candidate)
    ? candidate
    : { ...ESCAPE_PLAYER_START }
}

/** Resolves wall and prop collision with axis-by-axis sliding. */
export function resolveEscapeMovement(
  current: EscapePosition2D,
  requested: EscapePosition2D,
  phase: EscapePhase,
  rsaOpen = false,
): EscapePosition2D {
  const safeCurrent = resolveEscapePosition(current, phase)
  const finiteRequested = finitePosition(requested, safeCurrent)
  const mazeResolved = resolveBackroomsMovement(safeCurrent, finiteRequested)
  if (!collidesWithObstacle(mazeResolved, rsaOpen)) return mazeResolved

  const slideX = resolveBackroomsMovement(safeCurrent, {
    x: mazeResolved.x,
    z: safeCurrent.z,
  })
  if (!collidesWithObstacle(slideX, rsaOpen)) return slideX

  const slideZ = resolveBackroomsMovement(safeCurrent, {
    x: safeCurrent.x,
    z: mazeResolved.z,
  })
  if (!collidesWithObstacle(slideZ, rsaOpen)) return slideZ

  return safeCurrent
}

export function distanceSquared2D(
  first: EscapePosition2D,
  second: EscapePosition2D,
): number {
  const dx = first.x - second.x
  const dz = first.z - second.z
  return dx * dx + dz * dz
}

export function isWithinInteractionCone(
  player: EscapePosition2D,
  target: EscapePosition2D,
  yaw: number,
  radius: number,
  minimumAlignment: number,
): boolean {
  if (
    !Number.isFinite(yaw) ||
    !Number.isFinite(radius) ||
    radius < 0 ||
    !Number.isFinite(minimumAlignment)
  ) return false

  const distanceSquared = distanceSquared2D(player, target)
  if (distanceSquared > radius * radius) return false
  if (distanceSquared <= 0.09) return true

  const inverseDistance = 1 / Math.sqrt(distanceSquared)
  const forwardX = Math.sin(yaw)
  const forwardZ = -Math.cos(yaw)
  const alignment =
    ((target.x - player.x) * forwardX + (target.z - player.z) * forwardZ) *
    inverseDistance

  return alignment >= minimumAlignment
}
