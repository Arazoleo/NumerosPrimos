/**
 * Returns whether `value` is a prime number.
 *
 * Values outside the positive safe-integer domain are not prime. Returning
 * `false` for those values keeps this predicate convenient at UI boundaries.
 */
export function isPrime(value: number): boolean {
  if (!Number.isSafeInteger(value) || value < 2) {
    return false
  }

  if (value === 2 || value === 3) {
    return true
  }

  if (value % 2 === 0 || value % 3 === 0) {
    return false
  }

  for (let divisor = 5; divisor <= value / divisor; divisor += 6) {
    if (value % divisor === 0 || value % (divisor + 2) === 0) {
      return false
    }
  }

  return true
}
