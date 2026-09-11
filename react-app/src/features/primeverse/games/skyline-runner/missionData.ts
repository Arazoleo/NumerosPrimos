export type SkylinePosition3D = readonly [x: number, y: number, z: number]

export type SkylineNpcId = 'lia' | 'nilo'

export type SkylineSpeaker = SkylineNpcId | 'runner'

export type SkylineDialogueId =
  | 'lia-briefing'
  | 'lia-cores-online'
  | 'nilo-delivery'
  | 'apex-extraction'

export const SKYLINE_PRIME_CORE_VALUES = [2, 3, 5] as const

export type SkylinePrimeCoreValue =
  (typeof SKYLINE_PRIME_CORE_VALUES)[number]

export const SKYLINE_SENTINEL_IDS = [
  'sentinel-four',
  'sentinel-six',
  'sentinel-nine',
  'sentinel-ten',
] as const

export type SkylineSentinelId = (typeof SKYLINE_SENTINEL_IDS)[number]

export type SkylineObjectiveId =
  | 'talk-to-lia'
  | 'collect-prime-cores'
  | 'deliver-cores-to-nilo'
  | 'defeat-composite-sentinels'
  | 'reach-apex-spire'
  | 'activate-apex-beacon'
  | 'mission-complete'

export type SkylineObjectiveKind =
  | 'dialogue'
  | 'collect'
  | 'delivery'
  | 'combat'
  | 'traversal'
  | 'extraction'
  | 'complete'

export interface SkylineDialogueLine {
  readonly id: string
  readonly speaker: SkylineSpeaker
  readonly text: string
}

export interface SkylineDialogue {
  readonly id: SkylineDialogueId
  readonly lines: readonly SkylineDialogueLine[]
}

export interface SkylineNpc {
  readonly id: SkylineNpcId
  readonly name: string
  readonly role: string
  readonly position: SkylinePosition3D
  readonly accent: string
  readonly dialogueIds: readonly SkylineDialogueId[]
}

export interface SkylinePrimeCore {
  readonly value: SkylinePrimeCoreValue
  readonly label: string
  readonly position: SkylinePosition3D
  readonly clue: string
}

export interface SkylineSentinel {
  readonly id: SkylineSentinelId
  readonly label: string
  readonly compositeNumber: number
  readonly primeFactors: readonly SkylinePrimeCoreValue[]
  readonly position: SkylinePosition3D
}

export interface SkylineObjective {
  readonly id: SkylineObjectiveId
  readonly kind: SkylineObjectiveKind
  readonly title: string
  readonly detail: string
  readonly targetPositions: readonly SkylinePosition3D[]
  readonly requiredCount: number
}

export const SKYLINE_LOCATIONS = {
  runnerSpawn: [0, 1.1, 16] as SkylinePosition3D,
  apexSpire: [0, 13.2, -71] as SkylinePosition3D,
  apexBeacon: [0, 14.2, -76] as SkylinePosition3D,
} as const

export const SKYLINE_NPCS: Readonly<Record<SkylineNpcId, SkylineNpc>> = {
  lia: {
    id: 'lia',
    name: 'LIA',
    role: 'Operadora e corredora de telhados',
    position: [-3.4, 1.1, 11.8],
    accent: '#59e3dd',
    dialogueIds: ['lia-briefing', 'lia-cores-online', 'apex-extraction'],
  },
  nilo: {
    id: 'nilo',
    name: 'NILO',
    role: 'Engenheiro da torre intermediária',
    position: [-2.4, 7.2, -28.5],
    accent: '#f2c15c',
    dialogueIds: ['nilo-delivery', 'apex-extraction'],
  },
}

export const SKYLINE_PRIME_CORES: Readonly<
  Record<SkylinePrimeCoreValue, SkylinePrimeCore>
> = {
  2: {
    value: 2,
    label: 'Núcleo Binário',
    position: [4.8, 2.7, 2.5],
    clue: 'O único primo par estabiliza a primeira ponte.',
  },
  3: {
    value: 3,
    label: 'Núcleo Tríade',
    position: [-4.6, 4.9, -8.5],
    clue: 'Três pulsa acima do corredor de ventilação.',
  },
  5: {
    value: 5,
    label: 'Núcleo Pentagonal',
    position: [3.2, 7.2, -20],
    clue: 'Cinco abre a frequência da torre de Nilo.',
  },
}

export const SKYLINE_SENTINELS: Readonly<
  Record<SkylineSentinelId, SkylineSentinel>
> = {
  'sentinel-four': {
    id: 'sentinel-four',
    label: 'Sentinela 4',
    compositeNumber: 4,
    primeFactors: [2, 2],
    position: [-4.6, 7.2, -37],
  },
  'sentinel-six': {
    id: 'sentinel-six',
    label: 'Sentinela 6',
    compositeNumber: 6,
    primeFactors: [2, 3],
    position: [4.2, 8.7, -45],
  },
  'sentinel-nine': {
    id: 'sentinel-nine',
    label: 'Sentinela 9',
    compositeNumber: 9,
    primeFactors: [3, 3],
    position: [-3.8, 10.3, -53],
  },
  'sentinel-ten': {
    id: 'sentinel-ten',
    label: 'Sentinela 10',
    compositeNumber: 10,
    primeFactors: [2, 5],
    position: [4.4, 11.8, -61],
  },
}

export const SKYLINE_DIALOGUES: Readonly<
  Record<SkylineDialogueId, SkylineDialogue>
