export const BACKROOMS_ENTITY_STATES = [
  'dormant',
  'patrol',
  'investigate',
  'chase',
  'stunned',
] as const

export type BackroomsEntityState = (typeof BACKROOMS_ENTITY_STATES)[number]

export interface BackroomsPoint {
  readonly x: number
  readonly z: number
}

export interface BackroomsEntityConfig {
  readonly id: string
  readonly spawn: BackroomsPoint
  readonly patrolWaypoints: readonly BackroomsPoint[]
  readonly patrolSpeed: number
  readonly investigateSpeed: number
  readonly chaseSpeed: number
  readonly darkSightRadius: number
  readonly litSightRadius: number
  readonly flashlightSightBonus: number
  readonly hearingRadius: number
  readonly minimumNoise: number
  readonly noisePersistenceMs: number
  readonly investigateTelegraphMs: number
  readonly investigateLingerMs: number
  readonly chaseMemoryMs: number
  readonly chaseAttackGraceMs: number
  readonly attackRadius: number
  readonly attackDamage: number
  readonly attackCooldownMs: number
  readonly stunDurationMs: number
  readonly waypointReachRadius: number
}

/**
 * Default tuning intentionally makes the entity slower than a sprinting player.
 * Terror comes from information and route choice, not an unavoidable stat check.
 */
export const DEFAULT_BACKROOMS_ENTITY_CONFIG: BackroomsEntityConfig = Object.freeze({
  id: 'backrooms-remainder',
  spawn: Object.freeze({ x: -9.5, z: -16 }),
  patrolWaypoints: Object.freeze([
    Object.freeze({ x: -9.5, z: -16 }),
    Object.freeze({ x: 8.5, z: -16 }),
    Object.freeze({ x: 8.5, z: -33 }),
    Object.freeze({ x: -7.5, z: -33 }),
    Object.freeze({ x: -7.5, z: -49 }),
    Object.freeze({ x: 7, z: -49 }),
  ]),
  patrolSpeed: 0.92,
  investigateSpeed: 1.42,
  chaseSpeed: 3.35,
  darkSightRadius: 4.2,
  litSightRadius: 8.6,
  flashlightSightBonus: 5.4,
  hearingRadius: 13.5,
  minimumNoise: 0.16,
  noisePersistenceMs: 1_800,
  investigateTelegraphMs: 1_250,
  investigateLingerMs: 2_600,
  chaseMemoryMs: 2_200,
  chaseAttackGraceMs: 520,
  attackRadius: 1.18,
  attackDamage: 24,
  attackCooldownMs: 1_900,
  stunDurationMs: 3_200,
  waypointReachRadius: 0.38,
})

export interface BackroomsNoiseStimulus {
  /** 0 is silent, 1 is a loud sprint, impact or failed interaction. */
  readonly level: number
  readonly position: BackroomsPoint
  /** Old sounds fade deterministically and are ignored after noisePersistenceMs. */
  readonly ageMs?: number
}

export interface BackroomsEntityStimulus {
  /** False keeps the entity asleep regardless of all other stimulus values. */
  readonly active: boolean
  readonly playerPosition: BackroomsPoint
  /** The scene resolves walls/doors and supplies this explicit visibility result. */
  readonly hasLineOfSight: boolean
  readonly playerHidden?: boolean
  /** 0 is near darkness, 1 is strong environmental light. */
  readonly ambientLight: number
  readonly flashlightOn: boolean
  /** True only while the flashlight cone actually intersects the entity. */
  readonly flashlightHitsEntity: boolean
  readonly noise?: BackroomsNoiseStimulus | null
  /** An edge-triggered stun request, for example a completed defensive puzzle. */
  readonly stunRequested?: boolean
}

export type BackroomsPerceptionCause = 'none' | 'sight' | 'flashlight' | 'noise'

export interface BackroomsPerception {
  readonly cause: BackroomsPerceptionCause
  readonly seesPlayer: boolean
  readonly hearsNoise: boolean
  readonly playerDistance: number
  readonly sightRadius: number
  readonly hearingRadius: number
  readonly interestPosition: BackroomsPoint | null
}

