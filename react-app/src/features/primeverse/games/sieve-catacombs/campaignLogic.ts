export const CATACOMBS_LEVEL_IDS = [
  'yellow-offices',
  'modular-pools',
  'hotel-23',
  'crypt-49',
  'server-farm-11',
  'cold-vault-13',
] as const

export type CatacombsLevelId = (typeof CATACOMBS_LEVEL_IDS)[number]
export type CatacombsSealPrime = 2 | 3 | 5 | 7 | 11 | 13

export type CatacombsEnemyArchetype =
  | 'keylogger-wraith'
  | 'hash-collider'
  | 'man-in-the-middle'
  | 'factoring-warden'
  | 'brute-forcer'
  | 'cold-key-keeper'

export type CatacombsEventId =
  | 'fluorescent-blackout'
  | 'wrong-door-loop'
  | 'distant-copy'
  | 'water-level-shift'
  | 'moving-reflection'
  | 'prime-whistle'
  | 'room-23-loop'
  | 'dead-phone'
  | 'empty-elevator'
  | 'sieve-countdown'
  | 'warden-awakens'
  | 'false-exit'
  | 'rack-restart'
  | 'brute-force-sweep'
  | 'twin-serial'
  | 'cold-breath'
  | 'key-thaw'
  | 'last-shard'

export interface CatacombsLightProfile {
  readonly background: string
  readonly fog: string
  readonly fogNear: number
  readonly fogFar: number
  readonly ambientIntensity: number
  readonly hemisphereIntensity: number
  readonly flashlightIntensity: number
  readonly flashlightFillIntensity: number
}

export interface CatacombsLevelDefinition {
  readonly id: CatacombsLevelId
  readonly index: number
  readonly title: string
  readonly overline: string
  readonly sealPrime: CatacombsSealPrime
  readonly objective: string
  readonly mechanic: string
  readonly enemy: CatacombsEnemyArchetype
  readonly events: readonly CatacombsEventId[]
  readonly light: CatacombsLightProfile
}

/**
 * Campaign data deliberately contains no React or Three.js types. Scene modules can
 * select a layout by `id`, while the HUD and progression logic share the same copy,
 * seal order and conservative light floor.
 */
