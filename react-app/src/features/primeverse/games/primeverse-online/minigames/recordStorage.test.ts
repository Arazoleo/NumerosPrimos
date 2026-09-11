import { describe, expect, it } from 'vitest'

import {
  MINIGAME_RECORD_STORAGE_KEY,
  parseMinigameRecords,
  persistMinigameRecord,
  readMinigameRecords,
  writeMinigameRecords,
  type MinigameRecordStorage,
} from './recordStorage'

function memoryStorage(initial: string | null = null): MinigameRecordStorage & { value: string | null } {
  return {
    value: initial,
    getItem(key) {
      expect(key).toBe(MINIGAME_RECORD_STORAGE_KEY)
      return this.value
    },
    setItem(key, value) {
      expect(key).toBe(MINIGAME_RECORD_STORAGE_KEY)
      this.value = value
    },
  }
}

describe('minigame record storage', () => {
  it('parses only versioned, finite, positive and bounded times', () => {
    expect(parseMinigameRecords('{broken')).toEqual({
      ulamPrimeRunBestMs: null,
      factorReactorBestMs: null,
    })
    expect(parseMinigameRecords(JSON.stringify({
      version: 1,
      ulamPrimeRunBestMs: 8_123.4,
      factorReactorBestMs: Number.POSITIVE_INFINITY,
    }))).toEqual({
      ulamPrimeRunBestMs: 8_123,
      factorReactorBestMs: null,
    })
    expect(parseMinigameRecords(JSON.stringify({
      version: 99,
      ulamPrimeRunBestMs: 1,
    })).ulamPrimeRunBestMs).toBeNull()
  })

  it('round-trips both records and sanitizes invalid writes', () => {
    const storage = memoryStorage()
    expect(writeMinigameRecords({
      ulamPrimeRunBestMs: 7_200,
      factorReactorBestMs: -3,
    }, storage)).toBe(true)
    expect(readMinigameRecords(storage)).toEqual({
      ulamPrimeRunBestMs: 7_200,
      factorReactorBestMs: null,
    })
  })

  it('only replaces a record with a faster valid time', () => {
    const storage = memoryStorage()
    persistMinigameRecord('ulam-prime-run', 9_000, storage)
    persistMinigameRecord('ulam-prime-run', 10_000, storage)
    persistMinigameRecord('factor-reactor', 12_000, storage)
    expect(readMinigameRecords(storage)).toEqual({
      ulamPrimeRunBestMs: 9_000,
      factorReactorBestMs: 12_000,
    })
    persistMinigameRecord('ulam-prime-run', 8_500, storage)
    expect(readMinigameRecords(storage).ulamPrimeRunBestMs).toBe(8_500)
  })

  it('survives browser storage getter and setter failures', () => {
    const brokenRead: MinigameRecordStorage = {
      getItem() { throw new Error('blocked') },
      setItem() { throw new Error('blocked') },
    }
    expect(readMinigameRecords(brokenRead).ulamPrimeRunBestMs).toBeNull()
    expect(writeMinigameRecords({
      ulamPrimeRunBestMs: 1_000,
      factorReactorBestMs: null,
    }, brokenRead)).toBe(false)
  })
})

