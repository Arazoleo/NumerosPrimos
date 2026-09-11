import { useProgressionStore } from '../../../../progression/progressionStore'

import type { EscapeProgressInput } from './types'

export function recordEscapeProgress(result: EscapeProgressInput): boolean {
  const progression = useProgressionStore.getState()
  const isNewBest = progression.updateBestScore('crypto-escape', result.score)
  progression.awardXp(result.xp)
  return isNewBest
}
