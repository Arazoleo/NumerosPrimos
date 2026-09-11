import { describe, expect, it } from 'vitest'

import {
  calculateBobSharedSecret,
  calculateDiffieHellmanXp,
  calculatePublicValue,
  calculateSharedSecret,
  calculateTimeBonus,
  cloneChallenges,
  createPowerTrace,
  DIFFIE_HELLMAN_CHALLENGES,
  DIFFIE_HELLMAN_MAX_TIME_BONUS,
  isValidChallenge,
  modularPower,
  parseRelayAnswer,
} from './diffieHellmanLogic'

describe('Diffie-Hellman arithmetic', () => {
  it('uses overflow-safe fast modular exponentiation', () => {
    expect(modularPower(2, 10, 17)).toBe(4)
    expect(modularPower(-2, 3, 5)).toBe(2)
    expect(modularPower(Number.MAX_SAFE_INTEGER - 1, 31, 97)).toBe(55)
  })

  it('rejects unsafe or invalid modular power operands', () => {
    expect(() => modularPower(2, -1, 5)).toThrow(RangeError)
    expect(() => modularPower(2, 3, 1)).toThrow(RangeError)
    expect(() => modularPower(Number.MAX_VALUE, 3, 5)).toThrow(RangeError)
  })

  it('produces a compact repeated-multiplication trace', () => {
    expect(createPowerTrace(3, 4, 7)).toEqual([
      { multiplication: 1, residue: 3 },
      { multiplication: 2, residue: 2 },
      { multiplication: 3, residue: 6 },
      { multiplication: 4, residue: 4 },
    ])
  })

  it('gives Alice and Bob the same secret for every private option', () => {
    cloneChallenges().forEach((challenge) => {
      expect(isValidChallenge(challenge)).toBe(true)
      challenge.privateOptions.forEach((privateExponent) => {
        const alicePublic = calculatePublicValue(challenge, privateExponent)
        expect(alicePublic).toBeGreaterThan(1)
        expect(calculateSharedSecret(challenge, privateExponent)).toBeGreaterThan(1)
        expect(calculateSharedSecret(challenge, privateExponent)).toBe(
          calculateBobSharedSecret(challenge, alicePublic),
        )
      })
    })
  })

  it('keeps every challenge small and progressively ordered', () => {
    expect(DIFFIE_HELLMAN_CHALLENGES).toHaveLength(4)
    expect(DIFFIE_HELLMAN_CHALLENGES.map(({ prime }) => prime)).toEqual([5, 7, 11, 13])
  })

  it('rejects exponents that collapse a public value or shared secret to one', () => {
    const challenge = DIFFIE_HELLMAN_CHALLENGES[0]
    expect(isValidChallenge({ ...challenge, privateOptions: [2, 3, 4] })).toBe(false)
    expect(isValidChallenge({ ...challenge, generator: 2.5 })).toBe(false)
    expect(isValidChallenge({ ...challenge, bobPrivate: Number.MAX_VALUE })).toBe(false)
  })
})

describe('Diffie-Hellman input and rewards', () => {
  it('accepts only canonical residues inside the public range', () => {
    expect(parseRelayAnswer(' 4 ', 7)).toBe(4)
    expect(parseRelayAnswer('', 7)).toBeNull()
    expect(parseRelayAnswer('-1', 7)).toBeNull()
    expect(parseRelayAnswer('07', 11)).toBeNull()
    expect(parseRelayAnswer('7', 7)).toBeNull()
    expect(parseRelayAnswer('2.5', 7)).toBeNull()
  })

  it('applies a bounded time reward and deterministic XP', () => {
    expect(calculateTimeBonus(0)).toBe(DIFFIE_HELLMAN_MAX_TIME_BONUS)
    expect(calculateTimeBonus(999_999)).toBe(0)
    expect(calculateDiffieHellmanXp(4_000, 0)).toBeGreaterThan(
      calculateDiffieHellmanXp(4_000, 2),
    )
  })
})
