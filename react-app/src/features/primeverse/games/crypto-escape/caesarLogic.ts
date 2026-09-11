export const CAESAR_ALPHABET_SIZE = 26

export const CAESAR_PUZZLE = {
  ciphertext: 'SULPR',
  plaintext: 'PRIMO',
  shift: 3,
} as const

export interface CaesarShiftEvaluation {
  guess: number
  normalizedShift: number
  decodedText: string
  isCorrect: boolean
}

function assertValidShift(shift: number): void {
  if (!Number.isSafeInteger(shift)) {
    throw new RangeError('Caesar shift must be a safe integer')
  }
}

/** Normalizes any safe integer shift to the inclusive range from 0 to 25. */
export function normalizeCaesarShift(shift: number): number {
  assertValidShift(shift)

  return ((shift % CAESAR_ALPHABET_SIZE) + CAESAR_ALPHABET_SIZE) % CAESAR_ALPHABET_SIZE
}

function shiftAsciiLetter(character: string, shift: number): string {
  const code = character.charCodeAt(0)
  const uppercaseA = 65
  const uppercaseZ = 90
  const lowercaseA = 97
  const lowercaseZ = 122

  if (code >= uppercaseA && code <= uppercaseZ) {
    return String.fromCharCode(
      uppercaseA + normalizeCaesarShift(code - uppercaseA + shift),
    )
  }

  if (code >= lowercaseA && code <= lowercaseZ) {
    return String.fromCharCode(
      lowercaseA + normalizeCaesarShift(code - lowercaseA + shift),
    )
  }

  return character
}

/** Encodes ASCII letters while preserving casing and every non-ASCII-letter character. */
export function encodeCaesar(text: string, shift: number): string {
  const normalizedShift = normalizeCaesarShift(shift)

  return Array.from(text, (character) =>
    shiftAsciiLetter(character, normalizedShift),
  ).join('')
}

/** Decodes text produced by a Caesar cipher using the supplied encoding shift. */
export function decodeCaesar(text: string, shift: number): string {
  const normalizedShift = normalizeCaesarShift(shift)

  return Array.from(text, (character) =>
    shiftAsciiLetter(character, -normalizedShift),
  ).join('')
}

/** Evaluates a player's shift without throwing for malformed form input. */
export function evaluateCaesarShift(
  guess: number,
): CaesarShiftEvaluation | null {
  if (!Number.isSafeInteger(guess)) return null

  const normalizedShift = normalizeCaesarShift(guess)
  const decodedText = decodeCaesar(CAESAR_PUZZLE.ciphertext, normalizedShift)

  return {
    guess,
    normalizedShift,
    decodedText,
    isCorrect:
      normalizedShift === CAESAR_PUZZLE.shift &&
      decodedText === CAESAR_PUZZLE.plaintext,
  }
}
