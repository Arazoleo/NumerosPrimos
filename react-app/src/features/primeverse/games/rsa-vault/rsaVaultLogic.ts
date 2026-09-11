import type {
  RsaStage,
  RsaVaultChallenge,
  RsaVaultInputs,
} from './types'

export const RSA_VAULT_COUNT = 4
export const RSA_INPUT_MAX_DIGITS = 18
export const RSA_STAGES: readonly RsaStage[] = [
  'factor',
  'totient',
  'inverse',
  'decrypt',
] as const

export const RSA_STAGE_LABELS: Readonly<Record<RsaStage, string>> = {
  factor: 'Fatorar N',
  totient: 'Calcular φ(N)',
  inverse: 'Encontrar d',
  decrypt: 'Decifrar',
}

const LETTER_A = 'A'.charCodeAt(0)

export function assertNonNegativeBigInt(value: bigint, name: string): void {
  if (value < 0n) throw new RangeError(`${name} must be non-negative`)
}

export function greatestCommonDivisor(a: bigint, b: bigint): bigint {
  let left = a < 0n ? -a : a
  let right = b < 0n ? -b : b

  while (right !== 0n) {
    const remainder = left % right
    left = right
    right = remainder
  }

  return left
}

export function isPrimeBigInt(value: bigint): boolean {
  if (value < 2n) return false
  if (value === 2n) return true
  if (value % 2n === 0n) return false

  for (let divisor = 3n; divisor * divisor <= value; divisor += 2n) {
    if (value % divisor === 0n) return false
  }
  return true
}

export function modularPower(
  base: bigint,
  exponent: bigint,
  modulus: bigint,
): bigint {
  if (modulus <= 0n) throw new RangeError('modulus must be positive')
  assertNonNegativeBigInt(exponent, 'exponent')

  let factor = ((base % modulus) + modulus) % modulus
  let power = exponent
  let result = 1n % modulus

  while (power > 0n) {
    if ((power & 1n) === 1n) result = (result * factor) % modulus
    factor = (factor * factor) % modulus
    power >>= 1n
  }

  return result
}

export function modularInverse(value: bigint, modulus: bigint): bigint | null {
  if (modulus <= 1n) throw new RangeError('modulus must be greater than one')

  let oldRemainder = ((value % modulus) + modulus) % modulus
  let remainder = modulus
  let oldCoefficient = 1n
  let coefficient = 0n

  while (remainder !== 0n) {
    const quotient = oldRemainder / remainder
    ;[oldRemainder, remainder] = [remainder, oldRemainder - quotient * remainder]
    ;[oldCoefficient, coefficient] = [
      coefficient,
      oldCoefficient - quotient * coefficient,
    ]
  }

  if (oldRemainder !== 1n) return null
  return ((oldCoefficient % modulus) + modulus) % modulus
}

export function parseUnsignedBigInt(value: string): bigint | null {
  const normalized = value.trim()
  if (normalized.length > RSA_INPUT_MAX_DIGITS || !/^\d+$/.test(normalized)) return null

  try {
    return BigInt(normalized)
  } catch {
    return null
  }
}

export function encodeRsaMessage(message: string): bigint[] {
  const normalized = normalizeRsaMessage(message)
  if (!normalized || !/^[A-Z]+$/.test(normalized)) {
    throw new RangeError('message must contain letters A-Z')
  }

  return Array.from(normalized, (letter) =>
    BigInt(letter.charCodeAt(0) - LETTER_A + 1),
  )
}

export function decodeRsaBlocks(blocks: readonly bigint[]): string {
  return blocks.map((block) => {
    if (block < 1n || block > 26n) return '?'
    return String.fromCharCode(LETTER_A + Number(block) - 1)
  }).join('')
}

export function normalizeRsaMessage(message: string): string {
  return message.trim().toLocaleUpperCase('pt-BR').replace(/\s+/g, '')
}

interface ChallengeSeed {
  readonly id: string
  readonly level: RsaVaultChallenge['level']
  readonly codename: string
  readonly p: bigint
  readonly q: bigint
  readonly e: bigint
  readonly message: string
}

