/**
 * Opening cutscene: falling asleep in a prime numbers class.
 *
 * The blackboard runs the Sieve of Eratosthenes while the teacher's voice drifts;
 * the eyelids close in longer and longer blinks; one beat of black; then the
 * elevator ding — and the floor it stopped at is not on the panel. Skippable at
 * any moment: a cutscene the player cannot leave is a hostage situation.
 */

export type IntroBeatKind = 'class' | 'drowsy' | 'black' | 'elevator'

export interface IntroBeat {
  readonly id: string
  readonly kind: IntroBeatKind
  readonly atMs: number
  readonly line: string
  /** Numbers newly crossed out on the board when this beat lands. */
  readonly crossed?: readonly number[]
}

export const INTRO_CUTSCENE_BEATS: readonly IntroBeat[] = Object.freeze([
  {
    id: 'lesson-1',
    kind: 'class',
    atMs: 0,
    line: '— Um número primo só se divide por um… e por si mesmo.',
  },
  {
    id: 'lesson-2',
    kind: 'class',
    atMs: 3_200,
    line: '— O crivo de Eratóstenes risca os compostos. Um por um.',
    crossed: [4, 6, 8, 9, 10, 12, 14, 15, 16],
  },
  {
    id: 'drift-1',
    kind: 'drowsy',
    atMs: 6_400,
    line: '— quem não se divide… sobrevive…',
    crossed: [18, 20, 21, 22, 24, 25],
  },
  {
    id: 'drift-2',
    kind: 'drowsy',
    atMs: 9_400,
    line: '— vocês estão… me ouvindo…? riscados… um por um…',
    crossed: [26, 27, 28],
  },
  { id: 'black', kind: 'black', atMs: 11_800, line: '' },
  {
    id: 'ding',
    kind: 'elevator',
    atMs: 13_400,
    line: 'SUBSOLO 2 — você não apertou esse botão.',
  },
])

export const INTRO_CUTSCENE_DURATION_MS = 16_200

export interface IntroCutsceneFrame {
  readonly beat: IntroBeat
  /** 0 = eyes open, 1 = closed. Blinks lengthen until they do not reopen. */
  readonly eyelids: number
  /** 0..1 board blur/drift, following the drowsiness. */
  readonly drift: number
  readonly crossedNumbers: readonly number[]
  /** 0..1 continuous head-hang: sink + waver + blink weight + recovery jerk. */
  readonly headDroop: number
  readonly finished: boolean
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

/** Blinks at fixed moments, each deeper and slower than the last. */
const BLINKS: readonly { readonly atMs: number; readonly durationMs: number; readonly depth: number }[] = [
  { atMs: 4_600, durationMs: 700, depth: 0.5 },
  { atMs: 7_400, durationMs: 1_000, depth: 0.75 },
  { atMs: 10_200, durationMs: 1_400, depth: 0.95 },
]

export function introEyelids(elapsedMs: number): number {
  const elapsed = Math.max(0, elapsedMs)
  const blackAt = INTRO_CUTSCENE_BEATS.find((beat) => beat.kind === 'black')?.atMs ?? 11_800
  const elevatorAt = INTRO_CUTSCENE_BEATS.find((beat) => beat.kind === 'elevator')?.atMs ?? 13_400
  if (elapsed >= blackAt && elapsed < elevatorAt) return 1
  if (elapsed >= elevatorAt) {
    // Waking: the lids lift over half a second.
    return clamp01(1 - (elapsed - elevatorAt) / 500)
  }
  let lids = 0
  for (const blink of BLINKS) {
    const local = (elapsed - blink.atMs) / blink.durationMs
    if (local < 0 || local > 1) continue
    lids = Math.max(lids, Math.sin(local * Math.PI) * blink.depth)
  }
  return clamp01(lids)
}

/**
 * The head as a continuous signal, recomputed every frame: a slow sink that
 * deepens with the lesson, a waver on top (the neck fighting back), the full
 * weight of each blink — and a fast-decaying upward jerk right after a blink
 * ends, the catch-yourself snap. Nothing here steps; everything drifts.
 */
export function introHeadDroop(elapsedMs: number): number {
  const elapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0)
  const sink = clamp01((elapsed - 3_800) / 9_000) * 0.5
  const waver = sink > 0
    ? (Math.sin(elapsed * 0.0011) * 0.06 + Math.sin(elapsed * 0.0027) * 0.035) * (0.4 + sink)
    : 0
  const blinkWeight = introEyelids(elapsed) * 0.55
  let recovery = 0
  for (const blink of BLINKS) {
    const endedAt = blink.atMs + blink.durationMs
    if (elapsed <= endedAt) continue
    const since = elapsed - endedAt
    // Snap up past the baseline, then settle back over ~700 ms.
    recovery -= blink.depth * 0.34 * Math.exp(-since / 240) * Math.cos(since / 150)
  }
  return clamp01(sink + waver + blinkWeight + recovery)
}

export function introCutsceneFrame(elapsedMs: number): IntroCutsceneFrame {
  const elapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0)
  const beat = [...INTRO_CUTSCENE_BEATS].reverse().find((candidate) => elapsed >= candidate.atMs)
    ?? INTRO_CUTSCENE_BEATS[0]
  // The chalk crosses one number every 450 ms from the beat it belongs to —
  // a hand writing, not a spreadsheet updating.
  const crossedNumbers = INTRO_CUTSCENE_BEATS
    .filter((candidate) => elapsed >= candidate.atMs)
    .flatMap((candidate) => (candidate.crossed ?? []).filter((_, index) => (
      elapsed >= candidate.atMs + index * 450
    )))
  return {
    beat,
    eyelids: introEyelids(elapsed),
    headDroop: introHeadDroop(elapsed),
    drift: clamp01((elapsed - 5_000) / 6_500),
    crossedNumbers,
    finished: elapsed >= INTRO_CUTSCENE_DURATION_MS,
  }
}
