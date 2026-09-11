export type PrimeboundAreaId =
  | 'echo-woods'
  | 'composite-crypt'
  | 'twin-peaks'
  | 'residue-forge'
  | 'eratosthenes-garden'
  | 'goldbach-citadel'
  | 'wilson-observatory'
  | 'mobius-labyrinth'
  | 'fermat-bastion'
  | 'sieve-foundry'
  | 'elliptic-nexus'
  | 'prime-sanctuary'

export type PrimeboundNpcId =
  | 'seris'
  | 'orun'
  | 'lyra'
  | 'sophia'
  | 'theon'
  | 'aurea'
  | 'wilson'

export type PrimeboundDialogueId =
  | 'seris-intro'
  | 'seris-rune'
  | 'orun-intro'
  | 'orun-rune'
  | 'lyra-intro'
  | 'lyra-rune'
  | 'sophia-intro'
  | 'sophia-mastery'
  | 'theon-intro'
  | 'theon-rune'
  | 'aurea-intro'
  | 'aurea-rune'
  | 'wilson-intro'
  | 'wilson-rune'

export type PrimeboundSpeaker = PrimeboundNpcId | 'hero'

export type PrimeRuneValue = 2 | 3 | 5 | 7 | 11 | 13

export type PrimeFactorValue = PrimeRuneValue

export type PrimeboundEnemyFamilyId =
  | 'prime-powers'
  | 'twin-primes'
  | 'sophie-germain'
  | 'mersenne'
  | 'eratosthenes-sieve'
  | 'goldbach'
  | 'wilson'

export type PrimeboundEncounterRank =
  | 'minion'
  | 'area-boss'
  | 'final-boss'

export type PrimeboundEnemyId =
  | 'quadruped-slime'
  | 'eight-rootling'
  | 'twenty-seven-echo-beetle'
  | 'echo-moth'
  | 'hexagonal-wraith'
  | 'ten-divisor-crawler'
  | 'twenty-one-crypt-shade'
  | 'fifteen-knight'
  | 'twelve-mirror'
  | 'eighteen-twin-harrier'
  | 'forty-four-ridge-splitter'
  | 'twenty-five-duelist'
  | 'forty-nine-golem'
  | 'sixty-three-spark-golem'
  | 'one-twenty-five-residue-smelter'
  | 'seventy-five-smith'
  | 'thirty-five-sieve'
  | 'forty-two-sieve-runner'
  | 'sixty-six-grid-reaper'
  | 'seventy-seven-sentinel'
  | 'twenty-two-pair'
  | 'thirty-three-twin-lancer'
  | 'sixty-five-sophie-weaver'
  | 'twenty-six-pair'
  | 'ninety-one-sieve-orbit'
  | 'one-twenty-one-power-oracle'
  | 'one-forty-three-judge'
  | 'one-sixty-nine-congruence'
  | 'thirty-mobius-stalker'
  | 'forty-two-loop-wraith'
  | 'sixty-mobius-nullshade'
  | 'seventy-eight-inversion-warden'
  | 'fifty-five-fermat-squire'
  | 'ninety-goldbach-artillerist'
  | 'one-twenty-five-fermat-centurion'
  | 'one-thirty-fermat-keeper'
  | 'forty-five-sieve-drone'
  | 'eighty-eight-twin-smith'
  | 'one-sixty-five-sieve-loader'
  | 'one-ninety-five-foundry-overseer'
  | 'ninety-eight-curve-hunter'
  | 'one-forty-seven-nexus-seer'
  | 'one-fifty-four-curve-scribe'
  | 'two-eighty-six-elliptic-archon'
  | 'twenty-one-idol'
  | 'sixty-three-mersenne-seer'
  | 'sixty-six-goldbach-herald'
  | 'composite-sentinel'

export type PrimeboundConnectionId =
  | 'woods-to-crypt'
  | 'crypt-to-twin-peaks'
  | 'twin-peaks-to-residue-forge'
  | 'residue-forge-to-eratosthenes'
  | 'eratosthenes-to-goldbach'
  | 'goldbach-to-wilson'
  | 'wilson-to-mobius'
  | 'mobius-to-fermat'
  | 'fermat-to-sieve-foundry'
  | 'sieve-foundry-to-elliptic'
  | 'elliptic-to-sanctuary'

export type PrimeboundObjectiveId =
  | 'meet-seris'
  | 'clear-echo-woods'
  | 'collect-rune-2'
  | 'enter-composite-crypt'
  | 'meet-orun'
  | 'clear-composite-crypt'
  | 'collect-rune-3'
  | 'enter-twin-peaks'
  | 'meet-lyra'
  | 'clear-twin-peaks'
  | 'collect-rune-5'
  | 'enter-residue-forge'
  | 'meet-sophia'
  | 'clear-residue-forge'
  | 'enter-eratosthenes-garden'
  | 'meet-theon'
  | 'clear-eratosthenes-garden'
  | 'collect-rune-7'
  | 'enter-goldbach-citadel'
  | 'meet-aurea'
  | 'clear-goldbach-citadel'
  | 'collect-rune-11'
  | 'enter-wilson-observatory'
  | 'meet-wilson'
  | 'clear-wilson-observatory'
  | 'collect-rune-13'
  | 'enter-mobius-labyrinth'
  | 'clear-mobius-labyrinth'
  | 'enter-fermat-bastion'
  | 'clear-fermat-bastion'
  | 'enter-sieve-foundry'
  | 'clear-sieve-foundry'
  | 'enter-elliptic-nexus'
  | 'clear-elliptic-nexus'
  | 'enter-prime-sanctuary'
  | 'clear-prime-sanctuary'
  | 'defeat-composite-sentinel'
  | 'victory'

export type PrimeboundObjectiveKind =
  | 'talk'
  | 'battle'
  | 'collect'
  | 'travel'
  | 'boss'
  | 'complete'

export type PrimeboundTile =
  | '#'
  | '.'
  | '~'
  | '+'
  | '^'
  | 'D'

export interface GridPosition {
  readonly x: number
  readonly y: number
}

export interface PrimeboundArea {
  readonly id: PrimeboundAreaId
  readonly name: string
  readonly subtitle: string
  readonly palette: readonly [string, string, string]
  readonly tileMap: readonly string[]
  readonly playerSpawn: GridPosition
  readonly requiredRunesToEnter: readonly PrimeRuneValue[]
  readonly connectionIds: readonly PrimeboundConnectionId[]
  readonly npcIds: readonly PrimeboundNpcId[]
  readonly runeValues: readonly PrimeRuneValue[]
  readonly enemyIds: readonly PrimeboundEnemyId[]
}

export interface PrimeboundConnectionEndpoint {
  readonly areaId: PrimeboundAreaId
  readonly portal: GridPosition
  readonly arrival: GridPosition
}

export interface PrimeboundConnection {
  readonly id: PrimeboundConnectionId
  readonly a: PrimeboundConnectionEndpoint
  readonly b: PrimeboundConnectionEndpoint
}

export interface PrimeboundDialogueLine {
  readonly speaker: PrimeboundSpeaker
  readonly text: string
}

export interface PrimeboundDialogue {
  readonly id: PrimeboundDialogueId
  readonly lines: readonly PrimeboundDialogueLine[]
}

export interface PrimeboundNpc {
  readonly id: PrimeboundNpcId
  readonly name: string
  readonly title: string
  readonly areaId: PrimeboundAreaId
  readonly position: GridPosition
  readonly dialogueIds: readonly PrimeboundDialogueId[]
}

export interface PrimeRune {
  readonly value: PrimeRuneValue
  readonly name: string
  readonly areaId: PrimeboundAreaId
  readonly position: GridPosition
  readonly clue: string
}

export interface PrimeboundEnemy {
  readonly id: PrimeboundEnemyId
  readonly name: string
  readonly areaId: PrimeboundAreaId
  readonly position: GridPosition
  readonly number: number
  readonly primeFactors: readonly PrimeFactorValue[]
  readonly maxHealth: number
  readonly damage: number
  readonly encounterRank: PrimeboundEncounterRank
  readonly primeFamily: PrimeboundEnemyFamilyId
  readonly signaturePower: {
    readonly name: string
    readonly formula: string
    readonly description: string
  }
  /** Mantido para compatibilidade: identifica apenas o chefe final da campanha. */
  readonly isBoss: boolean
}

export interface PrimeboundObjective {
  readonly id: PrimeboundObjectiveId
  readonly kind: PrimeboundObjectiveKind
  readonly title: string
  readonly detail: string
  readonly areaId: PrimeboundAreaId | null
}

export interface PrimeboundProgress {
  readonly currentAreaId: PrimeboundAreaId
  readonly visitedAreaIds: readonly PrimeboundAreaId[]
  readonly completedStageIds: readonly PrimeboundAreaId[]
  readonly spokenNpcIds: readonly PrimeboundNpcId[]
  readonly collectedRunes: readonly PrimeRuneValue[]
  readonly defeatedEnemyIds: readonly PrimeboundEnemyId[]
}

export interface PrimeboundProgressSummary {
  readonly completedObjectives: number
  readonly totalObjectives: number
  readonly percentage: number
  readonly isComplete: boolean
}

export const PRIMEBOUND_TILE_LEGEND: Readonly<
  Record<PrimeboundTile, { readonly label: string; readonly walkable: boolean }>
> = {
  '#': { label: 'parede', walkable: false },
  '.': { label: 'chão', walkable: true },
  '~': { label: 'água ou abismo', walkable: false },
  '+': { label: 'trilha ritual', walkable: true },
  '^': { label: 'escombros', walkable: false },
  D: { label: 'passagem', walkable: true },
}

export const PRIMEBOUND_AREAS: Readonly<
  Record<PrimeboundAreaId, PrimeboundArea>
