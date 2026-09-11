import { describe, expect, it } from 'vitest'

import {
  calculateEscapeScore,
  calculateEscapeXp,
  calculateExplorationScore,
  createInspection,
  ESCAPE_MAX_TIME_BONUS,
  ESCAPE_MISTAKE_PENALTY,
  ESCAPE_PERFECT_BONUS,
  ESCAPE_STAGE_POINTS,
  evaluateModularLock,
  getInteractableAvailability,
  MODULAR_LOCK,
  parseIntegerInput,
  PRIME_BOX_TARGET,
  rotatePrimeRing,
  RSA_VAULT,
  solveModularLock,
  validatePrimeBox,
  validateRsaVault,
} from './escapeLogic'
import type { EscapeProgress } from './types'

const EMPTY_PROGRESS: EscapeProgress = {
  lensCollected: false,
  primeBoxSolved: false,
  caesarRotorCollected: false,
  caesarSolved: false,
  modularSolved: false,
  clueRevealed: false,
  rsaSolved: false,
}

describe('Crypto Escape pure logic', () => {
  it('rotates decimal rings in both directions with wraparound', () => {
    expect(rotatePrimeRing(9)).toBe(0)
    expect(rotatePrimeRing(0, -1)).toBe(9)
    expect(rotatePrimeRing(4, 1)).toBe(5)
    expect(() => rotatePrimeRing(10)).toThrow(RangeError)
  })

  it('accepts only the ordered 2, 3, 5, 7 prime-box combination', () => {
    expect(validatePrimeBox(PRIME_BOX_TARGET)).toBe(true)
    expect(validatePrimeBox([2, 3, 7, 5])).toBe(false)
    expect(validatePrimeBox([2, 3, 5])).toBe(false)
    expect(validatePrimeBox([2, 3, 5, 7, 11])).toBe(false)
  })

  it('solves the configured modular lock with the minimal k', () => {
    expect(solveModularLock()).toBe(4)
    expect(MODULAR_LOCK.solution).toBe(4)
    expect(evaluateModularLock(4)).toEqual({
      guess: 4,
      residue: 3,
      reachesTarget: true,
      isMinimal: true,
      isCorrect: true,
    })

    expect(evaluateModularLock(16)).toMatchObject({
      residue: 3,
      reachesTarget: true,
      isMinimal: false,
      isCorrect: false,
    })
    expect(evaluateModularLock(3.5)).toBeNull()
    expect(evaluateModularLock(-1)).toBeNull()
    expect(evaluateModularLock(Number.MAX_SAFE_INTEGER)?.residue).toBe(6)
  })

  it('validates both RSA factor orders and the minimal private exponent', () => {
    expect(validateRsaVault({ p: 11, q: 17, d: 23 })).toEqual({
      factorsCorrect: true,
      totient: 160,
      inverseCorrect: true,
      isCorrect: true,
    })
    expect(validateRsaVault({ p: 17, q: 11, d: 23 }).isCorrect).toBe(true)
    expect(validateRsaVault({ p: 11, q: 17, d: 183 })).toMatchObject({
      factorsCorrect: true,
      inverseCorrect: false,
      isCorrect: false,
    })
    expect(validateRsaVault({ p: 1, q: 187, d: 23 })).toMatchObject({
      factorsCorrect: false,
      totient: null,
      isCorrect: false,
    })
    expect(
      validateRsaVault({
        p: Number.MAX_SAFE_INTEGER,
        q: Number.MAX_SAFE_INTEGER,
        d: 23,
      }).isCorrect,
    ).toBe(false)
    expect(RSA_VAULT.publicExponent * RSA_VAULT.privateExponent % RSA_VAULT.totient).toBe(1)
  })

  it('parses strict safe integers at the form boundary', () => {
    expect(parseIntegerInput(' 023 ')).toBe(23)
    expect(parseIntegerInput('-4')).toBe(-4)
    expect(parseIntegerInput('')).toBeNull()
    expect(parseIntegerInput('2.3')).toBeNull()
    expect(parseIntegerInput('1e2')).toBeNull()
    expect(parseIntegerInput('999999999999999999999')).toBeNull()
  })

  it('unlocks interactables in narrative order, including the hidden plaque', () => {
    expect(getInteractableAvailability('lens', EMPTY_PROGRESS)).toBe('available')
    expect(getInteractableAvailability('prime-box', EMPTY_PROGRESS)).toBe('locked')
    expect(getInteractableAvailability('hidden-plaque', EMPTY_PROGRESS)).toBe('locked')
    expect(getInteractableAvailability('rsa-vault', EMPTY_PROGRESS)).toBe('locked')

    const lensProgress = { ...EMPTY_PROGRESS, lensCollected: true }
    expect(getInteractableAvailability('lens', lensProgress)).toBe('solved')
    expect(getInteractableAvailability('prime-box', lensProgress)).toBe('available')

    const boxProgress = { ...lensProgress, primeBoxSolved: true }
    expect(getInteractableAvailability('caesar-console', boxProgress)).toBe('locked')
    const rotorProgress = { ...boxProgress, caesarRotorCollected: true }
    expect(getInteractableAvailability('caesar-console', rotorProgress)).toBe('available')
    expect(getInteractableAvailability('modular-console', boxProgress)).toBe('locked')

    const caesarProgress = { ...rotorProgress, caesarSolved: true }
    expect(getInteractableAvailability('caesar-console', caesarProgress)).toBe('solved')
    expect(getInteractableAvailability('modular-console', caesarProgress)).toBe('available')

    const modularProgress = { ...caesarProgress, modularSolved: true }
    expect(getInteractableAvailability('hidden-plaque', modularProgress)).toBe('available')
    expect(getInteractableAvailability('rsa-vault', modularProgress)).toBe('locked')

    const clueProgress = { ...modularProgress, clueRevealed: true }
    expect(getInteractableAvailability('hidden-plaque', clueProgress)).toBe('solved')
    expect(getInteractableAvailability('rsa-vault', clueProgress)).toBe('available')

    const completedProgress = { ...clueProgress, rsaSolved: true }
    expect(getInteractableAvailability('exit-door', completedProgress)).toBe('available')
  })

  it('creates clue copy without revealing the RSA answers', () => {
    const inspection = createInspection('hidden-plaque', 'clue')
    expect(inspection.description).toContain('N = 187')
    expect(inspection.description).toContain('φ(N) = 160')
    expect(inspection.description).not.toContain('11')
    expect(inspection.description).not.toContain('17')
    expect(inspection.description).not.toContain('23')
  })

  it('rewards fast, precise escapes and penalizes mistakes', () => {
    const baseScore = Object.values(ESCAPE_STAGE_POINTS).reduce(
      (total, points) => total + points,
      0,
    )
    const perfect = calculateEscapeScore({ mistakes: 0, elapsedMs: 0 })
    const imperfect = calculateEscapeScore({ mistakes: 1, elapsedMs: 0 })
    const slow = calculateEscapeScore({ mistakes: 0, elapsedMs: 600_000 })

    expect(perfect).toBe(
      baseScore + ESCAPE_MAX_TIME_BONUS + ESCAPE_PERFECT_BONUS,
    )
    expect(imperfect).toBe(
      baseScore + ESCAPE_MAX_TIME_BONUS - ESCAPE_MISTAKE_PENALTY,
    )
    expect(perfect).toBeGreaterThan(imperfect)
    expect(perfect).toBeGreaterThan(slow)
    expect(calculateEscapeXp(perfect, 0)).toBeGreaterThan(
      calculateEscapeXp(imperfect, 1),
    )
  })

  it('derives the live exploration score from immutable progress flags', () => {
    const partial: EscapeProgress = {
      ...EMPTY_PROGRESS,
      lensCollected: true,
      primeBoxSolved: true,
    }
    expect(calculateExplorationScore(partial, 0)).toBe(
      ESCAPE_STAGE_POINTS.lens + ESCAPE_STAGE_POINTS.primeBox,
    )
    expect(calculateExplorationScore(partial, 2)).toBe(
      ESCAPE_STAGE_POINTS.lens +
        ESCAPE_STAGE_POINTS.primeBox -
        ESCAPE_MISTAKE_PENALTY * 2,
    )
    expect(() => calculateExplorationScore(partial, -1)).toThrow(RangeError)
  })
})
