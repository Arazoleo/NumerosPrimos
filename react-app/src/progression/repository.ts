import { createLockedAchievements } from './achievements'
import { levelFromXp } from './level'
import {
  ACHIEVEMENT_IDS,
  type AchievementProgress,
  type AchievementId,
  type AchievementProgressMap,
  type ProgressionSnapshot,
} from './types'

export const PROGRESSION_SCHEMA_VERSION = 1
export const PROGRESSION_STORAGE_KEY = 'primeverse:progression'

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface ProgressionRepository {
  load(): ProgressionSnapshot
  save(snapshot: ProgressionSnapshot): void
  clear(): void
}

interface StoredProgressionEnvelope {
  readonly version: typeof PROGRESSION_SCHEMA_VERSION
  readonly data: ProgressionSnapshot
}

export interface LocalStorageRepositoryOptions {
  readonly key?: string
  readonly storage?: KeyValueStorage | null
}

const GAME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isKeyValueStorage(value: unknown): value is KeyValueStorage {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.getItem === 'function' &&
    typeof value.setItem === 'function' &&
    typeof value.removeItem === 'function'
  )
}

function resolveBrowserStorage(): KeyValueStorage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const candidate: unknown = window.localStorage
    return isKeyValueStorage(candidate) ? candidate : null
  } catch {
    return null
  }
}

function toNonNegativeInteger(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return fallback
  }

  return Math.floor(value)
}

function normalizeAchievements(value: unknown): AchievementProgressMap {
  const defaults = createLockedAchievements()

  if (!isRecord(value)) {
    return defaults
  }

  const achievements: Record<AchievementId, AchievementProgress> = {
    ...defaults,
  }

  for (const id of ACHIEVEMENT_IDS) {
    const storedAchievement = value[id]

    if (!isRecord(storedAchievement) || storedAchievement.unlocked !== true) {
      continue
    }

    achievements[id] = {
      unlocked: true,
      unlockedAt:
        typeof storedAchievement.unlockedAt === 'string'
          ? storedAchievement.unlockedAt
          : null,
    }
  }

  return achievements
}

function normalizeBestScores(value: unknown): Readonly<Record<string, number>> {
  if (!isRecord(value)) {
    return {}
  }

  const bestScores: Record<string, number> = {}

  for (const [gameId, score] of Object.entries(value)) {
    if (
      GAME_ID_PATTERN.test(gameId) &&
      typeof score === 'number' &&
      Number.isFinite(score) &&
      score >= 0
    ) {
      bestScores[gameId] = Math.floor(score)
    }
  }

  return bestScores
}

export function createDefaultProgression(): ProgressionSnapshot {
  return {
    xp: 0,
    level: 1,
    achievements: createLockedAchievements(),
    bestScores: {},
    factorCompletions: 0,
    statistics: {
      totalPrimeHits: 0,
      currentPrimeStreak: 0,
      bestPrimeStreak: 0,
      hunterRuns: 0,
    },
  }
}

export function normalizeProgressionSnapshot(
  value: unknown,
): ProgressionSnapshot {
  if (!isRecord(value)) {
    return createDefaultProgression()
  }

  const xp = toNonNegativeInteger(value.xp)
  const statistics = isRecord(value.statistics) ? value.statistics : {}
  const currentPrimeStreak = toNonNegativeInteger(
    statistics.currentPrimeStreak,
  )
  const bestPrimeStreak = Math.max(
    currentPrimeStreak,
    toNonNegativeInteger(statistics.bestPrimeStreak),
  )

  return {
    xp,
    level: levelFromXp(xp),
    achievements: normalizeAchievements(value.achievements),
    bestScores: normalizeBestScores(value.bestScores),
    factorCompletions: toNonNegativeInteger(value.factorCompletions),
    statistics: {
      totalPrimeHits: toNonNegativeInteger(statistics.totalPrimeHits),
      currentPrimeStreak,
      bestPrimeStreak,
      hunterRuns: toNonNegativeInteger(statistics.hunterRuns),
    },
  }
}

function readVersionedSnapshot(serialized: string): ProgressionSnapshot {
  const parsed: unknown = JSON.parse(serialized)

  if (
    !isRecord(parsed) ||
    parsed.version !== PROGRESSION_SCHEMA_VERSION ||
    !('data' in parsed)
  ) {
    return createDefaultProgression()
  }

  return normalizeProgressionSnapshot(parsed.data)
}

export class VersionedLocalStorageProgressionRepository
  implements ProgressionRepository
{
  private readonly key: string
  private readonly configuredStorage: KeyValueStorage | null | undefined

  constructor(options: LocalStorageRepositoryOptions = {}) {
    this.key = options.key ?? PROGRESSION_STORAGE_KEY
    this.configuredStorage = options.storage
  }

  private getStorage(): KeyValueStorage | null {
    return this.configuredStorage === undefined
      ? resolveBrowserStorage()
      : this.configuredStorage
  }

  load(): ProgressionSnapshot {
    try {
      const serialized = this.getStorage()?.getItem(this.key)
      return serialized
        ? readVersionedSnapshot(serialized)
        : createDefaultProgression()
    } catch {
      return createDefaultProgression()
    }
  }

  save(snapshot: ProgressionSnapshot): void {
    const envelope: StoredProgressionEnvelope = {
      version: PROGRESSION_SCHEMA_VERSION,
      data: normalizeProgressionSnapshot(snapshot),
    }

    try {
      this.getStorage()?.setItem(this.key, JSON.stringify(envelope))
    } catch {
      // Storage can be disabled or full; gameplay must continue in memory.
    }
  }

  clear(): void {
    try {
      this.getStorage()?.removeItem(this.key)
    } catch {
      // A blocked storage API should not make resetting in-memory state fail.
    }
  }
}

export class MemoryProgressionRepository implements ProgressionRepository {
  private snapshot: ProgressionSnapshot | null

  constructor(initialSnapshot?: ProgressionSnapshot) {
    this.snapshot = initialSnapshot
      ? normalizeProgressionSnapshot(initialSnapshot)
      : null
  }

  load(): ProgressionSnapshot {
    return this.snapshot
      ? normalizeProgressionSnapshot(this.snapshot)
      : createDefaultProgression()
  }

  save(snapshot: ProgressionSnapshot): void {
    this.snapshot = normalizeProgressionSnapshot(snapshot)
  }

  clear(): void {
    this.snapshot = null
  }
}

export function createMemoryProgressionRepository(
  initialSnapshot?: ProgressionSnapshot,
): ProgressionRepository {
  return new MemoryProgressionRepository(initialSnapshot)
}

export function isKnownAchievementId(value: string): value is AchievementId {
  return (ACHIEVEMENT_IDS as readonly string[]).includes(value)
}
