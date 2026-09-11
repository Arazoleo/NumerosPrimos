import { isPrime, mod, solveOrbit } from '../../../../lib/math'

import type {
  EscapeInteractableDefinition,
  EscapeInteractableId,
  EscapeInspection,
  EscapeInspectionStatus,
  EscapeProgress,
  EscapeScoreInput,
  ModularLockEvaluation,
  RingDirection,
  RsaVaultEvaluation,
  RsaVaultInput,
} from './types'

export const PRIME_BOX_TARGET = [2, 3, 5, 7] as const
export const PRIME_BOX_RING_SIZE = 10

export const MODULAR_LOCK = {
  start: 7,
  step: 5,
  target: 3,
  modulus: 12,
  solution: 4,
} as const

export const RSA_VAULT = {
  modulus: 187,
  publicExponent: 7,
  primeP: 11,
  primeQ: 17,
  totient: 160,
  privateExponent: 23,
} as const

export const ESCAPE_STAGE_POINTS = {
  lens: 250,
  primeBox: 1_300,
  caesarCipher: 1_400,
  modularLock: 1_600,
  spectralClue: 600,
  rsaVault: 2_200,
  exit: 900,
} as const

export const ESCAPE_MISTAKE_PENALTY = 180
export const ESCAPE_PERFECT_BONUS = 500
export const ESCAPE_MAX_TIME_BONUS = 1_000
export const ESCAPE_TIME_BONUS_INTERVAL_MS = 30_000
export const ESCAPE_TIME_BONUS_STEP = 100

export const ESCAPE_INTERACTABLES: Readonly<
  Record<EscapeInteractableId, EscapeInteractableDefinition>
> = {
  lens: {
    id: 'lens',
    label: 'Lente espectral',
    prompt: 'Examinar a lente',
    description:
      'Um filtro óptico capaz de revelar inscrições escondidas no espectro violeta.',
  },
  'prime-box': {
    id: 'prime-box',
    label: 'Caixa dos quatro anéis',
    prompt: 'Inspecionar a caixa',
    description:
      'Quatro discos numerados protegem um compartimento mecânico sem fechadura aparente.',
  },
  'caesar-console': {
    id: 'caesar-console',
    label: 'Rotor de César',
    prompt: 'Instalar o rotor na máquina',
    description:
      'Dois alfabetos concêntricos decifram uma transmissão bloqueada por deslocamento.',
  },
  'modular-console': {
    id: 'modular-console',
    label: 'Console modular',
    prompt: 'Acessar o console',
    description:
      'Um painel orbital pede o menor número de pulsos para alinhar dois resíduos.',
  },
  'hidden-plaque': {
    id: 'hidden-plaque',
    label: 'Placa espectral',
    prompt: 'Usar a lente na parede',
    description:
      'A superfície parece vazia, mas reage discretamente à lente espectral.',
  },
  'rsa-vault': {
    id: 'rsa-vault',
    label: 'Cofre RSA',
    prompt: 'Examinar o cofre',
    description:
      'Dois dados de latão aguardam os fatores secretos; um terceiro controla a chave privada.',
  },
  'exit-door': {
    id: 'exit-door',
    label: 'Limiar vermelho',
    prompt: 'Atravessar o limiar',
    description:
      'A única abertura colorida do andar só reage a uma chave privada completa.',
  },
}

export type InteractableAvailability = 'available' | 'locked' | 'solved'

function assertRingValue(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value >= PRIME_BOX_RING_SIZE) {
    throw new RangeError(
      `ring value must be an integer from 0 to ${PRIME_BOX_RING_SIZE - 1}`,
    )
  }
}

export function rotatePrimeRing(
  value: number,
  direction: RingDirection = 1,
): number {
  assertRingValue(value)

  if (direction !== 1 && direction !== -1) {
    throw new RangeError('ring direction must be 1 or -1')
  }

  return mod(value + direction, PRIME_BOX_RING_SIZE)
}

export function validatePrimeBox(rings: readonly number[]): boolean {
  return (
    rings.length === PRIME_BOX_TARGET.length &&
    rings.every(
      (value, index) =>
        Number.isSafeInteger(value) && value === PRIME_BOX_TARGET[index],
    )
  )
}

