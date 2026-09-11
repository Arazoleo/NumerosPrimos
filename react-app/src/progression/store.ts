import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { levelFromXp } from './level'
import {
  createDefaultProgression,
  normalizeProgressionSnapshot,
  VersionedLocalStorageProgressionRepository,
  type ProgressionRepository,
} from './repository'
import type {
  AchievementId,
  AchievementProgress,
  FactorizationCompletionInput,
  GameId,
  HunterRunResultInput,
  PrimeHitInput,
  ProgressionEventResult,
  ProgressionSnapshot,
  XpAwardResult,
} from './types'

export interface ProgressionActions {
  awardXp(amount: number): XpAwardResult
  unlockAchievement(id: AchievementId): boolean
  updateBestScore(gameId: GameId, score: number): boolean
  startHunterRun(): void
  recordPrimeHit(input?: PrimeHitInput): ProgressionEventResult
  recordPrimeMiss(): void
  recordHunterRun(input: HunterRunResultInput): ProgressionEventResult
  recordFactorization(
    input: FactorizationCompletionInput,
  ): ProgressionEventResult
  recordFactorCompletion(
    input: FactorizationCompletionInput,
  ): ProgressionEventResult
  hydrate(): void
  resetProgression(): void
}

export type ProgressionStore = ProgressionSnapshot & ProgressionActions
export type ProgressionStoreHook = UseBoundStore<StoreApi<ProgressionStore>>

export interface ProgressionStoreOptions {
  readonly now?: () => string
}

interface TransactionResult<Result> {
  readonly snapshot: ProgressionSnapshot
  readonly result: Result
}

const GAME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/

