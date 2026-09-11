import { describe, expect, it } from 'vitest'

import {
  calculateGrapplePull,
  calculateParkourScore,
  canJumpWithCoyoteTime,
  clamp,
  detectWallRunSurface,
  evaluateLanding,
  findSweptLanding,
  hasLineOfSight,
  integratePlayerMotion,
  normalizeHorizontal,
  pointInsideAabb,
  respawnAtCheckpoint,
  segmentIntersectsAabb,
  selectGrappleAnchor,
  selectGrappleSurface,
  selectReachedCheckpoint,
  shouldRespawn,
  SKYLINE_SCORE_RULES,
} from './parkourLogic'
import type { Aabb, Checkpoint, ParkourPlatform, PlayerMotion } from './types'

const origin = { x: 0, y: 0, z: 0 }

const floorPlatform: ParkourPlatform = {
  id: 'roof-a',
  bounds: {
    min: { x: -4, y: 0, z: -4 },
    max: { x: 4, y: 1, z: 4 },
  },
}

describe('Skyline Runner vectors and motion', () => {
  it('clamps finite values and validates the interval', () => {
    expect(clamp(-2, 0, 4)).toBe(0)
    expect(clamp(2, 0, 4)).toBe(2)
    expect(clamp(8, 0, 4)).toBe(4)
    expect(() => clamp(0, 2, 1)).toThrow(RangeError)
    expect(() => clamp(Number.NaN, 0, 1)).toThrow(RangeError)
  })

  it('normalizes horizontal input without leaking vertical movement', () => {
    expect(normalizeHorizontal({ x: 3, y: 99, z: 4 })).toEqual({ x: 0.6, y: 0, z: 0.8 })
    expect(normalizeHorizontal({ x: 0, y: 12, z: 0 })).toEqual(origin)
    expect(() => normalizeHorizontal({ x: Infinity, y: 0, z: 0 })).toThrow(RangeError)
  })

  it('integrates motion and caps horizontal and falling speeds', () => {
    const motion: PlayerMotion = {
      position: { x: 1, y: 10, z: 1 },
      velocity: { x: 2, y: -5, z: 0 },
      grounded: false,
      lastGroundedAtMs: 900,
    }
    const next = integratePlayerMotion({
      motion,
      acceleration: { x: 10, y: -20, z: 0 },
      deltaSeconds: 0.5,
      maxHorizontalSpeed: 4,
      maxFallSpeed: 8,
    })
    expect(next.velocity).toEqual({ x: 4, y: -8, z: 0 })
    expect(next.position).toEqual({ x: 3, y: 6, z: 1 })
    expect(next.grounded).toBe(false)
    expect(motion.position).toEqual({ x: 1, y: 10, z: 1 })
    expect(() => integratePlayerMotion({
      motion,
      acceleration: origin,
      deltaSeconds: -0.01,
    })).toThrow(RangeError)
  })
})

