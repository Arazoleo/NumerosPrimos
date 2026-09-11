export interface Position2D {
  readonly x: number
  readonly z: number
}

export interface WalkableArea {
  readonly id: string
  readonly name: string
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

export interface MapTile extends Position2D {
  readonly id: string
}

export interface WallSegment extends Position2D {
  readonly id: string
  readonly rotation: number
}

export interface SealDefinition {
  readonly prime: 2 | 3 | 5 | 7
  readonly title: string
  readonly sector: string
  readonly position: Position2D
  readonly inscription: string
}

export interface SupplyDefinition {
  readonly id: string
  readonly position: Position2D
}

export type EnemyMode = 'patrol' | 'search' | 'chase' | 'attack' | 'stunned'

export interface EnemyBlueprint {
  readonly id: string
  readonly name: string
  readonly number: number
  readonly spawn: Position2D
  readonly patrol: readonly Position2D[]
}

export interface EnemyState extends Position2D {
  readonly id: string
  readonly mode: EnemyMode
  readonly waypoint: number
  readonly lastKnown: Position2D
  readonly lostPlayerAt: number
  readonly nextAttackAt: number
  readonly stunnedUntil: number
  /** Milliseconds this creature has already been held by the beam. */
  readonly lightStunMs: number
  /** When the current hunt began, so a chase cannot last forever. */
  readonly huntingSince: number
  /** Until this timestamp the creature refuses to re-acquire: the player's breather. */
  readonly huntCooldownUntil: number
  /** After the budget runs out the beam stops working until this timestamp. */
  readonly lightImmuneUntil: number
}

/** A creature can only be pinned by the flashlight for so long before adapting. */
export const LIGHT_STUN_BUDGET_MS = 2_400
/** How long the beam is useless on it afterwards. */
export const LIGHT_IMMUNITY_MS = 5_000

export type GamePhase = 'playing' | 'won' | 'lost'

export interface CatacombsGameState {
  readonly phase: GamePhase
  readonly health: number
  readonly battery: number
  readonly flashlightOn: boolean
  readonly collectedPrimes: readonly number[]
  readonly collectedSupplies: readonly string[]
  readonly elapsedMs: number
  readonly invulnerableUntil: number
  readonly message: string
  readonly messageUntil: number
}

export interface EnemyStepContext {
  readonly player: Position2D
  readonly flashlightOn: boolean
  readonly flashlightAimDot: number
  readonly sprinting: boolean
  readonly nowMs: number
  readonly deltaSeconds: number
}

export interface EnemyStepResult {
  readonly enemy: EnemyState
  readonly damage: number
}

export const CELL_SIZE = 4
export const PLAYER_RADIUS = 0.48
/** Solid torso radius: the creatures block movement instead of being walked through. */
export const ENEMY_BODY_RADIUS = 0.72
export const MAX_PLAYER_HITS = 3
/**
 * Mercy window after a hit. Long enough to break away from a creature that is
 * faster than you walk — without it, three hits land in under three seconds and
 * the run is over before the player can react.
 */
export const HIT_INVULNERABILITY_MS = 1_500
/** Three connected attacks end the run, whatever the archetype. */
export const HIT_DAMAGE = 100 / MAX_PLAYER_HITS
export const PLAYER_START = Object.freeze({ x: 0, z: 20 })
export const EXIT_POSITION = Object.freeze({ x: 0, z: 24 })
export const SEAL_ORDER = Object.freeze([2, 3, 5, 7] as const)
export const INTERACTION_DISTANCE = 2.65
export const FLASHLIGHT_DRAIN_PER_SECOND = 1.25
export const FLASHLIGHT_RECOVERY_PER_SECOND = 1.35
export const FLASHLIGHT_RESTART_THRESHOLD = 8

/**
 * The rooms deliberately cover a much larger footprint than the multiplayer
 * vignette. Overlapping connector rectangles make the whole dungeon traversable
 * while still allowing deterministic, dependency-free collision tests.
 */
export const WALKABLE_AREAS: readonly WalkableArea[] = Object.freeze([
  { id: 'vestibule', name: 'Vestíbulo do Crivo', minX: -8, maxX: 8, minZ: 12, maxZ: 28 },
  { id: 'spine', name: 'Galeria dos Riscados', minX: -4, maxX: 4, minZ: -48, maxZ: 16 },
  { id: 'ossuary-link', name: 'Passagem do Dois', minX: -16, maxX: 0, minZ: 0, maxZ: 4 },
  { id: 'ossuary', name: 'Ossuário dos Pares', minX: -36, maxX: -12, minZ: -8, maxZ: 12 },
  { id: 'archive-link', name: 'Passagem do Três', minX: 0, maxX: 16, minZ: -8, maxZ: -4 },
  { id: 'archive', name: 'Arquivo dos Múltiplos', minX: 12, maxX: 36, minZ: -24, maxZ: 8 },
  { id: 'crossroads', name: 'Átrio da Peneira', minX: -12, maxX: 12, minZ: -28, maxZ: -12 },
  { id: 'cistern-link', name: 'Passagem do Cinco', minX: -16, maxX: 0, minZ: -36, maxZ: -32 },
  { id: 'cistern', name: 'Cisterna dos Resíduos', minX: -36, maxX: -12, minZ: -52, maxZ: -24 },
  { id: 'sanctum-link', name: 'Passagem do Sete', minX: 0, maxX: 16, minZ: -44, maxZ: -40 },
  { id: 'sanctum', name: 'Santuário do Último Primo', minX: 12, maxX: 36, minZ: -56, maxZ: -28 },
  { id: 'heart', name: 'Coração da Cripta', minX: -8, maxX: 8, minZ: -56, maxZ: -44 },
])

export const SEALS: readonly SealDefinition[] = Object.freeze([
  {
    prime: 2,
    title: 'Selo dos Pares',
    sector: 'Ossuário dos Pares',
    position: { x: -28, z: 4 },
    inscription: 'Risque todo segundo nome.',
  },
  {
    prime: 3,
    title: 'Selo dos Tríplices',
    sector: 'Arquivo dos Múltiplos',
    position: { x: 28, z: -12 },
    inscription: 'O próximo sobrevivente é três.',
  },
  {
    prime: 5,
    title: 'Selo dos Resíduos',
    sector: 'Cisterna dos Resíduos',
    position: { x: -28, z: -42 },
    inscription: 'Depois de dois e três, resta cinco.',
  },
  {
    prime: 7,
    title: 'Selo da Última Peneira',
    sector: 'Santuário do Último Primo',
    position: { x: 28, z: -46 },
    inscription: 'Até a raiz de quarenta e nove.',
  },
])

export const SUPPLIES: readonly SupplyDefinition[] = Object.freeze([
  { id: 'cell-ossuary', position: { x: -18, z: -4 } },
  { id: 'cell-archive', position: { x: 18, z: 0 } },
  { id: 'cell-crossroads', position: { x: 8, z: -20 } },
  { id: 'cell-cistern', position: { x: -18, z: -48 } },
])

export const ENEMY_BLUEPRINTS: readonly EnemyBlueprint[] = Object.freeze([
  {
    id: 'warden-21',
    name: 'O Vigésimo Primeiro',
    number: 21,
    spawn: { x: -20, z: 7 },
    patrol: [{ x: -20, z: 7 }, { x: -31, z: 7 }, { x: -31, z: -4 }, { x: -17, z: -4 }],
  },
  {
    id: 'warden-35',
    name: 'O Resíduo de Trinta e Cinco',
    number: 35,
    spawn: { x: 21, z: -18 },
    patrol: [{ x: 21, z: -18 }, { x: 31, z: -18 }, { x: 31, z: 2 }, { x: 17, z: 2 }],
  },
  {
    id: 'warden-49',
    name: 'A Sombra de Quarenta e Nove',
    number: 49,
    spawn: { x: 20, z: -51 },
    patrol: [{ x: 20, z: -51 }, { x: 31, z: -51 }, { x: 31, z: -33 }, { x: 17, z: -33 }],
  },
])

function pointInArea(point: Position2D, area: WalkableArea): boolean {
  return point.x >= area.minX && point.x <= area.maxX && point.z >= area.minZ && point.z <= area.maxZ
}

export function isPointWalkable(point: Position2D): boolean {
  return WALKABLE_AREAS.some((area) => pointInArea(point, area))
}

export function isWalkable(point: Position2D, radius = PLAYER_RADIUS): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z) || !Number.isFinite(radius) || radius < 0) return false
  const diagonal = radius * Math.SQRT1_2
  const samples: readonly Position2D[] = [
    point,
    { x: point.x + radius, z: point.z },
    { x: point.x - radius, z: point.z },
    { x: point.x, z: point.z + radius },
    { x: point.x, z: point.z - radius },
    { x: point.x + diagonal, z: point.z + diagonal },
    { x: point.x - diagonal, z: point.z + diagonal },
    { x: point.x + diagonal, z: point.z - diagonal },
    { x: point.x - diagonal, z: point.z - diagonal },
  ]
  return samples.every(isPointWalkable)
}

