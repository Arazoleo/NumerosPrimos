/**
 * Procedural soundtrack engine.
 *
 * The Primeverse ships no audio files, so music is synthesised in the browser: a
 * lookahead scheduler walks a bar of steps and plays each layer's pattern through
 * simple oscillator voices. Layers fade in and out with an intensity value the game
 * drives (fear, combat pressure, region), so the track reacts instead of looping flat.
 */

export type MusicInstrument =
  | 'pad'
  | 'bass'
  | 'pluck'
  | 'lead'
  | 'kick'
  | 'hat'
  | 'snare'
  | 'brass'
  | 'timpani'
  | 'choir'

export interface MusicNote {
  /** Step index inside the bar. */
  readonly step: number
  /** Scale degree; negative values reach below the root. */
  readonly degree: number
  readonly durationSteps?: number
  readonly velocity?: number
  /** Extra degrees sounded together with this note, for real chords. */
  readonly chord?: readonly number[]
  /** Bars of the loop this note plays in. Omitted means every bar. */
  readonly bars?: readonly number[]
}

export interface MusicLayer {
  readonly id: string
  readonly instrument: MusicInstrument
  /** Layer joins once intensity reaches this, in 0..1. */
  readonly minIntensity: number
  readonly octave: number
  readonly gain: number
  readonly pattern: readonly MusicNote[]
  /** Doubles every note an octave up: the cheapest way to sound heroic. */
  readonly doubleOctave?: boolean
}

export interface MusicTrack {
  readonly id: string
  readonly bpm: number
  readonly stepsPerBar: number
  /** MIDI note of the tonic. */
  readonly root: number
  /** Semitone offsets of the scale, ascending from the tonic. */
  readonly scale: readonly number[]
  /** Scale degree the tonic moves to on each bar of the loop. */
  readonly progression: readonly number[]
  readonly layers: readonly MusicLayer[]
}

export interface MusicDirector {
  start(): Promise<boolean>
  stop(): void
  setEnabled(enabled: boolean): void
  /** 0..1: how hard the music should push right now. */
  setIntensity(intensity: number): void
  dispose(): Promise<void>
}

type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext

interface LegacyAudioWindow extends Window {
  webkitAudioContext?: AudioContextConstructor
}

const SILENCE = 0.0001

export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/** Equal temperament around A4 = 440 Hz. */
export function midiToFrequency(midi: number): number {
  if (!Number.isFinite(midi)) return 0
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/**
 * Maps a scale degree onto semitones, wrapping into octaves so degree 7 of a
 * seven-note scale is the tonic an octave up and degree -1 is the note below it.
 */
export function degreeToSemitone(scale: readonly number[], degree: number): number {
  if (scale.length === 0 || !Number.isFinite(degree)) return 0
  const rounded = Math.round(degree)
  const octave = Math.floor(rounded / scale.length)
  const index = ((rounded % scale.length) + scale.length) % scale.length
  return scale[index] + octave * 12
}

export function stepDurationSeconds(bpm: number, stepsPerBar: number): number {
  const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 90
  const safeSteps = Number.isFinite(stepsPerBar) && stepsPerBar > 0 ? Math.round(stepsPerBar) : 16
  // A bar is four beats.
  return (60 / safeBpm) * 4 / safeSteps
}

/** Layers currently audible, in track order. */
export function activeLayers(track: MusicTrack, intensity: number): readonly MusicLayer[] {
  const level = clampUnit(intensity)
  return track.layers.filter((layer) => level >= layer.minIntensity)
}

/** Every note a layer plays on one step of one bar, already transposed. */
export function notesAtStep(
  track: MusicTrack,
  layer: MusicLayer,
  barIndex: number,
  step: number,
): readonly { readonly midi: number; readonly durationSteps: number; readonly velocity: number }[] {
  if (track.progression.length === 0) return []
  const bar = ((Math.round(barIndex) % track.progression.length) + track.progression.length)
    % track.progression.length
  const barDegree = track.progression[bar]
  const voices: { midi: number; durationSteps: number; velocity: number }[] = []
  for (const note of layer.pattern) {
    if (note.step !== step) continue
    if (note.bars && !note.bars.includes(bar)) continue
    const degrees = [note.degree, ...(note.chord ?? [])]
    for (const degree of degrees) {
      const midi = track.root
        + degreeToSemitone(track.scale, degree + barDegree)
        + layer.octave * 12
      const velocity = clampUnit(note.velocity ?? 1)
      const durationSteps = note.durationSteps ?? 1
      voices.push({ midi, durationSteps, velocity })
      if (layer.doubleOctave) {
        voices.push({ midi: midi + 12, durationSteps, velocity: velocity * 0.62 })
      }
    }
  }
  return voices
}

function contextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null
  const legacy = window as LegacyAudioWindow
  return (typeof AudioContext === 'undefined' ? undefined : AudioContext)
    ?? legacy.webkitAudioContext
    ?? null
}

