import type { RealmId, RealmPosition } from '../shared/realms'

export const HORROR_REALM_ID = 'sieve-catacombs' as const satisfies RealmId
export type AdventureRealmId = RealmId

export const HORROR_SEAL_IDS = ['seal-23', 'seal-29', 'seal-31'] as const
export type HorrorSealId = (typeof HORROR_SEAL_IDS)[number]

export interface HorrorSealDefinition {
  readonly id: HorrorSealId
  readonly prime: 23 | 29 | 31
  readonly position: RealmPosition
  readonly interactionRadius: number
  readonly inscription: string
}

export const HORROR_SEALS: readonly HorrorSealDefinition[] = Object.freeze([
  {
    id: 'seal-23',
    prime: 23,
    position: [-10, 0.8, -104],
    interactionRadius: 2.15,
    inscription: 'O vigésimo terceiro eco ainda se lembra da luz.',
  },
  {
    id: 'seal-29',
    prime: 29,
    position: [9, 0.8, -109],
    interactionRadius: 2.15,
    inscription: 'Vinte e nove passos separam o caçador de sua sombra.',
  },
  {
    id: 'seal-31',
    prime: 31,
    position: [0, 0.8, -116.5],
    interactionRadius: 2.15,
    inscription: 'Trinta e um encerra o círculo que a peneira não apagou.',
  },
])

export const HORROR_ALTAR = Object.freeze({
  id: 'sieve-exit-altar',
  position: [0, 0.8, -120] as RealmPosition,
  interactionRadius: 2.5,
  label: 'ativar o Altar da Peneira',
})

export const HORROR_STALKER_GOAL = 2
export const HORROR_STALKER_ID_PREFIX = 'catacomb-null-'
export const ULAM_MOB_GOAL = 3
export const FORGE_MOB_GOAL = 3
export const PRIME_PULSE_COOLDOWN_MS = 2_000

export type AdventureMinigameId = 'ulam-prime-run' | 'factor-reactor'
export type AdventureFeedbackKind = 'info' | 'success' | 'warning' | 'danger'

export interface AdventureFeedback {
  readonly kind: AdventureFeedbackKind
  readonly message: string
}

export interface PrimeverseAdventureState {
  readonly realm: AdventureRealmId
  readonly visitedRealms: readonly AdventureRealmId[]
  readonly completedMinigames: readonly AdventureMinigameId[]
  readonly integrity: number
  readonly lanternOn: boolean
  readonly sealsCollected: readonly HorrorSealId[]
  readonly defeatedMobIds: readonly string[]
  readonly altarActivated: boolean
  readonly pulseSerial: number
  readonly pulseReadyAtMs: number
  readonly feedback: AdventureFeedback | null
}

export type PrimeverseAdventureAction =
  | { readonly type: 'set-realm'; readonly realm: AdventureRealmId }
  | { readonly type: 'mark-minigame-win'; readonly game: AdventureMinigameId }
  | { readonly type: 'collect-seal'; readonly sealId: HorrorSealId }
  | { readonly type: 'defeat-mob'; readonly mobId: string }
  | { readonly type: 'activate-altar' }
  | { readonly type: 'take-damage'; readonly mobId: string; readonly amount: number; readonly nowMs: number }
  | { readonly type: 'toggle-lantern' }
  | { readonly type: 'cast-pulse'; readonly nowMs: number }
  | { readonly type: 'recover' }
  | { readonly type: 'reset-horror' }
  | { readonly type: 'clear-feedback' }

export interface AdventureObjective {
  readonly id: string
  readonly eyebrow: string
  readonly title: string
  readonly instruction: string
  readonly current: number
  readonly total: number
  readonly completed: boolean
  readonly tone: 'cyan' | 'magenta' | 'amber' | 'horror'
}

const EXPLORATION_REALMS: readonly AdventureRealmId[] = [
  'ulam-run',
  'factor-forge',
  HORROR_REALM_ID,
]

function feedback(kind: AdventureFeedbackKind, message: string): AdventureFeedback {
  return { kind, message }
}

