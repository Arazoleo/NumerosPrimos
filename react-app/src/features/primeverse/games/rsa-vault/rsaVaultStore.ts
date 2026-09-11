import { create, type StoreApi, type UseBoundStore } from 'zustand'

import { recordRsaVaultProgress } from './progressionAdapter'
import {
  calculateRsaStageScore,
  calculateRsaVaultXp,
  evaluateRsaStage,
  isValidRsaChallenge,
  RSA_STAGES,
  RSA_VAULT_CHALLENGES,
  RSA_VAULT_COUNT,
} from './rsaVaultLogic'
import type {
  RsaFeedback,
  RsaInputField,
  RsaStage,
  RsaVaultChallenge,
  RsaVaultInputs,
  RsaVaultPhase,
  RsaVaultProgressInput,
  RsaVaultResult,
  RsaVaultRoundResult,
  RsaVaultSoundEvent,
  RsaVaultSoundSignal,
} from './types'

const EMPTY_INPUTS: RsaVaultInputs = {
  p: '',
  q: '',
  totient: '',
  privateExponent: '',
  message: '',
}

export interface RsaVaultState {
  phase: RsaVaultPhase
  runId: number
  vaultIndex: number
  challenges: readonly RsaVaultChallenge[]
  challenge: RsaVaultChallenge
  stage: RsaStage
  completedStages: readonly RsaStage[]
  inputs: RsaVaultInputs
  attempts: number
  mistakes: number
  stageAttempts: number
  roundAttempts: number
  roundMistakes: number
  score: number
  roundScore: number
  startedAt: number | null
  completedAt: number | null
  feedback: RsaFeedback | null
  lastSound: RsaVaultSoundSignal | null
  roundResults: readonly RsaVaultRoundResult[]
  result: RsaVaultResult | null
  start: () => void
  setInput: (field: RsaInputField, value: string) => void
  submitStage: () => boolean
  resolveVault: () => boolean
  nextVault: () => boolean
  restart: () => void
  returnToIntro: () => void
  clearFeedback: (feedbackId: number) => void
}

export type RsaVaultStore = UseBoundStore<StoreApi<RsaVaultState>>

export interface RsaVaultStoreOptions {
  readonly now?: () => number
  readonly challenges?: readonly RsaVaultChallenge[]
  readonly recordProgress?: (input: RsaVaultProgressInput) => boolean
}

function checkedChallenges(
  challenges: readonly RsaVaultChallenge[],
): readonly RsaVaultChallenge[] {
  if (
    challenges.length !== RSA_VAULT_COUNT ||
    challenges.some(
      (challenge, index) =>
        challenge.level !== index + 1 || !isValidRsaChallenge(challenge),
    )
  ) {
    throw new Error('RSA Vault requires four ordered, valid RSA challenges')
  }
  return challenges
}

function nextFeedback(
  previous: RsaFeedback | null,
  kind: RsaFeedback['kind'],
  title: string,
  detail: string,
): RsaFeedback {
  return { id: (previous?.id ?? 0) + 1, kind, title, detail }
}

function nextSound(
  previous: RsaVaultSoundSignal | null,
  event: RsaVaultSoundEvent,
): RsaVaultSoundSignal {
  return { id: (previous?.id ?? 0) + 1, event }
}

function resetRun(
  state: RsaVaultState,
  challenges: readonly RsaVaultChallenge[],
  startedAt: number,
): Partial<RsaVaultState> {
  return {
    phase: 'playing',
    runId: state.runId + 1,
    vaultIndex: 0,
    challenges,
    challenge: challenges[0],
    stage: 'factor',
    completedStages: [],
    inputs: { ...EMPTY_INPUTS },
    attempts: 0,
    mistakes: 0,
    stageAttempts: 0,
    roundAttempts: 0,
    roundMistakes: 0,
    score: 0,
    roundScore: 0,
    startedAt,
    completedAt: null,
    feedback: nextFeedback(
      state.feedback,
      'info',
      'Câmara criptográfica ativa',
      `Fatore N = ${challenges[0].modulus} para acoplar os rotores primos.`,
    ),
    lastSound: nextSound(state.lastSound, 'select'),
    roundResults: [],
    result: null,
  }
}

