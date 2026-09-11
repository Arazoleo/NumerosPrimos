import { PRIMEBOUND_AREAS, type PrimeboundAreaId } from './world'

/**
 * Primebound presence encoding.
 *
 * The online protocol replicates one Vec3 per player. Primebound is a 2D pixel
 * game with twelve separate areas, so each area gets its own 24-unit slot along
 * the presence X axis and the player's pixel position is normalised into it:
 *
 *   presenceX = areaIndex * SLOT + fractionX * WINDOW
 *   presenceZ = fractionY * DEPTH
 *
 * Both directions are exact inverses, so peers decode back to "which area, and
 * where inside it". Crossing an area gate shows up as a ≥ SLOT jump, which the
 * server's discontinuity budget for this activity is sized to accept.
 */
export const PRESENCE_SLOT = 24
export const PRESENCE_WINDOW = 20
export const PRESENCE_DEPTH = 40

export const PRIMEBOUND_AREA_ORDER = Object.freeze(
  Object.keys(PRIMEBOUND_AREAS) as PrimeboundAreaId[],
)

function areaSize(areaId: PrimeboundAreaId): { readonly x: number; readonly y: number } {
  const area = PRIMEBOUND_AREAS[areaId]
  const TILE_SIZE = 32
  return { x: area.tileMap[0].length * TILE_SIZE, y: area.tileMap.length * TILE_SIZE }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function encodePrimeboundPresence(
  areaId: PrimeboundAreaId,
  x: number,
  y: number,
): readonly [number, number, number] {
  const index = Math.max(0, PRIMEBOUND_AREA_ORDER.indexOf(areaId))
  const size = areaSize(areaId)
  return [
    index * PRESENCE_SLOT + clamp01(x / size.x) * PRESENCE_WINDOW,
    0,
    clamp01(y / size.y) * PRESENCE_DEPTH,
  ]
}

export interface DecodedPresence {
  readonly areaId: PrimeboundAreaId | null
  readonly x: number
  readonly y: number
}

export function decodePrimeboundPresence(
  position: { readonly x: number; readonly z: number },
): DecodedPresence {
  const index = Math.floor(position.x / PRESENCE_SLOT)
  const areaId = PRIMEBOUND_AREA_ORDER[index] ?? null
  if (!areaId) return { areaId: null, x: 0, y: 0 }
  const size = areaSize(areaId)
  const fractionX = clamp01((position.x - index * PRESENCE_SLOT) / PRESENCE_WINDOW)
  const fractionY = clamp01(position.z / PRESENCE_DEPTH)
  return { areaId, x: fractionX * size.x, y: fractionY * size.y }
}
