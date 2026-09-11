function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`)
  }
}

function assertModulus(modulus: number): void {
  if (!Number.isSafeInteger(modulus) || modulus < 1) {
    throw new RangeError('modulus must be a positive safe integer')
  }
}

/** Returns the canonical residue in the interval [0, modulus). */
export function mod(value: number, modulus: number): number {
  assertSafeInteger(value, 'value')
  assertModulus(modulus)

  const remainder = value % modulus
  if (remainder === 0) return 0
  return remainder < 0 ? remainder + modulus : remainder
}

/** Returns the non-negative greatest common divisor of two safe integers. */
export function gcd(left: number, right: number): number {
  assertSafeInteger(left, 'left')
  assertSafeInteger(right, 'right')

  let dividend = Math.abs(left)
  let divisor = Math.abs(right)

  while (divisor !== 0) {
    const remainder = dividend % divisor
    dividend = divisor
    divisor = remainder
  }

  return dividend
}

/**
 * Returns how many additions of `step` are needed for an orbit to repeat.
 * A zero step therefore has period one, while a coprime step visits every
 * residue modulo `modulus`.
 */
export function orbitPeriod(step: number, modulus: number): number {
  assertSafeInteger(step, 'step')
  assertModulus(modulus)

  return modulus / gcd(mod(step, modulus), modulus)
}

function addResidues(left: number, right: number, modulus: number): number {
  if (right === 0) {
    return left
  }

  // Both operands are canonical residues. This form avoids overflowing the
  // safe-integer range when the modulus itself is close to MAX_SAFE_INTEGER.
  const distanceToWrap = modulus - right
  return left >= distanceToWrap ? left - distanceToWrap : left + right
}

/**
 * Traces one complete additive orbit, including its normalized start and
 * stopping immediately before that residue would repeat.
 */
export function traceOrbit(
  start: number,
  step: number,
  modulus: number,
): number[] {
  const normalizedStart = mod(start, modulus)
  const normalizedStep = mod(step, modulus)
  const period = orbitPeriod(normalizedStep, modulus)
  const residues = new Array<number>(period)
  let current = normalizedStart

  for (let index = 0; index < period; index += 1) {
    residues[index] = current
    current = addResidues(current, normalizedStep, modulus)
  }

  return residues
}

function extendedGcd(
  left: bigint,
  right: bigint,
): { readonly gcd: bigint; readonly coefficient: bigint } {
  let oldRemainder = left
  let remainder = right
  let oldCoefficient = 1n
  let coefficient = 0n

  while (remainder !== 0n) {
    const quotient = oldRemainder / remainder

    ;[oldRemainder, remainder] = [
      remainder,
      oldRemainder - quotient * remainder,
    ]
    ;[oldCoefficient, coefficient] = [
      coefficient,
      oldCoefficient - quotient * coefficient,
    ]
  }

  return { gcd: oldRemainder, coefficient: oldCoefficient }
}

/**
 * Finds the smallest k >= 0 satisfying
 * `start + k * step ≡ target (mod modulus)`, or null when unreachable.
 */
export function solveOrbit(
  start: number,
  step: number,
  target: number,
  modulus: number,
): number | null {
  const normalizedStart = mod(start, modulus)
  const normalizedStep = mod(step, modulus)
  const normalizedTarget = mod(target, modulus)
  const difference = mod(normalizedTarget - normalizedStart, modulus)

  if (difference === 0) {
    return 0
  }

  const commonDivisor = gcd(normalizedStep, modulus)

  if (difference % commonDivisor !== 0) {
    return null
  }

  const reducedStep = BigInt(normalizedStep / commonDivisor)
  const reducedDifference = BigInt(difference / commonDivisor)
  const reducedModulus = BigInt(modulus / commonDivisor)
  const { gcd: reducedGcd, coefficient } = extendedGcd(
    reducedStep,
    reducedModulus,
  )

  // Dividing by the common divisor above guarantees coprime operands.
  if (reducedGcd !== 1n) {
    return null
  }

  const inverse = ((coefficient % reducedModulus) + reducedModulus) % reducedModulus
  const solution = (reducedDifference * inverse) % reducedModulus

  return Number(solution)
}