> = {
  'echo-woods': {
    id: 'echo-woods',
    name: 'Bosque dos Ecos',
    subtitle: 'As árvores repetem números que não aceitam divisão.',
    palette: ['#10281d', '#2f6b3e', '#b6e36f'],
    tileMap: [
      '##################',
      '#....~~~.........#',
      '#.##.~~~..##.....#',
      '#.....+..........#',
      '#..##.+..~~~.....#',
      '#......+.........D',
      '#..~~~.+..##.....#',
      '#..~~~.+.........#',
      '#......+..~~~....#',
      '#.........~~~....#',
      '##################',
    ],
    playerSpawn: { x: 2, y: 5 },
    requiredRunesToEnter: [],
    connectionIds: ['woods-to-crypt'],
    npcIds: ['seris'],
    runeValues: [2],
    enemyIds: [
      'quadruped-slime',
      'eight-rootling',
      'twenty-seven-echo-beetle',
      'echo-moth',
    ],
  },
  'composite-crypt': {
    id: 'composite-crypt',
    name: 'Cripta Composta',
    subtitle: 'Cada sombra esconde mais de dois divisores.',
    palette: ['#171526', '#4f426f', '#b49cff'],
    tileMap: [
      '##################',
      '#^^^.....##......#',
      '#.##..^^....##...#',
      '#......##........#',
      '#.^^^^....^^^^...#',
      'D................D',
      '#...^^^^....^^^^.#',
      '#........##......#',
      '#..##....^^..##..#',
      '#......##........#',
      '##################',
    ],
    playerSpawn: { x: 1, y: 5 },
    requiredRunesToEnter: [2],
    connectionIds: ['woods-to-crypt', 'crypt-to-twin-peaks'],
    npcIds: ['orun'],
    runeValues: [3],
    enemyIds: [
      'hexagonal-wraith',
      'ten-divisor-crawler',
      'twenty-one-crypt-shade',
      'fifteen-knight',
    ],
  },
  'twin-peaks': {
    id: 'twin-peaks',
    name: 'Penhascos Gêmeos',
    subtitle: 'Dois cumes separados pela mesma distância que une primos gêmeos.',
    palette: ['#102536', '#24748a', '#76edf0'],
    tileMap: [
      '##################',
      '#..^^......^^....#',
      '#...+......+.....#',
      '#...+..~~..+.....#',
      '#.##+..~~..+.##..#',
      'D...++++++++.....D',
      '#.##+..~~..+.##..#',
      '#...+..~~..+.....#',
      '#...+......+.....#',
      '#..^^......^^....#',
      '##################',
    ],
    playerSpawn: { x: 1, y: 5 },
    requiredRunesToEnter: [2, 3],
    connectionIds: [
      'crypt-to-twin-peaks',
      'twin-peaks-to-residue-forge',
    ],
    npcIds: ['lyra'],
    runeValues: [5],
    enemyIds: [
      'twelve-mirror',
      'eighteen-twin-harrier',
      'forty-four-ridge-splitter',
      'twenty-five-duelist',
    ],
  },
  'residue-forge': {
    id: 'residue-forge',
    name: 'Forja dos Resíduos',
    subtitle: 'Engrenagens incandescentes repetem os padrões de Sophie e Mersenne.',
    palette: ['#2b1517', '#94442e', '#ffb34f'],
    tileMap: [
      '##################',
      '#^^^^..++++..^^^^#',
      '#......+..+......#',
      '#.####.+..+.####.#',
      '#......+..+......#',
      'D.++++++++++++...D',
      '#......+..+......#',
      '#.####.+..+.####.#',
      '#......+..+......#',
      '#^^^^..++++..^^^^#',
      '##################',
    ],
    playerSpawn: { x: 1, y: 5 },
    requiredRunesToEnter: [2, 3, 5],
    connectionIds: [
      'twin-peaks-to-residue-forge',
      'residue-forge-to-eratosthenes',
    ],
    npcIds: ['sophia'],
    runeValues: [],
    enemyIds: [
      'forty-nine-golem',
      'sixty-three-spark-golem',
      'one-twenty-five-residue-smelter',
      'seventy-five-smith',
    ],
  },
  'eratosthenes-garden': {
    id: 'eratosthenes-garden',
    name: 'Jardim de Eratóstenes',
    subtitle: 'Múltiplos corrompidos desaparecem quando o crivo desperta.',
    palette: ['#11251f', '#28785e', '#72efb4'],
    tileMap: [
      '##################',
      '#....+....^^.....#',
      '#.##.+.##....##..#',
      '#....+....+......#',
      '#.^^.++++.+.^^...#',
      'D....+....+......D',
      '#.##.++++.+.##...#',
      '#....+....+......#',
      '#.^^...##.++++...#',
      '#................#',
      '##################',
    ],
    playerSpawn: { x: 1, y: 5 },
    requiredRunesToEnter: [2, 3, 5],
    connectionIds: [
      'residue-forge-to-eratosthenes',
      'eratosthenes-to-goldbach',
    ],
    npcIds: ['theon'],
    runeValues: [7],
    enemyIds: [
      'thirty-five-sieve',
      'forty-two-sieve-runner',
      'sixty-six-grid-reaper',
      'seventy-seven-sentinel',
    ],
  },
  'goldbach-citadel': {
    id: 'goldbach-citadel',
    name: 'Cidadela de Goldbach',
    subtitle: 'Todo portão par espera ser aberto por duas centelhas primas.',
    palette: ['#21182f', '#7551a5', '#ff92d5'],
    tileMap: [
      '##################',
      '#..++......++....#',
      '#..++..##..++....#',
      '#......++........#',
      '#.##...++...##...#',
      'D++++++..++++++..D',
      '#.##...++...##...#',
      '#......++........#',
      '#..++..##..++....#',
      '#..++......++....#',
      '##################',
    ],
    playerSpawn: { x: 1, y: 5 },
    requiredRunesToEnter: [2, 3, 5, 7],
    connectionIds: ['eratosthenes-to-goldbach', 'goldbach-to-wilson'],
    npcIds: ['aurea'],
    runeValues: [11],
    enemyIds: [
      'twenty-two-pair',
      'thirty-three-twin-lancer',
      'sixty-five-sophie-weaver',
      'twenty-six-pair',
    ],
  },
  'wilson-observatory': {
    id: 'wilson-observatory',
    name: 'Observatório de Wilson',
    subtitle: 'Órbitas congruentes giram até revelar o resto menos um.',
    palette: ['#131d36', '#355fa0', '#8fb8ff'],
    tileMap: [
      '##################',
      '#..^^..++++..^^..#',
      '#......+..+......#',
      '#.####.+..+.####.#',
      '#......++++......#',
      'D..++++++++++++..D',
      '#......++++......#',
      '#.####.+..+.####.#',
      '#......+..+......#',
      '#..^^..++++..^^..#',
      '##################',
    ],
    playerSpawn: { x: 1, y: 5 },
    requiredRunesToEnter: [2, 3, 5, 7, 11],
    connectionIds: ['goldbach-to-wilson', 'wilson-to-mobius'],
    npcIds: ['wilson'],
    runeValues: [13],
    enemyIds: [
      'one-forty-three-judge',
      'ninety-one-sieve-orbit',
      'one-twenty-one-power-oracle',
      'one-sixty-nine-congruence',
    ],
  },
  'mobius-labyrinth': {
    id: 'mobius-labyrinth',
    name: 'Labirinto de Möbius',
    subtitle: 'Toda saída retorna invertida pela faixa de uma única face.',
    palette: ['#17152f', '#5945a2', '#d09cff'],
    tileMap: [
      '##################',
      '#..^^........^^..#',
      '#..++++....++++..#',
      '#..+..+....+..+..#',
      '#..+..++++++..+..#',
      'D..+..........+..D',
      '#..+..++++++..+..#',
      '#..+..+....+..+..#',
      '#..++++....++++..#',
      '#..^^........^^..#',
      '##################',
    ],
    playerSpawn: { x: 1, y: 5 },
    requiredRunesToEnter: [2, 3, 5, 7, 11, 13],
    connectionIds: ['wilson-to-mobius', 'mobius-to-fermat'],
    npcIds: [],
    runeValues: [],
    enemyIds: [
      'thirty-mobius-stalker',
      'forty-two-loop-wraith',
      'sixty-mobius-nullshade',
      'seventy-eight-inversion-warden',
    ],
  },
  'fermat-bastion': {
    id: 'fermat-bastion',
    name: 'Bastião de Fermat',
    subtitle: 'Potências dobradas erguem muralhas que parecem eternamente primas.',
    palette: ['#2f1b12', '#a64f2f', '#ffbf62'],
    tileMap: [
      '##################',
      '#....##....##....#',
      '#................#',
      '#..++++....++++..#',
      '#..+..........+..#',
      'D++++++....++++++D',
      '#..+..........+..#',
      '#..++++....++++..#',
      '#................#',
      '#....##....##....#',
      '##################',
    ],
    playerSpawn: { x: 1, y: 5 },
    requiredRunesToEnter: [2, 3, 5, 7, 11, 13],
    connectionIds: ['mobius-to-fermat', 'fermat-to-sieve-foundry'],
    npcIds: [],
    runeValues: [],
    enemyIds: [
      'fifty-five-fermat-squire',
      'ninety-goldbach-artillerist',
      'one-twenty-five-fermat-centurion',
      'one-thirty-fermat-keeper',
    ],
  },
  'sieve-foundry': {
    id: 'sieve-foundry',
    name: 'Fundição do Crivo',
    subtitle: 'Matrizes ardentes eliminam múltiplos em linhas de produção.',
    palette: ['#152821', '#397d63', '#87f2bd'],
    tileMap: [
      '##################',
      '#..^^^^....^^^^..#',
      '#................#',
      '#..++..++++..++..#',
      '#..++........++..#',
      'D++++..++++..++++D',
      '#..++........++..#',
      '#..++..++++..++..#',
      '#................#',
      '#..^^^^....^^^^..#',
      '##################',
    ],
    playerSpawn: { x: 1, y: 5 },
    requiredRunesToEnter: [2, 3, 5, 7, 11, 13],
    connectionIds: ['fermat-to-sieve-foundry', 'sieve-foundry-to-elliptic'],
    npcIds: [],
    runeValues: [],
    enemyIds: [
      'forty-five-sieve-drone',
      'eighty-eight-twin-smith',
      'one-sixty-five-sieve-loader',
      'one-ninety-five-foundry-overseer',
    ],
  },
  'elliptic-nexus': {
    id: 'elliptic-nexus',
    name: 'Nexo Elíptico',
    subtitle: 'Cordas modulares somam pontos sobre curvas que ocultam chaves.',
    palette: ['#15243a', '#286b88', '#7ee8ea'],
    tileMap: [
      '##################',
      '#....++++++......#',
      '#..++......++....#',
      '#.++..^^^^..++...#',
      '#..++......++....#',
      'D....++++++++....D',
      '#..++......++....#',
      '#.++..^^^^..++...#',
      '#..++......++....#',
      '#......++++++....#',
      '##################',
    ],
    playerSpawn: { x: 1, y: 5 },
    requiredRunesToEnter: [2, 3, 5, 7, 11, 13],
    connectionIds: ['sieve-foundry-to-elliptic', 'elliptic-to-sanctuary'],
    npcIds: [],
    runeValues: [],
    enemyIds: [
      'ninety-eight-curve-hunter',
      'one-forty-seven-nexus-seer',
      'one-fifty-four-curve-scribe',
      'two-eighty-six-elliptic-archon',
    ],
  },
  'prime-sanctuary': {
    id: 'prime-sanctuary',
    name: 'Santuário Primo',
    subtitle: 'As seis runas pulsam diante de um guardião corrompido.',
    palette: ['#251b12', '#805729', '#ffd36a'],
    tileMap: [
      '##################',
      '#......++++......#',
      '#.####.+..+.####.#',
      '#......+..+......#',
      '#.####.+..+.####.#',
      'D......+..+......#',
      '#.####.+..+.####.#',
      '#......+..+......#',
      '#.####.++++.####.#',
      '#................#',
      '##################',
    ],
    playerSpawn: { x: 1, y: 5 },
    requiredRunesToEnter: [2, 3, 5, 7, 11, 13],
    connectionIds: ['elliptic-to-sanctuary'],
    npcIds: [],
    runeValues: [],
    enemyIds: [
      'twenty-one-idol',
      'sixty-three-mersenne-seer',
      'sixty-six-goldbach-herald',
      'composite-sentinel',
    ],
  },
}

export const PRIMEBOUND_CONNECTIONS: Readonly<
  Record<PrimeboundConnectionId, PrimeboundConnection>