interface VoiceShape {
  readonly type: OscillatorType
  readonly attack: number
  readonly release: number
  readonly gain: number
  readonly detune?: number
  readonly filter?: number
}

const VOICES: Readonly<Record<MusicInstrument, VoiceShape>> = {
  pad: { type: 'sine', attack: 0.6, release: 1.9, gain: 0.16, detune: 6, filter: 900 },
  bass: { type: 'triangle', attack: 0.02, release: 0.32, gain: 0.3, filter: 420 },
  pluck: { type: 'square', attack: 0.005, release: 0.22, gain: 0.11, filter: 2200 },
  lead: { type: 'sawtooth', attack: 0.02, release: 0.4, gain: 0.12, detune: 4, filter: 2600 },
  kick: { type: 'sine', attack: 0.002, release: 0.22, gain: 0.42, filter: 220 },
  hat: { type: 'square', attack: 0.001, release: 0.05, gain: 0.05, filter: 6000 },
  snare: { type: 'triangle', attack: 0.001, release: 0.16, gain: 0.16, filter: 3200 },
  brass: { type: 'sawtooth', attack: 0.07, release: 0.5, gain: 0.15, detune: 9, filter: 2000 },
  timpani: { type: 'sine', attack: 0.004, release: 0.9, gain: 0.34, filter: 180 },
  choir: { type: 'triangle', attack: 0.9, release: 2.4, gain: 0.12, detune: 11, filter: 1400 },
}

/** Percussive voices get a noise transient on top of their tone. */
const NOISY_VOICES: ReadonlySet<MusicInstrument> = new Set(['snare', 'hat'])

const LOOKAHEAD_MS = 25
const SCHEDULE_WINDOW_S = 0.14

/**
 * Creates a director for one track. Everything degrades to silence when Web Audio is
 * unavailable, so calling this on a server or a locked-down browser is safe.
 */
/**
 * Browsers refuse to start audio before the user interacts with the page, so a
 * director started on mount stays silent forever. This arms the first real gesture
 * (pointer, key or touch) to start it, and cleans itself up either way.
 */
export function startMusicOnFirstGesture(director: MusicDirector): () => void {
  if (typeof window === 'undefined') return () => undefined
  let done = false
  const events = ['pointerdown', 'keydown', 'touchstart'] as const
  const detach = (): void => {
    for (const event of events) window.removeEventListener(event, handler)
  }
  function handler(): void {
    if (done) return
    done = true
    detach()
    void director.start()
  }
  for (const event of events) window.addEventListener(event, handler, { passive: true })
  void director.start().then((started) => {
    // Some browsers allow it immediately (audio already unlocked on this page).
    if (started) handler()
  })
  return detach
}

