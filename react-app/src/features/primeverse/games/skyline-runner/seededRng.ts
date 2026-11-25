/**
 * Local, dependency-free seeded PRNG for the procedural world generator.
 *
 * This folder is extracted from the parent monorepo and has no package.json,
 * so we cannot pull a seeded-random library. The generator (worldGen.ts) and
 * the reachability checks must be fully deterministic per seed, so we implement
 * a well-known small-state PRNG locally:
 *
 *  - `xmur3(str)` hashes an arbitrary string into a 32-bit seed. It is the
 *    standard companion hasher for mulberry32 and lets callers pass a readable
 *    seed string (e.g. 'skyline-run-1') instead of a raw integer.
 *  - `mulberry32(seed)` is a fast 32-bit generator returning a float in [0, 1).
 *    It is deterministic, has a 2^32 period and passes basic distribution tests,
 *    which is more than enough for layout jitter here.
 *
 * Neither function allocates or touches global state, so two RNGs created from
 * the same seed produce byte-for-byte identical sequences.
 */

/** Hashes a string into a 32-bit unsigned integer seed (xmur3). */
export function xmur3(str: string): number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  h ^= h >>> 16
  return h >>> 0
}

/** Returns a deterministic generator of floats in [0, 1) from a 32-bit seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A deterministic random-number helper bound to a single seed. */
export interface SeededRng {
  /** Next float in [0, 1). */
  next(): number
  /** Integer in [minInclusive, maxExclusive). Throws if the range is empty. */
  int(minInclusive: number, maxExclusive: number): number
  /** Float in [min, max). */
  range(min: number, max: number): number
  /** Uniformly selects one item. Throws on an empty list. */
  pick<T>(items: readonly T[]): T
}

/**
 * Creates a {@link SeededRng}. A string seed is hashed with {@link xmur3};
 * a numeric seed is used directly (coerced to a 32-bit unsigned integer).
 */
export function createRng(seed: string | number): SeededRng {
  const numericSeed = typeof seed === 'number' ? seed >>> 0 : xmur3(seed)
  const next = mulberry32(numericSeed)
  return {
    next,
    int(minInclusive: number, maxExclusive: number): number {
      if (!(maxExclusive > minInclusive)) {
        throw new Error(`createRng.int requires max > min, got [${minInclusive}, ${maxExclusive})`)
      }
      const span = maxExclusive - minInclusive
      return minInclusive + Math.floor(next() * span)
    },
    range(min: number, max: number): number {
      return min + next() * (max - min)
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error('createRng.pick requires a non-empty list')
      }
      return items[Math.floor(next() * items.length)]
    },
  }
}
