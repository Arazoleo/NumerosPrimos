import { useProgressionStore } from '../../../../progression/progressionStore'

export interface SkylineProgressInput {
  readonly runId: string | number
  readonly score: number
  readonly xp: number
}

export interface SkylineProgressionWriter {
  updateBestScore(gameId: 'skyline-runner', score: number): boolean
  awardXp(amount: number): unknown
}

export type SkylineProgressRecorder = (result: SkylineProgressInput) => boolean

function normalizedInteger(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${field} must be finite and non-negative`)
  return Math.floor(value)
}

export function createSkylineProgressRecorder(
  getProgression: () => SkylineProgressionWriter = () => useProgressionStore.getState(),
): SkylineProgressRecorder {
  const recordedRuns = new Set<string>()
  return ({ runId, score, xp }) => {
    const key = `${typeof runId}:${String(runId).trim()}`
    if (key.endsWith(':')) throw new TypeError('runId must not be empty')
    if (recordedRuns.has(key)) return false
    const progression = getProgression()
    const isNewBest = progression.updateBestScore('skyline-runner', normalizedInteger(score, 'score'))
    progression.awardXp(normalizedInteger(xp, 'XP'))
    recordedRuns.add(key)
    return isNewBest
  }
}

const defaultRecorder = createSkylineProgressRecorder()

export function recordSkylineRunnerProgress(input: SkylineProgressInput): boolean {
  return defaultRecorder(input)
}