export function createMusicDirector(track: MusicTrack): MusicDirector {
  let context: AudioContext | null = null
  let master: GainNode | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let nextNoteTime = 0
  let step = 0
  let bar = 0
  let intensity = 0.35
  let enabled = true
  let running = false
  let disposed = false

  const stepSeconds = stepDurationSeconds(track.bpm, track.stepsPerBar)

  const ensureContext = (): AudioContext | null => {
    if (disposed) return null
    if (context && context.state !== 'closed') return context
    const Context = contextConstructor()
    if (!Context) return null
    try {
      const created = new Context({ latencyHint: 'interactive' })
      const gain = created.createGain()
      const limiter = created.createDynamicsCompressor()
      gain.gain.value = SILENCE
      limiter.threshold.value = -14
      limiter.ratio.value = 6
      limiter.attack.value = 0.005
      limiter.release.value = 0.25
      gain.connect(limiter)
      limiter.connect(created.destination)
      context = created
      master = gain
      return created
    } catch {
      return null
    }
  }

  let noiseBuffer: AudioBuffer | null = null
  const getNoiseBuffer = (audio: AudioContext): AudioBuffer => {
    if (noiseBuffer) return noiseBuffer
    const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.4), audio.sampleRate)
    const samples = buffer.getChannelData(0)
    let seed = 0x1f123bb5
    for (let index = 0; index < samples.length; index += 1) {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) | 0
      samples[index] = (seed >>> 0) / 0xffffffff * 2 - 1
    }
    noiseBuffer = buffer
    return buffer
  }

  const playVoice = (
    instrument: MusicInstrument,
    frequency: number,
    startTime: number,
    duration: number,
    velocity: number,
  ): void => {
    if (!context || !master || frequency <= 0) return
    const shape = VOICES[instrument]
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const filter = context.createBiquadFilter()
    oscillator.type = shape.type
    oscillator.frequency.setValueAtTime(frequency, startTime)
    if (instrument === 'kick' || instrument === 'timpani') {
      // Pitch drop: the only thing that turns a sine into a drum.
      const drop = instrument === 'timpani' ? 0.55 : 0.35
      const fall = instrument === 'timpani' ? 0.4 : 0.11
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * drop), startTime + fall)
    }
    if (shape.detune) oscillator.detune.setValueAtTime(shape.detune, startTime)
    filter.type = 'lowpass'
    filter.frequency.value = shape.filter ?? 1800
    const peak = Math.max(SILENCE, shape.gain * velocity)
    gain.gain.setValueAtTime(SILENCE, startTime)
    gain.gain.exponentialRampToValueAtTime(peak, startTime + shape.attack)
    gain.gain.exponentialRampToValueAtTime(SILENCE, startTime + duration + shape.release)
    oscillator.connect(filter).connect(gain).connect(master)
    oscillator.start(startTime)
    oscillator.stop(startTime + duration + shape.release + 0.05)
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect()
      filter.disconnect()
      gain.disconnect()
    }, { once: true })

    if (NOISY_VOICES.has(instrument) && context) {
      const noise = context.createBufferSource()
      const noiseFilter = context.createBiquadFilter()
      const noiseGain = context.createGain()
      const length = instrument === 'snare' ? 0.18 : 0.05
      noise.buffer = getNoiseBuffer(context)
      noiseFilter.type = 'bandpass'
      noiseFilter.frequency.value = instrument === 'snare' ? 2_200 : 7_400
      noiseFilter.Q.value = 0.7
      noiseGain.gain.setValueAtTime(SILENCE, startTime)
      noiseGain.gain.exponentialRampToValueAtTime(
        Math.max(SILENCE, (instrument === 'snare' ? 0.2 : 0.05) * velocity),
        startTime + 0.004,
      )
      noiseGain.gain.exponentialRampToValueAtTime(SILENCE, startTime + length)
      noise.connect(noiseFilter).connect(noiseGain).connect(master)
      noise.start(startTime)
      noise.stop(startTime + length + 0.02)
      noise.addEventListener('ended', () => {
        noise.disconnect()
        noiseFilter.disconnect()
        noiseGain.disconnect()
      }, { once: true })
    }
  }

  const scheduleStep = (time: number): void => {
    const layers = activeLayers(track, intensity)
    for (const layer of layers) {
      // A layer that just crossed its threshold fades in rather than snapping on.
      const headroom = clampUnit((intensity - layer.minIntensity) / 0.25)
      for (const note of notesAtStep(track, layer, bar, step)) {
        playVoice(
          layer.instrument,
          midiToFrequency(note.midi),
          time,
          note.durationSteps * stepSeconds,
          note.velocity * layer.gain * (0.45 + headroom * 0.55),
        )
      }
    }
  }

  const tick = (): void => {
    if (!context || !running) return
    while (nextNoteTime < context.currentTime + SCHEDULE_WINDOW_S) {
      scheduleStep(nextNoteTime)
      nextNoteTime += stepSeconds
      step += 1
      if (step >= track.stepsPerBar) {
        step = 0
        bar += 1
      }
    }
  }

  const director: MusicDirector = {
    async start() {
      const audio = ensureContext()
      if (!audio || !master) return false
      try {
        if (audio.state !== 'running') await audio.resume()
      } catch {
        return false
      }
      if (audio.state !== 'running') return false
      running = true
      step = 0
      bar = 0
      nextNoteTime = audio.currentTime + 0.08
      master.gain.cancelScheduledValues(audio.currentTime)
      master.gain.setValueAtTime(Math.max(SILENCE, master.gain.value), audio.currentTime)
      master.gain.exponentialRampToValueAtTime(enabled ? 0.5 : SILENCE, audio.currentTime + 1.4)
      if (timer === null) timer = setInterval(tick, LOOKAHEAD_MS)
      return true
    },

    stop() {
      running = false
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
      if (context && master && context.state === 'running') {
        master.gain.cancelScheduledValues(context.currentTime)
        master.gain.setValueAtTime(Math.max(SILENCE, master.gain.value), context.currentTime)
        master.gain.exponentialRampToValueAtTime(SILENCE, context.currentTime + 0.6)
      }
    },

    setEnabled(next) {
      enabled = next
      if (!context || !master || context.state !== 'running') return
      master.gain.cancelScheduledValues(context.currentTime)
      master.gain.setValueAtTime(Math.max(SILENCE, master.gain.value), context.currentTime)
      master.gain.exponentialRampToValueAtTime(
        enabled && running ? 0.5 : SILENCE,
        context.currentTime + 0.35,
      )
    },

    setIntensity(next) {
      intensity = clampUnit(next)
    },

    async dispose() {
      disposed = true
      director.stop()
      if (context && context.state !== 'closed') await context.close().catch(() => undefined)
      context = null
      master = null
      noiseBuffer = null
    },
  }

  return director
}
