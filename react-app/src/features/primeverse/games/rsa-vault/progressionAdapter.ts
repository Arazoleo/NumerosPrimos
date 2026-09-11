import { useProgressionStore } from '../../../../progression/progressionStore'

import type { RsaVaultProgressInput } from './types'

export function recordRsaVaultProgress(result: RsaVaultProgressInput): boolean {
  const progression = useProgressionStore.getState()
  const isNewBest = progression.updateBestScore('rsa-vault', result.score)
  progression.awardXp(result.xp)
  return isNewBest
}
