import type { OffensiveActionId } from './combatSystem'

/** Offensive actions that temporarily take control of the cinematic camera. */
export type CinematicActionId = Extract<
  OffensiveActionId,
  'mersenne-burst' | 'prime-infinity'
>

export const CINEMATIC_ACTION_IDS = [
  'mersenne-burst',
  'prime-infinity',
] as const satisfies readonly CinematicActionId[]

export type CinematicPhase =
  | 'idle'
  | 'charge'
  | 'release'
  | 'impact'
  | 'aftermath'
  | 'complete'

export interface CinematicPhraseCue {
  readonly id: string
  readonly atMs: number
  readonly text: string
}

export interface CinematicVisualDefinition {
  /** Camera scale at the instant of impact. Values above one zoom in. */
  readonly peakZoom: number
  /** Maximum opacity of the cinematic veil, between zero and one. */
  readonly maxDarkness: number
  /** Peak camera displacement in virtual pixels. */
  readonly shakeAmplitude: number
  readonly shakeDurationMs: number
}

export interface CinematicDefinition {
  readonly actionId: CinematicActionId
  readonly durationMs: number
  readonly reducedMotionDurationMs: number
  readonly chargeDurationMs: number
  readonly impactAtMs: number
  readonly impactDurationMs: number
  readonly phrases: readonly CinematicPhraseCue[]
  readonly visual: CinematicVisualDefinition
}

export interface CinematicTimeline {
  readonly actionId: CinematicActionId
  readonly reducedMotion: boolean
  readonly durationMs: number
  readonly chargeDurationMs: number
  readonly impactAtMs: number
  readonly impactDurationMs: number
  readonly impactEndAtMs: number
  readonly phrases: readonly CinematicPhraseCue[]
  readonly visual: CinematicVisualDefinition
}

export interface CinematicProgress {
  readonly actionId: CinematicActionId
  readonly phase: CinematicPhase
  readonly elapsedMs: number
  readonly durationMs: number
  /** Normalized progress across the complete cinematic. */
  readonly overall: number
  /** Normalized progress within the current phase. */
  readonly phaseProgress: number
  readonly chargeProgress: number
  readonly impactReached: boolean
  readonly currentPhrase: CinematicPhraseCue | null
  readonly reachedPhraseIds: readonly string[]
  readonly zoom: number
  readonly darkness: number
  /** Envelope only; the renderer decides the direction of each shake sample. */
  readonly shake: number
}

const REDUCED_DARKNESS_MULTIPLIER = 0.4

function freezeDefinition(definition: CinematicDefinition): CinematicDefinition {
  return Object.freeze({
    ...definition,
    phrases: Object.freeze(definition.phrases.map((phrase) => Object.freeze({ ...phrase }))),
    visual: Object.freeze({ ...definition.visual }),
  })
}

export const PRIME_CINEMATICS: Readonly<
  Record<CinematicActionId, CinematicDefinition>
