const RECORD_VERSION = 1
const MAX_REASONABLE_RECORD_MS = 60 * 60 * 1_000

export const MINIGAME_RECORD_STORAGE_KEY = 'primeverse-online:minigame-records:v1'

export type PrimeverseMinigameId = 'ulam-prime-run' | 'factor-reactor'

export interface PrimeverseMinigameRecords {
  readonly ulamPrimeRunBestMs: number | null
  readonly factorReactorBestMs: number | null
}

export interface MinigameRecordStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const EMPTY_RECORDS: PrimeverseMinigameRecords = Object.freeze({
  ulamPrimeRunBestMs: null,
  factorReactorBestMs: null,
})

function parseRecordTime(value: unknown): number | null {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value > 0
    && value <= MAX_REASONABLE_RECORD_MS
    ? Math.round(value)
    : null
}

function browserStorage(): MinigameRecordStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function parseMinigameRecords(serialized: string | null): PrimeverseMinigameRecords {
  if (!serialized) return EMPTY_RECORDS
  try {
    const parsed: unknown = JSON.parse(serialized)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return EMPTY_RECORDS
    const candidate = parsed as Record<string, unknown>
    if (candidate.version !== RECORD_VERSION) return EMPTY_RECORDS
    return {
      ulamPrimeRunBestMs: parseRecordTime(candidate.ulamPrimeRunBestMs),
      factorReactorBestMs: parseRecordTime(candidate.factorReactorBestMs),
    }
  } catch {
    return EMPTY_RECORDS
  }
}

export function readMinigameRecords(
  storage: MinigameRecordStorage | null = browserStorage(),
): PrimeverseMinigameRecords {
  if (!storage) return EMPTY_RECORDS
  try {
    return parseMinigameRecords(storage.getItem(MINIGAME_RECORD_STORAGE_KEY))
  } catch {
    return EMPTY_RECORDS
  }
}

export function writeMinigameRecords(
  records: PrimeverseMinigameRecords,
  storage: MinigameRecordStorage | null = browserStorage(),
): boolean {
  if (!storage) return false
  const safeRecords: PrimeverseMinigameRecords = {
    ulamPrimeRunBestMs: parseRecordTime(records.ulamPrimeRunBestMs),
    factorReactorBestMs: parseRecordTime(records.factorReactorBestMs),
  }
  try {
    storage.setItem(MINIGAME_RECORD_STORAGE_KEY, JSON.stringify({
      version: RECORD_VERSION,
      ...safeRecords,
    }))
    return true
  } catch {
    return false
  }
}

export function persistMinigameRecord(
  game: PrimeverseMinigameId,
  timeMs: number,
  storage: MinigameRecordStorage | null = browserStorage(),
): PrimeverseMinigameRecords {
  const records = readMinigameRecords(storage)
  const safeTime = parseRecordTime(timeMs)
  if (safeTime === null) return records
  const key = game === 'ulam-prime-run' ? 'ulamPrimeRunBestMs' : 'factorReactorBestMs'
  const previous = records[key]
  if (previous !== null && previous <= safeTime) return records
  const updated = { ...records, [key]: safeTime }
  writeMinigameRecords(updated, storage)
  return updated
}

