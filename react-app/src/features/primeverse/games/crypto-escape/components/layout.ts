import { backroomsGridToLocal } from '../backrooms/backroomsLayout'

export type WorldPosition = readonly [number, number, number]

export const ESCAPE_ZONE_Z_POSITIONS = [6, -5, -16, -27, -38] as const

export const GATE_Z_POSITIONS = [0.5, -10.5, -21.5, -32.5] as const

function mazePosition(column: number, row: number, y: number): WorldPosition {
  const { x, z } = backroomsGridToLocal(column, row)
  return [x, y, z]
}

// Each mechanism now occupies a landmark in the larger liminal maze. The
// route deliberately crosses every sector instead of unfolding in one hall.
export const LENS_POSITION: WorldPosition = mazePosition(7, 5, -0.75)
export const PRIME_BOX_POSITION: WorldPosition = mazePosition(4, 3, 0.58)
export const CAESAR_POSITION: WorldPosition = [backroomsGridToLocal(20, 3).x, 0.35, -30.25]
export const MODULAR_POSITION: WorldPosition = [0, -0.15, -2.65]
export const SPECTRAL_PLAQUE_POSITION: WorldPosition = [backroomsGridToLocal(5, 17).x, -0.2, 17.1]
export const RSA_VAULT_POSITION: WorldPosition = [backroomsGridToLocal(21, 18).x, -0.05, 32.15]

export const ESCAPE_EXIT_POSITION: WorldPosition = [backroomsGridToLocal(21, 19).x, 0.28, 35.35]