> = {
  'lia-briefing': {
    id: 'lia-briefing',
    lines: [
      {
        id: 'lia-briefing-01',
        speaker: 'lia',
        text: 'Runner, a malha caiu. Só os núcleos 2, 3 e 5 religam a rota até a Agulha.',
      },
      {
        id: 'lia-briefing-02',
        speaker: 'runner',
        text: 'Marco os três primos, cruzo os telhados e encontro Nilo na torre.',
      },
    ],
  },
  'lia-cores-online': {
    id: 'lia-cores-online',
    lines: [
      {
        id: 'lia-cores-online-01',
        speaker: 'lia',
        text: 'Tríade confirmada. Nilo já abriu o elevador de manutenção.',
      },
      {
        id: 'lia-cores-online-02',
        speaker: 'runner',
        text: 'Levo a carga até ele. Mantenha a rota limpa.',
      },
    ],
  },
  'nilo-delivery': {
    id: 'nilo-delivery',
    lines: [
      {
        id: 'nilo-delivery-01',
        speaker: 'nilo',
        text: 'Poderes online. Selecione 2, 3 ou 5 e dispare o primo que aparece na fatoração da Sentinela.',
      },
      {
        id: 'nilo-delivery-02',
        speaker: 'runner',
        text: 'Entendido: 4 pede dois disparos de 2; 9, dois de 3. Vou quebrar cada selo.',
      },
    ],
  },
  'apex-extraction': {
    id: 'apex-extraction',
    lines: [
      {
        id: 'apex-extraction-01',
        speaker: 'nilo',
        text: 'Farol armado. Alcance o topo da Agulha e feche o circuito.',
      },
      {
        id: 'apex-extraction-02',
        speaker: 'lia',
        text: 'Quando a luz acender, salte no feixe. Eu puxo você para casa.',
      },
      {
        id: 'apex-extraction-03',
        speaker: 'runner',
        text: 'Skyline em sincronia. Iniciando extração.',
      },
    ],
  },
}

export const SKYLINE_OBJECTIVES: Readonly<
  Record<SkylineObjectiveId, SkylineObjective>
> = {
  'talk-to-lia': {
    id: 'talk-to-lia',
    kind: 'dialogue',
    title: 'Abra o canal com LIA',
    detail: 'Encontre a operadora no terraço inicial e receba o protocolo.',
    targetPositions: [SKYLINE_NPCS.lia.position],
    requiredCount: 1,
  },
  'collect-prime-cores': {
    id: 'collect-prime-cores',
    kind: 'collect',
    title: 'Recupere os núcleos 2, 3 e 5',
    detail: 'Atravesse os telhados e reúna a tríade prima.',
    targetPositions: SKYLINE_PRIME_CORE_VALUES.map(
      (value) => SKYLINE_PRIME_CORES[value].position,
    ),
    requiredCount: SKYLINE_PRIME_CORE_VALUES.length,
  },
  'deliver-cores-to-nilo': {
    id: 'deliver-cores-to-nilo',
    kind: 'delivery',
    title: 'Entregue os núcleos a NILO',
    detail: 'Leve a tríade ao engenheiro na torre intermediária.',
    targetPositions: [SKYLINE_NPCS.nilo.position],
    requiredCount: 1,
  },
  'defeat-composite-sentinels': {
    id: 'defeat-composite-sentinels',
    kind: 'combat',
    title: 'Derrube as Sentinelas Compostas',
    detail: 'Equipe 2, 3 ou 5 e rompa, um a um, os fatores de 4, 6, 9 e 10.',
    targetPositions: SKYLINE_SENTINEL_IDS.map(
      (id) => SKYLINE_SENTINELS[id].position,
    ),
    requiredCount: SKYLINE_SENTINEL_IDS.length,
  },
  'reach-apex-spire': {
    id: 'reach-apex-spire',
    kind: 'traversal',
    title: 'Alcance a Agulha Apex',
    detail: 'Use a rota liberada e corra até o ponto mais alto da cidade.',
    targetPositions: [SKYLINE_LOCATIONS.apexSpire],
    requiredCount: 1,
  },
  'activate-apex-beacon': {
    id: 'activate-apex-beacon',
    kind: 'extraction',
    title: 'Ative o farol e extraia',
    detail: 'Feche o circuito primo e entre no feixe de extração.',
    targetPositions: [SKYLINE_LOCATIONS.apexBeacon],
    requiredCount: 1,
  },
  'mission-complete': {
    id: 'mission-complete',
    kind: 'complete',
    title: 'Skyline Protocol concluído',
    detail: 'A tríade prima voltou a iluminar a cidade.',
    targetPositions: [],
    requiredCount: 0,
  },
}

export const SKYLINE_OBJECTIVE_ORDER = [
  'talk-to-lia',
  'collect-prime-cores',
  'deliver-cores-to-nilo',
  'defeat-composite-sentinels',
  'reach-apex-spire',
  'activate-apex-beacon',
] as const satisfies readonly SkylineObjectiveId[]

export const SKYLINE_MISSION = {
  id: 'prime-runner-skyline-protocol',
  title: 'Prime Runner: Skyline Protocol',
  subtitle: 'Corra acima da cidade. Acenda o último farol primo.',
  playerSpawn: SKYLINE_LOCATIONS.runnerSpawn,
  objectiveOrder: SKYLINE_OBJECTIVE_ORDER,
  finalObjectiveId: 'activate-apex-beacon',
  requiredPrimeCores: SKYLINE_PRIME_CORE_VALUES,
  sentinelIds: SKYLINE_SENTINEL_IDS,
} as const
