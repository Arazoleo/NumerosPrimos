import type { CatacombsLevelId } from './campaignLogic'
import type { Position2D } from './gameLogic'

export type HallucinationTrigger =
  /** Fires once the floor has been walked for a while. */
  | { readonly kind: 'elapsed'; readonly afterMs: number }
  /** Fires near a place, after a minimum time on the floor. */
  | { readonly kind: 'place'; readonly position: Position2D; readonly radius: number; readonly afterMs: number }
  /** Fires the moment the floor's seal is taken. */
  | { readonly kind: 'seal' }
  /** Fires when fear crosses a threshold. */
  | { readonly kind: 'fear'; readonly atLeast: number }

export interface HallucinationLine {
  /** Milliseconds into the vision when this line appears. */
  readonly atMs: number
  readonly text: string
  /** The number or expression that fills the screen behind the line. */
  readonly glyph?: string
}

export interface Hallucination {
  readonly id: string
  readonly levelId: CatacombsLevelId
  readonly trigger: HallucinationTrigger
  readonly durationMs: number
  readonly lines: readonly HallucinationLine[]
  /** 0..1 — how hard the presentation pushes: shake, desaturation, whispers. */
  readonly severity: number
}

/**
 * Visions the explorer has on each floor.
 *
 * Each one is the floor's own mathematics turned against them: the sieve crossing
 * out names, a residue that repeats you, a room number that never changes, a square
 * that pretends to be prime. They are short, they cannot be missed twice, and the
 * player can always cut them short.
 */
export const CATACOMBS_HALLUCINATIONS: readonly Hallucination[] = Object.freeze([
  // ---------------------------------------------------------------- floor 1
  {
    id: 'sieve-counting',
    levelId: 'yellow-offices',
    trigger: { kind: 'elapsed', afterMs: 26_000 },
    durationMs: 5_200,
    severity: 0.35,
    lines: [
      { atMs: 0, text: 'Você começa a contar as lâmpadas do corredor.', glyph: '2' },
      { atMs: 1_500, text: 'Dois. Quatro. Seis. Oito. Todas riscadas.', glyph: '4  6  8' },
      { atMs: 3_200, text: 'A décima primeira continua acesa. Ela sabe o seu nome.', glyph: '11' },
    ],
  },
  {
    id: 'sieve-erasure',
    levelId: 'yellow-offices',
    trigger: { kind: 'seal' },
    durationMs: 4_600,
    severity: 0.5,
    lines: [
      { atMs: 0, text: 'O crivo risca todo segundo nome da lista.', glyph: '2n' },
      { atMs: 1_800, text: 'Você procura o seu na coluna dos sobreviventes.', glyph: '?' },
      { atMs: 3_200, text: 'Ele está na outra coluna.', glyph: '✗' },
    ],
  },

  // ---------------------------------------------------------------- floor 2
  {
    id: 'residue-repeat',
    levelId: 'modular-pools',
    trigger: { kind: 'elapsed', afterMs: 30_000 },
    durationMs: 5_400,
    severity: 0.45,
    lines: [
      { atMs: 0, text: 'Os azulejos se repetem a cada três metros.', glyph: '≡ 0 (mod 3)' },
      { atMs: 1_700, text: 'Você já passou por aqui três vezes.', glyph: '3' },
      { atMs: 3_400, text: 'Ou três de você passaram uma vez cada.', glyph: '3 × você' },
    ],
  },
  {
    id: 'inverse-drown',
    levelId: 'modular-pools',
    trigger: { kind: 'fear', atLeast: 72 },
    durationMs: 4_800,
    severity: 0.62,
    lines: [
      { atMs: 0, text: 'Todo número tem um inverso módulo sete.', glyph: '3 · 5 ≡ 1' },
      { atMs: 1_900, text: 'O seu está no fundo da piscina, olhando para cima.', glyph: '5' },
    ],
  },

  // ---------------------------------------------------------------- floor 3
  {
    id: 'room-twentythree',
    levelId: 'hotel-23',
    trigger: { kind: 'elapsed', afterMs: 24_000 },
    durationMs: 5_000,
    severity: 0.55,
    lines: [
      { atMs: 0, text: 'Quarto 23. O próximo também é 23.', glyph: '23' },
      { atMs: 1_800, text: 'Vinte e três é primo. Não se divide, não se reparte.', glyph: '23 = 23' },
      { atMs: 3_400, text: 'Você tentou dividir e virou resto.', glyph: 'r' },
    ],
  },
  {
    id: 'middle-copy',
    levelId: 'hotel-23',
    trigger: { kind: 'fear', atLeast: 68 },
    durationMs: 4_400,
    severity: 0.7,
    lines: [
      { atMs: 0, text: 'Alguém está no meio do corredor, copiando tudo.', glyph: '→ ▮ →' },
      { atMs: 1_900, text: 'Inclusive a parte em que você acha que escapou.', glyph: 'MITM' },
    ],
  },

  // ---------------------------------------------------------------- floor 4
  {
    id: 'square-of-seven',
    levelId: 'crypt-49',
    trigger: { kind: 'elapsed', afterMs: 22_000 },
    durationMs: 5_200,
    severity: 0.72,
    lines: [
      { atMs: 0, text: 'Quarenta e nove finge ser primo até você tentar dividir.', glyph: '49' },
      { atMs: 1_800, text: 'Sete vezes sete. Nada indivisível aqui.', glyph: '7 × 7' },
      { atMs: 3_400, text: 'Nem você.', glyph: '7 × 7 = você' },
    ],
  },
  {
    id: 'factored-name',
    levelId: 'crypt-49',
    trigger: { kind: 'seal' },
    durationMs: 4_800,
    severity: 0.85,
    lines: [
      { atMs: 0, text: 'O Fatorador terminou a sua chave.', glyph: 'n = p · q' },
      { atMs: 1_900, text: 'Dois fatores, um para cada metade sua.', glyph: 'p   q' },
    ],
  },

  // ---------------------------------------------------------------- floor 5
  {
    id: 'false-mersenne',
    levelId: 'server-farm-11',
    trigger: { kind: 'elapsed', afterMs: 20_000 },
    durationMs: 5_400,
    severity: 0.68,
    lines: [
      { atMs: 0, text: 'Dois elevado a onze, menos um. Deveria ser primo.', glyph: '2¹¹ − 1' },
      { atMs: 1_800, text: 'Dois mil e quarenta e sete.', glyph: '2047' },
      { atMs: 3_300, text: 'Vinte e três vezes oitenta e nove. Nem toda saída é saída.', glyph: '23 × 89' },
    ],
  },
  {
    id: 'brute-log',
    levelId: 'server-farm-11',
    trigger: { kind: 'fear', atLeast: 74 },
    durationMs: 4_200,
    severity: 0.8,
    lines: [
      { atMs: 0, text: 'A varredura chegou na sua senha.', glyph: '999 999' },
      { atMs: 1_700, text: 'Faltam poucas tentativas. Ela não dorme.', glyph: '∞' },
    ],
  },

  // ---------------------------------------------------------------- floor 6
  {
    id: 'thirteen-keys',
    levelId: 'cold-vault-13',
    trigger: { kind: 'elapsed', afterMs: 18_000 },
    durationMs: 5_200,
    severity: 0.78,
    lines: [
      { atMs: 0, text: 'Treze chaves. Treze titulares.', glyph: '13' },
      { atMs: 1_800, text: 'Treze certidões, todas com a mesma data.', glyph: '13 = 13' },
      { atMs: 3_400, text: 'A data é hoje.', glyph: '†' },
    ],
  },
  {
    id: 'shared-secret',
    levelId: 'cold-vault-13',
    trigger: { kind: 'seal' },
    durationMs: 5_000,
    severity: 0.95,
    lines: [
      { atMs: 0, text: 'Você e ele calcularam o mesmo segredo.', glyph: '2⁵ mod 13' },
      { atMs: 1_900, text: 'Seis. Vocês agora compartilham uma chave.', glyph: '6' },
      { atMs: 3_500, text: 'E uma saída. Só cabe um.', glyph: '1' },
    ],
  },
])