describe('Skyline Runner bounds and grapple targeting', () => {
  const blocker: Aabb = {
    min: { x: -1, y: -1, z: 3 },
    max: { x: 1, y: 1, z: 4 },
  }

  it('handles inclusive points, segment hits and endpoint-only visibility', () => {
    expect(pointInsideAabb({ x: 4, y: 1, z: 0 }, floorPlatform.bounds)).toBe(true)
    expect(pointInsideAabb({ x: 4.01, y: 1, z: 0 }, floorPlatform.bounds)).toBe(false)
    expect(segmentIntersectsAabb(origin, { x: 0, y: 0, z: 8 }, blocker)).toBe(true)
    expect(segmentIntersectsAabb(origin, { x: 3, y: 0, z: 8 }, blocker)).toBe(false)
    expect(hasLineOfSight(origin, { x: 0, y: 0, z: 8 }, [blocker])).toBe(false)

    const anchorFace = { min: { x: -1, y: -1, z: 8 }, max: { x: 1, y: 1, z: 9 } }
    expect(hasLineOfSight(origin, { x: 0, y: 0, z: 8 }, [anchorFace])).toBe(true)
    expect(() => pointInsideAabb(origin, {
      min: { x: 1, y: 0, z: 0 },
      max: { x: 0, y: 1, z: 1 },
    })).toThrow(RangeError)
  })

  it('selects by visibility, range and alignment with deterministic ties', () => {
    const anchors = [
      { id: 'far-center', position: { x: 0, y: 0, z: 10 } },
      { id: 'near-side', position: { x: 4, y: 0, z: 4 } },
      { id: 'disabled', position: { x: 0, y: 0, z: 2 }, enabled: false },
      { id: 'behind', position: { x: 0, y: 0, z: -2 } },
    ] as const
    const selection = selectGrappleAnchor({
      origin,
      viewDirection: { x: 0, y: 0, z: 4 },
      anchors,
      maxRange: 10,
      minimumAlignment: 0.5,
    })
    expect(selection?.anchor.id).toBe('far-center')
    expect(selection?.distance).toBe(10)
    expect(selection?.alignment).toBe(1)

    const tied = [
      { id: 'zeta', position: { x: 1, y: 0, z: 5 } },
      { id: 'alpha', position: { x: -1, y: 0, z: 5 } },
    ]
    expect(selectGrappleAnchor({
      origin,
      viewDirection: { x: 0, y: 0, z: 1 },
      anchors: tied,
      maxRange: 8,
    })?.anchor.id).toBe('alpha')
    expect(selectGrappleAnchor({
      origin,
      viewDirection: { x: 0, y: 0, z: 1 },
      anchors: [...tied].reverse(),
      maxRange: 8,
    })?.anchor.id).toBe('alpha')
  })

  it('rejects occluded anchors and accepts exact range/cone boundaries', () => {
    expect(selectGrappleAnchor({
      origin,
      viewDirection: { x: 0, y: 0, z: 1 },
      anchors: [{ id: 'hidden', position: { x: 0, y: 0, z: 8 } }],
      obstacles: [blocker],
      maxRange: 8,
      minimumAlignment: 1,
    })).toBeNull()

    const boundary = selectGrappleAnchor({
      origin,
      viewDirection: { x: 0, y: 0, z: 1 },
      anchors: [{ id: 'edge', position: { x: 6, y: 0, z: 8 } }],
      maxRange: 10,
      minimumAlignment: 0.8,
    })
    expect(boundary?.anchor.id).toBe('edge')
    expect(() => selectGrappleAnchor({
      origin,
      viewDirection: origin,
      anchors: [],
      maxRange: 10,
    })).toThrow(RangeError)
    expect(() => selectGrappleAnchor({
      origin,
      viewDirection: { x: 0, y: 0, z: 1 },
      anchors: [],
      obstacles: [{
        min: { x: 2, y: 0, z: 0 },
        max: { x: 1, y: 1, z: 1 },
      }],
      maxRange: 10,
    })).toThrow(RangeError)
  })
})

