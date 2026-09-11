function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer`)
  }
}

/**
 * Returns the prime factors of a positive integer in ascending order.
 * Repeated factors are retained, so 84 becomes [2, 2, 3, 7].
 */
export function primeFactorization(value: number): number[] {
  assertPositiveSafeInteger(value, 'value')

  const factors: number[] = []
  let remainder = value

  while (remainder % 2 === 0) {
    factors.push(2)
    remainder /= 2
  }

  for (let divisor = 3; divisor <= remainder / divisor; divisor += 2) {
    while (remainder % divisor === 0) {
      factors.push(divisor)
      remainder /= divisor
    }
  }

  if (remainder > 1) {
    factors.push(remainder)
  }

  return factors
}

/** Returns all positive divisors smaller than `value`, in ascending order. */
export function properDivisors(value: number): number[] {
  assertPositiveSafeInteger(value, 'value')

  if (value === 1) {
    return []
  }

  const lowerDivisors: number[] = [1]
  const upperDivisors: number[] = []

  for (let divisor = 2; divisor <= value / divisor; divisor += 1) {
    if (value % divisor !== 0) {
      continue
    }

    lowerDivisors.push(divisor)
    const pairedDivisor = value / divisor

    if (pairedDivisor !== divisor && pairedDivisor !== value) {
      upperDivisors.push(pairedDivisor)
    }
  }

  upperDivisors.reverse()
  return [...lowerDivisors, ...upperDivisors]
}

/**
 * Checks whether `divisor` can split `value` into two meaningful factors.
 * One and the value itself are deliberately excluded from Factor Forge moves.
 */
export function validateDivisor(value: number, divisor: number): boolean {
  return (
    Number.isSafeInteger(value) &&
    Number.isSafeInteger(divisor) &&
    value > 1 &&
    divisor > 1 &&
    divisor < value &&
    value % divisor === 0
  )
}
