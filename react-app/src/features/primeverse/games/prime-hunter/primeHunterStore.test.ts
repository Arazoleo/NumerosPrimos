import { beforeEach, describe, expect, it } from 'vitest'
import { getHunterDifficulty } from './difficulty'
import { HUNTER_TARGET_HITS, usePrimeHunterStore } from './primeHunterStore'

describe('Prime Hunter gameplay state', () => {
  beforeEach(() => {
    usePrimeHunterStore.getState().resetToReady()
    usePrimeHunterStore.getState().start()
  })

  it('rewards consecutive primes and tracks combo', () => {
    const hunter = usePrimeHunterStore.getState()
    hunter.hitPrime(11)
    hunter.hitPrime(17)

    const state = usePrimeHunterStore.getState()
    expect(state.hits).toBe(2)
    expect(state.combo).toBe(2)
    expect(state.bestCombo).toBe(2)
    expect(state.score).toBeGreaterThan(200)
  })

  it('shows the mathematical decomposition after a composite hit', () => {
    usePrimeHunterStore.getState().hitComposite(21)
    const state = usePrimeHunterStore.getState()

    expect(state.health).toBe(2)
    expect(state.errors).toBe(1)
    expect(state.feedback?.detail).toBe('21 = 3 × 7')
  })

  it('completes the sector after the target number of prime hits', () => {
    const hunter = usePrimeHunterStore.getState()
    for (let index = 0; index < HUNTER_TARGET_HITS; index += 1) hunter.hitPrime(13)

    expect(usePrimeHunterStore.getState()).toMatchObject({
      status: 'results',
      outcome: 'sector-cleared',
      hits: HUNTER_TARGET_HITS,
    })
  })

  it('ends the run when three prime breaches drain the ship', () => {
    const hunter = usePrimeHunterStore.getState()
    hunter.breachPrime(5)
    hunter.breachPrime(7)
    hunter.breachPrime(11)

    expect(usePrimeHunterStore.getState()).toMatchObject({ status: 'results', outcome: 'ship-lost', health: 0 })
  })
})

describe('Prime Hunter procedural difficulty', () => {
  it('advances through bounded stages using score or elapsed time', () => {
    expect(getHunterDifficulty(0, 0).stage).toBe(0)
    expect(getHunterDifficulty(900, 0).stage).toBe(1)
    expect(getHunterDifficulty(0, 70).stage).toBe(2)
    expect(getHunterDifficulty(50_000, 999).stage).toBe(3)
    expect(getHunterDifficulty(50_000, 999).spawnInterval).toBeGreaterThan(0)
  })
})
