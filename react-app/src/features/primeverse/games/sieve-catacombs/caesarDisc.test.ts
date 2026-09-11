import { describe, expect, it } from 'vitest'

import {
  CAESAR_ALPHABET,
  decodeWithDisc,
  discPairs,
  normalizeShift,
  shiftText,
} from './caesarDisc'

describe('Cripta do Crivo cipher disc', () => {
  it('encodes and decodes the elevator word with the same disc', () => {
    expect(shiftText('ELEVADOR', 3)).toBe('HOHYDGRU')
    expect(decodeWithDisc('HOHYDGRU', 3)).toBe('ELEVADOR')
    expect(decodeWithDisc('HOHYDGRU', 0)).toBe('HOHYDGRU')
  })

  it('leaves separators alone and folds accents into plain letters', () => {
    expect(shiftText('porta 23!', 1)).toBe('QPSUB 23!')
    expect(shiftText('salão', 0)).toBe('SALAO')
  })

  it('wraps any shift into the 0..25 range', () => {
    expect(normalizeShift(-3)).toBe(23)
    expect(normalizeShift(29)).toBe(3)
    expect(normalizeShift(Number.NaN)).toBe(0)
    expect(shiftText('AZ', 26)).toBe('AZ')
  })

  it('lines the two rings up so every outer letter has one inner partner', () => {
    const pairs = discPairs(3)
    expect(pairs).toHaveLength(26)
    expect(pairs[0]).toEqual(['A', 'D'])
    expect(pairs[25]).toEqual(['Z', 'C'])
    expect(new Set(pairs.map(([, inner]) => inner)).size).toBe(CAESAR_ALPHABET.length)
  })
})
