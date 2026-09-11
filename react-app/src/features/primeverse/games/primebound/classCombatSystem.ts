import type { CombatCooldownId } from './combatSystem'
import {
  HERO_ACTION_SLOTS,
  HERO_SLOT_ACTION_IDS,
  type HeroActionSlot,
  type HeroClassId,
} from './heroClassSystem'

/**
 * Class-specific combat rules for Primebound.
 *
 * This module intentionally has no knowledge of React, Canvas or the mutable
 * game engine. It describes how attacks travel and exposes immutable state
 * transitions that the renderer can animate independently.
 */

export const CLASS_MECHANIC_IDS = [
  'warrior-combo',
  'rsa-marks',
  'ranger-focus',
  'arcane-glyphs',
  'mobius-sign',
  'goldbach-rage',
  'sieve-machines',
  'elliptic-points',
] as const

export type ClassMechanicId = (typeof CLASS_MECHANIC_IDS)[number]

export const COMBAT_DELIVERY_KINDS = [
  'melee-combo',
  'lunge-line',
  'grappling-chain',
  'radial-burst',
  'counter-guard',
  'execution-dash',
  'homing-projectile',
  'rsa-mark-volley',
  'rsa-detonation',
  'homing-swarm',
  'projectile-reflector',
  'rsa-network',
  'straight-projectile',
  'spread-projectile',
  'chain-projectile',
  'projectile-rain',
  'evasive-counter',
  'piercing-projectile',
  'ground-zone',
  'twin-ground-zone',
  'glyph-detonation',
  'remote-slow-zone',
  'ward-zone',
  'map-wide-zone',
  'shadow-step-strike',
  'mobius-twin-cut',
  'squarefree-mark-detonation',
  'inversion-domain',
  'null-sign-counter',
  'divisor-execution',
  'rage-cleave',
  'goldbach-twin-axes',
  'even-sum-chain',
  'paired-prime-eruption',
  'conjecture-guard',
  'goldbach-cataclysm',
  'sieve-bolt',
  'twin-turret-deploy',
  'composite-line-sieve',
  'eratosthenes-minefield',
  'prime-barrier',
  'sieve-overdrive-grid',
  'curve-orb',
  'point-double-cast',
  'point-addition-chain',
  'elliptic-singularity',
  'infinity-point-ward',
  'curve-of-destiny',
] as const

export type CombatDeliveryKind = (typeof COMBAT_DELIVERY_KINDS)[number]

export type CombatTargetingMode =
  | 'forward-cone'
  | 'forward-line'
  | 'locked-target'
  | 'marked-targets'
  | 'ground-point'
  | 'placed-zones'
  | 'self-area'
  | 'movement-direction'
  | 'all-enemies'

export interface ClassActionDelivery {
  readonly classId: HeroClassId
  readonly slot: HeroActionSlot
  readonly actionId: CombatCooldownId
  readonly classMechanic: ClassMechanicId
  readonly kind: CombatDeliveryKind
  readonly targeting: CombatTargetingMode
  readonly maxTargets: number
  /** Relative to the base projectile speed. Zero means no projectile. */
  readonly projectileSpeedMultiplier: number
  readonly projectileLifetimeMs: number
  readonly persistsMs: number
  readonly pierces: boolean
}

type DeliverySource = Omit<ClassActionDelivery, 'classId' | 'slot' | 'actionId'>
type DeliveryLoadoutSource = Readonly<Record<HeroActionSlot, DeliverySource>>
export type ClassActionDeliveryLoadout = Readonly<
  Record<HeroActionSlot, ClassActionDelivery>
>

const noProjectile = Object.freeze({
  projectileSpeedMultiplier: 0,
  projectileLifetimeMs: 0,
})

function defineDeliveryLoadout(
  classId: HeroClassId,
  source: DeliveryLoadoutSource,
): ClassActionDeliveryLoadout {
  const deliveryFor = (slot: HeroActionSlot): ClassActionDelivery =>
    Object.freeze({
      classId,
      slot,
      actionId: HERO_SLOT_ACTION_IDS[slot],
      ...source[slot],
    })

  return Object.freeze({
    J: deliveryFor('J'),
    '1': deliveryFor('1'),
    '2': deliveryFor('2'),
    '3': deliveryFor('3'),
    Q: deliveryFor('Q'),
    R: deliveryFor('R'),
  })
}

export const CLASS_ACTION_DELIVERIES: Readonly<
  Record<HeroClassId, ClassActionDeliveryLoadout>