describe('Skyline Runner free-surface grapple targeting', () => {
  const facade: ParkourPlatform = {
    id: 'facade',
    bounds: {
      min: { x: -2, y: -2, z: 8 },
      max: { x: 2, y: 2, z: 10 },
    },
  }

  it('hits an arbitrary facade point and offsets the anchor away from geometry', () => {
    const selection = selectGrappleSurface({
      origin,
      viewDirection: { x: 0, y: 0, z: 4 },
      surfaces: [facade],
      maxRange: 12,
      surfaceOffset: 0.25,
    })

    expect(selection).toMatchObject({
      anchor: { id: 'surface:facade', position: { x: 0, y: 0, z: 7.75 } },
      surface: facade,
      contactPoint: { x: 0, y: 0, z: 8 },
      normal: { x: 0, y: 0, z: -1 },
      distance: 8,
    })
  })

  it('returns the correct roof face and outward normal for a vertical ray', () => {
    const roof: ParkourPlatform = {
      id: 'roof',
      bounds: {
        min: { x: -2, y: 0, z: -2 },
        max: { x: 2, y: 2, z: 2 },
      },
    }
    const selection = selectGrappleSurface({
      origin: { x: 0.5, y: 5, z: -0.5 },
      viewDirection: { x: 0, y: -3, z: 0 },
      surfaces: [roof],
      maxRange: 4,
      surfaceOffset: 0.1,
    })

    expect(selection?.contactPoint).toEqual({ x: 0.5, y: 2, z: -0.5 })
    expect(selection?.normal).toEqual({ x: 0, y: 1, z: 0 })
    expect(selection?.anchor.position).toEqual({ x: 0.5, y: 2.1, z: -0.5 })
    expect(selection?.distance).toBe(3)
  })

  it('chooses the nearest surface and breaks equal-distance ties by id', () => {
    const farther: ParkourPlatform = {
      id: 'farther',
      bounds: { min: { x: -1, y: -1, z: 7 }, max: { x: 1, y: 1, z: 8 } },
    }
    const nearer: ParkourPlatform = {
      id: 'nearer',
      bounds: { min: { x: -1, y: -1, z: 4 }, max: { x: 1, y: 1, z: 5 } },
    }
    expect(selectGrappleSurface({
      origin,
      viewDirection: { x: 0, y: 0, z: 1 },
      surfaces: [farther, nearer],
      maxRange: 10,
    })?.surface.id).toBe('nearer')

    const tied = [
      { ...nearer, id: 'zeta' },
      { ...nearer, id: 'alpha' },
    ]
    expect(selectGrappleSurface({
      origin,
      viewDirection: { x: 0, y: 0, z: 1 },
      surfaces: tied,
      maxRange: 10,
    })?.surface.id).toBe('alpha')
    expect(selectGrappleSurface({
      origin,
      viewDirection: { x: 0, y: 0, z: 1 },
      surfaces: [...tied].reverse(),
      maxRange: 10,
    })?.surface.id).toBe('alpha')
  })

  it('rejects occluded surfaces while honoring blocksGrapple=false', () => {
    const blocker: ParkourPlatform = {
      id: 'billboard',
      bounds: { min: { x: -1, y: -1, z: 3 }, max: { x: 1, y: 1, z: 4 } },
    }
    const baseInput = {
      origin,
      viewDirection: { x: 0, y: 0, z: 1 },
      surfaces: [facade],
      maxRange: 12,
    } as const

    expect(selectGrappleSurface({ ...baseInput, obstacles: [facade, blocker] })).toBeNull()
    expect(selectGrappleSurface({
      ...baseInput,
      obstacles: [facade, { ...blocker, blocksGrapple: false }],
    })?.surface.id).toBe('facade')
  })

  it('uses obstacle padding without making the target surface occlude itself', () => {
    const nearMiss: ParkourPlatform = {
      id: 'near-miss',
      bounds: { min: { x: 0.02, y: -1, z: 3 }, max: { x: 1, y: 1, z: 4 } },
    }
    const input = {
      origin,
      viewDirection: { x: 0, y: 0, z: 1 },
      surfaces: [facade],
      obstacles: [facade, nearMiss],
      maxRange: 12,
    } as const

    expect(selectGrappleSurface(input)?.surface.id).toBe('facade')
    expect(selectGrappleSurface({ ...input, obstaclePadding: 0.03 })).toBeNull()
    expect(selectGrappleSurface({
      ...input,
      obstacles: [facade],
      obstaclePadding: 0.03,
    })?.surface.id).toBe('facade')
  })

  it('accepts the exact range boundary and rejects misses or out-of-range hits', () => {
    const boundary: ParkourPlatform = {
      id: 'boundary',
      bounds: { min: { x: -1, y: -1, z: 10 }, max: { x: 1, y: 1, z: 11 } },
    }
    expect(selectGrappleSurface({
      origin,
      viewDirection: { x: 0, y: 0, z: 1 },
      surfaces: [boundary],
      maxRange: 10,
    })?.distance).toBe(10)
    expect(selectGrappleSurface({
      origin,
      viewDirection: { x: 0, y: 0, z: 1 },
      surfaces: [boundary],
      maxRange: 9.999,
    })).toBeNull()
    expect(selectGrappleSurface({
      origin,
      viewDirection: { x: 0, y: 0, z: 1 },
      surfaces: [{
        id: 'parallel-miss',
        bounds: { min: { x: 2, y: -1, z: 3 }, max: { x: 3, y: 1, z: 4 } },
      }],
      maxRange: 10,
    })).toBeNull()
  })

  it('validates vectors, options, bounds and collider identities', () => {
    const validInput = {
      origin,
      viewDirection: { x: 0, y: 0, z: 1 },
      surfaces: [facade],
      maxRange: 12,
    } as const
    expect(() => selectGrappleSurface({ ...validInput, viewDirection: origin })).toThrow(RangeError)
    expect(() => selectGrappleSurface({ ...validInput, surfaceOffset: -0.1 })).toThrow(RangeError)
    expect(() => selectGrappleSurface({ ...validInput, obstaclePadding: -0.1 })).toThrow(RangeError)
    expect(() => selectGrappleSurface({ ...validInput, surfaces: [facade, facade] })).toThrow(RangeError)
    expect(() => selectGrappleSurface({
      ...validInput,
      obstacles: [facade, facade],
    })).toThrow(RangeError)
  })
})

