import { isPrime } from './primes'

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert'

export interface DifficultyBand {
  readonly level: DifficultyLevel
  readonly min: number
  readonly max: number
}

export type RandomSource = () => number

export const DIFFICULTY_BANDS: Readonly<Record<DifficultyLevel, DifficultyBand>> =
  Object.freeze({
    easy: Object.freeze({ level: 'easy', min: 2, max: 30 }),
    medium: Object.freeze({ level: 'medium', min: 30, max: 100 }),
    hard: Object.freeze({ level: 'hard', min: 100, max: 500 }),
    expert: Object.freeze({ level: 'expert', min: 500, max: 2_000 }),
  })

const ORDERED_DIFFICULTIES: readonly DifficultyLevel[] = [
  'easy',
  'medium',
  'hard',
  'expert',
]

export type ChallengeDifficulty = DifficultyLevel | number

/**
 * Resolves a named difficulty or a zero-based procedural difficulty stage.
 * Numeric stages above the available range remain in the expert band.
 */
export function getDifficultyBand(difficulty: ChallengeDifficulty): DifficultyBand {
  if (typeof difficulty === 'string') {
    const band = DIFFICULTY_BANDS[difficulty]

    if (band === undefined) {
      throw new RangeError(`Unknown difficulty: ${difficulty}`)
    }

    return band
  }

  if (!Number.isFinite(difficulty) || difficulty < 0) {
    throw new RangeError('Numeric difficulty must be a finite non-negative number')
  }

  const index = Math.min(
    Math.floor(difficulty),
    ORDERED_DIFFICULTIES.length - 1,
  )

  return DIFFICULTY_BANDS[ORDERED_DIFFICULTIES[index]]
}

function nextRandom(random: RandomSource): number {
  const value = random()

  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('Random source must return a number in the interval [0, 1)')
  }

  return value
}

interface CandidatePools {
  readonly primes: readonly number[]
  readonly composites: readonly number[]
}

function buildCandidatePools(band: DifficultyBand): CandidatePools {
  const primes: number[] = []
  const composites: number[] = []

  for (let value = band.min; value <= band.max; value += 1) {
    const candidates = isPrime(value) ? primes : composites
    candidates.push(value)
  }

  return Object.freeze({
    primes: Object.freeze(primes),
    composites: Object.freeze(composites),
  })
}

const CANDIDATE_POOLS: Readonly<Record<DifficultyLevel, CandidatePools>> =
  Object.freeze({
    easy: buildCandidatePools(DIFFICULTY_BANDS.easy),
    medium: buildCandidatePools(DIFFICULTY_BANDS.medium),
    hard: buildCandidatePools(DIFFICULTY_BANDS.hard),
    expert: buildCandidatePools(DIFFICULTY_BANDS.expert),
  })

/**
 * Generates a number from a difficulty band with an even prime/composite
 * category split. The injected random source makes gameplay simulations and
 * tests reproducible.
 */
export function generateChallengeNumber(
  difficulty: ChallengeDifficulty,
  random: RandomSource = Math.random,
): number {
  const band = getDifficultyBand(difficulty)
  const choosePrime = nextRandom(random) < 0.5
  const pools = CANDIDATE_POOLS[band.level]
  const candidates = choosePrime ? pools.primes : pools.composites

  if (candidates.length === 0) {
    throw new RangeError(
      `Difficulty band ${band.level} has no ${choosePrime ? 'prime' : 'composite'} numbers`,
    )
  }

  const candidateIndex = Math.floor(nextRandom(random) * candidates.length)
  return candidates[candidateIndex]
}
