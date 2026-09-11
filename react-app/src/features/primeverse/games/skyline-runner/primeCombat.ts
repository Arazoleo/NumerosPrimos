import type { Vec3 } from './types'

export const PRIME_POWER_VALUES = [2, 3, 5] as const

export type PrimePowerValue = (typeof PRIME_POWER_VALUES)[number]

export type PrimeCastStyle = 'binary-bolt' | 'triad-burst' | 'pentagonal-orb'

export interface PrimePowerDefinition {
  readonly value: PrimePowerValue
  readonly label: string
  readonly description: string
  /** Minimum time between casts. */
  readonly cadenceMs: number
  readonly damage: number
  readonly range: number
  readonly color: string
  readonly castStyle: PrimeCastStyle
}

export const PRIME_POWERS: Readonly<
  Record<PrimePowerValue, PrimePowerDefinition>
> = Object.freeze({
  2: Object.freeze({
    value: 2,
    label: 'Raio Binário',
    description: 'Um disparo veloz que rompe múltiplos de 2.',
    cadenceMs: 220,
    damage: 50,
    range: 28,
    color: '#56f5ff',
    castStyle: 'binary-bolt',
  }),
  3: Object.freeze({
    value: 3,
    label: 'Rajada Trina',
    description: 'Uma descarga equilibrada contra múltiplos de 3.',
    cadenceMs: 420,
    damage: 50,
    range: 34,
    color: '#b78cff',
    castStyle: 'triad-burst',
  }),
  5: Object.freeze({
    value: 5,
    label: 'Orbe Pentagonal',
    description: 'Um projétil pesado que desintegra múltiplos de 5.',
    cadenceMs: 720,
    damage: 50,
    range: 42,
    color: '#ffc85a',
    castStyle: 'pentagonal-orb',
  }),
})

export interface PrimeCombatTarget {
  readonly id: string
  readonly compositeNumber: number
  readonly position: Vec3
  readonly health: number
  /** Disabled targets are ignored by aiming and cannot receive a shot. */
  readonly enabled?: boolean
}

export interface PrimeTargetSelectionInput<T extends PrimeCombatTarget> {
  readonly power: PrimePowerValue
  readonly origin: Vec3
  readonly viewDirection: Vec3
  readonly targets: readonly T[]
  /** Narrows the power's natural range, but can never extend it. */
  readonly maxRange?: number
  /** Cosine threshold from 0 (90 degrees) to 1 (perfectly centered). */
  readonly minimumAlignment?: number
  /** Useful for aim assist that should skip enemies immune to this power. */
  readonly factorMatchesOnly?: boolean
  /** Optional world-specific visibility check, e.g. a collider raycast. */
  readonly hasLineOfSight?: (origin: Vec3, target: T) => boolean
}

export interface PrimeTargetSelection<T extends PrimeCombatTarget> {
  readonly target: T
  readonly distance: number
  readonly alignment: number
  readonly score: number
  readonly factorMatch: boolean
}

export type PrimeShotReason =
  | 'hit'
  | 'cooldown'
  | 'out-of-range'
  | 'wrong-factor'
  | 'target-unavailable'

export interface ResolvePrimeShotInput<T extends PrimeCombatTarget> {
  readonly power: PrimePowerValue
  readonly origin: Vec3
  readonly target: T
  readonly nowMs: number
  /** Use null for a power that has not been cast yet. */
  readonly lastFiredAtMs?: number | null
  readonly damageMultiplier?: number
}

export interface PrimeShotResult<T extends PrimeCombatTarget> {
  readonly power: PrimePowerDefinition
  readonly target: T
  readonly reason: PrimeShotReason
  /** False only when cooldown or target state prevents the cast itself. */
  readonly fired: boolean
  readonly hit: boolean
  readonly factorMatch: boolean
  readonly damage: number
  readonly distance: number
  readonly remainingHealth: number
  readonly defeated: boolean
  readonly cooldownRemainingMs: number
  readonly nextReadyAtMs: number
}

