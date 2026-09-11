import type { PrimeboundAreaId } from './world'

export type StoryCutsceneKind = 'area-entry' | 'guardian-reveal' | 'finale'

export type StoryCutsceneShotTarget =
  | 'hero'
  | 'guardian'
  | 'landmark'
  | 'wide'

export type StoryCutsceneEffect = 'none' | 'pulse' | 'shake' | 'fade'

export type StoryCutsceneId =
  | `entry-${PrimeboundAreaId}`
  | `guardian-${PrimeboundAreaId}`
  | 'primebound-finale'

export interface StoryCutsceneBeat {
  readonly id: string
  readonly durationMs: number
  readonly speaker: string
  readonly text: string
  readonly shotTarget: StoryCutsceneShotTarget
  readonly effect: StoryCutsceneEffect
  readonly skippable: boolean
}

export interface StoryCutsceneDefinition {
  readonly id: StoryCutsceneId
  readonly kind: StoryCutsceneKind
  readonly areaId: PrimeboundAreaId
  readonly title: string
  readonly beats: readonly StoryCutsceneBeat[]
}

export type StoryCutsceneStatus = 'playing' | 'completed' | 'skipped'

export interface StoryCutsceneState {
  readonly sceneId: StoryCutsceneId
  /** The active beat, or beat count after natural completion. */
  readonly beatIndex: number
  readonly status: StoryCutsceneStatus
}

export interface StoryCutsceneSnapshot {
  readonly sceneId: StoryCutsceneId
  readonly kind: StoryCutsceneKind
  readonly areaId: PrimeboundAreaId
  readonly title: string
  readonly status: StoryCutsceneStatus
  readonly beatIndex: number
  readonly beatCount: number
  readonly completedBeatCount: number
  readonly currentBeat: StoryCutsceneBeat | null
  readonly completedDurationMs: number
  readonly totalDurationMs: number
  readonly progress: number
  readonly canAdvance: boolean
  readonly canSkip: boolean
  readonly finished: boolean
}

export const STORY_CUTSCENE_AREA_IDS = Object.freeze([
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
] as const satisfies readonly PrimeboundAreaId[])

export const AREA_ENTRY_CUTSCENE_IDS = Object.freeze({
  'echo-woods': 'entry-echo-woods',
  'composite-crypt': 'entry-composite-crypt',
  'twin-peaks': 'entry-twin-peaks',
  'residue-forge': 'entry-residue-forge',
  'eratosthenes-garden': 'entry-eratosthenes-garden',
  'goldbach-citadel': 'entry-goldbach-citadel',
  'wilson-observatory': 'entry-wilson-observatory',
  'mobius-labyrinth': 'entry-mobius-labyrinth',
  'fermat-bastion': 'entry-fermat-bastion',
  'sieve-foundry': 'entry-sieve-foundry',
  'elliptic-nexus': 'entry-elliptic-nexus',
  'prime-sanctuary': 'entry-prime-sanctuary',
} as const satisfies Readonly<Record<PrimeboundAreaId, StoryCutsceneId>>)

export const GUARDIAN_REVEAL_CUTSCENE_IDS = Object.freeze({
  'echo-woods': 'guardian-echo-woods',
  'composite-crypt': 'guardian-composite-crypt',
  'twin-peaks': 'guardian-twin-peaks',
  'residue-forge': 'guardian-residue-forge',
  'eratosthenes-garden': 'guardian-eratosthenes-garden',
  'goldbach-citadel': 'guardian-goldbach-citadel',
  'wilson-observatory': 'guardian-wilson-observatory',
  'mobius-labyrinth': 'guardian-mobius-labyrinth',
  'fermat-bastion': 'guardian-fermat-bastion',
  'sieve-foundry': 'guardian-sieve-foundry',
  'elliptic-nexus': 'guardian-elliptic-nexus',
  'prime-sanctuary': 'guardian-prime-sanctuary',
} as const satisfies Readonly<Record<PrimeboundAreaId, StoryCutsceneId>>)

export const PRIMEBOUND_FINALE_CUTSCENE_ID = 'primebound-finale' as const

export const STORY_CUTSCENE_IDS = Object.freeze([
  ...Object.values(AREA_ENTRY_CUTSCENE_IDS),
  ...Object.values(GUARDIAN_REVEAL_CUTSCENE_IDS),
  PRIMEBOUND_FINALE_CUTSCENE_ID,
] as const satisfies readonly StoryCutsceneId[])

