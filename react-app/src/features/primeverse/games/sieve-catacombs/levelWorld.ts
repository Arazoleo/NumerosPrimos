import type {
  CatacombsEnemyArchetype,
  CatacombsEventId,
  CatacombsLevelId,
  CatacombsSealPrime,
} from './campaignLogic'
import { CATACOMBS_LEVELS } from './campaignLogic'
import type { CabinetDefinition } from './cabinets'
import { CAESAR_DISC_ID } from './caesarDisc'
import { ELEVATOR_PUZZLES } from './elevatorPuzzle'
import { nextPathPoint } from './pathfinding'
import {
  CELL_SIZE,
  ENEMY_BODY_RADIUS,
  HIT_DAMAGE,
  LIGHT_IMMUNITY_MS,
  LIGHT_STUN_BUDGET_MS,
  PLAYER_RADIUS,
  type EnemyState,
  type EnemyStepContext,
  type MapTile,
  type Position2D,
  type SupplyDefinition,
  type WalkableArea,
  type WallSegment,
} from './gameLogic'

export type LiminalTheme = 'offices' | 'pools' | 'hotel' | 'crypt' | 'servers' | 'cold'

export interface LevelPalette {
  readonly floor: string
  readonly floorEmissive: string
  readonly wall: string
  readonly wallEmissive: string
  readonly ceiling: string
  readonly ceilingEmissive: string
  readonly accent: string
  readonly danger: string
  readonly haze: string
}

export interface LevelSealDefinition {
  readonly prime: CatacombsSealPrime
  readonly title: string
  readonly inscription: string
  readonly position: Position2D
}

export interface LevelEnemyBlueprint {
  readonly id: string
  readonly name: string
  readonly number: number
  readonly archetype: CatacombsEnemyArchetype
  readonly spawn: Position2D
  readonly patrol: readonly Position2D[]
}

export interface LevelScareTrigger {
  readonly id: CatacombsEventId
  readonly position: Position2D
  readonly radius: number
  readonly minLevelElapsedMs: number
  readonly requiresSeal?: boolean
  readonly message: string
  readonly apparition?: Position2D
}

export interface LevelLightPoint extends Position2D {
  readonly color: string
  readonly intensity: number
  readonly height?: number
}

export interface CatacombsLevelWorld {
  readonly id: CatacombsLevelId
  readonly theme: LiminalTheme
  readonly ceilingHeight: number
  readonly areas: readonly WalkableArea[]
  readonly tiles: readonly MapTile[]
  readonly walls: readonly WallSegment[]
  readonly playerStart: Position2D
  readonly exit: Position2D
  readonly exitRotation: number
  readonly seal: LevelSealDefinition
  readonly supplies: readonly SupplyDefinition[]
  /** Searchable furniture: each drawer holds a clue, a battery cell or a noise. */
  readonly cabinets: readonly CabinetDefinition[]
  readonly enemies: readonly LevelEnemyBlueprint[]
  readonly scares: readonly LevelScareTrigger[]
  readonly lights: readonly LevelLightPoint[]
  readonly palette: LevelPalette
}

/**
 * Base chase speed for archetypes that stop while the player looks at them. The
 * player walks at 3.35 and sprints at 5.45, so unwatched they outrun a walk and
 * force a sprint — the freeze is the counterplay, not the distance.
 */
export const WATCHED_ARCHETYPE_CHASE_SPEED = 4.35

/** How far a full-intensity noise (a pulled drawer) travels through the level. */
export const NOISE_HEARING_RADIUS = 26

/**
 * A chase that never ends is not tension, it is attrition. After this long on your
 * heels a creature breaks off and goes back to patrol, and refuses to re-acquire for
 * `HUNT_COOLDOWN_MS` — the breather that makes hiding worth doing.
 */
export const MAX_HUNT_MS = 15_000
export const HUNT_COOLDOWN_MS = 6_000

/**
 * A chase that starts at full speed has nowhere to go. Speed ramps while the
 * creature keeps you in sight — it is always *becoming* faster — and the ramp is
 * capped so a sprint still outruns it.
 */
export const CHASE_RAMP_PER_SECOND = 0.04
export const CHASE_RAMP_MAX = 0.3

/**
 * Patrol routes are fixed, so a player who stays off them is never found and the
 * floor feels empty. Out of detection range a creature drifts towards you at patrol
 * pace instead of walking its loop: the threat always closes, slowly, and walking
 * away still outpaces it three to one.
 */
export const STALK_SPEED_SCALE = 1.15
/** Closer than this it prowls its route instead, so it never simply glues to you. */
export const STALK_MINIMUM_DISTANCE = 4
/** How long a creature keeps searching the last place it saw you. */
export const SEARCH_MEMORY_MS = 3_600

export interface LevelNoise {
  readonly position: Position2D
  /** 0..1: a pulled drawer is loud, a footstep is not. */
  readonly intensity: number
  readonly atMs: number
}

export interface LevelEnemyStepContext extends EnemyStepContext {
  readonly fear: number
  readonly sealCollected: boolean
  /** Last loud thing the player did, if it is still worth investigating. */
  readonly noise?: LevelNoise | null
}

function pointInArea(point: Position2D, area: WalkableArea): boolean {
  return point.x >= area.minX && point.x <= area.maxX
    && point.z >= area.minZ && point.z <= area.maxZ
}

