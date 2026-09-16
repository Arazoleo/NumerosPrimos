import { create, type StoreApi, type UseBoundStore } from 'zustand'

import {
  calculateDefenseXp,
  calculateWaveBonus,
  createWaveEnemies,
  DEFENSE_STARTING_LIVES,
  DEFENSE_WAVES,
  evaluateDefenseEnemy,
  getPlacementEnergy,
  TOWER_COSTS,
  towerId,
} from './defenseLogic'
import { recordPrimeDefenseProgress } from './progressionAdapter'
import type {
  DefenseDivisor,
  DefenseEnemy,
  DefenseFeedback,
  DefenseLane,
  DefenseOutcome,
  DefensePhase,
  DefenseProgressInput,
  DefenseResult,
  DefenseSlot,
  DefenseWaveSummary,
  TowerPlacement,
} from './types'

const BEST_SCORE_KEY = 'primeverse.prime-defense.best.v1'

export interface PrimeDefenseState {
  phase: DefensePhase
  runId: number
  waveIndex: number
  placements: readonly TowerPlacement[]
  selectedDivisor: DefenseDivisor
  runQueue: readonly DefenseEnemy[]
  activeEnemyIndex: number
  currentWaveOutcomes: readonly DefenseOutcome[]
  recentOutcomes: readonly DefenseOutcome[]
  waveSummaries: readonly DefenseWaveSummary[]
  lives: number
  coreCharge: number
  score: number
  intercepted: number
  primesPassed: number
  breaches: number
  startedAt: number | null
  completedAt: number | null
  feedback: DefenseFeedback | null
  result: DefenseResult | null
  bestScore: number
  
  tutorialStep: number
  isTutorialActive: boolean
  
  nextTutorialStep: () => void
  skipTutorial: () => void
  startTutorial: () => void
  
  selectDivisor: (divisor: DefenseDivisor) => void
  placeTower: (lane: DefenseLane, slot: DefenseSlot, divisor?: DefenseDivisor) => boolean
  removeTower: (lane: DefenseLane, slot: DefenseSlot) => boolean
  start: () => void
  launchWave: () => boolean
  resolveNextEnemy: () => DefenseOutcome | null
  nextWave: () => boolean
  restart: () => void
  returnToIntro: () => void
  clearFeedback: (feedbackId: number) => void
}

export type PrimeDefenseStore = UseBoundStore<StoreApi<PrimeDefenseState>>

export interface PrimeDefenseStoreOptions {
  readonly now?: () => number
  readonly recordProgress?: (input: DefenseProgressInput) => boolean
  readonly initialBestScore?: number
  readonly saveBestScore?: (score: number) => void
}

function readBestScore(): number {
  if (typeof window === 'undefined') return 0

  try {
    const stored = Number(window.localStorage.getItem(BEST_SCORE_KEY))
    return Number.isSafeInteger(stored) && stored > 0 ? stored : 0
  } catch {
    return 0
  }
}

function writeBestScore(score: number): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(score))
  } catch {
    // Gameplay must remain available when storage is disabled.
  }
}

function nextFeedback(
  previous: DefenseFeedback | null,
  kind: DefenseFeedback['kind'],
  title: string,
  detail: string,
): DefenseFeedback {
  return {
    id: (previous?.id ?? 0) + 1,
    kind,
    title,
    detail,
  }
}

function emptyRun(
  runId: number,
  startedAt: number,
  bestScore: number,
  previousFeedback: DefenseFeedback | null,
): Omit<PrimeDefenseState, keyof PrimeDefenseActions> {
  return {
    phase: 'planning',
    runId,
    waveIndex: 0,
    placements: [],
    selectedDivisor: 2,
    runQueue: [],
    activeEnemyIndex: 0,
    currentWaveOutcomes: [],
    recentOutcomes: [],
    waveSummaries: [],
    lives: DEFENSE_STARTING_LIVES,
    coreCharge: 0,
    score: 0,
    intercepted: 0,
    primesPassed: 0,
    breaches: 0,
    startedAt,
    completedAt: null,
    feedback: nextFeedback(
      previousFeedback,
      'info',
      'Defesas online',
      `Onda 1: distribua ${DEFENSE_WAVES[0].energy} unidades de energia.`,
    ),
    result: null,
    bestScore,
    tutorialStep: 0,
    isTutorialActive: false,
  }
}