export function solveModularLock(): number {
  const solution = solveOrbit(
    MODULAR_LOCK.start,
    MODULAR_LOCK.step,
    MODULAR_LOCK.target,
    MODULAR_LOCK.modulus,
  )

  if (solution === null) {
    throw new Error('The configured modular lock must be solvable')
  }

  return solution
}

export function evaluateModularLock(
  guess: number,
): ModularLockEvaluation | null {
  if (!Number.isSafeInteger(guess) || guess < 0) return null

  const residue = Number(
    (BigInt(MODULAR_LOCK.start) +
      BigInt(guess) * BigInt(MODULAR_LOCK.step)) %
      BigInt(MODULAR_LOCK.modulus),
  )
  const reachesTarget = residue === MODULAR_LOCK.target
  const isMinimal = guess === MODULAR_LOCK.solution

  return {
    guess,
    residue,
    reachesTarget,
    isMinimal,
    isCorrect: reachesTarget && isMinimal,
  }
}

export function validateRsaVault(input: RsaVaultInput): RsaVaultEvaluation {
  const valuesAreIntegers = [input.p, input.q, input.d].every((value) =>
    Number.isSafeInteger(value),
  )
  const factorsCorrect =
    valuesAreIntegers &&
    input.p > 1 &&
    input.p <= RSA_VAULT.modulus &&
    input.q > 1 &&
    input.q <= RSA_VAULT.modulus &&
    input.p !== input.q &&
    isPrime(input.p) &&
    isPrime(input.q) &&
    input.p * input.q === RSA_VAULT.modulus
  const totient = factorsCorrect ? (input.p - 1) * (input.q - 1) : null
  const inverseCorrect =
    totient === RSA_VAULT.totient &&
    input.d === RSA_VAULT.privateExponent &&
    mod(RSA_VAULT.publicExponent * input.d, totient) === 1

  return {
    factorsCorrect,
    totient,
    inverseCorrect,
    isCorrect: factorsCorrect && inverseCorrect,
  }
}

export function parseIntegerInput(value: string): number | null {
  const normalized = value.trim()
  if (!/^[+-]?\d+$/.test(normalized)) return null

  const parsed = Number(normalized)
  return Number.isSafeInteger(parsed) ? parsed : null
}

export function getInteractableAvailability(
  interactable: EscapeInteractableId,
  progress: EscapeProgress,
): InteractableAvailability {
  switch (interactable) {
    case 'lens':
      return progress.lensCollected ? 'solved' : 'available'
    case 'prime-box':
      if (progress.primeBoxSolved) return 'solved'
      return progress.lensCollected ? 'available' : 'locked'
    case 'caesar-console':
      if (progress.caesarSolved) return 'solved'
      return progress.primeBoxSolved && progress.caesarRotorCollected
        ? 'available'
        : 'locked'
    case 'modular-console':
      if (progress.modularSolved) return 'solved'
      return progress.caesarSolved ? 'available' : 'locked'
    case 'hidden-plaque':
      if (progress.clueRevealed) return 'solved'
      return progress.modularSolved && progress.lensCollected
        ? 'available'
        : 'locked'
    case 'rsa-vault':
      if (progress.rsaSolved) return 'solved'
      return progress.clueRevealed ? 'available' : 'locked'
    case 'exit-door':
      return progress.rsaSolved ? 'available' : 'locked'
  }
}

const LOCKED_COPY: Readonly<Record<EscapeInteractableId, string>> = {
  lens: 'A lente está ao alcance.',
  'prime-box': 'Os símbolos dos anéis são invisíveis a olho nu.',
  'caesar-console': 'A máquina possui um encaixe vazio para um rotor de alfabeto.',
  'modular-console': 'O console aguarda a transmissão decifrada nos escritórios.',
  'hidden-plaque': 'A parede não revela nada sem energia no projetor modular.',
  'rsa-vault': 'A porta vermelha aguarda a chave intermediária produzida pelo console modular.',
  'exit-door': 'Três travas ainda respondem ao cofre RSA.',
}

