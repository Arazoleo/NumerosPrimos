import { describe, expect, it } from 'vitest'

import {
  calculateRsaStageScore,
  calculateRsaVaultXp,
  decodeRsaBlocks,
  decryptChallengeBlocks,
  encodeRsaMessage,
  evaluateRsaStage,
  greatestCommonDivisor,
  isPrimeBigInt,
  isValidRsaChallenge,
  modularInverse,
  modularPower,
  parseUnsignedBigInt,
  RSA_VAULT_CHALLENGES,
} from './rsaVaultLogic'
import type { RsaVaultInputs } from './types'

const emptyInputs: RsaVaultInputs = {
  p: '',
  q: '',
  totient: '',
  privateExponent: '',
  message: '',
}

describe('RSA Vault mathematics', () => {
  it('computes gcds, primes and modular inverses with exact integers', () => {
    expect(greatestCommonDivisor(-120n, 77n)).toBe(1n)
    expect(greatestCommonDivisor(120n, 84n)).toBe(12n)
    expect(isPrimeBigInt(2n)).toBe(true)
    expect(isPrimeBigInt(143n)).toBe(false)
    expect(isPrimeBigInt(97n)).toBe(true)
    expect(modularInverse(7n, 120n)).toBe(103n)
    expect(modularInverse(6n, 12n)).toBeNull()
  })

  it('uses exponentiation by squaring for values beyond safe Number arithmetic', () => {
    expect(modularPower(2n, 1_000n, 1_000_000_007n)).toBe(688_423_210n)
    expect(modularPower(-2n, 5n, 13n)).toBe(7n)
    expect(() => modularPower(2n, -1n, 5n)).toThrow(RangeError)
    expect(() => modularPower(2n, 3n, 0n)).toThrow(RangeError)
  })

  it('encodes and decodes A1Z26 messages', () => {
    expect(encodeRsaMessage('Prime')).toEqual([16n, 18n, 9n, 13n, 5n])
    expect(decodeRsaBlocks([22n, 1n, 21n, 12n, 20n])).toBe('VAULT')
    expect(decodeRsaBlocks([0n, 27n])).toBe('??')
    expect(() => encodeRsaMessage('RSA 2')).toThrow(RangeError)
  })

  it('ships four internally consistent encrypt/decrypt challenges', () => {
    expect(RSA_VAULT_CHALLENGES).toHaveLength(4)
    for (const challenge of RSA_VAULT_CHALLENGES) {
      expect(isValidRsaChallenge(challenge)).toBe(true)
      expect(decryptChallengeBlocks(challenge)).toEqual(challenge.plaintextBlocks)
      expect(decodeRsaBlocks(decryptChallengeBlocks(challenge))).toBe(challenge.message)
    }
  })

  it('accepts factors in either order and rejects a product-only impostor', () => {
    const challenge = RSA_VAULT_CHALLENGES[2]
    const swapped = evaluateRsaStage(challenge, 'factor', {
      ...emptyInputs,
      p: challenge.primeQ.toString(),
      q: challenge.primeP.toString(),
    })
    expect(swapped.correct).toBe(true)

    const impostor = evaluateRsaStage(RSA_VAULT_CHALLENGES[0], 'factor', {
      ...emptyInputs,
      p: '1',
      q: '15',
    })
    expect(impostor.correct).toBe(false)
  })

  it('validates totient, the canonical positive inverse and the message', () => {
    const challenge = RSA_VAULT_CHALLENGES[1]
    expect(evaluateRsaStage(challenge, 'totient', {
      ...emptyInputs,
      totient: challenge.totient.toString(),
    }).correct).toBe(true)
    expect(evaluateRsaStage(challenge, 'inverse', {
      ...emptyInputs,
      privateExponent: challenge.privateExponent.toString(),
    }).correct).toBe(true)
    expect(evaluateRsaStage(challenge, 'inverse', {
      ...emptyInputs,
      privateExponent: (challenge.privateExponent + challenge.totient).toString(),
    }).correct).toBe(false)
    expect(evaluateRsaStage(challenge, 'decrypt', {
      ...emptyInputs,
      message: ' prime ',
    }).correct).toBe(true)
  })

  it('parses only unsigned decimal integers', () => {
    expect(parseUnsignedBigInt(' 00143 ')).toBe(143n)
    expect(parseUnsignedBigInt('-1')).toBeNull()
    expect(parseUnsignedBigInt('3.5')).toBeNull()
    expect(parseUnsignedBigInt('1e3')).toBeNull()
    expect(parseUnsignedBigInt('1'.repeat(19))).toBeNull()
    expect(parseUnsignedBigInt('')).toBeNull()
  })

  it('rejects repeated primes and degenerate public exponents', () => {
    const base = RSA_VAULT_CHALLENGES[0]
    const repeatedPrime = {
      ...base,
      modulus: 9n,
      primeP: 3n,
      primeQ: 3n,
      totient: 4n,
      publicExponent: 3n,
      privateExponent: 3n,
      message: 'A',
      plaintextBlocks: [1n],
      encryptedBlocks: [1n],
    }
    const identityExponent = {
      ...base,
      publicExponent: 1n,
      privateExponent: 1n,
      encryptedBlocks: base.plaintextBlocks,
    }

    expect(isValidRsaChallenge(repeatedPrime)).toBe(false)
    expect(isValidRsaChallenge(identityExponent)).toBe(false)
  })

  it('rewards precision and validates score inputs', () => {
    expect(calculateRsaStageScore('decrypt', 4, 1)).toBeGreaterThan(
      calculateRsaStageScore('decrypt', 4, 3),
    )
    expect(calculateRsaVaultXp(8_000, 0)).toBeGreaterThan(
      calculateRsaVaultXp(8_000, 2),
    )
    expect(() => calculateRsaStageScore('factor', 0, 1)).toThrow(RangeError)
    expect(() => calculateRsaVaultXp(-1, 0)).toThrow(RangeError)
  })
})
