import { useProgressionStore } from '../../../../progression/progressionStore'

import type { DiffieHellmanProgressInput } from './types'

export function recordDiffieHellmanProgress(
  result: DiffieHellmanProgressInput,
): boolean {
  const progression = useProgressionStore.getState()
  const isNewBest = progression.updateBestScore('diffie-hellman', result.score)
  progression.awardXp(result.xp)
  return isNewBest
}
