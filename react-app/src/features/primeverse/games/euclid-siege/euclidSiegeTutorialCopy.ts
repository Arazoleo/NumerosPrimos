export type EuclidTutorialStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export type EuclidTutorialTarget =
  | 'movement'
  | 'prime-selector'
  | 'factor-action'
  | 'attack-action'
  | 'pulse-action'
  | 'guard-action'
  | 'nearest-enemy'
  | 'health-status'

export interface EuclidTutorialCopy {
  readonly target: EuclidTutorialTarget
  readonly selector: string
  readonly title: string
  readonly body: string
  readonly hint?: string
}

export const EUCLID_TUTORIAL_COPY: Readonly<Record<Exclude<EuclidTutorialStep, 0>, EuclidTutorialCopy>> = {
  1: {
    target: 'movement',
    selector: '.euclid-siege__canvas',
    title: 'Mova-se pelo campo de batalha',
    body: 'Use W-A-S-D para se aproximar dos invasores.',
  },
  2: {
    target: 'prime-selector',
    selector: '.euclid-factor-deck',
    title: 'Escolha um primo',
    body: 'Selecione um primo que divida o número do escudo.',
    hint: 'Os seis primos ficam disponíveis no painel inferior.',
  },
  3: {
    target: 'factor-action',
    selector: '.euclid-actions__factor',
    title: 'Quebre o escudo',
    body: 'Use F para aplicar o fator escolhido.',
    hint: 'Repita a fatoração até o escudo chegar a zero.',
  },
  4: {
    target: 'attack-action',
    selector: '.euclid-actions button:first-child',
    title: 'Ataque o núcleo',
    body: 'Quando o escudo acabar, use J para destruir o inimigo.',
    hint: 'O ataque comum só causa dano depois da fatoração completa.',
  },
  5: {
    target: 'pulse-action',
    selector: '.euclid-actions__pulse',
    title: 'Pulso de Euclides',
    body: 'Use Q para fatorar grupos de inimigos ao mesmo tempo.',
    hint: 'O Pulso é poderoso, mas possui tempo de recarga.',
  },
  6: {
    target: 'guard-action',
    selector: '.euclid-actions__guard',
    title: 'Égide da Forja',
    body: 'Segure E para ativar a defesa e aparar ataques próximos.',
    hint: 'A defesa reduz o dano e pode atordoar o invasor.',
  },
  7: {
    target: 'nearest-enemy',
    selector: '.euclid-target',
    title: 'Observe o alvo mais próximo',
    body: 'Este painel mostra o invasor mais perto, o escudo restante e a distância até ele.',
    hint: 'Aproxime-se até o alvo ficar ao alcance das suas ações.',
  },
  8: {
    target: 'health-status',
    selector: '.euclid-hud__status',
    title: 'Proteja o Artífice e a Forja',
    body: 'Acompanhe sua vida e a integridade da Forja neste painel.',
    hint: 'Se qualquer uma delas chegar a zero, a defesa termina.',
  },
} as const

export function getEuclidTutorialCopy(step: EuclidTutorialStep): EuclidTutorialCopy | null {
  return step === 0 ? null : EUCLID_TUTORIAL_COPY[step]
}
