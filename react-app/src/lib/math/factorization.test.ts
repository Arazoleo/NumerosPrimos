import { describe, expect, it } from 'vitest'

import {
  primeFactorization,
  properDivisors,
  validateDivisor,
} from './factorization'
import { isPrime } from './primes'

describe('primeFactorization', () => {
  it.each([
    [1, []],
    [2, [2]],
    [13, [13]],
    [60, [2, 2, 3, 5]],
    [84, [2, 2, 3, 7]],
    [1_024, [2, 2, 2, 2, 2, 2, 2, 2, 2, 2]],
    [1_999, [1_999]],
  ] as const)('factorizes %i', (value, expected) => {
    expect(primeFactorization(value)).toEqual(expected)
  })

  it.each([0, -12, 4.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid value: %s',
    (value) => {
      expect(() => primeFactorization(value)).toThrow(RangeError)
    },
  )

  it('reconstructs every integer in the challenge-number domain', () => {
    for (let value = 1; value <= 2_000; value += 1) {
      const factors = primeFactorization(value)

      expect(factors.every(isPrime)).toBe(true)
      expect(factors.reduce((product, factor) => product * factor, 1)).toBe(value)
      expect(factors).toEqual([...factors].sort((left, right) => left - right))
    }
  })
})

describe('properDivisors', () => {
  it('uses the conventional empty set for one', () => {
    expect(properDivisors(1)).toEqual([])
  })

  it('returns one for a prime number', () => {
    expect(properDivisors(13)).toEqual([1])
  })

  it('returns sorted, unique divisors for a perfect square', () => {
    expect(properDivisors(36)).toEqual([1, 2, 3, 4, 6, 9, 12, 18])
  })

  it('returns every proper divisor of a composite', () => {
    expect(properDivisors(84)).toEqual([
      1, 2, 3, 4, 6, 7, 12, 14, 21, 28, 42,
    ])
  })

  it.each([0, -1, 3.14, Number.NaN])('rejects an invalid value: %s', (value) => {
    expect(() => properDivisors(value)).toThrow(RangeError)
  })

  it('returns exactly the proper divisors across a representative range', () => {
    for (let value = 1; value <= 250; value += 1) {
      const expected = Array.from({ length: Math.max(0, value - 1) }, (_, index) => index + 1)
        .filter((candidate) => value % candidate === 0)

      expect(properDivisors(value)).toEqual(expected)
    }
  })
})

describe('validateDivisor', () => {
  it.each([
    [84, 2],
    [84, 7],
    [84, 12],
    [49, 7],
  ])('accepts %i as a playable divisor of %i', (value, divisor) => {
    expect(validateDivisor(value, divisor)).toBe(true)
  })

  it.each([
    [84, 1],
    [84, 5],
    [84, 84],
    [13, 2],
    [1, 1],
    [84, 2.5],
    [84.5, 2],
    [Number.NaN, 2],
    [84, Number.POSITIVE_INFINITY],
  ])('rejects %s as a playable divisor of %s', (value, divisor) => {
    expect(validateDivisor(value, divisor)).toBe(false)
  })
})