> = Object.freeze({
  'prime-warrior': defineDeliveryLoadout('prime-warrior', {
    J: {
      classMechanic: 'warrior-combo',
      kind: 'melee-combo',
      targeting: 'forward-cone',
      maxTargets: 1,
      ...noProjectile,
      persistsMs: 0,
      pierces: false,
    },
    '1': {
      classMechanic: 'warrior-combo',
      kind: 'lunge-line',
      targeting: 'forward-line',
      maxTargets: 3,
      ...noProjectile,
      persistsMs: 0,
      pierces: true,
    },
    '2': {
      classMechanic: 'warrior-combo',
      kind: 'grappling-chain',
      targeting: 'forward-cone',
      maxTargets: 3,
      ...noProjectile,
      persistsMs: 0,
      pierces: true,
    },
    '3': {
      classMechanic: 'warrior-combo',
      kind: 'radial-burst',
      targeting: 'self-area',
      maxTargets: 12,
      ...noProjectile,
      persistsMs: 520,
      pierces: true,
    },
    Q: {
      classMechanic: 'warrior-combo',
      kind: 'counter-guard',
      targeting: 'self-area',
      maxTargets: 1,
      ...noProjectile,
      persistsMs: 680,
      pierces: false,
    },
    R: {
      classMechanic: 'warrior-combo',
      kind: 'execution-dash',
      targeting: 'forward-line',
      maxTargets: 16,
      ...noProjectile,
      persistsMs: 900,
      pierces: true,
    },
  }),
  'rsa-cryptographer': defineDeliveryLoadout('rsa-cryptographer', {
    J: {
      classMechanic: 'rsa-marks',
      kind: 'homing-projectile',
      targeting: 'locked-target',
      maxTargets: 1,
      projectileSpeedMultiplier: 0.92,
      projectileLifetimeMs: 1_600,
      persistsMs: 0,
      pierces: false,
    },
    '1': {
      classMechanic: 'rsa-marks',
      kind: 'rsa-mark-volley',
      targeting: 'locked-target',
      maxTargets: 1,
      projectileSpeedMultiplier: 1.05,
      projectileLifetimeMs: 1_500,
      persistsMs: 4_000,
      pierces: false,
    },
    '2': {
      classMechanic: 'rsa-marks',
      kind: 'rsa-detonation',
      targeting: 'marked-targets',
      maxTargets: 8,
      ...noProjectile,
      persistsMs: 480,
      pierces: true,
    },
    '3': {
      classMechanic: 'rsa-marks',
      kind: 'homing-swarm',
      targeting: 'marked-targets',
      maxTargets: 7,
      projectileSpeedMultiplier: 1.2,
      projectileLifetimeMs: 1_800,
      persistsMs: 700,
      pierces: false,
    },
    Q: {
      classMechanic: 'rsa-marks',
      kind: 'projectile-reflector',
      targeting: 'self-area',
      maxTargets: 6,
      ...noProjectile,
      persistsMs: 760,
      pierces: true,
    },
    R: {
      classMechanic: 'rsa-marks',
      kind: 'rsa-network',
      targeting: 'all-enemies',
      maxTargets: 32,
      ...noProjectile,
      persistsMs: 1_400,
      pierces: true,
    },
  }),
  'modular-ranger': defineDeliveryLoadout('modular-ranger', {
    J: {
      classMechanic: 'ranger-focus',
      kind: 'straight-projectile',
      targeting: 'forward-line',
      maxTargets: 1,
      projectileSpeedMultiplier: 1.65,
      projectileLifetimeMs: 1_200,
      persistsMs: 0,
      pierces: false,
    },
    '1': {
      classMechanic: 'ranger-focus',
      kind: 'spread-projectile',
      targeting: 'forward-cone',
      maxTargets: 2,
      projectileSpeedMultiplier: 1.5,
      projectileLifetimeMs: 1_250,
      persistsMs: 0,
      pierces: false,
    },
    '2': {
      classMechanic: 'ranger-focus',
      kind: 'chain-projectile',
      targeting: 'locked-target',
      maxTargets: 5,
      projectileSpeedMultiplier: 1.35,
      projectileLifetimeMs: 1_700,
      persistsMs: 0,
      pierces: false,
    },
    '3': {
      classMechanic: 'ranger-focus',
      kind: 'projectile-rain',
      targeting: 'ground-point',
      maxTargets: 16,
      projectileSpeedMultiplier: 1.2,
      projectileLifetimeMs: 900,
      persistsMs: 900,
      pierces: true,
    },
    Q: {
      classMechanic: 'ranger-focus',
      kind: 'evasive-counter',
      targeting: 'movement-direction',
      maxTargets: 1,
      ...noProjectile,
      persistsMs: 420,
      pierces: false,
    },
    R: {
      classMechanic: 'ranger-focus',
      kind: 'piercing-projectile',
      targeting: 'forward-line',
      maxTargets: 32,
      projectileSpeedMultiplier: 2.4,
      projectileLifetimeMs: 1_500,
      persistsMs: 900,
      pierces: true,
    },
  }),
  'mersenne-arcanist': defineDeliveryLoadout('mersenne-arcanist', {
    J: {
      classMechanic: 'arcane-glyphs',
      kind: 'ground-zone',
      targeting: 'ground-point',
      maxTargets: 4,
      ...noProjectile,
      persistsMs: 4_200,
      pierces: true,
    },
    '1': {
      classMechanic: 'arcane-glyphs',
      kind: 'twin-ground-zone',
      targeting: 'ground-point',
      maxTargets: 6,
      ...noProjectile,
      persistsMs: 4_800,
      pierces: true,
    },
    '2': {
      classMechanic: 'arcane-glyphs',
      kind: 'glyph-detonation',
      targeting: 'placed-zones',
      maxTargets: 10,
      ...noProjectile,
      persistsMs: 620,
      pierces: true,
    },
    '3': {
      classMechanic: 'arcane-glyphs',
      kind: 'remote-slow-zone',
      targeting: 'ground-point',
      maxTargets: 20,
      ...noProjectile,
      persistsMs: 1_650,
      pierces: true,
    },
    Q: {
      classMechanic: 'arcane-glyphs',
      kind: 'ward-zone',
      targeting: 'self-area',
      maxTargets: 8,
      ...noProjectile,
      persistsMs: 900,
      pierces: true,
    },
    R: {
      classMechanic: 'arcane-glyphs',
      kind: 'map-wide-zone',
      targeting: 'all-enemies',
      maxTargets: 32,
      ...noProjectile,
      persistsMs: 3_200,
      pierces: true,
    },
  }),
  'mobius-assassin': defineDeliveryLoadout('mobius-assassin', {
    J: {
      classMechanic: 'mobius-sign',
      kind: 'shadow-step-strike',
      targeting: 'locked-target',
      maxTargets: 1,
      ...noProjectile,
      persistsMs: 0,
      pierces: false,
    },
    '1': {
      classMechanic: 'mobius-sign',
      kind: 'mobius-twin-cut',
      targeting: 'forward-cone',
      maxTargets: 2,
      ...noProjectile,
      persistsMs: 0,
      pierces: true,
    },
    '2': {
      classMechanic: 'mobius-sign',
      kind: 'squarefree-mark-detonation',
      targeting: 'marked-targets',
      maxTargets: 8,
      ...noProjectile,
      persistsMs: 520,
      pierces: true,
    },
    '3': {
      classMechanic: 'mobius-sign',
      kind: 'inversion-domain',
      targeting: 'self-area',
      maxTargets: 16,
      ...noProjectile,
      persistsMs: 1_050,
      pierces: true,
    },
    Q: {
      classMechanic: 'mobius-sign',
      kind: 'null-sign-counter',
      targeting: 'movement-direction',
      maxTargets: 1,
      ...noProjectile,
      persistsMs: 480,
      pierces: false,
    },
    R: {
      classMechanic: 'mobius-sign',
      kind: 'divisor-execution',
      targeting: 'all-enemies',
      maxTargets: 32,
      ...noProjectile,
      persistsMs: 1_200,
      pierces: true,
    },
  }),
  'goldbach-berserker': defineDeliveryLoadout('goldbach-berserker', {
    J: {
      classMechanic: 'goldbach-rage',
      kind: 'rage-cleave',
      targeting: 'forward-cone',
      maxTargets: 3,
      ...noProjectile,
      persistsMs: 0,
      pierces: true,
    },
    '1': {
      classMechanic: 'goldbach-rage',
      kind: 'goldbach-twin-axes',
      targeting: 'forward-line',
      maxTargets: 6,
      ...noProjectile,
      persistsMs: 260,
      pierces: true,
    },
    '2': {
      classMechanic: 'goldbach-rage',
      kind: 'even-sum-chain',
      targeting: 'forward-cone',
      maxTargets: 8,
      ...noProjectile,
      persistsMs: 520,
      pierces: true,
    },
    '3': {
      classMechanic: 'goldbach-rage',
      kind: 'paired-prime-eruption',
      targeting: 'self-area',
      maxTargets: 20,
      ...noProjectile,
      persistsMs: 940,
      pierces: true,
    },
    Q: {
      classMechanic: 'goldbach-rage',
      kind: 'conjecture-guard',
      targeting: 'self-area',
      maxTargets: 4,
      ...noProjectile,
      persistsMs: 760,
      pierces: false,
    },
    R: {
      classMechanic: 'goldbach-rage',
      kind: 'goldbach-cataclysm',
      targeting: 'all-enemies',
      maxTargets: 32,
      ...noProjectile,
      persistsMs: 1_500,
      pierces: true,
    },
  }),
  'sieve-engineer': defineDeliveryLoadout('sieve-engineer', {
    J: {
      classMechanic: 'sieve-machines',
      kind: 'sieve-bolt',
      targeting: 'forward-line',
      maxTargets: 1,
      projectileSpeedMultiplier: 1.4,
      projectileLifetimeMs: 1_400,
      persistsMs: 0,
      pierces: false,
    },
    '1': {
      classMechanic: 'sieve-machines',
      kind: 'twin-turret-deploy',
      targeting: 'ground-point',
      maxTargets: 8,
      ...noProjectile,
      persistsMs: 5_000,
      pierces: true,
    },
    '2': {
      classMechanic: 'sieve-machines',
      kind: 'composite-line-sieve',
      targeting: 'forward-line',
      maxTargets: 16,
      ...noProjectile,
      persistsMs: 900,
      pierces: true,
    },
    '3': {
      classMechanic: 'sieve-machines',
      kind: 'eratosthenes-minefield',
      targeting: 'ground-point',
      maxTargets: 20,
      ...noProjectile,
      persistsMs: 4_200,
      pierces: true,
    },
    Q: {
      classMechanic: 'sieve-machines',
      kind: 'prime-barrier',
      targeting: 'self-area',
      maxTargets: 12,
      ...noProjectile,
      persistsMs: 1_100,
      pierces: true,
    },
    R: {
      classMechanic: 'sieve-machines',
      kind: 'sieve-overdrive-grid',
      targeting: 'all-enemies',
      maxTargets: 32,
      ...noProjectile,
      persistsMs: 3_600,
      pierces: true,
    },
  }),
  'elliptic-oracle': defineDeliveryLoadout('elliptic-oracle', {
    J: {
      classMechanic: 'elliptic-points',
      kind: 'curve-orb',
      targeting: 'locked-target',
      maxTargets: 1,
      projectileSpeedMultiplier: 1.05,
      projectileLifetimeMs: 1_800,
      persistsMs: 0,
      pierces: false,
    },
    '1': {
      classMechanic: 'elliptic-points',
      kind: 'point-double-cast',
      targeting: 'locked-target',
      maxTargets: 2,
      projectileSpeedMultiplier: 0.95,
      projectileLifetimeMs: 1_900,
      persistsMs: 420,
      pierces: false,
    },
    '2': {
      classMechanic: 'elliptic-points',
      kind: 'point-addition-chain',
      targeting: 'marked-targets',
      maxTargets: 7,
      projectileSpeedMultiplier: 1.1,
      projectileLifetimeMs: 2_200,
      persistsMs: 700,
      pierces: true,
    },
    '3': {
      classMechanic: 'elliptic-points',
      kind: 'elliptic-singularity',
      targeting: 'ground-point',
      maxTargets: 20,
      ...noProjectile,
      persistsMs: 1_800,
      pierces: true,
    },
    Q: {
      classMechanic: 'elliptic-points',
      kind: 'infinity-point-ward',
      targeting: 'self-area',
      maxTargets: 10,
      ...noProjectile,
      persistsMs: 1_000,
      pierces: true,
    },
    R: {
      classMechanic: 'elliptic-points',
      kind: 'curve-of-destiny',
      targeting: 'all-enemies',
      maxTargets: 32,
      ...noProjectile,
      persistsMs: 3_400,
      pierces: true,
    },
  }),
})

