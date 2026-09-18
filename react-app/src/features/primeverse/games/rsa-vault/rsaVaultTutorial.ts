import type { RsaTutorialStep } from './types'

export type RsaTutorialTarget =
  | 'public-key'
  | 'stage-rail'
  | 'factor-p'
  | 'factor-q'
  | 'submit'
  | 'proof-stack'
  | 'console'

export interface RsaTutorialCopy {
  readonly target: RsaTutorialTarget
  readonly title: string
  readonly body: string
}

export const RSA_TUTORIAL_COPY: Readonly<Record<Exclude<RsaTutorialStep, 0>, RsaTutorialCopy>> = {
  1: {
    target: 'public-key',
    title: 'A chave pública',
    body: 'N é o número do cofre e e é o expoente usado para cifrar. Você pode ver esses valores, mas a chave para abrir o cofre ainda está escondida.',
  },
  2: {
    target: 'stage-rail',
    title: 'A ordem da solução',
    body: 'Você vai encontrar dois primos, calcular φ(N), descobrir o expoente privado d e só então decifrar a mensagem.',
  },
  3: {
    target: 'factor-p',
    title: 'Encontre o primeiro primo',
    body: 'Um número primo só pode ser dividido por 1 e por ele mesmo. Procure um primo que, multiplicado por outro, forme N. Clique no campo p para continuar.',
  },
  4: {
    target: 'factor-q',
    title: 'Encontre o segundo primo',
    body: 'Agora informe q. Os dois valores precisam obedecer a p × q = N. A ordem dos primos não importa.',
  },
  5: {
    target: 'submit',
    title: 'Confira a resposta',
    body: 'Depois de preencher os dois campos, use este botão para conferir. O clique será apenas demonstrativo durante o tutorial; a partida começa quando você o fechar.',
  },
  6: {
    target: 'proof-stack',
    title: 'Acompanhe suas descobertas',
    body: 'Este registro mostra as etapas que já foram resolvidas. Use-o para acompanhar a solução sem precisar guardar todas as contas.',
  },
  7: {
    target: 'console',
    title: 'Sua vez',
    body: 'Agora você já conhece o caminho. Encontre p e q, avance pelas quatro etapas e leia o feedback quando precisar de ajuda.',
  },
}

export function getRsaTutorialCopy(step: RsaTutorialStep): RsaTutorialCopy | null {
  return step === 0 ? null : RSA_TUTORIAL_COPY[step]
}