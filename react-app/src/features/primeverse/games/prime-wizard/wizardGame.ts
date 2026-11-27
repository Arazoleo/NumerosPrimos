import { generateRiddle, isAnswer, tierForRound, type Random, type Riddle } from './riddles'

export const TOTAL_ROUNDS = 12
export const MAX_HEARTS = 3
/** Quanto o golem avança quando o feitiço sai errado. */
export const WRONG_PENALTY = 0.2

export type WizardOutcome = 'victory' | 'defeat' | null

export interface WizardState {
  readonly round: number
  readonly hearts: number
  readonly score: number
  readonly streak: number
  readonly bestStreak: number
  readonly defeated: number
  readonly riddle: Riddle
  /** 0 = golem acabou de surgir no portal; 1 = chegou até o mago. */
  readonly progress: number
  readonly duration: number
  readonly recentKeys: readonly string[]
  readonly outcome: WizardOutcome
  /** Formato do golem: um retângulo de blocos, como todo número composto. */
  readonly golem: { readonly rows: number; readonly columns: number }
}

export type WizardEvent =
  | { readonly type: 'hit'; readonly points: number }
  | { readonly type: 'miss' }
  | { readonly type: 'breach' }

const GOLEMS = [[2, 2], [2, 3], [3, 2], [2, 4], [3, 3], [2, 5], [3, 4], [4, 3], [2, 6], [4, 4], [3, 5]] as const

/** Bem folgado: no começo dá meio minuto para pensar e escrever. */
export function durationForRound(round: number): number {
  const base = [30, 32, 32][tierForRound(round)]
  return Math.max(18, base - round * 0.6)
}

function nextEnemy(state: Pick<WizardState, 'recentKeys'>, round: number, random: Random) {
  const riddle = generateRiddle(tierForRound(round), random, state.recentKeys)
  const [rows, columns] = GOLEMS[Math.min(GOLEMS.length - 1, Math.floor(random() * Math.min(GOLEMS.length, 4 + round)))]
  return {
    round,
    riddle,
    progress: 0,
    duration: durationForRound(round),
    recentKeys: [riddle.key, ...state.recentKeys].slice(0, 4),
    golem: { rows, columns },
  }
}

export function createWizardGame(random: Random = Math.random): WizardState {
  return {
    hearts: MAX_HEARTS,
    score: 0,
    streak: 0,
    bestStreak: 0,
    defeated: 0,
    outcome: null,
    ...nextEnemy({ recentKeys: [] }, 0, random),
  }
}

function afterEnemy(state: WizardState, random: Random): WizardState {
  const round = state.round + 1
  if (state.hearts <= 0) return { ...state, outcome: 'defeat' }
  if (round >= TOTAL_ROUNDS) return { ...state, round, outcome: 'victory' }
  return { ...state, ...nextEnemy(state, round, random) }
}

function breach(state: WizardState, random: Random): [WizardState, WizardEvent] {
  const hearts = state.hearts - 1
  return [afterEnemy({ ...state, hearts, streak: 0, progress: 1 }, random), { type: 'breach' }]
}

/** Avança o relógio da partida. */
export function advanceWizard(state: WizardState, seconds: number, random: Random = Math.random): [WizardState, WizardEvent | null] {
  if (state.outcome) return [state, null]
  const progress = state.progress + seconds / state.duration
  if (progress >= 1) return breach(state, random)
  return [{ ...state, progress }, null]
}

export function castSpell(state: WizardState, value: number, random: Random = Math.random): [WizardState, WizardEvent] {
  if (state.outcome) return [state, { type: 'miss' }]
  if (isAnswer(state.riddle, value)) {
    const streak = state.streak + 1
    const points = 100 + Math.round(100 * (1 - state.progress)) + (streak - 1) * 25
    const scored = {
      ...state,
      score: state.score + points,
      streak,
      bestStreak: Math.max(state.bestStreak, streak),
      defeated: state.defeated + 1,
    }
    return [afterEnemy(scored, random), { type: 'hit', points }]
  }
  const progress = state.progress + WRONG_PENALTY
  if (progress >= 1) return breach(state, random)
  return [{ ...state, progress, streak: 0 }, { type: 'miss' }]
}

export function xpForRun(state: WizardState): number {
  return Math.round(state.score / 20) + (state.outcome === 'victory' ? 40 : 0)
}
