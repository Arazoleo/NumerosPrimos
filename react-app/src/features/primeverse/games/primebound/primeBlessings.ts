/**
 * Bênçãos Primas: Primebound's character progression.
 *
 * Shrines hidden in the regions offer a choice of three blessings, each themed on
 * a prime and stackable up to three times. Choices are seeded by region and runs
 * never offer a maxed blessing, so every shrine is a real decision. The same
 * module scales the enemies: every collected rune makes the world hit back
 * harder, so the power curve is a race, not a gift.
 */

export const PRIME_BLESSING_IDS = [
  'vigor-do-dois',
  'gume-do-tres',
  'celeridade-do-cinco',
  'folego-do-sete',
  'ressonancia-do-onze',
  'pele-do-treze',
] as const

export type PrimeBlessingId = (typeof PRIME_BLESSING_IDS)[number]

export interface PrimeBlessing {
  readonly id: PrimeBlessingId
  readonly prime: number
  readonly name: string
  readonly description: string
  readonly glyph: string
  readonly maxStacks: number
}

export const PRIME_BLESSINGS: Readonly<Record<PrimeBlessingId, PrimeBlessing>> = Object.freeze({
  'vigor-do-dois': {
    id: 'vigor-do-dois', prime: 2, glyph: '2', maxStacks: 3,
    name: 'Vigor do Dois',
    description: '+2 de vida máxima e cura completa.',
  },
  'gume-do-tres': {
    id: 'gume-do-tres', prime: 3, glyph: '3', maxStacks: 3,
    name: 'Gume do Três',
    description: '+12% de dano em todas as técnicas.',
  },
  'celeridade-do-cinco': {
    id: 'celeridade-do-cinco', prime: 5, glyph: '5', maxStacks: 3,
    name: 'Celeridade do Cinco',
    description: '+8% de velocidade de movimento.',
  },
  'folego-do-sete': {
    id: 'folego-do-sete', prime: 7, glyph: '7', maxStacks: 3,
    name: 'Fôlego do Sete',
    description: '+20 de vigor máximo.',
  },
  'ressonancia-do-onze': {
    id: 'ressonancia-do-onze', prime: 11, glyph: '11', maxStacks: 2,
    name: 'Ressonância do Onze',
    description: 'Corrente prima dura 25% mais tempo.',
  },
  'pele-do-treze': {
    id: 'pele-do-treze', prime: 13, glyph: '13', maxStacks: 2,
    name: 'Pele do Treze',
    description: 'Golpes inimigos causam 1 a menos de dano (mínimo 1).',
  },
})

export interface BlessingEffects {
  readonly bonusMaxHealth: number
  readonly bonusMaxStamina: number
  readonly speedMultiplier: number
  readonly damageMultiplier: number
  readonly damageTakenReduction: number
  readonly chainDurationMultiplier: number
}

export function countStacks(owned: readonly PrimeBlessingId[], id: PrimeBlessingId): number {
  return owned.filter((candidate) => candidate === id).length
}

export function blessingEffects(owned: readonly PrimeBlessingId[]): BlessingEffects {
  const stacks = (id: PrimeBlessingId) => countStacks(owned, id)
  return {
    bonusMaxHealth: stacks('vigor-do-dois') * 2,
    bonusMaxStamina: stacks('folego-do-sete') * 20,
    speedMultiplier: 1 + stacks('celeridade-do-cinco') * 0.08,
    damageMultiplier: 1 + stacks('gume-do-tres') * 0.12,
    damageTakenReduction: stacks('pele-do-treze'),
    chainDurationMultiplier: 1 + stacks('ressonancia-do-onze') * 0.25,
  }
}

function seededIndex(seed: number, salt: number, span: number): number {
  let state = (Math.trunc(seed) + salt * 0x9e3779b9) >>> 0
  state = Math.imul(state ^ (state >>> 15), state | 1) >>> 0
  state ^= state + Math.imul(state ^ (state >>> 7), state | 61)
  return ((state ^ (state >>> 14)) >>> 0) % span
}

/** Three distinct, non-maxed options — the same seed always offers the same three. */
export function offerBlessings(
  seed: number,
  owned: readonly PrimeBlessingId[],
): readonly PrimeBlessingId[] {
  const available = PRIME_BLESSING_IDS.filter((id) => (
    countStacks(owned, id) < PRIME_BLESSINGS[id].maxStacks
  ))
  const pool = [...available]
  const picks: PrimeBlessingId[] = []
  for (let round = 0; picks.length < 3 && pool.length > 0; round += 1) {
    const index = seededIndex(seed, round, pool.length)
    picks.push(pool.splice(index, 1)[0])
  }
  return picks
}

/**
 * The world answers the hero's growth: each collected rune hardens the remaining
 * enemies. Capped so the last regions are a fight, never a wall.
 */
export interface EnemyScale {
  readonly hpMultiplier: number
  readonly speedMultiplier: number
}

export function enemyScaleForRunes(runeCount: number): EnemyScale {
  const runes = Number.isFinite(runeCount) ? Math.max(0, Math.floor(runeCount)) : 0
  return {
    hpMultiplier: Math.min(1.9, 1 + runes * 0.14),
    speedMultiplier: Math.min(1.28, 1 + runes * 0.04),
  }
}

/**
 * Where a shrine stands: the first open floor tile found spiralling out from the
 * map's centre. Deterministic per area, guaranteed walkable because it *is* a
 * floor tile, and needs no hand-placed coordinates.
 */
export function findShrineTile(tileMap: readonly string[]): { readonly x: number; readonly y: number } | null {
  const height = tileMap.length
  if (height === 0) return null
  const centerY = Math.floor(height / 2)
  const centerX = Math.floor((tileMap[centerY]?.length ?? 0) / 2)
  for (let radius = 0; radius < Math.max(height, centerX * 2); radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
        const y = centerY + dy
        const x = centerX + dx
        if (tileMap[y]?.[x] === '.') return { x, y }
      }
    }
  }
  return null
}
