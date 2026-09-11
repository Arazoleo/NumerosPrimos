import { CELL_SIZE, type Position2D } from './gameLogic'
import { hasLevelClearPath, type CatacombsLevelWorld } from './levelWorld'

interface TileGraph {
  readonly keys: ReadonlySet<string>
  readonly tiles: readonly Position2D[]
}

const GRAPHS = new WeakMap<CatacombsLevelWorld, TileGraph>()

/** How many path tiles ahead the smoothing may skip to in one step. */
const SMOOTHING_LOOKAHEAD = 6

function tileKey(x: number, z: number): string {
  return `${x}:${z}`
}

function snap(value: number): number {
  return Math.round((value - CELL_SIZE / 2) / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2
}

function graphFor(world: CatacombsLevelWorld): TileGraph {
  const cached = GRAPHS.get(world)
  if (cached) return cached
  const graph: TileGraph = {
    keys: new Set(world.tiles.map((tile) => tileKey(tile.x, tile.z))),
    tiles: world.tiles.map((tile) => ({ x: tile.x, z: tile.z })),
  }
  GRAPHS.set(world, graph)
  return graph
}

function nearestTile(graph: TileGraph, point: Position2D): Position2D | null {
  const snapped = { x: snap(point.x), z: snap(point.z) }
  if (graph.keys.has(tileKey(snapped.x, snapped.z))) return snapped
  let closest: Position2D | null = null
  let closestDistance = Number.POSITIVE_INFINITY
  for (const tile of graph.tiles) {
    const distance = Math.hypot(tile.x - point.x, tile.z - point.z)
    if (distance < closestDistance) {
      closest = tile
      closestDistance = distance
    }
  }
  return closest
}

/**
 * Breadth-first search over the four-unit tile grid. Stalkers follow corridors
 * around corners instead of grinding against the wall between them and the player,
 * which is what made the old straight-line chase so easy to shake off.
 */
export function findTilePath(
  world: CatacombsLevelWorld,
  from: Position2D,
  to: Position2D,
  maximumTiles = 400,
): readonly Position2D[] {
  const graph = graphFor(world)
  const start = nearestTile(graph, from)
  const goal = nearestTile(graph, to)
  if (!start || !goal) return []
  const startKey = tileKey(start.x, start.z)
  const goalKey = tileKey(goal.x, goal.z)
  if (startKey === goalKey) return [goal]

  const cameFrom = new Map<string, string | null>([[startKey, null]])
  const queue: Position2D[] = [start]
  let head = 0
  let visited = 0

  while (head < queue.length && visited < maximumTiles) {
    const current = queue[head]
    head += 1
    visited += 1
    const currentKey = tileKey(current.x, current.z)
    if (currentKey === goalKey) break
    const neighbours = [
      { x: current.x + CELL_SIZE, z: current.z },
      { x: current.x - CELL_SIZE, z: current.z },
      { x: current.x, z: current.z + CELL_SIZE },
      { x: current.x, z: current.z - CELL_SIZE },
    ]
    for (const neighbour of neighbours) {
      const key = tileKey(neighbour.x, neighbour.z)
      if (!graph.keys.has(key) || cameFrom.has(key)) continue
      cameFrom.set(key, currentKey)
      queue.push(neighbour)
    }
  }

  if (!cameFrom.has(goalKey)) return []
  const path: Position2D[] = []
  let cursor: string | null = goalKey
  while (cursor) {
    const [x, z] = cursor.split(':').map(Number)
    path.push({ x, z })
    cursor = cameFrom.get(cursor) ?? null
  }
  return path.reverse().slice(1)
}

/**
 * The next point a stalker should walk towards.
 *
 * Aiming at the centre of the very next tile makes a creature zigzag — that centre is
 * usually off to one side — so it crawls forward at a fraction of its speed. The path
 * is smoothed instead: walk at the furthest tile still reachable in a straight line,
 * which is how anyone crosses a room they can see across.
 */
export function nextPathPoint(
  world: CatacombsLevelWorld,
  from: Position2D,
  to: Position2D,
  radius = 0.38,
): Position2D | null {
  const graph = graphFor(world)
  const fromTile = nearestTile(graph, from)
  const toTile = nearestTile(graph, to)
  if (!fromTile || !toTile) return null
  if (tileKey(fromTile.x, fromTile.z) === tileKey(toTile.x, toTile.z)) return to
  // A clear shot beats any path: head straight for the destination.
  if (hasLevelClearPath(world, from, to, radius)) return to

  const path = findTilePath(world, from, to)
  if (path.length === 0) return null

  // String pulling: keep the furthest waypoint still reachable in a straight line.
  let target = path[0]
  let targetIndex = 0
  for (let index = 0; index < Math.min(path.length, SMOOTHING_LOOKAHEAD); index += 1) {
    if (!hasLevelClearPath(world, from, path[index], radius)) break
    target = path[index]
    targetIndex = index
  }
  // Standing almost on the chosen waypoint means the next one is the useful one.
  if (
    Math.hypot(target.x - from.x, target.z - from.z) < CELL_SIZE * 0.4
    && targetIndex + 1 < path.length
  ) return path[targetIndex + 1]
  return target
}
