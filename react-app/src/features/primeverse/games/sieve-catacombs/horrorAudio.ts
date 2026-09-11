export type HorrorAudioEvent = 'level' | 'scare' | 'jumpscare' | 'seal' | 'hurt' | 'escape'

export interface HorrorAudioMix {
  readonly fear: number
  readonly flashlightOn: boolean
  readonly levelIndex: number
  readonly nowMs: number
  readonly threatDistance: number
}

export interface HorrorAudioController {
  unlock(): Promise<boolean>
  setActive(active: boolean): void
  setEnabled(enabled: boolean): void
  update(mix: HorrorAudioMix): void
  play(event: HorrorAudioEvent): void
  dispose(): Promise<void>
}

type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext

interface SafariAudioWindow extends Window {
  webkitAudioContext?: AudioContextConstructor
}

interface DroneVoice {
  readonly filter: BiquadFilterNode
  readonly gain: GainNode
  readonly low: OscillatorNode
  readonly lowGain: GainNode
  readonly fluorescent: OscillatorNode
  readonly fluorescentGain: GainNode
}

const SILENCE = 0.0001

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function contextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null
  const audioWindow = window as SafariAudioWindow
  return (typeof AudioContext === 'undefined' ? undefined : AudioContext)
    ?? audioWindow.webkitAudioContext
    ?? null
}

function instantiateAudioContext(Context: AudioContextConstructor): AudioContext | null {
  try {
    return new Context({ latencyHint: 'interactive' })
  } catch {
    // Older Safari/webkitAudioContext implementations reject constructor options.
    try {
      return new Context()
    } catch {
      return null
    }
  }
}

function glide(parameter: AudioParam, value: number, now: number, duration = 0.16): void {
  parameter.cancelScheduledValues(now)
  parameter.setValueAtTime(Math.max(SILENCE, parameter.value), now)
  parameter.exponentialRampToValueAtTime(Math.max(SILENCE, value), now + duration)
}

function safeStop(source: AudioScheduledSourceNode): void {
  try {
    source.stop()
  } catch {
    // Audio nodes can already be stopped during page teardown.
  }
}

