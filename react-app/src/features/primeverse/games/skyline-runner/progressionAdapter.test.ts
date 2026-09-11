import { describe, expect, it, vi } from 'vitest'

import { createSkylineProgressRecorder } from './progressionAdapter'

describe('skyline runner progression', () => {
  it('records a completed run only once', () => {
    const writer = { updateBestScore: vi.fn(() => true), awardXp: vi.fn() }
    const record = createSkylineProgressRecorder(() => writer)
    expect(record({ runId: 'run-7', score: 8120, xp: 240 })).toBe(true)
    expect(record({ runId: 'run-7', score: 8120, xp: 240 })).toBe(false)
    expect(writer.updateBestScore).toHaveBeenCalledOnce()
    expect(writer.awardXp).toHaveBeenCalledWith(240)
  })
})
