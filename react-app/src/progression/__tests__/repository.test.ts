import { describe, expect, it } from 'vitest'
import {
  createDefaultProgression,
  PROGRESSION_SCHEMA_VERSION,
  PROGRESSION_STORAGE_KEY,
  VersionedLocalStorageProgressionRepository,
  type KeyValueStorage,
} from '..'

class FakeStorage implements KeyValueStorage {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

const unavailableStorage: KeyValueStorage = {
  getItem: () => {
    throw new Error('unavailable')
  },
  setItem: () => {
    throw new Error('unavailable')
  },
  removeItem: () => {
    throw new Error('unavailable')
  },
}

describe('VersionedLocalStorageProgressionRepository', () => {
  it('persists a versioned envelope and restores normalized data', () => {
    const storage = new FakeStorage()
    const repository = new VersionedLocalStorageProgressionRepository({
      storage,
    })
    const snapshot = {
      ...createDefaultProgression(),
      xp: 750,
      level: 99,
      factorCompletions: 3,
    }

    repository.save(snapshot)

    expect(JSON.parse(storage.values.get(PROGRESSION_STORAGE_KEY) ?? '')).toMatchObject(
      {
        version: PROGRESSION_SCHEMA_VERSION,
        data: { xp: 750, level: 2, factorCompletions: 3 },
      },
    )
    expect(repository.load()).toMatchObject({
      xp: 750,
      level: 2,
      factorCompletions: 3,
    })
  })

  it('falls back safely for malformed, unknown-version, or unavailable storage', () => {
    const storage = new FakeStorage()
    const repository = new VersionedLocalStorageProgressionRepository({
      storage,
    })

    storage.setItem(PROGRESSION_STORAGE_KEY, '{not-json')
    expect(repository.load()).toEqual(createDefaultProgression())

    storage.setItem(
      PROGRESSION_STORAGE_KEY,
      JSON.stringify({ version: 999, data: { xp: 1000 } }),
    )
    expect(repository.load()).toEqual(createDefaultProgression())

    const unavailable = new VersionedLocalStorageProgressionRepository({
      storage: unavailableStorage,
    })
    expect(unavailable.load()).toEqual(createDefaultProgression())
    expect(() => unavailable.save(createDefaultProgression())).not.toThrow()
    expect(() => unavailable.clear()).not.toThrow()
  })

  it('works without a browser storage implementation', () => {
    const repository = new VersionedLocalStorageProgressionRepository({
      storage: null,
    })

    expect(repository.load()).toEqual(createDefaultProgression())
    expect(() => repository.save(createDefaultProgression())).not.toThrow()
  })
})

