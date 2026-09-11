import { describe, expect, it } from 'vitest'

import {
  calculateUlamRoundScore,
  createUlamMissions,
  createUlamSpiral,
  getMissionPath,
  getUlamPath,
  ULAM_DIRECTIONS,
  ULAM_ROUNDS,
} from './ulamLogic'

describe('Ulam spiral', () => {
  it('places the first square of values around one', () => {
    expect(createUlamSpiral(3).map(({ value, x, y }) => ({ value, x, y }))).toEqual([
      { value: 1, x: 0, y: 0 },
      { value: 2, x: 1, y: 0 },
      { value: 3, x: 1, y: 1 },
      { value: 4, x: 0, y: 1 },
      { value: 5, x: -1, y: 1 },
      { value: 6, x: -1, y: 0 },
      { value: 7, x: -1, y: -1 },
      { value: 8, x: 0, y: -1 },
      { value: 9, x: 1, y: -1 },
    ])
  })

  it('creates one unique coordinate for every value in an odd square', () => {
    const cells = createUlamSpiral(31)
    expect(cells).toHaveLength(31 ** 2)
    expect(new Set(cells.map((cell) => `${cell.x}:${cell.y}`)).size).toBe(cells.length)
    expect(cells.find((cell) => cell.value === 29)?.prime).toBe(true)
    expect(cells.find((cell) => cell.value === 49)?.prime).toBe(false)
  })

  it('rejects grids that cannot be centered on one', () => {
    expect(() => createUlamSpiral(10)).toThrow(RangeError)
    expect(() => createUlamSpiral(1)).toThrow(RangeError)
    expect(() => createUlamSpiral(53)).toThrow(RangeError)
  })
})

describe('Ulam diagonal missions', () => {
  it('builds five progressively larger missions with one best diagonal', () => {
    const missions = createUlamMissions()
    expect(missions).toHaveLength(ULAM_ROUNDS)

    missions.forEach((mission, index) => {
      expect(mission.difficulty).toBe(index + 1)
      expect(mission.paths).toHaveLength(4)
      expect(mission.paths.every((path) => path.cells.length === mission.pathLength)).toBe(true)
      const highest = Math.max(...mission.paths.map((path) => path.primeCount))
      const winners = mission.paths.filter((path) => path.primeCount === highest)
      expect(winners).toHaveLength(1)
      expect(winners[0].direction.id).toBe(mission.correctDirection)
    })
  })

  it('extracts a geometric ray from any valid anchor', () => {
    const cells = createUlamSpiral(7)
    const anchor = cells.find((cell) => cell.value === 1)
    if (!anchor) throw new Error('missing center')
    const path = getUlamPath(cells, anchor, ULAM_DIRECTIONS[0], 2)

    expect(path.cells.map((cell) => [cell.x, cell.y])).toEqual([[1, 1], [2, 2]])
    expect(path.cells.map((cell) => cell.value)).toEqual([3, 13])
    expect(path.primeCount).toBe(2)
  })

  it('scores observation accuracy without making a round worthless', () => {
    const mission = createUlamMissions()[0]
    expect(calculateUlamRoundScore(mission, 0)).toBeGreaterThan(
      calculateUlamRoundScore(mission, 2),
    )
    expect(calculateUlamRoundScore(mission, 99)).toBe(300)
    expect(getMissionPath(mission, mission.correctDirection).primeCount).toBeGreaterThanOrEqual(2)
  })
})
