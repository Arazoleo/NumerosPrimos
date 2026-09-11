import type { HeroClassId, HeroGender } from './heroClassSystem'

/**
 * Voice-over for the origin films.
 *
 * Two layers: pre-generated MP3s (ElevenLabs, via scripts/generate-origin-voices.ts)
 * served from public/games/primebound/origins/, and a Web Speech fallback so the
 * films narrate out of the box even before any file is generated. Beat ids are
 * globally unique (tested), so files are flat: <beatId>.mp3 and quote-<heroId>.mp3.
 */

export const ORIGIN_VOICE_BASE_PATH = '/games/primebound/origins'

export function originBeatAudioPath(beatId: string): string {
  return `${ORIGIN_VOICE_BASE_PATH}/${beatId}.mp3`
}

export function originQuoteAudioPath(heroClassId: HeroClassId): string {
  return `${ORIGIN_VOICE_BASE_PATH}/quote-${heroClassId}.mp3`
}

export type OriginVoiceStyle =
  | { readonly kind: 'narrator' }
  | { readonly kind: 'hero'; readonly gender: HeroGender }

const MUTE_STORAGE_KEY = 'primebound-origin-voice-muted'

export function readOriginVoiceMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeOriginVoiceMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0')
  } catch {
    // Storage may be unavailable (private mode); the session toggle still works.
  }
}

export interface OriginVoicePlayer {
  /** Plays the MP3 if it exists, otherwise speaks the text via Web Speech. */
  play(url: string, fallbackText: string, style: OriginVoiceStyle): void
  /** Like play, but waits for whatever is currently speaking to finish first. */
  playNext(url: string, fallbackText: string, style: OriginVoiceStyle): void
  stop(): void
}

function pickPortugueseVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? []
  return (
    voices.find((voice) => voice.lang.replace('_', '-').toLowerCase() === 'pt-br') ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith('pt')) ??
    null
  )
}

interface QueuedLine {
  readonly url: string
  readonly fallbackText: string
  readonly style: OriginVoiceStyle
}

export function createOriginVoicePlayer(): OriginVoicePlayer {
  let currentAudio: HTMLAudioElement | null = null
  let speaking = false
  let pending: QueuedLine | null = null
  let generation = 0

  const finished = (forGeneration: number) => {
    if (forGeneration !== generation) return
    speaking = false
    currentAudio = null
    const next = pending
    pending = null
    if (next) start(next, forGeneration)
  }

  const speakFallback = (text: string, style: OriginVoiceStyle, forGeneration: number) => {
    if (forGeneration !== generation) return
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      finished(forGeneration)
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'pt-BR'
    const voice = pickPortugueseVoice()
    if (voice) utterance.voice = voice
    if (style.kind === 'narrator') {
      utterance.rate = 0.92
      utterance.pitch = 0.85
    } else {
      utterance.rate = 1
      utterance.pitch = style.gender === 'woman' ? 1.15 : 0.8
    }
    utterance.onend = () => finished(forGeneration)
    utterance.onerror = () => finished(forGeneration)
    window.speechSynthesis.speak(utterance)
  }

  // Acted takes (.m4a, from the Gemini generator) outrank the neutral Edge
  // .mp3; Web Speech remains the last resort. The generator replaces lines
  // day by day as the free quota allows, and playback upgrades automatically.
  const start = (line: QueuedLine, forGeneration: number, url?: string) => {
    if (forGeneration !== generation) return
    const attempt = url ?? (line.url.endsWith('.mp3')
      ? line.url.replace(/\.mp3$/, '.m4a')
      : line.url)
    speaking = true
    const audio = new Audio(attempt)
    currentAudio = audio
    audio.volume = 0.9
    let fellBack = false
    const fallBack = () => {
      if (fellBack) return
      fellBack = true
      if (currentAudio === audio) currentAudio = null
      if (attempt !== line.url) {
        start(line, forGeneration, line.url)
        return
      }
      speakFallback(line.fallbackText, line.style, forGeneration)
    }
    audio.addEventListener('error', fallBack)
    audio.addEventListener('ended', () => finished(forGeneration))
    audio.play().catch(fallBack)
  }

  return {
    play(url, fallbackText, style) {
      this.stop()
      start({ url, fallbackText, style }, generation)
    },
    playNext(url, fallbackText, style) {
      if (!speaking) {
        this.play(url, fallbackText, style)
        return
      }
      pending = { url, fallbackText, style }
    },
    stop() {
      generation += 1
      speaking = false
      pending = null
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.src = ''
        currentAudio = null
      }
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    },
  }
}