function geometryForAreas(areas: readonly WalkableArea[]): {
  readonly tiles: readonly MapTile[]
  readonly walls: readonly WallSegment[]
} {
  if (areas.length === 0) throw new RangeError('A catacombs world needs at least one walkable area.')
  // Area bounds sit on the four-unit grid. Offset tile centres by half a cell so
  // rendered walls coincide with collision boundaries rather than sitting 2 m beyond them.
  const minX = Math.floor(Math.min(...areas.map((area) => area.minX)) / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2
  const maxX = Math.ceil(Math.max(...areas.map((area) => area.maxX)) / CELL_SIZE) * CELL_SIZE - CELL_SIZE / 2
  const minZ = Math.floor(Math.min(...areas.map((area) => area.minZ)) / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2
  const maxZ = Math.ceil(Math.max(...areas.map((area) => area.maxZ)) / CELL_SIZE) * CELL_SIZE - CELL_SIZE / 2
  const tiles: MapTile[] = []
  for (let x = minX; x <= maxX; x += CELL_SIZE) {
    for (let z = minZ; z <= maxZ; z += CELL_SIZE) {
      if (areas.some((area) => pointInArea({ x, z }, area))) tiles.push({ id: `${x}:${z}`, x, z })
    }
  }
  const keys = new Set(tiles.map((tile) => tile.id))
  const walls: WallSegment[] = []
  for (const tile of tiles) {
    const neighbours = [
      { dx: 0, dz: -CELL_SIZE, x: tile.x, z: tile.z - CELL_SIZE / 2, rotation: 0 },
      { dx: 0, dz: CELL_SIZE, x: tile.x, z: tile.z + CELL_SIZE / 2, rotation: 0 },
      { dx: -CELL_SIZE, dz: 0, x: tile.x - CELL_SIZE / 2, z: tile.z, rotation: Math.PI / 2 },
      { dx: CELL_SIZE, dz: 0, x: tile.x + CELL_SIZE / 2, z: tile.z, rotation: Math.PI / 2 },
    ]
    for (const neighbour of neighbours) {
      if (keys.has(`${tile.x + neighbour.dx}:${tile.z + neighbour.dz}`)) continue
      walls.push({
        id: `${tile.id}:${neighbour.dx}:${neighbour.dz}`,
        x: neighbour.x,
        z: neighbour.z,
        rotation: neighbour.rotation,
      })
    }
  }
  return { tiles: Object.freeze(tiles), walls: Object.freeze(walls) }
}

type WorldInput = Omit<CatacombsLevelWorld, 'tiles' | 'walls'>

function defineWorld(input: WorldInput): CatacombsLevelWorld {
  const geometry = geometryForAreas(input.areas)
  return Object.freeze({ ...input, ...geometry })
}

const LEVEL_WORLDS: readonly CatacombsLevelWorld[] = Object.freeze([
  defineWorld({
    id: 'yellow-offices',
    theme: 'offices',
    ceilingHeight: 3.18,
    playerStart: { x: 0, z: 24 },
    exit: { x: 0, z: 29 },
    exitRotation: Math.PI,
    areas: [
      { id: 'office-lobby', name: 'Recepção sem empresa', minX: -8, maxX: 8, minZ: 20, maxZ: 32 },
      { id: 'office-spine', name: 'Corredor que repete', minX: -4, maxX: 4, minZ: -60, maxZ: 24 },
      { id: 'office-west-link', name: 'Ala das divisórias', minX: -28, maxX: 4, minZ: 12, maxZ: 16 },
      { id: 'office-west', name: 'Escritório 002', minX: -36, maxX: -12, minZ: -8, maxZ: 24 },
      { id: 'office-east-link', name: 'Passagem fluorescente', minX: 0, maxX: 28, minZ: 0, maxZ: 4 },
      { id: 'office-east', name: 'Escritório 004', minX: 12, maxX: 36, minZ: -16, maxZ: 12 },
      { id: 'office-cross', name: 'Cruzamento 011', minX: -28, maxX: 28, minZ: -24, maxZ: -16 },
      { id: 'office-west-low', name: 'Arquivo de pessoal', minX: -36, maxX: -12, minZ: -48, maxZ: -20 },
      { id: 'office-west-low-link', name: 'Corredor 013', minX: -16, maxX: 0, minZ: -40, maxZ: -36 },
      { id: 'office-east-low', name: 'Sala de reunião vazia', minX: 12, maxX: 36, minZ: -56, maxZ: -24 },
      { id: 'office-east-low-link', name: 'Corredor 017', minX: 0, maxX: 16, minZ: -48, maxZ: -44 },
      { id: 'office-dead-end', name: 'Fim do expediente', minX: -8, maxX: 8, minZ: -64, maxZ: -52 },
    ],
    seal: {
      prime: 2,
      title: 'Selo da Primeira Lâmpada',
      inscription: 'Conte duas acesas. Ignore a terceira voz.',
      position: { x: 28, z: -48 },
    },
    supplies: [
      { id: 'office-cell-west', position: { x: -28, z: 12 } },
      { id: 'office-cell-archive', position: { x: -20, z: -40 } },
      { id: 'office-cell-meeting', position: { x: 20, z: -28 } },
    ],
    cabinets: [
      {
        id: 'office-cabinet-hr', position: { x: -30, z: 16 }, rotation: Math.PI / 2,
        drawers: [
          { id: 'office-hr-1', content: 'fragment', text: 'Post-it na gaveta: "o turno da noite empurra tudo 3 casas".' },
          { id: 'office-hr-2', content: 'battery', text: 'Uma célula de emergência rolou até o fundo. +26% de bateria.' },
          { id: 'office-hr-3', content: 'noise', text: 'A gaveta emperra e cede de uma vez. O corredor inteiro ouviu.' },
        ],
      },
      {
        id: 'office-cabinet-archive', position: { x: -22, z: -44 }, rotation: 0,
        drawers: [
          { id: 'office-archive-1', content: 'empty', text: 'Só formulários em branco com o seu nome já preenchido.' },
          { id: 'office-archive-2', content: 'fragment', text: 'Crachá rasgado: "H vira E, O vira L, H vira E..."' },
          { id: 'office-archive-3', content: 'battery', text: 'Pilhas de lanterna ainda lacradas. +26% de bateria.' },
        ],
      },
      {
        id: 'office-cabinet-meeting', position: { x: 22, z: -30 }, rotation: 0,
        drawers: [
          {
            id: 'office-meeting-1',
            content: 'tool',
            tool: CAESAR_DISC_ID,
            text: 'Sob os copos de café: um disco cifrante de papelão, dois anéis de letras ainda girando. VOCÊ PEGOU O DISCO DE CÉSAR.',
          },
          { id: 'office-meeting-2', content: 'noise', text: 'Algo metálico despenca dentro do armário.' },
        ],
      },
    ],
    enemies: [
      {
        id: 'keylog-09', name: 'KEYLOG-09 · O Registrador de Teclas', number: 9, archetype: 'keylogger-wraith',
        spawn: { x: -28, z: 4 },
        patrol: [
          { x: -28, z: 4 }, { x: -18, z: 16 }, { x: -4, z: 14 },
          { x: -18, z: 14 }, { x: -20, z: -4 },
        ],
      },
    ],
    scares: [
      {
        id: 'fluorescent-blackout', position: { x: 0, z: 5 }, radius: 3.2, minLevelElapsedMs: 3_000,
        message: 'As lâmpadas à frente apagaram na ordem errada.', apparition: { x: 0, z: -10 },
      },
      {
        id: 'wrong-door-loop', position: { x: -24, z: -20 }, radius: 4, minLevelElapsedMs: 12_000,
        message: 'Você já passou por esta porta. Seu nome na placa mudou.', apparition: { x: -13, z: -20 },
      },
      {
        id: 'distant-copy', position: { x: 14, z: -44 }, radius: 4, minLevelElapsedMs: 20_000,
        message: 'Há outra lanterna copiando cada movimento seu.', apparition: { x: 27, z: -44 },
      },
    ],
    lights: [
      { x: 0, z: 24, color: '#efe3a0', intensity: 4.2, height: 2.8 },
      { x: -24, z: 12, color: '#d8cc79', intensity: 3.2, height: 2.8 },
      { x: 24, z: 0, color: '#f1de91', intensity: 3.1, height: 2.8 },
      { x: 0, z: -20, color: '#c7b85f', intensity: 2.6, height: 2.8 },
      { x: 24, z: -44, color: '#dac969', intensity: 2.4, height: 2.8 },
    ],
    palette: {
      floor: '#4a4328', floorEmissive: '#665a2e', wall: '#77704b', wallEmissive: '#514b27',
      ceiling: '#575039', ceilingEmissive: '#3d381d', accent: '#f4df75', danger: '#8e2b28', haze: '#2a2512',
    },
  }),
  defineWorld({
    id: 'modular-pools',
    theme: 'pools',
    ceilingHeight: 4.35,
    playerStart: { x: 0, z: 30 },
    exit: { x: 0, z: -95 },
    exitRotation: 0,
    areas: [
      // An outer ring you can run forever plus a grid of shafts and halls that only
      // connect at a few points: the long way round is often the only way through.
      { id: 'pool-entry', name: 'Vestiário sem armários', minX: -8, maxX: 8, minZ: 20, maxZ: 36 },
      { id: 'pool-ring-north', name: 'Passarela Norte', minX: -44, maxX: 44, minZ: 16, maxZ: 24 },
      { id: 'pool-ring-south', name: 'Passarela Sul', minX: -44, maxX: 44, minZ: -88, maxZ: -80 },
      { id: 'pool-ring-west', name: 'Calha Oeste', minX: -44, maxX: -36, minZ: -88, maxZ: 24 },
      { id: 'pool-ring-east', name: 'Calha Leste', minX: 36, maxX: 44, minZ: -88, maxZ: 24 },
      // Each hall stops short of one ring, so no corridor crosses the whole floor.
      { id: 'pool-hall-a', name: 'Corredor dos Chuveiros', minX: -40, maxX: 24, minZ: 0, maxZ: 8 },
      { id: 'pool-hall-b', name: 'Corredor dos Ralos', minX: -28, maxX: 40, minZ: -24, maxZ: -16 },
      { id: 'pool-hall-c', name: 'Corredor Submerso', minX: -40, maxX: 12, minZ: -48, maxZ: -40 },
      { id: 'pool-hall-d', name: 'Corredor das Bordas', minX: -28, maxX: 40, minZ: -72, maxZ: -64 },
      // Single-tile ducts: two people do not pass, and neither do you and a stalker.
      { id: 'pool-shaft-1', name: 'Duto Ímpar', minX: -28, maxX: -24, minZ: -44, maxZ: 20 },
      { id: 'pool-shaft-2', name: 'Duto do Resto', minX: -12, maxX: -8, minZ: -68, maxZ: 4 },
      { id: 'pool-shaft-3', name: 'Duto Central', minX: 4, maxX: 8, minZ: -20, maxZ: 20 },
      { id: 'pool-shaft-4', name: 'Duto Par', minX: 20, maxX: 24, minZ: -68, maxZ: 4 },
      // The pools are rings around a solid block: you walk around them, never across.
      { id: 'pool-03-n', name: 'Piscina 03 · borda norte', minX: -28, maxX: 8, minZ: -4, maxZ: 4 },
      { id: 'pool-03-s', name: 'Piscina 03 · borda sul', minX: -28, maxX: 8, minZ: -20, maxZ: -12 },
      { id: 'pool-03-w', name: 'Piscina 03 · borda oeste', minX: -28, maxX: -20, minZ: -20, maxZ: 4 },
      { id: 'pool-03-e', name: 'Piscina 03 · borda leste', minX: 0, maxX: 8, minZ: -20, maxZ: 4 },
      { id: 'pool-06-n', name: 'Piscina 06 · borda norte', minX: 12, maxX: 40, minZ: -28, maxZ: -20 },
      { id: 'pool-06-s', name: 'Piscina 06 · borda sul', minX: 12, maxX: 40, minZ: -44, maxZ: -36 },
      { id: 'pool-06-w', name: 'Piscina 06 · borda oeste', minX: 12, maxX: 20, minZ: -44, maxZ: -20 },
      { id: 'pool-06-e', name: 'Piscina 06 · borda leste', minX: 32, maxX: 40, minZ: -44, maxZ: -20 },
      { id: 'pool-09-n', name: 'Piscina 09 · borda norte', minX: -40, maxX: -8, minZ: -48, maxZ: -40 },
      { id: 'pool-09-s', name: 'Piscina 09 · borda sul', minX: -40, maxX: -8, minZ: -68, maxZ: -60 },
      { id: 'pool-09-w', name: 'Piscina 09 · borda oeste', minX: -40, maxX: -32, minZ: -68, maxZ: -40 },
      { id: 'pool-09-e', name: 'Piscina 09 · borda leste', minX: -16, maxX: -8, minZ: -68, maxZ: -40 },
      { id: 'pool-stairs', name: 'Escada seca', minX: -8, maxX: 8, minZ: -100, maxZ: -84 },
    ],
    seal: {
      prime: 3,
      title: 'Selo do Terceiro Resíduo',
      inscription: 'A água retorna ao mesmo lugar módulo três.',
      position: { x: -36, z: -56 },
    },
    supplies: [
      { id: 'pool-cell-north', position: { x: 40, z: 12 } },
      { id: 'pool-cell-middle', position: { x: -24, z: -16 } },
      { id: 'pool-cell-deep', position: { x: 16, z: -32 } },
      { id: 'pool-cell-south', position: { x: -40, z: -76 } },
    ],
    cabinets: [
      {
        id: 'pool-cabinet-north', position: { x: 24, z: 20 }, rotation: Math.PI / 2,
        drawers: [
          { id: 'pool-north-1', content: 'fragment', text: 'Prancheta encharcada: "3 × 5 = 15, e 15 = 2 × 7 + 1".' },
          { id: 'pool-north-2', content: 'battery', text: 'Célula selada em saco plástico. +26% de bateria.' },
          { id: 'pool-north-3', content: 'noise', text: 'A gaveta bate no metal e o eco atravessa as três piscinas.' },
        ],
      },
      {
        id: 'pool-cabinet-mid', position: { x: 36, z: -32 }, rotation: Math.PI / 2,
        drawers: [
          { id: 'pool-mid-1', content: 'medkit', text: 'Kit de primeiros socorros lacrado. Você recupera um golpe.' },
          { id: 'pool-mid-2', content: 'empty', text: 'Óculos de natação embaçados por dentro.' },
        ],
      },
      {
        id: 'pool-cabinet-south', position: { x: -12, z: -56 }, rotation: Math.PI / 2,
        drawers: [
          { id: 'pool-south-1', content: 'empty', text: 'Toucas de natação com etiquetas ilegíveis.' },
          { id: 'pool-south-2', content: 'fragment', text: 'Azulejo riscado dentro da gaveta: "a válvula só abre com o inverso, nunca com o próprio 3".' },
          { id: 'pool-south-3', content: 'battery', text: 'Lanterna quebrada, bateria intacta. +26% de bateria.' },
        ],
      },
    ],
    enemies: [
      {
        id: 'collision-27', name: 'SHA-27 · A Colisão Afogada', number: 27, archetype: 'hash-collider',
        spawn: { x: 40, z: -84 },
        patrol: [
          { x: 40, z: -84 }, { x: -40, z: -84 }, { x: -40, z: 20 }, { x: 40, z: 20 },
        ],
      },
      {
        id: 'collision-33', name: 'MD5-33 · A Segunda Pré-Imagem', number: 33, archetype: 'hash-collider',
        spawn: { x: 6, z: -20 },
        patrol: [
          { x: 6, z: 20 }, { x: 6, z: -20 }, { x: -26, z: -20 }, { x: -26, z: 20 },
        ],
      },
    ],
    scares: [
      {
        id: 'water-level-shift', position: { x: 0, z: 20 }, radius: 3.5, minLevelElapsedMs: 3_000,
        message: 'A água subiu atrás de você sem produzir uma onda.', apparition: { x: -20, z: 20 },
      },
      {
        id: 'moving-reflection', position: { x: -24, z: -8 }, radius: 4.5, minLevelElapsedMs: 11_000,
        message: 'Seu reflexo continuou andando quando você parou.', apparition: { x: -24, z: -16 },
      },
      {
        id: 'prime-whistle', position: { x: 8, z: -68 }, radius: 4.5, minLevelElapsedMs: 20_000,
        message: 'Três assobios. O quarto veio debaixo d’água.', apparition: { x: -20, z: -68 },
      },
    ],
    lights: [
      { x: 0, z: 28, color: '#7ee8e4', intensity: 3.8, height: 3.8 },
      { x: -24, z: 20, color: '#54c8cf', intensity: 3, height: 3.6 },
      { x: 24, z: 20, color: '#54c8cf', intensity: 3, height: 3.6 },
      { x: -24, z: -8, color: '#4bb5c7', intensity: 2.8, height: 3.6 },
      { x: 16, z: -32, color: '#4bb5c7', intensity: 2.6, height: 3.6 },
      { x: -36, z: -56, color: '#3b9ca9', intensity: 2.6, height: 3.6 },
      { x: 0, z: -84, color: '#3b9ca9', intensity: 2.4, height: 3.6 },
    ],
    palette: {
      floor: '#14343a', floorEmissive: '#1d5f66', wall: '#2b5f66', wallEmissive: '#17454c',
      ceiling: '#123036', ceilingEmissive: '#0e2d33', accent: '#6ef0e4', danger: '#8c2f3a', haze: '#08282d',
    },
  }),
  defineWorld({
    id: 'hotel-23',
    theme: 'hotel',
    ceilingHeight: 3.75,
    playerStart: { x: 0, z: 27 },
    exit: { x: 0, z: -61 },
    exitRotation: 0,
    areas: [
      { id: 'hotel-lobby', name: 'Recepção do Hotel 23', minX: -12, maxX: 12, minZ: 20, maxZ: 32 },
      { id: 'hotel-corridor', name: 'Corredor sem fim', minX: -4, maxX: 4, minZ: -64, maxZ: 24 },
      { id: 'hotel-hall-05', name: 'Ala 05', minX: -28, maxX: 28, minZ: 12, maxZ: 16 },
      { id: 'hotel-left-05', name: 'Quartos 04–10', minX: -36, maxX: -12, minZ: 4, maxZ: 20 },
      { id: 'hotel-hall-11', name: 'Ala 11', minX: -28, maxX: 28, minZ: -4, maxZ: 0 },
      { id: 'hotel-right-11', name: 'Quartos 11–17', minX: 12, maxX: 36, minZ: -12, maxZ: 8 },
      { id: 'hotel-hall-17', name: 'Ala 17', minX: -28, maxX: 28, minZ: -24, maxZ: -20 },
      { id: 'hotel-left-17', name: 'Quartos 17–22', minX: -36, maxX: -12, minZ: -32, maxZ: -16 },
      { id: 'hotel-hall-23', name: 'Ala 23', minX: -28, maxX: 36, minZ: -44, maxZ: -40 },
      { id: 'hotel-room-23', name: 'Quarto 23', minX: 12, maxX: 36, minZ: -52, maxZ: -36 },
      { id: 'hotel-service', name: 'Elevador de serviço', minX: -8, maxX: 8, minZ: -68, maxZ: -56 },
    ],
    seal: {
      prime: 5,
      title: 'Selo do Hóspede Ausente',
      inscription: 'Cinco chaves. Nenhum quarto deveria existir.',
      position: { x: 28, z: -48 },
    },
    supplies: [
      { id: 'hotel-cell-05', position: { x: -28, z: 12 } },
      { id: 'hotel-cell-17', position: { x: -26, z: -28 } },
      { id: 'hotel-cell-23', position: { x: 16, z: -48 } },
    ],
    cabinets: [
      {
        id: 'hotel-cabinet-front', position: { x: -30, z: 12 }, rotation: Math.PI / 2,
        drawers: [
          { id: 'hotel-front-1', content: 'fragment', text: 'Ficha de hóspede: "17 é a décima sétima letra".' },
          { id: 'hotel-front-2', content: 'noise', text: 'A chave mestra cai no chão e quica três vezes.' },
          { id: 'hotel-front-3', content: 'battery', text: 'Rádio de camareira com bateria cheia. +26% de bateria.' },
        ],
      },
      {
        id: 'hotel-cabinet-23', position: { x: 20, z: -46 }, rotation: 0,
        drawers: [
          { id: 'hotel-23-1', content: 'empty', text: 'Lençóis dobrados. Ainda mornos.' },
          { id: 'hotel-23-2', content: 'fragment', text: 'Chave do 23: "o hotel só responde ao nome do lugar onde você dorme".' },
        ],
      },
    ],
    enemies: [
      {
        id: 'mitm-23', name: 'MITM-23 · O Homem no Meio', number: 23, archetype: 'man-in-the-middle',
        spawn: { x: 0, z: -34 },
        patrol: [
          { x: 0, z: -34 }, { x: 0, z: -4 }, { x: 0, z: -2 }, { x: 24, z: -2 },
          { x: 0, z: -2 }, { x: 0, z: -22 },
        ],
      },
      {
        id: 'mitm-46', name: 'PROXY-46 · A Chave Interceptada', number: 46, archetype: 'man-in-the-middle',
        spawn: { x: -26, z: -24 },
        patrol: [
          { x: -26, z: -24 }, { x: -14, z: -22 }, { x: 0, z: -22 },
          { x: -16, z: -22 }, { x: -24, z: -28 },
        ],
      },
    ],
    scares: [
      {
        id: 'room-23-loop', position: { x: 0, z: 2 }, radius: 3.2, minLevelElapsedMs: 3_500,
        message: 'O corredor ficou um quarto mais comprido.', apparition: { x: 0, z: -15 },
      },
      {
        id: 'dead-phone', position: { x: -18, z: -22 }, radius: 4, minLevelElapsedMs: 12_000,
        message: 'O telefone tocou dentro de uma parede. Alguém atendeu.', apparition: { x: -2, z: -22 },
      },
      {
        id: 'empty-elevator', position: { x: 0, z: -53 }, radius: 4, minLevelElapsedMs: 21_000,
        message: 'O elevador abriu. Você já estava lá dentro.', apparition: { x: 0, z: -61 },
      },
    ],
    lights: [
      { x: 0, z: 25, color: '#d8a075', intensity: 3.4, height: 3.25 },
      { x: -24, z: 12, color: '#a26a55', intensity: 2.8, height: 3.2 },
      { x: 24, z: -2, color: '#ad6f52', intensity: 2.6, height: 3.2 },
      { x: 0, z: -22, color: '#8c3f42', intensity: 2.4, height: 3.2 },
      { x: 24, z: -44, color: '#7b3340', intensity: 2.1, height: 3.2 },
    ],
    palette: {
      floor: '#271118', floorEmissive: '#3f1420', wall: '#40262a', wallEmissive: '#38131c',
      ceiling: '#1c1014', ceilingEmissive: '#2a0b13', accent: '#e1a876', danger: '#d13b52', haze: '#1d0911',
    },
  }),
  defineWorld({
    id: 'crypt-49',
    theme: 'crypt',
    ceilingHeight: 4.82,
    playerStart: { x: 0, z: 20 },
    exit: { x: 0, z: 24 },
    exitRotation: Math.PI,
    areas: [
      { id: 'crypt-vestibule', name: 'Vestíbulo do Crivo', minX: -8, maxX: 8, minZ: 12, maxZ: 28 },
      { id: 'crypt-spine', name: 'Galeria dos Riscados', minX: -4, maxX: 4, minZ: -48, maxZ: 16 },
      { id: 'crypt-ossuary-link', name: 'Passagem dos ossos', minX: -16, maxX: 0, minZ: 0, maxZ: 4 },
      { id: 'crypt-ossuary', name: 'Ossuário sem pares', minX: -36, maxX: -12, minZ: -8, maxZ: 12 },
      { id: 'crypt-archive-link', name: 'Passagem dos nomes', minX: 0, maxX: 16, minZ: -8, maxZ: -4 },
      { id: 'crypt-archive', name: 'Arquivo dos Riscados', minX: 12, maxX: 36, minZ: -24, maxZ: 8 },
      { id: 'crypt-crossroads', name: 'Átrio da Peneira', minX: -12, maxX: 12, minZ: -28, maxZ: -12 },
      { id: 'crypt-cistern-link', name: 'Passagem da cisterna', minX: -16, maxX: 0, minZ: -36, maxZ: -32 },
      { id: 'crypt-cistern', name: 'Cisterna dos Resíduos', minX: -36, maxX: -12, minZ: -52, maxZ: -24 },
      { id: 'crypt-sanctum-link', name: 'Passagem do Sete', minX: 0, maxX: 16, minZ: -44, maxZ: -40 },
      { id: 'crypt-sanctum', name: 'Santuário de 49', minX: 12, maxX: 36, minZ: -56, maxZ: -28 },
      { id: 'crypt-heart', name: 'Coração da Cripta', minX: -8, maxX: 8, minZ: -56, maxZ: -44 },
    ],
    seal: {
      prime: 7,
      title: 'Selo da Raiz de 49',
      inscription: 'Pare na raiz. Não conte a oitava sombra.',
      position: { x: 28, z: -46 },
    },
    supplies: [
      { id: 'crypt-cell-ossuary', position: { x: -18, z: -4 } },
      { id: 'crypt-cell-archive', position: { x: 18, z: 0 } },
      { id: 'crypt-cell-crossroads', position: { x: 8, z: -20 } },
      { id: 'crypt-cell-cistern', position: { x: -18, z: -48 } },
    ],
    cabinets: [
      {
        id: 'crypt-cabinet-archive', position: { x: 20, z: -4 }, rotation: 0,
        drawers: [
          { id: 'crypt-archive-1', content: 'fragment', text: 'Osso gravado: "391 não cede a 2, 3, 5, 7, 11 nem 13".' },
          { id: 'crypt-archive-2', content: 'battery', text: 'Lamparina elétrica dos coveiros. +26% de bateria.' },
          { id: 'crypt-archive-3', content: 'noise', text: 'Ossos rolam da gaveta e batem na pedra.' },
        ],
      },
      {
        id: 'crypt-cabinet-cistern', position: { x: -22, z: -46 }, rotation: 0,
        drawers: [
          { id: 'crypt-cistern-1', content: 'empty', text: 'Fichas de nomes riscados, todas iguais.' },
          { id: 'crypt-cistern-2', content: 'fragment', text: 'Lápide em miniatura: "os dois fatores estão a seis passos um do outro".' },
        ],
      },
    ],
    enemies: [
      {
        id: 'factor-49', name: 'Φ(49) · O Fatorador', number: 49, archetype: 'factoring-warden',
        spawn: { x: 20, z: -51 },
        patrol: [{ x: 20, z: -51 }, { x: 31, z: -51 }, { x: 31, z: -33 }, { x: 17, z: -33 }],
      },
      {
        id: 'factor-77', name: 'RSA-77 · O Expoente Privado', number: 77, archetype: 'factoring-warden',
        spawn: { x: -24, z: -40 },
        patrol: [{ x: -24, z: -40 }, { x: -30, z: -30 }, { x: -16, z: -30 }, { x: -18, z: -48 }],
      },
      {
        id: 'factor-91', name: 'FERMAT-91 · A Testemunha Falsa', number: 91, archetype: 'factoring-warden',
        spawn: { x: 24, z: -10 },
        patrol: [
          { x: 24, z: -10 }, { x: 16, z: -6 }, { x: 2, z: -6 },
          { x: 16, z: -6 }, { x: 18, z: 2 },
        ],
      },
    ],
    scares: [
      {
        id: 'sieve-countdown', position: { x: 0, z: -18 }, radius: 4, minLevelElapsedMs: 3_000,
        message: '49... 42... 35... alguém está peneirando você.', apparition: { x: 0, z: -34 },
      },
      {
        id: 'warden-awakens', position: { x: 12, z: -42 }, radius: 4, minLevelElapsedMs: 11_000,
        message: 'O Vigia abriu sete olhos.', apparition: { x: 27, z: -42 },
      },
      {
        id: 'false-exit', position: { x: 0, z: -40 }, radius: 3.5, minLevelElapsedMs: 16_000, requiresSeal: true,
        message: 'A placa EXIT apareceu no fundo. O elevador continua atrás de você.', apparition: { x: 0, z: -50 },
      },
    ],
    lights: [
      { x: 0, z: 17, color: '#75d99b', intensity: 3.8, height: 3.6 },
      { x: -27, z: 3, color: '#45694c', intensity: 3.4, height: 3.2 },
      { x: 27, z: -11, color: '#426d4e', intensity: 3.2, height: 3.2 },
      { x: -25, z: -39, color: '#256957', intensity: 2.8, height: 2.7 },
      { x: 27, z: -45, color: '#6b3439', intensity: 3.3, height: 3.2 },
    ],
    palette: {
      floor: '#0a1813', floorEmissive: '#123326', wall: '#0b1914', wallEmissive: '#173528',
      ceiling: '#050b08', ceilingEmissive: '#0b1711', accent: '#71f29f', danger: '#b32e43', haze: '#04100c',
    },
  }),
  defineWorld({
    id: 'server-farm-11',
    theme: 'servers',
    ceilingHeight: 4.1,
    playerStart: { x: 0, z: 24 },
    exit: { x: 0, z: 29 },
    exitRotation: Math.PI,
    areas: [
      { id: 'farm-entry', name: 'Corredor frio da entrada', minX: -8, maxX: 8, minZ: 20, maxZ: 32 },
      { id: 'farm-spine', name: 'Coluna de manutenção', minX: -4, maxX: 4, minZ: -60, maxZ: 24 },
      { id: 'farm-row-a', name: 'Fileira 03', minX: -32, maxX: 32, minZ: 8, maxZ: 16 },
      { id: 'farm-west', name: 'Racks ímpares', minX: -36, maxX: -12, minZ: -32, maxZ: 16 },
      { id: 'farm-east', name: 'Racks pares', minX: 12, maxX: 36, minZ: -32, maxZ: 16 },
      { id: 'farm-row-b', name: 'Fileira 07', minX: -32, maxX: 32, minZ: -24, maxZ: -16 },
      { id: 'farm-row-c', name: 'Fileira 11', minX: -32, maxX: 32, minZ: -44, maxZ: -36 },
      { id: 'farm-cooling', name: 'Trocadores de calor', minX: -36, maxX: -12, minZ: -56, maxZ: -36 },
      { id: 'farm-console', name: 'Console de força bruta', minX: 12, maxX: 36, minZ: -56, maxZ: -36 },
      { id: 'farm-dead-end', name: 'Sala de fitas', minX: -8, maxX: 8, minZ: -64, maxZ: -52 },
    ],
    seal: {
      prime: 11,
      title: 'Selo do Décimo Primeiro Rack',
      inscription: 'Onze tentativas por segundo. Nenhuma delas é você.',
      position: { x: 28, z: -48 },
    },
    supplies: [
      { id: 'farm-cell-west', position: { x: -28, z: 8 } },
      { id: 'farm-cell-east', position: { x: 28, z: -20 } },
      { id: 'farm-cell-cooling', position: { x: -28, z: -48 } },
    ],
    cabinets: [
      {
        id: 'farm-cabinet-spares', position: { x: -30, z: -20 }, rotation: Math.PI / 2,
        drawers: [
          { id: 'farm-spares-1', content: 'fragment', text: 'Etiqueta de rack: "2D = 0010 1101".' },
          { id: 'farm-spares-2', content: 'battery', text: 'Nobreak de bancada ainda carregado. +26% de bateria.' },
          { id: 'farm-spares-3', content: 'noise', text: 'Um rack de discos desaba dentro do armário. A varredura muda de direção.' },
        ],
      },
      {
        id: 'farm-cabinet-logs', position: { x: 20, z: -40 }, rotation: 0,
        drawers: [
          { id: 'farm-logs-1', content: 'empty', text: 'Fitas de backup rotuladas com a data de amanhã.' },
          { id: 'farm-logs-2', content: 'fragment', text: 'Log impresso: "46 = 0100 0110".' },
          { id: 'farm-logs-3', content: 'battery', text: 'Baterias de servidor, ainda quentes. +26% de bateria.' },
        ],
      },
    ],
    enemies: [
      {
        id: 'brute-11', name: 'BRUTE-11 · O Forçador', number: 11, archetype: 'brute-forcer',
        spawn: { x: 28, z: 12 },
        patrol: [{ x: 28, z: 12 }, { x: -28, z: 12 }, { x: -28, z: -20 }, { x: 28, z: -20 }],
      },
      {
        id: 'brute-121', name: 'BRUTE-121 · A Segunda Varredura', number: 121, archetype: 'brute-forcer',
        spawn: { x: 16, z: -40 },
        patrol: [{ x: 16, z: -40 }, { x: 28, z: -40 }, { x: 28, z: -50 }, { x: 16, z: -50 }],
      },
    ],
    scares: [
      {
        id: 'rack-restart', position: { x: 0, z: 18 }, radius: 3.4, minLevelElapsedMs: 3_000,
        message: 'Todos os racks reiniciaram ao mesmo tempo. Nenhum deles está ligado na tomada.',
        apparition: { x: 0, z: 6 },
      },
      {
        id: 'brute-force-sweep', position: { x: 0, z: -20 }, radius: 4, minLevelElapsedMs: 12_000,
        message: 'A varredura passou pelo seu número de série e voltou para conferir.',
        apparition: { x: -20, z: -20 },
      },
      {
        id: 'twin-serial', position: { x: 0, z: -40 }, radius: 4, minLevelElapsedMs: 21_000,
        message: 'Dois racks exibem o mesmo serial. Um deles respira.',
        apparition: { x: 20, z: -40 },
      },
    ],
    lights: [
      { x: 0, z: 24, color: '#ff9b7a', intensity: 3.6, height: 3.4 },
      { x: -24, z: 12, color: '#e2705a', intensity: 2.8, height: 3.4 },
      { x: 24, z: 12, color: '#e2705a', intensity: 2.8, height: 3.4 },
      { x: 0, z: -20, color: '#c9584d', intensity: 2.4, height: 3.4 },
      { x: 24, z: -44, color: '#ffb08c', intensity: 2.6, height: 3.4 },
    ],
    palette: {
      floor: '#231314', floorEmissive: '#43191a', wall: '#3a1e1d', wallEmissive: '#5b2019',
      ceiling: '#1d1112', ceilingEmissive: '#3a1512', accent: '#ff8f6a', danger: '#ff3b21', haze: '#210608',
    },
  }),
  defineWorld({
    id: 'cold-vault-13',
    theme: 'cold',
    ceilingHeight: 3.6,
    playerStart: { x: 0, z: 24 },
    exit: { x: 0, z: 29 },
    exitRotation: Math.PI,
    areas: [
      { id: 'vault-entry', name: 'Antecâmara de descongelamento', minX: -8, maxX: 8, minZ: 20, maxZ: 32 },
      { id: 'vault-spine', name: 'Corredor de −60 °C', minX: -4, maxX: 4, minZ: -52, maxZ: 24 },
      { id: 'vault-hall-a', name: 'Galeria das chaves mortas', minX: -28, maxX: 28, minZ: 4, maxZ: 12 },
      { id: 'vault-west', name: 'Prateleiras ímpares', minX: -32, maxX: -8, minZ: -28, maxZ: 8 },
      { id: 'vault-east', name: 'Prateleiras pares', minX: 8, maxX: 32, minZ: -28, maxZ: 8 },
      { id: 'vault-hall-b', name: 'Galeria do sal', minX: -28, maxX: 28, minZ: -24, maxZ: -16 },
      { id: 'vault-core', name: 'Núcleo do cofre', minX: -16, maxX: 16, minZ: -48, maxZ: -28 },
      { id: 'vault-shelf-west', name: 'Gavetas criogênicas ímpares', minX: -32, maxX: -12, minZ: -48, maxZ: -28 },
      { id: 'vault-shelf-east', name: 'Gavetas criogênicas pares', minX: 12, maxX: 32, minZ: -48, maxZ: -28 },
      { id: 'vault-dead', name: 'Poço de nitrogênio', minX: -8, maxX: 8, minZ: -60, maxZ: -44 },
    ],
    seal: {
      prime: 13,
      title: 'Selo da Décima Terceira Chave',
      inscription: 'A chave que ninguém revogou continua girando.',
      position: { x: 24, z: -40 },
    },
    supplies: [
      { id: 'vault-cell-hall', position: { x: -24, z: 8 } },
      { id: 'vault-cell-east', position: { x: 24, z: -20 } },
      { id: 'vault-cell-core', position: { x: 0, z: -44 } },
    ],
    cabinets: [
      {
        id: 'vault-cabinet-manual', position: { x: -24, z: -20 }, rotation: Math.PI / 2,
        drawers: [
          { id: 'vault-manual-1', content: 'fragment', text: 'Manual congelado: "2^5 = 32".' },
          { id: 'vault-manual-2', content: 'battery', text: 'Célula térmica de reserva. +26% de bateria.' },
          { id: 'vault-manual-3', content: 'noise', text: 'A gaveta congelada se solta com um estalo seco.' },
        ],
      },
      {
        id: 'vault-cabinet-keys', position: { x: -24, z: -40 }, rotation: 0,
        drawers: [
          { id: 'vault-keys-1', content: 'empty', text: 'Chaves privadas de titulares que não existem mais.' },
          { id: 'vault-keys-2', content: 'fragment', text: 'Etiqueta do cofre: "32 = 2 × 13 + resto".' },
          { id: 'vault-keys-3', content: 'battery', text: 'Lanterna de inspeção esquecida. +26% de bateria.' },
        ],
      },
    ],
    enemies: [
      {
        id: 'coldkey-13', name: 'CRIO-13 · O Guardião das Chaves', number: 13, archetype: 'cold-key-keeper',
        spawn: { x: -24, z: -32 },
        patrol: [{ x: -24, z: -32 }, { x: -24, z: -44 }, { x: -16, z: -44 }, { x: -16, z: -32 }],
      },
      {
        id: 'coldkey-26', name: 'CRIO-26 · A Chave Revogada', number: 26, archetype: 'cold-key-keeper',
        spawn: { x: 20, z: 8 },
        patrol: [{ x: 20, z: 8 }, { x: 20, z: -20 }, { x: -20, z: -20 }, { x: -20, z: 8 }],
      },
    ],
    scares: [
      {
        id: 'cold-breath', position: { x: 0, z: 18 }, radius: 3.4, minLevelElapsedMs: 3_000,
        message: 'Seu bafo congela no ar e desenha o contorno de alguém à sua frente.',
        apparition: { x: 0, z: 8 },
      },
      {
        id: 'key-thaw', position: { x: 0, z: -20 }, radius: 4, minLevelElapsedMs: 12_000,
        message: 'Uma gaveta criogênica abriu sozinha. A chave lá dentro está morna.',
        apparition: { x: -18, z: -20 },
      },
      {
        id: 'last-shard', position: { x: 0, z: -40 }, radius: 4, minLevelElapsedMs: 22_000, requiresSeal: true,
        message: 'O gelo do corredor rachou em treze pedaços. Nenhum deles derrete.',
        apparition: { x: 12, z: -40 },
      },
    ],
    lights: [
      { x: 0, z: 24, color: '#bfe6ff', intensity: 3.4, height: 3 },
      { x: -20, z: 8, color: '#8fc9e8', intensity: 2.6, height: 3 },
      { x: 20, z: 8, color: '#8fc9e8', intensity: 2.6, height: 3 },
      { x: 0, z: -20, color: '#7fb6d8', intensity: 2.3, height: 3 },
      { x: 0, z: -40, color: '#cfefff', intensity: 2.7, height: 3 },
    ],
    palette: {
      floor: '#0e2029', floorEmissive: '#16414f', wall: '#183340', wallEmissive: '#1d4b5e',
      ceiling: '#0b1a21', ceilingEmissive: '#12323f', accent: '#bfe6ff', danger: '#4fd4ff', haze: '#061a26',
    },
  }),
])

export const CATACOMBS_LEVEL_WORLDS = LEVEL_WORLDS

/** How fast the flashlight drains on a floor: the cold vault is brutal on batteries. */
export function levelDrainMultiplier(world: CatacombsLevelWorld): number {
  if (world.theme === 'cold') return 1.7
  if (world.theme === 'servers') return 1.15
  return 1
}

export function getCatacombsLevelWorld(level: number | CatacombsLevelId): CatacombsLevelWorld {
  const world = typeof level === 'number'
    ? LEVEL_WORLDS[level]
    : LEVEL_WORLDS.find((candidate) => candidate.id === level)
  if (!world) throw new RangeError(`Unknown catacombs level: ${String(level)}`)
  return world
}

export function isLevelPointWalkable(world: CatacombsLevelWorld, point: Position2D): boolean {
  return world.areas.some((area) => pointInArea(point, area))
}

export function isLevelWalkable(
  world: CatacombsLevelWorld,
  point: Position2D,
  radius = PLAYER_RADIUS,
): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z) || !Number.isFinite(radius) || radius < 0) return false
  const diagonal = radius * Math.SQRT1_2
  return [
    point,
    { x: point.x + radius, z: point.z },
    { x: point.x - radius, z: point.z },
    { x: point.x, z: point.z + radius },
    { x: point.x, z: point.z - radius },
    { x: point.x + diagonal, z: point.z + diagonal },
    { x: point.x - diagonal, z: point.z + diagonal },
    { x: point.x + diagonal, z: point.z - diagonal },
    { x: point.x - diagonal, z: point.z - diagonal },
  ].every((sample) => isLevelPointWalkable(world, sample))
}

