import type { HeroClassId } from './heroClassSystem'

export type UltimateQteMode = 'space-mash' | 'key-sequence'
export type UltimateQteGrade = 'base' | 'good' | 'great' | 'perfect'

export interface UltimateQteInput {
  readonly type: 'press'
  readonly code: string
}

export interface UltimateQteDefinition {
  readonly classId: HeroClassId
  readonly mode: UltimateQteMode
  readonly title: string
  readonly instruction: string
  readonly formula: string
  readonly durationMs: number
  readonly targetCount: number
  readonly perfectName: string
  readonly perfectLine: string
  /** Physical KeyboardEvent codes accepted by this challenge, in required order. */
  readonly keySequence: readonly string[]
  /** Player-facing labels aligned with keySequence. Mash challenges expose one label. */
  readonly keyLabels: readonly string[]
  /** Prime/factor labels revealed as each step is completed. */
  readonly stepLabels: readonly string[]
}

export interface UltimateQteState {
  readonly classId: HeroClassId
  readonly mode: UltimateQteMode
  readonly startedAtMs: number
  readonly expiresAtMs: number
  readonly completedAtMs: number | null
  readonly completedSteps: number
  readonly lastCorrectInputAtMs: number | null
}

export interface UltimateQteResult {
  readonly classId: HeroClassId
  readonly score: number
  readonly grade: UltimateQteGrade
  readonly damageMultiplier: number
  readonly perfect: boolean
  readonly finisherName: string
  readonly finisherLine: string
}

export interface UltimateQteSnapshot {
  readonly definition: UltimateQteDefinition
  readonly state: UltimateQteState
  readonly elapsedMs: number
  readonly remainingMs: number
  readonly progress: number
  readonly status: 'active' | 'complete' | 'expired'
  readonly result: UltimateQteResult
}

const QTE_DURATION_MS = 3_000
const INPUT_DEBOUNCE_MS = 55

function freezeDefinition(
  definition: UltimateQteDefinition,
): UltimateQteDefinition {
  return Object.freeze({
    ...definition,
    keySequence: Object.freeze([...definition.keySequence]),
    keyLabels: Object.freeze([...definition.keyLabels]),
    stepLabels: Object.freeze([...definition.stepLabels]),
  })
}

export const ULTIMATE_QTE_DEFINITIONS: Readonly<
  Record<HeroClassId, UltimateQteDefinition>
