import type { MusicTrack } from './proceduralMusic'

/** Natural minor: the backbone of every track here. */
const MINOR = [0, 2, 3, 5, 7, 8, 10] as const
/** Phrygian: minor with a flat second — the horror colour. */
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10] as const

/**
 * Cripta do Crivo: slow, low and patient. The pad and bass are always there; the
 * dissonant plucks and the high whine only arrive as fear climbs, so the music tells
 * the player how close the thing is before they see it.
 */
/**
 * Cripta do Crivo: an eight-bar descent. The drone and sub never leave; the choir,
 * the timpani heartbeat and the shrieking lead stack on with fear, so the room tells
 * you how close the thing is before you see it.
 */
export const CATACOMBS_TRACK: MusicTrack = Object.freeze<MusicTrack>({
  id: 'catacombs',
  bpm: 60,
  stepsPerBar: 16,
  root: 33,
  scale: PHRYGIAN,
  progression: [0, 0, 5, 3, 0, 6, 1, 0],
  layers: [
    {
      id: 'drone-pad',
      instrument: 'pad',
      minIntensity: 0,
      octave: 1,
      gain: 0.9,
      pattern: [
        { step: 0, degree: 0, chord: [4], durationSteps: 16 },
      ],
    },
    {
      id: 'sub',
      instrument: 'bass',
      minIntensity: 0.1,
      octave: 0,
      gain: 0.85,
      pattern: [
        { step: 0, degree: 0, durationSteps: 6 },
        { step: 10, degree: 0, durationSteps: 4, velocity: 0.7 },
      ],
    },
    {
      id: 'heartbeat',
      instrument: 'timpani',
      minIntensity: 0.3,
      octave: 0,
      gain: 0.75,
      pattern: [
        { step: 0, degree: 0, durationSteps: 2 },
        { step: 3, degree: 0, durationSteps: 2, velocity: 0.62 },
        { step: 8, degree: 0, durationSteps: 2, velocity: 0.85 },
        { step: 11, degree: 0, durationSteps: 2, velocity: 0.55 },
      ],
    },
    {
      id: 'bone-plucks',
      instrument: 'pluck',
      minIntensity: 0.42,
      octave: 3,
      gain: 0.7,
      pattern: [
        { step: 4, degree: 1, velocity: 0.75 },
        { step: 7, degree: 0, velocity: 0.5 },
        { step: 12, degree: 3, velocity: 0.65 },
        { step: 14, degree: 1, velocity: 0.6, bars: [3, 7] },
      ],
    },
    {
      id: 'choir',
      instrument: 'choir',
      minIntensity: 0.58,
      octave: 2,
      gain: 0.8,
      pattern: [
        { step: 0, degree: 0, chord: [1, 4], durationSteps: 16 },
      ],
    },
    {
      id: 'whine',
      instrument: 'lead',
      minIntensity: 0.76,
      octave: 4,
      gain: 0.45,
      pattern: [
        { step: 2, degree: 1, durationSteps: 3, velocity: 0.6 },
        { step: 11, degree: -1, durationSteps: 5, velocity: 0.55 },
        { step: 6, degree: 2, durationSteps: 4, velocity: 0.5, bars: [4, 5, 6, 7] },
      ],
    },
    {
      id: 'stab',
      instrument: 'brass',
      minIntensity: 0.88,
      octave: 1,
      gain: 0.7,
      pattern: [
        { step: 0, degree: 0, chord: [1], durationSteps: 3, bars: [3, 7] },
      ],
    },
  ],
})

/**
 * Núcleo 257: a driving arena pulse. Kick and bass hold the floor, the arpeggio and
 * lead stack on as the fight gets close, so a quiet sweep and a five-on-one brawl do
 * not sound alike.
 */
