export const SKYLINE_AUDIO_EVENTS = [
  'hook',
  'jump',
  'land',
  'collect',
  'pulse',
  'hit',
  'damage',
  'checkpoint',
  'victory',
] as const

export type SkylineAudioEvent = (typeof SKYLINE_AUDIO_EVENTS)[number]

export interface SkylineAudioOptions {
  /** Master sound preference. It can be changed later with setEnabled. */
  enabled?: boolean
  /** Linear master volume between 0 and 1. */
  volume?: number
  /** Defaults to the operating-system reduced-motion preference. */
  reducedMotion?: boolean
}

export interface SkylineAudioState {
  available: boolean
  disposed: boolean
  enabled: boolean
  reducedMotion: boolean
  unlocked: boolean
  volume: number
  windPlaying: boolean
  windRequested: boolean
}

export interface SkylineAudioController {
  /** Call from a click/key/touch handler to satisfy browser autoplay policies. */
  unlock(): Promise<boolean>
  play(event: SkylineAudioEvent, intensity?: number): void
  startWind(): void
  stopWind(): void
  setEnabled(enabled: boolean): void
  setVolume(volume: number): void
  setReducedMotion(reduced: boolean): void
  getState(): SkylineAudioState
  dispose(): Promise<void>
}

type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext

interface SafariAudioWindow extends Window {
  webkitAudioContext?: AudioContextConstructor
}

interface ToneOptions {
  duration: number
  endFrequency?: number
  filterFrequency?: number
  gain: number
  pan?: number
  startFrequency: number
  type?: OscillatorType
}

interface NoiseOptions {
  duration: number
  filterFrequency: number
  filterType?: BiquadFilterType
  gain: number
  pan?: number
  playbackRate?: number
}

interface WindVoice {
  filter: BiquadFilterNode
  gain: GainNode
  lfo: OscillatorNode
  lfoGain: GainNode
  source: AudioBufferSourceNode
  stopping: boolean
}

const MIN_GAIN = 0.0001
const MAX_ACTIVE_VOICES = 48

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null

  const audioWindow = window as SafariAudioWindow
  const standardContext = typeof AudioContext === 'undefined' ? undefined : AudioContext
  return standardContext ?? audioWindow.webkitAudioContext ?? null
}

function getMotionPreference(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null

  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)')
  } catch {
    return null
  }
}

function disconnectNode(node: AudioNode): void {
  try {
    node.disconnect()
  } catch {
    // A node may already have been disconnected by its `ended` callback.
  }
}

function stopSource(source: AudioScheduledSourceNode, when?: number): void {
  try {
    source.stop(when)
  } catch {
    // stop() throws when a source has already stopped; cleanup remains idempotent.
  }
}

/**
 * Creates one isolated, procedural WebAudio soundscape for Skyline Runner.
 * No AudioContext is allocated until unlock(), play(), or startWind() is called.
 */