export function resolveLevelMovement(
  world: CatacombsLevelWorld,
  current: Position2D,
  proposed: Position2D,
  radius = PLAYER_RADIUS,
): Position2D {
  if (isLevelWalkable(world, proposed, radius)) return proposed
  const alongX = { x: proposed.x, z: current.z }
  if (isLevelWalkable(world, alongX, radius)) return alongX
  const alongZ = { x: current.x, z: proposed.z }
  if (isLevelWalkable(world, alongZ, radius)) return alongZ
  return current
}

/**
 * Stalkers are solid. The player slides around a body instead of walking straight
 * through it, and an existing overlap (a creature stepping into a cornered player)
 * only allows moves that increase the separation, so nobody gets permanently stuck.
 */
export function resolveLevelMovementAroundEnemies(
  world: CatacombsLevelWorld,
  current: Position2D,
  proposed: Position2D,
  enemies: readonly Position2D[],
  radius = PLAYER_RADIUS,
): Position2D {
  const walled = resolveLevelMovement(world, current, proposed, radius)
  const contact = radius + ENEMY_BODY_RADIUS
  const clear = (point: Position2D): boolean => (
    enemies.every((enemy) => distance2D(enemy, point) >= contact)
  )
  if (clear(walled)) return walled
  if (!clear(current)) {
    const nearest = enemies.reduce(
      (closest, enemy) => (distance2D(enemy, current) < distance2D(closest, current) ? enemy : closest),
      enemies[0],
    )
    return distance2D(nearest, walled) > distance2D(nearest, current) ? walled : current
  }
  const alongX = resolveLevelMovement(world, current, { x: walled.x, z: current.z }, radius)
  if (clear(alongX)) return alongX
  const alongZ = resolveLevelMovement(world, current, { x: current.x, z: walled.z }, radius)
  if (clear(alongZ)) return alongZ
  return current
}

