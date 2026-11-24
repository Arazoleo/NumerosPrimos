import type { Aabb, Checkpoint, GrappleAnchor, ParkourPlatform, Vec3 } from './types'

export interface SkylineBuilding extends ParkourPlatform {
  readonly name: string
  readonly color: string
  readonly roofColor: string
  readonly accent: string
  readonly sector: string
  /**
   * Rendering hint for the distance-LOD layer in SkylineWorld.tsx. Does not
   * affect physics. 'full' keeps the detailed facade/trim/props visual even at
   * range (used for mission-critical landmarks); 'simple' allows the far batched
   * instanced path to take over. Defaults to 'simple' when omitted.
   */
  readonly detail?: 'full' | 'simple'
}

export interface RooftopProp {
  readonly id: string
  readonly kind: 'vent' | 'barrier' | 'crate' | 'solar' | 'antenna'
  readonly position: readonly [number, number, number]
  readonly size: readonly [number, number, number]
  readonly rotationY?: number
  readonly collider?: Aabb
}

function bounds(
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): Aabb {
  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } }
}

export const SKYLINE_BUILDINGS: readonly SkylineBuilding[] = [
  // --- Mission-critical landmarks (ids + bounds preserved; always full detail) ---
  {
    id: 'relay-base', name: 'Terminal Aurora', sector: 'BASE // AURORA',
    bounds: bounds(-8, -29, 8, 8, 0, 23), wallRunnable: true, detail: 'full',
    color: '#213745', roofColor: '#49626a', accent: '#6be4e7',
  },
  {
    id: 'binary-terrace', name: 'Terraço Binário', sector: 'SETOR // 02',
    bounds: bounds(0, -28, -1, 9, 1.6, 6.2), wallRunnable: true, detail: 'full',
    color: '#273d48', roofColor: '#526d70', accent: '#f1a55a',
  },
  {
    id: 'triad-fanway', name: 'Corredor Tríade', sector: 'SETOR // 03',
    bounds: bounds(-8.2, -27, -13.3, 1.2, 3.8, -5), wallRunnable: true, detail: 'full',
    color: '#1d3442', roofColor: '#47636c', accent: '#65e8e9',
  },
  {
    id: 'nilo-relay', name: 'Torre de Nilo', sector: 'RELAY // 05',
    bounds: bounds(-6.4, -26, -32, 7, 6.1, -17), wallRunnable: true, detail: 'full',
    color: '#263a43', roofColor: '#5e6d69', accent: '#e8ac5a',
  },
  {
    id: 'sentinel-four-roof', name: 'Pátio Quatro', sector: 'QUARENTENA // 04',
    bounds: bounds(-8.2, -25, -41.5, 1, 6.1, -33), wallRunnable: true, detail: 'full',
    color: '#243642', roofColor: '#53656a', accent: '#ed7c63',
  },
  {
    id: 'sentinel-six-roof', name: 'Pátio Seis', sector: 'QUARENTENA // 06',
    bounds: bounds(0, -24, -49.2, 9, 7.6, -40.8), wallRunnable: true, detail: 'full',
    color: '#263846', roofColor: '#586c70', accent: '#ed7c63',
  },
  {
    id: 'sentinel-nine-roof', name: 'Pátio Nove', sector: 'QUARENTENA // 09',
    bounds: bounds(-8.2, -23, -57.3, 1, 9.2, -48.8), wallRunnable: true, detail: 'full',
    color: '#233641', roofColor: '#51686b', accent: '#ed7c63',
  },
  {
    id: 'sentinel-ten-roof', name: 'Pátio Dez', sector: 'QUARENTENA // 10',
    bounds: bounds(0, -22, -65.2, 9, 10.7, -56.8), wallRunnable: true, detail: 'full',
    color: '#273a46', roofColor: '#5c6f70', accent: '#ed7c63',
  },
  {
    id: 'apex-spire', name: 'Agulha Apex', sector: 'APEX // FAROL',
    bounds: bounds(-6.2, -20, -79, 6.2, 12.1, -66), wallRunnable: true, detail: 'full',
    color: '#223a47', roofColor: '#647471', accent: '#75eef0',
  },

  // --- Open-world city grid (new playable buildings around the spawn) ---
  // The mission corridor runs along -z; these entries open the map in every
  // direction (+x east, -x west, +z south behind spawn, and wide -z flanks) so
  // the player can pick a route instead of a single rooftop line. Heights vary
  // to keep wall-run / grapple / mantle traversal interesting.

  // East district (+x), stepping down the corridor.
  {
    id: 'east-market-01', name: 'Mercado Leste', sector: 'LESTE // 01',
    bounds: bounds(12, -30, 4, 24, 2.4, 18), wallRunnable: true,
    color: '#223a44', roofColor: '#4d666c', accent: '#6be4e7',
  },
  {
    id: 'east-spire-02', name: 'Agulha Leste', sector: 'LESTE // 02',
    bounds: bounds(14, -32, -12, 23, 8.5, -2), wallRunnable: true,
    color: '#1f3742', roofColor: '#4a636a', accent: '#65e8e9',
  },
  {
    id: 'east-stack-03', name: 'Pilha Leste', sector: 'LESTE // 03',
    bounds: bounds(12.5, -30, -28, 22.5, 5.2, -16), wallRunnable: true,
    color: '#273d48', roofColor: '#53696d', accent: '#f1a55a',
  },
  {
    id: 'east-span-04', name: 'Viaduto Leste', sector: 'LESTE // 04',
    bounds: bounds(13, -28, -46, 24.5, 9.8, -32), wallRunnable: true,
    color: '#243744', roofColor: '#4f666a', accent: '#6be4e7',
  },
  {
    id: 'east-tower-05', name: 'Torre Leste', sector: 'LESTE // 05',
    bounds: bounds(12.5, -26, -64, 22, 13.4, -48), wallRunnable: true,
    color: '#223a47', roofColor: '#5a6f72', accent: '#75eef0',
  },

  // West district (-x).
  {
    id: 'west-gate-01', name: 'Portão Oeste', sector: 'OESTE // 01',
    bounds: bounds(-24, -30, 2, -12, 3.1, 17), wallRunnable: true,
    color: '#213845', roofColor: '#4c656b', accent: '#e8ac5a',
  },
  {
    id: 'west-loft-02', name: 'Sótão Oeste', sector: 'OESTE // 02',
    bounds: bounds(-23, -31, -14, -13, 6.6, -1), wallRunnable: true,
    color: '#1d3442', roofColor: '#47636c', accent: '#65e8e9',
  },
  {
    id: 'west-stack-03', name: 'Pilha Oeste', sector: 'OESTE // 03',
    bounds: bounds(-24.5, -30, -30, -12.5, 4.4, -17), wallRunnable: true,
    color: '#263a43', roofColor: '#536a6c', accent: '#f1a55a',
  },
  {
    id: 'west-span-04', name: 'Viaduto Oeste', sector: 'OESTE // 04',
    bounds: bounds(-24, -28, -48, -13, 10.6, -33), wallRunnable: true,
    color: '#243642', roofColor: '#53656a', accent: '#6be4e7',
  },
  {
    id: 'west-tower-05', name: 'Torre Oeste', sector: 'OESTE // 05',
    bounds: bounds(-23.5, -26, -66, -12, 14.2, -50), wallRunnable: true,
    color: '#223a47', roofColor: '#5a6f72', accent: '#75eef0',
  },

  // South district (+z, behind the spawn) — lets the player turn around.
  {
    id: 'south-dock-01', name: 'Doca Sul', sector: 'SUL // 01',
    bounds: bounds(-9, -30, 28, 3, 2.2, 40), wallRunnable: true,
    color: '#273d48', roofColor: '#52696d', accent: '#f1a55a',
  },
  {
    id: 'south-ridge-02', name: 'Crista Sul', sector: 'SUL // 02',
    bounds: bounds(6, -31, 27, 18, 5.6, 39), wallRunnable: true,
    color: '#1f3742', roofColor: '#4a636a', accent: '#65e8e9',
  },
  {
    id: 'south-block-03', name: 'Bloco Sul', sector: 'SUL // 03',
    bounds: bounds(-22, -30, 26, -11, 4.0, 38), wallRunnable: true,
    color: '#213845', roofColor: '#4c656b', accent: '#e8ac5a',
  },
  {
    id: 'south-spire-04', name: 'Agulha Sul', sector: 'SUL // 04',
    bounds: bounds(-6, -32, 44, 6, 9.1, 56), wallRunnable: true,
    color: '#223a47', roofColor: '#5a6f72', accent: '#75eef0',
  },

  // Far-west flank along the corridor and apex approach (wide -z, low detail).
  {
    id: 'flank-west-06', name: 'Flanco Oeste', sector: 'FLANCO // 06',
    bounds: bounds(-35, -26, -46, -26, 7.4, -30), wallRunnable: true,
    color: '#1d3442', roofColor: '#47636c', accent: '#65e8e9',
  },
  {
    id: 'flank-west-07', name: 'Flanco Oeste', sector: 'FLANCO // 07',
    bounds: bounds(-34, -24, -70, -26, 11.5, -52), wallRunnable: true,
    color: '#263a43', roofColor: '#536a6c', accent: '#6be4e7',
  },
  // Far-east flank.
  {
    id: 'flank-east-06', name: 'Flanco Leste', sector: 'FLANCO // 06',
    bounds: bounds(26, -26, -48, 35, 7.0, -32), wallRunnable: true,
    color: '#243744', roofColor: '#4f666a', accent: '#f1a55a',
  },
  {
    id: 'flank-east-07', name: 'Flanco Leste', sector: 'FLANCO // 07',
    bounds: bounds(26, -24, -72, 34, 12.0, -54), wallRunnable: true,
    color: '#223a47', roofColor: '#5a6f72', accent: '#75eef0',
  },

  // Deep-north skyline past the Apex (-z), framing the far horizon as real roofs.
  {
    id: 'north-ward-08', name: 'Distrito Norte', sector: 'NORTE // 08',
    bounds: bounds(-20, -22, -98, -8, 15.5, -82), wallRunnable: true,
    color: '#1f3742', roofColor: '#4a636a', accent: '#65e8e9',
  },
  {
    id: 'north-ward-09', name: 'Distrito Norte', sector: 'NORTE // 09',
    bounds: bounds(8, -22, -98, 20, 16.8, -82), wallRunnable: true,
    color: '#223a47', roofColor: '#5a6f72', accent: '#75eef0',
  },
  {
    id: 'north-ward-10', name: 'Distrito Norte', sector: 'NORTE // 10',
    bounds: bounds(-7, -21, -112, 7, 18.2, -98), wallRunnable: true,
    color: '#263a43', roofColor: '#536a6c', accent: '#6be4e7',
  },
] as const

