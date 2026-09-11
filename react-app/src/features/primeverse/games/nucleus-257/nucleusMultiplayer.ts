import type { InterpolatedTransform } from '../primeverse-online/network/interpolation'
import type { OnlineConnectionStatus } from '../primeverse-online/network/PrimeverseOnlineClient'
import type {
  NucleusCombatPlayer,
  NucleusCombatState,
  NucleusHeroId,
} from '../primeverse-online/shared/protocol'
import { getHeroKit } from './classKits'
import type { CombatStatusState, CombatantState, Vec3 } from './types'

const LOCAL_RECONCILIATION_DISTANCE = 3.5

export function canUseNucleusOnlineControls(
  ready: boolean,
  connectionStatus: OnlineConnectionStatus,
): boolean {
  return ready && connectionStatus === 'online'
}

export function cinematicLocksArenaControls(
  mode: 'solo' | 'online',
  cinematicActive: boolean,
): boolean {
  return mode === 'solo' && cinematicActive
}

export function isNucleusRemoteSampleFresh(
  sample: InterpolatedTransform | null,
  authoritativeServerTime: number,
): sample is InterpolatedTransform {
  return sample !== null && sample.serverTime >= authoritativeServerTime
}

export function hasAcknowledgedNucleusJoin(
  state: NucleusCombatState | null,
  playerId: string | null,
  heroId: NucleusHeroId,
): boolean {
  return state?.players.some((player) => (
    player.id === playerId
    && player.connected
    && player.heroId === heroId
  )) ?? false
}

function distance(first: Vec3, second: Vec3): number {
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z)
}

function facingFromYaw(yaw: number): Vec3 {
  return Object.freeze({ x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) })
}

function statusRecord(player: NucleusCombatPlayer): CombatStatusState {
  return Object.freeze(Object.fromEntries(player.statuses.map((status) => [
    status.id,
    Object.freeze({ id: status.id, expiresAtMs: status.expiresAt, magnitude: status.magnitude }),
  ])))
}

export function combatantFromNucleusPlayer(
  player: NucleusCombatPlayer,
  previous: CombatantState | undefined,
  localPlayerId: string | null,
): CombatantState {
  const kit = getHeroKit(player.heroId)
  const preservePredictedTransform = player.id === localPlayerId
    && previous !== undefined
    && previous.alive
    && player.alive
    && distance(previous.position, player.position) <= LOCAL_RECONCILIATION_DISTANCE
  const position = preservePredictedTransform ? previous.position : player.position
  const facing = preservePredictedTransform ? previous.facing : facingFromYaw(player.yaw)

  return Object.freeze({
    id: player.id,
    heroId: player.heroId,
    team: player.team,
    bot: false,
    position: Object.freeze({ ...position }),
    spawnPosition: previous?.spawnPosition ?? Object.freeze({ ...player.position }),
    facing,
    health: player.health,
    maxHealth: player.maxHealth,
    shield: player.shield,
    maxShield: player.maxShield,
    hitRadius: kit.stats.hitRadius,
    alive: player.alive,
    cooldownReadyAtMs: Object.freeze({ ...player.cooldownReadyAt }),
    statuses: statusRecord(player),
    ultimateCharge: player.ultimateCharge,
    eliminations: player.eliminations,
    deaths: player.deaths,
    respawnAtMs: player.respawnAt,
  })
}

/**
 * Rebuild combat vitals from the server while retaining only the small amount
 * of local movement prediction needed for responsive first-person controls.
 */
export function reconcileNucleusRoster(
  current: readonly CombatantState[],
  state: NucleusCombatState,
  localPlayerId: string | null,
): readonly CombatantState[] {
  const previousById = new Map(current.map((combatant) => [combatant.id, combatant]))
  return Object.freeze(state.players
    .filter((player) => player.connected)
    .map((player) => combatantFromNucleusPlayer(player, previousById.get(player.id), localPlayerId)))
}

export function nucleusOpponents(
  combatants: readonly CombatantState[],
  localPlayerId: string | null,
): readonly CombatantState[] {
  const local = combatants.find((combatant) => combatant.id === localPlayerId)
  if (!local) return []
  return combatants.filter((combatant) => combatant.id !== local.id && combatant.team !== local.team)
}

/** Camera-space bearing: 0° front, +90° right, -90° left and 180° behind. */
export function cameraRelativeBearingDegrees(
  observer: Pick<Vec3, 'x' | 'z'>,
  source: Pick<Vec3, 'x' | 'z'>,
  yaw: number,
): number {
  const dx = source.x - observer.x
  const dz = source.z - observer.z
  const sin = Math.sin(yaw)
  const cos = Math.cos(yaw)
  const right = dx * cos - dz * sin
  const forward = -dx * sin - dz * cos
  return Math.atan2(right, forward) * 180 / Math.PI
}
