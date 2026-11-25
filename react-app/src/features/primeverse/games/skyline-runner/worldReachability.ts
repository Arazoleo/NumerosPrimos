/**
 * Pure roof-connectivity analysis for a {@link SkylineWorldData}.
 *
 * Nodes are building roofs. An edge connects two roofs when the player can get
 * between them with the SAME physics the gameplay loop runs, expressed through
 * TRAVERSAL_BUDGET:
 *
 *  - FREE: the horizontal gap between the two footprints is within
 *    MAX_FREE_HORIZONTAL_GAP, the upward rise is within MAX_FREE_UP_STEP, and
 *    the drop is within MAX_FREE_DOWN_STEP (plain jump / wall-run / mantle).
 *  - GRAPPLE: a grapple anchor sits within GRAPPLE_RANGE of BOTH roofs and has
 *    clear line-of-sight to both (the rope can bridge the gap). This covers any
 *    gap the free budget cannot.
 *
 * NO React / three imports; only local code and the pure parkourLogic helper
 * {@link hasLineOfSight}. Used by FEAT-006 to prove the three missions always
 * spawn on reachable roofs.
 */
import { hasLineOfSight } from './parkourLogic'
import type { Aabb, Vec3 } from './types'
import type { SkylineWorldData } from './worldGen'
import { TRAVERSAL_BUDGET } from './worldGenConstants'

export type RoofEdgeKind = 'free' | 'grapple'

export interface RoofEdge {
  readonly to: string
  readonly kind: RoofEdgeKind
}

/** Adjacency list keyed by building id. */
export interface RoofGraph {
  readonly spawnRoofId: string
  readonly nodes: readonly string[]
  readonly edges: ReadonlyMap<string, readonly RoofEdge[]>
}

function roofCenter(bounds: Aabb): Vec3 {
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: bounds.max.y,
    z: (bounds.min.z + bounds.max.z) / 2,
  }
}

function horizontalGap(a: Aabb, b: Aabb): number {
  const dx = Math.max(0, Math.max(a.min.x - b.max.x, b.min.x - a.max.x))
  const dz = Math.max(0, Math.max(a.min.z - b.max.z, b.min.z - a.max.z))
  return Math.hypot(dx, dz)
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

/** True when a plain jump / wall-run / mantle covers the step within budget. */
export function isFreeTraversable(from: Aabb, to: Aabb): boolean {
  const gap = horizontalGap(from, to)
  if (gap > TRAVERSAL_BUDGET.MAX_FREE_HORIZONTAL_GAP) return false
  const rise = to.max.y - from.max.y
  if (rise > TRAVERSAL_BUDGET.MAX_FREE_UP_STEP) return false
  if (-rise > TRAVERSAL_BUDGET.MAX_FREE_DOWN_STEP) return false
  return true
}

/**
 * Builds the roof-connectivity graph. The spawn roof is the building whose roof
 * centre is closest to `world.spawn` (that is where the player lands after the
 * teleport).
 */
export function buildRoofGraph(world: SkylineWorldData): RoofGraph {
  const buildings = world.buildings
  const centers = new Map<string, Vec3>()
  for (const b of buildings) centers.set(b.id, roofCenter(b.bounds))

  // Spawn roof = nearest roof centre to the spawn point.
  let spawnRoofId = buildings.length > 0 ? buildings[0].id : ''
  let bestDist = Infinity
  for (const b of buildings) {
    const d = distance(centers.get(b.id) as Vec3, world.spawn)
    if (d < bestDist) {
      bestDist = d
      spawnRoofId = b.id
    }
  }

  const obstacles: readonly Aabb[] = buildings.map((b) => b.bounds)
  const obstacleIndexById = new Map<string, number>()
  buildings.forEach((b, i) => obstacleIndexById.set(b.id, i))

  // Precompute, for each anchor, which roofs it can reach (within range + LoS).
  const anchorReach: Array<Set<string>> = world.anchors.map((anchor) => {
    const reach = new Set<string>()
    for (const b of buildings) {
      const center = centers.get(b.id) as Vec3
      if (distance(center, anchor.position) > TRAVERSAL_BUDGET.GRAPPLE_RANGE) continue
      // Exclude the roof's own collider so its face does not occlude the rope.
      const selfIdx = obstacleIndexById.get(b.id)
      const filtered = obstacles.filter((_, i) => i !== selfIdx)
      if (hasLineOfSight(center, anchor.position, filtered)) reach.add(b.id)
    }
    return reach
  })

  const edges = new Map<string, RoofEdge[]>()
  for (const b of buildings) edges.set(b.id, [])
  const pushEdge = (a: string, b: string, kind: RoofEdgeKind): void => {
    const list = edges.get(a)
    if (!list) return
    if (!list.some((e) => e.to === b && e.kind === kind)) list.push({ to: b, kind })
  }

  // FREE edges (directional: rise budget differs by direction).
  for (let i = 0; i < buildings.length; i += 1) {
    for (let j = 0; j < buildings.length; j += 1) {
      if (i === j) continue
      if (isFreeTraversable(buildings[i].bounds, buildings[j].bounds)) {
        pushEdge(buildings[i].id, buildings[j].id, 'free')
      }
    }
  }

  // GRAPPLE edges: any two roofs an anchor can reach become mutually connected.
  for (const reach of anchorReach) {
    const ids = [...reach]
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = 0; j < ids.length; j += 1) {
        if (i === j) continue
        pushEdge(ids[i], ids[j], 'grapple')
      }
    }
  }

  const frozen = new Map<string, readonly RoofEdge[]>()
  for (const [k, v] of edges) frozen.set(k, v)

  return {
    spawnRoofId,
    nodes: buildings.map((b) => b.id),
    edges: frozen,
  }
}

/** Breadth-first set of roof ids reachable from `startRoofId`. */
export function reachableRoofIds(world: SkylineWorldData, startRoofId: string): Set<string> {
  const graph = buildRoofGraph(world)
  const seen = new Set<string>()
  if (!graph.edges.has(startRoofId)) return seen
  const queue: string[] = [startRoofId]
  seen.add(startRoofId)
  while (queue.length > 0) {
    const current = queue.shift() as string
    for (const edge of graph.edges.get(current) ?? []) {
      if (!seen.has(edge.to)) {
        seen.add(edge.to)
        queue.push(edge.to)
      }
    }
  }
  return seen
}

/**
 * True when every target roof is reachable from the spawn roof. With no targets
 * the guarantee is vacuously satisfied.
 */
export function isWorldTraversable(
  world: SkylineWorldData,
  targetRoofIds: readonly string[],
): boolean {
  const graph = buildRoofGraph(world)
  if (graph.spawnRoofId === '') return targetRoofIds.length === 0
  const reachable = reachableRoofIds(world, graph.spawnRoofId)
  return targetRoofIds.every((id) => reachable.has(id))
}
