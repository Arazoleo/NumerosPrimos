import { describe, expect, it } from 'vitest'

import { solveOrbit } from '../../../../lib/math'
import {
  calculateModularOrbitXp,
  calculateOrbitRoundScore,
  createModularOrbitChallenges,
  createSeededOrbitRandom,
  evaluateOrbitGuess,
  isValidOrbitChallenge,
  MAX_ORBIT_PULSES,
  MODULAR_ORBIT_ROUNDS,
  ORBIT_DIFFICULTY_PROFILES,
} from './modularOrbitLogic'
import type { ModularOrbitChallenge } from './types'

const example: ModularOrbitChallenge = {
  id: 'example',
  difficulty: 3,
  modulus: 12,
  start: 2,
  step: 5,
  target: 10,
  solution: 4,
  period: 12,
}

describe('Modular Orbit challenge generation', () => {
  it('creates five reachable challenges with increasing difficulty bands', () => {
    const challenges = createModularOrbitChallenges(
      createSeededOrbitRandom(2_026),
    )

    expect(challenges).toHaveLength(MODULAR_ORBIT_ROUNDS)

    challenges.forEach((challenge, index) => {
      const profile = ORBIT_DIFFICULTY_PROFILES[index]

      expect(challenge.difficulty).toBe(index + 1)
      expect(challenge.modulus).toBeGreaterThanOrEqual(profile.minM)
      expect(challenge.modulus).toBeLessThanOrEqual(profile.maxM)
      expect(challenge.period).toBeGreaterThanOrEqual(profile.minPeriod)
      expect(challenge.solution).toBeGreaterThanOrEqual(profile.minSolution)
      expect(
        solveOrbit(
          challenge.start,
          challenge.step,
          challenge.target,
          challenge.modulus,
        ),
      ).toBe(challenge.solution)
      expect(isValidOrbitChallenge(challenge)).toBe(true)
    })
  })

  it('replays a mission exactly when the same seed is injected', () => {
    const first = createModularOrbitChallenges(createSeededOrbitRandom(42))
    const second = createModularOrbitChallenges(createSeededOrbitRandom(42))
    const different = createModularOrbitChallenges(createSeededOrbitRandom(43))

    expect(first).toEqual(second)
    expect(different).not.toEqual(first)
  })

  it('falls back to a valid sequence when a source repeatedly yields poor steps', () => {
    const challenges = createModularOrbitChallenges(() => 0.5)

    expect(challenges).toHaveLength(5)
    expect(challenges.every(isValidOrbitChallenge)).toBe(true)
  })
})

describe('Modular Orbit launches and rewards', () => {
  it('traces every pulse from the start through the target', () => {
    expect(evaluateOrbitGuess(example, 4)).toEqual({
      pulses: 4,
      trace: [2, 7, 0, 5, 10],
      landing: 10,
      reachesTarget: true,
      isCorrect: true,
    })
  })

  it('distinguishes the minimal solution from an unnecessary extra lap', () => {
    const launch = evaluateOrbitGuess(example, example.solution + example.period)

    expect(launch.landing).toBe(example.target)
    expect(launch.reachesTarget).toBe(true)
    expect(launch.isCorrect).toBe(false)
  })

  it('bounds guesses so animation traces cannot grow indefinitely', () => {
    expect(() => evaluateOrbitGuess(example, -1)).toThrow(RangeError)
    expect(() => evaluateOrbitGuess(example, MAX_ORBIT_PULSES + 1)).toThrow(
      RangeError,
    )
  })

  it('traces a short launch without allocating a huge orbital period', () => {
    const hugeChallenge: ModularOrbitChallenge = {
      id: 'huge-safe-orbit',
      difficulty: 5,
      modulus: 4_294_967_297,
      start: 4_294_967_296,
      step: 2,
      target: 1,
      solution: 1,
      period: 4_294_967_297,
    }

    expect(evaluateOrbitGuess(hugeChallenge, 1).trace).toEqual([
      4_294_967_296,
      1,
    ])
  })

  it('computes deterministic rewards and penalizes extra attempts', () => {
    const perfect = calculateOrbitRoundScore(example, 1)
    const retried = calculateOrbitRoundScore(example, 3)

    expect(calculateOrbitRoundScore(example, 1)).toBe(perfect)
    expect(retried).toBeLessThan(perfect)
    expect(calculateModularOrbitXp(5_000, 0)).toBeGreaterThan(
      calculateModularOrbitXp(5_000, 1),
    )
  })
})