describe('Skyline Runner grapple physics and ground timing', () => {
  it('pulls only while taut, applies radial damping and caps tension', () => {
    const slack = calculateGrapplePull({
      playerPosition: origin,
      playerVelocity: origin,
      anchorPosition: { x: 0, y: 0, z: 4 },
      ropeLength: 4,
      stiffness: 8,
      damping: 2,
      maxAcceleration: 40,
    })
    expect(slack).toMatchObject({ taut: false, extension: 0, tension: 0, acceleration: origin })

    const pull = calculateGrapplePull({
      playerPosition: origin,
      playerVelocity: { x: 0, y: 0, z: -3 },
      anchorPosition: { x: 0, y: 0, z: 10 },
      ropeLength: 6,
      stiffness: 10,
      damping: 2,
      maxAcceleration: 30,
    })
    expect(pull).toMatchObject({ taut: true, distance: 10, extension: 4, tension: 30 })
    expect(pull.acceleration).toEqual({ x: 0, y: 0, z: 30 })
  })

  it('identifies landing transitions and hard impacts', () => {
    expect(evaluateLanding({
      wasGrounded: false,
      isGrounded: true,
      verticalVelocity: -12,
      hardLandingSpeed: 10,
    })).toEqual({ landed: true, impactSpeed: 12, hardLanding: true })
    expect(evaluateLanding({
      wasGrounded: true,
      isGrounded: true,
      verticalVelocity: -20,
      hardLandingSpeed: 10,
    })).toEqual({ landed: false, impactSpeed: 0, hardLanding: false })
  })

  it('finds the first swept platform top without landing while rising', () => {
    const upper: ParkourPlatform = {
      id: 'roof-upper',
      bounds: { min: { x: -2, y: 4, z: -2 }, max: { x: 2, y: 5, z: 2 } },
    }
    const hit = findSweptLanding({
      previousPosition: { x: 0, y: 10, z: 0 },
      nextPosition: { x: 0, y: -3, z: 0 },
      playerRadius: 0.5,
      playerHalfHeight: 1,
      platforms: [floorPlatform, upper],
    })
    expect(hit?.platform.id).toBe('roof-upper')
    expect(hit?.position.y).toBe(6)
    expect(hit?.time).toBeCloseTo(4 / 13)
    expect(findSweptLanding({
      previousPosition: { x: 0, y: -3, z: 0 },
      nextPosition: { x: 0, y: 10, z: 0 },
      playerRadius: 0.5,
      playerHalfHeight: 1,
      platforms: [floorPlatform],
    })).toBeNull()
  })

  it('does not land when only the square around a circular footprint reaches a corner', () => {
    expect(findSweptLanding({
      previousPosition: { x: 4.5, y: 3, z: 4.5 },
      nextPosition: { x: 4.5, y: 0, z: 4.5 },
      playerRadius: 0.5,
      playerHalfHeight: 0.5,
      platforms: [floorPlatform],
    })).toBeNull()
  })

  it('allows coyote jumps through the inclusive final millisecond once', () => {
    const base = {
      grounded: false,
      jumpConsumed: false,
      lastGroundedAtMs: 1_000,
      coyoteWindowMs: 120,
    }
    expect(canJumpWithCoyoteTime({ ...base, nowMs: 1_120 })).toBe(true)
    expect(canJumpWithCoyoteTime({ ...base, nowMs: 1_121 })).toBe(false)
    expect(canJumpWithCoyoteTime({ ...base, nowMs: 1_050, jumpConsumed: true })).toBe(false)
    expect(canJumpWithCoyoteTime({ ...base, nowMs: 1_500, grounded: true })).toBe(true)
    expect(() => canJumpWithCoyoteTime({ ...base, nowMs: 999 })).toThrow(RangeError)
  })
})

