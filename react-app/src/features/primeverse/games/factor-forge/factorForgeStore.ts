import { create } from 'zustand'
import { isPrime } from '../../../../lib/math/primes'
import { primeFactorization, validateDivisor } from '../../../../lib/math/factorization'

import {
  calculateForgeScore,
  calculateForgeXp,
  createRootNode,
  formatPrimeProduct,
  getCompositeLeaves,
  getOptimalStepCount,
  isFactorTreeComplete,
  nextChallengeValue,
  splitFactorNode,
} from './factorLogic'
import { recordForgeProgress } from './progressionAdapter'
import type {
  ForgeBestRecord,
  ForgeFeedback,
  ForgeNode,
  ForgePhase,
  ForgeResult,
} from './types'

const BEST_RECORDS_KEY = 'primeverse.factor-forge.best.v1'

interface ForgeState {
  phase: ForgePhase
  targetNumber: number
  nodes: ForgeNode[]
  selectedNodeId: string | null
  steps: number
  invalidAttempts: number
  startedAt: number | null
  completedAt: number | null
  feedback: ForgeFeedback | null
  result: ForgeResult | null
  bestRecords: Record<number, ForgeBestRecord>
  start: (value?: number) => void
  selectNode: (nodeId: string) => void
  submitDivisor: (divisor: number) => boolean
  restart: () => void
  nextChallenge: () => void
  returnToIntro: () => void
  clearFeedback: (feedbackId: number) => void
}

function readBestRecords(): Record<number, ForgeBestRecord> {
  if (typeof window === 'undefined') return {}

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(BEST_RECORDS_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<number, ForgeBestRecord>) : {}
  } catch {
    return {}
  }
}

function writeBestRecords(records: Record<number, ForgeBestRecord>): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(BEST_RECORDS_KEY, JSON.stringify(records))
  } catch {
    // The game remains fully playable if storage is unavailable.
  }
}

function feedback(
  id: number,
  kind: ForgeFeedback['kind'],
  message: string,
  nodeId?: string,
): ForgeFeedback {
  return { id, kind, message, nodeId }
}

export const useFactorForgeStore = create<ForgeState>((set, get) => ({
  phase: 'intro',
  targetNumber: 84,
  nodes: [createRootNode(84)],
  selectedNodeId: 'root',
  steps: 0,
  invalidAttempts: 0,
  startedAt: null,
  completedAt: null,
  feedback: null,
  result: null,
  bestRecords: readBestRecords(),

  start: (value = get().targetNumber) => {
    const challenge = Number.isSafeInteger(value) && value > 3 && !isPrime(value) ? value : 84
    const now = Date.now()
    set({
      phase: 'playing',
      targetNumber: challenge,
      nodes: [createRootNode(challenge, now)],
      selectedNodeId: 'root',
      steps: 0,
      invalidAttempts: 0,
      startedAt: now,
      completedAt: null,
      feedback: feedback(now, 'info', `Núcleo ${challenge} pronto. Escolha um divisor.`),
      result: null,
    })
  },

  selectNode: (nodeId) => {
    const { nodes, phase } = get()
    if (phase !== 'playing') return

    const node = nodes.find((candidate) => candidate.id === nodeId)
    if (!node) return

    const now = Date.now()
    if (node.children) {
      set({ feedback: feedback(now, 'info', 'Esse núcleo já foi dividido.', nodeId) })
      return
    }

    if (isPrime(node.value)) {
      set({
        selectedNodeId: null,
        feedback: feedback(now, 'success', `${node.value} é primo e já está estabilizado.`, nodeId),
      })
      return
    }

    set({
      selectedNodeId: nodeId,
      feedback: feedback(now, 'info', `Núcleo ${node.value} selecionado.`, nodeId),
    })
  },

  submitDivisor: (divisor) => {
    const state = get()
    const now = Date.now()

    if (state.phase !== 'playing') return false

    const selected = state.nodes.find((node) => node.id === state.selectedNodeId)
    if (!selected) {
      set({
        feedback: feedback(now, 'error', 'Selecione um cristal composto para continuar.'),
      })
      return false
    }

    if (!Number.isSafeInteger(divisor) || !validateDivisor(selected.value, divisor)) {
      set({
        invalidAttempts: state.invalidAttempts + 1,
        feedback: feedback(
          now,
          'error',
          `${divisor || '?'} não divide ${selected.value} em dois fatores inteiros maiores que 1.`,
          selected.id,
        ),
      })
      return false
    }

    const nextNodes = splitFactorNode(state.nodes, selected.id, divisor, now)
    if (!nextNodes) return false

    const nextSteps = state.steps + 1
    const complete = isFactorTreeComplete(nextNodes)
    const compositeLeaves = getCompositeLeaves(nextNodes)
    const nextSelectedId = compositeLeaves[0]?.id ?? null

    if (!complete) {
      set({
        nodes: nextNodes,
        selectedNodeId: nextSelectedId,
        steps: nextSteps,
        feedback: feedback(
          now,
          'success',
          `${selected.value} foi forjado em ${divisor} × ${selected.value / divisor}.`,
          selected.id,
        ),
      })
      return true
    }

    const startedAt = state.startedAt ?? now
    const elapsedMs = Math.max(1, now - startedAt)
    const factors = primeFactorization(state.targetNumber)
    const score = calculateForgeScore({
      value: state.targetNumber,
      elapsedMs,
      steps: nextSteps,
      invalidAttempts: state.invalidAttempts,
    })
    const xp = calculateForgeXp(score, state.invalidAttempts)
    const previousBest = state.bestRecords[state.targetNumber]
    const isNewBest = !previousBest || score > previousBest.score
    const result: ForgeResult = {
      value: state.targetNumber,
      factors,
      equation: `${state.targetNumber} = ${formatPrimeProduct(factors)}`,
      score,
      elapsedMs,
      steps: nextSteps,
      optimalSteps: getOptimalStepCount(state.targetNumber),
      invalidAttempts: state.invalidAttempts,
      xp,
      isNewBest,
    }
    const bestRecords = isNewBest
      ? {
          ...state.bestRecords,
          [state.targetNumber]: {
            score,
            elapsedMs,
            steps: nextSteps,
            recordedAt: now,
          },
        }
      : state.bestRecords

    if (isNewBest) writeBestRecords(bestRecords)
    recordForgeProgress(result)

    set({
      phase: 'complete',
      nodes: nextNodes,
      selectedNodeId: null,
      steps: nextSteps,
      completedAt: now,
      feedback: feedback(now, 'success', 'Fatoração fundamental concluída!'),
      result,
      bestRecords,
    })
    return true
  },

  restart: () => get().start(get().targetNumber),

  nextChallenge: () => get().start(nextChallengeValue(get().targetNumber)),

  returnToIntro: () => {
    const { targetNumber } = get()
    set({
      phase: 'intro',
      nodes: [createRootNode(targetNumber)],
      selectedNodeId: 'root',
      steps: 0,
      invalidAttempts: 0,
      startedAt: null,
      completedAt: null,
      feedback: null,
      result: null,
    })
  },

  clearFeedback: (feedbackId) => {
    if (get().feedback?.id === feedbackId) set({ feedback: null })
  },
}))

