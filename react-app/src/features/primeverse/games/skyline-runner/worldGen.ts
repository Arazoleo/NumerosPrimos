/**
 * Seeded procedural world generator for Skyline Runner (Round 2).
 *
 * This is a PURE module: it has NO React / @react-three / three imports. It
 * emits exactly the data structures the rest of the game already consumes
 * (SkylineBuilding[], a SKYLINE_COLLIDERS-shaped ParkourPlatform[],
 * GrappleAnchor[], Checkpoint[], a spawn Vec3 and world extents) so the renderer
 * and physics treat generated roofs just like the hand-authored ones.
 *
 * Determinism: all randomness comes from a single {@link createRng} instance, so
 * the same seed always yields a deep-equal {@link SkylineWorldData}.
 *
 * Reachability: the generator lays buildings on a grid and grows a seeded BFS
 * spanning tree rooted at the spawn cell. Round 4 DOUBLES the per-step
 * roof-height deltas (and the roof ceiling) to grow a genuinely taller
 * silhouette, so almost every upward tree edge now exceeds the free-jump
 * budget. Every over-budget tree edge (and every over-budget
 * orthogonal neighbour) is bridged by a grapple anchor placed within
 * GRAPPLE_RANGE and with clear line-of-sight to BOTH endpoint roofs (the exact
 * condition worldReachability.buildRoofGraph needs to emit a grapple edge). A
 * final connect-the-components post-pass places additional two-sided anchors
 * until the spawn roof reaches every roof. The companion worldReachability.ts
 * proves the resulting graph is connected.
 */
import { hasLineOfSight } from './parkourLogic'
import { createRng } from './seededRng'
import type { Aabb, Checkpoint, GrappleAnchor, ParkourPlatform, Vec3 } from './types'
import type { SkylineBuilding } from './world'
import { TRAVERSAL_BUDGET } from './worldGenConstants'

/**
 * Target spread of the realised roof heights. Round 2 kept roofs in a narrow
 * band (per-step delta <= ~1.38u up / 4.5u down). Round 3 widened this to the
 * static tutorial silhouette (~0..~13). Round 4 DOUBLES the band: the player
 * tested the round-3 city and reported head-room for roughly twice the height,
 * so the realised silhouette now spans ~0.8..~24. The user explicitly asked for
 * big height differences: steps that exceed the free-jump budget are
 * intentional and are covered by grapple anchors (that is the point of the
 * game), so the generator does not tie the per-step height delta to
 * MAX_FREE_UP_STEP.
 */
const ROOF_MIN_Y = 0.8
const ROOF_MAX_Y = 24
/**
 * Maximum per-BFS-step roof-height delta. Round 4 doubles this to ~12u up or
 * down: that is ~8x the free-up budget (1.5u), so almost every upward BFS step
 * now rises MORE than a free jump can clear (~1.73u) and is grapple-bridged by
 * design. The large delta lets the realised spread fill the taller
 * ~0.8..~24 band within a few BFS hops.
 */
const ROOF_STEP_DELTA = 12.0

/** Horizontal extents (world units) of a generated world. */
export interface WorldExtents {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

/**
 * Aggregate, read-only result of {@link generateSkylineWorld}. Mirrors the set
 * of module-level constants the static world.ts exports so a generated world is
 * a drop-in replacement.
 */
export interface SkylineWorldData {
  readonly seed: string | number
  readonly buildings: readonly SkylineBuilding[]
  readonly colliders: readonly ParkourPlatform[]
  readonly anchors: readonly GrappleAnchor[]
  readonly checkpoints: readonly Checkpoint[]
  readonly spawn: Vec3
  readonly extents: WorldExtents
  readonly killPlaneY: number
}

export interface GenerateSkylineWorldOptions {
  readonly seed: string | number
  /** Target number of buildings. Clamped to [36, 400]. Default ~96. */
  readonly buildingCount?: number
}

const MIN_BUILDINGS = 36
const MAX_BUILDINGS = 400
const DEFAULT_BUILDINGS = 96

/** Palette reused from the hand-authored look so generated roofs blend in. */
const PALETTE = [
  { color: '#213745', roofColor: '#49626a', accent: '#6be4e7' },
  { color: '#273d48', roofColor: '#526d70', accent: '#f1a55a' },
  { color: '#1d3442', roofColor: '#47636c', accent: '#65e8e9' },
  { color: '#263a43', roofColor: '#5e6d69', accent: '#e8ac5a' },
  { color: '#243642', roofColor: '#53656a', accent: '#ed7c63' },
  { color: '#223a47', roofColor: '#647471', accent: '#75eef0' },
] as const

const SECTORS = ['NÚCLEO', 'SETOR', 'DISTRITO', 'FLANCO', 'RELÉ', 'TERRAÇO'] as const
const NAMES = [
  'Terraço', 'Agulha', 'Pilha', 'Viaduto', 'Torre', 'Pátio',
  'Bloco', 'Crista', 'Doca', 'Corredor', 'Mirante', 'Relé',
] as const

/** Horizontal distance between the closest faces of two AABBs (0 if overlapping). */
function horizontalGap(a: Aabb, b: Aabb): number {
  const dx = Math.max(0, Math.max(a.min.x - b.max.x, b.min.x - a.max.x))
  const dz = Math.max(0, Math.max(a.min.z - b.max.z, b.min.z - a.max.z))
  return Math.hypot(dx, dz)
}

function roofCenter(bounds: Aabb): Vec3 {
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: bounds.max.y,
    z: (bounds.min.z + bounds.max.z) / 2,
  }
}