export interface BackroomsEntityRuntime {
  readonly state: BackroomsEntityState
  readonly position: BackroomsPoint
  readonly yaw: number
  readonly elapsedMs: number
  readonly stateEnteredAtMs: number
  readonly awakenStartedAtMs: number | null
  readonly patrolWaypointIndex: number
  readonly investigationTarget: BackroomsPoint | null
  readonly lastKnownPlayerPosition: BackroomsPoint | null
  readonly lastSenseAtMs: number
  readonly nextAttackAtMs: number
  readonly stunnedUntilMs: number
  readonly eventSerial: number
}

export type BackroomsEntityEventKind =
  | 'wake-warning'
  | 'patrol-start'
  | 'notice'
  | 'chase-start'
  | 'lost-player'
  | 'attack'
  | 'stunned'
  | 'recovered'
  | 'sleep'

export interface BackroomsEntityEvent {
  readonly serial: number
  readonly kind: BackroomsEntityEventKind
  readonly atMs: number
  readonly position: BackroomsPoint
  readonly cause?: BackroomsPerceptionCause
  readonly damage?: number
}

export interface BackroomsEntityStepResult {
  readonly runtime: BackroomsEntityRuntime
  readonly perception: BackroomsPerception
  readonly events: readonly BackroomsEntityEvent[]
  readonly attacked: boolean
}

export type BackroomsTelegraphKind = 'none' | 'waking' | 'listening' | 'pursuit' | 'recovery'

export interface BackroomsEntityTelegraph {
  readonly kind: BackroomsTelegraphKind
  readonly progress: number
  readonly attackLocked: boolean
  readonly label: string | null
}

const WAKE_WARNING_MS = 900
const MAX_STEP_MS = 100

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function finitePoint(point: BackroomsPoint, fallback: BackroomsPoint): BackroomsPoint {
  return {
    x: Number.isFinite(point.x) ? point.x : fallback.x,
    z: Number.isFinite(point.z) ? point.z : fallback.z,
  }
}

export function backroomsDistance(first: BackroomsPoint, second: BackroomsPoint): number {
  return Math.hypot(first.x - second.x, first.z - second.z)
}

function facePoint(from: BackroomsPoint, target: BackroomsPoint, fallback: number): number {
  const dx = target.x - from.x
  const dz = target.z - from.z
  return Math.abs(dx) + Math.abs(dz) < 0.0001 ? fallback : Math.atan2(dx, dz)
}

function moveToward(from: BackroomsPoint, target: BackroomsPoint, maximumDistance: number): BackroomsPoint {
  const dx = target.x - from.x
  const dz = target.z - from.z
  const length = Math.hypot(dx, dz)
  if (length < 0.0001 || maximumDistance <= 0) return from
  const ratio = Math.min(1, maximumDistance / length)
  return { x: from.x + dx * ratio, z: from.z + dz * ratio }
}

function normalizedConfig(config: BackroomsEntityConfig): BackroomsEntityConfig {
  if (config.patrolWaypoints.length > 0) return config
  return { ...config, patrolWaypoints: [config.spawn] }
}

export function createBackroomsEntityRuntime(
  config: BackroomsEntityConfig = DEFAULT_BACKROOMS_ENTITY_CONFIG,
): BackroomsEntityRuntime {
  const safeConfig = normalizedConfig(config)
  return {
    state: 'dormant',
    position: finitePoint(safeConfig.spawn, { x: 0, z: 0 }),
    yaw: 0,
    elapsedMs: 0,
    stateEnteredAtMs: 0,
    awakenStartedAtMs: null,
    patrolWaypointIndex: safeConfig.patrolWaypoints.length > 1 ? 1 : 0,
    investigationTarget: null,
    lastKnownPlayerPosition: null,
    lastSenseAtMs: 0,
    nextAttackAtMs: 0,
    stunnedUntilMs: 0,
    eventSerial: 0,
  }
}

