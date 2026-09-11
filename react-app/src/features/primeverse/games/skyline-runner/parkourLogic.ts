import type {
  Aabb,
  Checkpoint,
  CheckpointSelectionInput,
  CoyoteJumpInput,
  GrappleAnchorSelection,
  GrappleAnchorSelectionInput,
  GrapplePullInput,
  GrapplePullResult,
  GrappleSurfaceSelection,
  GrappleSurfaceSelectionInput,
  LandingInput,
  LandingHit,
  LandingResult,
  LandingSweepInput,
  MotionStepInput,
  ParkourPlatform,
  ParkourScoreInput,
  PlayerMotion,
  RespawnInput,
  RespawnResult,
  Vec3,
  WallRunDetectionInput,
  WallRunSurface,
} from './types'

export const SKYLINE_SCORE_RULES = {
  checkpoint: 500,
  collectible: 225,
  completion: 2_500,
  maxTimeBonus: 3_000,
  timePenaltyPerSecond: 8,
  fallPenalty: 300,
} as const

const MAX_SAFE_SCORE = BigInt(Number.MAX_SAFE_INTEGER)
const SEGMENT_EPSILON = 1e-9

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`)
}

function assertNonNegative(value: number, label: string): void {
  assertFinite(value, label)
  if (value < 0) throw new RangeError(`${label} must be non-negative`)
}

function assertPositive(value: number, label: string): void {
  assertFinite(value, label)
  if (value <= 0) throw new RangeError(`${label} must be positive`)
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`)
  }
}

function assertBoolean(value: boolean, label: string): void {
  if (typeof value !== 'boolean') throw new TypeError(`${label} must be boolean`)
}

