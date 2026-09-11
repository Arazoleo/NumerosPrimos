/**
 * Pure combat rules for Primebound.
 *
 * This module deliberately has no dependency on React, Canvas or the mutable
 * game engine. Its small immutable results can be consumed by the current game
 * loop and by future stages without coupling either side to an animation.
 */

export const PRIME_FAMILY_IDS = [
  'twin-primes',
  'sophie-germain',
  'mersenne',
] as const

export type PrimeFamilyId = (typeof PRIME_FAMILY_IDS)[number]

export interface PrimeFamilyDefinition {
  readonly id: PrimeFamilyId
  readonly name: string
  readonly shortDescription: string
  readonly formula: string
  readonly examples: readonly string[]
}

export const PRIME_FAMILIES: Readonly<Record<PrimeFamilyId, PrimeFamilyDefinition>> =
  Object.freeze({
    'twin-primes': Object.freeze({
      id: 'twin-primes',
      name: 'Primos Gêmeos',
      shortDescription: 'Dois primos separados por exatamente duas unidades.',
      formula: 'p e p + 2 são primos',
      examples: Object.freeze(['3 e 5', '5 e 7', '11 e 13']),
    }),
    'sophie-germain': Object.freeze({
      id: 'sophie-germain',
      name: 'Primos de Sophie Germain',
      shortDescription: 'Um primo p cuja transformação 2p + 1 também é prima.',
      formula: 'p e 2p + 1 são primos',
      examples: Object.freeze(['2 → 5', '3 → 7', '5 → 11']),
    }),
    mersenne: Object.freeze({
      id: 'mersenne',
      name: 'Primos de Mersenne',
      shortDescription: 'Primos que ficam uma unidade abaixo de uma potência de dois.',
      formula: '2^p − 1 é primo',
      examples: Object.freeze(['2² − 1 = 3', '2³ − 1 = 7', '2⁵ − 1 = 31']),
    }),
  })

export const TECHNIQUE_IDS = [
  'twin-blades',
  'sophie-chain',
  'mersenne-burst',
] as const

export type PrimeTechniqueId = (typeof TECHNIQUE_IDS)[number]

export type OffensiveActionId =
  | 'basic-strike'
  | PrimeTechniqueId
  | 'prime-infinity'

export type CombatCooldownId = OffensiveActionId | 'irreducible-aegis'

export interface OffensiveActionDefinition {
  readonly id: OffensiveActionId
  readonly kind: 'basic' | 'technique' | 'ultimate'
  readonly name: string
  /** Text suitable for a speech bubble, subtitle or synthesized voice line. */
  readonly spokenName: string
  readonly description: string
  readonly family: PrimeFamilyId | null
  readonly cooldownMs: number
  readonly hitDamages: readonly number[]
  readonly range: number
  readonly areaRadius: number
  readonly ultimateChargeOnHit: number
  readonly requiredRuneCount: number
}

function freezeAction(
  definition: OffensiveActionDefinition,
): OffensiveActionDefinition {
  return Object.freeze({
    ...definition,
    hitDamages: Object.freeze([...definition.hitDamages]),
  })
}

export const OFFENSIVE_ACTIONS: Readonly<
  Record<OffensiveActionId, OffensiveActionDefinition>
