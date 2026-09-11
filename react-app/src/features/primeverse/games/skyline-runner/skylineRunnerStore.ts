import { create, type StoreApi, type UseBoundStore } from 'zustand'

import {
  SKYLINE_DIALOGUES,
  SKYLINE_OBJECTIVES,
  SKYLINE_SENTINEL_IDS,
  SKYLINE_SENTINELS,
  type SkylineDialogueId,
  type SkylineNpcId,
  type SkylinePrimeCoreValue,
  type SkylineSentinelId,
} from './missionData'
import {
  activateApexBeacon,
  collectPrimeCore,
  deliverPrimeCores,
  getNextSkylineObjective,
  INITIAL_SKYLINE_MISSION_PROGRESS,
  isSkylineMissionComplete,
  reachApexSpire,
  recordNpcConversation,
  recordSentinelDefeat,
  type SkylineMissionProgress,
} from './missionLogic'
import { calculateParkourScore } from './parkourLogic'
import { calculatePrimeDamage } from './primeCombat'

export type RunnerMovementState =
  | 'PARADO'
  | 'CORRIDA'
  | 'SPRINT'
  | 'SALTO'
  | 'WALL RUN'
  | 'GRAPPLE'
  | 'QUEDA'
  | 'SLIDE'
  | 'ESCALADA'

export type RunnerNearby = `npc:${SkylineNpcId}` | 'beacon' | null

export interface RunnerDialogueState {
  readonly id: SkylineDialogueId
  readonly lineIndex: number
}

export interface RunnerToast {
  readonly id: number
  readonly tone: 'cyan' | 'amber' | 'danger'
  readonly title: string
  readonly detail: string
}

export interface RunnerTelemetry {
  readonly elapsedMs: number
  readonly speed: number
  readonly stamina: number
  readonly flow: number
  readonly maxFlow: number
  readonly movement: RunnerMovementState
  readonly grappleTarget: string | null
  readonly grappleDistance: number | null
  readonly grappleAttached: boolean
  readonly enemyTarget: SkylineSentinelId | null
  /** Remaining selected-spell cooldown, normalized from ready (0) to full (1). */
  readonly spellCooldown: number
  readonly sector: string
}

export interface SkylineRunnerResult {
  readonly score: number
  readonly xp: number
  readonly elapsedMs: number
  readonly maxFlow: number
  readonly enemiesDefeated: number
  readonly falls: number
}

export interface SkylineRunnerState {
  readonly runId: number
  readonly mission: SkylineMissionProgress
  readonly health: number
  readonly falls: number
  readonly stylePoints: number
  readonly checkpointId: string
  readonly checkpointOrder: number
  readonly controlsCaptured: boolean
  readonly nearby: RunnerNearby
  readonly activeDialogue: RunnerDialogueState | null
  readonly toast: RunnerToast | null
  readonly damagePulse: number
  readonly enemyHealth: Readonly<Record<SkylineSentinelId, number>>
  readonly enemyFactors: Readonly<Record<SkylineSentinelId, readonly SkylinePrimeCoreValue[]>>
  readonly telemetry: RunnerTelemetry
  readonly startedAt: number
  readonly completedAt: number | null
  readonly result: SkylineRunnerResult | null
  readonly defeated: boolean
  reset: () => void
  setControlsCaptured: (captured: boolean) => void
  setNearby: (nearby: RunnerNearby) => void
  interact: () => boolean
  advanceDialogue: () => void
  collectCore: (value: SkylinePrimeCoreValue) => boolean
  damageEnemy: (id: SkylineSentinelId, amount?: number) => 'locked' | 'hit' | 'defeated' | 'ignored'
  castPrimeAtEnemy: (id: SkylineSentinelId, prime: SkylinePrimeCoreValue) => 'locked' | 'resisted' | 'hit' | 'defeated' | 'ignored'
  takeDamage: (amount: number) => boolean
  recordFall: () => boolean
  reachCheckpoint: (id: string, order: number) => boolean
  reachApex: () => boolean
  updateTelemetry: (update: Partial<RunnerTelemetry>) => void
  addStylePoints: (amount: number) => void
  clearToast: (id: number) => void
}

