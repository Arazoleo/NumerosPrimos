import type { HeroClassId } from './heroClassSystem'

/** Visual/combat identities for the bonus area attack earned by a PERFECT QTE. */
export const PERFECT_ULTIMATE_STYLES = [
  'euclid-proof-cleave',
  'rsa-key-collapse',
  'modular-horizon-volley',
  'mersenne-star-collapse',
  'mobius-null-domain',
  'goldbach-twin-impact',
  'sieve-prime-grid',
  'elliptic-infinity-curve',
] as const

export type PerfectUltimateStyle = (typeof PERFECT_ULTIMATE_STYLES)[number]

export const PERFECT_ULTIMATE_ORIGINS = [
  'hero',
  'enemy-network',
  'aim-point',
  'largest-enemy-cluster',
  'nearest-target',
  'forward-impact',
  'battlefield-grid',
  'predicted-cluster',
] as const

export type PerfectUltimateOrigin = (typeof PERFECT_ULTIMATE_ORIGINS)[number]

export interface PerfectUltimateDamageWave {
  /** Delay from the PERFECT area attack's start. */
  readonly atMs: number
  /** Base damage before class, transformation and QTE modifiers. */
  readonly damage: number
  /** Fraction of the definition's maximum radius reached by this wave. */
  readonly radiusMultiplier: number
  readonly glyph: string
}

export interface PerfectUltimateDefinition {
  readonly classId: HeroClassId
  readonly style: PerfectUltimateStyle
  readonly origin: PerfectUltimateOrigin
  readonly name: string
  readonly formula: string
  readonly description: string
  /** Maximum world-space radius reached by the final wave. */
  readonly radius: number
  readonly durationMs: number
  /** Stagger applied to enemies touched by at least one wave. */
  readonly stunMs: number
  readonly waves: readonly PerfectUltimateDamageWave[]
}

function freezeDefinition(
  definition: PerfectUltimateDefinition,
): PerfectUltimateDefinition {
  return Object.freeze({
    ...definition,
    waves: Object.freeze(
      definition.waves.map((wave) => Object.freeze({ ...wave })),
    ),
  })
}

/**
 * The damage budgets deliberately trade reach and control for raw damage:
 * Ada owns the widest/longest stun, Noa the highest damage, Nara the most
 * waves, and Cael the compact close-range rupture.
 */
export const PERFECT_ULTIMATES: Readonly<
  Record<HeroClassId, PerfectUltimateDefinition>
