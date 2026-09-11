import { create, type StoreApi, type UseBoundStore } from 'zustand'

import {
  calculateUlamRoundScore,
  calculateUlamXp,
  createUlamMissions,
  getMissionPath,
  ULAM_ROUNDS,
} from './ulamLogic'
import { recordUlamProgress } from './progressionAdapter'
import type {
  UlamDirectionId,
  UlamFeedback,
  UlamMission,
  UlamPhase,
  UlamProgressInput,
  UlamResult,
  UlamRoundResult,
  UlamScan,
  UlamSoundCue,
  UlamSoundEvent,
} from './types'

export interface UlamGalaxyState {
  phase: UlamPhase
  runId: number
  missions: readonly UlamMission[]
  roundIndex: number
  mission: UlamMission
  selectedDirection: UlamDirectionId | null
  pendingScan: UlamScan | null
  scannerEnabled: boolean
  score: number
  mistakes: number
  roundMistakes: number
  startedAt: number | null
  completedAt: number | null
  feedback: UlamFeedback | null
  roundResults: readonly UlamRoundResult[]
  lastSound: UlamSoundCue | null
  result: UlamResult | null
  start: () => void
  selectDirection: (direction: UlamDirectionId) => boolean
  scan: () => boolean
  resolveScan: () => boolean
  nextRound: () => boolean
  toggleScanner: () => void
  restart: () => void
  returnToIntro: () => void
  clearFeedback: (feedbackId: number) => void
}

export type UlamGalaxyStore = UseBoundStore<StoreApi<UlamGalaxyState>>

export interface UlamGalaxyStoreOptions {
  readonly now?: () => number
  readonly recordProgress?: (input: UlamProgressInput) => boolean
  readonly missions?: readonly UlamMission[]
}

const DEFAULT_MISSIONS = createUlamMissions()

function nextFeedback(
  previous: UlamFeedback | null,
  kind: UlamFeedback['kind'],
  title: string,
  detail: string,
): UlamFeedback {
  return { id: (previous?.id ?? 0) + 1, kind, title, detail }
}

function nextSound(previous: UlamSoundCue | null, event: UlamSoundEvent): UlamSoundCue {
  return { id: (previous?.id ?? 0) + 1, event }
}

function checkedMissions(missions: readonly UlamMission[]): readonly UlamMission[] {
  if (
    missions.length !== ULAM_ROUNDS ||
    missions.some((mission, index) => {
      const directionIds = mission.paths.map((path) => path.direction.id)
      const highestPrimeCount = Math.max(...mission.paths.map((path) => path.primeCount))
      const winningPaths = mission.paths.filter((path) => path.primeCount === highestPrimeCount)

      return (
        mission.difficulty !== index + 1 ||
        !Number.isSafeInteger(mission.pathLength) ||
        mission.pathLength < 1 ||
        mission.paths.length !== 4 ||
        new Set(directionIds).size !== 4 ||
        mission.paths.some((path) =>
          path.cells.length !== mission.pathLength ||
          path.primeCount !== path.cells.filter((cell) => cell.prime).length,
        ) ||
        winningPaths.length !== 1 ||
        winningPaths[0]?.direction.id !== mission.correctDirection
      )
    })
  ) throw new Error(`Ulam Galaxy requires ${ULAM_ROUNDS} ordered missions`)
  return missions
}

function runState(
  missions: readonly UlamMission[],
  runId: number,
  startedAt: number,
  feedback: UlamFeedback | null,
): Pick<
  UlamGalaxyState,
  | 'phase'
  | 'runId'
  | 'missions'
  | 'roundIndex'
  | 'mission'
  | 'selectedDirection'
  | 'pendingScan'
  | 'scannerEnabled'
  | 'score'
  | 'mistakes'
  | 'roundMistakes'
  | 'startedAt'
  | 'completedAt'
  | 'feedback'
  | 'roundResults'
  | 'lastSound'
  | 'result'
> {
  return {
    phase: 'playing',
    runId,
    missions,
    roundIndex: 0,
    mission: missions[0],
    selectedDirection: null,
    pendingScan: null,
    scannerEnabled: true,
    score: 0,
    mistakes: 0,
    roundMistakes: 0,
    startedAt,
    completedAt: null,
    feedback: nextFeedback(
      feedback,
      'info',
      'Scanner em órbita',
      'Compare as quatro diagonais e escolha a maior concentração de primos.',
    ),
    roundResults: [],
    lastSound: null,
    result: null,
  }
}