export const NUCLEUS_TRACK: MusicTrack = Object.freeze<MusicTrack>({
  id: 'nucleus',
  bpm: 130,
  stepsPerBar: 16,
  root: 40,
  scale: MINOR,
  progression: [0, 0, 5, 6, 0, 3, 5, 4],
  layers: [
    {
      id: 'pulse-bass',
      instrument: 'bass',
      minIntensity: 0,
      octave: 0,
      gain: 0.95,
      pattern: [
        { step: 0, degree: 0, durationSteps: 2 },
        { step: 3, degree: 0, velocity: 0.7 },
        { step: 6, degree: 0, durationSteps: 2 },
        { step: 10, degree: 2, durationSteps: 2, velocity: 0.8 },
        { step: 14, degree: 0, durationSteps: 2, velocity: 0.75 },
      ],
    },
    {
      id: 'kick',
      instrument: 'kick',
      minIntensity: 0.16,
      octave: 0,
      gain: 1,
      pattern: [
        { step: 0, degree: 0 },
        { step: 4, degree: 0 },
        { step: 8, degree: 0 },
        { step: 12, degree: 0 },
        { step: 14, degree: 0, velocity: 0.7, bars: [3, 7] },
      ],
    },
    {
      id: 'snare-line',
      instrument: 'snare',
      minIntensity: 0.28,
      octave: 2,
      gain: 0.85,
      pattern: [
        { step: 4, degree: 0 },
        { step: 12, degree: 0 },
        { step: 15, degree: 0, velocity: 0.6, bars: [3, 7] },
      ],
    },
    {
      id: 'hats',
      instrument: 'hat',
      minIntensity: 0.36,
      octave: 5,
      gain: 0.55,
      pattern: [2, 6, 10, 14].map((step) => ({ step, degree: 0, velocity: 0.5 })),
    },
    {
      id: 'arp',
      instrument: 'pluck',
      minIntensity: 0.46,
      octave: 3,
      gain: 0.75,
      pattern: [
        { step: 0, degree: 0 }, { step: 2, degree: 2 }, { step: 4, degree: 4 },
        { step: 6, degree: 6 }, { step: 8, degree: 4 }, { step: 10, degree: 2 },
        { step: 12, degree: 5 }, { step: 14, degree: 4 },
      ],
    },
    {
      id: 'chords',
      instrument: 'pad',
      minIntensity: 0.56,
      octave: 2,
      gain: 0.6,
      pattern: [
        { step: 0, degree: 0, chord: [2, 4], durationSteps: 8 },
        { step: 8, degree: 0, chord: [2, 4], durationSteps: 8, velocity: 0.85 },
      ],
    },
    {
      id: 'brass',
      instrument: 'brass',
      minIntensity: 0.68,
      octave: 2,
      gain: 0.8,
      doubleOctave: true,
      pattern: [
        { step: 0, degree: 4, chord: [0], durationSteps: 4 },
        { step: 8, degree: 6, chord: [2], durationSteps: 4, velocity: 0.9 },
        { step: 12, degree: 7, durationSteps: 4, bars: [3, 7] },
      ],
    },
    {
      id: 'lead',
      instrument: 'lead',
      minIntensity: 0.8,
      octave: 4,
      gain: 0.6,
      doubleOctave: true,
      pattern: [
        { step: 0, degree: 4, durationSteps: 3 },
        { step: 6, degree: 6, durationSteps: 2 },
        { step: 9, degree: 5, durationSteps: 3, velocity: 0.85 },
        { step: 13, degree: 9, durationSteps: 3, velocity: 0.8 },
      ],
    },
  ],
})

/**
 * Primebound: chiptune adventure — square bass, bright plucked melody and a lead that
 * only shows up when the region turns dangerous.
 */
/**
 * Primebound: an eight-bar heroic loop. The progression walks i–VI–III–VII twice,
 * the melody is doubled an octave up, and the drums, brass and choir arrive in
 * layers, so a quiet region and a boss fight are the same song at different heights.
 */
