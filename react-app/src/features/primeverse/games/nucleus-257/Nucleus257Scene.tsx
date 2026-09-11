import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

import type { QualityLevel } from '../../graphics/useQualitySettings'
import type { NucleusTeamId } from '../primeverse-online/shared/protocol'
import {
  PYLON_CAPTURE_MS,
  PYLON_SEQUENCE,
  activePylon,
  advanceObjective,
  castAbility,
  chooseBotDecision,
  clearExpiredStatuses,
  cooldownRemainingMs,
  createCombatant,
  createObjectiveState,
  gainUltimateCharge,
  getCastBlockReason,
  isStatusActive,
  normalizeDirection,
  selectAimTarget,
  tickCombatants,
} from './arenaLogic'
import {
  ARENA_PYLONS,
  PLAYER_HEIGHT,
  PLAYER_SPAWNS,
  hasArenaLineOfSight,
  resolveArenaAbilityMovement,
  resolveArenaMovement,
  spawnForIndex,
} from './arenaWorld'
import { getHeroKit } from './classKits'
import {
  FirstPersonHands,
  PowerEffect,
  type ArenaPowerEffect,
  type CastSignal,
} from './Nucleus257Effects'
import CombatantAvatar from './Nucleus257CombatantAvatar'
import Nucleus257World from './Nucleus257World'
import {
  canUseNucleusOnlineControls,
  cameraRelativeBearingDegrees,
  isNucleusRemoteSampleFresh,
  nucleusOpponents,
  reconcileNucleusRoster,
} from './nucleusMultiplayer'
import type { NucleusMultiplayerMatch } from './useNucleusMultiplayer'
import type {
  AbilityDefinition,
  AbilityCastResult,
  AbilityMechanic,
  AbilitySlot,
  ArenaObjectiveState,
  CombatantState,
  HeroId,
  PylonPrime,
  Vec3,
} from './types'

export interface ArenaControls {
  readonly keys: Set<string>
  primaryHeld: boolean
  primaryPulse: number
  signaturePulse: number
  mobilityPulse: number
  ultimatePulse: number
  jumpPulse: number
}

export interface ArenaLook {
  yaw: number
  pitch: number
}

export type ArenaEnding = 'victory' | 'timeout'

export interface ArenaHudSnapshot {
  readonly nowMs: number
  readonly elapsedMs: number
  readonly remainingMs: number
  readonly player: CombatantState
  readonly objective: ArenaObjectiveState
  readonly activePrime: PylonPrime
  readonly captureProgress: number
  readonly captureContested: boolean
  readonly playerInsideObjective: boolean
  readonly livingEnemies: number
  readonly targetId: string | null
  readonly hitMarkerUntil: number
  /** Floating damage numbers for hits the player landed, newest last. */
  readonly damageNumbers: readonly ArenaDamageNumber[]
  /** Set while a combo detonation is worth celebrating on screen. */
  readonly comboUntil: number
  readonly damageFlashUntil: number
  readonly damageBearingDegrees: number
  readonly message: string
  readonly messageUntil: number
  readonly cooldowns: Readonly<Record<AbilitySlot, number>>
  readonly online: boolean
  readonly onlinePhase: 'solo' | 'connecting' | 'reconnecting' | 'offline' | 'blocked' | 'waiting' | 'active'
  readonly connectedPlayers: number
  readonly localTeam: NucleusTeamId
  readonly killFeed: readonly ArenaKillFeedEntry[]
}

/** How early a press is still remembered when an ability is on cooldown. */
const CAST_BUFFER_WINDOW_MS = 420

export interface ArenaDamageNumber {
  readonly id: number
  readonly amount: number
  readonly atMs: number
  readonly combo: boolean
  readonly lethal: boolean
}

export interface ArenaKillFeedEntry {
  readonly id: string
  readonly text: string
  readonly atMs: number
}

interface Nucleus257SceneBaseProps {
  readonly heroId: HeroId
  readonly controls: React.MutableRefObject<ArenaControls>
  readonly look: React.MutableRefObject<ArenaLook>
  readonly active: boolean
  readonly quality: QualityLevel
  readonly reducedMotion: boolean
  readonly onSnapshot: (snapshot: ArenaHudSnapshot) => void
  readonly onCinematic: (ability: AbilityDefinition) => void
  readonly onEnd: (ending: ArenaEnding, snapshot: ArenaHudSnapshot) => void
}

interface Nucleus257SceneProps extends Nucleus257SceneBaseProps {
  readonly multiplayer: NucleusMultiplayerMatch
}

const PLAYER_ID = 'operator:local'
const BOT_IDS = ['fracture:12', 'fracture:18', 'fracture:25', 'fracture:35', 'fracture:49'] as const
const BOT_HEROES: readonly HeroId[] = ['raul-rsa', 'teo-gemeos', 'luma-crivo', 'yara-diffie', 'teo-gemeos']
const MATCH_DURATION_MS = 4 * 60 * 1_000
const SNAPSHOT_INTERVAL_MS = 80
const GROUND_Y = 0.05
const BOT_CAST_SPACING_MS = 350

interface BotCastIntent {
  readonly executeAtMs: number
  readonly slot: AbilitySlot
  readonly targetId: string
  readonly aim: { readonly direction: Vec3; readonly point?: Vec3 }
}

function botWindupMs(slot: AbilitySlot): number {
  if (slot === 'ultimate') return 1_050
  if (slot === 'signature') return 780
  if (slot === 'mobility') return 420
  return 480
}

function lockedBotAim(
  aim: { readonly direction: Vec3; readonly point?: Vec3 },
  ability: AbilityDefinition,
  botIndex: number,
  serial: number,
): BotCastIntent['aim'] {
  // A deterministic breathing error keeps tests/replays stable while avoiding
  // perfect center tracking. Close shots remain credible; long rays can miss.
  const phase = (serial + 1) * 2.399 + botIndex * 1.731
  const maxYawError = ability.slot === 'primary' ? 2.4 : ability.slot === 'signature' ? 1.5 : 0.9
  const yawError = Math.sin(phase) * maxYawError * Math.PI / 180
  const cos = Math.cos(yawError)
  const sin = Math.sin(yawError)
  const direction = normalizeDirection({
    x: aim.direction.x * cos - aim.direction.z * sin,
    y: aim.direction.y,
    z: aim.direction.x * sin + aim.direction.z * cos,
  })

  if (ability.movement) return Object.freeze({ direction })
  if (ability.hitShape.kind === 'radius' && ability.hitShape.center === 'aim' && aim.point) {
    const miss = Math.sin(phase * 1.37) * (ability.slot === 'ultimate' ? 1.4 : 1)
    const horizontal = Math.hypot(aim.direction.x, aim.direction.z)
    const sideX = horizontal > 1e-6 ? -aim.direction.z / horizontal : 1
    const sideZ = horizontal > 1e-6 ? aim.direction.x / horizontal : 0
    return Object.freeze({
      direction,
      point: Object.freeze({
        x: aim.point.x + sideX * miss,
        y: aim.point.y,
        z: aim.point.z + sideZ * miss,
      }),
    })
  }
  return Object.freeze({
    direction,
    ...(aim.point === undefined ? {} : { point: Object.freeze({ ...aim.point }) }),
  })
}

function onlinePhase(match: NucleusMultiplayerMatch): ArenaHudSnapshot['onlinePhase'] {
  if (match.partyStatus === 'blocked') return 'blocked'
  if (match.connectionStatus === 'reconnecting') return 'reconnecting'
  if (match.connectionStatus === 'offline' || match.connectionStatus === 'error') return 'offline'
  if (!match.ready) return 'connecting'
  return match.state?.phase ?? 'connecting'
}

export function createArenaControls(): ArenaControls {
  return {
    keys: new Set(),
    primaryHeld: false,
    primaryPulse: 0,
    signaturePulse: 0,
    mobilityPulse: 0,
    ultimatePulse: 0,
    jumpPulse: 0,
  }
}

function emptyCooldowns(): Readonly<Record<AbilitySlot, number>> {
  return { primary: 0, signature: 0, mobility: 0, ultimate: 0 }
}

