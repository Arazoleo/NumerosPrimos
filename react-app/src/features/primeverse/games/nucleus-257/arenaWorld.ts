import type { Vec3 } from './types'

export const ARENA_RADIUS = 27.5
export const PLAYER_HEIGHT = 1.72
export const PLAYER_RADIUS = 0.48

export interface ArenaCover {
  readonly id: string
  readonly center: Vec3
  readonly half: Vec3
  readonly rotation?: number
}

export interface ArenaPylon {
  readonly prime: 2 | 3 | 5 | 7
  readonly position: Vec3
  readonly color: string
}

export const PLAYER_SPAWNS: readonly Vec3[] = Object.freeze([
  Object.freeze({ x: 0, y: 0.05, z: 20 }),
  Object.freeze({ x: -19, y: 0.05, z: -2 }),
  Object.freeze({ x: 18, y: 0.05, z: -7 }),
  Object.freeze({ x: 3, y: 0.05, z: -21 }),
])

export const BOT_SPAWNS: readonly Vec3[] = Object.freeze([
  Object.freeze({ x: -15, y: 0.05, z: -13 }),
  Object.freeze({ x: 15, y: 0.05, z: -14 }),
  Object.freeze({ x: -20, y: 0.05, z: 9 }),
  Object.freeze({ x: 19, y: 0.05, z: 11 }),
  Object.freeze({ x: 1, y: 0.05, z: -18 }),
])

export const ARENA_PYLONS: readonly ArenaPylon[] = Object.freeze([
  Object.freeze({ prime: 2, position: Object.freeze({ x: -17, y: 0, z: 0 }), color: '#50efff' }),
  Object.freeze({ prime: 3, position: Object.freeze({ x: 0, y: 0, z: -17 }), color: '#ff62d2' }),
  Object.freeze({ prime: 5, position: Object.freeze({ x: 17, y: 0, z: 0 }), color: '#ffc857' }),
  Object.freeze({ prime: 7, position: Object.freeze({ x: 0, y: 0, z: 17 }), color: '#8b79ff' }),
])

/** Axis-aligned gameplay colliders; visual meshes may add harmless rotation/detail. */
export const ARENA_COVERS: readonly ArenaCover[] = Object.freeze([
  Object.freeze({ id: 'west-monolith', center: Object.freeze({ x: -8.4, y: 1.45, z: -5.6 }), half: Object.freeze({ x: 1.65, y: 1.45, z: 2.25 }), rotation: -0.12 }),
  Object.freeze({ id: 'east-monolith', center: Object.freeze({ x: 8.4, y: 1.45, z: -5.6 }), half: Object.freeze({ x: 1.65, y: 1.45, z: 2.25 }), rotation: 0.12 }),
  Object.freeze({ id: 'west-shield', center: Object.freeze({ x: -11.7, y: 1.1, z: 9.2 }), half: Object.freeze({ x: 2.8, y: 1.1, z: 0.75 }) }),
  Object.freeze({ id: 'east-shield', center: Object.freeze({ x: 11.7, y: 1.1, z: 9.2 }), half: Object.freeze({ x: 2.8, y: 1.1, z: 0.75 }) }),
  Object.freeze({ id: 'north-shield', center: Object.freeze({ x: 0, y: 1.1, z: -11.5 }), half: Object.freeze({ x: 3, y: 1.1, z: 0.7 }) }),
  Object.freeze({ id: 'core', center: Object.freeze({ x: 0, y: 1.7, z: 0 }), half: Object.freeze({ x: 2.25, y: 1.7, z: 2.25 }) }),
])

export function isInsideArena(position: Pick<Vec3, 'x' | 'z'>, margin = PLAYER_RADIUS): boolean {
  return Math.hypot(position.x, position.z) <= ARENA_RADIUS - Math.max(0, margin)
}