interface GridCell {
  readonly col: number
  readonly row: number
}

/**
 * Deterministically builds a procedural skyline. See the module header for the
 * reachability guarantee. The layout is a jittered grid; a spanning tree of
 * FREE edges over the grid guarantees a connected free backbone, and over-budget
 * neighbours get a line-of-sight grapple anchor.
 */
export function generateSkylineWorld(options: GenerateSkylineWorldOptions): SkylineWorldData {
  const rng = createRng(options.seed)
  const requested = options.buildingCount ?? DEFAULT_BUILDINGS
  const target = Math.max(MIN_BUILDINGS, Math.min(MAX_BUILDINGS, Math.floor(requested)))

  // Choose grid dimensions whose product is at least `target`, roughly square.
  const cols = Math.max(6, Math.ceil(Math.sqrt(target)))
  const rows = Math.max(6, Math.ceil(target / cols))

  const cellSize = 16 // world units per grid cell (centre-to-centre stride)
  const originX = -((cols - 1) * cellSize) / 2
  const originZ = -((rows - 1) * cellSize) / 2

  // Spawn sits on the grid cell nearest the centre.
  const spawnCol = Math.floor(cols / 2)
  const spawnRow = Math.floor(rows / 2)

  // --- Pass 1: assign a roof height to every cell along a seeded BFS spanning
  // tree rooted at the spawn cell. Round 4 lets each child roof differ from its
  // parent by a LARGE delta (up to ROOF_STEP_DELTA ~= 12u), so almost every
  // upward tree edge exceeds the free budget; those over-budget edges are
  // bridged by two-sided grapple anchors in Pass 3, keeping the spawn-rooted
  // tree connected.
  const heightOf = new Map<string, number>()
  const key = (col: number, row: number): string => `${col},${row}`
  const spawnRoofY = rng.range(1.4, 3.2)
  heightOf.set(key(spawnCol, spawnRow), spawnRoofY)

  // Records the spanning-tree parent of every visited cell (by cell key). Pass 3
  // walks these tree edges to guarantee the spawn-rooted backbone stays crossable
  // (free edge where the step is within budget, grapple edge otherwise).
  const parentOf = new Map<string, string>()

  // BFS order doubles as the build order below: because every cell appears
  // AFTER its tree parent, taking any prefix of this order yields a connected
  // subgraph. That lets us trim to an arbitrary buildingCount without ever
  // orphaning a roof from the spawn-rooted backbone.
  const bfsOrder: GridCell[] = [{ col: spawnCol, row: spawnRow }]
  const queue: GridCell[] = [{ col: spawnCol, row: spawnRow }]
  const visited = new Set<string>([key(spawnCol, spawnRow)])
  while (queue.length > 0) {
    const cell = queue.shift() as GridCell
    const parentY = heightOf.get(key(cell.col, cell.row)) as number
    const neighbours: GridCell[] = [
      { col: cell.col + 1, row: cell.row },
      { col: cell.col - 1, row: cell.row },
      { col: cell.col, row: cell.row + 1 },
      { col: cell.col, row: cell.row - 1 },
    ]
    for (const n of neighbours) {
      if (n.col < 0 || n.col >= cols || n.row < 0 || n.row >= rows) continue
      if (visited.has(key(n.col, n.row))) continue
      visited.add(key(n.col, n.row))
      // Round 4 doubles the per-step height delta so the realised city spreads
      // across the taller ~0.8..~24 band. A child roof is the parent roof +/- up
      // to ROOF_STEP_DELTA (~12u), clamped to [ROOF_MIN_Y, ROOF_MAX_Y]. Because
      // ROOF_STEP_DELTA is ~8x MAX_FREE_UP_STEP (1.5u), almost every upward tree
      // edge now rises MORE than the free jump can clear (~1.73u). That is
      // INTENTIONAL: such over-budget steps are
      // NOT free-jumpable and are bridged by two-sided grapple anchors placed in
      // Pass 3 (tryPlaceAnchor + the spanning-tree pass), which is exactly the
      // grapple-driven traversal the design calls for.
      const delta = rng.range(-ROOF_STEP_DELTA, ROOF_STEP_DELTA)
      const childY = Math.max(ROOF_MIN_Y, Math.min(ROOF_MAX_Y, parentY + delta))
      heightOf.set(key(n.col, n.row), childY)
      parentOf.set(key(n.col, n.row), key(cell.col, cell.row))
      queue.push(n)
      bfsOrder.push(n)
    }
  }

  // --- Pass 2: realise buildings. Footprints are inset from the cell so the
  // horizontal gap to orthogonal neighbours stays within MAX_FREE_HORIZONTAL_GAP
  // for the backbone, while leaving visual variety.
  const freeGap = TRAVERSAL_BUDGET.MAX_FREE_HORIZONTAL_GAP
  const centerJitter = 0.6
  // Footprint half-size chosen so the worst-case face gap between orthogonal
  // neighbours stays within freeGap. Orthogonal neighbours overlap on the
  // perpendicular axis, so the gap is purely along the stride axis:
  //   worstGap = stride + 2*centerJitter - 2*minHalf  <=  freeGap
  // => minHalf >= (stride + 2*centerJitter - freeGap) / 2. Add a safety margin.
  const minHalf = (cellSize + 2 * centerJitter - freeGap) / 2 + 0.25
  const maxHalf = minHalf + 1.2

  const buildings: SkylineBuilding[] = []
  const cellIndex = new Map<string, number>() // cell key -> building index
  let buildingNumber = 0

  // Build the first `target` cells in BFS (spawn-rooted) order so the realised
  // set is always a connected prefix of the free backbone.
  const toBuild = Math.min(target, bfsOrder.length)
  for (let i = 0; i < toBuild; i += 1) {
    const { col, row } = bfsOrder[i]
    const centerX = originX + col * cellSize + rng.range(-centerJitter, centerJitter)
    const centerZ = originZ + row * cellSize + rng.range(-centerJitter, centerJitter)
    const halfX = rng.range(minHalf, maxHalf)
    const halfZ = rng.range(minHalf, maxHalf)
    const roofY = heightOf.get(key(col, row)) as number
    // Buildings extend well below 0 so they read as towers; the base is far
    // below the kill plane we derive later.
    const baseY = -30
    const bounds: Aabb = {
      min: { x: centerX - halfX, y: baseY, z: centerZ - halfZ },
      max: { x: centerX + halfX, y: roofY, z: centerZ + halfZ },
    }
    const palette = rng.pick(PALETTE)
    const sector = rng.pick(SECTORS)
    const name = rng.pick(NAMES)
    buildingNumber += 1
    const isSpawnCell = col === spawnCol && row === spawnRow
    // Near-spawn roofs render at full detail; everything else uses the far
    // batched LOD path. (Mission placement in FEAT-006 may promote more.)
    const nearSpawn = Math.abs(col - spawnCol) <= 2 && Math.abs(row - spawnRow) <= 2
    cellIndex.set(key(col, row), buildings.length)
    buildings.push({
      id: `building-${buildingNumber}`,
      name: `${name} ${String(buildingNumber).padStart(2, '0')}`,
      sector: `${sector} // ${String(buildingNumber).padStart(2, '0')}`,
      bounds,
      wallRunnable: true,
      detail: isSpawnCell || nearSpawn ? 'full' : 'simple',
      color: palette.color,
      roofColor: palette.roofColor,
      accent: palette.accent,
    })
  }

  // --- Pass 3: scatter grapple anchors.
  //
  // buildRoofGraph (worldReachability.ts) only emits a GRAPPLE edge between two
  // roofs when a SINGLE anchor is within GRAPPLE_RANGE of BOTH roof centres AND
  // has line-of-sight to BOTH. With round-4 heights (roofs up to ~24u) two
  // neighbouring roofs can differ by many units, so an anchor merely lifted
  // above the midpoint can be occluded by the taller roof when viewed from the
  // lower one. tryPlaceAnchor therefore validates the TWO-SIDED condition and,
  // if the first candidate fails, deterministically tries progressively higher /
  // nudged candidates (toward the higher roof) and places the first that both
  // roofs can see. The candidate ladder was widened for round 4 to clear the
  // taller silhouettes.
  const obstacleAabbs: readonly Aabb[] = buildings.map((b) => b.bounds)
  const anchors: GrappleAnchor[] = []
  let anchorNumber = 0
  const anchorAt = new Set<string>()

  // Mirrors buildRoofGraph's grapple-edge test EXACTLY so an anchor that passes
  // here is guaranteed to create a real grapple edge. buildRoofGraph, when
  // testing the sight line from a roof to an anchor, excludes ONLY that roof's
  // own collider (so its face cannot occlude the rope) and keeps every other
  // building, INCLUDING the opposite endpoint. We replicate that per-side here:
  // the A->anchor line excludes only A, the B->anchor line excludes only B.
  const twoSidedReaches = (anchorPos: Vec3, aIdx: number, bIdx: number): boolean => {
    const a = roofCenter(buildings[aIdx].bounds)
    const b = roofCenter(buildings[bIdx].bounds)
    const dA = Math.hypot(anchorPos.x - a.x, anchorPos.y - a.y, anchorPos.z - a.z)
    if (dA > TRAVERSAL_BUDGET.GRAPPLE_RANGE) return false
    const dB = Math.hypot(anchorPos.x - b.x, anchorPos.y - b.y, anchorPos.z - b.z)
    if (dB > TRAVERSAL_BUDGET.GRAPPLE_RANGE) return false
    const obstaclesFromA = obstacleAabbs.filter((_, i) => i !== aIdx)
    if (!hasLineOfSight(a, anchorPos, obstaclesFromA)) return false
    const obstaclesFromB = obstacleAabbs.filter((_, i) => i !== bIdx)
    if (!hasLineOfSight(b, anchorPos, obstaclesFromB)) return false
    return true
  }

  // Emits a two-sided bridging anchor for the roof pair (fromIdx, toIdx) when
  // one can be placed; returns true if an anchor now bridges the pair (either
  // freshly placed or already present). Deterministic: every candidate consumes
  // rng in a fixed order regardless of which one succeeds.
  const tryPlaceAnchor = (fromIdx: number, toIdx: number): boolean => {
    const pairKey = fromIdx < toIdx ? `${fromIdx}:${toIdx}` : `${toIdx}:${fromIdx}`
    if (anchorAt.has(pairKey)) return true
    const from = buildings[fromIdx]
    const to = buildings[toIdx]
    const a = roofCenter(from.bounds)
    const b = roofCenter(to.bounds)
    const mid: Vec3 = { x: (a.x + b.x) / 2, y: 0, z: (a.z + b.z) / 2 }
    // Bias the horizontal position toward the higher roof so a tall neighbour
    // cannot occlude the sight line from the lower roof.
    const higher = a.y >= b.y ? a : b
    const maxRoofY = Math.max(a.y, b.y)
    // Fixed candidate ladder: increasing lift above the taller roof, each with a
    // small deterministic jitter and an increasing bias toward the higher roof.
    // A high anchor directly above (or just past) the taller roof is visible to
    // both roof centres once it clears the tall roof's silhouette. Round 4
    // doubled the roof band (roofs up to ~24u), so a tall neighbour can occlude
    // a much lower roof: the ladder is widened to 12 candidates with larger lift
    // increments and a stronger bias progression toward the higher roof so a
    // clearing position is found even for large vertical separations (still
    // within GRAPPLE_RANGE=52). Every candidate consumes exactly one rng draw in
    // a fixed order, so determinism holds regardless of which candidate wins.
    const ANCHOR_CANDIDATES = 12
    for (let step = 0; step < ANCHOR_CANDIDATES; step += 1) {
      // Denser low/mid lifts (which stay within GRAPPLE_RANGE from a low roof)
      // plus a few higher reaches for tall-neighbour occlusion. Increment ~2.2u
      // keeps the useful candidates inside the 52u range from both roof centres.
      const lift = maxRoofY + 2.6 + step * 2.2
      const bias = Math.min(0.6, step * 0.06) // 0 -> midpoint, growing toward the higher roof
      const jitter = rng.range(-0.4, 0.4)
      const anchorPos: Vec3 = {
        x: mid.x + (higher.x - mid.x) * bias + jitter,
        y: lift,
        z: mid.z + (higher.z - mid.z) * bias + jitter,
      }
      if (twoSidedReaches(anchorPos, fromIdx, toIdx)) {
        anchorNumber += 1
        anchorAt.add(pairKey)
        anchors.push({ id: `anchor-${anchorNumber}`, position: anchorPos })
        return true
      }
    }
    return false
  }

  // Orthogonal-neighbour pass: cover every over-budget lateral pair and sprinkle
  // extra anchors elsewhere so grapple balls are scattered across the whole map.
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const idx = cellIndex.get(key(col, row))
      if (idx === undefined) continue
      const rightIdx = cellIndex.get(key(col + 1, row))
      const downIdx = cellIndex.get(key(col, row + 1))
      for (const nIdx of [rightIdx, downIdx]) {
        if (nIdx === undefined) continue
        const from = buildings[idx]
        const to = buildings[nIdx]
        const gap = horizontalGap(from.bounds, to.bounds)
        const rise = Math.abs(from.bounds.max.y - to.bounds.max.y)
        const overBudget = gap > freeGap || rise > TRAVERSAL_BUDGET.MAX_FREE_UP_STEP
        if (overBudget || rng.next() < 0.18) {
          tryPlaceAnchor(idx, nIdx)
        }
      }
    }
  }

  // Spanning-tree backbone pass: walk the BFS tree edges recorded in Pass 1 and,
  // for any tree edge that is over the free budget, guarantee a two-sided
  // grapple anchor bridges it. Because the realised buildings are a prefix of
  // the BFS order rooted at spawn, covering every in-prefix tree edge keeps the
  // spawn-rooted tree connected through free-or-grapple edges alone.
  for (let i = 1; i < toBuild; i += 1) {
    const { col, row } = bfsOrder[i]
    const childIdx = cellIndex.get(key(col, row))
    const parentKey = parentOf.get(key(col, row))
    if (childIdx === undefined || parentKey === undefined) continue
    const parentIdx = cellIndex.get(parentKey)
    if (parentIdx === undefined) continue
    const gap = horizontalGap(buildings[parentIdx].bounds, buildings[childIdx].bounds)
    const rise = Math.abs(buildings[parentIdx].bounds.max.y - buildings[childIdx].bounds.max.y)
    if (gap > freeGap || rise > TRAVERSAL_BUDGET.MAX_FREE_UP_STEP) {
      tryPlaceAnchor(parentIdx, childIdx)
    }
  }

  // Connect-the-components post-pass: prove spawn reaches every realised roof
  // under the SAME free+grapple rules worldReachability uses. If any roof is
  // still unreachable (e.g. a tree edge whose two-sided anchor could not be
  // placed), bridge it deterministically to an already-reachable in-range roof
  // with a two-sided anchor. This terminates: each outer iteration either grows
  // the reachable set by >=1 or exhausts candidates and stops.
  const spawnIdxForReach = cellIndex.get(key(spawnCol, spawnRow)) as number
  const reachFreeOrGrapple = (): Set<number> => {
    const seen = new Set<number>([spawnIdxForReach])
    const stack = [spawnIdxForReach]
    while (stack.length > 0) {
      const cur = stack.pop() as number
      for (let other = 0; other < buildings.length; other += 1) {
        if (seen.has(other)) continue
        const from = buildings[cur].bounds
        const to = buildings[other].bounds
        // FREE edge (directional, matches isFreeTraversable).
        const gap = horizontalGap(from, to)
        const riseUp = to.max.y - from.max.y
        const free =
          gap <= freeGap &&
          riseUp <= TRAVERSAL_BUDGET.MAX_FREE_UP_STEP &&
          -riseUp <= TRAVERSAL_BUDGET.MAX_FREE_DOWN_STEP
        let connected = free
        if (!connected) {
          // GRAPPLE edge: some placed anchor passes the SAME two-sided test
          // buildRoofGraph applies (per-side obstacle exclusion), so this
          // internal reachability never over-reports relative to the runtime
          // graph.
          for (const anchor of anchors) {
            if (twoSidedReaches(anchor.position, cur, other)) {
              connected = true
              break
            }
          }
        }
        if (connected) {
          seen.add(other)
          stack.push(other)
        }
      }
    }
    return seen
  }

  // Bounded outer loop: at most one pass per building (strictly monotone growth
  // of the reachable set, or an early exit when no bridge can be placed).
  for (let guard = 0; guard < buildings.length; guard += 1) {
    const reachable = reachFreeOrGrapple()
    if (reachable.size === buildings.length) break
    let placedAny = false
    for (let other = 0; other < buildings.length; other += 1) {
      if (reachable.has(other)) continue
      // Place a two-sided bridging anchor between this orphan and an
      // already-reachable roof within GRAPPLE_RANGE. Round 4's taller roofs make
      // a single candidate more likely to be occluded, so we try EVERY in-range
      // reachable roof, ordered nearest-first (ties broken by index), until one
      // accepts a two-sided anchor. Ordering by distance is a pure function of
      // the roof geometry (same seed => same order), so determinism holds.
      const otherCenter = roofCenter(buildings[other].bounds)
      let bridged = false
      const candidates: Array<{ idx: number; d: number }> = []
      for (const r of reachable) {
        const rCenter = roofCenter(buildings[r].bounds)
        const d = Math.hypot(
          rCenter.x - otherCenter.x,
          rCenter.y - otherCenter.y,
          rCenter.z - otherCenter.z,
        )
        if (d > TRAVERSAL_BUDGET.GRAPPLE_RANGE) continue
        candidates.push({ idx: r, d })
      }
      candidates.sort((p, q) => (p.d !== q.d ? p.d - q.d : p.idx - q.idx))
      for (const candidate of candidates) {
        if (tryPlaceAnchor(candidate.idx, other)) {
          bridged = true
          placedAny = true
          break
        }
      }
      if (bridged) break // recompute reachability before handling the next orphan
    }
    if (!placedAny) break // no further bridge possible; stop deterministically
  }

  // --- Derive spawn, extents, kill plane, colliders, checkpoints.
  const spawnIdx = cellIndex.get(key(spawnCol, spawnRow)) as number
  const spawnBuilding = buildings[spawnIdx]
  const spawnRoof = roofCenter(spawnBuilding.bounds)
  const spawn: Vec3 = { x: spawnRoof.x, y: spawnRoof.y + 1.1, z: spawnRoof.z }

  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  let lowestRoof = Infinity
  for (const b of buildings) {
    minX = Math.min(minX, b.bounds.min.x)
    maxX = Math.max(maxX, b.bounds.max.x)
    minZ = Math.min(minZ, b.bounds.min.z)
    maxZ = Math.max(maxZ, b.bounds.max.z)
    lowestRoof = Math.min(lowestRoof, b.bounds.max.y)
  }
  const pad = 12
  const extents: WorldExtents = {
    minX: minX - pad,
    maxX: maxX + pad,
    minZ: minZ - pad,
    maxZ: maxZ + pad,
  }
  // Kill plane sits safely below the lowest roof so a fall is fatal but the
  // roof graph itself is above it.
  const killPlaneY = lowestRoof - 12

  const colliders: readonly ParkourPlatform[] = buildings

  // A light spine of checkpoints along a straight column through the spawn so
  // respawn logic (and FEAT-006 missions) have ordered anchors to attach to.
  const checkpoints: Checkpoint[] = []
  let cpOrder = 0
  for (let row = 0; row < rows; row += 2) {
    const idx = cellIndex.get(key(spawnCol, row))
    if (idx === undefined) continue
    const b = buildings[idx]
    const center = roofCenter(b.bounds)
    checkpoints.push({
      id: `cp-${cpOrder}`,
      order: cpOrder,
      trigger: {
        min: { x: b.bounds.min.x, y: center.y - 0.4, z: b.bounds.min.z },
        max: { x: b.bounds.max.x, y: center.y + 3, z: b.bounds.max.z },
      },
      spawn: { x: center.x, y: center.y + 1.1, z: center.z },
    })
    cpOrder += 1
  }

  return {
    seed: options.seed,
    buildings,
    colliders,
    anchors,
    checkpoints,
    spawn,
    extents,
    killPlaneY,
  }
}
