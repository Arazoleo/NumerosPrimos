import { describe, expect, it } from 'vitest'

import { isPrime } from './primes'
import {
  DIFFICULTY_BANDS,
  generateChallengeNumber,
  getDifficultyBand,
  type RandomSource,
} from './challengeGeneration'

function sequenceRandom(values: readonly number[]): RandomSource {
  let index = 0

  return () => {
    const value = values[index]
    index += 1

    if (value === undefined) {
      throw new Error('The deterministic random sequence was exhausted')
    }

    return value
  }
}

describe('difficulty bands', () => {
  it('matches the product progression ranges', () => {
    expect(DIFFICULTY_BANDS.easy).toMatchObject({ min: 2, max: 30 })
    expect(DIFFICULTY_BANDS.medium).toMatchObject({ min: 30, max: 100 })
    expect(DIFFICULTY_BANDS.hard).toMatchObject({ min: 100, max: 500 })
    expect(DIFFICULTY_BANDS.expert).toMatchObject({ min: 500, max: 2_000 })
  })

  it.each([
    [0, 'easy'],
    [0.99, 'easy'],
    [1, 'medium'],
    [2, 'hard'],
    [3, 'expert'],
    [99, 'expert'],
  ] as const)('maps procedural stage %s to %s', (stage, level) => {
    expect(getDifficultyBand(stage).level).toBe(level)
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid procedural stage %s',
    (stage) => {
      expect(() => getDifficultyBand(stage)).toThrow(RangeError)
    },
  )
})

describe('generateChallengeNumber', () => {
  it.each(['easy', 'medium', 'hard', 'expert'] as const)(
    'can deliberately generate a prime in the %s band',
    (difficulty) => {
      const value = generateChallengeNumber(
        difficulty,
        sequenceRandom([0.25, 0.75]),
      )
      const band = DIFFICULTY_BANDS[difficulty]

      expect(isPrime(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(band.min)
      expect(value).toBeLessThanOrEqual(band.max)
    },
  )

  it.each(['easy', 'medium', 'hard', 'expert'] as const)(
    'can deliberately generate a composite in the %s band',
    (difficulty) => {
      const value = generateChallengeNumber(
        difficulty,
        sequenceRandom([0.75, 0.25]),
      )
      const band = DIFFICULTY_BANDS[difficulty]

      expect(isPrime(value)).toBe(false)
      expect(value).toBeGreaterThanOrEqual(band.min)
      expect(value).toBeLessThanOrEqual(band.max)
    },
  )

  it('selects candidate values deterministically with an injected source', () => {
    const firstPrime = generateChallengeNumber('easy', sequenceRandom([0, 0]))
    const lastPrime = generateChallengeNumber(
      'easy',
      sequenceRandom([0, 0.999_999]),
    )
    const firstComposite = generateChallengeNumber(
      'easy',
      sequenceRandom([0.5, 0]),
    )

    expect(firstPrime).toBe(2)
    expect(lastPrime).toBe(29)
    expect(firstComposite).toBe(4)
  })

  it('uses one half of the random interval for each number category', () => {
    expect(isPrime(generateChallengeNumber('easy', sequenceRandom([0.499, 0])))).toBe(
      true,
    )
    expect(isPrime(generateChallengeNumber('easy', sequenceRandom([0.5, 0])))).toBe(
      false,
    )
  })

  it.each([-0.01, 1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects out-of-contract random output %s',
    (randomValue) => {
      expect(() =>
        generateChallengeNumber('easy', () => randomValue),
      ).toThrow(RangeError)
    },
  )
})
