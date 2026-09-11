export const CAESAR_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Item id of the cipher disc hidden in the Yellow Offices drawers. */
export const CAESAR_DISC_ID = 'caesar-disc'

export function normalizeShift(shift: number): number {
  if (!Number.isFinite(shift)) return 0
  return ((Math.round(shift) % 26) + 26) % 26
}

/**
 * Rotates letters by `shift`, leaving everything else (spaces, digits, punctuation)
 * untouched. Negative shifts decode; the disc UI always works in decode direction.
 */
export function shiftText(text: string, shift: number): string {
  const offset = normalizeShift(shift)
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split('')
    .map((character) => {
      const index = CAESAR_ALPHABET.indexOf(character)
      if (index < 0) return character
      return CAESAR_ALPHABET[(index + offset) % 26]
    })
    .join('')
}

/** The inner ring letter currently lined up with an outer ring letter. */
export function discPairs(shift: number): readonly (readonly [string, string])[] {
  const offset = normalizeShift(shift)
  return CAESAR_ALPHABET.split('').map((letter, index) => [
    letter,
    CAESAR_ALPHABET[(index + offset) % 26],
  ] as const)
}

/** Decoding is the inverse rotation of encoding: shift 3 encodes, 23 decodes. */
export function decodeWithDisc(cipher: string, shift: number): string {
  return shiftText(cipher, 26 - normalizeShift(shift))
}