> = Object.freeze({
  'basic-strike': freezeAction({
    id: 'basic-strike',
    kind: 'basic',
    name: 'Corte Unitário',
    spokenName: 'Corte Unitário!',
    description: 'Um corte rápido, confiável e sem custo de energia prima.',
    family: null,
    cooldownMs: 320,
    hitDamages: [14],
    range: 42,
    areaRadius: 0,
    ultimateChargeOnHit: 6,
    requiredRuneCount: 0,
  }),
  'twin-blades': freezeAction({
    id: 'twin-blades',
    kind: 'technique',
    name: 'Lâminas Gêmeas',
    spokenName: 'Lâminas Gêmeas!',
    description: 'Dois cortes sucessivos separados pelo mesmo intervalo dos primos gêmeos.',
    family: 'twin-primes',
    cooldownMs: 3_200,
    hitDamages: [18, 18],
    range: 54,
    areaRadius: 0,
    ultimateChargeOnHit: 12,
    requiredRuneCount: 1,
  }),
  'sophie-chain': freezeAction({
    id: 'sophie-chain',
    kind: 'technique',
    name: 'Corrente de Sophie',
    spokenName: 'Corrente de Sophie Germain!',
    description: 'O segundo elo transforma p em 2p + 1 e atinge com o dobro da força.',
    family: 'sophie-germain',
    cooldownMs: 5_400,
    hitDamages: [16, 32],
    range: 72,
    areaRadius: 0,
    ultimateChargeOnHit: 16,
    requiredRuneCount: 2,
  }),
  'mersenne-burst': freezeAction({
    id: 'mersenne-burst',
    kind: 'technique',
    name: 'Ruptura de Mersenne',
    spokenName: 'Ruptura de Mersenne!',
    description: 'Três ondas 3, 7 e 31 convergem em uma explosão ao redor do herói.',
    family: 'mersenne',
    cooldownMs: 7_200,
    hitDamages: [16, 22, 30],
    range: 40,
    areaRadius: 76,
    ultimateChargeOnHit: 20,
    requiredRuneCount: 3,
  }),
  'prime-infinity': freezeAction({
    id: 'prime-infinity',
    kind: 'ultimate',
    name: 'Infinito de Euclides',
    spokenName: 'Infinito de Euclides!',
    description: 'Libera toda a reserva prima em cinco impactos de força crescente.',
    family: null,
    cooldownMs: 2_000,
    hitDamages: [10, 15, 20, 25, 40],
    range: 112,
    areaRadius: 96,
    ultimateChargeOnHit: 0,
    requiredRuneCount: 3,
  }),
})

export interface DefenseDefinition {
  readonly id: 'irreducible-aegis'
  readonly name: string
  readonly spokenName: string
  readonly parrySpokenName: string
  readonly description: string
  readonly formula: string
  readonly parryWindowMs: number
  readonly guardDurationMs: number
  readonly cooldownMs: number
  /** Fraction of incoming damage prevented during a normal guard. */
  readonly blockReduction: number
  readonly parryDamage: number
  readonly parryStaggerMs: number
  readonly parryUltimateCharge: number
}

export const IRREDUCIBLE_AEGIS: DefenseDefinition = Object.freeze({
  id: 'irreducible-aegis',
  name: 'Guarda de Wilson',
  spokenName: 'Guarda de Wilson!',
  parrySpokenName: 'Teorema de Wilson!',
  description: 'Para p primo, o fatorial anterior deixa resto −1 módulo p; a janela perfeita reflete o golpe.',
  formula: '(p − 1)! ≡ −1 (mod p)',
  parryWindowMs: 180,
  guardDurationMs: 680,
  cooldownMs: 1_400,
  blockReduction: 0.7,
  parryDamage: 28,
  parryStaggerMs: 620,
  parryUltimateCharge: 24,
})

export const ULTIMATE_MAX_CHARGE = 100

export type UltimateChargeSource =
  | 'basic-hit'
  | 'technique-hit'
  | 'perfect-parry'
  | 'enemy-defeated'
  | 'damage-taken'

export const ULTIMATE_CHARGE_GAINS: Readonly<Record<UltimateChargeSource, number>> =
  Object.freeze({
    'basic-hit': OFFENSIVE_ACTIONS['basic-strike'].ultimateChargeOnHit,
    'technique-hit': 14,
    'perfect-parry': IRREDUCIBLE_AEGIS.parryUltimateCharge,
    'enemy-defeated': 18,
    'damage-taken': 4,
  })

export type CooldownState = Readonly<Partial<Record<CombatCooldownId, number>>>

export interface DamageCalculationOptions {
  readonly multiplier?: number
  /** Flat armor applied independently to every hit. */
  readonly armorPerHit?: number
}

export interface DamageBreakdown {
  readonly action: OffensiveActionDefinition
  readonly hits: readonly number[]
  readonly totalDamage: number
}

export interface AppliedCombatDamage {
  readonly previousHealth: number
  readonly health: number
  readonly requestedDamage: number
  readonly damageTaken: number
  readonly defeated: boolean
}

export interface DefenseState {
  readonly startedAtMs: number | null
  readonly parryUntilMs: number
  readonly guardUntilMs: number
  readonly cooldownUntilMs: number
}

export type DefenseStatus = 'ready' | 'parry' | 'guard' | 'cooldown'