> = {
  'woods-to-crypt': {
    id: 'woods-to-crypt',
    a: {
      areaId: 'echo-woods',
      portal: { x: 17, y: 5 },
      arrival: { x: 16, y: 5 },
    },
    b: {
      areaId: 'composite-crypt',
      portal: { x: 0, y: 5 },
      arrival: { x: 1, y: 5 },
    },
  },
  'crypt-to-twin-peaks': {
    id: 'crypt-to-twin-peaks',
    a: {
      areaId: 'composite-crypt',
      portal: { x: 17, y: 5 },
      arrival: { x: 16, y: 5 },
    },
    b: {
      areaId: 'twin-peaks',
      portal: { x: 0, y: 5 },
      arrival: { x: 1, y: 5 },
    },
  },
  'twin-peaks-to-residue-forge': {
    id: 'twin-peaks-to-residue-forge',
    a: {
      areaId: 'twin-peaks',
      portal: { x: 17, y: 5 },
      arrival: { x: 16, y: 5 },
    },
    b: {
      areaId: 'residue-forge',
      portal: { x: 0, y: 5 },
      arrival: { x: 1, y: 5 },
    },
  },
  'residue-forge-to-eratosthenes': {
    id: 'residue-forge-to-eratosthenes',
    a: {
      areaId: 'residue-forge',
      portal: { x: 17, y: 5 },
      arrival: { x: 16, y: 5 },
    },
    b: {
      areaId: 'eratosthenes-garden',
      portal: { x: 0, y: 5 },
      arrival: { x: 1, y: 5 },
    },
  },
  'eratosthenes-to-goldbach': {
    id: 'eratosthenes-to-goldbach',
    a: {
      areaId: 'eratosthenes-garden',
      portal: { x: 17, y: 5 },
      arrival: { x: 16, y: 5 },
    },
    b: {
      areaId: 'goldbach-citadel',
      portal: { x: 0, y: 5 },
      arrival: { x: 1, y: 5 },
    },
  },
  'goldbach-to-wilson': {
    id: 'goldbach-to-wilson',
    a: {
      areaId: 'goldbach-citadel',
      portal: { x: 17, y: 5 },
      arrival: { x: 16, y: 5 },
    },
    b: {
      areaId: 'wilson-observatory',
      portal: { x: 0, y: 5 },
      arrival: { x: 1, y: 5 },
    },
  },
  'wilson-to-mobius': {
    id: 'wilson-to-mobius',
    a: {
      areaId: 'wilson-observatory',
      portal: { x: 17, y: 5 },
      arrival: { x: 16, y: 5 },
    },
    b: {
      areaId: 'mobius-labyrinth',
      portal: { x: 0, y: 5 },
      arrival: { x: 1, y: 5 },
    },
  },
  'mobius-to-fermat': {
    id: 'mobius-to-fermat',
    a: {
      areaId: 'mobius-labyrinth',
      portal: { x: 17, y: 5 },
      arrival: { x: 16, y: 5 },
    },
    b: {
      areaId: 'fermat-bastion',
      portal: { x: 0, y: 5 },
      arrival: { x: 1, y: 5 },
    },
  },
  'fermat-to-sieve-foundry': {
    id: 'fermat-to-sieve-foundry',
    a: {
      areaId: 'fermat-bastion',
      portal: { x: 17, y: 5 },
      arrival: { x: 16, y: 5 },
    },
    b: {
      areaId: 'sieve-foundry',
      portal: { x: 0, y: 5 },
      arrival: { x: 1, y: 5 },
    },
  },
  'sieve-foundry-to-elliptic': {
    id: 'sieve-foundry-to-elliptic',
    a: {
      areaId: 'sieve-foundry',
      portal: { x: 17, y: 5 },
      arrival: { x: 16, y: 5 },
    },
    b: {
      areaId: 'elliptic-nexus',
      portal: { x: 0, y: 5 },
      arrival: { x: 1, y: 5 },
    },
  },
  'elliptic-to-sanctuary': {
    id: 'elliptic-to-sanctuary',
    a: {
      areaId: 'elliptic-nexus',
      portal: { x: 17, y: 5 },
      arrival: { x: 16, y: 5 },
    },
    b: {
      areaId: 'prime-sanctuary',
      portal: { x: 0, y: 5 },
      arrival: { x: 1, y: 5 },
    },
  },
}

export const PRIMEBOUND_DIALOGUES: Readonly<
  Record<PrimeboundDialogueId, PrimeboundDialogue>
> = {
  'seris-intro': {
    id: 'seris-intro',
    lines: [
      {
        speaker: 'seris',
        text: 'O bosque só abre passagem para quem escuta os números.',
      },
      { speaker: 'hero', text: 'Que números?' },
      {
        speaker: 'seris',
        text: 'Dois, três e cinco são só o começo. Reúna as seis runas antes que a Sentinela desperte.',
      },
    ],
  },
  'seris-rune': {
    id: 'seris-rune',
    lines: [
      {
        speaker: 'seris',
        text: 'A runa dois é o único primo par. Ela abrirá a cripta.',
      },
    ],
  },
  'orun-intro': {
    id: 'orun-intro',
    lines: [
      {
        speaker: 'orun',
        text: 'Nesta cripta, todo monstro esconde seus divisores.',
      },
      { speaker: 'hero', text: 'Então vou revelar cada fator.' },
      {
        speaker: 'orun',
        text: 'Erga a Guarda de Wilson. No instante exato, o resto menos um revela um primo.',
      },
      {
        speaker: 'hero',
        text: 'Teorema de Wilson!',
      },
    ],
  },
  'orun-rune': {
    id: 'orun-rune',
    lines: [
      {
        speaker: 'orun',
        text: 'Os Penhascos Gêmeos respondem a pares separados por apenas dois.',
      },
    ],
  },
  'lyra-intro': {
    id: 'lyra-intro',
    lines: [
      {
        speaker: 'lyra',
        text: 'Três e cinco são primos gêmeos: dois indivisíveis separados por dois.',
      },
      {
        speaker: 'lyra',
        text: 'Ataque em par e cada lâmina encontrará o fator da outra.',
      },
      {
        speaker: 'hero',
        text: 'Lâminas Gêmeas!',
      },
    ],
  },
  'lyra-rune': {
    id: 'lyra-rune',
    lines: [
      {
        speaker: 'lyra',
        text: 'A runa cinco completa o primeiro par gêmeo depois de um e abre a forja.',
      },
    ],
  },
  'sophia-intro': {
    id: 'sophia-intro',
    lines: [
      {
        speaker: 'sophia',
        text: 'Se p e 2p + 1 são primos, a Corrente de Sophie fecha o circuito.',
      },
      {
        speaker: 'hero',
        text: 'Corrente de Sophie Germain!',
      },
      {
        speaker: 'sophia',
        text: 'Para romper uma horda, procure primos na forma 2 elevado a p menos 1.',
      },
      {
        speaker: 'hero',
        text: 'Ruptura de Mersenne!',
      },
      {
        speaker: 'sophia',
        text: 'E Euclides garante: nenhuma lista consegue conter todos os primos.',
      },
      {
        speaker: 'hero',
        text: 'Infinito de Euclides!',
      },
    ],
  },
  'sophia-mastery': {
    id: 'sophia-mastery',
    lines: [
      {
        speaker: 'sophia',
        text: 'Euclides provou: por maior que seja a lista, sempre existe outro primo.',
      },
      {
        speaker: 'hero',
        text: 'Infinito de Euclides!',
      },
    ],
  },
  'theon-intro': {
    id: 'theon-intro',
    lines: [
      {
        speaker: 'theon',
        text: 'O Crivo de Eratóstenes caça primos eliminando múltiplos, não números ao acaso.',
      },
      {
        speaker: 'hero',
        text: 'Marco 2 e apago seus múltiplos; depois repito com 3, 5 e 7.',
      },
      {
        speaker: 'theon',
        text: 'Exato. Pare quando o primo testado ultrapassar a raiz do limite.',
      },
    ],
  },
  'theon-rune': {
    id: 'theon-rune',
    lines: [
      {
        speaker: 'theon',
        text: 'A Runa 7 sobreviveu ao crivo. Leve sua luz até a cidadela dos pares.',
      },
    ],
  },
  'aurea-intro': {
    id: 'aurea-intro',
    lines: [
      {
        speaker: 'aurea',
        text: 'Goldbach propôs: todo inteiro par maior que 2 é soma de dois primos.',
      },
      {
        speaker: 'hero',
        text: 'Então 22 abre com 11 + 11, e 26 responde a 13 + 13.',
      },
      {
        speaker: 'aurea',
        text: 'Sincronize as duas centelhas. A conjectura vive no equilíbrio do par.',
      },
    ],
  },
  'aurea-rune': {
    id: 'aurea-rune',
    lines: [
      {
        speaker: 'aurea',
        text: 'A Runa 11 guarda duas metades iguais. O observatório aguarda seu pulso.',
      },
    ],
  },
  'wilson-intro': {
    id: 'wilson-intro',
    lines: [
      {
        speaker: 'wilson',
        text: 'Nas congruências, números diferentes podem deixar o mesmo resto.',
      },
      {
        speaker: 'wilson',
        text: 'Para primo p, o fatorial de p menos 1 deixa resto p menos 1 ao dividir por p.',
      },
      {
        speaker: 'hero',
        text: 'Se o resto for menos um, o Selo de Wilson reconhece o primo!',
      },
    ],
  },
  'wilson-rune': {
    id: 'wilson-rune',
    lines: [
      {
        speaker: 'wilson',
        text: 'A Runa 13 fecha a órbita. As seis runas agora podem julgar a Sentinela.',
      },
    ],
  },
}

export const PRIMEBOUND_NPCS: Readonly<
  Record<PrimeboundNpcId, PrimeboundNpc>
> = {
  seris: {
    id: 'seris',
    name: 'Seris',
    title: 'Guardiã dos Ecos',
    areaId: 'echo-woods',
    position: { x: 5, y: 3 },
    dialogueIds: ['seris-intro', 'seris-rune'],
  },
  orun: {
    id: 'orun',
    name: 'Orun',
    title: 'Cartógrafo dos Divisores',
    areaId: 'composite-crypt',
    position: { x: 4, y: 3 },
    dialogueIds: ['orun-intro', 'orun-rune'],
  },
  lyra: {
    id: 'lyra',
    name: 'Lyra',
    title: 'Duelista dos Gêmeos',
    areaId: 'twin-peaks',
    position: { x: 4, y: 3 },
    dialogueIds: ['lyra-intro', 'lyra-rune'],
  },
  sophia: {
    id: 'sophia',
    name: 'Sophia',
    title: 'Mestra das Famílias Primas',
    areaId: 'residue-forge',
    position: { x: 4, y: 2 },
    dialogueIds: ['sophia-intro', 'sophia-mastery'],
  },
  theon: {
    id: 'theon',
    name: 'Theon',
    title: 'Arquivista do Crivo',
    areaId: 'eratosthenes-garden',
    position: { x: 4, y: 3 },
    dialogueIds: ['theon-intro', 'theon-rune'],
  },
  aurea: {
    id: 'aurea',
    name: 'Aurea',
    title: 'Condutora das Duplas',
    areaId: 'goldbach-citadel',
    position: { x: 4, y: 3 },
    dialogueIds: ['aurea-intro', 'aurea-rune'],
  },
  wilson: {
    id: 'wilson',
    name: 'Wilson',
    title: 'Juiz das Congruências',
    areaId: 'wilson-observatory',
    position: { x: 4, y: 2 },
    dialogueIds: ['wilson-intro', 'wilson-rune'],
  },
}