export function createRsaVaultStore(
  options: RsaVaultStoreOptions = {},
): RsaVaultStore {
  const now = options.now ?? Date.now
  const challenges = checkedChallenges(options.challenges ?? RSA_VAULT_CHALLENGES)
  const recordProgress = options.recordProgress ?? recordRsaVaultProgress

  return create<RsaVaultState>((set, get) => ({
    phase: 'intro',
    runId: 0,
    vaultIndex: 0,
    challenges,
    challenge: challenges[0],
    stage: 'factor',
    completedStages: [],
    inputs: { ...EMPTY_INPUTS },
    attempts: 0,
    mistakes: 0,
    stageAttempts: 0,
    roundAttempts: 0,
    roundMistakes: 0,
    score: 0,
    roundScore: 0,
    startedAt: null,
    completedAt: null,
    feedback: null,
    lastSound: null,
    roundResults: [],
    result: null,

    start: () => {
      const state = get()
      set(resetRun(state, challenges, now()))
    },

    setInput: (field, value) => {
      if (get().phase !== 'playing') return
      set((state) => ({ inputs: { ...state.inputs, [field]: value } }))
    },

    submitStage: () => {
      const state = get()
      if (state.phase !== 'playing') return false

      const evaluation = evaluateRsaStage(
        state.challenge,
        state.stage,
        state.inputs,
      )
      const attempts = state.attempts + 1
      const stageAttempts = state.stageAttempts + 1
      const roundAttempts = state.roundAttempts + 1

      if (!evaluation.correct) {
        set({
          attempts,
          stageAttempts,
          roundAttempts,
          mistakes: state.mistakes + 1,
          roundMistakes: state.roundMistakes + 1,
          feedback: nextFeedback(
            state.feedback,
            'error',
            evaluation.title,
            evaluation.detail,
          ),
          lastSound: nextSound(state.lastSound, 'error'),
        })
        return false
      }

      const stageScore = calculateRsaStageScore(
        state.stage,
        state.challenge.level,
        stageAttempts,
      )
      const score = state.score + stageScore
      const roundScore = state.roundScore + stageScore
      const completedStages = [...state.completedStages, state.stage]
      const stageIndex = RSA_STAGES.indexOf(state.stage)
      const isDecrypt = state.stage === 'decrypt'

      if (isDecrypt) {
        set({
          phase: 'unlocking',
          attempts,
          stageAttempts,
          roundAttempts,
          completedStages,
          score,
          roundScore,
          feedback: nextFeedback(
            state.feedback,
            'success',
            evaluation.title,
            `${evaluation.detail} O ferrolho central está recuando.`,
          ),
          lastSound: nextSound(state.lastSound, 'unlock'),
        })
        return true
      }

      const nextStage = RSA_STAGES[stageIndex + 1]
      set({
        stage: nextStage,
        attempts,
        stageAttempts: 0,
        roundAttempts,
        completedStages,
        score,
        roundScore,
        feedback: nextFeedback(
          state.feedback,
          'success',
          evaluation.title,
          evaluation.detail,
        ),
        lastSound: nextSound(state.lastSound, 'stage'),
      })
      return true
    },

    resolveVault: () => {
      const state = get()
      if (state.phase !== 'unlocking') return false

      const roundResult: RsaVaultRoundResult = {
        vaultIndex: state.vaultIndex,
        challengeId: state.challenge.id,
        attempts: state.roundAttempts,
        mistakes: state.roundMistakes,
        score: state.roundScore,
        message: state.challenge.message,
      }
      const roundResults = [...state.roundResults, roundResult]
      const isFinalVault = state.vaultIndex === RSA_VAULT_COUNT - 1

      if (!isFinalVault) {
        set({
          phase: 'vault-open',
          roundResults,
          feedback: nextFeedback(
            state.feedback,
            'success',
            `Cofre ${state.challenge.codename} aberto`,
            `A palavra ${state.challenge.message} revelou a próxima coordenada.`,
          ),
        })
        return true
      }

      const completedAt = now()
      const elapsedMs = Math.max(0, completedAt - (state.startedAt ?? completedAt))
      const xp = calculateRsaVaultXp(state.score, state.mistakes)
      let isNewBest = false
      try {
        isNewBest = recordProgress({ score: state.score, xp })
      } catch {
        // Persistence failures must never trap an already-open vault.
      }

      const result: RsaVaultResult = {
        score: state.score,
        xp,
        elapsedMs,
        attempts: state.attempts,
        mistakes: state.mistakes,
        vaults: roundResults,
        isNewBest,
      }

      set({
        phase: 'complete',
        completedAt,
        roundResults,
        result,
        feedback: nextFeedback(
          state.feedback,
          'success',
          'Arquivo RSA recuperado',
          `Quatro cofres abertos. +${xp} XP de criptoanálise.`,
        ),
        lastSound: nextSound(state.lastSound, 'complete'),
      })
      return true
    },

    nextVault: () => {
      const state = get()
      if (state.phase !== 'vault-open') return false

      const vaultIndex = state.vaultIndex + 1
      const challenge = state.challenges[vaultIndex]
      if (!challenge) return false

      set({
        phase: 'playing',
        vaultIndex,
        challenge,
        stage: 'factor',
        completedStages: [],
        inputs: { ...EMPTY_INPUTS },
        stageAttempts: 0,
        roundAttempts: 0,
        roundMistakes: 0,
        roundScore: 0,
        feedback: nextFeedback(
          state.feedback,
          'info',
          `Cofre ${vaultIndex + 1} sincronizado`,
          `O novo módulo composto é N = ${challenge.modulus}.`,
        ),
        lastSound: nextSound(state.lastSound, 'select'),
      })
      return true
    },

    restart: () => {
      const state = get()
      set(resetRun(state, challenges, now()))
    },

    returnToIntro: () => {
      set(() => ({
        phase: 'intro',
        vaultIndex: 0,
        challenge: challenges[0],
        stage: 'factor',
        completedStages: [],
        inputs: { ...EMPTY_INPUTS },
        attempts: 0,
        mistakes: 0,
        stageAttempts: 0,
        roundAttempts: 0,
        roundMistakes: 0,
        score: 0,
        roundScore: 0,
        startedAt: null,
        completedAt: null,
        feedback: null,
        lastSound: null,
        roundResults: [],
        result: null,
      }))
    },

    clearFeedback: (feedbackId) => {
      if (get().feedback?.id === feedbackId) set({ feedback: null })
    },
  }))
}

export const useRsaVaultStore = createRsaVaultStore()