/**
 * Converts scene-provided light, visibility and noise into one inspectable signal.
 * No raycasting happens here: walls remain the scene's authority via hasLineOfSight.
 */
export function evaluateBackroomsPerception(
  runtime: BackroomsEntityRuntime,
  rawConfig: BackroomsEntityConfig,
  stimulus: BackroomsEntityStimulus,
): BackroomsPerception {
  const config = normalizedConfig(rawConfig)
  const playerPosition = finitePoint(stimulus.playerPosition, runtime.position)
  const playerDistance = backroomsDistance(runtime.position, playerPosition)
  const ambientLight = clamp01(stimulus.ambientLight)
  const environmentRadius = config.darkSightRadius +
    (config.litSightRadius - config.darkSightRadius) * ambientLight
  const flashlightGlow = stimulus.flashlightOn ? config.flashlightSightBonus * 0.28 : 0
  const directBeam = stimulus.flashlightHitsEntity ? config.flashlightSightBonus : 0
  const sightRadius = Math.max(0, environmentRadius + flashlightGlow + directBeam)
  const hidden = stimulus.playerHidden === true && !stimulus.flashlightHitsEntity
  const seesPlayer = stimulus.active && stimulus.hasLineOfSight && !hidden && playerDistance <= sightRadius

  const noise = stimulus.noise
  const noiseAge = Math.max(0, noise?.ageMs ?? 0)
  const ageFactor = noise && config.noisePersistenceMs > 0
    ? clamp01(1 - noiseAge / config.noisePersistenceMs)
    : noise ? 1 : 0
  const effectiveNoise = clamp01(noise?.level ?? 0) * ageFactor
  const hearingRadius = Math.max(0, config.hearingRadius * Math.sqrt(effectiveNoise))
  const noisePosition = noise ? finitePoint(noise.position, playerPosition) : playerPosition
  const hearsNoise = stimulus.active && effectiveNoise >= config.minimumNoise &&
    backroomsDistance(runtime.position, noisePosition) <= hearingRadius

  const cause: BackroomsPerceptionCause = seesPlayer
    ? stimulus.flashlightHitsEntity ? 'flashlight' : 'sight'
    : hearsNoise ? 'noise' : 'none'

  return {
    cause,
    seesPlayer,
    hearsNoise,
    playerDistance,
    sightRadius,
    hearingRadius,
    interestPosition: seesPlayer ? playerPosition : hearsNoise ? noisePosition : null,
  }
}

export function getBackroomsEntityTelegraph(
  runtime: BackroomsEntityRuntime,
  rawConfig: BackroomsEntityConfig = DEFAULT_BACKROOMS_ENTITY_CONFIG,
): BackroomsEntityTelegraph {
  const config = normalizedConfig(rawConfig)
  const stateAge = Math.max(0, runtime.elapsedMs - runtime.stateEnteredAtMs)
  if (runtime.state === 'dormant' && runtime.awakenStartedAtMs !== null) {
    return {
      kind: 'waking',
      progress: clamp01((runtime.elapsedMs - runtime.awakenStartedAtMs) / WAKE_WARNING_MS),
      attackLocked: true,
      label: 'Algo despertou atrás das paredes.',
    }
  }
  if (runtime.state === 'investigate') {
    return {
      kind: 'listening',
      progress: clamp01(stateAge / Math.max(1, config.investigateTelegraphMs)),
      attackLocked: true,
      label: 'Ele ouviu alguma coisa.',
    }
  }
  if (runtime.state === 'chase') {
    const progress = clamp01(stateAge / Math.max(1, config.chaseAttackGraceMs))
    return {
      kind: 'pursuit',
      progress,
      attackLocked: progress < 1,
      label: progress < 1 ? 'CORRA' : 'Ele está próximo.',
    }
  }
  if (runtime.state === 'stunned') {
    return {
      kind: 'recovery',
      progress: clamp01(1 - (runtime.stunnedUntilMs - runtime.elapsedMs) / Math.max(1, config.stunDurationMs)),
      attackLocked: true,
      label: 'A entidade está atordoada.',
    }
  }
  return { kind: 'none', progress: 0, attackLocked: true, label: null }
}

