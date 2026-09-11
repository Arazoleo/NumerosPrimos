import { create, type StoreApi, type UseBoundStore } from 'zustand'

import type { RandomSource } from '../../../../lib/math'
import {
  calculateModularOrbitXp,
  calculateOrbitRoundScore,
  createModularOrbitChallenges,
  createSeededOrbitRandom,
  evaluateOrbitGuess,
  isValidOrbitChallenge,
  MAX_ORBIT_PULSES,
  MODULAR_ORBIT_ROUNDS,
} from './modularOrbitLogic'
import { recordModularOrbitProgress } from './progressionAdapter'
import type {
  ModularOrbitChallenge,
  ModularOrbitPhase,
  ModularOrbitProgressInput,
  ModularOrbitResult,
  OrbitFeedback,
  OrbitLaunch,
  OrbitRoundResult,
} from './types'

export interface ModularOrbitState {
  phase: ModularOrbitPhase
  runId: number
  roundIndex: number
  challenges: readonly ModularOrbitChallenge[]
  challenge: ModularOrbitChallenge
  guess: string
  pendingLaunch: OrbitLaunch | null
  lastLaunch: OrbitLaunch | null
  attempts: number
  roundAttempts: number
  mistakes: number
  roundMistakes: number
  score: number
  startedAt: number | null
  completedAt: number | null
  feedback: OrbitFeedback | null
  roundResults: readonly OrbitRoundResult[]
  result: ModularOrbitResult | null
  start: (seed?: number) => void
  setGuess: (guess: string) => void
  launch: (pulses?: number) => boolean
  resolveLaunch: () => boolean
  nextRound: () => boolean
  restart: () => void
  returnToIntro: () => void
  clearFeedback: (feedbackId: number) => void
}

export type ModularOrbitStore = UseBoundStore<StoreApi<ModularOrbitState>>

export interface ModularOrbitStoreOptions {
  readonly now?: () => number
  readonly random?: RandomSource
  readonly challengeGenerator?: (
    random: RandomSource,
  ) => readonly ModularOrbitChallenge[]
  readonly recordProgress?: (input: ModularOrbitProgressInput) => boolean
}

const INTRO_CHALLENGES = createModularOrbitChallenges(
  createSeededOrbitRandom(0x0b17_2026),
)

function checkedChallenges(
  challenges: readonly ModularOrbitChallenge[],
): readonly ModularOrbitChallenge[] {
  if (
    challenges.length !== MODULAR_ORBIT_ROUNDS ||
    challenges.some(
      (challenge, index) =>
        challenge.difficulty !== index + 1 || !isValidOrbitChallenge(challenge),
    )
  ) {
    throw new Error(
      `Modular Orbit requires ${MODULAR_ORBIT_ROUNDS} ordered, reachable challenges`,
    )
  }

  return challenges.map((challenge) => ({ ...challenge }))
}

function nextFeedback(
  previous: OrbitFeedback | null,
  kind: OrbitFeedback['kind'],
  title: string,
  detail: string,
): OrbitFeedback {
  return {
    id: (previous?.id ?? 0) + 1,
    kind,
    title,
    detail,
  }
}

interface RunReset {
  phase: 'playing'
  runId: number
  roundIndex: number
  challenges: readonly ModularOrbitChallenge[]
  challenge: ModularOrbitChallenge
  guess: string
  pendingLaunch: null
  lastLaunch: null
  attempts: number
  roundAttempts: number
  mistakes: number
  roundMistakes: number
  score: number
  startedAt: number
  completedAt: null
  feedback: OrbitFeedback
  roundResults: readonly OrbitRoundResult[]
  result: null
}

function resetRun(
  challenges: readonly ModularOrbitChallenge[],
  runId: number,
  startedAt: number,
  previousFeedback: OrbitFeedback | null,
): RunReset {
  const challenge = challenges[0]

  return {
    phase: 'playing',
    runId,
    roundIndex: 0,
    challenges,
    challenge,
    guess: '',
    pendingLaunch: null,
    lastLaunch: null,
    attempts: 0,
    roundAttempts: 0,
    mistakes: 0,
    roundMistakes: 0,
    score: 0,
    startedAt,
    completedAt: null,
    feedback: nextFeedback(
      previousFeedback,
      'info',
      'Órbita sincronizada',
      `Encontre o menor k para chegar à estação ${challenge.target}.`,
    ),
    roundResults: [],
    result: null,
  }
}