export type ClassActionDeliveryById = Readonly<
  Record<CombatCooldownId, ClassActionDelivery>
>

function indexLoadoutByActionId(
  loadout: ClassActionDeliveryLoadout,
): ClassActionDeliveryById {
  return Object.freeze({
    'basic-strike': loadout.J,
    'twin-blades': loadout['1'],
    'sophie-chain': loadout['2'],
    'mersenne-burst': loadout['3'],
    'irreducible-aegis': loadout.Q,
    'prime-infinity': loadout.R,
  })
}

export const CLASS_ACTION_DELIVERIES_BY_ID: Readonly<
  Record<HeroClassId, ClassActionDeliveryById>
> = Object.freeze({
  'prime-warrior': indexLoadoutByActionId(CLASS_ACTION_DELIVERIES['prime-warrior']),
  'rsa-cryptographer': indexLoadoutByActionId(
    CLASS_ACTION_DELIVERIES['rsa-cryptographer'],
  ),
  'modular-ranger': indexLoadoutByActionId(CLASS_ACTION_DELIVERIES['modular-ranger']),
  'mersenne-arcanist': indexLoadoutByActionId(
    CLASS_ACTION_DELIVERIES['mersenne-arcanist'],
  ),
  'mobius-assassin': indexLoadoutByActionId(
    CLASS_ACTION_DELIVERIES['mobius-assassin'],
  ),
  'goldbach-berserker': indexLoadoutByActionId(
    CLASS_ACTION_DELIVERIES['goldbach-berserker'],
  ),
  'sieve-engineer': indexLoadoutByActionId(
    CLASS_ACTION_DELIVERIES['sieve-engineer'],
  ),
  'elliptic-oracle': indexLoadoutByActionId(
    CLASS_ACTION_DELIVERIES['elliptic-oracle'],
  ),
})

