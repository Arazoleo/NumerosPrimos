import { isPrime } from '../../../../lib/math'

/**
 * Enigmas do Grimório. Cada um descreve uma condição e lista *todos* os primos
 * que a satisfazem — qualquer um deles conjura o feitiço. As respostas ficam
 * sempre entre 2 e 47, com no máximo dois algarismos: o desafio é pensar no
 * primo certo, não escrever um número enorme no ar.
 */

export type RiddleTier = 0 | 1 | 2

export interface Riddle {
  readonly key: string
  readonly text: string
  readonly answers: readonly number[]
  readonly tier: RiddleTier
}

export type Random = () => number

const PRIMES = Array.from({ length: 48 }, (_, value) => value).filter(isPrime)

const pick = <T,>(items: readonly T[], random: Random): T => items[Math.floor(random() * items.length) % items.length]

const primesBetween = (low: number, high: number) => PRIMES.filter((value) => value > low && value < high)

const nextPrime = (value: number) => PRIMES.find((prime) => prime > value) as number

const previousPrime = (value: number) => [...PRIMES].reverse().find((prime) => prime < value) as number

const primeFactors = (value: number) => PRIMES.filter((prime) => value % prime === 0)

const ordinal = (n: number) => `${n}º`

type Builder = (random: Random) => Omit<Riddle, 'tier'>

const TIER_0: readonly Builder[] = [
  () => ({ key: 'only-even', text: 'O único primo par', answers: [2] }),
  () => ({ key: 'smallest', text: 'O menor número primo', answers: [2] }),
  () => ({ key: 'below-10', text: 'Qualquer primo menor que 10', answers: primesBetween(0, 10) }),
  () => ({ key: 'odd-below-6', text: 'Um primo ímpar menor que 6', answers: [3, 5] }),
  (random) => {
    const [low, high] = pick([[1, 4], [2, 6], [4, 8], [3, 6], [5, 9], [1, 3]] as const, random)
    return { key: `between-${low}-${high}`, text: `Um primo maior que ${low} e menor que ${high}`, answers: primesBetween(low, high) }
  },
  (random) => {
    const value = pick([2, 3, 5], random)
    return { key: `after-${value}`, text: `O primo que vem logo depois de ${value}`, answers: [nextPrime(value)] }
  },
  (random) => {
    const value = pick([4, 6, 8, 9, 10], random)
    return { key: `before-${value}`, text: `O maior primo menor que ${value}`, answers: [previousPrime(value)] }
  },
  (random) => {
    const value = pick([4, 6, 9, 10, 14, 15, 21, 25, 35, 49], random)
    return { key: `divides-${value}`, text: `Um primo que divide ${value}`, answers: primeFactors(value) }
  },
  (random) => {
    const [a, b] = pick([[1, 1], [1, 2], [2, 3], [3, 4], [1, 4], [2, 5], [4, 3]] as const, random)
    return { key: `sum-${a}-${b}`, text: `${a} + ${b} é primo. Qual é?`, answers: [a + b] }
  },
  (random) => {
    const n = pick([1, 2, 3, 4], random)
    return { key: `nth-${n}`, text: `O ${ordinal(n)} número primo`, answers: [PRIMES[n - 1]] }
  },
]

