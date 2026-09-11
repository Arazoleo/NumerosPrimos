import { useProgressionStore } from '../../../../progression/progressionStore'

import type { DefenseProgressInput } from './types'

export function recordPrimeDefenseProgress(input: DefenseProgressInput): boolean {
  const progression = useProgressionStore.getState()
  const isNewBest = progression.updateBestScore('prime-defense', input.score)
  progression.awardXp(input.xp)
  return isNewBest
}
