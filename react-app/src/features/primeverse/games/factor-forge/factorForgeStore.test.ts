import { beforeEach, describe, expect, it } from 'vitest'

import { useProgressionStore } from '../../../../progression/progressionStore'
import { useFactorForgeStore } from './factorForgeStore'

describe('Factor Forge store', () => {
  beforeEach(() => {
    useProgressionStore.getState().resetProgression()
    useFactorForgeStore.getState().returnToIntro()
  })

  it('finishes an arbitrary valid path and records progression once', () => {
    const forge = useFactorForgeStore.getState()
    forge.start(84)

    expect(forge.submitDivisor(12)).toBe(true)
    expect(useFactorForgeStore.getState().selectedNodeId).not.toBeNull()
    expect(forge.submitDivisor(3)).toBe(true)
    expect(forge.submitDivisor(2)).toBe(true)

    const finished = useFactorForgeStore.getState()
    const progression = useProgressionStore.getState()

    expect(finished.phase).toBe('complete')
    expect(finished.result?.equation).toBe('84 = 2² × 3 × 7')
    expect(finished.result?.steps).toBe(3)
    expect(progression.factorCompletions).toBe(1)
    expect(progression.xp).toBe(finished.result?.xp)
    expect(progression.achievements['factor-apprentice'].unlocked).toBe(true)
  })

  it('keeps the selected crystal intact after an invalid divisor', () => {
    const forge = useFactorForgeStore.getState()
    forge.start(60)

    expect(forge.submitDivisor(7)).toBe(false)
    const state = useFactorForgeStore.getState()

    expect(state.phase).toBe('playing')
    expect(state.nodes).toHaveLength(1)
    expect(state.steps).toBe(0)
    expect(state.invalidAttempts).toBe(1)
    expect(state.feedback?.kind).toBe('error')
  })
})