export const PRIMEBOUND_TRACK: MusicTrack = Object.freeze<MusicTrack>({
  id: 'primebound',
  bpm: 132,
  stepsPerBar: 16,
  root: 45,
  scale: MINOR,
  progression: [0, 5, 2, 6, 0, 5, 3, 4],
  layers: [
    {
      id: 'chip-bass',
      instrument: 'bass',
      minIntensity: 0,
      octave: 0,
      gain: 0.9,
      pattern: [
        { step: 0, degree: 0, durationSteps: 2 },
        { step: 3, degree: 0, durationSteps: 1, velocity: 0.7 },
        { step: 6, degree: 4, durationSteps: 2, velocity: 0.85 },
        { step: 8, degree: 0, durationSteps: 2 },
        { step: 11, degree: 0, durationSteps: 1, velocity: 0.7 },
        { step: 14, degree: 2, durationSteps: 2, velocity: 0.85 },
      ],
    },
    {
      id: 'melody',
      instrument: 'pluck',
      minIntensity: 0.1,
      octave: 3,
      gain: 0.85,
      doubleOctave: true,
      pattern: [
        { step: 0, degree: 4, durationSteps: 2 },
        { step: 3, degree: 5 },
        { step: 4, degree: 6, durationSteps: 2 },
        { step: 7, degree: 4 },
        { step: 8, degree: 2, durationSteps: 2 },
        { step: 11, degree: 4 },
        { step: 12, degree: 1, durationSteps: 3 },
        // Second half of the loop answers the first, a fourth higher.
        { step: 6, degree: 7, durationSteps: 2, bars: [4, 5, 6, 7] },
        { step: 14, degree: 6, durationSteps: 2, bars: [3, 7] },
      ],
    },
    {
      id: 'war-drums',
      instrument: 'kick',
      minIntensity: 0.2,
      octave: 0,
      gain: 1,
      pattern: [
        { step: 0, degree: 0 },
        { step: 4, degree: 0, velocity: 0.7 },
        { step: 6, degree: 0, velocity: 0.55 },
        { step: 8, degree: 0 },
        { step: 12, degree: 0, velocity: 0.7 },
        // Fill on the last bar of each half.
        { step: 14, degree: 0, velocity: 0.6, bars: [3, 7] },
        { step: 15, degree: 0, velocity: 0.8, bars: [3, 7] },
      ],
    },
    {
      id: 'snare-line',
      instrument: 'snare',
      minIntensity: 0.3,
      octave: 2,
      gain: 0.9,
      pattern: [
        { step: 4, degree: 0 },
        { step: 12, degree: 0 },
        { step: 10, degree: 0, velocity: 0.5, bars: [1, 3, 5, 7] },
        { step: 14, degree: 0, velocity: 0.7, bars: [3, 7] },
      ],
    },
    {
      id: 'chords',
      instrument: 'pad',
      minIntensity: 0.34,
      octave: 2,
      gain: 0.6,
      pattern: [
        { step: 0, degree: 0, chord: [2, 4], durationSteps: 8 },
        { step: 8, degree: 0, chord: [2, 4], durationSteps: 8, velocity: 0.82 },
      ],
    },
    {
      id: 'timpani',
      instrument: 'timpani',
      minIntensity: 0.46,
      octave: 0,
      gain: 0.8,
      pattern: [
        { step: 0, degree: 0, durationSteps: 2 },
        { step: 8, degree: 4, durationSteps: 2, velocity: 0.8 },
        { step: 12, degree: 0, durationSteps: 2, velocity: 0.7, bars: [3, 7] },
      ],
    },
    {
      id: 'brass-call',
      instrument: 'brass',
      minIntensity: 0.58,
      octave: 2,
      gain: 0.8,
      doubleOctave: true,
      pattern: [
        { step: 0, degree: 4, chord: [0], durationSteps: 4 },
        { step: 6, degree: 6, durationSteps: 2, velocity: 0.9 },
        { step: 8, degree: 7, chord: [4], durationSteps: 6 },
      ],
    },
    {
      id: 'choir',
      instrument: 'choir',
      minIntensity: 0.72,
      octave: 3,
      gain: 0.7,
      pattern: [
        { step: 0, degree: 0, chord: [4], durationSteps: 16 },
      ],
    },
    {
      id: 'hero-lead',
      instrument: 'lead',
      minIntensity: 0.82,
      octave: 4,
      gain: 0.6,
      doubleOctave: true,
      pattern: [
        { step: 2, degree: 6, durationSteps: 2 },
        { step: 6, degree: 7, durationSteps: 2, velocity: 0.9 },
        { step: 10, degree: 9, durationSteps: 4 },
        { step: 14, degree: 6, durationSteps: 2, velocity: 0.8 },
      ],
    },
  ],
})

/**
 * Fenda de Ulam: airy and vertical. A suspended arpeggio and a wide pad carry the
 * climb; drums only arrive when the run is truly moving, and the lead saves itself
 * for the heights.
 */
