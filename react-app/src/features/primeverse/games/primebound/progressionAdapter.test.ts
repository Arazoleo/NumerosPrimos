import { describe, expect, it, vi } from 'vitest'

import {
  createPrimeboundProgressRecorder,
  type PrimeboundProgressionWriter,
} from './progressionAdapter'

function createWriter(isNewBest = true) {
  const updateBestScore = vi.fn(() => isNewBest)
  const awardXp = vi.fn()
  const writer: PrimeboundProgressionWriter = {
    updateBestScore,
    awardXp,
  }

  return { writer, updateBestScore, awardXp }
}

describe('Primebound progression adapter', () => {
  it('records score and XP under the Primebound game id', () => {
    const { writer, updateBestScore, awardXp } = createWriter()
    const recordProgress = createPrimeboundProgressRecorder(() => writer)

    expect(recordProgress({ runId: 1, score: 4_850, xp: 175 })).toBe(true)
    expect(updateBestScore).toHaveBeenCalledOnce()
    expect(updateBestScore).toHaveBeenCalledWith('primebound', 4_850)
    expect(awardXp).toHaveBeenCalledOnce()
    expect(awardXp).toHaveBeenCalledWith(175)
  })

  it('does not grant progression twice for the same run', () => {
    const { writer, updateBestScore, awardXp } = createWriter()
    const recordProgress = createPrimeboundProgressRecorder(() => writer)
    const result = { runId: 'campaign-7', score: 3_200, xp: 120 }

    expect(recordProgress(result)).toBe(true)
    expect(recordProgress({ ...result, score: 9_999, xp: 999 })).toBe(false)
    expect(updateBestScore).toHaveBeenCalledOnce()
    expect(awardXp).toHaveBeenCalledOnce()
  })

  it('records different runs independently', () => {
    const { writer, updateBestScore, awardXp } = createWriter(false)
    const recordProgress = createPrimeboundProgressRecorder(() => writer)

    expect(recordProgress({ runId: 3, score: 900, xp: 30 })).toBe(false)
    expect(recordProgress({ runId: 4, score: 1_100, xp: 40 })).toBe(false)
    expect(updateBestScore).toHaveBeenCalledTimes(2)
    expect(awardXp).toHaveBeenNthCalledWith(1, 30)
    expect(awardXp).toHaveBeenNthCalledWith(2, 40)
  })

  it('normalizes score and XP before writing them', () => {
    const { writer, updateBestScore, awardXp } = createWriter()
    const recordProgress = createPrimeboundProgressRecorder(() => writer)

    recordProgress({ runId: 8, score: 720.9, xp: 54.8 })

    expect(updateBestScore).toHaveBeenCalledWith('primebound', 720)
    expect(awardXp).toHaveBeenCalledWith(54)
  })

  it('rejects invalid input before mutating progression', () => {
    const { writer, updateBestScore, awardXp } = createWriter()
    const recordProgress = createPrimeboundProgressRecorder(() => writer)

    expect(() => recordProgress({ runId: 2, score: 500, xp: -1 })).toThrow(
      RangeError,
    )
    expect(() => recordProgress({ runId: '', score: 500, xp: 10 })).toThrow(
      TypeError,
    )
    expect(updateBestScore).not.toHaveBeenCalled()
    expect(awardXp).not.toHaveBeenCalled()
  })
})