export const CATACOMBS_LEVELS: readonly CatacombsLevelDefinition[] = Object.freeze([
  {
    id: 'yellow-offices',
    index: 0,
    title: 'Escritórios Amarelos',
    overline: 'NÍVEL 01 // O CORREDOR QUE REPETE',
    sealPrime: 2,
    objective: 'Encontre o Selo 2 e retorne ao elevador de serviço.',
    mechanic: 'O Registrador grava cada passo que você digita e o repete com atraso. A lanterna acesa entrega sua posição; o facho de perto trava o buffer dele — mas só por alguns segundos, e depois ele se acostuma com a luz e vem assim mesmo. Três toques e seu nome vira log.',
    enemy: 'keylogger-wraith',
    events: ['fluorescent-blackout', 'wrong-door-loop', 'distant-copy'],
    light: {
      background: '#090804',
      fog: '#2a2512',
      fogNear: 9,
      fogFar: 45,
      ambientIntensity: 0.38,
      hemisphereIntensity: 0.34,
      flashlightIntensity: 92,
      flashlightFillIntensity: 5.5,
    },
  },
  {
    id: 'modular-pools',
    index: 1,
    title: 'Piscinas Modulares',
    overline: 'NÍVEL 02 // RESÍDUOS SUBMERSOS',
    sealPrime: 3,
    objective: 'Atravesse os três canais, recupere o Selo 3 e alcance a escada seca.',
    mechanic: 'As Colisões procuram uma segunda pré-imagem: seu corpo. No escuro elas enxergam mais longe e nadam mais rápido. Alterne luz e cobertura — três colisões fecham o hash.',
    enemy: 'hash-collider',
    events: ['water-level-shift', 'moving-reflection', 'prime-whistle'],
    light: {
      background: '#021014',
      fog: '#08282d',
      fogNear: 10,
      fogFar: 46,
      ambientIntensity: 0.34,
      hemisphereIntensity: 0.38,
      flashlightIntensity: 90,
      flashlightFillIntensity: 5.4,
    },
  },
  {
    id: 'hotel-23',
    index: 2,
    title: 'Hotel do 23',
    overline: 'NÍVEL 03 // NENHUM HÓSPEDE CONSTA',
    sealPrime: 5,
    objective: 'Atravesse as alas numeradas, encontre o Selo 5 e chame o elevador vazio.',
    mechanic: 'O Homem no Meio fica entre você e a saída, copiando tudo que passa. Ele congela enquanto está enquadrado no facho — e no instante em que você desvia o olhar ele corre mais rápido do que você anda.',
    enemy: 'man-in-the-middle',
    events: ['room-23-loop', 'dead-phone', 'empty-elevator'],
    light: {
      background: '#090307',
      fog: '#1d0911',
      fogNear: 8,
      fogFar: 40,
      ambientIntensity: 0.28,
      hemisphereIntensity: 0.3,
      flashlightIntensity: 94,
      flashlightFillIntensity: 5.6,
    },
  },
  {
    id: 'crypt-49',
    index: 3,
    title: 'Cripta 49',
    overline: 'NÍVEL 04 // A ÚLTIMA PENEIRA',
    sealPrime: 7,
    objective: 'Purifique o Selo 7 e escape antes que o Fatorador termine 49 = 7 × 7.',
    mechanic: 'Os Fatoradores quebram sua chave em fatores primos. A luz os contém apenas antes do selo; depois da purificação, a fatoração não pode mais ser interrompida.',
    enemy: 'factoring-warden',
    events: ['sieve-countdown', 'warden-awakens', 'false-exit'],
    light: {
      background: '#020806',
      fog: '#04100c',
      fogNear: 6,
      fogFar: 38,
      ambientIntensity: 0.28,
      hemisphereIntensity: 0.3,
      flashlightIntensity: 92,
      flashlightFillIntensity: 5.5,
    },
  },
  {
    id: 'server-farm-11',
    index: 4,
    title: 'Fazenda de Servidores 11',
    overline: 'NÍVEL 05 // A VARREDURA NÃO PARA',
    sealPrime: 11,
    objective: 'Ache o Selo 11 entre os racks e resolva o console antes que a varredura te alcance.',
    mechanic: 'O Forçador testa todas as portas, uma por uma, e não liga para a sua lanterna. Ele escuta: cada gaveta puxada marca a sua posição no log.',
    enemy: 'brute-forcer',
    events: ['rack-restart', 'brute-force-sweep', 'twin-serial'],
    light: {
      background: '#0a0203',
      fog: '#210608',
      fogNear: 7,
      fogFar: 42,
      ambientIntensity: 0.3,
      hemisphereIntensity: 0.32,
      flashlightIntensity: 93,
      flashlightFillIntensity: 5.5,
    },
  },
  {
    id: 'cold-vault-13',
    index: 5,
    title: 'Cofre Frio 13',
    overline: 'NÍVEL 06 // AS CHAVES DORMEM AQUI',
    sealPrime: 13,
    objective: 'Recupere o Selo 13 no armazenamento frio e troque a chave final na porta do cofre.',
    mechanic: 'O Guardião congela sob a lanterna e sempre sabe onde você está. No escuro ele é a coisa mais rápida da campanha — e a bateria acaba mais depressa neste andar.',
    enemy: 'cold-key-keeper',
    events: ['cold-breath', 'key-thaw', 'last-shard'],
    light: {
      background: '#01060a',
      fog: '#061a26',
      fogNear: 6,
      fogFar: 36,
      ambientIntensity: 0.28,
      hemisphereIntensity: 0.3,
      flashlightIntensity: 95,
      flashlightFillIntensity: 5.6,
    },
  },
])

/** The campaign seal order, derived from the floors themselves: 2, 3, 5, 7, 11, 13. */
export const CATACOMBS_SEAL_ORDER: readonly CatacombsSealPrime[] = Object.freeze(
  CATACOMBS_LEVELS.map((level) => level.sealPrime),
)

export interface CatacombsLevelCompletion {
  readonly levelId: CatacombsLevelId
  readonly sealPrime: CatacombsSealPrime
  readonly elapsedMs: number
}

export interface CatacombsCampaignState {
  readonly phase: 'playing' | 'won'
  readonly levelIndex: number
  readonly currentLevelId: CatacombsLevelId
  readonly collectedPrimes: readonly CatacombsSealPrime[]
  readonly completedLevels: readonly CatacombsLevelCompletion[]
  readonly campaignStartedAtMs: number
  readonly levelStartedAtMs: number
}

export type CatacombsCampaignActionStatus =
  | 'seal-collected'
  | 'wrong-seal'
  | 'already-collected'
  | 'exit-locked'
  | 'level-advanced'
  | 'campaign-complete'
  | 'inactive'

export interface CatacombsCampaignActionResult {
  readonly state: CatacombsCampaignState
  readonly status: CatacombsCampaignActionStatus
  readonly feedback: string
}

