import type { AbilitySlot } from './types'

export type NucleusTutorialStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type NucleusTutorialTarget =
  | 'movement'
  | 'aim'
  | 'primary-attack'
  | 'signature-power'
  | 'mobility-power'
  | 'ultimate-power'
  | 'vitals'
  | 'mark-detonate'
  | 'objective'

export type NucleusTutorialAdvance =
  | { readonly kind: 'manual' }
  | { readonly kind: 'moved' }
  | { readonly kind: 'aim-locked' }
  | { readonly kind: 'ability'; readonly slot: AbilitySlot }

export interface NucleusTutorialCopy {
  readonly target: NucleusTutorialTarget
  readonly selector: string
  readonly title: string
  readonly body: string
  readonly hint?: string
  readonly advance: NucleusTutorialAdvance
}

export const NUCLEUS_TUTORIAL_STEPS: readonly Exclude<NucleusTutorialStep, 0>[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export const NUCLEUS_TUTORIAL_COPY: Readonly<Record<Exclude<NucleusTutorialStep, 0>, NucleusTutorialCopy>> = {
  1: {
    target: 'movement',
    selector: '.n257-canvas-shell',
    title: 'Mova-se pela arena',
    body: 'Use W-A-S-D para andar pela Câmara 257.',
    hint: 'Ande um pouco para continuar.',
    advance: { kind: 'moved' },
  },
  2: {
    target: 'aim',
    selector: '.n257-crosshair',
    title: 'Trave a mira',
    body: 'Clique na tela para prender o mouse e olhar ao redor com ele.',
    hint: 'A mira segue o movimento do mouse depois de travada.',
    advance: { kind: 'aim-locked' },
  },
  3: {
    target: 'primary-attack',
    selector: '[data-slot="primary"]',
    title: 'Ataque primário',
    body: 'Clique com o botão esquerdo do mouse (M1) para atirar.',
    advance: { kind: 'ability', slot: 'primary' },
  },
  4: {
    target: 'signature-power',
    selector: '[data-slot="signature"]',
    title: 'Poder de assinatura',
    body: 'Pressione Q para usar o poder de assinatura do seu operador.',
    hint: 'Cada operador tem um efeito diferente nesse poder.',
    advance: { kind: 'ability', slot: 'signature' },
  },
  5: {
    target: 'mobility-power',
    selector: '[data-slot="mobility"]',
    title: 'Mobilidade',
    body: 'Pressione E para se deslocar rapidamente e trocar de ângulo.',
    advance: { kind: 'ability', slot: 'mobility' },
  },
  6: {
    target: 'ultimate-power',
    selector: '.n257-ultimate-meter',
    title: 'Definitivo',
    body: 'Causar dano carrega esta barra. Quando chegar a 100%, pressione R para usar o definitivo.',
    hint: 'Não precisa usar agora — a carga continua na partida.',
    advance: { kind: 'manual' },
  },
  7: {
    target: 'vitals',
    selector: '.n257-vitals',
    title: 'Vida e escudo',
    body: 'Acompanhe sua vida e seu escudo aqui. O escudo recarrega sozinho quando você fica um tempo fora de combate.',
    advance: { kind: 'manual' },
  },
  8: {
    target: 'mark-detonate',
    selector: '.n257-powers',
    title: 'Marcar e detonar',
    body: 'Vários poderes deixam o alvo Marcado. Acerte esse alvo de novo com uma habilidade de dano para detonar a marca: dano bônus e recarga extra do definitivo.',
    hint: 'Esse combo é o que separa um bom operador de um ótimo.',
    advance: { kind: 'manual' },
  },
  9: {
    target: 'objective',
    selector: '.n257-objective',
    title: 'Domine os pylons',
    body: 'Capture os pylons na ordem 2 → 3 → 5 → 7. Só um fica ativo por vez: fique dentro da zona até completar a captura antes de seguir para o próximo primo.',
    hint: 'Complete a sequência inteira antes do tempo acabar para vencer.',
    advance: { kind: 'manual' },
  },
} as const

export function getNucleusTutorialCopy(step: NucleusTutorialStep): NucleusTutorialCopy | null {
  return step === 0 ? null : NUCLEUS_TUTORIAL_COPY[step]
}
