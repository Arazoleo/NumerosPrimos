import type { RsaStage, RsaTutorialStep } from './types'

export type RsaTutorialTarget =
  | 'public-key'
  | 'stage-rail'
  | 'factor-p'
  | 'factor-q'
  | 'factor-pair'
  | 'submit'
  | 'proof-stack'
  | 'console'
  | 'totient'
  | 'private-exponent'
  | 'workbench'

export type RsaTutorialPosition = 'left' | 'right' | 'top' | 'bottom' | 'center'

export type RsaTutorialAdvance =
  | { readonly kind: 'manual' }
  | { readonly kind: 'stage-correct'; readonly stage: RsaStage }

export interface RsaTutorialCopy {
  readonly target: RsaTutorialTarget
  readonly position: RsaTutorialPosition
  readonly title: string
  readonly body: string
  readonly hint?: string
  readonly advance: RsaTutorialAdvance
}

const RSA_PRACTICE_STEPS = {
  factor: 3,
  totient: 4,
  inverse: 5,
  decrypt: 6,
} as const satisfies Readonly<Record<RsaStage, RsaTutorialStep>>

export function getRsaPracticeStep(stage: RsaStage): RsaTutorialStep {
  return RSA_PRACTICE_STEPS[stage]
}

export const RSA_TOUCH_MEDIA_QUERY = '(pointer: coarse)'

export function isRsaTouchDevice(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(RSA_TOUCH_MEDIA_QUERY).matches
}

export const RSA_TUTORIAL_COPY: Readonly<Record<Exclude<RsaTutorialStep, 0>, RsaTutorialCopy>> = {
  1: {
    advance: { kind: 'manual' },
    target: 'public-key',
    position: 'left',
    title: 'Conheça a chave pública',
    body: 'Este par (N, e) é a chave pública. Seu objetivo é descobrir os primos que formam N e usar os resultados para revelar a mensagem do cofre.',
  },
  2: {
    advance: { kind: 'manual' },
    target: 'stage-rail',
    position: 'right',
    title: 'Seu mapa de progresso',
    body: 'Resolva quatro etapas: fatorar N, calcular φ(N), encontrar d e decifrar a mensagem. As orientações acompanham cada conta. A primeira tarefa é preencher p e q.',
  },
  3: {
    advance: { kind: 'stage-correct', stage: 'factor' },
    target: 'factor-pair',
    position: 'right',
    title: 'Encontre os dois primos',
    body: 'p e q são os dois primos que formam N. Preencha os campos e clique em "Acoplar primos" para conferir p × q = N. A ordem dos fatores não importa. Se errar, ajuste os valores e tente novamente.',
    hint: 'Um primo é maior que 1 e só é divisível por 1 e por ele mesmo. Teste divisores primos até a raiz de N; ao encontrar p, use q = N ÷ p.',
  },
  4: {
    advance: { kind: 'stage-correct', stage: 'totient' },
    target: 'totient',
    position: 'right',
    title: 'Calcule φ(N)',
    body: 'Seus fatores já estão confirmados no registro do cofre. Calcule φ(N) = (p−1) × (q−1), digite o resultado e clique em "Calibrar totiente".',
    hint: 'O registro guarda os fatores, φ(N) e d conforme você avança. Use os fatores confirmados: subtraia 1 de cada um e depois multiplique.',
  },
  5: {
    advance: { kind: 'stage-correct', stage: 'inverse' },
    target: 'private-exponent',
    position: 'right',
    title: 'Encontre a chave privada d',
    body: 'Use e, o expoente da chave pública. Procure o menor inteiro positivo d para que e × d deixe resto 1 na divisão por φ(N). Digite d e clique em "Sintetizar chave".',
    hint: 'Teste d = 1, 2, 3… Multiplique por e e verifique o resto da divisão por φ(N).',
  },
  6: {
    advance: { kind: 'stage-correct', stage: 'decrypt' },
    target: 'workbench',
    position: 'right',
    title: 'Revele a mensagem',
    body: 'Clique nos blocos da bancada para calcular Cᵈ mod N. Converta cada resultado em uma letra usando A=1…Z=26, na ordem dos blocos. Digite a palavra e clique em "Abrir cofre".',
    hint: 'Cada bloco revela uma letra. Confira a conversão e a ordem se a mensagem for recusada.',
  },
}

export function getRsaTutorialCopy(step: RsaTutorialStep, isTouchDevice = false): RsaTutorialCopy | null {
  if (step === 0) return null

  const copy = RSA_TUTORIAL_COPY[step]
  if (!isTouchDevice) return copy

  return {
    ...copy,
    body: copy.body.replace(/\bclique\b/gi, (match) => (match[0] === 'C' ? 'Toque' : 'toque')),
  }
}