function assertIdentifier(value: string, label: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string`)
  }
}

function assertVec3(vector: Vec3, label: string): void {
  assertFinite(vector.x, `${label}.x`)
  assertFinite(vector.y, `${label}.y`)
  assertFinite(vector.z, `${label}.z`)
}

function assertAabb(bounds: Aabb, label: string): void {
  assertVec3(bounds.min, `${label}.min`)
  assertVec3(bounds.max, `${label}.max`)
  if (
    bounds.min.x > bounds.max.x ||
    bounds.min.y > bounds.max.y ||
    bounds.min.z > bounds.max.z
  ) {
    throw new RangeError(`${label} minimum cannot exceed maximum`)
  }
}

function assertMotion(motion: PlayerMotion, label: string): void {
  assertVec3(motion.position, `${label}.position`)
  assertVec3(motion.velocity, `${label}.velocity`)
  assertBoolean(motion.grounded, `${label}.grounded`)
  if (motion.lastGroundedAtMs !== null) {
    assertNonNegative(motion.lastGroundedAtMs, `${label}.lastGroundedAtMs`)
  }
}

function assertPlatform(platform: ParkourPlatform, label: string): void {
  assertIdentifier(platform.id, `${label}.id`)
  assertAabb(platform.bounds, `${label}.bounds`)
  if (platform.wallRunnable !== undefined) {
    assertBoolean(platform.wallRunnable, `${label}.wallRunnable`)
  }
  if (platform.blocksGrapple !== undefined) {
    assertBoolean(platform.blocksGrapple, `${label}.blocksGrapple`)
  }
}

function assertCheckpoint(checkpoint: Checkpoint, label: string): void {
  assertIdentifier(checkpoint.id, `${label}.id`)
  assertNonNegativeSafeInteger(checkpoint.order, `${label}.order`)
  assertAabb(checkpoint.trigger, `${label}.trigger`)
  assertVec3(checkpoint.spawn, `${label}.spawn`)
}

function magnitude(vector: Vec3): number {
  return Math.hypot(vector.x, vector.y, vector.z)
}

function normalize(vector: Vec3): Vec3 {
  const length = magnitude(vector)
  if (length === 0) return { x: 0, y: 0, z: 0 }
  if (!Number.isFinite(length)) throw new RangeError('vector magnitude must be finite')
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length }
}

function dot(first: Vec3, second: Vec3): number {
  return first.x * second.x + first.y * second.y + first.z * second.z
}

function expandedAabb(bounds: Aabb, padding: number): Aabb {
  return {
    min: {
      x: bounds.min.x - padding,
      y: bounds.min.y - padding,
      z: bounds.min.z - padding,
    },
    max: {
      x: bounds.max.x + padding,
      y: bounds.max.y + padding,
      z: bounds.max.z + padding,
    },
  }
}

interface SegmentInterval {
  readonly entry: number
  readonly exit: number
}

interface RayAabbHit {
  readonly distance: number
  readonly normal: Vec3
}

function segmentAabbInterval(start: Vec3, end: Vec3, bounds: Aabb): SegmentInterval | null {
  let entry = 0
  let exit = 1
  const axes = ['x', 'y', 'z'] as const

  for (const axis of axes) {
    const origin = start[axis]
    const delta = end[axis] - origin
    if (!Number.isFinite(delta)) throw new RangeError(`segment ${axis} delta must be finite`)
    const minimum = bounds.min[axis]
    const maximum = bounds.max[axis]

    if (Math.abs(delta) <= SEGMENT_EPSILON) {
      if (origin < minimum || origin > maximum) return null
      continue
    }

    let near = (minimum - origin) / delta
    let far = (maximum - origin) / delta
    if (near > far) [near, far] = [far, near]
    entry = Math.max(entry, near)
    exit = Math.min(exit, far)
    if (entry > exit) return null
  }

  return { entry, exit }
}

/**
 * Returns the first face hit by a normalized, finite ray. Rays beginning inside
 * (or directly on) a collider deliberately do not target that collider.
 */
function rayAabbHit(
  origin: Vec3,
  direction: Vec3,
  bounds: Aabb,
  maxRange: number,
): RayAabbHit | null {
  let entry = Number.NEGATIVE_INFINITY
  let exit = Number.POSITIVE_INFINITY
  let entryNormal: Vec3 = { x: 0, y: 0, z: 0 }
  const axes = ['x', 'y', 'z'] as const

  for (const axis of axes) {
    const axisOrigin = origin[axis]
    const axisDirection = direction[axis]
    const minimum = bounds.min[axis]
    const maximum = bounds.max[axis]

    if (Math.abs(axisDirection) <= SEGMENT_EPSILON) {
      if (axisOrigin < minimum || axisOrigin > maximum) return null
      continue
    }

    let near = (minimum - axisOrigin) / axisDirection
    let far = (maximum - axisOrigin) / axisDirection
    let normalSign = -1
    if (near > far) {
      ;[near, far] = [far, near]
      normalSign = 1
    }

    if (near > entry + SEGMENT_EPSILON) {
      entry = near
      entryNormal = {
        x: axis === 'x' ? normalSign : 0,
        y: axis === 'y' ? normalSign : 0,
        z: axis === 'z' ? normalSign : 0,
      }
    }
    exit = Math.min(exit, far)
    if (entry > exit + SEGMENT_EPSILON) return null
  }

  if (
    !Number.isFinite(entry)
    || entry <= SEGMENT_EPSILON
    || entry > maxRange
    || exit < entry - SEGMENT_EPSILON
  ) return null

  return { distance: entry, normal: entryNormal }
}

/** Clamps a finite value to an ordered, inclusive interval. */
export function clamp(value: number, minimum: number, maximum: number): number {
  assertFinite(value, 'value')
  assertFinite(minimum, 'minimum')
  assertFinite(maximum, 'maximum')
  if (minimum > maximum) throw new RangeError('minimum cannot exceed maximum')
  return Math.min(maximum, Math.max(minimum, value))
}

/** Normalizes only the X/Z plane, deliberately discarding vertical input. */
export function normalizeHorizontal(vector: Vec3): Vec3 {
  assertVec3(vector, 'vector')
  const length = Math.hypot(vector.x, vector.z)
  if (length === 0) return { x: 0, y: 0, z: 0 }
  if (!Number.isFinite(length)) throw new RangeError('horizontal magnitude must be finite')
  return { x: vector.x / length, y: 0, z: vector.z / length }
}

/** Semi-implicit Euler step with optional horizontal and falling-speed limits. */
export function integratePlayerMotion(input: MotionStepInput): PlayerMotion {
  assertMotion(input.motion, 'motion')
  assertVec3(input.acceleration, 'acceleration')
  assertNonNegative(input.deltaSeconds, 'deltaSeconds')
  if (input.maxHorizontalSpeed !== undefined) {
    assertNonNegative(input.maxHorizontalSpeed, 'maxHorizontalSpeed')
  }
  if (input.maxFallSpeed !== undefined) {
    assertNonNegative(input.maxFallSpeed, 'maxFallSpeed')
  }

  let velocity: Vec3 = {
    x: input.motion.velocity.x + input.acceleration.x * input.deltaSeconds,
    y: input.motion.velocity.y + input.acceleration.y * input.deltaSeconds,
    z: input.motion.velocity.z + input.acceleration.z * input.deltaSeconds,
  }

  if (input.maxHorizontalSpeed !== undefined) {
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z)
    if (horizontalSpeed > input.maxHorizontalSpeed && horizontalSpeed > 0) {
      const scale = input.maxHorizontalSpeed / horizontalSpeed
      velocity = { ...velocity, x: velocity.x * scale, z: velocity.z * scale }
    }
  }
  if (input.maxFallSpeed !== undefined && velocity.y < -input.maxFallSpeed) {
    velocity = { ...velocity, y: -input.maxFallSpeed }
  }
  assertVec3(velocity, 'result.velocity')

  const position = {
    x: input.motion.position.x + velocity.x * input.deltaSeconds,
    y: input.motion.position.y + velocity.y * input.deltaSeconds,
    z: input.motion.position.z + velocity.z * input.deltaSeconds,
  }
  assertVec3(position, 'result.position')

  return { ...input.motion, position, velocity }
}

export function pointInsideAabb(point: Vec3, bounds: Aabb): boolean {
  assertVec3(point, 'point')
  assertAabb(bounds, 'bounds')
  return point.x >= bounds.min.x && point.x <= bounds.max.x &&
    point.y >= bounds.min.y && point.y <= bounds.max.y &&
    point.z >= bounds.min.z && point.z <= bounds.max.z
}

/** Inclusive segment/AABB intersection using the slab method. */
export function segmentIntersectsAabb(start: Vec3, end: Vec3, bounds: Aabb): boolean {
  assertVec3(start, 'start')
  assertVec3(end, 'end')
  assertAabb(bounds, 'bounds')
  return segmentAabbInterval(start, end, bounds) !== null
}

/**
 * A blocker must intersect the interior of the sight segment. Merely touching at
 * the origin or anchor is allowed, which lets anchors live on platform faces.
 */
export function hasLineOfSight(
  start: Vec3,
  end: Vec3,
  obstacles: readonly Aabb[],
  padding = 0,
): boolean {
  assertVec3(start, 'start')
  assertVec3(end, 'end')
  assertNonNegative(padding, 'padding')

  let visible = true
  for (let index = 0; index < obstacles.length; index += 1) {
    const obstacle = obstacles[index]
    assertAabb(obstacle, `obstacles[${index}]`)
    const expanded = expandedAabb(obstacle, padding)
    assertAabb(expanded, `expanded obstacles[${index}]`)
    const interval = segmentAabbInterval(start, end, expanded)
    if (
      interval &&
      interval.exit >= SEGMENT_EPSILON &&
      interval.entry <= 1 - SEGMENT_EPSILON
    ) {
      visible = false
    }
  }
  return visible
}

/**
 * Aims a finite ray at collider-backed surfaces and returns the closest visible
 * face. Unlike beacon targeting, the resulting point may be anywhere on a
 * valid roof or facade.
 */
export function selectGrappleSurface(
  input: GrappleSurfaceSelectionInput,
): GrappleSurfaceSelection | null {
  assertVec3(input.origin, 'origin')
  assertVec3(input.viewDirection, 'viewDirection')
  assertPositive(input.maxRange, 'maxRange')
  const obstaclePadding = input.obstaclePadding ?? 0
  const surfaceOffset = input.surfaceOffset ?? 0
  assertNonNegative(obstaclePadding, 'obstaclePadding')
  assertNonNegative(surfaceOffset, 'surfaceOffset')

  const view = normalize(input.viewDirection)
  if (magnitude(view) === 0) throw new RangeError('viewDirection must not be zero')

  const surfaceIds = new Set<string>()
  const candidates: Array<{
    readonly surface: ParkourPlatform
    readonly contactPoint: Vec3
    readonly normal: Vec3
    readonly distance: number
  }> = []

  for (let index = 0; index < input.surfaces.length; index += 1) {
    const surface = input.surfaces[index]
    assertPlatform(surface, `surfaces[${index}]`)
    if (surfaceIds.has(surface.id)) throw new RangeError(`duplicate surface id: ${surface.id}`)
    surfaceIds.add(surface.id)

    const hit = rayAabbHit(input.origin, view, surface.bounds, input.maxRange)
    if (!hit) continue
    candidates.push({
      surface,
      distance: hit.distance,
      normal: hit.normal,
      contactPoint: {
        x: input.origin.x + view.x * hit.distance,
        y: input.origin.y + view.y * hit.distance,
        z: input.origin.z + view.z * hit.distance,
      },
    })
  }

  const obstacles = input.obstacles ?? input.surfaces
  const obstacleIds = new Set<string>()
  for (let index = 0; index < obstacles.length; index += 1) {
    const obstacle = obstacles[index]
    assertPlatform(obstacle, `obstacles[${index}]`)
    if (obstacleIds.has(obstacle.id)) throw new RangeError(`duplicate obstacle id: ${obstacle.id}`)
    obstacleIds.add(obstacle.id)
  }

  candidates.sort((first, second) => {
    const distanceDifference = first.distance - second.distance
    if (Math.abs(distanceDifference) > SEGMENT_EPSILON) return distanceDifference
    return first.surface.id.localeCompare(second.surface.id)
  })

  for (const candidate of candidates) {
    // The selected surface itself ends exactly at the ray endpoint. Excluding
    // it also prevents obstacle padding from making that endpoint self-occlude.
    const blockerBounds = obstacles
      .filter((obstacle) => obstacle.id !== candidate.surface.id && obstacle.blocksGrapple !== false)
      .map((obstacle) => obstacle.bounds)
    if (!hasLineOfSight(input.origin, candidate.contactPoint, blockerBounds, obstaclePadding)) {
      continue
    }

    const anchorPosition = {
      x: candidate.contactPoint.x + candidate.normal.x * surfaceOffset,
      y: candidate.contactPoint.y + candidate.normal.y * surfaceOffset,
      z: candidate.contactPoint.z + candidate.normal.z * surfaceOffset,
    }
    return {
      anchor: { id: `surface:${candidate.surface.id}`, position: anchorPosition },
      surface: candidate.surface,
      contactPoint: candidate.contactPoint,
      normal: candidate.normal,
      distance: candidate.distance,
    }
  }

  return null
}

/** Selects the best visible anchor using a stable alignment/proximity score. */
export function selectGrappleAnchor(
  input: GrappleAnchorSelectionInput,
): GrappleAnchorSelection | null {
  assertVec3(input.origin, 'origin')
  assertVec3(input.viewDirection, 'viewDirection')
  assertPositive(input.maxRange, 'maxRange')
  const minimumAlignment = input.minimumAlignment ?? 0.25
  const alignmentWeight = input.alignmentWeight ?? 0.75
  const padding = input.lineOfSightPadding ?? 0
  if (minimumAlignment < -1 || minimumAlignment > 1 || !Number.isFinite(minimumAlignment)) {
    throw new RangeError('minimumAlignment must be in [-1, 1]')
  }
  if (alignmentWeight < 0 || alignmentWeight > 1 || !Number.isFinite(alignmentWeight)) {
    throw new RangeError('alignmentWeight must be in [0, 1]')
  }
  assertNonNegative(padding, 'lineOfSightPadding')

  const view = normalize(input.viewDirection)
  if (magnitude(view) === 0) throw new RangeError('viewDirection must not be zero')
  const obstacles = input.obstacles ?? []
  for (let index = 0; index < obstacles.length; index += 1) {
    assertAabb(obstacles[index], `obstacles[${index}]`)
  }
  let best: GrappleAnchorSelection | null = null
  const anchorIds = new Set<string>()

  for (let index = 0; index < input.anchors.length; index += 1) {
    const anchor = input.anchors[index]
    assertIdentifier(anchor.id, `anchors[${index}].id`)
    if (anchorIds.has(anchor.id)) throw new RangeError(`duplicate anchor id: ${anchor.id}`)
    anchorIds.add(anchor.id)
    assertVec3(anchor.position, `anchors[${index}].position`)
    if (anchor.enabled !== undefined) assertBoolean(anchor.enabled, `anchors[${index}].enabled`)
    if (anchor.enabled === false) continue

    const offset = {
      x: anchor.position.x - input.origin.x,
      y: anchor.position.y - input.origin.y,
      z: anchor.position.z - input.origin.z,
    }
    const anchorDistance = magnitude(offset)
    if (!Number.isFinite(anchorDistance)) {
      throw new RangeError(`anchors[${index}] distance must be finite`)
    }
    if (anchorDistance === 0 || anchorDistance > input.maxRange) continue
    const direction = normalize(offset)
    const alignment = clamp(dot(view, direction), -1, 1)
    if (alignment < minimumAlignment) continue
    if (!hasLineOfSight(input.origin, anchor.position, obstacles, padding)) continue

    const proximity = 1 - anchorDistance / input.maxRange
    const score = alignment * alignmentWeight + proximity * (1 - alignmentWeight)
    const candidate = { anchor, distance: anchorDistance, alignment, score }
    if (
      !best ||
      candidate.score > best.score + Number.EPSILON ||
      (Math.abs(candidate.score - best.score) <= Number.EPSILON &&
        (candidate.distance < best.distance - Number.EPSILON ||
          (Math.abs(candidate.distance - best.distance) <= Number.EPSILON &&
            candidate.anchor.id.localeCompare(best.anchor.id) < 0)))
    ) {
      best = candidate
    }
  }

  return best
}

/** Calculates a one-way spring: a rope can pull, but it never pushes. */
export function calculateGrapplePull(input: GrapplePullInput): GrapplePullResult {
  assertVec3(input.playerPosition, 'playerPosition')
  assertVec3(input.playerVelocity, 'playerVelocity')
  assertVec3(input.anchorPosition, 'anchorPosition')
  assertNonNegative(input.ropeLength, 'ropeLength')
  assertNonNegative(input.stiffness, 'stiffness')
  assertNonNegative(input.damping, 'damping')
  assertNonNegative(input.maxAcceleration, 'maxAcceleration')

  const offset = {
    x: input.anchorPosition.x - input.playerPosition.x,
    y: input.anchorPosition.y - input.playerPosition.y,
    z: input.anchorPosition.z - input.playerPosition.z,
  }
  const distance = magnitude(offset)
  if (!Number.isFinite(distance)) throw new RangeError('grapple distance must be finite')
  const extension = Math.max(0, distance - input.ropeLength)
  if (distance === 0 || extension === 0) {
    return {
      acceleration: { x: 0, y: 0, z: 0 },
      distance,
      extension,
      tension: 0,
      taut: false,
    }
  }

  const direction = normalize(offset)
  const velocityTowardAnchor = dot(input.playerVelocity, direction)
  const uncappedTension = extension * input.stiffness - velocityTowardAnchor * input.damping
  const tension = clamp(uncappedTension, 0, input.maxAcceleration)

  return {
    acceleration: {
      x: direction.x * tension,
      y: direction.y * tension,
      z: direction.z * tension,
    },
    distance,
    extension,
    tension,
    taut: true,
  }
}

export function evaluateLanding(input: LandingInput): LandingResult {
  assertBoolean(input.wasGrounded, 'wasGrounded')
  assertBoolean(input.isGrounded, 'isGrounded')
  assertFinite(input.verticalVelocity, 'verticalVelocity')
  assertNonNegative(input.hardLandingSpeed, 'hardLandingSpeed')
  const landed = !input.wasGrounded && input.isGrounded
  const impactSpeed = landed ? Math.max(0, -input.verticalVelocity) : 0
  return {
    landed,
    impactSpeed,
    hardLanding: landed && impactSpeed >= input.hardLandingSpeed,
  }
}

/**
 * Sweeps the player's feet through platform tops, preventing fast downward
 * movement from tunnelling through a landing surface.
 */
export function findSweptLanding(input: LandingSweepInput): LandingHit | null {
  assertVec3(input.previousPosition, 'previousPosition')
  assertVec3(input.nextPosition, 'nextPosition')
  assertNonNegative(input.playerRadius, 'playerRadius')
  assertNonNegative(input.playerHalfHeight, 'playerHalfHeight')
  const downwardDistance = input.previousPosition.y - input.nextPosition.y
  assertFinite(downwardDistance, 'vertical sweep distance')
  const horizontalDeltaX = input.nextPosition.x - input.previousPosition.x
  const horizontalDeltaZ = input.nextPosition.z - input.previousPosition.z
  assertFinite(horizontalDeltaX, 'horizontal sweep x delta')
  assertFinite(horizontalDeltaZ, 'horizontal sweep z delta')
  let best: LandingHit | null = null
  const platformIds = new Set<string>()

  for (let index = 0; index < input.platforms.length; index += 1) {
    const platform = input.platforms[index]
    assertPlatform(platform, `platforms[${index}]`)
    if (platformIds.has(platform.id)) throw new RangeError(`duplicate platform id: ${platform.id}`)
    platformIds.add(platform.id)
    if (downwardDistance <= 0) continue

    const platformTop = platform.bounds.max.y
    const previousFeet = input.previousPosition.y - input.playerHalfHeight
    const nextFeet = input.nextPosition.y - input.playerHalfHeight
    if (previousFeet < platformTop || nextFeet > platformTop) continue
    const time = clamp((previousFeet - platformTop) / downwardDistance, 0, 1)
    const x = input.previousPosition.x + horizontalDeltaX * time
    const z = input.previousPosition.z + horizontalDeltaZ * time
    assertFinite(x, 'landing x')
    assertFinite(z, 'landing z')
    const nearestX = clamp(x, platform.bounds.min.x, platform.bounds.max.x)
    const nearestZ = clamp(z, platform.bounds.min.z, platform.bounds.max.z)
    if (Math.hypot(x - nearestX, z - nearestZ) > input.playerRadius) continue

    const landingY = platformTop + input.playerHalfHeight
    assertFinite(landingY, 'landing y')
    const candidate: LandingHit = {
      platform,
      time,
      position: {
        x,
        y: landingY,
        z,
      },
      normal: { x: 0, y: 1, z: 0 },
    }
    if (
      !best ||
      candidate.time < best.time - Number.EPSILON ||
      (Math.abs(candidate.time - best.time) <= Number.EPSILON &&
        candidate.platform.id.localeCompare(best.platform.id) < 0)
    ) {
      best = candidate
    }
  }

  return best
}

export function canJumpWithCoyoteTime(input: CoyoteJumpInput): boolean {
  assertBoolean(input.grounded, 'grounded')
  assertBoolean(input.jumpConsumed, 'jumpConsumed')
  assertNonNegative(input.nowMs, 'nowMs')
  assertNonNegative(input.coyoteWindowMs, 'coyoteWindowMs')
  if (input.lastGroundedAtMs !== null) {
    assertNonNegative(input.lastGroundedAtMs, 'lastGroundedAtMs')
    if (input.lastGroundedAtMs > input.nowMs) {
      throw new RangeError('lastGroundedAtMs cannot be in the future')
    }
  }

  if (input.jumpConsumed) return false
  if (input.grounded) return true
  return input.lastGroundedAtMs !== null &&
    input.nowMs - input.lastGroundedAtMs <= input.coyoteWindowMs
}

interface WallFaceCandidate {
  readonly normal: Vec3
  readonly contactPoint: Vec3
  readonly distance: number
}

function wallFacesNearPlayer(
  position: Vec3,
  radius: number,
  bounds: Aabb,
  maxDistance: number,
): readonly WallFaceCandidate[] {
  const faces: WallFaceCandidate[] = []
  const contactY = clamp(position.y, bounds.min.y, bounds.max.y)
  const maximumCenterDistance = radius + maxDistance

  const addFace = (
    contactX: number,
    contactZ: number,
    fallbackNormal: Vec3,
  ) => {
    const offset = { x: position.x - contactX, y: 0, z: position.z - contactZ }
    const centerDistance = Math.hypot(offset.x, offset.z)
    if (!Number.isFinite(centerDistance)) throw new RangeError('wall distance must be finite')
    if (centerDistance > maximumCenterDistance) return
    const normal = centerDistance > SEGMENT_EPSILON
      ? normalizeHorizontal(offset)
      : fallbackNormal
    faces.push({
      normal,
      contactPoint: { x: contactX, y: contactY, z: contactZ },
      distance: Math.max(0, centerDistance - radius),
    })
  }

  if (position.x <= bounds.min.x) {
    addFace(
      bounds.min.x,
      clamp(position.z, bounds.min.z, bounds.max.z),
      { x: -1, y: 0, z: 0 },
    )
  }
  if (position.x >= bounds.max.x) {
    addFace(
      bounds.max.x,
      clamp(position.z, bounds.min.z, bounds.max.z),
      { x: 1, y: 0, z: 0 },
    )
  }
  if (position.z <= bounds.min.z) {
    addFace(
      clamp(position.x, bounds.min.x, bounds.max.x),
      bounds.min.z,
      { x: 0, y: 0, z: -1 },
    )
  }
  if (position.z >= bounds.max.z) {
    addFace(
      clamp(position.x, bounds.min.x, bounds.max.x),
      bounds.max.z,
      { x: 0, y: 0, z: 1 },
    )
  }
  return faces
}

/** Finds the closest vertical AABB face that can sustain a wall-run. */
export function detectWallRunSurface(
  input: WallRunDetectionInput,
): WallRunSurface | null {
  assertVec3(input.position, 'position')
  assertVec3(input.velocity, 'velocity')
  assertNonNegative(input.playerRadius, 'playerRadius')
  assertNonNegative(input.playerHalfHeight, 'playerHalfHeight')
  assertNonNegative(input.maxDistance, 'maxDistance')
  const minimumSpeed = input.minAlongWallSpeed ?? 0
  assertNonNegative(minimumSpeed, 'minAlongWallSpeed')
  let best: WallRunSurface | null = null
  const platformIds = new Set<string>()

  for (let index = 0; index < input.platforms.length; index += 1) {
    const platform = input.platforms[index]
    assertPlatform(platform, `platforms[${index}]`)
    if (platformIds.has(platform.id)) throw new RangeError(`duplicate platform id: ${platform.id}`)
    platformIds.add(platform.id)
    if (platform.wallRunnable === false) continue
    const playerBottom = input.position.y - input.playerHalfHeight
    const playerTop = input.position.y + input.playerHalfHeight
    if (playerTop < platform.bounds.min.y || playerBottom > platform.bounds.max.y) continue

    for (const face of wallFacesNearPlayer(
      input.position,
      input.playerRadius,
      platform.bounds,
      input.maxDistance,
    )) {
      const normalSpeed = input.velocity.x * face.normal.x + input.velocity.z * face.normal.z
      const alongVelocity = {
        x: input.velocity.x - normalSpeed * face.normal.x,
        y: 0,
        z: input.velocity.z - normalSpeed * face.normal.z,
      }
      const alongWallSpeed = Math.hypot(alongVelocity.x, alongVelocity.z)
      if (alongWallSpeed <= SEGMENT_EPSILON || alongWallSpeed < minimumSpeed) continue
      const tangent = normalizeHorizontal(alongVelocity)
      const candidate: WallRunSurface = {
        platform,
        normal: face.normal,
        tangent,
        contactPoint: face.contactPoint,
        distance: face.distance,
        alongWallSpeed,
      }
      if (
        !best ||
        candidate.distance < best.distance - Number.EPSILON ||
        (Math.abs(candidate.distance - best.distance) <= Number.EPSILON &&
          (candidate.alongWallSpeed > best.alongWallSpeed + Number.EPSILON ||
            (Math.abs(candidate.alongWallSpeed - best.alongWallSpeed) <= Number.EPSILON &&
              candidate.platform.id.localeCompare(best.platform.id) < 0)))
      ) {
        best = candidate
      }
    }
  }

  return best
}

/** Returns the highest-order newly reached checkpoint, or null if none advanced. */
export function selectReachedCheckpoint(
  input: CheckpointSelectionInput,
): Checkpoint | null {
  assertVec3(input.position, 'position')
  if (input.previousPosition !== undefined) {
    assertVec3(input.previousPosition, 'previousPosition')
  }
  const triggerPadding = input.triggerPadding ?? 0
  assertNonNegative(triggerPadding, 'triggerPadding')
  const currentOrder = input.currentOrder ?? -1
  if (!Number.isSafeInteger(currentOrder) || currentOrder < -1) {
    throw new RangeError('currentOrder must be -1 or a non-negative safe integer')
  }

  let selected: Checkpoint | null = null
  const ids = new Set<string>()
  const orders = new Set<number>()
  for (let index = 0; index < input.checkpoints.length; index += 1) {
    const checkpoint = input.checkpoints[index]
    assertCheckpoint(checkpoint, `checkpoints[${index}]`)
    if (ids.has(checkpoint.id)) throw new RangeError(`duplicate checkpoint id: ${checkpoint.id}`)
    if (orders.has(checkpoint.order)) throw new RangeError(`duplicate checkpoint order: ${checkpoint.order}`)
    ids.add(checkpoint.id)
    orders.add(checkpoint.order)

    const expandedTrigger = expandedAabb(checkpoint.trigger, triggerPadding)
    assertAabb(expandedTrigger, `expanded checkpoints[${index}].trigger`)
    const reached = pointInsideAabb(input.position, expandedTrigger) || Boolean(
      input.previousPosition &&
      segmentIntersectsAabb(input.previousPosition, input.position, expandedTrigger),
    )
    if (
      checkpoint.order > currentOrder && reached &&
      (!selected || checkpoint.order > selected.order)
    ) {
      selected = checkpoint
    }
  }
  return selected
}

/** A fall below the kill plane requests a respawn. */
export function shouldRespawn(position: Vec3, killPlaneY: number): boolean {
  assertVec3(position, 'position')
  assertFinite(killPlaneY, 'killPlaneY')
  return position.y <= killPlaneY
}

/** Resets transient movement at the active checkpoint or the level fallback. */
export function respawnAtCheckpoint(input: RespawnInput): RespawnResult {
  assertVec3(input.fallbackPosition, 'fallbackPosition')
  if (input.checkpoint) assertCheckpoint(input.checkpoint, 'checkpoint')
  const source = input.checkpoint?.spawn ?? input.fallbackPosition
  return {
    checkpointId: input.checkpoint?.id ?? null,
    motion: {
      position: { ...source },
      velocity: { x: 0, y: 0, z: 0 },
      grounded: false,
      lastGroundedAtMs: null,
    },
  }
}

/** Deterministic, non-negative score with completion-only time bonus. */
export function calculateParkourScore(input: ParkourScoreInput): number {
  assertBoolean(input.completed, 'completed')
  assertNonNegativeSafeInteger(input.elapsedMs, 'elapsedMs')
  assertNonNegativeSafeInteger(input.checkpointsReached, 'checkpointsReached')
  assertNonNegativeSafeInteger(input.collectibles, 'collectibles')
  assertNonNegativeSafeInteger(input.falls, 'falls')
  assertNonNegativeSafeInteger(input.stylePoints, 'stylePoints')

  const elapsedSeconds = Math.floor(input.elapsedMs / 1_000)
  const timeBonus = input.completed
    ? Math.max(
        0,
        SKYLINE_SCORE_RULES.maxTimeBonus -
          elapsedSeconds * SKYLINE_SCORE_RULES.timePenaltyPerSecond,
      )
    : 0
  const earned =
    BigInt(input.checkpointsReached) * BigInt(SKYLINE_SCORE_RULES.checkpoint) +
    BigInt(input.collectibles) * BigInt(SKYLINE_SCORE_RULES.collectible) +
    BigInt(input.stylePoints) +
    BigInt(input.completed ? SKYLINE_SCORE_RULES.completion : 0) +
    BigInt(timeBonus)
  const penalty = BigInt(input.falls) * BigInt(SKYLINE_SCORE_RULES.fallPenalty)
  const score = earned - penalty
  if (score <= 0n) return 0
  return Number(score > MAX_SAFE_SCORE ? MAX_SAFE_SCORE : score)
}