export function resolveMovement(current: Position2D, proposed: Position2D, radius = PLAYER_RADIUS): Position2D {
  if (isWalkable(proposed, radius)) return proposed
  const alongX = { x: proposed.x, z: current.z }
  if (isWalkable(alongX, radius)) return alongX
  const alongZ = { x: current.x, z: proposed.z }
  if (isWalkable(alongZ, radius)) return alongZ
  return current
}

export function sectorForPosition(position: Position2D): string {
  const candidates = WALKABLE_AREAS.filter((area) => pointInArea(position, area))
  const namedRoom = candidates.find((area) => !area.id.includes('link') && area.id !== 'spine')
  return namedRoom?.name ?? candidates[0]?.name ?? 'Além da cripta'
}

function createMapGeometry(): { readonly tiles: readonly MapTile[]; readonly walls: readonly WallSegment[] } {
  const tiles: MapTile[] = []
  for (let x = -34; x <= 34; x += CELL_SIZE) {
    for (let z = -54; z <= 26; z += CELL_SIZE) {
      if (isPointWalkable({ x, z })) tiles.push({ id: `${x}:${z}`, x, z })
    }
  }
  const tileKeys = new Set(tiles.map((tile) => tile.id))
  const walls: WallSegment[] = []
  for (const tile of tiles) {
    const neighbours = [
      { dx: 0, dz: -CELL_SIZE, x: tile.x, z: tile.z - CELL_SIZE / 2, rotation: 0 },
      { dx: 0, dz: CELL_SIZE, x: tile.x, z: tile.z + CELL_SIZE / 2, rotation: 0 },
      { dx: -CELL_SIZE, dz: 0, x: tile.x - CELL_SIZE / 2, z: tile.z, rotation: Math.PI / 2 },
      { dx: CELL_SIZE, dz: 0, x: tile.x + CELL_SIZE / 2, z: tile.z, rotation: Math.PI / 2 },
    ]
    for (const neighbour of neighbours) {
      if (!tileKeys.has(`${tile.x + neighbour.dx}:${tile.z + neighbour.dz}`)) {
        walls.push({
          id: `${tile.id}:${neighbour.dx}:${neighbour.dz}`,
          x: neighbour.x,
          z: neighbour.z,
          rotation: neighbour.rotation,
        })
      }
    }
  }
  return { tiles: Object.freeze(tiles), walls: Object.freeze(walls) }
}

