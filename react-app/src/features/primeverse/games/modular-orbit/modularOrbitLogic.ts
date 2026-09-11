import {
  mod,
  orbitPeriod,
  solveOrbit,
  type RandomSource,
} from '../../../../lib/math'

import type {
  ModularOrbitChallenge,
  OrbitLaunch,
} from './types'

export const MODULAR_ORBIT_ROUNDS = 5
export const MAX_ORBIT_PULSES = 99

interface DifficultyProfile {
  readonly minM: number
  readonly maxM: number
  readonly minPeriod: number
  readonly minSolution: number
}

export const ORBIT_DIFFICULTY_PROFILES: readonly DifficultyProfile[] = [
  { minM: 5, maxM: 6, minPeriod: 4, minSolution: 2 },
  { minM: 7, maxM: 8, minPeriod: 5, minSolution: 2 },
  { minM: 9, maxM: 11, minPeriod: 6, minSolution: 3 },
  { minM: 12, maxM: 14, minPeriod: 7, minSolution: 4 },
  { minM: 15, maxM: 19, minPeriod: 9, minSolution: 5 },
] as const

const FALLBACK_CHALLENGES: readonly ModularOrbitChallenge[] = [
  {
    id: 'orbit-1-5-1-2-0',
    difficulty: 1,
    modulus: 5,
    start: 1,
    step: 2,
    target: 0,
    solution: 2,
    period: 5,
  },
  {
    id: 'orbit-2-7-3-3-5',
    difficulty: 2,
    modulus: 7,
    start: 3,
    step: 3,
    target: 5,
    solution: 3,
    period: 7,
  },
  {
    id: 'orbit-3-11-2-4-7',
    difficulty: 3,
    modulus: 11,
    start: 2,
    step: 4,
    target: 7,
    solution: 4,
    period: 11,
  },
  {
    id: 'orbit-4-13-5-5-9',
    difficulty: 4,
    modulus: 13,
    start: 5,
    step: 5,
    target: 9,
    solution: 6,
    period: 13,
  },
  {
    id: 'orbit-5-17-7-6-4',
    difficulty: 5,
    modulus: 17,
    start: 7,
    step: 6,
    target: 4,
    solution: 8,
    period: 17,
  },
] as const

function randomInteger(random: RandomSource, min: number, max: number): number {
  const sample = random()

  if (!Number.isFinite(sample)) {
    throw new RangeError('random source must return a finite number')
  }

  const fraction = ((sample % 1) + 1) % 1
  return min + Math.floor(fraction * (max - min + 1))
}

export function createSeededOrbitRandom(seed: number): RandomSource {
  if (!Number.isSafeInteger(seed)) {
    throw new RangeError('seed must be a safe integer')
  }

  let state = seed >>> 0

  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function buildChallenge(
  roundIndex: number,
  random: RandomSource,
): ModularOrbitChallenge {
  const profile = ORBIT_DIFFICULTY_PROFILES[roundIndex]
  const difficulty = (roundIndex + 1) as ModularOrbitChallenge['difficulty']

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const modulus = randomInteger(random, profile.minM, profile.maxM)
    const start = randomInteger(random, 0, modulus - 1)
    const step = randomInteger(random, 1, modulus - 1)
    const period = orbitPeriod(step, modulus)

    if (period < profile.minPeriod || period <= profile.minSolution) continue

    const solution = randomInteger(random, profile.minSolution, period - 1)
    const target = mod(start + step * solution, modulus)

    if (solveOrbit(start, step, target, modulus) !== solution) continue

    return {
      id: `orbit-${difficulty}-${modulus}-${start}-${step}-${target}`,
      difficulty,
      modulus,
      start,
      step,
      target,
      solution,
      period,
    }
  }

  return { ...FALLBACK_CHALLENGES[roundIndex] }
}

export function createModularOrbitChallenges(
  random: RandomSource = Math.random,
): ModularOrbitChallenge[] {
  return Array.from({ length: MODULAR_ORBIT_ROUNDS }, (_, roundIndex) =>
    buildChallenge(roundIndex, random),
  )
}

export function isValidOrbitChallenge(
  challenge: ModularOrbitChallenge,
): boolean {
  return (
    Number.isSafeInteger(challenge.modulus) &&
    challenge.modulus > 1 &&
    Number.isSafeInteger(challenge.start) &&
    challenge.start >= 0 &&
    challenge.start < challenge.modulus &&
    Number.isSafeInteger(challenge.step) &&
    challenge.step > 0 &&
    challenge.step < challenge.modulus &&
    Number.isSafeInteger(challenge.target) &&
    challenge.target >= 0 &&
    challenge.target < challenge.modulus &&
    Number.isSafeInteger(challenge.solution) &&
    challenge.solution > 0 &&
    challenge.solution < challenge.period &&
    challenge.period === orbitPeriod(challenge.step, challenge.modulus) &&
    solveOrbit(
      challenge.start,
      challenge.step,
      challenge.target,
      challenge.modulus,
    ) === challenge.solution
  )
}

export function evaluateOrbitGuess(
  challenge: ModularOrbitChallenge,
  pulses: number,
): OrbitLaunch {
  if (
    !Number.isSafeInteger(pulses) ||
    pulses < 0 ||
    pulses > MAX_ORBIT_PULSES
  ) {
    throw new RangeError(
      `pulses must be an integer from 0 to ${MAX_ORBIT_PULSES}`,
    )
  }

  const launchTrace = new Array<number>(pulses + 1)
  const normalizedStep = mod(challenge.step, challenge.modulus)
  let residue = mod(challenge.start, challenge.modulus)

  for (let index = 0; index <= pulses; index += 1) {
    launchTrace[index] = residue
    if (normalizedStep === 0) continue

    const distanceToWrap = challenge.modulus - normalizedStep
    residue = residue >= distanceToWrap
      ? residue - distanceToWrap
      : residue + normalizedStep
  }
  const landing = launchTrace[launchTrace.length - 1]
  const reachesTarget = landing === challenge.target

  return {
    pulses,
    trace: launchTrace,
    landing,
    reachesTarget,
    isCorrect: reachesTarget && pulses === challenge.solution,
  }
}

export function calculateOrbitRoundScore(
  challenge: ModularOrbitChallenge,
  attempts: number,
): number {
  if (!Number.isSafeInteger(attempts) || attempts < 1) {
    throw new RangeError('attempts must be a positive integer')
  }

  const complexity =
    challenge.modulus * 24 +
    challenge.period * 18 +
    challenge.solution * 12 +
    challenge.difficulty * 100
  const precisionBonus = Math.max(0, 420 - (attempts - 1) * 140)

  return 650 + complexity + precisionBonus
}

export function calculateModularOrbitXp(
  score: number,
  mistakes: number,
): number {
  if (!Number.isFinite(score) || score < 0) {
    throw new RangeError('score must be a finite non-negative number')
  }
  if (!Number.isSafeInteger(mistakes) || mistakes < 0) {
    throw new RangeError('mistakes must be a non-negative integer')
  }

  const precisionBonus = mistakes === 0 ? 35 : 0
  return Math.max(50, Math.min(350, Math.round(score / 45) + precisionBonus))
}
