import { describe, expect, it } from 'vitest'

import { gcd, mod, orbitPeriod, solveOrbit, traceOrbit } from './modular'

describe('mod', () => {
  it.each([
    [14, 5, 4],
    [-1, 5, 4],
    [-14, 5, 1],
    [-5, 5, 0],
    [0, 7, 0],
    [83, 1, 0],
  ])('normalizes %i modulo %i to %i', (value, modulus, expected) => {
    expect(mod(value, modulus)).toBe(expected)
  })

  it.each([0, -3, 2.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid modulus: %s',
    (modulus) => {
      expect(() => mod(4, modulus)).toThrow(RangeError)
    },
  )

  it.each([1.5, Number.NaN, Number.NEGATIVE_INFINITY])(
    'rejects a non-integer value: %s',
    (value) => {
      expect(() => mod(value, 5)).toThrow(RangeError)
    },
  )
})

describe('gcd', () => {
  it.each([
    [54, 24, 6],
    [-54, 24, 6],
    [54, -24, 6],
    [0, 9, 9],
    [9, 0, 9],
    [0, 0, 0],
    [17, 13, 1],
  ])('returns gcd(%i, %i) = %i', (left, right, expected) => {
    expect(gcd(left, right)).toBe(expected)
  })

  it('rejects operands outside the safe-integer domain', () => {
    expect(() => gcd(1.2, 2)).toThrow(RangeError)
    expect(() => gcd(2, Number.MAX_VALUE)).toThrow(RangeError)
  })
})

describe('orbitPeriod', () => {
  it.each([
    [5, 12, 12],
    [4, 12, 3],
    [-3, 12, 4],
    [0, 12, 1],
    [7, 1, 1],
  ])('finds period %i for step %i modulo %i', (step, modulus, expected) => {
    expect(orbitPeriod(step, modulus)).toBe(expected)
  })
})

describe('traceOrbit', () => {
  it('lists a complete orbit and stops before the start repeats', () => {
    expect(traceOrbit(2, 5, 12)).toEqual([
      2, 7, 0, 5, 10, 3, 8, 1, 6, 11, 4, 9,
    ])
  })

  it('traces a proper subgroup when step and modulus share a divisor', () => {
    expect(traceOrbit(14, 4, 12)).toEqual([2, 6, 10])
  })

  it('supports negative steps and normalizes the start', () => {
    expect(traceOrbit(-1, -3, 12)).toEqual([11, 8, 5, 2])
  })

  it('returns only the start for a stationary orbit or modulus one', () => {
    expect(traceOrbit(8, 0, 12)).toEqual([8])
    expect(traceOrbit(8, 7, 1)).toEqual([0])
  })

  it('contains exactly one period of unique canonical residues', () => {
    for (let modulus = 1; modulus <= 30; modulus += 1) {
      for (let step = -modulus; step <= modulus; step += 1) {
        const orbit = traceOrbit(-7, step, modulus)

        expect(orbit).toHaveLength(orbitPeriod(step, modulus))
        expect(new Set(orbit).size).toBe(orbit.length)
        expect(orbit.every((residue) => residue >= 0 && residue < modulus)).toBe(true)
      }
    }
  })
})

describe('solveOrbit', () => {
  it.each([
    [2, 5, 10, 12, 4],
    [2, 4, 10, 12, 2],
    [11, -3, 5, 12, 2],
    [-1, 5, 4, 7, 1],
    [7, 0, 7, 12, 0],
    [82, 19, -4, 1, 0],
  ])(
    'solves start=%i, step=%i, target=%i (mod %i)',
    (start, step, target, modulus, expected) => {
      expect(solveOrbit(start, step, target, modulus)).toBe(expected)
    },
  )

  it('returns null when the target is outside the additive orbit', () => {
    expect(solveOrbit(2, 4, 9, 12)).toBeNull()
    expect(solveOrbit(3, 0, 8, 12)).toBeNull()
  })

  it('returns the smallest non-negative solution across a broad domain', () => {
    for (let modulus = 1; modulus <= 20; modulus += 1) {
      for (let start = -3; start <= modulus + 2; start += 1) {
        for (let step = -modulus; step <= modulus; step += 1) {
          for (let target = 0; target < modulus; target += 1) {
            const orbit = traceOrbit(start, step, modulus)
            const expected = orbit.indexOf(target)

            expect(solveOrbit(start, step, target, modulus)).toBe(
              expected === -1 ? null : expected,
            )
          }
        }
      }
    }
  })

  it('avoids arithmetic overflow near the safe-integer limit', () => {
    const modulus = Number.MAX_SAFE_INTEGER

    expect(solveOrbit(modulus - 2, 2, 1, modulus)).toBe(4_503_599_627_370_497)
  })
})
