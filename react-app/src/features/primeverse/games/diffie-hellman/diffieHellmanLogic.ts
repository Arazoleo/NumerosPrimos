import { isPrime } from '../../../../lib/math'

import type {
  DiffieHellmanChallenge,
  PowerTraceStep,
} from './types'

export const DIFFIE_HELLMAN_ROUNDS = 4
export const DIFFIE_HELLMAN_MISTAKE_PENALTY = 90
export const DIFFIE_HELLMAN_MAX_TIME_BONUS = 1_200
export const DIFFIE_HELLMAN_TIME_STEP_MS = 10_000
export const DIFFIE_HELLMAN_TIME_STEP_PENALTY = 40

export const PUBLIC_STAGE_POINTS = [350, 450, 550, 650] as const
export const SECRET_STAGE_POINTS = [650, 800, 950, 1_100] as const

export const DIFFIE_HELLMAN_CHALLENGES: readonly DiffieHellmanChallenge[] = [
  {
    id: 'handshake',
    round: 1,
    title: 'Primeiro contato',
    payload: 'HELLO',
    prime: 5,
    generator: 2,
    bobPrivate: 3,
    bobPublic: 3,
    privateOptions: [2, 3],
  },
  {
    id: 'coordinates',
    round: 2,
    title: 'Coordenadas',
    payload: 'ORBIT-7',
    prime: 7,
    generator: 3,
    bobPrivate: 5,
    bobPublic: 5,
    privateOptions: [2, 3, 4],
  },
  {
    id: 'archive-key',
    round: 3,
    title: 'Chave do arquivo',
    payload: 'PRIME-11',
    prime: 11,
    generator: 2,
    bobPrivate: 7,
    bobPublic: 7,
    privateOptions: [2, 3, 4],
  },
  {
    id: 'deep-signal',
    round: 4,
    title: 'Sinal profundo',
    payload: 'THETA-13',
    prime: 13,
    generator: 2,
    bobPrivate: 7,
    bobPublic: 11,
    privateOptions: [3, 4, 5],
  },
] as const

function requireSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be a safe integer`)
  }
}

/** Fast modular exponentiation using BigInt avoids intermediate overflow. */
export function modularPower(
  base: number,
  exponent: number,
  modulus: number,
): number {
  requireSafeInteger(base, 'base')
  requireSafeInteger(exponent, 'exponent')
  requireSafeInteger(modulus, 'modulus')
  if (exponent < 0) throw new RangeError('exponent must be non-negative')
  if (modulus <= 1) throw new RangeError('modulus must be greater than one')

  const bigModulus = BigInt(modulus)
  let factor = ((BigInt(base) % bigModulus) + bigModulus) % bigModulus
  let power = BigInt(exponent)
  let result = 1n

  while (power > 0n) {
    if (power % 2n === 1n) result = (result * factor) % bigModulus
    factor = (factor * factor) % bigModulus
    power /= 2n
  }

  return Number(result % bigModulus)
}

export function createPowerTrace(
  base: number,
  exponent: number,
  modulus: number,
): readonly PowerTraceStep[] {
  requireSafeInteger(exponent, 'exponent')
  if (exponent < 1 || exponent > 32) {
    throw new RangeError('trace exponent must be between 1 and 32')
  }
  if (!Number.isSafeInteger(modulus) || modulus <= 1) {
    throw new RangeError('modulus must be a safe integer greater than one')
  }

  const steps: PowerTraceStep[] = []
  for (let multiplication = 1; multiplication <= exponent; multiplication += 1) {
    const residue = modularPower(base, multiplication, modulus)
    steps.push({ multiplication, residue })
  }
  return steps
}

export function calculatePublicValue(
  challenge: DiffieHellmanChallenge,
  privateExponent: number,
): number {
  return modularPower(challenge.generator, privateExponent, challenge.prime)
}

export function calculateSharedSecret(
  challenge: DiffieHellmanChallenge,
  privateExponent: number,
): number {
  return modularPower(challenge.bobPublic, privateExponent, challenge.prime)
}

export function calculateBobSharedSecret(
  challenge: DiffieHellmanChallenge,
  alicePublic: number,
): number {
  return modularPower(alicePublic, challenge.bobPrivate, challenge.prime)
}

export function parseRelayAnswer(
  raw: string,
  modulus: number,
): number | null {
  const trimmed = raw.trim()
  if (!/^(0|[1-9]\d*)$/.test(trimmed)) return null
  const value = Number(trimmed)
  if (!Number.isSafeInteger(value) || value < 0 || value >= modulus) return null
  return value
}

export function isValidChallenge(
  challenge: DiffieHellmanChallenge,
): boolean {
  if (
    !Number.isSafeInteger(challenge.prime) ||
    !Number.isSafeInteger(challenge.generator) ||
    !Number.isSafeInteger(challenge.bobPrivate) ||
    !Number.isSafeInteger(challenge.bobPublic) ||
    !isPrime(challenge.prime) ||
    challenge.generator <= 1 ||
    challenge.generator >= challenge.prime ||
    challenge.bobPrivate <= 1 ||
    challenge.bobPrivate >= challenge.prime - 1 ||
    challenge.bobPublic <= 1 ||
    challenge.privateOptions.length < 2 ||
    new Set(challenge.privateOptions).size !== challenge.privateOptions.length ||
    challenge.privateOptions.some(
      (option) =>
        !Number.isSafeInteger(option) ||
        option <= 1 ||
        option >= challenge.prime - 1 ||
        calculatePublicValue(challenge, option) <= 1 ||
        calculateSharedSecret(challenge, option) <= 1,
    )
  ) {
    return false
  }

  return challenge.bobPublic === modularPower(
    challenge.generator,
    challenge.bobPrivate,
    challenge.prime,
  )
}

export function calculateTimeBonus(elapsedMs: number): number {
  const elapsedSteps = Math.floor(Math.max(0, elapsedMs) / DIFFIE_HELLMAN_TIME_STEP_MS)
  return Math.max(
    0,
    DIFFIE_HELLMAN_MAX_TIME_BONUS - elapsedSteps * DIFFIE_HELLMAN_TIME_STEP_PENALTY,
  )
}

export function calculateDiffieHellmanXp(
  score: number,
  mistakes: number,
): number {
  return Math.max(80, Math.round(score / 24) + (mistakes === 0 ? 90 : 0))
}

export function cloneChallenges(): readonly DiffieHellmanChallenge[] {
  if (
    DIFFIE_HELLMAN_CHALLENGES.length !== DIFFIE_HELLMAN_ROUNDS ||
    DIFFIE_HELLMAN_CHALLENGES.some(
      (challenge, index) => challenge.round !== index + 1 || !isValidChallenge(challenge),
    )
  ) {
    throw new Error('Diffie-Hellman Relay requires four valid ordered challenges')
  }

  return DIFFIE_HELLMAN_CHALLENGES.map((challenge) => ({
    ...challenge,
    privateOptions: [...challenge.privateOptions],
  }))
}
