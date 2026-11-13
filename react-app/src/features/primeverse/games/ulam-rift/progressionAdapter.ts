import { useProgressionStore } from '../../../../progression/progressionStore'

import { buildUlamRiftResult, type UlamRiftResult, type UlamRiftState } from './ulamRiftLogic'

export const ULAM_RIFT_GAME_ID = 'ulam-rift'

export interface UlamRiftProgressionWriter {
  updateBestScore: (gameId: string, score: number) => boolean
  awardXp: (amount: number) => unknown
}

export interface UlamRiftProgressRecord extends UlamRiftResult {
  readonly isNewBest: boolean
}

export interface UlamRiftProgressRecorder {
  record: (state: UlamRiftState) => UlamRiftProgressRecord | null
}

export function createUlamRiftProgressRecorder(
  getWriter: () => UlamRiftProgressionWriter = () => useProgressionStore.getState(),
): UlamRiftProgressRecorder {
  const recordedRuns = new Set<number>()

  return {
    record: (state) => {
      const result = buildUlamRiftResult(state)
      if (!result) return null
      if (recordedRuns.has(state.runSerial)) return null

      recordedRuns.add(state.runSerial)

      const writer = getWriter()
      const isNewBest = writer.updateBestScore(ULAM_RIFT_GAME_ID, result.score)
      writer.awardXp(result.xp)

      return { ...result, isNewBest }
    },
  }
}

export function recordUlamRiftProgress(state: UlamRiftState): UlamRiftProgressRecord | null {
  return createUlamRiftProgressRecorder().record(state)
}