export function createSkylineAudio(options: SkylineAudioOptions = {}): SkylineAudioController {
  const motionPreference = getMotionPreference()
  let followsSystemMotionPreference = options.reducedMotion === undefined
  let reducedMotion = options.reducedMotion ?? motionPreference?.matches ?? false
  let enabled = options.enabled ?? true
  let volume = clamp(options.volume ?? 0.58, 0, 1)
  let disposed = false
  let windRequested = false

  let context: AudioContext | null = null
  let masterGain: GainNode | null = null
  let compressor: DynamicsCompressorNode | null = null
  let noiseBuffer: AudioBuffer | null = null
  let unlockPromise: Promise<boolean> | null = null
  let windVoice: WindVoice | null = null

  const voices = new Map<AudioScheduledSourceNode, AudioNode[]>()

  const cleanupVoice = (source: AudioScheduledSourceNode): void => {
    const nodes = voices.get(source)
    if (!nodes) return

    voices.delete(source)
    nodes.forEach(disconnectNode)
  }

  const trackVoice = (source: AudioScheduledSourceNode, nodes: AudioNode[]): void => {
    if (voices.size >= MAX_ACTIVE_VOICES) {
      const oldest = voices.keys().next().value as AudioScheduledSourceNode | undefined
      if (oldest) {
        stopSource(oldest)
        cleanupVoice(oldest)
      }
    }

    voices.set(source, nodes)
    source.addEventListener('ended', () => cleanupVoice(source), { once: true })
  }

  const ensureContext = (): AudioContext | null => {
    if (disposed) return null
    if (context && context.state !== 'closed') return context

    const Context = getAudioContextConstructor()
    if (!Context) return null

    try {
      try {
        context = new Context({ latencyHint: 'interactive' })
      } catch {
        context = new Context()
      }

      masterGain = context.createGain()
      masterGain.gain.value = enabled ? volume : 0

      compressor = context.createDynamicsCompressor()
      compressor.threshold.value = -18
      compressor.knee.value = 12
      compressor.ratio.value = 6
      compressor.attack.value = 0.004
      compressor.release.value = 0.22

      masterGain.connect(compressor)
      compressor.connect(context.destination)
      return context
    } catch {
      if (masterGain) disconnectNode(masterGain)
      if (compressor) disconnectNode(compressor)
      if (context && context.state !== 'closed') void context.close().catch(() => undefined)
      context = null
      masterGain = null
      compressor = null
      return null
    }
  }

  const getNoiseBuffer = (audioContext: AudioContext): AudioBuffer => {
    if (noiseBuffer) return noiseBuffer

    const length = Math.max(1, Math.floor(audioContext.sampleRate * 2))
    const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate)
    const samples = buffer.getChannelData(0)
    let seed = 0x5f3759df
    let smoothed = 0

    for (let index = 0; index < samples.length; index += 1) {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) | 0
      const white = (seed >>> 0) / 0xffffffff * 2 - 1
      smoothed = smoothed * 0.86 + white * 0.14
      samples[index] = white * 0.74 + smoothed * 0.26
    }

    noiseBuffer = buffer
    return buffer
  }

  const createTone = (
    audioContext: AudioContext,
    destination: AudioNode,
    startTime: number,
    tone: ToneOptions,
  ): void => {
    const oscillator = audioContext.createOscillator()
    const voiceGain = audioContext.createGain()
    const filter = audioContext.createBiquadFilter()
    const panner = audioContext.createStereoPanner()
    const duration = Math.max(0.025, tone.duration)
    const attack = Math.min(0.018, duration * 0.2)
    const endTime = startTime + duration

    oscillator.type = tone.type ?? 'sine'
    oscillator.frequency.setValueAtTime(Math.max(1, tone.startFrequency), startTime)
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, tone.endFrequency ?? tone.startFrequency),
      endTime,
    )

    filter.type = 'lowpass'
    filter.frequency.value = tone.filterFrequency ?? 7_500
    filter.Q.value = 0.5
    panner.pan.value = clamp(tone.pan ?? 0, -1, 1)

    voiceGain.gain.setValueAtTime(MIN_GAIN, startTime)
    voiceGain.gain.exponentialRampToValueAtTime(Math.max(MIN_GAIN, tone.gain), startTime + attack)
    voiceGain.gain.exponentialRampToValueAtTime(MIN_GAIN, endTime)

    oscillator.connect(filter)
    filter.connect(panner)
    panner.connect(voiceGain)
    voiceGain.connect(destination)

    trackVoice(oscillator, [oscillator, filter, panner, voiceGain])
    oscillator.start(startTime)
    oscillator.stop(endTime + 0.025)
  }

  const createNoise = (
    audioContext: AudioContext,
    destination: AudioNode,
    startTime: number,
    noise: NoiseOptions,
  ): void => {
    const source = audioContext.createBufferSource()
    const filter = audioContext.createBiquadFilter()
    const panner = audioContext.createStereoPanner()
    const voiceGain = audioContext.createGain()
    const duration = Math.max(0.025, noise.duration)
    const attack = Math.min(0.012, duration * 0.16)
    const endTime = startTime + duration

    source.buffer = getNoiseBuffer(audioContext)
    source.playbackRate.value = noise.playbackRate ?? 1
    filter.type = noise.filterType ?? 'bandpass'
    filter.frequency.value = Math.max(20, noise.filterFrequency)
    filter.Q.value = noise.filterType === 'lowpass' ? 0.6 : 1.1
    panner.pan.value = clamp(noise.pan ?? 0, -1, 1)

    voiceGain.gain.setValueAtTime(MIN_GAIN, startTime)
    voiceGain.gain.exponentialRampToValueAtTime(Math.max(MIN_GAIN, noise.gain), startTime + attack)
    voiceGain.gain.exponentialRampToValueAtTime(MIN_GAIN, endTime)

    source.connect(filter)
    filter.connect(panner)
    panner.connect(voiceGain)
    voiceGain.connect(destination)

    trackVoice(source, [source, filter, panner, voiceGain])
    source.start(startTime)
    source.stop(endTime + 0.025)
  }

  const renderCue = (event: SkylineAudioEvent, intensity: number): void => {
    const audioContext = context
    const destination = masterGain
    if (!audioContext || !destination || audioContext.state !== 'running' || disposed || !enabled) return

    const now = audioContext.currentTime + 0.006
    const amount = clamp(intensity, 0.2, 1.5) * (reducedMotion ? 0.72 : 1)

    try {
      switch (event) {
        case 'hook':
          createNoise(audioContext, destination, now, {
            duration: 0.095,
            filterFrequency: 2_800,
            filterType: 'highpass',
            gain: 0.13 * amount,
            pan: 0.34,
          })
          createTone(audioContext, destination, now, {
            duration: 0.17,
            endFrequency: 690,
            filterFrequency: 2_100,
            gain: 0.12 * amount,
            pan: 0.3,
            startFrequency: 165,
            type: 'sawtooth',
          })
          break

        case 'jump':
          createTone(audioContext, destination, now, {
            duration: 0.14,
            endFrequency: 255,
            gain: 0.1 * amount,
            pan: -0.08,
            startFrequency: 132,
            type: 'sine',
          })
          break

        case 'land':
          createNoise(audioContext, destination, now, {
            duration: 0.15,
            filterFrequency: 260,
            filterType: 'lowpass',
            gain: 0.22 * amount,
            playbackRate: 0.72,
          })
          createTone(audioContext, destination, now, {
            duration: 0.16,
            endFrequency: 42,
            filterFrequency: 240,
            gain: 0.18 * amount,
            startFrequency: 92,
            type: 'sine',
          })
          break

        case 'collect':
          ;[659.25, 987.77, 1_318.51].forEach((frequency, index) => {
            createTone(audioContext, destination, now + index * 0.065, {
              duration: 0.19,
              endFrequency: frequency * 1.018,
              gain: 0.085 * amount,
              pan: (index - 1) * 0.24,
              startFrequency: frequency,
              type: index === 1 ? 'triangle' : 'sine',
            })
          })
          break

        case 'pulse':
          createTone(audioContext, destination, now, {
            duration: 0.24,
            endFrequency: 780,
            filterFrequency: 1_650,
            gain: 0.11 * amount,
            startFrequency: 108,
            type: 'sawtooth',
          })
          createNoise(audioContext, destination, now + 0.018, {
            duration: 0.2,
            filterFrequency: 1_100,
            gain: 0.12 * amount,
            playbackRate: 1.35,
          })
          break

        case 'hit':
          createNoise(audioContext, destination, now, {
            duration: 0.085,
            filterFrequency: 920,
            gain: 0.2 * amount,
            pan: 0.12,
          })
          createTone(audioContext, destination, now, {
            duration: 0.075,
            endFrequency: 58,
            filterFrequency: 480,
            gain: 0.13 * amount,
            startFrequency: 128,
            type: 'square',
          })
          break

        case 'damage':
          createTone(audioContext, destination, now, {
            duration: 0.32,
            endFrequency: 88,
            filterFrequency: 820,
            gain: 0.16 * amount,
            pan: -0.28,
            startFrequency: 205,
            type: 'sawtooth',
          })
          createTone(audioContext, destination, now + 0.04, {
            duration: 0.23,
            endFrequency: 72,
            filterFrequency: 520,
            gain: 0.11 * amount,
            pan: 0.28,
            startFrequency: 148,
            type: 'square',
          })
          break

        case 'checkpoint':
          ;[523.25, 659.25, 783.99].forEach((frequency, index) => {
            createTone(audioContext, destination, now + index * 0.085, {
              duration: 0.28,
              endFrequency: frequency * 1.01,
              gain: 0.075 * amount,
              pan: (index - 1) * 0.18,
              startFrequency: frequency,
              type: 'triangle',
            })
          })
          break

        case 'victory': {
          const notes = reducedMotion
            ? [523.25, 659.25, 783.99]
            : [392, 523.25, 659.25, 783.99, 1_046.5]

          notes.forEach((frequency, index) => {
            createTone(audioContext, destination, now + index * 0.1, {
              duration: index === notes.length - 1 ? 0.62 : 0.3,
              endFrequency: frequency * 1.012,
              gain: 0.085 * amount,
              pan: Math.sin(index * 1.7) * 0.34,
              startFrequency: frequency,
              type: index % 2 === 0 ? 'triangle' : 'sine',
            })
          })
          break
        }
      }
    } catch {
      // Audio must never interrupt the game if a browser rejects a node operation.
    }
  }

  const cleanupWindVoice = (voice: WindVoice): void => {
    ;[voice.source, voice.filter, voice.gain, voice.lfo, voice.lfoGain].forEach(disconnectNode)
    if (windVoice === voice) windVoice = null
  }

  const canPlayWind = (): boolean => {
    if (!windRequested || reducedMotion || !enabled || volume <= 0 || disposed) return false
    return typeof document === 'undefined' || document.visibilityState !== 'hidden'
  }

  const beginWind = (): void => {
    const audioContext = context
    const destination = masterGain
    if (!audioContext || !destination || audioContext.state !== 'running' || !canPlayWind()) return
    if (windVoice) return

    try {
      const source = audioContext.createBufferSource()
      const filter = audioContext.createBiquadFilter()
      const gain = audioContext.createGain()
      const lfo = audioContext.createOscillator()
      const lfoGain = audioContext.createGain()
      const now = audioContext.currentTime

      source.buffer = getNoiseBuffer(audioContext)
      source.loop = true
      source.playbackRate.value = 0.68

      filter.type = 'bandpass'
      filter.frequency.value = 620
      filter.Q.value = 0.42

      gain.gain.setValueAtTime(MIN_GAIN, now)
      gain.gain.exponentialRampToValueAtTime(0.042, now + 0.7)

      lfo.type = 'sine'
      lfo.frequency.value = 0.075
      lfoGain.gain.value = 0.013

      source.connect(filter)
      filter.connect(gain)
      gain.connect(destination)
      lfo.connect(lfoGain)
      lfoGain.connect(gain.gain)

      const voice: WindVoice = { filter, gain, lfo, lfoGain, source, stopping: false }
      windVoice = voice
      source.addEventListener('ended', () => {
        cleanupWindVoice(voice)
        if (canPlayWind()) beginWind()
      }, { once: true })

      source.start(now)
      lfo.start(now)
    } catch {
      if (windVoice) cleanupWindVoice(windVoice)
    }
  }

  const stopWindVoice = (immediate = false): void => {
    const voice = windVoice
    if (!voice || (voice.stopping && !immediate)) return

    voice.stopping = true
    const now = context?.currentTime ?? 0
    const stopAt = immediate ? now : now + 0.14

    if (!immediate) {
      try {
        voice.gain.gain.cancelScheduledValues(now)
        voice.gain.gain.setValueAtTime(Math.max(MIN_GAIN, voice.gain.gain.value), now)
        voice.gain.gain.exponentialRampToValueAtTime(MIN_GAIN, stopAt)
      } catch {
        // The source can still be stopped and disconnected below.
      }
    }

    stopSource(voice.source, stopAt)
    stopSource(voice.lfo, stopAt)
    if (immediate) cleanupWindVoice(voice)
  }

  const updateMasterGain = (): void => {
    if (!context || !masterGain || context.state === 'closed') return

    const now = context.currentTime
    const target = enabled ? volume : 0
    try {
      masterGain.gain.cancelScheduledValues(now)
      masterGain.gain.setTargetAtTime(target, now, 0.018)
    } catch {
      masterGain.gain.value = target
    }
  }

  const unlock = (): Promise<boolean> => {
    if (disposed || !enabled) return Promise.resolve(false)

    const audioContext = ensureContext()
    if (!audioContext) return Promise.resolve(false)
    if (audioContext.state === 'running') {
      if (canPlayWind()) beginWind()
      return Promise.resolve(true)
    }
    if (audioContext.state === 'closed') return Promise.resolve(false)
    if (unlockPromise) return unlockPromise

    let resumePromise: Promise<void>
    try {
      // Called synchronously so a direct click/key/touch invocation keeps user activation.
      resumePromise = audioContext.resume()
    } catch {
      return Promise.resolve(false)
    }

    const pending = resumePromise
      .then(() => {
        const unlocked = !disposed && audioContext.state === 'running'
        if (unlocked && canPlayWind()) beginWind()
        return unlocked
      })
      .catch(() => false)

    const tracked = pending.finally(() => {
      if (unlockPromise === tracked) unlockPromise = null
    })
    unlockPromise = tracked
    return tracked
  }

  const play = (event: SkylineAudioEvent, intensity = 1): void => {
    if (disposed || !enabled || volume <= 0) return

    const audioContext = ensureContext()
    if (!audioContext) return
    if (audioContext.state === 'running') {
      renderCue(event, intensity)
      return
    }

    void unlock().then((unlocked) => {
      if (unlocked) renderCue(event, intensity)
    })
  }

  const startWind = (): void => {
    windRequested = true
    if (!canPlayWind()) return

    const audioContext = ensureContext()
    if (!audioContext) return
    if (audioContext.state === 'running') {
      beginWind()
      return
    }

    void unlock()
  }

  const stopWind = (): void => {
    windRequested = false
    stopWindVoice()
  }

  const applyReducedMotion = (reduced: boolean): void => {
    reducedMotion = reduced
    if (reducedMotion) {
      stopWindVoice()
    } else if (canPlayWind()) {
      void unlock()
    }
  }

  const setReducedMotion = (reduced: boolean): void => {
    followsSystemMotionPreference = false
    applyReducedMotion(reduced)
  }

  const setEnabled = (nextEnabled: boolean): void => {
    enabled = nextEnabled
    updateMasterGain()
    if (!enabled) {
      stopWindVoice()
    } else if (canPlayWind()) {
      void unlock()
    }
  }

  const setVolume = (nextVolume: number): void => {
    volume = clamp(Number.isFinite(nextVolume) ? nextVolume : 0, 0, 1)
    updateMasterGain()
    if (volume <= 0) stopWindVoice()
    else if (canPlayWind()) void unlock()
  }

  const handleMotionPreference = (event: MediaQueryListEvent): void => {
    if (followsSystemMotionPreference) applyReducedMotion(event.matches)
  }

  const handleVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      stopWindVoice()
    } else if (canPlayWind()) {
      void unlock()
    }
  }

  motionPreference?.addEventListener?.('change', handleMotionPreference)
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', handleVisibilityChange)

  const getState = (): SkylineAudioState => ({
    available: !disposed && getAudioContextConstructor() !== null,
    disposed,
    enabled,
    reducedMotion,
    unlocked: context?.state === 'running',
    volume,
    windPlaying: windVoice !== null && !windVoice.stopping,
    windRequested,
  })

  const dispose = async (): Promise<void> => {
    if (disposed) return
    disposed = true
    windRequested = false

    motionPreference?.removeEventListener?.('change', handleMotionPreference)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibilityChange)

    stopWindVoice(true)
    voices.forEach((_nodes, source) => stopSource(source))
    voices.forEach((_nodes, source) => cleanupVoice(source))
    voices.clear()

    if (masterGain) disconnectNode(masterGain)
    if (compressor) disconnectNode(compressor)

    const audioContext = context
    context = null
    masterGain = null
    compressor = null
    noiseBuffer = null
    unlockPromise = null

    if (audioContext && audioContext.state !== 'closed') {
      try {
        await audioContext.close()
      } catch {
        // Some engines reject close() while the page is being torn down.
      }
    }
  }

  return {
    dispose,
    getState,
    play,
    setEnabled,
    setReducedMotion,
    setVolume,
    startWind,
    stopWind,
    unlock,
  }
}