export function createInitialArenaSnapshot(heroId: HeroId, nowMs = 0): ArenaHudSnapshot {
  const player = createCombatant({
    id: PLAYER_ID,
    heroId,
    team: 'cipher',
    position: PLAYER_SPAWNS[0],
  })
  return {
    nowMs,
    elapsedMs: 0,
    remainingMs: MATCH_DURATION_MS,
    player,
    objective: createObjectiveState(),
    activePrime: 2,
    captureProgress: 0,
    captureContested: false,
    playerInsideObjective: false,
    livingEnemies: BOT_IDS.length,
    targetId: null,
    hitMarkerUntil: 0,
    damageNumbers: [],
    comboUntil: 0,
    damageFlashUntil: 0,
    damageBearingDegrees: 0,
    message: 'Domine o pylon 2. As Sentinelas já estão em movimento.',
    messageUntil: nowMs + 5_000,
    cooldowns: emptyCooldowns(),
    online: false,
    onlinePhase: 'solo',
    connectedPlayers: 1,
    localTeam: 'cipher',
    killFeed: [],
  }
}

function createRoster(heroId: HeroId): readonly CombatantState[] {
  const player = createCombatant({
    id: PLAYER_ID,
    heroId,
    team: 'cipher',
    position: spawnForIndex(0),
  })
  const bots = BOT_IDS.map((id, index) => createCombatant({
    id,
    heroId: BOT_HEROES[index],
    team: 'fracture',
    bot: true,
    position: spawnForIndex(index, true),
    facing: normalizeDirection({ x: -spawnForIndex(index, true).x, y: 0, z: -spawnForIndex(index, true).z }),
  }))
  return Object.freeze([player, ...bots])
}

function replaceCombatant(
  combatants: readonly CombatantState[],
  id: string,
  replacement: CombatantState,
): readonly CombatantState[] {
  return combatants.map((combatant) => combatant.id === id ? replacement : combatant)
}

function horizontalDirection(from: Vec3, to: Vec3): Vec3 {
  const x = to.x - from.x
  const z = to.z - from.z
  const magnitude = Math.hypot(x, z)
  return magnitude < 1e-6 ? { x: 0, y: 0, z: -1 } : { x: x / magnitude, y: 0, z: z / magnitude }
}

function distance2D(first: Vec3, second: Vec3): number {
  return Math.hypot(first.x - second.x, first.z - second.z)
}

function viewDirection(view: ArenaLook): Vec3 {
  const pitchScale = Math.cos(view.pitch)
  return normalizeDirection({
    x: -Math.sin(view.yaw) * pitchScale,
    y: Math.sin(view.pitch),
    z: -Math.cos(view.yaw) * pitchScale,
  })
}

function eyePoint(combatant: CombatantState): Vec3 {
  return {
    x: combatant.position.x,
    y: combatant.position.y + PLAYER_HEIGHT,
    z: combatant.position.z,
  }
}

function bodyPoint(combatant: CombatantState): Vec3 {
  return {
    x: combatant.position.x,
    y: combatant.position.y + 1.18,
    z: combatant.position.z,
  }
}

function effectEndpoint(
  caster: CombatantState,
  ability: AbilityDefinition,
  aim: { readonly direction: Vec3; readonly point: Vec3 },
  target: CombatantState | null,
): Vec3 {
  // Area/cone casts must keep their telegraph aligned with the reticle. A nearby
  // victim may sit on the edge of the hit shape and is not necessarily its center.
  if (ability.movement) {
    const deltaX = aim.point.x - caster.position.x
    const deltaZ = aim.point.z - caster.position.z
    const distance = Math.hypot(deltaX, deltaZ)
    const scale = distance > 1e-6 ? Math.min(distance, ability.movement.distance) / distance : 0
    return {
      x: caster.position.x + deltaX * scale,
      y: caster.position.y + 0.12,
      z: caster.position.z + deltaZ * scale,
    }
  }
  if (ability.hitShape.kind === 'radius' && ability.hitShape.center === 'caster') {
    return { x: caster.position.x, y: GROUND_Y + 0.12, z: caster.position.z }
  }
  if (ability.hitShape.kind === 'radius') return { ...aim.point, y: GROUND_Y + 0.12 }
  if (ability.hitShape.kind === 'cone') {
    return {
      x: caster.position.x + aim.direction.x * ability.hitShape.range,
      y: caster.position.y + 1.18 + aim.direction.y * ability.hitShape.range,
      z: caster.position.z + aim.direction.z * ability.hitShape.range,
    }
  }
  if (target) return { x: target.position.x, y: target.position.y + 1.05, z: target.position.z }
  const range = Math.min(ability.hitShape.range, ability.slot === 'ultimate' ? 34 : 28)
  return {
    x: caster.position.x + aim.direction.x * range,
    y: caster.position.y + 1.18 + aim.direction.y * range,
    z: caster.position.z + aim.direction.z * range,
  }
}

function targetPointForAbility(caster: CombatantState, ability: AbilityDefinition, direction: Vec3): Vec3 {
  const horizontalMagnitude = Math.hypot(direction.x, direction.z)
  const horizontalX = horizontalMagnitude > 1e-6 ? direction.x / horizontalMagnitude : caster.facing.x
  const horizontalZ = horizontalMagnitude > 1e-6 ? direction.z / horizontalMagnitude : caster.facing.z
  if (ability.movement) {
    return {
      x: caster.position.x + horizontalX * ability.movement.distance,
      y: caster.position.y,
      z: caster.position.z + horizontalZ * ability.movement.distance,
    }
  }
  const requestedRange = ability.hitShape.kind === 'radius'
    ? ability.hitShape.center === 'aim' ? ability.hitShape.maxRange ?? 18 : 0
    : ability.hitShape.range
  if (ability.hitShape.kind === 'radius' && ability.hitShape.center === 'aim') {
    const eye = eyePoint(caster)
    const groundDistance = direction.y < -0.025
      ? Math.max(0, (GROUND_Y - eye.y) / direction.y)
      : Number.POSITIVE_INFINITY
    const projectedX = eye.x + direction.x * groundDistance
    const projectedZ = eye.z + direction.z * groundDistance
    const horizontalDistance = Number.isFinite(groundDistance)
      ? Math.hypot(projectedX - caster.position.x, projectedZ - caster.position.z)
      : Number.POSITIVE_INFINITY
    const range = Math.min(requestedRange, horizontalDistance)
    return {
      x: caster.position.x + horizontalX * range,
      y: GROUND_Y,
      z: caster.position.z + horizontalZ * range,
    }
  }
  const range = requestedRange
  return {
    x: caster.position.x + horizontalX * range,
    y: caster.position.y,
    z: caster.position.z + horizontalZ * range,
  }
}

function abilityCue(mechanic: AbilityMechanic): string {
  if (mechanic === 'rsa-barrier' || mechanic === 'rsa-bastion') return 'ESCUDO RSA REFORÇADO'
  if (mechanic === 'sieve-field') return 'MALHA DE ERATÓSTENES ATIVA'
  if (mechanic === 'public-key-decoy') return 'CHAVE PÚBLICA PROJETADA'
  if (mechanic === 'key-exchange') return 'POSIÇÃO TROCADA'
  return 'PODER IRREDUTÍVEL LIBERADO'
}

