import { getHeroKit } from './classKits'
import {
  ABILITY_SLOTS,
  type AbilityCastResult,
  type AbilityDefinition,
  type AbilityHitShape,
  type AbilitySlot,
  type AimInput,
  type ArenaObjectiveState,
  type BotDecision,
  type CastBlockReason,
  type CombatantState,
  type CombatStatusId,
  type CreateCombatantInput,
  type DamageOptions,
  type DamageResult,
  type ObjectiveAdvanceInput,
  type PylonPrime,
  type TimedCombatStatus,
  type Vec3,
} from './types'

export const ULTIMATE_MAX_CHARGE = 100
/** Five seconds keeps an elimination meaningful without removing a player from the fight for long. */
export const RESPAWN_DELAY_MS = 5_000
/** Protection is long enough to read the arena, and is cancelled by an offensive cast. */
export const SPAWN_PROTECTION_MS = 2_000
/** PvE sentinels use the same readable kits without matching a human player's perfect damage. */
export const BOT_DAMAGE_SCALE = 0.52
/** A short focus-fire guard softens stacked impacts without changing normal duel DPS. */
export const DAMAGE_GUARD_DURATION_MS = 500
export const DAMAGE_GUARD_REDUCTION = 0.25
/** Shields recover on the same deterministic clock in solo play and on the server. */
export const SHIELD_RECHARGE_DELAY_MS = 4_000
export const SHIELD_RECHARGE_PER_SECOND = 12
export const PYLON_CAPTURE_MS = 5_000
export const PYLON_SEQUENCE: readonly PylonPrime[] = Object.freeze([2, 3, 5, 7])

