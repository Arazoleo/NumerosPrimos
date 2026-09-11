import { useProgressionStore } from '../../../../progression/progressionStore'

import type { ForgeResult } from './types'

export function recordForgeProgress(result: ForgeResult): void {
  useProgressionStore.getState().recordFactorization({
    score: result.score,
    xp: result.xp,
    elapsedMs: result.elapsedMs,
    steps: result.steps,
  })
}