> = Object.freeze({
  'prime-warrior': freezeDefinition({
    classId: 'prime-warrior',
    mode: 'space-mash',
    title: 'Forja de Euclides',
    instruction: 'Pressione Espaço 10 vezes para forjar a cadeia dos próximos primos.',
    formula: '2 → 3 → 5 → 7 → ⋯',
    durationMs: QTE_DURATION_MS,
    targetCount: 10,
    perfectName: 'Lâmina do Próximo Primo',
    perfectLine: 'Todos os primos conhecidos... E MAIS UM!',
    keySequence: ['Space'],
    keyLabels: ['ESPAÇO'],
    stepLabels: ['2', '3', '5', '7', '11', '13', '17', '19', '23', '29'],
  }),
  'rsa-cryptographer': freezeDefinition({
    classId: 'rsa-cryptographer',
    mode: 'key-sequence',
    title: 'Cerco RSA: Chave Privada',
    instruction: 'Digite a sequência indicada para revelar os fatores primos da chave.',
    formula: '15 · 77 · 143 = (3×5)(7×11)(11×13)',
    durationMs: QTE_DURATION_MS,
    targetCount: 6,
    perfectName: 'Protocolo Ω: Chave Privada',
    perfectLine: 'p e q encontrados. A chave privada é minha!',
    keySequence: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit4', 'Digit5'],
    keyLabels: ['1', '2', '3', '4', '4', '5'],
    stepLabels: ['3', '5', '7', '11', '11', '13'],
  }),
  'modular-ranger': freezeDefinition({
    classId: 'modular-ranger',
    mode: 'key-sequence',
    title: 'Rota dos Resíduos',
    instruction: 'Pressione a seta mostrada — ou o WASD equivalente — para seguir a rota.',
    formula: '2 → 3 → 5 → 7 → 11',
    durationMs: QTE_DURATION_MS,
    targetCount: 5,
    perfectName: 'Próximo Alvo: 13',
    perfectLine: 'Trajetória perfeita. Próximo alvo... TREZE!',
    keySequence: ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Space'],
    keyLabels: ['←', '↑', '→', '↓', 'ESPAÇO'],
    stepLabels: ['2', '3', '5', '7', '11'],
  }),
  'mersenne-arcanist': freezeDefinition({
    classId: 'mersenne-arcanist',
    mode: 'space-mash',
    title: 'Núcleo de Mersenne',
    instruction: 'Pressione Espaço 8 vezes para acender os expoentes primos de Mersenne.',
    formula: 'Mₚ = 2ᵖ − 1',
    durationMs: QTE_DURATION_MS,
    targetCount: 8,
    perfectName: 'Quinta Estrela: M₁₃',
    perfectLine: 'O céu ainda não acabou... OITO MIL CENTO E NOVENTA E UM!',
    keySequence: ['Space'],
    keyLabels: ['ESPAÇO'],
    stepLabels: ['M₂', 'M₃', 'M₅', 'M₇', 'p=13', '2¹³', '−1', '8191'],
  }),
  'mobius-assassin': freezeDefinition({
    classId: 'mobius-assassin',
    mode: 'key-sequence',
    title: 'Sinais de Möbius',
    instruction: 'Pressione a tecla indicada para inverter os cinco sinais da sombra.',
    formula: 'μ(n) ∈ {−1, 0, +1}',
    durationMs: QTE_DURATION_MS,
    targetCount: 5,
    perfectName: 'Domínio Nulo de Möbius',
    perfectLine: 'Menos um. Zero. Mais um... seu valor foi apagado!',
    keySequence: ['KeyA', 'KeyD', 'KeyA', 'KeyD', 'Space'],
    keyLabels: ['A', 'D', 'A', 'D', 'ESPAÇO'],
    stepLabels: ['−1', '+1', '0', '−1', 'μ'],
  }),
  'goldbach-berserker': freezeDefinition({
    classId: 'goldbach-berserker',
    mode: 'space-mash',
    title: 'Colisão de Goldbach',
    instruction: 'Pressione Espaço 12 vezes para fechar seis pares de primos.',
    formula: '2n = p + q',
    durationMs: QTE_DURATION_MS,
    targetCount: 12,
    perfectName: 'Cataclismo dos Dois Sóis',
    perfectLine: 'Dois primos. Uma soma. COLISÃO PAR!',
    keySequence: ['Space'],
    keyLabels: ['ESPAÇO'],
    stepLabels: ['3', '5', '5', '7', '7', '11', '11', '13', '13', '17', '17', '19'],
  }),
  'sieve-engineer': freezeDefinition({
    classId: 'sieve-engineer',
    mode: 'key-sequence',
    title: 'Sobrecarga do Crivo',
    instruction: 'Pressione 2, 3 ou 5 conforme a grade indicar para riscar os compostos.',
    formula: 'risque kp para p ≤ √n',
    durationMs: QTE_DURATION_MS,
    targetCount: 6,
    perfectName: 'Crivo Final de Eratóstenes',
    perfectLine: 'Compostos eliminados. Somente os primos permanecem!',
    keySequence: ['Digit2', 'Digit3', 'Digit5', 'Digit2', 'Digit3', 'Digit5'],
    keyLabels: ['2', '3', '5', '2', '3', '5'],
    stepLabels: ['4×', '9×', '25×', '6×', '15×', '35×'],
  }),
  'elliptic-oracle': freezeDefinition({
    classId: 'elliptic-oracle',
    mode: 'space-mash',
    title: 'Órbita Elíptica',
    instruction: 'Pressione Espaço 9 vezes para somar os pontos até o infinito.',
    formula: 'P + Q → 𝒪',
    durationMs: QTE_DURATION_MS,
    targetCount: 9,
    perfectName: 'Curva do Destino: Ponto Ômega',
    perfectLine: 'A tangente atravessou o horizonte... PONTO NO INFINITO!',
    keySequence: ['Space'],
    keyLabels: ['ESPAÇO'],
    stepLabels: ['P', '2P', '3P', '5P', '7P', '11P', '13P', '17P', '𝒪'],
  }),
})