function safeTimestamp(nowMs: number, fallback = 0): number {
  return Number.isFinite(nowMs) && nowMs >= fallback ? nowMs : fallback
}

export function createInitialCatacombsCampaign(nowMs = 0): CatacombsCampaignState {
  const startedAt = safeTimestamp(nowMs)
  const firstLevel = CATACOMBS_LEVELS[0]
  return {
    phase: 'playing',
    levelIndex: firstLevel.index,
    currentLevelId: firstLevel.id,
    collectedPrimes: [],
    completedLevels: [],
    campaignStartedAtMs: startedAt,
    levelStartedAtMs: startedAt,
  }
}

export function getCurrentCatacombsLevel(state: CatacombsCampaignState): CatacombsLevelDefinition {
  const indexedLevel = CATACOMBS_LEVELS[state.levelIndex]
  if (indexedLevel?.id === state.currentLevelId) return indexedLevel

  // The stable id wins when restoring an older/corrupted save whose numeric
  // index no longer matches the campaign order.
  return CATACOMBS_LEVELS.find((level) => level.id === state.currentLevelId)
    ?? indexedLevel
    ?? CATACOMBS_LEVELS[0]
}

export function isCurrentCatacombsExitUnlocked(state: CatacombsCampaignState): boolean {
  if (state.phase !== 'playing') return false
  return state.collectedPrimes.includes(getCurrentCatacombsLevel(state).sealPrime)
}

export function collectCurrentCatacombsSeal(
  state: CatacombsCampaignState,
  prime: CatacombsSealPrime,
): CatacombsCampaignActionResult {
  if (state.phase !== 'playing') {
    return { state, status: 'inactive', feedback: 'A expedição já foi concluída.' }
  }
  const level = getCurrentCatacombsLevel(state)
  if (state.collectedPrimes.includes(level.sealPrime)) {
    return { state, status: 'already-collected', feedback: `O Selo ${level.sealPrime} já respondeu.` }
  }
  if (prime !== level.sealPrime) {
    return {
      state,
      status: 'wrong-seal',
      feedback: `Este nível exige o Selo ${level.sealPrime}; ${prime} ainda não pertence a esta camada.`,
    }
  }
  return {
    state: { ...state, collectedPrimes: [...state.collectedPrimes, prime] },
    status: 'seal-collected',
    feedback: `Selo ${prime} purificado. O elevador foi liberado.`,
  }
}

export function attemptCatacombsLevelExit(
  state: CatacombsCampaignState,
  nowMs: number,
): CatacombsCampaignActionResult {
  if (state.phase !== 'playing') {
    return { state, status: 'inactive', feedback: 'A expedição já foi concluída.' }
  }
  const level = getCurrentCatacombsLevel(state)
  if (!isCurrentCatacombsExitUnlocked(state)) {
    return {
      state,
      status: 'exit-locked',
      feedback: `O elevador exige o Selo ${level.sealPrime} deste nível.`,
    }
  }

  const timestamp = safeTimestamp(nowMs, state.levelStartedAtMs)
  const completion: CatacombsLevelCompletion = {
    levelId: level.id,
    sealPrime: level.sealPrime,
    elapsedMs: Math.max(0, timestamp - state.levelStartedAtMs),
  }
  const completedLevels = [...state.completedLevels, completion]
  const nextLevel = CATACOMBS_LEVELS[level.index + 1]
  if (!nextLevel) {
    return {
      state: { ...state, phase: 'won', completedLevels },
      status: 'campaign-complete',
      feedback: `Os ${CATACOMBS_LEVELS.length} níveis foram peneirados. Você escapou da Cripta do Crivo.`,
    }
  }

  return {
    state: {
      ...state,
      levelIndex: nextLevel.index,
      currentLevelId: nextLevel.id,
      completedLevels,
      levelStartedAtMs: timestamp,
    },
    status: 'level-advanced',
    feedback: `${level.title} concluído. Próxima parada: ${nextLevel.title}.`,
  }
}

export function catacombsCampaignObjective(state: CatacombsCampaignState): string {
  if (state.phase === 'won') return `EXPEDIÇÃO CONCLUÍDA · ${CATACOMBS_SEAL_ORDER.join(' · ')}`
  const level = getCurrentCatacombsLevel(state)
  return isCurrentCatacombsExitUnlocked(state)
    ? `RETORNE AO ELEVADOR · ${level.title.toUpperCase()}`
    : level.objective.toUpperCase()
}