export interface HallucinationContext {
  readonly levelId: CatacombsLevelId
  readonly levelElapsedMs: number
  readonly player: Position2D
  readonly fear: number
  readonly sealJustTaken: boolean
  readonly seenIds: readonly string[]
  /** Nothing fires while a creature is this close: visions are for quiet moments. */
  readonly nearestEnemyDistance: number
}

/** Distance under which a vision would be a death sentence rather than a scare. */
export const HALLUCINATION_SAFE_DISTANCE = 12

export function isHallucinationTriggered(
  vision: Hallucination,
  context: HallucinationContext,
): boolean {
  const { trigger } = vision
  if (trigger.kind === 'seal') return context.sealJustTaken
  if (trigger.kind === 'fear') {
    return context.fear >= trigger.atLeast && context.levelElapsedMs > 8_000
  }
  if (trigger.kind === 'elapsed') return context.levelElapsedMs >= trigger.afterMs
  const distance = Math.hypot(
    trigger.position.x - context.player.x,
    trigger.position.z - context.player.z,
  )
  return context.levelElapsedMs >= trigger.afterMs && distance <= trigger.radius
}

/**
 * The vision to play right now, if any. A hallucination never repeats, never
 * interrupts another, and never fires with something breathing down your neck.
 */
export function selectHallucination(
  context: HallucinationContext,
  visions: readonly Hallucination[] = CATACOMBS_HALLUCINATIONS,
): Hallucination | null {
  if (context.nearestEnemyDistance < HALLUCINATION_SAFE_DISTANCE) return null
  return visions.find((vision) => (
    vision.levelId === context.levelId
    && !context.seenIds.includes(vision.id)
    && isHallucinationTriggered(vision, context)
  )) ?? null
}

export interface HallucinationFrame {
  readonly line: HallucinationLine | null
  /** 0..1 across the whole vision. */
  readonly progress: number
  /** 0..1 presentation weight: rises, holds, then releases. */
  readonly envelope: number
  readonly finished: boolean
}

export function hallucinationFrame(
  vision: Hallucination,
  elapsedMs: number,
): HallucinationFrame {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0
  const progress = Math.min(1, elapsed / vision.durationMs)
  const line = [...vision.lines]
    .reverse()
    .find((candidate) => elapsed >= candidate.atMs) ?? null
  // Quick swell, long hold, soft release.
  const envelope = progress < 0.12
    ? progress / 0.12
    : progress > 0.82
      ? Math.max(0, (1 - progress) / 0.18)
      : 1
  return { line, progress, envelope, finished: elapsed >= vision.durationMs }
}