export function levelSectorForPosition(world: CatacombsLevelWorld, position: Position2D): string {
  const candidates = world.areas.filter((area) => pointInArea(position, area))
  const room = candidates.find((area) => !area.id.includes('link') && !area.id.includes('spine') && !area.id.includes('corridor'))
  return room?.name ?? candidates[0]?.name ?? CATACOMBS_LEVELS.find((level) => level.id === world.id)?.title ?? 'Camada desconhecida'
}

export function hasLevelLineOfSight(
  world: CatacombsLevelWorld,
  from: Position2D,
  to: Position2D,
): boolean {
  if (!isLevelPointWalkable(world, from) || !isLevelPointWalkable(world, to)) return false
  const distance = Math.hypot(to.x - from.x, to.z - from.z)
  if (!Number.isFinite(distance)) return false
  const steps = Math.max(1, Math.ceil(distance / 0.45))
  for (let index = 1; index < steps; index += 1) {
    const progress = index / steps
    if (!isLevelPointWalkable(world, {
      x: from.x + (to.x - from.x) * progress,
      z: from.z + (to.z - from.z) * progress,
    })) return false
  }
  return true
}

export function hasLevelClearPath(
  world: CatacombsLevelWorld,
  from: Position2D,
  to: Position2D,
  radius: number,
): boolean {
  const distance = Math.hypot(to.x - from.x, to.z - from.z)
  if (!Number.isFinite(distance)) return false
  const steps = Math.max(1, Math.ceil(distance / 0.25))
  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps
    if (!isLevelWalkable(world, {
      x: from.x + (to.x - from.x) * progress,
      z: from.z + (to.z - from.z) * progress,
    }, radius)) return false
  }
  return true
}