export const ROOFTOP_PROPS: readonly RooftopProp[] = [
  { id: 'start-vent-a', kind: 'vent', position: [4.8, .55, 14.5], size: [2.4, 1.1, 1.7], collider: bounds(3.6, 0, 13.65, 6, 1.1, 15.35) },
  { id: 'start-barrier', kind: 'barrier', position: [-4.5, .8, 9.8], size: [4.5, 1.6, .35], rotationY: -.08, collider: bounds(-6.75, 0, 9.55, -2.25, 1.6, 10.05) },
  { id: 'binary-crate', kind: 'crate', position: [1.1, 2.1, 4.7], size: [1.5, 1, 1.5], collider: bounds(.35, 1.6, 3.95, 1.85, 2.6, 5.45) },
  { id: 'triad-fans', kind: 'vent', position: [-5.3, 4.45, -10.5], size: [2.7, 1.3, 2.2], collider: bounds(-6.65, 3.8, -11.6, -3.95, 5.1, -9.4) },
  { id: 'relay-solar-a', kind: 'solar', position: [3.2, 6.8, -25.2], size: [3.2, .18, 2.1], rotationY: .28, collider: bounds(1.5, 6.1, -26.4, 4.9, 7.15, -24) },
  { id: 'relay-solar-b', kind: 'solar', position: [3.8, 6.8, -29], size: [3.2, .18, 2.1], rotationY: .28, collider: bounds(2.1, 6.1, -30.2, 5.5, 7.15, -27.8) },
  { id: 'four-cover', kind: 'barrier', position: [-1.8, 6.85, -36.2], size: [3.6, 1.5, .35], collider: bounds(-3.6, 6.1, -36.4, 0, 7.6, -36) },
  { id: 'six-cover', kind: 'crate', position: [6.5, 8.25, -46.6], size: [1.6, 1.3, 1.6], collider: bounds(5.7, 7.6, -47.4, 7.3, 8.9, -45.8) },
  { id: 'nine-vent', kind: 'vent', position: [-6, 9.85, -51.4], size: [2.5, 1.3, 1.7], collider: bounds(-7.25, 9.2, -52.25, -4.75, 10.5, -50.55) },
  { id: 'ten-barrier', kind: 'barrier', position: [2.1, 11.45, -60.8], size: [3.3, 1.5, .3], collider: bounds(.45, 10.7, -61, 3.75, 12.2, -60.6) },
  { id: 'apex-antenna', kind: 'antenna', position: [0, 16, -74.6], size: [.45, 7.8, .45], collider: bounds(-.3, 12.1, -74.9, .3, 19.9, -74.3) },
] as const

