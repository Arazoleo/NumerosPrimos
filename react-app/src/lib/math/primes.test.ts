import { describe, expect, it } from 'vitest'

import { isPrime } from './primes'

describe('isPrime', () => {
  it.each([
    -17,
    -1,
    0,
    1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects values outside the prime domain: %s', (value) => {
    expect(isPrime(value)).toBe(false)
  })

  it.each([2, 3, 5, 7, 11, 29, 97, 499, 1_999])(
    'recognizes the prime %i',
    (value) => {
      expect(isPrime(value)).toBe(true)
    },
  )

  it.each([4, 6, 9, 21, 25, 49, 121, 341, 2_000])(
    'rejects the composite %i',
    (value) => {
      expect(isPrime(value)).toBe(false)
    },
  )
})
