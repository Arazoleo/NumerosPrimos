/**
 * Active-world snapshot for Skyline Runner (Round 2, FEAT-007).
 *
 * The game now has TWO play spaces: the hand-authored STATIC TUTORIAL and a
 * seeded PROCEDURAL WORLD the player is teleported into when the tutorial
 * completes. Both the physics loop (SkylineRunnerExperience.tsx) and the R3F
 * renderer (SkylineWorld.tsx) read their world data (buildings / colliders /
 * grapple anchors / checkpoints / spawn / bounds / kill plane) and their mission
 * content (prime cores / sentinels / NPCs / apex locations / activatable
 * contracts) from module-level constants in world.ts and missionData.ts.
 *
 * Rather than thread an "active world" argument through every free function and
 * component, this module holds a single snapshot that resolves to EITHER the
 * static constants (tutorial mode) or a generated world (world mode). The
 * tutorial snapshot reuses the EXACT same constant references, so tutorial-mode
 * behaviour is byte-identical to Round 1.
 *
 * The store (skylineRunnerStore.ts) owns the canonical `mode` / `activeWorld`
 * and drives this module: enterWorld() installs a generated snapshot,
 * reset()/initialisation restores the static snapshot. The snapshot is a plain
 * value so the React layer can select it from the store, while the physics free
 * functions (which run outside React) read the live module pointer.
 *
 * PURE data only: no React / three / @react-three imports.
 */
import {
  SKYLINE_LOCATIONS,
  SKYLINE_NPCS,
  SKYLINE_PRIME_CORES,
  SKYLINE_SENTINELS,
  createSkylineMissionsForWorld,
  type SkylineMissionContract,
  type SkylineMissionId,
  type SkylineNpc,
  type SkylineNpcId,
  type SkylinePosition3D,
  type SkylinePrimeCore,
  type SkylinePrimeCoreValue,
  type SkylineSentinel,
  type SkylineSentinelId,
  type SkylineWorldMissionPlacement,
} from './missionData'
import type { Checkpoint, GrappleAnchor, ParkourPlatform, Vec3 } from './types'
import {
  PLAYER_SPAWN,
  ROOFTOP_PROPS,
  SKYLINE_ANCHORS,
  SKYLINE_BUILDINGS,
  SKYLINE_CHECKPOINTS,
  SKYLINE_COLLIDERS,
  SKYLINE_WORLD_BOUNDS,
  type RooftopProp,
  type SkylineBuilding,
} from './world'
import type { SkylineWorldData } from './worldGen'
import type { SkylineWorldMissions } from './worldMissions'

