import type { RsaTutorialStep } from './types'

export type RsaTutorialTarget =
  | 'public-key'
  | 'stage-rail'
  | 'factor-p'
  | 'factor-q'
  | 'submit'
  | 'proof-stack'
  | 'console'

export type RsaTutorialPosition = 'left' | 'right' | 'top' | 'bottom' | 'center'

export interface RsaTutorialCopy {
  readonly target: RsaTutorialTarget
  readonly position: RsaTutorialPosition
  readonly title: string
  readonly body: string
}

export const RSA_TUTORIAL_COPY: Readonly<Record<Exclude<RsaTutorialStep, 0>, RsaTutorialCopy>> = {
  1: {
    target: 'public-key',
    position: 'left',
    title: 'O seu desafio',
    body: 'Esta é a mensagem trancada. Você consegue ver o número N (o cofre) e o valor e (a trava), mas precisa encontrar a chave certa para abrir.',
  },
  2: {
    target: 'stage-rail',
    position: 'right',
    title: 'Seu mapa de progresso',
    body: 'Esta barra mostra o seu caminho. Você vai descobrir dois números secretos, calcular a combinação e, no fim, revelar a mensagem secreta.',
  },
  3: {
    target: 'factor-p',
    position: 'right',
    title: 'Primeira pista: valor p',
    body: 'O cofre N é formado pela multiplicação de dois números. Pense em um número que ajude a formar N. Clique no campo p para continuar.',
  },
  4: {
    target: 'factor-q',
    position: 'right',
    title: 'Segunda pista: valor q',
    body: 'Agora encontre o parceiro dele! A conta é simples: o valor de p multiplicado por q precisa ser igual ao total N.',
  },
  5: {
    target: 'submit',
    position: 'right',
    title: 'Testar combinação',
    body: 'Sempre que preencher os campos, clique neste botão para conferir se a sua resposta está certa e avançar.',
  },
  6: {
    target: 'proof-stack',
    position: 'left',
    title: 'Histórico de conquistas',
    body: 'Tudo o que você resolver aparecerá guardado aqui. Use esta área para consultar seus passos sem precisar anotar nada fora da tela.',
  },
  7: {
    target: 'console',
    position: 'right',
    title: 'Hora de jogar!',
    body: 'O caminho está livre! Encontre p e q para dar o primeiro passo. Se tiver dúvidas, fique de olho nas dicas da tela.',
  },
}

export function getRsaTutorialCopy(step: RsaTutorialStep): RsaTutorialCopy | null {
  return step === 0 ? null : RSA_TUTORIAL_COPY[step]
}