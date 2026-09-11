import { describe, expect, it } from 'vitest'

import {
  AREA_ENTRY_CUTSCENE_IDS,
  GUARDIAN_REVEAL_CUTSCENE_IDS,
  PRIMEBOUND_FINALE_CUTSCENE_ID,
  PRIMEBOUND_STORY_CUTSCENES,
  STORY_CUTSCENE_AREA_IDS,
  STORY_CUTSCENE_IDS,
  advanceOrCompleteStoryCutscene,
  getStoryCutsceneDefinition,
  getStoryCutsceneSnapshot,
  skipStoryCutscene,
  startStoryCutscene,
  type StoryCutsceneId,
  type StoryCutsceneState,
} from './storyCutsceneSystem'
import { PRIMEBOUND_WORLD } from './world'

describe('Primebound story cutscene catalog', () => {
  it('defines an entry and guardian reveal for all twelve areas plus a finale', () => {
    expect(STORY_CUTSCENE_AREA_IDS).toEqual(PRIMEBOUND_WORLD.areaOrder)
    expect(Object.keys(AREA_ENTRY_CUTSCENE_IDS)).toEqual(
      PRIMEBOUND_WORLD.areaOrder,
    )
    expect(Object.keys(GUARDIAN_REVEAL_CUTSCENE_IDS)).toEqual(
      PRIMEBOUND_WORLD.areaOrder,
    )
    expect(STORY_CUTSCENE_IDS).toHaveLength(25)
    expect(new Set(STORY_CUTSCENE_IDS).size).toBe(25)
    expect(Object.keys(PRIMEBOUND_STORY_CUTSCENES)).toEqual(
      STORY_CUTSCENE_IDS,
    )

    for (const areaId of PRIMEBOUND_WORLD.areaOrder) {
      const entry = getStoryCutsceneDefinition(
        AREA_ENTRY_CUTSCENE_IDS[areaId],
      )
      const guardian = getStoryCutsceneDefinition(
        GUARDIAN_REVEAL_CUTSCENE_IDS[areaId],
      )

      expect(entry).toMatchObject({ kind: 'area-entry', areaId })
      expect(guardian).toMatchObject({ kind: 'guardian-reveal', areaId })
      expect(entry.beats).toHaveLength(2)
      expect(guardian.beats).toHaveLength(2)
    }

    expect(
      getStoryCutsceneDefinition(PRIMEBOUND_FINALE_CUTSCENE_ID),
    ).toMatchObject({ kind: 'finale', areaId: 'prime-sanctuary' })
  })

  it('gives every beat complete, concise presentation metadata', () => {
    const beatIds = new Set<string>()
    const shotTargets = new Set(['hero', 'guardian', 'landmark', 'wide'])
    const effects = new Set(['none', 'pulse', 'shake', 'fade'])

    for (const sceneId of STORY_CUTSCENE_IDS) {
      const definition = getStoryCutsceneDefinition(sceneId)
      expect(definition.title.trim().length).toBeGreaterThan(0)
      expect(definition.beats.length).toBeGreaterThanOrEqual(2)

      for (const beat of definition.beats) {
        expect(beatIds.has(beat.id)).toBe(false)
        beatIds.add(beat.id)
        expect(beat.durationMs).toBeGreaterThanOrEqual(1_000)
        expect(beat.durationMs).toBeLessThanOrEqual(3_000)
        expect(beat.speaker.trim().length).toBeGreaterThan(0)
        expect(beat.text.trim().length).toBeGreaterThan(0)
        expect(beat.text.length).toBeLessThanOrEqual(110)
        expect(shotTargets.has(beat.shotTarget)).toBe(true)
        expect(effects.has(beat.effect)).toBe(true)
        expect(typeof beat.skippable).toBe('boolean')
      }
    }
  })

  it('deep-freezes the public story definitions', () => {
    expect(Object.isFrozen(STORY_CUTSCENE_AREA_IDS)).toBe(true)
    expect(Object.isFrozen(AREA_ENTRY_CUTSCENE_IDS)).toBe(true)
    expect(Object.isFrozen(GUARDIAN_REVEAL_CUTSCENE_IDS)).toBe(true)
    expect(Object.isFrozen(STORY_CUTSCENE_IDS)).toBe(true)
    expect(Object.isFrozen(PRIMEBOUND_STORY_CUTSCENES)).toBe(true)

    for (const definition of Object.values(PRIMEBOUND_STORY_CUTSCENES)) {
      expect(Object.isFrozen(definition)).toBe(true)
      expect(Object.isFrozen(definition.beats)).toBe(true)
      expect(definition.beats.every((beat) => Object.isFrozen(beat))).toBe(true)
    }
  })

  it('rejects unknown scene IDs', () => {
    const unknownId = 'entry-unknown-realm' as StoryCutsceneId
    expect(() => getStoryCutsceneDefinition(unknownId)).toThrow(RangeError)
    expect(() => startStoryCutscene(unknownId)).toThrow(
      /unsupported primebound story cutscene/i,
    )
  })
})

