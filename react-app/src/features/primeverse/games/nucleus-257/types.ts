export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

export const HERO_IDS = [
  'luma-crivo',
  'raul-rsa',
  'teo-gemeos',
  'yara-diffie',
  'iris-mersenne',
] as const

export type HeroId = (typeof HERO_IDS)[number]

export const ABILITY_SLOTS = [
  'primary',
  'signature',
  'mobility',
  'ultimate',
] as const

export type AbilitySlot = (typeof ABILITY_SLOTS)[number]
export type TeamId = 'cipher' | 'fracture'
export type HexColor = `#${string}`

export type AbilityMechanic =
  | 'precision-shot'
  | 'sieve-field'
  | 'residue-dash'
  | 'sieve-domain'
  | 'scatter-shot'
  | 'rsa-barrier'
  | 'modular-charge'
  | 'rsa-bastion'
  | 'paired-burst'
  | 'twin-detonation'
  | 'echo-step'
  | 'twin-conjecture'
  | 'suppressed-shot'
  | 'public-key-decoy'
  | 'key-exchange'
  | 'shared-secret'
  | 'mersenne-lance'
  | 'perfect-trap'
  | 'exponent-leap'
  | 'mersenne-cascade'

export interface RayHitShape {
  readonly kind: 'ray'
  readonly range: number
  /** Thickness around the mathematical ray, in world units. */
  readonly radius: number
}

export interface ConeHitShape {
  readonly kind: 'cone'
  readonly range: number
  readonly halfAngleDegrees: number
}

export interface RadiusHitShape {
  readonly kind: 'radius'
  readonly radius: number
  readonly center: 'caster' | 'aim'
  /** Only used by aim-centered areas. */
  readonly maxRange?: number
}

export type AbilityHitShape = RayHitShape | ConeHitShape | RadiusHitShape

export type CombatStatusId =
  | 'cloaked'
  | 'damage-guard'
  | 'marked'
  | 'reflecting'
  | 'revealed'
  | 'shield-recharging'
  | 'silenced'
  | 'slowed'
  | 'spawn-protected'

export interface TimedCombatStatus {
  readonly id: CombatStatusId
  readonly expiresAtMs: number
  /** Meaning depends on the status: e.g. 0.3 means 30% slow/reflect/bonus. */
  readonly magnitude: number
}

export interface AbilityStatusApplication {
  readonly id: Exclude<CombatStatusId, 'damage-guard' | 'shield-recharging' | 'spawn-protected'>
  readonly durationMs: number
  readonly magnitude: number
  readonly appliesTo: 'caster' | 'targets'
}

export interface AbilityDamage {
  readonly amount: number
  readonly instances?: number
  readonly bypassShield?: boolean
}

export interface AbilityMovement {
  readonly kind: 'dash' | 'blink'
  readonly distance: number
}

/**
 * Combo payoff: an ability with this detonates the `marked` status a teammate (or an
 * earlier ability) left on the target, for bonus damage and a cooldown/ultimate
 * refund. Marking is cheap; cashing the mark in is the skill.
 */
export interface AbilityDetonation {
  /** Extra damage fraction on top of the mark's own magnitude. */
  readonly bonus: number
  /** Ultimate charge granted per detonated target. */
  readonly ultimateRefund?: number
  /** Cooldown taken off this ability per detonated target. */
  readonly cooldownRefundMs?: number
}

export interface AbilityDefinition {
  readonly id: string
  readonly slot: AbilitySlot
  readonly name: string
  readonly spokenName: string
  readonly description: string
  readonly mechanic: AbilityMechanic
  readonly cooldownMs: number
  readonly target: 'enemies' | 'self'
  readonly hitShape: AbilityHitShape
  readonly damage?: AbilityDamage
  readonly shieldGain?: number
  readonly movement?: AbilityMovement
  readonly statuses?: readonly AbilityStatusApplication[]
  readonly maxTargets?: number
  readonly ultimateCost?: number
  readonly detonates?: AbilityDetonation
}

