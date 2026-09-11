import { create, type StoreApi, type UseBoundStore } from 'zustand'

import {
  calculateDiffieHellmanXp,
  calculatePublicValue,
  calculateSharedSecret,
  calculateTimeBonus,
  cloneChallenges,
  DIFFIE_HELLMAN_MISTAKE_PENALTY,
  parseRelayAnswer,
  PUBLIC_STAGE_POINTS,
  SECRET_STAGE_POINTS,
} from './diffieHellmanLogic'
import { recordDiffieHellmanProgress } from './progressionAdapter'
import type {
  DiffieHellmanChallenge,
  DiffieHellmanFeedback,
  DiffieHellmanPhase,
  DiffieHellmanProgressInput,
  DiffieHellmanResult,
  DiffieHellmanSoundCue,
  DiffieHellmanSoundEvent,
  RelayPacket,
  TransmissionRecord,
} from './types'

export interface DiffieHellmanState {
  phase: DiffieHellmanPhase
  runId: number
  roundIndex: number
  challenges: readonly DiffieHellmanChallenge[]
  challenge: DiffieHellmanChallenge
  privateExponent: number | null
  publicGuess: string
  publicValue: number | null
  secretGuess: string
  sharedSecret: number | null
  attempts: number
  roundAttempts: number
  mistakes: number
  roundMistakes: number
  score: number
  startedAt: number | null
  completedAt: number | null
  packetSequence: number
  pendingPacket: RelayPacket | null
  feedback: DiffieHellmanFeedback | null
  lastSound: DiffieHellmanSoundCue | null
  transmissions: readonly TransmissionRecord[]
  result: DiffieHellmanResult | null
  start: () => void
  selectPrivateExponent: (value: number) => boolean
  setPublicGuess: (value: string) => void
  submitPublicValue: () => boolean
  resolvePublicTransit: () => boolean
  setSecretGuess: (value: string) => void
  submitSharedSecret: () => boolean
  resolveSecretTransit: () => boolean
  nextRound: () => boolean
  restart: () => void
  returnToIntro: () => void
  clearFeedback: (feedbackId: number) => void
}

export type DiffieHellmanStore = UseBoundStore<StoreApi<DiffieHellmanState>>

export interface DiffieHellmanStoreOptions {
  readonly now?: () => number
  readonly recordProgress?: (input: DiffieHellmanProgressInput) => boolean
}

const INTRO_CHALLENGES = cloneChallenges()

function nextFeedback(
  previous: DiffieHellmanFeedback | null,
  kind: DiffieHellmanFeedback['kind'],
  title: string,
  detail: string,
): DiffieHellmanFeedback {
  return { id: (previous?.id ?? 0) + 1, kind, title, detail }
}

function nextSound(
  previous: DiffieHellmanSoundCue | null,
  event: DiffieHellmanSoundEvent,
): DiffieHellmanSoundCue {
  return { id: (previous?.id ?? 0) + 1, event }
}

function startState(
  state: DiffieHellmanState,
  startedAt: number,
): Partial<DiffieHellmanState> {
  const challenges = cloneChallenges()
  return {
    phase: 'select-private',
    runId: state.runId + 1,
    roundIndex: 0,
    challenges,
    challenge: challenges[0],
    privateExponent: null,
    publicGuess: '',
    publicValue: null,
    secretGuess: '',
    sharedSecret: null,
    attempts: 0,
    roundAttempts: 0,
    mistakes: 0,
    roundMistakes: 0,
    score: 0,
    startedAt,
    completedAt: null,
    packetSequence: 0,
    pendingPacket: null,
    feedback: nextFeedback(
      state.feedback,
      'info',
      'Canal público conectado',
      'Escolha um expoente para o cofre privado de Alice. Ele nunca será transmitido.',
    ),
    lastSound: null,
    transmissions: [],
    result: null,
  }
}

function failedAttempt(
  state: DiffieHellmanState,
  title: string,
  detail: string,
): Partial<DiffieHellmanState> {
  return {
    attempts: state.attempts + 1,
    roundAttempts: state.roundAttempts + 1,
    mistakes: state.mistakes + 1,
    roundMistakes: state.roundMistakes + 1,
    feedback: nextFeedback(state.feedback, 'error', title, detail),
    lastSound: nextSound(state.lastSound, 'error'),
  }
}

