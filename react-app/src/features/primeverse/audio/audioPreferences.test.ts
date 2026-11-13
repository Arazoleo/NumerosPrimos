import { describe, expect, it } from 'vitest'
import { AUDIO_PREFERENCES_KEY, createAudioPreferencesStore, effectiveAudioVolume } from './audioPreferences'

function memoryStorage() {
  const entries = new Map<string, string>()
  return { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value) } }
}

describe('shared audio preferences', () => {
  it('restores volume and mute in a new store after a reload, retaining volume when unmuted', () => {
    const storage = memoryStorage()
    const first = createAudioPreferencesStore(storage)
    first.getState().setVolume(0.37)
    first.getState().setMuted(true)
    const restored = createAudioPreferencesStore(storage)
    expect(restored.getState()).toMatchObject({ volume: 0.37, muted: true })
    expect(effectiveAudioVolume(restored.getState())).toBe(0)
    restored.getState().toggleMuted()
    expect(effectiveAudioVolume(restored.getState())).toBe(0.37)
  })

  it('recovers from corrupt values and clamps saved volume', () => {
    const storage = memoryStorage()
    storage.setItem(AUDIO_PREFERENCES_KEY, 'invalid json')
    expect(createAudioPreferencesStore(storage).getState()).toMatchObject({ volume: 1, muted: false })
    storage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify({ volume: 9, muted: 'false' }))
    const store = createAudioPreferencesStore(storage)
    expect(store.getState()).toMatchObject({ volume: 1, muted: false })
    store.getState().setVolume(-1)
    store.getState().setVolume(NaN)
    expect(store.getState().volume).toBe(0)
  })

  it('keeps controls functional when browser storage is denied', () => {
    const store = createAudioPreferencesStore({ getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } })
    store.getState().setVolume(0.2)
    store.getState().toggleMuted()
    expect(store.getState()).toMatchObject({ volume: 0.2, muted: true })
  })
})