export interface BeginDefenseResult {
  readonly activated: boolean
  readonly state: DefenseState
  readonly status: DefenseStatus
  readonly cooldownRemainingMs: number
}

export interface DefenseHitResult {
  readonly outcome: 'parried' | 'blocked' | 'hit'
  readonly state: DefenseState
  readonly incomingDamage: number
  readonly damageTaken: number
  readonly damagePrevented: number
  readonly reflectedDamage: number
  readonly staggerMs: number
  readonly ultimateChargeGained: number
  readonly spokenName: string | null
}

export interface UltimateConsumptionResult {
  readonly activated: boolean
  readonly charge: number
}

export type OffensiveActionAvailabilityReason =
  | 'ready'
  | 'locked'
  | 'cooldown'
  | 'ultimate-not-ready'

export interface OffensiveActionAvailabilityInput {
  readonly actionId: OffensiveActionId
  readonly nowMs: number
  readonly cooldowns: CooldownState
  readonly collectedRuneCount: number
  readonly ultimateCharge: number
}

export interface OffensiveActionAvailability {
  readonly available: boolean
  readonly reason: OffensiveActionAvailabilityReason
  readonly cooldownRemainingMs: number
  readonly missingRuneCount: number
  readonly missingUltimateCharge: number
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`)
}

function assertNonNegative(value: number, label: string): void {
  assertFinite(value, label)
  if (value < 0) throw new RangeError(`${label} must be non-negative`)
}

function assertRatio(value: number, label: string): void {
  assertFinite(value, label)
  if (value < 0 || value > 1) {
    throw new RangeError(`${label} must be between 0 and 1`)
  }
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`)
  }
}

function isOffensiveActionId(value: string): value is OffensiveActionId {
  return Object.prototype.hasOwnProperty.call(OFFENSIVE_ACTIONS, value)
}

function cooldownDuration(actionId: CombatCooldownId): number {
  return actionId === IRREDUCIBLE_AEGIS.id
    ? IRREDUCIBLE_AEGIS.cooldownMs
    : getOffensiveAction(actionId).cooldownMs
}

function assertCooldownId(actionId: CombatCooldownId): void {
  if (actionId !== IRREDUCIBLE_AEGIS.id && !isOffensiveActionId(actionId)) {
    throw new RangeError(`unsupported cooldown action: ${String(actionId)}`)
  }
}

export function getPrimeFamily(familyId: PrimeFamilyId): PrimeFamilyDefinition {
  const family = PRIME_FAMILIES[familyId]
  if (!family) throw new RangeError(`unsupported prime family: ${String(familyId)}`)
  return family
}

export function getOffensiveAction(
  actionId: OffensiveActionId,
): OffensiveActionDefinition {
  if (!isOffensiveActionId(actionId)) {
    throw new RangeError(`unsupported combat action: ${String(actionId)}`)
  }
  return OFFENSIVE_ACTIONS[actionId]
}

/** Calculates all hits without mutating health, charge or cooldown state. */
export function calculateActionDamage(
  actionId: OffensiveActionId,
  options: DamageCalculationOptions = {},
): DamageBreakdown {
  const action = getOffensiveAction(actionId)
  const multiplier = options.multiplier ?? 1
  const armorPerHit = options.armorPerHit ?? 0
  assertNonNegative(multiplier, 'multiplier')
  assertNonNegative(armorPerHit, 'armorPerHit')

  const hits = action.hitDamages.map((baseDamage) =>
    Math.max(0, baseDamage * multiplier - armorPerHit))

  return Object.freeze({
    action,
    hits: Object.freeze(hits),
    totalDamage: hits.reduce((total, damage) => total + damage, 0),
  })
}

/** Applies already-calculated damage, clamping overkill at zero health. */
export function applyCombatDamage(
  health: number,
  requestedDamage: number,
): AppliedCombatDamage {
  assertNonNegative(health, 'health')
  assertNonNegative(requestedDamage, 'requestedDamage')
  const damageTaken = Math.min(health, requestedDamage)
  const remainingHealth = health - damageTaken

  return Object.freeze({
    previousHealth: health,
    health: remainingHealth,
    requestedDamage,
    damageTaken,
    defeated: remainingHealth === 0,
  })
}