export type SkylineRunnerStore = UseBoundStore<StoreApi<SkylineRunnerState>>

const INITIAL_ENEMY_HEALTH: Readonly<Record<SkylineSentinelId, number>> = {
  'sentinel-four': 100,
  'sentinel-six': 100,
  'sentinel-nine': 100,
  'sentinel-ten': 100,
}

function createInitialEnemyFactors(): Readonly<Record<SkylineSentinelId, readonly SkylinePrimeCoreValue[]>> {
  return SKYLINE_SENTINEL_IDS.reduce<Record<SkylineSentinelId, readonly SkylinePrimeCoreValue[]>>(
    (factors, id) => {
      factors[id] = [...SKYLINE_SENTINELS[id].primeFactors]
      return factors
    },
    {} as Record<SkylineSentinelId, readonly SkylinePrimeCoreValue[]>,
  )
}

const INITIAL_TELEMETRY: RunnerTelemetry = {
  elapsedMs: 0,
  speed: 0,
  stamina: 100,
  flow: 0,
  maxFlow: 0,
  movement: 'PARADO',
  grappleTarget: null,
  grappleDistance: null,
  grappleAttached: false,
  enemyTarget: null,
  spellCooldown: 0,
  sector: 'BASE // AURORA',
}

function nextToast(
  current: RunnerToast | null,
  tone: RunnerToast['tone'],
  title: string,
  detail: string,
): RunnerToast {
  return { id: (current?.id ?? 0) + 1, tone, title, detail }
}

function completionResult(state: SkylineRunnerState): SkylineRunnerResult {
  const elapsedMs = Math.max(0, Math.round(state.telemetry.elapsedMs))
  const score = calculateParkourScore({
    completed: true,
    elapsedMs: Math.floor(elapsedMs),
    checkpointsReached: state.checkpointOrder + 1,
    collectibles: state.mission.collectedPrimeCores.length,
    falls: state.falls,
    stylePoints: Math.max(0, Math.floor(state.stylePoints)),
  })
  return {
    score,
    xp: 220 + Math.round(state.telemetry.maxFlow) + Math.max(0, 80 - state.falls * 15),
    elapsedMs,
    maxFlow: state.telemetry.maxFlow,
    enemiesDefeated: state.mission.defeatedSentinelIds.length,
    falls: state.falls,
  }
}

