export const DIFFIE_HELLMAN_TUTORIAL_STEPS = [1, 2, 3, 4, 5, 6] as const

export type DiffieHellmanTutorialStep = 0 | typeof DIFFIE_HELLMAN_TUTORIAL_STEPS[number]

export interface DiffieHellmanTutorialCopy {
  readonly title: string
  readonly body: string
  readonly example?: string
  readonly hint?: string
}

export const DIFFIE_HELLMAN_TUTORIAL_COPY: Readonly<Record<Exclude<DiffieHellmanTutorialStep, 0>, DiffieHellmanTutorialCopy>> = {
  1: {
    title: 'Um segredo em comum',
    body: 'Você controla Alice. Seu objetivo é chegar ao mesmo segredo de Bob usando um canal público, observado por Eve. Para isso, os dois trocam valores públicos e calculam o segredo nos próprios terminais.',
    hint: 'O segredo compartilhado K não é enviado pelo canal.',
  },
  2: {
    title: 'O que Eve pode ver?',
    body: 'O primo p e a base g são parâmetros públicos. Alice envia o valor A e Bob fornece o valor B. O mapa de visibilidade separa esses valores dos expoentes privados e do segredo K.',
    example: 'No primeiro desafio: p = 5, g = 2 e B = 3.',
    hint: 'Os números pequenos deste jogo servem para aprender os cálculos.',
  },
  3: {
    title: 'Escolha o expoente privado',
    body: 'Escolha uma das opções de expoente a no cofre de Alice. Esse número fica no terminal e será usado nos dois cálculos. Sua escolha muda os valores de A e K.',
    example: 'Vamos usar a = 2 neste exemplo.',
    hint: 'O expoente b pertence a Bob e também permanece privado.',
  },
  4: {
    title: 'Calcule o valor público A',
    body: 'Use A = gᵃ mod p. Eleve g ao expoente a e encontre o resto da divisão por p: é isso que mod significa. Digite o resultado e selecione “Transmitir A”.',
    example: 'Com g = 2, a = 2 e p = 5: A = 2² mod 5 = 4.',
    hint: 'Você pode reduzir o resto a cada multiplicação. Somente A será enviado; a permanece privado.',
  },
  5: {
    title: 'Calcule o segredo K',
    body: 'Agora use o valor público de Bob na fórmula K = Bᵃ mod p. Digite o resultado e selecione “Confirmar segredo”. Bob calcula o mesmo segredo usando A e seu próprio expoente privado.',
    example: 'Com B = 3, a = 2 e p = 5: K = 3² mod 5 = 9 mod 5 = 4.',
    hint: 'O relay mostra uma confirmação do canal, sem transmitir K.',
  },
  6: {
    title: 'Hora de abrir o canal',
    body: 'Complete quatro transmissões com novos parâmetros a cada rodada. Respostas incorretas contam como erros e reduzem a pontuação da rodada; o tempo da partida influencia o bônus final.',
    hint: 'Use as dicas “Como calcular” e consulte “Ver cálculo confirmado” quando disponível.',
  },
}

export function getDiffieHellmanTutorialCopy(step: DiffieHellmanTutorialStep, ): DiffieHellmanTutorialCopy | null {
  return step === 0 ? null : DIFFIE_HELLMAN_TUTORIAL_COPY[step]
}