export function getCooldownRemaining(
  cooldowns: CooldownState,
  actionId: CombatCooldownId,
  nowMs: number,
): number {
  assertNonNegative(nowMs, 'nowMs')
  assertCooldownId(actionId)
  const readyAtMs = cooldowns[actionId] ?? 0
  assertNonNegative(readyAtMs, `cooldowns.${actionId}`)
  return Math.max(0, readyAtMs - nowMs)
}

export function isCooldownReady(
  cooldowns: CooldownState,
  actionId: CombatCooldownId,
  nowMs: number,
): boolean {
  return getCooldownRemaining(cooldowns, actionId, nowMs) === 0
}

/** Combines unlock, cooldown and ultimate-meter gates for UI and input code. */
export function getOffensiveActionAvailability(
  input: OffensiveActionAvailabilityInput,
): OffensiveActionAvailability {
  const action = getOffensiveAction(input.actionId)
  assertNonNegativeSafeInteger(input.collectedRuneCount, 'collectedRuneCount')
  const charge = clampUltimateCharge(input.ultimateCharge)
  const cooldownRemainingMs = getCooldownRemaining(
    input.cooldowns,
    input.actionId,
    input.nowMs,
  )
  const missingRuneCount = Math.max(0, action.requiredRuneCount - input.collectedRuneCount)
  const missingUltimateCharge = action.kind === 'ultimate'
    ? Math.max(0, ULTIMATE_MAX_CHARGE - charge)
    : 0

  const reason: OffensiveActionAvailabilityReason = missingRuneCount > 0
    ? 'locked'
    : cooldownRemainingMs > 0
      ? 'cooldown'
      : missingUltimateCharge > 0
        ? 'ultimate-not-ready'
        : 'ready'

  return Object.freeze({
    available: reason === 'ready',
    reason,
    cooldownRemainingMs,
    missingRuneCount,
    missingUltimateCharge,
  })
}

/** Starts a cooldown without shortening one that is already running. */
export function startCooldown(
  cooldowns: CooldownState,
  actionId: CombatCooldownId,
  nowMs: number,
): CooldownState {
  assertNonNegative(nowMs, 'nowMs')
  assertCooldownId(actionId)
  const currentReadyAtMs = cooldowns[actionId] ?? 0
  assertNonNegative(currentReadyAtMs, `cooldowns.${actionId}`)
  const nextReadyAtMs = Math.max(currentReadyAtMs, nowMs + cooldownDuration(actionId))

  return Object.freeze({ ...cooldowns, [actionId]: nextReadyAtMs })
}

export function clampUltimateCharge(charge: number): number {
  assertFinite(charge, 'charge')
  return Math.min(ULTIMATE_MAX_CHARGE, Math.max(0, charge))
}

export function addUltimateCharge(currentCharge: number, amount: number): number {
  assertNonNegative(amount, 'amount')
  return clampUltimateCharge(clampUltimateCharge(currentCharge) + amount)
}

export function gainUltimateCharge(
  currentCharge: number,
  source: UltimateChargeSource,
  multiplier = 1,
): number {
  assertNonNegative(multiplier, 'multiplier')
  const gain = ULTIMATE_CHARGE_GAINS[source]
  if (gain === undefined) {
    throw new RangeError(`unsupported ultimate charge source: ${String(source)}`)
  }
  return addUltimateCharge(currentCharge, gain * multiplier)
}

/** Uses the individual action's configured gain (specials need not gain equally). */
export function gainUltimateChargeFromAction(
  currentCharge: number,
  actionId: OffensiveActionId,
  multiplier = 1,
): number {
  assertNonNegative(multiplier, 'multiplier')
  return addUltimateCharge(
    currentCharge,
    getOffensiveAction(actionId).ultimateChargeOnHit * multiplier,
  )
}

export function isUltimateReady(charge: number): boolean {
  return clampUltimateCharge(charge) >= ULTIMATE_MAX_CHARGE
}

/** Consumes a full meter; a failed attempt preserves its current charge. */
export function consumeUltimateCharge(charge: number): UltimateConsumptionResult {
  const clampedCharge = clampUltimateCharge(charge)
  return Object.freeze(isUltimateReady(clampedCharge)
    ? { activated: true, charge: 0 }
    : { activated: false, charge: clampedCharge })
}

