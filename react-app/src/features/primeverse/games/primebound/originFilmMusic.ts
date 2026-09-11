import type { MusicTrack } from '../../audio/proceduralMusic'
import type { OriginSceneId } from './heroOriginFilms'

/**
 * One score per origin film, played under the narration. Each scene gets its
 * own instrumentation and tempo — the forge pounds, the organ sustains, the
 * tide breathes — and layers join as the film's intensity ramps (0.25 → 1).
 */

const MINOR = [0, 2, 3, 5, 7, 8, 10] as const
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10] as const
const DORIAN = [0, 2, 3, 5, 7, 9, 10] as const
const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const
const LYDIAN = [0, 2, 4, 6, 7, 9, 11] as const

export const ORIGIN_FILM_TRACKS: Readonly<Record<OriginSceneId, MusicTrack>> =
  Object.freeze({
    /** Forge: anvil timpani, ember drone, brass resolve. */
    'mountain-forge': {
      id: 'origin-forge',
      bpm: 72,
      stepsPerBar: 16,
      root: 38,
      scale: MINOR,
      progression: [0, 0, 5, 0, 3, 3, 4, 0],
      layers: [
        {
          id: 'ember-drone', instrument: 'pad', minIntensity: 0, octave: 1, gain: 0.7,
          pattern: [{ step: 0, degree: 0, chord: [4], durationSteps: 16 }],
        },
        {
          id: 'anvil', instrument: 'timpani', minIntensity: 0.2, octave: 0, gain: 0.8,
          pattern: [
            { step: 0, degree: 0, durationSteps: 2 },
            { step: 8, degree: 0, durationSteps: 2, velocity: 0.6 },
            { step: 12, degree: 4, durationSteps: 2, velocity: 0.45, bars: [3, 7] },
          ],
        },
        {
          id: 'smith-bass', instrument: 'bass', minIntensity: 0.45, octave: 0, gain: 0.7,
          pattern: [
            { step: 0, degree: 0, durationSteps: 4 },
            { step: 10, degree: 4, durationSteps: 3, velocity: 0.7 },
          ],
        },
        {
          id: 'oath-brass', instrument: 'brass', minIntensity: 0.75, octave: 1, gain: 0.55,
          pattern: [
            { step: 0, degree: 0, chord: [2, 4], durationSteps: 10, bars: [4, 6, 7] },
          ],
        },
      ],
    },
    /** Cipher city: nervous arpeggios over a pulsing bass, neon at night. */
    'cipher-city': {
      id: 'origin-city',
      bpm: 112,
      stepsPerBar: 16,
      root: 43,
      scale: MINOR,
      progression: [0, 6, 3, 4, 0, 6, 5, 4],
      layers: [
        {
          id: 'grid-bass', instrument: 'bass', minIntensity: 0, octave: 0, gain: 0.75,
          pattern: [
            { step: 0, degree: 0, durationSteps: 2 }, { step: 4, degree: 0, durationSteps: 2, velocity: 0.6 },
            { step: 8, degree: 0, durationSteps: 2 }, { step: 12, degree: 0, durationSteps: 2, velocity: 0.6 },
          ],
        },
        {
          id: 'key-arp', instrument: 'pluck', minIntensity: 0.25, octave: 2, gain: 0.6,
          pattern: [
            { step: 0, degree: 0 }, { step: 2, degree: 2 }, { step: 4, degree: 4 },
            { step: 6, degree: 2 }, { step: 8, degree: 0 }, { step: 10, degree: 2 },
            { step: 12, degree: 4 }, { step: 14, degree: 7, velocity: 0.7 },
          ],
        },
        {
          id: 'firewall-pad', instrument: 'pad', minIntensity: 0.5, octave: 2, gain: 0.4,
          pattern: [{ step: 0, degree: 0, chord: [2, 4], durationSteps: 16 }],
        },
        {
          id: 'dawn-lead', instrument: 'lead', minIntensity: 0.8, octave: 3, gain: 0.35,
          pattern: [
            { step: 0, degree: 4, durationSteps: 4, bars: [4, 5, 6, 7] },
            { step: 8, degree: 5, durationSteps: 3, bars: [5, 7], velocity: 0.8 },
          ],
        },
      ],
    },
    /** Steppe: wide airy pad, a slow round melody like a turning wheel. */
    'residue-steppe': {
      id: 'origin-steppe',
      bpm: 84,
      stepsPerBar: 12,
      root: 45,
      scale: DORIAN,
      progression: [0, 3, 0, 4, 0, 3, 5, 4],
      layers: [
        {
          id: 'sky-pad', instrument: 'pad', minIntensity: 0, octave: 1, gain: 0.65,
          pattern: [{ step: 0, degree: 0, chord: [4, 9], durationSteps: 12 }],
        },
        {
          id: 'wheel-pluck', instrument: 'pluck', minIntensity: 0.3, octave: 2, gain: 0.55,
          pattern: [
            { step: 0, degree: 0 }, { step: 4, degree: 2 }, { step: 8, degree: 4, velocity: 0.8 },
          ],
        },
        {
          id: 'hoof-bass', instrument: 'bass', minIntensity: 0.55, octave: 0, gain: 0.6,
          pattern: [
            { step: 0, degree: 0, durationSteps: 3 }, { step: 6, degree: 4, durationSteps: 3, velocity: 0.7 },
          ],
        },
        {
          id: 'arrow-lead', instrument: 'lead', minIntensity: 0.8, octave: 3, gain: 0.3,
          pattern: [{ step: 0, degree: 7, durationSteps: 6, bars: [6, 7], velocity: 0.7 }],
        },
      ],
    },
    /** Organ tower: sustained chords, a choir that answers, one bright voice. */
    'organ-tower': {
      id: 'origin-organ',
      bpm: 66,
      stepsPerBar: 16,
      root: 36,
      scale: MINOR,
      progression: [0, 0, 3, 4, 0, 5, 4, 0],
      layers: [
        {
          id: 'organ-low', instrument: 'pad', minIntensity: 0, octave: 1, gain: 0.75,
          pattern: [{ step: 0, degree: 0, chord: [2, 4], durationSteps: 16 }],
        },
        {
          id: 'organ-pedal', instrument: 'bass', minIntensity: 0.2, octave: 0, gain: 0.7,
          pattern: [{ step: 0, degree: 0, durationSteps: 16 }],
        },
        {
          id: 'choir-answer', instrument: 'choir', minIntensity: 0.5, octave: 2, gain: 0.5,
          pattern: [{ step: 8, degree: 4, chord: [7], durationSteps: 8, velocity: 0.8 }],
        },
        {
          id: 'mersenne-voice', instrument: 'lead', minIntensity: 0.78, octave: 3, gain: 0.35,
          pattern: [
            { step: 0, degree: 6, durationSteps: 10, bars: [5, 7], velocity: 0.75 },
          ],
        },
      ],
    },
    /** Mirror hall: glassy, sparse, wrong in a beautiful way. */
    'mirror-hall': {
      id: 'origin-mirrors',
      bpm: 92,
      stepsPerBar: 16,
      root: 40,
      scale: PHRYGIAN,
      progression: [0, 1, 0, 5, 0, 1, 6, 0],
      layers: [
        {
          id: 'glass-pad', instrument: 'pad', minIntensity: 0, octave: 2, gain: 0.5,
          pattern: [{ step: 0, degree: 0, chord: [4], durationSteps: 16 }],
        },
        {
          id: 'shard-pluck', instrument: 'pluck', minIntensity: 0.3, octave: 3, gain: 0.45,
          pattern: [
            { step: 0, degree: 0 }, { step: 5, degree: 1, velocity: 0.6 },
            { step: 10, degree: 4, velocity: 0.75 }, { step: 13, degree: 1, velocity: 0.5, bars: [1, 3, 5, 7] },
          ],
        },
        {
          id: 'under-bass', instrument: 'bass', minIntensity: 0.55, octave: 0, gain: 0.6,
          pattern: [{ step: 0, degree: 0, durationSteps: 6 }, { step: 10, degree: 1, durationSteps: 4, velocity: 0.6 }],
        },
        {
          id: 'vanish-lead', instrument: 'lead', minIntensity: 0.82, octave: 3, gain: 0.25,
          pattern: [{ step: 6, degree: 8, durationSteps: 5, bars: [3, 6, 7], velocity: 0.6 }],
        },
      ],
    },
    /** Fjord: war drums and brass over black water. */
    'frozen-fjord': {
      id: 'origin-fjord',
      bpm: 96,
      stepsPerBar: 16,
      root: 35,
      scale: MINOR,
      progression: [0, 0, 3, 0, 5, 5, 4, 0],
      layers: [
        {
          id: 'ice-pad', instrument: 'pad', minIntensity: 0, octave: 1, gain: 0.55,
          pattern: [{ step: 0, degree: 0, chord: [4], durationSteps: 16 }],
        },
        {
          id: 'war-drums', instrument: 'timpani', minIntensity: 0.25, octave: 0, gain: 0.8,
          pattern: [
            { step: 0, degree: 0, durationSteps: 2 }, { step: 6, degree: 0, durationSteps: 2, velocity: 0.55 },
            { step: 8, degree: 0, durationSteps: 2, velocity: 0.85 }, { step: 14, degree: 4, durationSteps: 2, velocity: 0.6 },
          ],
        },
        {
          id: 'oath-brass', instrument: 'brass', minIntensity: 0.55, octave: 1, gain: 0.6,
          pattern: [{ step: 0, degree: 0, chord: [4], durationSteps: 6, bars: [2, 4, 5, 6, 7] }],
        },
        {
          id: 'rage-lead', instrument: 'lead', minIntensity: 0.85, octave: 2, gain: 0.4,
          pattern: [{ step: 8, degree: 7, durationSteps: 6, bars: [6, 7], velocity: 0.85 }],
        },
      ],
    },
    /** Greenhouse: bright plucks in major — the one hopeful film. */
    'sieve-greenhouse': {
      id: 'origin-greenhouse',
      bpm: 104,
      stepsPerBar: 16,
      root: 48,
      scale: MAJOR,
      progression: [0, 5, 3, 4, 0, 5, 1, 4],
      layers: [
        {
          id: 'soil-bass', instrument: 'bass', minIntensity: 0, octave: 0, gain: 0.6,
          pattern: [{ step: 0, degree: 0, durationSteps: 4 }, { step: 8, degree: 4, durationSteps: 4, velocity: 0.7 }],
        },
        {
          id: 'sprout-pluck', instrument: 'pluck', minIntensity: 0.25, octave: 2, gain: 0.6,
          pattern: [
            { step: 0, degree: 0 }, { step: 3, degree: 4, velocity: 0.7 }, { step: 6, degree: 2 },
            { step: 10, degree: 4 }, { step: 13, degree: 7, velocity: 0.75 },
          ],
        },
        {
          id: 'glass-pad', instrument: 'pad', minIntensity: 0.5, octave: 2, gain: 0.4,
          pattern: [{ step: 0, degree: 0, chord: [2, 4], durationSteps: 16 }],
        },
        {
          id: 'bloom-lead', instrument: 'lead', minIntensity: 0.8, octave: 3, gain: 0.3,
          pattern: [{ step: 0, degree: 4, durationSteps: 5, bars: [5, 6, 7], velocity: 0.7 }],
        },
      ],
    },
    /** Tide observatory: slow lydian waves, one star of a lead note. */
    'tide-observatory': {
      id: 'origin-tide',
      bpm: 58,
      stepsPerBar: 12,
      root: 41,
      scale: LYDIAN,
      progression: [0, 3, 0, 4, 0, 3, 1, 0],
      layers: [
        {
          id: 'sea-pad', instrument: 'pad', minIntensity: 0, octave: 1, gain: 0.7,
          pattern: [{ step: 0, degree: 0, chord: [4, 9], durationSteps: 12 }],
        },
        {
          id: 'undertow', instrument: 'bass', minIntensity: 0.3, octave: 0, gain: 0.55,
          pattern: [{ step: 0, degree: 0, durationSteps: 8 }],
        },
        {
          id: 'star-pluck', instrument: 'pluck', minIntensity: 0.55, octave: 3, gain: 0.4,
          pattern: [{ step: 0, degree: 4, velocity: 0.6 }, { step: 7, degree: 6, velocity: 0.5, bars: [1, 3, 5, 7] }],
        },
        {
          id: 'oracle-choir', instrument: 'choir', minIntensity: 0.8, octave: 2, gain: 0.4,
          pattern: [{ step: 0, degree: 0, chord: [4], durationSteps: 12, bars: [4, 5, 6, 7] }],
        },
      ],
    },
  } as const)