function freezeScene(
  definition: StoryCutsceneDefinition,
): StoryCutsceneDefinition {
  return Object.freeze({
    ...definition,
    beats: Object.freeze(
      definition.beats.map((beat) => Object.freeze({ ...beat })),
    ),
  })
}

export const PRIMEBOUND_STORY_CUTSCENES: Readonly<
  Record<StoryCutsceneId, StoryCutsceneDefinition>
> = Object.freeze({
  'entry-echo-woods': freezeScene({
    id: 'entry-echo-woods',
    kind: 'area-entry',
    areaId: 'echo-woods',
    title: 'Ecos sob as raízes',
    beats: [
      {
        id: 'echo-entry-wide',
        durationMs: 1_800,
        speaker: 'Narração',
        text: 'O bosque repete uma sequência que nunca termina.',
        shotTarget: 'wide',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'echo-entry-hero',
        durationMs: 1_900,
        speaker: 'Primebound',
        text: 'Ouço o dois sob as raízes. É por ali.',
        shotTarget: 'hero',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'entry-composite-crypt': freezeScene({
    id: 'entry-composite-crypt',
    kind: 'area-entry',
    areaId: 'composite-crypt',
    title: 'Divisores na penumbra',
    beats: [
      {
        id: 'crypt-entry-landmark',
        durationMs: 1_900,
        speaker: 'Narração',
        text: 'Na cripta, cada sombra se divide mais de uma vez.',
        shotTarget: 'landmark',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'crypt-entry-hero',
        durationMs: 1_900,
        speaker: 'Primebound',
        text: 'Compostos deixam rastros. Vou quebrar seus fatores.',
        shotTarget: 'hero',
        effect: 'none',
        skippable: true,
      },
    ],
  }),
  'entry-twin-peaks': freezeScene({
    id: 'entry-twin-peaks',
    kind: 'area-entry',
    areaId: 'twin-peaks',
    title: 'A distância entre dois',
    beats: [
      {
        id: 'twin-entry-landmark',
        durationMs: 1_900,
        speaker: 'Narração',
        text: 'Dois penhascos respiram separados por uma única lacuna.',
        shotTarget: 'landmark',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'twin-entry-hero',
        durationMs: 2_000,
        speaker: 'Primebound',
        text: 'Como onze e treze... os cumes lutam em par.',
        shotTarget: 'hero',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'entry-residue-forge': freezeScene({
    id: 'entry-residue-forge',
    kind: 'area-entry',
    areaId: 'residue-forge',
    title: 'A forja dos padrões',
    beats: [
      {
        id: 'forge-entry-wide',
        durationMs: 1_900,
        speaker: 'Narração',
        text: 'A forja grava resíduos em cada lâmina incandescente.',
        shotTarget: 'wide',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'forge-entry-hero',
        durationMs: 2_000,
        speaker: 'Primebound',
        text: 'Se o padrão se repete, também pode ser rompido.',
        shotTarget: 'hero',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'entry-eratosthenes-garden': freezeScene({
    id: 'entry-eratosthenes-garden',
    kind: 'area-entry',
    areaId: 'eratosthenes-garden',
    title: 'O que permanece',
    beats: [
      {
        id: 'garden-entry-landmark',
        durationMs: 1_900,
        speaker: 'Narração',
        text: 'Linhas antigas riscam da terra tudo que é múltiplo.',
        shotTarget: 'landmark',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'garden-entry-hero',
        durationMs: 2_100,
        speaker: 'Primebound',
        text: 'O crivo não destrói. Ele revela o que permanece.',
        shotTarget: 'hero',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'entry-goldbach-citadel': freezeScene({
    id: 'entry-goldbach-citadel',
    kind: 'area-entry',
    areaId: 'goldbach-citadel',
    title: 'Duas centelhas',
    beats: [
      {
        id: 'goldbach-entry-landmark',
        durationMs: 1_900,
        speaker: 'Narração',
        text: 'Portões pares aguardam duas centelhas para despertar.',
        shotTarget: 'landmark',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'goldbach-entry-hero',
        durationMs: 2_000,
        speaker: 'Primebound',
        text: 'Toda soma tem sua dupla. Encontrarei a minha rota.',
        shotTarget: 'hero',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'entry-wilson-observatory': freezeScene({
    id: 'entry-wilson-observatory',
    kind: 'area-entry',
    areaId: 'wilson-observatory',
    title: 'O último giro',
    beats: [
      {
        id: 'wilson-entry-wide',
        durationMs: 1_900,
        speaker: 'Narração',
        text: 'Treze órbitas giram ao redor de um resto impossível.',
        shotTarget: 'wide',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'wilson-entry-hero',
        durationMs: 1_900,
        speaker: 'Primebound',
        text: 'Menos um. A resposta está no último giro.',
        shotTarget: 'hero',
        effect: 'none',
        skippable: true,
      },
    ],
  }),
  'entry-mobius-labyrinth': freezeScene({
    id: 'entry-mobius-labyrinth',
    kind: 'area-entry',
    areaId: 'mobius-labyrinth',
    title: 'A única face',
    beats: [
      {
        id: 'mobius-entry-landmark',
        durationMs: 2_000,
        speaker: 'Narração',
        text: 'O corredor retorna ao começo com o mundo invertido.',
        shotTarget: 'landmark',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'mobius-entry-hero',
        durationMs: 2_000,
        speaker: 'Primebound',
        text: 'Uma face, uma borda. Não vou confiar nos olhos.',
        shotTarget: 'hero',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'entry-fermat-bastion': freezeScene({
    id: 'entry-fermat-bastion',
    kind: 'area-entry',
    areaId: 'fermat-bastion',
    title: 'Potências de pedra',
    beats: [
      {
        id: 'fermat-entry-wide',
        durationMs: 1_900,
        speaker: 'Narração',
        text: 'Potências colossais sustentam as muralhas do bastião.',
        shotTarget: 'wide',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'fermat-entry-hero',
        durationMs: 2_100,
        speaker: 'Primebound',
        text: 'Nem todo número que parece primo resiste ao teste.',
        shotTarget: 'hero',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'entry-sieve-foundry': freezeScene({
    id: 'entry-sieve-foundry',
    kind: 'area-entry',
    areaId: 'sieve-foundry',
    title: 'Linhas de fogo',
    beats: [
      {
        id: 'sieve-entry-landmark',
        durationMs: 1_900,
        speaker: 'Narração',
        text: 'A fundição elimina múltiplos em linhas de fogo.',
        shotTarget: 'landmark',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'sieve-entry-hero',
        durationMs: 2_000,
        speaker: 'Primebound',
        text: 'Vou cruzar as lacunas antes que o crivo feche.',
        shotTarget: 'hero',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'entry-elliptic-nexus': freezeScene({
    id: 'entry-elliptic-nexus',
    kind: 'area-entry',
    areaId: 'elliptic-nexus',
    title: 'Pontos sobre a curva',
    beats: [
      {
        id: 'elliptic-entry-wide',
        durationMs: 2_000,
        speaker: 'Narração',
        text: 'Pontos de luz somam-se sobre uma curva sem fim.',
        shotTarget: 'wide',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'elliptic-entry-hero',
        durationMs: 2_100,
        speaker: 'Primebound',
        text: 'Cada salto deixa uma chave. Preciso seguir a tangente.',
        shotTarget: 'hero',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'entry-prime-sanctuary': freezeScene({
    id: 'entry-prime-sanctuary',
    kind: 'area-entry',
    areaId: 'prime-sanctuary',
    title: 'As seis runas',
    beats: [
      {
        id: 'sanctuary-entry-landmark',
        durationMs: 2_100,
        speaker: 'Narração',
        text: 'As seis runas respondem diante do altar corrompido.',
        shotTarget: 'landmark',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'sanctuary-entry-hero',
        durationMs: 2_100,
        speaker: 'Primebound',
        text: 'Cheguei até aqui. Agora, cada primo luta comigo.',
        shotTarget: 'hero',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),

  'guardian-echo-woods': freezeScene({
    id: 'guardian-echo-woods',
    kind: 'guardian-reveal',
    areaId: 'echo-woods',
    title: 'Matriarca dos Nove Ecos',
    beats: [
      {
        id: 'echo-guardian-rise',
        durationMs: 1_700,
        speaker: 'Narração',
        text: 'As copas se abrem. Nove ecos tomam uma única forma.',
        shotTarget: 'guardian',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'echo-guardian-line',
        durationMs: 2_100,
        speaker: 'Matriarca dos Nove Ecos',
        text: 'Três vezes três. Encontre o eco verdadeiro.',
        shotTarget: 'guardian',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'guardian-composite-crypt': freezeScene({
    id: 'guardian-composite-crypt',
    kind: 'guardian-reveal',
    areaId: 'composite-crypt',
    title: 'Paladino Quinze',
    beats: [
      {
        id: 'crypt-guardian-rise',
        durationMs: 1_700,
        speaker: 'Narração',
        text: 'Uma lança sela a passagem e a cripta perde a voz.',
        shotTarget: 'guardian',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'crypt-guardian-line',
        durationMs: 2_100,
        speaker: 'Paladino Quinze',
        text: 'Três e cinco guardam este juramento. Você não passa.',
        shotTarget: 'guardian',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'guardian-twin-peaks': freezeScene({
    id: 'guardian-twin-peaks',
    kind: 'guardian-reveal',
    areaId: 'twin-peaks',
    title: 'Soberano Vinte e Cinco',
    beats: [
      {
        id: 'twin-guardian-rise',
        durationMs: 1_800,
        speaker: 'Narração',
        text: 'Duas lâminas riscam o ar entre os penhascos.',
        shotTarget: 'guardian',
        effect: 'shake',
        skippable: true,
      },
      {
        id: 'twin-guardian-line',
        durationMs: 2_000,
        speaker: 'Soberano Vinte e Cinco',
        text: 'Dois cortes, uma distância de dois. Venha.',
        shotTarget: 'guardian',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'guardian-residue-forge': freezeScene({
    id: 'guardian-residue-forge',
    kind: 'guardian-reveal',
    areaId: 'residue-forge',
    title: 'Mestre-Ferreiro Setenta e Cinco',
    beats: [
      {
        id: 'forge-guardian-rise',
        durationMs: 1_800,
        speaker: 'Narração',
        text: 'O martelo desce, e três anéis de fagulhas despertam.',
        shotTarget: 'guardian',
        effect: 'shake',
        skippable: true,
      },
      {
        id: 'forge-guardian-line',
        durationMs: 2_100,
        speaker: 'Mestre-Ferreiro Setenta e Cinco',
        text: 'Três, cinco e cinco. Na minha forja, viram aço.',
        shotTarget: 'guardian',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'guardian-eratosthenes-garden': freezeScene({
    id: 'guardian-eratosthenes-garden',
    kind: 'guardian-reveal',
    areaId: 'eratosthenes-garden',
    title: 'Arquissentinela Setenta e Sete',
    beats: [
      {
        id: 'garden-guardian-rise',
        durationMs: 1_800,
        speaker: 'Narração',
        text: 'Faixas de múltiplos fecham o jardim em silêncio.',
        shotTarget: 'wide',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'garden-guardian-line',
        durationMs: 2_100,
        speaker: 'Arquissentinela Setenta e Sete',
        text: 'Sete por onze. O crivo já marcou seu lugar.',
        shotTarget: 'guardian',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'guardian-goldbach-citadel': freezeScene({
    id: 'guardian-goldbach-citadel',
    kind: 'guardian-reveal',
    areaId: 'goldbach-citadel',
    title: 'Gêmeo Áureo Vinte e Seis',
    beats: [
      {
        id: 'goldbach-guardian-rise',
        durationMs: 1_800,
        speaker: 'Narração',
        text: 'Duas centelhas idênticas tomam lados opostos da arena.',
        shotTarget: 'wide',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'goldbach-guardian-line',
        durationMs: 2_200,
        speaker: 'Gêmeo Áureo Vinte e Seis',
        text: 'Vinte e seis é treze mais treze. Duas explosões, uma sentença.',
        shotTarget: 'guardian',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'guardian-wilson-observatory': freezeScene({
    id: 'guardian-wilson-observatory',
    kind: 'guardian-reveal',
    areaId: 'wilson-observatory',
    title: 'Arconte da Órbita',
    beats: [
      {
        id: 'wilson-guardian-rise',
        durationMs: 1_900,
        speaker: 'Narração',
        text: 'Treze órbitas travam o céu sobre o observatório.',
        shotTarget: 'wide',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'wilson-guardian-line',
        durationMs: 2_200,
        speaker: 'Arconte da Órbita',
        text: 'Doze fatorial deixa menos um. Seu veredito está traçado.',
        shotTarget: 'guardian',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'guardian-mobius-labyrinth': freezeScene({
    id: 'guardian-mobius-labyrinth',
    kind: 'guardian-reveal',
    areaId: 'mobius-labyrinth',
    title: 'Guardião da Inversão',
    beats: [
      {
        id: 'mobius-guardian-rise',
        durationMs: 1_900,
        speaker: 'Narração',
        text: 'A faixa se dobra, e a saída surge atrás do guardião.',
        shotTarget: 'landmark',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'mobius-guardian-line',
        durationMs: 2_100,
        speaker: 'Guardião da Inversão',
        text: 'Nesta faixa, avançar e voltar são o mesmo passo.',
        shotTarget: 'guardian',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'guardian-fermat-bastion': freezeScene({
    id: 'guardian-fermat-bastion',
    kind: 'guardian-reveal',
    areaId: 'fermat-bastion',
    title: 'Castelão de Fermat',
    beats: [
      {
        id: 'fermat-guardian-rise',
        durationMs: 1_800,
        speaker: 'Narração',
        text: 'Camadas de potência erguem uma muralha viva.',
        shotTarget: 'guardian',
        effect: 'shake',
        skippable: true,
      },
      {
        id: 'fermat-guardian-line',
        durationMs: 2_100,
        speaker: 'Castelão de Fermat',
        text: 'Ergui este bastião com potências. Veja-as ruir.',
        shotTarget: 'guardian',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'guardian-sieve-foundry': freezeScene({
    id: 'guardian-sieve-foundry',
    kind: 'guardian-reveal',
    areaId: 'sieve-foundry',
    title: 'Supervisor do Crivo',
    beats: [
      {
        id: 'sieve-guardian-rise',
        durationMs: 1_900,
        speaker: 'Narração',
        text: 'A linha de produção para. Três marcas ficam acesas.',
        shotTarget: 'landmark',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'sieve-guardian-line',
        durationMs: 2_100,
        speaker: 'Supervisor do Crivo',
        text: 'Três. Cinco. Treze. Cada linha elimina uma escolha.',
        shotTarget: 'guardian',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'guardian-elliptic-nexus': freezeScene({
    id: 'guardian-elliptic-nexus',
    kind: 'guardian-reveal',
    areaId: 'elliptic-nexus',
    title: 'Arconte Elíptico',
    beats: [
      {
        id: 'elliptic-guardian-rise',
        durationMs: 1_900,
        speaker: 'Narração',
        text: 'Pontos modulares orbitam uma silhueta sobre a curva.',
        shotTarget: 'guardian',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'elliptic-guardian-line',
        durationMs: 2_200,
        speaker: 'Arconte Elíptico',
        text: 'Na curva, somo pontos onde sua lâmina não alcança.',
        shotTarget: 'guardian',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),
  'guardian-prime-sanctuary': freezeScene({
    id: 'guardian-prime-sanctuary',
    kind: 'guardian-reveal',
    areaId: 'prime-sanctuary',
    title: 'Sentinela Composta',
    beats: [
      {
        id: 'sanctuary-guardian-rise',
        durationMs: 2_100,
        speaker: 'Narração',
        text: 'A corrupção reúne as seis famílias em um único corpo.',
        shotTarget: 'guardian',
        effect: 'shake',
        skippable: true,
      },
      {
        id: 'sanctuary-guardian-line',
        durationMs: 2_200,
        speaker: 'Sentinela Composta',
        text: 'Primos isolados caem. Eu sou todos os seus produtos.',
        shotTarget: 'guardian',
        effect: 'pulse',
        skippable: true,
      },
    ],
  }),

  'primebound-finale': freezeScene({
    id: 'primebound-finale',
    kind: 'finale',
    areaId: 'prime-sanctuary',
    title: 'Sempre existe outro',
    beats: [
      {
        id: 'finale-runes',
        durationMs: 2_200,
        speaker: 'Narração',
        text: 'A Sentinela se desfaz. As seis runas voltam a pulsar.',
        shotTarget: 'landmark',
        effect: 'fade',
        skippable: true,
      },
      {
        id: 'finale-hero',
        durationMs: 2_500,
        speaker: 'Primebound',
        text: 'Nenhum primo caminha sozinho. A prova continua em cada novo número.',
        shotTarget: 'hero',
        effect: 'pulse',
        skippable: true,
      },
      {
        id: 'finale-horizon',
        durationMs: 2_600,
        speaker: 'Narração',
        text: 'O Santuário abre o céu, e o Primeverse encontra outro horizonte.',
        shotTarget: 'wide',
        effect: 'fade',
        skippable: false,
      },
    ],
  }),
})

function isStoryCutsceneId(value: string): value is StoryCutsceneId {
  return Object.prototype.hasOwnProperty.call(PRIMEBOUND_STORY_CUTSCENES, value)
}

function freezeState(state: StoryCutsceneState): StoryCutsceneState {
  return Object.freeze({ ...state })
}

function assertValidState(
  state: StoryCutsceneState,
  definition: StoryCutsceneDefinition,
): void {
  if (!Number.isInteger(state.beatIndex) || state.beatIndex < 0) {
    throw new RangeError('Story cutscene beat index must be a non-negative integer.')
  }
  if (state.status === 'playing' && state.beatIndex >= definition.beats.length) {
    throw new RangeError('Playing story cutscene must point to an active beat.')
  }
  if (state.status === 'completed' && state.beatIndex !== definition.beats.length) {
    throw new RangeError('Completed story cutscene must point past its final beat.')
  }
  if (state.status === 'skipped' && state.beatIndex >= definition.beats.length) {
    throw new RangeError('Skipped story cutscene must retain its skipped beat.')
  }
}

export function getStoryCutsceneDefinition(
  sceneId: StoryCutsceneId,
): StoryCutsceneDefinition {
  if (!isStoryCutsceneId(sceneId)) {
    throw new RangeError(`Unsupported Primebound story cutscene: ${String(sceneId)}`)
  }
  return PRIMEBOUND_STORY_CUTSCENES[sceneId]
}

/** Creates a renderer-agnostic state at the first beat of a story scene. */
export function startStoryCutscene(
  sceneId: StoryCutsceneId,
): StoryCutsceneState {
  getStoryCutsceneDefinition(sceneId)
  return freezeState({ sceneId, beatIndex: 0, status: 'playing' })
}

/** Returns the next beat, or a completed state after the final beat. */
export function advanceOrCompleteStoryCutscene(
  state: StoryCutsceneState,
): StoryCutsceneState {
  const definition = getStoryCutsceneDefinition(state.sceneId)
  assertValidState(state, definition)
  if (state.status !== 'playing') return state

  const nextBeatIndex = state.beatIndex + 1
  return freezeState({
    sceneId: state.sceneId,
    beatIndex: nextBeatIndex,
    status: nextBeatIndex >= definition.beats.length ? 'completed' : 'playing',
  })
}

/** Skips the scene only when its active beat explicitly permits it. */
export function skipStoryCutscene(
  state: StoryCutsceneState,
): StoryCutsceneState {
  const definition = getStoryCutsceneDefinition(state.sceneId)
  assertValidState(state, definition)
  if (state.status !== 'playing') return state
  if (!definition.beats[state.beatIndex]?.skippable) return state
  return freezeState({ ...state, status: 'skipped' })
}

/** Derives all presentation data without mutating the cutscene state. */
export function getStoryCutsceneSnapshot(
  state: StoryCutsceneState,
): StoryCutsceneSnapshot {
  const definition = getStoryCutsceneDefinition(state.sceneId)
  assertValidState(state, definition)

  const finished = state.status !== 'playing'
  const completedBeatCount = state.status === 'completed'
    ? definition.beats.length
    : state.beatIndex
  const totalDurationMs = definition.beats.reduce(
    (total, beat) => total + beat.durationMs,
    0,
  )
  const completedDurationMs = definition.beats
    .slice(0, completedBeatCount)
    .reduce((total, beat) => total + beat.durationMs, 0)
  const currentBeat = state.status === 'playing'
    ? definition.beats[state.beatIndex] ?? null
    : null

  return Object.freeze({
    sceneId: state.sceneId,
    kind: definition.kind,
    areaId: definition.areaId,
    title: definition.title,
    status: state.status,
    beatIndex: state.beatIndex,
    beatCount: definition.beats.length,
    completedBeatCount,
    currentBeat,
    completedDurationMs,
    totalDurationMs,
    progress: totalDurationMs === 0 ? 1 : completedDurationMs / totalDurationMs,
    canAdvance: state.status === 'playing',
    canSkip: currentBeat?.skippable ?? false,
    finished,
  })
}