function areasConnectForRadius(first: WalkableArea, second: WalkableArea, radius: number): boolean {
  const minX = Math.max(first.minX + radius, second.minX + radius)
  const maxX = Math.min(first.maxX - radius, second.maxX - radius)
  const minZ = Math.max(first.minZ + radius, second.minZ + radius)
  const maxZ = Math.min(first.maxZ - radius, second.maxZ - radius)
  return minX <= maxX && minZ <= maxZ
}

function pointFitsArea(point: Position2D, area: WalkableArea, radius: number): boolean {
  return point.x >= area.minX + radius && point.x <= area.maxX - radius
    && point.z >= area.minZ + radius && point.z <= area.maxZ - radius
}

function areLevelPointsConnected(
  world: CatacombsLevelWorld,
  from: Position2D,
  to: Position2D,
  radius: number,
): boolean {
  const starts = world.areas
    .map((area, index) => pointFitsArea(from, area, radius) ? index : -1)
    .filter((index) => index >= 0)
  const goals = new Set(world.areas
    .map((area, index) => pointFitsArea(to, area, radius) ? index : -1)
    .filter((index) => index >= 0))
  if (starts.length === 0 || goals.size === 0) return false

  const pending = [...starts]
  const visited = new Set(starts)
  while (pending.length > 0) {
    const current = pending.shift()
    if (current === undefined) break
    if (goals.has(current)) return true
    for (let index = 0; index < world.areas.length; index += 1) {
      if (visited.has(index) || !areasConnectForRadius(world.areas[current], world.areas[index], radius)) continue
      visited.add(index)
      pending.push(index)
    }
  }
  return false
}

