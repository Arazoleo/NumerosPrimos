/**
 * Conteúdo do tutorial da Órbita Modular.
 *
 * Este arquivo guarda só DADOS (textos, exemplo e persistência). A parte visual
 * fica em `ModularOrbitTutorialView.tsx`. Para mudar um texto, edite apenas
 * `MODULAR_ORBIT_TUTORIAL_STEPS` abaixo; o teste `modularOrbitTutorial.test.ts`
 * avisa se algum passo ficar incoerente.
 */
import { evaluateOrbitGuess } from './modularOrbitLogic'
import type { ModularOrbitChallenge } from './types'

/**
 * Órbita de exemplo usada em todo o tutorial. Módulo pequeno (5) para o jogador
 * conseguir seguir o rastro de cabeça:
 *
 *   start + k × step ≡ target (mod modulus)   →   1 + k × 2 ≡ 0 (mod 5)
 *
 * A menor solução é k = 2 (rastro 1 → 3 → 0). Somar o período (5) dá outra
 * resposta que também pousa no alvo, mas com uma volta extra — ver
 * TUTORIAL_EXTRA_LAP_PULSES. Para trocar o exemplo, edite só este objeto: os
 * textos e o quadro derivam tudo daqui.
 */
export const TUTORIAL_ORBIT: ModularOrbitChallenge = {
  id: 'orbit-tutorial',
  difficulty: 1,
  modulus: 5,
  start: 1,
  step: 2,
  target: 0,
  solution: 2,
  period: 5,
}

/** Resposta com volta extra: chega ao alvo, mas NÃO vale. */
export const TUTORIAL_EXTRA_LAP_PULSES =
  TUTORIAL_ORBIT.solution + TUTORIAL_ORBIT.period

/**
 * Rastro (lista de estações visitadas) para um número de pulsos na órbita de
 * exemplo. Usa a mesma função do jogo, então o tutorial nunca mostra uma conta
 * diferente da que o jogo faz.
 */
export function getTutorialTrace(pulses: number): readonly number[] {
  return evaluateOrbitGuess(TUTORIAL_ORBIT, pulses).trace
}

/** Um rastro desenhado na tela, com um rótulo em texto (não depende só de cor). */
export interface TutorialTrace {
  readonly pulses: number
  readonly label: string
  /** `true` = resposta aceita pelo jogo; `false` = resposta recusada. */
  readonly accepted?: boolean
}

/** Pergunta de prática: o passo só libera o "Próximo" depois do acerto. */
export interface TutorialQuiz {
  readonly question: string
  readonly options: readonly number[]
  readonly correct: number
  readonly success: string
  readonly retry: string
}

/**
 * Desafio interativo no quadro da órbita (igual ao do jogo). O jogador escolhe
 * um número de pulsos entre `options`, lança, e vê o rastro preencher a órbita.
 * A resposta certa é sempre `TUTORIAL_ORBIT.solution`.
 */
export interface TutorialBoard {
  readonly options: readonly number[]
  readonly hint: string
}

export interface TutorialStep {
  readonly title: string
  readonly body: string
  /** Linhas de conta mostradas em fonte monoespaçada (opcional). */
  readonly math?: readonly string[]
  /** Rastros de órbita desenhados pulso a pulso (opcional). */
  readonly traces?: readonly TutorialTrace[]
  /** Prática guiada (opcional). */
  readonly quiz?: TutorialQuiz
  /** Desafio no quadro interativo da órbita (opcional). */
  readonly board?: TutorialBoard
  readonly hint?: string
}

const { start, step, target, modulus, solution } = TUTORIAL_ORBIT
const extra = TUTORIAL_EXTRA_LAP_PULSES

/**
 * Texto da tela de boas-vindas, mostrada antes do passo a passo. Dá o contexto
 * do jogo em uma frase e convida o jogador a começar o tutorial.
 */
export const MODULAR_ORBIT_TUTORIAL_INTRO = {
  title: 'Órbita Modular',
  body: 'Você comanda uma sonda que salta de estação em estação numa órbita circular. A cada pulso ela avança um passo fixo; quando passa da última estação, volta ao início, como um relógio. Sua missão: descobrir quantos pulsos levam a sonda até a estação-alvo pela rota mais curta.',
  hint: 'O tutorial tem cinco passos rápidos e você pode pulá-lo quando quiser.',
} as const