export function stepBackroomsEntity(
  previous: BackroomsEntityRuntime,
  rawConfig: BackroomsEntityConfig,
  stimulus: BackroomsEntityStimulus,
  rawDeltaMs: number,
): BackroomsEntityStepResult {
  const config = normalizedConfig(rawConfig)
  const deltaMs = Math.max(0, Math.min(Number.isFinite(rawDeltaMs) ? rawDeltaMs : 0, MAX_STEP_MS))
  const elapsedMs = previous.elapsedMs + deltaMs
  const perception = evaluateBackroomsPerception(previous, config, stimulus)
  let state = previous.state
  let position = previous.position
  let yaw = previous.yaw
  let stateEnteredAtMs = previous.stateEnteredAtMs
  let awakenStartedAtMs = previous.awakenStartedAtMs
  let patrolWaypointIndex = previous.patrolWaypointIndex % config.patrolWaypoints.length
  let investigationTarget = previous.investigationTarget
  let lastKnownPlayerPosition = previous.lastKnownPlayerPosition
  let lastSenseAtMs = previous.lastSenseAtMs
  let nextAttackAtMs = previous.nextAttackAtMs
  let stunnedUntilMs = previous.stunnedUntilMs
  let eventSerial = previous.eventSerial
  let attacked = false
  const events: BackroomsEntityEvent[] = []

  const emit = (
    kind: BackroomsEntityEventKind,
    at: BackroomsPoint = position,
    details?: Pick<BackroomsEntityEvent, 'cause' | 'damage'>,
  ) => {
    eventSerial += 1
    events.push({ serial: eventSerial, kind, atMs: elapsedMs, position: at, ...details })
  }
  const enter = (nextState: BackroomsEntityState) => {
    state = nextState
    stateEnteredAtMs = elapsedMs
  }

  if (!stimulus.active) {
    if (state !== 'dormant' || awakenStartedAtMs !== null) emit('sleep')
    return {
      runtime: {
        ...previous,
        state: 'dormant',
        elapsedMs,
        stateEnteredAtMs: state === 'dormant' ? previous.stateEnteredAtMs : elapsedMs,
        awakenStartedAtMs: null,
        investigationTarget: null,
        lastKnownPlayerPosition: null,
        lastSenseAtMs: 0,
        nextAttackAtMs: Math.max(previous.nextAttackAtMs, elapsedMs),
        stunnedUntilMs: 0,
        eventSerial,
      },
      perception,
      events,
      attacked: false,
    }
  }

  if (state === 'dormant') {
    if (awakenStartedAtMs === null) {
      awakenStartedAtMs = elapsedMs
      emit('wake-warning')
    } else if (elapsedMs - awakenStartedAtMs >= WAKE_WARNING_MS) {
      enter('patrol')
      awakenStartedAtMs = null
      emit('patrol-start')
    }
  }

  if (stimulus.stunRequested && state !== 'dormant' && state !== 'stunned') {
    enter('stunned')
    stunnedUntilMs = elapsedMs + Math.max(0, config.stunDurationMs)
    investigationTarget = null
    emit('stunned')
  }

  if (state === 'stunned') {
    if (elapsedMs >= stunnedUntilMs) {
      if (lastKnownPlayerPosition) {
        enter('investigate')
        investigationTarget = lastKnownPlayerPosition
      } else {
        enter('patrol')
      }
      emit('recovered')
    }
  } else if (state === 'patrol' && perception.cause !== 'none' && perception.interestPosition) {
    enter('investigate')
    investigationTarget = perception.interestPosition
    lastSenseAtMs = elapsedMs
    if (perception.seesPlayer) lastKnownPlayerPosition = perception.interestPosition
    emit('notice', perception.interestPosition, { cause: perception.cause })
  } else if (state === 'investigate') {
    if (perception.cause !== 'none' && perception.interestPosition) {
      investigationTarget = perception.interestPosition
      lastSenseAtMs = elapsedMs
      if (perception.seesPlayer) lastKnownPlayerPosition = perception.interestPosition
    }
    const telegraphComplete = elapsedMs - stateEnteredAtMs >= Math.max(0, config.investigateTelegraphMs)
    if (telegraphComplete && perception.seesPlayer) {
      enter('chase')
      lastKnownPlayerPosition = finitePoint(stimulus.playerPosition, position)
      lastSenseAtMs = elapsedMs
      emit('chase-start', lastKnownPlayerPosition, { cause: perception.cause })
    } else if (
      telegraphComplete &&
      investigationTarget &&
      backroomsDistance(position, investigationTarget) <= config.waypointReachRadius &&
      elapsedMs - lastSenseAtMs >= config.investigateLingerMs
    ) {
      enter('patrol')
      investigationTarget = null
    }
  } else if (state === 'chase') {
    if (perception.cause !== 'none' && perception.interestPosition) {
      lastSenseAtMs = elapsedMs
      if (perception.seesPlayer) lastKnownPlayerPosition = perception.interestPosition
      else if (!lastKnownPlayerPosition) lastKnownPlayerPosition = perception.interestPosition
    }
    if (elapsedMs - lastSenseAtMs > Math.max(0, config.chaseMemoryMs)) {
      enter('investigate')
      investigationTarget = lastKnownPlayerPosition ?? position
      emit('lost-player', investigationTarget)
    } else {
      const chaseAge = elapsedMs - stateEnteredAtMs
      if (
        perception.seesPlayer &&
        perception.playerDistance <= config.attackRadius &&
        chaseAge >= config.chaseAttackGraceMs &&
        elapsedMs >= nextAttackAtMs
      ) {
        attacked = true
        nextAttackAtMs = elapsedMs + Math.max(0, config.attackCooldownMs)
        emit('attack', finitePoint(stimulus.playerPosition, position), { cause: perception.cause, damage: config.attackDamage })
      }
    }
  }

  let movementTarget: BackroomsPoint | null = null
  let movementSpeed = 0
  if (state === 'patrol') {
    let waypoint = config.patrolWaypoints[patrolWaypointIndex]
    if (backroomsDistance(position, waypoint) <= config.waypointReachRadius) {
      patrolWaypointIndex = (patrolWaypointIndex + 1) % config.patrolWaypoints.length
      waypoint = config.patrolWaypoints[patrolWaypointIndex]
    }
    movementTarget = waypoint
    movementSpeed = config.patrolSpeed
  } else if (state === 'investigate' && investigationTarget) {
    const telegraphComplete = elapsedMs - stateEnteredAtMs >= Math.max(0, config.investigateTelegraphMs)
    if (telegraphComplete) {
      movementTarget = investigationTarget
      movementSpeed = config.investigateSpeed
    }
  } else if (state === 'chase') {
    movementTarget = perception.seesPlayer
      ? finitePoint(stimulus.playerPosition, position)
      : lastKnownPlayerPosition
    movementSpeed = config.chaseSpeed
  }

  if (movementTarget && state !== 'stunned') {
    yaw = facePoint(position, movementTarget, yaw)
    position = moveToward(position, movementTarget, Math.max(0, movementSpeed) * deltaMs / 1_000)
  }

  return {
    runtime: {
      state,
      position,
      yaw,
      elapsedMs,
      stateEnteredAtMs,
      awakenStartedAtMs,
      patrolWaypointIndex,
      investigationTarget,
      lastKnownPlayerPosition,
      lastSenseAtMs,
      nextAttackAtMs,
      stunnedUntilMs,
      eventSerial,
    },
    perception,
    events,
    attacked,
  }
}

export function stepDefaultBackroomsEntity(
  previous: BackroomsEntityRuntime,
  stimulus: BackroomsEntityStimulus,
  deltaMs: number,
): BackroomsEntityStepResult {
  return stepBackroomsEntity(previous, DEFAULT_BACKROOMS_ENTITY_CONFIG, stimulus, deltaMs)
}
