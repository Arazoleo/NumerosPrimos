import { describe, expect, it } from 'vitest'

import {
  CAESAR_ALPHABET_SIZE,
  CAESAR_PUZZLE,
  decodeCaesar,
  encodeCaesar,
  evaluateCaesarShift,
  normalizeCaesarShift,
} from './caesarLogic'

describe('Crypto Escape Caesar cipher logic', () => {
  it('ships a coherent curated puzzle', () => {
    expect(CAESAR_ALPHABET_SIZE).toBe(26)
    expect(CAESAR_PUZZLE).toEqual({
      ciphertext: 'SULPR',
      plaintext: 'PRIMO',
      shift: 3,
    })
    expect(encodeCaesar(CAESAR_PUZZLE.plaintext, CAESAR_PUZZLE.shift)).toBe(
      CAESAR_PUZZLE.ciphertext,
    )
    expect(decodeCaesar(CAESAR_PUZZLE.ciphertext, CAESAR_PUZZLE.shift)).toBe(
      CAESAR_PUZZLE.plaintext,
    )
  })

  it('normalizes positive and negative shifts to the range from 0 to 25', () => {
    expect(normalizeCaesarShift(0)).toBe(0)
    expect(normalizeCaesarShift(25)).toBe(25)
    expect(normalizeCaesarShift(26)).toBe(0)
    expect(normalizeCaesarShift(29)).toBe(3)
    expect(normalizeCaesarShift(-1)).toBe(25)
    expect(normalizeCaesarShift(-26)).toBe(0)
    expect(normalizeCaesarShift(-29)).toBe(23)
  })

  it('rejects shifts that cannot represent discrete safe rotations', () => {
    expect(() => normalizeCaesarShift(1.5)).toThrow(RangeError)
    expect(() => normalizeCaesarShift(Number.NaN)).toThrow(RangeError)
    expect(() => normalizeCaesarShift(Number.POSITIVE_INFINITY)).toThrow(
      RangeError,
    )
    expect(() => normalizeCaesarShift(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      RangeError,
    )
  })

  it('encodes with wraparound while preserving case and other characters', () => {
    expect(encodeCaesar('XyZ', 3)).toBe('AbC')
    expect(encodeCaesar('Primo 2: ação!', 3)).toBe('Sulpr 2: dçãr!')
    expect(encodeCaesar('Sem mudança — 123 🔐', 0)).toBe(
      'Sem mudança — 123 🔐',
    )
  })

  it('decodes with wraparound while preserving case and other characters', () => {
    expect(decodeCaesar('AbC', 3)).toBe('XyZ')
    expect(decodeCaesar('Sulpr 2: dçãr!', 3)).toBe('Primo 2: ação!')
    expect(decodeCaesar('ABC xyz', -1)).toBe('BCD yza')
  })

  it('round-trips text for canonical, wrapped and negative shifts', () => {
    const message = 'Enigma #7: Primos, César & RSA!'

    for (const shift of [0, 1, 3, 25, 26, 29, -1, -29]) {
      expect(decodeCaesar(encodeCaesar(message, shift), shift)).toBe(message)
    }
  })

  it('accepts the configured shift and its equivalent rotations', () => {
    expect(evaluateCaesarShift(3)).toEqual({
      guess: 3,
      normalizedShift: 3,
      decodedText: 'PRIMO',
      isCorrect: true,
    })
    expect(evaluateCaesarShift(29)).toEqual({
      guess: 29,
      normalizedShift: 3,
      decodedText: 'PRIMO',
      isCorrect: true,
    })
    expect(evaluateCaesarShift(-23)?.isCorrect).toBe(true)
  })

  it('returns useful feedback for wrong shifts and null for invalid guesses', () => {
    expect(evaluateCaesarShift(2)).toEqual({
      guess: 2,
      normalizedShift: 2,
      decodedText: 'QSJNP',
      isCorrect: false,
    })
    expect(evaluateCaesarShift(3.5)).toBeNull()
    expect(evaluateCaesarShift(Number.NaN)).toBeNull()
    expect(evaluateCaesarShift(Number.MAX_SAFE_INTEGER + 1)).toBeNull()
  })
})