type PrimeDefenseActions = Pick<
  PrimeDefenseState,
  | 'selectDivisor'
  | 'placeTower'
  | 'removeTower'
  | 'start'
  | 'launchWave'
  | 'resolveNextEnemy'
  | 'nextWave'
  | 'restart'
  | 'returnToIntro'
  | 'clearFeedback'
  | 'nextTutorialStep'
  | 'skipTutorial'
  | 'startTutorial'
>

export function createPrimeDefenseStore(
  options: PrimeDefenseStoreOptions = {},
): PrimeDefenseStore {
  const now = options.now ?? Date.now
  const recordProgress = options.recordProgress ?? recordPrimeDefenseProgress
  const saveBestScore = options.saveBestScore ?? writeBestScore
  const initialBestScore = options.initialBestScore ?? readBestScore()

  return create<PrimeDefenseState>((set, get) => {
    const finishRun = (
      state: PrimeDefenseState,
      outcome: DefenseOutcome,
      nextValues: {
        lives: number
        coreCharge: number
        score: number
        intercepted: number
        primesPassed: number
        breaches: number
        currentWaveOutcomes: readonly DefenseOutcome[]
        recentOutcomes: readonly DefenseOutcome[]
        waveSummaries: readonly DefenseWaveSummary[]
      },
      victory: boolean,
    ): void => {
      const completedAt = now()
      const xp = calculateDefenseXp(nextValues.score, victory)
      const localNewBest = nextValues.score > state.bestScore
      let progressionNewBest = false

      try {
        progressionNewBest = recordProgress({ score: nextValues.score, xp })
      } catch {
        // Progress persistence cannot interrupt a completed defense run.
      }

      const bestScore = Math.max(state.bestScore, nextValues.score)
      if (localNewBest) {
        try {
          saveBestScore(bestScore)
        } catch {
          // Local best-score persistence must not hold the simulation open.
        }
      }

      const result: DefenseResult = {
        victory,
        score: nextValues.score,
        xp,
        elapsedMs: Math.max(0, completedAt - (state.startedAt ?? completedAt)),
        wavesCleared: nextValues.waveSummaries.length,
        intercepted: nextValues.intercepted,
        primesPassed: nextValues.primesPassed,
        breaches: nextValues.breaches,
        livesRemaining: nextValues.lives,
        coreCharge: nextValues.coreCharge,
        isNewBest: progressionNewBest || localNewBest,
      }

      set({
        ...nextValues,
        phase: victory ? 'victory' : 'defeat',
        activeEnemyIndex: state.activeEnemyIndex,
        completedAt,
        result,
        bestScore,
        feedback: nextFeedback(
          state.feedback,
          victory ? 'success' : 'error',
          victory ? 'Núcleo preservado' : 'Núcleo comprometido',
          victory
            ? `Cinco ondas contidas. ${nextValues.coreCharge} primos energizaram a estação.`
            : `${outcome.enemy.value} atravessou a última camada de integridade.`,
        ),
      })
    }

    return {
      phase: 'intro',
      runId: 0,
      waveIndex: 0,
      placements: [],
      selectedDivisor: 2,
      runQueue: [],
      activeEnemyIndex: 0,
      currentWaveOutcomes: [],
      recentOutcomes: [],
      waveSummaries: [],
      lives: DEFENSE_STARTING_LIVES,
      coreCharge: 0,
      score: 0,
      intercepted: 0,
      primesPassed: 0,
      breaches: 0,
      startedAt: null,
      completedAt: null,
      feedback: null,
      result: null,
      bestScore: initialBestScore,
      tutorialStep: 0,
      isTutorialActive: false,

      selectDivisor: (divisor) => {
        const state = get()
        if (state.phase !== 'planning') return
        set({
          selectedDivisor: divisor,
          feedback: nextFeedback(
            state.feedback,
            'info',
            `Filtro ${divisor} selecionado`,
            `Custa ${TOWER_COSTS[divisor]} unidades e captura múltiplos de ${divisor}.`,
          ),
        })
      },

      placeTower: (lane, slot, requestedDivisor) => {
        const state = get()
        if (state.phase !== 'planning') return false

        const divisor = requestedDivisor ?? state.selectedDivisor
        const id = towerId(lane, slot)
        const existing = state.placements.find((placement) => placement.id === id)

        if (existing?.divisor === divisor) {
          set({
            placements: state.placements.filter((placement) => placement.id !== id),
            feedback: nextFeedback(
              state.feedback,
              'info',
              `Filtro ${divisor} recolhido`,
              `A energia do slot da pista ${lane + 1} foi devolvida.`,
            ),
          })
          return true
        }

        const placement: TowerPlacement = { id, lane, slot, divisor }
        const placements = [
          ...state.placements.filter((candidate) => candidate.id !== id),
          placement,
        ]
        const wave = DEFENSE_WAVES[state.waveIndex]
        const energy = getPlacementEnergy(placements)

        if (!wave || energy > wave.energy) {
          set({
            feedback: nextFeedback(
              state.feedback,
              'error',
              'Energia insuficiente',
              `O filtro ${divisor} custa ${TOWER_COSTS[divisor]}; remova ou troque outra torre.`,
            ),
          })
          return false
        }

        set({
          placements,
          feedback: nextFeedback(
            state.feedback,
            'success',
            `Filtro ${divisor} instalado`,
            `Pista ${lane + 1}: todo composto divisível por ${divisor} será interceptado.`,
          ),
        })
        return true
      },

      removeTower: (lane, slot) => {
        const state = get()
        if (state.phase !== 'planning') return false
        const id = towerId(lane, slot)
        const existing = state.placements.find((placement) => placement.id === id)
        if (!existing) return false

        set({
          placements: state.placements.filter((placement) => placement.id !== id),
          feedback: nextFeedback(
            state.feedback,
            'info',
            `Filtro ${existing.divisor} removido`,
            `${TOWER_COSTS[existing.divisor]} unidades de energia recuperadas.`,
          ),
        })
        return true
      },

      start: () => {
        const state = get()
        set(emptyRun(state.runId + 1, now(), state.bestScore, state.feedback))

        set({
          ...emptyRun(state.runId + 1, now(), state.bestScore, state.feedback),
          isTutorialActive: true,
          tutorialStep: 1,
        })
      },

      launchWave: () => {
        const state = get()
        if (state.phase !== 'planning') return false
        const wave = DEFENSE_WAVES[state.waveIndex]
        if (!wave) return false

        const runQueue = createWaveEnemies(wave, state.waveIndex)
        if (runQueue.length === 0) return false

        set({
          phase: 'running',
          runQueue,
          activeEnemyIndex: 0,
          currentWaveOutcomes: [],
          feedback: nextFeedback(
            state.feedback,
            'info',
            `Onda ${state.waveIndex + 1} lançada`,
            `${runQueue.length} assinaturas entrando nas três pistas.`,
          ),
        })
        return true
      },

      resolveNextEnemy: () => {
        const state = get()
        if (state.phase !== 'running') return null
        const enemy = state.runQueue[state.activeEnemyIndex]
        if (!enemy) return null

        const outcome = evaluateDefenseEnemy(enemy, state.placements)
        const currentWaveOutcomes = [...state.currentWaveOutcomes, outcome]
        const recentOutcomes = [...state.recentOutcomes, outcome].slice(-8)
        const lives = Math.max(0, state.lives + outcome.lifeDelta)
        const coreCharge = state.coreCharge + outcome.chargeDelta
        const intercepted = state.intercepted + (outcome.kind === 'intercepted' ? 1 : 0)
        const primesPassed = state.primesPassed + (outcome.kind === 'prime-passed' ? 1 : 0)
        const breaches = state.breaches + (outcome.kind === 'breach' ? 1 : 0)
        const baseScore = state.score + outcome.points
        const isLastEnemy = state.activeEnemyIndex >= state.runQueue.length - 1

        const outcomeTitle = outcome.kind === 'intercepted'
          ? `${enemy.value} interceptado`
          : outcome.kind === 'prime-passed'
            ? `${enemy.value} autenticado como primo`
            : `${enemy.value} rompeu a defesa`

        const commonValues = {
          lives,
          coreCharge,
          intercepted,
          primesPassed,
          breaches,
          currentWaveOutcomes,
          recentOutcomes,
        }

        if (lives <= 0) {
          finishRun(
            state,
            outcome,
            {
              ...commonValues,
              score: baseScore,
              waveSummaries: state.waveSummaries,
            },
            false,
          )
          return outcome
        }

        if (!isLastEnemy) {
          set({
            ...commonValues,
            score: baseScore,
            activeEnemyIndex: state.activeEnemyIndex + 1,
            feedback: nextFeedback(
              state.feedback,
              outcome.kind === 'breach' ? 'error' : 'success',
              outcomeTitle,
              outcome.explanation,
            ),
          })
          return outcome
        }

        const waveBreaches = currentWaveOutcomes
          .filter((candidate) => candidate.kind === 'breach').length
        const waveIntercepted = currentWaveOutcomes
          .filter((candidate) => candidate.kind === 'intercepted').length
        const wavePrimes = currentWaveOutcomes
          .filter((candidate) => candidate.kind === 'prime-passed').length
        const bonus = calculateWaveBonus(state.waveIndex, waveBreaches)
        const score = baseScore + bonus
        const summary: DefenseWaveSummary = {
          waveIndex: state.waveIndex,
          intercepted: waveIntercepted,
          primesPassed: wavePrimes,
          breaches: waveBreaches,
          points: currentWaveOutcomes.reduce((total, candidate) => total + candidate.points, 0) + bonus,
          perfect: waveBreaches === 0,
        }
        const waveSummaries = [...state.waveSummaries, summary]
        const finalWave = state.waveIndex === DEFENSE_WAVES.length - 1

        if (finalWave) {
          finishRun(
            state,
            outcome,
            { ...commonValues, score, waveSummaries },
            true,
          )
          return outcome
        }

        set({
          ...commonValues,
          phase: 'wave-result',
          score,
          waveSummaries,
          feedback: nextFeedback(
            state.feedback,
            waveBreaches === 0 ? 'success' : 'info',
            waveBreaches === 0 ? 'Onda perfeita' : 'Onda contida',
            waveBreaches === 0
              ? `Cobertura integral: bônus de ${bonus} pontos.`
              : `${waveBreaches} composto${waveBreaches === 1 ? '' : 's'} alcançaram o núcleo.`,
          ),
        })
        return outcome
      },

      nextWave: () => {
        const state = get()
        if (state.phase !== 'wave-result') return false
        const waveIndex = state.waveIndex + 1
        const wave = DEFENSE_WAVES[waveIndex]
        if (!wave) return false

        set({
          phase: 'planning',
          waveIndex,
          placements: [],
          selectedDivisor: 2,
          runQueue: [],
          activeEnemyIndex: 0,
          currentWaveOutcomes: [],
          feedback: nextFeedback(
            state.feedback,
            'info',
            `Onda ${waveIndex + 1}: ${wave.name}`,
            `${wave.energy} unidades disponíveis para uma nova malha de filtros.`,
          ),
        })
        return true
      },

      restart: () => {
        const state = get()
        set(emptyRun(state.runId + 1, now(), state.bestScore, state.feedback))
      },

      returnToIntro: () => {
        set({
          phase: 'intro',
          waveIndex: 0,
          placements: [],
          selectedDivisor: 2,
          runQueue: [],
          activeEnemyIndex: 0,
          currentWaveOutcomes: [],
          recentOutcomes: [],
          waveSummaries: [],
          lives: DEFENSE_STARTING_LIVES,
          coreCharge: 0,
          score: 0,
          intercepted: 0,
          primesPassed: 0,
          breaches: 0,
          startedAt: null,
          completedAt: null,
          feedback: null,
          result: null,
        })
      },

      clearFeedback: (feedbackId) => {
        if (get().feedback?.id === feedbackId) set({ feedback: null })
      },
    
      nextTutorialStep: () => 
        set((state) => {
          if (state.tutorialStep < 8) {
            return { tutorialStep: state.tutorialStep + 1 }
          }
          return { isTutorialActive: false, tutorialStep: 0 } 
        }),

      skipTutorial: () => {
        set({ isTutorialActive: false })
      },

      startTutorial: () => {
        set({ isTutorialActive: true, tutorialStep: 1 })
      },
    }
  })
}

export const usePrimeDefenseStore = createPrimeDefenseStore()