/** Procedural ambience: no downloaded samples and no browser speech voices. */
export function createHorrorAudio(): HorrorAudioController {
  let context: AudioContext | null = null
  let master: GainNode | null = null
  let compressor: DynamicsCompressorNode | null = null
  let drone: DroneVoice | null = null
  let noiseBuffer: AudioBuffer | null = null
  let active = false
  let enabled = true
  let disposed = false
  let lastHeartbeatAt = Number.NEGATIVE_INFINITY

  const ensureContext = (): AudioContext | null => {
    if (disposed) return null
    if (context && context.state !== 'closed') return context
    const Context = contextConstructor()
    if (!Context) return null
    const nextContext = instantiateAudioContext(Context)
    if (!nextContext) return null
    try {
      context = nextContext
      master = nextContext.createGain()
      master.gain.value = SILENCE
      compressor = nextContext.createDynamicsCompressor()
      compressor.threshold.value = -22
      compressor.knee.value = 18
      compressor.ratio.value = 8
      compressor.attack.value = 0.004
      compressor.release.value = 0.28
      master.connect(compressor)
      compressor.connect(nextContext.destination)

      const gain = nextContext.createGain()
      const filter = nextContext.createBiquadFilter()
      const low = nextContext.createOscillator()
      const lowGain = nextContext.createGain()
      const fluorescent = nextContext.createOscillator()
      const fluorescentGain = nextContext.createGain()
      gain.gain.value = SILENCE
      filter.type = 'lowpass'
      filter.frequency.value = 180
      filter.Q.value = 1.2
      low.type = 'sine'
      low.frequency.value = 41
      lowGain.gain.value = 0.42
      fluorescent.type = 'sawtooth'
      fluorescent.frequency.value = 60
      fluorescentGain.gain.value = 0.012
      low.connect(lowGain).connect(filter)
      fluorescent.connect(fluorescentGain).connect(filter)
      filter.connect(gain).connect(master)
      low.start()
      fluorescent.start()
      drone = { filter, gain, low, lowGain, fluorescent, fluorescentGain }
      return nextContext
    } catch {
      if (nextContext.state !== 'closed') void nextContext.close().catch(() => undefined)
      context = null
      master = null
      compressor = null
      drone = null
      return null
    }
  }

  const getNoise = (audioContext: AudioContext): AudioBuffer => {
    if (noiseBuffer) return noiseBuffer
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate)
    const samples = buffer.getChannelData(0)
    let seed = 0x2572357
    let brown = 0
    for (let index = 0; index < samples.length; index += 1) {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) | 0
      const white = (seed >>> 0) / 0xffffffff * 2 - 1
      brown = clamp(brown * 0.97 + white * 0.03, -1, 1)
      samples[index] = white * 0.28 + brown * 0.72
    }
    noiseBuffer = buffer
    return buffer
  }

  const tone = (
    frequency: number,
    endFrequency: number,
    gainValue: number,
    duration: number,
    delay = 0,
    type: OscillatorType = 'sine',
  ): void => {
    if (!context || !master || !active || !enabled) return
    const start = context.currentTime + delay
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(Math.max(8, frequency), start)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(8, endFrequency), start + duration)
    gain.gain.setValueAtTime(SILENCE, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(SILENCE, gainValue), start + Math.min(0.025, duration * 0.15))
    gain.gain.exponentialRampToValueAtTime(SILENCE, start + duration)
    oscillator.connect(gain).connect(master)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.03)
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect()
      gain.disconnect()
    }, { once: true })
  }

  const noise = (gainValue: number, duration: number, filterFrequency: number): void => {
    if (!context || !master || !active || !enabled) return
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    const start = context.currentTime
    source.buffer = getNoise(context)
    filter.type = 'bandpass'
    filter.frequency.value = filterFrequency
    filter.Q.value = 0.8
    gain.gain.setValueAtTime(SILENCE, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(SILENCE, gainValue), start + 0.018)
    gain.gain.exponentialRampToValueAtTime(SILENCE, start + duration)
    source.connect(filter).connect(gain).connect(master)
    source.start(start)
    source.stop(start + duration + 0.03)
    source.addEventListener('ended', () => {
      source.disconnect()
      filter.disconnect()
      gain.disconnect()
    }, { once: true })
  }

  const controller: HorrorAudioController = {
    async unlock() {
      const audioContext = ensureContext()
      if (!audioContext) return false
      try {
        if (audioContext.state !== 'running' && audioContext.state !== 'closed') {
          await audioContext.resume()
        }
        controller.setActive(active)
        return audioContext.state === 'running'
      } catch {
        return false
      }
    },

    setActive(nextActive) {
      active = nextActive
      if (!context || context.state === 'closed' || !master || !drone) return
      const now = context.currentTime
      glide(master.gain, active && enabled ? 0.32 : SILENCE, now, 0.35)
      glide(drone.gain.gain, active ? 0.11 : SILENCE, now, 0.5)
    },

    setEnabled(nextEnabled) {
      enabled = nextEnabled
      if (!context || context.state === 'closed' || !master) return
      glide(master.gain, active && enabled ? 0.32 : SILENCE, context.currentTime, 0.2)
    },

    update(mix) {
      if (!context || !drone || !active || !enabled || context.state !== 'running') return
      const now = context.currentTime
      const fear = clamp(mix.fear, 0, 100) / 100
      const threatened = Number.isFinite(mix.threatDistance)
        ? 1 - clamp((mix.threatDistance - 2) / 16, 0, 1)
        : 0
      const baseFrequencies = [43, 36, 39, 31] as const
      const base = baseFrequencies[mix.levelIndex] ?? 34
      glide(drone.low.frequency, base + fear * 8, now, 0.45)
      glide(drone.lowGain.gain, 0.34 + fear * 0.34 + threatened * 0.2, now, 0.35)
      glide(drone.filter.frequency, 145 + fear * 115 + threatened * 90, now, 0.28)
      glide(drone.fluorescentGain.gain, mix.flashlightOn ? 0.012 + fear * 0.008 : 0.003, now, 0.2)

      if (threatened > 0.24 || fear > 0.58) {
        const interval = 1_150 - Math.max(threatened, fear) * 650
        if (mix.nowMs - lastHeartbeatAt >= interval) {
          lastHeartbeatAt = mix.nowMs
          tone(58, 42, 0.24 + threatened * 0.16, 0.14, 0)
          tone(52, 38, 0.17 + threatened * 0.1, 0.12, 0.19)
        }
      }
    },

    play(event) {
      if (!context) return
      if (event === 'scare') {
        noise(0.22, 0.72, 1_100)
        tone(180, 31, 0.26, 0.85, 0, 'sawtooth')
      } else if (event === 'jumpscare') {
        // Short violin-like stinger plus a body impact, all under the compressor.
        noise(0.3, 0.36, 2_600)
        noise(0.2, 0.55, 520)
        tone(1_240, 96, 0.26, 0.46, 0, 'sawtooth')
        tone(806, 62, 0.2, 0.5, 0.015, 'square')
        tone(61, 33, 0.28, 0.6, 0.05)
      } else if (event === 'hurt') {
        noise(0.18, 0.25, 230)
        tone(74, 28, 0.3, 0.42)
      } else if (event === 'seal') {
        tone(131, 263, 0.17, 0.7)
        tone(197, 394, 0.1, 0.72, 0.08)
      } else if (event === 'level') {
        tone(48, 24, 0.2, 1.2)
        noise(0.09, 1.1, 340)
      } else {
        tone(131, 523, 0.15, 1.2)
        tone(196, 784, 0.1, 1.35, 0.1)
      }
    },

    async dispose() {
      disposed = true
      active = false
      if (drone) {
        safeStop(drone.low)
        safeStop(drone.fluorescent)
      }
      if (context && context.state !== 'closed') await context.close().catch(() => undefined)
      context = null
      master = null
      compressor = null
      drone = null
      noiseBuffer = null
    },
  }

  return controller
}
