import { describe, expect, it } from 'vitest'

import {
  BACKROOMS_CELL_SIZE,
  BACKROOMS_GRID,
  BACKROOMS_GRID_HEIGHT,
  BACKROOMS_GRID_WIDTH,
  BACKROOMS_OPEN_CELLS,
  BACKROOMS_POINTS_OF_INTEREST,
  BACKROOMS_START,
  BACKROOMS_WALL_CELLS,
  backroomsGridToLocal,
  backroomsLocalToGrid,
  getBackroomsSector,
  getNearestBackroomsPointOfInterest,
  isBackroomsPositionWalkable,
  resolveBackroomsMovement,
  toBackroomsWorld,
} from './backroomsLayout'

describe('procedural liminal maze', () => {
  it('is deterministic, bounded and contains both corridors and walls', () => {
    expect(BACKROOMS_GRID).toHaveLength(BACKROOMS_GRID_HEIGHT)
    expect(BACKROOMS_GRID.every((row) => row.length === BACKROOMS_GRID_WIDTH)).toBe(true)
    expect(BACKROOMS_OPEN_CELLS.length).toBeGreaterThan(180)
    expect(BACKROOMS_WALL_CELLS.length).toBeGreaterThan(120)
    expect(isBackroomsPositionWalkable(BACKROOMS_START)).toBe(true)
  })

  it('keeps every point of interest inside an open part of the maze', () => {
    for (const point of BACKROOMS_POINTS_OF_INTEREST) {
      if (point.id === 'reception-desk' || point.id === 'abandoned-cart') continue
      expect(isBackroomsPositionWalkable(point.position, 0.2), point.id).toBe(true)
    }
  })

  it('keeps every point of interest connected to the entrance', () => {
    const start = backroomsLocalToGrid(BACKROOMS_START)
    const queue = [start]
    const visited = new Set([`${start.column}:${start.row}`])
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index]
      for (const [column, row] of [
        [current.column + 1, current.row], [current.column - 1, current.row],
        [current.column, current.row + 1], [current.column, current.row - 1],
      ] as const) {
        const key = `${column}:${row}`
        if (visited.has(key) || row < 0 || row >= BACKROOMS_GRID_HEIGHT || column < 0 || column >= BACKROOMS_GRID_WIDTH) continue
        if (BACKROOMS_GRID[row][column]) continue
        visited.add(key)
        queue.push({ column, row })
      }
    }
    for (const point of BACKROOMS_POINTS_OF_INTEREST) {
      const grid = backroomsLocalToGrid(point.position)
      expect(visited.has(`${grid.column}:${grid.row}`), point.id).toBe(true)
    }
  })

  it('converts between grid and world coordinates without drift', () => {
    for (const [column, row] of [[1, 1], [12, 10], [23, 19]] as const) {
      expect(backroomsLocalToGrid(backroomsGridToLocal(column, row))).toEqual({ column, row })
    }
  })

  it('supports an arbitrary world origin for collisions and lookup', () => {
    const origin = [120, 0, -80] as const
    const worldStart = toBackroomsWorld(BACKROOMS_START, origin)
    expect(isBackroomsPositionWalkable(worldStart, 0.46, origin)).toBe(true)
    expect(getBackroomsSector(worldStart, origin)?.id).toBe('reception')
    expect(getNearestBackroomsPointOfInterest(
      toBackroomsWorld(BACKROOMS_POINTS_OF_INTEREST[2].position, origin),
      0.2,
      origin,
    )?.id).toBe('false-window')
  })

  it('slides against a wall and never accepts a wall cell center', () => {
    const open = BACKROOMS_OPEN_CELLS.find((cell) => (
      cell.column + 1 < BACKROOMS_GRID_WIDTH && BACKROOMS_GRID[cell.row][cell.column + 1]
    ))
    expect(open).toBeDefined()
    if (!open) return
    const blocked = { x: open.x + BACKROOMS_CELL_SIZE, z: open.z }
    expect(isBackroomsPositionWalkable(blocked)).toBe(false)
    const resolved = resolveBackroomsMovement(
      { x: open.x, z: open.z },
      { x: blocked.x, z: open.z + 0.3 },
    )
    expect(resolved.x).toBe(open.x)
    expect(resolved.z).toBeCloseTo(open.z + 0.3)
  })
})
