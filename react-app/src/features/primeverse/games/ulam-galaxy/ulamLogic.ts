import { isPrime } from '../../../../lib/math'

import type {
  UlamCell,
  UlamDirection,
  UlamDirectionId,
  UlamMission,
  UlamPath,
} from './types'

export const ULAM_DIRECTIONS: readonly UlamDirection[] = [
  { id: 'ne', label: 'Nordeste', symbol: '↗', dx: 1, dy: 1 },
  { id: 'nw', label: 'Noroeste', symbol: '↖', dx: -1, dy: 1 },
  { id: 'sw', label: 'Sudoeste', symbol: '↙', dx: -1, dy: -1 },
  { id: 'se', label: 'Sudeste', symbol: '↘', dx: 1, dy: -1 },
] as const

export const ULAM_ROUNDS = 5

const MISSION_CONFIGS = [
  { size: 15, pathLength: 4, preferred: 'ne' },
  { size: 19, pathLength: 5, preferred: 'nw' },
  { size: 23, pathLength: 6, preferred: 'sw' },
  { size: 27, pathLength: 7, preferred: 'se' },
  { size: 31, pathLength: 8, preferred: 'ne' },
] as const satisfies readonly {
  size: number
  pathLength: number
  preferred: UlamDirectionId
}[]

function assertGridSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 3 || size > 51 || size % 2 === 0) {
    throw new RangeError('Ulam grid size must be an odd integer from 3 to 51')
  }
}

function coordinateKey(x: number, y: number): string {
  return `${x}:${y}`
}

/** Builds the classic counter-clockwise Ulam spiral with 1 at the origin. */
export function createUlamSpiral(size: number): readonly UlamCell[] {
  assertGridSize(size)
  const limit = size * size
  const cells: UlamCell[] = [{ value: 1, x: 0, y: 0, prime: false }]
  const directions = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ] as const
  let x = 0
  let y = 0
  let value = 1
  let runLength = 1
  let directionIndex = 0

  while (value < limit) {
    for (let repeatedDirection = 0; repeatedDirection < 2 && value < limit; repeatedDirection += 1) {
      const [dx, dy] = directions[directionIndex % directions.length]
      for (let step = 0; step < runLength && value < limit; step += 1) {
        x += dx
        y += dy
        value += 1
        cells.push({ value, x, y, prime: isPrime(value) })
      }
      directionIndex += 1
    }
    runLength += 1
  }

  return cells
}

export function getUlamPath(
  cells: readonly UlamCell[],
  anchor: UlamCell,
  direction: UlamDirection,
  length: number,
): UlamPath {
  if (!Number.isSafeInteger(length) || length < 1) {
    throw new RangeError('path length must be a positive integer')
  }
  const byCoordinate = new Map(cells.map((cell) => [coordinateKey(cell.x, cell.y), cell]))
  return getUlamPathFromMap(byCoordinate, anchor, direction, length)
}

function getUlamPathFromMap(
  byCoordinate: ReadonlyMap<string, UlamCell>,
  anchor: UlamCell,
  direction: UlamDirection,
  length: number,
): UlamPath {
  const pathCells: UlamCell[] = []

  for (let step = 1; step <= length; step += 1) {
    const cell = byCoordinate.get(coordinateKey(
      anchor.x + direction.dx * step,
      anchor.y + direction.dy * step,
    ))
    if (!cell) throw new RangeError('path leaves the supplied Ulam grid')
    pathCells.push(cell)
  }

  return {
    direction,
    cells: pathCells,
    primeCount: pathCells.filter((cell) => cell.prime).length,
  }
}

function createMission(
  size: number,
  pathLength: number,
  preferred: UlamDirectionId,
  difficulty: number,
): UlamMission {
  const cells = createUlamSpiral(size)
  const byCoordinate = new Map(cells.map((cell) => [coordinateKey(cell.x, cell.y), cell]))
  const radius = (size - 1) / 2
  const anchors = cells.filter((cell) =>
    Math.abs(cell.x) <= radius - pathLength &&
    Math.abs(cell.y) <= radius - pathLength &&
    cell.value > 1,
  )

  const candidates = anchors.flatMap((anchor) => {
    const paths = ULAM_DIRECTIONS.map((direction) =>
      getUlamPathFromMap(byCoordinate, anchor, direction, pathLength),
    )
    const highest = Math.max(...paths.map((path) => path.primeCount))
    const winners = paths.filter((path) => path.primeCount === highest)
    if (
      winners.length !== 1 ||
      winners[0].direction.id !== preferred ||
      highest < 2
    ) return []
    return [{ anchor, paths }]
  })

  if (candidates.length === 0) {
    throw new Error(`Unable to configure Ulam mission ${difficulty}`)
  }

  const chosen = candidates[(difficulty * 7) % candidates.length]
  return {
    id: `ulam-${size}-${chosen.anchor.value}`,
    difficulty,
    size,
    pathLength,
    anchor: chosen.anchor,
    paths: chosen.paths,
    correctDirection: preferred,
  }
}

export function createUlamMissions(): readonly UlamMission[] {
  return MISSION_CONFIGS.map((config, index) =>
    createMission(
      config.size,
      config.pathLength,
      config.preferred,
      index + 1,
    ),
  )
}

export function getMissionPath(
  mission: UlamMission,
  direction: UlamDirectionId,
): UlamPath {
  const path = mission.paths.find((candidate) => candidate.direction.id === direction)
  if (!path) throw new RangeError(`Unknown Ulam direction: ${direction}`)
  return path
}

export function calculateUlamRoundScore(
  mission: UlamMission,
  roundMistakes: number,
): number {
  if (!Number.isSafeInteger(roundMistakes) || roundMistakes < 0) {
    throw new RangeError('round mistakes must be a non-negative integer')
  }
  const winningPath = getMissionPath(mission, mission.correctDirection)
  return Math.max(300, 850 + winningPath.primeCount * 140 - roundMistakes * 170)
}

export function calculateUlamXp(score: number, mistakes: number): number {
  if (!Number.isFinite(score) || score < 0 || !Number.isSafeInteger(mistakes) || mistakes < 0) {
    throw new RangeError('score and mistakes must be non-negative')
  }
  return Math.max(120, Math.min(500, Math.round(score / 18) + (mistakes === 0 ? 45 : 0)))
}
