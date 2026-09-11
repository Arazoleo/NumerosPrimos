export { electCoopHost } from '../primeverse-online/party/coopElection'

/**
 * Primebound co-op wire format.
 *
 * The run's host simulates the creatures of the area it stands in and broadcasts
 * them; a guest inside the same area replicates position, hp and wakefulness, and
 * reports the damage its own hits produced (hp reconciliation — no combat code is
 * intercepted). Guests in other areas keep their local solo simulation.
 */
export const PRIMEBOUND_COOP_INTERVAL_MS = 140

export interface CoopEnemySnapshot {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly hp: number
  readonly awake: boolean
}

export interface PrimeboundCoopState {
  readonly areaId: string
  readonly enemies: readonly CoopEnemySnapshot[]
}

export interface PrimeboundCoopDamage {
  readonly kind: 'damage'
  readonly enemyId: string
  readonly amount: number
}

export function encodePrimeboundCoopState(state: PrimeboundCoopState): unknown {
  return {
    v: 1,
    a: state.areaId,
    e: state.enemies.map((enemy) => [
      enemy.id,
      Math.round(enemy.x),
      Math.round(enemy.y),
      Math.round(enemy.hp),
      enemy.awake ? 1 : 0,
    ]),
  }
}

export function decodePrimeboundCoopState(data: unknown): PrimeboundCoopState | null {
  if (typeof data !== 'object' || data === null) return null
  const record = data as Record<string, unknown>
  if (record.v !== 1 || typeof record.a !== 'string' || !Array.isArray(record.e)) return null
  const enemies: CoopEnemySnapshot[] = []
  for (const entry of record.e) {
    if (!Array.isArray(entry) || entry.length !== 5) return null
    const [id, x, y, hp, awake] = entry
    if (typeof id !== 'string' || typeof x !== 'number' || typeof y !== 'number' || typeof hp !== 'number') return null
    enemies.push({ id, x, y, hp, awake: awake === 1 })
  }
  return { areaId: record.a, enemies }
}

export function encodePrimeboundCoopDamage(damage: PrimeboundCoopDamage): unknown {
  return { v: 1, kind: 'damage', enemyId: damage.enemyId, amount: Math.max(0, Math.round(damage.amount)) }
}

export function decodePrimeboundCoopDamage(data: unknown): PrimeboundCoopDamage | null {
  if (typeof data !== 'object' || data === null) return null
  const record = data as Record<string, unknown>
  if (record.v !== 1 || record.kind !== 'damage') return null
  if (typeof record.enemyId !== 'string' || typeof record.amount !== 'number' || !Number.isFinite(record.amount)) return null
  if (record.amount <= 0 || record.amount > 9_999) return null
  return { kind: 'damage', enemyId: record.enemyId, amount: record.amount }
}

/**
 * Online reinforcement: with a party in the run, every minion is cloned once per
 * extra member (bosses never multiply). Clones reuse the source id — definition
 * lookups stay valid — offset in a ring so the pack reads as a pack.
 */
export function reinforcementCount(partySize: number): number {
  if (!Number.isFinite(partySize) || partySize <= 1) return 0
  return Math.min(3, Math.floor(partySize) - 1)
}

export interface ReinforceableEnemy {
  readonly x: number
  readonly y: number
  readonly kind: string
}

export function reinforcementOffsets(copies: number, radius = 46): readonly { x: number; y: number }[] {
  return Array.from({ length: copies }, (_, index) => {
    const angle = (index + 1) / (copies + 1) * Math.PI * 2
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
  })
}