export const SKYLINE_COLLIDERS: readonly ParkourPlatform[] = [
  ...SKYLINE_BUILDINGS,
  ...ROOFTOP_PROPS.flatMap((prop) => prop.collider ? [{ id: prop.id, bounds: prop.collider, wallRunnable: false }] : []),
]

export const SKYLINE_ANCHORS: readonly GrappleAnchor[] = [
  { id: 'anchor-binary', position: { x: 4.6, y: 6.8, z: .6 } },
  { id: 'anchor-triad', position: { x: -4.8, y: 10.5, z: -8.1 } },
  { id: 'anchor-relay', position: { x: 3.6, y: 13.6, z: -19.5 } },
  { id: 'anchor-four', position: { x: -5.8, y: 14.8, z: -36.4 } },
  { id: 'anchor-six', position: { x: 6.9, y: 16.1, z: -44.8 } },
  { id: 'anchor-nine', position: { x: -5.9, y: 17.6, z: -52.8 } },
  { id: 'anchor-ten', position: { x: 6.1, y: 19.2, z: -60.5 } },
  { id: 'anchor-apex', position: { x: 0, y: 25, z: -71.5 } },
] as const

export const SKYLINE_CHECKPOINTS: readonly Checkpoint[] = [
  { id: 'base', order: 0, trigger: bounds(-8, .3, 8, 8, 3, 23), spawn: { x: 0, y: 1.1, z: 16 } },
  { id: 'triad', order: 1, trigger: bounds(-8, 4, -13, 1, 7, -5), spawn: { x: -2.5, y: 4.9, z: -7 } },
  { id: 'relay', order: 2, trigger: bounds(-6, 6.3, -32, 7, 9, -17), spawn: { x: 0, y: 7.2, z: -22 } },
  { id: 'combat', order: 3, trigger: bounds(-8, 6.3, -42, 1, 9, -33), spawn: { x: -5.5, y: 7.2, z: -34.5 } },
  { id: 'upper', order: 4, trigger: bounds(-8, 9.4, -58, 1, 12, -49), spawn: { x: -4, y: 10.3, z: -50 } },
  { id: 'apex', order: 5, trigger: bounds(-6, 12.2, -79, 6, 15, -66), spawn: { x: 0, y: 13.2, z: -68 } },
] as const

