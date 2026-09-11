/** World-space vector. Skyline Runner uses positive Y as up. */
export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Axis-aligned bounds represented by inclusive minimum and maximum corners. */
export interface Aabb {
  readonly min: Vec3
  readonly max: Vec3
}

export interface ParkourPlatform {
  readonly id: string
  readonly bounds: Aabb
  /** Defaults to true when omitted. */
  readonly wallRunnable?: boolean
  /** Defaults to true when omitted. */
  readonly blocksGrapple?: boolean
}

export interface PlayerMotion {
  readonly position: Vec3
  readonly velocity: Vec3
  readonly grounded: boolean
  readonly lastGroundedAtMs: number | null
}

export interface MotionStepInput {
  readonly motion: PlayerMotion
  readonly acceleration: Vec3
  readonly deltaSeconds: number
  readonly maxHorizontalSpeed?: number
  readonly maxFallSpeed?: number
}

export interface GrappleAnchor {
  readonly id: string
  readonly position: Vec3
  readonly enabled?: boolean
}

export interface GrappleAnchorSelectionInput {
  readonly origin: Vec3
  readonly viewDirection: Vec3
  readonly anchors: readonly GrappleAnchor[]
  readonly obstacles?: readonly Aabb[]
  readonly maxRange: number
  /** Dot-product threshold in the inclusive interval [-1, 1]. */
  readonly minimumAlignment?: number
  /** Relative importance of alignment versus proximity, in [0, 1]. */
  readonly alignmentWeight?: number
  readonly lineOfSightPadding?: number
}

export interface GrappleAnchorSelection {
  readonly anchor: GrappleAnchor
  readonly distance: number
  readonly alignment: number
  readonly score: number
}

/** Input for aiming the grapple directly at collider-backed world surfaces. */
export interface GrappleSurfaceSelectionInput {
  readonly origin: Vec3
  readonly viewDirection: Vec3
  /** Colliders that may receive the grapple. */
  readonly surfaces: readonly ParkourPlatform[]
  /** Colliders that can occlude a surface. Defaults to `surfaces`. */
  readonly obstacles?: readonly ParkourPlatform[]
  readonly maxRange: number
  /** Expands non-target obstacles while checking cable clearance. */
  readonly obstaclePadding?: number
  /** Moves the usable anchor outward along the hit-face normal. */
  readonly surfaceOffset?: number
}

export interface GrappleSurfaceSelection {
  /** Anchor point offset from the geometry and ready for rope physics. */
  readonly anchor: GrappleAnchor
  readonly surface: ParkourPlatform
  /** Exact, unoffset contact point on the collider face. */
  readonly contactPoint: Vec3
  /** Outward-facing normal of the contacted collider face. */
  readonly normal: Vec3
  /** Ray distance from the origin to `contactPoint`. */
  readonly distance: number
}

export interface GrapplePullInput {
  readonly playerPosition: Vec3
  readonly playerVelocity: Vec3
  readonly anchorPosition: Vec3
  readonly ropeLength: number
  /** Acceleration added per world unit of rope extension. */
  readonly stiffness: number
  /** Dampens radial velocity toward or away from the anchor. */
  readonly damping: number
  readonly maxAcceleration: number
}

export interface GrapplePullResult {
  readonly acceleration: Vec3
  readonly distance: number
  readonly extension: number
  readonly tension: number
  readonly taut: boolean
}

export interface LandingInput {
  readonly wasGrounded: boolean
  readonly isGrounded: boolean
  /** Vertical velocity immediately before contact; negative means falling. */
  readonly verticalVelocity: number
  readonly hardLandingSpeed: number
}

export interface LandingResult {
  readonly landed: boolean
  readonly impactSpeed: number
  readonly hardLanding: boolean
}

export interface LandingSweepInput {
  readonly previousPosition: Vec3
  readonly nextPosition: Vec3
  readonly playerRadius: number
  readonly playerHalfHeight: number
  readonly platforms: readonly ParkourPlatform[]
}

export interface LandingHit {
  readonly platform: ParkourPlatform
  /** Fraction of the movement step at which contact occurred, in [0, 1]. */
  readonly time: number
  readonly position: Vec3
  readonly normal: Vec3
}

export interface CoyoteJumpInput {
  readonly grounded: boolean
  readonly jumpConsumed: boolean
  readonly nowMs: number
  readonly lastGroundedAtMs: number | null
  readonly coyoteWindowMs: number
}

export interface WallRunDetectionInput {
  readonly position: Vec3
  readonly velocity: Vec3
  readonly playerRadius: number
  readonly playerHalfHeight: number
  readonly platforms: readonly ParkourPlatform[]
  /** Maximum horizontal gap between the player collider and the wall. */
  readonly maxDistance: number
  readonly minAlongWallSpeed?: number
}

export interface WallRunSurface {
  readonly platform: ParkourPlatform
  /** Outward-facing normal of the selected vertical face. */
  readonly normal: Vec3
  /** Unit horizontal direction of the player's movement along the wall. */
  readonly tangent: Vec3
  readonly contactPoint: Vec3
  readonly distance: number
  readonly alongWallSpeed: number
}

export interface Checkpoint {
  readonly id: string
  readonly order: number
  readonly trigger: Aabb
  readonly spawn: Vec3
}

export interface CheckpointSelectionInput {
  readonly position: Vec3
  /** Enables swept trigger detection for fast movement between frames. */
  readonly previousPosition?: Vec3
  readonly checkpoints: readonly Checkpoint[]
  /** Use -1 when no checkpoint has been activated yet. */
  readonly currentOrder?: number
  /** Expands checkpoint triggers by the player's collision radius. */
  readonly triggerPadding?: number
}

export interface RespawnInput {
  readonly checkpoint: Checkpoint | null
  readonly fallbackPosition: Vec3
}

export interface RespawnResult {
  readonly checkpointId: string | null
  readonly motion: PlayerMotion
}

export interface ParkourScoreInput {
  readonly completed: boolean
  readonly elapsedMs: number
  readonly checkpointsReached: number
  readonly collectibles: number
  readonly falls: number
  readonly stylePoints: number
}