describe('Primebound story cutscene state', () => {
  it('starts at the first beat and advances into natural completion', () => {
    const initial = startStoryCutscene('entry-echo-woods')
    const opening = getStoryCutsceneSnapshot(initial)

    expect(Object.isFrozen(initial)).toBe(true)
    expect(Object.isFrozen(opening)).toBe(true)
    expect(opening).toMatchObject({
      sceneId: 'entry-echo-woods',
      kind: 'area-entry',
      areaId: 'echo-woods',
      status: 'playing',
      beatIndex: 0,
      beatCount: 2,
      completedBeatCount: 0,
      completedDurationMs: 0,
      totalDurationMs: 3_700,
      progress: 0,
      canAdvance: true,
      canSkip: true,
      finished: false,
    })
    expect(opening.currentBeat?.id).toBe('echo-entry-wide')

    const second = advanceOrCompleteStoryCutscene(initial)
    const secondSnapshot = getStoryCutsceneSnapshot(second)
    expect(initial).toMatchObject({ beatIndex: 0, status: 'playing' })
    expect(secondSnapshot).toMatchObject({
      beatIndex: 1,
      status: 'playing',
      completedBeatCount: 1,
      completedDurationMs: 1_800,
    })
    expect(secondSnapshot.progress).toBeCloseTo(1_800 / 3_700)
    expect(secondSnapshot.currentBeat?.id).toBe('echo-entry-hero')

    const completed = advanceOrCompleteStoryCutscene(second)
    expect(getStoryCutsceneSnapshot(completed)).toMatchObject({
      beatIndex: 2,
      status: 'completed',
      completedBeatCount: 2,
      currentBeat: null,
      completedDurationMs: 3_700,
      progress: 1,
      canAdvance: false,
      canSkip: false,
      finished: true,
    })
    expect(advanceOrCompleteStoryCutscene(completed)).toBe(completed)
    expect(skipStoryCutscene(completed)).toBe(completed)
  })

  it('skips an allowed beat and preserves how far the scene had advanced', () => {
    const second = advanceOrCompleteStoryCutscene(
      startStoryCutscene('guardian-goldbach-citadel'),
    )
    const skipped = skipStoryCutscene(second)
    const snapshot = getStoryCutsceneSnapshot(skipped)

    expect(second.status).toBe('playing')
    expect(skipped).not.toBe(second)
    expect(snapshot).toMatchObject({
      status: 'skipped',
      beatIndex: 1,
      completedBeatCount: 1,
      currentBeat: null,
      canAdvance: false,
      canSkip: false,
      finished: true,
    })
    expect(snapshot.progress).toBeGreaterThan(0)
    expect(snapshot.progress).toBeLessThan(1)
    expect(skipStoryCutscene(skipped)).toBe(skipped)
    expect(advanceOrCompleteStoryCutscene(skipped)).toBe(skipped)
  })

  it('honors an unskippable closing beat while still allowing completion', () => {
    const opening = startStoryCutscene(PRIMEBOUND_FINALE_CUTSCENE_ID)
    const middle = advanceOrCompleteStoryCutscene(opening)
    const closing = advanceOrCompleteStoryCutscene(middle)

    expect(getStoryCutsceneSnapshot(closing)).toMatchObject({
      beatIndex: 2,
      canAdvance: true,
      canSkip: false,
      finished: false,
    })
    expect(skipStoryCutscene(closing)).toBe(closing)

    const completed = advanceOrCompleteStoryCutscene(closing)
    expect(getStoryCutsceneSnapshot(completed)).toMatchObject({
      status: 'completed',
      progress: 1,
      finished: true,
    })
  })

  it('is deterministic and rejects malformed state transitions', () => {
    const state = startStoryCutscene('entry-mobius-labyrinth')
    expect(getStoryCutsceneSnapshot(state)).toEqual(
      getStoryCutsceneSnapshot(state),
    )
    expect(advanceOrCompleteStoryCutscene(state)).toEqual(
      advanceOrCompleteStoryCutscene(state),
    )

    const invalidPlayingState: StoryCutsceneState = {
      sceneId: 'entry-mobius-labyrinth',
      beatIndex: 2,
      status: 'playing',
    }
    const invalidCompletedState: StoryCutsceneState = {
      sceneId: 'entry-mobius-labyrinth',
      beatIndex: 1,
      status: 'completed',
    }
    const invalidSkippedState: StoryCutsceneState = {
      sceneId: 'entry-mobius-labyrinth',
      beatIndex: 2,
      status: 'skipped',
    }

    expect(() => getStoryCutsceneSnapshot(invalidPlayingState)).toThrow(
      RangeError,
    )
    expect(() => advanceOrCompleteStoryCutscene(invalidCompletedState)).toThrow(
      RangeError,
    )
    expect(() => skipStoryCutscene(invalidSkippedState)).toThrow(RangeError)
  })
})
