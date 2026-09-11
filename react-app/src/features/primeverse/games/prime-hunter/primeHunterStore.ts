import { create } from 'zustand'
import { primeFactorization } from '../../../../lib/math'

export type HunterStatus = 'ready' | 'playing' | 'paused' | 'results'
export type HunterOutcome = 'sector-cleared' | 'ship-lost' | null

export interface HunterFeedback {
  id: number
  kind: 'prime' | 'composite' | 'miss' | 'breach'
  title: string
  detail: string
}

interface HunterState {
  status: HunterStatus
  outcome: HunterOutcome
  runId: number
  score: number
  combo: number
  bestCombo: number
  hits: number
  errors: number
  health: number
  stage: number
  feedback: HunterFeedback | null
  start: () => void
  resetToReady: () => void
  togglePause: () => void
  hitPrime: (value: number) => void
  hitComposite: (value: number) => void
  missShot: () => void
  breachPrime: (value: number) => void
  setStage: (stage: number) => void
}

const TARGET_PRIME_HITS = 20

function factorLabel(value: number) {
  return primeFactorization(value).join(' × ')
}

export const usePrimeHunterStore = create<HunterState>((set) => ({
  status: 'ready',
  outcome: null,
  runId: 0,
  score: 0,
  combo: 0,
  bestCombo: 0,
  hits: 0,
  errors: 0,
  health: 3,
  stage: 0,
  feedback: null,

  resetToReady: () => set({
    status: 'ready',
    outcome: null,
    score: 0,
    combo: 0,
    bestCombo: 0,
    hits: 0,
    errors: 0,
    health: 3,
    stage: 0,
    feedback: null,
  }),

  start: () => set((state) => ({
    status: 'playing',
    outcome: null,
    runId: state.runId + 1,
    score: 0,
    combo: 0,
    bestCombo: 0,
    hits: 0,
    errors: 0,
    health: 3,
    stage: 0,
    feedback: null,
  })),

  togglePause: () => set((state) => {
    if (state.status === 'playing') return { status: 'paused' }
    if (state.status === 'paused') return { status: 'playing' }
    return state
  }),

  hitPrime: (value) => set((state) => {
    if (state.status !== 'playing') return state
    const combo = state.combo + 1
    const hits = state.hits + 1
    const score = state.score + 100 + Math.min(combo, 20) * 18
    return {
      score,
      combo,
      hits,
      bestCombo: Math.max(state.bestCombo, combo),
      status: hits >= TARGET_PRIME_HITS ? 'results' : 'playing',
      outcome: hits >= TARGET_PRIME_HITS ? 'sector-cleared' : null,
      feedback: { id: state.feedback?.id ? state.feedback.id + 1 : 1, kind: 'prime', title: `+${100 + Math.min(combo, 20) * 18}`, detail: `${value} é primo` },
    }
  }),

  hitComposite: (value) => set((state) => {
    if (state.status !== 'playing') return state
    const health = Math.max(0, state.health - 1)
    return {
      score: Math.max(0, state.score - 80),
      combo: 0,
      errors: state.errors + 1,
      health,
      status: health === 0 ? 'results' : 'playing',
      outcome: health === 0 ? 'ship-lost' : null,
      feedback: { id: state.feedback?.id ? state.feedback.id + 1 : 1, kind: 'composite', title: 'ALVO COMPOSTO', detail: `${value} = ${factorLabel(value)}` },
    }
  }),

  missShot: () => set((state) => {
    if (state.status !== 'playing') return state
    return {
      score: Math.max(0, state.score - 12),
      combo: 0,
      errors: state.errors + 1,
      feedback: { id: state.feedback?.id ? state.feedback.id + 1 : 1, kind: 'miss', title: 'TIRO PERDIDO', detail: 'Mantenha a mira nos números' },
    }
  }),

  breachPrime: (value) => set((state) => {
    if (state.status !== 'playing') return state
    const health = Math.max(0, state.health - 1)
    return {
      combo: 0,
      errors: state.errors + 1,
      health,
      status: health === 0 ? 'results' : 'playing',
      outcome: health === 0 ? 'ship-lost' : null,
      feedback: { id: state.feedback?.id ? state.feedback.id + 1 : 1, kind: 'breach', title: 'PRIMO PERDIDO', detail: `${value} atravessou a defesa` },
    }
  }),

  setStage: (stage) => set((state) => state.stage === stage ? state : { stage }),
}))

export const HUNTER_TARGET_HITS = TARGET_PRIME_HITS