function Nucleus257SoloScene({
  heroId,
  controls,
  look,
  active,
  quality,
  reducedMotion,
  onSnapshot,
  onCinematic,
  onEnd,
}: Nucleus257SceneBaseProps): JSX.Element {
  const { camera, gl } = useThree()
  const [initialSimulation] = useState(() => {
    const startedAt = performance.now()
    return {
      startedAt,
      combatants: createRoster(heroId),
      objective: createObjectiveState(),
      botNextCast: new Map(BOT_IDS.map((id, index) => [id, startedAt + 1_200 + index * 480])),
      botCastTimes: new Map<string, number>(),
      botCastIntents: new Map<string, BotCastIntent>(),
      botCastSerials: new Map(BOT_IDS.map((id) => [id, 0])),
    }
  })
  const combatants = useRef<readonly CombatantState[]>(initialSimulation.combatants)
  const objective = useRef<ArenaObjectiveState>(initialSimulation.objective)
  const startedAt = useRef(initialSimulation.startedAt)
  const simulationElapsedMs = useRef(0)
  const simulationNowMs = useRef(startedAt.current)
  const lastSnapshotAt = useRef(0)
  const finished = useRef(false)
  const verticalVelocity = useRef(0)
  const lastJumpPulse = useRef(0)
  const seenPulses = useRef({ primary: 0, signature: 0, mobility: 0, ultimate: 0 })
  const lastEnemyCastAt = useRef(0)
  const botNextCast = useRef(initialSimulation.botNextCast)
  const botCastTimes = useRef(initialSimulation.botCastTimes)
  const botCastIntents = useRef(initialSimulation.botCastIntents)
  const botCastSerials = useRef(initialSimulation.botCastSerials)
  const lastPlayerAlive = useRef(true)
  const hitMarkerUntil = useRef(0)
  const damageNumbers = useRef<readonly ArenaDamageNumber[]>([])
  const damageNumberSerial = useRef(0)
  const comboUntil = useRef(0)
  const damageFlashUntil = useRef(0)
  const damageBearingDegrees = useRef(0)
  const movementSpeed = useRef(0)
  const castSignal = useRef<CastSignal>({ serial: 0, slot: 'primary', atMs: -10_000 })
  const queuedCast = useRef<{ readonly slot: AbilitySlot; readonly untilMs: number } | null>(null)
  const message = useRef({ text: 'Domine o pylon 2. As Sentinelas já estão em movimento.', until: startedAt.current + 5_000 })
  const effectId = useRef(0)
  const ultimateImpactTimer = useRef<number | null>(null)
  const ultimatePending = useRef(false)
  const [effects, setEffects] = useState<readonly ArenaPowerEffect[]>([])
  const perspectiveCamera = camera as THREE.PerspectiveCamera

  const showMessage = useCallback((text: string, nowMs: number, duration = 2_200) => {
    message.current = { text, until: nowMs + duration }
  }, [])

  const removeEffect = useCallback((id: number) => {
    setEffects((current) => current.filter((effect) => effect.id !== id))
  }, [])

  const addEffect = useCallback((effect: Omit<ArenaPowerEffect, 'id'>) => {
    const next = { ...effect, id: ++effectId.current }
    setEffects((current) => [...current.slice(-27), next])
  }, [])

  useEffect(() => {
    const previousExposure = gl.toneMappingExposure
    gl.toneMappingExposure = 1.12
    camera.rotation.order = 'YXZ'
    return () => { gl.toneMappingExposure = previousExposure }
  }, [camera, gl])

  useEffect(() => () => {
    if (ultimateImpactTimer.current !== null) window.clearTimeout(ultimateImpactTimer.current)
  }, [])

  const addCastVisual = useCallback((
    caster: CombatantState,
    ability: AbilityDefinition,
    direction: Vec3,
    point: Vec3,
    target: CombatantState | null,
    hit: boolean,
  ) => {
    const kit = getHeroKit(caster.heroId)
    const groundCast = ability.hitShape.kind === 'radius' && ability.hitShape.center === 'caster'
    addEffect({
      heroId: caster.heroId,
      slot: ability.slot,
      mechanic: ability.mechanic,
      origin: { x: caster.position.x, y: caster.position.y + (groundCast ? 0 : 1.18), z: caster.position.z },
      target: effectEndpoint(caster, ability, { direction, point }, target),
      direction,
      color: kit.accent,
      hit,
      sourceTeam: caster.team,
    })
  }, [addEffect])

  const commitPlayerCast = useCallback((
    caster: CombatantState,
    ability: AbilityDefinition,
    direction: Vec3,
    point: Vec3,
    target: CombatantState | null,
    result: AbilityCastResult,
    nowMs: number,
  ) => {
    let next = result.combatants
    const moved = next.find((combatant) => combatant.id === PLAYER_ID)
    if (moved && ability.movement) {
      const resolved = resolveArenaAbilityMovement(
        caster.position,
        moved.position,
        moved.hitRadius,
        ability.movement.kind === 'blink',
      )
      next = replaceCombatant(next, PLAYER_ID, { ...moved, position: resolved })
    }
    combatants.current = next
    const resolvedPlayer = next.find((combatant) => combatant.id === PLAYER_ID)
    let defeatedByReflection = false
    if (resolvedPlayer && (resolvedPlayer.health < caster.health || resolvedPlayer.shield < caster.shield)) {
      damageFlashUntil.current = nowMs + 300
      damageBearingDegrees.current = 0
      defeatedByReflection = !resolvedPlayer.alive
    }
    const hitEnemy = result.hitIds.some((id) => id !== PLAYER_ID)
    addCastVisual(caster, ability, direction, point, target, hitEnemy)
    if (hitEnemy) hitMarkerUntil.current = nowMs + 180
    // Floating numbers: one per damaged rival, flagged when a mark was detonated.
    for (const [targetId, amount] of Object.entries(result.damageByTarget)) {
      if (targetId === PLAYER_ID || amount <= 0) continue
      damageNumberSerial.current += 1
      damageNumbers.current = [
        ...damageNumbers.current.slice(-5),
        {
          id: damageNumberSerial.current,
          amount,
          atMs: nowMs,
          combo: result.detonatedIds.includes(targetId),
          lethal: result.eliminatedIds.includes(targetId),
        },
      ]
    }
    if (result.detonatedIds.length > 0) comboUntil.current = nowMs + 900
    if (defeatedByReflection) {
      showMessage('SEU VETOR FOI REFLETIDO // RECONSTRUINDO', nowMs, 3_000)
    } else if (result.eliminatedIds.length > 0) {
      showMessage(result.eliminatedIds.length > 1 ? `${result.eliminatedIds.length} ELIMINAÇÕES // FATORAÇÃO MÚLTIPLA` : 'SENTINELA FATORADA', nowMs, 1_800)
    } else if (ability.slot !== 'primary') showMessage(abilityCue(ability.mechanic), nowMs, 1_500)
  }, [addCastVisual, showMessage])

  const castPlayerAbility = useCallback((slot: AbilitySlot, nowMs: number) => {
    const before = combatants.current
    const caster = before.find((combatant) => combatant.id === PLAYER_ID)
    if (!caster || !caster.alive || finished.current || ultimatePending.current) return
    const kit = getHeroKit(caster.heroId)
    const ability = kit.abilities[slot]
    const direction = viewDirection(look.current)
    const point = targetPointForAbility(caster, ability, direction)
    const blocked = getCastBlockReason(caster, slot, nowMs)
    if (blocked) {
      if (blocked === 'cooldown') {
        const remaining = cooldownRemainingMs(caster, slot, nowMs)
        showMessage(`${ability.name} recarrega em ${(remaining / 1_000).toFixed(1)} s.`, nowMs, 1_200)
      } else if (blocked === 'ultimate-not-ready') {
        showMessage(`Ultimate em ${Math.floor(caster.ultimateCharge)}%. Continue causando dano.`, nowMs, 1_500)
      } else if (blocked === 'silenced') showMessage('Sistemas criptográficos silenciados.', nowMs, 1_500)
      return
    }

    castSignal.current = { serial: castSignal.current.serial + 1, slot, atMs: nowMs }
    const resolveCast = () => {
      const impactNowMs = simulationNowMs.current
      const impactRoster = combatants.current
      const impactCaster = impactRoster.find((combatant) => combatant.id === PLAYER_ID)
      if (!impactCaster?.alive || finished.current) return
      const target = selectAimTarget(impactCaster, impactRoster, ability.hitShape, { direction, point }, {
        nowMs: impactNowMs,
        hasLineOfSight: hasArenaLineOfSight,
        hitOrigin: eyePoint(impactCaster),
        hitPoint: bodyPoint,
      })
      const result = castAbility(impactRoster, PLAYER_ID, slot, { direction, point }, impactNowMs, {
        hasLineOfSight: hasArenaLineOfSight,
        hitOrigin: eyePoint(impactCaster),
        hitPoint: bodyPoint,
      })
      if (result.ok) commitPlayerCast(impactCaster, ability, direction, point, target, result, impactNowMs)
    }

    if (slot !== 'ultimate') {
      resolveCast()
      return
    }

    ultimatePending.current = true
    onCinematic(ability)
    ultimateImpactTimer.current = window.setTimeout(() => {
      ultimateImpactTimer.current = null
      resolveCast()
      ultimatePending.current = false
    }, reducedMotion ? 120 : 1_280)
  }, [commitPlayerCast, look, onCinematic, reducedMotion, showMessage])

  useFrame(({ clock }, rawDelta) => {
    // Match clocks, cooldowns and capture use all active elapsed time. Only
    // physical displacement is capped so a slow frame cannot tunnel actors.
    const elapsedDelta = Number.isFinite(rawDelta) ? Math.max(rawDelta, 0) : 0
    const delta = Math.min(elapsedDelta, 0.1)
    if (!active || finished.current) {
      movementSpeed.current = 0
      return
    }
    simulationElapsedMs.current += elapsedDelta * 1_000
    const elapsedMs = simulationElapsedMs.current
    const nowMs = startedAt.current + elapsedMs
    simulationNowMs.current = nowMs

    combatants.current = tickCombatants(combatants.current, nowMs)
    let player = combatants.current.find((combatant) => combatant.id === PLAYER_ID)
    if (!player) return

    if (player.alive && !lastPlayerAlive.current) {
      verticalVelocity.current = 0
      botCastIntents.current.clear()
      for (const [index, botId] of BOT_IDS.entries()) {
        botNextCast.current.set(botId, nowMs + 900 + index * 320)
      }
      showMessage('OPERADOR RECONSTRUÍDO // PROTEÇÃO 2 S', nowMs, 2_000)
    }
    lastPlayerAlive.current = player.alive

    const input = controls.current
    const forwardAxis = Number(input.keys.has('KeyW') || input.keys.has('ArrowUp')) - Number(input.keys.has('KeyS') || input.keys.has('ArrowDown'))
    const rightAxis = Number(input.keys.has('KeyD') || input.keys.has('ArrowRight')) - Number(input.keys.has('KeyA') || input.keys.has('ArrowLeft'))
    const sprint = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight')
    const axisLength = Math.hypot(forwardAxis, rightAxis)

    if (player.alive) {
      if (input.jumpPulse !== lastJumpPulse.current) {
        lastJumpPulse.current = input.jumpPulse
        if (player.position.y <= GROUND_Y + 0.02) verticalVelocity.current = 7.2
      }
      verticalVelocity.current -= 19.5 * delta
      const slowed = isStatusActive(player, 'slowed', nowMs) ? player.statuses.slowed?.magnitude ?? 0 : 0
      const moveSpeed = getHeroKit(heroId).stats.moveSpeed * (sprint ? 1.34 : 1) * (1 - slowed)
      const normalizedForward = axisLength > 0 ? forwardAxis / axisLength : 0
      const normalizedRight = axisLength > 0 ? rightAxis / axisLength : 0
      const sin = Math.sin(look.current.yaw)
      const cos = Math.cos(look.current.yaw)
      const dx = (-sin * normalizedForward + cos * normalizedRight) * moveSpeed * delta
      const dz = (-cos * normalizedForward - sin * normalizedRight) * moveSpeed * delta
      let nextY = player.position.y + verticalVelocity.current * delta
      if (nextY <= GROUND_Y) {
        nextY = GROUND_Y
        verticalVelocity.current = 0
      }
      const moved = resolveArenaMovement(player.position, {
        x: player.position.x + dx,
        y: nextY,
        z: player.position.z + dz,
      }, player.hitRadius)
      const facing = { x: -sin, y: 0, z: -cos }
      player = clearExpiredStatuses({ ...player, position: moved, facing }, nowMs)
      // Gentle passive charge guarantees that every round reaches its spectacle.
      player = gainUltimateCharge(player, elapsedDelta * 1.35)
      combatants.current = replaceCombatant(combatants.current, PLAYER_ID, player)
      movementSpeed.current = axisLength > 0 ? moveSpeed : 0
    } else movementSpeed.current = 0

    const pulseBySlot = {
      primary: input.primaryPulse,
      signature: input.signaturePulse,
      mobility: input.mobilityPulse,
      ultimate: input.ultimatePulse,
    } as const
    for (const slot of ['primary', 'signature', 'mobility', 'ultimate'] as const) {
      if (pulseBySlot[slot] === seenPulses.current[slot]) continue
      seenPulses.current[slot] = pulseBySlot[slot]
      // Input buffer: a press that lands just before the cooldown ends is kept and
      // fired the instant the ability is ready, instead of being swallowed.
      const remaining = cooldownRemainingMs(player, slot, nowMs)
      if (remaining > 0 && remaining <= CAST_BUFFER_WINDOW_MS && player.alive) {
        queuedCast.current = { slot, untilMs: nowMs + remaining + 90 }
        continue
      }
      queuedCast.current = null
      castPlayerAbility(slot, nowMs)
    }

    const queued = queuedCast.current
    if (queued) {
      if (nowMs > queued.untilMs || !player.alive) queuedCast.current = null
      else if (cooldownRemainingMs(player, queued.slot, nowMs) <= 0) {
        queuedCast.current = null
        castPlayerAbility(queued.slot, nowMs)
        player = combatants.current.find((combatant) => combatant.id === PLAYER_ID) ?? player
      }
    }
    player = combatants.current.find((combatant) => combatant.id === PLAYER_ID) ?? player
    if (input.primaryHeld && player.alive && cooldownRemainingMs(player, 'primary', nowMs) <= 0) {
      castPlayerAbility('primary', nowMs)
    }

    player = combatants.current.find((combatant) => combatant.id === PLAYER_ID) ?? player
    const activePrime = activePylon(objective.current) ?? 7
    const pylon = ARENA_PYLONS.find((candidate) => candidate.prime === activePrime) ?? ARENA_PYLONS[3]

    for (const [index, botId] of BOT_IDS.entries()) {
      let bot = combatants.current.find((combatant) => combatant.id === botId)
      player = combatants.current.find((combatant) => combatant.id === PLAYER_ID) ?? player
      if (!bot?.alive || !player.alive) {
        botCastIntents.current.delete(botId)
        continue
      }
      const playerHidden = isStatusActive(player, 'cloaked', nowMs) && !isStatusActive(player, 'revealed', nowMs)
      const pendingIntent = botCastIntents.current.get(botId)
      const objectiveBias = index < 3 || playerHidden
      const destination = objectiveBias ? pylon.position : player.position
      const targetDirection = horizontalDirection(bot.position, destination)
      const playerDistance = distance2D(bot.position, player.position)
      const desiredDistance = getHeroKit(bot.heroId).role === 'tank' ? 8 : getHeroKit(bot.heroId).role === 'infiltrator' ? 18 : 13
      const shouldAdvance = objectiveBias
        ? distance2D(bot.position, pylon.position) > 2.6
        : playerDistance > desiredDistance
      const shouldRetreat = !objectiveBias && playerDistance < desiredDistance * 0.52
      const strafe = Math.sin(clock.elapsedTime * (0.72 + index * 0.05) + index * 1.73)
      const slowed = isStatusActive(bot, 'slowed', nowMs) ? bot.statuses.slowed?.magnitude ?? 0 : 0
      const speed = getHeroKit(bot.heroId).stats.moveSpeed * (0.48 + index * 0.025) * (1 - slowed)
      const drive = shouldAdvance ? 1 : shouldRetreat ? -0.68 : 0.08
      const proposed = {
        x: bot.position.x + (targetDirection.x * drive + targetDirection.z * strafe * 0.34) * speed * delta,
        y: GROUND_Y,
        z: bot.position.z + (targetDirection.z * drive - targetDirection.x * strafe * 0.34) * speed * delta,
      }
      const moved = resolveArenaMovement(bot.position, proposed, bot.hitRadius)
      const facing = pendingIntent
        ? horizontalDirection({ x: 0, y: 0, z: 0 }, pendingIntent.aim.direction)
        : horizontalDirection(bot.position, playerHidden ? destination : player.position)
      bot = { ...bot, position: moved, facing }
      combatants.current = replaceCombatant(combatants.current, botId, bot)

      if (pendingIntent) {
        if (nowMs < pendingIntent.executeAtMs) continue
        botCastIntents.current.delete(botId)
        const beforePlayer = combatants.current.find((combatant) => combatant.id === PLAYER_ID) ?? player
        const beforeBot = combatants.current.find((combatant) => combatant.id === botId) ?? bot
        const result = castAbility(
          combatants.current,
          botId,
          pendingIntent.slot,
          pendingIntent.aim,
          nowMs,
          {
            hasLineOfSight: hasArenaLineOfSight,
            hitOrigin: eyePoint(beforeBot),
            hitPoint: bodyPoint,
          },
        )
        if (!result.ok || !result.ability) {
          botNextCast.current.set(botId, nowMs + 600)
          continue
        }
        let nextCombatants = result.combatants
        const castBot = nextCombatants.find((combatant) => combatant.id === botId)
        if (castBot && result.ability.movement) {
          const resolved = resolveArenaAbilityMovement(
            beforeBot.position,
            castBot.position,
            castBot.hitRadius,
            result.ability.movement.kind === 'blink',
          )
          nextCombatants = replaceCombatant(nextCombatants, botId, { ...castBot, position: resolved })
        }
        combatants.current = nextCombatants
        const afterPlayer = combatants.current.find((combatant) => combatant.id === PLAYER_ID) ?? beforePlayer
        const target = result.hitIds.includes(PLAYER_ID) ? beforePlayer : null
        addCastVisual(
          beforeBot,
          result.ability,
          pendingIntent.aim.direction,
          pendingIntent.aim.point ?? beforePlayer.position,
          target,
          Boolean(target),
        )
        const baseCadence = result.ability.slot === 'primary'
          ? 1_200
          : result.ability.slot === 'ultimate' ? 3_000 : 2_050
        botNextCast.current.set(botId, nowMs + baseCadence + index * 120)
        if (afterPlayer.health < beforePlayer.health || afterPlayer.shield < beforePlayer.shield) {
          damageFlashUntil.current = nowMs + 360
          damageBearingDegrees.current = cameraRelativeBearingDegrees(
            beforePlayer.position,
            beforeBot.position,
            look.current.yaw,
          )
          if (!afterPlayer.alive) {
            const source = getHeroKit(beforeBot.heroId).codename.toUpperCase()
            showMessage(
              `FATORADO POR ${source} · ${result.ability.name.toUpperCase()} // RECONSTRUINDO`,
              nowMs,
              3_000,
            )
          }
        }
        continue
      }

      const nextCastAt = botNextCast.current.get(botId) ?? 0
      if (playerHidden || nowMs < nextCastAt || nowMs - lastEnemyCastAt.current < BOT_CAST_SPACING_MS) continue
      const decision = chooseBotDecision(
        combatants.current,
        botId,
        nowMs,
        pylon.position,
        {
          hasLineOfSight: hasArenaLineOfSight,
          hitOrigin: eyePoint(bot),
          hitPoint: bodyPoint,
        },
      )
      if (decision.kind !== 'cast' || decision.slot === 'mobility' && playerDistance < 6) {
        botNextCast.current.set(botId, nowMs + 300)
        continue
      }
      const ability = getHeroKit(bot.heroId).abilities[decision.slot]
      const serial = (botCastSerials.current.get(botId) ?? 0) + 1
      botCastSerials.current.set(botId, serial)
      const aim = lockedBotAim(decision.aim, ability, index, serial)
      botCastIntents.current.set(botId, {
        executeAtMs: nowMs + botWindupMs(decision.slot),
        slot: decision.slot,
        targetId: decision.targetId,
        aim,
      })
      botCastTimes.current.set(botId, nowMs)
      lastEnemyCastAt.current = nowMs
      if (decision.slot !== 'primary') {
        addCastVisual(
          bot,
          ability,
          aim.direction,
          aim.point ?? player.position,
          null,
          false,
        )
        showMessage(
          `AMEAÇA: ${getHeroKit(bot.heroId).codename.toUpperCase()} · ${ability.name.toUpperCase()} // EVADE`,
          nowMs,
          botWindupMs(decision.slot) + 350,
        )
      }
    }

    player = combatants.current.find((combatant) => combatant.id === PLAYER_ID) ?? player
    const playerInsideObjective = player.alive && distance2D(player.position, pylon.position) <= 3.65
    const enemyInsideObjective = combatants.current.some((combatant) => (
      combatant.team === 'fracture' && combatant.alive && distance2D(combatant.position, pylon.position) <= 3.65
    ))
    const presentTeams = playerInsideObjective
      ? enemyInsideObjective ? ['cipher', 'fracture'] as const : ['cipher'] as const
      : []
    const previousIndex = objective.current.activeIndex
    objective.current = advanceObjective(objective.current, {
      pylon: activePrime,
      presentTeams,
      deltaMs: elapsedDelta * 1_000,
    })
    if (objective.current.activeIndex > previousIndex) {
      const captured = PYLON_SEQUENCE[previousIndex]
      showMessage(`PYLON ${captured} IRREDUTÍVEL // PRÓXIMA COORDENADA LIBERADA`, nowMs, 3_300)
      const boosted = combatants.current.find((combatant) => combatant.id === PLAYER_ID)
      if (boosted) {
        combatants.current = replaceCombatant(combatants.current, PLAYER_ID, {
          ...gainUltimateCharge(boosted, 28),
          health: Math.min(boosted.maxHealth, boosted.health + 26),
          shield: Math.min(boosted.maxShield, boosted.shield + 20),
        })
      }
    }

    const bob = player.alive && movementSpeed.current > 0 && !reducedMotion
      ? Math.sin(clock.elapsedTime * (sprint ? 12 : 8.5)) * 0.026
      : 0
    const damageShake = !reducedMotion && damageFlashUntil.current > nowMs
      ? Math.sin(clock.elapsedTime * 45) * 0.018 * ((damageFlashUntil.current - nowMs) / 360)
      : 0
    camera.position.set(player.position.x + damageShake, player.position.y + PLAYER_HEIGHT + bob, player.position.z)
    camera.rotation.set(look.current.pitch, look.current.yaw, damageShake * 0.3, 'YXZ')
    const targetFov = reducedMotion ? 72 : sprint && movementSpeed.current > 0 ? 78 : 72
    if (perspectiveCamera.isPerspectiveCamera) {
      const nextFov = THREE.MathUtils.lerp(perspectiveCamera.fov, targetFov, 1 - Math.exp(-delta * 8))
      if (Math.abs(nextFov - perspectiveCamera.fov) > 0.01) {
        perspectiveCamera.fov = nextFov
        perspectiveCamera.updateProjectionMatrix()
      }
    }

    if (elapsedMs >= MATCH_DURATION_MS && !finished.current) finished.current = true
    if (objective.current.winner === 'cipher' && !finished.current) finished.current = true

    if (nowMs - lastSnapshotAt.current >= SNAPSHOT_INTERVAL_MS || finished.current) {
      lastSnapshotAt.current = nowMs
      player = combatants.current.find((combatant) => combatant.id === PLAYER_ID) ?? player
      const primary = getHeroKit(heroId).abilities.primary
      const aimDirection = viewDirection(look.current)
      const aimed = selectAimTarget(player, combatants.current, primary.hitShape, {
        direction: aimDirection,
        point: targetPointForAbility(player, primary, aimDirection),
      }, {
        nowMs,
        hasLineOfSight: hasArenaLineOfSight,
        hitOrigin: eyePoint(player),
        hitPoint: bodyPoint,
      })
      const snapshot: ArenaHudSnapshot = {
        nowMs,
        elapsedMs,
        remainingMs: Math.max(0, MATCH_DURATION_MS - elapsedMs),
        player,
        objective: objective.current,
        activePrime,
        captureProgress: objective.current.progressMs / PYLON_CAPTURE_MS,
        captureContested: playerInsideObjective && enemyInsideObjective,
        playerInsideObjective,
        livingEnemies: combatants.current.filter((combatant) => combatant.team === 'fracture' && combatant.alive).length,
        targetId: aimed?.id ?? null,
        hitMarkerUntil: hitMarkerUntil.current,
        damageNumbers: damageNumbers.current,
        comboUntil: comboUntil.current,
        damageFlashUntil: damageFlashUntil.current,
        damageBearingDegrees: damageBearingDegrees.current,
        message: message.current.text,
        messageUntil: message.current.until,
        cooldowns: {
          primary: cooldownRemainingMs(player, 'primary', nowMs),
          signature: cooldownRemainingMs(player, 'signature', nowMs),
          mobility: cooldownRemainingMs(player, 'mobility', nowMs),
          ultimate: cooldownRemainingMs(player, 'ultimate', nowMs),
        },
        online: false,
        onlinePhase: 'solo',
        connectedPlayers: 1,
        localTeam: 'cipher',
        killFeed: [],
      }
      onSnapshot(snapshot)
      if (finished.current) onEnd(objective.current.winner === 'cipher' ? 'victory' : 'timeout', snapshot)
    }
  }, -2)

  const currentObjective = objective.current
  const currentPrime = activePylon(currentObjective) ?? 7
  return (
    <>
      <Nucleus257World
        quality={quality}
        reducedMotion={reducedMotion}
        activePrime={currentPrime}
        capturedPrimes={currentObjective.captures.map((capture) => capture.prime)}
        captureProgress={currentObjective.progressMs / PYLON_CAPTURE_MS}
      />
      {BOT_IDS.map((id) => (
        <CombatantAvatar
          key={id}
          id={id}
          heroId={BOT_HEROES[BOT_IDS.indexOf(id)]}
          team="fracture"
          label={`${getHeroKit(BOT_HEROES[BOT_IDS.indexOf(id)]).codename.toUpperCase()} // ${id.split(':')[1]}`}
          localTeam="cipher"
          combatants={combatants}
          castTimes={botCastTimes}
          simulationNowMs={simulationNowMs}
          reducedMotion={reducedMotion}
          quality={quality}
        />
      ))}
      {effects.map((effect) => (
        <PowerEffect
          key={effect.id}
          effect={effect}
          reducedMotion={reducedMotion}
          quality={quality}
          onComplete={removeEffect}
        />
      ))}
      <FirstPersonHands
        heroId={heroId}
        movementSpeed={movementSpeed.current}
        reducedMotion={reducedMotion}
        castSignal={castSignal}
      />
    </>
  )
}