const MAP_GEOMETRY = createMapGeometry()
export const MAP_TILES = MAP_GEOMETRY.tiles
export const WALL_SEGMENTS = MAP_GEOMETRY.walls

/** Health is stored as a percentage, but the HUD and the fiction count whole hits. */
export function hitsRemaining(health: number): number {
  if (!Number.isFinite(health) || health <= 0) return 0
  return Math.min(MAX_PLAYER_HITS, Math.ceil(health / HIT_DAMAGE - 1e-6))
}

export function isPrime(value: number): boolean {
  if (!Number.isInteger(value) || value < 2) return false
  for (let divisor = 2; divisor * divisor <= value; divisor += 1) {
    if (value % divisor === 0) return false
  }
  return true
}

export function sieveSurvivors(limit: number, appliedPrimes: readonly number[]): readonly number[] {
  if (!Number.isInteger(limit) || limit < 2) return []
  return Array.from({ length: limit - 1 }, (_, index) => index + 2).filter((candidate) => (
    !appliedPrimes.some((prime) => candidate !== prime && candidate % prime === 0)
  ))
}

export function expectedSealPrime(collectedPrimes: readonly number[]): (typeof SEAL_ORDER)[number] | null {
  return SEAL_ORDER[collectedPrimes.length] ?? null
}

