import { describe, expect, it } from 'vitest'

import {
  INTRO_CUTSCENE_BEATS,
  INTRO_CUTSCENE_DURATION_MS,
  introCutsceneFrame,
  introEyelids,
  introHeadDroop,
} from './introCutscene'

describe('classroom intro cutscene', () => {
  it('tells the story in order and ends after the elevator', () => {
    expect(INTRO_CUTSCENE_BEATS.map((beat) => beat.atMs))
      .toEqual([...INTRO_CUTSCENE_BEATS.map((beat) => beat.atMs)].sort((a, b) => a - b))
    expect(introCutsceneFrame(0).beat.id).toBe('lesson-1')
    expect(introCutsceneFrame(10_000).beat.kind).toBe('drowsy')
    expect(introCutsceneFrame(12_000).beat.kind).toBe('black')
    expect(introCutsceneFrame(14_000).beat.kind).toBe('elevator')
    expect(introCutsceneFrame(INTRO_CUTSCENE_DURATION_MS).finished).toBe(true)
    expect(introCutsceneFrame(Number.NaN).finished).toBe(false)
  })

  it('crosses out composites cumulatively and never a prime', () => {
    expect(introCutsceneFrame(1_000).crossedNumbers).toEqual([])
    const late = introCutsceneFrame(10_000).crossedNumbers
    expect(late).toContain(4)
    expect(late).toContain(25)
    for (const prime of [2, 3, 5, 7, 11, 13, 17, 19, 23]) {
      expect(late).not.toContain(prime)
    }
  })

  it('closes the eyes in deepening blinks, holds black, then wakes', () => {
    expect(introEyelids(1_000)).toBe(0)
    const firstBlink = introEyelids(4_950)
    expect(firstBlink).toBeGreaterThan(0.3)
    expect(firstBlink).toBeLessThan(0.6)
    expect(introEyelids(12_500)).toBe(1)
    expect(introEyelids(13_400 + 500)).toBe(0)
  })

  it('hangs the head as a living signal: sinking, blink-weighted, then the jerk', () => {
    expect(introHeadDroop(1_000)).toBe(0)
    // Deep in a blink the head carries the full weight...
    expect(introHeadDroop(10_800)).toBeGreaterThan(0.5)
    // ...and right after the blink ends it snaps back above where it was sinking.
    const blinkEnd = 10_200 + 1_400
    expect(introHeadDroop(blinkEnd + 120)).toBeLessThan(introHeadDroop(blinkEnd - 200))
    // Between blinks it never freezes: two nearby instants differ.
    expect(introHeadDroop(8_600)).not.toBe(introHeadDroop(8_720))
  })
})