const SOLVED_COPY: Readonly<Record<EscapeInteractableId, string>> = {
  lens: 'A lente espectral está no seu inventário.',
  'prime-box': 'Os anéis, as travas e a gaveta revelaram o rotor de César.',
  'caesar-console': 'Os alfabetos permanecem alinhados no deslocamento 3: SULPR significa PRIMO.',
  'modular-console': 'O console confirma quatro pulsos como a menor órbita.',
  'hidden-plaque': 'A lente revela N = 187 e φ(N) = 160 gravados na parede.',
  'rsa-vault': 'Os dados exibem 11, 17 e 23; a chave privada está correta.',
  'exit-door': 'A rota de fuga está aberta.',
}

export function createInspection(
  interactable: EscapeInteractableId,
  status: EscapeInspectionStatus,
): EscapeInspection {
  const definition = ESCAPE_INTERACTABLES[interactable]
  let description = definition.description

  if (status === 'locked') description = LOCKED_COPY[interactable]
  if (status === 'solved') description = SOLVED_COPY[interactable]
  if (status === 'clue' && interactable === 'lens') {
    description =
      'Através da lente, quatro números brilham na caixa: os primeiros primos de um único algarismo.'
  }
  if (status === 'clue' && interactable === 'hidden-plaque') {
    description =
      'A lente torna visível a inscrição: N = 187 e φ(N) = 160. Os fatores e a chave privada ainda precisam ser deduzidos.'
  }

  return {
    interactable,
    status,
    title: definition.label,
    description,
  }
}

function assertScoreInput(input: EscapeScoreInput): void {
  if (!Number.isSafeInteger(input.mistakes) || input.mistakes < 0) {
    throw new RangeError('mistakes must be a non-negative integer')
  }
  if (!Number.isFinite(input.elapsedMs) || input.elapsedMs < 0) {
    throw new RangeError('elapsedMs must be a finite non-negative number')
  }
}

export function calculateEscapeScore(input: EscapeScoreInput): number {
  assertScoreInput(input)

  const baseScore = Object.values(ESCAPE_STAGE_POINTS).reduce(
    (total, value) => total + value,
    0,
  )
  const elapsedIntervals = Math.floor(
    input.elapsedMs / ESCAPE_TIME_BONUS_INTERVAL_MS,
  )
  const timeBonus = Math.max(
    0,
    ESCAPE_MAX_TIME_BONUS - elapsedIntervals * ESCAPE_TIME_BONUS_STEP,
  )
  const perfectBonus = input.mistakes === 0 ? ESCAPE_PERFECT_BONUS : 0
  const mistakePenalty = input.mistakes * ESCAPE_MISTAKE_PENALTY

  return Math.max(1_000, baseScore + timeBonus + perfectBonus - mistakePenalty)
}

export function calculateEscapeXp(score: number, mistakes: number): number {
  if (!Number.isFinite(score) || score < 0) {
    throw new RangeError('score must be a finite non-negative number')
  }
  if (!Number.isSafeInteger(mistakes) || mistakes < 0) {
    throw new RangeError('mistakes must be a non-negative integer')
  }

  const perfectBonus = mistakes === 0 ? 50 : 0
  return Math.max(100, Math.min(500, Math.round(score / 25) + perfectBonus))
}

export function calculateExplorationScore(
  progress: EscapeProgress,
  mistakes: number,
): number {
  if (!Number.isSafeInteger(mistakes) || mistakes < 0) {
    throw new RangeError('mistakes must be a non-negative integer')
  }

  const earned =
    (progress.lensCollected ? ESCAPE_STAGE_POINTS.lens : 0) +
    (progress.primeBoxSolved ? ESCAPE_STAGE_POINTS.primeBox : 0) +
    (progress.caesarSolved ? ESCAPE_STAGE_POINTS.caesarCipher : 0) +
    (progress.modularSolved ? ESCAPE_STAGE_POINTS.modularLock : 0) +
    (progress.clueRevealed ? ESCAPE_STAGE_POINTS.spectralClue : 0) +
    (progress.rsaSolved ? ESCAPE_STAGE_POINTS.rsaVault : 0)

  return Math.max(0, earned - mistakes * ESCAPE_MISTAKE_PENALTY)
}