export function createInitialGameState(nowMs = 0): CatacombsGameState {
  return {
    phase: 'playing',
    health: 100,
    battery: 100,
    flashlightOn: true,
    collectedPrimes: [],
    collectedSupplies: [],
    elapsedMs: 0,
    invulnerableUntil: nowMs,
    message: 'Encontre o Selo 2 no Ossuário dos Pares.',
    messageUntil: nowMs + 7_000,
  }
}

export function toggleFlashlight(state: CatacombsGameState, nowMs: number): CatacombsGameState {
  if (state.phase !== 'playing') return state
  if (!state.flashlightOn && state.battery < FLASHLIGHT_RESTART_THRESHOLD) {
    return { ...state, message: `Carga de emergência: espere a bateria chegar a ${FLASHLIGHT_RESTART_THRESHOLD}%.`, messageUntil: nowMs + 2_400 }
  }
  const flashlightOn = !state.flashlightOn
  return {
    ...state,
    flashlightOn,
    message: flashlightOn ? 'A luz revela. A luz também denuncia.' : 'Lanterna apagada. Seus passos ainda fazem ruído.',
    messageUntil: nowMs + 2_400,
  }
}

export function advanceGameState(
  state: CatacombsGameState,
  deltaSeconds: number,
  nowMs: number,
  /** Cold floors eat the battery faster; 1 is the baseline drain. */
  drainMultiplier = 1,
): CatacombsGameState {
  if (state.phase !== 'playing' || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return state
  const delta = Math.min(deltaSeconds, 0.1)
  const drain = Number.isFinite(drainMultiplier) && drainMultiplier > 0 ? drainMultiplier : 1
  const battery = state.flashlightOn
    ? Math.max(0, state.battery - FLASHLIGHT_DRAIN_PER_SECOND * drain * delta)
    : Math.min(100, state.battery + FLASHLIGHT_RECOVERY_PER_SECOND * delta)
  const depleted = state.flashlightOn && battery <= 0
  return {
    ...state,
    battery,
    flashlightOn: depleted ? false : state.flashlightOn,
    elapsedMs: state.elapsedMs + delta * 1_000,
    message: depleted ? 'A lanterna apagou.' : state.message,
    messageUntil: depleted ? nowMs + 2_500 : state.messageUntil,
  }
}

export function applyDamage(
  state: CatacombsGameState,
  amount: number,
  nowMs: number,
  attackerName: string,
): CatacombsGameState {
  if (state.phase !== 'playing' || nowMs < state.invulnerableUntil || amount <= 0) return state
  const health = Math.max(0, state.health - amount)
  const remaining = hitsRemaining(health)
  return {
    ...state,
    phase: health <= 0 ? 'lost' : 'playing',
    health,
    invulnerableUntil: nowMs + HIT_INVULNERABILITY_MS,
    message: health <= 0
      ? `${attackerName} apagou seu nome do Crivo.`
      : `${attackerName} te alcançou. ${remaining === 1 ? 'MAIS UM GOLPE E ACABOU.' : `Restam ${remaining} golpes.`}`,
    messageUntil: nowMs + 3_200,
  }
}

export function interactWithWorld(
  state: CatacombsGameState,
  player: Position2D,
  nowMs: number,
): CatacombsGameState {
  if (state.phase !== 'playing') return state
  const nearbySupply = SUPPLIES.find((supply) => (
    !state.collectedSupplies.includes(supply.id) && distance2D(player, supply.position) <= INTERACTION_DISTANCE
  ))
  if (nearbySupply) {
    return {
      ...state,
      battery: Math.min(100, state.battery + 36),
      collectedSupplies: [...state.collectedSupplies, nearbySupply.id],
      message: 'Célula de emergência: +36% de bateria.',
      messageUntil: nowMs + 2_600,
    }
  }

  const nearbySeal = SEALS.find((seal) => distance2D(player, seal.position) <= INTERACTION_DISTANCE)
  if (nearbySeal && !state.collectedPrimes.includes(nearbySeal.prime)) {
    const expected = expectedSealPrime(state.collectedPrimes)
    if (nearbySeal.prime !== expected) {
      return {
        ...state,
        message: `O Crivo rejeita ${nearbySeal.prime}. Encontre ${expected} primeiro.`,
        messageUntil: nowMs + 3_000,
      }
    }
    const collectedPrimes = [...state.collectedPrimes, nearbySeal.prime]
    const next = expectedSealPrime(collectedPrimes)
    return {
      ...state,
      collectedPrimes,
      battery: Math.min(100, state.battery + 15),
      health: Math.min(100, state.health + 12),
      message: next === null
        ? 'A peneira está completa. Volte ao elevador do Vestíbulo!'
        : `Selo ${nearbySeal.prime} purificado. Agora procure ${next}.`,
      messageUntil: nowMs + 4_600,
    }
  }

  if (distance2D(player, EXIT_POSITION) <= INTERACTION_DISTANCE + 0.6) {
    if (state.collectedPrimes.length < SEAL_ORDER.length) {
      return {
        ...state,
        message: `A saída exige quatro selos. Faltam ${SEAL_ORDER.length - state.collectedPrimes.length}.`,
        messageUntil: nowMs + 3_000,
      }
    }
    return {
      ...state,
      phase: 'won',
      flashlightOn: false,
      message: 'Você escapou da Cripta do Crivo.',
      messageUntil: Number.POSITIVE_INFINITY,
    }
  }

  return { ...state, message: 'Nada responde aqui.', messageUntil: nowMs + 1_500 }
}

export function getInteractionPrompt(
  state: CatacombsGameState,
  player: Position2D,
): string | null {
  const supply = SUPPLIES.find((item) => (
    !state.collectedSupplies.includes(item.id) && distance2D(player, item.position) <= INTERACTION_DISTANCE
  ))
  if (supply) return 'E  RECOLHER CÉLULA'
  const seal = SEALS.find((item) => (
    !state.collectedPrimes.includes(item.prime) && distance2D(player, item.position) <= INTERACTION_DISTANCE
  ))
  if (seal) return `E  PURIFICAR SELO ${seal.prime}`
  if (distance2D(player, EXIT_POSITION) <= INTERACTION_DISTANCE + 0.6) {
    return state.collectedPrimes.length === SEAL_ORDER.length ? 'E  ESCAPAR DA CRIPTA' : 'E  EXAMINAR SAÍDA SELADA'
  }
  return null
}

export function objectiveForState(state: CatacombsGameState): string {
  if (state.phase === 'won') return 'Expedição concluída'
  if (state.phase === 'lost') return 'Você foi riscado do Crivo'
  const next = expectedSealPrime(state.collectedPrimes)
  if (next === null) return 'RETORNE AO ELEVADOR · VESTÍBULO'
  const seal = SEALS.find((candidate) => candidate.prime === next)
  return `ENCONTRE O SELO ${next} · ${seal?.sector.toUpperCase() ?? ''}`
}

export function createInitialEnemies(): readonly EnemyState[] {
  return ENEMY_BLUEPRINTS.map((blueprint) => ({
    id: blueprint.id,
    x: blueprint.spawn.x,
    z: blueprint.spawn.z,
    mode: 'patrol',
    waypoint: 1,
    lastKnown: blueprint.spawn,
    lostPlayerAt: 0,
    nextAttackAt: 0,
    stunnedUntil: 0,
    lightStunMs: 0,
    lightImmuneUntil: 0,
    huntingSince: 0,
    huntCooldownUntil: 0,
  }))
}

export function detectionRange(flashlightOn: boolean, sprinting: boolean, alreadyChasing = false): number {
  return (flashlightOn ? 14.5 : 7) + (sprinting ? 4 : 0) + (alreadyChasing ? 3.5 : 0)
}

export function stepEnemy(enemy: EnemyState, context: EnemyStepContext): EnemyStepResult {
  const blueprint = ENEMY_BLUEPRINTS.find((candidate) => candidate.id === enemy.id)
  if (!blueprint) return { enemy, damage: 0 }
  const delta = Math.min(Math.max(context.deltaSeconds, 0), 0.1)
  const distance = distance2D(enemy, context.player)

  if (context.flashlightOn && context.flashlightAimDot > 0.78 && distance < 4.4) {
    return {
      enemy: {
        ...enemy,
        mode: 'stunned',
        stunnedUntil: Math.max(enemy.stunnedUntil, context.nowMs + 720),
        nextAttackAt: Math.max(enemy.nextAttackAt, context.nowMs + 1_000),
      },
      damage: 0,
    }
  }
  if (enemy.stunnedUntil > context.nowMs) return { enemy: { ...enemy, mode: 'stunned' }, damage: 0 }

  const seesPlayer = distance <= detectionRange(
    context.flashlightOn,
    context.sprinting,
    enemy.mode === 'chase' || enemy.mode === 'attack',
  )
  if (distance <= 1.35 && (seesPlayer || enemy.mode === 'chase')) {
    const canAttack = context.nowMs >= enemy.nextAttackAt
    return {
      enemy: {
        ...enemy,
        mode: 'attack',
        lastKnown: context.player,
        lostPlayerAt: 0,
        nextAttackAt: canAttack ? context.nowMs + 1_450 : enemy.nextAttackAt,
      },
      damage: canAttack ? 22 : 0,
    }
  }

  if (seesPlayer) {
    const moved = moveToward(enemy, context.player, 2.65 * delta, 0.38)
    return {
      enemy: {
        ...enemy,
        ...moved,
        mode: 'chase',
        lastKnown: context.player,
        lostPlayerAt: 0,
      },
      damage: 0,
    }
  }

  if (enemy.mode === 'chase' || enemy.mode === 'attack' || enemy.mode === 'search') {
    const lostPlayerAt = enemy.lostPlayerAt || context.nowMs
    if (context.nowMs - lostPlayerAt < 4_000 && distance2D(enemy, enemy.lastKnown) > 0.55) {
      const moved = moveToward(enemy, enemy.lastKnown, 1.6 * delta, 0.38)
      return { enemy: { ...enemy, ...moved, mode: 'search', lostPlayerAt }, damage: 0 }
    }
  }

  const target = blueprint.patrol[enemy.waypoint] ?? blueprint.patrol[0]
  const reached = distance2D(enemy, target) < 0.5
  const waypoint = reached ? (enemy.waypoint + 1) % blueprint.patrol.length : enemy.waypoint
  const nextTarget = blueprint.patrol[waypoint] ?? blueprint.patrol[0]
  const moved = moveToward(enemy, nextTarget, 0.78 * delta, 0.38)
  return {
    enemy: { ...enemy, ...moved, mode: 'patrol', waypoint, lostPlayerAt: 0 },
    damage: 0,
  }
}

function moveToward(current: Position2D, target: Position2D, distance: number, radius: number): Position2D {
  const dx = target.x - current.x
  const dz = target.z - current.z
  const length = Math.hypot(dx, dz)
  if (length <= 0.0001 || distance <= 0) return current
  return resolveMovement(current, {
    x: current.x + dx / length * Math.min(length, distance),
    z: current.z + dz / length * Math.min(length, distance),
  }, radius)
}

export function distance2D(first: Position2D, second: Position2D): number {
  return Math.hypot(first.x - second.x, first.z - second.z)
}
