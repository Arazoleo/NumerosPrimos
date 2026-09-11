/**
 * Primebound's chiptune sound bank.
 *
 * The old effect layer was a single oscillator per cue, which read as a beep rather
 * than as a hit. Each cue is now a small arrangement — a body, a transient and, when
 * it matters, a noise burst — so a parry, a rune and an ultimate are distinguishable
 * with your eyes closed. Everything is synthesised; the game ships no audio files.
 */
export type PrimeboundSound =
  | 'swing'
  | 'hit'
  | 'hurt'
  | 'dash'
  | 'rune'
  | 'portal'
  | 'victory'
  | 'technique'
  | 'guard'
  | 'parry'
  | 'ultimate'
  | 'cinematic-rise'
  | 'cinematic-beat'
  | 'cinematic-release'

export interface PrimeboundSfx {
  play(sound: PrimeboundSound): void
  setEnabled(enabled: boolean): void
  unlock(): Promise<boolean>
  dispose(): Promise<void>
}

type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext

interface LegacyAudioWindow extends Window {
  webkitAudioContext?: AudioContextConstructor
}

const SILENCE = 0.0001

interface ToneStep {
  readonly type: OscillatorType
  readonly from: number
  readonly to: number
  readonly duration: number
  readonly gain: number
  readonly delay?: number
}

interface NoiseStep {
  readonly duration: number
  readonly gain: number
  readonly frequency: number
  readonly delay?: number
  readonly sweepTo?: number
}

interface SoundRecipe {
  readonly tones: readonly ToneStep[]
  readonly noises?: readonly NoiseStep[]
}

/** Square-wave arpeggios and short noise bursts: the 8-bit vocabulary. */
const RECIPES: Readonly<Record<PrimeboundSound, SoundRecipe>> = {
  swing: {
    tones: [
      { type: 'square', from: 320, to: 150, duration: 0.07, gain: 0.05 },
      { type: 'square', from: 480, to: 240, duration: 0.05, gain: 0.03, delay: 0.015 },
    ],
    noises: [{ duration: 0.07, gain: 0.05, frequency: 1_800, sweepTo: 600 }],
  },
  hit: {
    tones: [
      { type: 'square', from: 190, to: 70, duration: 0.09, gain: 0.075 },
      { type: 'triangle', from: 96, to: 48, duration: 0.13, gain: 0.06, delay: 0.005 },
    ],
    noises: [{ duration: 0.08, gain: 0.09, frequency: 900, sweepTo: 240 }],
  },
  hurt: {
    tones: [
      { type: 'sawtooth', from: 150, to: 46, duration: 0.18, gain: 0.085 },
      { type: 'square', from: 84, to: 40, duration: 0.24, gain: 0.05, delay: 0.03 },
    ],
    noises: [{ duration: 0.2, gain: 0.07, frequency: 420, sweepTo: 120 }],
  },
  dash: {
    tones: [
      { type: 'square', from: 210, to: 620, duration: 0.11, gain: 0.045 },
      { type: 'triangle', from: 420, to: 1_040, duration: 0.09, gain: 0.03, delay: 0.02 },
    ],
    noises: [{ duration: 0.14, gain: 0.05, frequency: 2_400, sweepTo: 5_200 }],
  },
  rune: {
    // A rising perfect fifth, then the octave: the sound of a rune waking up.
    tones: [
      { type: 'square', from: 523, to: 523, duration: 0.1, gain: 0.05 },
      { type: 'square', from: 784, to: 784, duration: 0.12, gain: 0.045, delay: 0.09 },
      { type: 'triangle', from: 1_046, to: 1_046, duration: 0.22, gain: 0.04, delay: 0.19 },
    ],
  },
  portal: {
    tones: [
      { type: 'triangle', from: 196, to: 588, duration: 0.3, gain: 0.05 },
      { type: 'square', from: 392, to: 1_176, duration: 0.26, gain: 0.03, delay: 0.05 },
    ],
    noises: [{ duration: 0.34, gain: 0.04, frequency: 700, sweepTo: 3_100 }],
  },
  victory: {
    // Major triad, arpeggiated, then held: the level-clear fanfare.
    tones: [
      { type: 'square', from: 523, to: 523, duration: 0.13, gain: 0.055 },
      { type: 'square', from: 659, to: 659, duration: 0.13, gain: 0.055, delay: 0.12 },
      { type: 'square', from: 784, to: 784, duration: 0.16, gain: 0.055, delay: 0.24 },
      { type: 'triangle', from: 1_046, to: 1_046, duration: 0.5, gain: 0.05, delay: 0.38 },
    ],
  },
  technique: {
    tones: [
      { type: 'square', from: 330, to: 660, duration: 0.14, gain: 0.05 },
      { type: 'sawtooth', from: 495, to: 990, duration: 0.12, gain: 0.028, delay: 0.05 },
    ],
  },
  guard: {
    tones: [
      { type: 'triangle', from: 240, to: 360, duration: 0.12, gain: 0.05 },
      { type: 'square', from: 180, to: 180, duration: 0.16, gain: 0.03, delay: 0.02 },
    ],
    noises: [{ duration: 0.1, gain: 0.04, frequency: 1_200 }],
  },
  parry: {
    // Metal on metal: a bright transient over a very short noise crack.
    tones: [
      { type: 'square', from: 1_180, to: 1_760, duration: 0.09, gain: 0.05 },
      { type: 'triangle', from: 2_360, to: 1_180, duration: 0.14, gain: 0.03, delay: 0.02 },
    ],
    noises: [{ duration: 0.07, gain: 0.08, frequency: 5_200, sweepTo: 1_600 }],
  },
  ultimate: {
    tones: [
      { type: 'sawtooth', from: 130, to: 520, duration: 0.42, gain: 0.07 },
      { type: 'square', from: 196, to: 784, duration: 0.36, gain: 0.045, delay: 0.06 },
      { type: 'triangle', from: 65, to: 130, duration: 0.6, gain: 0.06, delay: 0.02 },
    ],
    noises: [{ duration: 0.5, gain: 0.06, frequency: 600, sweepTo: 4_200 }],
  },
  'cinematic-rise': {
    tones: [
      { type: 'sawtooth', from: 72, to: 460, duration: 0.62, gain: 0.06 },
      { type: 'square', from: 144, to: 920, duration: 0.5, gain: 0.03, delay: 0.08 },
    ],
    noises: [{ duration: 0.66, gain: 0.05, frequency: 300, sweepTo: 3_600 }],
  },
  'cinematic-beat': {
    tones: [{ type: 'square', from: 110, to: 58, duration: 0.13, gain: 0.08 }],
    noises: [{ duration: 0.09, gain: 0.05, frequency: 520, sweepTo: 160 }],
  },
  'cinematic-release': {
    tones: [
      { type: 'sawtooth', from: 140, to: 1_180, duration: 0.34, gain: 0.07 },
      { type: 'square', from: 280, to: 2_360, duration: 0.28, gain: 0.035, delay: 0.04 },
    ],
    noises: [{ duration: 0.4, gain: 0.07, frequency: 1_100, sweepTo: 6_000 }],
  },
}

function contextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null
  const legacy = window as LegacyAudioWindow
  return (typeof AudioContext === 'undefined' ? undefined : AudioContext)
    ?? legacy.webkitAudioContext
    ?? null
}

export function createPrimeboundSfx(): PrimeboundSfx {
  let context: AudioContext | null = null
  let master: GainNode | null = null
  let noiseBuffer: AudioBuffer | null = null
  let enabled = true
  let disposed = false

  const ensureContext = (): AudioContext | null => {
    if (disposed) return null
    if (context && context.state !== 'closed') return context
    const Context = contextConstructor()
    if (!Context) return null
    try {
      const created = new Context()
      const gain = created.createGain()
      const limiter = created.createDynamicsCompressor()
      gain.gain.value = enabled ? 1 : SILENCE
      limiter.threshold.value = -12
      limiter.ratio.value = 8
      gain.connect(limiter)
      limiter.connect(created.destination)
      context = created
      master = gain
      return created
    } catch {
      return null
    }
  }

  const getNoise = (audio: AudioContext): AudioBuffer => {
    if (noiseBuffer) return noiseBuffer
    const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.7), audio.sampleRate)
    const samples = buffer.getChannelData(0)
    let seed = 0x9e3779b9
    for (let index = 0; index < samples.length; index += 1) {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) | 0
      samples[index] = (seed >>> 0) / 0xffffffff * 2 - 1
    }
    noiseBuffer = buffer
    return buffer
  }

  const sfx: PrimeboundSfx = {
    play(sound) {
      if (!enabled) return
      const audio = ensureContext()
      if (!audio || !master || audio.state === 'closed') return
      if (audio.state === 'suspended') void audio.resume().catch(() => undefined)
      const recipe = RECIPES[sound]
      const now = audio.currentTime

      for (const tone of recipe.tones) {
        const start = now + (tone.delay ?? 0)
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        oscillator.type = tone.type
        oscillator.frequency.setValueAtTime(Math.max(20, tone.from), start)
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, tone.to), start + tone.duration)
        gain.gain.setValueAtTime(SILENCE, start)
        gain.gain.exponentialRampToValueAtTime(Math.max(SILENCE, tone.gain), start + 0.008)
        gain.gain.exponentialRampToValueAtTime(SILENCE, start + tone.duration)
        oscillator.connect(gain).connect(master)
        oscillator.start(start)
        oscillator.stop(start + tone.duration + 0.03)
        oscillator.addEventListener('ended', () => {
          oscillator.disconnect()
          gain.disconnect()
        }, { once: true })
      }

      for (const burst of recipe.noises ?? []) {
        const start = now + (burst.delay ?? 0)
        const source = audio.createBufferSource()
        const filter = audio.createBiquadFilter()
        const gain = audio.createGain()
        source.buffer = getNoise(audio)
        filter.type = 'bandpass'
        filter.Q.value = 0.9
        filter.frequency.setValueAtTime(burst.frequency, start)
        if (burst.sweepTo !== undefined) {
          filter.frequency.exponentialRampToValueAtTime(
            Math.max(40, burst.sweepTo),
            start + burst.duration,
          )
        }
        gain.gain.setValueAtTime(SILENCE, start)
        gain.gain.exponentialRampToValueAtTime(Math.max(SILENCE, burst.gain), start + 0.006)
        gain.gain.exponentialRampToValueAtTime(SILENCE, start + burst.duration)
        source.connect(filter).connect(gain).connect(master)
        source.start(start)
        source.stop(start + burst.duration + 0.03)
        source.addEventListener('ended', () => {
          source.disconnect()
          filter.disconnect()
          gain.disconnect()
        }, { once: true })
      }
    },

    setEnabled(next) {
      enabled = next
      if (!master || !context || context.state === 'closed') return
      master.gain.setTargetAtTime(next ? 1 : SILENCE, context.currentTime, 0.05)
    },

    async unlock() {
      const audio = ensureContext()
      if (!audio) return false
      try {
        if (audio.state !== 'running') await audio.resume()
        return audio.state === 'running'
      } catch {
        return false
      }
    },

    async dispose() {
      disposed = true
      if (context && context.state !== 'closed') await context.close().catch(() => undefined)
      context = null
      master = null
      noiseBuffer = null
    },
  }

  return sfx
}
