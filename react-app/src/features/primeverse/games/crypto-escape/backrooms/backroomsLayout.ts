export interface BackroomsPosition2D {
  readonly x: number
  readonly z: number
}

export type BackroomsOrigin = readonly [x: number, y: number, z: number]
export type BackroomsSectorId = 'reception' | 'offices' | 'junction' | 'archive' | 'service'

export interface BackroomsSectorDefinition {
  readonly id: BackroomsSectorId
  readonly name: string
  readonly subtitle: string
  readonly wallColor: string
  readonly carpetColor: string
  readonly lightColor: string
}

export interface BackroomsCell extends BackroomsPosition2D {
  readonly id: string
  readonly column: number
  readonly row: number
  readonly sectorId: BackroomsSectorId
  readonly kind: 'open' | 'wall'
}

export interface BackroomsCollider {
  readonly id: string
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

export interface BackroomsWallEdge extends BackroomsPosition2D {
  readonly id: string
  readonly rotation: number
  readonly sectorId: BackroomsSectorId
}

export type BackroomsPointOfInterestKind =
  | 'reception-desk'
  | 'silent-phone'
  | 'false-window'
  | 'water-stain'
  | 'abandoned-cart'
  | 'red-exit'

export interface BackroomsPointOfInterest {
  readonly id: BackroomsPointOfInterestKind
  readonly title: string
  readonly hint: string
  readonly position: BackroomsPosition2D
  readonly interactionRadius: number
  readonly sectorId: BackroomsSectorId
}

export interface BackroomsLightDefinition extends BackroomsPosition2D {
  readonly id: string
  readonly sectorId: BackroomsSectorId
  readonly broken: boolean
  readonly phase: number
}

export const BACKROOMS_GRID_WIDTH = 25
export const BACKROOMS_GRID_HEIGHT = 21
export const BACKROOMS_CELL_SIZE = 3.8
export const BACKROOMS_FLOOR_Y = -2.18
export const BACKROOMS_CEILING_Y = 3.35
export const BACKROOMS_PLAYER_RADIUS = 0.46
export const DEFAULT_BACKROOMS_ORIGIN: BackroomsOrigin = Object.freeze([0, 0, 0])

export const BACKROOMS_SECTORS: Readonly<Record<BackroomsSectorId, BackroomsSectorDefinition>> = Object.freeze({
  reception: {
    id: 'reception',
    name: 'Recepção Ausente',
    subtitle: 'O relógio não avança',
    wallColor: '#b6a75d',
    carpetColor: '#756b3d',
    lightColor: '#fff4b0',
  },
  offices: {
    id: 'offices',
    name: 'Escritórios Vazios',
    subtitle: 'Toda mesa foi abandonada ao mesmo tempo',
    wallColor: '#c2b370',
    carpetColor: '#81764b',
    lightColor: '#f4edbc',
  },
  junction: {
    id: 'junction',
    name: 'Junção Úmida',
    subtitle: 'O carpete respira sob seus pés',
    wallColor: '#9f9a59',
    carpetColor: '#536046',
    lightColor: '#d7e799',
  },
  archive: {
    id: 'archive',
    name: 'Arquivo sem Índice',
    subtitle: 'As gavetas guardam páginas em branco',
    wallColor: '#ad9151',
    carpetColor: '#684f35',
    lightColor: '#ffdfa0',
  },
  service: {
    id: 'service',
    name: 'Ala de Serviço',
    subtitle: 'Há uma porta que não pertence ao prédio',
    wallColor: '#918252',
    carpetColor: '#4d4c38',
    lightColor: '#d8d4a3',
  },
})

interface GridPoint {
  readonly column: number
  readonly row: number
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

function shuffledDirections(random: () => number): readonly GridPoint[] {
  const values: GridPoint[] = [
    { column: 2, row: 0 },
    { column: -2, row: 0 },
    { column: 0, row: 2 },
    { column: 0, row: -2 },
  ]
  for (let index = values.length - 1; index > 0; index -= 1) {
    const replacement = Math.floor(random() * (index + 1))
    const temporary = values[index]
    values[index] = values[replacement]
    values[replacement] = temporary
  }
  return values
}

function createMazeGrid(): readonly (readonly boolean[])[] {
  const walls = Array.from({ length: BACKROOMS_GRID_HEIGHT }, () => (
    Array.from({ length: BACKROOMS_GRID_WIDTH }, () => true)
  ))
  const visited = Array.from({ length: BACKROOMS_GRID_HEIGHT }, () => (
    Array.from({ length: BACKROOMS_GRID_WIDTH }, () => false)
  ))
  const random = seededRandom(997_235_711)
  const stack: GridPoint[] = [{ column: 1, row: 1 }]
  walls[1][1] = false
  visited[1][1] = true

  while (stack.length > 0) {
    const current = stack[stack.length - 1]
    const next = shuffledDirections(random)
      .map((direction) => ({
        column: current.column + direction.column,
        row: current.row + direction.row,
      }))
      .find((candidate) => (
        candidate.column > 0 && candidate.column < BACKROOMS_GRID_WIDTH - 1 &&
        candidate.row > 0 && candidate.row < BACKROOMS_GRID_HEIGHT - 1 &&
        !visited[candidate.row][candidate.column]
      ))
    if (!next) {
      stack.pop()
      continue
    }
    const middleColumn = (current.column + next.column) / 2
    const middleRow = (current.row + next.row) / 2
    walls[middleRow][middleColumn] = false
    walls[next.row][next.column] = false
    visited[next.row][next.column] = true
    stack.push(next)
  }

  const rooms = [
    { minColumn: 1, maxColumn: 7, minRow: 1, maxRow: 5 },
    { minColumn: 16, maxColumn: 23, minRow: 1, maxRow: 6 },
    { minColumn: 9, maxColumn: 15, minRow: 8, maxRow: 12 },
    { minColumn: 1, maxColumn: 9, minRow: 14, maxRow: 19 },
    { minColumn: 15, maxColumn: 23, minRow: 14, maxRow: 19 },
  ] as const
  for (const room of rooms) {
    for (let row = room.minRow; row <= room.maxRow; row += 1) {
      for (let column = room.minColumn; column <= room.maxColumn; column += 1) walls[row][column] = false
    }
  }
  return Object.freeze(walls.map((row) => Object.freeze(row)))
}

export const BACKROOMS_GRID = createMazeGrid()

export function backroomsGridToLocal(column: number, row: number): BackroomsPosition2D {
  return {
    x: (column - (BACKROOMS_GRID_WIDTH - 1) / 2) * BACKROOMS_CELL_SIZE,
    z: (row - (BACKROOMS_GRID_HEIGHT - 1) / 2) * BACKROOMS_CELL_SIZE,
  }
}

export function backroomsLocalToGrid(position: BackroomsPosition2D): GridPoint {
  const minimumX = -BACKROOMS_GRID_WIDTH * BACKROOMS_CELL_SIZE / 2
  const minimumZ = -BACKROOMS_GRID_HEIGHT * BACKROOMS_CELL_SIZE / 2
  return {
    column: Math.floor((position.x - minimumX) / BACKROOMS_CELL_SIZE),
    row: Math.floor((position.z - minimumZ) / BACKROOMS_CELL_SIZE),
  }
}

function sectorIdForGrid(column: number, row: number): BackroomsSectorId {
  if (column >= 9 && column <= 15 && row >= 7 && row <= 13) return 'junction'
  if (row <= 8) return column <= 11 ? 'reception' : 'offices'
  if (row >= 12) return column <= 11 ? 'archive' : 'service'
  return column <= 11 ? 'archive' : 'service'
}

function createCells(): readonly BackroomsCell[] {
  const cells: BackroomsCell[] = []
  for (let row = 0; row < BACKROOMS_GRID_HEIGHT; row += 1) {
    for (let column = 0; column < BACKROOMS_GRID_WIDTH; column += 1) {
      const position = backroomsGridToLocal(column, row)
      cells.push({
        id: `${column}:${row}`,
        column,
        row,
        sectorId: sectorIdForGrid(column, row),
        kind: BACKROOMS_GRID[row][column] ? 'wall' : 'open',
        ...position,
      })
    }
  }
  return Object.freeze(cells)
}

export const BACKROOMS_CELLS = createCells()
export const BACKROOMS_OPEN_CELLS = Object.freeze(BACKROOMS_CELLS.filter((cell) => cell.kind === 'open'))
export const BACKROOMS_WALL_CELLS = Object.freeze(BACKROOMS_CELLS.filter((cell) => cell.kind === 'wall'))

export const BACKROOMS_LIMITS = Object.freeze({
  minX: -BACKROOMS_GRID_WIDTH * BACKROOMS_CELL_SIZE / 2,
  maxX: BACKROOMS_GRID_WIDTH * BACKROOMS_CELL_SIZE / 2,
  minZ: -BACKROOMS_GRID_HEIGHT * BACKROOMS_CELL_SIZE / 2,
  maxZ: BACKROOMS_GRID_HEIGHT * BACKROOMS_CELL_SIZE / 2,
})

export const BACKROOMS_COLLIDERS: readonly BackroomsCollider[] = Object.freeze(
  BACKROOMS_WALL_CELLS.map((cell) => ({
    id: `wall-${cell.id}`,
    minX: cell.x - BACKROOMS_CELL_SIZE / 2,
    maxX: cell.x + BACKROOMS_CELL_SIZE / 2,
    minZ: cell.z - BACKROOMS_CELL_SIZE / 2,
    maxZ: cell.z + BACKROOMS_CELL_SIZE / 2,
  })),
)

const POINT_GRID = Object.freeze({
  'reception-desk': { column: 4, row: 3 },
  'silent-phone': { column: 7, row: 5 },
  'false-window': { column: 20, row: 1 },
  'water-stain': { column: 12, row: 10 },
  'abandoned-cart': { column: 5, row: 17 },
  'red-exit': { column: 21, row: 19 },
} as const satisfies Readonly<Record<BackroomsPointOfInterestKind, GridPoint>>)

export const BACKROOMS_POINTS_OF_INTEREST: readonly BackroomsPointOfInterest[] = Object.freeze([
  {
    id: 'reception-desk', title: 'Balcão sem atendente', hint: 'Há uma ficha numerada sob o telefone.',
    position: backroomsGridToLocal(POINT_GRID['reception-desk'].column, POINT_GRID['reception-desk'].row),
    interactionRadius: 2.5, sectorId: 'reception',
  },
  {
    id: 'silent-phone', title: 'Telefone sem fio', hint: 'O aparelho toca, mas não existe tomada.',
    position: backroomsGridToLocal(POINT_GRID['silent-phone'].column, POINT_GRID['silent-phone'].row),
    interactionRadius: 2.2, sectorId: 'reception',
  },
  {
    id: 'false-window', title: 'Janela impossível', hint: 'A luz atrás do vidro não projeta sombra.',
    position: backroomsGridToLocal(POINT_GRID['false-window'].column, POINT_GRID['false-window'].row),
    interactionRadius: 2.7, sectorId: 'offices',
  },
  {
    id: 'water-stain', title: 'Mancha crescente', hint: 'A umidade desenha uma espiral que termina em 13.',
    position: backroomsGridToLocal(POINT_GRID['water-stain'].column, POINT_GRID['water-stain'].row),
    interactionRadius: 2.6, sectorId: 'junction',
  },
  {
    id: 'abandoned-cart', title: 'Carrinho de arquivos', hint: 'Todas as pastas têm a mesma data, amanhã.',
    position: backroomsGridToLocal(POINT_GRID['abandoned-cart'].column, POINT_GRID['abandoned-cart'].row),
    interactionRadius: 2.5, sectorId: 'archive',
  },
  {
    id: 'red-exit', title: 'Porta vermelha', hint: 'A única cor que não pertence a este lugar.',
    position: backroomsGridToLocal(POINT_GRID['red-exit'].column, POINT_GRID['red-exit'].row),
    interactionRadius: 3, sectorId: 'service',
  },
])

export const BACKROOMS_START = Object.freeze(backroomsGridToLocal(2, 3))
export const BACKROOMS_EXIT_GRID = Object.freeze(POINT_GRID['red-exit'])
export const BACKROOMS_EXIT = Object.freeze(backroomsGridToLocal(BACKROOMS_EXIT_GRID.column, BACKROOMS_EXIT_GRID.row))

const POI_PROP_COLLIDERS: readonly BackroomsCollider[] = Object.freeze([
  {
    id: 'prop-reception-desk',
    minX: BACKROOMS_POINTS_OF_INTEREST[0].position.x - 1.7,
    maxX: BACKROOMS_POINTS_OF_INTEREST[0].position.x + 1.7,
    minZ: BACKROOMS_POINTS_OF_INTEREST[0].position.z - 0.7,
    maxZ: BACKROOMS_POINTS_OF_INTEREST[0].position.z + 0.7,
  },
  {
    id: 'prop-archive-cart',
    minX: BACKROOMS_POINTS_OF_INTEREST[4].position.x - 0.7,
    maxX: BACKROOMS_POINTS_OF_INTEREST[4].position.x + 0.7,
    minZ: BACKROOMS_POINTS_OF_INTEREST[4].position.z - 1,
    maxZ: BACKROOMS_POINTS_OF_INTEREST[4].position.z + 1,
  },
])

export const BACKROOMS_PROP_COLLIDERS = POI_PROP_COLLIDERS

function createWallEdges(): readonly BackroomsWallEdge[] {
  const edges: BackroomsWallEdge[] = []
  for (const cell of BACKROOMS_OPEN_CELLS) {
    const neighbours = [
      { column: cell.column, row: cell.row - 1, x: cell.x, z: cell.z - BACKROOMS_CELL_SIZE / 2, rotation: 0 },
      { column: cell.column, row: cell.row + 1, x: cell.x, z: cell.z + BACKROOMS_CELL_SIZE / 2, rotation: 0 },
      { column: cell.column - 1, row: cell.row, x: cell.x - BACKROOMS_CELL_SIZE / 2, z: cell.z, rotation: Math.PI / 2 },
      { column: cell.column + 1, row: cell.row, x: cell.x + BACKROOMS_CELL_SIZE / 2, z: cell.z, rotation: Math.PI / 2 },
    ]
    for (const neighbour of neighbours) {
      if (neighbour.row < 0 || neighbour.row >= BACKROOMS_GRID_HEIGHT ||
        neighbour.column < 0 || neighbour.column >= BACKROOMS_GRID_WIDTH ||
        BACKROOMS_GRID[neighbour.row][neighbour.column]) {
        edges.push({
          id: `${cell.id}:${neighbour.column}:${neighbour.row}`,
          x: neighbour.x,
          z: neighbour.z,
          rotation: neighbour.rotation,
          sectorId: cell.sectorId,
        })
      }
    }
  }
  return Object.freeze(edges)
}

export const BACKROOMS_WALL_EDGES = createWallEdges()

export const BACKROOMS_LIGHTS: readonly BackroomsLightDefinition[] = Object.freeze(
  BACKROOMS_OPEN_CELLS
    .filter((cell) => (cell.column * 7 + cell.row * 11) % 17 === 0)
    .map((cell, index) => ({
      id: `light-${cell.id}`,
      x: cell.x,
      z: cell.z,
      sectorId: cell.sectorId,
      broken: index % 5 === 2,
      phase: index * 1.731,
    })),
)

export function toBackroomsLocal(position: BackroomsPosition2D, origin: BackroomsOrigin = DEFAULT_BACKROOMS_ORIGIN): BackroomsPosition2D {
  return { x: position.x - origin[0], z: position.z - origin[2] }
}

export function toBackroomsWorld(position: BackroomsPosition2D, origin: BackroomsOrigin = DEFAULT_BACKROOMS_ORIGIN): BackroomsPosition2D {
  return { x: position.x + origin[0], z: position.z + origin[2] }
}

function circleIntersectsCollider(position: BackroomsPosition2D, radius: number, collider: BackroomsCollider): boolean {
  const closestX = Math.max(collider.minX, Math.min(position.x, collider.maxX))
  const closestZ = Math.max(collider.minZ, Math.min(position.z, collider.maxZ))
  return Math.hypot(position.x - closestX, position.z - closestZ) <= radius
}

export function isBackroomsPositionWalkable(
  worldPosition: BackroomsPosition2D,
  radius = BACKROOMS_PLAYER_RADIUS,
  origin: BackroomsOrigin = DEFAULT_BACKROOMS_ORIGIN,
): boolean {
  if (!Number.isFinite(worldPosition.x) || !Number.isFinite(worldPosition.z) || !Number.isFinite(radius) || radius < 0) return false
  const position = toBackroomsLocal(worldPosition, origin)
  if (position.x - radius < BACKROOMS_LIMITS.minX || position.x + radius > BACKROOMS_LIMITS.maxX ||
    position.z - radius < BACKROOMS_LIMITS.minZ || position.z + radius > BACKROOMS_LIMITS.maxZ) return false
  return !BACKROOMS_COLLIDERS.some((collider) => circleIntersectsCollider(position, radius, collider)) &&
    !BACKROOMS_PROP_COLLIDERS.some((collider) => circleIntersectsCollider(position, radius, collider))
}

export function resolveBackroomsMovement(
  currentWorldPosition: BackroomsPosition2D,
  requestedWorldPosition: BackroomsPosition2D,
  radius = BACKROOMS_PLAYER_RADIUS,
  origin: BackroomsOrigin = DEFAULT_BACKROOMS_ORIGIN,
): BackroomsPosition2D {
  if (isBackroomsPositionWalkable(requestedWorldPosition, radius, origin)) return requestedWorldPosition
  const slideX = { x: requestedWorldPosition.x, z: currentWorldPosition.z }
  if (isBackroomsPositionWalkable(slideX, radius, origin)) return slideX
  const slideZ = { x: currentWorldPosition.x, z: requestedWorldPosition.z }
  if (isBackroomsPositionWalkable(slideZ, radius, origin)) return slideZ
  return currentWorldPosition
}

export function getBackroomsSector(
  worldPosition: BackroomsPosition2D,
  origin: BackroomsOrigin = DEFAULT_BACKROOMS_ORIGIN,
): BackroomsSectorDefinition | null {
  const local = toBackroomsLocal(worldPosition, origin)
  const grid = backroomsLocalToGrid(local)
  if (grid.column < 0 || grid.column >= BACKROOMS_GRID_WIDTH || grid.row < 0 || grid.row >= BACKROOMS_GRID_HEIGHT) return null
  return BACKROOMS_SECTORS[sectorIdForGrid(grid.column, grid.row)]
}

export function getNearestBackroomsPointOfInterest(
  worldPosition: BackroomsPosition2D,
  maximumDistance = Number.POSITIVE_INFINITY,
  origin: BackroomsOrigin = DEFAULT_BACKROOMS_ORIGIN,
): BackroomsPointOfInterest | null {
  const local = toBackroomsLocal(worldPosition, origin)
  let nearest: BackroomsPointOfInterest | null = null
  let nearestDistance = maximumDistance
  for (const point of BACKROOMS_POINTS_OF_INTEREST) {
    const distance = Math.hypot(local.x - point.position.x, local.z - point.position.z)
    if (distance <= nearestDistance) {
      nearest = point
      nearestDistance = distance
    }
  }
  return nearest
}
