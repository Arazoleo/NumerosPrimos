export const XP_PER_LEVEL = 500

function normalizeXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) {
    return 0
  }

  return Math.floor(xp)
}

export function levelFromXp(xp: number): number {
  return Math.floor(normalizeXp(xp) / XP_PER_LEVEL) + 1
}

export interface LevelProgress {
  readonly level: number
  readonly xpInLevel: number
  readonly xpForNextLevel: number
  readonly ratio: number
}

export function getLevelProgress(xp: number): LevelProgress {
  const normalizedXp = normalizeXp(xp)
  const xpInLevel = normalizedXp % XP_PER_LEVEL

  return {
    level: levelFromXp(normalizedXp),
    xpInLevel,
    xpForNextLevel: XP_PER_LEVEL,
    ratio: xpInLevel / XP_PER_LEVEL,
  }
}