describe('Skyline Runner wall-run and recovery', () => {
  const wall: ParkourPlatform = {
    id: 'wall-east',
    bounds: { min: { x: 3, y: 0, z: -10 }, max: { x: 4, y: 12, z: 10 } },
  }

  it('detects the closest wall face and movement tangent', () => {
    const surface = detectWallRunSurface({
      position: { x: 2, y: 5, z: 0 },
      velocity: { x: 1, y: -2, z: 8 },
      playerRadius: 0.5,
      playerHalfHeight: 1,
      platforms: [wall],
      maxDistance: 0.5,
      minAlongWallSpeed: 6,
    })
    expect(surface).toMatchObject({
      platform: wall,
      normal: { x: -1, y: 0, z: 0 },
      tangent: { x: 0, y: 0, z: 1 },
      distance: 0.5,
      alongWallSpeed: 8,
    })
    expect(surface?.contactPoint).toEqual({ x: 3, y: 5, z: 0 })
  })

  it('rejects distant, vertically separated, slow and disabled walls', () => {
    const base = {
      position: { x: 1, y: 5, z: 0 },
      velocity: { x: 0, y: 0, z: 3 },
      playerRadius: 0.5,
      playerHalfHeight: 1,
      platforms: [wall],
      maxDistance: 0.5,
    }
    expect(detectWallRunSurface(base)).toBeNull()
    expect(detectWallRunSurface({ ...base, position: { x: 2, y: 20, z: 0 } })).toBeNull()
    expect(detectWallRunSurface({ ...base, position: { x: 2, y: 5, z: 0 }, minAlongWallSpeed: 4 })).toBeNull()
    expect(detectWallRunSurface({
      ...base,
      position: { x: 2, y: 5, z: 0 },
      platforms: [{ ...wall, wallRunnable: false }],
    })).toBeNull()
    expect(detectWallRunSurface({
      ...base,
      position: { x: 2, y: 5, z: 0 },
      velocity: { x: 2, y: 0, z: 0 },
    })).toBeNull()
  })

  const checkpoints: readonly Checkpoint[] = [
    {
      id: 'start',
      order: 0,
      trigger: { min: { x: -2, y: 0, z: -2 }, max: { x: 2, y: 4, z: 2 } },
      spawn: { x: 0, y: 2, z: 0 },
    },
    {
      id: 'tower',
      order: 1,
      trigger: { min: { x: 8, y: 8, z: -2 }, max: { x: 12, y: 12, z: 2 } },
      spawn: { x: 10, y: 10, z: 0 },
    },
  ]

  it('advances checkpoints monotonically and respawns with cleared motion', () => {
    expect(selectReachedCheckpoint({
      position: { x: 10, y: 10, z: 0 },
      checkpoints,
      currentOrder: 0,
    })?.id).toBe('tower')
    expect(selectReachedCheckpoint({
      position: origin,
      checkpoints,
      currentOrder: 1,
    })).toBeNull()

    const respawn = respawnAtCheckpoint({
      checkpoint: checkpoints[1],
      fallbackPosition: { x: -10, y: 2, z: 0 },
    })
    expect(respawn).toEqual({
      checkpointId: 'tower',
      motion: {
        position: { x: 10, y: 10, z: 0 },
        velocity: origin,
        grounded: false,
        lastGroundedAtMs: null,
      },
    })
    expect(shouldRespawn({ x: 0, y: -20, z: 0 }, -20)).toBe(true)
    expect(shouldRespawn({ x: 0, y: -19.99, z: 0 }, -20)).toBe(false)
  })

  it('detects a checkpoint crossed completely between frames', () => {
    expect(selectReachedCheckpoint({
      previousPosition: { x: 5, y: 10, z: 0 },
      position: { x: 15, y: 10, z: 0 },
      checkpoints,
      currentOrder: 0,
    })?.id).toBe('tower')
  })
})

describe('Skyline Runner score', () => {
  it('combines progress, style, completion time and fall penalties', () => {
    const score = calculateParkourScore({
      completed: true,
      elapsedMs: 30_000,
      checkpointsReached: 3,
      collectibles: 4,
      falls: 2,
      stylePoints: 700,
    })
    expect(score).toBe(
      3 * SKYLINE_SCORE_RULES.checkpoint +
      4 * SKYLINE_SCORE_RULES.collectible +
      700 +
      SKYLINE_SCORE_RULES.completion +
      (SKYLINE_SCORE_RULES.maxTimeBonus - 30 * SKYLINE_SCORE_RULES.timePenaltyPerSecond) -
      2 * SKYLINE_SCORE_RULES.fallPenalty,
    )
  })

  it('omits time/completion bonuses on failure and never returns an unsafe score', () => {
    expect(calculateParkourScore({
      completed: false,
      elapsedMs: 0,
      checkpointsReached: 0,
      collectibles: 0,
      falls: 99,
      stylePoints: 0,
    })).toBe(0)
    expect(calculateParkourScore({
      completed: true,
      elapsedMs: 0,
      checkpointsReached: Number.MAX_SAFE_INTEGER,
      collectibles: 0,
      falls: 0,
      stylePoints: 0,
    })).toBe(Number.MAX_SAFE_INTEGER)
    expect(() => calculateParkourScore({
      completed: true,
      elapsedMs: 1.5,
      checkpointsReached: 0,
      collectibles: 0,
      falls: 0,
      stylePoints: 0,
    })).toThrow(RangeError)
  })

  it('applies the time penalty on whole-second boundaries', () => {
    const base = {
      completed: true,
      checkpointsReached: 0,
      collectibles: 0,
      falls: 0,
      stylePoints: 0,
    }
    const beforeOneSecond = calculateParkourScore({ ...base, elapsedMs: 999 })
    const atOneSecond = calculateParkourScore({ ...base, elapsedMs: 1_000 })
    expect(beforeOneSecond - atOneSecond).toBe(SKYLINE_SCORE_RULES.timePenaltyPerSecond)
  })
})
