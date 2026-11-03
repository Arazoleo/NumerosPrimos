export type SkylineTutorialStep = 0 | 1 | 2 | 3 | 4 | 5

export type SkylineTutorialTarget =
  | 'sprint'
  | 'jump'
  | 'hook'
  | 'prime-core'
  | 'sentinel'

export interface SkylineTutorialCopy {
  readonly target: SkylineTutorialTarget
  readonly selector?: string
  readonly title: string
  readonly body: string
  readonly hint?: string
}

export const SKYLINE_TUTORIAL_COPY: Readonly<
  Record<Exclude<SkylineTutorialStep, 0>, SkylineTutorialCopy>
> = {
  1: {
    target: 'sprint',
    title: 'Movimentação',
    body: 'Em Prime Runner: Skyline Protocol, use W-A-S-D para se mover pelos telhados dos arranha-céus.',
    hint: 'Mantenha W-A-S-D pressionado para avançar e use CTRL para deslizar sob obstáculos.',
  },
  2: {
    target: 'jump',
    title: 'Salto',
    body: 'Pressione ESPAÇO junto à borda para saltar sobre os abismos entre os edifícios sem tocar no chão da rua.',
    hint: 'Pressione ESPAÇO no momento exato em que chegar à extremidade do telhado.',
  },
  3: {
    target: 'hook',
    title: 'Gancho',
    body: 'Pressione Q para acionar o sistema do gancho e disparar nos pontos de fixação suspensos para cruzar os abismos.',
    hint: 'Mire num ponto de ancoragem válido e pressione Q para disparar o gancho.',
  },
  4: {
    target: 'prime-core',
    title: 'Núcleos Primos vs. Compostos',
    body: 'Assim como em todo o Primeverse, recolher um Núcleo Primo energiza o seu traje, enquanto evitar um composto é o melhor para não instabilizar os seus sistemas.',
    hint: 'Absorva apenas números primos (ex: 2, 3, 5).',
  },
  5: {
    target: 'sentinel',
    title: 'Sentinela Composta',
    body: 'Enfrente a Sentinela Composta selecionando o primo adequado (2, 3 ou 5) e pressione F para disparar o feixe e desarmar o seu escudo numérico.',
    hint: 'Selecione o fator primo correto (2, 3 ou 5) e pressione F (ou clique com o botão esquerdo) para disparar.',
  },
} as const

export function getSkylineTutorialCopy(
  step: SkylineTutorialStep
): SkylineTutorialCopy | null {
  return step === 0 ? null : SKYLINE_TUTORIAL_COPY[step]
}