export const PRIMEBOUND_RUNES: Readonly<
  Record<PrimeRuneValue, PrimeRune>
> = {
  2: {
    value: 2,
    name: 'Runa do Par Solitário',
    areaId: 'echo-woods',
    position: { x: 14, y: 3 },
    clue: 'Sou par, mas meus únicos divisores são um e eu mesmo.',
  },
  3: {
    value: 3,
    name: 'Runa do Triângulo',
    areaId: 'composite-crypt',
    position: { x: 14, y: 3 },
    clue: 'Depois do dois, sou o primeiro ímpar que permanece indivisível.',
  },
  5: {
    value: 5,
    name: 'Runa da Última Centelha',
    areaId: 'twin-peaks',
    position: { x: 14, y: 8 },
    clue: 'Com três, formo o primeiro par de primos gêmeos além de um.',
  },
  7: {
    value: 7,
    name: 'Runa do Crivo Vivo',
    areaId: 'eratosthenes-garden',
    position: { x: 15, y: 9 },
    clue: 'Nenhum risco de dois, três ou cinco consegue me eliminar.',
  },
  11: {
    value: 11,
    name: 'Runa da Dupla Dourada',
    areaId: 'goldbach-citadel',
    position: { x: 15, y: 9 },
    clue: 'Duas cópias de mim recompõem o portão par de vinte e dois.',
  },
  13: {
    value: 13,
    name: 'Runa do Resto Estelar',
    areaId: 'wilson-observatory',
    position: { x: 15, y: 9 },
    clue: 'Meu fatorial anterior deixa o mesmo resto que menos um.',
  },
}

export const PRIMEBOUND_ENEMIES: Readonly<
  Record<PrimeboundEnemyId, PrimeboundEnemy>
