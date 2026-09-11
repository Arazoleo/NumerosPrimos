import { useProgressionStore } from '../../../../progression/progressionStore'

import type { ModularOrbitProgressInput } from './types'

export function recordModularOrbitProgress(
  result: ModularOrbitProgressInput,
): boolean {
  const progression = useProgressionStore.getState()
  const isNewBest = progression.updateBestScore('modular-orbit', result.score)
  progression.awardXp(result.xp)
  return isNewBest
}