export interface HeroStats {
  readonly maxHealth: number
  readonly maxShield: number
  readonly moveSpeed: number
  readonly hitRadius: number
  /** Ultimate points earned per point of effective non-ultimate damage. */
  readonly ultimateGainPerDamage: number
}

export interface HeroKit {
  readonly id: HeroId
  readonly characterName: string
  readonly codename: string
  readonly gender: 'man' | 'woman'
  readonly role: 'controller' | 'tank' | 'assault' | 'infiltrator'
  readonly affinity: string
  readonly description: string
  readonly accent: HexColor
  readonly stats: HeroStats
  readonly abilities: Readonly<Record<AbilitySlot, AbilityDefinition>>
}

export type CooldownState = Readonly<Record<AbilitySlot, number>>
export type CombatStatusState = Readonly<Partial<Record<CombatStatusId, TimedCombatStatus>>>

export interface CombatantState {
  readonly id: string
  readonly heroId: HeroId
  readonly team: TeamId
  readonly bot: boolean
  readonly position: Vec3
  readonly spawnPosition: Vec3
  readonly facing: Vec3
  readonly health: number
  readonly maxHealth: number
  readonly shield: number
  readonly maxShield: number
  readonly hitRadius: number
  readonly alive: boolean
  readonly cooldownReadyAtMs: CooldownState
  readonly statuses: CombatStatusState
  readonly ultimateCharge: number
  readonly eliminations: number
  readonly deaths: number
  readonly respawnAtMs: number | null
}

export interface CreateCombatantInput {
  readonly id: string
  readonly heroId: HeroId
  readonly team: TeamId
  readonly position: Vec3
  readonly facing?: Vec3
  readonly bot?: boolean
}

export interface AimInput {
  readonly direction: Vec3
  /** Ground/area center or desired movement destination. */
  readonly point?: Vec3
}

export type CastBlockReason =
  | 'dead'
  | 'cooldown'
  | 'silenced'
  | 'ultimate-not-ready'

export interface DamageOptions {
  readonly bypassShield?: boolean
  readonly respawnDelayMs?: number
}

export interface DamageResult {
  readonly target: CombatantState
  readonly requestedDamage: number
  readonly appliedDamage: number
  readonly absorbedByShield: number
  readonly healthDamage: number
  readonly eliminated: boolean
}

export interface AbilityCastResult {
  readonly ok: boolean
  readonly reason: CastBlockReason | 'unknown-combatant' | null
  readonly ability: AbilityDefinition | null
  readonly combatants: readonly CombatantState[]
  readonly hitIds: readonly string[]
  readonly eliminatedIds: readonly string[]
  readonly damageDealt: number
  /** Targets whose mark this cast detonated. */
  readonly detonatedIds: readonly string[]
  /** Damage dealt per target, for floating numbers and hit markers. */
  readonly damageByTarget: Readonly<Record<string, number>>
}

export type PylonPrime = 2 | 3 | 5 | 7

export interface PylonCapture {
  readonly prime: PylonPrime
  readonly team: TeamId
}

export interface ArenaObjectiveState {
  /** Equals four after the final pylon has been locked. */
  readonly activeIndex: number
  readonly capturingTeam: TeamId | null
  readonly progressMs: number
  readonly captures: readonly PylonCapture[]
  readonly score: Readonly<Record<TeamId, number>>
  readonly winner: TeamId | null
}

export interface ObjectiveAdvanceInput {
  readonly pylon: PylonPrime
  readonly presentTeams: readonly TeamId[]
  readonly deltaMs: number
}

export type BotDecision =
  | { readonly kind: 'wait'; readonly reason: 'dead' | 'no-target' }
  | { readonly kind: 'move'; readonly destination: Vec3 }
  | {
      readonly kind: 'cast'
      readonly slot: AbilitySlot
      readonly targetId: string
      readonly aim: AimInput
    }