> = {
  'quadruped-slime': {
    id: 'quadruped-slime',
    name: 'Lodo Quádruplo',
    areaId: 'echo-woods',
    position: { x: 10, y: 3 },
    number: 4,
    primeFactors: [2, 2],
    maxHealth: 20,
    damage: 4,
    encounterRank: 'minion',
    primeFamily: 'prime-powers',
    signaturePower: {
      name: 'Fissão de Potências',
      formula: '4 = 2²',
      description: 'Divide a massa em duas cópias marcadas pelo primo 2.',
    },
    isBoss: false,
  },
  'eight-rootling': {
    id: 'eight-rootling',
    name: 'Rebento das Oito Raízes',
    areaId: 'echo-woods',
    position: { x: 7, y: 7 },
    number: 8,
    primeFactors: [2, 2, 2],
    maxHealth: 24,
    damage: 4,
    encounterRank: 'minion',
    primeFamily: 'prime-powers',
    signaturePower: {
      name: 'Crescimento Cúbico',
      formula: '8 = 2³',
      description: 'Ergue três raízes sucessivas, todas alimentadas pela potência do primo dois.',
    },
    isBoss: false,
  },
  'twenty-seven-echo-beetle': {
    id: 'twenty-seven-echo-beetle',
    name: 'Besouro dos Vinte e Sete Ecos',
    areaId: 'echo-woods',
    position: { x: 14, y: 5 },
    number: 27,
    primeFactors: [3, 3, 3],
    maxHealth: 30,
    damage: 5,
    encounterRank: 'minion',
    primeFamily: 'prime-powers',
    signaturePower: {
      name: 'Carapaça de Três Ecos',
      formula: '27 = 3³',
      description: 'Repete três pulsos em três camadas até a floresta devolver vinte e sete ecos.',
    },
    isBoss: false,
  },
  'echo-moth': {
    id: 'echo-moth',
    name: 'Matriarca dos Nove Ecos',
    areaId: 'echo-woods',
    position: { x: 14, y: 8 },
    number: 9,
    primeFactors: [3, 3],
    maxHealth: 42,
    damage: 6,
    encounterRank: 'area-boss',
    primeFamily: 'prime-powers',
    signaturePower: {
      name: 'Ressonância da Potência',
      formula: '9 = 3²',
      description: 'Replica três ecos em três ondas até preencher nove marcas.',
    },
    isBoss: false,
  },
  'hexagonal-wraith': {
    id: 'hexagonal-wraith',
    name: 'Espectro Hexagonal',
    areaId: 'composite-crypt',
    position: { x: 6, y: 3 },
    number: 6,
    primeFactors: [2, 3],
    maxHealth: 30,
    damage: 6,
    encounterRank: 'minion',
    primeFamily: 'sophie-germain',
    signaturePower: {
      name: 'Elo de Sophie',
      formula: 'p = 2 → 2p + 1 = 5',
      description: 'Liga dois projéteis; o segundo persegue o alvo do primeiro.',
    },
    isBoss: false,
  },
  'ten-divisor-crawler': {
    id: 'ten-divisor-crawler',
    name: 'Rastejante dos Dez Divisores',
    areaId: 'composite-crypt',
    position: { x: 15, y: 2 },
    number: 10,
    primeFactors: [2, 5],
    maxHealth: 34,
    damage: 6,
    encounterRank: 'minion',
    primeFamily: 'sophie-germain',
    signaturePower: {
      name: 'Salto do Primo Seguro',
      formula: 'p = 2 → 2p + 1 = 5',
      description: 'Uma sombra marcada por dois salta para a segunda posição segura, marcada por cinco.',
    },
    isBoss: false,
  },
  'twenty-one-crypt-shade': {
    id: 'twenty-one-crypt-shade',
    name: 'Sombra Crivada Vinte e Um',
    areaId: 'composite-crypt',
    position: { x: 2, y: 6 },
    number: 21,
    primeFactors: [3, 7],
    maxHealth: 40,
    damage: 7,
    encounterRank: 'minion',
    primeFamily: 'eratosthenes-sieve',
    signaturePower: {
      name: 'Marca dos Múltiplos',
      formula: '21 = 3 × 7',
      description: 'Risca o corredor em múltiplos de três antes de fechar a passagem com o fator sete.',
    },
    isBoss: false,
  },
  'fifteen-knight': {
    id: 'fifteen-knight',
    name: 'Paladino Quinze',
    areaId: 'composite-crypt',
    position: { x: 14, y: 7 },
    number: 15,
    primeFactors: [3, 5],
    maxHealth: 58,
    damage: 8,
    encounterRank: 'area-boss',
    primeFamily: 'sophie-germain',
    signaturePower: {
      name: 'Juramento de Sophie',
      formula: 'p = 3 → 2p + 1 = 7',
      description: 'Uma lança inicial acorrenta outra e a faz perseguir o alvo.',
    },
    isBoss: false,
  },
  'twelve-mirror': {
    id: 'twelve-mirror',
    name: 'Espelho dos Doze Rostos',
    areaId: 'twin-peaks',
    position: { x: 11, y: 3 },
    number: 12,
    primeFactors: [2, 2, 3],
    maxHealth: 52,
    damage: 8,
    encounterRank: 'minion',
    primeFamily: 'twin-primes',
    signaturePower: {
      name: 'Reflexo Gêmeo',
      formula: '(5, 7) · 7 − 5 = 2',
      description: 'Duplica o disparo a uma distância modular de dois blocos.',
    },
    isBoss: false,
  },
  'eighteen-twin-harrier': {
    id: 'eighteen-twin-harrier',
    name: 'Hostigador Gêmeo Dezoito',
    areaId: 'twin-peaks',
    position: { x: 5, y: 7 },
    number: 18,
    primeFactors: [2, 3, 3],
    maxHealth: 58,
    damage: 8,
    encounterRank: 'minion',
    primeFamily: 'twin-primes',
    signaturePower: {
      name: 'Rajada dos Dois Cumes',
      formula: '(5, 7) · 7 − 5 = 2',
      description: 'Dispara dos dois cumes em linhas paralelas separadas pelo intervalo primo dois.',
    },
    isBoss: false,
  },
  'forty-four-ridge-splitter': {
    id: 'forty-four-ridge-splitter',
    name: 'Fendedor da Crista Quarenta e Quatro',
    areaId: 'twin-peaks',
    position: { x: 15, y: 2 },
    number: 44,
    primeFactors: [2, 2, 11],
    maxHealth: 66,
    damage: 9,
    encounterRank: 'minion',
    primeFamily: 'twin-primes',
    signaturePower: {
      name: 'Fenda Onze-Treze',
      formula: '(11, 13) · 13 − 11 = 2',
      description: 'Abre duas fissuras nos penhascos e comprime o espaço de duas unidades entre elas.',
    },
    isBoss: false,
  },
  'twenty-five-duelist': {
    id: 'twenty-five-duelist',
    name: 'Soberano Vinte e Cinco',
    areaId: 'twin-peaks',
    position: { x: 14, y: 7 },
    number: 25,
    primeFactors: [5, 5],
    maxHealth: 88,
    damage: 10,
    encounterRank: 'area-boss',
    primeFamily: 'twin-primes',
    signaturePower: {
      name: 'Trono dos Primos Gêmeos',
      formula: '(11, 13) · 13 − 11 = 2',
      description: 'Cruza dois cortes primos e fecha a rota entre eles.',
    },
    isBoss: false,
  },
  'forty-nine-golem': {
    id: 'forty-nine-golem',
    name: 'Golem Quarenta e Nove',
    areaId: 'residue-forge',
    position: { x: 8, y: 2 },
    number: 49,
    primeFactors: [7, 7],
    maxHealth: 78,
    damage: 11,
    encounterRank: 'minion',
    primeFamily: 'sophie-germain',
    signaturePower: {
      name: 'Corrente de Sophie',
      formula: 'p = 5 → 2p + 1 = 11',
      description: 'Uma esfera inicial convoca outra mais forte e perseguidora.',
    },
    isBoss: false,
  },
  'sixty-three-spark-golem': {
    id: 'sixty-three-spark-golem',
    name: 'Golem das Sessenta e Três Faíscas',
    areaId: 'residue-forge',
    position: { x: 7, y: 7 },
    number: 63,
    primeFactors: [3, 3, 7],
    maxHealth: 86,
    damage: 11,
    encounterRank: 'minion',
    primeFamily: 'mersenne',
    signaturePower: {
      name: 'Anéis Três e Sete',
      formula: '63 = 3² × 7 · M₂ = 3 · M₃ = 7',
      description: 'Sobrepõe anéis de três e sete fagulhas para aquecer o núcleo da forja.',
    },
    isBoss: false,
  },
  'one-twenty-five-residue-smelter': {
    id: 'one-twenty-five-residue-smelter',
    name: 'Fundidor de Resíduos Cento e Vinte e Cinco',
    areaId: 'residue-forge',
    position: { x: 11, y: 5 },
    number: 125,
    primeFactors: [5, 5, 5],
    maxHealth: 96,
    damage: 12,
    encounterRank: 'minion',
    primeFamily: 'prime-powers',
    signaturePower: {
      name: 'Cadinho Cúbico',
      formula: '125 = 5³',
      description: 'Funde três camadas do primo cinco e lança os resíduos incandescentes em sequência.',
    },
    isBoss: false,
  },
  'seventy-five-smith': {
    id: 'seventy-five-smith',
    name: 'Mestre-Ferreiro Setenta e Cinco',
    areaId: 'residue-forge',
    position: { x: 14, y: 6 },
    number: 75,
    primeFactors: [3, 5, 5],
    maxHealth: 126,
    damage: 14,
    encounterRank: 'area-boss',
    primeFamily: 'mersenne',
    signaturePower: {
      name: 'Forja de Mersenne',
      formula: '2ᵖ − 1 ∈ {3, 7, 31}',
      description: 'Forja anéis radiais de 3, 7 e 31 fagulhas por fase.',
    },
    isBoss: false,
  },
  'thirty-five-sieve': {
    id: 'thirty-five-sieve',
    name: 'Ceifador Trinta e Cinco',
    areaId: 'eratosthenes-garden',
    position: { x: 10, y: 3 },
    number: 35,
    primeFactors: [5, 7],
    maxHealth: 104,
    damage: 14,
    encounterRank: 'minion',
    primeFamily: 'eratosthenes-sieve',
    signaturePower: {
      name: 'Faixa do Crivo',
      formula: '2, 3, 5, 7 ≤ √77',
      description: 'Marca corredores e elimina posições que são múltiplos.',
    },
    isBoss: false,
  },
  'forty-two-sieve-runner': {
    id: 'forty-two-sieve-runner',
    name: 'Corredor do Crivo Quarenta e Dois',
    areaId: 'eratosthenes-garden',
    position: { x: 5, y: 8 },
    number: 42,
    primeFactors: [2, 3, 7],
    maxHealth: 112,
    damage: 14,
    encounterRank: 'minion',
    primeFamily: 'eratosthenes-sieve',
    signaturePower: {
      name: 'Varredura Dois-Três-Sete',
      formula: '42 = 2 × 3 × 7',
      description: 'Atravessa as linhas do jardim e risca, em ordem, múltiplos de dois, três e sete.',
    },
    isBoss: false,
  },
  'sixty-six-grid-reaper': {
    id: 'sixty-six-grid-reaper',
    name: 'Ceifador da Grade Sessenta e Seis',
    areaId: 'eratosthenes-garden',
    position: { x: 15, y: 5 },
    number: 66,
    primeFactors: [2, 3, 11],
    maxHealth: 124,
    damage: 15,
    encounterRank: 'minion',
    primeFamily: 'eratosthenes-sieve',
    signaturePower: {
      name: 'Cruzamento do Crivo',
      formula: '66 = 2 × 3 × 11',
      description: 'Cruza três faixas de eliminação e deixa acesas apenas as células que escapam ao crivo.',
    },
    isBoss: false,
  },
  'seventy-seven-sentinel': {
    id: 'seventy-seven-sentinel',
    name: 'Arquissentinela Setenta e Sete',
    areaId: 'eratosthenes-garden',
    position: { x: 13, y: 8 },
    number: 77,
    primeFactors: [7, 11],
    maxHealth: 158,
    damage: 17,
    encounterRank: 'area-boss',
    primeFamily: 'eratosthenes-sieve',
    signaturePower: {
      name: 'Julgamento do Crivo',
      formula: '77 = 7 × 11',
      description: 'Cruza faixas de múltiplos; só lacunas primas ficam seguras.',
    },
    isBoss: false,
  },
  'twenty-two-pair': {
    id: 'twenty-two-pair',
    name: 'Duplo Vinte e Dois',
    areaId: 'goldbach-citadel',
    position: { x: 10, y: 3 },
    number: 22,
    primeFactors: [2, 11],
    maxHealth: 128,
    damage: 16,
    encounterRank: 'minion',
    primeFamily: 'goldbach',
    signaturePower: {
      name: 'Dueto de Goldbach',
      formula: '22 = 11 + 11',
      description: 'Duas centelhas primas convergem no mesmo ponto de impacto.',
    },
    isBoss: false,
  },
  'thirty-three-twin-lancer': {
    id: 'thirty-three-twin-lancer',
    name: 'Lanceiro Gêmeo Trinta e Três',
    areaId: 'goldbach-citadel',
    position: { x: 5, y: 7 },
    number: 33,
    primeFactors: [3, 11],
    maxHealth: 142,
    damage: 16,
    encounterRank: 'minion',
    primeFamily: 'twin-primes',
    signaturePower: {
      name: 'Estocada do Intervalo Dois',
      formula: '(17, 19) · 19 − 17 = 2',
      description: 'Projeta duas lanças paralelas separadas pelo intervalo dos primos gêmeos.',
    },
    isBoss: false,
  },
  'sixty-five-sophie-weaver': {
    id: 'sixty-five-sophie-weaver',
    name: 'Tecelã de Sophie Sessenta e Cinco',
    areaId: 'goldbach-citadel',
    position: { x: 14, y: 2 },
    number: 65,
    primeFactors: [5, 13],
    maxHealth: 158,
    damage: 17,
    encounterRank: 'minion',
    primeFamily: 'sophie-germain',
    signaturePower: {
      name: 'Trama Segura de Sophie',
      formula: 'p = 5 → 2p + 1 = 11',
      description: 'Encadeia uma centelha ao primo seguro seguinte e fecha a rota de fuga.',
    },
    isBoss: false,
  },
  'twenty-six-pair': {
    id: 'twenty-six-pair',
    name: 'Gêmeo Áureo Vinte e Seis',
    areaId: 'goldbach-citadel',
    position: { x: 14, y: 8 },
    number: 26,
    primeFactors: [2, 13],
    maxHealth: 194,
    damage: 19,
    encounterRank: 'area-boss',
    primeFamily: 'goldbach',
    signaturePower: {
      name: 'Conjectura Áurea',
      formula: '26 = 13 + 13',
      description: 'Telegrava duas explosões pareadas que somam uma zona par.',
    },
    isBoss: false,
  },
  'ninety-one-sieve-orbit': {
    id: 'ninety-one-sieve-orbit',
    name: 'Crivador Orbital Noventa e Um',
    areaId: 'wilson-observatory',
    position: { x: 7, y: 8 },
    number: 91,
    primeFactors: [7, 13],
    maxHealth: 170,
    damage: 18,
    encounterRank: 'minion',
    primeFamily: 'eratosthenes-sieve',
    signaturePower: {
      name: 'Crivo Orbital',
      formula: '91 = 7 × 13',
      description: 'Risca órbitas múltiplas de sete até restar um corredor seguro.',
    },
    isBoss: false,
  },
  'one-twenty-one-power-oracle': {
    id: 'one-twenty-one-power-oracle',
    name: 'Oráculo da Potência Cento e Vinte e Um',
    areaId: 'wilson-observatory',
    position: { x: 12, y: 5 },
    number: 121,
    primeFactors: [11, 11],
    maxHealth: 188,
    damage: 20,
    encounterRank: 'minion',
    primeFamily: 'prime-powers',
    signaturePower: {
      name: 'Quadrado do Resto',
      formula: '121 = 11²',
      description: 'Duplica onze resíduos em duas órbitas quadradas que convergem no alvo.',
    },
    isBoss: false,
  },
  'one-forty-three-judge': {
    id: 'one-forty-three-judge',
    name: 'Juiz Cento e Quarenta e Três',
    areaId: 'wilson-observatory',
    position: { x: 10, y: 2 },
    number: 143,
    primeFactors: [11, 13],
    maxHealth: 154,
    damage: 18,
    encounterRank: 'minion',
    primeFamily: 'wilson',
    signaturePower: {
      name: 'Órbita Fatorial',
      formula: '10! ≡ −1 (mod 11)',
      description: 'Projéteis orbitam em onze resíduos antes de serem lançados.',
    },
    isBoss: false,
  },
  'one-sixty-nine-congruence': {
    id: 'one-sixty-nine-congruence',
    name: 'Arconte da Órbita Cento e Sessenta e Nove',
    areaId: 'wilson-observatory',
    position: { x: 14, y: 8 },
    number: 169,
    primeFactors: [13, 13],
    maxHealth: 238,
    damage: 22,
    encounterRank: 'area-boss',
    primeFamily: 'wilson',
    signaturePower: {
      name: 'Veredito de Wilson',
      formula: '12! ≡ −1 (mod 13)',
      description: 'Fecha treze órbitas fatoriais e dispara no resto menos um.',
    },
    isBoss: false,
  },
  'thirty-mobius-stalker': {
    id: 'thirty-mobius-stalker',
    name: 'Rastreador de Möbius Trinta',
    areaId: 'mobius-labyrinth',
    position: { x: 6, y: 2 },
    number: 30,
    primeFactors: [2, 3, 5],
    maxHealth: 160,
    damage: 18,
    encounterRank: 'minion',
    primeFamily: 'twin-primes',
    signaturePower: {
      name: 'Trilha Gêmea',
      formula: '(29, 31) · 31 − 29 = 2',
      description: 'Percorre as duas bordas aparentes da faixa antes de cruzar o centro.',
    },
    isBoss: false,
  },
  'forty-two-loop-wraith': {
    id: 'forty-two-loop-wraith',
    name: 'Espectro do Laço Quarenta e Dois',
    areaId: 'mobius-labyrinth',
    position: { x: 13, y: 6 },
    number: 42,
    primeFactors: [2, 3, 7],
    maxHealth: 172,
    damage: 19,
    encounterRank: 'minion',
    primeFamily: 'sophie-germain',
    signaturePower: {
      name: 'Laço Seguro de Sophie',
      formula: 'p = 11 → 2p + 1 = 23',
      description: 'Liga a primeira sombra a uma segunda que reaparece pelo lado invertido.',
    },
    isBoss: false,
  },
  'sixty-mobius-nullshade': {
    id: 'sixty-mobius-nullshade',
    name: 'Sombra Nula de Möbius Sessenta',
    areaId: 'mobius-labyrinth',
    position: { x: 10, y: 2 },
    number: 60,
    primeFactors: [2, 2, 3, 5],
    maxHealth: 186,
    damage: 20,
    encounterRank: 'minion',
    primeFamily: 'prime-powers',
    signaturePower: {
      name: 'Nó do Fator Quadrado',
      formula: 'μ(60) = 0, pois 2² | 60',
      description: 'Dobra a faixa sobre um fator quadrado e apaga a trilha quando a inversão chega a zero.',
    },
    isBoss: false,
  },
  'seventy-eight-inversion-warden': {
    id: 'seventy-eight-inversion-warden',
    name: 'Guardião da Inversão Setenta e Oito',
    areaId: 'mobius-labyrinth',
    position: { x: 9, y: 5 },
    number: 78,
    primeFactors: [2, 3, 13],
    maxHealth: 270,
    damage: 23,
    encounterRank: 'area-boss',
    primeFamily: 'wilson',
    signaturePower: {
      name: 'Congruência Invertida',
      formula: '12! ≡ −1 (mod 13)',
      description: 'Inverte o sentido das órbitas e fecha a faixa sobre o resto menos um.',
    },
    isBoss: false,
  },
  'fifty-five-fermat-squire': {
    id: 'fifty-five-fermat-squire',
    name: 'Escudeiro de Fermat Cinquenta e Cinco',
    areaId: 'fermat-bastion',
    position: { x: 8, y: 2 },
    number: 55,
    primeFactors: [5, 11],
    maxHealth: 168,
    damage: 19,
    encounterRank: 'minion',
    primeFamily: 'twin-primes',
    signaturePower: {
      name: 'Muralhas Gêmeas',
      formula: '(41, 43) · 43 − 41 = 2',
      description: 'Ergue dois escudos paralelos separados por um intervalo de duas unidades.',
    },
    isBoss: false,
  },
  'ninety-goldbach-artillerist': {
    id: 'ninety-goldbach-artillerist',
    name: 'Artilheiro de Goldbach Noventa',
    areaId: 'fermat-bastion',
    position: { x: 14, y: 2 },
    number: 90,
    primeFactors: [2, 3, 3, 5],
    maxHealth: 182,
    damage: 20,
    encounterRank: 'minion',
    primeFamily: 'goldbach',
    signaturePower: {
      name: 'Bombarda Par',
      formula: '90 = 43 + 47',
      description: 'Dispara duas cargas primas que recompõem noventa no mesmo impacto.',
    },
    isBoss: false,
  },
  'one-twenty-five-fermat-centurion': {
    id: 'one-twenty-five-fermat-centurion',
    name: 'Centurião de Fermat Cento e Vinte e Cinco',
    areaId: 'fermat-bastion',
    position: { x: 4, y: 7 },
    number: 125,
    primeFactors: [5, 5, 5],
    maxHealth: 204,
    damage: 21,
    encounterRank: 'minion',
    primeFamily: 'prime-powers',
    signaturePower: {
      name: 'Muralha da Quinta Potência',
      formula: '125 = 5³',
      description: 'Empilha três blocos do primo cinco e os projeta como uma muralha de potência.',
    },
    isBoss: false,
  },
  'one-thirty-fermat-keeper': {
    id: 'one-thirty-fermat-keeper',
    name: 'Castelão de Fermat Cento e Trinta',
    areaId: 'fermat-bastion',
    position: { x: 9, y: 7 },
    number: 130,
    primeFactors: [2, 5, 13],
    maxHealth: 300,
    damage: 24,
    encounterRank: 'area-boss',
    primeFamily: 'prime-powers',
    signaturePower: {
      name: 'Bastião de Fermat',
      formula: 'F₄ = 2¹⁶ + 1 = 65 537',
      description: 'Duplica potências até erguer uma muralha e colapsá-la sobre o invasor.',
    },
    isBoss: false,
  },
  'forty-five-sieve-drone': {
    id: 'forty-five-sieve-drone',
    name: 'Drone do Crivo Quarenta e Cinco',
    areaId: 'sieve-foundry',
    position: { x: 8, y: 2 },
    number: 45,
    primeFactors: [3, 3, 5],
    maxHealth: 176,
    damage: 20,
    encounterRank: 'minion',
    primeFamily: 'mersenne',
    signaturePower: {
      name: 'Reator de Mersenne',
      formula: '2⁵ − 1 = 31',
      description: 'Carrega trinta e uma fagulhas e as despeja pela linha da fundição.',
    },
    isBoss: false,
  },
  'eighty-eight-twin-smith': {
    id: 'eighty-eight-twin-smith',
    name: 'Ferreiro Gêmeo Oitenta e Oito',
    areaId: 'sieve-foundry',
    position: { x: 15, y: 4 },
    number: 88,
    primeFactors: [2, 2, 2, 11],
    maxHealth: 194,
    damage: 21,
    encounterRank: 'minion',
    primeFamily: 'twin-primes',
    signaturePower: {
      name: 'Martelos Gêmeos',
      formula: '(41, 43) · 43 − 41 = 2',
      description: 'Golpeia a matriz em dois pontos separados pelo intervalo primo mínimo.',
    },
    isBoss: false,
  },
  'one-sixty-five-sieve-loader': {
    id: 'one-sixty-five-sieve-loader',
    name: 'Carregador do Crivo Cento e Sessenta e Cinco',
    areaId: 'sieve-foundry',
    position: { x: 3, y: 7 },
    number: 165,
    primeFactors: [3, 5, 11],
    maxHealth: 216,
    damage: 22,
    encounterRank: 'minion',
    primeFamily: 'eratosthenes-sieve',
    signaturePower: {
      name: 'Esteira Três-Cinco-Onze',
      formula: '165 = 3 × 5 × 11',
      description: 'Alimenta a fundição com três linhas de múltiplos que avançam em ritmos diferentes.',
    },
    isBoss: false,
  },
  'one-ninety-five-foundry-overseer': {
    id: 'one-ninety-five-foundry-overseer',
    name: 'Supervisor do Crivo Cento e Noventa e Cinco',
    areaId: 'sieve-foundry',
    position: { x: 8, y: 7 },
    number: 195,
    primeFactors: [3, 5, 13],
    maxHealth: 335,
    damage: 25,
    encounterRank: 'area-boss',
    primeFamily: 'eratosthenes-sieve',
    signaturePower: {
      name: 'Linha de Eliminação',
      formula: '195 = 3 × 5 × 13',
      description: 'Varre múltiplos de três, cinco e treze em faixas sucessivas da arena.',
    },
    isBoss: false,
  },
  'ninety-eight-curve-hunter': {
    id: 'ninety-eight-curve-hunter',
    name: 'Caçador da Curva Noventa e Oito',
    areaId: 'elliptic-nexus',
    position: { x: 4, y: 2 },
    number: 98,
    primeFactors: [2, 7, 7],
    maxHealth: 184,
    damage: 21,
    encounterRank: 'minion',
    primeFamily: 'goldbach',
    signaturePower: {
      name: 'Soma sobre a Curva',
      formula: '98 = 19 + 79',
      description: 'Lança dois pontos primos e soma suas trajetórias numa única corda.',
    },
    isBoss: false,
  },
  'one-forty-seven-nexus-seer': {
    id: 'one-forty-seven-nexus-seer',
    name: 'Vidente do Nexo Cento e Quarenta e Sete',
    areaId: 'elliptic-nexus',
    position: { x: 14, y: 8 },
    number: 147,
    primeFactors: [3, 7, 7],
    maxHealth: 208,
    damage: 22,
    encounterRank: 'minion',
    primeFamily: 'mersenne',
    signaturePower: {
      name: 'Ponto de Mersenne',
      formula: '2⁷ − 1 = 127',
      description: 'Projeta sete pontos de energia e os fecha numa estrela sobre a curva.',
    },
    isBoss: false,
  },
  'one-fifty-four-curve-scribe': {
    id: 'one-fifty-four-curve-scribe',
    name: 'Escriba da Curva Cento e Cinquenta e Quatro',
    areaId: 'elliptic-nexus',
    position: { x: 14, y: 2 },
    number: 154,
    primeFactors: [2, 7, 11],
    maxHealth: 226,
    damage: 23,
    encounterRank: 'minion',
    primeFamily: 'sophie-germain',
    signaturePower: {
      name: 'Secante do Primo Seguro',
      formula: 'p = 11 → 2p + 1 = 23',
      description: 'Traça uma secante entre dois pontos e faz o segundo perseguir a tangente prevista.',
    },
    isBoss: false,
  },
  'two-eighty-six-elliptic-archon': {
    id: 'two-eighty-six-elliptic-archon',
    name: 'Arconte Elíptico Duzentos e Oitenta e Seis',
    areaId: 'elliptic-nexus',
    position: { x: 11, y: 5 },
    number: 286,
    primeFactors: [2, 11, 13],
    maxHealth: 370,
    damage: 27,
    encounterRank: 'area-boss',
    primeFamily: 'wilson',
    signaturePower: {
      name: 'Julgamento da Curva',
      formula: '12! ≡ −1 (mod 13)',
      description: 'Orbita pontos modulares e dispara quando a tangente encontra o resto menos um.',
    },
    isBoss: false,
  },
  'twenty-one-idol': {
    id: 'twenty-one-idol',
    name: 'Ídolo Vinte e Um',
    areaId: 'prime-sanctuary',
    position: { x: 4, y: 7 },
    number: 21,
    primeFactors: [3, 7],
    maxHealth: 190,
    damage: 22,
    encounterRank: 'minion',
    primeFamily: 'prime-powers',
    signaturePower: {
      name: 'Ídolo dos Fatores',
      formula: '21 = 3 × 7',
      description: 'Alterna ondas de três golpes com uma muralha de sete selos.',
    },
    isBoss: false,
  },
  'sixty-three-mersenne-seer': {
    id: 'sixty-three-mersenne-seer',
    name: 'Vidente de Mersenne Sessenta e Três',
    areaId: 'prime-sanctuary',
    position: { x: 9, y: 8 },
    number: 63,
    primeFactors: [3, 3, 7],
    maxHealth: 236,
    damage: 22,
    encounterRank: 'minion',
    primeFamily: 'mersenne',
    signaturePower: {
      name: 'Conjunção de Mersenne',
      formula: '63 = 3² × 7 · M₂ = 3 · M₃ = 7',
      description: 'Sobrepõe anéis de três e sete fagulhas antes de romper o centro.',
    },
    isBoss: false,
  },
  'sixty-six-goldbach-herald': {
    id: 'sixty-six-goldbach-herald',
    name: 'Arauto de Goldbach Sessenta e Seis',
    areaId: 'prime-sanctuary',
    position: { x: 8, y: 2 },
    number: 66,
    primeFactors: [2, 3, 11],
    maxHealth: 220,
    damage: 23,
    encounterRank: 'minion',
    primeFamily: 'goldbach',
    signaturePower: {
      name: 'Procissão Par',
      formula: '66 = 29 + 37',
      description: 'Conduz duas centelhas primas opostas para uma explosão par no altar.',
    },
    isBoss: false,
  },
  'composite-sentinel': {
    id: 'composite-sentinel',
    name: 'Sentinela Composta',
    areaId: 'prime-sanctuary',
    position: { x: 14, y: 5 },
    number: 35,
    primeFactors: [5, 7],
    maxHealth: 420,
    damage: 30,
    encounterRank: 'final-boss',
    primeFamily: 'prime-powers',
    signaturePower: {
      name: 'Colapso das Seis Runas',
      formula: '35 = 5 × 7',
      description: 'Combina as seis famílias primas em fases de corrupção.',
    },
    isBoss: true,
  },
}