/** No creature may start closer than this to the player, or in plain sight. */
export const MINIMUM_SPAWN_DISTANCE = 16

/**
 * Picks the patrol point that keeps a creature far from the player and, when
 * possible, out of line of sight — so a floor never opens with a stalker already
 * breathing on the elevator door.
 */
export function chooseEnemySpawn(
  world: CatacombsLevelWorld,
  blueprint: LevelEnemyBlueprint,
  player: Position2D,
): { readonly position: Position2D; readonly waypoint: number } {
  const candidates = [blueprint.spawn, ...blueprint.patrol]
  let best = { position: blueprint.spawn, waypoint: 1, score: -Infinity }
  for (const [index, candidate] of candidates.entries()) {
    const distance = distance2D(candidate, player)
    const hidden = hasLevelLineOfSight(world, candidate, player) ? 0 : MINIMUM_SPAWN_DISTANCE
    const score = distance + hidden
    if (score > best.score) {
      const waypointIndex = index === 0
        ? 1 % blueprint.patrol.length
        : (index - 1 + 1) % blueprint.patrol.length
      best = { position: candidate, waypoint: waypointIndex, score }
    }
  }
  return { position: best.position, waypoint: best.waypoint }
}

export function createLevelEnemies(
  world: CatacombsLevelWorld,
  player: Position2D = world.playerStart,
): readonly EnemyState[] {
  return world.enemies.map((blueprint) => {
    const spawn = chooseEnemySpawn(world, blueprint, player)
    return {
      id: blueprint.id,
      x: spawn.position.x,
      z: spawn.position.z,
      mode: 'patrol' as const,
      waypoint: spawn.waypoint,
      lastKnown: { ...spawn.position },
      lostPlayerAt: 0,
      nextAttackAt: 0,
      stunnedUntil: 0,
      lightStunMs: 0,
      lightImmuneUntil: 0,
      huntingSince: 0,
      huntCooldownUntil: 0,
    }
  })
}