const DEFAULT_MINIMUM_ALIGNMENT = 0.78
const VECTOR_EPSILON = 1e-9

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

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`)
  }
}

function assertVec3(vector: Vec3, label: string): void {
  assertFinite(vector.x, `${label}.x`)
  assertFinite(vector.y, `${label}.y`)
  assertFinite(vector.z, `${label}.z`)
}

function assertTarget(target: PrimeCombatTarget, label: string): void {
  if (typeof target.id !== 'string' || target.id.trim().length === 0) {
    throw new TypeError(`${label}.id must be a non-empty string`)
  }
  assertSafeInteger(target.compositeNumber, `${label}.compositeNumber`)
  if (!isCompositeNumber(target.compositeNumber)) {
    throw new RangeError(`${label}.compositeNumber must be composite`)
  }
  assertVec3(target.position, `${label}.position`)
  assertNonNegative(target.health, `${label}.health`)
  if (target.enabled !== undefined && typeof target.enabled !== 'boolean') {
    throw new TypeError(`${label}.enabled must be boolean`)
  }
}

function magnitude(vector: Vec3): number {
  return Math.hypot(vector.x, vector.y, vector.z)
}

function distanceBetween(first: Vec3, second: Vec3): number {
  return Math.hypot(
    second.x - first.x,
    second.y - first.y,
    second.z - first.z,
  )
}

function normalized(vector: Vec3, label: string): Vec3 {
  assertVec3(vector, label)
  const length = magnitude(vector)
  if (length <= VECTOR_EPSILON) {
    throw new RangeError(`${label} must not be a zero vector`)
  }
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  }
}

function dot(first: Vec3, second: Vec3): number {
  return first.x * second.x + first.y * second.y + first.z * second.z
}

export function isPrimePowerValue(value: number): value is PrimePowerValue {
  return PRIME_POWER_VALUES.some((candidate) => candidate === value)
}

export function getPrimePower(value: PrimePowerValue | number): PrimePowerDefinition {
  if (!isPrimePowerValue(value)) {
    throw new RangeError(`unsupported prime power: ${value}`)
  }
  return PRIME_POWERS[value]
}

export function isPrimeNumber(value: number): boolean {
  if (!Number.isSafeInteger(value) || value < 2) return false
  if (value === 2) return true
  if (value % 2 === 0) return false
  for (let divisor = 3; divisor <= Math.sqrt(value); divisor += 2) {
    if (value % divisor === 0) return false
  }
  return true
}

export function isCompositeNumber(value: number): boolean {
  return Number.isSafeInteger(value) && value > 3 && !isPrimeNumber(value)
}

/** Mathematically verifies a prime weakness on a composite enemy number. */
export function doesPrimeFactorComposite(
  prime: number,
  compositeNumber: number,
): boolean {
  if (!Number.isSafeInteger(prime) || !Number.isSafeInteger(compositeNumber)) {
    return false
  }
  return isPrimeNumber(prime)
    && isCompositeNumber(compositeNumber)
    && compositeNumber % prime === 0
}

/** Returns only powers currently available to the runner, in HUD order. */
export function getMatchingPrimePowers(
  compositeNumber: number,
): readonly PrimePowerValue[] {
  assertSafeInteger(compositeNumber, 'compositeNumber')
  if (!isCompositeNumber(compositeNumber)) return []
  return PRIME_POWER_VALUES.filter((value) => (
    doesPrimeFactorComposite(value, compositeNumber)
  ))
}

export function calculatePrimeDamage(
  powerValue: PrimePowerValue | number,
  compositeNumber: number,
  multiplier = 1,
): number {
  const power = getPrimePower(powerValue)
  assertSafeInteger(compositeNumber, 'compositeNumber')
  assertNonNegative(multiplier, 'multiplier')
  if (!doesPrimeFactorComposite(power.value, compositeNumber)) return 0
  return power.damage * multiplier
}

/**
 * Picks the most centered viable target, with distance used as a tie-breaker.
 * World collision stays injectable so this module remains renderer-independent.
 */
export function selectPrimeTarget<T extends PrimeCombatTarget>(
  input: PrimeTargetSelectionInput<T>,
): PrimeTargetSelection<T> | null {
  const power = getPrimePower(input.power)
  assertVec3(input.origin, 'origin')
  const viewDirection = normalized(input.viewDirection, 'viewDirection')
  const requestedRange = input.maxRange ?? power.range
  assertPositive(requestedRange, 'maxRange')
  const maxRange = Math.min(requestedRange, power.range)
  const minimumAlignment = input.minimumAlignment
    ?? DEFAULT_MINIMUM_ALIGNMENT
  assertFinite(minimumAlignment, 'minimumAlignment')
  if (minimumAlignment < 0 || minimumAlignment > 1) {
    throw new RangeError('minimumAlignment must be between 0 and 1')
  }

  let selected: PrimeTargetSelection<T> | null = null

  input.targets.forEach((target, index) => {
    assertTarget(target, `targets[${index}]`)
    if (target.enabled === false || target.health <= 0) return

    const distance = distanceBetween(input.origin, target.position)
    if (distance > maxRange) return
    const direction = distance <= VECTOR_EPSILON
      ? viewDirection
      : {
          x: (target.position.x - input.origin.x) / distance,
          y: (target.position.y - input.origin.y) / distance,
          z: (target.position.z - input.origin.z) / distance,
        }
    const alignment = Math.max(-1, Math.min(1, dot(viewDirection, direction)))
    if (alignment < minimumAlignment) return

    const factorMatch = doesPrimeFactorComposite(
      power.value,
      target.compositeNumber,
    )
    if (input.factorMatchesOnly && !factorMatch) return
    if (input.hasLineOfSight && !input.hasLineOfSight(input.origin, target)) return

    // Angular error dominates, so aim assist follows the reticle before proximity.
    const score = (1 - alignment) * maxRange * 2 + distance / maxRange
    if (
      selected === null
      || score < selected.score
      || (score === selected.score && distance < selected.distance)
    ) {
      selected = { target, distance, alignment, score, factorMatch }
    }
  })

  return selected
}

/** Resolves cadence, range, mathematical weakness, damage and defeat atomically. */
export function resolvePrimeShot<T extends PrimeCombatTarget>(
  input: ResolvePrimeShotInput<T>,
): PrimeShotResult<T> {
  const power = getPrimePower(input.power)
  assertVec3(input.origin, 'origin')
  assertTarget(input.target, 'target')
  assertNonNegative(input.nowMs, 'nowMs')
  if (input.lastFiredAtMs !== undefined && input.lastFiredAtMs !== null) {
    assertFinite(input.lastFiredAtMs, 'lastFiredAtMs')
  }
  const multiplier = input.damageMultiplier ?? 1
  assertNonNegative(multiplier, 'damageMultiplier')

  const distance = distanceBetween(input.origin, input.target.position)
  const factorMatch = doesPrimeFactorComposite(
    power.value,
    input.target.compositeNumber,
  )
  const lastFiredAtMs = input.lastFiredAtMs ?? null
  const readyAtMs = lastFiredAtMs === null
    ? input.nowMs
    : lastFiredAtMs + power.cadenceMs
  const cooldownRemainingMs = Math.max(0, readyAtMs - input.nowMs)

  if (input.target.enabled === false || input.target.health <= 0) {
    return {
      power,
      target: input.target,
      reason: 'target-unavailable',
      fired: false,
      hit: false,
      factorMatch,
      damage: 0,
      distance,
      remainingHealth: input.target.health,
      defeated: input.target.health <= 0,
      cooldownRemainingMs,
      nextReadyAtMs: readyAtMs,
    }
  }

  if (cooldownRemainingMs > 0) {
    return {
      power,
      target: input.target,
      reason: 'cooldown',
      fired: false,
      hit: false,
      factorMatch,
      damage: 0,
      distance,
      remainingHealth: input.target.health,
      defeated: false,
      cooldownRemainingMs,
      nextReadyAtMs: readyAtMs,
    }
  }

  const nextReadyAtMs = input.nowMs + power.cadenceMs
  if (distance > power.range) {
    return {
      power,
      target: input.target,
      reason: 'out-of-range',
      fired: true,
      hit: false,
      factorMatch,
      damage: 0,
      distance,
      remainingHealth: input.target.health,
      defeated: false,
      cooldownRemainingMs: power.cadenceMs,
      nextReadyAtMs,
    }
  }

  const rawDamage = calculatePrimeDamage(
    power.value,
    input.target.compositeNumber,
    multiplier,
  )
  const damage = Math.min(input.target.health, rawDamage)
  const remainingHealth = Math.max(0, input.target.health - damage)
  const hit = damage > 0

  return {
    power,
    target: input.target,
    reason: hit ? 'hit' : 'wrong-factor',
    fired: true,
    hit,
    factorMatch,
    damage,
    distance,
    remainingHealth,
    defeated: hit && remainingHealth === 0,
    cooldownRemainingMs: power.cadenceMs,
    nextReadyAtMs,
  }
}