export const PRIMEBOUND_OBJECTIVES: Readonly<
  Record<PrimeboundObjectiveId, PrimeboundObjective>
> = {
  'meet-seris': {
    id: 'meet-seris',
    kind: 'talk',
    title: 'Encontre Seris',
    detail: 'Siga a trilha luminosa no Bosque dos Ecos.',
    areaId: 'echo-woods',
  },
  'clear-echo-woods': {
    id: 'clear-echo-woods',
    kind: 'battle',
    title: 'Silencie a Matriarca dos Ecos',
    detail: 'Fatore 4 e sobreviva às nove marcas da Matriarca.',
    areaId: 'echo-woods',
  },
  'collect-rune-2': {
    id: 'collect-rune-2',
    kind: 'collect',
    title: 'Recolha a runa 2',
    detail: 'A primeira runa apareceu entre as árvores antigas.',
    areaId: 'echo-woods',
  },
  'enter-composite-crypt': {
    id: 'enter-composite-crypt',
    kind: 'travel',
    title: 'Entre na Cripta Composta',
    detail: 'Use a passagem a leste do bosque.',
    areaId: 'composite-crypt',
  },
  'meet-orun': {
    id: 'meet-orun',
    kind: 'talk',
    title: 'Fale com Orun',
    detail: 'O cartógrafo conhece os divisores que assombram a cripta.',
    areaId: 'composite-crypt',
  },
  'clear-composite-crypt': {
    id: 'clear-composite-crypt',
    kind: 'battle',
    title: 'Rompa o juramento do Paladino',
    detail: 'Fatore 6 e quebre a Corrente de Sophie do Paladino Quinze.',
    areaId: 'composite-crypt',
  },
  'collect-rune-3': {
    id: 'collect-rune-3',
    kind: 'collect',
    title: 'Recolha a runa 3',
    detail: 'O símbolo triangular pulsa no salão silencioso.',
    areaId: 'composite-crypt',
  },
  'enter-twin-peaks': {
    id: 'enter-twin-peaks',
    kind: 'travel',
    title: 'Suba aos Penhascos Gêmeos',
    detail: 'Una as runas 2 e 3 para estabilizar a ponte entre os cumes.',
    areaId: 'twin-peaks',
  },
  'meet-lyra': {
    id: 'meet-lyra',
    kind: 'talk',
    title: 'Treine com Lyra',
    detail: 'Aprenda por que certos primos sempre combatem em pares.',
    areaId: 'twin-peaks',
  },
  'clear-twin-peaks': {
    id: 'clear-twin-peaks',
    kind: 'battle',
    title: 'Desafie o Soberano Gêmeo',
    detail: 'Fatore 12 e 25 enquanto escapa de seus cortes separados por dois.',
    areaId: 'twin-peaks',
  },
  'collect-rune-5': {
    id: 'collect-rune-5',
    kind: 'collect',
    title: 'Recolha a runa 5',
    detail: 'Complete o par 3 e 5 no cume oriental.',
    areaId: 'twin-peaks',
  },
  'enter-residue-forge': {
    id: 'enter-residue-forge',
    kind: 'travel',
    title: 'Acenda a Forja dos Resíduos',
    detail: 'As três runas alimentam a passagem para a quarta região.',
    areaId: 'residue-forge',
  },
  'meet-sophia': {
    id: 'meet-sophia',
    kind: 'talk',
    title: 'Encontre Sophia',
    detail: 'Descubra as famílias de Sophie Germain e Mersenne.',
    areaId: 'residue-forge',
  },
  'clear-residue-forge': {
    id: 'clear-residue-forge',
    kind: 'battle',
    title: 'Apague a Forja de Mersenne',
    detail: 'Desmonte 49 e o Mestre-Ferreiro antes do anel de 31 fagulhas.',
    areaId: 'residue-forge',
  },
  'enter-eratosthenes-garden': {
    id: 'enter-eratosthenes-garden',
    kind: 'travel',
    title: 'Atravesse o Jardim de Eratóstenes',
    detail: 'Siga a trilha verde além da forja e encontre o crivo vivo.',
    areaId: 'eratosthenes-garden',
  },
  'meet-theon': {
    id: 'meet-theon',
    kind: 'talk',
    title: 'Aprenda o crivo com Theon',
    detail: 'O arquivista sabe eliminar múltiplos sem ferir os primos.',
    areaId: 'eratosthenes-garden',
  },
  'clear-eratosthenes-garden': {
    id: 'clear-eratosthenes-garden',
    kind: 'battle',
    title: 'Atravesse o Julgamento do Crivo',
    detail: 'Decomponha 35 e 77 enquanto múltiplos apagam trilhas inteiras.',
    areaId: 'eratosthenes-garden',
  },
  'collect-rune-7': {
    id: 'collect-rune-7',
    kind: 'collect',
    title: 'Recolha a runa 7',
    detail: 'O primeiro sobrevivente do novo crivo pulsa no jardim.',
    areaId: 'eratosthenes-garden',
  },
  'enter-goldbach-citadel': {
    id: 'enter-goldbach-citadel',
    kind: 'travel',
    title: 'Entre na Cidadela de Goldbach',
    detail: 'As runas 2 e 7 alinham as duas metades do portão par.',
    areaId: 'goldbach-citadel',
  },
  'meet-aurea': {
    id: 'meet-aurea',
    kind: 'talk',
    title: 'Fale com Aurea',
    detail: 'A condutora conhece os pares primos que recompõem números pares.',
    areaId: 'goldbach-citadel',
  },
  'clear-goldbach-citadel': {
    id: 'clear-goldbach-citadel',
    kind: 'battle',
    title: 'Quebre a Conjectura Áurea',
    detail: 'Rompa as duplas 22 e 26 e atravesse as guardas de Sophie e dos gêmeos.',
    areaId: 'goldbach-citadel',
  },
  'collect-rune-11': {
    id: 'collect-rune-11',
    kind: 'collect',
    title: 'Recolha a runa 11',
    detail: 'Duas centelhas de onze fizeram o selo dourado aparecer.',
    areaId: 'goldbach-citadel',
  },
  'enter-wilson-observatory': {
    id: 'enter-wilson-observatory',
    kind: 'travel',
    title: 'Suba ao Observatório de Wilson',
    detail: 'Use cinco runas para estabilizar as órbitas congruentes.',
    areaId: 'wilson-observatory',
  },
  'meet-wilson': {
    id: 'meet-wilson',
    kind: 'talk',
    title: 'Consulte o Juiz Wilson',
    detail: 'Aprenda a reconhecer primos pelo resto de um fatorial.',
    areaId: 'wilson-observatory',
  },
  'clear-wilson-observatory': {
    id: 'clear-wilson-observatory',
    kind: 'battle',
    title: 'Conteste o Veredito de Wilson',
    detail: 'Crive 91, rompa a potência 121 e conteste as órbitas de 143 e 169.',
    areaId: 'wilson-observatory',
  },
  'collect-rune-13': {
    id: 'collect-rune-13',
    kind: 'collect',
    title: 'Recolha a runa 13',
    detail: 'O resto menos um revelou a última runa antes do santuário.',
    areaId: 'wilson-observatory',
  },
  'enter-mobius-labyrinth': {
    id: 'enter-mobius-labyrinth',
    kind: 'travel',
    title: 'Entre no Labirinto de Möbius',
    detail: 'Atravesse a órbita oriental e alcance a faixa de uma única face.',
    areaId: 'mobius-labyrinth',
  },
  'clear-mobius-labyrinth': {
    id: 'clear-mobius-labyrinth',
    kind: 'battle',
    title: 'Desfaça a inversão de Möbius',
    detail: 'Rompa 30 e 42 antes de enfrentar o Guardião da Inversão 78.',
    areaId: 'mobius-labyrinth',
  },
  'enter-fermat-bastion': {
    id: 'enter-fermat-bastion',
    kind: 'travel',
    title: 'Invada o Bastião de Fermat',
    detail: 'Siga a faixa reinvertida até as muralhas erguidas por potências dobradas.',
    areaId: 'fermat-bastion',
  },
  'clear-fermat-bastion': {
    id: 'clear-fermat-bastion',
    kind: 'battle',
    title: 'Derrube o Bastião de Fermat',
    detail: 'Supere 55 e 90 e desmonte a fortaleza composta do Castelão 130.',
    areaId: 'fermat-bastion',
  },
  'enter-sieve-foundry': {
    id: 'enter-sieve-foundry',
    kind: 'travel',
    title: 'Acesse a Fundição do Crivo',
    detail: 'Cruze o bastião para alcançar as matrizes que eliminam múltiplos.',
    areaId: 'sieve-foundry',
  },
  'clear-sieve-foundry': {
    id: 'clear-sieve-foundry',
    kind: 'battle',
    title: 'Interrompa a linha de eliminação',
    detail: 'Desative 45 e 88 antes que o Supervisor 195 complete o crivo.',
    areaId: 'sieve-foundry',
  },
  'enter-elliptic-nexus': {
    id: 'enter-elliptic-nexus',
    kind: 'travel',
    title: 'Alcance o Nexo Elíptico',
    detail: 'Atravesse a última matriz e siga as cordas de pontos modulares.',
    areaId: 'elliptic-nexus',
  },
  'clear-elliptic-nexus': {
    id: 'clear-elliptic-nexus',
    kind: 'battle',
    title: 'Quebre o julgamento da curva',
    detail: 'Separe 98 e 147 e derrote o Arconte Elíptico 286.',
    areaId: 'elliptic-nexus',
  },
  'enter-prime-sanctuary': {
    id: 'enter-prime-sanctuary',
    kind: 'travel',
    title: 'Alcance o Santuário Primo',
    detail: 'Atravesse o Nexo Elíptico carregando as seis runas primas.',
    areaId: 'prime-sanctuary',
  },
  'clear-prime-sanctuary': {
    id: 'clear-prime-sanctuary',
    kind: 'battle',
    title: 'Derrube as três guardas do altar',
    detail: 'Separe 21, 63 e 66 para silenciar as três guardas do altar.',
    areaId: 'prime-sanctuary',
  },
  'defeat-composite-sentinel': {
    id: 'defeat-composite-sentinel',
    kind: 'boss',
    title: 'Derrote a Sentinela Composta',
    detail: 'Use 5 × 7 para romper a armadura de 35.',
    areaId: 'prime-sanctuary',
  },
  victory: {
    id: 'victory',
    kind: 'complete',
    title: 'O Último Primo despertou',
    detail: 'As seis runas restauraram as doze regiões do Santuário Primo.',
    areaId: null,
  },
}

