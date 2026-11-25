import { describe, expect, it } from 'vitest'

import { createRng, mulberry32, xmur3 } from './seededRng'

function take(rng: { next(): number }, count: number): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i += 1) out.push(rng.next())
  return out
}

describe('seededRng', () => {
  it('produces an identical sequence for the same string seed', () => {
    const a = take(createRng('skyline-run'), 16)
    const b = take(createRng('skyline-run'), 16)
    expect(a).toEqual(b)
  })

  it('produces an identical sequence for the same numeric seed', () => {
    const a = take(createRng(12345), 16)
    const b = take(createRng(12345), 16)
    expect(a).toEqual(b)
  })

  it('produces different sequences for different seeds', () => {
    const a = take(createRng('seed-a'), 32)
    const b = take(createRng('seed-b'), 32)
    expect(a).not.toEqual(b)
  })

  it('keeps next() outputs within [0, 1)', () => {
    const rng = createRng('range-check')
    for (let i = 0; i < 2000; i += 1) {
      const value = rng.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('respects int bounds [minInclusive, maxExclusive)', () => {
    const rng = createRng('int-check')
    for (let i = 0; i < 2000; i += 1) {
      const value = rng.int(3, 9)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(3)
      expect(value).toBeLessThan(9)
    }
  })

  it('throws when int range is empty', () => {
    const rng = createRng('int-empty')
    expect(() => rng.int(5, 5)).toThrow()
    expect(() => rng.int(5, 4)).toThrow()
  })

  it('respects range bounds [min, max)', () => {
    const rng = createRng('float-range')
    for (let i = 0; i < 2000; i += 1) {
      const value = rng.range(-2.5, 4.25)
      expect(value).toBeGreaterThanOrEqual(-2.5)
      expect(value).toBeLessThan(4.25)
    }
  })

  it('picks only from the supplied list and throws when empty', () => {
    const rng = createRng('pick-check')
    const items = ['a', 'b', 'c', 'd'] as const
    for (let i = 0; i < 500; i += 1) {
      expect(items).toContain(rng.pick(items))
    }
    expect(() => rng.pick([])).toThrow()
  })

  it('xmur3 is deterministic and returns a 32-bit unsigned integer', () => {
    const h1 = xmur3('skyline')
    const h2 = xmur3('skyline')
    expect(h1).toBe(h2)
    expect(h1).toBeGreaterThanOrEqual(0)
    expect(h1).toBeLessThanOrEqual(0xffffffff)
    expect(Number.isInteger(h1)).toBe(true)
    expect(xmur3('skyline')).not.toBe(xmur3('skyliné'))
  })

  it('mulberry32 reproduces the same stream for the same seed', () => {
    const a = take({ next: mulberry32(99) }, 8)
    const b = take({ next: mulberry32(99) }, 8)
    expect(a).toEqual(b)
  })
})