/** Os passos do tutorial, na ordem em que aparecem. Máximo de cinco. */
export const MODULAR_ORBIT_TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    title: 'A órbita é um relógio',
    body: `Uma órbita mod ${modulus} tem as estações 0, 1, 2, 3 e 4. Quando a sonda passa da última estação, ela volta para o 0, como os ponteiros de um relógio.`,
    // Tabela de "n mod 5" para n de 1 a 6, mostrando o salto de 4 de volta ao 0.
    math: Array.from({ length: 6 }, (_, index) => {
      const n = index + 1
      return `${n} mod ${modulus} = ${n % modulus}`
    }),
    hint: 'Mod é o resto da divisão: 6 dividido por 5 deixa resto 1.',
  },
  {
    title: 'Siga o rastro pulso a pulso',
    body: `A sonda sai da estação ${start}. Cada pulso soma +${step}. Veja o caminho com ${solution} pulsos:`,
    math: [
      `pulso 1: ${start} + ${step} = ${start + step}`,
      `pulso 2: ${start + step} + ${step} = ${start + 2 * step} → ${start + 2 * step} mod ${modulus} = ${(start + 2 * step) % modulus}`,
    ],
    traces: [{ pulses: solution, label: `${solution} pulsos` }],
    hint: 'Conte cada pouso. O número de setas é o número de pulsos.',
  },
  {
    title: 'Só a menor rota vale',
    body: `Com ${solution} pulsos a sonda chega ao ${target}. Com ${extra} pulsos ela também chega ao ${target}, mas antes dá uma volta inteira na órbita. O jogo só aceita a MENOR quantidade de pulsos.`,
    traces: [
      { pulses: solution, label: `${solution} pulsos · vale`, accepted: true },
      { pulses: extra, label: `${extra} pulsos · volta extra, não vale`, accepted: false },
    ],
    quiz: {
      question: `Qual resposta o jogo aceita para chegar ao ${target}?`,
      options: [extra, solution],
      correct: solution,
      success: `Isso! ${solution} é a menor rota. ${extra} chega ao alvo, mas com uma volta a mais.`,
      retry: `${extra} chega ao alvo, mas dá uma volta extra. Procure a resposta com menos pulsos.`,
    },
  },
  {
    title: 'Como achar o menor k',
    body: `k é o número de pulsos. Some +${step} a cada pulso a partir da estação ${start} e, quando passar de ${modulus - 1}, volte ao 0 (tire o resto por ${modulus}). Pare no PRIMEIRO pouso no alvo ${target}:`,
    math: [
      `${start} + k × ${step} ≡ ${target} (mod ${modulus})`,
      `k = 1:  ${start} + 1 × ${step} = ${start + step}  →  ${start + step} mod ${modulus} = ${(start + step) % modulus}`,
      `k = 2:  ${start} + 2 × ${step} = ${start + 2 * step}  →  ${start + 2 * step} mod ${modulus} = ${(start + 2 * step) % modulus}`,
      `menor k = ${solution} (primeiro pouso no ${target})`,
    ],
    hint: `${start + 2 * step} mod ${modulus} = ${(start + 2 * step) % modulus}: ${start + 2 * step} dividido por ${modulus} dá resto ${(start + 2 * step) % modulus}. Por isso k = ${solution} chega ao alvo.`,
  },
  {
    title: 'Agora é com você',
    body: `Mesma órbita do jogo: a sonda sai do ${start} (amarelo) e você quer chegar ao ${target} (ciano). Escolha os pulsos e aperte LANÇAR — a órbita vai se preenchendo pulso a pulso, como na missão.`,
    board: {
      options: [1, solution, extra],
      hint: 'Dica: o menor número de pulsos que pousa no alvo é a resposta que o jogo aceita.',
    },
  },
]

// ---------------------------------------------------------------------------
// Persistência: lembra se o jogador já terminou ou pulou o tutorial.
// ---------------------------------------------------------------------------

export const MODULAR_ORBIT_TUTORIAL_STORAGE_KEY = 'modular-orbit-tutorial-seen'

/** `true` se o jogador já viu (ou pulou) o tutorial neste navegador. */
export function hasSeenModularOrbitTutorial(): boolean {
  try {
    return window.localStorage.getItem(MODULAR_ORBIT_TUTORIAL_STORAGE_KEY) === '1'
  } catch {
    // Armazenamento bloqueado (ex.: modo privado): mostramos o tutorial de novo.
    return false
  }
}

/** Guarda que o tutorial foi visto, para não abrir sozinho na próxima vez. */
export function markModularOrbitTutorialSeen(): void {
  try {
    window.localStorage.setItem(MODULAR_ORBIT_TUTORIAL_STORAGE_KEY, '1')
  } catch {
    // Sem armazenamento, o tutorial só volta a aparecer na próxima visita.
  }
}
