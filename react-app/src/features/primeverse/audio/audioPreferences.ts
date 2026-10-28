import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

export const AUDIO_PREFERENCES_KEY = 'primeverse-audio-preferences-v1'

interface AudioValues {
  volume: number
  muted: boolean
}

interface AudioPreferences extends AudioValues {
  setVolume(volume: number): void
  setMuted(muted: boolean): void
  toggleMuted(): void
}

type AudioStorage = Pick<Storage, 'getItem' | 'setItem'>
const defaults: AudioValues = { volume: 1, muted: false }

function browserStorage(): AudioStorage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage } catch { return undefined }
}

export function createAudioPreferencesStore(storage: AudioStorage | undefined = browserStorage()) {
  const restored = { ...defaults }
  try {
    const value: unknown = JSON.parse(storage?.getItem(AUDIO_PREFERENCES_KEY) ?? 'null')
    if (value && typeof value === 'object') {
      const saved = value as Partial<AudioValues>
      if (typeof saved.volume === 'number' && Number.isFinite(saved.volume)) restored.volume = Math.min(1, Math.max(0, saved.volume))
      if (typeof saved.muted === 'boolean') restored.muted = saved.muted
    }
  } catch { /* A corrupt or unavailable preference must not prevent playing. */ }

  const store = createStore<AudioPreferences>()((set) => ({
    ...restored,
    setVolume: volume => {
      if (Number.isFinite(volume)) set({ volume: Math.min(1, Math.max(0, volume)) })
    },
    setMuted: muted => set({ muted }),
    toggleMuted: () => set(state => ({ muted: !state.muted })),
  }))
  store.subscribe(({ volume, muted }) => {
    try { storage?.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify({ volume, muted })) } catch { /* Session controls still work. */ }
  })
  return store
}

export const audioPreferences = createAudioPreferencesStore()

export function useAudioPreferences<T>(selector: (state: AudioPreferences) => T): T {
  return useStore(audioPreferences, selector)
}

export function effectiveAudioVolume(state: AudioValues = audioPreferences.getState()): number {
  return state.muted ? 0 : state.volume
}

/** Connect an engine without creating or resuming an AudioContext. Dispose with the engine. */
export function subscribeAudioVolume(apply: (volume: number) => void): () => void {
  apply(effectiveAudioVolume())
  return audioPreferences.subscribe(state => apply(effectiveAudioVolume(state)))
}
