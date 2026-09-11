import { useProgressionStore } from '../../../../progression/progressionStore'

import type { UlamProgressInput } from './types'

export function recordUlamProgress(result: UlamProgressInput): boolean {
  const progression = useProgressionStore.getState()
  const isNewBest = progression.updateBestScore('ulam-galaxy', result.score)
  progression.awardXp(result.xp)
  return isNewBest
}