export function createDefenseState(): DefenseState {
  return Object.freeze({
    startedAtMs: null,
    parryUntilMs: 0,
    guardUntilMs: 0,
    cooldownUntilMs: 0,
  })
}

export function getDefenseStatus(
  state: DefenseState,
  nowMs: number,
): DefenseStatus {
  assertNonNegative(nowMs, 'nowMs')
  assertNonNegative(state.parryUntilMs, 'parryUntilMs')
  assertNonNegative(state.guardUntilMs, 'guardUntilMs')
  assertNonNegative(state.cooldownUntilMs, 'cooldownUntilMs')
  if (state.startedAtMs !== null) assertNonNegative(state.startedAtMs, 'startedAtMs')

  const hasStarted = state.startedAtMs !== null && nowMs >= state.startedAtMs
  if (hasStarted && nowMs <= state.parryUntilMs) return 'parry'
  if (hasStarted && nowMs <= state.guardUntilMs) return 'guard'
  if (nowMs < state.cooldownUntilMs) return 'cooldown'
  return 'ready'
}

export function beginDefense(
  state: DefenseState,
  nowMs: number,
): BeginDefenseResult {
  const status = getDefenseStatus(state, nowMs)
  if (status !== 'ready') {
    return Object.freeze({
      activated: false,
      state,
      status,
      cooldownRemainingMs: Math.max(0, state.cooldownUntilMs - nowMs),
    })
  }

  const nextState: DefenseState = Object.freeze({
    startedAtMs: nowMs,
    parryUntilMs: nowMs + IRREDUCIBLE_AEGIS.parryWindowMs,
    guardUntilMs: nowMs + IRREDUCIBLE_AEGIS.guardDurationMs,
    cooldownUntilMs: nowMs + IRREDUCIBLE_AEGIS.cooldownMs,
  })

  return Object.freeze({
    activated: true,
    state: nextState,
    status: 'parry',
    cooldownRemainingMs: IRREDUCIBLE_AEGIS.cooldownMs,
  })
}

/** Resolves one incoming hit against the active parry/guard window. */
export function resolveDefenseHit(
  state: DefenseState,
  incomingDamage: number,
  nowMs: number,
): DefenseHitResult {
  assertNonNegative(incomingDamage, 'incomingDamage')
  const status = getDefenseStatus(state, nowMs)

  // A collision carrying no damage cannot farm perfect-parry rewards.
  if (incomingDamage === 0) {
    return Object.freeze({
      outcome: 'hit',
      state,
      incomingDamage,
      damageTaken: 0,
      damagePrevented: 0,
      reflectedDamage: 0,
      staggerMs: 0,
      ultimateChargeGained: 0,
      spokenName: null,
    })
  }

  if (status === 'parry') {
    const consumedState: DefenseState = Object.freeze({
      ...state,
      startedAtMs: null,
      parryUntilMs: 0,
      guardUntilMs: 0,
    })
    return Object.freeze({
      outcome: 'parried',
      state: consumedState,
      incomingDamage,
      damageTaken: 0,
      damagePrevented: incomingDamage,
      reflectedDamage: IRREDUCIBLE_AEGIS.parryDamage,
      staggerMs: IRREDUCIBLE_AEGIS.parryStaggerMs,
      ultimateChargeGained: IRREDUCIBLE_AEGIS.parryUltimateCharge,
      spokenName: IRREDUCIBLE_AEGIS.parrySpokenName,
    })
  }

  if (status === 'guard') {
    assertRatio(IRREDUCIBLE_AEGIS.blockReduction, 'blockReduction')
    const damagePrevented = incomingDamage * IRREDUCIBLE_AEGIS.blockReduction
    return Object.freeze({
      outcome: 'blocked',
      state,
      incomingDamage,
      damageTaken: incomingDamage - damagePrevented,
      damagePrevented,
      reflectedDamage: 0,
      staggerMs: 0,
      ultimateChargeGained: 0,
      spokenName: null,
    })
  }

  return Object.freeze({
    outcome: 'hit',
    state,
    incomingDamage,
    damageTaken: incomingDamage,
    damagePrevented: 0,
    reflectedDamage: 0,
    staggerMs: 0,
    ultimateChargeGained: 0,
    spokenName: null,
  })
}