export function createModularOrbitStore(
  options: ModularOrbitStoreOptions = {},
): ModularOrbitStore {
  const now = options.now ?? Date.now
  const random = options.random ?? Math.random
  const challengeGenerator =
    options.challengeGenerator ?? createModularOrbitChallenges
  const recordProgress =
    options.recordProgress ?? recordModularOrbitProgress

  return create<ModularOrbitState>((set, get) => ({
    phase: 'intro',
    runId: 0,
    roundIndex: 0,
    challenges: INTRO_CHALLENGES,
    challenge: INTRO_CHALLENGES[0],
    guess: '',
    pendingLaunch: null,
    lastLaunch: null,
    attempts: 0,
    roundAttempts: 0,
    mistakes: 0,
    roundMistakes: 0,
    score: 0,
    startedAt: null,
    completedAt: null,
    feedback: null,
    roundResults: [],
    result: null,

    start: (seed) => {
      const source = seed === undefined ? random : createSeededOrbitRandom(seed)
      const challenges = checkedChallenges(challengeGenerator(source))
      const state = get()
      set(resetRun(challenges, state.runId + 1, now(), state.feedback))
    },

    setGuess: (guess) => {
      if (get().phase !== 'playing') return
      set({ guess })
    },

    launch: (pulses) => {
      const state = get()
      if (state.phase !== 'playing') return false

      const rawGuess = pulses ?? (
        state.guess.trim() === '' ? Number.NaN : Number(state.guess)
      )

      if (
        !Number.isSafeInteger(rawGuess) ||
        rawGuess < 0 ||
        rawGuess > MAX_ORBIT_PULSES
      ) {
        set({
          feedback: nextFeedback(
            state.feedback,
            'error',
            'Pulso inválido',
            `Use um número inteiro entre 0 e ${MAX_ORBIT_PULSES}.`,
          ),
        })
        return false
      }

      const pendingLaunch = evaluateOrbitGuess(state.challenge, rawGuess)
      set({
        phase: 'launching',
        pendingLaunch,
        lastLaunch: null,
        attempts: state.attempts + 1,
        roundAttempts: state.roundAttempts + 1,
        feedback: nextFeedback(
          state.feedback,
          'info',
          `${rawGuess} ${rawGuess === 1 ? 'pulso' : 'pulsos'}`,
          `Nave partindo do resíduo ${state.challenge.start}.`,
        ),
      })
      return true
    },

    resolveLaunch: () => {
      const state = get()
      if (state.phase !== 'launching' || !state.pendingLaunch) return false

      const launch = state.pendingLaunch

      if (!launch.isCorrect) {
        const equivalentDetail = launch.reachesTarget
          ? 'Você chegou ao alvo, mas deu uma volta extra. Procure o menor k.'
          : `A nave pousou em ${launch.landing}; o alvo está em ${state.challenge.target}.`

        set({
          phase: 'playing',
          pendingLaunch: null,
          lastLaunch: launch,
          mistakes: state.mistakes + 1,
          roundMistakes: state.roundMistakes + 1,
          feedback: nextFeedback(
            state.feedback,
            'error',
            launch.reachesTarget ? 'Rota não mínima' : 'Órbita incompleta',
            equivalentDetail,
          ),
        })
        return false
      }

      const roundScore = calculateOrbitRoundScore(
        state.challenge,
        state.roundAttempts,
      )
      const roundResult: OrbitRoundResult = {
        roundIndex: state.roundIndex,
        challengeId: state.challenge.id,
        attempts: state.roundAttempts,
        mistakes: state.roundMistakes,
        score: roundScore,
      }
      const roundResults = [...state.roundResults, roundResult]
      const score = state.score + roundScore
      const isFinalRound = state.roundIndex === MODULAR_ORBIT_ROUNDS - 1

      if (!isFinalRound) {
        set({
          phase: 'round-complete',
          pendingLaunch: null,
          lastLaunch: launch,
          score,
          roundResults,
          feedback: nextFeedback(
            state.feedback,
            'success',
            'Acoplamento perfeito',
            `${state.challenge.solution} pulsos formam a menor rota possível.`,
          ),
        })
        return true
      }

      const completedAt = now()
      const elapsedMs = Math.max(0, completedAt - (state.startedAt ?? completedAt))
      const xp = calculateModularOrbitXp(score, state.mistakes)
      let isNewBest = false

      try {
        isNewBest = recordProgress({ score, xp })
      } catch {
        // Progress persistence must never prevent a completed mission.
      }

      const result: ModularOrbitResult = {
        score,
        xp,
        elapsedMs,
        attempts: state.attempts,
        mistakes: state.mistakes,
        rounds: roundResults,
        isNewBest,
      }

      set({
        phase: 'complete',
        pendingLaunch: null,
        lastLaunch: launch,
        score,
        completedAt,
        roundResults,
        result,
        feedback: nextFeedback(
          state.feedback,
          'success',
          'Sistema orbital dominado',
          `Cinco rotas concluídas. +${xp} XP de navegação modular.`,
        ),
      })
      return true
    },

    nextRound: () => {
      const state = get()
      if (state.phase !== 'round-complete') return false

      const roundIndex = state.roundIndex + 1
      const challenge = state.challenges[roundIndex]
      if (!challenge) return false

      set({
        phase: 'playing',
        roundIndex,
        challenge,
        guess: '',
        pendingLaunch: null,
        lastLaunch: null,
        roundAttempts: 0,
        roundMistakes: 0,
        feedback: nextFeedback(
          state.feedback,
          'info',
          `Órbita ${roundIndex + 1} de ${MODULAR_ORBIT_ROUNDS}`,
          `Novo módulo ${challenge.modulus}; alvo no resíduo ${challenge.target}.`,
        ),
      })
      return true
    },

    restart: () => {
      const state = get()
      set(
        resetRun(
          state.challenges,
          state.runId + 1,
          now(),
          state.feedback,
        ),
      )
    },

    returnToIntro: () => {
      const state = get()
      set({
        phase: 'intro',
        roundIndex: 0,
        challenge: state.challenges[0],
        guess: '',
        pendingLaunch: null,
        lastLaunch: null,
        attempts: 0,
        roundAttempts: 0,
        mistakes: 0,
        roundMistakes: 0,
        score: 0,
        startedAt: null,
        completedAt: null,
        feedback: null,
        roundResults: [],
        result: null,
      })
    },

    clearFeedback: (feedbackId) => {
      if (get().feedback?.id === feedbackId) set({ feedback: null })
    },
  }))
}

export const useModularOrbitStore = createModularOrbitStore()
