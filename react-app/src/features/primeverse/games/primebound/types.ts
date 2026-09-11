/** A point or displacement in the Canvas world, where positive y points down. */
export interface Vec2 {
  readonly x: number
  readonly y: number
}

export type Direction = 'up' | 'down' | 'left' | 'right'

export type EnemyKind = 'crawler' | 'charger' | 'caster' | 'guardian'

export type GamePhase = 'intro' | 'playing' | 'paused' | 'victory' | 'defeat'

export interface Circle {
  readonly center: Vec2
  readonly radius: number
}

/** An axis-aligned box whose x/y coordinate is its top-left corner. */
export interface Aabb {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface DamageState {
  readonly health: number
  readonly invulnerableUntilMs: number
}

export interface DamageRequest {
  readonly amount: number
  readonly nowMs: number
  readonly invulnerabilityMs: number
}

export interface DamageResult extends DamageState {
  readonly applied: boolean
  readonly damageTaken: number
  readonly defeated: boolean
}

export interface SwordAttack {
  readonly origin: Vec2
  readonly facing: Direction
  /** Maximum distance from the attack origin to the target's near edge. */
  readonly range: number
  /** Total angular width of the attack sector, in radians. */
  readonly arcRadians: number
}

export interface DashEligibilityInput {
  readonly phase: GamePhase
  readonly nowMs: number
  readonly lastDashAtMs: number | null
  readonly cooldownMs: number
  readonly stamina: number
  readonly staminaCost: number
  readonly isDashing: boolean
}

export type RuneOrderStatus = 'in-progress' | 'complete' | 'incorrect'

export interface RuneOrderEvaluation {
  readonly status: RuneOrderStatus
  readonly validPrefix: boolean
  readonly complete: boolean
  readonly nextExpected: 2 | 3 | 5 | 7 | 11 | 13 | null
  readonly mismatchIndex: number | null
}

export interface ScoreInput {
  readonly enemiesDefeated: number
  readonly runesActivated: number
  readonly damageTaken: number
  readonly elapsedMs: number
  readonly victory: boolean
}
