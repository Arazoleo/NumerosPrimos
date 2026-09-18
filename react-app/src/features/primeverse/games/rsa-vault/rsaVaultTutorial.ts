import type { RsaTutorialStep } from './types'

export type RsaTutorialTarget =
  | 'console'
  | 'progress'
  | 'stage-rail'
  | 'public-key'
  | 'form'
  | 'proof-stack'

export interface RsaTutorialCopy {
  readonly target: RsaTutorialTarget
  readonly title: string
  readonly body: string
}

export const RSA_TUTORIAL_COPY: Readonly<Record<Exclude<RsaTutorialStep, 0>, RsaTutorialCopy>> = {
  1: {
    target: 'console',
    title: 'Console de invasão',
    body: 'Cada cofre tem quatro etapas. Você vai reconstruir a mensagem sem receber a chave privada.',
  },
  2: {
    target: 'progress',
    title: 'Quatro cofres',
    body: 'Este indicador mostra o cofre atual e os cofres já abertos durante a incursão.',
  },
  3: {
    target: 'stage-rail',
    title: 'A sequência RSA',
    body: 'A ordem é fatorar N, calcular φ(N), encontrar d e decifrar a mensagem.',
  },
  4: {
    target: 'public-key',
    title: 'A chave pública',
    body: 'O par (N, e) é público. Comece encontrando os primos p e q cujo produto é N.',
  },
  5: {
    target: 'form',
    title: 'Envie uma resposta',
    body: 'Preencha os campos da etapa atual e use o botão do console para validar a resposta.',
  },
  6: {
    target: 'proof-stack',
    title: 'Registro do mecanismo',
    body: 'Cada etapa correta fica registrada. Erros aumentam as tentativas e reduzem o score, mas não encerram a missão.',
  },
  7: {
    target: 'console',
    title: 'Sua primeira operação',
    body: 'O tutorial terminou. Resolva agora o primeiro estágio usando p e q.',
  },
}

export function getRsaTutorialCopy(step: RsaTutorialStep): RsaTutorialCopy | null {
  return step === 0 ? null : RSA_TUTORIAL_COPY[step]
}