function assertTime(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite, non-negative time.`)
  }
}

function definitionFor(classId: HeroClassId): UltimateQteDefinition {
  const definition = ULTIMATE_QTE_DEFINITIONS[classId]
  if (!definition) throw new RangeError(`Unknown hero class: ${String(classId)}`)
  return definition
}

function freezeState(state: UltimateQteState): UltimateQteState {
  return Object.freeze({ ...state })
}

function assertState(state: UltimateQteState): UltimateQteDefinition {
  const definition = definitionFor(state.classId)
  assertTime(state.startedAtMs, 'startedAtMs')
  assertTime(state.expiresAtMs, 'expiresAtMs')
  if (
    definition.mode !== state.mode ||
    state.expiresAtMs !== state.startedAtMs + definition.durationMs ||
    !Number.isInteger(state.completedSteps) ||
    state.completedSteps < 0 ||
    state.completedSteps > definition.targetCount
  ) {
    throw new RangeError('Invalid ultimate QTE state.')
  }
  return definition
}

function qteTime(
  state: UltimateQteState,
  nowMs: number,
): { definition: UltimateQteDefinition; elapsedMs: number; remainingMs: number } {
  const definition = assertState(state)
  assertTime(nowMs, 'nowMs')
  if (nowMs < state.startedAtMs) throw new RangeError('QTE clock cannot move backwards.')
  const latestRecordedAtMs = state.completedAtMs ?? state.lastCorrectInputAtMs
  if (latestRecordedAtMs !== null && nowMs < latestRecordedAtMs) {
    throw new RangeError('QTE clock cannot precede its latest input.')
  }
  return {
    definition,
    elapsedMs: Math.min(definition.durationMs, nowMs - state.startedAtMs),
    remainingMs: Math.max(0, state.expiresAtMs - nowMs),
  }
}

export function startUltimateQte(
  classId: HeroClassId,
  startedAtMs = 0,
): UltimateQteState {
  const definition = definitionFor(classId)
  assertTime(startedAtMs, 'startedAtMs')
  return freezeState({
    classId,
    mode: definition.mode,
    startedAtMs,
    expiresAtMs: startedAtMs + definition.durationMs,
    completedAtMs: null,
    completedSteps: 0,
    lastCorrectInputAtMs: null,
  })
}

function expectedCode(
  state: UltimateQteState,
  definition: UltimateQteDefinition,
): string | undefined {
  return state.mode === 'space-mash'
    ? definition.keySequence[0]
    : definition.keySequence[state.completedSteps]
}

export function applyUltimateQteInput(
  state: UltimateQteState,
  input: UltimateQteInput,
  nowMs: number,
): UltimateQteState {
  const { definition } = qteTime(state, nowMs)
  if (state.completedAtMs !== null || nowMs >= state.expiresAtMs) return state

  // Incorrect input is intentionally free: it neither lowers the score nor
  // consumes the debounce window for the next correct key.
  if (input.code !== expectedCode(state, definition)) return state
  if (
    state.lastCorrectInputAtMs !== null &&
    nowMs - state.lastCorrectInputAtMs < INPUT_DEBOUNCE_MS
  ) return state

  const completedSteps = Math.min(definition.targetCount, state.completedSteps + 1)
  return freezeState({
    ...state,
    completedSteps,
    lastCorrectInputAtMs: nowMs,
    completedAtMs: completedSteps === definition.targetCount ? nowMs : null,
  })
}

export function resolveUltimateQte(
  state: UltimateQteState,
  nowMs: number,
): UltimateQteResult {
  const { definition } = qteTime(state, nowMs)
  const perfect = state.completedSteps === definition.targetCount && state.completedAtMs !== null
  const rawScore = state.completedSteps / definition.targetCount * 1_000
  const score = perfect ? 1_000 : Math.round(Math.min(999, Math.max(0, rawScore)))
  const grade: UltimateQteGrade = perfect
    ? 'perfect'
    : score >= 700 ? 'great' : score >= 300 ? 'good' : 'base'
  const damageMultiplier = perfect
    ? 1.75
    : Math.round((1 + score / 1_000 * .55) * 100) / 100
  return Object.freeze({
    classId: state.classId,
    score,
    grade,
    damageMultiplier,
    perfect,
    finisherName: definition.perfectName,
    finisherLine: definition.perfectLine,
  })
}

export function getUltimateQteSnapshot(
  state: UltimateQteState,
  nowMs: number,
): UltimateQteSnapshot {
  const { definition, elapsedMs, remainingMs } = qteTime(state, nowMs)
  return Object.freeze({
    definition,
    state,
    elapsedMs,
    remainingMs,
    progress: elapsedMs / definition.durationMs,
    status: state.completedAtMs !== null
      ? 'complete'
      : nowMs >= state.expiresAtMs ? 'expired' : 'active',
    result: resolveUltimateQte(state, nowMs),
  })
}

export function getUltimateQteKeyboardInput(
  state: UltimateQteState,
  code: string,
  phase: 'down' | 'up',
): UltimateQteInput | null {
  if (phase === 'up') return null
  const definition = definitionFor(state.classId)
  const normalizedCode = state.classId === 'modular-ranger'
    ? ({
        KeyA: 'ArrowLeft',
        KeyW: 'ArrowUp',
        KeyD: 'ArrowRight',
        KeyS: 'ArrowDown',
      } as const)[code as 'KeyA' | 'KeyW' | 'KeyD' | 'KeyS'] ?? code
    : /^Numpad[1-5]$/.test(code) ? `Digit${code.slice(-1)}` : code
  return definition.keySequence.includes(normalizedCode)
    ? { type: 'press', code: normalizedCode }
    : null
}
