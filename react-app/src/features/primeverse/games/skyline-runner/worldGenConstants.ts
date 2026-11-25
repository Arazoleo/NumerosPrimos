/**
 * Procedural-world reachability budget.
 *
 * Round 2 teleports the player from the static tutorial into a seeded
 * procedural city. The generator must only place roofs, gaps and ledges the
 * player can actually traverse with the SAME physics the gameplay loop runs.
 * Those physics live in the READ-ONLY files (SkylineRunnerExperience.tsx,
 * movementFlow.ts, parkourLogic.ts) and must stay byte-for-byte unchanged.
 *
 * To keep the generator cheap and independently testable, this module copies
 * the DERIVED numeric limits as plain constants rather than importing the
 * physics modules. Each field documents the physics source it is derived from;
 * if a physics constant changes, update the matching field here.
 *
 * Jump reach math (used below): the jump impulse is `vy = 9.3` and gravity is
 * `ay = -25` (both in SkylineRunnerExperience.tsx). The peak rise of a standing
 * jump is therefore `vy^2 / (2 * |ay|) = 9.3^2 / 50 = 1.7298` world units.
 */
export const TRAVERSAL_BUDGET = {
  /**
   * Max horizontal roof-to-roof gap (world units) the generator may leave for
   * free (jump-only) traversal between two same-height roofs.
   *
   * Derived from: ground clamp speeds in SkylineRunnerExperience.tsx
   * (`targetSpeed` 8.4 walk / 13.4 sprint / 15.5 slide) and the jump airtime
   * implied by `vy = 9.3`, `ay = -25` (rise then fall ~= 0.744 s). The absolute
   * flat-jump reach is ~7.4 u; we hold the free budget well under that so flow
   * variance (`flowSpeedMultiplier` up to x1.34, movementFlow.ts) never makes a
   * gap unclearable. Wider gaps must be bridged by a grapple anchor.
   */
  MAX_FREE_HORIZONTAL_GAP: 5.0,
  /**
   * Max upward roof-to-roof rise (world units) allowed for free traversal.
   *
   * Derived from: jump rise `9.3^2 / (2 * 25) = 1.7298` (impulse `vy = 9.3`,
   * gravity `ay = -25`, SkylineRunnerExperience.tsx) and the mantle/vault climb
   * ceiling `climb <= 1.72` in SkylineRunnerExperience.tsx
   * (`detectMantleLedge` default `maxLedgeHeight = 2.1`, movementFlow.ts, is the
   * looser upper bound). Kept strictly below both the ~1.73 jump rise and the
   * 1.72 climb ceiling so a rise of this size is always clearable.
   */
  MAX_FREE_UP_STEP: 1.5,
  /**
   * Max downward roof-to-roof drop (world units) allowed for free traversal.
   *
   * Derived from: there is no upward-reach limit when dropping, so this is a
   * generous bound chosen to keep landings inside the kill-plane budget
   * (`SKYLINE_WORLD_BOUNDS.killPlaneY` in world.ts) and swept-landing detection
   * (`findSweptLanding`, parkourLogic.ts). A drop is always jump-reachable.
   */
  MAX_FREE_DOWN_STEP: 9.0,
  /**
   * Max distance (world units) a grapple can reach, used to bridge any gap that
   * exceeds the free budget above.
   *
   * Derived from: `GRAPPLE_RANGE = 52` in SkylineRunnerExperience.tsx, passed as
   * `maxRange` to both `selectGrappleSurface` and `selectGrappleAnchor`
   * (parkourLogic.ts). A gap wider than the free budget must have a grapple
   * anchor within this range and with clear line-of-sight from the takeoff roof.
   */
  GRAPPLE_RANGE: 52,
  /**
   * Minimum view-to-anchor alignment (dot product, in [-1, 1]) for a grapple
   * anchor to be selectable.
   *
   * Derived from: the `minimumAlignment: .54` argument passed to
   * `selectGrappleAnchor` in SkylineRunnerExperience.tsx (the function clamps it
   * to [-1, 1] in parkourLogic.ts; the gameplay-paired `alignmentWeight` there
   * is .84). The generator uses this so a placed anchor is reachable from a roof
   * the player can plausibly aim at.
   */
  GRAPPLE_MIN_ALIGNMENT: 0.54,
} as const

export type TraversalBudget = typeof TRAVERSAL_BUDGET

Object.freeze(TRAVERSAL_BUDGET)