> = Object.freeze({
  'mersenne-burst': freezeDefinition({
    actionId: 'mersenne-burst',
    durationMs: 1_320,
    reducedMotionDurationMs: 720,
    chargeDurationMs: 560,
    impactAtMs: 760,
    impactDurationMs: 200,
    phrases: [
      { id: 'mersenne-name', atMs: 100, text: 'Ruptura...' },
      { id: 'mersenne-pause', atMs: 350, text: 'De...' },
      { id: 'mersenne-family', atMs: 610, text: 'MERSENNE!' },
      { id: 'mersenne-release', atMs: 720, text: 'RUPTURA DE MERSENNE!' },
    ],
    visual: {
      peakZoom: 1.125,
      maxDarkness: 0.52,
      shakeAmplitude: 8,
      shakeDurationMs: 260,
    },
  }),
  'prime-infinity': freezeDefinition({
    actionId: 'prime-infinity',
    durationMs: 4_200,
    // The QTE is gameplay, not ornamental motion: keep its full three-second
    // input window when the visual reduced-motion preference is enabled.
    reducedMotionDurationMs: 4_200,
    chargeDurationMs: 2_650,
    impactAtMs: 3_000,
    impactDurationMs: 420,
    phrases: [
      { id: 'infinity-first-primes', atMs: 100, text: 'Dois. Três. Cinco.' },
      { id: 'infinity-sequence', atMs: 900, text: 'Sete. Onze. Treze.' },
      { id: 'infinity-theorem', atMs: 1_850, text: 'Sempre existe outro primo.' },
      { id: 'infinity-release', atMs: 2_750, text: 'Infinito de Euclides!' },
    ],
    visual: {
      peakZoom: 1.25,
      maxDarkness: 0.76,
      shakeAmplitude: 14,
      shakeDurationMs: 480,
    },
  }),
})

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`)
}

function isCinematicActionId(value: string): value is CinematicActionId {
  return Object.prototype.hasOwnProperty.call(PRIME_CINEMATICS, value)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function progressBetween(elapsedMs: number, startMs: number, endMs: number): number {
  if (endMs <= startMs) return elapsedMs >= endMs ? 1 : 0
  return clamp01((elapsedMs - startMs) / (endMs - startMs))
}

function easeInOut(value: number): number {
  const progress = clamp01(value)
  return progress * progress * (3 - 2 * progress)
}

function easeOut(value: number): number {
  const inverse = 1 - clamp01(value)
  return 1 - inverse * inverse * inverse
}

function scaleTime(value: number, scale: number): number {
  return Math.round(value * scale)
}

export function getCinematicDefinition(
  actionId: CinematicActionId,
): CinematicDefinition {
  if (!isCinematicActionId(actionId)) {
    throw new RangeError(`unsupported cinematic action: ${String(actionId)}`)
  }
  return PRIME_CINEMATICS[actionId]
}

/** Resolves the effective timings and accessibility-safe visual limits. */
export function getCinematicTimeline(
  actionId: CinematicActionId,
  reducedMotion = false,
): CinematicTimeline {
  const definition = getCinematicDefinition(actionId)
  const durationMs = reducedMotion
    ? definition.reducedMotionDurationMs
    : definition.durationMs
  const timeScale = durationMs / definition.durationMs
  const chargeDurationMs = scaleTime(definition.chargeDurationMs, timeScale)
  const impactAtMs = scaleTime(definition.impactAtMs, timeScale)
  const impactDurationMs = scaleTime(definition.impactDurationMs, timeScale)
  const phrases = definition.phrases.map((phrase) => Object.freeze({
    ...phrase,
    atMs: scaleTime(phrase.atMs, timeScale),
  }))
  const visual: CinematicVisualDefinition = Object.freeze({
    peakZoom: reducedMotion ? 1 : definition.visual.peakZoom,
    maxDarkness: reducedMotion
      ? definition.visual.maxDarkness * REDUCED_DARKNESS_MULTIPLIER
      : definition.visual.maxDarkness,
    shakeAmplitude: reducedMotion ? 0 : definition.visual.shakeAmplitude,
    shakeDurationMs: reducedMotion
      ? 0
      : scaleTime(definition.visual.shakeDurationMs, timeScale),
  })

  return Object.freeze({
    actionId,
    reducedMotion,
    durationMs,
    chargeDurationMs,
    impactAtMs,
    impactDurationMs,
    impactEndAtMs: impactAtMs + impactDurationMs,
    phrases: Object.freeze(phrases),
    visual,
  })
}

export function getCinematicPhase(
  actionId: CinematicActionId,
  elapsedMs: number,
  reducedMotion = false,
): CinematicPhase {
  assertFinite(elapsedMs, 'elapsedMs')
  const timeline = getCinematicTimeline(actionId, reducedMotion)
  if (elapsedMs < 0) return 'idle'
  if (elapsedMs < timeline.chargeDurationMs) return 'charge'
  if (elapsedMs < timeline.impactAtMs) return 'release'
  if (elapsedMs < timeline.impactEndAtMs) return 'impact'
  if (elapsedMs < timeline.durationMs) return 'aftermath'
  return 'complete'
}

/**
 * Produces a renderer-agnostic snapshot. Every channel is deterministic and
 * derived only from action, elapsed game time and the reduced-motion setting.
 */
export function getCinematicProgress(
  actionId: CinematicActionId,
  elapsedMs: number,
  reducedMotion = false,
): CinematicProgress {
  assertFinite(elapsedMs, 'elapsedMs')
  const timeline = getCinematicTimeline(actionId, reducedMotion)
  const phase = getCinematicPhase(actionId, elapsedMs, reducedMotion)
  const clampedElapsedMs = Math.min(timeline.durationMs, Math.max(0, elapsedMs))
  const overall = progressBetween(clampedElapsedMs, 0, timeline.durationMs)
  const chargeProgress = progressBetween(clampedElapsedMs, 0, timeline.chargeDurationMs)
  const recoveryProgress = progressBetween(
    clampedElapsedMs,
    timeline.impactEndAtMs,
    timeline.durationMs,
  )

  let phaseProgress = 0
  if (phase === 'charge') {
    phaseProgress = chargeProgress
  } else if (phase === 'release') {
    phaseProgress = progressBetween(
      clampedElapsedMs,
      timeline.chargeDurationMs,
      timeline.impactAtMs,
    )
  } else if (phase === 'impact') {
    phaseProgress = progressBetween(
      clampedElapsedMs,
      timeline.impactAtMs,
      timeline.impactEndAtMs,
    )
  } else if (phase === 'aftermath') {
    phaseProgress = recoveryProgress
  } else if (phase === 'complete') {
    phaseProgress = 1
  }

  const focusProgress = easeInOut(progressBetween(
    clampedElapsedMs,
    0,
    timeline.impactAtMs,
  ))
  const visualRecovery = easeOut(progressBetween(
    clampedElapsedMs,
    timeline.impactAtMs,
    timeline.durationMs,
  ))
  const zoom = phase === 'idle' || phase === 'complete'
    ? 1
    : 1 + (timeline.visual.peakZoom - 1) * focusProgress * (1 - visualRecovery)
  const darkness = phase === 'idle' || phase === 'complete'
    ? 0
    : timeline.visual.maxDarkness * focusProgress * (1 - visualRecovery)
  const shakeProgress = timeline.visual.shakeDurationMs === 0
    ? 1
    : progressBetween(
        clampedElapsedMs,
        timeline.impactAtMs,
        timeline.impactAtMs + timeline.visual.shakeDurationMs,
      )
  const shake = clampedElapsedMs < timeline.impactAtMs || shakeProgress >= 1
    ? 0
    : timeline.visual.shakeAmplitude * (1 - easeOut(shakeProgress))
  const reachedPhrases = phase === 'idle'
    ? []
    : timeline.phrases.filter((phrase) => phrase.atMs <= clampedElapsedMs)
  const currentPhrase = phase === 'complete'
    ? null
    : reachedPhrases[reachedPhrases.length - 1] ?? null

  return Object.freeze({
    actionId,
    phase,
    elapsedMs: clampedElapsedMs,
    durationMs: timeline.durationMs,
    overall,
    phaseProgress,
    chargeProgress,
    impactReached: elapsedMs >= timeline.impactAtMs,
    currentPhrase,
    reachedPhraseIds: Object.freeze(reachedPhrases.map((phrase) => phrase.id)),
    zoom,
    darkness,
    shake,
  })
}