const CHALLENGE_SEEDS: readonly ChallengeSeed[] = [
  { id: 'vault-gem-15', level: 1, codename: 'BRONZE', p: 3n, q: 5n, e: 3n, message: 'GEM' },
  { id: 'vault-prime-33', level: 2, codename: 'IRÍDIO', p: 3n, q: 11n, e: 3n, message: 'PRIME' },
  { id: 'vault-euler-77', level: 3, codename: 'EULER', p: 7n, q: 11n, e: 7n, message: 'EULER' },
  { id: 'vault-final-143', level: 4, codename: 'OMEGA', p: 11n, q: 13n, e: 7n, message: 'VAULT' },
] as const

function createChallenge(seed: ChallengeSeed): RsaVaultChallenge {
  const modulus = seed.p * seed.q
  const totient = (seed.p - 1n) * (seed.q - 1n)
  const privateExponent = modularInverse(seed.e, totient)

  if (privateExponent === null) {
    throw new Error(`Invalid RSA seed ${seed.id}: e has no inverse`)
  }

  const plaintextBlocks = encodeRsaMessage(seed.message)
  if (plaintextBlocks.some((block) => block >= modulus)) {
    throw new Error(`Invalid RSA seed ${seed.id}: plaintext exceeds modulus`)
  }

  return {
    id: seed.id,
    level: seed.level,
    codename: seed.codename,
    modulus,
    publicExponent: seed.e,
    primeP: seed.p,
    primeQ: seed.q,
    totient,
    privateExponent,
    plaintextBlocks,
    encryptedBlocks: plaintextBlocks.map((block) =>
      modularPower(block, seed.e, modulus),
    ),
    message: seed.message,
  }
}

export const RSA_VAULT_CHALLENGES: readonly RsaVaultChallenge[] =
  CHALLENGE_SEEDS.map(createChallenge)

export function isValidRsaChallenge(challenge: RsaVaultChallenge): boolean {
  if (
    challenge.level < 1 ||
    challenge.level > RSA_VAULT_COUNT ||
    !isPrimeBigInt(challenge.primeP) ||
    !isPrimeBigInt(challenge.primeQ) ||
    challenge.primeP === challenge.primeQ ||
    challenge.primeP * challenge.primeQ !== challenge.modulus ||
    (challenge.primeP - 1n) * (challenge.primeQ - 1n) !== challenge.totient ||
    challenge.publicExponent <= 1n ||
    challenge.publicExponent >= challenge.totient ||
    greatestCommonDivisor(challenge.publicExponent, challenge.totient) !== 1n ||
    (challenge.publicExponent * challenge.privateExponent) % challenge.totient !== 1n ||
    challenge.plaintextBlocks.length !== challenge.encryptedBlocks.length ||
    decodeRsaBlocks(challenge.plaintextBlocks) !== challenge.message
  ) return false

  return challenge.plaintextBlocks.every((plain, index) =>
    modularPower(plain, challenge.publicExponent, challenge.modulus) ===
      challenge.encryptedBlocks[index] &&
    modularPower(
      challenge.encryptedBlocks[index],
      challenge.privateExponent,
      challenge.modulus,
    ) === plain,
  )
}

export interface RsaStageEvaluation {
  readonly correct: boolean
  readonly malformed: boolean
  readonly title: string
  readonly detail: string
}

function error(title: string, detail: string, malformed = false): RsaStageEvaluation {
  return { correct: false, malformed, title, detail }
}