const TIER_1: readonly Builder[] = [
  (random) => {
    const [low, high] = pick([[10, 14], [10, 20], [12, 18], [14, 20], [20, 30], [18, 24], [24, 30], [8, 12]] as const, random)
    return { key: `between-${low}-${high}`, text: `Um primo entre ${low} e ${high}`, answers: primesBetween(low, high) }
  },
  (random) => {
    const value = pick([7, 11, 13, 17, 19], random)
    return { key: `after-${value}`, text: `O primo que vem logo depois de ${value}`, answers: [nextPrime(value)] }
  },
  (random) => {
    const [value, twin] = pick([[11, 13], [13, 11], [17, 19], [19, 17], [29, 31], [31, 29]] as const, random)
    return { key: `twin-${value}`, text: `O primo gêmeo de ${value} (diferença 2)`, answers: [twin] }
  },
  (random) => {
    const value = pick([22, 26, 33, 34, 38, 39, 46, 55, 65, 77], random)
    return { key: `divides-${value}`, text: `Um primo que divide ${value}`, answers: primeFactors(value) }
  },
  (random) => {
    const digit = pick([1, 3, 7, 9], random)
    return {
      key: `ends-${digit}`,
      text: `Um primo menor que 30 terminado em ${digit}`,
      answers: PRIMES.filter((prime) => prime < 30 && prime % 10 === digit),
    }
  },
  (random) => {
    const n = pick([5, 6, 7, 8], random)
    return { key: `nth-${n}`, text: `O ${ordinal(n)} número primo`, answers: [PRIMES[n - 1]] }
  },
  () => ({ key: 'teen', text: 'Um primo entre 10 e 20', answers: primesBetween(10, 20) }),
]

const TIER_2: readonly Builder[] = [
  (random) => {
    const [low, high] = pick([[30, 40], [40, 47], [20, 30], [30, 38], [36, 44]] as const, random)
    return { key: `between-${low}-${high}`, text: `Um primo entre ${low} e ${high}`, answers: primesBetween(low, high) }
  },
  (random) => {
    const value = pick([23, 29, 31, 37], random)
    return { key: `after-${value}`, text: `O primo que vem logo depois de ${value}`, answers: [nextPrime(value)] }
  },
  (random) => {
    const [a, b] = pick([[10, 7], [20, 3], [30, 1], [8, 9], [12, 11], [20, 9], [30, 7]] as const, random)
    return { key: `sum-${a}-${b}`, text: `${a} + ${b} é primo. Qual é?`, answers: [a + b] }
  },
  (random) => {
    const value = pick([58, 62, 69, 74, 82, 86, 87, 93, 94], random)
    const factors = primeFactors(value).filter((prime) => prime > 2 || value % 2 === 0)
    return { key: `divides-${value}`, text: `Um primo que divide ${value}`, answers: factors }
  },
  (random) => {
    const n = pick([9, 10, 11, 12], random)
    return { key: `nth-${n}`, text: `O ${ordinal(n)} número primo`, answers: [PRIMES[n - 1]] }
  },
]

const POOLS: Record<RiddleTier, readonly Builder[]> = { 0: TIER_0, 1: TIER_1, 2: TIER_2 }

/** Nível do enigma conforme o avanço na partida: começa só com primos de um algarismo. */
export function tierForRound(round: number): RiddleTier {
  if (round < 4) return 0
  if (round < 9) return 1
  return 2
}

export function generateRiddle(tier: RiddleTier, random: Random = Math.random, avoidKeys: readonly string[] = []): Riddle {
  const pool = POOLS[tier]
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const riddle = pick(pool, random)(random)
    if (!avoidKeys.includes(riddle.key) && riddle.answers.length > 0) return { ...riddle, tier }
  }
  return { ...pick(pool, random)(random), tier }
}

export function isAnswer(riddle: Riddle, value: number): boolean {
  return riddle.answers.includes(value)
}

/**
 * Decide se já dá para conjurar com os algarismos escritos até agora.
 * Lança na hora quando nenhuma resposta válida começa com esse prefixo e tem
 * mais algarismos — assim "7" sai imediatamente, mas "1" espera um segundo
 * algarismo quando a resposta pode ser 11, 13, 17 ou 19.
 */
export function shouldCastImmediately(riddle: Riddle, digits: readonly number[]): boolean {
  if (digits.length === 0) return false
  if (digits.length >= 2) return true
  const prefix = digits.join('')
  return !riddle.answers.some((answer) => {
    const text = String(answer)
    return text.length > prefix.length && text.startsWith(prefix)
  })
}

export function digitsToNumber(digits: readonly number[]): number {
  return digits.reduce((value, digit) => value * 10 + digit, 0)
}