function toGameInteger(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${fieldName} must be a finite, non-negative number`)
  }

  return Math.floor(value)
}

function assertGameId(gameId: string): void {
  if (!GAME_ID_PATTERN.test(gameId)) {
    throw new TypeError(
      'gameId must use lowercase letters, numbers, and hyphens (max 64 characters)',
    )
  }
}

function snapshotFromStore(store: ProgressionStore): ProgressionSnapshot {
  return normalizeProgressionSnapshot(store)
}

function safeLoad(repository: ProgressionRepository): ProgressionSnapshot {
  try {
    return normalizeProgressionSnapshot(repository.load())
  } catch {
    return createDefaultProgression()
  }
}

function safeSave(
  repository: ProgressionRepository,
  snapshot: ProgressionSnapshot,
): void {
  try {
    repository.save(snapshot)
  } catch {
    // Custom/remote repositories must not be able to interrupt gameplay.
  }
}

function xpResult(
  snapshot: ProgressionSnapshot,
  amount: number,
): TransactionResult<XpAwardResult> {
  const awardedXp = toGameInteger(amount, 'XP')
  const totalXp = snapshot.xp + awardedXp
  const level = levelFromXp(totalXp)

  return {
    snapshot: {
      ...snapshot,
      xp: totalXp,
      level,
    },
    result: {
      awardedXp,
      previousXp: snapshot.xp,
      totalXp,
      previousLevel: snapshot.level,
      level,
      levelsGained: level - snapshot.level,
    },
  }
}

function unlockAchievements(
  snapshot: ProgressionSnapshot,
  ids: readonly AchievementId[],
  now: () => string,
): TransactionResult<readonly AchievementId[]> {
  const newIds = ids.filter((id) => !snapshot.achievements[id].unlocked)

  if (newIds.length === 0) {
    return { snapshot, result: [] }
  }

  const achievements: Record<AchievementId, AchievementProgress> = {
    ...snapshot.achievements,
  }
  const unlockedAt = now()

  for (const id of newIds) {
    achievements[id] = { unlocked: true, unlockedAt }
  }

  return {
    snapshot: { ...snapshot, achievements },
    result: newIds,
  }
}

function withBestScore(
  snapshot: ProgressionSnapshot,
  gameId: GameId,
  score: number,
): TransactionResult<boolean> {
  assertGameId(gameId)
  const normalizedScore = toGameInteger(score, 'score')
  const previousBest = snapshot.bestScores[gameId]

  if (previousBest !== undefined && previousBest >= normalizedScore) {
    return { snapshot, result: false }
  }

  return {
    snapshot: {
      ...snapshot,
      bestScores: {
        ...snapshot.bestScores,
        [gameId]: normalizedScore,
      },
    },
    result: true,
  }
}

function eventResult(
  unlockedAchievements: readonly AchievementId[],
  xp: XpAwardResult,
  isNewBestScore: boolean,
): ProgressionEventResult {
  return { unlockedAchievements, xp, isNewBestScore }
}

export function createProgressionStore(
  repository: ProgressionRepository =
    new VersionedLocalStorageProgressionRepository(),
  options: ProgressionStoreOptions = {},
): ProgressionStoreHook {
  const now = options.now ?? (() => new Date().toISOString())
  const initialSnapshot = safeLoad(repository)

  return create<ProgressionStore>()((set, get) => {
    const commit = <Result>(
      transaction: (
        snapshot: ProgressionSnapshot,
      ) => TransactionResult<Result>,
    ): Result => {
      const currentSnapshot = snapshotFromStore(get())
      const transactionResult = transaction(currentSnapshot)
      const nextSnapshot = normalizeProgressionSnapshot(
        transactionResult.snapshot,
      )

      set(nextSnapshot)
      safeSave(repository, nextSnapshot)
      return transactionResult.result
    }

    const recordFactorization = (
      input: FactorizationCompletionInput,
    ): ProgressionEventResult =>
      commit((snapshot) => {
        const scoreUpdate = withBestScore(
          snapshot,
          'factor-forge',
          input.score,
        )
        const completionCount = snapshot.factorCompletions + 1
        let nextSnapshot: ProgressionSnapshot = {
          ...scoreUpdate.snapshot,
          factorCompletions: completionCount,
        }
        const achievementIds: AchievementId[] = ['factor-apprentice']

        if (completionCount >= 10) {
          achievementIds.push('factor-master')
        }

        const achievementUpdate = unlockAchievements(
          nextSnapshot,
          achievementIds,
          now,
        )
        nextSnapshot = achievementUpdate.snapshot
        const awardedXp = xpResult(nextSnapshot, input.xp ?? 0)

        return {
          snapshot: awardedXp.snapshot,
          result: eventResult(
            achievementUpdate.result,
            awardedXp.result,
            scoreUpdate.result,
          ),
        }
      })

    return {
      ...initialSnapshot,

      awardXp: (amount) => commit((snapshot) => xpResult(snapshot, amount)),

      unlockAchievement: (id) =>
        commit((snapshot) => {
          const update = unlockAchievements(snapshot, [id], now)
          return {
            snapshot: update.snapshot,
            result: update.result.length > 0,
          }
        }),

      updateBestScore: (gameId, score) =>
        commit((snapshot) => withBestScore(snapshot, gameId, score)),

      startHunterRun: () => {
        commit((snapshot) => ({
          snapshot: {
            ...snapshot,
            statistics: {
              ...snapshot.statistics,
              currentPrimeStreak: 0,
            },
          },
          result: undefined,
        }))
      },

      recordPrimeHit: (input = {}) =>
        commit((snapshot) => {
          const currentPrimeStreak =
            snapshot.statistics.currentPrimeStreak + 1
          const nextSnapshot: ProgressionSnapshot = {
            ...snapshot,
            statistics: {
              ...snapshot.statistics,
              totalPrimeHits: snapshot.statistics.totalPrimeHits + 1,
              currentPrimeStreak,
              bestPrimeStreak: Math.max(
                snapshot.statistics.bestPrimeStreak,
                currentPrimeStreak,
              ),
            },
          }
          const achievementIds: AchievementId[] = ['first-prime']

          if (currentPrimeStreak >= 10) {
            achievementIds.push('prime-sniper')
          }

          const achievementUpdate = unlockAchievements(
            nextSnapshot,
            achievementIds,
            now,
          )
          const awardedXp = xpResult(
            achievementUpdate.snapshot,
            input.xp ?? 0,
          )

          return {
            snapshot: awardedXp.snapshot,
            result: eventResult(
              achievementUpdate.result,
              awardedXp.result,
              false,
            ),
          }
        }),

      recordPrimeMiss: () => {
        commit((snapshot) => ({
          snapshot: {
            ...snapshot,
            statistics: {
              ...snapshot.statistics,
              currentPrimeStreak: 0,
            },
          },
          result: undefined,
        }))
      },

      recordHunterRun: (input) =>
        commit((snapshot) => {
          const hits = toGameInteger(input.hits, 'hits')
          const misses = toGameInteger(input.misses, 'misses')
          const bestCombo = toGameInteger(input.bestCombo, 'bestCombo')
          const scoreUpdate = withBestScore(
            snapshot,
            'prime-hunter',
            input.score,
          )
          const achievementIds: AchievementId[] = []

          if (hits > 0) {
            achievementIds.push('first-prime')
          }

          if (bestCombo >= 10) {
            achievementIds.push('prime-sniper')
          }

          if (hits > 0 && misses === 0) {
            achievementIds.push('perfect-hunter')
          }

          const withRun: ProgressionSnapshot = {
            ...scoreUpdate.snapshot,
            statistics: {
              ...scoreUpdate.snapshot.statistics,
              currentPrimeStreak: 0,
              bestPrimeStreak: Math.max(
                scoreUpdate.snapshot.statistics.bestPrimeStreak,
                bestCombo,
              ),
              hunterRuns: scoreUpdate.snapshot.statistics.hunterRuns + 1,
            },
          }
          const achievementUpdate = unlockAchievements(
            withRun,
            achievementIds,
            now,
          )
          const awardedXp = xpResult(
            achievementUpdate.snapshot,
            input.xp ?? 0,
          )

          return {
            snapshot: awardedXp.snapshot,
            result: eventResult(
              achievementUpdate.result,
              awardedXp.result,
              scoreUpdate.result,
            ),
          }
        }),

      recordFactorization,
      recordFactorCompletion: recordFactorization,

      hydrate: () => {
        set(safeLoad(repository))
      },

      resetProgression: () => {
        try {
          repository.clear()
        } catch {
          // The in-memory reset remains valid if an adapter cannot clear itself.
        }

        set(createDefaultProgression())
      },
    }
  })
}

export const useProgressionStore = createProgressionStore()
