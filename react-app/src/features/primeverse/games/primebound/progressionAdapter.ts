import { useProgressionStore } from '../../../../progression/progressionStore'

export interface PrimeboundProgressInput {
  readonly runId: string | number
  readonly score: number
  readonly xp: number
}

export interface PrimeboundProgressionWriter {
  updateBestScore(gameId: 'primebound', score: number): boolean
  awardXp(amount: number): unknown
}

export type PrimeboundProgressRecorder = (
  result: PrimeboundProgressInput,
) => boolean

function toNonNegativeInteger(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${field} must be a finite, non-negative number`)
  }

  return Math.floor(value)
}

function toRunKey(runId: string | number): string {
  if (typeof runId === 'number') {
    if (!Number.isSafeInteger(runId) || runId < 0) {
      throw new RangeError('runId must be a non-negative safe integer')
    }

    return `number:${runId}`
  }

  const normalized = runId.trim()
  if (normalized.length === 0) {
    throw new TypeError('runId must not be empty')
  }

  return `string:${normalized}`
}

/**
 * Creates a recorder that grants progression at most once for each run id.
 * A factory keeps the idempotency boundary explicit and makes isolated stores
 * straightforward to test without changing the global progression contract.
 */
export function createPrimeboundProgressRecorder(
  getProgression: () => PrimeboundProgressionWriter = () =>
    useProgressionStore.getState(),
): PrimeboundProgressRecorder {
  const recordedRuns = new Set<string>()

  return ({ runId, score, xp }) => {
    const runKey = toRunKey(runId)
    const normalizedScore = toNonNegativeInteger(score, 'score')
    const normalizedXp = toNonNegativeInteger(xp, 'XP')

    if (recordedRuns.has(runKey)) return false

    const progression = getProgression()
    const isNewBest = progression.updateBestScore(
      'primebound',
      normalizedScore,
    )
    progression.awardXp(normalizedXp)
    recordedRuns.add(runKey)

    return isNewBest
  }
}

const defaultRecorder = createPrimeboundProgressRecorder()

export function recordPrimeboundProgress(
  result: PrimeboundProgressInput,
): boolean {
  return defaultRecorder(result)
}