export const PRIMEBOUND_OBJECTIVE_ORDER = [
  'meet-seris',
  'clear-echo-woods',
  'collect-rune-2',
  'enter-composite-crypt',
  'meet-orun',
  'clear-composite-crypt',
  'collect-rune-3',
  'enter-twin-peaks',
  'meet-lyra',
  'clear-twin-peaks',
  'collect-rune-5',
  'enter-residue-forge',
  'meet-sophia',
  'clear-residue-forge',
  'enter-eratosthenes-garden',
  'meet-theon',
  'clear-eratosthenes-garden',
  'collect-rune-7',
  'enter-goldbach-citadel',
  'meet-aurea',
  'clear-goldbach-citadel',
  'collect-rune-11',
  'enter-wilson-observatory',
  'meet-wilson',
  'clear-wilson-observatory',
  'collect-rune-13',
  'enter-mobius-labyrinth',
  'clear-mobius-labyrinth',
  'enter-fermat-bastion',
  'clear-fermat-bastion',
  'enter-sieve-foundry',
  'clear-sieve-foundry',
  'enter-elliptic-nexus',
  'clear-elliptic-nexus',
  'enter-prime-sanctuary',
  'clear-prime-sanctuary',
  'defeat-composite-sentinel',
] as const satisfies readonly PrimeboundObjectiveId[]

export const INITIAL_PRIMEBOUND_PROGRESS: PrimeboundProgress = {
  currentAreaId: 'echo-woods',
  visitedAreaIds: ['echo-woods'],
  completedStageIds: [],
  spokenNpcIds: [],
  collectedRunes: [],
  defeatedEnemyIds: [],
}