function Nucleus257OnlineScene({
  heroId,
  controls,
  look,
  active,
  quality,
  reducedMotion,
  onSnapshot,
  onCinematic,
  multiplayer,
}: Nucleus257SceneBaseProps & { readonly multiplayer: NucleusMultiplayerMatch }): JSX.Element {
  const { camera, gl } = useThree()
  const localPlayerId = multiplayer.playerId ?? PLAYER_ID
  const [initialSimulation] = useState(() => {
    const nowMs = multiplayer.getServerNow()
    return {
      nowMs,
      combatants: [createCombatant({
        id: localPlayerId,
        heroId,
        team: 'cipher',
        position: spawnForIndex(0),
      })] as readonly CombatantState[],
    }
  })
  const combatants = useRef<readonly CombatantState[]>(initialSimulation.combatants)
  const simulationNowMs = useRef(initialSimulation.nowMs)
  const startedAt = useRef(initialSimulation.nowMs)
  const lastSnapshotAt = useRef(0)
  const verticalVelocity = useRef(0)
  const lastJumpPulse = useRef(0)
  const seenPulses = useRef({ primary: 0, signature: 0, mobility: 0, ultimate: 0 })
  const movementSpeed = useRef(0)
  const hitMarkerUntil = useRef(0)
  const damageFlashUntil = useRef(0)
  const damageBearingDegrees = useRef(0)
  const castSignal = useRef<CastSignal>({ serial: 0, slot: 'primary', atMs: -10_000 })
  const castTimes = useRef(new Map<string, number>())
  const message = useRef({
    text: 'CONECTANDO AO COMBATE AUTORITATIVO...',
    until: initialSimulation.nowMs + 8_000,
  })
  const killFeed = useRef<readonly ArenaKillFeedEntry[]>([])
  const seenEventIds = useRef<string[]>(multiplayer.events.map((packet) => packet.eventId))
  const effectId = useRef(0)
  const [effects, setEffects] = useState<readonly ArenaPowerEffect[]>([])
  const perspectiveCamera = camera as THREE.PerspectiveCamera
  const emptyObjective = useRef(createObjectiveState())

  const showMessage = useCallback((text: string, nowMs: number, duration = 2_200) => {
    message.current = { text, until: nowMs + duration }
  }, [])

  const removeEffect = useCallback((id: number) => {
    setEffects((current) => current.filter((effect) => effect.id !== id))
  }, [])

  const addEffect = useCallback((effect: Omit<ArenaPowerEffect, 'id'>) => {
    const next = { ...effect, id: ++effectId.current }
    setEffects((current) => [...current.slice(-31), next])
  }, [])

  useEffect(() => {
    const previousExposure = gl.toneMappingExposure
    gl.toneMappingExposure = 1.12
    camera.rotation.order = 'YXZ'
    return () => { gl.toneMappingExposure = previousExposure }
  }, [camera, gl])

  useEffect(() => {
    const state = multiplayer.state
    if (!state) return
    const beforeLocal = combatants.current.find((combatant) => combatant.id === localPlayerId)
    const reconciled = reconcileNucleusRoster(combatants.current, state, localPlayerId)
    // Keep a camera-only placeholder while the join acknowledgement is pending.
    // It cannot move, cast, take damage or appear to peers until ready becomes true.
    combatants.current = !reconciled.some((combatant) => combatant.id === localPlayerId) && beforeLocal
      ? Object.freeze([beforeLocal, ...reconciled])
      : reconciled
    const afterLocal = combatants.current.find((combatant) => combatant.id === localPlayerId)
    if (beforeLocal && afterLocal && !beforeLocal.alive && afterLocal.alive) {
      verticalVelocity.current = 0
      showMessage('RECONSTRUÇÃO CONFIRMADA // PROTEÇÃO DE SPAWN ATIVA', state.serverTime, 2_600)
    } else if (state.phase === 'waiting') {
      showMessage('AGUARDANDO MAIS 1 OPERADOR DA SALA', state.serverTime, 60_000)
    } else if (message.current.text.startsWith('AGUARDANDO') || message.current.text.startsWith('CONECTANDO')) {
      showMessage('BATALHA ONLINE ATIVA // DANO VALIDADO PELO SERVIDOR', state.serverTime, 3_200)
    }
  }, [localPlayerId, multiplayer.state, showMessage])

  useEffect(() => {
    const nowMs = multiplayer.getServerNow()
    const phase = onlinePhase(multiplayer)
    if (phase === 'reconnecting') showMessage('SINAL INSTÁVEL // RECONECTANDO À MESMA BATALHA', nowMs, 60_000)
    else if (phase === 'offline') showMessage('CONEXÃO PERDIDA // VOLTE AO NEXUS PARA RECONECTAR', nowMs, 60_000)
    else if (phase === 'blocked') showMessage('ENTRADA ONLINE BLOQUEADA // USE O PORTAL DO NEXUS', nowMs, 60_000)
    else if (!multiplayer.ready && multiplayer.joinError) {
      showMessage(`${multiplayer.joinError.toUpperCase()} // NOVA TENTATIVA AGENDADA`, nowMs, 60_000)
    }
  }, [multiplayer, showMessage])

  useEffect(() => {
    const state = multiplayer.state
    if (!state) return
    const playerName = (id: string) => state.players.find((player) => player.id === id)?.nickname ?? id

    const orderedPackets = [...multiplayer.events].sort((first, second) => (
      first.serverTime - second.serverTime
      || first.revision - second.revision
      || first.eventId.localeCompare(second.eventId)
    ))
    const markSeen = (eventId: string) => {
      seenEventIds.current = [...seenEventIds.current.slice(-127), eventId]
    }
    for (const packet of orderedPackets) {
      if (seenEventIds.current.includes(packet.eventId)) continue
      if (multiplayer.getServerNow() - packet.serverTime > 5_000) {
        markSeen(packet.eventId)
        continue
      }
      const event = packet.event
      const nowMs = packet.serverTime

      if (event.kind === 'joined') {
        markSeen(packet.eventId)
        if (event.playerId !== localPlayerId) showMessage(`${playerName(event.playerId).toUpperCase()} ENTROU NA BATALHA`, nowMs, 1_800)
        continue
      }
      if (event.kind === 'left') {
        markSeen(packet.eventId)
        if (event.playerId !== localPlayerId) showMessage(`${playerName(event.playerId).toUpperCase()} SAIU DA ARENA`, nowMs, 1_800)
        continue
      }
      if (event.kind === 'respawned') {
        markSeen(packet.eventId)
        if (event.playerId === localPlayerId) {
          verticalVelocity.current = 0
          showMessage('RECONSTRUÍDO // 2 S DE PROTEÇÃO', nowMs, 2_400)
        }
        continue
      }

      const roster = combatants.current
      const caster = roster.find((combatant) => combatant.id === event.casterId)
      const serverCaster = state.players.find((player) => player.id === event.casterId)
      // A cast can beat its roster snapshot through cross-runtime Pub/Sub.
      // Leave it unconsumed until the authoritative player arrives.
      if (!caster || !serverCaster) continue
      markSeen(packet.eventId)
      const ability = getHeroKit(caster.heroId).abilities[event.slot]
      const target = event.hitIds
        .map((id) => roster.find((combatant) => combatant.id === id))
        .find((combatant): combatant is CombatantState => combatant !== undefined) ?? null
      const point = event.point ?? event.destination ?? targetPointForAbility(caster, ability, event.direction)
      const groundCast = ability.hitShape.kind === 'radius' && ability.hitShape.center === 'caster'
      const perspectiveTeam = state.players.find((player) => player.id === localPlayerId)?.team ?? 'cipher'
      const confirmedRivalHit = event.damages.some((damage) => {
        const hitPlayer = state.players.find((player) => player.id === damage.targetId)
        return damage.sourceId === localPlayerId
          && damage.amount > 0
          && hitPlayer !== undefined
          && hitPlayer.team !== perspectiveTeam
      })
      addEffect({
        heroId: caster.heroId,
        slot: ability.slot,
        mechanic: ability.mechanic,
        origin: {
          x: event.origin.x,
          y: groundCast ? GROUND_Y + 0.12 : event.origin.y,
          z: event.origin.z,
        },
        target: event.destination ?? effectEndpoint(caster, ability, { direction: event.direction, point }, target),
        direction: event.direction,
        color: getHeroKit(caster.heroId).accent,
        hit: event.hitIds.length > 0,
        sourceTeam: caster.team === perspectiveTeam ? 'cipher' : 'fracture',
      })
      castTimes.current.set(event.casterId, nowMs)

      if (event.destination && event.casterId === localPlayerId) {
        const local = combatants.current.find((combatant) => combatant.id === localPlayerId)
        if (local) {
          combatants.current = replaceCombatant(combatants.current, localPlayerId, {
            ...local,
            position: resolveArenaAbilityMovement(
              local.position,
              event.destination,
              local.hitRadius,
              ability.movement?.kind === 'blink',
            ),
          })
        }
      }

      if (event.casterId === localPlayerId) {
        if (confirmedRivalHit) hitMarkerUntil.current = nowMs + 280
        if (event.eliminatedIds.length > 0) {
          showMessage(
            event.eliminatedIds.length > 1
              ? `${event.eliminatedIds.length} OPONENTES FATORADOS // ELIMINAÇÃO MÚLTIPLA`
              : `${playerName(event.eliminatedIds[0]).toUpperCase()} FATORADO`,
            nowMs,
            2_200,
          )
        } else if (ability.slot !== 'primary') showMessage(abilityCue(ability.mechanic), nowMs, 1_600)
      }

      const damage = event.damages.find((candidate) => candidate.targetId === localPlayerId)
      if (damage) {
        damageFlashUntil.current = nowMs + 620
        const local = combatants.current.find((combatant) => combatant.id === localPlayerId)
        const damageSource = combatants.current.find((combatant) => combatant.id === damage.sourceId)
        if (local) {
          damageBearingDegrees.current = cameraRelativeBearingDegrees(
            local.position,
            damageSource?.position ?? event.origin,
            look.current.yaw,
          )
        }
        if (damage.eliminated) {
          const cause = damage.sourceId !== event.casterId
            ? 'REFLEXÃO RSA'
            : ability.name.toUpperCase()
          showMessage(
            `FATORADO POR ${playerName(damage.sourceId).toUpperCase()} · ${cause} // RECONSTRUINDO`,
            nowMs,
            4_000,
          )
        } else {
          showMessage(`-${Math.ceil(damage.amount)} DANO // ATAQUE DE ${playerName(damage.sourceId).toUpperCase()}`, nowMs, 1_200)
        }
      }

      const reflectedEliminations = event.damages.filter((damage) => (
        damage.eliminated && damage.sourceId !== event.casterId
      ))
      if (event.eliminatedIds.length > 0 || reflectedEliminations.length > 0) {
        const entries = [
          ...event.eliminatedIds.map((targetId) => ({
            id: `${packet.eventId}:${targetId}`,
            text: `${playerName(event.casterId)}  ▸  ${playerName(targetId)}`,
            atMs: nowMs,
          })),
          ...reflectedEliminations.map((damage) => ({
            id: `${packet.eventId}:reflection:${damage.targetId}`,
            text: `${playerName(damage.sourceId)}  ↩  ${playerName(damage.targetId)}`,
            atMs: nowMs,
          })),
        ]
        killFeed.current = [...entries, ...killFeed.current].slice(0, 5)
      }
    }
  }, [
    addEffect,
    localPlayerId,
    look,
    multiplayer,
    showMessage,
  ])

  const castOnlineAbility = useCallback((slot: AbilitySlot, nowMs: number) => {
    const caster = combatants.current.find((combatant) => combatant.id === localPlayerId)
    if (!caster?.alive) return
    if (multiplayer.state?.phase !== 'active') {
      showMessage('AGUARDE OUTRO OPERADOR PARA INICIAR O PVP', nowMs, 1_500)
      return
    }
    const ability = getHeroKit(caster.heroId).abilities[slot]
    const blocked = getCastBlockReason(caster, slot, nowMs)
    if (blocked) {
      if (blocked === 'cooldown') {
        showMessage(`${ability.name} recarrega em ${(cooldownRemainingMs(caster, slot, nowMs) / 1_000).toFixed(1)} s.`, nowMs, 1_000)
      } else if (blocked === 'ultimate-not-ready') {
        showMessage(`Ultimate em ${Math.floor(caster.ultimateCharge)}%.`, nowMs, 1_200)
      } else if (blocked === 'silenced') showMessage('SISTEMAS CRIPTOGRÁFICOS SILENCIADOS', nowMs, 1_200)
      return
    }

    const direction = viewDirection(look.current)
    const point = targetPointForAbility(caster, ability, direction)
    const castId = multiplayer.sendCast(slot, { direction, point })
    if (!castId) {
      showMessage('CAST NÃO CONFIRMADO // RECONECTANDO', nowMs, 1_500)
      return
    }
    castSignal.current = { serial: castSignal.current.serial + 1, slot, atMs: nowMs }
    castTimes.current.set(localPlayerId, nowMs)
    combatants.current = replaceCombatant(combatants.current, localPlayerId, {
      ...caster,
      cooldownReadyAtMs: {
        ...caster.cooldownReadyAtMs,
        [slot]: nowMs + ability.cooldownMs,
      },
      ultimateCharge: ability.ultimateCost === undefined ? caster.ultimateCharge : 0,
    })
    if (slot === 'ultimate') onCinematic(ability)
  }, [localPlayerId, look, multiplayer, onCinematic, showMessage])

  useFrame(({ clock }, rawDelta) => {
    const elapsedDelta = Number.isFinite(rawDelta) ? Math.max(rawDelta, 0) : 0
    const delta = Math.min(elapsedDelta, 0.1)
    const nowMs = multiplayer.getServerNow()
    simulationNowMs.current = nowMs

    let roster: readonly CombatantState[] = combatants.current.map((combatant) => clearExpiredStatuses(combatant, nowMs))
    const correction = multiplayer.consumeCorrection()
    if (correction) {
      const local = roster.find((combatant) => combatant.id === localPlayerId)
      if (local) {
        roster = replaceCombatant(roster, localPlayerId, {
          ...local,
          position: {
            x: correction.position[0],
            y: correction.position[1],
            z: correction.position[2],
          },
          facing: { x: -Math.sin(correction.yaw), y: 0, z: -Math.cos(correction.yaw) },
        })
        verticalVelocity.current = 0
      }
    }
    const authoritativeServerTime = multiplayer.state?.serverTime ?? Number.NEGATIVE_INFINITY
    for (const combatant of roster) {
      if (combatant.id === localPlayerId) continue
      const sampled = multiplayer.sampleRemote(combatant.id)
      if (!isNucleusRemoteSampleFresh(sampled, authoritativeServerTime)) continue
      roster = replaceCombatant(roster, combatant.id, {
        ...combatant,
        position: { x: sampled.position[0], y: sampled.position[1], z: sampled.position[2] },
        facing: { x: -Math.sin(sampled.yaw), y: 0, z: -Math.cos(sampled.yaw) },
      })
    }
    combatants.current = roster
    let player = roster.find((combatant) => combatant.id === localPlayerId)
    if (!player) return

    const input = controls.current
    const forwardAxis = Number(input.keys.has('KeyW') || input.keys.has('ArrowUp')) - Number(input.keys.has('KeyS') || input.keys.has('ArrowDown'))
    const rightAxis = Number(input.keys.has('KeyD') || input.keys.has('ArrowRight')) - Number(input.keys.has('KeyA') || input.keys.has('ArrowLeft'))
    const sprint = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight')
    const axisLength = Math.hypot(forwardAxis, rightAxis)

    const networkControlsActive = active && canUseNucleusOnlineControls(
      multiplayer.ready,
      multiplayer.connectionStatus,
    )
    if (networkControlsActive && player.alive) {
      if (input.jumpPulse !== lastJumpPulse.current) {
        lastJumpPulse.current = input.jumpPulse
        if (player.position.y <= GROUND_Y + 0.02) verticalVelocity.current = 7.2
      }
      verticalVelocity.current -= 19.5 * delta
      const slowed = isStatusActive(player, 'slowed', nowMs) ? player.statuses.slowed?.magnitude ?? 0 : 0
      const moveSpeed = getHeroKit(player.heroId).stats.moveSpeed * (sprint ? 1.34 : 1) * (1 - slowed)
      const normalizedForward = axisLength > 0 ? forwardAxis / axisLength : 0
      const normalizedRight = axisLength > 0 ? rightAxis / axisLength : 0
      const sin = Math.sin(look.current.yaw)
      const cos = Math.cos(look.current.yaw)
      let nextY = player.position.y + verticalVelocity.current * delta
      if (nextY <= GROUND_Y) {
        nextY = GROUND_Y
        verticalVelocity.current = 0
      }
      const moved = resolveArenaMovement(player.position, {
        x: player.position.x + (-sin * normalizedForward + cos * normalizedRight) * moveSpeed * delta,
        y: nextY,
        z: player.position.z + (-cos * normalizedForward - sin * normalizedRight) * moveSpeed * delta,
      }, player.hitRadius)
      player = {
        ...player,
        position: moved,
        facing: { x: -sin, y: 0, z: -cos },
      }
      combatants.current = replaceCombatant(combatants.current, localPlayerId, player)
      movementSpeed.current = axisLength > 0 ? moveSpeed : 0
    } else movementSpeed.current = 0

    if (networkControlsActive) {
      const pulseBySlot = {
        primary: input.primaryPulse,
        signature: input.signaturePulse,
        mobility: input.mobilityPulse,
        ultimate: input.ultimatePulse,
      } as const
      for (const slot of ['primary', 'signature', 'mobility', 'ultimate'] as const) {
        if (pulseBySlot[slot] === seenPulses.current[slot]) continue
        seenPulses.current[slot] = pulseBySlot[slot]
        castOnlineAbility(slot, nowMs)
      }
      player = combatants.current.find((combatant) => combatant.id === localPlayerId) ?? player
      if (input.primaryHeld && player.alive && cooldownRemainingMs(player, 'primary', nowMs) <= 0) {
        castOnlineAbility('primary', nowMs)
      }
    }

    player = combatants.current.find((combatant) => combatant.id === localPlayerId) ?? player
    const bob = networkControlsActive && player.alive && movementSpeed.current > 0 && !reducedMotion
      ? Math.sin(clock.elapsedTime * (sprint ? 12 : 8.5)) * 0.026
      : 0
    const damageShake = !reducedMotion && damageFlashUntil.current > nowMs
      ? Math.sin(clock.elapsedTime * 38) * 0.014 * ((damageFlashUntil.current - nowMs) / 620)
      : 0
    camera.position.set(player.position.x + damageShake, player.position.y + PLAYER_HEIGHT + bob, player.position.z)
    camera.rotation.set(look.current.pitch, look.current.yaw, damageShake * 0.25, 'YXZ')
    const targetFov = reducedMotion ? 72 : sprint && movementSpeed.current > 0 ? 78 : 72
    if (perspectiveCamera.isPerspectiveCamera) {
      const nextFov = THREE.MathUtils.lerp(perspectiveCamera.fov, targetFov, 1 - Math.exp(-delta * 8))
      if (Math.abs(nextFov - perspectiveCamera.fov) > 0.01) {
        perspectiveCamera.fov = nextFov
        perspectiveCamera.updateProjectionMatrix()
      }
    }

    if (nowMs - lastSnapshotAt.current < SNAPSHOT_INTERVAL_MS) return
    lastSnapshotAt.current = nowMs
    const primary = getHeroKit(player.heroId).abilities.primary
    const aimDirection = viewDirection(look.current)
    const aimed = multiplayer.state?.phase === 'active'
      ? selectAimTarget(player, combatants.current, primary.hitShape, {
          direction: aimDirection,
          point: targetPointForAbility(player, primary, aimDirection),
        }, {
          nowMs,
          hasLineOfSight: hasArenaLineOfSight,
          hitOrigin: eyePoint(player),
          hitPoint: bodyPoint,
        })
      : null
    const opponents = nucleusOpponents(combatants.current, localPlayerId)
    killFeed.current = killFeed.current.filter((entry) => nowMs - entry.atMs < 7_000)
    onSnapshot({
      nowMs,
      elapsedMs: Math.max(0, nowMs - startedAt.current),
      remainingMs: 0,
      player,
      objective: emptyObjective.current,
      activePrime: 2,
      captureProgress: 0,
      captureContested: false,
      playerInsideObjective: false,
      livingEnemies: opponents.filter((combatant) => combatant.alive).length,
      targetId: aimed?.id ?? null,
      hitMarkerUntil: hitMarkerUntil.current,
      damageNumbers: [],
      comboUntil: 0,
      damageFlashUntil: damageFlashUntil.current,
      damageBearingDegrees: damageBearingDegrees.current,
      message: message.current.text,
      messageUntil: message.current.until,
      cooldowns: {
        primary: cooldownRemainingMs(player, 'primary', nowMs),
        signature: cooldownRemainingMs(player, 'signature', nowMs),
        mobility: cooldownRemainingMs(player, 'mobility', nowMs),
        ultimate: cooldownRemainingMs(player, 'ultimate', nowMs),
      },
      online: true,
      onlinePhase: onlinePhase(multiplayer),
      connectedPlayers: multiplayer.state?.players.filter((candidate) => candidate.connected).length ?? 0,
      localTeam: player.team,
      killFeed: killFeed.current,
    })
  }, -2)

  const localTeam = multiplayer.state?.players.find((player) => player.id === localPlayerId)?.team ?? 'cipher'
  const localHeroId = multiplayer.state?.players.find((player) => player.id === localPlayerId)?.heroId ?? heroId
  const remotePlayers = multiplayer.state?.players.filter((player) => (
    player.connected && player.id !== localPlayerId
  )) ?? []

  return (
    <>
      <Nucleus257World
        quality={quality}
        reducedMotion={reducedMotion}
        activePrime={2}
        capturedPrimes={[]}
        captureProgress={0}
      />
      {remotePlayers.map((player) => (
        <CombatantAvatar
          key={player.id}
          id={player.id}
          heroId={player.heroId}
          team={player.team}
          label={`${player.nickname.toUpperCase()} // ${player.team === localTeam ? 'ALIADO' : 'INIMIGO'}`}
          localTeam={localTeam}
          combatants={combatants}
          castTimes={castTimes}
          simulationNowMs={simulationNowMs}
          reducedMotion={reducedMotion}
          quality={quality}
        />
      ))}
      {effects.map((effect) => (
        <PowerEffect
          key={effect.id}
          effect={effect}
          reducedMotion={reducedMotion}
          quality={quality}
          onComplete={removeEffect}
        />
      ))}
      <FirstPersonHands
        heroId={localHeroId}
        movementSpeed={movementSpeed.current}
        reducedMotion={reducedMotion}
        castSignal={castSignal}
      />
    </>
  )
}

export default function Nucleus257Scene({
  multiplayer,
  ...sceneProps
}: Nucleus257SceneProps): JSX.Element {
  return multiplayer.mode === 'online'
    ? <Nucleus257OnlineScene {...sceneProps} multiplayer={multiplayer} />
    : <Nucleus257SoloScene {...sceneProps} />
}

export const NUCLEUS_MATCH_DURATION_MS = MATCH_DURATION_MS
