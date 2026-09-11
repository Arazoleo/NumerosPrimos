import { primeFactorization } from '../../../../lib/math/factorization'
import { isPrime } from '../../../../lib/math/primes'

import type {
  DefenseDivisor,
  DefenseEnemy,
  DefenseLane,
  DefenseOutcome,
  DefensePlanAnalysis,
  DefenseSlot,
  DefenseWave,
  TowerPlacement,
} from './types'

export const DEFENSE_LANES = [0, 1, 2] as const
export const DEFENSE_SLOTS = [0, 1, 2] as const
export const DEFENSE_DIVISORS = [2, 3, 5, 7] as const
export const DEFENSE_STARTING_LIVES = 6

export const TOWER_COSTS: Readonly<Record<DefenseDivisor, number>> = {
  2: 2,
  3: 2,
  5: 3,
  7: 3,
}

const seeds = (...values: number[]): readonly { value: number }[] =>
  values.map((value) => ({ value }))

export const DEFENSE_WAVES: readonly DefenseWave[] = [
  {
    id: 'parity-signal',
    name: 'Sinal de paridade',
    briefing: 'Calibre filtros simples e deixe as assinaturas primas alcançarem o núcleo.',
    energy: 6,
    lanes: [seeds(11, 6, 13), seeds(15, 17), seeds(10, 19)],
  },
  {
    id: 'crossed-factors',
    name: 'Fatores cruzados',
    briefing: 'Algumas pistas exigem dois divisores; procure coberturas compartilhadas.',
    energy: 10,
    lanes: [seeds(21, 23, 35), seeds(22, 25, 29), seeds(27, 31, 33)],
  },
  {
    id: 'dual-front',
    name: 'Frente dupla',
    briefing: 'Cada rota mistura famílias de fatores. Distribua energia antes de lançar.',
    energy: 14,
    lanes: [seeds(26, 39, 41), seeds(49, 43, 45), seeds(46, 55, 47)],
  },
  {
    id: 'compression-field',
    name: 'Campo de compressão',
    briefing: 'A sequência cresceu, mas uma torre bem escolhida pode deter vários compostos.',
    energy: 12,
    lanes: [seeds(51, 53, 65, 67), seeds(70, 71, 77), seeds(57, 59, 58, 61)],
  },
  {
    id: 'factor-storm',
    name: 'Tempestade fatorial',
    briefing: 'A onda final exige cobertura total das quatro frequências divisoras.',
    energy: 19,
    lanes: [seeds(82, 83, 85, 87), seeds(91, 89, 93, 95), seeds(94, 97, 98, 99)],
  },
] as const

export const DEFENSE_WAVE_COUNT = DEFENSE_WAVES.length

export function towerId(lane: DefenseLane, slot: DefenseSlot): string {
  return `lane-${lane}-slot-${slot}`
}

export function createWaveEnemies(
  wave: DefenseWave,
  waveIndex: number,
): DefenseEnemy[] {
  const enemiesByLane = wave.lanes.map((lane, laneIndex) =>
    lane.map((enemy, laneOrder) => ({
      ...enemy,
      id: `wave-${waveIndex}-lane-${laneIndex}-enemy-${laneOrder}`,
      lane: laneIndex as DefenseLane,
      laneOrder,
      travelOrder: -1,
    })),
  )
  const longestLane = Math.max(...enemiesByLane.map((lane) => lane.length))
  const ordered: DefenseEnemy[] = []

  for (let enemyIndex = 0; enemyIndex < longestLane; enemyIndex += 1) {
    for (const lane of DEFENSE_LANES) {
      const enemy = enemiesByLane[lane][enemyIndex]
      if (enemy) ordered.push({ ...enemy, travelOrder: ordered.length })
    }
  }

  return ordered
}

export function getPlacementEnergy(placements: readonly TowerPlacement[]): number {
  return placements.reduce((total, placement) => total + TOWER_COSTS[placement.divisor], 0)
}

export function getCoveringDivisors(value: number): DefenseDivisor[] {
  if (isPrime(value)) return []
  return DEFENSE_DIVISORS.filter((divisor) => value % divisor === 0)
}

export function formatDefenseFactorization(value: number): string {
  return primeFactorization(value).join(' × ')
}

export function scoreDefenseOutcome(
  value: number,
  kind: DefenseOutcome['kind'],
): number {
  if (kind === 'intercepted') return 120 + value * 3
  if (kind === 'prime-passed') return 80 + value * 2
  return 0
}

export function evaluateDefenseEnemy(
  enemy: DefenseEnemy,
  placements: readonly TowerPlacement[],
): DefenseOutcome {
  const factors = primeFactorization(enemy.value)

  if (isPrime(enemy.value)) {
    return {
      enemy,
      kind: 'prime-passed',
      divisor: null,
      towerId: null,
      factors,
      points: scoreDefenseOutcome(enemy.value, 'prime-passed'),
      lifeDelta: 0,
      chargeDelta: 1,
      explanation: `${enemy.value} é primo: não possui divisor próprio e alimenta o núcleo.`,
    }
  }

  const tower = [...placements]
    .filter((placement) => placement.lane === enemy.lane)
    .sort((left, right) => left.slot - right.slot)
    .find((placement) => enemy.value % placement.divisor === 0)

  if (tower) {
    return {
      enemy,
      kind: 'intercepted',
      divisor: tower.divisor,
      towerId: tower.id,
      factors,
      points: scoreDefenseOutcome(enemy.value, 'intercepted'),
      lifeDelta: 0,
      chargeDelta: 0,
      explanation: `${enemy.value} = ${formatDefenseFactorization(enemy.value)}; divisível por ${tower.divisor}.`,
    }
  }

  const available = getCoveringDivisors(enemy.value)
  const hint = available.length > 0
    ? `Um filtro ${available.join(' ou ')} nesta pista o teria interceptado.`
    : 'Nenhuma frequência disponível cobre este composto.'

  return {
    enemy,
    kind: 'breach',
    divisor: null,
    towerId: null,
    factors,
    points: 0,
    lifeDelta: -1,
    chargeDelta: 0,
    explanation: `${enemy.value} = ${formatDefenseFactorization(enemy.value)}. ${hint}`,
  }
}

export function analyzeDefensePlan(
  wave: DefenseWave,
  waveIndex: number,
  placements: readonly TowerPlacement[],
): DefensePlanAnalysis {
  const outcomes = createWaveEnemies(wave, waveIndex)
    .map((enemy) => evaluateDefenseEnemy(enemy, placements))

  return {
    outcomes,
    intercepted: outcomes.filter((outcome) => outcome.kind === 'intercepted').length,
    primes: outcomes.filter((outcome) => outcome.kind === 'prime-passed').length,
    breaches: outcomes.filter((outcome) => outcome.kind === 'breach').length,
  }
}

export function calculateWaveBonus(waveIndex: number, breaches: number): number {
  if (breaches > 0) return 0
  return 400 + waveIndex * 150
}

export function calculateDefenseXp(score: number, victory: boolean): number {
  const completionBonus = victory ? 80 : 0
  return Math.max(20, Math.min(450, Math.round(score / 22) + completionBonus))
}