function isFiniteTimestamp(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

export function isHorrorSealId(value: string): value is HorrorSealId {
  return HORROR_SEAL_IDS.some((id) => id === value)
}

export function isHorrorStalkerId(value: string): boolean {
  return value.startsWith(HORROR_STALKER_ID_PREFIX)
}

export function defeatedHorrorStalkers(state: PrimeverseAdventureState): number {
  return state.defeatedMobIds.filter(isHorrorStalkerId).length
}

function defeatedByPrefix(state: PrimeverseAdventureState, prefix: string): number {
  return state.defeatedMobIds.filter((id) => id.startsWith(prefix)).length
}

export function createPrimeverseAdventureState(
  realm: AdventureRealmId = 'nexus',
): PrimeverseAdventureState {
  return {
    realm,
    visitedRealms: [realm],
    completedMinigames: [],
    integrity: 100,
    lanternOn: false,
    sealsCollected: [],
    defeatedMobIds: [],
    altarActivated: false,
    pulseSerial: 0,
    pulseReadyAtMs: 0,
    feedback: null,
  }
}

export function canActivateHorrorAltar(state: PrimeverseAdventureState): boolean {
  return state.realm === HORROR_REALM_ID
    && state.integrity > 0
    && HORROR_SEAL_IDS.every((id) => state.sealsCollected.includes(id))
    && defeatedHorrorStalkers(state) >= HORROR_STALKER_GOAL
}

export function pulseCooldownRemaining(
  state: PrimeverseAdventureState,
  nowMs: number,
): number {
  if (!isFiniteTimestamp(nowMs)) return Math.max(0, state.pulseReadyAtMs)
  return Math.max(0, state.pulseReadyAtMs - nowMs)
}

export function primeverseAdventureReducer(
  state: PrimeverseAdventureState,
  action: PrimeverseAdventureAction,
): PrimeverseAdventureState {
  switch (action.type) {
    case 'set-realm': {
      if (state.realm === action.realm) return state
      const firstVisit = !state.visitedRealms.includes(action.realm)
      return {
        ...state,
        realm: action.realm,
        visitedRealms: firstVisit ? [...state.visitedRealms, action.realm] : state.visitedRealms,
        lanternOn: action.realm === HORROR_REALM_ID ? state.lanternOn : false,
        feedback: firstVisit
          ? feedback('info', action.realm === HORROR_REALM_ID
            ? 'A luz enfraqueceu. Há algo se movendo entre as colunas.'
            : 'Novo mundo registrado no mapa do Nexus.')
          : null,
      }
    }

    case 'mark-minigame-win':
      if (state.completedMinigames.includes(action.game)) return state
      return {
        ...state,
        completedMinigames: [...state.completedMinigames, action.game],
        feedback: feedback('success', action.game === 'ulam-prime-run'
          ? 'A rota irredutível foi dominada.'
          : 'A Forja reconheceu sua fatoração.'),
      }

    case 'collect-seal': {
      if (state.realm !== HORROR_REALM_ID || !isHorrorSealId(action.sealId)) return state
      if (state.sealsCollected.includes(action.sealId)) {
        return { ...state, feedback: feedback('info', 'Este selo já responde ao seu pulso.') }
      }
      const sealsCollected = HORROR_SEAL_IDS.filter((id) => (
        id === action.sealId || state.sealsCollected.includes(id)
      ))
      return {
        ...state,
        sealsCollected,
        feedback: feedback('success', sealsCollected.length === HORROR_SEAL_IDS.length
          ? 'Os três primos ressoam. O altar agora pode ouvir você.'
          : `Selo ${action.sealId.replace('seal-', '')} recuperado · ${sealsCollected.length}/3.`),
      }
    }

    case 'defeat-mob': {
      const mobId = action.mobId.trim()
      if (!mobId || state.defeatedMobIds.includes(mobId)) return state
      const defeatedMobIds = [...state.defeatedMobIds, mobId]
      const stalkers = defeatedMobIds.filter(isHorrorStalkerId).length
      const realmEnemy = mobId.startsWith('ulam-composite-')
        ? 'Composto dissipado pela onda prima.'
        : mobId.startsWith('forge-warden-')
          ? 'Guardião desmontado em seus fatores.'
          : null
      return {
        ...state,
        defeatedMobIds,
        feedback: isHorrorStalkerId(mobId)
          ? feedback('success', stalkers >= HORROR_STALKER_GOAL
            ? 'As duas sombras ruíram. Encontre os selos e alcance o altar.'
            : `Sombra dissipada · ${stalkers}/${HORROR_STALKER_GOAL}.`)
          : realmEnemy ? feedback('success', realmEnemy) : state.feedback,
      }
    }

    case 'activate-altar': {
      if (state.realm !== HORROR_REALM_ID || state.altarActivated) return state
      if (!canActivateHorrorAltar(state)) {
        const missingSeals = HORROR_SEAL_IDS.length - state.sealsCollected.length
        const missingStalkers = Math.max(0, HORROR_STALKER_GOAL - defeatedHorrorStalkers(state))
        return {
          ...state,
          feedback: feedback('warning', `O altar permanece mudo · faltam ${missingSeals} selo(s) e ${missingStalkers} sombra(s).`),
        }
      }
      return {
        ...state,
        altarActivated: true,
        feedback: feedback('success', 'A Peneira se abriu. Você escapou das Catacumbas.'),
      }
    }

    case 'take-damage': {
      if (state.integrity <= 0 || !Number.isFinite(action.amount) || action.amount <= 0) return state
      const damage = Math.min(100, Math.ceil(action.amount))
      const integrity = Math.max(0, state.integrity - damage)
      return {
        ...state,
        integrity,
        feedback: integrity === 0
          ? feedback('danger', 'Seu eco foi quebrado. Recomponha-se na entrada das Catacumbas.')
          : feedback('danger', `${action.mobId || 'Uma presença'} drenou ${damage} de integridade.`),
      }
    }

    case 'toggle-lantern':
      if (state.realm !== HORROR_REALM_ID || state.integrity <= 0) return state
      return {
        ...state,
        lanternOn: !state.lanternOn,
        feedback: feedback('info', state.lanternOn ? 'Lanterna apagada.' : 'Lanterna acesa. As sombras também podem vê-la.'),
      }

    case 'cast-pulse': {
      if (state.realm === 'nexus' || state.integrity <= 0 || !isFiniteTimestamp(action.nowMs)) return state
      if (pulseCooldownRemaining(state, action.nowMs) > 0) {
        return {
          ...state,
          feedback: feedback('warning', `Pulso recompondo · ${(pulseCooldownRemaining(state, action.nowMs) / 1_000).toFixed(1)} s.`),
        }
      }
      return {
        ...state,
        pulseSerial: state.pulseSerial + 1,
        pulseReadyAtMs: action.nowMs + PRIME_PULSE_COOLDOWN_MS,
        feedback: feedback('success', 'Pulso de Eratóstenes liberado.'),
      }
    }

    case 'recover':
      return {
        ...state,
        integrity: 100,
        lanternOn: false,
        pulseReadyAtMs: 0,
        feedback: feedback('info', 'Integridade recomposta. Continue a expedição.'),
      }

    case 'reset-horror':
      return {
        ...state,
        integrity: 100,
        lanternOn: false,
        sealsCollected: [],
        defeatedMobIds: state.defeatedMobIds.filter((id) => !isHorrorStalkerId(id)),
        altarActivated: false,
        pulseReadyAtMs: 0,
        feedback: feedback('info', 'Seu eco foi recomposto. A Peneira mudou de lugar.'),
      }

    case 'clear-feedback':
      return state.feedback ? { ...state, feedback: null } : state
  }
}

export function selectAdventureObjective(state: PrimeverseAdventureState): AdventureObjective {
  if (state.realm === 'ulam-run') {
    const runCompleted = state.completedMinigames.includes('ulam-prime-run')
    const defeated = Math.min(ULAM_MOB_GOAL, defeatedByPrefix(state, 'ulam-composite-'))
    const current = (runCompleted ? 1 : 0) + defeated
    const completed = current === ULAM_MOB_GOAL + 1
    return {
      id: 'ulam-run',
      eyebrow: 'AVENTURA · FENDA DE ULAM',
      title: completed ? 'Fenda purificada' : runCompleted ? 'Dissipe os compostos' : 'Corra pelos irredutíveis',
      instruction: completed
        ? 'O portal do Nexus está aberto. Você também pode melhorar seu recorde.'
        : runCompleted
          ? `Drones compostos ${defeated}/${ULAM_MOB_GOAL}. Aproxime-se e libere o Pulso Primo com R.`
          : 'Complete 2 → 3 → 5 → 7 → 11 → 13 → 17; fora da corrida, R dissipa drones.',
      current,
      total: ULAM_MOB_GOAL + 1,
      completed,
      tone: 'magenta',
    }
  }

  if (state.realm === 'factor-forge') {
    const reactorCompleted = state.completedMinigames.includes('factor-reactor')
    const defeated = Math.min(FORGE_MOB_GOAL, defeatedByPrefix(state, 'forge-warden-'))
    const current = (reactorCompleted ? 1 : 0) + defeated
    const completed = current === FORGE_MOB_GOAL + 1
    return {
      id: 'factor-forge',
      eyebrow: 'AVENTURA · FORJA DE EUCLIDES',
      title: completed ? 'Forja estabilizada' : reactorCompleted ? 'Desmonte os guardiões' : 'Reconstrua a fatoração',
      instruction: completed
        ? 'A Forja está estável. Retorne ao Nexus ou tente superar seu tempo.'
        : reactorCompleted
          ? `Guardiões desmontados ${defeated}/${FORGE_MOB_GOAL}. Use R quando entrarem no alcance.`
          : 'Decomponha 30, 42 e 66; fora do reator, use R contra os guardiões.',
      current,
      total: FORGE_MOB_GOAL + 1,
      completed,
      tone: 'amber',
    }
  }

  if (state.realm === HORROR_REALM_ID) {
    const sealCount = state.sealsCollected.length
    const stalkerCount = Math.min(HORROR_STALKER_GOAL, defeatedHorrorStalkers(state))
    const progress = sealCount + stalkerCount + (state.altarActivated ? 1 : 0)
    if (state.integrity <= 0) {
      return {
        id: 'sieve-fallen',
        eyebrow: 'AVENTURA · CATACUMBAS DA PENEIRA',
        title: 'Seu eco foi quebrado',
        instruction: 'Recomponha-se e tente uma rota diferente. A lanterna denuncia sua posição.',
        current: progress,
        total: 6,
        completed: false,
        tone: 'horror',
      }
    }
    const title = state.altarActivated
      ? 'A Peneira foi atravessada'
      : sealCount < HORROR_SEAL_IDS.length
        ? 'Recupere os selos perdidos'
        : stalkerCount < HORROR_STALKER_GOAL
          ? 'Silencie as sombras'
          : 'Ative o altar de saída'
    const instruction = state.altarActivated
      ? 'O caminho de volta está aberto. Ainda há ecos escondidos na escuridão.'
      : `Selos ${sealCount}/3 · Sombras ${stalkerCount}/${HORROR_STALKER_GOAL}. Use F para a lanterna e R para o pulso.`
    return {
      id: 'sieve-catacombs',
      eyebrow: 'AVENTURA · CATACUMBAS DA PENEIRA',
      title,
      instruction,
      current: progress,
      total: 6,
      completed: state.altarActivated,
      tone: 'horror',
    }
  }

  const explored = EXPLORATION_REALMS.filter((realm) => state.visitedRealms.includes(realm)).length
  return {
    id: 'nexus',
    eyebrow: 'JORNADA · NEXUS PRIMO',
    title: explored === EXPLORATION_REALMS.length ? 'Mapa dos mundos completo' : 'Desperte os portais',
    instruction: explored === EXPLORATION_REALMS.length
      ? 'Todos os mundos foram encontrados. Escolha qual mistério deseja dominar.'
      : 'Portais: Torre de Ulam · Templo dos Fatores · Observatório. Aproxime-se e pressione E.',
    current: explored,
    total: EXPLORATION_REALMS.length,
    completed: explored === EXPLORATION_REALMS.length,
    tone: 'cyan',
  }
}

export function isPrimeverseAdventureComplete(state: PrimeverseAdventureState): boolean {
  return EXPLORATION_REALMS.every((realm) => state.visitedRealms.includes(realm))
    && state.completedMinigames.includes('ulam-prime-run')
    && state.completedMinigames.includes('factor-reactor')
    && defeatedByPrefix(state, 'ulam-composite-') >= ULAM_MOB_GOAL
    && defeatedByPrefix(state, 'forge-warden-') >= FORGE_MOB_GOAL
    && state.altarActivated
}