export const PRIMEBOUND_WORLD = {
  id: 'primebound',
  title: 'Primebound — O Último Primo',
  tileSize: 16,
  startAreaId: 'echo-woods',
  areaOrder: [
    'echo-woods',
    'composite-crypt',
    'twin-peaks',
    'residue-forge',
    'eratosthenes-garden',
    'goldbach-citadel',
    'wilson-observatory',
    'mobius-labyrinth',
    'fermat-bastion',
    'sieve-foundry',
    'elliptic-nexus',
    'prime-sanctuary',
  ],
  finalBossId: 'composite-sentinel',
  areas: PRIMEBOUND_AREAS,
  connections: PRIMEBOUND_CONNECTIONS,
  npcs: PRIMEBOUND_NPCS,
  dialogues: PRIMEBOUND_DIALOGUES,
  runes: PRIMEBOUND_RUNES,
  enemies: PRIMEBOUND_ENEMIES,
} as const

const AREA_GUARDIANS: Readonly<
  Record<PrimeboundAreaId, readonly PrimeboundEnemyId[]>
> = {
  'echo-woods': [
    'quadruped-slime',
    'eight-rootling',
    'twenty-seven-echo-beetle',
    'echo-moth',
  ],
  'composite-crypt': [
    'hexagonal-wraith',
    'ten-divisor-crawler',
    'twenty-one-crypt-shade',
    'fifteen-knight',
  ],
  'twin-peaks': [
    'twelve-mirror',
    'eighteen-twin-harrier',
    'forty-four-ridge-splitter',
    'twenty-five-duelist',
  ],
  'residue-forge': [
    'forty-nine-golem',
    'sixty-three-spark-golem',
    'one-twenty-five-residue-smelter',
    'seventy-five-smith',
  ],
  'eratosthenes-garden': [
    'thirty-five-sieve',
    'forty-two-sieve-runner',
    'sixty-six-grid-reaper',
    'seventy-seven-sentinel',
  ],
  'goldbach-citadel': [
    'twenty-two-pair',
    'thirty-three-twin-lancer',
    'sixty-five-sophie-weaver',
    'twenty-six-pair',
  ],
  'wilson-observatory': [
    'one-forty-three-judge',
    'ninety-one-sieve-orbit',
    'one-twenty-one-power-oracle',
    'one-sixty-nine-congruence',
  ],
  'mobius-labyrinth': [
    'thirty-mobius-stalker',
    'forty-two-loop-wraith',
    'sixty-mobius-nullshade',
    'seventy-eight-inversion-warden',
  ],
  'fermat-bastion': [
    'fifty-five-fermat-squire',
    'ninety-goldbach-artillerist',
    'one-twenty-five-fermat-centurion',
    'one-thirty-fermat-keeper',
  ],
  'sieve-foundry': [
    'forty-five-sieve-drone',
    'eighty-eight-twin-smith',
    'one-sixty-five-sieve-loader',
    'one-ninety-five-foundry-overseer',
  ],
  'elliptic-nexus': [
    'ninety-eight-curve-hunter',
    'one-forty-seven-nexus-seer',
    'one-fifty-four-curve-scribe',
    'two-eighty-six-elliptic-archon',
  ],
  'prime-sanctuary': [
    'twenty-one-idol',
    'sixty-three-mersenne-seer',
    'sixty-six-goldbach-herald',
  ],
}

function includesAll<T>(values: readonly T[], required: readonly T[]): boolean {
  return required.every((value) => values.includes(value))
}

function isStageClear(
  areaId: PrimeboundAreaId,
  progress: PrimeboundProgress,
): boolean {
  return progress.completedStageIds.includes(areaId) && includesAll(
    progress.defeatedEnemyIds,
    AREA_GUARDIANS[areaId],
  )
}

export function getPrimeboundArea(
  areaId: PrimeboundAreaId | string,
): PrimeboundArea | null {
  if (!Object.prototype.hasOwnProperty.call(PRIMEBOUND_AREAS, areaId)) {
    return null
  }
  return PRIMEBOUND_AREAS[areaId as PrimeboundAreaId]
}

export function getPrimeboundDialogue(
  dialogueId: PrimeboundDialogueId | string,
): PrimeboundDialogue | null {
  if (!Object.prototype.hasOwnProperty.call(PRIMEBOUND_DIALOGUES, dialogueId)) {
    return null
  }
  return PRIMEBOUND_DIALOGUES[dialogueId as PrimeboundDialogueId]
}

export function getConnectionDestination(
  connectionId: PrimeboundConnectionId | string,
  fromAreaId: PrimeboundAreaId | string,
): PrimeboundConnectionEndpoint | null {
  if (!Object.prototype.hasOwnProperty.call(PRIMEBOUND_CONNECTIONS, connectionId)) {
    return null
  }

  const connection = PRIMEBOUND_CONNECTIONS[
    connectionId as PrimeboundConnectionId
  ]
  if (connection.a.areaId === fromAreaId) return connection.b
  if (connection.b.areaId === fromAreaId) return connection.a
  return null
}

export function canEnterPrimeboundArea(
  areaId: PrimeboundAreaId | string,
  progress: PrimeboundProgress,
): boolean {
  const area = getPrimeboundArea(areaId)
  return Boolean(
    area && includesAll(progress.collectedRunes, area.requiredRunesToEnter),
  )
}

export function getAvailableConnections(
  fromAreaId: PrimeboundAreaId,
  progress: PrimeboundProgress,
): readonly PrimeboundConnection[] {
  const area = PRIMEBOUND_AREAS[fromAreaId]

  return area.connectionIds
    .map((connectionId) => PRIMEBOUND_CONNECTIONS[connectionId])
    .filter((connection) => {
      const destination = getConnectionDestination(connection.id, fromAreaId)
      return Boolean(
        destination && canEnterPrimeboundArea(destination.areaId, progress),
      )
    })
}

export function canChallengeCompositeSentinel(
  progress: PrimeboundProgress,
): boolean {
  return (
    includesAll(progress.collectedRunes, [2, 3, 5, 7, 11, 13]) &&
    isStageClear('prime-sanctuary', progress)
  )
}

export function isPrimeboundComplete(progress: PrimeboundProgress): boolean {
  return progress.defeatedEnemyIds.includes('composite-sentinel')
}

export function isPrimeboundObjectiveComplete(
  objectiveId: PrimeboundObjectiveId,
  progress: PrimeboundProgress,
): boolean {
  switch (objectiveId) {
    case 'meet-seris':
      return progress.spokenNpcIds.includes('seris')
    case 'clear-echo-woods':
      return isStageClear('echo-woods', progress)
    case 'collect-rune-2':
      return progress.collectedRunes.includes(2)
    case 'enter-composite-crypt':
      return progress.visitedAreaIds.includes('composite-crypt')
    case 'meet-orun':
      return progress.spokenNpcIds.includes('orun')
    case 'clear-composite-crypt':
      return isStageClear('composite-crypt', progress)
    case 'collect-rune-3':
      return progress.collectedRunes.includes(3)
    case 'enter-twin-peaks':
      return progress.visitedAreaIds.includes('twin-peaks')
    case 'meet-lyra':
      return progress.spokenNpcIds.includes('lyra')
    case 'clear-twin-peaks':
      return isStageClear('twin-peaks', progress)
    case 'collect-rune-5':
      return progress.collectedRunes.includes(5)
    case 'enter-residue-forge':
      return progress.visitedAreaIds.includes('residue-forge')
    case 'meet-sophia':
      return progress.spokenNpcIds.includes('sophia')
    case 'clear-residue-forge':
      return isStageClear('residue-forge', progress)
    case 'enter-eratosthenes-garden':
      return progress.visitedAreaIds.includes('eratosthenes-garden')
    case 'meet-theon':
      return progress.spokenNpcIds.includes('theon')
    case 'clear-eratosthenes-garden':
      return isStageClear('eratosthenes-garden', progress)
    case 'collect-rune-7':
      return progress.collectedRunes.includes(7)
    case 'enter-goldbach-citadel':
      return progress.visitedAreaIds.includes('goldbach-citadel')
    case 'meet-aurea':
      return progress.spokenNpcIds.includes('aurea')
    case 'clear-goldbach-citadel':
      return isStageClear('goldbach-citadel', progress)
    case 'collect-rune-11':
      return progress.collectedRunes.includes(11)
    case 'enter-wilson-observatory':
      return progress.visitedAreaIds.includes('wilson-observatory')
    case 'meet-wilson':
      return progress.spokenNpcIds.includes('wilson')
    case 'clear-wilson-observatory':
      return isStageClear('wilson-observatory', progress)
    case 'collect-rune-13':
      return progress.collectedRunes.includes(13)
    case 'enter-mobius-labyrinth':
      return progress.visitedAreaIds.includes('mobius-labyrinth')
    case 'clear-mobius-labyrinth':
      return isStageClear('mobius-labyrinth', progress)
    case 'enter-fermat-bastion':
      return progress.visitedAreaIds.includes('fermat-bastion')
    case 'clear-fermat-bastion':
      return isStageClear('fermat-bastion', progress)
    case 'enter-sieve-foundry':
      return progress.visitedAreaIds.includes('sieve-foundry')
    case 'clear-sieve-foundry':
      return isStageClear('sieve-foundry', progress)
    case 'enter-elliptic-nexus':
      return progress.visitedAreaIds.includes('elliptic-nexus')
    case 'clear-elliptic-nexus':
      return isStageClear('elliptic-nexus', progress)
    case 'enter-prime-sanctuary':
      return progress.visitedAreaIds.includes('prime-sanctuary')
    case 'clear-prime-sanctuary':
      return isStageClear('prime-sanctuary', progress)
    case 'defeat-composite-sentinel':
    case 'victory':
      return isPrimeboundComplete(progress)
  }
}

export function getNextPrimeboundObjective(
  progress: PrimeboundProgress,
): PrimeboundObjective {
  if (isPrimeboundComplete(progress)) return PRIMEBOUND_OBJECTIVES.victory

  const nextObjectiveId = PRIMEBOUND_OBJECTIVE_ORDER.find(
    (objectiveId) => !isPrimeboundObjectiveComplete(objectiveId, progress),
  )

  return nextObjectiveId
    ? PRIMEBOUND_OBJECTIVES[nextObjectiveId]
    : PRIMEBOUND_OBJECTIVES.victory
}

export function getPrimeboundProgressSummary(
  progress: PrimeboundProgress,
): PrimeboundProgressSummary {
  const isComplete = isPrimeboundComplete(progress)
  const totalObjectives = PRIMEBOUND_OBJECTIVE_ORDER.length
  const nextIncompleteIndex = isComplete
    ? -1
    : PRIMEBOUND_OBJECTIVE_ORDER.findIndex(
      (objectiveId) => !isPrimeboundObjectiveComplete(objectiveId, progress),
    )
  const completedObjectives = isComplete
    ? totalObjectives
    : nextIncompleteIndex === -1
      ? totalObjectives
      : nextIncompleteIndex

  return {
    completedObjectives,
    totalObjectives,
    percentage: Math.round((completedObjectives / totalObjectives) * 100),
    isComplete,
  }
}
