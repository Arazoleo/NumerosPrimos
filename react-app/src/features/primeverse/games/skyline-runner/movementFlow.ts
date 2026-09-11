import type { Aabb, Vec3 } from './types'

/**
 * Flow is the runner's momentum meter: it fills while the run keeps moving
 * (wall runs, grapples, slides, airtime at speed) and drains the moment the run
 * stalls on a rooftop. Everything downstream — top speed, field of view, HUD —
 * reads from this single 0..1 value.
 */
export const FLOW_MAX_SPEED_BONUS = 0.34
export const FLOW_FOV_BONUS = 14
export const SLIDE_MIN_SPEED = 6.4
export const SLIDE_MAX_MS = 1_500
export const SLIDE_BOOST = 5.2
export const SLIDE_CAMERA_SCALE = 0.46

export interface FlowInput {
  readonly flow: number
  readonly deltaSeconds: number
  readonly grounded: boolean
  readonly horizontalSpeed: number
  readonly wallRunning: boolean
  readonly grappling: boolean
  readonly sliding: boolean
  /** One-off boost from a trick: vault, wall jump, clean landing. */
  readonly trickBonus?: number
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function updateFlow(input: FlowInput): number {
  const delta = Number.isFinite(input.deltaSeconds) ? Math.min(Math.max(input.deltaSeconds, 0), 0.1) : 0
  const speed = Number.isFinite(input.horizontalSpeed) ? Math.max(0, input.horizontalSpeed) : 0
  const flowing = input.wallRunning || input.grappling || input.sliding || (!input.grounded && speed > 5)
  const running = input.grounded && speed > 7.5

  let rate = -0.55
  if (flowing) rate = 0.62
  else if (running) rate = 0.12

  const next = input.flow + rate * delta + clamp01(input.trickBonus ?? 0)
  return clamp01(next)
}

/** 1 at a standstill, up to 1.34 in full flow. */
export function flowSpeedMultiplier(flow: number): number {
  return 1 + clamp01(flow) * FLOW_MAX_SPEED_BONUS
}

export function flowFieldOfView(baseFov: number, flow: number): number {
  const base = Number.isFinite(baseFov) ? baseFov : 75
  return base + clamp01(flow) * FLOW_FOV_BONUS
}

export interface SlideState {
  readonly active: boolean
  readonly startedAtMs: number
}

export interface SlideInput {
  readonly state: SlideState
  readonly wantsSlide: boolean
  readonly grounded: boolean
  readonly horizontalSpeed: number
  readonly nowMs: number
}

export interface SlideResult {
  readonly state: SlideState
  /** Speed to add along the current heading on the frame the slide starts. */
  readonly boost: number
  readonly started: boolean
  readonly ended: boolean
  /** Multiplier for eye height: crouched while sliding. */
  readonly cameraHeightScale: number
}

export const IDLE_SLIDE: SlideState = Object.freeze({ active: false, startedAtMs: 0 })

/**
 * A slide starts only from a real run, lasts at most `SLIDE_MAX_MS`, and dies as
 * soon as the runner leaves the ground or drops below walking pace — so it stays
 * a way to keep speed through a low gap, never a faster way to travel flat ground.
 */
export function updateSlide(input: SlideInput): SlideResult {
  const speed = Number.isFinite(input.horizontalSpeed) ? Math.max(0, input.horizontalSpeed) : 0
  const elapsed = input.nowMs - input.state.startedAtMs

  if (input.state.active) {
    const expired = elapsed >= SLIDE_MAX_MS
    const stalled = speed < SLIDE_MIN_SPEED * 0.55
    if (!input.wantsSlide || !input.grounded || expired || stalled) {
      return {
        state: IDLE_SLIDE,
        boost: 0,
        started: false,
        ended: true,
        cameraHeightScale: 1,
      }
    }
    return {
      state: input.state,
      boost: 0,
      started: false,
      ended: false,
      cameraHeightScale: SLIDE_CAMERA_SCALE,
    }
  }

  if (input.wantsSlide && input.grounded && speed >= SLIDE_MIN_SPEED) {
    return {
      state: { active: true, startedAtMs: input.nowMs },
      boost: SLIDE_BOOST,
      started: true,
      ended: false,
      cameraHeightScale: SLIDE_CAMERA_SCALE,
    }
  }

  return { state: IDLE_SLIDE, boost: 0, started: false, ended: false, cameraHeightScale: 1 }
}

export interface MantleInput {
  readonly position: Vec3
  readonly velocity: Vec3
  /** Horizontal facing, normalised by the caller. */
  readonly facing: Vec3
  readonly playerRadius: number
  readonly playerHalfHeight: number
  readonly platforms: readonly Aabb[]
  readonly minLedgeHeight?: number
  readonly maxLedgeHeight?: number
  readonly reach?: number
}

export interface MantleResult {
  /** Where the player body ends up, standing on the ledge. */
  readonly target: Vec3
  readonly ledgeY: number
  readonly climbHeight: number
}

function horizontallyInside(point: Vec3, bounds: Aabb, padding: number): boolean {
  return point.x >= bounds.min.x - padding && point.x <= bounds.max.x + padding
    && point.z >= bounds.min.z - padding && point.z <= bounds.max.z + padding
}

/**
 * Grabbing a ledge: when the runner is falling into a wall whose top edge sits
 * between waist and head height, and the space above that edge is clear, they pull
 * themselves up instead of sliding down the face.
 */
export function detectMantleLedge(input: MantleInput): MantleResult | null {
  const reach = input.reach ?? 0.85
  const minHeight = input.minLedgeHeight ?? 0.2
  const maxHeight = input.maxLedgeHeight ?? 2.1
  const facingLength = Math.hypot(input.facing.x, input.facing.z)
  if (facingLength < 1e-6) return null
  if (input.velocity.y > 1.5) return null

  const facing = { x: input.facing.x / facingLength, z: input.facing.z / facingLength }
  const feetY = input.position.y - input.playerHalfHeight
  const probe: Vec3 = {
    x: input.position.x + facing.x * (input.playerRadius + reach),
    y: feetY,
    z: input.position.z + facing.z * (input.playerRadius + reach),
  }

  let ledge: Aabb | null = null
  for (const bounds of input.platforms) {
    if (!horizontallyInside(probe, bounds, 0)) continue
    const height = bounds.max.y - feetY
    if (height < minHeight || height > maxHeight) continue
    if (!ledge || bounds.max.y > ledge.max.y) ledge = bounds
  }
  if (!ledge) return null

  const target: Vec3 = {
    x: probe.x,
    y: ledge.max.y + input.playerHalfHeight,
    z: probe.z,
  }

  // Refuse the climb when something occupies the landing spot.
  const headroom = { ...target, y: target.y + input.playerHalfHeight * 0.5 }
  for (const bounds of input.platforms) {
    if (bounds === ledge) continue
    if (
      horizontallyInside(headroom, bounds, -input.playerRadius * 0.5)
      && headroom.y > bounds.min.y && target.y < bounds.max.y
    ) return null
  }

  return { target, ledgeY: ledge.max.y, climbHeight: ledge.max.y - feetY }
}

export interface WallJumpInput {
  readonly velocity: Vec3
  readonly wallNormal: Vec3
  /** Horizontal facing, so the runner leaps where they look. */
  readonly facing: Vec3
  readonly flow: number
  readonly pushSpeed?: number
  readonly upSpeed?: number
}

/**
 * Kicking off a wall throws the runner along the wall normal *and* towards where
 * they are looking, scaled by flow — the reward for chaining wall runs.
 */
export function calculateWallJump(input: WallJumpInput): Vec3 {
  const push = input.pushSpeed ?? 7.2
  const up = input.upSpeed ?? 9.1
  const flow = clamp01(input.flow)
  const facingLength = Math.hypot(input.facing.x, input.facing.z)
  const facing = facingLength > 1e-6
    ? { x: input.facing.x / facingLength, z: input.facing.z / facingLength }
    : { x: 0, z: 0 }
  const lead = 2.6 * flow

  return {
    x: input.velocity.x + input.wallNormal.x * push + facing.x * lead,
    y: up + flow * 1.5,
    z: input.velocity.z + input.wallNormal.z * push + facing.z * lead,
  }
}
