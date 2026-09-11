import { describe, expect, it } from 'vitest'

import {
  activeLayers,
  clampUnit,
  createMusicDirector,
  degreeToSemitone,
  midiToFrequency,
  notesAtStep,
  stepDurationSeconds,
} from './proceduralMusic'
import { CATACOMBS_TRACK, NUCLEUS_TRACK, PRIMEBOUND_TRACK } from './tracks'

const TRACKS = [CATACOMBS_TRACK, NUCLEUS_TRACK, PRIMEBOUND_TRACK]

describe('procedural music theory helpers', () => {
  it('converts MIDI notes to equal-tempered frequencies', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440)
    expect(midiToFrequency(81)).toBeCloseTo(880)
    expect(midiToFrequency(57)).toBeCloseTo(220)
    expect(midiToFrequency(Number.NaN)).toBe(0)
  })

  it('wraps scale degrees into octaves in both directions', () => {
    const minor = [0, 2, 3, 5, 7, 8, 10]
    expect(degreeToSemitone(minor, 0)).toBe(0)
    expect(degreeToSemitone(minor, 4)).toBe(7)
    expect(degreeToSemitone(minor, 7)).toBe(12)
    expect(degreeToSemitone(minor, -1)).toBe(-2)
    expect(degreeToSemitone([], 3)).toBe(0)
  })

  it('derives step length from tempo', () => {
    // 120 bpm, sixteen steps per bar: a bar is two seconds, a step is 0.125s.
    expect(stepDurationSeconds(120, 16)).toBeCloseTo(0.125)
    expect(stepDurationSeconds(60, 16)).toBeCloseTo(0.25)
    expect(stepDurationSeconds(0, 16)).toBeGreaterThan(0)
  })

  it('clamps intensity into the unit interval', () => {
    expect(clampUnit(-3)).toBe(0)
    expect(clampUnit(0.42)).toBe(0.42)
    expect(clampUnit(9)).toBe(1)
    expect(clampUnit(Number.NaN)).toBe(0)
  })
})

describe('soundtrack arrangement', () => {
  it('layers in as intensity rises and never drops the foundation', () => {
    for (const track of TRACKS) {
      const quiet = activeLayers(track, 0)
      const loud = activeLayers(track, 1)
      expect(quiet.length).toBeGreaterThan(0)
      expect(loud.length).toBe(track.layers.length)
      expect(loud.length).toBeGreaterThan(quiet.length)
      // Every layer the quiet mix uses is still present when things get loud.
      for (const layer of quiet) expect(loud).toContain(layer)
    }
  })

  it('transposes each bar of the progression', () => {
    const layer = CATACOMBS_TRACK.layers[0]
    const firstBar = notesAtStep(CATACOMBS_TRACK, layer, 0, 0)
    const thirdBar = notesAtStep(CATACOMBS_TRACK, layer, 2, 0)
    expect(firstBar.length).toBeGreaterThan(0)
    expect(thirdBar[0].midi).not.toBe(firstBar[0].midi)
    // Bar four of a four-bar loop wraps back to bar zero.
    expect(notesAtStep(CATACOMBS_TRACK, layer, 4, 0)).toEqual(firstBar)
  })

  it('keeps every written note inside its bar and audible range', () => {
    for (const track of TRACKS) {
      for (const layer of track.layers) {
        expect(layer.pattern.length).toBeGreaterThan(0)
        for (const note of layer.pattern) {
          expect(note.step).toBeGreaterThanOrEqual(0)
          expect(note.step).toBeLessThan(track.stepsPerBar)
        }
        for (let step = 0; step < track.stepsPerBar; step += 1) {
          for (const note of notesAtStep(track, layer, 0, step)) {
            const frequency = midiToFrequency(note.midi)
            expect(frequency).toBeGreaterThan(20)
            expect(frequency).toBeLessThan(12_000)
          }
        }
      }
    }
  })
})

describe('music director without Web Audio', () => {
  it('degrades to silence instead of throwing', async () => {
    const director = createMusicDirector(CATACOMBS_TRACK)
    director.setIntensity(0.8)
    director.setEnabled(true)
    director.stop()
    await expect(director.start()).resolves.toBe(false)
    await expect(director.dispose()).resolves.toBeUndefined()
    await expect(director.start()).resolves.toBe(false)
  })

  it('sounds chords, doubles octaves and varies by bar', () => {
    const chordLayer = PRIMEBOUND_TRACK.layers.find((layer) => layer.id === 'chords')
    expect(chordLayer).toBeDefined()
    const chord = notesAtStep(PRIMEBOUND_TRACK, chordLayer!, 0, 0)
    // Root plus two chord tones, all distinct pitches.
    expect(chord).toHaveLength(3)
    expect(new Set(chord.map((voice) => voice.midi)).size).toBe(3)

    const melody = PRIMEBOUND_TRACK.layers.find((layer) => layer.id === 'melody')
    expect(melody?.doubleOctave).toBe(true)
    const doubled = notesAtStep(PRIMEBOUND_TRACK, melody!, 0, 0)
    expect(doubled).toHaveLength(2)
    expect(doubled[1].midi - doubled[0].midi).toBe(12)

    // The drum fill only exists on the closing bar of each half.
    const drums = PRIMEBOUND_TRACK.layers.find((layer) => layer.id === 'war-drums')
    expect(notesAtStep(PRIMEBOUND_TRACK, drums!, 0, 15)).toHaveLength(0)
    expect(notesAtStep(PRIMEBOUND_TRACK, drums!, 3, 15)).toHaveLength(1)
  })

  it('builds every track from a long progression with a full band at the top', () => {
    for (const track of TRACKS) {
      expect(track.progression.length).toBeGreaterThanOrEqual(8)
      const instruments = new Set(activeLayers(track, 1).map((layer) => layer.instrument))
      // Foundation, rhythm or weight, and a voice on top.
      expect(instruments.size).toBeGreaterThanOrEqual(5)
    }
  })
})