const EPSILON = 1e-9

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`)
}

function assertNonNegative(value: number, label: string): void {
  assertFiniteNumber(value, label)
  if (value < 0) throw new RangeError(`${label} must be non-negative`)
}

function assertVec3(value: Vec3, label: string): void {
  assertFiniteNumber(value.x, `${label}.x`)
  assertFiniteNumber(value.y, `${label}.y`)
  assertFiniteNumber(value.z, `${label}.z`)
}

function cloneVec3(value: Vec3): Vec3 {
  return Object.freeze({ x: value.x, y: value.y, z: value.z })
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function addScaled(origin: Vec3, direction: Vec3, scale: number): Vec3 {
  return {
    x: origin.x + direction.x * scale,
    y: origin.y + direction.y * scale,
    z: origin.z + direction.z * scale,
  }
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function lengthSquared(value: Vec3): number {
  return dot(value, value)
}

function distanceSquared(a: Vec3, b: Vec3): number {
  return lengthSquared(subtract(a, b))
}

export function normalizeDirection(value: Vec3): Vec3 {
  assertVec3(value, 'direction')
  const magnitude = Math.sqrt(lengthSquared(value))
  if (magnitude <= EPSILON) throw new RangeError('direction must not be a zero vector')
  return Object.freeze({ x: value.x / magnitude, y: value.y / magnitude, z: value.z / magnitude })
}

function freezeStatuses(
  statuses: Readonly<Partial<Record<CombatStatusId, TimedCombatStatus>>>,
): CombatantState['statuses'] {
  return Object.freeze({ ...statuses })
}

function removeStatus(
  combatant: CombatantState,
  statusId: CombatStatusId,
): CombatantState {
  if (combatant.statuses[statusId] === undefined) return combatant
  const statuses = { ...combatant.statuses }
  delete statuses[statusId]
  return Object.freeze({ ...combatant, statuses: freezeStatuses(statuses) })
}

function emptyCooldowns(): CombatantState['cooldownReadyAtMs'] {
  return Object.freeze({
    primary: 0,
    signature: 0,
    mobility: 0,
    ultimate: 0,
  })
}

export function createCombatant(input: CreateCombatantInput): CombatantState {
  if (!input.id.trim()) throw new RangeError('combatant id must not be empty')
  assertVec3(input.position, 'position')
  const kit = getHeroKit(input.heroId)
  const facing = normalizeDirection(input.facing ?? { x: 0, y: 0, z: -1 })
  const position = cloneVec3(input.position)

  return Object.freeze({
    id: input.id,
    heroId: input.heroId,
    team: input.team,
    bot: input.bot === true,
    position,
    spawnPosition: cloneVec3(position),
    facing,
    health: kit.stats.maxHealth,
    maxHealth: kit.stats.maxHealth,
    shield: kit.stats.maxShield,
    maxShield: kit.stats.maxShield,
    hitRadius: kit.stats.hitRadius,
    alive: true,
    cooldownReadyAtMs: emptyCooldowns(),
    statuses: Object.freeze({}),
    ultimateCharge: 0,
    eliminations: 0,
    deaths: 0,
    respawnAtMs: null,
  })
}

export function isStatusActive(
  combatant: CombatantState,
  statusId: CombatStatusId,
  nowMs: number,
): boolean {
  assertNonNegative(nowMs, 'nowMs')
  const status = combatant.statuses[statusId]
  return status !== undefined && status.expiresAtMs > nowMs
}

export function clearExpiredStatuses(
  combatant: CombatantState,
  nowMs: number,
): CombatantState {
  assertNonNegative(nowMs, 'nowMs')
  const entries = Object.entries(combatant.statuses).filter(([, status]) => (
    status !== undefined && status.expiresAtMs > nowMs
  )) as Array<[CombatStatusId, TimedCombatStatus]>

  if (entries.length === Object.keys(combatant.statuses).length) return combatant
  return Object.freeze({ ...combatant, statuses: freezeStatuses(Object.fromEntries(entries)) })
}

function applyStatus(
  combatant: CombatantState,
  status: Omit<TimedCombatStatus, 'expiresAtMs'> & { readonly durationMs: number },
  nowMs: number,
): CombatantState {
  assertNonNegative(status.durationMs, 'status.durationMs')
  assertNonNegative(status.magnitude, 'status.magnitude')
  if (!combatant.alive || status.durationMs === 0) return combatant

  const existing = combatant.statuses[status.id]
  const nextExpiresAtMs = nowMs + status.durationMs
  if (existing && existing.expiresAtMs > nowMs && existing.magnitude > status.magnitude) {
    return combatant
  }
  const nextStatus = Object.freeze({
    id: status.id,
    expiresAtMs: existing?.magnitude === status.magnitude
      ? Math.max(existing.expiresAtMs, nextExpiresAtMs)
      : nextExpiresAtMs,
    magnitude: status.magnitude,
  })
  return Object.freeze({
    ...combatant,
    statuses: freezeStatuses({ ...combatant.statuses, [status.id]: nextStatus }),
  })
}

export function cooldownRemainingMs(
  combatant: CombatantState,
  slot: AbilitySlot,
  nowMs: number,
): number {
  assertNonNegative(nowMs, 'nowMs')
  return Math.max(0, combatant.cooldownReadyAtMs[slot] - nowMs)
}

export function getCastBlockReason(
  combatant: CombatantState,
  slot: AbilitySlot,
  nowMs: number,
): CastBlockReason | null {
  assertNonNegative(nowMs, 'nowMs')
  if (!combatant.alive) return 'dead'
  if (cooldownRemainingMs(combatant, slot, nowMs) > 0) return 'cooldown'
  if (slot !== 'primary' && isStatusActive(combatant, 'silenced', nowMs)) return 'silenced'

  const ability = getHeroKit(combatant.heroId).abilities[slot]
  if (ability.ultimateCost !== undefined && combatant.ultimateCharge < ability.ultimateCost) {
    return 'ultimate-not-ready'
  }
  return null
}

export function canCast(
  combatant: CombatantState,
  slot: AbilitySlot,
  nowMs: number,
): boolean {
  return getCastBlockReason(combatant, slot, nowMs) === null
}

function aimCenter(origin: Vec3, aim: AimInput, shape: AbilityHitShape): Vec3 {
  if (shape.kind !== 'radius' || shape.center === 'caster') return origin
  const maxRange = shape.maxRange ?? 0
  assertNonNegative(maxRange, 'hitShape.maxRange')
  const desired = aim.point ?? addScaled(origin, normalizeDirection(aim.direction), maxRange)
  assertVec3(desired, 'aim.point')
  const offset = subtract(desired, origin)
  const distance = Math.sqrt(lengthSquared(offset))
  if (distance <= maxRange || distance <= EPSILON) return desired
  return addScaled(origin, normalizeDirection(offset), maxRange)
}

export function hitShapeContainsPoint(
  shape: AbilityHitShape,
  origin: Vec3,
  aim: AimInput,
  point: Vec3,
  pointRadius = 0,
): boolean {
  assertVec3(origin, 'origin')
  assertVec3(point, 'point')
  assertNonNegative(pointRadius, 'pointRadius')

  if (shape.kind === 'radius') {
    assertNonNegative(shape.radius, 'hitShape.radius')
    const center = aimCenter(origin, aim, shape)
    const reach = shape.radius + pointRadius
    return distanceSquared(center, point) <= reach * reach + EPSILON
  }

  const direction = normalizeDirection(aim.direction)
  const offset = subtract(point, origin)
  const projection = dot(offset, direction)

  if (shape.kind === 'ray') {
    assertNonNegative(shape.range, 'hitShape.range')
    assertNonNegative(shape.radius, 'hitShape.radius')
    if (projection < -pointRadius || projection > shape.range + pointRadius) return false
    const perpendicularSquared = Math.max(0, lengthSquared(offset) - projection * projection)
    const reach = shape.radius + pointRadius
    return perpendicularSquared <= reach * reach + EPSILON
  }

  assertNonNegative(shape.range, 'hitShape.range')
  assertNonNegative(shape.halfAngleDegrees, 'hitShape.halfAngleDegrees')
  if (shape.halfAngleDegrees > 180) {
    throw new RangeError('hitShape.halfAngleDegrees must be at most 180')
  }
  const distance = Math.sqrt(lengthSquared(offset))
  if (distance <= pointRadius + EPSILON) return true
  if (distance > shape.range + pointRadius) return false
  const angle = Math.acos(Math.max(-1, Math.min(1, projection / distance)))
  const radiusAllowance = Math.asin(Math.min(1, pointRadius / distance))
  const halfAngle = shape.halfAngleDegrees * Math.PI / 180
  return angle <= halfAngle + radiusAllowance + EPSILON
}

export interface TargetSelectionOptions {
  readonly nowMs?: number
  readonly hasLineOfSight?: (from: Vec3, to: Vec3) => boolean
  readonly includeCloaked?: boolean
  /** Optional eye/muzzle origin used by 3D ray and cone attacks. */
  readonly hitOrigin?: Vec3
  /** Optional body-space point used by 3D ray and cone attacks. */
  readonly hitPoint?: (target: CombatantState) => Vec3
}

function hitOriginFor(
  shape: AbilityHitShape,
  caster: CombatantState,
  options: TargetSelectionOptions,
): Vec3 {
  return shape.kind === 'radius' ? caster.position : options.hitOrigin ?? caster.position
}

function hitPointFor(
  shape: AbilityHitShape,
  target: CombatantState,
  options: TargetSelectionOptions,
): Vec3 {
  return shape.kind === 'radius' ? target.position : options.hitPoint?.(target) ?? target.position
}

function targetSortOrigin(
  shape: AbilityHitShape,
  caster: CombatantState,
  aim: AimInput,
  options: TargetSelectionOptions,
): Vec3 {
  const origin = hitOriginFor(shape, caster, options)
  return shape.kind === 'radius' ? aimCenter(origin, aim, shape) : origin
}

function validEnemyTarget(
  caster: CombatantState,
  target: CombatantState,
  shape: AbilityHitShape,
  options: TargetSelectionOptions,
): boolean {
  if (!target.alive || target.id === caster.id || target.team === caster.team) return false
  const nowMs = options.nowMs ?? 0
  if (
    options.includeCloaked !== true
    && isStatusActive(target, 'cloaked', nowMs)
    && !isStatusActive(target, 'revealed', nowMs)
  ) return false
  return options.hasLineOfSight?.(
    hitOriginFor(shape, caster, options),
    hitPointFor(shape, target, options),
  ) !== false
}

export function selectAimTarget(
  caster: CombatantState,
  combatants: readonly CombatantState[],
  shape: AbilityHitShape,
  aim: AimInput,
  options: TargetSelectionOptions = {},
): CombatantState | null {
  const hitOrigin = hitOriginFor(shape, caster, options)
  const origin = targetSortOrigin(shape, caster, aim, options)
  const candidates = combatants
    .filter((target) => validEnemyTarget(caster, target, shape, options))
    .filter((target) => hitShapeContainsPoint(
      shape,
      hitOrigin,
      aim,
      hitPointFor(shape, target, options),
      target.hitRadius,
    ))
    .sort((left, right) => (
      distanceSquared(origin, hitPointFor(shape, left, options))
      - distanceSquared(origin, hitPointFor(shape, right, options))
      || left.id.localeCompare(right.id)
    ))
  return candidates[0] ?? null
}

export function resolveAbilityHits(
  caster: CombatantState,
  ability: AbilityDefinition,
  combatants: readonly CombatantState[],
  aim: AimInput,
  options: TargetSelectionOptions = {},
): readonly CombatantState[] {
  if (!caster.alive) return Object.freeze([])
  if (ability.target === 'self') return Object.freeze([caster])

  const hitOrigin = hitOriginFor(ability.hitShape, caster, options)
  const origin = targetSortOrigin(ability.hitShape, caster, aim, options)
  const limit = ability.maxTargets ?? Number.POSITIVE_INFINITY
  const hits = combatants
    .filter((target) => validEnemyTarget(caster, target, ability.hitShape, options))
    .filter((target) => hitShapeContainsPoint(
      ability.hitShape,
      hitOrigin,
      aim,
      hitPointFor(ability.hitShape, target, options),
      target.hitRadius,
    ))
    .sort((left, right) => (
      distanceSquared(origin, hitPointFor(ability.hitShape, left, options))
      - distanceSquared(origin, hitPointFor(ability.hitShape, right, options))
      || left.id.localeCompare(right.id)
    ))
    .slice(0, limit)
  return Object.freeze(hits)
}

export function applyDamage(
  target: CombatantState,
  amount: number,
  nowMs: number,
  options: DamageOptions = {},
): DamageResult {
  assertNonNegative(amount, 'damage')
  assertNonNegative(nowMs, 'nowMs')
  const respawnDelayMs = options.respawnDelayMs ?? RESPAWN_DELAY_MS
  assertNonNegative(respawnDelayMs, 'respawnDelayMs')

  if (!target.alive || amount === 0 || isStatusActive(target, 'spawn-protected', nowMs)) {
    return Object.freeze({
      target,
      requestedDamage: amount,
      appliedDamage: 0,
      absorbedByShield: 0,
      healthDamage: 0,
      eliminated: false,
    })
  }

  const activeGuard = target.statuses['damage-guard']
  const guardReduction = activeGuard && activeGuard.expiresAtMs > nowMs
    ? Math.max(0, Math.min(0.9, activeGuard.magnitude))
    : 0
  const mitigatedAmount = amount * (1 - guardReduction)
  const absorbedByShield = options.bypassShield === true
    ? 0
    : Math.min(target.shield, mitigatedAmount)
  const healthRequest = mitigatedAmount - absorbedByShield
  const healthDamage = Math.min(target.health, healthRequest)
  const shield = Math.max(0, target.shield - absorbedByShield)
  const health = Math.max(0, target.health - healthDamage)
  const eliminated = health === 0
  const appliedDamage = absorbedByShield + healthDamage

  const statuses = { ...target.statuses }
  if (eliminated) {
    for (const statusId of Object.keys(statuses) as CombatStatusId[]) delete statuses[statusId]
  } else if (appliedDamage > 0) {
    statuses['damage-guard'] = Object.freeze({
      id: 'damage-guard',
      expiresAtMs: nowMs + DAMAGE_GUARD_DURATION_MS,
      magnitude: DAMAGE_GUARD_REDUCTION,
    })
    if (target.maxShield > 0 && shield < target.maxShield) {
      const missingShield = target.maxShield - shield
      statuses['shield-recharging'] = Object.freeze({
        id: 'shield-recharging',
        expiresAtMs: nowMs
          + SHIELD_RECHARGE_DELAY_MS
          + missingShield / SHIELD_RECHARGE_PER_SECOND * 1_000,
        magnitude: shield / target.maxShield,
      })
    } else {
      delete statuses['shield-recharging']
    }
  }

  const nextTarget: CombatantState = Object.freeze({
    ...target,
    health,
    shield,
    alive: !eliminated,
    statuses: freezeStatuses(statuses),
    deaths: target.deaths + (eliminated ? 1 : 0),
    respawnAtMs: eliminated ? nowMs + respawnDelayMs : null,
  })

  return Object.freeze({
    target: nextTarget,
    requestedDamage: amount,
    appliedDamage,
    absorbedByShield,
    healthDamage,
    eliminated,
  })
}

export function gainUltimateCharge(
  combatant: CombatantState,
  amount: number,
): CombatantState {
  assertNonNegative(amount, 'ultimate charge')
  const ultimateCharge = Math.min(ULTIMATE_MAX_CHARGE, combatant.ultimateCharge + amount)
  if (ultimateCharge === combatant.ultimateCharge) return combatant
  return Object.freeze({ ...combatant, ultimateCharge })
}

function beginCooldown(
  combatant: CombatantState,
  ability: AbilityDefinition,
  nowMs: number,
): CombatantState {
  const readyAtMs = Math.max(
    combatant.cooldownReadyAtMs[ability.slot],
    nowMs + ability.cooldownMs,
  )
  return Object.freeze({
    ...combatant,
    cooldownReadyAtMs: Object.freeze({
      ...combatant.cooldownReadyAtMs,
      [ability.slot]: readyAtMs,
    }),
    ultimateCharge: ability.ultimateCost === undefined
      ? combatant.ultimateCharge
      : Math.max(0, combatant.ultimateCharge - ability.ultimateCost),
  })
}

function grantShield(combatant: CombatantState, amount: number): CombatantState {
  assertNonNegative(amount, 'shield gain')
  const shield = Math.min(combatant.maxShield, combatant.shield + amount)
  return shield === combatant.shield ? combatant : Object.freeze({ ...combatant, shield })
}

function moveForAbility(
  combatant: CombatantState,
  ability: AbilityDefinition,
  aim: AimInput,
): CombatantState {
  if (!ability.movement) return combatant
  const desiredDistance = aim.point
    ? Math.sqrt(distanceSquared(combatant.position, aim.point))
    : ability.movement.distance
  if (desiredDistance <= EPSILON) return combatant
  const direction = aim.point
    ? normalizeDirection(subtract(aim.point, combatant.position))
    : normalizeDirection(aim.direction)
  const distance = Math.min(ability.movement.distance, desiredDistance)
  return Object.freeze({
    ...combatant,
    position: cloneVec3(addScaled(combatant.position, direction, distance)),
    facing: direction,
  })
}

function damageMultiplierFor(target: CombatantState, nowMs: number): number {
  const marked = target.statuses.marked
  return marked && marked.expiresAtMs > nowMs ? 1 + marked.magnitude : 1
}

function scatterInstancesFor(
  ability: AbilityDefinition,
  caster: CombatantState,
  target: CombatantState,
  aim: AimInput,
  options: TargetSelectionOptions,
): number {
  const maximum = Math.max(1, Math.trunc(ability.damage?.instances ?? 1))
  if (ability.mechanic !== 'scatter-shot' || ability.hitShape.kind !== 'cone') return maximum

  const origin = hitOriginFor(ability.hitShape, caster, options)
  const point = hitPointFor(ability.hitShape, target, options)
  const offset = subtract(point, origin)
  const distance = Math.sqrt(lengthSquared(offset))
  if (distance <= EPSILON) return maximum
  const direction = normalizeDirection(aim.direction)
  const angle = Math.acos(Math.max(-1, Math.min(1, dot(offset, direction) / distance)))
  const angleLimit = Math.max(EPSILON, ability.hitShape.halfAngleDegrees * Math.PI / 180)
  const spread = Math.max(distance / ability.hitShape.range, angle / angleLimit)
  const intended = spread <= 0.34 ? 5 : spread <= 0.56 ? 4 : spread <= 0.78 ? 3 : 2
  return Math.min(maximum, intended)
}

function mechanicDamageMultiplier(
  caster: CombatantState,
  target: CombatantState,
  ability: AbilityDefinition,
  nowMs: number,
): number {
  let multiplier = damageMultiplierFor(target, nowMs)
  if (ability.mechanic === 'precision-shot' && isStatusActive(target, 'revealed', nowMs)) {
    multiplier *= 1.25
  }
  if (ability.mechanic === 'suppressed-shot' && isStatusActive(caster, 'cloaked', nowMs)) {
    multiplier *= 1.35
  }
  return multiplier
}

export function castAbility(
  combatants: readonly CombatantState[],
  casterId: string,
  slot: AbilitySlot,
  aim: AimInput,
  nowMs: number,
  options: TargetSelectionOptions = {},
): AbilityCastResult {
  assertNonNegative(nowMs, 'nowMs')
  const caster = combatants.find((candidate) => candidate.id === casterId)
  if (!caster) {
    return Object.freeze({
      ok: false,
      reason: 'unknown-combatant',
      ability: null,
      combatants,
      hitIds: Object.freeze([]),
      eliminatedIds: Object.freeze([]),
      damageDealt: 0,
      detonatedIds: Object.freeze([]),
      damageByTarget: Object.freeze({}),
    })
  }

  const ability = getHeroKit(caster.heroId).abilities[slot]
  const reason = getCastBlockReason(caster, slot, nowMs)
  if (reason) {
    return Object.freeze({
      ok: false,
      reason,
      ability,
      combatants,
      hitIds: Object.freeze([]),
      eliminatedIds: Object.freeze([]),
      damageDealt: 0,
      detonatedIds: Object.freeze([]),
      damageByTarget: Object.freeze({}),
    })
  }

  // Cloak prevents target acquisition, not physics. A shot or area effect that is
  // actually aimed through a hidden combatant still connects; bots and HUD aim
  // assistance continue to use selectAimTarget(), which excludes cloaked targets.
  const hits = resolveAbilityHits(caster, ability, combatants, aim, {
    ...options,
    nowMs,
    includeCloaked: true,
  })
  let nextCaster = beginCooldown(caster, ability, nowMs)
  // Spawn safety is a reset window, not permission to deal damage while
  // invulnerable. Mobility remains safe so a player can leave a camped spawn.
  if (ability.damage !== undefined || ability.target === 'enemies' && ability.slot !== 'mobility') {
    nextCaster = removeStatus(nextCaster, 'spawn-protected')
    // Stealth protects repositioning, but committing to an attack reveals the
    // infiltrator. The suppressed shot still reads the pre-cast cloak below so
    // its first impact receives the ambush bonus.
    nextCaster = removeStatus(nextCaster, 'cloaked')
  }
  const directionLength = lengthSquared(aim.direction)
  if (directionLength > EPSILON) {
    nextCaster = Object.freeze({ ...nextCaster, facing: normalizeDirection(aim.direction) })
  }
  if (ability.shieldGain !== undefined) nextCaster = grantShield(nextCaster, ability.shieldGain)
  nextCaster = moveForAbility(nextCaster, ability, aim)

  for (const status of ability.statuses ?? []) {
    if (status.appliesTo !== 'caster') continue
    nextCaster = applyStatus(nextCaster, status, nowMs)
  }

  const byId = new Map(combatants.map((combatant) => [combatant.id, combatant]))
  byId.set(caster.id, nextCaster)
  let damageDealt = 0
  let reflectedDamage = 0
  const detonatedIds: string[] = []
  const damageByTarget: Record<string, number> = {}
  const reflectedBy = new Map<string, number>()
  const eliminatedIds: string[] = []

  for (const originalTarget of hits) {
    if (originalTarget.id === caster.id) continue
    let target = byId.get(originalTarget.id) ?? originalTarget
    if (ability.damage) {
      // Combo: a detonator cashes in the mark for bonus damage and consumes it.
      const detonating = Boolean(ability.detonates) && isStatusActive(target, 'marked', nowMs)
      const detonationBonus = detonating ? ability.detonates?.bonus ?? 0 : 0
      const instances = scatterInstancesFor(ability, caster, target, aim, options)
      const sourceScale = caster.bot ? BOT_DAMAGE_SCALE : 1
      const requested = ability.damage.amount
        * instances
        * mechanicDamageMultiplier(caster, target, ability, nowMs)
        * (1 + detonationBonus)
        * sourceScale
      const result = applyDamage(target, requested, nowMs, {
        bypassShield: ability.damage.bypassShield,
      })
      target = result.target
      if (detonating) {
        detonatedIds.push(target.id)
        if (target.alive) target = removeStatus(target, 'marked')
      }
      damageDealt += result.appliedDamage
      damageByTarget[target.id] = (damageByTarget[target.id] ?? 0) + result.appliedDamage
      if (result.eliminated) eliminatedIds.push(target.id)

      const reflecting = originalTarget.statuses.reflecting
      if (reflecting && reflecting.expiresAtMs > nowMs) {
        const reflected = result.appliedDamage * reflecting.magnitude
        reflectedDamage += reflected
        reflectedBy.set(originalTarget.id, (reflectedBy.get(originalTarget.id) ?? 0) + reflected)
      }
    }

    for (const status of ability.statuses ?? []) {
      if (status.appliesTo !== 'targets') continue
      if (isStatusActive(target, 'spawn-protected', nowMs)) continue
      target = applyStatus(target, status, nowMs)
    }
    byId.set(target.id, target)
  }

  nextCaster = byId.get(caster.id) ?? nextCaster
  if (reflectedDamage > 0 && nextCaster.alive) {
    const reflection = applyDamage(nextCaster, reflectedDamage, nowMs)
    nextCaster = reflection.target
    if (reflection.eliminated) {
      const reflectorId = [...reflectedBy.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0]
      const reflector = reflectorId ? byId.get(reflectorId) : undefined
      if (reflector) {
        byId.set(reflector.id, Object.freeze({
          ...reflector,
          eliminations: reflector.eliminations + 1,
        }))
      }
    }
  }
  if (slot !== 'ultimate' && nextCaster.alive) {
    const chargeRate = getHeroKit(caster.heroId).stats.ultimateGainPerDamage
    const detonationCharge = detonatedIds.length * (ability.detonates?.ultimateRefund ?? 0)
    nextCaster = gainUltimateCharge(
      nextCaster,
      damageDealt * chargeRate + eliminatedIds.length * 12 + detonationCharge,
    )
  }
  const cooldownRefundMs = detonatedIds.length * (ability.detonates?.cooldownRefundMs ?? 0)
  if (cooldownRefundMs > 0 && nextCaster.alive) {
    nextCaster = Object.freeze({
      ...nextCaster,
      cooldownReadyAtMs: Object.freeze({
        ...nextCaster.cooldownReadyAtMs,
        [slot]: Math.max(nowMs, nextCaster.cooldownReadyAtMs[slot] - cooldownRefundMs),
      }),
    })
  }
  if (eliminatedIds.length > 0) {
    nextCaster = Object.freeze({
      ...nextCaster,
      eliminations: nextCaster.eliminations + eliminatedIds.length,
    })
  }
  byId.set(caster.id, nextCaster)

  const nextCombatants = Object.freeze(combatants.map((combatant) => byId.get(combatant.id) ?? combatant))
  return Object.freeze({
    ok: true,
    reason: null,
    ability,
    combatants: nextCombatants,
    hitIds: Object.freeze(hits.map((target) => target.id)),
    eliminatedIds: Object.freeze(eliminatedIds),
    damageDealt,
    detonatedIds: Object.freeze(detonatedIds),
    damageByTarget: Object.freeze({ ...damageByTarget }),
  })
}

export function respawnCombatant(
  combatant: CombatantState,
  nowMs: number,
): CombatantState {
  assertNonNegative(nowMs, 'nowMs')
  if (combatant.alive || combatant.respawnAtMs === null || nowMs < combatant.respawnAtMs) {
    return combatant
  }

  const spawnProtection = Object.freeze({
    id: 'spawn-protected' as const,
    expiresAtMs: nowMs + SPAWN_PROTECTION_MS,
    magnitude: 1,
  })
  return Object.freeze({
    ...combatant,
    position: cloneVec3(combatant.spawnPosition),
    health: combatant.maxHealth,
    shield: combatant.maxShield,
    alive: true,
    statuses: freezeStatuses({ 'spawn-protected': spawnProtection }),
    respawnAtMs: null,
  })
}

export function rechargeCombatantShield(
  combatant: CombatantState,
  nowMs: number,
): CombatantState {
  assertNonNegative(nowMs, 'nowMs')
  const recharge = combatant.statuses['shield-recharging']
  if (!combatant.alive || !recharge) return combatant
  if (combatant.shield >= combatant.maxShield || combatant.maxShield <= 0) {
    return removeStatus(combatant, 'shield-recharging')
  }

  const shieldAtDamage = combatant.maxShield * Math.max(0, Math.min(1, recharge.magnitude))
  const recoveryDurationMs = (combatant.maxShield - shieldAtDamage)
    / SHIELD_RECHARGE_PER_SECOND * 1_000
  const recoveryStartsAtMs = recharge.expiresAtMs - recoveryDurationMs
  if (nowMs <= recoveryStartsAtMs) return combatant

  const recovered = (nowMs - recoveryStartsAtMs) / 1_000 * SHIELD_RECHARGE_PER_SECOND
  const shield = Math.min(combatant.maxShield, Math.max(combatant.shield, shieldAtDamage + recovered))
  const next = shield === combatant.shield ? combatant : Object.freeze({ ...combatant, shield })
  return shield >= combatant.maxShield ? removeStatus(next, 'shield-recharging') : next
}

export function tickCombatants(
  combatants: readonly CombatantState[],
  nowMs: number,
): readonly CombatantState[] {
  assertNonNegative(nowMs, 'nowMs')
  let changed = false
  const next = combatants.map((combatant) => {
    const respawned = respawnCombatant(combatant, nowMs)
    // Recharge is resolved before expiry cleanup so a coarse server tick that
    // lands on/after the final instant still grants the complete shield.
    const recharged = rechargeCombatantShield(respawned, nowMs)
    const cleaned = clearExpiredStatuses(recharged, nowMs)
    if (cleaned !== combatant) changed = true
    return cleaned
  })
  return changed ? Object.freeze(next) : combatants
}

function freezeObjective(state: ArenaObjectiveState): ArenaObjectiveState {
  return Object.freeze({
    ...state,
    captures: Object.freeze([...state.captures]),
    score: Object.freeze({ ...state.score }),
  })
}

export function createObjectiveState(): ArenaObjectiveState {
  return freezeObjective({
    activeIndex: 0,
    capturingTeam: null,
    progressMs: 0,
    captures: [],
    score: { cipher: 0, fracture: 0 },
    winner: null,
  })
}

export function activePylon(state: ArenaObjectiveState): PylonPrime | null {
  return PYLON_SEQUENCE[state.activeIndex] ?? null
}

export function advanceObjective(
  state: ArenaObjectiveState,
  input: ObjectiveAdvanceInput,
): ArenaObjectiveState {
  assertNonNegative(input.deltaMs, 'deltaMs')
  if (state.winner || input.deltaMs === 0 || input.pylon !== activePylon(state)) return state

  const presentTeams = [...new Set(input.presentTeams)]
  if (presentTeams.length > 1) return state

  if (presentTeams.length === 0) {
    if (state.progressMs === 0) return state
    const progressMs = Math.max(0, state.progressMs - input.deltaMs)
    return freezeObjective({
      ...state,
      progressMs,
      capturingTeam: progressMs === 0 ? null : state.capturingTeam,
    })
  }

  const team = presentTeams[0]
  let capturingTeam = state.capturingTeam
  let progressMs = state.progressMs
  let remainingMs = input.deltaMs

  if (capturingTeam !== null && capturingTeam !== team) {
    const neutralizedMs = Math.min(progressMs, remainingMs)
    progressMs -= neutralizedMs
    remainingMs -= neutralizedMs
    if (progressMs > 0) {
      return freezeObjective({ ...state, progressMs })
    }
    capturingTeam = team
  } else if (capturingTeam === null) {
    capturingTeam = team
  }

  progressMs = Math.min(PYLON_CAPTURE_MS, progressMs + remainingMs)
  if (progressMs < PYLON_CAPTURE_MS) {
    return freezeObjective({ ...state, capturingTeam, progressMs })
  }

  const prime = activePylon(state)
  if (prime === null) return state
  const activeIndex = state.activeIndex + 1
  const score = { ...state.score, [team]: state.score[team] + 1 }
  return freezeObjective({
    activeIndex,
    capturingTeam: null,
    progressMs: 0,
    captures: [...state.captures, { prime, team }],
    score,
    winner: activeIndex >= PYLON_SEQUENCE.length ? team : null,
  })
}

export function chooseBotDecision(
  combatants: readonly CombatantState[],
  botId: string,
  nowMs: number,
  objectivePosition: Vec3 | null,
  options: TargetSelectionOptions = {},
): BotDecision {
  assertNonNegative(nowMs, 'nowMs')
  if (objectivePosition) assertVec3(objectivePosition, 'objectivePosition')
  const bot = combatants.find((combatant) => combatant.id === botId)
  if (!bot || !bot.alive) return Object.freeze({ kind: 'wait', reason: 'dead' })

  const enemies = combatants
    .filter((candidate) => validEnemyTarget(
      bot,
      candidate,
      getHeroKit(bot.heroId).abilities.primary.hitShape,
      { ...options, nowMs },
    ))
    .sort((left, right) => (
      distanceSquared(bot.position, left.position) - distanceSquared(bot.position, right.position)
      || left.id.localeCompare(right.id)
    ))
  const target = enemies[0]
  if (!target) {
    return objectivePosition
      ? Object.freeze({ kind: 'move', destination: cloneVec3(objectivePosition) })
      : Object.freeze({ kind: 'wait', reason: 'no-target' })
  }

  // Aim projectiles/cones from the same eye-to-body line used by the
  // first-person player. Area powers still land on the target's ground point.
  const direction = normalizeDirection(subtract(
    options.hitPoint?.(target) ?? target.position,
    options.hitOrigin ?? bot.position,
  ))
  const aim = Object.freeze({ direction, point: cloneVec3(target.position) })
  const kit = getHeroKit(bot.heroId)
  const signature = kit.abilities.signature
  if (
    signature.target === 'self'
    && bot.shield < bot.maxShield * 0.72
    && canCast(bot, 'signature', nowMs)
  ) {
    return Object.freeze({ kind: 'cast', slot: 'signature', targetId: bot.id, aim })
  }
  const priorities: readonly AbilitySlot[] = ['ultimate', 'signature', 'primary']
  for (const slot of priorities) {
    const ability = kit.abilities[slot]
    if (ability.target === 'self' || !canCast(bot, slot, nowMs)) continue
    const origin = hitOriginFor(ability.hitShape, bot, options)
    const point = hitPointFor(ability.hitShape, target, options)
    const distance = Math.sqrt(distanceSquared(origin, point))
    const threatRange = ability.hitShape.kind === 'radius'
      ? ability.hitShape.center === 'caster'
        ? ability.hitShape.radius + target.hitRadius
        : (ability.hitShape.maxRange ?? 0) + ability.hitShape.radius + target.hitRadius
      : ability.hitShape.range + target.hitRadius
    // This is only a tactical range check. The bot commits to a shot before
    // collision resolution, allowing its telegraphed, locked aim to miss just
    // like a human shot when the opponent dodges.
    if (distance <= threatRange) return Object.freeze({ kind: 'cast', slot, targetId: target.id, aim })
  }

  if (canCast(bot, 'mobility', nowMs)) {
    return Object.freeze({ kind: 'cast', slot: 'mobility', targetId: target.id, aim })
  }
  return Object.freeze({
    kind: 'move',
    destination: cloneVec3(objectivePosition ?? target.position),
  })
}

/** Useful for integration-time assertions and deterministic test fixtures. */
export function hasCompleteCooldownMap(combatant: CombatantState): boolean {
  return ABILITY_SLOTS.every((slot) => Number.isFinite(combatant.cooldownReadyAtMs[slot]))
}

export type {
  AbilityCastResult,
  AbilityDefinition,
  AbilityHitShape,
  AbilitySlot,
  AimInput,
  ArenaObjectiveState,
  BotDecision,
  CombatantState,
  DamageResult,
  HeroId,
  ObjectiveAdvanceInput,
  TeamId,
  Vec3,
} from './types'
