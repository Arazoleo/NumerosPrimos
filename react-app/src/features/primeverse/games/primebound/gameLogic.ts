import type {
  Aabb,
  Circle,
  DamageRequest,
  DamageResult,
  DamageState,
  DashEligibilityInput,
  Direction,
  RuneOrderEvaluation,
  ScoreInput,
  SwordAttack,
  Vec2,
} from './types'

export const PRIME_RUNE_ORDER = [2, 3, 5, 7, 11, 13] as const

export const SCORE_RULES = {
  enemy: 120,
  rune: 400,
  victory: 1_500,
  maxTimeBonus: 1_200,
  timePenaltyPerSecond: 10,
  damagePenalty: 75,
} as const

const MAX_SAFE_SCORE = BigInt(Number.MAX_SAFE_INTEGER)

const DIRECTION_VECTORS: Readonly<Record<Direction, Vec2>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`)
}

function assertNonNegative(value: number, label: string): void {
  assertFinite(value, label)
  if (value < 0) throw new RangeError(`${label} must be non-negative`)
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`)
  }
}

function assertVec2(value: Vec2, label: string): void {
  assertFinite(value.x, `${label}.x`)
  assertFinite(value.y, `${label}.y`)
}

function assertCircle(circle: Circle, label: string): void {
  assertVec2(circle.center, `${label}.center`)
  assertNonNegative(circle.radius, `${label}.radius`)
}

function assertAabb(box: Aabb, label: string): void {
  assertFinite(box.x, `${label}.x`)
  assertFinite(box.y, `${label}.y`)
  assertNonNegative(box.width, `${label}.width`)
  assertNonNegative(box.height, `${label}.height`)
  assertFinite(box.x + box.width, `${label}.right`)
  assertFinite(box.y + box.height, `${label}.bottom`)
}

/** Clamps an ordered finite interval, including both endpoints. */
export function clamp(value: number, minimum: number, maximum: number): number {
  assertFinite(value, 'value')
  assertFinite(minimum, 'minimum')
  assertFinite(maximum, 'maximum')
  if (minimum > maximum) throw new RangeError('minimum cannot exceed maximum')
  return Math.min(maximum, Math.max(minimum, value))
}

export function distance(first: Vec2, second: Vec2): number {
  assertVec2(first, 'first')
  assertVec2(second, 'second')
  return Math.hypot(second.x - first.x, second.y - first.y)
}

/** Returns a fresh unit vector, or {0, 0} when there is no movement. */
export function normalizeMovement(movement: Vec2): Vec2 {
  assertVec2(movement, 'movement')
  const magnitude = Math.hypot(movement.x, movement.y)
  if (magnitude === 0) return { x: 0, y: 0 }
  return { x: movement.x / magnitude, y: movement.y / magnitude }
}

export function directionVector(direction: Direction): Vec2 {
  const vector = DIRECTION_VECTORS[direction]
  if (!vector) throw new RangeError(`unknown direction: ${String(direction)}`)
  return { ...vector }
}

/** Circle collision is inclusive: tangent circles count as touching. */
export function circlesIntersect(first: Circle, second: Circle): boolean {
  assertCircle(first, 'first')
  assertCircle(second, 'second')
  return distance(first.center, second.center) <= first.radius + second.radius
}

/** Circle/AABB collision, including contacts with an edge or corner. */
export function circleIntersectsAabb(circle: Circle, box: Aabb): boolean {
  assertCircle(circle, 'circle')
  assertAabb(box, 'box')
  const nearestX = clamp(circle.center.x, box.x, box.x + box.width)
  const nearestY = clamp(circle.center.y, box.y, box.y + box.height)
  return Math.hypot(circle.center.x - nearestX, circle.center.y - nearestY) <= circle.radius
}

/** Inclusive AABB overlap; useful for walls, doors and trigger zones. */
export function aabbsIntersect(first: Aabb, second: Aabb): boolean {
  assertAabb(first, 'first')
  assertAabb(second, 'second')
  return first.x <= second.x + second.width &&
    first.x + first.width >= second.x &&
    first.y <= second.y + second.height &&
    first.y + first.height >= second.y
}

/** Applies damage only after invulnerability has expired, clamping health at zero. */
export function applyDamage(
  state: DamageState,
  request: DamageRequest,
): DamageResult {
  assertNonNegative(state.health, 'health')
  assertNonNegative(state.invulnerableUntilMs, 'invulnerableUntilMs')
  assertNonNegative(request.amount, 'amount')
  assertNonNegative(request.nowMs, 'nowMs')
  assertNonNegative(request.invulnerabilityMs, 'invulnerabilityMs')

  if (
    state.health === 0 ||
    request.amount === 0 ||
    request.nowMs < state.invulnerableUntilMs
  ) {
    return {
      ...state,
      applied: false,
      damageTaken: 0,
      defeated: state.health === 0,
    }
  }

  const damageTaken = Math.min(state.health, request.amount)
  const health = state.health - damageTaken
  const invulnerableUntilMs = request.nowMs + request.invulnerabilityMs
  assertFinite(invulnerableUntilMs, 'resulting invulnerableUntilMs')

  return {
    health,
    invulnerableUntilMs,
    applied: true,
    damageTaken,
    defeated: health === 0,
  }
}