function distance2D(first: Position2D, second: Position2D): number {
  return Math.hypot(first.x - second.x, first.z - second.z)
}

function moveEnemy(
  world: CatacombsLevelWorld,
  current: Position2D,
  target: Position2D,
  distance: number,
): Position2D {
  const dx = target.x - current.x
  const dz = target.z - current.z
  const length = Math.hypot(dx, dz)
  if (length <= 0.0001 || distance <= 0) return current
  return resolveLevelMovement(world, current, {
    x: current.x + dx / length * Math.min(length, distance),
    z: current.z + dz / length * Math.min(length, distance),
  }, 0.38)
}

function enemyTuning(blueprint: LevelEnemyBlueprint, context: LevelEnemyStepContext): {
  readonly attackDamage: number
  readonly chaseSpeed: number
  readonly detection: number
  readonly lightStunDistance: number
  readonly patrolSpeed: number
  readonly watched: boolean
} {
  const fear = clamp(context.fear / 100, 0, 1)
  // Every archetype deals the same blow: three connected attacks end the run.
  if (blueprint.archetype === 'keylogger-wraith') {
    return {
      // Faster than a walk, slower than a sprint: the beam buys distance, not safety.
      attackDamage: HIT_DAMAGE, chaseSpeed: 3.85 + fear * 0.4,
      detection: (context.flashlightOn ? 15 : 8.5) + (context.sprinting ? 5 : 0),
      lightStunDistance: 3.4, patrolSpeed: 1.05, watched: false,
    }
  }
  if (blueprint.archetype === 'hash-collider') {
    return {
      attackDamage: HIT_DAMAGE, chaseSpeed: (context.flashlightOn ? 3.15 : 4.2) + fear * 0.3,
      detection: (context.flashlightOn ? 9.5 : 16) + (context.sprinting ? 5 : 0),
      lightStunDistance: 3.2, patrolSpeed: 0.68, watched: false,
    }
  }
  if (blueprint.archetype === 'man-in-the-middle') {
    // Freezing under the beam is paid for with speed: look away and it closes the
    // gap faster than you can walk.
    return {
      attackDamage: HIT_DAMAGE, chaseSpeed: WATCHED_ARCHETYPE_CHASE_SPEED + fear * 0.55,
      detection: 18 + (context.sprinting ? 4 : 0), lightStunDistance: 0,
      patrolSpeed: 0.92,
      watched: context.flashlightOn && context.flashlightAimDot > 0.72,
    }
  }
  if (blueprint.archetype === 'brute-forcer') {
    // Ignores the flashlight entirely and never stops sweeping: it is beaten by
    // silence and distance, not by light.
    return {
      attackDamage: HIT_DAMAGE, chaseSpeed: 2.95 + fear * 0.25,
      detection: 14 + (context.sprinting ? 6 : 0),
      lightStunDistance: 0, patrolSpeed: 1.45, watched: false,
    }
  }
  if (blueprint.archetype === 'cold-key-keeper') {
    // Always knows where you are and stands perfectly still while lit — so in the
    // dark it is the fastest thing in the campaign. Light is the only brake.
    return {
      attackDamage: HIT_DAMAGE,
      chaseSpeed: context.flashlightOn ? 0 : WATCHED_ARCHETYPE_CHASE_SPEED + 0.3 + fear * 0.45,
      detection: 90,
      lightStunDistance: 0,
      patrolSpeed: context.flashlightOn ? 0 : 1.35,
      watched: context.flashlightOn,
    }
  }
  return {
    attackDamage: HIT_DAMAGE, chaseSpeed: (context.sealCollected ? 3.55 : 2.8) + fear * 0.4,
    detection: (context.flashlightOn ? 19 : 13) + (context.sprinting ? 5 : 0),
    lightStunDistance: context.sealCollected ? 0 : 2.8, patrolSpeed: 0.72,
    watched: false,
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function stepLevelEnemy(
  initialEnemy: EnemyState,
  blueprint: LevelEnemyBlueprint,
  world: CatacombsLevelWorld,
  context: LevelEnemyStepContext,
): { readonly enemy: EnemyState; readonly damage: number } {
  let enemy = initialEnemy
  const delta = Math.min(Math.max(context.deltaSeconds, 0), 0.1)
  const distance = distance2D(enemy, context.player)
  const lineOfSight = hasLevelLineOfSight(world, enemy, context.player)
  const tuning = enemyTuning(blueprint, context)

  const beamOnIt = tuning.lightStunDistance > 0
    && context.flashlightOn
    && context.flashlightAimDot > 0.8
    && lineOfSight
    && distance < tuning.lightStunDistance
  if (beamOnIt && context.nowMs >= enemy.lightImmuneUntil) {
    const held = enemy.lightStunMs + delta * 1_000
    if (held >= LIGHT_STUN_BUDGET_MS) {
      // It adapts to the beam: staring no longer works, and it comes anyway.
      return {
        enemy: {
          ...enemy,
          mode: 'chase',
          lastKnown: { ...context.player },
          lostPlayerAt: 0,
          stunnedUntil: 0,
          lightStunMs: 0,
          lightImmuneUntil: context.nowMs + LIGHT_IMMUNITY_MS,
        },
        damage: 0,
      }
    }
    return {
      enemy: {
        ...enemy,
        mode: 'stunned',
        stunnedUntil: Math.max(enemy.stunnedUntil, context.nowMs + 620),
        nextAttackAt: Math.max(enemy.nextAttackAt, context.nowMs + 950),
        lightStunMs: held,
      },
      damage: 0,
    }
  }
  // The budget refills only while the light is off it.
  const recoveredStunMs = beamOnIt
    ? enemy.lightStunMs
    : Math.max(0, enemy.lightStunMs - delta * 700)
  enemy = { ...enemy, lightStunMs: recoveredStunMs }
  if (enemy.stunnedUntil > context.nowMs) return { enemy: { ...enemy, mode: 'stunned' }, damage: 0 }

  const alreadyAlert = enemy.mode === 'chase' || enemy.mode === 'attack' || enemy.mode === 'search'
  const seesPlayer = lineOfSight && distance <= tuning.detection + (alreadyAlert ? 3 : 0)

  // A pulled drawer is louder than footsteps: everything nearby comes to look,
  // even archetypes that cannot see the player from there.
  const noise = context.noise
  if (
    noise
    && context.nowMs - noise.atMs < 2_600
    && distance2D(enemy, noise.position) <= NOISE_HEARING_RADIUS * noise.intensity
    && !seesPlayer
    && enemy.mode !== 'attack'
  ) {
    const heard = { x: noise.position.x, z: noise.position.z }
    const step = Math.min(
      tuning.chaseSpeed * 0.7 * delta,
      Math.max(0, distance2D(enemy, heard) - 0.4),
    )
    const target = nextPathPoint(world, enemy, heard) ?? heard
    const moved = moveEnemy(world, enemy, target, step)
    return {
      enemy: { ...enemy, ...moved, mode: 'search', lastKnown: heard, lostPlayerAt: context.nowMs },
      damage: 0,
    }
  }

  if (blueprint.archetype === 'cold-key-keeper' && tuning.watched) {
    // Frozen in place while lit, but it keeps its bearings for when the light dies.
    return {
      enemy: {
        ...enemy,
        mode: seesPlayer || alreadyAlert ? 'search' : enemy.mode,
        lastKnown: seesPlayer ? { ...context.player } : enemy.lastKnown,
        lostPlayerAt: seesPlayer ? context.nowMs : enemy.lostPlayerAt,
      },
      damage: 0,
    }
  }

  if (blueprint.archetype === 'man-in-the-middle' && tuning.watched && lineOfSight && distance < 24) {
    return {
      enemy: {
        ...enemy,
        mode: seesPlayer || alreadyAlert ? 'search' : enemy.mode,
        lastKnown: seesPlayer ? { ...context.player } : enemy.lastKnown,
        lostPlayerAt: seesPlayer ? context.nowMs : enemy.lostPlayerAt,
      },
      damage: 0,
    }
  }

  if (distance <= 1.4 && (seesPlayer || enemy.mode === 'chase')) {
    const canAttack = context.nowMs >= enemy.nextAttackAt
    return {
      enemy: {
        ...enemy,
        mode: 'attack',
        lastKnown: { ...context.player },
        lostPlayerAt: 0,
        nextAttackAt: canAttack ? context.nowMs + 1_800 : enemy.nextAttackAt,
      },
      damage: canAttack ? tuning.attackDamage : 0,
    }
  }

  if (seesPlayer && context.nowMs >= enemy.huntCooldownUntil) {
    const huntingSince = enemy.huntingSince || context.nowMs
    if (context.nowMs - huntingSince > MAX_HUNT_MS) {
      // Winded: it breaks off and leaves the player a window to move.
      return {
        enemy: {
          ...enemy,
          mode: 'patrol',
          huntingSince: 0,
          huntCooldownUntil: context.nowMs + HUNT_COOLDOWN_MS,
          lostPlayerAt: 0,
        },
        damage: 0,
      }
    }
    // The longer it has you, the faster it comes — up to a fair ceiling.
    const rampSeconds = Math.max(0, (context.nowMs - huntingSince) / 1_000)
    const ramp = 1 + Math.min(CHASE_RAMP_MAX, rampSeconds * CHASE_RAMP_PER_SECOND)
    const approach = Math.min(
      tuning.chaseSpeed * ramp * delta,
      Math.max(0, distance - (ENEMY_BODY_RADIUS + PLAYER_RADIUS)),
    )
    const target = nextPathPoint(world, enemy, context.player) ?? context.player
    const moved = moveEnemy(world, enemy, target, approach)
    return {
      enemy: {
        ...enemy,
        ...moved,
        mode: 'chase',
        lastKnown: { ...context.player },
        lostPlayerAt: 0,
        huntingSince,
      },
      damage: 0,
    }
  }

  if (alreadyAlert) {
    const lostPlayerAt = enemy.lostPlayerAt || context.nowMs
    if (context.nowMs - lostPlayerAt < SEARCH_MEMORY_MS && distance2D(enemy, enemy.lastKnown) > 0.55) {
      const search = Math.min(
        tuning.chaseSpeed * 0.62 * delta,
        Math.max(0, distance - (ENEMY_BODY_RADIUS + PLAYER_RADIUS)),
      )
      const searchTarget = nextPathPoint(world, enemy, enemy.lastKnown) ?? enemy.lastKnown
      const moved = moveEnemy(world, enemy, searchTarget, search)
      return { enemy: { ...enemy, ...moved, mode: 'search', lostPlayerAt }, damage: 0 }
    }
  }

  // Drift towards a distant player rather than looping a route they never cross.
  if (
    distance > STALK_MINIMUM_DISTANCE
    && context.nowMs >= enemy.huntCooldownUntil
    && tuning.patrolSpeed > 0
  ) {
    const drift = nextPathPoint(world, enemy, context.player) ?? context.player
    const moved = moveEnemy(world, enemy, drift, tuning.patrolSpeed * STALK_SPEED_SCALE * delta)
    return {
      enemy: { ...enemy, ...moved, mode: 'patrol', lostPlayerAt: 0, huntingSince: 0 },
      damage: 0,
    }
  }

  const target = blueprint.patrol[enemy.waypoint] ?? blueprint.patrol[0]
  const reached = distance2D(enemy, target) < 0.5
  const waypoint = reached ? (enemy.waypoint + 1) % blueprint.patrol.length : enemy.waypoint
  const nextTarget = blueprint.patrol[waypoint] ?? blueprint.patrol[0]
  const patrolTarget = nextPathPoint(world, enemy, nextTarget) ?? nextTarget
  const moved = moveEnemy(world, enemy, patrolTarget, tuning.patrolSpeed * delta)
  return {
    enemy: { ...enemy, ...moved, mode: 'patrol', waypoint, lostPlayerAt: 0, huntingSince: 0 },
    damage: 0,
  }
}

export function validateCatacombsLevelWorlds(): readonly string[] {
  const errors: string[] = []
  for (const [levelIndex, world] of LEVEL_WORLDS.entries()) {
    const definition = CATACOMBS_LEVELS[levelIndex]
    if (!definition || definition.id !== world.id) errors.push(`${world.id}:campaign-order`)
    if (definition && definition.sealPrime !== world.seal.prime) errors.push(`${world.id}:campaign-seal`)

    const eventIds = new Set(world.scares.map((scare) => scare.id))
    if (definition) {
      for (const event of definition.events) {
        if (!eventIds.has(event)) errors.push(`${world.id}:missing-event:${event}`)
      }
      for (const event of eventIds) {
        if (!definition.events.includes(event)) errors.push(`${world.id}:unexpected-event:${event}`)
      }
    }

    const entityIds = [
      ...world.areas.map((area) => `area:${area.id}`),
      ...world.supplies.map((supply) => `supply:${supply.id}`),
      ...world.cabinets.map((cabinet) => `cabinet:${cabinet.id}`),
      ...world.cabinets.flatMap((cabinet) => cabinet.drawers.map((drawer) => `drawer:${drawer.id}`)),
      ...world.enemies.map((enemy) => `enemy:${enemy.id}`),
      ...world.scares.map((scare) => `scare:${scare.id}`),
    ]
    if (new Set(entityIds).size !== entityIds.length) errors.push(`${world.id}:duplicate-entity-id`)

    for (const area of world.areas) {
      if (
        !Number.isFinite(area.minX) || !Number.isFinite(area.maxX)
        || !Number.isFinite(area.minZ) || !Number.isFinite(area.maxZ)
        || area.minX >= area.maxX || area.minZ >= area.maxZ
      ) errors.push(`${world.id}:area:${area.id}:bounds`)
    }

    const points: ReadonlyArray<readonly [string, Position2D, number]> = [
      ['playerStart', world.playerStart, PLAYER_RADIUS],
      ['exit', world.exit, PLAYER_RADIUS],
      ['seal', world.seal.position, 0.2],
      ...world.supplies.map((supply) => [`supply:${supply.id}`, supply.position, 0.2] as const),
      ...world.cabinets.map((cabinet) => [`cabinet:${cabinet.id}`, cabinet.position, 0.6] as const),
      ...world.enemies.flatMap((enemy) => [
        [`enemy:${enemy.id}:spawn`, enemy.spawn, 0.38] as const,
        ...enemy.patrol.map((point, index) => [`enemy:${enemy.id}:patrol:${index}`, point, 0.38] as const),
      ]),
      ...world.scares.flatMap((scare) => [
        [`scare:${scare.id}`, scare.position, 0.2] as const,
        ...(scare.apparition
          ? [[`scare:${scare.id}:apparition`, scare.apparition, 0] as const]
          : []),
      ]),
      ...world.lights.map((light, index) => [`light:${index}`, light, 0] as const),
    ]
    for (const [label, point, radius] of points) {
      if (!isLevelWalkable(world, point, radius)) errors.push(`${world.id}:${label}`)
    }

    const reachablePoints: ReadonlyArray<readonly [string, Position2D]> = [
      ['exit', world.exit],
      ['seal', world.seal.position],
      ...world.supplies.map((supply) => [`supply:${supply.id}`, supply.position] as const),
      ...world.cabinets.map((cabinet) => [`cabinet:${cabinet.id}`, cabinet.position] as const),
    ]
    for (const [label, point] of reachablePoints) {
      if (!areLevelPointsConnected(world, world.playerStart, point, PLAYER_RADIUS)) {
        errors.push(`${world.id}:${label}:unreachable`)
      }
    }

    // Every floor must hide at least as many clue fragments as its elevator cipher
    // needs, otherwise the puzzle would be unsolvable from exploration alone.
    const fragments = world.cabinets.reduce(
      (total, cabinet) => total + cabinet.drawers.filter((drawer) => drawer.content === 'fragment').length,
      0,
    )
    const puzzle = ELEVATOR_PUZZLES.find((candidate) => candidate.levelId === world.id)
    if (!puzzle) errors.push(`${world.id}:missing-elevator-puzzle`)
    else if (fragments < puzzle.fragments.length) errors.push(`${world.id}:missing-fragments`)

    for (const enemy of world.enemies) {
      if (enemy.patrol.length < 2) errors.push(`${world.id}:enemy:${enemy.id}:patrol-empty`)
      if (definition && enemy.archetype !== definition.enemy) {
        errors.push(`${world.id}:enemy:${enemy.id}:archetype`)
      }
      for (let index = 0; index < enemy.patrol.length; index += 1) {
        const from = enemy.patrol[index]
        const to = enemy.patrol[(index + 1) % enemy.patrol.length]
        if (!from || !to || !hasLevelClearPath(world, from, to, 0.38)) {
          errors.push(`${world.id}:enemy:${enemy.id}:patrol-path:${index}`)
        }
      }
    }

    for (const scare of world.scares) {
      if (!Number.isFinite(scare.radius) || scare.radius <= 0) errors.push(`${world.id}:scare:${scare.id}:radius`)
      if (!Number.isFinite(scare.minLevelElapsedMs) || scare.minLevelElapsedMs < 0) {
        errors.push(`${world.id}:scare:${scare.id}:timing`)
      }
    }
  }
  return errors
}
