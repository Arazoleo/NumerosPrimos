import type {
  AchievementDefinition,
  AchievementId,
  AchievementProgressMap,
} from './types'

export const ACHIEVEMENTS = [
  {
    id: 'first-prime',
    name: 'Primeiro Primo',
    description: 'Acerte o primeiro número primo.',
  },
  {
    id: 'prime-sniper',
    name: 'Prime Sniper',
    description: 'Acerte 10 números primos consecutivos.',
  },
  {
    id: 'factor-apprentice',
    name: 'Factor Apprentice',
    description: 'Complete sua primeira fatoração.',
  },
  {
    id: 'factor-master',
    name: 'Factor Master',
    description: 'Complete 10 fatorações.',
  },
  {
    id: 'perfect-hunter',
    name: 'Perfect Hunter',
    description: 'Termine uma partida com 100% de precisão.',
  },
] as const satisfies readonly AchievementDefinition[]

export const ACHIEVEMENT_BY_ID: Readonly<
  Record<AchievementId, AchievementDefinition>
> = Object.freeze(
  Object.fromEntries(
    ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]),
  ) as Record<AchievementId, AchievementDefinition>,
)

export function createLockedAchievements(): AchievementProgressMap {
  return {
    'first-prime': { unlocked: false, unlockedAt: null },
    'prime-sniper': { unlocked: false, unlockedAt: null },
    'factor-apprentice': { unlocked: false, unlockedAt: null },
    'factor-master': { unlocked: false, unlockedAt: null },
    'perfect-hunter': { unlocked: false, unlockedAt: null },
  }
}

