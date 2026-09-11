/**
 * Walk cadence shared between the first-person rig (which owns the physics) and the
 * view model (which only needs to sway). A module-level record keeps them in sync
 * without threading refs through the scene, mirroring `explorationInput`.
 */
export interface EscapeViewBob {
  /** Ever-increasing stride phase, in radians. */
  stride: number
  /** 0..1 blend of standing to full walking speed. */
  walk: number
  /** 0..1 blend into a sprint. */
  sprint: number
  /** Seconds since the last damage flash, used for a recoil kick. */
  hurtAtMs: number
}

const viewBob: EscapeViewBob = { stride: 0, walk: 0, sprint: 0, hurtAtMs: 0 }

export function reportEscapeViewBob(next: Partial<EscapeViewBob>): void {
  if (next.stride !== undefined && Number.isFinite(next.stride)) viewBob.stride = next.stride
  if (next.walk !== undefined && Number.isFinite(next.walk)) viewBob.walk = next.walk
  if (next.sprint !== undefined && Number.isFinite(next.sprint)) viewBob.sprint = next.sprint
  if (next.hurtAtMs !== undefined && Number.isFinite(next.hurtAtMs)) viewBob.hurtAtMs = next.hurtAtMs
}

export function readEscapeViewBob(): Readonly<EscapeViewBob> {
  return viewBob
}

export function resetEscapeViewBob(): void {
  viewBob.stride = 0
  viewBob.walk = 0
  viewBob.sprint = 0
  viewBob.hurtAtMs = 0
}