export function getClassActionDelivery(
  classId: HeroClassId,
  slotOrActionId: HeroActionSlot | CombatCooldownId,
): ClassActionDelivery {
  const loadout = CLASS_ACTION_DELIVERIES[classId]
  if (!loadout) {
    throw new RangeError(`unsupported hero class: ${String(classId)}`)
  }
  if ((HERO_ACTION_SLOTS as readonly string[]).includes(slotOrActionId)) {
    return loadout[slotOrActionId as HeroActionSlot]
  }
  const delivery = CLASS_ACTION_DELIVERIES_BY_ID[classId][
    slotOrActionId as CombatCooldownId
  ]
  if (!delivery) {
    throw new RangeError(`unsupported combat action: ${String(slotOrActionId)}`)
  }
  return delivery
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`)
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  assertFinite(value, label)
  if (value < 0) {
    throw new RangeError(`${label} must not be negative`)
  }
}

function assertPositiveFinite(value: number, label: string): void {
  assertFinite(value, label)
  if (value <= 0) {
    throw new RangeError(`${label} must be positive`)
  }
}

function assertLimit(value: number, label: string): void {
  if (value !== Number.POSITIVE_INFINITY && (!Number.isInteger(value) || value < 0)) {
    throw new RangeError(`${label} must be a non-negative integer or Infinity`)
  }
}

function squaredDistance(a: CombatPoint, b: CombatPoint): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

export interface CombatPoint {
  readonly x: number
  readonly y: number
}

export interface ForwardConeTarget extends CombatPoint {
  readonly id: string
  readonly radius?: number
  readonly targetable?: boolean
}

export interface ForwardConeOptions {
  readonly range: number
  readonly halfAngleRadians: number
  readonly maxTargets?: number
}

/** Selects nearest valid targets without mutating or reordering the input. */
export function selectTargetsInForwardCone<Target extends ForwardConeTarget>(
  origin: CombatPoint,
  facingRadians: number,
  targets: readonly Target[],
  options: ForwardConeOptions,
): readonly Target[] {
  assertFinite(origin.x, 'origin.x')
  assertFinite(origin.y, 'origin.y')
  assertFinite(facingRadians, 'facingRadians')
  assertNonNegativeFinite(options.range, 'range')
  assertNonNegativeFinite(options.halfAngleRadians, 'halfAngleRadians')
  if (options.halfAngleRadians > Math.PI) {
    throw new RangeError('halfAngleRadians must not exceed PI')
  }
  const maxTargets = options.maxTargets ?? Number.POSITIVE_INFINITY
  assertLimit(maxTargets, 'maxTargets')

  const selected = targets
    .map((target, index) => {
      assertFinite(target.x, `targets[${index}].x`)
      assertFinite(target.y, `targets[${index}].y`)
      const radius = target.radius ?? 0
      assertNonNegativeFinite(radius, `targets[${index}].radius`)
      const dx = target.x - origin.x
      const dy = target.y - origin.y
      const distance = Math.hypot(dx, dy)
      const angleDelta = Math.abs(
        Math.atan2(
          Math.sin(Math.atan2(dy, dx) - facingRadians),
          Math.cos(Math.atan2(dy, dx) - facingRadians),
        ),
      )
      return { target, index, distance, radius, angleDelta }
    })
    .filter(({ target, distance, radius, angleDelta }) =>
      target.targetable !== false &&
      distance - radius <= options.range &&
      (distance === 0 || angleDelta <= options.halfAngleRadians),
    )
    .sort((left, right) => left.distance - right.distance || left.index - right.index)
    .slice(0, maxTargets)
    .map(({ target }) => target)

  return Object.freeze(selected)
}

export interface RangerChainOptions {
  readonly jumpRange: number
  readonly maxTargets: number
}

/** Greedily chains to the nearest unvisited target from the previous impact. */
export function selectRangerChainTargets<Target extends ForwardConeTarget>(
  primaryTarget: Target,
  candidates: readonly Target[],
  options: RangerChainOptions,
): readonly Target[] {
  assertNonNegativeFinite(options.jumpRange, 'jumpRange')
  assertLimit(options.maxTargets, 'maxTargets')
  if (options.maxTargets === 0 || primaryTarget.targetable === false) {
    return Object.freeze([])
  }

  const selected: Target[] = [primaryTarget]
  const visitedIds = new Set([primaryTarget.id])
  const jumpRangeSquared = options.jumpRange * options.jumpRange

  while (selected.length < options.maxTargets) {
    const previous = selected[selected.length - 1]
    const nextTarget = candidates
      .map((candidate, index) => ({
        candidate,
        index,
        distance: squaredDistance(previous, candidate),
      }))
      .filter(({ candidate, distance }) =>
        candidate.targetable !== false &&
        !visitedIds.has(candidate.id) &&
        distance <= jumpRangeSquared,
      )
      .sort((left, right) =>
        left.distance - right.distance || left.index - right.index,
      )[0]?.candidate

    if (!nextTarget) break
    selected.push(nextTarget)
    visitedIds.add(nextTarget.id)
  }

  return Object.freeze(selected)
}

export type WarriorComboStep = 0 | 1 | 2 | 3

export interface WarriorComboState {
  readonly step: WarriorComboStep
  readonly expiresAtMs: number
}

export interface WarriorComboAdvance {
  readonly state: WarriorComboState
  readonly step: Exclude<WarriorComboStep, 0>
  readonly damageMultiplier: number
  readonly reachMultiplier: number
  readonly isFinisher: boolean
}

export const WARRIOR_COMBO_WINDOW_MS = 850
export const EMPTY_WARRIOR_COMBO: WarriorComboState = Object.freeze({
  step: 0,
  expiresAtMs: 0,
})

const WARRIOR_COMBO_DAMAGE = Object.freeze([0, 1, 1.18, 1.65] as const)
const WARRIOR_COMBO_REACH = Object.freeze([0, 1, 1.08, 1.24] as const)

export function expireWarriorCombo(
  state: WarriorComboState,
  nowMs: number,
): WarriorComboState {
  assertNonNegativeFinite(nowMs, 'nowMs')
  return state.step !== 0 && nowMs >= state.expiresAtMs
    ? EMPTY_WARRIOR_COMBO
    : state
}

export function advanceWarriorCombo(
  state: WarriorComboState,
  nowMs: number,
  comboWindowMs = WARRIOR_COMBO_WINDOW_MS,
): WarriorComboAdvance {
  assertNonNegativeFinite(nowMs, 'nowMs')
  assertPositiveFinite(comboWindowMs, 'comboWindowMs')
  const current = expireWarriorCombo(state, nowMs)
  const step = (current.step >= 1 && current.step < 3
    ? current.step + 1
    : 1) as Exclude<WarriorComboStep, 0>
  const nextState: WarriorComboState = Object.freeze({
    step,
    expiresAtMs: nowMs + comboWindowMs,
  })
  return Object.freeze({
    state: nextState,
    step,
    damageMultiplier: WARRIOR_COMBO_DAMAGE[step],
    reachMultiplier: WARRIOR_COMBO_REACH[step],
    isFinisher: step === 3,
  })
}

export type RsaPrimeMark = 'p' | 'q'

export interface RsaMarkState {
  readonly pUntilMs: number
  readonly qUntilMs: number
}

export interface RsaMarkApplication {
  readonly state: RsaMarkState
  readonly appliedMark: RsaPrimeMark
  readonly activeMarks: readonly RsaPrimeMark[]
  readonly readyToDetonate: boolean
}

export interface RsaDetonationResult {
  readonly state: RsaMarkState
  readonly detonated: boolean
  readonly consumedMarks: readonly RsaPrimeMark[]
  readonly damageMultiplier: number
  readonly blastRadius: number
}

export const RSA_MARK_DURATION_MS = 4_000
export const RSA_DETONATION_DAMAGE_MULTIPLIER = 2.35
export const RSA_DETONATION_RADIUS = 72
export const EMPTY_RSA_MARKS: RsaMarkState = Object.freeze({
  pUntilMs: 0,
  qUntilMs: 0,
})

function activeRsaMarks(state: RsaMarkState, nowMs: number): readonly RsaPrimeMark[] {
  const marks: RsaPrimeMark[] = []
  if (state.pUntilMs > nowMs) marks.push('p')
  if (state.qUntilMs > nowMs) marks.push('q')
  return Object.freeze(marks)
}

export function expireRsaMarks(state: RsaMarkState, nowMs: number): RsaMarkState {
  assertNonNegativeFinite(nowMs, 'nowMs')
  const pUntilMs = state.pUntilMs > nowMs ? state.pUntilMs : 0
  const qUntilMs = state.qUntilMs > nowMs ? state.qUntilMs : 0
  if (pUntilMs === state.pUntilMs && qUntilMs === state.qUntilMs) return state
  if (pUntilMs === 0 && qUntilMs === 0) return EMPTY_RSA_MARKS
  return Object.freeze({ pUntilMs, qUntilMs })
}

export function getNextRsaMark(state: RsaMarkState, nowMs: number): RsaPrimeMark {
  const marks = activeRsaMarks(expireRsaMarks(state, nowMs), nowMs)
  return marks.includes('p') && !marks.includes('q') ? 'q' : 'p'
}

export function applyRsaMark(
  state: RsaMarkState,
  mark: RsaPrimeMark,
  nowMs: number,
  durationMs = RSA_MARK_DURATION_MS,
): RsaMarkApplication {
  assertNonNegativeFinite(nowMs, 'nowMs')
  assertPositiveFinite(durationMs, 'durationMs')
  const current = expireRsaMarks(state, nowMs)
  const nextState: RsaMarkState = Object.freeze({
    pUntilMs: mark === 'p' ? nowMs + durationMs : current.pUntilMs,
    qUntilMs: mark === 'q' ? nowMs + durationMs : current.qUntilMs,
  })
  const activeMarks = activeRsaMarks(nextState, nowMs)
  return Object.freeze({
    state: nextState,
    appliedMark: mark,
    activeMarks,
    readyToDetonate: activeMarks.length === 2,
  })
}

export function detonateRsaMarks(
  state: RsaMarkState,
  nowMs: number,
): RsaDetonationResult {
  const current = expireRsaMarks(state, nowMs)
  const consumedMarks = activeRsaMarks(current, nowMs)
  const detonated = consumedMarks.length === 2
  return Object.freeze({
    state: detonated ? EMPTY_RSA_MARKS : current,
    detonated,
    consumedMarks: detonated ? consumedMarks : Object.freeze([]),
    damageMultiplier: detonated ? RSA_DETONATION_DAMAGE_MULTIPLIER : 1,
    blastRadius: detonated ? RSA_DETONATION_RADIUS : 0,
  })
}

export type RangerFocusStack = 0 | 1 | 2 | 3

export interface RangerFocusState {
  readonly targetId: string | null
  readonly stacks: RangerFocusStack
  readonly expiresAtMs: number
}

export interface RangerFocusAdvance {
  readonly state: RangerFocusState
  readonly damageMultiplier: number
  readonly chainJumps: number
  readonly reachedMaximum: boolean
}

export const RANGER_FOCUS_DURATION_MS = 2_200
export const EMPTY_RANGER_FOCUS: RangerFocusState = Object.freeze({
  targetId: null,
  stacks: 0,
  expiresAtMs: 0,
})

export function expireRangerFocus(
  state: RangerFocusState,
  nowMs: number,
): RangerFocusState {
  assertNonNegativeFinite(nowMs, 'nowMs')
  return state.targetId !== null && nowMs >= state.expiresAtMs
    ? EMPTY_RANGER_FOCUS
    : state
}

export function advanceRangerFocus(
  state: RangerFocusState,
  targetId: string,
  nowMs: number,
  durationMs = RANGER_FOCUS_DURATION_MS,
): RangerFocusAdvance {
  if (targetId.length === 0) throw new RangeError('targetId must not be empty')
  assertNonNegativeFinite(nowMs, 'nowMs')
  assertPositiveFinite(durationMs, 'durationMs')
  const current = expireRangerFocus(state, nowMs)
  const stacks = (
    current.targetId === targetId
      ? Math.min(3, current.stacks + 1)
      : 1
  ) as Exclude<RangerFocusStack, 0>
  const nextState: RangerFocusState = Object.freeze({
    targetId,
    stacks,
    expiresAtMs: nowMs + durationMs,
  })
  return Object.freeze({
    state: nextState,
    damageMultiplier: 1 + (stacks - 1) * 0.2,
    chainJumps: stacks - 1,
    reachedMaximum: stacks === 3,
  })
}

export function consumeRangerFocus(
  state: RangerFocusState,
  nowMs: number,
): RangerFocusAdvance {
  const current = expireRangerFocus(state, nowMs)
  const stacks = current.stacks
  return Object.freeze({
    state: EMPTY_RANGER_FOCUS,
    damageMultiplier: stacks === 0 ? 1 : 1 + (stacks - 1) * 0.2,
    chainJumps: Math.max(0, stacks - 1),
    reachedMaximum: stacks === 3,
  })
}

export const ARCANE_GLYPH_PRIMES = [3, 7, 31] as const
export type ArcaneGlyphPrime = (typeof ARCANE_GLYPH_PRIMES)[number]

export interface ArcaneGlyph extends CombatPoint {
  readonly id: string
  readonly prime: ArcaneGlyphPrime
  readonly expiresAtMs: number
}

export type ArcaneGlyphState = readonly ArcaneGlyph[]

export interface ArcaneGlyphSeed extends CombatPoint {
  readonly id: string
  readonly prime: ArcaneGlyphPrime
}

export interface AddArcaneGlyphResult {
  readonly state: ArcaneGlyphState
  readonly glyph: ArcaneGlyph
  readonly evicted: ArcaneGlyph | null
}

export interface ConsumeArcaneGlyphOptions {
  readonly center?: CombatPoint
  readonly radius?: number
  readonly maxGlyphs?: number
}

export interface ConsumeArcaneGlyphResult {
  readonly state: ArcaneGlyphState
  readonly consumed: ArcaneGlyphState
  readonly primeSum: number
  readonly completedMersenneSet: boolean
  readonly damageMultiplier: number
}

export const ARCANE_GLYPH_DURATION_MS = 5_000
export const ARCANE_GLYPH_CAPACITY = 3
export const EMPTY_ARCANE_GLYPHS: ArcaneGlyphState = Object.freeze([])

function freezeGlyph(glyph: ArcaneGlyph): ArcaneGlyph {
  return Object.freeze({ ...glyph })
}

export function expireArcaneGlyphs(
  state: ArcaneGlyphState,
  nowMs: number,
): ArcaneGlyphState {
  assertNonNegativeFinite(nowMs, 'nowMs')
  const active = state.filter((glyph) => glyph.expiresAtMs > nowMs)
  if (active.length === state.length) return state
  if (active.length === 0) return EMPTY_ARCANE_GLYPHS
  return Object.freeze(active)
}

export function getNextArcaneGlyphPrime(
  state: ArcaneGlyphState,
  nowMs: number,
): ArcaneGlyphPrime {
  const activeCount = expireArcaneGlyphs(state, nowMs).length
  return ARCANE_GLYPH_PRIMES[activeCount % ARCANE_GLYPH_PRIMES.length]
}

export function addArcaneGlyph(
  state: ArcaneGlyphState,
  seed: ArcaneGlyphSeed,
  nowMs: number,
  durationMs = ARCANE_GLYPH_DURATION_MS,
  capacity = ARCANE_GLYPH_CAPACITY,
): AddArcaneGlyphResult {
  if (seed.id.length === 0) throw new RangeError('glyph id must not be empty')
  assertFinite(seed.x, 'seed.x')
  assertFinite(seed.y, 'seed.y')
  assertNonNegativeFinite(nowMs, 'nowMs')
  assertPositiveFinite(durationMs, 'durationMs')
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError('capacity must be a positive integer')
  }
  if (!(ARCANE_GLYPH_PRIMES as readonly number[]).includes(seed.prime)) {
    throw new RangeError(`unsupported Mersenne glyph prime: ${String(seed.prime)}`)
  }

  const active = expireArcaneGlyphs(state, nowMs).filter(
    (glyph) => glyph.id !== seed.id,
  )
  const glyph = freezeGlyph({ ...seed, expiresAtMs: nowMs + durationMs })
  const withGlyph = [...active, glyph]
  const overflow = Math.max(0, withGlyph.length - capacity)
  const evicted = overflow > 0 ? withGlyph[0] : null
  const nextState = Object.freeze(withGlyph.slice(overflow))
  return Object.freeze({ state: nextState, glyph, evicted })
}

export function consumeArcaneGlyphs(
  state: ArcaneGlyphState,
  nowMs: number,
  options: ConsumeArcaneGlyphOptions = {},
): ConsumeArcaneGlyphResult {
  const active = expireArcaneGlyphs(state, nowMs)
  const radius = options.radius ?? Number.POSITIVE_INFINITY
  if (radius !== Number.POSITIVE_INFINITY) {
    assertNonNegativeFinite(radius, 'radius')
  }
  if (options.center) {
    assertFinite(options.center.x, 'center.x')
    assertFinite(options.center.y, 'center.y')
  }
  const maxGlyphs = options.maxGlyphs ?? Number.POSITIVE_INFINITY
  assertLimit(maxGlyphs, 'maxGlyphs')
  const radiusSquared = radius * radius
  const eligible = active.filter((glyph) =>
    options.center ? squaredDistance(glyph, options.center) <= radiusSquared : true,
  )
  const consumed = Object.freeze(eligible.slice(0, maxGlyphs))
  const consumedIds = new Set(consumed.map((glyph) => glyph.id))
  const nextState = Object.freeze(
    active.filter((glyph) => !consumedIds.has(glyph.id)),
  )
  const uniquePrimes = new Set(consumed.map((glyph) => glyph.prime))
  const completedMersenneSet = ARCANE_GLYPH_PRIMES.every((prime) =>
    uniquePrimes.has(prime),
  )
  const primeSum = consumed.reduce((sum, glyph) => sum + glyph.prime, 0)

  return Object.freeze({
    state: nextState.length === 0 ? EMPTY_ARCANE_GLYPHS : nextState,
    consumed,
    primeSum,
    completedMersenneSet,
    damageMultiplier: 1 + consumed.length * 0.3 + (completedMersenneSet ? 0.9 : 0),
  })
}