export const PLAYER_SPAWN: Vec3 = { x: 0, y: 1.1, z: 16 }

export const SKYLINE_WORLD_BOUNDS = {
  killPlaneY: -18,
  finishRadius: 2.3,
  npcInteractionRadius: 3,
  coreCollectionRadius: 1.55,
  attackRange: 4.5,
  /**
   * Horizontal extents of the hand-authored city grid, in world units. Widened
   * from the original -z corridor so the open grid in world.ts stays inside a
   * known play area (used by rendering/LOD and any future soft boundary). Kept
   * well outside the outermost building bounds on every axis.
   */
  extents: {
    minX: -38,
    maxX: 38,
    minZ: -116,
    maxZ: 60,
  },
} as const

export function aabbCenter(aabb: Aabb): readonly [number, number, number] {
  return [
    (aabb.min.x + aabb.max.x) / 2,
    (aabb.min.y + aabb.max.y) / 2,
    (aabb.min.z + aabb.max.z) / 2,
  ]
}

export function aabbSize(aabb: Aabb): readonly [number, number, number] {
  return [
    aabb.max.x - aabb.min.x,
    aabb.max.y - aabb.min.y,
    aabb.max.z - aabb.min.z,
  ]
}

export function distanceBetween(position: Vec3, target: readonly [number, number, number]): number {
  return Math.hypot(position.x - target[0], position.y - target[1], position.z - target[2])
}
