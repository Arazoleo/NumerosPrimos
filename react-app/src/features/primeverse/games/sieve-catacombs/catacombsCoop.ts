import type { EnemyMode, EnemyState } from './gameLogic'

/**
 * Co-op wire format for the Cripta do Crivo.
 *
 * One member of the run — deterministically the lowest player id, so a host that
 * drops is replaced without negotiation — simulates the creatures and owns the
 * shared world facts (drawers, seals, level). Everyone else renders the creatures
 * from this state and sends intents. Each player remains authority over their own
 * body: position, health and jumpscares stay local.
 */

export const COOP_STATE_INTERVAL_MS = 120

export interface CoopEnemyState {
  readonly id: string
  readonly x: number
  readonly z: number
  readonly mode: EnemyMode
}

export interface CatacombsCoopState {
  readonly levelIndex: number
  readonly enemies: readonly CoopEnemyState[]
  readonly openedDrawers: readonly string[]
  readonly collectedPrimes: readonly number[]
  readonly collectedSupplies: readonly string[]
  readonly solvedPuzzles: readonly string[]
}

export type CatacombsCoopAction =
  | { readonly kind: 'open-drawer'; readonly cabinetId: string }
  | { readonly kind: 'collect-supply'; readonly supplyId: string }
  | { readonly kind: 'collect-seal'; readonly prime: number }
  | { readonly kind: 'solve-puzzle'; readonly levelId: string }

export { electCoopHost } from '../primeverse-online/party/coopElection'

export function encodeCoopState(state: CatacombsCoopState): unknown {
  return {
    v: 1,
    l: state.levelIndex,
    e: state.enemies.map((enemy) => [enemy.id, Math.round(enemy.x * 10) / 10, Math.round(enemy.z * 10) / 10, enemy.mode]),
    d: state.openedDrawers,
    p: state.collectedPrimes,
    s: state.collectedSupplies,
    z: state.solvedPuzzles,
  }
}

const ENEMY_MODES: readonly EnemyMode[] = ['patrol', 'search', 'chase', 'attack', 'stunned']

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

export function decodeCoopState(data: unknown): CatacombsCoopState | null {
  if (typeof data !== 'object' || data === null) return null
  const record = data as Record<string, unknown>
  if (record.v !== 1 || typeof record.l !== 'number') return null
  if (!Array.isArray(record.e) || !isStringArray(record.d) || !isStringArray(record.s) || !isStringArray(record.z)) return null
  if (!Array.isArray(record.p) || !record.p.every((entry) => typeof entry === 'number')) return null
  const enemies: CoopEnemyState[] = []
  for (const entry of record.e) {
    if (!Array.isArray(entry) || entry.length !== 4) return null
    const [id, x, z, mode] = entry
    if (typeof id !== 'string' || typeof x !== 'number' || typeof z !== 'number') return null
    if (!ENEMY_MODES.includes(mode as EnemyMode)) return null
    enemies.push({ id, x, z, mode: mode as EnemyMode })
  }
  return {
    levelIndex: record.l,
    enemies,
    openedDrawers: record.d,
    collectedPrimes: record.p as readonly number[],
    collectedSupplies: record.s,
    solvedPuzzles: record.z,
  }
}

export function encodeCoopAction(action: CatacombsCoopAction): unknown {
  return { v: 1, ...action }
}

export function decodeCoopAction(data: unknown): CatacombsCoopAction | null {
  if (typeof data !== 'object' || data === null) return null
  const record = data as Record<string, unknown>
  if (record.v !== 1 || typeof record.kind !== 'string') return null
  if (record.kind === 'open-drawer' && typeof record.cabinetId === 'string') {
    return { kind: 'open-drawer', cabinetId: record.cabinetId }
  }
  if (record.kind === 'collect-supply' && typeof record.supplyId === 'string') {
    return { kind: 'collect-supply', supplyId: record.supplyId }
  }
  if (record.kind === 'collect-seal' && typeof record.prime === 'number') {
    return { kind: 'collect-seal', prime: record.prime }
  }
  if (record.kind === 'solve-puzzle' && typeof record.levelId === 'string') {
    return { kind: 'solve-puzzle', levelId: record.levelId }
  }
  return null
}

/** Replicated creatures become local EnemyState with inert hunt bookkeeping. */
export function coopEnemiesToLocal(
  coop: readonly CoopEnemyState[],
  previous: readonly EnemyState[],
): readonly EnemyState[] {
  return coop.map((enemy) => {
    const before = previous.find((candidate) => candidate.id === enemy.id)
    return {
      id: enemy.id,
      x: enemy.x,
      z: enemy.z,
      mode: enemy.mode,
      waypoint: before?.waypoint ?? 0,
      lastKnown: { x: enemy.x, z: enemy.z },
      lostPlayerAt: 0,
      nextAttackAt: before?.nextAttackAt ?? 0,
      stunnedUntil: 0,
      lightStunMs: 0,
      lightImmuneUntil: 0,
      huntingSince: 0,
      huntCooldownUntil: 0,
    }
  })
}