export function evaluateRsaStage(
  challenge: RsaVaultChallenge,
  stage: RsaStage,
  inputs: RsaVaultInputs,
): RsaStageEvaluation {
  if (stage === 'factor') {
    const p = parseUnsignedBigInt(inputs.p)
    const q = parseUnsignedBigInt(inputs.q)
    if (p === null || q === null || p < 2n || q < 2n) {
      return error('Fatores inválidos', 'Informe dois inteiros positivos maiores que 1.', true)
    }
    const factorsMatch =
      (p === challenge.primeP && q === challenge.primeQ) ||
      (p === challenge.primeQ && q === challenge.primeP)
    if (!factorsMatch) {
      return error('Engrenagens desalinhadas', `${p} × ${q} = ${p * q}, mas o cofre exige N = ${challenge.modulus}.`)
    }
    return {
      correct: true,
      malformed: false,
      title: 'Semiprimo fatorado',
      detail: `${p} × ${q} = ${challenge.modulus}. Os dois rotores primos responderam.`,
    }
  }

  if (stage === 'totient') {
    const totient = parseUnsignedBigInt(inputs.totient)
    if (totient === null) {
      return error('Totiente inválido', 'Use um número inteiro sem sinais ou casas decimais.', true)
    }
    if (totient !== challenge.totient) {
      return error('Anel φ fora de fase', `Calcule (${challenge.primeP} − 1) × (${challenge.primeQ} − 1).`)
    }
    return {
      correct: true,
      malformed: false,
      title: 'Totiente calibrado',
      detail: `φ(${challenge.modulus}) = ${challenge.totient}. O segundo anel foi energizado.`,
    }
  }

  if (stage === 'inverse') {
    const privateExponent = parseUnsignedBigInt(inputs.privateExponent)
    if (privateExponent === null) {
      return error('Expoente inválido', 'd precisa ser um inteiro não negativo.', true)
    }
    if (privateExponent !== challenge.privateExponent) {
      const residue = (challenge.publicExponent * privateExponent) % challenge.totient
      const suffix = residue === 1n
        ? ` O cofre usa o menor representante positivo, entre 1 e ${challenge.totient - 1n}.`
        : ''
      return error('Inverso recusado', `${challenge.publicExponent} × d deve deixar resto 1 módulo ${challenge.totient}; sua chave deixou ${residue}.${suffix}`)
    }
    return {
      correct: true,
      malformed: false,
      title: 'Chave privada sintetizada',
      detail: `d = ${privateExponent}: ${challenge.publicExponent} × ${privateExponent} ≡ 1 (mod ${challenge.totient}).`,
    }
  }

  const message = normalizeRsaMessage(inputs.message)
  if (!message || !/^[A-Z]+$/.test(message)) {
    return error('Mensagem inválida', 'Converta os blocos para letras usando A=1, B=2, …, Z=26.', true)
  }
  if (message !== challenge.message) {
    return error('Código não reconhecido', 'Aplique m = Cᵈ mod N a cada bloco e converta os resultados em letras.')
  }
  return {
    correct: true,
    malformed: false,
    title: 'Mensagem autenticada',
    detail: `${challenge.message}: todos os blocos atravessaram a chave privada.`,
  }
}

export function decryptChallengeBlocks(challenge: RsaVaultChallenge): bigint[] {
  return challenge.encryptedBlocks.map((block) =>
    modularPower(block, challenge.privateExponent, challenge.modulus),
  )
}

const STAGE_BASE_SCORE: Readonly<Record<RsaStage, number>> = {
  factor: 360,
  totient: 420,
  inverse: 560,
  decrypt: 760,
}

export function calculateRsaStageScore(
  stage: RsaStage,
  level: number,
  attempts: number,
): number {
  if (!Number.isSafeInteger(level) || level < 1 || level > RSA_VAULT_COUNT) {
    throw new RangeError('level must be an integer from 1 to 4')
  }
  if (!Number.isSafeInteger(attempts) || attempts < 1) {
    throw new RangeError('attempts must be a positive integer')
  }

  const precisionPenalty = Math.min(360, (attempts - 1) * 90)
  return Math.max(120, STAGE_BASE_SCORE[stage] + level * 135 - precisionPenalty)
}

export function calculateRsaVaultXp(score: number, mistakes: number): number {
  if (!Number.isFinite(score) || score < 0) {
    throw new RangeError('score must be finite and non-negative')
  }
  if (!Number.isSafeInteger(mistakes) || mistakes < 0) {
    throw new RangeError('mistakes must be a non-negative integer')
  }

  const precisionBonus = mistakes === 0 ? 60 : 0
  return Math.max(80, Math.min(500, Math.round(score / 38) + precisionBonus))
}
