export interface CatacombWallDefinition {
  readonly id: string
  readonly x: number
  readonly z: number
  readonly width: number
  readonly depth: number
  readonly height: number
  readonly mark: number
}

/** Axis-aligned ruins shared by the renderer and the local collision layer. */
export const CATACOMB_WALLS: readonly CatacombWallDefinition[] = Object.freeze([
  { id: 'crypt-wall-nw', x: -8.5, z: -99, width: 9, depth: 0.8, height: 3.1, mark: 4 },
  { id: 'crypt-wall-ne', x: 6.5, z: -99, width: 7, depth: 0.8, height: 3.8, mark: 6 },
  { id: 'crypt-wall-mid-left', x: -5, z: -106, width: 8, depth: 0.8, height: 4.2, mark: 9 },
  { id: 'crypt-wall-mid-right', x: 8, z: -106, width: 6, depth: 0.8, height: 3.4, mark: 15 },
  { id: 'crypt-wall-low-left', x: -9, z: -112, width: 5, depth: 0.8, height: 3.6, mark: 21 },
  { id: 'crypt-wall-low-right', x: 4, z: -112, width: 10, depth: 0.8, height: 4.4, mark: 25 },
  { id: 'crypt-wall-west', x: -13.2, z: -105, width: 0.8, depth: 8, height: 4.8, mark: 27 },
  { id: 'crypt-wall-east', x: 13.2, z: -109, width: 0.8, depth: 9, height: 4.1, mark: 33 },
])

export const CATACOMB_CENTER = [0, 0, -104] as const