> = Object.freeze({
  'prime-warrior': freezeDefinition({
    classId: 'prime-warrior',
    style: 'euclid-proof-cleave',
    origin: 'hero',
    name: 'Lâmina do Próximo Primo',
    formula: 'gcd(P, P + 1) = 1',
    description: 'Três cortes de prova atravessam a composição e abrem espaço para um novo primo.',
    radius: 144,
    durationMs: 980,
    stunMs: 900,
    waves: [
      { atMs: 80, damage: 14, radiusMultiplier: 0.5, glyph: '2' },
      { atMs: 360, damage: 17, radiusMultiplier: 0.75, glyph: '3' },
      { atMs: 760, damage: 23, radiusMultiplier: 1, glyph: 'P+1' },
    ],
  }),
  'rsa-cryptographer': freezeDefinition({
    classId: 'rsa-cryptographer',
    style: 'rsa-key-collapse',
    origin: 'enemy-network',
    name: 'Protocolo Ômega: Chave Privada',
    formula: 'n = pq; d ≡ e⁻¹ (mod φ(n))',
    description: 'As chaves p e q fecham uma rede de decifração que paralisa todo composto conectado.',
    radius: 224,
    durationMs: 1_420,
    stunMs: 1_400,
    waves: [
      { atMs: 120, damage: 9, radiusMultiplier: 0.55, glyph: 'p' },
      { atMs: 560, damage: 11, radiusMultiplier: 0.78, glyph: 'q' },
      { atMs: 1_120, damage: 22, radiusMultiplier: 1, glyph: 'd' },
    ],
  }),
  'modular-ranger': freezeDefinition({
    classId: 'modular-ranger',
    style: 'modular-horizon-volley',
    origin: 'aim-point',
    name: 'Próximo Alvo: Treze',
    formula: '13 ≡ 0 (mod 13)',
    description: 'Seis horizontes primos convergem sobre a mira antes que a flecha treze atravesse a área.',
    radius: 192,
    durationMs: 1_200,
    stunMs: 600,
    waves: [
      { atMs: 80, damage: 6, radiusMultiplier: 0.58, glyph: '2' },
      { atMs: 220, damage: 6, radiusMultiplier: 0.67, glyph: '3' },
      { atMs: 380, damage: 7, radiusMultiplier: 0.75, glyph: '5' },
      { atMs: 560, damage: 7, radiusMultiplier: 0.83, glyph: '7' },
      { atMs: 780, damage: 8, radiusMultiplier: 0.92, glyph: '11' },
      { atMs: 1_000, damage: 14, radiusMultiplier: 1, glyph: '13' },
    ],
  }),
  'mersenne-arcanist': freezeDefinition({
    classId: 'mersenne-arcanist',
    style: 'mersenne-star-collapse',
    origin: 'largest-enemy-cluster',
    name: 'Quinta Estrela: M₁₃',
    formula: 'M₁₃ = 2¹³ − 1 = 8191',
    description: 'Quatro estrelas de Mersenne colapsam e fazem nascer 8191 numa supernova de área.',
    radius: 208,
    durationMs: 1_680,
    stunMs: 820,
    waves: [
      { atMs: 160, damage: 9, radiusMultiplier: 0.4, glyph: '3' },
      { atMs: 480, damage: 13, radiusMultiplier: 0.62, glyph: '7' },
      { atMs: 900, damage: 17, radiusMultiplier: 0.82, glyph: '31' },
      { atMs: 1_440, damage: 25, radiusMultiplier: 1, glyph: '8191' },
    ],
  }),
  'mobius-assassin': freezeDefinition({
    classId: 'mobius-assassin',
    style: 'mobius-null-domain',
    origin: 'nearest-target',
    name: 'Domínio Nulo de Möbius',
    formula: 'Σ(d | n) μ(d) = δ(n, 1)',
    description: 'Três inversões trocam o sinal da área antes de apagar no zero todo fator repetido.',
    radius: 156,
    durationMs: 1_080,
    stunMs: 1_000,
    waves: [
      { atMs: 90, damage: 12, radiusMultiplier: 0.5, glyph: '−1' },
      { atMs: 400, damage: 15, radiusMultiplier: 0.74, glyph: '+1' },
      { atMs: 840, damage: 23, radiusMultiplier: 1, glyph: '0' },
    ],
  }),
  'goldbach-berserker': freezeDefinition({
    classId: 'goldbach-berserker',
    style: 'goldbach-twin-impact',
    origin: 'forward-impact',
    name: 'Cataclismo dos Dois Sóis',
    formula: '2n = p + q',
    description: 'Dois sóis primos atingem lados opostos e fecham uma soma par sobre o campo.',
    radius: 178,
    durationMs: 1_280,
    stunMs: 760,
    waves: [
      { atMs: 100, damage: 13, radiusMultiplier: 0.48, glyph: 'p' },
      { atMs: 340, damage: 13, radiusMultiplier: 0.62, glyph: 'q' },
      { atMs: 700, damage: 16, radiusMultiplier: 0.82, glyph: 'p+q' },
      { atMs: 1_080, damage: 22, radiusMultiplier: 1, glyph: '2n' },
    ],
  }),
  'sieve-engineer': freezeDefinition({
    classId: 'sieve-engineer',
    style: 'sieve-prime-grid',
    origin: 'battlefield-grid',
    name: 'Crivo Final de Eratóstenes',
    formula: 'p ≤ √n ⇒ elimine kp',
    description: 'A maior grade do crivo risca os múltiplos em cinco passagens e detona as células compostas.',
    radius: 225,
    durationMs: 1_600,
    stunMs: 1_200,
    waves: [
      { atMs: 120, damage: 6, radiusMultiplier: 0.44, glyph: '2×' },
      { atMs: 360, damage: 7, radiusMultiplier: 0.58, glyph: '3×' },
      { atMs: 660, damage: 7, radiusMultiplier: 0.72, glyph: '5×' },
      { atMs: 1_000, damage: 8, radiusMultiplier: 0.86, glyph: '7×' },
      { atMs: 1_380, damage: 12, radiusMultiplier: 1, glyph: 'PRIMO' },
    ],
  }),
  'elliptic-oracle': freezeDefinition({
    classId: 'elliptic-oracle',
    style: 'elliptic-infinity-curve',
    origin: 'predicted-cluster',
    name: 'Curva do Destino: Ponto Ômega',
    formula: 'P + (−P) = 𝒪',
    description: 'Pontos profetizados percorrem a curva, somam seus opostos e colapsam no infinito.',
    radius: 216,
    durationMs: 1_700,
    stunMs: 1_100,
    waves: [
      { atMs: 140, damage: 9, radiusMultiplier: 0.4, glyph: 'P' },
      { atMs: 500, damage: 12, radiusMultiplier: 0.62, glyph: '2P' },
      { atMs: 940, damage: 15, radiusMultiplier: 0.82, glyph: '−P' },
      { atMs: 1_460, damage: 22, radiusMultiplier: 1, glyph: '𝒪' },
    ],
  }),
})

export function getPerfectUltimate(
  classId: HeroClassId,
): PerfectUltimateDefinition {
  const definition = PERFECT_ULTIMATES[classId]
  if (!definition) {
    throw new RangeError(`Unknown hero class for PERFECT ultimate: ${String(classId)}`)
  }
  return definition
}
