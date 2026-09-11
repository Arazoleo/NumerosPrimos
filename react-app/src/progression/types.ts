export const ACHIEVEMENT_IDS = [
  'first-prime',
  'prime-sniper',
  'factor-apprentice',
  'factor-master',
  'perfect-hunter',
] as const

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number]

export const CORE_GAME_IDS = [
  'prime-hunter',
  'factor-forge',
  'modular-orbit',
  'prime-defense',
  'rsa-vault',
  'diffie-hellman',
  'ulam-galaxy',
  'crypto-escape',
  'primebound',
  'skyline-runner',
] as const

export type CoreGameId = (typeof CORE_GAME_IDS)[number]
export type GameId = CoreGameId | (string & {})

export interface AchievementDefinition {
  readonly id: AchievementId
  readonly name: string
  readonly description: string
}

export interface AchievementProgress {
  readonly unlocked: boolean
  readonly unlockedAt: string | null
}

export type AchievementProgressMap = Readonly<
  Record<AchievementId, AchievementProgress>
>

export interface ProgressionStatistics {
  readonly totalPrimeHits: number
  readonly currentPrimeStreak: number
  readonly bestPrimeStreak: number
  readonly hunterRuns: number
}

export interface ProgressionSnapshot {
  readonly xp: number
  readonly level: number
  readonly achievements: AchievementProgressMap
  readonly bestScores: Readonly<Record<string, number>>
  readonly factorCompletions: number
  readonly statistics: ProgressionStatistics
}

export interface XpAwardResult {
  readonly awardedXp: number
  readonly previousXp: number
  readonly totalXp: number
  readonly previousLevel: number
  readonly level: number
  readonly levelsGained: number
}

export interface ProgressionEventResult {
  readonly unlockedAchievements: readonly AchievementId[]
  readonly xp: XpAwardResult
  readonly isNewBestScore: boolean
}

export interface FactorizationCompletionInput {
  readonly score: number
  readonly xp?: number
  readonly elapsedMs?: number
  readonly steps?: number
}

export interface HunterRunResultInput {
  readonly score: number
  readonly hits: number
  readonly misses: number
  readonly bestCombo: number
  readonly xp?: number
}

export interface PrimeHitInput {
  readonly xp?: number
}