export function collidesWithCover(position: Pick<Vec3, 'x' | 'z'>, radius = PLAYER_RADIUS): boolean {
  return ARENA_COVERS.some((cover) => (
    position.x >= cover.center.x - cover.half.x - radius
    && position.x <= cover.center.x + cover.half.x + radius
    && position.z >= cover.center.z - cover.half.z - radius
    && position.z <= cover.center.z + cover.half.z + radius
  ))
}

export function resolveArenaMovement(current: Vec3, proposed: Vec3, radius = PLAYER_RADIUS): Vec3 {
  const candidate = { x: proposed.x, y: Math.max(0.05, proposed.y), z: proposed.z }
  if (isInsideArena(candidate, radius) && !collidesWithCover(candidate, radius)) return candidate

  const slideX = { x: candidate.x, y: candidate.y, z: current.z }
  if (isInsideArena(slideX, radius) && !collidesWithCover(slideX, radius)) return slideX

  const slideZ = { x: current.x, y: candidate.y, z: candidate.z }
  if (isInsideArena(slideZ, radius) && !collidesWithCover(slideZ, radius)) return slideZ

  return { ...current, y: candidate.y }
}

/**
 * Resolves a long ability displacement without tunnelling through cover.
 * Blinks deliberately validate only their landing point; physical dashes are
 * swept in short steps and can slide along an obstacle's face.
 */
export function resolveArenaAbilityMovement(
  current: Vec3,
  proposed: Vec3,
  radius = PLAYER_RADIUS,
  canPhase = false,
): Vec3 {
  if (canPhase) return resolveArenaMovement(current, proposed, radius)
  const distance = Math.hypot(proposed.x - current.x, proposed.z - current.z)
  const steps = Math.max(1, Math.ceil(distance / 0.3))
  const stepX = (proposed.x - current.x) / steps
  const stepY = (proposed.y - current.y) / steps
  const stepZ = (proposed.z - current.z) / steps
  let resolved = { ...current }
  for (let step = 0; step < steps; step += 1) {
    const next = resolveArenaMovement(resolved, {
      x: resolved.x + stepX,
      y: resolved.y + stepY,
      z: resolved.z + stepZ,
    }, radius)
    if (Math.hypot(next.x - resolved.x, next.z - resolved.z) < 1e-6) break
    resolved = next
  }
  return resolved
}

export function hasArenaLineOfSight(from: Vec3, to: Vec3): boolean {
  return !ARENA_COVERS.some((cover) => segmentIntersectsCover(from, to, cover, 0.08))
}

export function spawnForIndex(index: number, bot = false): Vec3 {
  const pool = bot ? BOT_SPAWNS : PLAYER_SPAWNS
  const normalizedIndex = Number.isFinite(index) ? Math.trunc(index) : 0
  const safeIndex = ((normalizedIndex % pool.length) + pool.length) % pool.length
  return { ...pool[safeIndex] }
}

function segmentIntersectsCover(from: Vec3, to: Vec3, cover: ArenaCover, padding: number): boolean {
  const minX = cover.center.x - cover.half.x - padding
  const maxX = cover.center.x + cover.half.x + padding
  const minZ = cover.center.z - cover.half.z - padding
  const maxZ = cover.center.z + cover.half.z + padding
  const minY = cover.center.y - cover.half.y - padding
  const maxY = cover.center.y + cover.half.y + padding
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dz = to.z - from.z
  let entry = 0
  let exit = 1

  const clip = (origin: number, delta: number, min: number, max: number): boolean => {
    if (Math.abs(delta) < 1e-9) return origin < min || origin > max
    const first = (min - origin) / delta
    const second = (max - origin) / delta
    const near = Math.min(first, second)
    const far = Math.max(first, second)
    entry = Math.max(entry, near)
    exit = Math.min(exit, far)
    return entry > exit
  }

  if (
    clip(from.x, dx, minX, maxX)
    || clip(from.y, dy, minY, maxY)
    || clip(from.z, dz, minZ, maxZ)
  ) return false
  // Endpoints may be beside cover; only the open segment should occlude combatants.
  return exit > 0.001 && entry < 0.999
}