/** Horizontal play-area extents, shared shape between static and generated. */
export interface ActiveWorldExtents {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

/** The two interaction radii the gameplay loop needs, carried per world. */
export interface ActiveWorldRadii {
  readonly npcInteractionRadius: number
  readonly coreCollectionRadius: number
}

/**
 * Everything the physics loop and renderer need to run a play space. The
 * tutorial snapshot points at the static constants; the world snapshot points
 * at generated data plus re-anchored mission content.
 */
export interface ActiveWorldSnapshot {
  readonly mode: 'tutorial' | 'world'
  readonly seed: string | number | null
  // --- Geometry / traversal ---
  readonly buildings: readonly SkylineBuilding[]
  readonly colliders: readonly ParkourPlatform[]
  readonly anchors: readonly GrappleAnchor[]
  readonly checkpoints: readonly Checkpoint[]
  /** Rooftop props to render; empty in the generated world. */
  readonly props: readonly RooftopProp[]
  readonly spawn: Vec3
  readonly extents: ActiveWorldExtents
  readonly killPlaneY: number
  readonly radii: ActiveWorldRadii
  // --- Mission content (same shapes as the static constants) ---
  readonly primeCores: Readonly<Record<SkylinePrimeCoreValue, SkylinePrimeCore>>
  readonly sentinels: Readonly<Record<SkylineSentinelId, SkylineSentinel>>
  readonly npcs: Readonly<Record<SkylineNpcId, SkylineNpc>>
  readonly locations: {
    readonly runnerSpawn: SkylinePosition3D
    readonly apexSpire: SkylinePosition3D
    readonly apexBeacon: SkylinePosition3D
  }
  /**
   * Activatable contracts the gameplay loop scans for pickup. The LIA tutorial
   * contract is intentionally OMITTED from the world snapshot so entering the
   * world leaves the three playable contracts (prime-cores, composite-sentinels,
   * apex-extraction) activatable from their generated anchors.
   */
  readonly contracts: ReadonlyArray<SkylineMissionContract>
}

const STATIC_RADII: ActiveWorldRadii = {
  npcInteractionRadius: SKYLINE_WORLD_BOUNDS.npcInteractionRadius,
  coreCollectionRadius: SKYLINE_WORLD_BOUNDS.coreCollectionRadius,
}

/**
 * The static tutorial snapshot. Reuses the exact constant references from
 * world.ts / missionData.ts so tutorial-mode physics and rendering are
 * byte-identical to Round 1.
 */
export const TUTORIAL_WORLD_SNAPSHOT: ActiveWorldSnapshot = {
  mode: 'tutorial',
  seed: null,
  buildings: SKYLINE_BUILDINGS,
  colliders: SKYLINE_COLLIDERS,
  anchors: SKYLINE_ANCHORS,
  checkpoints: SKYLINE_CHECKPOINTS,
  props: ROOFTOP_PROPS,
  spawn: PLAYER_SPAWN,
  extents: SKYLINE_WORLD_BOUNDS.extents,
  killPlaneY: SKYLINE_WORLD_BOUNDS.killPlaneY,
  radii: STATIC_RADII,
  primeCores: SKYLINE_PRIME_CORES,
  sentinels: SKYLINE_SENTINELS,
  npcs: SKYLINE_NPCS,
  locations: SKYLINE_LOCATIONS,
  // The tutorial has NPC-anchored contracts plus the beacon finale; the
  // activation scan in the Experience already filters on autoActivate, so we
  // feed it the non-tutorial contracts from the static registry via the
  // existing SKYLINE_MISSIONS import there. For symmetry the snapshot exposes
  // no extra contracts in tutorial mode (the Experience keeps its static scan).
  contracts: [],
}

/** Generated-world interaction radii. Slightly wider so the larger, more
 * spread-out procedural city still lets the player pick contracts up reliably. */
const WORLD_RADII: ActiveWorldRadii = {
  npcInteractionRadius: 3.2,
  coreCollectionRadius: 1.8,
}

/**
 * Builds a world-mode snapshot from a generated {@link SkylineWorldData} and its
 * seeded {@link SkylineWorldMissions} placement. Mission content is produced by
 * the pure {@link createSkylineMissionsForWorld} factory, so every label, clue,
 * prime factor, composite number and objective id is reused from the static
 * data; only positions move onto generated rooftops.
 */
export function buildWorldSnapshot(
  world: SkylineWorldData,
  placement: SkylineWorldMissions,
): ActiveWorldSnapshot {
  const factoryPlacement: SkylineWorldMissionPlacement = {
    cores: placement.cores,
    sentinels: placement.sentinels,
    apexSpire: placement.apexSpire,
    apexBeacon: placement.apexBeacon,
    activation: placement.activation,
  }
  const content = createSkylineMissionsForWorld(factoryPlacement)

  // Re-anchor the two NPCs onto REACHABLE generated roofs so the LIA tutorial
  // contract and the cores->NILO delivery stay physically completable in the
  // larger procedural city (LIA at the spawn landing, NILO on the prime-cores
  // activation roof). Labels / roles / dialogue are reused from the static NPCs.
  const liaPosition: SkylinePosition3D = [world.spawn.x, world.spawn.y, world.spawn.z]
  const niloPosition: SkylinePosition3D = placement.activation.primeCores.position
  const npcs: Record<SkylineNpcId, SkylineNpc> = {
    lia: { ...SKYLINE_NPCS.lia, position: liaPosition },
    nilo: { ...SKYLINE_NPCS.nilo, position: niloPosition },
  }

  // Only the three playable world contracts are re-anchored; prime-cores / apex
  // objectives read positions from `content`.
  const contracts: SkylineMissionContract[] = [
    content.missions['prime-cores'],
    content.missions['composite-sentinels'],
    content.missions['apex-extraction'],
  ]

  return {
    mode: 'world',
    seed: world.seed,
    buildings: world.buildings,
    colliders: world.colliders,
    anchors: world.anchors,
    checkpoints: world.checkpoints,
    props: [],
    spawn: world.spawn,
    extents: world.extents,
    killPlaneY: world.killPlaneY,
    radii: WORLD_RADII,
    primeCores: content.primeCores,
    sentinels: content.sentinels,
    npcs,
    locations: content.locations,
    contracts,
  }
}

/**
 * Live module pointer the physics free functions (which run outside React) read
 * each frame. React code should prefer selecting the snapshot from the store,
 * but the two pointers are always kept in sync by the store actions.
 */
let currentSnapshot: ActiveWorldSnapshot = TUTORIAL_WORLD_SNAPSHOT

/** The snapshot the gameplay loop is currently simulating. */
export function getActiveWorldSnapshot(): ActiveWorldSnapshot {
  return currentSnapshot
}

/** Installs a snapshot (called by the store on enterWorld). */
export function setActiveWorldSnapshot(snapshot: ActiveWorldSnapshot): void {
  currentSnapshot = snapshot
}

/** Restores the static tutorial snapshot (called by the store on reset/init). */
export function resetActiveWorldSnapshot(): void {
  currentSnapshot = TUTORIAL_WORLD_SNAPSHOT
}

/** The non-auto-activating contracts to scan in the CURRENT mode. */
export type { SkylineMissionContract, SkylineMissionId }