export const ULAM_RIFT_TRACK: MusicTrack = Object.freeze<MusicTrack>({
  id: 'ulam-rift',
  bpm: 116,
  stepsPerBar: 16,
  root: 50,
  scale: MINOR,
  progression: [0, 2, 5, 4, 0, 2, 6, 4],
  layers: [
    {
      id: 'sky-pad',
      instrument: 'pad',
      minIntensity: 0,
      octave: 2,
      gain: 0.75,
      pattern: [{ step: 0, degree: 0, chord: [2, 4], durationSteps: 16 }],
    },
    {
      id: 'float-arp',
      instrument: 'pluck',
      minIntensity: 0.12,
      octave: 3,
      gain: 0.7,
      pattern: [
        { step: 0, degree: 0 }, { step: 3, degree: 4 }, { step: 6, degree: 7 },
        { step: 8, degree: 9 }, { step: 11, degree: 7 }, { step: 14, degree: 4 },
      ],
    },
    {
      id: 'pulse',
      instrument: 'bass',
      minIntensity: 0.34,
      octave: 0,
      gain: 0.8,
      pattern: [
        { step: 0, degree: 0, durationSteps: 3 },
        { step: 6, degree: 0, durationSteps: 2, velocity: 0.7 },
        { step: 10, degree: 4, durationSteps: 3, velocity: 0.8 },
      ],
    },
    {
      id: 'drums',
      instrument: 'kick',
      minIntensity: 0.5,
      octave: 0,
      gain: 0.9,
      pattern: [
        { step: 0, degree: 0 }, { step: 6, degree: 0, velocity: 0.7 },
        { step: 8, degree: 0 }, { step: 14, degree: 0, velocity: 0.6, bars: [3, 7] },
      ],
    },
    {
      id: 'height-lead',
      instrument: 'lead',
      minIntensity: 0.72,
      octave: 4,
      gain: 0.55,
      doubleOctave: true,
      pattern: [
        { step: 2, degree: 7, durationSteps: 3 },
        { step: 8, degree: 9, durationSteps: 4 },
        { step: 13, degree: 7, durationSteps: 3, velocity: 0.8 },
      ],
    },
  ],
})

/**
 * Cerco de Euclides: martial defence. Timpani and low brass hold the wall; each
 * layer that joins is another wave hitting it.
 */
export const EUCLID_SIEGE_TRACK: MusicTrack = Object.freeze<MusicTrack>({
  id: 'euclid-siege',
  bpm: 108,
  stepsPerBar: 16,
  root: 38,
  scale: PHRYGIAN,
  progression: [0, 0, 3, 4, 0, 5, 3, 0],
  layers: [
    {
      id: 'war-timpani',
      instrument: 'timpani',
      minIntensity: 0,
      octave: 0,
      gain: 0.85,
      pattern: [
        { step: 0, degree: 0, durationSteps: 2 },
        { step: 6, degree: 0, durationSteps: 2, velocity: 0.7 },
        { step: 8, degree: 0, durationSteps: 2 },
        { step: 12, degree: 4, durationSteps: 2, velocity: 0.85, bars: [3, 7] },
      ],
    },
    {
      id: 'wall-bass',
      instrument: 'bass',
      minIntensity: 0.18,
      octave: 0,
      gain: 0.85,
      pattern: [
        { step: 0, degree: 0, durationSteps: 4 },
        { step: 8, degree: 1, durationSteps: 4, velocity: 0.85 },
      ],
    },
    {
      id: 'siege-snare',
      instrument: 'snare',
      minIntensity: 0.36,
      octave: 2,
      gain: 0.85,
      pattern: [
        { step: 4, degree: 0 }, { step: 12, degree: 0 },
        { step: 14, degree: 0, velocity: 0.6, bars: [1, 3, 5, 7] },
      ],
    },
    {
      id: 'low-brass',
      instrument: 'brass',
      minIntensity: 0.52,
      octave: 1,
      gain: 0.8,
      pattern: [
        { step: 0, degree: 0, chord: [4], durationSteps: 6 },
        { step: 8, degree: 1, chord: [5], durationSteps: 6, velocity: 0.9 },
      ],
    },
    {
      id: 'alarm-lead',
      instrument: 'lead',
      minIntensity: 0.74,
      octave: 3,
      gain: 0.6,
      doubleOctave: true,
      pattern: [
        { step: 0, degree: 4, durationSteps: 2 },
        { step: 4, degree: 5, durationSteps: 2, velocity: 0.9 },
        { step: 8, degree: 7, durationSteps: 4 },
        { step: 14, degree: 4, durationSteps: 2, velocity: 0.75 },
      ],
    },
  ],
})