export function createUlamGalaxyStore(
  options: UlamGalaxyStoreOptions = {},
): UlamGalaxyStore {
  const now = options.now ?? Date.now
  const recordProgress = options.recordProgress ?? recordUlamProgress
  const missions = checkedMissions(options.missions ?? DEFAULT_MISSIONS)

  return create<UlamGalaxyState>((set, get) => ({
    phase: 'intro',
    runId: 0,
    missions,
    roundIndex: 0,
    mission: missions[0],
    selectedDirection: null,
    pendingScan: null,
    scannerEnabled: true,
    score: 0,
    mistakes: 0,
    roundMistakes: 0,
    startedAt: null,
    completedAt: null,
    feedback: null,
    roundResults: [],
    lastSound: null,
    result: null,

    start: () => {
      const state = get()
      set(runState(missions, state.runId + 1, now(), state.feedback))
    },

    selectDirection: (direction) => {
      const state = get()
      if (state.phase !== 'playing' || !state.mission.paths.some((path) => path.direction.id === direction)) {
        return false
      }
      set({
        selectedDirection: direction,
        lastSound: nextSound(state.lastSound, 'select'),
      })
      return true
    },

    scan: () => {
      const state = get()
      if (state.phase !== 'playing' || !state.selectedDirection) return false
      const path = getMissionPath(state.mission, state.selectedDirection)
      const pendingScan: UlamScan = {
        direction: state.selectedDirection,
        isCorrect: state.selectedDirection === state.mission.correctDirection,
        primeCount: path.primeCount,
      }
      set({
        phase: 'scanning',
        pendingScan,
        feedback: nextFeedback(
          state.feedback,
          'info',
          `Trajetória ${path.direction.symbol} em análise`,
          `${path.cells.length} setores entrando no espectrômetro.`,
        ),
        lastSound: nextSound(state.lastSound, 'scan'),
      })
      return true
    },

    resolveScan: () => {
      const state = get()
      if (state.phase !== 'scanning' || !state.pendingScan) return false
      const scan = state.pendingScan
      const path = getMissionPath(state.mission, scan.direction)

      if (!scan.isCorrect) {
        const mistakes = state.mistakes + 1
        const roundMistakes = state.roundMistakes + 1
        set({
          phase: 'playing',
          pendingScan: null,
          selectedDirection: null,
          mistakes,
          roundMistakes,
          feedback: nextFeedback(
            state.feedback,
            'error',
            'Densidade insuficiente',
            `A trajetória ${path.direction.symbol} contém ${path.primeCount} ${path.primeCount === 1 ? 'primo' : 'primos'}. Compare outra diagonal.`,
          ),
          lastSound: nextSound(state.lastSound, 'error'),
        })
        return false
      }

      const points = calculateUlamRoundScore(state.mission, state.roundMistakes)
      const roundResult: UlamRoundResult = {
        ...scan,
        missionId: state.mission.id,
        points,
        mistakes: state.roundMistakes,
      }
      const score = state.score + points
      const roundResults = [...state.roundResults, roundResult]
      const isLastRound = state.roundIndex === ULAM_ROUNDS - 1

      if (!isLastRound) {
        set({
          phase: 'round-complete',
          pendingScan: null,
          score,
          roundResults,
          feedback: nextFeedback(
            state.feedback,
            'success',
            'Diagonal confirmada',
            `${path.primeCount} primos formam a trajetória dominante desta região.`,
          ),
          lastSound: nextSound(state.lastSound, 'correct'),
        })
        return true
      }

      const completedAt = now()
      const elapsedMs = Math.max(0, completedAt - (state.startedAt ?? completedAt))
      const xp = calculateUlamXp(score, state.mistakes)
      let isNewBest = false
      try {
        isNewBest = recordProgress({ score, xp })
      } catch {
        // Progression persistence cannot interrupt the observatory.
      }
      const result: UlamResult = {
        score,
        xp,
        elapsedMs,
        mistakes: state.mistakes,
        rounds: roundResults,
        isNewBest,
      }
      set({
        phase: 'complete',
        pendingScan: null,
        score,
        completedAt,
        roundResults,
        result,
        feedback: nextFeedback(
          state.feedback,
          'success',
          'Mapa de Ulam concluído',
          'As cinco regiões foram cartografadas.',
        ),
        lastSound: nextSound(state.lastSound, 'complete'),
      })
      return true
    },

    nextRound: () => {
      const state = get()
      if (state.phase !== 'round-complete' || state.roundIndex >= ULAM_ROUNDS - 1) return false
      const roundIndex = state.roundIndex + 1
      set({
        phase: 'playing',
        roundIndex,
        mission: state.missions[roundIndex],
        selectedDirection: null,
        pendingScan: null,
        roundMistakes: 0,
        feedback: nextFeedback(
          state.feedback,
          'info',
          `Região ${roundIndex + 1} carregada`,
          `A malha agora contém ${state.missions[roundIndex].size ** 2} setores.`,
        ),
      })
      return true
    },

    toggleScanner: () => {
      const state = get()
      if (state.phase === 'intro' || state.phase === 'complete') return
      set({ scannerEnabled: !state.scannerEnabled })
    },

    restart: () => {
      const state = get()
      set(runState(missions, state.runId + 1, now(), state.feedback))
    },

    returnToIntro: () => {
      const state = get()
      set({
        phase: 'intro',
        runId: state.runId,
        roundIndex: 0,
        mission: missions[0],
        selectedDirection: null,
        pendingScan: null,
        scannerEnabled: true,
        score: 0,
        mistakes: 0,
        roundMistakes: 0,
        startedAt: null,
        completedAt: null,
        feedback: null,
        roundResults: [],
        lastSound: null,
        result: null,
      })
    },

    clearFeedback: (feedbackId) => {
      if (get().feedback?.id === feedbackId) set({ feedback: null })
    },
  }))
}

export const useUlamGalaxyStore = createUlamGalaxyStore()
