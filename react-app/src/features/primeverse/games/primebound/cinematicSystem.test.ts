import { describe, expect, it } from 'vitest'

import {
  CINEMATIC_ACTION_IDS,
  PRIME_CINEMATICS,
  getCinematicDefinition,
  getCinematicPhase,
  getCinematicProgress,
  getCinematicTimeline,
} from './cinematicSystem'

describe('Primebound cinematic definitions', () => {
  it('defines immutable timelines for the existing Mersenne and ultimate IDs', () => {
    expect(CINEMATIC_ACTION_IDS).toEqual(['mersenne-burst', 'prime-infinity'])
    expect(Object.keys(PRIME_CINEMATICS)).toEqual(CINEMATIC_ACTION_IDS)
    expect(Object.isFrozen(PRIME_CINEMATICS)).toBe(true)

    for (const actionId of CINEMATIC_ACTION_IDS) {
      const cinematic = getCinematicDefinition(actionId)
      expect(cinematic.actionId).toBe(actionId)
      expect(cinematic.chargeDurationMs).toBeLessThan(cinematic.impactAtMs)
      expect(cinematic.impactAtMs + cinematic.impactDurationMs).toBeLessThan(cinematic.durationMs)
      expect(cinematic.reducedMotionDurationMs).toBeLessThanOrEqual(cinematic.durationMs)
      expect(cinematic.phrases.length).toBeGreaterThanOrEqual(4)
      expect(cinematic.phrases.every((phrase) => phrase.atMs < cinematic.impactAtMs)).toBe(true)
      expect(Object.isFrozen(cinematic)).toBe(true)
      expect(Object.isFrozen(cinematic.phrases)).toBe(true)
      expect(Object.isFrozen(cinematic.visual)).toBe(true)
    }
  })

  it('rejects actions without a cinematic', () => {
    expect(() => getCinematicDefinition('basic-strike' as 'mersenne-burst')).toThrow(
      /unsupported cinematic action/i,
    )
  })
})

describe('Primebound cinematic phases', () => {
  it('changes phase on every exact Mersenne timeline boundary', () => {
    const timeline = getCinematicTimeline('mersenne-burst')
    expect(getCinematicPhase('mersenne-burst', -1)).toBe('idle')
    expect(getCinematicPhase('mersenne-burst', 0)).toBe('charge')
    expect(getCinematicPhase('mersenne-burst', timeline.chargeDurationMs - 1)).toBe('charge')
    expect(getCinematicPhase('mersenne-burst', timeline.chargeDurationMs)).toBe('release')
    expect(getCinematicPhase('mersenne-burst', timeline.impactAtMs)).toBe('impact')
    expect(getCinematicPhase('mersenne-burst', timeline.impactEndAtMs)).toBe('aftermath')
    expect(getCinematicPhase('mersenne-burst', timeline.durationMs)).toBe('complete')
  })

  it('preserves the complete three-second ultimate QTE before impact with reduced motion', () => {
    const regular = getCinematicTimeline('prime-infinity')
    const reduced = getCinematicTimeline('prime-infinity', true)
    expect(regular.impactAtMs).toBe(3_000)
    expect(reduced.impactAtMs).toBe(3_000)
    expect(reduced.durationMs).toBe(regular.durationMs)
    expect(getCinematicPhase('prime-infinity', 2_999, true)).not.toBe('impact')
    expect(getCinematicPhase('prime-infinity', reduced.chargeDurationMs, true)).toBe('release')
    expect(getCinematicPhase('prime-infinity', reduced.impactAtMs, true)).toBe('impact')
    expect(getCinematicPhase('prime-infinity', reduced.durationMs, true)).toBe('complete')
    expect(() => getCinematicPhase('prime-infinity', Number.NaN)).toThrow(RangeError)
  })
})

describe('Primebound cinematic progress', () => {
  it('clamps progress outside the timeline and exposes reached phrase milestones', () => {
    const beforeStart = getCinematicProgress('mersenne-burst', -200)
    expect(beforeStart).toMatchObject({
      phase: 'idle', overall: 0, phaseProgress: 0, currentPhrase: null,
    })

    const thirdPhrase = PRIME_CINEMATICS['mersenne-burst'].phrases[2]
    const duringCharge = getCinematicProgress('mersenne-burst', thirdPhrase.atMs)
    expect(duringCharge.currentPhrase).toEqual(thirdPhrase)
    expect(duringCharge.reachedPhraseIds).toEqual([
      'mersenne-name',
      'mersenne-pause',
      'mersenne-family',
    ])

    const complete = getCinematicProgress('mersenne-burst', 99_000)
    expect(complete).toMatchObject({
      phase: 'complete',
      elapsedMs: PRIME_CINEMATICS['mersenne-burst'].durationMs,
      overall: 1,
      phaseProgress: 1,
      currentPhrase: null,
      zoom: 1,
      darkness: 0,
      shake: 0,
    })
  })

  it('peaks focus and shake at impact, then settles during aftermath', () => {
    const timeline = getCinematicTimeline('prime-infinity')
    const impact = getCinematicProgress('prime-infinity', timeline.impactAtMs)
    expect(impact.phase).toBe('impact')
    expect(impact.impactReached).toBe(true)
    expect(impact.zoom).toBeCloseTo(timeline.visual.peakZoom)
    expect(impact.darkness).toBeCloseTo(timeline.visual.maxDarkness)
    expect(impact.shake).toBeCloseTo(timeline.visual.shakeAmplitude)

    const aftermath = getCinematicProgress(
      'prime-infinity',
      timeline.impactEndAtMs + (timeline.durationMs - timeline.impactEndAtMs) / 2,
    )
    expect(aftermath.phase).toBe('aftermath')
    expect(aftermath.zoom).toBeGreaterThan(1)
    expect(aftermath.zoom).toBeLessThan(impact.zoom)
    expect(aftermath.darkness).toBeLessThan(impact.darkness)
    expect(aftermath.shake).toBe(0)
  })

  it('removes camera motion and softens darkness in reduced-motion mode', () => {
    const regularTimeline = getCinematicTimeline('prime-infinity')
    const reducedTimeline = getCinematicTimeline('prime-infinity', true)
    const regularImpact = getCinematicProgress(
      'prime-infinity', regularTimeline.impactAtMs,
    )
    const reducedImpact = getCinematicProgress(
      'prime-infinity', reducedTimeline.impactAtMs, true,
    )

    expect(reducedImpact.phase).toBe('impact')
    expect(reducedImpact.zoom).toBe(1)
    expect(reducedImpact.shake).toBe(0)
    expect(reducedImpact.darkness).toBeGreaterThan(0)
    expect(reducedImpact.darkness).toBeLessThan(regularImpact.darkness)
    expect(reducedTimeline.phrases[reducedTimeline.phrases.length - 1]?.atMs).toBe(
      regularTimeline.phrases[regularTimeline.phrases.length - 1]?.atMs ?? 0,
    )
  })

  it('is deterministic and validates elapsed time', () => {
    expect(getCinematicProgress('mersenne-burst', 700)).toEqual(
      getCinematicProgress('mersenne-burst', 700),
    )
    expect(() => getCinematicProgress('mersenne-burst', Number.POSITIVE_INFINITY)).toThrow(
      RangeError,
    )
  })
})