export function createDiffieHellmanStore(
  options: DiffieHellmanStoreOptions = {},
): DiffieHellmanStore {
  const now = options.now ?? Date.now
  const recordProgress = options.recordProgress ?? recordDiffieHellmanProgress

  return create<DiffieHellmanState>((set, get) => ({
    phase: 'intro',
    runId: 0,
    roundIndex: 0,
    challenges: INTRO_CHALLENGES,
    challenge: INTRO_CHALLENGES[0],
    privateExponent: null,
    publicGuess: '',
    publicValue: null,
    secretGuess: '',
    sharedSecret: null,
    attempts: 0,
    roundAttempts: 0,
    mistakes: 0,
    roundMistakes: 0,
    score: 0,
    startedAt: null,
    completedAt: null,
    packetSequence: 0,
    pendingPacket: null,
    feedback: null,
    lastSound: null,
    transmissions: [],
    result: null,

    start: () => set(startState(get(), now())),

    selectPrivateExponent: (value) => {
      const state = get()
      if (
        state.phase !== 'select-private' ||
        !state.challenge.privateOptions.includes(value)
      ) {
        return false
      }

      set({
        phase: 'calculate-public',
        privateExponent: value,
        feedback: nextFeedback(
          state.feedback,
          'success',
          'Expoente protegido',
          `a = ${value} foi guardado no cofre local de Alice. Agora derive somente o valor público A.`,
        ),
        lastSound: nextSound(state.lastSound, 'select'),
      })
      return true
    },

    setPublicGuess: (value) => {
      if (get().phase !== 'calculate-public') return
      set({ publicGuess: value })
    },

    submitPublicValue: () => {
      const state = get()
      if (state.phase !== 'calculate-public' || state.privateExponent === null) {
        return false
      }

      const guess = parseRelayAnswer(state.publicGuess, state.challenge.prime)
      const expected = calculatePublicValue(state.challenge, state.privateExponent)
      if (guess !== expected) {
        set(failedAttempt(
          state,
          guess === null ? 'Resíduo inválido' : 'Valor público incorreto',
          guess === null
            ? `Digite um inteiro de 0 a ${state.challenge.prime - 1}.`
            : `Reduza cada multiplicação módulo ${state.challenge.prime} e tente novamente.`,
        ))
        return false
      }

      const packetSequence = state.packetSequence + 1
      set({
        phase: 'public-transit',
        publicValue: expected,
        attempts: state.attempts + 1,
        roundAttempts: state.roundAttempts + 1,
        packetSequence,
        pendingPacket: {
          id: packetSequence,
          kind: 'public',
          label: `A = ${expected}`,
          visibleToEve: true,
        },
        feedback: nextFeedback(
          state.feedback,
          'success',
          'Valor público confirmado',
          `A = ${expected} pode atravessar o relay: conhecer A não revela diretamente o expoente a.`,
        ),
        lastSound: nextSound(state.lastSound, 'send'),
      })
      return true
    },

    resolvePublicTransit: () => {
      const state = get()
      if (state.phase !== 'public-transit') return false
      set({
        phase: 'calculate-secret',
        pendingPacket: null,
        feedback: nextFeedback(
          state.feedback,
          'info',
          'Resposta pública de Bob recebida',
          `B = ${state.challenge.bobPublic} é público. Combine-o localmente com a; não envie o segredo.`,
        ),
      })
      return true
    },

    setSecretGuess: (value) => {
      if (get().phase !== 'calculate-secret') return
      set({ secretGuess: value })
    },

    submitSharedSecret: () => {
      const state = get()
      if (state.phase !== 'calculate-secret' || state.privateExponent === null) {
        return false
      }

      const guess = parseRelayAnswer(state.secretGuess, state.challenge.prime)
      const expected = calculateSharedSecret(state.challenge, state.privateExponent)
      if (guess !== expected) {
        set(failedAttempt(
          state,
          guess === null ? 'Segredo inválido' : 'Segredo não sincronizado',
          guess === null
            ? `Digite um inteiro de 0 a ${state.challenge.prime - 1}.`
            : `Calcule B^a e reduza o resultado módulo ${state.challenge.prime}.`,
        ))
        return false
      }

      const packetSequence = state.packetSequence + 1
      set({
        phase: 'secret-transit',
        sharedSecret: expected,
        attempts: state.attempts + 1,
        roundAttempts: state.roundAttempts + 1,
        packetSequence,
        pendingPacket: {
          id: packetSequence,
          kind: 'confirmation',
          label: 'CANAL CONFIRMADO',
          visibleToEve: true,
        },
        feedback: nextFeedback(
          state.feedback,
          'success',
          'Segredo sincronizado',
          'Alice e Bob chegaram à mesma chave localmente. O relay confirma o canal sem transmitir K.',
        ),
        lastSound: nextSound(state.lastSound, 'send'),
      })
      return true
    },

    resolveSecretTransit: () => {
      const state = get()
      if (
        state.phase !== 'secret-transit' ||
        state.privateExponent === null ||
        state.publicValue === null ||
        state.sharedSecret === null
      ) {
        return false
      }

      const roundScore = Math.max(
        200,
        PUBLIC_STAGE_POINTS[state.roundIndex] +
          SECRET_STAGE_POINTS[state.roundIndex] -
          state.roundMistakes * DIFFIE_HELLMAN_MISTAKE_PENALTY,
      )
      const transmission: TransmissionRecord = {
        challengeId: state.challenge.id,
        privateExponent: state.privateExponent,
        publicValue: state.publicValue,
        sharedSecret: state.sharedSecret,
        attempts: state.roundAttempts,
        mistakes: state.roundMistakes,
        score: roundScore,
      }
      const transmissions = [...state.transmissions, transmission]
      const baseScore = state.score + roundScore

      if (state.roundIndex < state.challenges.length - 1) {
        set({
          phase: 'round-complete',
          score: baseScore,
          pendingPacket: null,
          transmissions,
          feedback: nextFeedback(
            state.feedback,
            'success',
            'Canal estabelecido',
            `A chave está pronta para uma cifra autenticada proteger “${state.challenge.payload}”; K não cruzou o relay.`,
          ),
          lastSound: nextSound(state.lastSound, 'secure'),
        })
        return true
      }

      const completedAt = now()
      const elapsedMs = Math.max(0, completedAt - (state.startedAt ?? completedAt))
      const score = baseScore + calculateTimeBonus(elapsedMs)
      const xp = calculateDiffieHellmanXp(score, state.mistakes)
      let isNewBest = false
      try {
        isNewBest = recordProgress({ score, xp })
      } catch {
        // A persistence failure must not prevent the final transmission.
      }
      const result: DiffieHellmanResult = {
        score,
        xp,
        elapsedMs,
        attempts: state.attempts,
        mistakes: state.mistakes,
        transmissions,
        isNewBest,
      }

      set({
        phase: 'complete',
        score,
        completedAt,
        pendingPacket: null,
        transmissions,
        result,
        feedback: nextFeedback(
          state.feedback,
          'success',
          'Canal seguro estabelecido',
          'Quatro chaves compartilhadas sem transmitir um único segredo.',
        ),
        lastSound: nextSound(state.lastSound, 'complete'),
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
        phase: 'select-private',
        roundIndex,
        challenge,
        privateExponent: null,
        publicGuess: '',
        publicValue: null,
        secretGuess: '',
        sharedSecret: null,
        roundAttempts: 0,
        roundMistakes: 0,
        pendingPacket: null,
        feedback: nextFeedback(
          state.feedback,
          'info',
          `Transmissão ${roundIndex + 1} preparada`,
          `Novos parâmetros públicos: p = ${challenge.prime} e g = ${challenge.generator}.`,
        ),
        lastSound: nextSound(state.lastSound, 'select'),
      })
      return true
    },

    restart: () => set(startState(get(), now())),

    returnToIntro: () => {
      const state = get()
      set({
        phase: 'intro',
        roundIndex: 0,
        challenge: state.challenges[0],
        privateExponent: null,
        publicGuess: '',
        publicValue: null,
        secretGuess: '',
        sharedSecret: null,
        attempts: 0,
        roundAttempts: 0,
        mistakes: 0,
        roundMistakes: 0,
        score: 0,
        startedAt: null,
        completedAt: null,
        packetSequence: 0,
        pendingPacket: null,
        feedback: null,
        lastSound: null,
        transmissions: [],
        result: null,
      })
    },

    clearFeedback: (feedbackId) => {
      if (get().feedback?.id === feedbackId) set({ feedback: null })
    },
  }))
}

export const useDiffieHellmanStore = createDiffieHellmanStore()
