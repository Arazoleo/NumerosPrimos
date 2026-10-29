import { isPrime, primeFactorization } from '../../../../lib/math'

export type TutorialStepId = 'aim' | 'composite' | 'mixed' | 'briefing'

/** Elemento do HUD que pode ser destacado durante o tutorial. */
export type TutorialHudTarget = 'score-combo' | 'health' | 'mission'

export interface TutorialHighlight {
  readonly target: TutorialHudTarget
  readonly text: string
}

export interface TutorialStep {
  readonly id: TutorialStepId
  readonly kicker: string
  readonly title: string
  readonly body: string
  readonly goal?: string
  readonly success?: string
  /** Asteroides que entram em cena, na ordem. Vazio = passo só de leitura. */
  readonly wave: readonly number[]
  /** Frases que destacam partes do HUD, uma de cada vez. */
  readonly highlights?: readonly TutorialHighlight[]
}

/** Tempo que cada destaque do HUD fica ativo antes de passar ao próximo. */
export const TUTORIAL_HIGHLIGHT_MS = 3800

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'aim',
    kicker: 'MIRA',
    title: 'Acerte o primo',
    body: 'O 7 só é divisível por 1 e por ele mesmo, então é primo. Mire no asteroide e clique para disparar.',
    goal: 'Destrua o asteroide 7',
    success: 'Primos são os seus alvos. Cada acerto soma pontos.',
    wave: [7],
  },
  {
    id: 'composite',
    kicker: 'TRIAGEM',
    title: 'Deixe o composto passar',
    body: '9 = 3 × 3. Números compostos têm outros divisores e não são alvos. Não atire: deixe-o atravessar a defesa.',
    goal: 'Não atire no 9',
    success: 'Compostos que passam não causam dano.',
    wave: [9],
  },
  {
    id: 'mixed',
    kicker: 'SIMULAÇÃO',
    title: 'Separe primos e compostos',
    body: 'Agora vêm vários números. Acerte só os primos. Dica: teste se o número é divisível por 2, 3, 5 ou 7.',
    goal: 'Acerte os primos, deixe os compostos passarem',
    success: 'Triagem perfeita. Você está pronto.',
    wave: [15, 11, 21, 13],
  },
  {
    id: 'briefing',
    kicker: 'PAINEL',
    title: 'Pronto para a missão',
    body: 'Este é o painel da missão. Clique numa frase para ver o destaque de novo.',
    wave: [],
    highlights: [
      { target: 'score-combo', text: 'Primos acertados em sequência aumentam o COMBO e o SCORE.' },
      { target: 'health', text: 'Atirar num composto ou deixar um primo escapar custa 1 de ENERGIA. Sem energia, a nave cai.' },
      { target: 'mission', text: 'Com 20 primos, o setor está limpo.' },
    ],
  },
]

export type TutorialPhase = 'running' | 'success' | 'retry'

export interface TutorialFeedback {
  readonly correct: boolean
  readonly text: string
}

export interface TutorialState {
  readonly stepIndex: number
  /** Muda a cada tentativa para o AsteroidPool reiniciar a onda. */
  readonly waveId: number
  readonly resolved: number
  readonly mistakes: number
  readonly phase: TutorialPhase
  readonly feedback: TutorialFeedback | null
}

export type TutorialAction =
  | { type: 'hit'; value: number }
  | { type: 'pass'; value: number }
  | { type: 'retry' }
  | { type: 'next' }
  | { type: 'restart' }

function freshWave(stepIndex: number, waveId: number): TutorialState {
  return { stepIndex, waveId, resolved: 0, mistakes: 0, phase: 'running', feedback: null }
}

export const initialTutorialState: TutorialState = freshWave(0, 1)

function factors(value: number) {
  return primeFactorization(value).join(' × ')
}

function describe(action: 'hit' | 'pass', value: number, prime: boolean): TutorialFeedback {
  if (action === 'hit') {
    return prime
      ? { correct: true, text: `${value} é primo. Alvo destruído.` }
      : { correct: false, text: `${value} = ${factors(value)}. É composto, não era alvo.` }
  }
  return prime
    ? { correct: false, text: `${value} é primo e escapou da sua mira.` }
    : { correct: true, text: `${value} = ${factors(value)} passou. Correto.` }
}

export function tutorialReducer(state: TutorialState, action: TutorialAction): TutorialState {
  switch (action.type) {
    case 'hit':
    case 'pass': {
      const step = TUTORIAL_STEPS[state.stepIndex]
      if (state.phase !== 'running' || step.wave.length === 0) return state
      const feedback = describe(action.type, action.value, isPrime(action.value))
      const resolved = state.resolved + 1
      const mistakes = state.mistakes + (feedback.correct ? 0 : 1)
      const waveOver = resolved >= step.wave.length
      return {
        ...state,
        resolved,
        mistakes,
        feedback,
        phase: !waveOver ? 'running' : mistakes === 0 ? 'success' : 'retry',
      }
    }
    case 'retry':
      return freshWave(state.stepIndex, state.waveId + 1)
    case 'next':
      return state.stepIndex < TUTORIAL_STEPS.length - 1
        ? freshWave(state.stepIndex + 1, state.waveId + 1)
        : state
    case 'restart':
      return freshWave(0, state.waveId + 1)
  }
}

const STORAGE_KEY = 'primeverse:prime-hunter:tutorial-complete'

export function readTutorialComplete(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markTutorialComplete(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* storage indisponível (ex.: modo privado); o tutorial volta a aparecer */
  }
}