/**
 * Tests a target circle against a sword sector. The target radius contributes
 * both to reach and angular overlap, so large targets are not reduced to a point.
 */
export function isSwordAttackHit(attack: SwordAttack, target: Circle): boolean {
  assertVec2(attack.origin, 'attack.origin')
  assertNonNegative(attack.range, 'attack.range')
  assertNonNegative(attack.arcRadians, 'attack.arcRadians')
  if (attack.arcRadians > Math.PI * 2) {
    throw new RangeError('attack.arcRadians cannot exceed a full circle')
  }
  assertCircle(target, 'target')

  const offsetX = target.center.x - attack.origin.x
  const offsetY = target.center.y - attack.origin.y
  const centerDistance = Math.hypot(offsetX, offsetY)
  if (centerDistance > attack.range + target.radius) return false
  if (centerDistance <= target.radius) return true
  if (attack.arcRadians === Math.PI * 2) return true

  const facing = directionVector(attack.facing)
  const normalizedDot = clamp(
    (offsetX * facing.x + offsetY * facing.y) / centerDistance,
    -1,
    1,
  )
  const angleToCenter = Math.acos(normalizedDot)
  const targetAngularRadius = Math.asin(clamp(target.radius / centerDistance, 0, 1))
  const allowedAngle = attack.arcRadians / 2 + targetAngularRadius

  return angleToCenter <= allowedAngle + Number.EPSILON * 8
}

export function canDash(input: DashEligibilityInput): boolean {
  assertNonNegative(input.nowMs, 'nowMs')
  assertNonNegative(input.cooldownMs, 'cooldownMs')
  assertNonNegative(input.stamina, 'stamina')
  assertNonNegative(input.staminaCost, 'staminaCost')
  if (input.lastDashAtMs !== null) {
    assertNonNegative(input.lastDashAtMs, 'lastDashAtMs')
  }

  if (
    input.phase !== 'playing' ||
    input.isDashing ||
    input.stamina < input.staminaCost
  ) return false

  return input.lastDashAtMs === null ||
    input.nowMs - input.lastDashAtMs >= input.cooldownMs
}

/** Evaluates partial input and the exact six-rune campaign sequence. */
export function evaluateRuneOrder(sequence: readonly number[]): RuneOrderEvaluation {
  let mismatchIndex: number | null = null
  for (let index = 0; index < sequence.length; index += 1) {
    if (index >= PRIME_RUNE_ORDER.length || sequence[index] !== PRIME_RUNE_ORDER[index]) {
      mismatchIndex = index
      break
    }
  }

  const validPrefix = mismatchIndex === null && sequence.length <= PRIME_RUNE_ORDER.length
  const complete = validPrefix && sequence.length === PRIME_RUNE_ORDER.length

  return {
    status: complete ? 'complete' : validPrefix ? 'in-progress' : 'incorrect',
    validPrefix,
    complete,
    nextExpected: validPrefix && !complete
      ? PRIME_RUNE_ORDER[sequence.length]
      : null,
    mismatchIndex,
  }
}

export function verifyRuneOrder(sequence: readonly number[]): boolean {
  return evaluateRuneOrder(sequence).complete
}

/** Deterministic campaign score with a capped time bonus and no negative result. */
export function calculateScore(input: ScoreInput): number {
  assertNonNegativeSafeInteger(input.enemiesDefeated, 'enemiesDefeated')
  assertNonNegativeSafeInteger(input.runesActivated, 'runesActivated')
  if (input.runesActivated > PRIME_RUNE_ORDER.length) {
    throw new RangeError(`runesActivated cannot exceed ${PRIME_RUNE_ORDER.length}`)
  }
  assertNonNegativeSafeInteger(input.damageTaken, 'damageTaken')
  assertNonNegativeSafeInteger(input.elapsedMs, 'elapsedMs')
  if (typeof input.victory !== 'boolean') throw new TypeError('victory must be boolean')

  const elapsedSeconds = Math.floor(input.elapsedMs / 1_000)
  const timeBonus = input.victory
    ? Math.max(
        0,
        SCORE_RULES.maxTimeBonus - elapsedSeconds * SCORE_RULES.timePenaltyPerSecond,
      )
    : 0
  const earned =
    BigInt(input.enemiesDefeated) * BigInt(SCORE_RULES.enemy) +
    BigInt(input.runesActivated) * BigInt(SCORE_RULES.rune) +
    BigInt(input.victory ? SCORE_RULES.victory : 0) +
    BigInt(timeBonus)
  const penalty = BigInt(input.damageTaken) * BigInt(SCORE_RULES.damagePenalty)
  const score = earned - penalty

  if (score <= 0n) return 0
  return Number(score > MAX_SAFE_SCORE ? MAX_SAFE_SCORE : score)
}