export function createSkylineRunnerStore(now: () => number = Date.now): SkylineRunnerStore {
  return create<SkylineRunnerState>((set, get) => ({
    runId: 1,
    mission: { ...INITIAL_SKYLINE_MISSION_PROGRESS },
    health: 100,
    falls: 0,
    stylePoints: 0,
    checkpointId: 'base',
    checkpointOrder: 0,
    controlsCaptured: false,
    nearby: null,
    activeDialogue: null,
    toast: nextToast(null, 'cyan', 'CANAL ABERTO', 'Encontre LIA no terraço inicial.'),
    damagePulse: 0,
    enemyHealth: { ...INITIAL_ENEMY_HEALTH },
    enemyFactors: createInitialEnemyFactors(),
    telemetry: { ...INITIAL_TELEMETRY },
    startedAt: now(),
    completedAt: null,
    result: null,
    defeated: false,

    reset: () => set((state) => ({
      runId: state.runId + 1,
      mission: { ...INITIAL_SKYLINE_MISSION_PROGRESS },
      health: 100,
      falls: 0,
      stylePoints: 0,
      checkpointId: 'base',
      checkpointOrder: 0,
      controlsCaptured: false,
      nearby: null,
      activeDialogue: null,
      toast: nextToast(state.toast, 'cyan', 'CANAL ABERTO', 'Encontre LIA no terraço inicial.'),
      damagePulse: 0,
      enemyHealth: { ...INITIAL_ENEMY_HEALTH },
      enemyFactors: createInitialEnemyFactors(),
      telemetry: { ...INITIAL_TELEMETRY },
      startedAt: now(),
      completedAt: null,
      result: null,
      defeated: false,
    })),

    setControlsCaptured: (controlsCaptured) => set({ controlsCaptured }),
    setNearby: (nearby) => set((state) => state.nearby === nearby ? state : { nearby }),

    interact: () => {
      const state = get()
      if (state.defeated || state.result || state.activeDialogue || !state.nearby) return false
      if (state.nearby === 'npc:lia') {
        if (state.mission.spokenNpcIds.includes('lia')) {
          set({ toast: nextToast(state.toast, 'cyan', 'LIA // COMMS', 'Siga os marcadores da tríade prima.') })
          return true
        }
        set({ activeDialogue: { id: 'lia-briefing', lineIndex: 0 }, controlsCaptured: false })
        return true
      }
      if (state.nearby === 'npc:nilo') {
        if (state.mission.coresDeliveredToNilo) {
          set({ toast: nextToast(state.toast, 'amber', 'NILO // RELAY', 'As Sentinelas já estão vulneráveis ao seu pulso.') })
          return true
        }
        if (state.mission.collectedPrimeCores.length < 3) {
          set({ toast: nextToast(state.toast, 'amber', 'ASSINATURA INCOMPLETA', 'Nilo precisa dos núcleos 2, 3 e 5.') })
          return false
        }
        set({ activeDialogue: { id: 'nilo-delivery', lineIndex: 0 }, controlsCaptured: false })
        return true
      }
      if (state.nearby === 'beacon') {
        const mission = activateApexBeacon(state.mission)
        if (mission === state.mission) {
          set({ toast: nextToast(state.toast, 'amber', 'FAROL BLOQUEADO', getNextSkylineObjective(state.mission).detail) })
          return false
        }
        const completedAt = now()
        const interim = { ...state, mission } as SkylineRunnerState
        set({
          mission,
          completedAt,
          result: isSkylineMissionComplete(mission) ? completionResult(interim) : null,
          controlsCaptured: false,
          nearby: null,
          toast: nextToast(state.toast, 'cyan', 'SKYLINE EM SINCRONIA', 'O farol primo voltou a iluminar a cidade.'),
        })
        return true
      }
      return false
    },

    advanceDialogue: () => {
      const state = get()
      const active = state.activeDialogue
      if (!active) return
      const dialogue = SKYLINE_DIALOGUES[active.id]
      if (active.lineIndex < dialogue.lines.length - 1) {
        set({ activeDialogue: { ...active, lineIndex: active.lineIndex + 1 } })
        return
      }

      let mission = state.mission
      let toast = state.toast
      if (active.id === 'lia-briefing') {
        mission = recordNpcConversation(mission, 'lia')
        toast = nextToast(toast, 'cyan', 'ROTA LIBERADA', 'Colete os núcleos 2, 3 e 5.')
      } else if (active.id === 'nilo-delivery') {
        mission = recordNpcConversation(mission, 'nilo')
        mission = deliverPrimeCores(mission)
        toast = nextToast(toast, 'amber', 'MAGIA PRIMA ATIVA', 'Use 2, 3 ou 5 para equipar; F dispara contra o fator correto.')
      } else if (active.id === 'apex-extraction') {
        toast = nextToast(toast, 'cyan', 'EXTRAÇÃO PRONTA', 'Aproxime-se do farol e pressione E.')
      }
      set({ activeDialogue: null, mission, toast })
    },

    collectCore: (value) => {
      const state = get()
      const mission = collectPrimeCore(state.mission, value)
      if (mission === state.mission) return false
      const complete = mission.collectedPrimeCores.length === 3
      set({
        mission,
        stylePoints: state.stylePoints + 225,
        toast: nextToast(
          state.toast,
          complete ? 'amber' : 'cyan',
          complete ? 'TRÍADE PRIMA COMPLETA' : `NÚCLEO ${value} RECUPERADO`,
          complete ? 'Leve a assinatura 2 · 3 · 5 até NILO.' : 'O próximo núcleo apareceu na rota.',
        ),
        activeDialogue: complete ? { id: 'lia-cores-online', lineIndex: 0 } : state.activeDialogue,
        controlsCaptured: complete ? false : state.controlsCaptured,
      })
      return true
    },

    damageEnemy: (id, amount = 52) => {
      const state = get()
      if (state.defeated || state.result || state.activeDialogue) return 'ignored'
      if (!state.mission.coresDeliveredToNilo) {
        set({ toast: nextToast(state.toast, 'amber', 'BLINDAGEM COMPOSTA', 'Entregue a tríade a NILO para armar o pulso.') })
        return 'locked'
      }
      if (state.mission.defeatedSentinelIds.includes(id) || amount <= 0) return 'ignored'
      const health = Math.max(0, state.enemyHealth[id] - amount)
      const enemyHealth = { ...state.enemyHealth, [id]: health }
      if (health > 0) {
        const factorCount = SKYLINE_SENTINELS[id].primeFactors.length
        const remainingCount = Math.min(
          state.enemyFactors[id].length,
          Math.ceil(health / (100 / Math.max(1, factorCount))),
        )
        const enemyFactors = {
          ...state.enemyFactors,
          [id]: state.enemyFactors[id].slice(-remainingCount),
        }
        set({ enemyHealth, enemyFactors, stylePoints: state.stylePoints + 45 })
        return 'hit'
      }
      const mission = recordSentinelDefeat(state.mission, id)
      const allDefeated = mission.defeatedSentinelIds.length === SKYLINE_SENTINEL_IDS.length
      set({
        enemyHealth,
        enemyFactors: { ...state.enemyFactors, [id]: [] },
        mission,
        stylePoints: state.stylePoints + 325,
        toast: nextToast(
          state.toast,
          allDefeated ? 'cyan' : 'amber',
          allDefeated ? 'ROTA APEX LIBERADA' : 'COMPOSTO FATORADO',
          allDefeated ? 'Suba até a Agulha e alcance o farol.' : `${mission.defeatedSentinelIds.length}/4 Sentinelas neutralizadas.`,
        ),
      })
      return 'defeated'
    },

    castPrimeAtEnemy: (id, prime) => {
      const state = get()
      if (state.defeated || state.result || state.activeDialogue) return 'ignored'
      if (!state.mission.coresDeliveredToNilo) {
        set({ toast: nextToast(state.toast, 'amber', 'BLINDAGEM COMPOSTA', 'Entregue a tríade a NILO para armar os poderes primos.') })
        return 'locked'
      }
      if (state.mission.defeatedSentinelIds.includes(id)) return 'ignored'

      const factors = state.enemyFactors[id]
      const factorIndex = factors.indexOf(prime)
      if (factorIndex === -1) {
        const sentinel = SKYLINE_SENTINELS[id]
        const sealAlreadyBroken = sentinel.primeFactors.includes(prime)
        set({
          toast: nextToast(
            state.toast,
            'danger',
            sealAlreadyBroken ? 'SELO JÁ ROMPIDO' : 'FATOR REJEITADO',
            sealAlreadyBroken
              ? `O selo ${prime} de ${sentinel.compositeNumber} já caiu. Resta ${factors.join(' × ')}.`
              : `${prime} não divide ${sentinel.compositeNumber}. A blindagem resistiu ao disparo.`,
          ),
        })
        return 'resisted'
      }

      const remainingFactors = [
        ...factors.slice(0, factorIndex),
        ...factors.slice(factorIndex + 1),
      ]
      const health = Math.max(
        0,
        state.enemyHealth[id] - calculatePrimeDamage(prime, SKYLINE_SENTINELS[id].compositeNumber),
      )
      const enemyFactors = { ...state.enemyFactors, [id]: remainingFactors }
      const enemyHealth = { ...state.enemyHealth, [id]: health }

      if (remainingFactors.length > 0) {
        set({
          enemyFactors,
          enemyHealth,
          stylePoints: state.stylePoints + 45,
          toast: nextToast(
            state.toast,
            'cyan',
            `FATOR ${prime} EXTRAÍDO`,
            `${SKYLINE_SENTINELS[id].label} ainda contém ${remainingFactors.join(' × ')}.`,
          ),
        })
        return 'hit'
      }

      const mission = recordSentinelDefeat(state.mission, id)
      const allDefeated = mission.defeatedSentinelIds.length === SKYLINE_SENTINEL_IDS.length
      set({
        enemyFactors,
        enemyHealth,
        mission,
        stylePoints: state.stylePoints + 325,
        toast: nextToast(
          state.toast,
          allDefeated ? 'cyan' : 'amber',
          allDefeated ? 'ROTA APEX LIBERADA' : 'COMPOSTO FATORADO',
          allDefeated ? 'Suba até a Agulha e alcance o farol.' : `${mission.defeatedSentinelIds.length}/4 Sentinelas neutralizadas.`,
        ),
      })
      return 'defeated'
    },

    takeDamage: (amount) => {
      const state = get()
      if (state.defeated || amount <= 0) return state.defeated
      const health = Math.max(0, state.health - amount)
      const defeated = health === 0
      set({
        health,
        defeated,
        damagePulse: state.damagePulse + 1,
        controlsCaptured: defeated ? false : state.controlsCaptured,
        toast: defeated ? nextToast(state.toast, 'danger', 'SINAL PERDIDO', 'A rota entrou em colapso.') : state.toast,
      })
      return defeated
    },

    recordFall: () => {
      const state = get()
      const health = Math.max(0, state.health - 14)
      const defeated = health === 0
      set({
        falls: state.falls + 1,
        health,
        defeated,
        damagePulse: state.damagePulse + 1,
        controlsCaptured: defeated ? false : state.controlsCaptured,
        toast: nextToast(state.toast, 'danger', defeated ? 'SINAL PERDIDO' : 'REBOBINAMENTO', defeated ? 'A rota entrou em colapso.' : 'Retorno ao último ponto seguro.'),
      })
      return defeated
    },

    reachCheckpoint: (id, order) => {
      const state = get()
      if (order <= state.checkpointOrder) return false
      set({
        checkpointId: id,
        checkpointOrder: order,
        stylePoints: state.stylePoints + 180,
        toast: nextToast(state.toast, 'cyan', 'ROTA ANCORADA', `Checkpoint ${String(order + 1).padStart(2, '0')} sincronizado.`),
      })
      return true
    },

    reachApex: () => {
      const state = get()
      const mission = reachApexSpire(state.mission)
      if (mission === state.mission) return false
      set({
        mission,
        activeDialogue: { id: 'apex-extraction', lineIndex: 0 },
        controlsCaptured: false,
        stylePoints: state.stylePoints + 500,
      })
      return true
    },

    updateTelemetry: (update) => set((state) => {
      const telemetry = { ...state.telemetry, ...update }
      telemetry.maxFlow = Math.max(state.telemetry.maxFlow, telemetry.flow)
      return { telemetry }
    }),
    addStylePoints: (amount) => {
      if (Number.isFinite(amount) && amount > 0) set((state) => ({ stylePoints: state.stylePoints + amount }))
    },
    clearToast: (id) => set((state) => state.toast?.id === id ? { toast: null } : state),
  }))
}

export const useSkylineRunnerStore = createSkylineRunnerStore()

export function getObjectiveProgress(state: SkylineRunnerState): { current: number; required: number; percent: number } {
  const objective = getNextSkylineObjective(state.mission)
  let current = 0
  if (objective.id === 'talk-to-lia') current = state.mission.spokenNpcIds.includes('lia') ? 1 : 0
  if (objective.id === 'collect-prime-cores') current = state.mission.collectedPrimeCores.length
  if (objective.id === 'deliver-cores-to-nilo') current = state.mission.coresDeliveredToNilo ? 1 : 0
  if (objective.id === 'defeat-composite-sentinels') current = state.mission.defeatedSentinelIds.length
  if (objective.id === 'reach-apex-spire') current = state.mission.apexReached ? 1 : 0
  if (objective.id === 'activate-apex-beacon') current = state.mission.beaconActivated ? 1 : 0
  const required = SKYLINE_OBJECTIVES[objective.id].requiredCount
  return { current, required, percent: required === 0 ? 100 : Math.min(100, current / required * 100) }
}
