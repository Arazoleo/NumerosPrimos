import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import { Link } from 'react-router-dom'

import { createMusicDirector, startMusicOnFirstGesture } from '../../audio/proceduralMusic'
import { PRIMEBOUND_TRACK } from '../../audio/tracks'
import { useAudioResource } from '../../audio/useAudioResource'
import { usePrimeverseExpeditionParty } from '../primeverse-online/party/usePrimeverseExpeditionParty'
import { decodePrimeboundPresence, encodePrimeboundPresence } from './primeboundPresence'
import { stretchFactorForParty, stretchTileMap, stretchedGridIndex } from './primeboundMapStretch'
import {
  PRIME_BLESSINGS,
  blessingEffects,
  enemyScaleForRunes,
  findShrineTile,
  offerBlessings,
  type PrimeBlessingId,
} from './primeBlessings'
import {
  PRIMEBOUND_COOP_INTERVAL_MS,
  decodePrimeboundCoopDamage,
  decodePrimeboundCoopState,
  electCoopHost,
  encodePrimeboundCoopDamage,
  encodePrimeboundCoopState,
  reinforcementCount,
  reinforcementOffsets,
} from './primeboundCoop'
import { usePrimeverseSession } from '../primeverse-online/session/PrimeverseSessionProvider'
import { createPrimeboundSfx } from './primeboundAudio'

import {
  applyDamage,
  canDash,
  clamp,
  directionVector,
  distance,
  isSwordAttackHit,
  normalizeMovement,
} from './gameLogic'
import {
  IRREDUCIBLE_AEGIS,
  OFFENSIVE_ACTIONS,
  PRIME_FAMILIES,
  TECHNIQUE_IDS,
  addUltimateCharge,
  beginDefense,
  calculateActionDamage,
  consumeUltimateCharge,
  createDefenseState,
  gainUltimateCharge,
  getCooldownRemaining,
  getDefenseStatus,
  isCooldownReady,
  resolveDefenseHit,
  startCooldown,
  type CombatCooldownId,
  type CooldownState,
  type DefenseState,
  type OffensiveActionId,
  type PrimeTechniqueId,
} from './combatSystem'
import {
  getCinematicProgress,
  getCinematicTimeline,
  type CinematicActionId,
  type CinematicProgress,
} from './cinematicSystem'
import {
  advanceWarriorCombo,
  getClassActionDelivery,
} from './classCombatSystem'
import {
  getHeroClass,
  getHeroClassAction,
  getHeroClassCinematic,
  type HeroActionSlot,
  type HeroCinematicDefinition,
  type HeroClassDefinition,
  type HeroClassId,
} from './heroClassSystem'
import {
  HERO_TRANSFORMATION_DURATION_MS,
  getHeroTransformationProgress,
  getHeroTransformationRemainingMs,
  isHeroTransformationActive,
  resolveHeroTransformationDefinition,
  startHeroTransformation,
  type HeroTransformationDefinition,
  type HeroTransformationState,
} from './heroTransformationSystem'
import {
  applyUltimateQteInput,
  getUltimateQteKeyboardInput,
  getUltimateQteSnapshot,
  resolveUltimateQte,
  startUltimateQte,
  type UltimateQteInput,
  type UltimateQteResult,
  type UltimateQteSnapshot,
  type UltimateQteState,
} from './ultimateQteSystem'
import {
  getPerfectUltimate,
  type PerfectUltimateDefinition,
} from './perfectUltimateSystem'
import {
  advancePrimeChainCount,
  getPrimeStageMechanic,
  isPrimeChainCount,
  resolvePrimeStageHitEffect,
} from './primeStageMechanics'
import {
  canAwakenStageGuardian,
  cancelStageReinforcement,
  completeStageEncounter,
  consumeStageCheckpointRespawn,
  deployStageReinforcement,
  getStageEncounterSnapshot,
  isStageReinforcementReady,
  recordStageMinionDefeat,
  scheduleStageReinforcement,
  shouldScheduleStageReinforcement,
  startStageEncounter,
  type StageEncounterStatus,
  type StageEncounterState,
} from './stageEncounterSystem'
import {
  AREA_ENTRY_CUTSCENE_IDS,
  GUARDIAN_REVEAL_CUTSCENE_IDS,
  PRIMEBOUND_FINALE_CUTSCENE_ID,
  advanceOrCompleteStoryCutscene,
  getStoryCutsceneSnapshot,
  skipStoryCutscene,
  startStoryCutscene,
  type StoryCutsceneId,
  type StoryCutsceneSnapshot,
  type StoryCutsceneState,
} from './storyCutsceneSystem'
import {
  ENEMY_PRIME_POWERS,
  enemyPowerPhaseLabel,
  getEnemyBossPhase,
  isEnemyBossShowcaseCast,
  resolveEnemyPrimePower,
  resolveEnemyPrimePowerAnimePresentation,
  type EnemyBossPhase,
  type EnemyPowerPattern,
  type EnemyPrimePowerCast,
  type EnemyPrimePowerFamilyId,
} from './enemyPrimePowerSystem'
import { heroBodyRects } from './heroSpriteBody'
import { HERO_VOICE_LINES, heroVoiceAudioPath, type HeroVoiceCue } from './heroVoiceLines'
import { createOriginVoicePlayer, readOriginVoiceMuted, type OriginVoicePlayer } from './originVoice'
import type { Direction, EnemyKind, Vec2 } from './types'
import {
  canChallengeCompositeSentinel,
  getNextPrimeboundObjective,
  PRIMEBOUND_AREAS,
  PRIMEBOUND_DIALOGUES,
  PRIMEBOUND_ENEMIES,
  PRIMEBOUND_NPCS,
  PRIMEBOUND_RUNES,
  PRIMEBOUND_WORLD,
  type PrimeboundAreaId,
  type PrimeboundDialogueId,
  type PrimeboundDialogueLine,
  type PrimeboundEnemyId,
  type PrimeboundEncounterRank,
  type PrimeboundNpcId,
  type PrimeboundProgress,
  type PrimeRuneValue,
} from './world'

const VIEW_WIDTH = 480
const VIEW_HEIGHT = 270
const TILE_SIZE = 32
const PLAYER_RADIUS = 8
const BASE_PLAYER_SPEED = 72
const BASE_DASH_SPEED = 188
const DASH_DURATION_MS = 170
const DASH_COOLDOWN_MS = 580
const DASH_COST = 34
const ATTACK_DURATION_MS = 180
const TECHNIQUE_ATTACK_DURATION_MS = 430
const GUARD_STAMINA_COST = 18
const MAX_COMBAT_EFFECTS = 18
const MAX_PARTICLES = 220
const MAX_ENEMY_PROJECTILES = 48
const MAX_ENEMY_POWER_EFFECTS = 10
const MAX_HERO_PROJECTILES = 40
const MAX_SPELL_ZONES = 8
const PRIME_CHAIN_WINDOW_MS = 2_200
const TRANSFORMATION_MAX_CHARGE = 100
const GAMEPLAY_CAMERA_SHAKE_SCALE = .38
const CINEMATIC_CAMERA_SHAKE_SCALE = .46
const STORY_CAMERA_SHAKE_SCALE = .28
const CAMERA_SHAKE_DECAY_PER_SECOND = 34

const COMBAT_KEY_ACTIONS: Readonly<Partial<Record<string, PlayerCombatAction>>> = {
  KeyJ: 'basic-strike',
  Space: 'basic-strike',
  Digit1: 'twin-blades',
  Digit2: 'sophie-chain',
  Digit3: 'mersenne-burst',
  KeyQ: 'irreducible-aegis',
  KeyR: 'prime-infinity',
}

export interface PrimeboundRunResult {
  readonly heroClassId: HeroClassId
  readonly elapsedMs: number
  readonly enemiesDefeated: number
  readonly runesCollected: number
  readonly damageTaken: number
}

interface PrimeboundGameProps {
  readonly heroClassId: HeroClassId
  readonly paused: boolean
  readonly onPauseChange: (paused: boolean) => void
  readonly onExitToClassSelect: () => void
  readonly onVictory: (result: PrimeboundRunResult) => void
  readonly onDefeat: (result: PrimeboundRunResult) => void
}

interface PlayerState {
  x: number
  y: number
  facing: Direction
  health: number
  maxHealth: number
  damageRemainder: number
  stamina: number
  maxStamina: number
  invulnerableUntilMs: number
  lastDashAtMs: number | null
  dashUntilMs: number
  lastMoveAtMs: number
  attackUntilMs: number
  attackSerial: number
  attackOrigin: Vec2
  attackFacing: Direction
  activeAction: OffensiveActionId | null
  warriorComboStep: 0 | 1 | 2 | 3
  warriorComboUntilMs: number
  classDefenseUntilMs: number
  cooldowns: CooldownState
  defense: DefenseState
  ultimateCharge: number
  transformationCharge: number
  transformation: HeroTransformationState | null
  transformationGuardCharges: number
  nextTransformationPulseAtMs: number
}

type PlayerCombatAction = OffensiveActionId | typeof IRREDUCIBLE_AEGIS.id
type EnemyIntent = 'cast' | 'charge' | 'burst' | null

const ACTION_ID_TO_HERO_SLOT: Readonly<Record<PlayerCombatAction, HeroActionSlot>> = {
  'basic-strike': 'J',
  'twin-blades': '1',
  'sophie-chain': '2',
  'mersenne-burst': '3',
  'irreducible-aegis': 'Q',
  'prime-infinity': 'R',
}

const TECHNIQUE_SLOT_BY_ID: Readonly<Record<PrimeTechniqueId, '1' | '2' | '3'>> = {
  'twin-blades': '1',
  'sophie-chain': '2',
  'mersenne-burst': '3',
}

interface EnemyState {
  id: PrimeboundEnemyId
  kind: EnemyKind
  x: number
  y: number
  hp: number
  maxHp: number
  radius: number
  speed: number
  lastActionAtMs: number
  lastAttackSerial: number
  awake: boolean
  flashUntilMs: number
  stunnedUntilMs: number
  intent: EnemyIntent
  intentStartedAtMs: number
  intentUntilMs: number
  intentTarget: Vec2 | null
  vx: number
  vy: number
  rsaMark: 0 | 1 | 2 | 3
  rsaMarkUntilMs: number
  bossPhase: EnemyBossPhase
  powerCastSerial: number
}

interface ProjectileState {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  lifeMs: number
  color: string
  damage: number
  sourceEnemyId: PrimeboundEnemyId
  familyId: EnemyPrimePowerFamilyId
  pattern: EnemyPowerPattern
  phase: EnemyBossPhase
  ageMs: number
  homingStrength: number
  angularVelocity: number
  variant: number
}

interface EnemyPowerEffectState {
  readonly id: number
  readonly familyId: EnemyPrimePowerFamilyId
  readonly kind: 'cast' | 'impact' | 'phase-break'
  readonly x: number
  readonly y: number
  readonly phase: EnemyBossPhase
  readonly rotation: number
  readonly dramatic: boolean
  readonly startedAtMs: number
  readonly durationMs: number
}

type RsaMark = 0 | 1 | 2 | 3

type HeroProjectileKind =
  | 'crypto-pulse'
  | 'rsa-key-p'
  | 'rsa-key-q'
  | 'rsa-chain'
  | 'arrow'
  | 'twin-arrow'
  | 'ricochet-arrow'
  | 'euclid-arrow'
  | 'mobius-blade'
  | 'sieve-bolt'
  | 'turret-bolt'
  | 'elliptic-orb'
  | 'elliptic-chain'

interface HeroProjectileState {
  readonly id: number
  readonly kind: HeroProjectileKind
  readonly actionId: OffensiveActionId
  x: number
  y: number
  vx: number
  vy: number
  readonly speed: number
  readonly radius: number
  lifeMs: number
  readonly damage: number
  targetEnemyId: PrimeboundEnemyId | null
  readonly homingStrength: number
  remainingBounces: number
  readonly hitEnemyIds: PrimeboundEnemyId[]
  readonly rsaMark: RsaMark
  readonly isTransformationEcho: boolean
  grantsUltimateCharge: boolean
}

type SpellZoneKind =
  | 'glyph'
  | 'supernova'
  | 'constellation'
  | 'sieve-turret'
  | 'sieve-line'
  | 'sieve-minefield'
  | 'sieve-grid'
  | 'elliptic-singularity'
  | 'elliptic-curve'

interface SpellZoneState {
  readonly id: number
  readonly kind: SpellZoneKind
  readonly actionId: OffensiveActionId
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly startedAtMs: number
  readonly durationMs: number
  readonly armAtMs: number
  nextPulseAtMs: number
  readonly pulseIntervalMs: number
  readonly pulseDamages: readonly number[]
  pulseIndex: number
  consumed: boolean
}

interface PendingCombatHit {
  readonly actionId: PrimeTechniqueId | 'prime-infinity'
  readonly enemyId: PrimeboundEnemyId
  readonly damage: number
  readonly executeAtMs: number
  readonly grantsUltimateCharge: boolean
}

interface PendingPerfectUltimateWave {
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly damage: number
  readonly executeAtPresentationMs: number
  readonly stunMs: number
  readonly isFinal: boolean
  readonly stunnedEnemyIds: Set<PrimeboundEnemyId>
}

type CombatEffectKind =
  | PrimeTechniqueId
  | 'prime-infinity'
  | 'class-basic'
  | 'parry'
  | 'guard'
  | 'rsa-detonation'
  | 'arrow-rain'
  | 'glyph-detonation'
  | 'constellation-pulse'
  | 'euclid-dash'
  | 'prime-resonance'
  | 'perfect-ultimate'
  | 'mobius-step'
  | 'goldbach-impact'
  | 'sieve-deploy'
  | 'elliptic-arc'

interface CombatEffectState {
  readonly id: number
  readonly kind: CombatEffectKind
  readonly x: number
  readonly y: number
  readonly facing: Direction
  readonly startedAtMs: number
  readonly durationMs: number
  readonly radius: number
  readonly heroClassId: HeroClassId
  readonly usesPresentationClock: boolean
}

interface HeroCalloutState {
  readonly title: string
  readonly detail: string
  readonly untilMs: number
  readonly source?: 'hero' | 'enemy'
  readonly familyId?: EnemyPrimePowerFamilyId
  readonly phase?: EnemyBossPhase
  readonly worldPosition?: Vec2
}

interface CombatCinematicState {
  readonly actionId: CinematicActionId
  readonly focus: Vec2
  elapsedMs: number
  impactTriggered: boolean
  lastPhraseId: string | null
  ultimateQte: UltimateQteState | null
  ultimateQteResult: UltimateQteResult | null
  perfectUltimateOrigin: Vec2 | null
}

interface TransformationIntroState {
  readonly startedAtMs: number
  readonly durationMs: number
  readonly impactAtMs: number
  released: boolean
}

interface ParticleState {
  x: number
  y: number
  vx: number
  vy: number
  lifeMs: number
  maxLifeMs: number
  size: number
  color: string
}

interface ToastState {
  title: string
  detail: string
  untilMs: number
  tone: 'gold' | 'violet' | 'danger'
}

interface EngineState {
  heroClassId: HeroClassId
  areaId: PrimeboundAreaId
  progress: {
    currentAreaId: PrimeboundAreaId
    visitedAreaIds: PrimeboundAreaId[]
    spokenNpcIds: PrimeboundNpcId[]
    collectedRunes: PrimeRuneValue[]
    defeatedEnemyIds: PrimeboundEnemyId[]
    completedStageIds: PrimeboundAreaId[]
  }
  stageEncounters: Partial<Record<PrimeboundAreaId, StageEncounterState>>
  /** Bênçãos Primas owned this run, one entry per stack. */
  blessings: PrimeBlessingId[]
  /** Shrines already consumed, one per region at most. */
  blessedShrineAreaIds: PrimeboundAreaId[]
  /** An open shrine choice pauses combat input until the player picks. */
  blessingChoice: readonly PrimeBlessingId[] | null
  /** A guardian waking triggers the letterboxed introduction card. */
  bossIntro: { readonly enemyId: PrimeboundEnemyId; readonly startedAtMs: number } | null
  player: PlayerState
  enemies: EnemyState[]
  projectiles: ProjectileState[]
  enemyPowerEffects: EnemyPowerEffectState[]
  enemyHitStopMs: number
  heroProjectiles: HeroProjectileState[]
  spellZones: SpellZoneState[]
  rangerMarkedEnemyId: PrimeboundEnemyId | null
  rangerMarkUntilMs: number
  primeChainCount: number
  primeChainUntilMs: number
  primeAscensionUntilMs: number
  pendingCombatHits: PendingCombatHit[]
  pendingPerfectUltimateWaves: PendingPerfectUltimateWave[]
  particles: ParticleState[]
  combatEffects: CombatEffectState[]
  elapsedMs: number
  stageClockMs: number
  presentationElapsedMs: number
  kills: number
  damageTaken: number
  camera: Vec2
  shake: number
  toast: ToastState | null
  areaBannerUntilMs: number
  callout: HeroCalloutState | null
  cinematic: CombatCinematicState | null
  storyCutscene: StoryCutsceneState | null
  storyCutsceneBeatElapsedMs: number
  pendingStoryCutsceneIds: StoryCutsceneId[]
  seenStoryCutsceneIds: StoryCutsceneId[]
  transformationIntro: TransformationIntroState | null
  queuedCombatAction: PlayerCombatAction | null
  queuedDash: boolean
  queuedTransformation: boolean
  nextEffectId: number
  nextCombatEntityId: number
  ended: boolean
}

interface HudState {
  blessings: PrimeBlessingId[]
  blessingChoice: readonly PrimeBlessingId[] | null
  bossIntro: {
    readonly name: string
    readonly number: number
    readonly rank: 'area-boss' | 'final-boss'
    readonly power: string
    readonly sinceMs: number
  } | null
  health: number
  maxHealth: number
  stamina: number
  maxStamina: number
  areaId: PrimeboundAreaId
  areaName: string
  areaSubtitle: string
  objectiveTitle: string
  objectiveDetail: string
  runes: readonly PrimeRuneValue[]
  elapsedMs: number
  kills: number
  prompt: string | null
  bossHealth: number | null
  bossMaxHealth: number | null
  bossLabel: string | null
  bossPowerLabel: string | null
  bossPhase: EnemyBossPhase | null
  toast: ToastState | null
  callout: HeroCalloutState | null
  cinematicActionId: CinematicActionId | null
  cinematicPhrase: string | null
  storyCutscene: StoryCutsceneSnapshot | null
  storyCutsceneProgress: number
  ultimateQte: UltimateQteSnapshot | null
  ultimateQteResult: UltimateQteResult | null
  cooldowns: Readonly<Record<CombatCooldownId, number>>
  unlockedTechniqueCount: number
  ultimateCharge: number
  transformationCharge: number
  transformationActive: boolean
  transformationRemainingMs: number
  transformationName: string
  transformationPhase: ReturnType<typeof getHeroTransformationProgress>['phase'] | null
  defenseStatus: ReturnType<typeof getDefenseStatus>
  classResourceLabel: string
  classResourceValue: number
  classResourceMax: number
  classResourceDetail: string
  primeChainCount: number
  primeChainIsPrime: boolean
  primeAscensionActive: boolean
  stageStatus: StageEncounterStatus
  stageProgress: number
  stageActiveEnemyCount: number
  stageNextReinforcementRemainingMs: number
  stageRespawnsRemaining: number
  stageCompleted: boolean
}

interface ActiveDialogue {
  readonly lines: readonly PrimeboundDialogueLine[]
  readonly index: number
}

type SoundName =
  | 'swing'
  | 'hit'
  | 'hurt'
  | 'dash'
  | 'rune'
  | 'portal'
  | 'victory'
  | 'technique'
  | 'guard'
  | 'parry'
  | 'ultimate'
  | 'cinematic-rise'
  | 'cinematic-beat'
  | 'cinematic-release'

const ENEMY_KINDS: Readonly<Partial<Record<PrimeboundEnemyId, EnemyKind>>> = {
  'quadruped-slime': 'crawler',
  'echo-moth': 'caster',
  'hexagonal-wraith': 'caster',
  'fifteen-knight': 'charger',
  'twelve-mirror': 'caster',
  'twenty-five-duelist': 'charger',
  'forty-nine-golem': 'charger',
  'seventy-five-smith': 'caster',
  'thirty-five-sieve': 'charger',
  'seventy-seven-sentinel': 'caster',
  'twenty-two-pair': 'charger',
  'twenty-six-pair': 'caster',
  'thirty-three-twin-lancer': 'charger',
  'sixty-five-sophie-weaver': 'caster',
  'one-forty-three-judge': 'charger',
  'one-sixty-nine-congruence': 'caster',
  'ninety-one-sieve-orbit': 'charger',
  'one-twenty-one-power-oracle': 'caster',
  'thirty-mobius-stalker': 'charger',
  'forty-two-loop-wraith': 'caster',
  'seventy-eight-inversion-warden': 'caster',
  'fifty-five-fermat-squire': 'charger',
  'ninety-goldbach-artillerist': 'caster',
  'one-thirty-fermat-keeper': 'guardian',
  'forty-five-sieve-drone': 'caster',
  'eighty-eight-twin-smith': 'charger',
  'one-ninety-five-foundry-overseer': 'caster',
  'ninety-eight-curve-hunter': 'charger',
  'one-forty-seven-nexus-seer': 'caster',
  'two-eighty-six-elliptic-archon': 'caster',
  'twenty-one-idol': 'caster',
  'sixty-three-mersenne-seer': 'caster',
  'sixty-six-goldbach-herald': 'charger',
  'composite-sentinel': 'guardian',
}

const AREA_ACCENTS: Readonly<Record<string, string>> = {
  'echo-woods': '#9ad66f',
  'composite-crypt': '#b59af5',
  'twin-peaks': '#76edf0',
  'residue-forge': '#ff9e55',
  'eratosthenes-garden': '#72efb4',
  'goldbach-citadel': '#ff92d5',
  'wilson-observatory': '#8fb8ff',
  'mobius-labyrinth': '#ff7199',
  'fermat-bastion': '#ff9b57',
  'sieve-foundry': '#62efb2',
  'elliptic-nexus': '#9f8cff',
  'prime-sanctuary': '#f2c15c',
}

const PRIME_RUNE_SEQUENCE = (
  Object.keys(PRIMEBOUND_RUNES).map(Number) as PrimeRuneValue[]
).sort((first, second) => first - second)

const RUNE_DIALOGUE_BY_VALUE: Readonly<Record<PrimeRuneValue, PrimeboundDialogueId>> = {
  2: 'seris-rune',
  3: 'orun-rune',
  5: 'lyra-rune',
  7: 'theon-rune',
  11: 'aurea-rune',
  13: 'wilson-rune',
}

const DIRECTION_LABELS: Readonly<Record<Direction, string>> = {
  up: 'cima',
  down: 'baixo',
  left: 'esquerda',
  right: 'direita',
}

function gridToWorld(position: Vec2): Vec2 {
  return {
    x: (stretchedGridIndex(position.x, onlineStretch) + 0.5) * TILE_SIZE,
    y: (stretchedGridIndex(position.y, onlineStretch) + 0.5) * TILE_SIZE,
  }
}

function worldSize(areaId: PrimeboundAreaId): Vec2 {
  const tileMap = tileMapFor(PRIMEBOUND_AREAS[areaId])
  return { x: tileMap[0].length * TILE_SIZE, y: tileMap.length * TILE_SIZE }
}

function enemyStats(id: PrimeboundEnemyId): Pick<EnemyState, 'radius' | 'speed'> {
  const rank = PRIMEBOUND_ENEMIES[id].encounterRank
  if (rank === 'final-boss') return { radius: 16, speed: 28 }
  if (rank === 'area-boss') return { radius: 14, speed: 30 }
  const kind = enemyKindFor(id)
  if (kind === 'guardian') return { radius: 13, speed: 28 }
  if (kind === 'charger') return { radius: 11, speed: 43 }
  if (kind === 'caster') return { radius: 10, speed: 31 }
  return { radius: 9, speed: 39 }
}

function enemyKindFor(id: PrimeboundEnemyId): EnemyKind {
  const configuredKind = ENEMY_KINDS[id]
  if (configuredKind) return configuredKind
  const number = PRIMEBOUND_ENEMIES[id].number
  if (number % 3 === 0) return 'caster'
  if (number % 2 === 0) return 'charger'
  return 'crawler'
}

function createEnemyState(id: PrimeboundEnemyId): EnemyState {
  const definition = PRIMEBOUND_ENEMIES[id]
  const position = gridToWorld(definition.position)
  const stats = enemyStats(id)
  const isEncounterBoss = definition.encounterRank !== 'minion'
  return {
    id,
    kind: isEncounterBoss ? 'guardian' : enemyKindFor(id),
    x: position.x,
    y: position.y,
    hp: definition.maxHealth,
    maxHp: definition.maxHealth,
    radius: stats.radius,
    speed: stats.speed,
    lastActionAtMs: -2_000,
    lastAttackSerial: -1,
    awake: definition.encounterRank === 'minion',
    flashUntilMs: 0,
    stunnedUntilMs: 0,
    intent: null,
    intentStartedAtMs: 0,
    intentUntilMs: 0,
    intentTarget: null,
    vx: 0,
    vy: 0,
    rsaMark: 0,
    rsaMarkUntilMs: 0,
    bossPhase: 1,
    powerCastSerial: 0,
  }
}

/** Set by the component while an online party is active; read at area spawn. */
let onlinePartySize = 1
/** Desired stretch from the roster; applied only when a fresh area loads, so the
 * ground never rescales under a player mid-room when a friend joins or leaves. */
let desiredStretch = 1
let onlineStretch = 1
const stretchedMapCache = new Map<string, readonly string[]>()

export function setPrimeboundOnlinePartySize(size: number): void {
  onlinePartySize = Number.isFinite(size) && size > 1 ? Math.floor(size) : 1
  desiredStretch = stretchFactorForParty(onlinePartySize)
}

/** The map the whole engine reads: stretched while an online party is active. */
function tileMapFor(area: { readonly id: string; readonly tileMap: readonly string[] }): readonly string[] {
  if (onlineStretch === 1) return area.tileMap
  const key = `${area.id}:${onlineStretch}`
  const cached = stretchedMapCache.get(key)
  if (cached) return cached
  const stretched = stretchTileMap(area.tileMap, onlineStretch)
  stretchedMapCache.set(key, stretched)
  return stretched
}

function createAreaEnemies(
  areaId: PrimeboundAreaId,
  defeatedEnemyIds: readonly PrimeboundEnemyId[],
  runeCount = 0,
): EnemyState[] {
  // Area entry is the one safe moment to adopt the party's map scale.
  onlineStretch = desiredStretch
  // The world answers your runes: survivors of the sieve grow tougher and quicker.
  const scale = enemyScaleForRunes(runeCount)
  const base = PRIMEBOUND_AREAS[areaId].enemyIds
    .filter((id) => !defeatedEnemyIds.includes(id))
    .map((id) => {
      const enemy = createEnemyState(id)
      enemy.hp = Math.round(enemy.hp * scale.hpMultiplier)
      enemy.maxHp = Math.round(enemy.maxHp * scale.hpMultiplier)
      enemy.speed *= scale.speedMultiplier
      return enemy
    })
  // Online, the region fights back at party strength: every minion brings copies,
  // one per extra member, in a ring around the original. Bosses never multiply.
  const copies = reinforcementCount(onlinePartySize)
  if (copies === 0) return base
  const reinforced = [...base]
  for (const enemy of base) {
    if (PRIMEBOUND_ENEMIES[enemy.id].encounterRank !== 'minion') continue
    for (const offset of reinforcementOffsets(copies)) {
      reinforced.push({ ...createEnemyState(enemy.id), x: enemy.x + offset.x, y: enemy.y + offset.y })
    }
  }
  return reinforced
}

const shrineTileCache = new Map<PrimeboundAreaId, Vec2 | null>()

/** Every region hides one shrine on an open floor tile near its centre. */
function shrineTileForArea(areaId: PrimeboundAreaId): Vec2 | null {
  const cached = shrineTileCache.get(areaId)
  if (cached !== undefined) return cached
  const tile = findShrineTile(PRIMEBOUND_AREAS[areaId].tileMap)
  shrineTileCache.set(areaId, tile)
  return tile
}

function stageEncounterFor(
  state: EngineState,
  areaId: PrimeboundAreaId = state.areaId,
): StageEncounterState {
  const existing = state.stageEncounters[areaId]
  if (existing) return existing
  const encounter = startStageEncounter(
    areaId,
    state.stageClockMs,
    state.progress.completedStageIds.includes(areaId),
  )
  state.stageEncounters[areaId] = encounter
  return encounter
}

function updateStageEncounter(
  state: EngineState,
  encounter: StageEncounterState,
): void {
  state.stageEncounters[encounter.areaId] = encounter
}

function completeCurrentStage(state: EngineState): void {
  if (state.progress.completedStageIds.includes(state.areaId)) return
  const completed = completeStageEncounter(stageEncounterFor(state), state.stageClockMs)
  updateStageEncounter(state, completed)
  state.progress.completedStageIds.push(state.areaId)
}

function queueStoryCutscene(state: EngineState, sceneId: StoryCutsceneId): void {
  if (
    state.storyCutscene?.sceneId === sceneId ||
    state.pendingStoryCutsceneIds.includes(sceneId) ||
    state.seenStoryCutsceneIds.includes(sceneId)
  ) return
  if (sceneId === PRIMEBOUND_FINALE_CUTSCENE_ID) {
    state.pendingStoryCutsceneIds.unshift(sceneId)
  } else {
    state.pendingStoryCutsceneIds.push(sceneId)
  }
}

function canStartQueuedStoryCutscene(state: EngineState): boolean {
  return Boolean(
    !state.storyCutscene &&
    !state.ended &&
    state.pendingStoryCutsceneIds.length > 0 &&
    !state.cinematic &&
    !state.transformationIntro &&
    state.enemyHitStopMs <= 0 &&
    state.pendingCombatHits.length === 0 &&
    state.pendingPerfectUltimateWaves.length === 0 &&
    state.elapsedMs >= state.player.attackUntilMs,
  )
}

function startQueuedStoryCutscene(state: EngineState): boolean {
  if (!canStartQueuedStoryCutscene(state)) return false
  const sceneId = state.pendingStoryCutsceneIds.shift()
  if (!sceneId) return false
  state.storyCutscene = startStoryCutscene(sceneId)
  state.storyCutsceneBeatElapsedMs = 0
  state.queuedCombatAction = null
  state.queuedDash = false
  state.queuedTransformation = false
  state.projectiles = []
  state.heroProjectiles = []
  state.spellZones = []
  return true
}

function storyGuardian(state: EngineState, sceneId: StoryCutsceneId): EnemyState | null {
  const snapshot = getStoryCutsceneSnapshot(startStoryCutscene(sceneId))
  if (snapshot.kind !== 'guardian-reveal') return null
  const guardianRank: PrimeboundEncounterRank = snapshot.areaId === 'prime-sanctuary'
    ? 'final-boss'
    : 'area-boss'
  return state.enemies.find((enemy) =>
    PRIMEBOUND_ENEMIES[enemy.id].encounterRank === guardianRank,
  ) ?? null
}

function revealStoryGuardian(state: EngineState, sceneId: StoryCutsceneId): EnemyState | null {
  const guardian = storyGuardian(state, sceneId)
  if (!guardian) return null
  guardian.awake = true
  guardian.bossPhase = 1
  guardian.intent = null
  guardian.intentTarget = null
  guardian.intentUntilMs = 0
  guardian.vx = 0
  guardian.vy = 0
  guardian.flashUntilMs = Math.max(guardian.flashUntilMs, state.elapsedMs + 240)
  return guardian
}

function finishStoryCutscene(state: EngineState): EnemyState | null {
  const active = state.storyCutscene
  if (!active) return null
  const snapshot = getStoryCutsceneSnapshot(active)
  const sceneId = active.sceneId
  const guardian = snapshot.kind === 'guardian-reveal'
    ? revealStoryGuardian(state, sceneId)
    : null

  if (guardian) {
    const definition = PRIMEBOUND_ENEMIES[guardian.id]
    const openingPower = enemyPrimePowerFor(guardian)
    guardian.lastActionAtMs = state.elapsedMs
    guardian.stunnedUntilMs = state.elapsedMs + (definition.encounterRank === 'final-boss' ? 850 : 1_000)
    if (definition.encounterRank === 'final-boss') {
      guardian.intent = openingPower.intent
      guardian.intentStartedAtMs = state.elapsedMs
      guardian.intentUntilMs = state.elapsedMs + 1_400
      guardian.intentTarget = { x: state.player.x, y: state.player.y }
    }
    addEnemyPowerEffectAt(
      state,
      openingPower.id,
      openingPower.phase,
      guardian,
      'phase-break',
      false,
    )
    createParticles(state, guardian.x, guardian.y, openingPower.color, 30, 62)
    // The card the terror game taught us: letterbox, the number, the name.
    state.bossIntro = { enemyId: guardian.id, startedAtMs: state.elapsedMs }
    state.shake = Math.max(state.shake, 10)
    state.enemyHitStopMs = Math.max(state.enemyHitStopMs, 260)
    state.toast = {
      title: `${definition.encounterRank === 'final-boss' ? 'CHEFE FINAL' : 'CHEFE DA REGIÃO'}: ${definition.name}`,
      detail: `${definition.signaturePower.name} · ${definition.signaturePower.formula}`,
      tone: 'danger',
      untilMs: state.elapsedMs + 3_800,
    }
    state.callout = {
      title: openingPower.anime.techniqueName,
      detail: `${openingPower.anime.battleCry} · ${openingPower.anime.glyph}`,
      untilMs: state.elapsedMs + 1_650,
      source: 'enemy',
      familyId: openingPower.id,
      phase: openingPower.phase,
      worldPosition: { x: guardian.x, y: guardian.y },
    }
    state.shake = Math.max(state.shake, 5)
  }

  if (!state.seenStoryCutsceneIds.includes(sceneId)) {
    state.seenStoryCutsceneIds.push(sceneId)
  }
  state.storyCutscene = null
  state.storyCutsceneBeatElapsedMs = 0
  return guardian
}

function createEngine(heroClassId: HeroClassId): EngineState {
  const areaId: PrimeboundAreaId = 'echo-woods'
  const spawn = gridToWorld(PRIMEBOUND_AREAS[areaId].playerSpawn)
  const heroClass = getHeroClass(heroClassId)
  return {
    heroClassId,
    areaId,
    blessings: [],
    blessedShrineAreaIds: [],
    blessingChoice: null,
    bossIntro: null,
    progress: {
      currentAreaId: areaId,
      visitedAreaIds: [areaId],
      spokenNpcIds: [],
      collectedRunes: [],
      defeatedEnemyIds: [],
      completedStageIds: [],
    },
    stageEncounters: {
      [areaId]: startStageEncounter(areaId, 0),
    },
    player: {
      x: spawn.x,
      y: spawn.y,
      facing: 'right',
      health: heroClass.stats.maxHealth,
      maxHealth: heroClass.stats.maxHealth,
      damageRemainder: 0,
      stamina: heroClass.stats.maxStamina,
      maxStamina: heroClass.stats.maxStamina,
      invulnerableUntilMs: 0,
      lastDashAtMs: null,
      dashUntilMs: 0,
      lastMoveAtMs: -1_000,
      attackUntilMs: 0,
      attackSerial: 0,
      attackOrigin: { x: spawn.x, y: spawn.y },
      attackFacing: 'right',
      activeAction: null,
      warriorComboStep: 0,
      warriorComboUntilMs: 0,
      classDefenseUntilMs: 0,
      cooldowns: {},
      defense: createDefenseState(),
      ultimateCharge: 0,
      transformationCharge: 0,
      transformation: null,
      transformationGuardCharges: 0,
      nextTransformationPulseAtMs: 0,
    },
    enemies: createAreaEnemies(areaId, []),
    projectiles: [],
    enemyPowerEffects: [],
    enemyHitStopMs: 0,
    heroProjectiles: [],
    spellZones: [],
    rangerMarkedEnemyId: null,
    rangerMarkUntilMs: 0,
    primeChainCount: 0,
    primeChainUntilMs: 0,
    primeAscensionUntilMs: 0,
    pendingCombatHits: [],
    pendingPerfectUltimateWaves: [],
    particles: [],
    combatEffects: [],
    elapsedMs: 0,
    stageClockMs: 0,
    presentationElapsedMs: 0,
    kills: 0,
    damageTaken: 0,
    camera: { x: 0, y: 35 },
    shake: 0,
    toast: {
      title: `${heroClass.characterName} atravessou o véu`,
      detail: `${heroClass.title}. Encontre Seris e descubra o caminho das runas.`,
      tone: 'gold',
      untilMs: 3_500,
    },
    areaBannerUntilMs: 0,
    callout: null,
    cinematic: null,
    storyCutscene: startStoryCutscene(AREA_ENTRY_CUTSCENE_IDS[areaId]),
    storyCutsceneBeatElapsedMs: 0,
    pendingStoryCutsceneIds: [],
    seenStoryCutsceneIds: [],
    transformationIntro: null,
    queuedCombatAction: null,
    queuedDash: false,
    queuedTransformation: false,
    nextEffectId: 0,
    nextCombatEntityId: 0,
    ended: false,
  }
}

function progressView(state: EngineState): PrimeboundProgress {
  return state.progress
}

function isWalkable(areaId: PrimeboundAreaId, x: number, y: number, radius: number): boolean {
  const area = PRIMEBOUND_AREAS[areaId]
  const size = worldSize(areaId)
  if (x - radius < 0 || y - radius < 0 || x + radius >= size.x || y + radius >= size.y) return false

  const samples = [
    [x - radius, y], [x + radius, y], [x, y - radius], [x, y + radius],
    [x - radius * 0.72, y - radius * 0.72], [x + radius * 0.72, y - radius * 0.72],
    [x - radius * 0.72, y + radius * 0.72], [x + radius * 0.72, y + radius * 0.72],
  ]
  return samples.every(([sampleX, sampleY]) => {
    const tileX = Math.floor(sampleX / TILE_SIZE)
    const tileY = Math.floor(sampleY / TILE_SIZE)
    const tile = tileMapFor(area)[tileY]?.[tileX]
    return tile === '.' || tile === '+' || tile === 'D'
  })
}

function moveWithCollision(
  areaId: PrimeboundAreaId,
  entity: { x: number; y: number },
  radius: number,
  deltaX: number,
  deltaY: number,
): void {
  const nextX = entity.x + deltaX
  if (isWalkable(areaId, nextX, entity.y, radius)) entity.x = nextX
  const nextY = entity.y + deltaY
  if (isWalkable(areaId, entity.x, nextY, radius)) entity.y = nextY
}

function areaEnemyIdsByRank(
  areaId: PrimeboundAreaId,
  rank: PrimeboundEncounterRank,
): readonly PrimeboundEnemyId[] {
  return PRIMEBOUND_AREAS[areaId].enemyIds.filter((id) =>
    PRIMEBOUND_ENEMIES[id].encounterRank === rank,
  )
}

function isAreaClear(state: EngineState): boolean {
  return state.progress.completedStageIds.includes(state.areaId)
}

function hasMetLocalGuides(state: EngineState): boolean {
  return PRIMEBOUND_AREAS[state.areaId].npcIds.every((npcId) =>
    state.progress.spokenNpcIds.includes(npcId),
  )
}

function isRuneUnlocked(state: EngineState): boolean {
  return hasMetLocalGuides(state) && isAreaClear(state)
}

function runeForArea(areaId: PrimeboundAreaId) {
  const value = PRIMEBOUND_AREAS[areaId].runeValues[0]
  return value ? PRIMEBOUND_RUNES[value] : null
}

function isNearEasternGate(state: EngineState): boolean {
  const area = PRIMEBOUND_AREAS[state.areaId]
  const exitRow = tileMapFor(area).findIndex((row) => row.endsWith('D'))
  if (exitRow < 0) return false
  const size = worldSize(state.areaId)
  const gateY = (exitRow + 0.5) * TILE_SIZE
  return state.player.x >= size.x - 51 && Math.abs(state.player.y - gateY) <= 30
}

function getNextAreaId(areaId: PrimeboundAreaId): PrimeboundAreaId | null {
  const currentIndex = PRIMEBOUND_WORLD.areaOrder.indexOf(areaId)
  return PRIMEBOUND_WORLD.areaOrder[currentIndex + 1] ?? null
}

function canUseEasternGate(state: EngineState): boolean {
  const nextAreaId = getNextAreaId(state.areaId)
  if (!nextAreaId || !isAreaClear(state) || !hasMetLocalGuides(state)) return false
  return PRIMEBOUND_AREAS[nextAreaId].requiredRunesToEnter.every((rune) =>
    state.progress.collectedRunes.includes(rune),
  )
}

function currentPrompt(state: EngineState): string | null {
  if (state.storyCutscene) return null
  const player = state.player
  for (const npcId of PRIMEBOUND_AREAS[state.areaId].npcIds) {
    const npc = PRIMEBOUND_NPCS[npcId]
    if (distance(player, gridToWorld(npc.position)) <= 43) return `E  FALAR COM ${npc.name.toUpperCase()}`
  }

  const rune = runeForArea(state.areaId)
  if (
    rune &&
    isRuneUnlocked(state) &&
    !state.progress.collectedRunes.includes(rune.value) &&
    distance(player, gridToWorld(rune.position)) <= 38
  ) return `E  RECOLHER RUNA ${rune.value}`

  const shrineTile = shrineTileForArea(state.areaId)
  if (
    shrineTile
    && !state.blessedShrineAreaIds.includes(state.areaId)
    && distance(player, gridToWorld(shrineTile)) <= 40
  ) return 'E  TOCAR O SANTUÁRIO PRIMO'

  const nextAreaId = getNextAreaId(state.areaId)
  if (nextAreaId && isNearEasternGate(state)) {
    if (!isAreaClear(state)) return 'DERROTE AS SOMBRAS ANTES DE AVANÇAR'
    const localGuide = PRIMEBOUND_AREAS[state.areaId].npcIds.find((npcId) =>
      !state.progress.spokenNpcIds.includes(npcId),
    )
    if (localGuide) return `FALE COM ${PRIMEBOUND_NPCS[localGuide].name.toUpperCase()} ANTES DE AVANÇAR`
    const missingRunes = PRIMEBOUND_AREAS[nextAreaId].requiredRunesToEnter.filter((rune) =>
      !state.progress.collectedRunes.includes(rune),
    )
    return missingRunes.length === 0
      ? 'E  ATRAVESSAR PASSAGEM'
      : `RUNAS ${missingRunes.join(' · ')} SELAM ESTA PASSAGEM`
  }
  return null
}

function createParticles(
  state: EngineState,
  x: number,
  y: number,
  color: string,
  amount: number,
  force = 34,
): void {
  const available = Math.max(0, MAX_PARTICLES - state.particles.length)
  for (let index = 0; index < Math.min(amount, available); index += 1) {
    const angle = (index / amount) * Math.PI * 2 + state.elapsedMs * 0.001
    const speed = force * (0.45 + ((index * 37) % 10) / 12)
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      lifeMs: 420 + (index % 4) * 90,
      maxLifeMs: 690,
      size: 1 + (index % 3),
      color,
    })
  }
}

function addCombatEffect(
  state: EngineState,
  kind: CombatEffectKind,
  radius: number,
  durationMs: number,
  origin: Vec2 = state.player,
  facing: Direction = state.player.facing,
  usesPresentationClock = false,
): void {
  state.nextEffectId += 1
  state.combatEffects.push({
    id: state.nextEffectId,
    kind,
    x: origin.x,
    y: origin.y,
    facing,
    startedAtMs: usesPresentationClock
      ? state.presentationElapsedMs
      : state.elapsedMs,
    durationMs,
    radius,
    heroClassId: state.heroClassId,
    usesPresentationClock,
  })
  if (state.combatEffects.length > MAX_COMBAT_EFFECTS) {
    state.combatEffects.splice(0, state.combatEffects.length - MAX_COMBAT_EFFECTS)
  }
}

const FINAL_BOSS_FAMILY_CYCLE: readonly EnemyPrimePowerFamilyId[] = [
  'twin-primes',
  'sophie-germain',
  'mersenne',
  'eratosthenes-sieve',
  'goldbach',
  'wilson',
]

function enemyPrimePowerFor(enemy: EnemyState): EnemyPrimePowerCast {
  const definition = PRIMEBOUND_ENEMIES[enemy.id]
  const phase = getEnemyBossPhase(
    Math.max(0, enemy.hp),
    enemy.maxHp,
    definition.encounterRank,
  )
  const familyId = definition.encounterRank === 'final-boss'
    ? FINAL_BOSS_FAMILY_CYCLE[
        (enemy.powerCastSerial + (phase - 1) * 2) % FINAL_BOSS_FAMILY_CYCLE.length
      ]
    : definition.primeFamily
  return resolveEnemyPrimePower(
    familyId,
    definition.encounterRank,
    Math.max(0, enemy.hp),
    enemy.maxHp,
  )
}

function addEnemyPowerEffectAt(
  state: EngineState,
  familyId: EnemyPrimePowerFamilyId,
  phase: EnemyBossPhase,
  origin: Vec2,
  kind: EnemyPowerEffectState['kind'],
  dramatic: boolean,
  rotation = 0,
): void {
  state.nextEffectId += 1
  state.enemyPowerEffects.push({
    id: state.nextEffectId,
    familyId,
    kind,
    x: origin.x,
    y: origin.y,
    phase,
    rotation,
    dramatic,
    startedAtMs: state.elapsedMs,
    durationMs: kind === 'impact'
      ? 240 + phase * 30
      : kind === 'phase-break' ? 900 : phase === 3 ? 640 : 500,
  })
  while (state.enemyPowerEffects.length > MAX_ENEMY_POWER_EFFECTS) {
    const disposableIndex = state.enemyPowerEffects.findIndex((effect) => !effect.dramatic)
    state.enemyPowerEffects.splice(disposableIndex >= 0 ? disposableIndex : 0, 1)
  }
}

function addEnemyPowerEffect(
  state: EngineState,
  enemy: EnemyState,
  power: EnemyPrimePowerCast,
  kind: EnemyPowerEffectState['kind'] = 'cast',
): void {
  const rank = PRIMEBOUND_ENEMIES[enemy.id].encounterRank
  const isShowcaseCast = kind === 'cast' && isEnemyBossShowcaseCast(
    rank,
    power.phase,
    enemy.powerCastSerial,
  )
  addEnemyPowerEffectAt(
    state,
    power.id,
    power.phase,
    enemy,
    kind,
    kind === 'phase-break' || isShowcaseCast,
    Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x),
  )
}

function addEnemyProjectileImpact(
  state: EngineState,
  projectile: ProjectileState,
  dramatic = false,
): void {
  addEnemyPowerEffectAt(
    state,
    projectile.familyId,
    projectile.phase,
    projectile,
    'impact',
    dramatic,
    Math.atan2(projectile.vy, projectile.vx),
  )
}

function spawnEnemyPrimeProjectile(
  state: EngineState,
  enemy: EnemyState,
  power: EnemyPrimePowerCast,
  angle: number,
  originOffset: Vec2,
  variant: number,
): boolean {
  if (state.projectiles.length >= MAX_ENEMY_PROJECTILES) return false
  const speedMultiplier = power.pattern === 'sophie-chain'
    ? 1 + variant * .08
    : power.pattern === 'goldbach-pair' && variant % 2 === 1 ? 1.1 : 1
  const speed = power.projectileSpeed * speedMultiplier
  state.projectiles.push({
    x: enemy.x + originOffset.x,
    y: enemy.y + originOffset.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: power.pattern === 'sieve-lanes' ? 4 : power.phase === 3 ? 4 : 3,
    lifeMs: power.pattern === 'wilson-orbit' ? 3_050 : 3_000,
    color: power.color,
    damage: power.projectileDamage,
    sourceEnemyId: enemy.id,
    familyId: power.id,
    pattern: power.pattern,
    phase: power.phase,
    ageMs: 0,
    homingStrength: power.homingStrength,
    angularVelocity: power.angularVelocity * (variant % 2 === 0 ? 1 : -1),
    variant,
  })
  return true
}

function executeEnemyPrimePower(
  state: EngineState,
  enemy: EnemyState,
  target: Vec2,
): EnemyPrimePowerCast {
  const power = enemyPrimePowerFor(enemy)
  const direction = normalizeMovement({ x: target.x - enemy.x, y: target.y - enemy.y })
  const baseAngle = Math.atan2(direction.y, direction.x)
  const side = { x: -direction.y, y: direction.x }

  for (let index = 0; index < power.projectileCount; index += 1) {
    let angle = baseAngle
    let originOffset: Vec2 = { x: 0, y: 0 }
    if (power.pattern === 'mersenne-ring' || power.pattern === 'wilson-orbit') {
      angle = index / power.projectileCount * Math.PI * 2
        + state.elapsedMs * .001
    } else if (power.pattern === 'twin-lances') {
      const pairSide = index % 2 === 0 ? -1 : 1
      const pairIndex = Math.floor(index / 2)
      originOffset = {
        x: side.x * pairSide * (7 + pairIndex * 3),
        y: side.y * pairSide * (7 + pairIndex * 3),
      }
      angle = baseAngle + (pairIndex - (power.projectileCount / 2 - 1) / 2) * .12
    } else if (power.pattern === 'sieve-lanes') {
      const lane = index - (power.projectileCount - 1) / 2
      originOffset = { x: side.x * lane * 9, y: side.y * lane * 9 }
      angle = baseAngle + lane * power.spreadRadians * .08
    } else {
      const spreadIndex = index - (power.projectileCount - 1) / 2
      angle = baseAngle + spreadIndex * power.spreadRadians
      if (power.pattern === 'goldbach-pair') {
        const pairSide = index % 2 === 0 ? -1 : 1
        originOffset = { x: side.x * pairSide * 9, y: side.y * pairSide * 9 }
      }
    }
    if (!spawnEnemyPrimeProjectile(
      state,
      enemy,
      power,
      angle,
      originOffset,
      index,
    )) break
  }

  enemy.powerCastSerial += 1
  addEnemyPowerEffect(state, enemy, power)
  createParticles(
    state,
    enemy.x,
    enemy.y,
    power.color,
    Math.min(18, 6 + power.projectileCount),
    38 + power.phase * 6,
  )
  if (PRIMEBOUND_ENEMIES[enemy.id].encounterRank !== 'minion') {
    state.callout = {
      title: power.anime.techniqueName,
      detail: `${power.anime.battleCry} · ${power.anime.glyph}`,
      untilMs: state.elapsedMs + (power.phase === 3 ? 1_100 : 880),
      source: 'enemy',
      familyId: power.id,
      phase: power.phase,
      worldPosition: { x: enemy.x, y: enemy.y },
    }
    if (power.phase >= 2) {
      state.enemyHitStopMs = Math.max(
        state.enemyHitStopMs,
        Math.min(42, Math.round(power.anime.hitStopMs * .3)),
      )
    }
  }
  const rank = PRIMEBOUND_ENEMIES[enemy.id].encounterRank
  const shakeScale = rank === 'minion' ? .42 : power.phase === 3 ? .52 : .38
  state.shake = Math.max(state.shake, power.anime.shakePx * shakeScale)
  return power
}

function heroActionForState(
  state: EngineState,
  actionId: PlayerCombatAction,
) {
  return getHeroClassAction(state.heroClassId, ACTION_ID_TO_HERO_SLOT[actionId])
}

function heroCinematicForState(
  state: EngineState,
  actionId: CinematicActionId,
): HeroCinematicDefinition {
  return getHeroClassCinematic(
    state.heroClassId,
    actionId === 'mersenne-burst' ? '3' : 'R',
  )
}

function cinematicPhrase(
  definition: HeroCinematicDefinition,
  progress: CinematicProgress,
): string | null {
  if (progress.phase === 'charge') return definition.lines.charge
  if (progress.phase === 'release') return definition.lines.release
  if (progress.phase === 'impact') return definition.lines.impact
  if (progress.phase === 'aftermath') return definition.lines.aftermath
  return null
}

interface ClassCinematicChannels {
  readonly zoom: number
  readonly darkness: number
  readonly shake: number
}

function classCinematicChannels(
  state: EngineState,
  progress: CinematicProgress,
  reducedMotion: boolean,
): ClassCinematicChannels {
  const timeline = getCinematicTimeline(progress.actionId, reducedMotion)
  const visual = heroCinematicForState(state, progress.actionId).visual
  const zoomEnvelope = timeline.visual.peakZoom > 1
    ? (progress.zoom - 1) / (timeline.visual.peakZoom - 1)
    : 0
  const darknessEnvelope = timeline.visual.maxDarkness > 0
    ? progress.darkness / timeline.visual.maxDarkness
    : 0
  const shakeEnvelope = timeline.visual.shakeAmplitude > 0
    ? progress.shake / timeline.visual.shakeAmplitude
    : 0
  return {
    zoom: reducedMotion ? 1 : 1 + (visual.peakZoom - 1) * zoomEnvelope,
    darkness: visual.maxDarkness * (reducedMotion ? .4 : 1) * darknessEnvelope,
    shake: reducedMotion ? 0 : visual.shakeAmplitude * shakeEnvelope,
  }
}

function announceAction(state: EngineState, actionId: OffensiveActionId): HeroCalloutState {
  const action = OFFENSIVE_ACTIONS[actionId]
  const presentation = heroActionForState(state, actionId)
  const family = action.family ? PRIME_FAMILIES[action.family] : null
  const callout = {
    title: presentation.spokenName,
    detail: family
      ? `${family.name} · ${family.formula}`
      : getHeroClass(state.heroClassId).affinity.formula,
    untilMs: state.elapsedMs + (
      action.kind === 'ultimate' ? 1_650 : action.kind === 'basic' ? 440 : 1_050
    ),
  }
  state.callout = callout
  return callout
}

function isActionUnlocked(state: EngineState, actionId: OffensiveActionId): boolean {
  return state.progress.collectedRunes.length >= OFFENSIVE_ACTIONS[actionId].requiredRuneCount
}

function classActionSetupIssue(
  state: EngineState,
  actionId: OffensiveActionId,
): { readonly title: string; readonly detail: string } | null {
  if (actionId !== 'sophie-chain') return null
  const archetype = getHeroClass(state.heroClassId).archetype
  if (
    archetype === 'cryptographer' &&
    !state.enemies.some((enemy) =>
      enemy.hp > 0 && enemy.rsaMark !== 0 && enemy.rsaMarkUntilMs > state.elapsedMs,
    )
  ) {
    return {
      title: 'Nenhuma chave para fatorar',
      detail: 'Use J ou 1 para gravar p e q antes da detonação.',
    }
  }
  if (
    archetype === 'assassin' &&
    !state.enemies.some((enemy) =>
      enemy.hp > 0 && enemy.rsaMark !== 0 && enemy.rsaMarkUntilMs > state.elapsedMs,
    )
  ) {
    return {
      title: 'Nenhum sinal para inverter',
      detail: 'Use J ou 1 para gravar μ = −1 e μ = +1 antes da nulidade.',
    }
  }
  if (
    archetype === 'arcanist' &&
    !state.spellZones.some((zone) => zone.kind === 'glyph' && !zone.consumed)
  ) {
    return {
      title: 'Nenhum glifo inscrito',
      detail: 'Use J ou 1 para preparar o terreno antes da transmutação.',
    }
  }
  return null
}

function activeHeroTransformation(
  state: EngineState,
): HeroTransformationDefinition | null {
  const transformation = state.player.transformation
  if (!transformation || !isHeroTransformationActive(transformation, state.elapsedMs)) return null
  return resolveHeroTransformationDefinition(transformation.classId)
}

function grantTransformationCharge(state: EngineState, amount: number): void {
  if (amount <= 0 || activeHeroTransformation(state) || state.transformationIntro) return
  const previous = state.player.transformationCharge
  state.player.transformationCharge = clamp(
    previous + amount,
    0,
    TRANSFORMATION_MAX_CHARGE,
  )
  if (previous < TRANSFORMATION_MAX_CHARGE && state.player.transformationCharge >= TRANSFORMATION_MAX_CHARGE) {
    const transformation = resolveHeroTransformationDefinition(state.heroClassId)
    state.toast = {
      title: `${transformation.name} pronta`,
      detail: `Pressione F para despertar por ${HERO_TRANSFORMATION_DURATION_MS / 1_000} segundos.`,
      tone: 'gold',
      untilMs: state.elapsedMs + 3_200,
    }
  }
}

function startHeroCooldown(
  state: EngineState,
  actionId: OffensiveActionId,
): CooldownState {
  const baseCooldowns = startCooldown(state.player.cooldowns, actionId, state.elapsedMs)
  const baseReadyAtMs = baseCooldowns[actionId] ?? state.elapsedMs
  const transformation = activeHeroTransformation(state)
  const transformationMultiplier = actionId === 'prime-infinity'
    ? 1
    : transformation?.modifiers.cooldownMultiplier ?? 1
  const multiplier = getHeroClass(state.heroClassId).modifiers.cooldownMultiplier
    * transformationMultiplier
  return Object.freeze({
    ...baseCooldowns,
    [actionId]: state.elapsedMs + (baseReadyAtMs - state.elapsedMs) * multiplier,
  })
}

function beginHeroDefense(state: EngineState): ReturnType<typeof beginDefense> {
  const result = beginDefense(state.player.defense, state.elapsedMs)
  if (!result.activated) return result
  const modifiers = getHeroClass(state.heroClassId).modifiers
  const transformation = activeHeroTransformation(state)
  const parryMultiplier = transformation?.uniqueEffect.id === 'irreducible-counter'
    ? transformation.uniqueEffect.parryWindowMultiplier
    : 1
  return Object.freeze({
    ...result,
    state: Object.freeze({
      ...result.state,
      parryUntilMs: state.elapsedMs
        + (result.state.parryUntilMs - state.elapsedMs)
          * modifiers.parryWindowMultiplier
          * parryMultiplier,
      cooldownUntilMs: state.elapsedMs
        + (result.state.cooldownUntilMs - state.elapsedMs)
          * modifiers.cooldownMultiplier
          * (transformation?.modifiers.cooldownMultiplier ?? 1),
    }),
  })
}

function classUltimateGain(state: EngineState, amount: number): number {
  return amount
    * getHeroClass(state.heroClassId).modifiers.ultimateChargeMultiplier
    * (activeHeroTransformation(state)?.modifiers.ultimateChargeMultiplier ?? 1)
}

function heroAttackArcRadians(
  state: EngineState,
  actionId: 'basic-strike' | PrimeTechniqueId,
): number {
  const archetype = getHeroClass(state.heroClassId).archetype
  if (archetype === 'ranger') return actionId === 'sophie-chain' ? Math.PI * .16 : Math.PI * .11
  if (archetype === 'cryptographer') return actionId === 'sophie-chain' ? Math.PI * .3 : Math.PI * .22
  if (archetype === 'arcanist') return actionId === 'sophie-chain' ? Math.PI * .42 : Math.PI * .36
  if (archetype === 'assassin') return actionId === 'sophie-chain' ? Math.PI * .55 : Math.PI * .22
  if (archetype === 'berserker') return actionId === 'sophie-chain' ? Math.PI * .72 : Math.PI * .95
  if (archetype === 'engineer') return actionId === 'sophie-chain' ? Math.PI * .16 : Math.PI * .1
  if (archetype === 'oracle') return actionId === 'sophie-chain' ? Math.PI * .5 : Math.PI * .3
  if (actionId === 'basic-strike') return Math.PI * .8
  return actionId === 'sophie-chain' ? Math.PI * .48 : Math.PI * 1.08
}

function livingEnemies(state: EngineState): EnemyState[] {
  return state.enemies.filter((enemy) => enemy.awake && enemy.hp > 0)
}

function findFrontEnemies(
  state: EngineState,
  range: number,
  halfAngleRadians: number,
  origin: Vec2 = state.player,
  facing: Direction = state.player.facing,
): EnemyState[] {
  const direction = directionVector(facing)
  const minimumDot = Math.cos(halfAngleRadians)
  return livingEnemies(state)
    .filter((enemy) => {
      const offset = { x: enemy.x - origin.x, y: enemy.y - origin.y }
      const enemyDistance = Math.hypot(offset.x, offset.y)
      if (enemyDistance > range + enemy.radius || enemyDistance === 0) return false
      const dot = (offset.x / enemyDistance) * direction.x + (offset.y / enemyDistance) * direction.y
      return dot >= minimumDot
    })
    .sort((first, second) => distance(origin, first) - distance(origin, second))
}

function nearestEnemy(
  state: EngineState,
  origin: Vec2,
  excludedIds: readonly PrimeboundEnemyId[] = [],
  maximumDistance = Number.POSITIVE_INFINITY,
): EnemyState | null {
  return livingEnemies(state)
    .filter((enemy) => !excludedIds.includes(enemy.id) && distance(origin, enemy) <= maximumDistance)
    .sort((first, second) => distance(origin, first) - distance(origin, second))[0] ?? null
}

function projectileDirection(
  state: EngineState,
  target: EnemyState | null,
  sideBias = 0,
): Vec2 {
  const forward = directionVector(state.player.facing)
  const side = { x: -forward.y, y: forward.x }
  if (!target) return normalizeMovement({ x: forward.x + side.x * sideBias, y: forward.y + side.y * sideBias })
  return normalizeMovement({
    x: target.x - state.player.x + side.x * sideBias,
    y: target.y - state.player.y + side.y * sideBias,
  })
}

interface SpawnHeroProjectileOptions {
  readonly kind: HeroProjectileKind
  readonly actionId: OffensiveActionId
  readonly damage: number
  readonly speed: number
  readonly direction: Vec2
  readonly target?: EnemyState | null
  readonly radius?: number
  readonly lifeMs?: number
  readonly homingStrength?: number
  readonly remainingBounces?: number
  readonly rsaMark?: RsaMark
  readonly offset?: number
}

function spawnHeroProjectile(state: EngineState, options: SpawnHeroProjectileOptions): void {
  const transformation = activeHeroTransformation(state)
  const rangeMultiplier = transformation?.modifiers.rangeMultiplier ?? 1
  const rsaOverflow = transformation?.uniqueEffect.id === 'rsa-key-overflow'
  const residueStep = transformation?.uniqueEffect.id === 'modular-residue-step'
    ? transformation.uniqueEffect
    : null

  const pushProjectile = (
    direction: Vec2,
    damage: number,
    offset: number,
    grantsUltimateCharge: boolean,
  ) => {
    const forward = normalizeMovement(direction)
    const side = { x: -forward.y, y: forward.x }
    state.nextCombatEntityId += 1
    state.heroProjectiles.push({
      id: state.nextCombatEntityId,
      kind: options.kind,
      actionId: options.actionId,
      x: state.player.x + forward.x * 12 + side.x * offset,
      y: state.player.y + forward.y * 12 + side.y * offset,
      vx: forward.x * options.speed,
      vy: forward.y * options.speed,
      speed: options.speed,
      radius: options.radius ?? 3,
      lifeMs: (options.lifeMs ?? 1_050) * rangeMultiplier,
      damage,
      targetEnemyId: options.target?.id ?? null,
      homingStrength: options.homingStrength ?? 0,
      remainingBounces: options.remainingBounces ?? 0,
      hitEnemyIds: [],
      rsaMark: rsaOverflow && (options.rsaMark ?? 0) !== 0 ? 3 : options.rsaMark ?? 0,
      isTransformationEcho: !grantsUltimateCharge,
      grantsUltimateCharge,
    })
  }

  pushProjectile(options.direction, options.damage, options.offset ?? 0, true)

  if (residueStep) {
    const baseAngle = Math.atan2(options.direction.y, options.direction.x)
    for (let echo = 0; echo < residueStep.echoShots; echo += 1) {
      const spread = (echo - (residueStep.echoShots - 1) / 2) * .105
      pushProjectile(
        { x: Math.cos(baseAngle + spread), y: Math.sin(baseAngle + spread) },
        options.damage * residueStep.echoDamageMultiplier,
        (options.offset ?? 0) + (echo - 1) * 3,
        false,
      )
    }
  }
  if (state.heroProjectiles.length > MAX_HERO_PROJECTILES) {
    state.heroProjectiles.splice(0, state.heroProjectiles.length - MAX_HERO_PROJECTILES)
  }
}

interface SpawnSpellZoneOptions {
  readonly kind: SpellZoneKind
  readonly actionId: OffensiveActionId
  readonly origin: Vec2
  readonly radius: number
  readonly durationMs: number
  readonly armDelayMs?: number
  readonly pulseDelayMs?: number
  readonly pulseIntervalMs?: number
  readonly pulseDamages: readonly number[]
}

function spawnSpellZone(state: EngineState, options: SpawnSpellZoneOptions): void {
  if (options.kind === 'glyph') {
    const glyphs = state.spellZones.filter((zone) => zone.kind === 'glyph')
    if (glyphs.length >= 3) {
      const oldestGlyphId = glyphs.sort((first, second) => first.startedAtMs - second.startedAtMs)[0].id
      state.spellZones = state.spellZones.filter((zone) => zone.id !== oldestGlyphId)
    }
  }
  state.nextCombatEntityId += 1
  const transformation = activeHeroTransformation(state)
  const mersenneForm = transformation?.uniqueEffect.id === 'mersenne-supernova'
  const rangeMultiplier = transformation?.modifiers.rangeMultiplier ?? 1
  const armAtMs = state.elapsedMs + (options.armDelayMs ?? 0) * (mersenneForm ? .55 : 1)
  state.spellZones.push({
    id: state.nextCombatEntityId,
    kind: options.kind,
    actionId: options.actionId,
    x: options.origin.x,
    y: options.origin.y,
    radius: options.radius * rangeMultiplier,
    startedAtMs: state.elapsedMs,
    durationMs: options.durationMs * (mersenneForm ? 1.3 : 1),
    armAtMs,
    nextPulseAtMs: armAtMs + (options.pulseDelayMs ?? 0),
    pulseIntervalMs: options.pulseIntervalMs ?? 0,
    pulseDamages: options.pulseDamages,
    pulseIndex: 0,
    consumed: false,
  })
  if (state.spellZones.length > MAX_SPELL_ZONES) {
    state.spellZones.splice(0, state.spellZones.length - MAX_SPELL_ZONES)
  }
}

function bestEnemyClusterPoint(state: EngineState, radius: number): Vec2 {
  const enemies = livingEnemies(state)
  if (enemies.length === 0) {
    const direction = directionVector(state.player.facing)
    return { x: state.player.x + direction.x * 64, y: state.player.y + direction.y * 64 }
  }
  const ranked = enemies.map((candidate) => ({
    candidate,
    count: enemies.filter((enemy) => distance(candidate, enemy) <= radius).length,
  })).sort((first, second) => second.count - first.count || distance(state.player, first.candidate) - distance(state.player, second.candidate))
  return { x: ranked[0].candidate.x, y: ranked[0].candidate.y }
}

function registerPrimeChainHit(state: EngineState, impact: Vec2): void {
  if (state.primeChainUntilMs <= state.elapsedMs) state.primeChainCount = 0
  state.primeChainCount = advancePrimeChainCount(state.primeChainCount)
  state.primeChainUntilMs = state.elapsedMs
    + PRIME_CHAIN_WINDOW_MS * blessingEffects(state.blessings).chainDurationMultiplier
  const milestone = state.primeChainCount
  if (!isPrimeChainCount(milestone)) return

  const heroClass = getHeroClass(state.heroClassId)
  state.player.ultimateCharge = addUltimateCharge(
    state.player.ultimateCharge,
    classUltimateGain(state, Math.min(7, milestone)),
  )
  state.player.stamina = Math.min(
    state.player.maxStamina,
    state.player.stamina + milestone * 1.5,
  )
  addCombatEffect(state, 'prime-resonance', 20 + milestone * 2.2, 520, impact)
  createParticles(
    state,
    impact.x,
    impact.y,
    milestone >= 7 ? heroClass.palette.accent : heroClass.palette.energy,
    7 + milestone,
    40 + milestone * 2,
  )

  if (milestone === 5) {
    for (const enemy of state.enemies) {
      if (!enemy.awake || enemy.hp <= 0 || distance(impact, enemy) > 48 + enemy.radius) continue
      const echoDamage = Math.min(enemy.hp, 7 * heroClass.modifiers.damageMultiplier)
      enemy.hp -= echoDamage
      enemy.flashUntilMs = state.elapsedMs + 180
    }
    state.callout = {
      title: 'RESSONÂNCIA CINCO!',
      detail: 'O quinto impacto ecoa em todos os compostos próximos.',
      untilMs: state.elapsedMs + 1_050,
    }
  } else if (milestone === 7) {
    state.player.health = Math.min(state.player.maxHealth, state.player.health + 1)
    state.callout = {
      title: 'SÉTIMO PULSO — REGENERAÇÃO!',
      detail: 'Uma unidade de vitalidade foi recomposta.',
      untilMs: state.elapsedMs + 1_100,
    }
  } else if (milestone === 11) {
    state.primeAscensionUntilMs = state.elapsedMs + 5_200
    state.callout = {
      title: 'ASCENSÃO PRIMA: ONZE!',
      detail: 'Aura desperta · dano ampliado por 5 segundos.',
      untilMs: state.elapsedMs + 1_450,
    }
    state.shake = Math.max(state.shake, 7)
  } else if (milestone === 13) {
    state.primeAscensionUntilMs = Math.max(
      state.primeAscensionUntilMs,
      state.elapsedMs + 6_500,
    )
    state.player.stamina = state.player.maxStamina
    state.callout = {
      title: 'DÉCIMO TERCEIRO — LIMITE ROMPIDO!',
      detail: 'Ascensão prolongada e energia restaurada.',
      untilMs: state.elapsedMs + 1_450,
    }
    state.shake = Math.max(state.shake, 9)
  }
}

/** The player touched the shrine and chose: apply, consume, celebrate. */
function chooseBlessing(state: EngineState, id: PrimeBlessingId): void {
  if (!state.blessingChoice || !state.blessingChoice.includes(id)) return
  state.blessings.push(id)
  state.blessedShrineAreaIds.push(state.areaId)
  state.blessingChoice = null
  const blessing = PRIME_BLESSINGS[id]
  if (id === 'vigor-do-dois') {
    state.player.maxHealth += 2
    state.player.health = state.player.maxHealth
  }
  if (id === 'folego-do-sete') {
    state.player.maxStamina += 20
    state.player.stamina = state.player.maxStamina
  }
  state.toast = {
    title: `${blessing.name} aceita`,
    detail: blessing.description,
    tone: 'gold',
    untilMs: state.elapsedMs + 4_200,
  }
  createParticles(state, state.player.x, state.player.y, '#f2c15c', 26, 52)
  state.shake = Math.max(state.shake, 4)
}

function damageEnemyWithAction(
  state: EngineState,
  enemy: EnemyState,
  actionId: OffensiveActionId,
  requestedDamage?: number,
  grantsUltimateCharge = true,
  registersPrimeChain = true,
): number {
  const definition = OFFENSIVE_ACTIONS[actionId]
  const activeChainCount = state.primeChainUntilMs <= state.elapsedMs
    ? 0
    : state.primeChainCount
  const chainCountForHit = advancePrimeChainCount(activeChainCount)
  const stageEffect = resolvePrimeStageHitEffect(state.areaId, chainCountForHit)
  const transformation = activeHeroTransformation(state)
  const ascensionMultiplier = transformation && actionId !== 'prime-infinity'
    ? transformation.modifiers.damageMultiplier
    : state.primeAscensionUntilMs > state.elapsedMs ? 1.35 : 1
  const damageMultiplier = getHeroClass(state.heroClassId).modifiers.damageMultiplier
    * ascensionMultiplier
    * stageEffect.damageMultiplier
    * blessingEffects(state.blessings).damageMultiplier
  const armorPerHit = enemy.kind === 'guardian'
    ? actionId === 'prime-infinity' ? 3 : 5
    : 0
  const damage = requestedDamage === undefined
    ? calculateActionDamage(actionId, { armorPerHit, multiplier: damageMultiplier }).totalDamage
    : Math.max(0, requestedDamage * damageMultiplier - armorPerHit)
  const applied = Math.min(enemy.hp, Math.max(0, damage))
  if (applied <= 0) return 0
  enemy.hp -= applied
  enemy.flashUntilMs = state.elapsedMs + (actionId === 'prime-infinity' ? 260 : 150)
  const stunDurationMs = actionId === 'basic-strike'
    ? 70
    : actionId === 'twin-blades'
      ? 180
      : actionId === 'sophie-chain'
        ? 340
        : actionId === 'mersenne-burst' ? 480 : 650
  enemy.stunnedUntilMs = Math.max(
    enemy.stunnedUntilMs,
    state.elapsedMs + Math.max(stunDurationMs, stageEffect.stunDurationMs),
  )
  const palette = getHeroClass(state.heroClassId).palette
  const color = actionId === 'twin-blades'
    ? palette.energy
    : actionId === 'sophie-chain'
      ? palette.primary
      : palette.accent
  createParticles(state, enemy.x, enemy.y, color, actionId === 'prime-infinity' ? 18 : 11, 52)
  if (definition.kind !== 'ultimate' && grantsUltimateCharge) {
    state.player.ultimateCharge = addUltimateCharge(
      state.player.ultimateCharge,
      classUltimateGain(state, definition.ultimateChargeOnHit),
    )
    grantTransformationCharge(state, 3 + applied * .18)
  }
  if (registersPrimeChain) registerPrimeChainHit(state, enemy)

  if (stageEffect.partnerEchoRatio > 0) {
    const partner = state.enemies
      .filter((candidate) => candidate !== enemy && candidate.hp > 0 && candidate.awake)
      .sort((first, second) => distance(enemy, first) - distance(enemy, second))[0]
    if (partner) {
      const echoedDamage = Math.min(partner.hp, applied * stageEffect.partnerEchoRatio)
      partner.hp -= echoedDamage
      partner.flashUntilMs = state.elapsedMs + 210
      partner.stunnedUntilMs = Math.max(partner.stunnedUntilMs, state.elapsedMs + 160)
      createParticles(state, partner.x, partner.y, '#ffd37d', 9, 42)
      addCombatEffect(state, 'prime-resonance', 25, 460, partner)
    }
  }

  if (stageEffect.triggered && stageEffect.callout) {
    const mechanic = getPrimeStageMechanic(state.areaId)
    state.callout = {
      title: stageEffect.callout,
      detail: mechanic?.formula ?? `CADEIA ${chainCountForHit}`,
      untilMs: state.elapsedMs + (stageEffect.stunDurationMs > 0 ? 1_450 : 920),
    }
    state.shake = Math.max(state.shake, stageEffect.stunDurationMs > 0 ? 8 : 3)
    addCombatEffect(state, 'prime-resonance', 24 + chainCountForHit, 560, enemy)
  }
  return applied
}

function queueActionHits(
  state: EngineState,
  enemy: EnemyState,
  actionId: PrimeTechniqueId | 'prime-infinity',
  damages: readonly number[],
  intervalMs: number,
): void {
  damages.forEach((damage, hitIndex) => {
    state.pendingCombatHits.push({
      actionId,
      enemyId: enemy.id,
      damage,
      executeAtMs: state.elapsedMs + hitIndex * intervalMs,
      grantsUltimateCharge: hitIndex === 0,
    })
  })
}

function perfectUltimateOrigin(
  state: EngineState,
  definition: PerfectUltimateDefinition,
): Vec2 {
  const enemies = livingEnemies(state)
  if (definition.origin === 'hero') {
    return { x: state.player.x, y: state.player.y }
  }
  if (definition.origin === 'enemy-network') {
    if (enemies.length === 0) return { x: state.player.x, y: state.player.y }
    return enemies.reduce(
      (center, enemy) => ({
        x: center.x + enemy.x / enemies.length,
        y: center.y + enemy.y / enemies.length,
      }),
      { x: 0, y: 0 },
    )
  }
  if (definition.origin === 'aim-point') {
    const target = currentRangerTarget(state)
      ?? findFrontEnemies(state, 320, Math.PI * .42)[0]
      ?? nearestEnemy(state, state.player)
    if (target) return { x: target.x, y: target.y }
    const direction = directionVector(state.player.facing)
    return {
      x: state.player.x + direction.x * 82,
      y: state.player.y + direction.y * 82,
    }
  }
  return bestEnemyClusterPoint(state, definition.radius * .55)
}

function triggerPerfectUltimateAreaAttack(
  state: EngineState,
  qteDamageMultiplier: number,
  reducedMotion: boolean,
): PerfectUltimateDefinition {
  const definition = getPerfectUltimate(state.heroClassId)
  const origin = perfectUltimateOrigin(state, definition)
  const rangeMultiplier = getHeroClass(state.heroClassId).modifiers.rangeMultiplier
    * (activeHeroTransformation(state)?.modifiers.rangeMultiplier ?? 1)
  const radius = definition.radius * rangeMultiplier
  const stunnedEnemyIds = new Set<PrimeboundEnemyId>()

  if (state.cinematic?.actionId === 'prime-infinity') {
    state.cinematic.perfectUltimateOrigin = origin
  }

  for (const [waveIndex, wave] of definition.waves.entries()) {
    state.pendingPerfectUltimateWaves.push({
      x: origin.x,
      y: origin.y,
      radius: radius * wave.radiusMultiplier,
      damage: wave.damage * qteDamageMultiplier,
      executeAtPresentationMs: state.presentationElapsedMs + wave.atMs,
      stunMs: definition.stunMs,
      isFinal: waveIndex === definition.waves.length - 1,
      stunnedEnemyIds,
    })
  }

  const firstWaveAtMs = definition.waves[0]?.atMs ?? 0
  for (const enemy of livingEnemies(state)) {
    if (distance(origin, enemy) > radius + enemy.radius) continue
    enemy.intent = null
    enemy.intentTarget = null
    enemy.stunnedUntilMs = Math.max(
      enemy.stunnedUntilMs,
      state.elapsedMs + firstWaveAtMs,
    )
  }
  state.projectiles = state.projectiles.filter(
    (projectile) => distance(origin, projectile) > radius + projectile.radius,
  )
  addCombatEffect(
    state,
    'perfect-ultimate',
    radius,
    definition.durationMs,
    origin,
    state.player.facing,
    true,
  )
  const palette = getHeroClass(state.heroClassId).palette
  createParticles(
    state,
    origin.x,
    origin.y,
    palette.energy,
    reducedMotion ? 8 : 30,
    reducedMotion ? 0 : 92,
  )
  createParticles(
    state,
    origin.x,
    origin.y,
    palette.accent,
    reducedMotion ? 4 : 18,
    reducedMotion ? 0 : 58,
  )
  state.shake = Math.max(state.shake, 16)
  return definition
}

function damageEnemyWithPerfectUltimate(
  state: EngineState,
  enemy: EnemyState,
  requestedDamage: number,
  stunMs: number,
  reducedMotion: boolean,
): number {
  const heroClass = getHeroClass(state.heroClassId)
  const transformation = activeHeroTransformation(state)
  const powerMultiplier = transformation
    ? transformation.modifiers.damageMultiplier
    : state.primeAscensionUntilMs > state.elapsedMs ? 1.35 : 1
  const armor = enemy.kind === 'guardian' ? 3 : 0
  const damage = Math.max(
    0,
    requestedDamage * heroClass.modifiers.damageMultiplier * powerMultiplier - armor,
  )
  const applied = Math.min(enemy.hp, damage)
  if (applied <= 0) return 0

  enemy.hp -= applied
  enemy.flashUntilMs = state.elapsedMs + 300
  enemy.intent = null
  enemy.intentTarget = null
  if (stunMs > 0) {
    enemy.stunnedUntilMs = Math.max(enemy.stunnedUntilMs, state.elapsedMs + stunMs)
  }
  createParticles(
    state,
    enemy.x,
    enemy.y,
    heroClass.palette.energy,
    reducedMotion ? 3 : 8,
    reducedMotion ? 0 : 62,
  )
  return applied
}

function applyRsaMark(
  state: EngineState,
  enemy: EnemyState,
  mark: RsaMark,
): boolean {
  if (mark === 0) return false
  const current = enemy.rsaMarkUntilMs > state.elapsedMs ? enemy.rsaMark : 0
  const combined = (current | mark) as RsaMark
  enemy.rsaMark = combined
  enemy.rsaMarkUntilMs = state.elapsedMs + 6_500
  const transformation = activeHeroTransformation(state)
  if (transformation?.uniqueEffect.id === 'rsa-key-overflow') {
    const overflow = transformation.uniqueEffect
    const nearby = livingEnemies(state)
      .filter((candidate) => candidate !== enemy && distance(candidate, enemy) <= overflow.chainRadius)
      .slice(0, Math.max(0, overflow.simultaneousMarks - 1))
    for (const candidate of nearby) {
      const candidateMark = candidate.rsaMarkUntilMs > state.elapsedMs ? candidate.rsaMark : 0
      candidate.rsaMark = (candidateMark | mark) as RsaMark
      candidate.rsaMarkUntilMs = state.elapsedMs + 6_500
      createParticles(state, candidate.x, candidate.y, transformation.palette.energy, 4, 20)
    }
  }
  return combined === 3
}

function detonateRsaEnemy(
  state: EngineState,
  enemy: EnemyState,
  actionId: PrimeTechniqueId | 'prime-infinity',
  baseDamage: number,
  grantsUltimateCharge: boolean,
): boolean {
  const activeMark = enemy.rsaMarkUntilMs > state.elapsedMs ? enemy.rsaMark : 0
  if (activeMark === 0) return false
  const markCount = (activeMark & 1 ? 1 : 0) + (activeMark & 2 ? 1 : 0)
  const transformation = activeHeroTransformation(state)
  const detonationMultiplier = transformation?.uniqueEffect.id === 'rsa-key-overflow'
    ? transformation.uniqueEffect.detonationDamageMultiplier
    : 1
  enemy.rsaMark = 0
  enemy.rsaMarkUntilMs = 0
  damageEnemyWithAction(
    state,
    enemy,
    actionId,
    baseDamage * (markCount === 2 ? 2.35 : 1) * detonationMultiplier,
    grantsUltimateCharge,
  )
  enemy.intent = null
  enemy.stunnedUntilMs = Math.max(
    enemy.stunnedUntilMs,
    state.elapsedMs + (markCount === 2 ? 720 : 320),
  )
  addCombatEffect(state, 'rsa-detonation', markCount === 2 ? 46 : 30, 540, enemy)
  createParticles(state, enemy.x, enemy.y, getHeroClass(state.heroClassId).palette.energy, 16, 58)
  return true
}

function markRangerTarget(state: EngineState, enemy: EnemyState): void {
  state.rangerMarkedEnemyId = enemy.id
  state.rangerMarkUntilMs = state.elapsedMs + 6_000
}

function currentRangerTarget(state: EngineState): EnemyState | null {
  if (state.rangerMarkUntilMs <= state.elapsedMs || !state.rangerMarkedEnemyId) return null
  return state.enemies.find((enemy) =>
    enemy.id === state.rangerMarkedEnemyId && enemy.awake && enemy.hp > 0,
  ) ?? null
}

function performWarriorTechnique(
  state: EngineState,
  actionId: PrimeTechniqueId | 'prime-infinity',
  timingScale = 1,
  ultimateDamageMultiplier = 1,
): number {
  const action = OFFENSIVE_ACTIONS[actionId]
  const rangeMultiplier = getHeroClass(state.heroClassId).modifiers.rangeMultiplier
    * (activeHeroTransformation(state)?.modifiers.rangeMultiplier ?? 1)
  if (actionId === 'prime-infinity') {
    const origin = { x: state.player.x, y: state.player.y }
    const facing = state.player.facing
    const direction = directionVector(facing)
    const candidates = findFrontEnemies(
      state,
      action.range * rangeMultiplier * 1.55,
      Math.PI * .18,
      origin,
      facing,
    )
    for (const enemy of candidates) {
      queueActionHits(
        state,
        enemy,
        actionId,
        action.hitDamages.map((damage) => damage * ultimateDamageMultiplier),
        105 * timingScale,
      )
      enemy.intent = null
      enemy.stunnedUntilMs = Math.max(enemy.stunnedUntilMs, state.elapsedMs + 1_200)
    }
    for (let step = 0; step < 7; step += 1) {
      moveWithCollision(
        state.areaId,
        state.player,
        PLAYER_RADIUS,
        direction.x * 12,
        direction.y * 12,
      )
    }
    addCombatEffect(
      state,
      'euclid-dash',
      action.range * rangeMultiplier * 1.55,
      1_050,
      origin,
      facing,
    )
    state.shake = 9
    return candidates.length
  }
  const isRadial = actionId === 'mersenne-burst'
  if (actionId === 'twin-blades') {
    const direction = directionVector(state.player.facing)
    moveWithCollision(state.areaId, state.player, PLAYER_RADIUS, direction.x * 22, direction.y * 22)
  }
  const baseHitIntervalMs = actionId === 'twin-blades'
    ? 120
    : actionId === 'sophie-chain'
      ? 170
      : actionId === 'mersenne-burst' ? 180 : 110
  const hitIntervalMs = baseHitIntervalMs * timingScale
  let hitCount = 0
  const candidates = state.enemies
    .filter((enemy) => enemy.awake && enemy.hp > 0)
    .sort((first, second) => distance(state.player, first) - distance(state.player, second))

  for (const enemy of candidates) {
    const hit = isRadial
      ? distance(state.player, enemy) <= action.areaRadius * rangeMultiplier + enemy.radius
      : isSwordAttackHit(
          {
            origin: state.player,
            facing: state.player.facing,
            range: action.range * rangeMultiplier,
            arcRadians: heroAttackArcRadians(state, actionId),
          },
          { center: enemy, radius: enemy.radius },
        )
    if (!hit) continue
    if (actionId === 'sophie-chain' && hitCount >= 3) break
    queueActionHits(state, enemy, actionId, action.hitDamages, hitIntervalMs)
    if (actionId === 'sophie-chain') {
      const pull = normalizeMovement({ x: state.player.x - enemy.x, y: state.player.y - enemy.y })
      moveWithCollision(state.areaId, enemy, enemy.radius, pull.x * 24, pull.y * 24)
      enemy.intent = null
    }
    hitCount += 1
  }

  addCombatEffect(
    state,
    actionId,
    (action.areaRadius || action.range) * rangeMultiplier,
    actionId === 'mersenne-burst' ? 720 : 480,
  )
  state.shake = actionId === 'mersenne-burst' ? 6 : 4
  return hitCount
}

function performCryptographerTechnique(
  state: EngineState,
  actionId: PrimeTechniqueId | 'prime-infinity',
  timingScale = 1,
  ultimateDamageMultiplier = 1,
): number {
  const action = OFFENSIVE_ACTIONS[actionId]
  const delivery = getClassActionDelivery(state.heroClassId, actionId)
  const targets = findFrontEnemies(state, 225, Math.PI * .44)
  if (actionId === 'twin-blades') {
    const first = targets[0] ?? null
    const second = first
    for (const [index, mark] of ([1, 2] as const).entries()) {
      const target = index === 0 ? first : second
      spawnHeroProjectile(state, {
        kind: mark === 1 ? 'rsa-key-p' : 'rsa-key-q',
        actionId,
        damage: action.hitDamages[index] ?? action.hitDamages[0],
        speed: 195 * delivery.projectileSpeedMultiplier,
        direction: projectileDirection(state, target, index === 0 ? -4 : 4),
        target,
        homingStrength: 5.4,
        rsaMark: mark,
        offset: index === 0 ? -5 : 5,
        lifeMs: delivery.projectileLifetimeMs,
      })
    }
    return first ? 1 : 0
  }
  if (actionId === 'sophie-chain') {
    const marked = livingEnemies(state).filter((enemy) =>
      enemy.rsaMark !== 0 &&
      enemy.rsaMarkUntilMs > state.elapsedMs &&
      distance(state.player, enemy) <= 260,
    )
    if (marked.length === 0) {
      state.toast = {
        title: 'Nenhuma chave para fatorar',
        detail: 'Use J ou 1 para gravar p e q antes da detonação.',
        tone: 'violet',
        untilMs: state.elapsedMs + 1_900,
      }
      return 0
    }
    let grantsCharge = true
    for (const enemy of marked) {
      detonateRsaEnemy(state, enemy, actionId, 24, grantsCharge)
      grantsCharge = false
    }
    state.shake = marked.some((enemy) => enemy.stunnedUntilMs > state.elapsedMs + 600) ? 6 : 3
    return marked.length
  }

  const living = livingEnemies(state)
  const marked = living.filter((enemy) =>
    enemy.rsaMark !== 0 && enemy.rsaMarkUntilMs > state.elapsedMs,
  )
  if (actionId === 'mersenne-burst') {
    const candidates = marked.length > 0 ? marked : living
    const packetCount = 7
    for (let index = 0; index < packetCount; index += 1) {
      const target = candidates[index % Math.max(1, candidates.length)] ?? null
      spawnHeroProjectile(state, {
        kind: 'rsa-chain',
        actionId,
        damage: action.hitDamages[index % action.hitDamages.length] * .52,
        speed: (205 + index * 6) * delivery.projectileSpeedMultiplier,
        direction: projectileDirection(state, target, (index - 3) * 2.2),
        target,
        homingStrength: 6.8,
        rsaMark: index % 2 === 0 ? 1 : 2,
        offset: (index - 3) * 2,
        lifeMs: delivery.projectileLifetimeMs,
      })
    }
    return Math.min(packetCount, candidates.length)
  }

  for (const enemy of living) {
    const markCount = enemy.rsaMarkUntilMs > state.elapsedMs
      ? (enemy.rsaMark & 1 ? 1 : 0) + (enemy.rsaMark & 2 ? 1 : 0)
      : 0
    queueActionHits(
      state,
      enemy,
      actionId,
      action.hitDamages.map(
        (damage) => (damage + markCount * 7) * ultimateDamageMultiplier,
      ),
      105 * timingScale,
    )
    enemy.rsaMark = 0
    enemy.rsaMarkUntilMs = 0
    enemy.intent = null
    enemy.stunnedUntilMs = Math.max(enemy.stunnedUntilMs, state.elapsedMs + 1_500)
    addCombatEffect(state, 'rsa-detonation', 58, 900, enemy)
  }
  state.projectiles = []
  state.shake = 9
  return living.length
}

function performRangerTechnique(
  state: EngineState,
  actionId: PrimeTechniqueId | 'prime-infinity',
  timingScale = 1,
  ultimateDamageMultiplier = 1,
): number {
  const action = OFFENSIVE_ACTIONS[actionId]
  const delivery = getClassActionDelivery(state.heroClassId, actionId)
  const targets = findFrontEnemies(state, 250, Math.PI * .32)
  if (actionId === 'twin-blades') {
    for (const index of [0, 1]) {
      const target = targets[index] ?? targets[0] ?? null
      spawnHeroProjectile(state, {
        kind: 'twin-arrow',
        actionId,
        damage: action.hitDamages[index] ?? action.hitDamages[0],
        speed: 210 * delivery.projectileSpeedMultiplier,
        direction: projectileDirection(state, target, target ? 0 : index === 0 ? -.13 : .13),
        target: null,
        offset: index === 0 ? -5 : 5,
        radius: 2,
        lifeMs: delivery.projectileLifetimeMs,
      })
    }
    return targets.length > 1 ? 2 : targets.length
  }
  if (actionId === 'sophie-chain') {
    const target = targets[0] ?? nearestEnemy(state, state.player, [], 250)
    spawnHeroProjectile(state, {
      kind: 'ricochet-arrow',
      actionId,
      damage: action.hitDamages[0],
      speed: 245 * delivery.projectileSpeedMultiplier,
      direction: projectileDirection(state, target),
      target: null,
      remainingBounces: 2,
      radius: 2,
      lifeMs: delivery.projectileLifetimeMs,
    })
    return target ? 1 : 0
  }

  if (actionId === 'mersenne-burst') {
    const marked = currentRangerTarget(state)
    const center = marked ?? bestEnemyClusterPoint(state, 72)
    const candidates = livingEnemies(state).filter((enemy) => distance(center, enemy) <= 78 + enemy.radius)
    for (const enemy of candidates) {
      queueActionHits(state, enemy, actionId, action.hitDamages, 165 * timingScale)
    }
    addCombatEffect(state, 'arrow-rain', 82, 900, center)
    state.shake = 5
    return candidates.length
  }

  const living = livingEnemies(state)
  const marked = currentRangerTarget(state)
  const target = marked ?? targets[0] ?? nearestEnemy(state, state.player)
  const direction = projectileDirection(state, target)
  for (const [index, damage] of action.hitDamages.entries()) {
    spawnHeroProjectile(state, {
      kind: 'euclid-arrow',
      actionId,
      damage: damage * ultimateDamageMultiplier,
      speed: 190 * delivery.projectileSpeedMultiplier,
      direction,
      target: null,
      offset: (index - 2) * 5,
      radius: 3,
      lifeMs: delivery.projectileLifetimeMs,
    })
  }
  state.shake = 8
  return living.length
}

function performArcanistTechnique(
  state: EngineState,
  actionId: PrimeTechniqueId | 'prime-infinity',
  timingScale = 1,
  ultimateDamageMultiplier = 1,
): number {
  const action = OFFENSIVE_ACTIONS[actionId]
  const delivery = getClassActionDelivery(state.heroClassId, actionId)
  const direction = directionVector(state.player.facing)
  if (actionId === 'twin-blades') {
    const side = { x: -direction.y, y: direction.x }
    for (const offset of [-18, 18]) {
      spawnSpellZone(state, {
        kind: 'glyph',
        actionId,
        origin: {
          x: state.player.x + direction.x * 48 + side.x * offset,
          y: state.player.y + direction.y * 48 + side.y * offset,
        },
        radius: 27,
        durationMs: delivery.persistsMs,
        armDelayMs: 240,
        pulseDamages: [action.hitDamages[offset < 0 ? 0 : 1] ?? action.hitDamages[0]],
      })
    }
    return 2
  }
  if (actionId === 'sophie-chain') {
    const glyphs = state.spellZones.filter((zone) => zone.kind === 'glyph' && !zone.consumed)
    if (glyphs.length === 0) {
      state.toast = {
        title: 'Nenhum glifo inscrito',
        detail: 'Use J ou 1 para preparar o terreno antes da transmutação.',
        tone: 'violet',
        untilMs: state.elapsedMs + 1_900,
      }
      return 0
    }
    const origins = glyphs
    const damagePerGlyph = action.hitDamages.reduce((sum, damage) => sum + damage, 0) / origins.length
    let grantsCharge = true
    for (const origin of origins) {
      const victims = livingEnemies(state).filter((enemy) => distance(origin, enemy) <= 54 + enemy.radius)
      for (const enemy of victims) {
        damageEnemyWithAction(state, enemy, actionId, damagePerGlyph, grantsCharge)
        grantsCharge = false
      }
      addCombatEffect(state, 'glyph-detonation', 56, 620, origin)
    }
    state.spellZones = state.spellZones.filter((zone) => zone.kind !== 'glyph')
    state.shake = 5
    return origins.length
  }
  if (actionId === 'mersenne-burst') {
    const center = bestEnemyClusterPoint(state, 78)
    spawnSpellZone(state, {
      kind: 'supernova',
      actionId,
      origin: center,
      radius: 84,
      durationMs: delivery.persistsMs,
      pulseDamages: action.hitDamages,
      pulseIntervalMs: 220 * timingScale,
    })
    addCombatEffect(state, 'glyph-detonation', 88, 1_000, center)
    return livingEnemies(state).filter((enemy) => distance(center, enemy) <= 92 + enemy.radius).length
  }
  spawnSpellZone(state, {
    kind: 'constellation',
    actionId,
    origin: state.player,
    radius: Math.hypot(worldSize(state.areaId).x, worldSize(state.areaId).y),
    durationMs: delivery.persistsMs,
    pulseDamages: action.hitDamages.map(
      (damage) => damage * ultimateDamageMultiplier,
    ),
    pulseIntervalMs: 420 * timingScale,
  })
  addCombatEffect(state, 'constellation-pulse', 120, 1_100, state.player)
  return livingEnemies(state).length
}

function berserkerRageMultiplier(state: EngineState): number {
  const missingHealthRatio = 1 - state.player.health / state.player.maxHealth
  const transformation = activeHeroTransformation(state)
  const overdriveMultiplier = transformation?.uniqueEffect.id === 'goldbach-overdrive'
    ? transformation.uniqueEffect.missingHealthDamageMultiplier
    : 1
  return 1 + missingHealthRatio * .9 * overdriveMultiplier
}

function shadowStepPastEnemy(state: EngineState, enemy: EnemyState, distancePast = 16): void {
  const direction = normalizeMovement({
    x: enemy.x - state.player.x,
    y: enemy.y - state.player.y,
  })
  const targetDistance = Math.max(0, distance(state.player, enemy) - enemy.radius + distancePast)
  const steps = Math.ceil(targetDistance / 10)
  for (let step = 0; step < steps; step += 1) {
    moveWithCollision(
      state.areaId,
      state.player,
      PLAYER_RADIUS,
      direction.x * Math.min(10, targetDistance - step * 10),
      direction.y * Math.min(10, targetDistance - step * 10),
    )
  }
  state.player.invulnerableUntilMs = Math.max(
    state.player.invulnerableUntilMs,
    state.elapsedMs + 260,
  )
}

function performAssassinTechnique(
  state: EngineState,
  actionId: PrimeTechniqueId | 'prime-infinity',
  timingScale = 1,
  ultimateDamageMultiplier = 1,
): number {
  const action = OFFENSIVE_ACTIONS[actionId]
  const marked = livingEnemies(state).filter((enemy) =>
    enemy.rsaMark !== 0 && enemy.rsaMarkUntilMs > state.elapsedMs,
  )

  if (actionId === 'twin-blades') {
    const targets = findFrontEnemies(state, 175, Math.PI * .48).slice(0, 2)
    const fallback = targets[0] ?? nearestEnemy(state, state.player, [], 150)
    const resolvedTargets = targets.length > 0 ? targets : fallback ? [fallback] : []
    for (const [index, enemy] of resolvedTargets.entries()) {
      applyRsaMark(state, enemy, index % 2 === 0 ? 1 : 2)
      queueActionHits(
        state,
        enemy,
        actionId,
        action.hitDamages.map((damage) => damage * (index === 0 ? 1 : .84)),
        70 * timingScale,
      )
      addCombatEffect(state, 'mobius-step', 42, 420, enemy)
    }
    const lastTarget = resolvedTargets[resolvedTargets.length - 1]
    if (lastTarget) shadowStepPastEnemy(state, lastTarget, 18)
    state.shake = resolvedTargets.length > 0 ? 4 : 0
    return resolvedTargets.length
  }

  if (actionId === 'sophie-chain') {
    if (marked.length === 0) {
      state.toast = {
        title: 'Nenhum sinal de Möbius',
        detail: 'Use J ou 1 para alternar μ = −1 e μ = +1 sobre os alvos.',
        tone: 'violet',
        untilMs: state.elapsedMs + 1_900,
      }
      return 0
    }
    let grantsCharge = true
    for (const enemy of marked) {
      const completeSign = enemy.rsaMark === 3
      const baseDamage = action.hitDamages.reduce((sum, damage) => sum + damage, 0)
      enemy.rsaMark = 0
      enemy.rsaMarkUntilMs = 0
      damageEnemyWithAction(
        state,
        enemy,
        actionId,
        baseDamage * (completeSign ? 1.8 : .82),
        grantsCharge,
      )
      grantsCharge = false
      enemy.intent = null
      enemy.stunnedUntilMs = Math.max(enemy.stunnedUntilMs, state.elapsedMs + (completeSign ? 820 : 360))
      addCombatEffect(state, 'mobius-step', completeSign ? 58 : 36, 620, enemy)
    }
    state.shake = 6
    return marked.length
  }

  if (actionId === 'mersenne-burst') {
    const victims = livingEnemies(state).filter((enemy) => distance(state.player, enemy) <= 128 + enemy.radius)
    for (const [index, enemy] of victims.entries()) {
      applyRsaMark(state, enemy, 3)
      queueActionHits(
        state,
        enemy,
        actionId,
        action.hitDamages.map((damage, hit) => damage * (hit === 2 ? 1.35 : .78)),
        (95 + index * 8) * timingScale,
      )
      enemy.intent = null
    }
    addCombatEffect(state, 'mobius-step', 132, 1_050, state.player)
    state.shake = 7
    return victims.length
  }

  const victims = livingEnemies(state)
  for (const [index, enemy] of victims.entries()) {
    const executeMultiplier = enemy.hp / enemy.maxHp <= .35 ? 1.75 : 1
    queueActionHits(
      state,
      enemy,
      actionId,
      action.hitDamages.map((damage) => damage * ultimateDamageMultiplier * executeMultiplier),
      (74 + index * 5) * timingScale,
    )
    enemy.intent = null
    enemy.stunnedUntilMs = Math.max(enemy.stunnedUntilMs, state.elapsedMs + 1_350)
    addCombatEffect(state, 'mobius-step', 62, 920, enemy)
  }
  state.shake = 10
  return victims.length
}

function performBerserkerTechnique(
  state: EngineState,
  actionId: PrimeTechniqueId | 'prime-infinity',
  timingScale = 1,
  ultimateDamageMultiplier = 1,
): number {
  const action = OFFENSIVE_ACTIONS[actionId]
  const rage = berserkerRageMultiplier(state)
  const transformation = activeHeroTransformation(state)
  const overdrive = transformation?.uniqueEffect.id === 'goldbach-overdrive'
    ? transformation.uniqueEffect
    : null
  const rangeMultiplier = getHeroClass(state.heroClassId).modifiers.rangeMultiplier
    * (transformation?.modifiers.rangeMultiplier ?? 1)

  if (actionId === 'twin-blades') {
    const direction = directionVector(state.player.facing)
    for (let step = 0; step < 3; step += 1) {
      moveWithCollision(state.areaId, state.player, PLAYER_RADIUS, direction.x * 10, direction.y * 10)
    }
    const victims = findFrontEnemies(state, 94 * rangeMultiplier, Math.PI * .62)
    for (const enemy of victims) {
      queueActionHits(
        state,
        enemy,
        actionId,
        action.hitDamages.map((damage) => damage * rage),
        115 * timingScale,
      )
    }
    addCombatEffect(state, 'goldbach-impact', 96, 620)
    state.shake = 6
    return victims.length
  }

  if (actionId === 'sophie-chain') {
    const victims = livingEnemies(state)
      .filter((enemy) => distance(state.player, enemy) <= 150 * rangeMultiplier + enemy.radius)
      .sort((first, second) => distance(state.player, first) - distance(state.player, second))
      .slice(0, 8)
    for (const [index, enemy] of victims.entries()) {
      const pull = normalizeMovement({ x: state.player.x - enemy.x, y: state.player.y - enemy.y })
      moveWithCollision(state.areaId, enemy, enemy.radius, pull.x * 34, pull.y * 34)
      damageEnemyWithAction(
        state,
        enemy,
        actionId,
        (action.hitDamages[index % action.hitDamages.length] ?? action.hitDamages[0]) * rage,
        index === 0,
      )
      enemy.intent = null
    }
    addCombatEffect(state, 'goldbach-impact', 150, 720)
    state.shake = 7
    return victims.length
  }

  if (actionId === 'mersenne-burst') {
    const impactRadius = overdrive?.impactRadius ?? 156
    const victims = livingEnemies(state).filter((enemy) => distance(state.player, enemy) <= impactRadius + enemy.radius)
    for (const enemy of victims) {
      queueActionHits(
        state,
        enemy,
        actionId,
        action.hitDamages.map((damage, index) => damage * rage * (.82 + index * .2)),
        175 * timingScale,
      )
      enemy.intent = null
    }
    addCombatEffect(state, 'goldbach-impact', impactRadius, 1_050)
    state.shake = 11
    return victims.length
  }

  const victims = livingEnemies(state)
  for (const enemy of victims) {
    queueActionHits(
      state,
      enemy,
      actionId,
      action.hitDamages.map((damage) => damage * rage * ultimateDamageMultiplier),
      125 * timingScale,
    )
    enemy.intent = null
    enemy.stunnedUntilMs = Math.max(enemy.stunnedUntilMs, state.elapsedMs + 1_600)
  }
  state.player.health = Math.min(state.player.maxHealth, state.player.health + 2)
  addCombatEffect(state, 'goldbach-impact', 210, 1_350)
  state.shake = 14
  return victims.length
}

function performEngineerTechnique(
  state: EngineState,
  actionId: PrimeTechniqueId | 'prime-infinity',
  timingScale = 1,
  ultimateDamageMultiplier = 1,
): number {
  const action = OFFENSIVE_ACTIONS[actionId]
  const delivery = getClassActionDelivery(state.heroClassId, actionId)
  const direction = directionVector(state.player.facing)
  const side = { x: -direction.y, y: direction.x }

  if (actionId === 'twin-blades') {
    for (const offset of [-24, 24]) {
      const pulseDamage = (action.hitDamages[offset < 0 ? 0 : 1] ?? action.hitDamages[0]) * .42
      spawnSpellZone(state, {
        kind: 'sieve-turret',
        actionId,
        origin: {
          x: state.player.x + direction.x * 48 + side.x * offset,
          y: state.player.y + direction.y * 48 + side.y * offset,
        },
        radius: 82,
        durationMs: delivery.persistsMs,
        armDelayMs: 150,
        pulseIntervalMs: 520 * timingScale,
        pulseDamages: Array.from({ length: 9 }, () => pulseDamage),
      })
    }
    addCombatEffect(state, 'sieve-deploy', 82, 680)
    return 2
  }

  if (actionId === 'sophie-chain') {
    for (const [index, range] of [48, 92, 136].entries()) {
      spawnSpellZone(state, {
        kind: 'sieve-line',
        actionId,
        origin: {
          x: state.player.x + direction.x * range,
          y: state.player.y + direction.y * range,
        },
        radius: 34,
        durationMs: delivery.persistsMs,
        armDelayMs: index * 105 * timingScale,
        pulseDamages: [action.hitDamages[index % action.hitDamages.length]],
      })
    }
    addCombatEffect(state, 'sieve-deploy', 148, 760)
    return livingEnemies(state).filter((enemy) => findFrontEnemies(state, 165, Math.PI * .16).includes(enemy)).length
  }

  if (actionId === 'mersenne-burst') {
    const center = bestEnemyClusterPoint(state, 94)
    spawnSpellZone(state, {
      kind: 'sieve-minefield',
      actionId,
      origin: center,
      radius: 98,
      durationMs: delivery.persistsMs,
      armDelayMs: 260,
      pulseIntervalMs: 620 * timingScale,
      pulseDamages: action.hitDamages,
    })
    addCombatEffect(state, 'sieve-deploy', 104, 1_100, center)
    return livingEnemies(state).filter((enemy) => distance(center, enemy) <= 104 + enemy.radius).length
  }

  spawnSpellZone(state, {
    kind: 'sieve-grid',
    actionId,
    origin: state.player,
    radius: Math.hypot(worldSize(state.areaId).x, worldSize(state.areaId).y),
    durationMs: delivery.persistsMs,
    pulseIntervalMs: 460 * timingScale,
    pulseDamages: action.hitDamages.map((damage) => damage * ultimateDamageMultiplier),
  })
  addCombatEffect(state, 'sieve-deploy', 170, 1_250, state.player)
  state.projectiles = []
  return livingEnemies(state).length
}

function performOracleTechnique(
  state: EngineState,
  actionId: PrimeTechniqueId | 'prime-infinity',
  timingScale = 1,
  ultimateDamageMultiplier = 1,
): number {
  const action = OFFENSIVE_ACTIONS[actionId]
  const delivery = getClassActionDelivery(state.heroClassId, actionId)
  const targets = livingEnemies(state)
    .sort((first, second) => distance(state.player, first) - distance(state.player, second))

  if (actionId === 'twin-blades') {
    for (const index of [0, 1]) {
      const target = targets[index] ?? targets[0] ?? null
      spawnHeroProjectile(state, {
        kind: 'elliptic-orb',
        actionId,
        damage: action.hitDamages[index] ?? action.hitDamages[0],
        speed: 174 * delivery.projectileSpeedMultiplier,
        direction: projectileDirection(state, target, index === 0 ? -5 : 5),
        target,
        homingStrength: 5.8,
        radius: 4,
        offset: index === 0 ? -6 : 6,
        lifeMs: delivery.projectileLifetimeMs,
      })
    }
    addCombatEffect(state, 'elliptic-arc', 76, 620)
    return Math.min(2, targets.length)
  }

  if (actionId === 'sophie-chain') {
    const target = targets[0] ?? null
    spawnHeroProjectile(state, {
      kind: 'elliptic-chain',
      actionId,
      damage: action.hitDamages.reduce((sum, damage) => sum + damage, 0) * .62,
      speed: 194 * delivery.projectileSpeedMultiplier,
      direction: projectileDirection(state, target),
      target,
      homingStrength: 7.2,
      remainingBounces: 6,
      radius: 4,
      lifeMs: delivery.projectileLifetimeMs,
    })
    addCombatEffect(state, 'elliptic-arc', 112, 760)
    return Math.min(7, targets.length)
  }

  if (actionId === 'mersenne-burst') {
    const center = bestEnemyClusterPoint(state, 92)
    spawnSpellZone(state, {
      kind: 'elliptic-singularity',
      actionId,
      origin: center,
      radius: 104,
      durationMs: delivery.persistsMs,
      pulseIntervalMs: 420 * timingScale,
      pulseDamages: action.hitDamages,
    })
    addCombatEffect(state, 'elliptic-arc', 112, 1_100, center)
    return livingEnemies(state).filter((enemy) => distance(center, enemy) <= 112 + enemy.radius).length
  }

  spawnSpellZone(state, {
    kind: 'elliptic-curve',
    actionId,
    origin: bestEnemyClusterPoint(state, 180),
    radius: Math.hypot(worldSize(state.areaId).x, worldSize(state.areaId).y),
    durationMs: delivery.persistsMs,
    pulseIntervalMs: 410 * timingScale,
    pulseDamages: action.hitDamages.map((damage) => damage * ultimateDamageMultiplier),
  })
  addCombatEffect(state, 'elliptic-arc', 190, 1_300, state.player)
  return targets.length
}

function performClassTechnique(
  state: EngineState,
  actionId: PrimeTechniqueId | 'prime-infinity',
  timingScale = 1,
  ultimateDamageMultiplier = 1,
): number {
  const archetype = getHeroClass(state.heroClassId).archetype
  if (archetype === 'warrior') {
    return performWarriorTechnique(state, actionId, timingScale, ultimateDamageMultiplier)
  }
  if (archetype === 'cryptographer') {
    return performCryptographerTechnique(state, actionId, timingScale, ultimateDamageMultiplier)
  }
  if (archetype === 'ranger') {
    return performRangerTechnique(state, actionId, timingScale, ultimateDamageMultiplier)
  }
  if (archetype === 'arcanist') {
    return performArcanistTechnique(state, actionId, timingScale, ultimateDamageMultiplier)
  }
  if (archetype === 'assassin') {
    return performAssassinTechnique(state, actionId, timingScale, ultimateDamageMultiplier)
  }
  if (archetype === 'berserker') {
    return performBerserkerTechnique(state, actionId, timingScale, ultimateDamageMultiplier)
  }
  if (archetype === 'engineer') {
    return performEngineerTechnique(state, actionId, timingScale, ultimateDamageMultiplier)
  }
  return performOracleTechnique(state, actionId, timingScale, ultimateDamageMultiplier)
}

function activateClassBasic(state: EngineState): void {
  const heroClass = getHeroClass(state.heroClassId)
  const action = OFFENSIVE_ACTIONS['basic-strike']
  const delivery = getClassActionDelivery(state.heroClassId, 'basic-strike')
  if (heroClass.archetype === 'warrior') {
    const combo = advanceWarriorCombo({
      step: state.player.warriorComboStep,
      expiresAtMs: state.player.warriorComboUntilMs,
    }, state.elapsedMs)
    state.player.warriorComboStep = combo.state.step
    state.player.warriorComboUntilMs = combo.state.expiresAtMs
    addCombatEffect(state, 'class-basic', action.range, 220)
    return
  }
  if (heroClass.archetype === 'berserker') {
    const combo = advanceWarriorCombo({
      step: state.player.warriorComboStep,
      expiresAtMs: state.player.warriorComboUntilMs,
    }, state.elapsedMs)
    state.player.warriorComboStep = combo.state.step
    state.player.warriorComboUntilMs = combo.state.expiresAtMs
    const transformation = activeHeroTransformation(state)
    const overdrive = transformation?.uniqueEffect.id === 'goldbach-overdrive'
      ? transformation.uniqueEffect
      : null
    const cleaveRange = overdrive ? overdrive.impactRadius * .64 : 66
    const victims = findFrontEnemies(state, cleaveRange, Math.PI * .92).slice(0, overdrive ? 6 : 3)
    const rage = berserkerRageMultiplier(state)
    for (const enemy of victims) {
      damageEnemyWithAction(
        state,
        enemy,
        'basic-strike',
        action.hitDamages[0] * rage * (combo.state.step === 3 ? 1.55 : 1),
      )
      const push = directionVector(state.player.facing)
      moveWithCollision(state.areaId, enemy, enemy.radius, push.x * 12, push.y * 12)
    }
    addCombatEffect(state, 'goldbach-impact', cleaveRange + 2, overdrive ? 440 : 300)
    state.shake = victims.length > 0 ? 4 : 1
    return
  }
  const target = findFrontEnemies(
    state,
    heroClass.archetype === 'ranger'
      ? 245
      : heroClass.archetype === 'engineer'
        ? 280
        : heroClass.archetype === 'oracle'
          ? 265
          : heroClass.archetype === 'assassin' ? 150 : 210,
    heroClass.archetype === 'ranger' || heroClass.archetype === 'engineer'
      ? Math.PI * .22
      : heroClass.archetype === 'assassin' ? Math.PI * .36 : Math.PI * .42,
  )[0] ?? null
  if (heroClass.archetype === 'cryptographer') {
    const mark = state.player.attackSerial % 2 === 0 ? 2 : 1
    spawnHeroProjectile(state, {
      kind: 'crypto-pulse',
      actionId: 'basic-strike',
      damage: action.hitDamages[0],
      speed: 235 * delivery.projectileSpeedMultiplier,
      direction: projectileDirection(state, target),
      target,
      homingStrength: 4.6,
      rsaMark: mark,
      lifeMs: delivery.projectileLifetimeMs,
    })
    return
  }
  if (heroClass.archetype === 'ranger') {
    spawnHeroProjectile(state, {
      kind: 'arrow',
      actionId: 'basic-strike',
      damage: action.hitDamages[0],
      speed: 200 * delivery.projectileSpeedMultiplier,
      direction: projectileDirection(state, target),
      target: null,
      radius: 2,
      lifeMs: delivery.projectileLifetimeMs,
    })
    return
  }
  if (heroClass.archetype === 'assassin') {
    if (!target) {
      addCombatEffect(state, 'mobius-step', 38, 260)
      return
    }
    const sign: RsaMark = state.player.attackSerial % 2 === 0 ? 2 : 1
    applyRsaMark(state, target, sign)
    shadowStepPastEnemy(state, target, 10)
    damageEnemyWithAction(
      state,
      target,
      'basic-strike',
      action.hitDamages[0] * (target.rsaMark === 3 ? 1.35 : 1),
    )
    addCombatEffect(state, 'mobius-step', 46, 340, target)
    return
  }
  if (heroClass.archetype === 'engineer') {
    spawnHeroProjectile(state, {
      kind: 'sieve-bolt',
      actionId: 'basic-strike',
      damage: action.hitDamages[0],
      speed: 248 * delivery.projectileSpeedMultiplier,
      direction: projectileDirection(state, target),
      target: null,
      radius: 3,
      lifeMs: delivery.projectileLifetimeMs,
    })
    return
  }
  if (heroClass.archetype === 'oracle') {
    spawnHeroProjectile(state, {
      kind: 'elliptic-orb',
      actionId: 'basic-strike',
      damage: action.hitDamages[0],
      speed: 184 * delivery.projectileSpeedMultiplier,
      direction: projectileDirection(state, target),
      target,
      homingStrength: 5.2,
      radius: 4,
      lifeMs: delivery.projectileLifetimeMs,
    })
    return
  }
  const direction = directionVector(state.player.facing)
  spawnSpellZone(state, {
    kind: 'glyph',
    actionId: 'basic-strike',
    origin: {
      x: state.player.x + direction.x * 42,
      y: state.player.y + direction.y * 42,
    },
    radius: 24,
    durationMs: delivery.persistsMs,
    armDelayMs: 260,
    pulseDamages: action.hitDamages,
  })
}

function activateClassDefense(state: EngineState): boolean {
  const defense = beginHeroDefense(state)
  if (!defense.activated) return false
  const heroClass = getHeroClass(state.heroClassId)
  state.player.defense = defense.state
  state.player.attackUntilMs = 0
  state.player.lastMoveAtMs = state.elapsedMs - 1_000
  state.player.activeAction = null
  state.player.classDefenseUntilMs = 0

  if (heroClass.archetype === 'ranger') {
    state.player.defense = {
      ...defense.state,
      startedAtMs: null,
      parryUntilMs: 0,
      guardUntilMs: 0,
    }
    const backward = directionVector(state.player.facing)
    moveWithCollision(
      state.areaId,
      state.player,
      PLAYER_RADIUS,
      -backward.x * 38,
      -backward.y * 38,
    )
    state.player.invulnerableUntilMs = Math.max(
      state.player.invulnerableUntilMs,
      state.elapsedMs + 430,
    )
    const target = findFrontEnemies(state, 245, Math.PI * .34)[0] ?? null
    if (target) {
      spawnHeroProjectile(state, {
        kind: 'arrow',
        actionId: 'basic-strike',
        damage: 12,
        speed: 350,
        direction: projectileDirection(state, target),
        target: null,
        radius: 2,
        lifeMs: 820,
      })
    }
    addCombatEffect(state, 'parry', 30, 390)
    return true
  }

  if (heroClass.archetype === 'assassin') {
    state.player.defense = {
      ...defense.state,
      startedAtMs: null,
      parryUntilMs: 0,
      guardUntilMs: 0,
    }
    const forward = directionVector(state.player.facing)
    for (let step = 0; step < 5; step += 1) {
      moveWithCollision(state.areaId, state.player, PLAYER_RADIUS, forward.x * 9, forward.y * 9)
    }
    state.player.classDefenseUntilMs = state.elapsedMs + 620
    state.player.invulnerableUntilMs = Math.max(state.player.invulnerableUntilMs, state.elapsedMs + 620)
    const target = nearestEnemy(state, state.player, [], 105)
    if (target) {
      applyRsaMark(state, target, target.rsaMark & 1 ? 2 : 1)
      damageEnemyWithAction(state, target, 'basic-strike', 12, true)
    }
    addCombatEffect(state, 'mobius-step', 58, 620)
    return true
  }

  if (heroClass.archetype === 'cryptographer') {
    state.player.defense = {
      ...defense.state,
      startedAtMs: null,
      parryUntilMs: 0,
      guardUntilMs: 0,
    }
    state.player.classDefenseUntilMs = state.elapsedMs + 780
    addCombatEffect(state, 'rsa-detonation', 54, 780)
    return true
  }
  if (heroClass.archetype === 'arcanist') {
    state.player.defense = {
      ...defense.state,
      startedAtMs: null,
      parryUntilMs: 0,
      guardUntilMs: 0,
    }
    state.player.classDefenseUntilMs = state.elapsedMs + 900
    addCombatEffect(state, 'glyph-detonation', 58, 900)
    return true
  }
  if (heroClass.archetype === 'engineer') {
    state.player.defense = {
      ...defense.state,
      startedAtMs: null,
      parryUntilMs: 0,
      guardUntilMs: 0,
    }
    state.player.classDefenseUntilMs = state.elapsedMs + 1_100
    addCombatEffect(state, 'sieve-deploy', 68, 1_100)
    return true
  }
  if (heroClass.archetype === 'oracle') {
    state.player.defense = {
      ...defense.state,
      startedAtMs: null,
      parryUntilMs: 0,
      guardUntilMs: 0,
    }
    state.player.classDefenseUntilMs = state.elapsedMs + 1_000
    addCombatEffect(state, 'elliptic-arc', 64, 1_000)
    return true
  }
  if (heroClass.archetype === 'berserker') {
    state.player.classDefenseUntilMs = state.elapsedMs + 760
    addCombatEffect(state, 'goldbach-impact', 46, 760)
    return true
  }
  addCombatEffect(state, 'guard', 32, IRREDUCIBLE_AEGIS.guardDurationMs)
  return true
}

function travelToArea(state: EngineState, areaId: PrimeboundAreaId): void {
  const firstVisit = !state.progress.visitedAreaIds.includes(areaId)
  state.areaId = areaId
  state.progress.currentAreaId = areaId
  if (firstVisit) state.progress.visitedAreaIds.push(areaId)
  const stageEncounter = stageEncounterFor(state, areaId)
  const spawn = gridToWorld(PRIMEBOUND_AREAS[areaId].playerSpawn)
  state.player.x = spawn.x
  state.player.y = spawn.y
  state.player.facing = 'right'
  state.player.health = Math.min(state.player.maxHealth, state.player.health + 2)
  state.player.stamina = state.player.maxStamina
  state.player.invulnerableUntilMs = Math.max(state.player.invulnerableUntilMs, state.elapsedMs + 1_200)
  state.player.attackUntilMs = 0
  state.player.attackOrigin = { x: spawn.x, y: spawn.y }
  state.player.attackFacing = 'right'
  state.player.activeAction = null
  state.player.warriorComboStep = 0
  state.player.warriorComboUntilMs = 0
  state.player.classDefenseUntilMs = 0
  state.player.defense = {
    ...state.player.defense,
    startedAtMs: null,
    parryUntilMs: 0,
    guardUntilMs: 0,
  }
  state.enemies = createAreaEnemies(areaId, state.progress.defeatedEnemyIds, state.progress.collectedRunes.length)
  state.projectiles = []
  state.enemyPowerEffects = []
  state.enemyHitStopMs = 0
  state.heroProjectiles = []
  state.spellZones = []
  state.rangerMarkedEnemyId = null
  state.rangerMarkUntilMs = 0
  state.primeChainCount = 0
  state.primeChainUntilMs = 0
  state.primeAscensionUntilMs = 0
  state.pendingCombatHits = []
  state.pendingPerfectUltimateWaves = []
  state.particles = []
  state.combatEffects = []
  state.callout = null
  state.cinematic = null
  state.storyCutscene = firstVisit
    ? startStoryCutscene(AREA_ENTRY_CUTSCENE_IDS[areaId])
    : null
  state.storyCutsceneBeatElapsedMs = 0
  state.pendingStoryCutsceneIds = state.pendingStoryCutsceneIds.filter((sceneId) =>
    sceneId === PRIMEBOUND_FINALE_CUTSCENE_ID || sceneId.endsWith(areaId),
  )
  state.transformationIntro = null
  state.queuedTransformation = false
  const size = worldSize(areaId)
  state.camera = {
    x: clamp(spawn.x - VIEW_WIDTH / 2, 0, Math.max(0, size.x - VIEW_WIDTH)),
    y: clamp(spawn.y - VIEW_HEIGHT / 2, 0, Math.max(0, size.y - VIEW_HEIGHT)),
  }
  state.areaBannerUntilMs = firstVisit ? 0 : state.elapsedMs + 1_800
  const stageMechanic = getPrimeStageMechanic(areaId)
  state.toast = {
    title: PRIMEBOUND_AREAS[areaId].name,
    detail: stageEncounter.completedAtMs !== null
      ? `${PRIMEBOUND_AREAS[areaId].subtitle} Região já purificada.`
      : stageMechanic
        ? `${stageMechanic.shortLabel}: ${stageMechanic.formula}. Dissipe a presença composta para revelar o guardião.`
        : `${PRIMEBOUND_AREAS[areaId].subtitle} Dissipe a presença composta para revelar o guardião.`,
    tone: areaId === 'prime-sanctuary' ? 'gold' : 'violet',
    untilMs: state.elapsedMs + (stageMechanic ? 5_200 : 3_800),
  }
}

function runResult(state: EngineState): PrimeboundRunResult {
  return {
    heroClassId: state.heroClassId,
    elapsedMs: Math.round(state.stageClockMs),
    enemiesDefeated: state.kills,
    runesCollected: state.progress.collectedRunes.length,
    damageTaken: state.damageTaken,
  }
}

function hashTile(x: number, y: number, seed: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43_758.5453
  return value - Math.floor(value)
}

function fillPixel(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height))
}

function drawGroundTile(
  ctx: CanvasRenderingContext2D,
  areaId: PrimeboundAreaId,
  tile: string,
  x: number,
  y: number,
  tileX: number,
  tileY: number,
  time: number,
) {
  const noise = hashTile(tileX, tileY, areaId.length)
  if (areaId === 'echo-woods') {
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, tile === '+' || tile === 'D' ? '#263824' : '#10241b')
    if (tile === '+' || tile === 'D') {
      fillPixel(ctx, x + 2, y + 4 + Math.floor(noise * 8), 10, 3, '#344d2d')
      fillPixel(ctx, x + 18, y + 20 - Math.floor(noise * 6), 8, 2, '#172b1d')
    } else {
      fillPixel(ctx, x + 5 + Math.floor(noise * 16), y + 6, 2, 5, '#315b35')
      fillPixel(ctx, x + 20, y + 21, 5, 2, '#1e4329')
    }
  } else if (areaId === 'composite-crypt') {
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, tile === '+' || tile === 'D' ? '#29243a' : '#181728')
    fillPixel(ctx, x, y, TILE_SIZE, 1, '#34304b')
    fillPixel(ctx, x + (tileY % 2 ? 16 : 0), y + 15, 1, 17, '#0f1020')
    if (noise > 0.55) fillPixel(ctx, x + 7, y + 7, 7, 1, '#51486b')
  } else if (areaId === 'twin-peaks') {
    const isBridge = tile === '+' || tile === 'D'
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, isBridge ? '#24576a' : '#102b3a')
    if (isBridge) {
      fillPixel(ctx, x + 2, y + 2, 28, 7, '#39778a')
      fillPixel(ctx, x + 2, y + 12, 28, 7, '#2f677b')
      fillPixel(ctx, x + 2, y + 22, 28, 7, '#39778a')
      fillPixel(ctx, x + 5 + Math.floor(noise * 14), y + 2, 2, 27, '#76cdd2')
    } else {
      fillPixel(ctx, x + 4, y + 6, 13, 2, '#1c4859')
      fillPixel(ctx, x + 20, y + 20, 8, 2, '#24586a')
      if (noise > .62) fillPixel(ctx, x + 9, y + 24, 2, 2, '#76edf0')
    }
  } else if (areaId === 'residue-forge') {
    const isRail = tile === '+' || tile === 'D'
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, isRail ? '#4d2922' : '#24171a')
    fillPixel(ctx, x + 2, y + 2, 28, 28, isRail ? '#563129' : '#2d1c1f')
    fillPixel(ctx, x + 3, y + 3, 2, 2, '#9a5840')
    fillPixel(ctx, x + 27, y + 27, 2, 2, '#9a5840')
    if (isRail) {
      fillPixel(ctx, x + 5, y + 6, 22, 3, '#a75a39')
      fillPixel(ctx, x + 5, y + 23, 22, 3, '#a75a39')
      for (let bar = 9; bar < 25; bar += 6) fillPixel(ctx, x + bar, y + 8, 2, 15, '#6f3a2e')
      const glow = .28 + Math.sin(time * .004 + tileX * .7 + tileY) * .12
      ctx.fillStyle = `rgba(255, 145, 61, ${glow})`
      ctx.fillRect(x + 7, y + 14, 18, 3)
    } else if (noise > .5) {
      fillPixel(ctx, x + 8, y + 15, 16, 1, '#613329')
    }
  } else if (areaId === 'eratosthenes-garden') {
    const isSievePath = tile === '+' || tile === 'D'
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, isSievePath ? '#194638' : '#0d241e')
    fillPixel(ctx, x + 2, y + 2, 28, 28, isSievePath ? '#205944' : '#123027')
    if (isSievePath) {
      // A living sieve: crossed composite cells and surviving prime sparks.
      for (let line = 6; line <= 26; line += 7) {
        fillPixel(ctx, x + line, y + 4, 1, 24, '#398665')
        fillPixel(ctx, x + 4, y + line, 24, 1, '#398665')
      }
      if ((tileX + tileY) % 3 === 0) {
        fillPixel(ctx, x + 14, y + 14, 4, 4, '#a8ffd5')
      } else {
        fillPixel(ctx, x + 10, y + 10, 2, 12, '#17392e')
        fillPixel(ctx, x + 5, y + 15, 12, 2, '#17392e')
      }
    } else {
      fillPixel(ctx, x + 5 + Math.floor(noise * 17), y + 7, 3, 6, '#267452')
      fillPixel(ctx, x + 19, y + 21, 7, 2, '#3a9a6c')
    }
  } else if (areaId === 'goldbach-citadel') {
    const isPairPath = tile === '+' || tile === 'D'
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, isPairPath ? '#442d60' : '#1c1428')
    fillPixel(ctx, x + 2, y + 2, 28, 28, isPairPath ? '#5a3a78' : '#281c39')
    fillPixel(ctx, x + 3, y + 3, 26, 2, '#8157a8')
    if (isPairPath) {
      const pulse = .45 + Math.sin(time * .005 + tileX + tileY) * .18
      ctx.fillStyle = `rgba(255, 146, 213, ${pulse})`
      ctx.fillRect(x + 7, y + 14, 5, 5)
      ctx.fillRect(x + 20, y + 14, 5, 5)
      fillPixel(ctx, x + 12, y + 16, 8, 1, '#ffd37d')
    } else if (noise > .48) {
      fillPixel(ctx, x + 8, y + 16, 5, 2, '#6c4a8e')
      fillPixel(ctx, x + 20, y + 16, 5, 2, '#6c4a8e')
    }
  } else if (areaId === 'wilson-observatory') {
    const isOrbit = tile === '+' || tile === 'D'
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, isOrbit ? '#203b67' : '#0e172d')
    fillPixel(ctx, x + 2, y + 2, 28, 28, isOrbit ? '#294b7c' : '#15213d')
    ctx.strokeStyle = isOrbit ? '#5c8fc8' : '#263d68'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(x + 16, y + 16, isOrbit ? 10 : 7, 0, Math.PI * 2)
    ctx.stroke()
    const angle = time * .002 + tileX * .73 + tileY
    fillPixel(ctx, x + 15 + Math.cos(angle) * 10, y + 15 + Math.sin(angle) * 10, 3, 3, '#b9d7ff')
    if (isOrbit) fillPixel(ctx, x + 15, y + 15, 3, 3, '#8fb8ff')
  } else if (areaId === 'mobius-labyrinth') {
    const isRibbon = tile === '+' || tile === 'D'
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, isRibbon ? '#38203f' : '#160f24')
    fillPixel(ctx, x + 2, y + 2, 28, 28, isRibbon ? '#4b2850' : '#21152f')
    ctx.strokeStyle = isRibbon ? '#ff7199' : '#5e376d'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(x + 16, y + 16, 11, 5, (tileX + tileY) % 2 ? .55 : -.55, 0, Math.PI * 2)
    ctx.stroke()
    fillPixel(ctx, x + 14, y + 14, 4, 4, (tileX + tileY) % 3 === 0 ? '#70f0ad' : '#7c496f')
  } else if (areaId === 'fermat-bastion') {
    const isRampart = tile === '+' || tile === 'D'
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, isRampart ? '#4d2920' : '#211411')
    fillPixel(ctx, x + 2, y + 2, 28, 28, isRampart ? '#69372a' : '#2d1c18')
    fillPixel(ctx, x + 4, y + 4, 24, 2, '#9b5439')
    if (isRampart) {
      const pulse = .35 + Math.sin(time * .004 + tileX) * .16
      ctx.fillStyle = `rgba(255, 155, 87, ${pulse})`
      ctx.fillRect(x + 6, y + 14, 20, 4)
      fillPixel(ctx, x + 9, y + 10, 2, 12, '#ffcf76')
      fillPixel(ctx, x + 21, y + 10, 2, 12, '#ffcf76')
    }
  } else if (areaId === 'sieve-foundry') {
    const isGrid = tile === '+' || tile === 'D'
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, isGrid ? '#183f37' : '#0d201d')
    fillPixel(ctx, x + 2, y + 2, 28, 28, isGrid ? '#21564a' : '#123029')
    for (let line = 6; line < 30; line += 6) {
      fillPixel(ctx, x + line, y + 3, 1, 26, '#327767')
      fillPixel(ctx, x + 3, y + line, 26, 1, '#327767')
    }
    if (isGrid) {
      const primeCell = [2, 3, 5, 7][Math.abs(tileX + tileY) % 4]
      fillPixel(ctx, x + primeCell * 3, y + primeCell * 2, 3, 3, '#62efb2')
    }
  } else if (areaId === 'elliptic-nexus') {
    const isCurve = tile === '+' || tile === 'D'
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, isCurve ? '#252a58' : '#10152d')
    fillPixel(ctx, x + 2, y + 2, 28, 28, isCurve ? '#31356d' : '#171d3e')
    ctx.strokeStyle = isCurve ? '#9f8cff' : '#485192'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + 3, y + 23)
    ctx.bezierCurveTo(x + 9, y + 2, x + 23, y + 30, x + 29, y + 8)
    ctx.stroke()
    const point = Math.abs(tileX * 3 + tileY * 5) % 19
    fillPixel(ctx, x + 6 + point, y + 12 + Math.sin(point) * 6, 3, 3, '#ff70c5')
  } else {
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, tile === '+' || tile === 'D' ? '#4b3620' : '#241b15')
    fillPixel(ctx, x + 2, y + 2, 28, 28, '#2d2117')
    if (tile === '+') {
      fillPixel(ctx, x + 13, y, 6, TILE_SIZE, '#6d4b24')
      fillPixel(ctx, x, y + 13, TILE_SIZE, 6, '#6d4b24')
      const glow = 0.45 + Math.sin(time * 0.003 + tileX + tileY) * 0.15
      ctx.fillStyle = `rgba(255, 205, 100, ${glow})`
      ctx.fillRect(x + 15, y + 15, 2, 2)
    }
  }
}

function drawSolidTile(
  ctx: CanvasRenderingContext2D,
  areaId: PrimeboundAreaId,
  tile: string,
  x: number,
  y: number,
  tileX: number,
  tileY: number,
  time: number,
) {
  const noise = hashTile(tileX, tileY, 8)
  if (tile === '~') {
    const waterBase = areaId === 'echo-woods'
      ? '#092b31'
      : areaId === 'twin-peaks'
        ? '#071d2c'
        : areaId === 'eratosthenes-garden'
          ? '#082b25'
          : areaId === 'goldbach-citadel'
            ? '#241438'
            : areaId === 'wilson-observatory'
              ? '#081934'
              : areaId === 'mobius-labyrinth'
                ? '#1b0c2b'
                : areaId === 'fermat-bastion'
                  ? '#35140e'
                  : areaId === 'sieve-foundry'
                    ? '#082923'
                    : areaId === 'elliptic-nexus'
                      ? '#10143c'
        : '#0b1020'
    const waterHighlight = areaId === 'echo-woods'
      ? '#197181'
      : areaId === 'twin-peaks'
        ? '#2c91a7'
        : areaId === 'eratosthenes-garden'
          ? '#36a778'
          : areaId === 'goldbach-citadel'
            ? '#a85bba'
            : areaId === 'wilson-observatory'
              ? '#4e82be'
              : areaId === 'mobius-labyrinth'
                ? '#bc4b85'
                : areaId === 'fermat-bastion'
                  ? '#d96a3e'
                  : areaId === 'sieve-foundry'
                    ? '#38a984'
                    : areaId === 'elliptic-nexus'
                      ? '#7c6ed6'
        : '#342d65'
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, waterBase)
    const wave = Math.floor((time * 0.012 + tileX * 5 + tileY * 3) % 18)
    fillPixel(ctx, x + wave - 4, y + 9, 10, 1, waterHighlight)
    fillPixel(ctx, x + ((wave + 12) % 24), y + 23, 7, 1, areaId === 'twin-peaks' ? '#76dce3' : '#165364')
    return
  }
  if (tile === '^') {
    drawGroundTile(ctx, areaId, '.', x, y, tileX, tileY, time)
    const rubbleDark = areaId === 'twin-peaks'
      ? '#1b3e4b'
      : areaId === 'residue-forge'
        ? '#4e2924'
        : '#332f42'
    const rubbleMid = areaId === 'twin-peaks'
      ? '#376979'
      : areaId === 'residue-forge'
        ? '#86452f'
        : '#514965'
    const rubbleLight = areaId === 'twin-peaks'
      ? '#66aeba'
      : areaId === 'residue-forge'
        ? '#d07642'
        : '#706583'
    fillPixel(ctx, x + 4, y + 18, 21, 8, rubbleDark)
    fillPixel(ctx, x + 9, y + 10, 13, 9, rubbleMid)
    fillPixel(ctx, x + 12, y + 8, 7, 3, rubbleLight)
    return
  }

  if (areaId === 'echo-woods') {
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, '#071712')
    fillPixel(ctx, x + 11, y + 16, 10, 16, '#3a291c')
    fillPixel(ctx, x + 3, y + 3, 26, 19, noise > 0.48 ? '#173e25' : '#12351f')
    fillPixel(ctx, x + 7, y, 18, 7, '#24562c')
    fillPixel(ctx, x + 2, y + 9, 7, 8, '#2d6635')
    if (noise > 0.66) fillPixel(ctx, x + 23, y + 6, 2, 2, '#a7d86a')
  } else if (areaId === 'composite-crypt') {
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, '#11101d')
    fillPixel(ctx, x + 2, y + 3, 28, 29, '#302b42')
    fillPixel(ctx, x + 2, y + 3, 28, 4, '#5b516c')
    fillPixel(ctx, x + 5, y + 10, 2, 16, '#211e31')
    fillPixel(ctx, x + 18, y + 7, 2, 20, '#211e31')
  } else if (areaId === 'twin-peaks') {
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, '#06151f')
    fillPixel(ctx, x + 2, y + 5, 28, 27, noise > .5 ? '#193c49' : '#153541')
    fillPixel(ctx, x + 2, y + 5, 28, 3, '#407182')
    fillPixel(ctx, x + 7, y + 12, 4, 20, '#102a35')
    fillPixel(ctx, x + 21, y + 9, 3, 23, '#102a35')
    if (noise > .65) fillPixel(ctx, x + 25, y + 11, 2, 5, '#62cad3')
  } else if (areaId === 'residue-forge') {
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, '#14090b')
    fillPixel(ctx, x + 2, y + 4, 28, 28, '#3d2020')
    fillPixel(ctx, x + 2, y + 4, 28, 4, '#8c4935')
    fillPixel(ctx, x + 6, y + 12, 20, 3, '#1e1317')
    fillPixel(ctx, x + 6, y + 22, 20, 3, '#1e1317')
    fillPixel(ctx, x + 9, y + 8, 3, 22, '#673126')
    if (noise > .56) fillPixel(ctx, x + 24, y + 9, 3, 3, '#ff9e55')
  } else if (areaId === 'eratosthenes-garden') {
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, '#071914')
    fillPixel(ctx, x + 2, y + 5, 28, 27, '#174a37')
    fillPixel(ctx, x + 2, y + 5, 28, 4, '#4ba477')
    fillPixel(ctx, x + 6, y + 10, 4, 22, '#0e2e24')
    fillPixel(ctx, x + 20, y + 9, 4, 23, '#0e2e24')
    if (noise > .45) fillPixel(ctx, x + 13, y + 12, 6, 6, '#72efb4')
  } else if (areaId === 'goldbach-citadel') {
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, '#120b1d')
    fillPixel(ctx, x + 2, y + 4, 28, 28, '#4e3165')
    fillPixel(ctx, x + 2, y + 4, 28, 4, '#ad6aa7')
    fillPixel(ctx, x + 6, y + 11, 8, 17, '#2b1b3a')
    fillPixel(ctx, x + 18, y + 11, 8, 17, '#2b1b3a')
    fillPixel(ctx, x + 14, y + 15, 4, 4, noise > .5 ? '#ffcf7a' : '#ff92d5')
  } else if (areaId === 'wilson-observatory') {
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, '#070e20')
    fillPixel(ctx, x + 2, y + 4, 28, 28, '#253e6b')
    fillPixel(ctx, x + 2, y + 4, 28, 4, '#608cca')
    fillPixel(ctx, x + 6, y + 11, 20, 2, '#142747')
    fillPixel(ctx, x + 6, y + 22, 20, 2, '#142747')
    ctx.strokeStyle = '#8fb8ff'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(x + 16, y + 18, 6 + (noise > .5 ? 2 : 0), 0, Math.PI * 2)
    ctx.stroke()
  } else if (areaId === 'mobius-labyrinth') {
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, '#0e0918')
    fillPixel(ctx, x + 2, y + 4, 28, 28, '#3d2148')
    fillPixel(ctx, x + 2, y + 4, 28, 4, '#8b4b7c')
    ctx.strokeStyle = '#ff7199'
    ctx.beginPath()
    ctx.ellipse(x + 16, y + 18, 9, 5, .55, 0, Math.PI * 2)
    ctx.stroke()
    fillPixel(ctx, x + 14, y + 16, 4, 4, '#70f0ad')
  } else if (areaId === 'fermat-bastion') {
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, '#160907')
    fillPixel(ctx, x + 2, y + 4, 28, 28, '#593024')
    fillPixel(ctx, x + 2, y + 4, 28, 4, '#bd6944')
    fillPixel(ctx, x + 6, y + 11, 7, 20, '#321a16')
    fillPixel(ctx, x + 19, y + 11, 7, 20, '#321a16')
    fillPixel(ctx, x + 14, y + 14, 4, 4, noise > .5 ? '#ffcf76' : '#ff7855')
  } else if (areaId === 'sieve-foundry') {
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, '#061813')
    fillPixel(ctx, x + 2, y + 4, 28, 28, '#174a3c')
    fillPixel(ctx, x + 2, y + 4, 28, 4, '#50ad89')
    for (let line = 7; line <= 25; line += 6) {
      fillPixel(ctx, x + line, y + 10, 2, 20, '#0b2922')
    }
    if (noise > .4) fillPixel(ctx, x + 13, y + 13, 6, 6, '#62efb2')
  } else if (areaId === 'elliptic-nexus') {
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, '#080b20')
    fillPixel(ctx, x + 2, y + 4, 28, 28, '#292c62')
    fillPixel(ctx, x + 2, y + 4, 28, 4, '#756bc5')
    ctx.strokeStyle = '#9f8cff'
    ctx.beginPath()
    ctx.moveTo(x + 5, y + 26)
    ctx.bezierCurveTo(x + 10, y + 5, x + 22, y + 29, x + 27, y + 10)
    ctx.stroke()
    fillPixel(ctx, x + 15, y + 15, 3, 3, '#ff70c5')
  } else {
    fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, '#120e0c')
    fillPixel(ctx, x + 2, y + 4, 28, 28, '#49331e')
    fillPixel(ctx, x + 2, y + 4, 28, 4, '#8a6531')
    fillPixel(ctx, x + 8, y + 10, 3, 19, '#302116')
    fillPixel(ctx, x + 22, y + 9, 2, 20, '#302116')
  }
}

function drawDoor(ctx: CanvasRenderingContext2D, areaId: PrimeboundAreaId, x: number, y: number, open: boolean, time: number) {
  const accent = AREA_ACCENTS[areaId]
  fillPixel(ctx, x, y, TILE_SIZE, TILE_SIZE, '#090b10')
  fillPixel(ctx, x + 3, y + 2, 26, 30, '#272834')
  fillPixel(ctx, x + 7, y + 6, 18, 26, '#10141b')
  ctx.globalAlpha = open ? 0.75 + Math.sin(time * 0.004) * 0.18 : 0.22
  fillPixel(ctx, x + 9, y + 8, 14, 22, open ? accent : '#6e3547')
  ctx.globalAlpha = 1
  fillPixel(ctx, x + 14, y + 12, 4, 4, open ? '#fff2b0' : '#bb4d5f')
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, alpha = 0.35) {
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`
  ctx.beginPath()
  ctx.ellipse(Math.round(x), Math.round(y), width, Math.max(2, width * 0.34), 0, 0, Math.PI * 2)
  ctx.fill()
}

interface HeroRenderPose {
  readonly time: number
  readonly moving: boolean
  readonly attacking: boolean
  readonly dashing: boolean
  readonly casting: boolean
  readonly ascended: boolean
}

function drawHeroBody(
  ctx: CanvasRenderingContext2D,
  heroClass: HeroClassDefinition,
  x: number,
  y: number,
  direction: Direction,
  pose: HeroRenderPose,
): void {
  for (const rect of heroBodyRects(heroClass, direction, pose)) {
    fillPixel(ctx, x + rect.x, y + rect.y, rect.w, rect.h, rect.color)
  }
}

function drawHeroWeapon(
  ctx: CanvasRenderingContext2D,
  heroClass: HeroClassDefinition,
  player: PlayerState,
  x: number,
  y: number,
  direction: Vec2,
  attacking: boolean,
  time: number,
  cinematic: CinematicProgress | null,
): void {
  const { archetype, palette } = heroClass
  const baseAngles: Record<Direction, number> = {
    right: 0,
    down: Math.PI / 2,
    left: Math.PI,
    up: -Math.PI / 2,
  }
  const weaponActive = attacking || Boolean(
    cinematic && cinematic.phase !== 'idle' && cinematic.phase !== 'complete',
  )
  let progress = 0
  if (cinematic) {
    progress = cinematic.phase === 'charge'
      ? cinematic.chargeProgress * .18
      : cinematic.phase === 'release'
        ? .18 + cinematic.phaseProgress * .62
        : cinematic.phase === 'impact'
          ? .8 + cinematic.phaseProgress * .2
          : 1
  } else if (attacking) {
    const durationMs = player.activeAction === 'basic-strike'
      ? ATTACK_DURATION_MS
      : TECHNIQUE_ATTACK_DURATION_MS
    const elapsedMs = durationMs - clamp(player.attackUntilMs - time, 0, durationMs)
    const releaseWindowMs = player.activeAction === 'basic-strike'
      ? ATTACK_DURATION_MS
      : 240
    progress = clamp(elapsedMs / releaseWindowMs, 0, 1)
  }
  const angle = baseAngles[player.facing] - (weaponActive ? .95 : 0) + progress * 1.9
  const reach = archetype === 'ranger'
    ? 29
    : archetype === 'engineer' ? 27
      : archetype === 'oracle' ? 25
        : archetype === 'cryptographer' || archetype === 'berserker' ? 23
          : archetype === 'assassin' ? 21 : 17
  const tipX = x + Math.cos(angle) * reach
  const tipY = y + Math.sin(angle) * reach
  const actionColor = player.activeAction === 'sophie-chain'
    ? palette.secondary
    : player.activeAction === 'mersenne-burst' || player.activeAction === 'prime-infinity'
      ? palette.accent
      : palette.energy

  if (weaponActive) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = actionColor
    ctx.lineWidth = player.activeAction === 'prime-infinity' ? 5 : archetype === 'ranger' ? 2 : 3
    if (archetype === 'ranger') {
      const sideX = -Math.sin(angle)
      const sideY = Math.cos(angle)
      ctx.beginPath()
      ctx.moveTo(x + sideX * 8, y + sideY * 8)
      ctx.quadraticCurveTo(x - Math.cos(angle) * 4, y - Math.sin(angle) * 4, x - sideX * 8, y - sideY * 8)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(angle) * 5, y + Math.sin(angle) * 5)
      ctx.lineTo(tipX, tipY)
      ctx.stroke()
      fillPixel(ctx, tipX - 2, tipY - 2, 4, 4, palette.accent)
    } else if (archetype === 'cryptographer') {
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(angle) * 6, y + Math.sin(angle) * 6)
      ctx.lineTo(tipX, tipY)
      ctx.stroke()
      ctx.strokeRect(tipX - 4, tipY - 4, 8, 8)
      fillPixel(ctx, tipX - 1, tipY - 1, 3, 3, '#ffffff')
    } else if (archetype === 'arcanist') {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(tipX, tipY)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(tipX, tipY, 5 + progress * 3, 0, Math.PI * 2)
      ctx.stroke()
      fillPixel(ctx, tipX - 1, tipY - 1, 3, 3, '#ffffff')
    } else if (archetype === 'assassin') {
      const sideX = -Math.sin(angle)
      const sideY = Math.cos(angle)
      for (const side of [-1, 1]) {
        ctx.strokeStyle = side < 0 ? palette.energy : palette.accent
        ctx.beginPath()
        ctx.moveTo(x + sideX * side * 5, y + sideY * side * 5)
        ctx.quadraticCurveTo(
          x + Math.cos(angle) * reach * .5 + sideX * side * 9,
          y + Math.sin(angle) * reach * .5 + sideY * side * 9,
          tipX + sideX * side * 5,
          tipY + sideY * side * 5,
        )
        ctx.stroke()
      }
    } else if (archetype === 'berserker') {
      for (const side of [-1, 1]) {
        ctx.strokeStyle = side < 0 ? palette.energy : palette.accent
        ctx.beginPath()
        ctx.arc(
          tipX - Math.sin(angle) * side * 7,
          tipY + Math.cos(angle) * side * 7,
          7 + progress * 3,
          0,
          Math.PI * 2,
        )
        ctx.stroke()
      }
    } else if (archetype === 'engineer') {
      ctx.strokeRect(tipX - 7, tipY - 5, 14, 10)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(tipX, tipY)
      ctx.stroke()
      fillPixel(ctx, tipX - 2, tipY - 2, 4, 4, palette.energy)
    } else if (archetype === 'oracle') {
      ctx.beginPath()
      ctx.ellipse(tipX, tipY, 9 + progress * 3, 5, angle, 0, Math.PI * 2)
      ctx.ellipse(tipX, tipY, 9 + progress * 3, 5, -angle, 0, Math.PI * 2)
      ctx.stroke()
      fillPixel(ctx, tipX - 2, tipY - 2, 4, 4, '#ffffff')
    } else {
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(angle) * 7, y + Math.sin(angle) * 7)
      ctx.lineTo(tipX, tipY)
      ctx.stroke()
      fillPixel(ctx, tipX - 1, tipY - 1, 3, 3, '#ffffff')
    }
    ctx.restore()
    return
  }

  const weaponX = x + direction.x * 10 - direction.y * 4
  const weaponY = y + direction.y * 10 + direction.x * 4
  if (archetype === 'ranger') {
    ctx.strokeStyle = palette.accent
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(weaponX, weaponY, 7, -Math.PI / 2, Math.PI / 2)
    ctx.stroke()
    return
  }
  if (archetype === 'cryptographer') {
    fillPixel(ctx, weaponX - 2, weaponY - 2, 5, 5, palette.energy)
    fillPixel(ctx, weaponX, weaponY + 2, 2, 8, palette.accent)
    return
  }
  if (archetype === 'arcanist') {
    fillPixel(ctx, weaponX - 1, weaponY - 7, 2, 15, palette.accent)
    fillPixel(ctx, weaponX - 3, weaponY - 10, 6, 6, palette.energy)
    return
  }
  if (archetype === 'assassin') {
    fillPixel(ctx, weaponX - 6, weaponY - 1, 12, 2, palette.energy)
    fillPixel(ctx, weaponX - 1, weaponY - 6, 2, 12, palette.accent)
    return
  }
  if (archetype === 'berserker') {
    fillPixel(ctx, weaponX - 5, weaponY - 5, 10, 10, palette.accent)
    fillPixel(ctx, weaponX - 2, weaponY - 2, 4, 4, palette.energy)
    return
  }
  if (archetype === 'engineer') {
    fillPixel(ctx, weaponX - 5, weaponY - 3, 11, 7, palette.secondary)
    fillPixel(ctx, weaponX + 3, weaponY - 1, 8, 3, palette.energy)
    return
  }
  if (archetype === 'oracle') {
    ctx.strokeStyle = palette.energy
    ctx.beginPath()
    ctx.ellipse(weaponX, weaponY, 7, 4, .55, 0, Math.PI * 2)
    ctx.stroke()
    fillPixel(ctx, weaponX - 1, weaponY - 1, 3, 3, palette.accent)
    return
  }
  fillPixel(ctx, weaponX - 1, weaponY - 6, 2, 12, '#d9e3df')
  fillPixel(ctx, weaponX - 3, weaponY + 3, 6, 2, palette.shadow)
}

function drawHeroAnimeAura(
  ctx: CanvasRenderingContext2D,
  heroClass: HeroClassDefinition,
  x: number,
  y: number,
  time: number,
  strength: number,
  reducedMotion: boolean,
): void {
  if (strength <= 0) return
  const clock = reducedMotion ? 0 : time
  const radius = 17 + strength * 13 + (reducedMotion ? 0 : Math.sin(clock * .016) * 2)
  ctx.save()
  ctx.translate(x, y - 4)
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = .16 + strength * .28
  ctx.strokeStyle = heroClass.palette.energy
  ctx.fillStyle = heroClass.palette.primary
  ctx.lineWidth = 1.5 + strength
  ctx.beginPath()
  for (let point = 0; point < 18; point += 1) {
    const angle = -Math.PI / 2 + point / 18 * Math.PI * 2
    const flame = point % 2 === 0
      ? radius * (1 + (reducedMotion ? .08 : Math.sin(clock * .022 + point) * .12))
      : radius * .7
    const pointX = Math.cos(angle) * flame
    const pointY = Math.sin(angle) * flame * 1.25
    if (point === 0) ctx.moveTo(pointX, pointY)
    else ctx.lineTo(pointX, pointY)
  }
  ctx.closePath()
  ctx.stroke()

  ctx.globalAlpha = .3 + strength * .38
  if (heroClass.archetype === 'warrior') {
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(side * 8, 13)
      ctx.lineTo(side * (20 + strength * 8), -14)
      ctx.stroke()
    }
  } else if (heroClass.archetype === 'cryptographer') {
    ctx.rotate(reducedMotion ? Math.PI / 4 : clock * .001)
    ctx.strokeRect(-radius * .7, -radius * .7, radius * 1.4, radius * 1.4)
    ctx.fillStyle = heroClass.palette.accent
    ctx.font = 'bold 7px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('p', -radius, -2)
    ctx.fillText('q', radius, -2)
  } else if (heroClass.archetype === 'ranger') {
    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, Math.PI * 2)
    ctx.moveTo(-radius - 7, 0)
    ctx.lineTo(radius + 7, 0)
    ctx.moveTo(0, -radius * 1.25)
    ctx.lineTo(0, radius * 1.25)
    ctx.stroke()
  } else if (heroClass.archetype === 'assassin') {
    ctx.rotate(reducedMotion ? 0 : clock * .0022)
    ctx.beginPath()
    ctx.ellipse(0, 0, radius, radius * .38, .52, 0, Math.PI * 2)
    ctx.ellipse(0, 0, radius, radius * .38, -.52, 0, Math.PI * 2)
    ctx.stroke()
    ctx.font = 'bold 6px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('−1', -radius, 2)
    ctx.fillText('0', 0, 2)
    ctx.fillText('+1', radius, 2)
  } else if (heroClass.archetype === 'berserker') {
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(side * radius * .6, 0, radius * .48, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.font = 'bold 7px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('p', -radius * .6, 2)
    ctx.fillText('q', radius * .6, 2)
  } else if (heroClass.archetype === 'engineer') {
    ctx.rotate(reducedMotion ? 0 : clock * .0013)
    for (let line = -2; line <= 2; line += 1) {
      ctx.beginPath()
      ctx.moveTo(-radius, line * radius * .22)
      ctx.lineTo(radius, line * radius * .22)
      ctx.moveTo(line * radius * .22, -radius)
      ctx.lineTo(line * radius * .22, radius)
      ctx.stroke()
    }
  } else if (heroClass.archetype === 'oracle') {
    ctx.rotate(reducedMotion ? 0 : -clock * .0011)
    for (const rotation of [-.65, 0, .65]) {
      ctx.beginPath()
      ctx.ellipse(0, 0, radius, radius * .42, rotation, 0, Math.PI * 2)
      ctx.stroke()
    }
    fillPixel(ctx, radius * .7, -2, 4, 4, heroClass.palette.accent)
  } else {
    ctx.rotate(reducedMotion ? 0 : -clock * .0008)
    for (let star = 0; star < 7; star += 1) {
      const angle = star / 7 * Math.PI * 2
      const orbit = radius * (star % 2 ? .8 : 1.08)
      fillPixel(
        ctx,
        Math.cos(angle) * orbit - 2,
        Math.sin(angle) * orbit * .8 - 2,
        4,
        4,
        star % 2 ? heroClass.palette.energy : heroClass.palette.accent,
      )
    }
  }
  ctx.restore()
}

function drawHeroTransformationAura(
  ctx: CanvasRenderingContext2D,
  definition: HeroTransformationDefinition,
  x: number,
  y: number,
  time: number,
  reducedMotion: boolean,
): void {
  const clock = reducedMotion ? 0 : time
  const pulse = reducedMotion ? 1 : .9 + Math.sin(clock * .006 * definition.aura.pulseHz) * .1
  const radius = 24 * definition.aura.radiusMultiplier * pulse
  ctx.save()
  ctx.translate(x, y - 4)
  ctx.globalCompositeOperation = 'lighter'

  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, radius * 1.35)
  glow.addColorStop(0, `${definition.palette.auraCore}d8`)
  glow.addColorStop(.34, `${definition.palette.energy}54`)
  glow.addColorStop(1, `${definition.palette.primary}00`)
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(0, 0, radius * 1.35, 0, Math.PI * 2)
  ctx.fill()

  for (let layer = 0; layer < definition.aura.layers; layer += 1) {
    const layerRadius = radius * (.58 + layer * .17)
    ctx.globalAlpha = .22 + layer * .09
    ctx.strokeStyle = layer % 2 ? definition.palette.secondary : definition.palette.energy
    ctx.lineWidth = layer === definition.aura.layers - 1 ? 1.8 : 1
    ctx.setLineDash(layer % 2 ? [3, 5] : [1, 4])
    ctx.beginPath()
    ctx.arc(0, 0, layerRadius, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.globalAlpha = .78
  ctx.strokeStyle = definition.palette.flash
  ctx.fillStyle = definition.palette.flash

  if (definition.aura.style === 'prime-blade-constellation') {
    for (let blade = 0; blade < 6; blade += 1) {
      const angle = blade / 6 * Math.PI * 2 + clock * .0012
      ctx.beginPath()
      ctx.moveTo(Math.cos(angle) * radius * .45, Math.sin(angle) * radius * .45)
      ctx.lineTo(Math.cos(angle) * radius * 1.24, Math.sin(angle) * radius * 1.24)
      ctx.stroke()
    }
    ctx.strokeRect(-15, -15, 30, 30)
  } else if (definition.aura.style === 'rsa-key-mandala') {
    ctx.save()
    ctx.rotate(clock * .0014)
    ctx.strokeRect(-radius * .62, -radius * .62, radius * 1.24, radius * 1.24)
    ctx.rotate(Math.PI / 4)
    ctx.strokeRect(-radius * .46, -radius * .46, radius * .92, radius * .92)
    ctx.restore()
    ctx.font = 'bold 7px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('p', -radius, 3)
    ctx.fillText('q', radius, 3)
  } else if (definition.aura.style === 'modular-residue-comet') {
    ctx.beginPath()
    ctx.arc(0, 0, radius * .72, -.65, Math.PI * 1.55)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-radius * 1.55, 7)
    ctx.lineTo(radius * .95, 7)
    ctx.moveTo(-radius * 1.25, -5)
    ctx.lineTo(radius * .7, -5)
    ctx.stroke()
  } else if (definition.aura.style === 'mobius-shadow-lattice') {
    ctx.rotate(reducedMotion ? 0 : clock * .0018)
    for (const rotation of [-.62, .62]) {
      ctx.beginPath()
      ctx.ellipse(0, 0, radius, radius * .34, rotation, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.font = 'bold 8px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('−1', -radius * .76, 3)
    ctx.fillText('0', 0, 3)
    ctx.fillText('+1', radius * .76, 3)
  } else if (definition.aura.style === 'goldbach-twin-sun') {
    for (const side of [-1, 1]) {
      const sunX = side * radius * .54
      ctx.beginPath()
      ctx.arc(sunX, 0, radius * .4, 0, Math.PI * 2)
      ctx.stroke()
      for (let ray = 0; ray < 7; ray += 1) {
        const angle = ray / 7 * Math.PI * 2 + clock * .0008 * side
        ctx.beginPath()
        ctx.moveTo(sunX + Math.cos(angle) * radius * .42, Math.sin(angle) * radius * .42)
        ctx.lineTo(sunX + Math.cos(angle) * radius * .58, Math.sin(angle) * radius * .58)
        ctx.stroke()
      }
    }
  } else if (definition.aura.style === 'eratosthenes-forge-grid') {
    ctx.rotate(reducedMotion ? 0 : clock * .0007)
    for (let line = -3; line <= 3; line += 1) {
      const offset = line * radius * .23
      ctx.beginPath()
      ctx.moveTo(-radius, offset)
      ctx.lineTo(radius, offset)
      ctx.moveTo(offset, -radius)
      ctx.lineTo(offset, radius)
      ctx.stroke()
    }
    fillPixel(ctx, -2, -2, 4, 4, definition.palette.auraCore)
  } else if (definition.aura.style === 'elliptic-curve-oracle') {
    ctx.rotate(reducedMotion ? 0 : -clock * .0009)
    for (const rotation of [-.72, -.24, .24, .72]) {
      ctx.beginPath()
      ctx.ellipse(0, 0, radius, radius * .34, rotation, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(0, 0, radius * .13, 0, Math.PI * 2)
    ctx.fill()
  } else {
    for (let star = 0; star < 31; star += 1) {
      const angle = star / 31 * Math.PI * 2 - clock * .0009
      const orbit = radius * (.62 + (star % 5) * .12)
      const size = star % 6 === 0 ? 2.5 : 1.2
      ctx.fillRect(
        Math.cos(angle) * orbit - size / 2,
        Math.sin(angle) * orbit * .75 - size / 2,
        size,
        size,
      )
    }
  }

  ctx.globalAlpha = .62
  ctx.font = 'bold 5px "JetBrains Mono", monospace'
  ctx.textAlign = 'center'
  for (const [index, glyph] of definition.aura.particleGlyphs.entries()) {
    const angle = index / definition.aura.particleGlyphs.length * Math.PI * 2
      + (reducedMotion ? 0 : clock * .0016)
    const orbit = radius * (1.02 + index % 2 * .18)
    ctx.fillStyle = index % 2 ? definition.palette.primary : definition.palette.energy
    ctx.fillText(glyph, Math.cos(angle) * orbit, Math.sin(angle) * orbit * .82 + 2)
  }

  ctx.globalAlpha = .72
  ctx.font = 'bold 6px "JetBrains Mono", monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = definition.palette.auraCore
  ctx.fillText(definition.aura.glyph, 0, radius + 11)
  ctx.restore()
}

function drawHeroTransformationSkin(
  ctx: CanvasRenderingContext2D,
  definition: HeroTransformationDefinition,
  x: number,
  y: number,
  time: number,
  reducedMotion: boolean,
): void {
  const flicker = reducedMotion ? .92 : .78 + Math.sin(time * .018) * .18
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = flicker
  ctx.shadowBlur = 8
  ctx.shadowColor = definition.palette.energy

  if (definition.identity.silhouette === 'armored-prime-titan') {
    // Crown-like golden hair, armor fissures and a longer manifested blade.
    for (let spike = 0; spike < 5; spike += 1) {
      const spikeX = x - 8 + spike * 4
      ctx.fillStyle = spike % 2 ? definition.palette.auraCore : definition.palette.primary
      ctx.beginPath()
      ctx.moveTo(spikeX, y - 18)
      ctx.lineTo(spikeX + 2, y - 31 - (spike % 3) * 3)
      ctx.lineTo(spikeX + 5, y - 18)
      ctx.fill()
    }
    fillPixel(ctx, x - 10, y - 9, 3, 12, definition.palette.primary)
    fillPixel(ctx, x + 7, y - 9, 3, 12, definition.palette.primary)
    fillPixel(ctx, x - 2, y - 7, 4, 13, definition.palette.auraCore)
    ctx.strokeStyle = definition.palette.flash
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x + 9, y - 4)
    ctx.lineTo(x + 30, y - 30)
    ctx.stroke()
  } else if (definition.identity.silhouette === 'cipher-empress') {
    fillPixel(ctx, x - 8, y - 23, 3, 7, definition.palette.energy)
    fillPixel(ctx, x - 2, y - 27, 4, 11, definition.palette.auraCore)
    fillPixel(ctx, x + 5, y - 23, 3, 7, definition.palette.secondary)
    fillPixel(ctx, x - 7, y - 15, 14, 2, definition.palette.eyeGlow)
    fillPixel(ctx, x - 5, y - 7, 2, 14, definition.palette.energy)
    fillPixel(ctx, x + 3, y - 7, 2, 14, definition.palette.secondary)
    const orbit = reducedMotion ? 0 : time * .004
    for (const [label, angle, color] of [
      ['p', orbit, definition.palette.energy],
      ['q', orbit + Math.PI, definition.palette.eyeGlow],
    ] as const) {
      const keyX = x + Math.cos(angle) * 22
      const keyY = y - 5 + Math.sin(angle) * 12
      ctx.fillStyle = color
      ctx.font = 'bold 8px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(label, keyX, keyY)
    }
  } else if (definition.identity.silhouette === 'residue-horizon-hunter') {
    ctx.strokeStyle = definition.palette.energy
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y - 8, 18, -.4, Math.PI * 1.7)
    ctx.stroke()
    ctx.strokeStyle = definition.palette.primary
    ctx.beginPath()
    ctx.moveTo(x - 6, y - 7)
    ctx.lineTo(x - 30, y + 2)
    ctx.lineTo(x - 42, y - 3)
    ctx.stroke()
    fillPixel(ctx, x - 6, y - 16, 4, 2, definition.palette.eyeGlow)
    fillPixel(ctx, x + 2, y - 16, 4, 2, definition.palette.eyeGlow)
    for (let residue = 0; residue < 5; residue += 1) {
      fillPixel(ctx, x - 28 - residue * 7, y + 8 - (residue % 2) * 4, 3, 2, definition.palette.energy)
    }
  } else if (definition.identity.silhouette === 'mobius-null-assassin') {
    ctx.strokeStyle = definition.palette.energy
    ctx.lineWidth = 2
    for (const rotation of [-.55, .55]) {
      ctx.beginPath()
      ctx.ellipse(x, y - 6, 23, 8, rotation, 0, Math.PI * 2)
      ctx.stroke()
    }
    for (const side of [-1, 1]) {
      ctx.strokeStyle = side < 0 ? definition.palette.energy : definition.palette.primary
      ctx.beginPath()
      ctx.moveTo(x + side * 5, y - 4)
      ctx.lineTo(x + side * 29, y - 20)
      ctx.stroke()
    }
    fillPixel(ctx, x - 6, y - 16, 4, 2, definition.palette.eyeGlow)
    fillPixel(ctx, x + 2, y - 16, 4, 2, definition.palette.eyeGlow)
  } else if (definition.identity.silhouette === 'goldbach-paired-colossus') {
    for (const side of [-1, 1]) {
      ctx.fillStyle = side < 0 ? definition.palette.primary : definition.palette.energy
      ctx.beginPath()
      ctx.arc(x + side * 15, y - 3, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = definition.palette.flash
      ctx.lineWidth = 2
      ctx.stroke()
    }
    for (let spike = 0; spike < 5; spike += 1) {
      const spikeX = x - 8 + spike * 4
      ctx.fillStyle = spike % 2 ? definition.palette.primary : definition.palette.energy
      ctx.beginPath()
      ctx.moveTo(spikeX, y - 17)
      ctx.lineTo(spikeX + 2, y - 29 - (spike % 2) * 4)
      ctx.lineTo(spikeX + 5, y - 17)
      ctx.fill()
    }
    fillPixel(ctx, x - 6, y - 16, 4, 2, definition.palette.eyeGlow)
    fillPixel(ctx, x + 2, y - 16, 4, 2, definition.palette.eyeGlow)
  } else if (definition.identity.silhouette === 'sieve-prime-engineer') {
    ctx.strokeStyle = definition.palette.energy
    ctx.lineWidth = 2
    for (let line = -2; line <= 2; line += 1) {
      ctx.beginPath()
      ctx.moveTo(x - 22, y - 7 + line * 6)
      ctx.lineTo(x + 22, y - 7 + line * 6)
      ctx.stroke()
    }
    for (const side of [-1, 1]) {
      fillPixel(ctx, x + side * 16 - 4, y - 12, 8, 17, definition.palette.primary)
      fillPixel(ctx, x + side * 17 - 2, y - 8, 4, 4, definition.palette.auraCore)
    }
    fillPixel(ctx, x - 7, y - 17, 14, 3, definition.palette.eyeGlow)
  } else if (definition.identity.silhouette === 'elliptic-infinity-seer') {
    ctx.strokeStyle = definition.palette.energy
    ctx.lineWidth = 2
    for (const rotation of [-.7, -.25, .25, .7]) {
      ctx.beginPath()
      ctx.ellipse(x, y - 6, 27, 9, rotation, 0, Math.PI * 2)
      ctx.stroke()
    }
    const orbit = reducedMotion ? 0 : time * .003
    for (let point = 0; point < 5; point += 1) {
      const angle = orbit + point * Math.PI * 2 / 5
      fillPixel(
        ctx,
        x + Math.cos(angle) * 24 - 2,
        y - 6 + Math.sin(angle) * 15 - 2,
        4,
        4,
        point === 4 ? definition.palette.flash : definition.palette.primary,
      )
    }
    fillPixel(ctx, x - 6, y - 16, 4, 2, definition.palette.eyeGlow)
    fillPixel(ctx, x + 2, y - 16, 4, 2, definition.palette.eyeGlow)
  } else {
    ctx.strokeStyle = definition.palette.primary
    ctx.lineWidth = 3
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(x + side * 6, y - 7)
      ctx.quadraticCurveTo(x + side * 27, y - 29, x + side * 38, y - 4)
      ctx.quadraticCurveTo(x + side * 24, y - 9, x + side * 10, y + 7)
      ctx.stroke()
    }
    for (let crown = 0; crown < 5; crown += 1) {
      const angle = crown / 5 * Math.PI * 2 - Math.PI / 2
      fillPixel(
        ctx,
        x + Math.cos(angle) * 13 - 2,
        y - 23 + Math.sin(angle) * 5 - 2,
        4,
        4,
        crown % 2 ? definition.palette.energy : definition.palette.flash,
      )
    }
    fillPixel(ctx, x - 5, y - 16, 3, 2, definition.palette.eyeGlow)
    fillPixel(ctx, x + 2, y - 16, 3, 2, definition.palette.eyeGlow)
  }
  ctx.restore()
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  time: number,
  cinematic: CinematicProgress | null,
  heroClass: HeroClassDefinition,
  ascended: boolean,
  primeChainCount: number,
  reducedMotion: boolean,
  transformation: HeroTransformationDefinition | null,
) {
  const x = Math.round(player.x)
  const y = Math.round(player.y)
  const direction = directionVector(player.facing)
  const attacking = time < player.attackUntilMs
  const dashing = time < player.dashUntilMs
  const defenseStatus = getDefenseStatus(player.defense, time)
  const moving = time - player.lastMoveAtMs < 100
  const casting = Boolean(cinematic)
  const pose: HeroRenderPose = {
    time,
    moving,
    attacking,
    dashing,
    casting,
    ascended: ascended || Boolean(transformation),
  }
  const blink = !cinematic && time < player.invulnerableUntilMs && Math.floor(time / 70) % 2 === 0
  if (blink) ctx.globalAlpha = 0.38

  const auraStrength = ascended
    ? 1
    : cinematic
      ? .35 + cinematic.chargeProgress * .65
      : primeChainCount >= 5 ? .2 : 0
  if (transformation) {
    drawHeroTransformationAura(ctx, transformation, x, y, time, reducedMotion)
  }
  drawHeroAnimeAura(ctx, heroClass, x, y, time, transformation ? 1 : auraStrength, reducedMotion)

  if (transformation && moving && !reducedMotion) {
    const trailCount = Math.min(
      9,
      Math.max(transformation.aura.trailLength, transformation.cinematic.afterimageCount),
    )
    for (let index = trailCount; index > 0; index -= 1) {
      ctx.save()
      ctx.globalAlpha = .025 + (trailCount - index) * .014
      ctx.globalCompositeOperation = 'lighter'
      drawHeroBody(
        ctx,
        heroClass,
        x - direction.x * index * 5,
        y - direction.y * index * 5,
        player.facing,
        { ...pose, ascended: true },
      )
      ctx.restore()
    }
  }

  if (dashing) {
    for (let index = 3; index > 0; index -= 1) {
      ctx.save()
      ctx.globalAlpha = 0.055 * index
      ctx.globalCompositeOperation = 'lighter'
      drawHeroBody(
        ctx,
        heroClass,
        x - direction.x * index * 7,
        y - direction.y * index * 7,
        player.facing,
        { ...pose, ascended: true },
      )
      ctx.restore()
    }
    ctx.globalAlpha = blink ? 0.38 : 1
  }

  drawShadow(ctx, x, y + 8, 8)
  if (defenseStatus === 'parry' || defenseStatus === 'guard') {
    const shieldDistance = defenseStatus === 'parry' ? 16 : 14
    const shieldX = x + direction.x * shieldDistance
    const shieldY = y + direction.y * shieldDistance
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = defenseStatus === 'parry' ? .96 : .62
    ctx.strokeStyle = defenseStatus === 'parry' ? heroClass.palette.accent : heroClass.palette.energy
    ctx.lineWidth = defenseStatus === 'parry' ? 4 : 3
    ctx.beginPath()
    ctx.arc(shieldX, shieldY, defenseStatus === 'parry' ? 13 : 11, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = defenseStatus === 'parry' ? heroClass.palette.accent : heroClass.palette.energy
    ctx.font = 'bold 7px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(defenseStatus === 'parry' ? 'P' : 'Q', shieldX, shieldY + 3)
    ctx.restore()
  }
  if (time < player.classDefenseUntilMs) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = .72
    ctx.strokeStyle = heroClass.palette.energy
    ctx.fillStyle = heroClass.palette.accent
    ctx.lineWidth = 2
    if (heroClass.archetype === 'cryptographer') {
      for (let line = -2; line <= 2; line += 1) {
        ctx.strokeRect(x - 27 + Math.abs(line) * 2, y - 26 + line * 9, 54 - Math.abs(line) * 4, 7)
      }
      ctx.font = 'bold 6px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText('RSA FIREWALL', x, y - 31)
    } else if (heroClass.archetype === 'assassin') {
      ctx.setLineDash([3, 5])
      ctx.beginPath()
      ctx.ellipse(x, y - 3, 31, 13, .5, 0, Math.PI * 2)
      ctx.ellipse(x, y - 3, 31, 13, -.5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.font = 'bold 7px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText('μ = 0', x, y - 32)
    } else if (heroClass.archetype === 'engineer') {
      for (let line = -3; line <= 3; line += 1) {
        ctx.beginPath()
        ctx.moveTo(x - 29, y - 3 + line * 7)
        ctx.lineTo(x + 29, y - 3 + line * 7)
        ctx.stroke()
      }
      ctx.font = 'bold 6px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText('CRIVO ATIVO', x, y - 32)
    } else if (heroClass.archetype === 'oracle') {
      for (const rotation of [-.6, .6]) {
        ctx.beginPath()
        ctx.ellipse(x, y - 3, 30, 13, rotation, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.font = 'bold 7px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText('𝒪', x, y - 32)
    } else if (heroClass.archetype === 'berserker') {
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(x + side * 12, y - 3, 15, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.font = 'bold 6px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText('p + q', x, y - 32)
    } else {
      ctx.beginPath()
      ctx.arc(x, y - 3, 27, 0, Math.PI * 2)
      ctx.stroke()
      ctx.save()
      ctx.translate(x, y - 3)
      ctx.rotate(reducedMotion ? Math.PI / 4 : time * .004)
      ctx.strokeRect(-18, -18, 36, 36)
      ctx.restore()
      ctx.font = 'bold 7px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText('2ᵖ−1', x, y - 32)
    }
    ctx.restore()
  }
  drawHeroBody(ctx, heroClass, x, y, player.facing, pose)
  if (transformation) {
    drawHeroTransformationSkin(ctx, transformation, x, y, time, reducedMotion)
  }
  if (cinematic) {
    const eyeIntensity = cinematic.phase === 'aftermath'
      ? 1 - cinematic.phaseProgress
      : Math.min(1, cinematic.chargeProgress * 1.9 + .12)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = eyeIntensity
    ctx.shadowBlur = 10 + eyeIntensity * 8
    ctx.shadowColor = '#ff182f'
    const eyeBob = reducedMotion ? 0 : moving && Math.floor(time / 88) % 2 ? 1 : casting ? -2 : 0
    fillPixel(ctx, x - 4, y - 15 + eyeBob, 3, 2, '#ff1838')
    fillPixel(ctx, x + 2, y - 15 + eyeBob, 3, 2, '#ff1838')
    fillPixel(ctx, x - 2, y - 14 + eyeBob, 4, 1, '#ff8a6c')
    ctx.restore()
  } else if (ascended || transformation) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = reducedMotion ? .8 : .62 + Math.sin(time * .02) * .25
    ctx.shadowBlur = 10
    ctx.shadowColor = transformation?.palette.eyeGlow ?? heroClass.palette.energy
    fillPixel(ctx, x - 5, y - 15, 3, 2, transformation?.palette.eyeGlow ?? '#ffffff')
    fillPixel(ctx, x + 2, y - 15, 3, 2, transformation?.palette.eyeGlow ?? heroClass.palette.energy)
    ctx.restore()
  }
  drawHeroWeapon(ctx, heroClass, player, x, y, direction, attacking, time, cinematic)
  ctx.globalAlpha = 1
}

function drawNpc(ctx: CanvasRenderingContext2D, npcId: PrimeboundNpcId, position: Vec2, time: number, spoken: boolean) {
  const x = Math.round(position.x)
  const y = Math.round(position.y)
  const bob = Math.sin(time * 0.003 + x) > 0.4 ? 1 : 0
  drawShadow(ctx, x, y + 8, 8)
  if (npcId === 'seris') {
    fillPixel(ctx, x - 7, y - 4 + bob, 14, 15, '#315b48')
    fillPixel(ctx, x - 5, y - 9 + bob, 10, 8, '#d0b57d')
    fillPixel(ctx, x - 7, y - 11 + bob, 14, 5, '#d8dde0')
    fillPixel(ctx, x - 9, y - 8 + bob, 4, 12, '#c5d2d0')
    fillPixel(ctx, x + 5, y - 8 + bob, 4, 12, '#c5d2d0')
  } else if (npcId === 'orun') {
    fillPixel(ctx, x - 7, y - 3 + bob, 14, 14, '#51436f')
    fillPixel(ctx, x - 5, y - 10 + bob, 10, 9, '#b68e65')
    fillPixel(ctx, x - 7, y - 11 + bob, 14, 4, '#2e263d')
    fillPixel(ctx, x + 7, y - 2 + bob, 2, 14, '#9c8355')
  } else if (npcId === 'lyra') {
    fillPixel(ctx, x - 8, y - 4 + bob, 16, 15, '#1f6573')
    fillPixel(ctx, x - 5, y - 11 + bob, 10, 9, '#c89268')
    fillPixel(ctx, x - 8, y - 13 + bob, 16, 5, '#7ce4e5')
    fillPixel(ctx, x - 10, y - 8 + bob, 4, 15, '#387f8e')
    fillPixel(ctx, x + 7, y - 5 + bob, 5, 3, '#d8fbf4')
    fillPixel(ctx, x + 10, y - 9 + bob, 2, 12, '#71cbd2')
  } else if (npcId === 'sophia') {
    fillPixel(ctx, x - 8, y - 4 + bob, 16, 15, '#7a3529')
    fillPixel(ctx, x - 5, y - 11 + bob, 10, 9, '#b97958')
    fillPixel(ctx, x - 7, y - 13 + bob, 14, 5, '#cf7440')
    fillPixel(ctx, x - 10, y - 2 + bob, 4, 12, '#ab5635')
    fillPixel(ctx, x + 7, y - 4 + bob, 5, 5, '#efb35d')
    fillPixel(ctx, x + 9, y - 8 + bob, 2, 18, '#70402d')
  } else if (npcId === 'theon') {
    fillPixel(ctx, x - 9, y - 5 + bob, 18, 16, '#215c45')
    fillPixel(ctx, x - 5, y - 12 + bob, 10, 9, '#be8d66')
    fillPixel(ctx, x - 8, y - 15 + bob, 16, 5, '#83e6b5')
    fillPixel(ctx, x - 11, y - 5 + bob, 4, 14, '#123a2c')
    fillPixel(ctx, x + 8, y - 9 + bob, 2, 19, '#a9ffd5')
    for (let mark = 0; mark < 3; mark += 1) {
      fillPixel(ctx, x + 11 + mark * 3, y - 8 + mark * 4 + bob, 2, 2, mark === 1 ? '#17392e' : '#72efb4')
    }
  } else if (npcId === 'aurea') {
    fillPixel(ctx, x - 9, y - 5 + bob, 18, 16, '#6a3c78')
    fillPixel(ctx, x - 5, y - 12 + bob, 10, 9, '#c58a68')
    fillPixel(ctx, x - 8, y - 15 + bob, 16, 5, '#f0b65f')
    fillPixel(ctx, x - 11, y - 4 + bob, 5, 14, '#40224e')
    fillPixel(ctx, x + 7, y - 4 + bob, 5, 14, '#40224e')
    fillPixel(ctx, x - 14, y - 7 + bob, 5, 5, '#ff92d5')
    fillPixel(ctx, x + 10, y - 7 + bob, 5, 5, '#ffd37d')
    fillPixel(ctx, x - 9, y - 6 + bob, 18, 1, '#ffbadf')
  } else {
    fillPixel(ctx, x - 9, y - 5 + bob, 18, 16, '#29466f')
    fillPixel(ctx, x - 5, y - 12 + bob, 10, 9, '#aa795a')
    fillPixel(ctx, x - 8, y - 16 + bob, 16, 6, '#d8e8ff')
    fillPixel(ctx, x - 11, y - 3 + bob, 4, 14, '#162844')
    fillPixel(ctx, x + 8, y - 8 + bob, 2, 19, '#8fb8ff')
    ctx.strokeStyle = '#b9d7ff'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(x + 9, y - 11 + bob, 5, 0, Math.PI * 2)
    ctx.stroke()
    fillPixel(ctx, x + 8, y - 12 + bob, 3, 3, '#e8f3ff')
  }
  if (!spoken) {
    fillPixel(ctx, x - 3, y - 23 + bob, 6, 8, '#f2c15c')
    fillPixel(ctx, x - 1, y - 21 + bob, 2, 4, '#2a1f13')
  }
}

function drawEnemyPrimeSkin(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyState,
  time: number,
  flash: boolean,
): void {
  const x = Math.round(enemy.x)
  const y = Math.round(enemy.y)
  const definition = PRIMEBOUND_ENEMIES[enemy.id]
  const family = ENEMY_PRIME_POWERS[definition.primeFamily]
  ctx.save()
  ctx.globalCompositeOperation = flash ? 'source-over' : 'lighter'
  ctx.lineWidth = 1

  if (enemy.id === 'echo-moth') {
    ctx.strokeStyle = family.color
    ctx.lineWidth = 2
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(x + side * 8, y - 9)
      ctx.quadraticCurveTo(x + side * 25, y - 19, x + side * 20, y + 4)
      ctx.quadraticCurveTo(x + side * 18, y + 13, x + side * 7, y + 5)
      ctx.stroke()
    }
    for (let echo = 0; echo < 3; echo += 1) {
      fillPixel(ctx, x - 4 + echo * 4, y - 5 + echo * 4, 3, 3, '#d9ffbb')
    }
  } else if (enemy.id === 'fifteen-knight') {
    ctx.strokeStyle = family.color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x - 17, y + 8)
    ctx.lineTo(x + 15, y - 17)
    ctx.stroke()
    for (let link = 0; link < 4; link += 1) {
      const linkX = x - 12 + link * 8
      const linkY = y + 3 - link * 6
      ctx.strokeRect(linkX - 3, linkY - 3, 6, 6)
    }
    fillPixel(ctx, x + 12, y - 20, 5, 5, '#efe5ff')
  } else if (enemy.id === 'twenty-five-duelist') {
    ctx.strokeStyle = family.color
    ctx.lineWidth = 2
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(x + side * 5, y + 10)
      ctx.lineTo(x - side * 18, y - 16)
      ctx.lineTo(x - side * 13, y - 14)
      ctx.stroke()
      fillPixel(ctx, x + side * 11 - 2, y - 2, 4, 4, side < 0 ? '#fff0a8' : family.color)
    }
  } else if (enemy.id === 'seventy-five-smith') {
    const spokes = enemy.bossPhase === 3 ? 13 : enemy.bossPhase === 2 ? 7 : 3
    ctx.strokeStyle = family.color
    ctx.lineWidth = 1.5
    for (let spoke = 0; spoke < spokes; spoke += 1) {
      const angle = spoke / spokes * Math.PI * 2 + time * .0007
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(angle) * 13, y - 3 + Math.sin(angle) * 13)
      ctx.lineTo(x + Math.cos(angle) * 20, y - 3 + Math.sin(angle) * 20)
      ctx.stroke()
    }
    fillPixel(ctx, x + 13, y - 7, 5, 19, '#d7a06f')
    fillPixel(ctx, x + 8, y - 11, 15, 7, '#ffbc72')
  } else if (enemy.id === 'thirty-five-sieve') {
    ctx.strokeStyle = '#72efb4'
    ctx.beginPath()
    ctx.arc(x - 10, y - 4, 10, -1.2, 1.15)
    ctx.stroke()
    fillPixel(ctx, x - 15, y + 4, 16, 2, '#b5ffda')
    fillPixel(ctx, x - 4, y - 11, 3, 15, '#237e59')
  } else if (enemy.id === 'seventy-seven-sentinel') {
    ctx.strokeStyle = '#a8ffd5'
    ctx.strokeRect(x - 10, y - 11, 20, 20)
    for (let mark = -6; mark <= 6; mark += 6) {
      fillPixel(ctx, x + mark - 1, y - 1, 3, 3, mark === 0 ? '#172f28' : '#72efb4')
    }
  } else if (enemy.id === 'twenty-two-pair' || enemy.id === 'twenty-six-pair') {
    const isTwentyTwo = enemy.id === 'twenty-two-pair'
    const main = isTwentyTwo ? '#ff92d5' : '#ffd37d'
    const other = isTwentyTwo ? '#ffd37d' : '#ff92d5'
    ctx.strokeStyle = main
    ctx.beginPath()
    ctx.arc(x - 8, y - 3, 6, 0, Math.PI * 2)
    ctx.arc(x + 8, y - 3, 6, 0, Math.PI * 2)
    ctx.stroke()
    fillPixel(ctx, x - 10, y - 5, 4, 4, main)
    fillPixel(ctx, x + 6, y - 5, 4, 4, other)
    fillPixel(ctx, x - 5, y - 3, 10, 1, '#fff0b5')
  } else if (enemy.id === 'one-forty-three-judge') {
    ctx.strokeStyle = '#8fb8ff'
    ctx.beginPath()
    ctx.arc(x, y - 6, 13, Math.PI, Math.PI * 2)
    ctx.stroke()
    fillPixel(ctx, x - 13, y - 8, 3, 3, '#d9e9ff')
    fillPixel(ctx, x + 11, y - 8, 3, 3, '#d9e9ff')
    fillPixel(ctx, x - 1, y - 18, 3, 5, '#8fb8ff')
  } else if (enemy.id === 'one-sixty-nine-congruence') {
    const orbit = 12 + Math.sin(time * .006) * 2
    ctx.strokeStyle = '#8fb8ff'
    ctx.beginPath()
    ctx.ellipse(x, y - 3, orbit, 5, time * .001, 0, Math.PI * 2)
    ctx.stroke()
    const angle = time * .004
    fillPixel(ctx, x + Math.cos(angle) * orbit - 2, y - 5 + Math.sin(angle) * 5, 4, 4, '#edf5ff')
  } else if (enemy.id === 'twenty-one-idol') {
    ctx.strokeStyle = '#f2c15c'
    ctx.beginPath()
    ctx.moveTo(x, y - 16)
    ctx.lineTo(x + 12, y + 5)
    ctx.lineTo(x - 12, y + 5)
    ctx.closePath()
    ctx.stroke()
  }

  if (definition.encounterRank !== 'minion') {
    const crownPulse = .66 + Math.sin(time * .009) * .22
    ctx.globalAlpha = crownPulse
    ctx.strokeStyle = family.color
    ctx.lineWidth = definition.encounterRank === 'final-boss' ? 2 : 1.5
    ctx.beginPath()
    ctx.arc(x, y - 3, enemy.radius + 7, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x - 10, y - enemy.radius - 5)
    ctx.lineTo(x - 6, y - enemy.radius - 12)
    ctx.lineTo(x, y - enemy.radius - 7)
    ctx.lineTo(x + 6, y - enemy.radius - 12)
    ctx.lineTo(x + 10, y - enemy.radius - 5)
    ctx.stroke()
    for (let phase = 1; phase <= 3; phase += 1) {
      fillPixel(
        ctx,
        x + (phase - 2) * 7 - 2,
        y + enemy.radius + 9,
        4,
        3,
        phase <= enemy.bossPhase ? family.color : '#27303a',
      )
    }
  }
  ctx.restore()
}

/** Distinct prime factors of a guardian's number: the grammar of its regalia. */
function distinctPrimeFactors(value: number): number[] {
  const factors: number[] = []
  let rest = Math.max(2, Math.floor(value))
  for (let divisor = 2; divisor * divisor <= rest; divisor += 1) {
    if (rest % divisor !== 0) continue
    factors.push(divisor)
    while (rest % divisor === 0) rest /= divisor
  }
  if (rest > 1) factors.push(rest)
  return factors
}

const GUARDIAN_PALETTES: readonly { readonly crown: string; readonly aura: string }[] = [
  { crown: '#ffd06a', aura: '#f2c15c' },
  { crown: '#8be2ff', aura: '#4fb7e0' },
  { crown: '#ff9a76', aura: '#e06a4f' },
  { crown: '#b6ff8b', aura: '#6fe04f' },
  { crown: '#d79bff', aura: '#a44fe0' },
  { crown: '#ff8bb5', aura: '#e04f86' },
]

/**
 * No two guardians look alike: the crown carries one spike per distinct prime
 * factor of its number, the orbit writes the factorisation itself, and the palette
 * rotates per boss. The final boss burns white above all of it.
 */
function drawGuardianRegalia(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyState,
  definition: (typeof PRIMEBOUND_ENEMIES)[PrimeboundEnemyId],
  time: number,
) {
  const x = Math.round(enemy.x)
  const y = Math.round(enemy.y)
  const factors = distinctPrimeFactors(definition.number)
  const palette = definition.encounterRank === 'final-boss'
    ? { crown: '#ffffff', aura: '#ffe9a8' }
    : GUARDIAN_PALETTES[definition.number % GUARDIAN_PALETTES.length]

  // Crown: one spike per distinct prime factor, breathing with the boss phase.
  const spikes = Math.max(2, factors.length + 1)
  const crownY = y - enemy.radius - 7
  for (let spike = 0; spike < spikes; spike += 1) {
    const offset = (spike - (spikes - 1) / 2) * 7
    const height = 5 + (spike % 2) * 3 + enemy.bossPhase
    fillPixel(ctx, x + offset - 1, crownY - height, 3, height, palette.crown)
  }
  fillPixel(ctx, x - (spikes * 7) / 2 - 1, crownY, spikes * 7 + 2, 3, palette.crown)

  // Orbit: the factorisation written around the body, always turning.
  ctx.save()
  ctx.globalAlpha = 0.8
  ctx.font = '8px "JetBrains Mono", monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = palette.aura
  for (const [index, factor] of factors.entries()) {
    const angle = time * 0.0013 * (index % 2 ? -1 : 1) + index / factors.length * Math.PI * 2
    const radius = enemy.radius + 14 + index * 5
    ctx.fillText(String(factor), x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * 0.6)
  }
  ctx.restore()

  // Aura ring, heavier per phase; the final boss gets a second counter-ring.
  ctx.save()
  ctx.globalAlpha = 0.24 + enemy.bossPhase * 0.08
  ctx.strokeStyle = palette.aura
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(x, y, enemy.radius + 9 + Math.sin(time * 0.004) * 2, 0, Math.PI * 2)
  ctx.stroke()
  if (definition.encounterRank === 'final-boss') {
    ctx.beginPath()
    ctx.arc(x, y, enemy.radius + 16 + Math.cos(time * 0.003) * 3, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyState, time: number) {
  const x = Math.round(enemy.x)
  const y = Math.round(enemy.y)
  const flash = time < enemy.flashUntilMs
  const definition = PRIMEBOUND_ENEMIES[enemy.id]
  const primePower = enemyPrimePowerFor(enemy)
  drawShadow(ctx, x, y + enemy.radius * 0.65, enemy.radius * 0.9, enemy.kind === 'guardian' ? 0.55 : 0.35)
  if (enemy.kind === 'guardian') drawGuardianRegalia(ctx, enemy, definition, time)

  if (enemy.intent && time < enemy.intentUntilMs) {
    const anime = primePower.anime
    const chargeProgress = clamp(
      (time - enemy.intentStartedAtMs) /
        Math.max(1, enemy.intentUntilMs - enemy.intentStartedAtMs),
      0,
      1,
    )
    const pulse = 1 + Math.sin(time * .028) * .18 + chargeProgress * .18
    const telegraphRadius = enemy.radius + 8 + chargeProgress * (8 + enemy.bossPhase * 3)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = .34 + chargeProgress * .38
    ctx.strokeStyle = enemy.intent === 'charge' ? '#ff826c' : primePower.color
    ctx.lineWidth = enemy.bossPhase === 3 ? 2 : 1.5
    ctx.beginPath()
    ctx.arc(x, y, telegraphRadius * pulse, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, telegraphRadius * (.62 + chargeProgress * .18), 0, Math.PI * 2)
    ctx.stroke()

    const orbitCount = enemy.kind === 'guardian' ? Math.min(5, 2 + enemy.bossPhase) : 3
    for (let orbit = 0; orbit < orbitCount; orbit += 1) {
      const orbitAngle = orbit / orbitCount * Math.PI * 2 + time * .004 * (orbit % 2 ? -1 : 1)
      const orbitRadius = telegraphRadius * (1.05 + (orbit % 2) * .18)
      const orbitX = x + Math.cos(orbitAngle) * orbitRadius
      const orbitY = y + Math.sin(orbitAngle) * orbitRadius
      fillPixel(ctx, orbitX - 1, orbitY - 1, 3, 3, orbit % 2 ? anime.flashColor : primePower.color)
    }

    const streakCount = enemy.kind === 'guardian' ? Math.min(7, anime.rayCount) : 4
    ctx.globalAlpha = .12 + chargeProgress * .3
    for (let streak = 0; streak < streakCount; streak += 1) {
      const streakAngle = streak / streakCount * Math.PI * 2 - time * .001
      const outerRadius = telegraphRadius * (1.7 + (streak % 3) * .18)
      ctx.beginPath()
      ctx.moveTo(
        x + Math.cos(streakAngle) * outerRadius,
        y + Math.sin(streakAngle) * outerRadius,
      )
      ctx.lineTo(
        x + Math.cos(streakAngle) * telegraphRadius * 1.12,
        y + Math.sin(streakAngle) * telegraphRadius * 1.12,
      )
      ctx.stroke()
    }

    if (enemy.intentTarget) {
      const targetX = Math.round(enemy.intentTarget.x)
      const targetY = Math.round(enemy.intentTarget.y)
      ctx.globalAlpha = .26 + chargeProgress * .38
      ctx.setLineDash([3, 4])
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(targetX, targetY)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.arc(targetX, targetY, 7 + chargeProgress * 5, 0, Math.PI * 2)
      ctx.moveTo(targetX - 14, targetY)
      ctx.lineTo(targetX + 14, targetY)
      ctx.moveTo(targetX, targetY - 14)
      ctx.lineTo(targetX, targetY + 14)
      ctx.stroke()
    }

    ctx.globalAlpha = .78
    ctx.fillStyle = primePower.color
    ctx.font = 'bold 6px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(
      `${enemy.kind === 'guardian' ? anime.techniqueName : primePower.shortName} · F${primePower.phase}`,
      x,
      y - enemy.radius - 22,
    )
    ctx.fillStyle = '#fff0cb'
    ctx.font = 'bold 5px "JetBrains Mono", monospace'
    ctx.fillText(anime.glyph, x, y - enemy.radius - 15)
    ctx.restore()
  } else if (time < enemy.stunnedUntilMs) {
    ctx.fillStyle = '#8cf4ee'
    ctx.font = 'bold 7px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('2 · 3 · 5', x, y - enemy.radius - 16)
  }

  if (!enemy.awake) ctx.globalAlpha = 0.48
  if (enemy.kind === 'crawler') {
    fillPixel(ctx, x - 9, y - 5, 18, 12, flash ? '#fff5d2' : '#538448')
    fillPixel(ctx, x - 6, y - 9, 12, 7, flash ? '#ffffff' : '#79ae58')
    fillPixel(ctx, x - 6, y + 6, 4, 4, '#283c27')
    fillPixel(ctx, x + 3, y + 6, 4, 4, '#283c27')
    fillPixel(ctx, x - 4, y - 6, 2, 2, '#e4f5a7')
    fillPixel(ctx, x + 3, y - 6, 2, 2, '#e4f5a7')
  } else if (enemy.kind === 'caster') {
    const hover = Math.sin(time * 0.006 + x) * 2
    fillPixel(ctx, x - 8, y - 7 + hover, 16, 15, flash ? '#fff5d2' : '#51477e')
    fillPixel(ctx, x - 11, y - 3 + hover, 4, 10, '#312a58')
    fillPixel(ctx, x + 7, y - 3 + hover, 4, 10, '#312a58')
    fillPixel(ctx, x - 4, y - 5 + hover, 8, 5, flash ? '#ffffff' : '#9c8be0')
    fillPixel(ctx, x - 3, y - 3 + hover, 2, 2, '#f2c15c')
    fillPixel(ctx, x + 2, y - 3 + hover, 2, 2, '#f2c15c')
  } else if (enemy.kind === 'charger') {
    fillPixel(ctx, x - 8, y - 7, 16, 17, flash ? '#fff5d2' : '#6c3841')
    fillPixel(ctx, x - 7, y - 12, 14, 8, flash ? '#ffffff' : '#8d9296')
    fillPixel(ctx, x - 9, y - 10, 3, 10, '#c0c4be')
    fillPixel(ctx, x + 6, y - 10, 3, 10, '#c0c4be')
    fillPixel(ctx, x - 4, y - 8, 8, 2, '#241b22')
    fillPixel(ctx, x + 8, y - 3, 8, 3, '#d8d4bd')
  } else {
    fillPixel(ctx, x - 16, y - 13, 32, 29, flash ? '#fff7d3' : '#332a2a')
    fillPixel(ctx, x - 13, y - 20, 26, 11, flash ? '#ffffff' : '#80613a')
    fillPixel(ctx, x - 18, y - 15, 6, 20, '#6b4b2d')
    fillPixel(ctx, x + 12, y - 15, 6, 20, '#6b4b2d')
    fillPixel(ctx, x - 8, y - 16, 16, 5, '#151218')
    fillPixel(ctx, x - 6, y - 14, 4, 2, '#ff6b58')
    fillPixel(ctx, x + 2, y - 14, 4, 2, '#ff6b58')
    fillPixel(ctx, x - 10, y + 3, 20, 4, '#b78a45')
  }
  drawEnemyPrimeSkin(ctx, enemy, time, flash)
  ctx.globalAlpha = 1

  ctx.font = `${enemy.kind === 'guardian' ? 10 : 8}px "JetBrains Mono", monospace`
  ctx.textAlign = 'center'
  ctx.fillStyle = enemy.kind === 'guardian' ? '#ffd06a' : '#f5efda'
  ctx.fillText(String(definition.number), x, y - enemy.radius - (enemy.kind === 'guardian' ? 12 : 6))

  if (enemy.hp < enemy.maxHp || enemy.kind === 'guardian') {
    const width = enemy.kind === 'guardian' ? 38 : 22
    fillPixel(ctx, x - width / 2, y + enemy.radius + 5, width, 3, '#1a1418')
    fillPixel(ctx, x - width / 2, y + enemy.radius + 5, width * (enemy.hp / enemy.maxHp), 3, enemy.kind === 'guardian' ? '#f2c15c' : '#d85d68')
  }
}

/**
 * The blessing shrine: a stone pedestal with an orbiting pair of prime glyphs.
 * Spent shrines go dark — one blessing per region, no farming.
 */
function drawShrine(ctx: CanvasRenderingContext2D, position: Vec2, time: number, spent: boolean): void {
  const x = Math.round(position.x)
  const y = Math.round(position.y)
  drawShadow(ctx, x, y + 12, 14, 0.35)
  fillPixel(ctx, x - 10, y - 4, 20, 14, spent ? '#4a4438' : '#6b6250')
  fillPixel(ctx, x - 7, y - 16, 14, 12, spent ? '#57503f' : '#7d7259')
  fillPixel(ctx, x - 4, y - 24, 8, 8, spent ? '#635a45' : '#8f8264')
  if (!spent) {
    const pulse = 0.6 + Math.sin(time * 0.005) * 0.4
    ctx.save()
    ctx.globalAlpha = 0.55 * pulse
    ctx.fillStyle = '#ffd97a'
    ctx.beginPath()
    ctx.arc(x, y - 30, 5 + pulse * 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 0.9
    ctx.font = '9px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    for (const [index, glyph] of ['2', '3'].entries()) {
      const angle = time * 0.0016 + index * Math.PI
      ctx.fillText(glyph, x + Math.cos(angle) * 16, y - 28 + Math.sin(angle) * 6)
    }
    ctx.restore()
  }
}

function drawRune(ctx: CanvasRenderingContext2D, position: Vec2, value: PrimeRuneValue, time: number) {
  const x = Math.round(position.x)
  const y = Math.round(position.y + Math.sin(time * 0.004) * 3)
  const pulse = 10 + Math.sin(time * 0.006) * 2
  ctx.fillStyle = 'rgba(242, 193, 92, .12)'
  ctx.beginPath()
  ctx.arc(x, y, pulse + 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f2c15c'
  ctx.beginPath()
  ctx.moveTo(x, y - 11)
  ctx.lineTo(x + 8, y)
  ctx.lineTo(x, y + 11)
  ctx.lineTo(x - 8, y)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#fff1b0'
  ctx.beginPath()
  ctx.moveTo(x, y - 7)
  ctx.lineTo(x + 4, y)
  ctx.lineTo(x, y + 7)
  ctx.lineTo(x - 4, y)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#362515'
  ctx.font = 'bold 8px "JetBrains Mono", monospace'
  ctx.textAlign = 'center'
  ctx.fillText(String(value), x, y + 3)
}

function drawCinematicSigil(
  ctx: CanvasRenderingContext2D,
  state: EngineState,
  cinematic: CinematicProgress,
  reducedMotion: boolean,
  heroClass: HeroClassDefinition,
): void {
  if (!state.cinematic || cinematic.phase === 'complete' || cinematic.phase === 'idle') return
  const x = Math.round(state.cinematic.focus.x)
  const y = Math.round(state.cinematic.focus.y)
  const charge = reducedMotion ? 1 : cinematic.chargeProgress
  const entranceFade = clamp(state.cinematic.elapsedMs / 80, 0, 1)
  const fade = entranceFade * (cinematic.phase === 'aftermath' ? 1 - cinematic.phaseProgress : 1)
  const animationClock = reducedMotion ? 0 : state.cinematic.elapsedMs
  const pulse = reducedMotion ? 0 : Math.sin(animationClock * .025) * 2
  const radius = 18 + charge * (cinematic.actionId === 'prime-infinity' ? 43 : 31) + pulse

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = (.18 + charge * .64) * fade
  ctx.translate(x, y)

  if (cinematic.actionId === 'mersenne-burst') {
    ctx.rotate(animationClock * .00045)
    ctx.strokeStyle = heroClass.palette.energy
    ctx.lineWidth = 2
    for (let ring = 0; ring < 3; ring += 1) {
      ctx.globalAlpha = (.16 + charge * .45) * (1 - ring * .16) * fade
      ctx.beginPath()
      ctx.arc(0, 0, radius * (.48 + ring * .27), ring * .8, Math.PI * 1.45 + ring * .8)
      ctx.stroke()
    }
    const values = ['3', '7', '31']
    values.forEach((value, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / 3
      const pointRadius = radius * .82
      const pointX = Math.cos(angle) * pointRadius
      const pointY = Math.sin(angle) * pointRadius
      const pointColor = index === 2 ? heroClass.palette.accent : heroClass.palette.energy
      ctx.fillStyle = pointColor
      fillPixel(ctx, pointX - 2, pointY - 2, 4, 4, pointColor)
      ctx.font = 'bold 7px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(value, pointX, pointY - 6)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(pointX, pointY)
      ctx.stroke()
    })
    ctx.rotate(-animationClock * .00045)
    ctx.globalAlpha = (.45 + charge * .5) * fade
    ctx.fillStyle = heroClass.palette.energy
    ctx.font = 'bold 7px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('2^p − 1', 0, radius + 12)
  } else {
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
    ctx.strokeStyle = heroClass.palette.accent
    ctx.lineWidth = 1.5
    ctx.beginPath()
    primes.forEach((prime, index) => {
      const angle = -Math.PI / 2 + index / primes.length * Math.PI * 2 + animationClock * .00028
      const orbit = radius * (.78 + (index % 2) * .18)
      const pointX = Math.cos(angle) * orbit
      const pointY = Math.sin(angle) * orbit
      if (index === 0) ctx.moveTo(pointX, pointY)
      else ctx.lineTo(pointX, pointY)
      ctx.fillStyle = index % 2 ? heroClass.palette.accent : heroClass.palette.energy
      ctx.font = 'bold 6px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(String(prime), pointX, pointY + 2)
    })
    ctx.closePath()
    ctx.stroke()
    ctx.globalAlpha = (.28 + charge * .68) * fade
    ctx.strokeStyle = heroClass.palette.accent
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, 0, radius * .54, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = heroClass.palette.energy
    ctx.font = 'bold 17px Georgia, serif'
    ctx.fillText('∞', 0, 6)
    ctx.font = 'bold 6px "JetBrains Mono", monospace'
    ctx.fillText('(2·3·5·7·11·13) + 1', 0, radius + 12)
  }

  ctx.globalAlpha = (.28 + charge * .42) * fade
  ctx.strokeStyle = heroClass.palette.primary
  ctx.fillStyle = heroClass.palette.energy
  ctx.lineWidth = 1.5
  if (heroClass.archetype === 'cryptographer') {
    ctx.strokeRect(-radius * .42, -radius * .42, radius * .84, radius * .84)
    ctx.beginPath()
    ctx.arc(0, -2, 6, 0, Math.PI * 2)
    ctx.moveTo(0, 4)
    ctx.lineTo(0, 15)
    ctx.stroke()
    ctx.font = 'bold 5px "JetBrains Mono", monospace'
    ctx.fillText('p', -radius * .56, 2)
    ctx.fillText('q', radius * .56, 2)
  } else if (heroClass.archetype === 'ranger') {
    ctx.beginPath()
    ctx.arc(0, 0, radius * .4, 0, Math.PI * 2)
    ctx.moveTo(-radius, 0)
    ctx.lineTo(radius, 0)
    ctx.moveTo(0, -radius)
    ctx.lineTo(0, radius)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(radius * .55, -5)
    ctx.lineTo(radius * .82, 0)
    ctx.lineTo(radius * .55, 5)
    ctx.stroke()
  } else if (heroClass.archetype === 'arcanist') {
    ctx.beginPath()
    for (let point = 0; point < 8; point += 1) {
      const starAngle = -Math.PI / 2 + point * Math.PI / 4
      const starRadius = point % 2 === 0 ? radius * .76 : radius * .32
      const pointX = Math.cos(starAngle) * starRadius
      const pointY = Math.sin(starAngle) * starRadius
      if (point === 0) ctx.moveTo(pointX, pointY)
      else ctx.lineTo(pointX, pointY)
    }
    ctx.closePath()
    ctx.stroke()
  } else if (heroClass.archetype === 'assassin') {
    for (const rotation of [-.62, .62]) {
      ctx.beginPath()
      ctx.ellipse(0, 0, radius * .78, radius * .28, rotation, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.font = 'bold 6px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('−1 · 0 · +1', 0, 2)
  } else if (heroClass.archetype === 'berserker') {
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(side * radius * .42, 0, radius * .34, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.font = 'bold 6px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('p+q', 0, 2)
  } else if (heroClass.archetype === 'engineer') {
    for (let line = -2; line <= 2; line += 1) {
      ctx.beginPath()
      ctx.moveTo(-radius * .7, line * radius * .25)
      ctx.lineTo(radius * .7, line * radius * .25)
      ctx.moveTo(line * radius * .25, -radius * .7)
      ctx.lineTo(line * radius * .25, radius * .7)
      ctx.stroke()
    }
  } else if (heroClass.archetype === 'oracle') {
    for (const rotation of [-.62, 0, .62]) {
      ctx.beginPath()
      ctx.ellipse(0, 0, radius * .8, radius * .3, rotation, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.font = 'bold 8px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('𝒪', 0, 3)
  } else {
    ctx.beginPath()
    ctx.moveTo(0, -radius * .7)
    ctx.lineTo(0, radius * .55)
    ctx.moveTo(-7, radius * .27)
    ctx.lineTo(7, radius * .27)
    ctx.stroke()
  }
  ctx.restore()
}

function drawAnimeCinematicCutIn(
  ctx: CanvasRenderingContext2D,
  state: EngineState,
  cinematic: CinematicProgress,
  heroClass: HeroClassDefinition,
  reducedMotion: boolean,
  alpha: number,
): void {
  if (!state.cinematic) return
  const fromLeft = heroClass.archetype === 'warrior' ||
    heroClass.archetype === 'ranger' ||
    heroClass.archetype === 'assassin' ||
    heroClass.archetype === 'berserker'
  const isUltimate = cinematic.actionId === 'prime-infinity'
  const panelWidth = isUltimate ? 154 : 128
  const reveal = reducedMotion ? 1 : clamp(state.cinematic.elapsedMs / 190, 0, 1)
  const exit = cinematic.phase === 'aftermath' ? 1 - cinematic.phaseProgress : 1
  const offset = (1 - reveal) * panelWidth * (fromLeft ? -1 : 1)
  const left = (fromLeft ? 0 : VIEW_WIDTH - panelWidth) + offset
  const right = left + panelWidth
  const diagonal = fromLeft ? 22 : -22

  ctx.save()
  ctx.globalAlpha = alpha * exit * (isUltimate ? .94 : .84)
  ctx.beginPath()
  ctx.moveTo(left, 20)
  ctx.lineTo(right + diagonal, 20)
  ctx.lineTo(right - diagonal, VIEW_HEIGHT - 20)
  ctx.lineTo(left, VIEW_HEIGHT - 20)
  ctx.closePath()
  ctx.clip()

  const panelGradient = ctx.createLinearGradient(left, 0, right, VIEW_HEIGHT)
  panelGradient.addColorStop(0, '#02050a')
  panelGradient.addColorStop(.58, heroClass.palette.shadow)
  panelGradient.addColorStop(1, '#05070d')
  ctx.fillStyle = panelGradient
  ctx.fillRect(left - 25, 20, panelWidth + 50, VIEW_HEIGHT - 40)

  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = heroClass.palette.energy
  ctx.lineWidth = 1
  ctx.globalAlpha *= .28
  for (let line = -2; line < 12; line += 1) {
    const drift = reducedMotion ? 0 : (state.cinematic.elapsedMs * .12) % 34
    const lineY = 30 + line * 25 + drift
    ctx.beginPath()
    ctx.moveTo(left - 12, lineY + 36)
    ctx.lineTo(right + 24, lineY - 28)
    ctx.stroke()
  }

  ctx.globalAlpha = alpha * exit
  ctx.save()
  ctx.translate(left + panelWidth * .5, 151)
  ctx.scale(isUltimate ? 3.8 : 3.25, isUltimate ? 3.8 : 3.25)
  drawHeroBody(
    ctx,
    heroClass,
    0,
    0,
    fromLeft ? 'right' : 'left',
    {
      time: state.cinematic.elapsedMs,
      moving: false,
      attacking: cinematic.phase === 'release' || cinematic.phase === 'impact',
      dashing: false,
      casting: true,
      ascended: true,
    },
  )
  ctx.restore()

  const eyeY = 91
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = alpha * exit * (.55 + cinematic.chargeProgress * .45)
  const eyeGradient = ctx.createLinearGradient(left + 20, eyeY, right - 18, eyeY)
  eyeGradient.addColorStop(0, 'rgba(255, 24, 56, 0)')
  eyeGradient.addColorStop(.5, '#ff294d')
  eyeGradient.addColorStop(1, 'rgba(255, 24, 56, 0)')
  ctx.fillStyle = eyeGradient
  ctx.fillRect(left + 12, eyeY, panelWidth - 24, isUltimate ? 3 : 2)

  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = alpha * exit
  ctx.fillStyle = '#fff8e8'
  ctx.font = `900 ${isUltimate ? 10 : 8}px "Space Grotesk", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(heroClass.characterName.toUpperCase(), left + panelWidth / 2, 224)
  ctx.fillStyle = heroClass.palette.energy
  ctx.font = 'bold 5px "JetBrains Mono", monospace'
  ctx.fillText(heroClass.affinity.formula.toUpperCase(), left + panelWidth / 2, 234)
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = alpha * exit
  ctx.strokeStyle = heroClass.palette.accent
  ctx.lineWidth = isUltimate ? 3 : 2
  ctx.beginPath()
  ctx.moveTo(right + diagonal, 20)
  ctx.lineTo(right - diagonal, VIEW_HEIGHT - 20)
  ctx.stroke()
  ctx.restore()
}

function drawCinematicOverlay(
  ctx: CanvasRenderingContext2D,
  state: EngineState,
  cinematic: CinematicProgress,
  reducedMotion: boolean,
  focus: Vec2,
  heroClass: HeroClassDefinition,
  visualDarkness: number,
): void {
  if (!state.cinematic || cinematic.phase === 'idle' || cinematic.phase === 'complete') return
  const isUltimate = cinematic.actionId === 'prime-infinity'
  const definition = heroCinematicForState(state, cinematic.actionId)
  const accent = definition.visual.primary
  const secondary = definition.visual.secondary
  const phrase = cinematicPhrase(definition, cinematic)
  const timeline = getCinematicTimeline(cinematic.actionId, reducedMotion)
  const phraseStartedAtMs = cinematic.phase === 'release'
    ? timeline.chargeDurationMs
    : cinematic.phase === 'impact'
      ? timeline.impactAtMs
      : cinematic.phase === 'aftermath' ? timeline.impactEndAtMs : 0
  const phraseAge = phrase ? state.cinematic.elapsedMs - phraseStartedAtMs : 0
  const phraseAlpha = phrase ? clamp(phraseAge / (reducedMotion ? 35 : 70), 0, 1) : 0
  const entranceAlpha = clamp(state.cinematic.elapsedMs / 80, 0, 1)
  const exitAlpha = cinematic.phase === 'aftermath' ? 1 - cinematic.phaseProgress : 1
  const overlayAlpha = entranceAlpha * exitAlpha

  ctx.save()
  const veil = ctx.createRadialGradient(
    focus.x,
    focus.y,
    22,
    focus.x,
    focus.y,
    285,
  )
  veil.addColorStop(0, `rgba(${isUltimate ? '39, 24, 8' : '12, 22, 32'}, ${visualDarkness * .22})`)
  veil.addColorStop(1, `rgba(1, 3, 8, ${visualDarkness})`)
  ctx.fillStyle = veil
  ctx.globalAlpha = overlayAlpha
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

  const barHeight = reducedMotion ? 5 : Math.round(5 + visualDarkness * 19)
  ctx.fillStyle = 'rgba(1, 3, 7, .96)'
  ctx.fillRect(0, 0, VIEW_WIDTH, barHeight)
  ctx.fillRect(0, VIEW_HEIGHT - barHeight, VIEW_WIDTH, barHeight)
  fillPixel(ctx, 0, barHeight, VIEW_WIDTH, 1, accent)
  fillPixel(ctx, 0, VIEW_HEIGHT - barHeight - 1, VIEW_WIDTH, 1, accent)

  drawAnimeCinematicCutIn(
    ctx,
    state,
    cinematic,
    heroClass,
    reducedMotion,
    overlayAlpha,
  )

  ctx.globalAlpha = (.15 + cinematic.chargeProgress * .3) * overlayAlpha
  ctx.strokeStyle = accent
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(25, VIEW_HEIGHT / 2)
  ctx.lineTo(122, VIEW_HEIGHT / 2)
  ctx.moveTo(VIEW_WIDTH - 122, VIEW_HEIGHT / 2)
  ctx.lineTo(VIEW_WIDTH - 25, VIEW_HEIGHT / 2)
  ctx.stroke()

  if (phrase) {
    const releasePhrase = cinematic.phase === 'impact' || cinematic.phase === 'aftermath'
    ctx.globalAlpha = phraseAlpha * overlayAlpha
    ctx.textAlign = 'center'
    ctx.fillStyle = releasePhrase ? secondary : '#f4f1e6'
    ctx.shadowBlur = releasePhrase && !reducedMotion ? 16 : 0
    ctx.shadowColor = releasePhrase ? accent : secondary
    ctx.font = `900 ${releasePhrase ? (isUltimate ? 20 : 23) : 13}px "Space Grotesk", sans-serif`
    if (!isUltimate && releasePhrase && !reducedMotion) {
      ctx.globalAlpha = phraseAlpha * overlayAlpha * .25
      ctx.fillStyle = accent
      ctx.fillText(phrase.toUpperCase(), VIEW_WIDTH / 2 - 2, 199)
      ctx.fillStyle = secondary
      ctx.fillText(phrase.toUpperCase(), VIEW_WIDTH / 2 + 2, 199)
      ctx.globalAlpha = phraseAlpha * overlayAlpha
    }
    ctx.fillStyle = releasePhrase ? '#fff8e8' : '#f4f1e6'
    ctx.fillText(phrase.toUpperCase(), VIEW_WIDTH / 2, 198)
  }

  ctx.globalAlpha = .72 * overlayAlpha
  ctx.fillStyle = accent
  ctx.font = 'bold 6px "JetBrains Mono", monospace'
  ctx.textAlign = 'center'
  ctx.fillText(
    `${definition.title}  //  ${heroClass.affinity.formula}`.toUpperCase(),
    VIEW_WIDTH / 2,
    214,
  )

  if (!reducedMotion && cinematic.phase === 'impact' && cinematic.phaseProgress < .28) {
    const flash = (1 - cinematic.phaseProgress / .28) * (isUltimate ? .46 : .3)
    ctx.globalAlpha = flash * overlayAlpha
    ctx.fillStyle = secondary
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }
  ctx.restore()
}

function drawPerfectUltimateFinalizer(
  ctx: CanvasRenderingContext2D,
  state: EngineState,
  cinematic: CinematicProgress,
  reducedMotion: boolean,
  focus: Vec2,
  heroClass: HeroClassDefinition,
): void {
  const activeCinematic = state.cinematic
  const result = activeCinematic?.ultimateQteResult
  if (
    !activeCinematic || activeCinematic.actionId !== 'prime-infinity' ||
    !result?.perfect || (cinematic.phase !== 'impact' && cinematic.phase !== 'aftermath')
  ) return
  const perfectUltimate = getPerfectUltimate(heroClass.id)

  const timeline = getCinematicTimeline('prime-infinity', reducedMotion)
  const ageMs = Math.max(0, activeCinematic.elapsedMs - timeline.impactAtMs)
  const reveal = reducedMotion ? 1 : clamp(ageMs / 170, 0, 1)
  const fade = cinematic.phase === 'aftermath'
    ? Math.max(.12, 1 - cinematic.phaseProgress)
    : 1
  const energy = heroClass.palette.energy
  const accent = heroClass.palette.accent
  const ultimateOrigin = activeCinematic.perfectUltimateOrigin
    ?? activeCinematic.focus
  const cinematicZoom = classCinematicChannels(
    state,
    cinematic,
    reducedMotion,
  ).zoom
  const centerX = Math.round(clamp(
    focus.x + (ultimateOrigin.x - activeCinematic.focus.x) * cinematicZoom,
    48,
    VIEW_WIDTH - 48,
  ))
  const centerY = Math.round(clamp(
    focus.y + (ultimateOrigin.y - activeCinematic.focus.y) * cinematicZoom,
    48,
    VIEW_HEIGHT - 48,
  ))
  const motion = reducedMotion ? 0 : ageMs

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = reveal * fade
  ctx.translate(centerX, centerY)

  if (heroClass.archetype === 'warrior') {
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
    ctx.strokeStyle = energy
    ctx.lineWidth = 2
    primes.forEach((prime, index) => {
      const offset = (index - (primes.length - 1) / 2) * 7
      const sweep = reducedMotion ? 1 : clamp((ageMs - index * 24) / 120, 0, 1)
      ctx.globalAlpha = sweep * fade * (.4 + index * .05)
      ctx.beginPath()
      ctx.moveTo(-170 * sweep, offset + 52)
      ctx.lineTo(170 * sweep, offset - 52)
      ctx.stroke()
      ctx.fillStyle = index === primes.length - 1 ? accent : energy
      ctx.font = 'bold 6px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(String(prime), -92 + index * 20, offset - 8)
    })
    ctx.globalAlpha = reveal * fade
    ctx.fillStyle = '#fff8dc'
    ctx.font = '900 38px "Space Grotesk", sans-serif'
    ctx.fillText('31', 0, 14)
  } else if (heroClass.archetype === 'cryptographer') {
    ctx.strokeStyle = energy
    ctx.fillStyle = energy
    ctx.lineWidth = 1.5
    for (let ring = 0; ring < 3; ring += 1) {
      const radius = 34 + ring * 22 + (reducedMotion ? 0 : Math.sin(motion * .012 + ring) * 3)
      ctx.globalAlpha = reveal * fade * (.75 - ring * .14)
      ctx.strokeRect(-radius, -radius, radius * 2, radius * 2)
    }
    const pairs = ['3×5', '7×11', '11×13']
    ctx.font = 'bold 7px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    pairs.forEach((pair, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / 3 + motion * .0007
      ctx.fillText(pair, Math.cos(angle) * 57, Math.sin(angle) * 42 + 2)
    })
    ctx.globalAlpha = reveal * fade
    ctx.fillStyle = '#fff8dc'
    ctx.font = '900 34px Georgia, serif'
    ctx.fillText('Ω', 0, 12)
  } else if (heroClass.archetype === 'ranger') {
    ctx.strokeStyle = energy
    ctx.fillStyle = accent
    ctx.lineWidth = 4
    const beam = reducedMotion ? 1 : clamp(ageMs / 230, 0, 1)
    ctx.beginPath()
    ctx.moveTo(-VIEW_WIDTH * .55 * beam, 0)
    ctx.lineTo(VIEW_WIDTH * .55 * beam, 0)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(104, 0)
    ctx.lineTo(78, -15)
    ctx.lineTo(84, 0)
    ctx.lineTo(78, 15)
    ctx.closePath()
    ctx.fill()
    ;[2, 3, 5, 7, 11].forEach((prime, index) => {
      ctx.globalAlpha = reveal * fade * .75
      ctx.font = 'bold 6px "JetBrains Mono", monospace'
      ctx.fillText(String(prime), -68 + index * 34, index % 2 ? 19 : -15)
    })
    ctx.globalAlpha = reveal * fade
    ctx.fillStyle = '#fff8dc'
    ctx.font = '900 34px "Space Grotesk", sans-serif'
    ctx.fillText('13', 118, 11)
  } else if (heroClass.archetype === 'assassin') {
    ctx.strokeStyle = energy
    ctx.lineWidth = 2
    ctx.rotate(motion * .0008)
    for (const rotation of [-.72, -.24, .24, .72]) {
      ctx.beginPath()
      ctx.ellipse(0, 0, 92 * reveal, 27 + Math.abs(rotation) * 12, rotation, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.rotate(-motion * .0008)
    ctx.fillStyle = accent
    ctx.font = '900 24px "Space Grotesk", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('−1  →  0  →  +1', 0, 8)
    ctx.globalAlpha = reveal * fade * .7
    for (let slash = -3; slash <= 3; slash += 1) {
      ctx.beginPath()
      ctx.moveTo(-120, slash * 15 + 38)
      ctx.lineTo(120, slash * 15 - 38)
      ctx.stroke()
    }
  } else if (heroClass.archetype === 'berserker') {
    ctx.strokeStyle = energy
    ctx.fillStyle = accent
    ctx.lineWidth = 5
    const collision = reducedMotion ? 1 : clamp(ageMs / 300, 0, 1)
    const separation = 125 * (1 - collision)
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(side * separation, 0, 28 + collision * 22, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = reveal * fade * collision
    for (let ray = 0; ray < 18; ray += 1) {
      const rayAngle = ray / 18 * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(rayAngle) * 20, Math.sin(rayAngle) * 20)
      ctx.lineTo(Math.cos(rayAngle) * 108, Math.sin(rayAngle) * 70)
      ctx.stroke()
    }
    ctx.fillStyle = '#fff8dc'
    ctx.font = '900 31px "Space Grotesk", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('p + q = 2n', 0, 11)
  } else if (heroClass.archetype === 'engineer') {
    ctx.strokeStyle = energy
    ctx.fillStyle = accent
    ctx.lineWidth = 1.5
    const extent = 116 * reveal
    for (let line = -5; line <= 5; line += 1) {
      const offset = line * extent / 5
      ctx.beginPath()
      ctx.moveTo(-extent, offset * .55)
      ctx.lineTo(extent, offset * .55)
      ctx.moveTo(offset, -extent * .55)
      ctx.lineTo(offset, extent * .55)
      ctx.stroke()
    }
    ctx.font = 'bold 8px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ;[2, 3, 5, 7, 11, 13].forEach((prime, index) => {
      const column = index % 3 - 1
      const row = Math.floor(index / 3) * 2 - 1
      ctx.fillText(String(prime), column * 58, row * 28 + 3)
    })
    ctx.fillStyle = '#fff8dc'
    ctx.font = '900 24px "Space Grotesk", sans-serif'
    ctx.fillText('COMPOSTOS RISCADOS', 0, 8)
  } else if (heroClass.archetype === 'oracle') {
    ctx.strokeStyle = energy
    ctx.fillStyle = accent
    ctx.lineWidth = 2.5
    ctx.rotate(reducedMotion ? 0 : motion * .00045)
    for (const rotation of [-.8, -.4, 0, .4, .8]) {
      ctx.beginPath()
      ctx.ellipse(0, 0, 108 * reveal, 34 * reveal, rotation, 0, Math.PI * 2)
      ctx.stroke()
    }
    for (let point = 0; point < 11; point += 1) {
      const pointAngle = point / 11 * Math.PI * 2
      fillPixel(ctx, Math.cos(pointAngle) * 82 - 2, Math.sin(pointAngle) * 38 - 2, 4, 4, accent)
    }
    ctx.rotate(reducedMotion ? 0 : -motion * .00045)
    ctx.fillStyle = '#fff8dc'
    ctx.font = '900 36px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('𝒪', 0, 12)
  } else {
    const points = 26
    ctx.strokeStyle = energy
    ctx.fillStyle = accent
    ctx.lineWidth = 2
    ctx.rotate(motion * .00035)
    ctx.beginPath()
    for (let point = 0; point < points; point += 1) {
      const angle = -Math.PI / 2 + point / points * Math.PI * 2
      const radius = point % 2 === 0 ? 78 : 31
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      if (point === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
    ctx.rotate(-motion * .00035)
    ;['3', '7', '31', '127'].forEach((prime, index) => {
      const angle = -Math.PI / 2 + index * Math.PI / 2
      const x = Math.cos(angle) * 56
      const y = Math.sin(angle) * 56
      fillPixel(ctx, x - 2, y - 2, 4, 4, accent)
      ctx.font = 'bold 6px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(prime, x, y - 6)
    })
    ctx.globalAlpha = reveal * fade
    ctx.fillStyle = '#fff8dc'
    ctx.font = '900 25px "Space Grotesk", sans-serif'
    ctx.fillText('8191', 0, 9)
  }
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = reveal * fade
  ctx.textAlign = 'center'
  ctx.fillStyle = energy
  ctx.font = 'bold 6px "JetBrains Mono", monospace'
  ctx.fillText('EXECUÇÃO PERFEITA', VIEW_WIDTH / 2, 43)
  ctx.fillStyle = '#fff8e8'
  ctx.font = '900 12px "Space Grotesk", sans-serif'
  ctx.fillText(perfectUltimate.name.toUpperCase(), VIEW_WIDTH / 2, 57)
  ctx.fillStyle = accent
  ctx.font = 'bold 6px "JetBrains Mono", monospace'
  ctx.fillText(`${perfectUltimate.formula}  //  ATAQUE TOTAL EM ÁREA`, VIEW_WIDTH / 2, 69)
  if (!reducedMotion && ageMs < 90) {
    ctx.globalAlpha = (1 - ageMs / 90) * .22
    ctx.fillStyle = energy
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }
  ctx.restore()
}

function facingAngle(direction: Direction): number {
  if (direction === 'right') return 0
  if (direction === 'down') return Math.PI / 2
  if (direction === 'left') return Math.PI
  return -Math.PI / 2
}

function drawEnemyProjectile(
  ctx: CanvasRenderingContext2D,
  projectile: ProjectileState,
  time: number,
  reducedMotion: boolean,
): void {
  const angle = Math.atan2(projectile.vy, projectile.vx)
  const anime = resolveEnemyPrimePowerAnimePresentation(
    projectile.familyId,
    projectile.phase,
  )
  const pulse = reducedMotion ? 1 : .82 + Math.sin(time * .018 + projectile.variant) * .18
  ctx.save()
  ctx.translate(Math.round(projectile.x), Math.round(projectile.y))
  ctx.rotate(angle)
  ctx.globalAlpha = Math.min(1, projectile.lifeMs / 180)
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = projectile.color
  ctx.fillStyle = projectile.color
  ctx.lineWidth = projectile.phase === 3 ? 1.5 : 1

  const afterimageCount = reducedMotion ? 1 : Math.min(3, anime.afterimageCount)
  for (let echo = afterimageCount; echo >= 1; echo -= 1) {
    const echoDistance = 5 + echo * (projectile.phase === 3 ? 5 : 4)
    ctx.globalAlpha = Math.min(1, projectile.lifeMs / 180) * (.055 + (afterimageCount - echo) * .025)
    if (projectile.pattern === 'goldbach-pair' || projectile.pattern === 'twin-lances') {
      ctx.strokeRect(-echoDistance - 4, projectile.variant % 2 ? 2 : -4, 4, 4)
    } else if (projectile.pattern === 'wilson-orbit') {
      ctx.beginPath()
      ctx.arc(-echoDistance, Math.sin(projectile.ageMs * .012 + echo) * 3, 2, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      fillPixel(ctx, -echoDistance, -1, Math.max(2, 5 - echo), 2, projectile.color)
    }
  }
  if (!reducedMotion && projectile.phase === 3) {
    ctx.globalAlpha = .12
    ctx.beginPath()
    ctx.moveTo(-26, -5)
    ctx.lineTo(-8, -2)
    ctx.moveTo(-24, 6)
    ctx.lineTo(-7, 2)
    ctx.stroke()
  }

  ctx.globalAlpha *= .18
  ctx.fillRect(-18 * pulse, -1, 14, 2)
  ctx.globalAlpha = Math.min(1, projectile.lifeMs / 180)

  if (projectile.pattern === 'twin-lances') {
    ctx.beginPath()
    ctx.moveTo(-8, 0)
    ctx.lineTo(7, 0)
    ctx.moveTo(7, 0)
    ctx.lineTo(2, -4)
    ctx.moveTo(7, 0)
    ctx.lineTo(2, 4)
    ctx.stroke()
    fillPixel(ctx, -1, -2, 4, 4, projectile.variant % 2 ? '#fff0a8' : projectile.color)
  } else if (projectile.pattern === 'sophie-chain') {
    ctx.rotate(reducedMotion ? Math.PI / 4 : projectile.ageMs * .006)
    ctx.strokeRect(-4, -4, 8, 8)
    ctx.rotate(reducedMotion ? -Math.PI / 4 : -projectile.ageMs * .006)
    ctx.font = 'bold 5px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(projectile.variant === 0 ? 'p' : '2p+1', 0, -7)
  } else if (projectile.pattern === 'mersenne-ring') {
    const points = 8
    ctx.beginPath()
    for (let point = 0; point < points; point += 1) {
      const pointAngle = point / points * Math.PI * 2
      const radius = point % 2 === 0 ? 6 : 2
      const pointX = Math.cos(pointAngle) * radius
      const pointY = Math.sin(pointAngle) * radius
      if (point === 0) ctx.moveTo(pointX, pointY)
      else ctx.lineTo(pointX, pointY)
    }
    ctx.closePath()
    ctx.fill()
  } else if (projectile.pattern === 'sieve-lanes') {
    fillPixel(ctx, -9, -2, 18, 4, projectile.color)
    fillPixel(ctx, -2, -6, 4, 12, '#e4fff2')
    fillPixel(ctx, -7, -5, 2, 2, '#102d22')
    fillPixel(ctx, 5, 3, 2, 2, '#102d22')
  } else if (projectile.pattern === 'goldbach-pair') {
    ctx.beginPath()
    ctx.arc(-3, 0, 4, 0, Math.PI * 2)
    ctx.arc(4, 0, 4, 0, Math.PI * 2)
    ctx.stroke()
    fillPixel(ctx, projectile.variant % 2 ? 2 : -5, -2, 4, 4, projectile.variant % 2 ? '#ffd37d' : '#ff92d5')
  } else if (projectile.pattern === 'wilson-orbit') {
    ctx.rotate(reducedMotion ? 0 : projectile.ageMs * .004 * Math.sign(projectile.angularVelocity || 1))
    ctx.beginPath()
    ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2)
    ctx.stroke()
    fillPixel(ctx, 5, -2, 4, 4, '#f0f6ff')
    fillPixel(ctx, -2, -2, 4, 4, projectile.color)
  } else {
    const size = 4 + projectile.phase
    ctx.rotate(Math.PI / 4)
    ctx.strokeRect(-size, -size, size * 2, size * 2)
    fillPixel(ctx, -2, -2, 4, 4, '#f5ffe9')
  }
  ctx.restore()
}

function drawHeroProjectile(
  ctx: CanvasRenderingContext2D,
  projectile: HeroProjectileState,
  heroClass: HeroClassDefinition,
  time: number,
  reducedMotion: boolean,
  transformation: HeroTransformationDefinition | null,
): void {
  const energy = transformation?.palette.energy ?? heroClass.palette.energy
  const accent = transformation?.palette.primary ?? heroClass.palette.accent
  const angle = Math.atan2(projectile.vy, projectile.vx)
  const pulse = reducedMotion ? 1 : .78 + Math.sin(time * .018 + projectile.id) * .22
  ctx.save()
  ctx.translate(Math.round(projectile.x), Math.round(projectile.y))
  ctx.rotate(angle)
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = Math.min(1, projectile.lifeMs / 140)
  if (projectile.isTransformationEcho) ctx.globalAlpha *= .58
  if (projectile.kind === 'mobius-blade') {
    ctx.strokeStyle = projectile.rsaMark === 2 ? accent : energy
    ctx.fillStyle = ctx.strokeStyle
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(-15, 0)
    ctx.quadraticCurveTo(0, -8 * pulse, 13, 0)
    ctx.quadraticCurveTo(0, 8 * pulse, -15, 0)
    ctx.stroke()
    ctx.font = 'bold 7px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(projectile.rsaMark === 2 ? '+1' : '−1', 0, -8)
  } else if (projectile.kind === 'sieve-bolt' || projectile.kind === 'turret-bolt') {
    ctx.strokeStyle = projectile.kind === 'turret-bolt' ? accent : energy
    ctx.fillStyle = energy
    ctx.lineWidth = projectile.kind === 'turret-bolt' ? 2.5 : 2
    ctx.strokeRect(-8, -4, 14, 8)
    for (let cell = -5; cell <= 4; cell += 3) {
      fillPixel(ctx, cell, -1, 2, 2, cell === 1 ? '#101a0d' : energy)
    }
    ctx.globalAlpha *= .38
    ctx.fillRect(-24 * pulse, -1, 14, 2)
  } else if (projectile.kind === 'elliptic-orb' || projectile.kind === 'elliptic-chain') {
    ctx.strokeStyle = projectile.kind === 'elliptic-chain' ? accent : energy
    ctx.fillStyle = projectile.kind === 'elliptic-chain' ? energy : accent
    ctx.lineWidth = 2
    ctx.rotate(reducedMotion ? 0 : time * .004)
    ctx.beginPath()
    ctx.ellipse(0, 0, 10 * pulse, 5, .55, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(0, 0, 10 * pulse, 5, -.55, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = 'bold 6px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(projectile.kind === 'elliptic-chain' ? 'P+Q' : 'P', 0, -10)
  } else if (
    projectile.kind === 'arrow' || projectile.kind === 'twin-arrow' ||
    projectile.kind === 'ricochet-arrow' || projectile.kind === 'euclid-arrow'
  ) {
    const isEuclidArrow = projectile.kind === 'euclid-arrow'
    ctx.strokeStyle = projectile.kind === 'ricochet-arrow' || isEuclidArrow
      ? accent
      : energy
    ctx.fillStyle = isEuclidArrow ? energy : accent
    ctx.lineWidth = isEuclidArrow ? 3.5 : projectile.kind === 'ricochet-arrow' ? 2.5 : 1.5
    ctx.beginPath()
    ctx.moveTo(isEuclidArrow ? -22 : -12, 0)
    ctx.lineTo(isEuclidArrow ? 11 : 7, 0)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(isEuclidArrow ? 12 : 8, 0)
    ctx.lineTo(isEuclidArrow ? 3 : 2, isEuclidArrow ? -7 : -4)
    ctx.lineTo(isEuclidArrow ? 3 : 2, isEuclidArrow ? 7 : 4)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha *= .5
    ctx.beginPath()
    ctx.moveTo((isEuclidArrow ? -38 : -20) * pulse, 0)
    ctx.lineTo(isEuclidArrow ? -15 : -8, 0)
    ctx.stroke()
    if (isEuclidArrow) {
      ctx.font = 'bold 6px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = accent
      ctx.fillText('p+1', -4, -8)
    }
  } else {
    const isP = projectile.kind === 'rsa-key-p' || projectile.rsaMark === 1
    ctx.strokeStyle = isP ? energy : accent
    ctx.fillStyle = ctx.strokeStyle
    ctx.lineWidth = 2
    ctx.rotate(reducedMotion ? Math.PI / 4 : time * .006)
    const size = projectile.kind === 'rsa-chain' ? 7 : 5
    ctx.strokeRect(-size, -size, size * 2, size * 2)
    ctx.rotate(reducedMotion ? -Math.PI / 4 : -time * .006)
    ctx.font = 'bold 6px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(projectile.rsaMark === 3 ? 'pq' : isP ? 'p' : 'q', 0, -9)
    ctx.globalAlpha *= .34
    ctx.fillRect(-18 * pulse, -1, 13, 2)
  }
  ctx.restore()
}

function drawSpellZone(
  ctx: CanvasRenderingContext2D,
  zone: SpellZoneState,
  heroClass: HeroClassDefinition,
  time: number,
  reducedMotion: boolean,
  transformation: HeroTransformationDefinition | null,
): void {
  const energy = transformation?.palette.energy ?? heroClass.palette.energy
  const accent = transformation?.palette.primary ?? heroClass.palette.accent
  const age = time - zone.startedAtMs
  const lifeProgress = clamp(age / zone.durationMs, 0, 1)
  const armed = time >= zone.armAtMs
  const pulse = reducedMotion ? .72 : .64 + Math.sin(time * .008 + zone.id) * .16
  const visualRadius = zone.kind === 'constellation'
    ? 96
    : zone.kind === 'sieve-grid' || zone.kind === 'elliptic-curve' ? 110 : zone.radius
  ctx.save()
  ctx.translate(Math.round(zone.x), Math.round(zone.y))
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = Math.max(.16, 1 - lifeProgress) * (armed ? .82 : .38)
  ctx.strokeStyle = zone.kind === 'supernova' ? accent : energy
  ctx.fillStyle = accent
  ctx.lineWidth = zone.kind === 'constellation' ? 2 : 1.5
  ctx.beginPath()
  ctx.ellipse(0, 0, visualRadius * pulse, visualRadius * pulse * .5, 0, 0, Math.PI * 2)
  ctx.stroke()
  if (zone.kind === 'glyph') {
    ctx.rotate(reducedMotion ? Math.PI / 4 : time * .0015)
    ctx.strokeRect(-zone.radius * .42, -zone.radius * .42, zone.radius * .84, zone.radius * .84)
    ctx.rotate(reducedMotion ? -Math.PI / 4 : -time * .0015)
    ctx.font = 'bold 8px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(armed ? 'p' : '·', 0, 3)
  } else if (zone.kind === 'supernova') {
    for (const [index, prime] of [3, 7, 31].entries()) {
      const ring = zone.radius * (.34 + index * .25) * pulse
      ctx.beginPath()
      ctx.arc(0, 0, ring, 0, Math.PI * 2)
      ctx.stroke()
      ctx.font = 'bold 6px "JetBrains Mono", monospace'
      ctx.fillText(String(prime), ring, -3)
    }
  } else if (zone.kind === 'sieve-turret') {
    ctx.rotate(reducedMotion ? 0 : time * .0018)
    ctx.strokeRect(-9, -9, 18, 18)
    ctx.strokeRect(-4, -4, 8, 8)
    for (let barrel = 0; barrel < 4; barrel += 1) {
      ctx.rotate(Math.PI / 2)
      ctx.beginPath()
      ctx.moveTo(9, 0)
      ctx.lineTo(18 + pulse * 7, 0)
      ctx.stroke()
    }
    ctx.font = 'bold 6px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('p', 0, 2)
  } else if (zone.kind === 'sieve-line') {
    ctx.rotate(Math.PI / 4)
    for (let line = -2; line <= 2; line += 1) {
      ctx.beginPath()
      ctx.moveTo(-zone.radius, line * 7)
      ctx.lineTo(zone.radius, line * 7)
      ctx.stroke()
    }
    ctx.rotate(-Math.PI / 4)
    ctx.font = 'bold 6px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('× kp', 0, 3)
  } else if (zone.kind === 'sieve-minefield' || zone.kind === 'sieve-grid') {
    const extent = zone.kind === 'sieve-grid' ? 90 : zone.radius
    for (let line = -extent; line <= extent; line += 18) {
      ctx.beginPath()
      ctx.moveTo(line, -extent * .55)
      ctx.lineTo(line, extent * .55)
      ctx.moveTo(-extent, line * .55)
      ctx.lineTo(extent, line * .55)
      ctx.stroke()
    }
    ;[2, 3, 5, 7].forEach((prime, index) => {
      const angle = index / 4 * Math.PI * 2 + (reducedMotion ? 0 : time * .0007)
      const orbit = Math.min(extent * .72, 54)
      ctx.fillText(String(prime), Math.cos(angle) * orbit, Math.sin(angle) * orbit * .55)
    })
  } else if (zone.kind === 'elliptic-singularity' || zone.kind === 'elliptic-curve') {
    const extent = zone.kind === 'elliptic-curve' ? 94 : zone.radius
    ctx.rotate(reducedMotion ? 0 : time * .0009)
    for (const rotation of [-.55, 0, .55]) {
      ctx.beginPath()
      ctx.ellipse(0, 0, extent * pulse, extent * pulse * .34, rotation, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.rotate(reducedMotion ? 0 : -time * .0009)
    ctx.font = 'bold 7px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(zone.kind === 'elliptic-curve' ? 'P + Q = 𝒪' : '2P', 0, 3)
  } else {
    ctx.beginPath()
    for (let point = 0; point < 16; point += 1) {
      const pointAngle = -Math.PI / 2 + point * Math.PI / 8
      const radius = point % 2 === 0 ? visualRadius * pulse : visualRadius * .42 * pulse
      const x = Math.cos(pointAngle) * radius
      const y = Math.sin(pointAngle) * radius * .55
      if (point === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
  }
  ctx.restore()
}

function drawEnemyClassStatus(
  ctx: CanvasRenderingContext2D,
  state: EngineState,
  enemy: EnemyState,
): void {
  const heroClass = getHeroClass(state.heroClassId)
  if (
    (heroClass.archetype === 'cryptographer' || heroClass.archetype === 'assassin') &&
    enemy.rsaMarkUntilMs > state.elapsedMs && enemy.rsaMark !== 0
  ) {
    ctx.save()
    ctx.textAlign = 'center'
    ctx.font = 'bold 6px "JetBrains Mono", monospace'
    const labels = heroClass.archetype === 'assassin'
      ? [enemy.rsaMark & 1 ? '−1' : '', enemy.rsaMark & 2 ? '+1' : ''].filter(Boolean)
      : [enemy.rsaMark & 1 ? 'p' : '', enemy.rsaMark & 2 ? 'q' : ''].filter(Boolean)
    labels.forEach((label, index) => {
      const x = enemy.x + (index - (labels.length - 1) / 2) * 10
      fillPixel(ctx, x - 4, enemy.y - enemy.radius - 15, 8, 8, 'rgba(3, 8, 13, .88)')
      ctx.strokeStyle = index === 0 ? heroClass.palette.energy : heroClass.palette.accent
      ctx.strokeRect(x - 4, enemy.y - enemy.radius - 15, 8, 8)
      ctx.fillStyle = ctx.strokeStyle
      ctx.fillText(label, x, enemy.y - enemy.radius - 9)
    })
    ctx.restore()
  }
  if (
    heroClass.archetype === 'ranger' &&
    state.rangerMarkedEnemyId === enemy.id &&
    state.rangerMarkUntilMs > state.elapsedMs
  ) {
    ctx.save()
    ctx.strokeStyle = heroClass.palette.accent
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(enemy.x, enemy.y, enemy.radius + 7, 0, Math.PI * 2)
    ctx.moveTo(enemy.x - enemy.radius - 10, enemy.y)
    ctx.lineTo(enemy.x + enemy.radius + 10, enemy.y)
    ctx.moveTo(enemy.x, enemy.y - enemy.radius - 10)
    ctx.lineTo(enemy.x, enemy.y + enemy.radius + 10)
    ctx.stroke()
    ctx.restore()
  }
}

function drawEnemyPrimePowerEffect(
  ctx: CanvasRenderingContext2D,
  effect: EnemyPowerEffectState,
  time: number,
  reducedMotion: boolean,
): void {
  const power = ENEMY_PRIME_POWERS[effect.familyId]
  const anime = resolveEnemyPrimePowerAnimePresentation(effect.familyId, effect.phase)
  const progress = clamp((time - effect.startedAtMs) / effect.durationMs, 0, 1)
  const eased = reducedMotion ? .72 : 1 - Math.pow(1 - progress, 3)
  const radius = effect.kind === 'impact'
    ? 4 + eased * (11 + effect.phase * 4)
    : 11 + eased * (18 + effect.phase * 6)
  const alpha = Math.max(0, 1 - progress)
  ctx.save()
  ctx.translate(effect.x, effect.y)
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = alpha * (effect.kind === 'phase-break' ? .66 : effect.kind === 'impact' ? .44 : .56)
  ctx.strokeStyle = power.color
  ctx.fillStyle = power.color
  ctx.lineWidth = 1 + effect.phase * .55

  if (effect.kind === 'impact') {
    ctx.rotate(effect.rotation)
    const rayCount = Math.min(8, anime.rayCount)
    for (let ray = 0; ray < rayCount; ray += 1) {
      const rayAngle = ray / rayCount * Math.PI * 2
      const inner = radius * (ray % 2 === 0 ? .18 : .35)
      const outer = radius * (ray % 3 === 0 ? 1.35 : .92)
      ctx.beginPath()
      ctx.moveTo(Math.cos(rayAngle) * inner, Math.sin(rayAngle) * inner)
      ctx.lineTo(Math.cos(rayAngle) * outer, Math.sin(rayAngle) * outer)
      ctx.stroke()
    }
    ctx.rotate(-effect.rotation)
    ctx.globalAlpha = alpha * .34
    ctx.beginPath()
    ctx.arc(0, 0, radius * .68, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = anime.flashColor
    ctx.fillStyle = anime.flashColor
    if (anime.impactShape === 'nested-squares') {
      for (let square = 1; square <= 2; square += 1) {
        ctx.save()
        ctx.rotate(Math.PI / 4 * square)
        ctx.strokeRect(-radius * .42 * square, -radius * .42 * square, radius * .84 * square, radius * .84 * square)
        ctx.restore()
      }
    } else if (anime.impactShape === 'twin-cross') {
      ctx.beginPath()
      ctx.moveTo(-radius, -radius)
      ctx.lineTo(radius, radius)
      ctx.moveTo(radius, -radius)
      ctx.lineTo(-radius, radius)
      ctx.stroke()
    } else if (anime.impactShape === 'linked-diamonds') {
      for (let link = -1; link <= 1; link += 1) {
        ctx.save()
        ctx.translate(link * radius * .55, 0)
        ctx.rotate(Math.PI / 4)
        ctx.strokeRect(-radius * .28, -radius * .28, radius * .56, radius * .56)
        ctx.restore()
      }
    } else if (anime.impactShape === 'fractured-crown') {
      ctx.beginPath()
      ctx.moveTo(-radius, radius * .45)
      ctx.lineTo(-radius * .65, -radius * .72)
      ctx.lineTo(-radius * .15, -.1 * radius)
      ctx.lineTo(radius * .28, -radius)
      ctx.lineTo(radius * .62, -.08 * radius)
      ctx.lineTo(radius, -radius * .65)
      ctx.stroke()
    } else if (anime.impactShape === 'sieve-grid') {
      for (let lane = -1; lane <= 1; lane += 1) {
        ctx.beginPath()
        ctx.moveTo(-radius, lane * radius * .45)
        ctx.lineTo(radius, lane * radius * .45)
        ctx.moveTo(lane * radius * .45, -radius)
        ctx.lineTo(lane * radius * .45, radius)
        ctx.stroke()
      }
    } else if (anime.impactShape === 'binary-sun') {
      ctx.beginPath()
      ctx.arc(-radius * .38, 0, radius * .48, 0, Math.PI * 2)
      ctx.arc(radius * .38, 0, radius * .48, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.ellipse(0, 0, radius, radius * .42, .5, 0, Math.PI * 2)
      ctx.ellipse(0, 0, radius * .72, radius * .3, -.5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.font = 'bold 7px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText('!', 0, 2)
    }
    if (effect.dramatic && progress < .62) {
      ctx.globalAlpha = Math.min(1, alpha * 1.6)
      ctx.fillStyle = '#fff8e8'
      ctx.font = `900 ${7 + effect.phase}px "Space Grotesk", sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(anime.impactWord, 0, -radius - 5)
    }
    ctx.restore()
    return
  }

  if (effect.kind === 'phase-break') {
    ctx.globalAlpha = alpha * .42
    for (let ring = 1; ring <= 3; ring += 1) {
      ctx.beginPath()
      ctx.arc(0, 0, radius * (.45 + ring * .24), 0, Math.PI * 2)
      ctx.stroke()
    }
    const slashCount = 5 + effect.phase * 2
    for (let slash = 0; slash < slashCount; slash += 1) {
      const slashAngle = slash / slashCount * Math.PI * 2 + progress
      ctx.beginPath()
      ctx.moveTo(Math.cos(slashAngle) * radius * .72, Math.sin(slashAngle) * radius * .72)
      ctx.lineTo(Math.cos(slashAngle) * radius * 1.35, Math.sin(slashAngle) * radius * 1.35)
      ctx.stroke()
    }
    ctx.globalAlpha = alpha * .7
  }

  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.stroke()

  ctx.save()
  if (power.pattern === 'twin-lances') {
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(-radius, side * 5)
      ctx.lineTo(radius, side * 5)
      ctx.stroke()
    }
  } else if (power.pattern === 'sophie-chain') {
    const nodes = effect.phase + 2
    ctx.beginPath()
    for (let node = 0; node < nodes; node += 1) {
      const nodeX = -radius + node / (nodes - 1) * radius * 2
      const nodeY = Math.sin(node * 1.7) * 7
      if (node === 0) ctx.moveTo(nodeX, nodeY)
      else ctx.lineTo(nodeX, nodeY)
      ctx.strokeRect(nodeX - 3, nodeY - 3, 6, 6)
    }
    ctx.stroke()
  } else if (power.pattern === 'mersenne-ring') {
    const rings = effect.phase
    for (let ring = 1; ring <= rings; ring += 1) {
      ctx.beginPath()
      ctx.arc(0, 0, radius * ring / rings, 0, Math.PI * 2)
      ctx.stroke()
    }
    const rayCount = anime.rayCount
    for (let ray = 0; ray < rayCount; ray += 1) {
      const rayAngle = ray / rayCount * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(rayAngle) * radius * .35, Math.sin(rayAngle) * radius * .35)
      ctx.lineTo(Math.cos(rayAngle) * radius, Math.sin(rayAngle) * radius)
      ctx.stroke()
    }
  } else if (power.pattern === 'sieve-lanes') {
    for (let lane = -2; lane <= 2; lane += 1) {
      if (lane === 0) continue
      ctx.beginPath()
      ctx.moveTo(-radius, lane * 5)
      ctx.lineTo(radius, lane * 5)
      ctx.stroke()
    }
    ctx.globalAlpha *= .45
    ctx.fillRect(-radius, -2, radius * 2, 4)
  } else if (power.pattern === 'goldbach-pair') {
    ctx.beginPath()
    ctx.arc(-radius * .42, 0, radius * .34, 0, Math.PI * 2)
    ctx.arc(radius * .42, 0, radius * .34, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#ffd37d'
    fillPixel(ctx, -2, -2, 4, 4, '#ffd37d')
  } else if (power.pattern === 'wilson-orbit') {
    ctx.rotate(reducedMotion ? 0 : progress * Math.PI * 2)
    for (let orbit = 1; orbit <= effect.phase + 1; orbit += 1) {
      ctx.beginPath()
      ctx.ellipse(0, 0, radius * orbit / (effect.phase + 1), radius * .35, orbit * .45, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else {
    ctx.rotate(Math.PI / 4 + (reducedMotion ? 0 : progress * .8))
    ctx.strokeRect(-radius * .58, -radius * .58, radius * 1.16, radius * 1.16)
  }
  ctx.restore()

  if (progress < .62) {
    ctx.globalAlpha = alpha
    ctx.fillStyle = '#fff6df'
    ctx.font = 'bold 6px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(power.formula, 0, -radius - 7)
  }
  ctx.restore()
}

function activeDramaticEnemyEffect(state: EngineState): EnemyPowerEffectState | null {
  for (let index = state.enemyPowerEffects.length - 1; index >= 0; index -= 1) {
    const candidate = state.enemyPowerEffects[index]
    if (
      candidate.dramatic && candidate.kind !== 'impact' &&
      state.elapsedMs - candidate.startedAtMs < candidate.durationMs
    ) return candidate
  }
  return null
}

function drawEnemyAnimeOverlay(
  ctx: CanvasRenderingContext2D,
  state: EngineState,
  reducedMotion: boolean,
): void {
  const activeEffect = activeDramaticEnemyEffect(state)
  if (!activeEffect) return

  const anime = resolveEnemyPrimePowerAnimePresentation(
    activeEffect.familyId,
    activeEffect.phase,
  )
  const progress = clamp(
    (state.elapsedMs - activeEffect.startedAtMs) / activeEffect.durationMs,
    0,
    1,
  )
  const envelope = reducedMotion
    ? .42
    : Math.min(1, progress / .14, (1 - progress) / .3)
  if (envelope <= 0) return
  const phaseBreak = activeEffect.kind === 'phase-break'
  const focusX = clamp(activeEffect.x - state.camera.x, 54, VIEW_WIDTH - 54)
  const focusY = clamp(activeEffect.y - state.camera.y, 48, VIEW_HEIGHT - 48)
  const lineCount = reducedMotion
    ? 4
    : Math.min(phaseBreak ? 12 : 8, anime.rayCount + 3)
  const motion = reducedMotion ? 0 : progress

  ctx.save()
  ctx.globalAlpha = envelope * (phaseBreak ? .32 : .13)
  ctx.fillStyle = '#020308'
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = envelope * Math.min(
    reducedMotion ? .06 : phaseBreak ? .2 : .11,
    anime.screenFlashAlpha,
  )
  ctx.fillStyle = anime.flashColor
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

  ctx.save()
  ctx.translate(focusX, focusY)
  if (anime.cameraMove === 'orbital-roll' && !reducedMotion) {
    ctx.rotate((progress - .5) * .06)
  }
  ctx.strokeStyle = anime.flashColor
  ctx.lineWidth = phaseBreak ? 2 : 1
  for (let line = 0; line < lineCount; line += 1) {
    const angle = line / lineCount * Math.PI * 2 + motion * .2
    const inner = 24 + activeEffect.phase * 4
    const outer = 130 + (line % 4) * 16
    ctx.globalAlpha = envelope * (.07 + (line % 3) * .03)
    ctx.beginPath()
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
    ctx.stroke()
  }

  ctx.globalAlpha = envelope * .3
  if (anime.cutInStyle === 'mirrored-duel' || anime.cutInStyle === 'binary-eclipse') {
    ctx.beginPath()
    ctx.arc(-30 + motion * 9, 0, 22 + activeEffect.phase * 3, 0, Math.PI * 2)
    ctx.arc(30 - motion * 9, 0, 22 + activeEffect.phase * 3, 0, Math.PI * 2)
    ctx.stroke()
  } else if (anime.cutInStyle === 'geometric-erasure') {
    for (let lane = -2; lane <= 2; lane += 1) {
      ctx.beginPath()
      ctx.moveTo(-VIEW_WIDTH, lane * 12)
      ctx.lineTo(VIEW_WIDTH, lane * 12)
      ctx.stroke()
    }
  } else if (anime.cutInStyle === 'chained-awakening') {
    for (let link = -2; link <= 2; link += 1) {
      ctx.save()
      ctx.translate(link * 18, Math.sin(link * 1.7 + motion * 6) * 10)
      ctx.rotate(Math.PI / 4)
      ctx.strokeRect(-6, -6, 12, 12)
      ctx.restore()
    }
  } else if (anime.cutInStyle === 'apocalyptic-crown') {
    ctx.beginPath()
    for (let spike = 0; spike < 14; spike += 1) {
      const angle = spike / 14 * Math.PI * 2
      const radius = spike % 2 === 0 ? 54 : 30
      const pointX = Math.cos(angle) * radius
      const pointY = Math.sin(angle) * radius
      if (spike === 0) ctx.moveTo(pointX, pointY)
      else ctx.lineTo(pointX, pointY)
    }
    ctx.closePath()
    ctx.stroke()
  } else if (anime.cutInStyle === 'factorial-judgement') {
    for (let orbit = 1; orbit <= 3; orbit += 1) {
      ctx.beginPath()
      ctx.ellipse(0, 0, 24 * orbit, 8 * orbit, orbit * .55 + motion, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else {
    for (let square = 1; square <= 3; square += 1) {
      ctx.save()
      ctx.rotate(Math.PI / 4 + square * motion * .12)
      ctx.strokeRect(-square * 15, -square * 15, square * 30, square * 30)
      ctx.restore()
    }
  }
  ctx.restore()

  const textOnLeft = focusX > VIEW_WIDTH * .54
  const textX = textOnLeft ? 32 : VIEW_WIDTH - 32
  ctx.textAlign = textOnLeft ? 'left' : 'right'
  ctx.globalAlpha = envelope * .11
  ctx.fillStyle = anime.flashColor
  ctx.font = `900 ${phaseBreak ? 54 : 43}px "Space Grotesk", sans-serif`
  ctx.fillText(anime.glyph, textX, 83)
  ctx.globalAlpha = envelope * .88
  ctx.fillStyle = '#fff7e8'
  ctx.font = `900 ${phaseBreak ? 13 : 10}px "Space Grotesk", sans-serif`
  ctx.fillText(anime.techniqueName.toUpperCase(), textX, 104)
  ctx.fillStyle = anime.flashColor
  ctx.font = 'bold 6px "JetBrains Mono", monospace'
  ctx.fillText(`FASE ${activeEffect.phase}  //  ${anime.battleCry}`.toUpperCase(), textX, 116)

  ctx.globalAlpha = envelope * .55
  ctx.fillStyle = anime.flashColor
  ctx.fillRect(0, 0, VIEW_WIDTH, phaseBreak ? 3 : 1)
  ctx.fillRect(0, VIEW_HEIGHT - (phaseBreak ? 3 : 1), VIEW_WIDTH, phaseBreak ? 3 : 1)
  ctx.restore()
}

function drawPerfectUltimateAreaEffect(
  ctx: CanvasRenderingContext2D,
  effect: CombatEffectState,
  time: number,
  reducedMotion: boolean,
): void {
  const heroClass = getHeroClass(effect.heroClassId)
  const definition = getPerfectUltimate(effect.heroClassId)
  const ageMs = clamp(time - effect.startedAtMs, 0, effect.durationMs)
  const progress = clamp(ageMs / effect.durationMs, 0, 1)
  const reveal = reducedMotion ? 1 : clamp(ageMs / 120, 0, 1)
  const fade = clamp((effect.durationMs - ageMs) / 260, 0, 1)
  const envelope = reveal * fade
  const rotation = reducedMotion ? 0 : progress * Math.PI * 1.4
  const energy = heroClass.palette.energy
  const accent = heroClass.palette.accent
  const primary = heroClass.palette.primary

  const traceStar = (
    points: number,
    outerRadius: number,
    innerRadius: number,
    startAngle: number,
  ): void => {
    ctx.beginPath()
    for (let point = 0; point < points * 2; point += 1) {
      const pointAngle = startAngle + point / (points * 2) * Math.PI * 2
      const pointRadius = point % 2 === 0 ? outerRadius : innerRadius
      const x = Math.cos(pointAngle) * pointRadius
      const y = Math.sin(pointAngle) * pointRadius
      if (point === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
  }

  ctx.save()
  ctx.translate(effect.x, effect.y)
  ctx.globalCompositeOperation = 'lighter'

  const auraRadius = effect.radius * (reducedMotion ? .88 : .2 + progress * .8)
  const aura = ctx.createRadialGradient(0, 0, 3, 0, 0, Math.max(4, auraRadius))
  aura.addColorStop(0, `${accent}80`)
  aura.addColorStop(.24, `${energy}38`)
  aura.addColorStop(1, `${primary}00`)
  ctx.globalAlpha = envelope * .72
  ctx.fillStyle = aura
  ctx.beginPath()
  ctx.arc(0, 0, auraRadius, 0, Math.PI * 2)
  ctx.fill()

  for (const [waveIndex, wave] of definition.waves.entries()) {
    const expansionLeadMs = Math.min(180, Math.max(1, wave.atMs))
    const expansionStartMs = wave.atMs - expansionLeadMs
    const expansion = reducedMotion
      ? ageMs >= wave.atMs ? 1 : 0
      : clamp((ageMs - expansionStartMs) / expansionLeadMs, 0, 1)
    if (expansion <= 0) continue
    const remainingEffectMs = Math.max(160, effect.durationMs - wave.atMs)
    const decay = reducedMotion
      ? 0
      : clamp((ageMs - wave.atMs) / Math.min(300, remainingEffectMs), 0, 1)
    const waveRadius = effect.radius * wave.radiusMultiplier * (.18 + expansion * .82)
    ctx.globalAlpha = envelope * (reducedMotion ? .48 : 1 - decay) * .92
    ctx.strokeStyle = waveIndex === definition.waves.length - 1 ? accent : energy
    ctx.lineWidth = waveIndex === definition.waves.length - 1 ? 4 : 2
    ctx.beginPath()
    ctx.arc(0, 0, waveRadius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = waveIndex === definition.waves.length - 1 ? '#fff8df' : energy
    ctx.font = `900 ${waveIndex === definition.waves.length - 1 ? 10 : 7}px "JetBrains Mono", monospace`
    ctx.textAlign = 'center'
    const labelAngle = -Math.PI / 2 + waveIndex * 2.399 + rotation * .2
    ctx.fillText(
      wave.glyph,
      Math.cos(labelAngle) * waveRadius,
      Math.sin(labelAngle) * waveRadius + 3,
    )
  }

  ctx.globalAlpha = envelope
  if (definition.style === 'euclid-proof-cleave') {
    const slashProgress = reducedMotion ? 1 : clamp((ageMs - 70) / 760, 0, 1)
    for (let slash = 0; slash < 13; slash += 1) {
      const slashAngle = slash / 13 * Math.PI * 2 + rotation * .22
      const inner = effect.radius * (.08 + (slash % 3) * .025)
      const outer = effect.radius * (.48 + slashProgress * .5)
      ctx.globalAlpha = envelope * (.3 + (slash % 3) * .16)
      ctx.strokeStyle = slash % 3 === 0 ? accent : energy
      ctx.lineWidth = slash % 3 === 0 ? 3.5 : 1.5
      ctx.beginPath()
      ctx.moveTo(Math.cos(slashAngle) * inner, Math.sin(slashAngle) * inner)
      ctx.lineTo(Math.cos(slashAngle) * outer, Math.sin(slashAngle) * outer)
      ctx.stroke()
    }
    for (const [index, wave] of definition.waves.entries()) {
      const cutProgress = reducedMotion
        ? ageMs >= wave.atMs ? 1 : 0
        : clamp((ageMs - wave.atMs) / 180, 0, 1)
      if (cutProgress <= 0) continue
      const cutAngle = -Math.PI * .32 + index * Math.PI / 3
      const side = (index - 1) * 11
      ctx.save()
      ctx.rotate(cutAngle)
      ctx.globalAlpha = envelope * (.45 + cutProgress * .45)
      ctx.strokeStyle = index === definition.waves.length - 1 ? '#fff8df' : energy
      ctx.lineWidth = index === definition.waves.length - 1 ? 6 : 3
      ctx.beginPath()
      ctx.moveTo(-effect.radius * cutProgress, side)
      ctx.lineTo(effect.radius * cutProgress, side)
      ctx.stroke()
      ctx.restore()
    }
    ctx.globalAlpha = envelope
    ctx.fillStyle = '#fff8df'
    ctx.font = '900 22px "Space Grotesk", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('P+1', 0, 8)
  } else if (definition.style === 'rsa-key-collapse') {
    const nodeLabels = ['p', 'q', 'n', 'φ', 'e', 'd', 'Ω']
    const networkRadius = effect.radius * (
      reducedMotion ? .5 : .42 + Math.sin(progress * Math.PI) * .12
    )
    ctx.strokeStyle = energy
    ctx.lineWidth = 1.5
    for (let node = 0; node < nodeLabels.length; node += 1) {
      const nodeAngle = -Math.PI / 2 + node / nodeLabels.length * Math.PI * 2 - rotation * .18
      const nextAngle = -Math.PI / 2 + (node + 1) / nodeLabels.length * Math.PI * 2 - rotation * .18
      const x = Math.cos(nodeAngle) * networkRadius
      const y = Math.sin(nodeAngle) * networkRadius
      const nextX = Math.cos(nextAngle) * networkRadius
      const nextY = Math.sin(nextAngle) * networkRadius
      ctx.globalAlpha = envelope * .58
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(nextX, nextY)
      if (node % 2 === 0) ctx.lineTo(0, 0)
      ctx.stroke()
      ctx.globalAlpha = envelope
      ctx.strokeStyle = node === nodeLabels.length - 1 ? accent : energy
      ctx.strokeRect(x - 7, y - 7, 14, 14)
      ctx.fillStyle = node === nodeLabels.length - 1 ? '#fff8df' : energy
      ctx.font = '900 7px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(nodeLabels[node], x, y + 2.5)
      ctx.strokeStyle = energy
    }
    for (let key = 0; key < 3; key += 1) {
      const collapse = reducedMotion ? .55 : 1 - progress
      const half = 25 + key * 19 + collapse * effect.radius * .2
      ctx.save()
      ctx.rotate(Math.PI / 4 + key * .22 + rotation * (key % 2 ? -1 : 1))
      ctx.globalAlpha = envelope * (.75 - key * .16)
      ctx.strokeStyle = key === 2 ? accent : energy
      ctx.lineWidth = 2 + (2 - key) * .6
      ctx.strokeRect(-half, -half, half * 2, half * 2)
      ctx.restore()
    }
    ctx.globalAlpha = envelope
    ctx.fillStyle = '#fff8df'
    ctx.font = '900 24px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('Ω', 0, 8)
  } else if (definition.style === 'modular-horizon-volley') {
    ctx.globalAlpha = envelope * .6
    ctx.strokeStyle = primary
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, effect.radius * .72, 0, Math.PI * 2)
    ctx.stroke()
    for (let arrow = 0; arrow < 13; arrow += 1) {
      const arrowDelay = (arrow % 7) * 46
      const flight = reducedMotion
        ? .82
        : clamp((ageMs - 80 - arrowDelay) / 620, 0, 1)
      if (flight <= 0) continue
      const arrowAngle = arrow / 13 * Math.PI * 2 + rotation * .1
      const radius = effect.radius * (.16 + flight * .79)
      const tailRadius = Math.max(12, radius - 24)
      const tipX = Math.cos(arrowAngle) * radius
      const tipY = Math.sin(arrowAngle) * radius
      const sideAngle = arrowAngle + Math.PI / 2
      ctx.globalAlpha = envelope * (.42 + (arrow % 3) * .18)
      ctx.strokeStyle = arrow === 12 ? '#fff8df' : arrow % 2 ? accent : energy
      ctx.lineWidth = arrow === 12 ? 4 : 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(arrowAngle) * tailRadius, Math.sin(arrowAngle) * tailRadius)
      ctx.lineTo(tipX, tipY)
      ctx.moveTo(tipX, tipY)
      ctx.lineTo(
        tipX - Math.cos(arrowAngle) * 8 + Math.cos(sideAngle) * 4,
        tipY - Math.sin(arrowAngle) * 8 + Math.sin(sideAngle) * 4,
      )
      ctx.moveTo(tipX, tipY)
      ctx.lineTo(
        tipX - Math.cos(arrowAngle) * 8 - Math.cos(sideAngle) * 4,
        tipY - Math.sin(arrowAngle) * 8 - Math.sin(sideAngle) * 4,
      )
      ctx.stroke()
    }
    const horizon = reducedMotion ? 1 : clamp((ageMs - 720) / 250, 0, 1)
    ctx.globalAlpha = envelope * horizon
    ctx.strokeStyle = '#fff8df'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(-effect.radius * horizon, 0)
    ctx.lineTo(effect.radius * horizon, 0)
    ctx.stroke()
    ctx.fillStyle = accent
    ctx.font = '900 23px "Space Grotesk", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('13', 0, 8)
  } else if (definition.style === 'mobius-null-domain') {
    ctx.strokeStyle = energy
    ctx.lineWidth = 2.5
    for (let ribbon = 0; ribbon < 5; ribbon += 1) {
      ctx.save()
      ctx.rotate(rotation * (ribbon % 2 ? -1 : 1) + ribbon * Math.PI / 5)
      ctx.globalAlpha = envelope * (.42 + ribbon * .1)
      ctx.beginPath()
      ctx.ellipse(0, 0, effect.radius * (.35 + ribbon * .1), effect.radius * .14, .6, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    const nullPulse = reducedMotion ? 1 : clamp((ageMs - 620) / 380, 0, 1)
    ctx.globalAlpha = envelope * nullPulse
    ctx.fillStyle = accent
    ctx.font = '900 30px "Space Grotesk", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('μ(n) = 0', 0, 10)
  } else if (definition.style === 'goldbach-twin-impact') {
    const collision = reducedMotion ? 1 : clamp((ageMs - 120) / 760, 0, 1)
    const separation = effect.radius * .7 * (1 - collision)
    ctx.strokeStyle = energy
    ctx.fillStyle = accent
    ctx.lineWidth = 5
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(side * separation, 0, 18 + collision * effect.radius * .22, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = envelope * collision
    for (let ray = 0; ray < 22; ray += 1) {
      const rayAngle = ray / 22 * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(rayAngle) * 14, Math.sin(rayAngle) * 14)
      ctx.lineTo(Math.cos(rayAngle) * effect.radius * .82, Math.sin(rayAngle) * effect.radius * .55)
      ctx.stroke()
    }
    ctx.fillStyle = '#fff8df'
    ctx.font = '900 24px "Space Grotesk", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('p + q = 2n', 0, 9)
  } else if (definition.style === 'sieve-prime-grid') {
    const extent = effect.radius * Math.min(1, reveal * 1.2)
    ctx.strokeStyle = energy
    ctx.lineWidth = 1.5
    for (let line = -6; line <= 6; line += 1) {
      const offset = line * extent / 6
      ctx.globalAlpha = envelope * (line % 2 ? .44 : .72)
      ctx.beginPath()
      ctx.moveTo(-extent, offset * .62)
      ctx.lineTo(extent, offset * .62)
      ctx.moveTo(offset, -extent * .62)
      ctx.lineTo(offset, extent * .62)
      ctx.stroke()
    }
    ctx.globalAlpha = envelope
    ctx.fillStyle = '#fff8df'
    ctx.font = '900 22px "Space Grotesk", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('2 · 3 · 5 · 7', 0, 8)
    ctx.strokeStyle = accent
    ctx.strokeRect(-effect.radius * .35, -effect.radius * .2, effect.radius * .7, effect.radius * .4)
  } else if (definition.style === 'elliptic-infinity-curve') {
    ctx.strokeStyle = energy
    ctx.lineWidth = 2.5
    ctx.save()
    ctx.rotate(rotation * .35)
    for (const curveRotation of [-.84, -.42, 0, .42, .84]) {
      ctx.globalAlpha = envelope * (.48 + Math.abs(curveRotation) * .35)
      ctx.beginPath()
      ctx.ellipse(0, 0, effect.radius * .78, effect.radius * .25, curveRotation, 0, Math.PI * 2)
      ctx.stroke()
    }
    for (let point = 0; point < 19; point += 1) {
      const pointAngle = point / 19 * Math.PI * 2
      const pointRadius = effect.radius * (.42 + (point % 3) * .13)
      fillPixel(
        ctx,
        Math.cos(pointAngle) * pointRadius - 2,
        Math.sin(pointAngle) * pointRadius * .5 - 2,
        4,
        4,
        point === 18 ? '#fff8df' : accent,
      )
    }
    ctx.restore()
    ctx.globalAlpha = envelope
    ctx.fillStyle = '#fff8df'
    ctx.font = '900 34px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('𝒪', 0, 11)
  } else {
    const mersenneValues = ['3', '7', '31', '127']
    for (const [index, value] of mersenneValues.entries()) {
      const starAngle = -Math.PI / 2 + index / mersenneValues.length * Math.PI * 2 + rotation * .16
      const collapse = reducedMotion
        ? .62
        : 1 - clamp((ageMs - definition.waves[index].atMs) / 620, 0, 1)
      const orbitRadius = 24 + collapse * effect.radius * .58
      const x = Math.cos(starAngle) * orbitRadius
      const y = Math.sin(starAngle) * orbitRadius
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(-rotation + index * .4)
      ctx.globalAlpha = envelope * (.5 + index * .12)
      ctx.strokeStyle = index === mersenneValues.length - 1 ? accent : energy
      ctx.lineWidth = 1.5 + index * .45
      traceStar(5 + index * 2, 9 + index * 2, 4 + index, -Math.PI / 2)
      ctx.stroke()
      ctx.restore()
      ctx.globalAlpha = envelope
      ctx.fillStyle = index === mersenneValues.length - 1 ? '#fff8df' : energy
      ctx.font = '900 6px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(value, x, y - 12 - index)
    }
    const supernova = reducedMotion ? .82 : clamp((ageMs - 1_180) / 300, 0, 1)
    if (supernova > 0) {
      ctx.save()
      ctx.rotate(rotation * .42)
      ctx.globalAlpha = envelope * supernova
      ctx.strokeStyle = '#fff8df'
      ctx.fillStyle = accent
      ctx.lineWidth = 4
      traceStar(13, 24 + effect.radius * .62 * supernova, 12 + effect.radius * .2 * supernova, -Math.PI / 2)
      ctx.stroke()
      ctx.restore()
    }
    ctx.globalAlpha = envelope
    ctx.fillStyle = '#fff8df'
    ctx.font = '900 18px "Space Grotesk", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('8191', 0, 7)
  }

  ctx.globalAlpha = envelope * .92
  ctx.fillStyle = '#fff8df'
  ctx.font = 'bold 6px "JetBrains Mono", monospace'
  ctx.textAlign = 'center'
  ctx.fillText(definition.formula, 0, -Math.min(effect.radius * .78, 112))
  ctx.restore()
}

function drawCombatEffect(
  ctx: CanvasRenderingContext2D,
  effect: CombatEffectState,
  time: number,
  reducedMotion: boolean,
): void {
  if (effect.kind === 'perfect-ultimate') {
    drawPerfectUltimateAreaEffect(ctx, effect, time, reducedMotion)
    return
  }
  const heroClass = getHeroClass(effect.heroClassId)
  const progress = clamp((time - effect.startedAtMs) / effect.durationMs, 0, 1)
  const eased = reducedMotion ? progress : 1 - Math.pow(1 - progress, 3)
  const alpha = Math.max(0, 1 - progress)
  const angle = facingAngle(effect.facing)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = alpha
  ctx.lineCap = 'square'

  if (effect.kind === 'class-basic') {
    const direction = directionVector(effect.facing)
    const side = { x: -direction.y, y: direction.x }
    const length = effect.radius * (reducedMotion ? 1 : eased)
    const endX = effect.x + direction.x * length
    const endY = effect.y + direction.y * length
    ctx.strokeStyle = heroClass.palette.energy
    ctx.fillStyle = heroClass.palette.accent
    ctx.lineWidth = heroClass.archetype === 'ranger' ? 2 : 3
    if (heroClass.archetype === 'ranger') {
      ctx.beginPath()
      ctx.moveTo(effect.x + direction.x * 8, effect.y + direction.y * 8)
      ctx.lineTo(endX, endY)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(endX, endY)
      ctx.lineTo(endX - direction.x * 7 + side.x * 4, endY - direction.y * 7 + side.y * 4)
      ctx.moveTo(endX, endY)
      ctx.lineTo(endX - direction.x * 7 - side.x * 4, endY - direction.y * 7 - side.y * 4)
      ctx.stroke()
    } else if (heroClass.archetype === 'cryptographer') {
      ctx.beginPath()
      ctx.moveTo(effect.x, effect.y)
      ctx.lineTo(endX, endY)
      ctx.stroke()
      for (let node = 1; node <= 3; node += 1) {
        const nodeX = effect.x + direction.x * length * node / 3
        const nodeY = effect.y + direction.y * length * node / 3
        ctx.strokeRect(nodeX - 3, nodeY - 3, 6, 6)
      }
    } else if (heroClass.archetype === 'arcanist') {
      for (let glyph = 1; glyph <= 3; glyph += 1) {
        ctx.beginPath()
        ctx.arc(
          effect.x + direction.x * length * glyph / 3,
          effect.y + direction.y * length * glyph / 3,
          3 + glyph * 2,
          0,
          Math.PI * 2,
        )
        ctx.stroke()
      }
    } else {
      const angle = facingAngle(effect.facing)
      ctx.beginPath()
      ctx.arc(effect.x, effect.y, 12 + eased * 26, angle - .78, angle + .78)
      ctx.stroke()
    }
  } else if (effect.kind === 'mobius-step') {
    ctx.save()
    ctx.translate(effect.x, effect.y)
    ctx.rotate(reducedMotion ? 0 : progress * Math.PI * 1.6)
    ctx.strokeStyle = heroClass.palette.energy
    ctx.lineWidth = 2
    for (const rotation of [-.58, .58]) {
      ctx.beginPath()
      ctx.ellipse(0, 0, effect.radius * eased, effect.radius * .3 * eased, rotation, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.strokeStyle = heroClass.palette.accent
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(side * effect.radius * .18, -effect.radius * .62 * alpha)
      ctx.lineTo(-side * effect.radius * .72, effect.radius * .46 * alpha)
      ctx.stroke()
    }
    ctx.fillStyle = '#fff8e8'
    ctx.font = 'bold 7px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(progress > .62 ? '0' : progress > .3 ? '+1' : '−1', 0, 3)
    ctx.restore()
  } else if (effect.kind === 'goldbach-impact') {
    ctx.strokeStyle = heroClass.palette.energy
    ctx.fillStyle = heroClass.palette.accent
    ctx.lineWidth = 3
    const separation = effect.radius * (1 - eased) * .55
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(effect.x + side * separation, effect.y, 8 + eased * effect.radius * .38, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = alpha * eased
    ctx.beginPath()
    ctx.moveTo(effect.x - effect.radius * .7, effect.y)
    ctx.lineTo(effect.x + effect.radius * .7, effect.y)
    ctx.stroke()
    ctx.font = 'bold 8px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('p + q = 2n', effect.x, effect.y - 10 - eased * effect.radius * .3)
  } else if (effect.kind === 'sieve-deploy') {
    const extent = effect.radius * Math.min(1, eased * 1.4)
    ctx.strokeStyle = heroClass.palette.energy
    ctx.lineWidth = 1.5
    for (let line = -3; line <= 3; line += 1) {
      const offset = line * extent / 3
      ctx.beginPath()
      ctx.moveTo(effect.x - extent, effect.y + offset * .55)
      ctx.lineTo(effect.x + extent, effect.y + offset * .55)
      ctx.moveTo(effect.x + offset, effect.y - extent * .55)
      ctx.lineTo(effect.x + offset, effect.y + extent * .55)
      ctx.stroke()
    }
    ctx.fillStyle = heroClass.palette.accent
    ctx.font = 'bold 7px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ;[2, 3, 5, 7].forEach((prime, index) => {
      const pointAngle = index / 4 * Math.PI * 2 + progress
      ctx.fillText(
        String(prime),
        effect.x + Math.cos(pointAngle) * extent * .7,
        effect.y + Math.sin(pointAngle) * extent * .35,
      )
    })
  } else if (effect.kind === 'elliptic-arc') {
    ctx.save()
    ctx.translate(effect.x, effect.y)
    ctx.rotate(reducedMotion ? 0 : progress * Math.PI)
    ctx.strokeStyle = heroClass.palette.energy
    ctx.lineWidth = 2
    for (const rotation of [-.65, 0, .65]) {
      ctx.beginPath()
      ctx.ellipse(0, 0, effect.radius * eased, effect.radius * .32 * eased, rotation, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = heroClass.palette.accent
    for (let point = 0; point < 5; point += 1) {
      const pointAngle = point / 5 * Math.PI * 2 - progress * 2
      fillPixel(
        ctx,
        Math.cos(pointAngle) * effect.radius * .62 - 2,
        Math.sin(pointAngle) * effect.radius * .32 - 2,
        4,
        4,
        point === 4 ? '#fff8e8' : heroClass.palette.accent,
      )
    }
    ctx.restore()
  } else if (effect.kind === 'twin-blades') {
    const direction = directionVector(effect.facing)
    const side = { x: -direction.y, y: direction.x }
    const length = effect.radius * eased
    if (heroClass.archetype === 'warrior') {
      for (const offset of [-5, 5]) {
        ctx.strokeStyle = offset < 0 ? heroClass.palette.energy : heroClass.palette.accent
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(
          effect.x - Math.sin(angle) * offset,
          effect.y + Math.cos(angle) * offset,
          18 + eased * 38,
          angle - .75,
          angle + .75,
        )
        ctx.stroke()
      }
    } else if (heroClass.archetype === 'ranger') {
      for (const offset of [-6, 6]) {
        const arrowLength = length * (offset < 0 ? 1 : .86)
        const startX = effect.x + side.x * offset
        const startY = effect.y + side.y * offset
        const tipX = startX + direction.x * arrowLength
        const tipY = startY + direction.y * arrowLength
        ctx.strokeStyle = offset < 0 ? heroClass.palette.energy : heroClass.palette.accent
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(tipX, tipY)
        ctx.moveTo(tipX, tipY)
        ctx.lineTo(tipX - direction.x * 8 + side.x * 4, tipY - direction.y * 8 + side.y * 4)
        ctx.moveTo(tipX, tipY)
        ctx.lineTo(tipX - direction.x * 8 - side.x * 4, tipY - direction.y * 8 - side.y * 4)
        ctx.stroke()
      }
    } else if (heroClass.archetype === 'cryptographer') {
      for (const [index, offset] of [-7, 7].entries()) {
        const endX = effect.x + direction.x * length + side.x * offset
        const endY = effect.y + direction.y * length + side.y * offset
        ctx.strokeStyle = index === 0 ? heroClass.palette.energy : heroClass.palette.accent
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(effect.x + side.x * offset, effect.y + side.y * offset)
        ctx.lineTo(endX, endY)
        ctx.stroke()
        ctx.strokeRect(endX - 5, endY - 5, 10, 10)
        ctx.fillStyle = ctx.strokeStyle
        ctx.font = 'bold 6px "JetBrains Mono", monospace'
        ctx.textAlign = 'center'
        ctx.fillText(index === 0 ? 'p' : 'q', endX, endY - 8)
      }
    } else {
      for (const offset of [-7, 7]) {
        const endX = effect.x + direction.x * length + side.x * offset
        const endY = effect.y + direction.y * length + side.y * offset
        ctx.strokeStyle = offset < 0 ? heroClass.palette.energy : heroClass.palette.accent
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(effect.x, effect.y)
        ctx.quadraticCurveTo(
          effect.x + direction.x * length * .55 + side.x * offset * 2,
          effect.y + direction.y * length * .55 + side.y * offset * 2,
          endX,
          endY,
        )
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(endX, endY, 4 + eased * 4, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  } else if (effect.kind === 'sophie-chain') {
    const direction = directionVector(effect.facing)
    const side = { x: -direction.y, y: direction.x }
    const length = effect.radius * eased
    ctx.strokeStyle = heroClass.palette.energy
    ctx.lineWidth = 2
    if (heroClass.archetype === 'ranger') {
      const endX = effect.x + direction.x * length
      const endY = effect.y + direction.y * length
      ctx.beginPath()
      ctx.moveTo(effect.x, effect.y)
      ctx.quadraticCurveTo(
        effect.x + direction.x * length * .48 + side.x * 15 * alpha,
        effect.y + direction.y * length * .48 + side.y * 15 * alpha,
        endX,
        endY,
      )
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(endX, endY)
      ctx.lineTo(endX - direction.x * 9 + side.x * 5, endY - direction.y * 9 + side.y * 5)
      ctx.moveTo(endX, endY)
      ctx.lineTo(endX - direction.x * 9 - side.x * 5, endY - direction.y * 9 - side.y * 5)
      ctx.stroke()
    } else if (heroClass.archetype === 'cryptographer') {
      ctx.beginPath()
      ctx.moveTo(effect.x, effect.y)
      ctx.lineTo(
        effect.x + direction.x * length,
        effect.y + direction.y * length,
      )
      ctx.stroke()
      for (let node = 1; node <= 5; node += 1) {
        const nodeX = effect.x + direction.x * length * node / 5
        const nodeY = effect.y + direction.y * length * node / 5
        const size = node === 5 ? 10 : 6
        ctx.strokeStyle = node === 5 ? heroClass.palette.accent : heroClass.palette.energy
        ctx.strokeRect(nodeX - size / 2, nodeY - size / 2, size, size)
      }
    } else if (heroClass.archetype === 'arcanist') {
      ctx.beginPath()
      ctx.moveTo(effect.x, effect.y)
      ctx.lineTo(effect.x + direction.x * length, effect.y + direction.y * length)
      ctx.stroke()
      for (let glyph = 1; glyph <= 5; glyph += 1) {
        const glyphX = effect.x + direction.x * length * glyph / 5
        const glyphY = effect.y + direction.y * length * glyph / 5
        ctx.strokeStyle = glyph === 5 ? heroClass.palette.accent : heroClass.palette.energy
        ctx.beginPath()
        ctx.arc(glyphX, glyphY, 2 + glyph, 0, Math.PI * 2)
        ctx.stroke()
      }
    } else {
      ctx.strokeStyle = heroClass.palette.secondary
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(effect.x, effect.y)
      const segments = 7
      for (let index = 1; index <= segments; index += 1) {
        const segmentLength = length * (index / segments)
        const zigzag = (index % 2 ? 1 : -1) * 5 * alpha
        ctx.lineTo(
          effect.x + direction.x * segmentLength + side.x * zigzag,
          effect.y + direction.y * segmentLength + side.y * zigzag,
        )
      }
      ctx.stroke()
    }
    ctx.fillStyle = heroClass.palette.accent
    ctx.font = 'bold 7px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('p → 2p+1', effect.x + direction.x * effect.radius * .58, effect.y + direction.y * effect.radius * .58 - 8)
  } else if (effect.kind === 'mersenne-burst') {
    const values = [
      { prime: 3, formula: '2²−1' },
      { prime: 7, formula: '2³−1' },
      { prime: 31, formula: '2⁵−1' },
    ]
    values.forEach(({ prime, formula }, index) => {
      const waveProgress = reducedMotion
        ? .72
        : clamp((progress - index * .25) / .5, 0, 1)
      if (waveProgress <= 0) return
      const waveRadius = reducedMotion
        ? effect.radius * (.34 + index * .2)
        : 10 + waveProgress * effect.radius
      ctx.globalAlpha = reducedMotion
        ? alpha * (.82 - index * .1)
        : (1 - waveProgress) * .92
      ctx.strokeStyle = index === 2 ? heroClass.palette.accent : heroClass.palette.energy
      ctx.lineWidth = 2 + index
      ctx.beginPath()
      ctx.arc(effect.x, effect.y, waveRadius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.save()
      ctx.translate(effect.x, effect.y)
      ctx.rotate(Math.PI / 4 + index * .22 + (reducedMotion ? 0 : progress))
      ctx.strokeRect(-waveRadius * .58, -waveRadius * .58, waveRadius * 1.16, waveRadius * 1.16)
      for (let ray = 0; ray < 8; ray += 1) {
        const rayAngle = ray / 8 * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(Math.cos(rayAngle) * waveRadius * .35, Math.sin(rayAngle) * waveRadius * .35)
        ctx.lineTo(Math.cos(rayAngle) * waveRadius, Math.sin(rayAngle) * waveRadius)
        ctx.stroke()
      }
      ctx.restore()
      ctx.fillStyle = index === 2 ? heroClass.palette.accent : heroClass.palette.energy
      ctx.font = 'bold 6px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(
        `${formula} = ${prime}`,
        effect.x + Math.cos(index * 2.1) * waveRadius * .72,
        effect.y + Math.sin(index * 2.1) * waveRadius * .72,
      )
    })
  } else if (effect.kind === 'rsa-detonation') {
    const radius = 8 + eased * effect.radius
    ctx.save()
    ctx.translate(effect.x, effect.y)
    ctx.rotate(reducedMotion ? Math.PI / 4 : progress * Math.PI * 1.5)
    ctx.strokeStyle = heroClass.palette.energy
    ctx.lineWidth = 2.5
    ctx.strokeRect(-radius * .55, -radius * .55, radius * 1.1, radius * 1.1)
    ctx.rotate(Math.PI / 4)
    ctx.strokeStyle = heroClass.palette.accent
    ctx.strokeRect(-radius * .38, -radius * .38, radius * .76, radius * .76)
    ctx.restore()
    ctx.fillStyle = heroClass.palette.energy
    ctx.font = 'bold 8px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('p × q', effect.x, effect.y + 3)
  } else if (effect.kind === 'arrow-rain') {
    ctx.strokeStyle = heroClass.palette.energy
    ctx.fillStyle = heroClass.palette.accent
    ctx.lineWidth = 1.5
    for (let arrow = 0; arrow < 11; arrow += 1) {
      const offsetX = ((arrow * 29) % 23 - 11) / 12 * effect.radius
      const delay = (arrow % 4) * .12
      const fall = reducedMotion ? .72 : clamp((progress - delay) / .55, 0, 1)
      if (fall <= 0) continue
      const endY = effect.y - effect.radius * .65 + fall * effect.radius * 1.3
      ctx.globalAlpha = alpha * (1 - fall * .45)
      ctx.beginPath()
      ctx.moveTo(effect.x + offsetX + 8, endY - 22)
      ctx.lineTo(effect.x + offsetX, endY)
      ctx.stroke()
      fillPixel(ctx, effect.x + offsetX - 2, endY - 2, 4, 4, heroClass.palette.accent)
    }
  } else if (effect.kind === 'glyph-detonation') {
    const radius = 9 + eased * effect.radius
    ctx.strokeStyle = heroClass.palette.energy
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.save()
    ctx.translate(effect.x, effect.y)
    ctx.rotate(reducedMotion ? Math.PI / 4 : progress * Math.PI)
    ctx.strokeStyle = heroClass.palette.accent
    ctx.strokeRect(-radius * .55, -radius * .55, radius * 1.1, radius * 1.1)
    ctx.restore()
    ctx.fillStyle = heroClass.palette.energy
    ctx.font = 'bold 7px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('2p + 1', effect.x, effect.y + 2)
  } else if (effect.kind === 'constellation-pulse') {
    const radius = 12 + eased * effect.radius
    ctx.strokeStyle = heroClass.palette.accent
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let point = 0; point < 12; point += 1) {
      const pointAngle = point / 12 * Math.PI * 2 - Math.PI / 2
      const pointRadius = point % 2 === 0 ? radius : radius * .4
      const x = effect.x + Math.cos(pointAngle) * pointRadius
      const y = effect.y + Math.sin(pointAngle) * pointRadius
      if (point === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
  } else if (effect.kind === 'euclid-dash') {
    const direction = directionVector(effect.facing)
    const side = { x: -direction.y, y: direction.x }
    const primes = [2, 3, 5, 7, 11]
    for (const [index, prime] of primes.entries()) {
      const slashProgress = reducedMotion
        ? .82
        : clamp((progress - index * .08) / .5, 0, 1)
      if (slashProgress <= 0) continue
      const length = effect.radius * slashProgress
      const offset = (index - 2) * 6
      ctx.globalAlpha = alpha * (1 - index * .08)
      ctx.strokeStyle = index === primes.length - 1
        ? heroClass.palette.accent
        : heroClass.palette.energy
      ctx.lineWidth = 1.5 + index * .45
      ctx.beginPath()
      ctx.moveTo(effect.x + side.x * offset, effect.y + side.y * offset)
      ctx.lineTo(
        effect.x + direction.x * length + side.x * offset,
        effect.y + direction.y * length + side.y * offset,
      )
      ctx.stroke()
      ctx.fillStyle = heroClass.palette.accent
      ctx.font = 'bold 6px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(
        String(prime),
        effect.x + direction.x * length + side.x * offset,
        effect.y + direction.y * length + side.y * offset - 5,
      )
    }
  } else if (effect.kind === 'prime-resonance') {
    const radius = 7 + eased * effect.radius
    const rayCount = 13
    ctx.strokeStyle = heroClass.palette.energy
    ctx.fillStyle = heroClass.palette.accent
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(effect.x, effect.y, radius * .58, 0, Math.PI * 2)
    ctx.stroke()
    for (let ray = 0; ray < rayCount; ray += 1) {
      const rayAngle = ray / rayCount * Math.PI * 2 + (reducedMotion ? 0 : progress * .7)
      const inner = radius * (ray % 2 === 0 ? .64 : .76)
      const outer = radius * (ray % 3 === 0 ? 1.18 : 1)
      ctx.beginPath()
      ctx.moveTo(
        effect.x + Math.cos(rayAngle) * inner,
        effect.y + Math.sin(rayAngle) * inner,
      )
      ctx.lineTo(
        effect.x + Math.cos(rayAngle) * outer,
        effect.y + Math.sin(rayAngle) * outer,
      )
      ctx.stroke()
    }
    ctx.font = '900 9px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('PRIMO', effect.x, effect.y - radius - 4)
  } else if (effect.kind === 'prime-infinity') {
    const radius = reducedMotion ? effect.radius * .82 : 18 + eased * effect.radius
    const primes = [2, 3, 5, 7, 11]
    primes.forEach((prime, index) => {
      const waveProgress = reducedMotion
        ? .72
        : clamp((progress - index * .1) / .48, 0, 1)
      if (waveProgress <= 0) return
      const waveRadius = reducedMotion
        ? effect.radius * (.28 + index * .13)
        : 9 + waveProgress * effect.radius
      ctx.globalAlpha = reducedMotion
        ? alpha * (.82 - index * .08)
        : (1 - waveProgress) * .88
      ctx.strokeStyle = index === primes.length - 1
        ? heroClass.palette.accent
        : index % 2 ? heroClass.palette.energy : heroClass.palette.primary
      ctx.lineWidth = 1 + index * .65
      ctx.beginPath()
      ctx.arc(effect.x, effect.y, waveRadius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = heroClass.palette.accent
      ctx.font = 'bold 6px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      const primeAngle = -Math.PI / 2 + index / primes.length * Math.PI * 2 + (reducedMotion ? 0 : progress)
      ctx.fillText(
        String(prime),
        effect.x + Math.cos(primeAngle) * waveRadius,
        effect.y + Math.sin(primeAngle) * waveRadius,
      )
    })
    ctx.globalAlpha = Math.min(1, alpha * 1.35)
    ctx.strokeStyle = heroClass.palette.energy
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let point = 0; point < 7; point += 1) {
      const pointAngle = -Math.PI / 2 + point / 7 * Math.PI * 2 + (reducedMotion ? 0 : progress * .8)
      const px = effect.x + Math.cos(pointAngle) * radius * .72
      const py = effect.y + Math.sin(pointAngle) * radius * .72
      if (point === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.stroke()
    ctx.strokeStyle = heroClass.palette.accent
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(effect.x, effect.y, radius * .45, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = heroClass.palette.accent
    ctx.font = 'bold 13px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('∞', effect.x, effect.y + 4)
    ctx.font = 'bold 7px "JetBrains Mono", monospace'
    ctx.fillText(heroClass.affinity.formula, effect.x, effect.y - radius - 7)

    ctx.save()
    ctx.translate(effect.x, effect.y)
    ctx.rotate(reducedMotion ? 0 : progress * Math.PI * 1.5)
    ctx.globalAlpha = Math.min(1, alpha * 1.7)
    ctx.strokeStyle = heroClass.palette.primary
    ctx.fillStyle = heroClass.palette.energy
    ctx.lineWidth = 2
    if (heroClass.archetype === 'cryptographer') {
      for (const side of [-1, 1]) {
        ctx.save()
        ctx.translate(side * radius * .52, 0)
        ctx.rotate(Math.PI / 4)
        ctx.strokeRect(-8, -8, 16, 16)
        ctx.restore()
      }
      ctx.beginPath()
      ctx.moveTo(-radius * .45, 0)
      ctx.lineTo(radius * .45, 0)
      ctx.stroke()
      ctx.font = 'bold 7px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText('p', -radius * .52, 2)
      ctx.fillText('q', radius * .52, 2)
    } else if (heroClass.archetype === 'ranger') {
      for (let arrow = 0; arrow < 12; arrow += 1) {
        const arrowAngle = arrow / 12 * Math.PI * 2
        const inner = radius * .42
        const outer = radius * (.74 + (arrow % 3) * .08)
        ctx.beginPath()
        ctx.moveTo(Math.cos(arrowAngle) * inner, Math.sin(arrowAngle) * inner)
        ctx.lineTo(Math.cos(arrowAngle) * outer, Math.sin(arrowAngle) * outer)
        ctx.stroke()
      }
    } else if (heroClass.archetype === 'arcanist') {
      ctx.beginPath()
      for (let point = 0; point < 22; point += 1) {
        const pointAngle = -Math.PI / 2 + point / 22 * Math.PI * 2
        const pointRadius = point % 2 === 0 ? radius * .84 : radius * .38
        const pointX = Math.cos(pointAngle) * pointRadius
        const pointY = Math.sin(pointAngle) * pointRadius
        if (point === 0) ctx.moveTo(pointX, pointY)
        else ctx.lineTo(pointX, pointY)
      }
      ctx.closePath()
      ctx.stroke()
    } else {
      for (let blade = 0; blade < 4; blade += 1) {
        ctx.rotate(Math.PI / 2)
        ctx.beginPath()
        ctx.moveTo(-5, radius * .35)
        ctx.lineTo(0, radius * .86)
        ctx.lineTo(5, radius * .35)
        ctx.stroke()
      }
    }
    ctx.restore()
  } else {
    ctx.strokeStyle = effect.kind === 'parry'
      ? heroClass.palette.accent
      : heroClass.palette.energy
    ctx.lineWidth = effect.kind === 'parry' ? 4 : 2
    ctx.beginPath()
    ctx.arc(effect.x, effect.y, 10 + eased * effect.radius, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

function drawHeroCallout(ctx: CanvasRenderingContext2D, state: EngineState): void {
  const callout = state.callout
  if (!callout || callout.untilMs <= state.elapsedMs) return
  const remaining = callout.untilMs - state.elapsedMs
  const alpha = Math.min(1, remaining / 180)
  const isEnemyCallout = callout.source === 'enemy'
  const anchor = isEnemyCallout && callout.worldPosition
    ? callout.worldPosition
    : state.player
  const x = Math.round(anchor.x)
  const y = Math.round(anchor.y - (isEnemyCallout ? 48 : 36))
  const heroClass = getHeroClass(state.heroClassId)
  const enemyColor = callout.familyId
    ? ENEMY_PRIME_POWERS[callout.familyId].color
    : '#ff6b58'
  const accent = isEnemyCallout ? enemyColor : heroClass.palette.accent
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = 'bold 7px "JetBrains Mono", monospace'
  const titleWidth = Math.ceil(ctx.measureText(callout.title).width)
  ctx.font = 'bold 5px "JetBrains Mono", monospace'
  const detailWidth = isEnemyCallout ? Math.ceil(ctx.measureText(callout.detail).width) : 0
  const width = Math.min(205, Math.max(72, Math.max(titleWidth, detailWidth) + 18))
  const height = isEnemyCallout ? 25 : 16
  fillPixel(ctx, x - width / 2, y - 12, width, height, 'rgba(3, 8, 13, .94)')
  ctx.strokeStyle = accent
  ctx.lineWidth = isEnemyCallout && callout.phase === 3 ? 2 : 1
  ctx.strokeRect(Math.round(x - width / 2), y - 12, width, height)
  if (isEnemyCallout) {
    ctx.globalAlpha = alpha * .28
    fillPixel(ctx, x - width / 2 + 2, y - 10, 3, height - 4, accent)
    fillPixel(ctx, x + width / 2 - 5, y - 10, 3, height - 4, accent)
    ctx.globalAlpha = alpha
  }
  ctx.fillStyle = isEnemyCallout ? '#fff5ea' : heroClass.palette.energy
  ctx.font = 'bold 7px "JetBrains Mono", monospace'
  ctx.textAlign = 'center'
  ctx.fillText(callout.title.toUpperCase(), x, y - (isEnemyCallout ? 3 : 2))
  if (isEnemyCallout) {
    ctx.fillStyle = accent
    ctx.font = 'bold 5px "JetBrains Mono", monospace'
    ctx.fillText(callout.detail.toUpperCase(), x, y + 6)
  }
  ctx.beginPath()
  const pointerY = y - 12 + height
  ctx.moveTo(x - 3, pointerY)
  ctx.lineTo(x + 3, pointerY)
  ctx.lineTo(x, pointerY + 5)
  ctx.closePath()
  ctx.fillStyle = accent
  ctx.fill()
  ctx.restore()
}

function drawHeroTransformationOverlay(
  ctx: CanvasRenderingContext2D,
  state: EngineState,
  definition: HeroTransformationDefinition,
  reducedMotion: boolean,
): void {
  const intro = state.transformationIntro
  if (!intro) return
  const elapsedMs = clamp(state.elapsedMs - intro.startedAtMs, 0, intro.durationMs)
  const progress = clamp(elapsedMs / intro.durationMs, 0, 1)
  const impactProgress = clamp(elapsedMs / Math.max(1, intro.impactAtMs), 0, 1)
  const fadeOut = clamp((1 - progress) / .14, 0, 1)
  const pulse = reducedMotion ? 1 : .72 + Math.sin(elapsedMs * .028) * .28

  ctx.save()
  ctx.globalAlpha = Math.min(1, fadeOut)
  fillPixel(
    ctx,
    0,
    0,
    VIEW_WIDTH,
    VIEW_HEIGHT,
    `rgba(2, 3, 10, ${definition.cinematic.maxDarkness * (1 - impactProgress * .58)})`,
  )

  const centerX = VIEW_WIDTH / 2
  const centerY = VIEW_HEIGHT / 2 - 8
  const radial = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, 185)
  radial.addColorStop(0, `${definition.palette.auraCore}${intro.released ? 'cf' : '58'}`)
  radial.addColorStop(.28, `${definition.palette.energy}48`)
  radial.addColorStop(1, `${definition.palette.shadow}00`)
  ctx.fillStyle = radial
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

  ctx.save()
  ctx.translate(centerX, centerY)
  const zoomEnvelope = Math.sin(progress * Math.PI)
  const motifZoom = reducedMotion
    ? 1
    : 1 + (definition.cinematic.peakZoom - 1) * zoomEnvelope
  ctx.scale(motifZoom, motifZoom)
  ctx.globalCompositeOperation = 'lighter'
  const rayLength = 78 + impactProgress * 170
  ctx.strokeStyle = intro.released ? definition.palette.flash : definition.palette.energy
  ctx.lineWidth = intro.released ? 2 : 1
  for (let ray = 0; ray < definition.cinematic.rayCount; ray += 1) {
    const angle = ray / definition.cinematic.rayCount * Math.PI * 2
      + (reducedMotion ? 0 : elapsedMs * .0008 * (ray % 2 ? -1 : 1))
    const inner = 18 + (ray % 4) * 5
    const outer = rayLength * (.58 + (ray % 5) * .09) * pulse
    ctx.globalAlpha = .18 + (ray % 3) * .08
    ctx.beginPath()
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
    ctx.stroke()
  }

  ctx.globalAlpha = .58
  ctx.strokeStyle = definition.palette.primary
  ctx.lineWidth = 2
  if (definition.cinematic.style === 'sword-sky-split') {
    ctx.beginPath()
    ctx.moveTo(-92, 128)
    ctx.lineTo(48, -145)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-38, 135)
    ctx.lineTo(96, -126)
    ctx.stroke()
  } else if (definition.cinematic.style === 'dual-key-decryption') {
    for (const side of [-1, 1]) {
      ctx.save()
      ctx.translate(side * (36 + impactProgress * 48), 0)
      ctx.rotate(Math.PI / 4 + (reducedMotion ? 0 : elapsedMs * .002 * side))
      ctx.strokeRect(-22, -22, 44, 44)
      ctx.restore()
    }
  } else if (definition.cinematic.style === 'horizon-orbit-break') {
    for (let line = -2; line <= 2; line += 1) {
      ctx.beginPath()
      ctx.moveTo(-VIEW_WIDTH / 2, line * 18)
      ctx.lineTo(VIEW_WIDTH / 2, line * 18 - impactProgress * line * 5)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(0, 0, 52 + impactProgress * 55, 0, Math.PI * 2)
    ctx.stroke()
  } else if (definition.cinematic.style === 'mobius-inversion-vanish') {
    for (let echo = 0; echo < definition.cinematic.afterimageCount; echo += 1) {
      const side = echo % 2 ? -1 : 1
      const offset = (echo + 1) * 13 * (1 - impactProgress)
      ctx.globalAlpha = .16 + echo / definition.cinematic.afterimageCount * .34
      ctx.beginPath()
      ctx.ellipse(side * offset, 0, 58 + echo * 5, 17, side * .62, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = .76
    ctx.font = '900 24px "Space Grotesk", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(impactProgress > .72 ? '0' : '−1  +1', 0, 8)
  } else if (definition.cinematic.style === 'goldbach-even-world-break') {
    const separation = 110 * (1 - impactProgress)
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(side * separation, 0, 22 + impactProgress * 38, 0, Math.PI * 2)
      ctx.stroke()
    }
    for (let crack = 0; crack < 14; crack += 1) {
      const angle = crack / 14 * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(angle) * 14, Math.sin(angle) * 14)
      ctx.lineTo(Math.cos(angle) * (42 + impactProgress * 105), Math.sin(angle) * (28 + impactProgress * 76))
      ctx.stroke()
    }
  } else if (definition.cinematic.style === 'sieve-composite-erasure') {
    const extent = 55 + impactProgress * 105
    for (let line = -5; line <= 5; line += 1) {
      const offset = line * extent / 5
      ctx.globalAlpha = line % 2 === 0 ? .72 : .35
      ctx.beginPath()
      ctx.moveTo(-extent, offset * .56)
      ctx.lineTo(extent, offset * .56)
      ctx.moveTo(offset, -extent * .56)
      ctx.lineTo(offset, extent * .56)
      ctx.stroke()
    }
  } else if (definition.cinematic.style === 'elliptic-point-at-infinity') {
    for (const rotation of [-.8, -.4, 0, .4, .8]) {
      ctx.beginPath()
      ctx.ellipse(0, 0, 72 + impactProgress * 70, 25 + impactProgress * 18, rotation, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.font = '900 34px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('𝒪', 0, 11)
  } else {
    ctx.beginPath()
    for (let point = 0; point < 62; point += 1) {
      const angle = -Math.PI / 2 + point / 62 * Math.PI * 2
      const pointRadius = point % 2 === 0 ? 94 + impactProgress * 45 : 42
      const pointX = Math.cos(angle) * pointRadius
      const pointY = Math.sin(angle) * pointRadius
      if (point === 0) ctx.moveTo(pointX, pointY)
      else ctx.lineTo(pointX, pointY)
    }
    ctx.closePath()
    ctx.stroke()
  }
  ctx.restore()

  if (intro.released && !reducedMotion) {
    ctx.globalAlpha = Math.max(0, 1 - (elapsedMs - intro.impactAtMs) / 190) * .88
    fillPixel(ctx, 0, 0, VIEW_WIDTH, VIEW_HEIGHT, definition.palette.flash)
  }

  const reveal = reducedMotion ? 1 : clamp((progress - .08) / .18, 0, 1)
  ctx.globalAlpha = reveal * fadeOut
  ctx.textAlign = 'center'
  ctx.fillStyle = definition.palette.energy
  ctx.font = 'bold 6px "JetBrains Mono", monospace'
  ctx.fillText(definition.title.toUpperCase(), centerX, 45)
  ctx.fillStyle = '#fffdf4'
  ctx.font = 'bold 20px "Space Grotesk", sans-serif'
  ctx.fillText(definition.name.toUpperCase(), centerX, 69)
  ctx.fillStyle = definition.palette.primary
  ctx.font = 'bold 8px "JetBrains Mono", monospace'
  ctx.fillText(definition.formula, centerX, 85)
  ctx.globalAlpha = reveal * fadeOut * .66
  ctx.fillStyle = definition.palette.energy
  ctx.font = 'bold 5px "JetBrains Mono", monospace'
  ctx.fillText(definition.identity.halo.toUpperCase(), centerX, 197)

  const spokenLine = intro.released
    ? definition.cinematic.releaseLine
    : definition.cinematic.openingLine
  ctx.globalAlpha = (intro.released ? 1 : .72) * fadeOut
  fillPixel(ctx, 62, 206, VIEW_WIDTH - 124, 27, 'rgba(3, 7, 14, .88)')
  ctx.strokeStyle = definition.palette.energy
  ctx.strokeRect(62, 206, VIEW_WIDTH - 124, 27)
  ctx.fillStyle = intro.released ? definition.palette.flash : '#e8edf5'
  ctx.font = 'bold 7px "JetBrains Mono", monospace'
  ctx.fillText(spokenLine.toUpperCase(), centerX, 223)
  ctx.restore()
}

function storyCutsceneFocus(
  state: EngineState,
  snapshot: StoryCutsceneSnapshot,
): Vec2 {
  const size = worldSize(state.areaId)
  const guardian = snapshot.kind === 'guardian-reveal'
    ? state.enemies.find((enemy) =>
        PRIMEBOUND_ENEMIES[enemy.id].encounterRank !== 'minion',
      )
    : null
  const landmark = runeForArea(state.areaId)
  const landmarkPosition = landmark
    ? gridToWorld(landmark.position)
    : { x: size.x * .62, y: size.y * .48 }
  switch (snapshot.currentBeat?.shotTarget) {
    case 'hero':
      return { x: state.player.x, y: state.player.y }
    case 'guardian':
      return guardian ?? landmarkPosition
    case 'landmark':
      return landmarkPosition
    case 'wide':
    default:
      return guardian
        ? { x: (state.player.x + guardian.x) / 2, y: (state.player.y + guardian.y) / 2 }
        : { x: size.x / 2, y: size.y / 2 }
  }
}


function storyHash(seed: number): number {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

/**
 * Screen-space cinema pass for story cutscenes: letterbox bars, film grain,
 * glitch slices and distorted floating numbers — the same visual language the
 * terror game's hallucinations taught us, tinted per scene kind.
 */
function drawStoryCutsceneOverlay(
  ctx: CanvasRenderingContext2D,
  state: EngineState,
  snapshot: StoryCutsceneSnapshot,
  envelope: number,
  reducedMotion: boolean,
): void {
  const sceneTimeMs = snapshot.completedDurationMs + state.storyCutsceneBeatElapsedMs
  const accent = snapshot.kind === 'guardian-reveal'
    ? '#ff5148'
    : snapshot.kind === 'finale'
      ? '#8df8f2'
      : AREA_ACCENTS[state.areaId]
  const effect = snapshot.currentBeat?.effect ?? 'none'

  // Glitch slices first so everything drawn after stays crisp on top of them.
  if (!reducedMotion && snapshot.kind !== 'area-entry' && (effect === 'shake' || effect === 'pulse')) {
    const sliceCount = effect === 'shake' ? 3 : 1
    for (let index = 0; index < sliceCount; index += 1) {
      const jitterSeed = Math.floor(sceneTimeMs / 110) * 7 + index * 13
      if (storyHash(jitterSeed) < .45) continue
      const sliceY = Math.floor(storyHash(jitterSeed + 1) * (VIEW_HEIGHT - 40)) + 20
      const sliceHeight = 3 + Math.floor(storyHash(jitterSeed + 2) * 6)
      const offset = Math.round((storyHash(jitterSeed + 3) - .5) * 14 * envelope)
      if (offset !== 0) {
        ctx.drawImage(
          ctx.canvas,
          0, sliceY, VIEW_WIDTH, sliceHeight,
          offset, sliceY, VIEW_WIDTH, sliceHeight,
        )
      }
    }
  }

  // Letterbox bars sliding in over the first breath of the scene.
  const barReveal = reducedMotion ? 1 : clamp(sceneTimeMs / 420, 0, 1)
  const barHeight = Math.round(26 * (1 - (1 - barReveal) ** 3))
  ctx.fillStyle = '#040308'
  ctx.fillRect(0, 0, VIEW_WIDTH, barHeight)
  ctx.fillRect(0, VIEW_HEIGHT - barHeight, VIEW_WIDTH, barHeight)
  ctx.globalAlpha = .5
  ctx.fillStyle = accent
  ctx.fillRect(0, barHeight, VIEW_WIDTH, 1)
  ctx.fillRect(0, VIEW_HEIGHT - barHeight - 1, VIEW_WIDTH, 1)
  ctx.globalAlpha = 1

  // Kind-specific atmosphere between the bars.
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, barHeight, VIEW_WIDTH, VIEW_HEIGHT - barHeight * 2)
  ctx.clip()

  if (snapshot.kind === 'guardian-reveal' || snapshot.kind === 'finale') {
    const guardian = state.enemies.find((enemy) =>
      PRIMEBOUND_ENEMIES[enemy.id].encounterRank !== 'minion',
    )
    const number = snapshot.kind === 'finale'
      ? 257
      : guardian
        ? PRIMEBOUND_ENEMIES[guardian.id].number
        : 91
    const digits = snapshot.kind === 'finale'
      ? ['2', '5', '7', '257', '∞']
      : [`${number}`, ...distinctPrimeFactors(number).map(String)]
    ctx.textAlign = 'center'
    for (let index = 0; index < 7; index += 1) {
      const seed = index * 31 + 5
      const drift = reducedMotion ? 0 : (sceneTimeMs * (.006 + storyHash(seed) * .012)) % (VIEW_HEIGHT + 60)
      const x = 24 + storyHash(seed + 1) * (VIEW_WIDTH - 48)
      const y = VIEW_HEIGHT + 20 - drift
      const jitterX = reducedMotion ? 0 : (storyHash(Math.floor(sceneTimeMs / 90) + seed) - .5) * 4 * envelope
      const glyph = digits[index % digits.length]
      const size = 7 + Math.floor(storyHash(seed + 2) * 9)
      ctx.font = `bold ${size}px "JetBrains Mono", monospace`
      ctx.globalAlpha = .1 + storyHash(seed + 3) * .16
      if (!reducedMotion && snapshot.kind === 'guardian-reveal') {
        ctx.fillStyle = '#3ee0ff'
        ctx.fillText(glyph, x + jitterX - 1, y)
        ctx.fillStyle = '#ff3b30'
        ctx.fillText(glyph, x + jitterX + 1, y)
      }
      ctx.fillStyle = accent
      ctx.fillText(glyph, x + jitterX, y)
    }
    ctx.globalAlpha = 1
  } else {
    // Area entry: slow golden motes rising, the world taking a first breath.
    for (let index = 0; index < 10; index += 1) {
      const seed = index * 17 + 3
      const rise = reducedMotion ? 30 + index * 20 : (sceneTimeMs * (.008 + storyHash(seed) * .01)) % (VIEW_HEIGHT + 20)
      const x = storyHash(seed + 1) * VIEW_WIDTH + Math.sin(sceneTimeMs * .0011 + index) * 9
      const y = VIEW_HEIGHT + 8 - rise
      ctx.globalAlpha = .12 + storyHash(seed + 2) * .2
      ctx.fillStyle = accent
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
    }
    ctx.globalAlpha = 1
  }

  // Effect punctuation: pulse rings out from center, fade closes the iris.
  if (effect === 'pulse' && !reducedMotion) {
    const radius = 30 + envelope * 150
    ctx.globalAlpha = Math.max(0, .34 - envelope * .3)
    ctx.strokeStyle = accent
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  if (effect === 'fade') {
    const iris = ctx.createRadialGradient(
      VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 40 + (1 - envelope) * 90,
      VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 250,
    )
    iris.addColorStop(0, 'rgba(4, 3, 8, 0)')
    iris.addColorStop(1, `rgba(4, 3, 8, ${.55 + envelope * .3})`)
    ctx.fillStyle = iris
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
  }

  // Film grain over everything inside the frame.
  if (!reducedMotion) {
    const grainSeed = Math.floor(sceneTimeMs / 80)
    ctx.fillStyle = '#f5edda'
    for (let index = 0; index < 46; index += 1) {
      ctx.globalAlpha = .028 + storyHash(grainSeed + index * 3 + 1) * .04
      ctx.fillRect(
        Math.floor(storyHash(grainSeed + index * 3) * VIEW_WIDTH),
        Math.floor(storyHash(grainSeed + index * 3 + 2) * VIEW_HEIGHT),
        1, 1,
      )
    }
    ctx.globalAlpha = 1
  }
  ctx.restore()
}

export interface PrimeboundPeerGhost {
  readonly id: string
  readonly nickname: string
  readonly x: number
  readonly y: number
}

/**
 * Draws a party member as a translucent pixel ghost with their name. Peers are
 * presence, not physics: they collide with nothing and threaten nothing.
 */
function drawPeerGhost(ctx: CanvasRenderingContext2D, ghost: PrimeboundPeerGhost, time: number): void {
  const x = Math.round(ghost.x)
  const y = Math.round(ghost.y + Math.sin(time * 0.004 + ghost.x * 0.05) * 1.5)
  ctx.save()
  ctx.globalAlpha = 0.55
  ctx.fillStyle = '#9ff2ff'
  ctx.fillRect(x - 7, y - 22, 14, 16)
  ctx.fillRect(x - 5, y - 30, 10, 9)
  ctx.fillStyle = '#0c2733'
  ctx.fillRect(x - 3, y - 27, 2, 3)
  ctx.fillRect(x + 1, y - 27, 2, 3)
  ctx.globalAlpha = 0.85
  ctx.fillStyle = '#dffaff'
  ctx.font = '7px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(ghost.nickname.slice(0, 12), x, y - 34)
  ctx.restore()
}

function drawWorld(
  ctx: CanvasRenderingContext2D,
  state: EngineState,
  reducedMotion: boolean,
  frameDeltaSeconds: number,
  peers: readonly PrimeboundPeerGhost[] = [],
) {
  const area = PRIMEBOUND_AREAS[state.areaId]
  const size = worldSize(state.areaId)
  const heroClass = getHeroClass(state.heroClassId)
  const transformationDefinition = activeHeroTransformation(state) || state.transformationIntro
    ? resolveHeroTransformationDefinition(state.heroClassId)
    : null
  const cinematicProgress = state.cinematic
    ? getCinematicProgress(state.cinematic.actionId, state.cinematic.elapsedMs, reducedMotion)
    : null
  const cinematicChannels = cinematicProgress
    ? classCinematicChannels(state, cinematicProgress, reducedMotion)
    : null
  const storySnapshot = state.storyCutscene
    ? getStoryCutsceneSnapshot(state.storyCutscene)
    : null
  const storyFocus = storySnapshot ? storyCutsceneFocus(state, storySnapshot) : null
  const storyBeatDurationMs = storySnapshot?.currentBeat?.durationMs ?? 0
  const storyBeatProgress = storyBeatDurationMs > 0
    ? clamp(state.storyCutsceneBeatElapsedMs / storyBeatDurationMs, 0, 1)
    : 0
  const storyEnvelope = Math.sin(storyBeatProgress * Math.PI)
  const dramaticEnemyEffect = cinematicProgress || storySnapshot ? null : activeDramaticEnemyEffect(state)
  const dramaticEnemyAnime = dramaticEnemyEffect
    ? resolveEnemyPrimePowerAnimePresentation(
        dramaticEnemyEffect.familyId,
        dramaticEnemyEffect.phase,
      )
    : null
  const dramaticEnemyProgress = dramaticEnemyEffect
    ? clamp(
        (state.elapsedMs - dramaticEnemyEffect.startedAtMs) / dramaticEnemyEffect.durationMs,
        0,
        1,
      )
    : 0
  const dramaticEnemyEnvelope = dramaticEnemyEffect
    ? reducedMotion
      ? 0
      : Math.min(1, dramaticEnemyProgress / .12, (1 - dramaticEnemyProgress) / .3)
    : 0
  const cameraTarget = storyFocus ?? state.player
  const targetCameraX = clamp(cameraTarget.x - VIEW_WIDTH / 2, 0, Math.max(0, size.x - VIEW_WIDTH))
  const targetCameraY = clamp(cameraTarget.y - VIEW_HEIGHT / 2, 0, Math.max(0, size.y - VIEW_HEIGHT))
  const cameraFollow = storyFocus
    ? reducedMotion
      ? 1
      : 1 - Math.exp(-4.68 * Math.min(frameDeltaSeconds, .1))
    : .12
  state.camera = {
    x: state.camera.x + (targetCameraX - state.camera.x) * cameraFollow,
    y: state.camera.y + (targetCameraY - state.camera.y) * cameraFollow,
  }
  const cinematicClock = state.cinematic?.elapsedMs
    ?? (storySnapshot ? state.storyCutsceneBeatElapsedMs : state.elapsedMs)
  const storyShake = !reducedMotion && storySnapshot?.currentBeat?.effect === 'shake'
    ? storyEnvelope * 3
    : 0
  const totalShake = cinematicProgress
    ? Math.max(state.shake, cinematicChannels?.shake ?? 0)
    : storySnapshot
      ? storyShake
    : Math.max(
        state.shake,
        (dramaticEnemyAnime?.shakePx ?? 0) * dramaticEnemyEnvelope * .55,
      )
  const shakeScale = cinematicProgress
    ? CINEMATIC_CAMERA_SHAKE_SCALE
    : storySnapshot
      ? STORY_CAMERA_SHAKE_SCALE
      : GAMEPLAY_CAMERA_SHAKE_SCALE
  const visibleShake = totalShake * shakeScale
  const shakeX = reducedMotion ? 0 : Math.sin(cinematicClock * .032) * visibleShake
  const shakeY = reducedMotion ? 0 : Math.cos(cinematicClock * .041) * visibleShake * .33
  let cinematicScreenFocus: Vec2 = { x: VIEW_WIDTH / 2, y: VIEW_HEIGHT / 2 }

  fillPixel(ctx, 0, 0, VIEW_WIDTH, VIEW_HEIGHT, area.palette[0])
  ctx.save()
  if (cinematicProgress && cinematicChannels && state.cinematic) {
    const cinematicDefinition = heroCinematicForState(state, state.cinematic.actionId)
    const zoomRange = Math.max(0, cinematicDefinition.visual.peakZoom - 1)
    const focusAmount = zoomRange > 0
      ? clamp((cinematicChannels.zoom - 1) / zoomRange, 0, 1)
      : 0
    const zoom = reducedMotion ? 1 : Math.max(1, Math.round(cinematicChannels.zoom * 32) / 32)
    const halfWidth = VIEW_WIDTH / (2 * zoom)
    const halfHeight = VIEW_HEIGHT / (2 * zoom)
    const normalCenterX = state.camera.x + VIEW_WIDTH / 2
    const normalCenterY = state.camera.y + VIEW_HEIGHT / 2
    const focusCenterX = clamp(state.cinematic.focus.x, halfWidth, Math.max(halfWidth, size.x - halfWidth))
    const focusCenterY = clamp(state.cinematic.focus.y, halfHeight, Math.max(halfHeight, size.y - halfHeight))
    const centerX = normalCenterX + (focusCenterX - normalCenterX) * focusAmount
    const centerY = normalCenterY + (focusCenterY - normalCenterY) * focusAmount
    const quantizedCenterX = Math.round(centerX * zoom) / zoom
    const quantizedCenterY = Math.round(centerY * zoom) / zoom
    cinematicScreenFocus = {
      x: VIEW_WIDTH / 2 + Math.round(shakeX) + (state.cinematic.focus.x - quantizedCenterX) * zoom,
      y: VIEW_HEIGHT / 2 + Math.round(shakeY) + (state.cinematic.focus.y - quantizedCenterY) * zoom,
    }
    ctx.translate(VIEW_WIDTH / 2 + Math.round(shakeX), VIEW_HEIGHT / 2 + Math.round(shakeY))
    ctx.scale(zoom, zoom)
    ctx.translate(-quantizedCenterX, -quantizedCenterY)
  } else if (storySnapshot && storyFocus) {
    const shotZoom = storySnapshot.currentBeat?.shotTarget === 'guardian'
      ? 1.14
      : storySnapshot.currentBeat?.shotTarget === 'hero'
        ? 1.08
        : storySnapshot.currentBeat?.shotTarget === 'landmark' ? 1.06 : 1.02
    const zoom = reducedMotion ? 1 : 1 + (shotZoom - 1) * (.35 + storyEnvelope * .65)
    const centerX = state.camera.x + VIEW_WIDTH / 2
    const centerY = state.camera.y + VIEW_HEIGHT / 2
    ctx.translate(VIEW_WIDTH / 2 + Math.round(shakeX), VIEW_HEIGHT / 2 + Math.round(shakeY))
    ctx.scale(zoom, zoom)
    ctx.translate(-centerX, -centerY)
  } else if (dramaticEnemyEffect && dramaticEnemyAnime && dramaticEnemyEnvelope > 0) {
    const zoom = 1 + (dramaticEnemyAnime.zoomScale - 1) * dramaticEnemyEnvelope * .65
    const halfWidth = VIEW_WIDTH / (2 * zoom)
    const halfHeight = VIEW_HEIGHT / (2 * zoom)
    const normalCenterX = state.camera.x + VIEW_WIDTH / 2
    const normalCenterY = state.camera.y + VIEW_HEIGHT / 2
    const focusX = clamp(dramaticEnemyEffect.x, halfWidth, Math.max(halfWidth, size.x - halfWidth))
    const focusY = clamp(dramaticEnemyEffect.y, halfHeight, Math.max(halfHeight, size.y - halfHeight))
    const focusStrength = (dramaticEnemyEffect.kind === 'phase-break' ? .12 : .05) * dramaticEnemyEnvelope
    const centerX = normalCenterX + (focusX - normalCenterX) * focusStrength
    const centerY = normalCenterY + (focusY - normalCenterY) * focusStrength
    ctx.translate(VIEW_WIDTH / 2 + Math.round(shakeX), VIEW_HEIGHT / 2 + Math.round(shakeY))
    ctx.scale(zoom, zoom)
    ctx.translate(-centerX, -centerY)
  } else {
    ctx.translate(-Math.round(state.camera.x) + Math.round(shakeX), -Math.round(state.camera.y) + Math.round(shakeY))
  }
  fillPixel(ctx, 0, 0, size.x, size.y, area.palette[0])

  const areaTileMap = tileMapFor(area)
  for (let tileY = 0; tileY < areaTileMap.length; tileY += 1) {
    for (let tileX = 0; tileX < areaTileMap[tileY].length; tileX += 1) {
      const tile = areaTileMap[tileY][tileX]
      const x = tileX * TILE_SIZE
      const y = tileY * TILE_SIZE
      if (tile === '#' || tile === '~' || tile === '^') drawSolidTile(ctx, state.areaId, tile, x, y, tileX, tileY, state.elapsedMs)
      else drawGroundTile(ctx, state.areaId, tile, x, y, tileX, tileY, state.elapsedMs)
      if (tile === 'D') {
        const easternExit = tileX === areaTileMap[tileY].length - 1
        const open = !easternExit || canUseEasternGate(state)
        drawDoor(ctx, state.areaId, x, y, open, state.elapsedMs)
      }
    }
  }

  const rune = runeForArea(state.areaId)
  if (rune && isRuneUnlocked(state) && !state.progress.collectedRunes.includes(rune.value)) {
    drawRune(ctx, gridToWorld(rune.position), rune.value, state.elapsedMs)
  }

  const shrineTile = shrineTileForArea(state.areaId)
  if (shrineTile) {
    drawShrine(
      ctx,
      gridToWorld(shrineTile),
      state.elapsedMs,
      state.blessedShrineAreaIds.includes(state.areaId),
    )
  }

  for (const npcId of area.npcIds) {
    const npc = PRIMEBOUND_NPCS[npcId]
    drawNpc(ctx, npcId, gridToWorld(npc.position), state.elapsedMs, state.progress.spokenNpcIds.includes(npcId))
  }

  for (const zone of state.spellZones) {
    drawSpellZone(ctx, zone, heroClass, state.elapsedMs, reducedMotion, transformationDefinition)
  }

  for (const effect of state.enemyPowerEffects) {
    drawEnemyPrimePowerEffect(ctx, effect, state.elapsedMs, reducedMotion)
  }
  for (const projectile of state.projectiles) {
    drawEnemyProjectile(ctx, projectile, state.elapsedMs, reducedMotion)
  }
  for (const projectile of state.heroProjectiles) {
    drawHeroProjectile(ctx, projectile, heroClass, state.elapsedMs, reducedMotion, transformationDefinition)
  }
  ctx.globalAlpha = 1

  if (cinematicProgress) {
    drawCinematicSigil(ctx, state, cinematicProgress, reducedMotion, heroClass)
  }

  if (state.areaId === 'goldbach-citadel') {
    const goldbachPair = state.enemies.filter((enemy) =>
      enemy.hp > 0 && (enemy.id === 'twenty-two-pair' || enemy.id === 'twenty-six-pair'),
    )
    if (goldbachPair.length === 2) {
      const pulse = reducedMotion ? .45 : .34 + Math.sin(state.elapsedMs * .012) * .14
      ctx.save()
      ctx.globalAlpha = pulse
      ctx.strokeStyle = '#ffd37d'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.moveTo(goldbachPair[0].x, goldbachPair[0].y)
      ctx.lineTo(goldbachPair[1].x, goldbachPair[1].y)
      ctx.stroke()
      ctx.restore()
    }
  }

  const renderables: Array<{ y: number; draw: () => void }> = [
    {
      y: state.player.y,
      draw: () => drawPlayer(
        ctx,
        state.player,
        state.elapsedMs,
        cinematicProgress,
        heroClass,
        state.primeAscensionUntilMs > state.elapsedMs,
        state.primeChainCount,
        reducedMotion,
        transformationDefinition,
      ),
    },
    ...state.enemies.map((enemy) => ({
      y: enemy.y,
      draw: () => {
        drawEnemy(ctx, enemy, state.elapsedMs)
        drawEnemyClassStatus(ctx, state, enemy)
      },
    })),
    ...peers.map((ghost) => ({
      y: ghost.y,
      draw: () => drawPeerGhost(ctx, ghost, state.elapsedMs),
    })),
  ]
  renderables.sort((first, second) => first.y - second.y).forEach((item) => item.draw())

  for (const effect of state.combatEffects) {
    drawCombatEffect(
      ctx,
      effect,
      effect.usesPresentationClock
        ? state.presentationElapsedMs
        : state.elapsedMs,
      reducedMotion,
    )
  }
  if (!state.cinematic && !state.storyCutscene) drawHeroCallout(ctx, state)

  for (const particle of state.particles) {
    ctx.globalAlpha = clamp(particle.lifeMs / particle.maxLifeMs, 0, 1)
    fillPixel(ctx, particle.x, particle.y, particle.size, particle.size, particle.color)
  }
  ctx.globalAlpha = 1
  ctx.restore()

  const vignette = ctx.createRadialGradient(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 70, VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 285)
  vignette.addColorStop(0, 'rgba(2, 6, 10, 0)')
  vignette.addColorStop(1, 'rgba(2, 5, 9, .65)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

  if (storySnapshot) {
    drawStoryCutsceneOverlay(ctx, state, storySnapshot, storyEnvelope, reducedMotion)
  }

  if (!state.cinematic && !state.storyCutscene) {
    drawEnemyAnimeOverlay(ctx, state, reducedMotion)
  }

  if (state.transformationIntro && transformationDefinition && !state.cinematic && !state.storyCutscene) {
    drawHeroTransformationOverlay(ctx, state, transformationDefinition, reducedMotion)
  }

  if (cinematicProgress && cinematicChannels) {
    drawCinematicOverlay(
      ctx,
      state,
      cinematicProgress,
      reducedMotion,
      cinematicScreenFocus,
      heroClass,
      cinematicChannels.darkness,
    )
    drawPerfectUltimateFinalizer(
      ctx,
      state,
      cinematicProgress,
      reducedMotion,
      cinematicScreenFocus,
      heroClass,
    )
  }

  if (!state.cinematic && !state.storyCutscene && state.areaBannerUntilMs > state.elapsedMs) {
    const remaining = state.areaBannerUntilMs - state.elapsedMs
    ctx.globalAlpha = Math.min(1, remaining / 400)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#f7edce'
    ctx.font = 'bold 12px "Space Grotesk", sans-serif'
    ctx.fillText(area.name.toUpperCase(), VIEW_WIDTH / 2, 67)
    ctx.fillStyle = AREA_ACCENTS[state.areaId]
    ctx.font = '5px "JetBrains Mono", monospace'
    ctx.fillText(area.subtitle.toUpperCase(), VIEW_WIDTH / 2, 79)
    ctx.globalAlpha = 1
  }
}

function cooldownSnapshot(player: PlayerState, nowMs: number): Readonly<Record<CombatCooldownId, number>> {
  return {
    'basic-strike': getCooldownRemaining(player.cooldowns, 'basic-strike', nowMs),
    'twin-blades': getCooldownRemaining(player.cooldowns, 'twin-blades', nowMs),
    'sophie-chain': getCooldownRemaining(player.cooldowns, 'sophie-chain', nowMs),
    'mersenne-burst': getCooldownRemaining(player.cooldowns, 'mersenne-burst', nowMs),
    'prime-infinity': getCooldownRemaining(player.cooldowns, 'prime-infinity', nowMs),
    'irreducible-aegis': Math.max(0, player.defense.cooldownUntilMs - nowMs),
  }
}

function classResourceSnapshot(
  state: EngineState,
): Pick<
  HudState,
  'classResourceLabel' | 'classResourceValue' | 'classResourceMax' | 'classResourceDetail'
> {
  const archetype = getHeroClass(state.heroClassId).archetype
  if (archetype === 'warrior') {
    const comboDetails = [
      'J: 2 → 3 → 5',
      '2 · próximo: 3',
      '2 × 3 · finalize: 5',
      '5 · ruptura pronta',
    ] as const
    return {
      classResourceLabel: 'COMBO PRIMO',
      classResourceValue: state.player.warriorComboStep,
      classResourceMax: 3,
      classResourceDetail: comboDetails[state.player.warriorComboStep],
    }
  }
  if (archetype === 'cryptographer') {
    const strongestKey = state.enemies
      .filter((enemy) => enemy.hp > 0 && enemy.rsaMarkUntilMs > state.elapsedMs)
      .sort((first, second) => {
        const firstBits = (first.rsaMark & 1 ? 1 : 0) + (first.rsaMark & 2 ? 1 : 0)
        const secondBits = (second.rsaMark & 1 ? 1 : 0) + (second.rsaMark & 2 ? 1 : 0)
        return secondBits - firstBits || distance(state.player, first) - distance(state.player, second)
      })[0]
    const mark = strongestKey?.rsaMark ?? 0
    const markCount = (mark & 1 ? 1 : 0) + (mark & 2 ? 1 : 0)
    return {
      classResourceLabel: 'FATORAÇÃO RSA',
      classResourceValue: markCount,
      classResourceMax: 2,
      classResourceDetail: mark === 3 ? 'p × q · DETONAR COM 2' : mark === 1 ? 'p gravado · falta q' : mark === 2 ? 'q gravado · falta p' : 'grave p e q com J / 1',
    }
  }
  if (archetype === 'ranger') {
    const target = currentRangerTarget(state)
    return {
      classResourceLabel: 'ALVO MODULAR',
      classResourceValue: target ? 1 : 0,
      classResourceMax: 1,
      classResourceDetail: target
        ? `${PRIMEBOUND_ENEMIES[target.id].number} marcado · 3 busca o alvo`
        : 'use 2 para marcar',
    }
  }
  if (archetype === 'assassin') {
    const marked = state.enemies.filter((enemy) =>
      enemy.hp > 0 && enemy.rsaMark !== 0 && enemy.rsaMarkUntilMs > state.elapsedMs,
    )
    const nullTargets = marked.filter((enemy) => enemy.rsaMark === 3).length
    return {
      classResourceLabel: 'SINAIS DE MÖBIUS',
      classResourceValue: Math.min(3, marked.length),
      classResourceMax: 3,
      classResourceDetail: nullTargets > 0
        ? `${nullTargets} alvo${nullTargets > 1 ? 's' : ''} em μ = 0 · use 2`
        : marked.length > 0 ? `${marked.length} sinal${marked.length > 1 ? 'is' : ''} ativo${marked.length > 1 ? 's' : ''}` : 'J alterna −1 / +1',
    }
  }
  if (archetype === 'berserker') {
    const rage = Math.round((berserkerRageMultiplier(state) - 1) / .9 * 100)
    return {
      classResourceLabel: 'FÚRIA DE GOLDBACH',
      classResourceValue: Math.ceil(rage / 10),
      classResourceMax: 10,
      classResourceDetail: rage >= 70
        ? 'PAR CRÍTICO · dano máximo'
        : rage > 0 ? `${rage}% · cresce com vida perdida` : 'vida cheia · soma estável',
    }
  }
  if (archetype === 'engineer') {
    const machines = state.spellZones.filter((zone) =>
      zone.kind === 'sieve-turret' || zone.kind === 'sieve-line' ||
      zone.kind === 'sieve-minefield' || zone.kind === 'sieve-grid'
    ).length
    return {
      classResourceLabel: 'MÁQUINAS DO CRIVO',
      classResourceValue: Math.min(6, machines),
      classResourceMax: 6,
      classResourceDetail: machines > 0
        ? `${machines} módulo${machines > 1 ? 's' : ''} filtrando compostos`
        : '1 instala torres · 3 planta minas',
    }
  }
  if (archetype === 'oracle') {
    const points = state.heroProjectiles.filter((projectile) =>
      projectile.kind === 'elliptic-orb' || projectile.kind === 'elliptic-chain'
    ).length + state.spellZones.filter((zone) =>
      zone.kind === 'elliptic-singularity' || zone.kind === 'elliptic-curve'
    ).length
    return {
      classResourceLabel: 'PONTOS ELÍPTICOS',
      classResourceValue: Math.min(7, points),
      classResourceMax: 7,
      classResourceDetail: points > 0
        ? `${points} ponto${points > 1 ? 's' : ''} em órbita · 2 encadeia`
        : 'J prevê P · 1 dobra o ponto',
    }
  }
  const glyphCount = state.spellZones.filter((zone) =>
    zone.kind === 'glyph' && !zone.consumed,
  ).length
  return {
    classResourceLabel: 'GLIFOS DE MERSENNE',
    classResourceValue: glyphCount,
    classResourceMax: 3,
    classResourceDetail: glyphCount > 0 ? `${glyphCount} ativo${glyphCount > 1 ? 's' : ''} · 2 detona` : 'J / 1 inscrevem glifos',
  }
}

function stageHudSnapshot(
  state: EngineState,
): Pick<
  HudState,
  | 'stageStatus'
  | 'stageProgress'
  | 'stageActiveEnemyCount'
  | 'stageNextReinforcementRemainingMs'
  | 'stageRespawnsRemaining'
  | 'stageCompleted'
> {
  const encounter = stageEncounterFor(state)
  const activeMinionCount = state.enemies.filter((enemy) =>
    enemy.hp > 0 && PRIMEBOUND_ENEMIES[enemy.id].encounterRank === 'minion',
  ).length
  const activeEnemyCount = state.enemies.filter((enemy) => enemy.hp > 0 && enemy.awake).length
  const snapshot = getStageEncounterSnapshot(encounter, state.stageClockMs, activeMinionCount)
  return {
    stageStatus: snapshot.status,
    stageProgress: snapshot.progress,
    stageActiveEnemyCount: activeEnemyCount,
    stageNextReinforcementRemainingMs: snapshot.nextReinforcementInMs,
    stageRespawnsRemaining: snapshot.checkpointRespawnsRemaining,
    stageCompleted: snapshot.completed,
  }
}

function transformationHudSnapshot(
  state: EngineState,
): Pick<
  HudState,
  | 'transformationCharge'
  | 'transformationActive'
  | 'transformationRemainingMs'
  | 'transformationName'
  | 'transformationPhase'
> {
  const definition = resolveHeroTransformationDefinition(state.heroClassId)
  const transformation = state.player.transformation
  if (transformation && isHeroTransformationActive(transformation, state.elapsedMs)) {
    const progress = getHeroTransformationProgress(transformation, state.elapsedMs)
    return {
      transformationCharge: state.player.transformationCharge,
      transformationActive: true,
      transformationRemainingMs: progress.remainingMs,
      transformationName: definition.name,
      // The awakening cinematic already ran before the forty playable seconds begin.
      transformationPhase: progress.phase === 'awakening' ? 'ascended' : progress.phase,
    }
  }
  return {
    transformationCharge: state.player.transformationCharge,
    transformationActive: Boolean(state.transformationIntro),
    transformationRemainingMs: state.transformationIntro ? HERO_TRANSFORMATION_DURATION_MS : 0,
    transformationName: definition.name,
    transformationPhase: state.transformationIntro ? 'awakening' : null,
  }
}

function storyCutsceneHudSnapshot(
  state: EngineState,
): Pick<HudState, 'storyCutscene' | 'storyCutsceneProgress'> {
  if (!state.storyCutscene) {
    return { storyCutscene: null, storyCutsceneProgress: 0 }
  }
  const snapshot = getStoryCutsceneSnapshot(state.storyCutscene)
  const elapsedMs = snapshot.completedDurationMs + Math.min(
    state.storyCutsceneBeatElapsedMs,
    snapshot.currentBeat?.durationMs ?? 0,
  )
  return {
    storyCutscene: snapshot,
    storyCutsceneProgress: snapshot.totalDurationMs > 0
      ? clamp(elapsedMs / snapshot.totalDurationMs, 0, 1)
      : 1,
  }
}

function initialHud(state: EngineState): HudState {
  const area = PRIMEBOUND_AREAS[state.areaId]
  const objective = getNextPrimeboundObjective(progressView(state))
  return {
    blessings: [...state.blessings],
    blessingChoice: state.blessingChoice,
    bossIntro: null,
    health: state.player.health,
    maxHealth: state.player.maxHealth,
    stamina: state.player.stamina,
    maxStamina: state.player.maxStamina,
    areaId: state.areaId,
    areaName: area.name,
    areaSubtitle: area.subtitle,
    objectiveTitle: objective.title,
    objectiveDetail: objective.detail,
    runes: [...state.progress.collectedRunes],
    elapsedMs: state.stageClockMs,
    kills: state.kills,
    prompt: currentPrompt(state),
    bossHealth: null,
    bossMaxHealth: null,
    bossLabel: null,
    bossPowerLabel: null,
    bossPhase: null,
    toast: state.toast,
    callout: state.callout,
    cinematicActionId: null,
    cinematicPhrase: null,
    ...storyCutsceneHudSnapshot(state),
    ultimateQte: null,
    ultimateQteResult: null,
    cooldowns: cooldownSnapshot(state.player, state.elapsedMs),
    unlockedTechniqueCount: state.progress.collectedRunes.length,
    ultimateCharge: state.player.ultimateCharge,
    ...transformationHudSnapshot(state),
    defenseStatus: getDefenseStatus(state.player.defense, state.elapsedMs),
    primeChainCount: state.primeChainCount,
    primeChainIsPrime: isPrimeChainCount(state.primeChainCount),
    primeAscensionActive: state.primeAscensionUntilMs > state.elapsedMs,
    ...classResourceSnapshot(state),
    ...stageHudSnapshot(state),
  }
}

function speakerName(
  speaker: PrimeboundDialogueLine['speaker'],
  heroClass: HeroClassDefinition,
): string {
  if (speaker === 'hero') return heroClass.characterName.toUpperCase()
  return PRIMEBOUND_NPCS[speaker].name.toUpperCase()
}

function classAwareDialogueText(
  line: PrimeboundDialogueLine,
  heroClass: HeroClassDefinition,
): string {
  const classLines: Readonly<Record<string, string>> = {
    'Lâminas Gêmeas!': heroClass.actions['1'].spokenName,
    'Corrente de Sophie Germain!': heroClass.actions['2'].spokenName,
    'Ruptura de Mersenne!': heroClass.actions['3'].spokenName,
    'Infinito de Euclides!': heroClass.actions.R.spokenName,
    'Teorema de Wilson!': heroClass.id === 'prime-warrior'
      ? 'Teorema de Wilson!'
      : heroClass.actions.Q.spokenName,
    'Erga a Guarda de Wilson. No instante exato, o resto menos um revela um primo.':
      `Prepare a técnica “${heroClass.actions.Q.label}”. No instante exato, o resto menos um revela um primo.`,
    'Ataque em par e cada lâmina encontrará o fator da outra.':
      `Ataque em par com “${heroClass.actions['1'].label}” e cada impacto encontrará o fator do outro.`,
    'Se p e 2p + 1 são primos, a Corrente de Sophie fecha o circuito.':
      `Se p e 2p + 1 são primos, a técnica “${heroClass.actions['2'].label}” fecha o circuito.`,
  }
  return classLines[line.text] ?? line.text
}

function formatCooldown(milliseconds: number): string {
  return `${Math.max(.1, milliseconds / 1_000).toFixed(1)}s`
}

const STAGE_STATUS_LABELS: Readonly<Record<StageEncounterStatus, string>> = {
  engaged: 'PRESENÇA COMPOSTA',
  'reinforcement-inbound': 'MOVIMENTO DETECTADO',
  'guardian-ready': 'ÁREA SILENCIOSA',
  complete: 'REGIÃO PURIFICADA',
}

function isCinematicAction(actionId: OffensiveActionId): actionId is CinematicActionId {
  return actionId === 'mersenne-burst' || actionId === 'prime-infinity'
}

interface UltimateQteOverlayProps {
  readonly snapshot: UltimateQteSnapshot
  readonly result: UltimateQteResult | null
  readonly reducedMotion: boolean
  readonly paused: boolean
  readonly onInput: (input: UltimateQteInput) => void
}

function UltimateQteOverlay({
  snapshot,
  result,
  reducedMotion,
  paused,
  onInput,
}: UltimateQteOverlayProps): JSX.Element {
  const rootRef = useRef<HTMLElement>(null)
  const { definition, state } = snapshot
  const perfectUltimate = getPerfectUltimate(state.classId)
  const resolvedResult = result ?? (snapshot.status === 'active' ? null : snapshot.result)
  const resultForMeter = resolvedResult ?? snapshot.result
  const timeRatio = snapshot.remainingMs / definition.durationMs
  const timerWidth = reducedMotion
    ? Math.ceil(timeRatio * 4) * 25
    : timeRatio * 100
  useEffect(() => {
    if (!paused) rootRef.current?.focus({ preventScroll: true })
  }, [definition.mode, paused])
  const pointerInput = (input: UltimateQteInput) => (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    event.preventDefault()
    onInput(input)
  }
  const keyboardClick = (input: UltimateQteInput) => (
    event: ReactMouseEvent<HTMLButtonElement>
  ) => {
    if (event.detail === 0) onInput(input)
  }

  const activeStepIndex = Math.min(
    state.completedSteps,
    definition.targetCount - 1,
  )
  const expectedCode = state.mode === 'space-mash'
    ? definition.keySequence[0]
    : definition.keySequence[activeStepIndex]
  const expectedKeyLabel = state.mode === 'space-mash'
    ? definition.keyLabels[0]
    : definition.keyLabels[activeStepIndex]
  const activeStepLabel = definition.stepLabels[activeStepIndex]
  const lastStepLabel = state.completedSteps > 0
    ? definition.stepLabels[state.completedSteps - 1]
    : null
  const primaryInput: UltimateQteInput = { type: 'press', code: expectedCode }
  const actionLabel = state.classId === 'prime-warrior'
    ? 'GOLPEAR'
    : state.classId === 'mersenne-arcanist'
      ? 'CANALIZAR'
      : state.classId === 'mobius-assassin'
        ? 'INVERTER'
        : state.classId === 'goldbach-berserker'
          ? 'ESMAGAR'
          : state.classId === 'sieve-engineer'
            ? 'RISCAR'
            : state.classId === 'elliptic-oracle' ? 'SOMAR' : 'CONFIRMAR'
  const expectedShortcut = expectedCode === 'Space'
    ? 'Space'
    : expectedCode.replace(/^Digit/, '').replace(/^Key/, '')
  const accessiblePrompt = state.mode === 'space-mash'
    ? `Pressione Espaço. ${state.completedSteps} de ${definition.targetCount}.`
    : `Pressione ${expectedKeyLabel}. Etapa ${state.completedSteps + 1} de ${definition.targetCount}.`

  const challenge = (
    <>
      <div className="primebound-ultimate-qte__actions">
        <button
          type="button"
          className={`primebound-ultimate-qte__button is-big${state.mode === 'space-mash' ? ' is-mash' : ''}`}
          disabled={Boolean(resolvedResult)}
          aria-label={state.mode === 'space-mash'
            ? `Pressione Espaço. ${state.completedSteps} de ${definition.targetCount}.`
            : `Pressione ${expectedKeyLabel}. Etapa ${state.completedSteps + 1} de ${definition.targetCount}.`}
          aria-keyshortcuts={expectedShortcut}
          onPointerDown={pointerInput(primaryInput)}
          onClick={keyboardClick(primaryInput)}
        >
          <span className="primebound-ultimate-qte__prompt">
            {state.mode === 'space-mash' ? 'SPAM' : 'APERTE A TECLA'}
          </span>
          <kbd className="primebound-ultimate-qte__big-key">{expectedKeyLabel}</kbd>
          <strong>{actionLabel}</strong>
          {activeStepLabel && <small>SELO {activeStepLabel}</small>}
        </button>
      </div>
      <div className="primebound-ultimate-qte__step-dots" aria-hidden="true">
        {Array.from({ length: definition.targetCount }, (_, index) => (
          <i
            key={`${definition.stepLabels[index] ?? index}-${index}`}
            className={`${index < state.completedSteps ? 'is-complete' : ''}${index === state.completedSteps && !resolvedResult ? ' is-active' : ''}`}
          >{definition.stepLabels[index] && <b>{definition.stepLabels[index]}</b>}</i>
        ))}
      </div>
      {state.mode === 'space-mash' && (
        <div className="primebound-ultimate-qte__mash-count" aria-hidden="true">
          <strong>{state.completedSteps}</strong><span>/ {definition.targetCount}</span>
        </div>
      )}
      <div className="primebound-ultimate-qte__meta">
        <span>{state.mode === 'space-mash' ? 'CARGA' : 'SEQUÊNCIA'}</span>
        <strong>{state.completedSteps} / {definition.targetCount}</strong>
        <small>{lastStepLabel ? `${lastStepLabel} SELADO` : 'COPIE A TECLA GRANDE'}</small>
      </div>
    </>
  )

  return (
    <section
      ref={rootRef}
      className={`primebound-ultimate-qte${resolvedResult ? ' is-resolved' : ''}${resolvedResult?.perfect ? ' is-perfect' : ''}`}
      data-mode={definition.mode}
      data-grade={resolvedResult?.grade}
      role="group"
      tabIndex={-1}
      aria-label={`${definition.title}. ${definition.instruction}`}
    >
      {!resolvedResult && (
        <span
          className="primebound-sr-only"
          role="status"
          aria-live={state.mode === 'key-sequence' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          {accessiblePrompt}
        </span>
      )}
      <header className="primebound-ultimate-qte__header">
        <span className="primebound-ultimate-qte__eyebrow">SINCRONIA DA ULTIMATE</span>
        <strong className="primebound-ultimate-qte__title">{definition.title}</strong>
        <code className="primebound-ultimate-qte__formula">{definition.formula}</code>
      </header>
      <p className="primebound-ultimate-qte__instruction">{definition.instruction}</p>
      <div
        className="primebound-ultimate-qte__timer"
        role="progressbar"
        aria-label="Tempo restante do evento"
        aria-valuemin={0}
        aria-valuemax={definition.durationMs}
        aria-valuenow={Math.round(snapshot.remainingMs)}
      >
        <i className="primebound-ultimate-qte__timer-fill" style={{ width: `${timerWidth}%` }} />
      </div>
      {challenge}
      <div
        className="primebound-ultimate-qte__progress"
        role="progressbar"
        aria-label="Sincronia da ultimate"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(resultForMeter.score / 10)}
      >
        <i className="primebound-ultimate-qte__progress-fill" style={{ width: `${resultForMeter.score / 10}%` }} />
      </div>
      <div className="primebound-ultimate-qte__multiplier">
        <span>SINCRONIA {Math.round(resultForMeter.score / 10)}%</span>
        <strong>DANO ×{resultForMeter.damageMultiplier.toFixed(2)}</strong>
      </div>
      <small className="primebound-ultimate-qte__hint">
        Teclado, clique ou toque · PERFECT libera ataque total em área
      </small>
      {resolvedResult && (
        <div
          className={`primebound-ultimate-qte__result${resolvedResult.perfect ? ' is-perfect' : ''}`}
          role="status"
          aria-live="assertive"
        >
          <span>{resolvedResult.perfect ? 'EXECUÇÃO PERFEITA' : `GRAU ${resolvedResult.grade.toUpperCase()}`}</span>
          <strong>{resolvedResult.perfect ? resolvedResult.finisherName : `DANO ×${resolvedResult.damageMultiplier.toFixed(2)}`}</strong>
          {resolvedResult.perfect && (
            <small>
              {resolvedResult.finisherLine} · {perfectUltimate.formula} · ÁREA TOTAL
            </small>
          )}
        </div>
      )}
    </section>
  )
}

export default function PrimeboundGame({
  heroClassId,
  paused,
  onPauseChange,
  onExitToClassSelect,
  onVictory,
  onDefeat,
}: PrimeboundGameProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const gameplayHudRef = useRef<HTMLDivElement>(null)
  const storyDialogRef = useRef<HTMLElement>(null)
  const storySkipButtonRef = useRef<HTMLButtonElement>(null)
  const dialogueButtonRef = useRef<HTMLButtonElement>(null)
  const portraitExitButtonRef = useRef<HTMLButtonElement>(null)
  const [engine] = useState(() => createEngine(heroClassId))
  const engineRef = useRef<EngineState>(engine)
  const keysRef = useRef(new Set<string>())
  const touchDirectionsRef = useRef(new Set<Direction>())
  const pausedRef = useRef(paused)
  const orientationBlockedRef = useRef(false)
  const dialogueRef = useRef<ActiveDialogue | null>(null)
  const dialogueAfterRef = useRef<(() => void) | null>(null)
  const lastHudUpdateRef = useRef(-1_000)
  const [hud, setHud] = useState(() => initialHud(engineRef.current))
  const [dialogue, setDialogue] = useState<ActiveDialogue | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const voicePlayerRef = useRef<OriginVoicePlayer | null>(null)
  const techVoiceReadyAtRef = useRef(0)
  const previousTransformationRef = useRef(false)
  const previousCooldownsRef = useRef<Readonly<Record<string, number>> | null>(null)
  const speakHeroCue = useCallback((cue: HeroVoiceCue) => {
    if (readOriginVoiceMuted()) return
    const now = performance.now()
    if (cue === 'tech') {
      if (now < techVoiceReadyAtRef.current) return
      techVoiceReadyAtRef.current = now + 14_000
    }
    voicePlayerRef.current ??= createOriginVoicePlayer()
    voicePlayerRef.current.play(
      heroVoiceAudioPath(heroClassId, cue),
      HERO_VOICE_LINES[heroClassId][cue],
      { kind: 'hero', gender: getHeroClass(heroClassId).gender },
    )
  }, [heroClassId])

  // Opening line when the run begins; silence the voice when the run unmounts.
  useEffect(() => {
    const timer = window.setTimeout(() => speakHeroCue('start'), 900)
    return () => {
      window.clearTimeout(timer)
      voicePlayerRef.current?.stop()
    }
  }, [speakHeroCue])

  // Battle cries ride HUD transitions: a cooldown leaving zero means the move
  // just fired; the transformation flag rising means F was accepted.
  useEffect(() => {
    if (hud.transformationActive && !previousTransformationRef.current) speakHeroCue('transform')
    previousTransformationRef.current = hud.transformationActive
  }, [hud.transformationActive, speakHeroCue])

  useEffect(() => {
    const previous = previousCooldownsRef.current
    previousCooldownsRef.current = hud.cooldowns
    if (!previous) return
    if (hud.cooldowns['prime-infinity'] > 0 && previous['prime-infinity'] === 0) {
      speakHeroCue('ultimate')
      return
    }
    const techIds = ['sophie-chain', 'mersenne-burst', 'twin-blades'] as const
    if (techIds.some((id) => hud.cooldowns[id] > 0 && previous[id] === 0)) speakHeroCue('tech')
  }, [hud.cooldowns, speakHeroCue])

  const getMusic = useAudioResource(() => createMusicDirector(PRIMEBOUND_TRACK))
  const party = usePrimeverseExpeditionParty('primebound')
  const { client: onlineClient, snapshot: onlineSnapshot } = usePrimeverseSession()
  const peerGhostsRef = useRef<readonly PrimeboundPeerGhost[]>([])
  const lastPresenceSentAt = useRef(0)
  const lastCoopSentAt = useRef(0)
  const appliedCoopSeq = useRef(-1)
  /** hp per enemy id at the last host packet, to measure the guest's own damage. */
  const coopHpShadow = useRef(new Map<string, number>())
  const coopRef = useRef({ client: onlineClient, snapshot: onlineSnapshot })
  coopRef.current = { client: onlineClient, snapshot: onlineSnapshot }

  useEffect(() => {
    const inRun = onlineSnapshot.activityId === 'primebound' && onlineSnapshot.runId !== null
    const partySize = inRun
      ? 1 + onlineSnapshot.players
        .filter((peer) => peer.activityId === 'primebound' && peer.runId === onlineSnapshot.runId)
        .length
      : 1
    setPrimeboundOnlinePartySize(partySize)
    return () => setPrimeboundOnlinePartySize(1)
  }, [onlineSnapshot.activityId, onlineSnapshot.players, onlineSnapshot.runId])
  const getSfx = useAudioResource(createPrimeboundSfx)
  const [portraitNoticeVisible, setPortraitNoticeVisible] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  pausedRef.current = paused

  useEffect(() => {
    const portraitTouch = window.matchMedia('(orientation: portrait) and (hover: none) and (pointer: coarse)')
    const update = () => {
      orientationBlockedRef.current = portraitTouch.matches
      setPortraitNoticeVisible(portraitTouch.matches)
      if (portraitTouch.matches) {
        keysRef.current.clear()
        touchDirectionsRef.current.clear()
        engineRef.current.queuedCombatAction = null
        engineRef.current.queuedDash = false
        engineRef.current.queuedTransformation = false
      }
    }
    update()
    portraitTouch.addEventListener('change', update)
    return () => portraitTouch.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (portraitNoticeVisible && !paused) portraitExitButtonRef.current?.focus()
  }, [paused, portraitNoticeVisible])

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.inert = portraitNoticeVisible && !paused
    }
  }, [paused, portraitNoticeVisible])

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(motionPreference.matches)
    update()
    motionPreference.addEventListener('change', update)
    return () => motionPreference.removeEventListener('change', update)
  }, [])

  const playSound = useCallback((name: SoundName) => {
    if (!soundEnabled) return
    getSfx().play(name)
  }, [getSfx, soundEnabled])

  // Chiptune soundtrack: it follows the same toggle as the effects, rises when the
  // hero is hurt or a boss is on the field, and pauses with the game.
  useEffect(() => {
    getMusic().setEnabled(soundEnabled)
    getSfx().setEnabled(soundEnabled)
  }, [getMusic, getSfx, soundEnabled])

  // Browsers block audio until the player interacts, so the soundtrack arms itself
  // on the first key press or tap instead of on mount.
  useEffect(() => {
    if (!soundEnabled) return undefined
    const music = getMusic()
    const sfx = getSfx()
    const detachMusic = startMusicOnFirstGesture(music)
    // The effect bank needs the same gesture before the browser lets it speak.
    const unlock = () => { void sfx.unlock() }
    window.addEventListener('pointerdown', unlock, { once: true, passive: true })
    window.addEventListener('keydown', unlock, { once: true, passive: true })
    return () => {
      detachMusic()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [getMusic, getSfx, soundEnabled])

  useEffect(() => {
    if (paused) getMusic().stop()
    else if (soundEnabled) void getMusic().start()
  }, [getMusic, paused, soundEnabled])

  useEffect(() => {
    // The arrangement climbs with the run: every rune adds weight, a boss brings the
    // brass in, low health opens the choir, and an ultimate cutscene goes full band.
    const wounded = hud.maxHealth > 0 ? 1 - hud.health / hud.maxHealth : 0
    const journey = Math.min(1, hud.runes.length / 6) * 0.26
    const bossFight = hud.bossHealth !== null ? 0.34 : 0
    const bossDesperate = hud.bossHealth !== null && hud.bossMaxHealth
      ? (1 - hud.bossHealth / hud.bossMaxHealth) * 0.18
      : 0
    const climax = hud.ultimateQte || hud.cinematicActionId ? 1 : 0
    getMusic().setIntensity(Math.max(
      climax,
      Math.min(1, 0.26 + journey + wounded * 0.3 + bossFight + bossDesperate),
    ))
  }, [
    getMusic,
    hud.bossHealth,
    hud.bossMaxHealth,
    hud.cinematicActionId,
    hud.health,
    hud.maxHealth,
    hud.runes.length,
    hud.ultimateQte,
  ])

  // Online presence: every ~140 ms the hero's pixel position is projected onto
  // the shared plane, and party members in the same area come back as ghosts.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const state = engineRef.current
      if (!state || pausedRef.current) return
      const nowMs = performance.now()
      if (nowMs - lastPresenceSentAt.current < 140) return
      lastPresenceSentAt.current = nowMs
      const [px, py, pz] = encodePrimeboundPresence(state.areaId, state.player.x, state.player.y)
      party.sendTransform([px, py, pz], 0, 'walk')

      const ghosts: PrimeboundPeerGhost[] = []
      for (const peer of party.peers) {
        const sampled = party.sampleRemote(peer.id)
        if (!sampled) continue
        const decoded = decodePrimeboundPresence({ x: sampled.position[0], z: sampled.position[2] })
        if (decoded.areaId !== state.areaId) continue
        ghosts.push({ id: peer.id, nickname: peer.nickname, x: decoded.x, y: decoded.y })
      }
      peerGhostsRef.current = ghosts

      // ------------------------------------------------------------- co-op
      const { client, snapshot: online } = coopRef.current
      const inRun = client && online.playerId
        && online.activityId === 'primebound' && online.runId !== null
      const runPeerIds = inRun
        ? online.players
          .filter((peer) => peer.activityId === 'primebound' && peer.runId === online.runId)
          .map((peer) => peer.id)
        : []
      if (!inRun || runPeerIds.length === 0) return
      const hostId = electCoopHost([online.playerId as string, ...runPeerIds])

      if (hostId === online.playerId) {
        // Host: my creatures are the creatures. Damage reported by friends lands here.
        for (const raw of client.consumePartyActions()) {
          const damage = decodePrimeboundCoopDamage(raw.data)
          if (!damage) continue
          const target = state.enemies.find((enemy) => enemy.id === damage.enemyId && enemy.hp > 0)
          if (target) {
            target.hp = Math.max(0, target.hp - damage.amount)
            target.flashUntilMs = state.elapsedMs + 130
          }
        }
        if (nowMs - lastCoopSentAt.current >= PRIMEBOUND_COOP_INTERVAL_MS) {
          lastCoopSentAt.current = nowMs
          client.sendPartyState(encodePrimeboundCoopState({
            areaId: state.areaId,
            enemies: state.enemies.map((enemy) => ({
              id: enemy.id, x: enemy.x, y: enemy.y, hp: enemy.hp, awake: enemy.awake,
            })),
          }))
        }
        return
      }

      // Guest: replicate the host's area when we share it; report our own hits.
      const packet = online.partyState
      if (!packet || packet.fromId !== hostId || packet.seq === appliedCoopSeq.current) return
      appliedCoopSeq.current = packet.seq
      const shared = decodePrimeboundCoopState(packet.data)
      if (!shared || shared.areaId !== state.areaId) {
        coopHpShadow.current.clear()
        return
      }
      const seen = new Set<string>()
      for (const replicated of shared.enemies) {
        seen.add(replicated.id)
        const local = state.enemies.find((enemy) => enemy.id === replicated.id)
        if (!local) continue
        const shadow = coopHpShadow.current.get(replicated.id)
        if (shadow !== undefined && local.hp < shadow) {
          // Whatever my engine subtracted since the last packet was my damage.
          client.sendPartyAction(encodePrimeboundCoopDamage({
            kind: 'damage', enemyId: replicated.id, amount: shadow - local.hp,
          }))
        }
        local.x = replicated.x
        local.y = replicated.y
        local.hp = replicated.hp
        local.awake = replicated.awake
        coopHpShadow.current.set(replicated.id, replicated.hp)
      }
      for (const key of [...coopHpShadow.current.keys()]) {
        if (!seen.has(key)) coopHpShadow.current.delete(key)
      }
    }, 70)
    return () => window.clearInterval(timer)
  }, [party])

  const showDialogue = useCallback((lines: readonly PrimeboundDialogueLine[], after?: () => void) => {
    keysRef.current.clear()
    touchDirectionsRef.current.clear()
    engineRef.current.queuedCombatAction = null
    engineRef.current.queuedDash = false
    engineRef.current.queuedTransformation = false
    const nextDialogue = { lines, index: 0 }
    dialogueAfterRef.current = after ?? null
    dialogueRef.current = nextDialogue
    setDialogue(nextDialogue)
  }, [])

  const advanceDialogue = useCallback(() => {
    const active = dialogueRef.current
    if (!active) return
    if (active.index < active.lines.length - 1) {
      const next = { ...active, index: active.index + 1 }
      dialogueRef.current = next
      setDialogue(next)
      return
    }
    dialogueRef.current = null
    setDialogue(null)
    const after = dialogueAfterRef.current
    dialogueAfterRef.current = null
    after?.()
  }, [])

  const ultimateQteVisible = Boolean(hud.ultimateQte)
  const storyCutsceneVisible = Boolean(hud.storyCutscene)
  useEffect(() => {
    if (gameplayHudRef.current) {
      gameplayHudRef.current.inert = storyCutsceneVisible
    }
    if (canvasRef.current) {
      canvasRef.current.inert = storyCutsceneVisible
    }
  }, [storyCutsceneVisible])

  useEffect(() => {
    if (paused || portraitNoticeVisible || !storyCutsceneVisible) return
    const focusTarget = hud.storyCutscene?.canSkip
      ? storySkipButtonRef.current
      : storyDialogRef.current
    focusTarget?.focus({ preventScroll: true })
  }, [
    hud.storyCutscene?.beatIndex,
    hud.storyCutscene?.canSkip,
    hud.storyCutscene?.sceneId,
    paused,
    portraitNoticeVisible,
    storyCutsceneVisible,
  ])

  useEffect(() => {
    if (paused) {
      keysRef.current.clear()
      touchDirectionsRef.current.clear()
      engineRef.current.queuedCombatAction = null
      engineRef.current.queuedDash = false
      engineRef.current.queuedTransformation = false
    }
    if (dialogue) dialogueButtonRef.current?.focus()
    else if (!paused && !portraitNoticeVisible && !ultimateQteVisible && !storyCutsceneVisible) {
      canvasRef.current?.focus()
    }
  }, [dialogue, paused, portraitNoticeVisible, storyCutsceneVisible, ultimateQteVisible])

  useEffect(() => {
    if (
      !ultimateQteVisible && !storyCutsceneVisible && !paused && !portraitNoticeVisible &&
      !dialogueRef.current
    ) {
      canvasRef.current?.focus({ preventScroll: true })
    }
  }, [paused, portraitNoticeVisible, storyCutsceneVisible, ultimateQteVisible])

  const updateHud = useCallback((state: EngineState) => {
    const area = PRIMEBOUND_AREAS[state.areaId]
    const objective = getNextPrimeboundObjective(progressView(state))
    const boss = state.enemies.find((enemy) => enemy.kind === 'guardian' && enemy.awake)
    const bossDefinition = boss ? PRIMEBOUND_ENEMIES[boss.id] : null
    const bossPower = boss ? enemyPrimePowerFor(boss) : null
    const cinematicProgress = state.cinematic
      ? getCinematicProgress(state.cinematic.actionId, state.cinematic.elapsedMs, reducedMotion)
      : null
    const activeCinematic = state.cinematic
      ? heroCinematicForState(state, state.cinematic.actionId)
      : null
    const ultimateQte = state.cinematic?.ultimateQte
      ? getUltimateQteSnapshot(state.cinematic.ultimateQte, state.cinematic.elapsedMs)
      : null
    const intro = state.bossIntro && state.elapsedMs - state.bossIntro.startedAtMs < 3_200
      ? state.bossIntro
      : null
    if (state.bossIntro && !intro) state.bossIntro = null
    const introDefinition = intro ? PRIMEBOUND_ENEMIES[intro.enemyId] : null
    setHud({
      blessings: [...state.blessings],
      blessingChoice: state.blessingChoice,
      bossIntro: intro && introDefinition
        ? {
          name: introDefinition.name,
          number: introDefinition.number,
          rank: introDefinition.encounterRank === 'final-boss' ? 'final-boss' : 'area-boss',
          power: enemyPrimePowerFor(state.enemies.find((enemy) => enemy.id === intro.enemyId) ?? state.enemies[0])?.shortName ?? '',
          sinceMs: state.elapsedMs - intro.startedAtMs,
        }
        : null,
      health: state.player.health,
      maxHealth: state.player.maxHealth,
      stamina: state.player.stamina,
      maxStamina: state.player.maxStamina,
      areaId: state.areaId,
      areaName: area.name,
      areaSubtitle: area.subtitle,
      objectiveTitle: objective.title,
      objectiveDetail: objective.detail,
      runes: [...state.progress.collectedRunes],
      elapsedMs: state.stageClockMs,
      kills: state.kills,
      prompt: currentPrompt(state),
      bossHealth: boss?.hp ?? null,
      bossMaxHealth: boss?.maxHp ?? null,
      bossLabel: bossDefinition
        ? `${bossDefinition.encounterRank === 'final-boss' ? 'CHEFE FINAL' : 'CHEFE'} · ${bossDefinition.name}`
        : null,
      bossPowerLabel: bossPower
        ? `${enemyPowerPhaseLabel(bossPower)} · ${bossDefinition?.number} = ${bossDefinition?.primeFactors.join(' × ')}`
        : null,
      bossPhase: boss?.bossPhase ?? null,
      toast: state.toast && state.toast.untilMs > state.elapsedMs ? state.toast : null,
      callout: state.callout && state.callout.untilMs > state.elapsedMs ? state.callout : null,
      cinematicActionId: state.cinematic?.actionId ?? null,
      cinematicPhrase: cinematicProgress && activeCinematic
        ? cinematicPhrase(activeCinematic, cinematicProgress)
        : null,
      ...storyCutsceneHudSnapshot(state),
      ultimateQte,
      ultimateQteResult: state.cinematic?.ultimateQteResult ?? null,
      cooldowns: cooldownSnapshot(state.player, state.elapsedMs),
      unlockedTechniqueCount: state.progress.collectedRunes.length,
      ultimateCharge: state.player.ultimateCharge,
      ...transformationHudSnapshot(state),
      defenseStatus: getDefenseStatus(state.player.defense, state.elapsedMs),
      primeChainCount: state.primeChainCount,
      primeChainIsPrime: isPrimeChainCount(state.primeChainCount),
      primeAscensionActive: state.primeAscensionUntilMs > state.elapsedMs,
      ...classResourceSnapshot(state),
      ...stageHudSnapshot(state),
    })
  }, [reducedMotion])

  const skipActiveStoryCutscene = useCallback(() => {
    const state = engineRef.current
    if (!state.storyCutscene) return
    const sceneId = state.storyCutscene.sceneId
    const skipped = skipStoryCutscene(state.storyCutscene)
    if (skipped === state.storyCutscene) return
    state.storyCutscene = skipped
    const guardian = finishStoryCutscene(state)
    keysRef.current.clear()
    touchDirectionsRef.current.clear()
    playSound(guardian ? 'cinematic-release' : 'cinematic-beat')
    if (sceneId === PRIMEBOUND_FINALE_CUTSCENE_ID && !state.ended) {
      state.ended = true
      onVictory(runResult(state))
      return
    }
    updateHud(state)
  }, [onVictory, playSound, updateHud])

  const submitUltimateQteInput = useCallback((input: UltimateQteInput) => {
    const state = engineRef.current
    const cinematic = state.cinematic
    if (
      pausedRef.current || orientationBlockedRef.current || dialogueRef.current ||
      cinematic?.actionId !== 'prime-infinity' || !cinematic.ultimateQte ||
      cinematic.ultimateQteResult
    ) return

    const currentSnapshot = getUltimateQteSnapshot(
      cinematic.ultimateQte,
      cinematic.elapsedMs,
    )
    if (currentSnapshot.status !== 'active') return
    const nextQte = applyUltimateQteInput(
      cinematic.ultimateQte,
      input,
      cinematic.elapsedMs,
    )
    if (nextQte === cinematic.ultimateQte) return
    cinematic.ultimateQte = nextQte
    const nextSnapshot = getUltimateQteSnapshot(nextQte, cinematic.elapsedMs)
    if (nextSnapshot.status === 'complete') {
      cinematic.ultimateQteResult = nextSnapshot.result
    }
    playSound(nextSnapshot.result.perfect ? 'parry' : 'cinematic-beat')
    updateHud(state)
  }, [playSound, updateHud])

  const interact = useCallback(() => {
    const state = engineRef.current
    if (
      state.ended || state.cinematic || state.storyCutscene || state.transformationIntro || pausedRef.current ||
      orientationBlockedRef.current || dialogueRef.current
    ) return
    const player = state.player

    for (const npcId of PRIMEBOUND_AREAS[state.areaId].npcIds) {
      const npc = PRIMEBOUND_NPCS[npcId]
      if (distance(player, gridToWorld(npc.position)) > 43) continue
      const firstVisit = !state.progress.spokenNpcIds.includes(npcId)
      const rune = runeForArea(state.areaId)
      const hasRune = Boolean(rune && state.progress.collectedRunes.includes(rune.value))
      const dialogueId = firstVisit
        ? npc.dialogueIds[0]
        : hasRune || isAreaClear(state)
          ? npc.dialogueIds[1]
          : npc.dialogueIds[0]
      showDialogue(PRIMEBOUND_DIALOGUES[dialogueId].lines, () => {
        if (!state.progress.spokenNpcIds.includes(npcId)) state.progress.spokenNpcIds.push(npcId)
        state.toast = {
          title: firstVisit ? `${npc.name} marcou o caminho` : 'Sabedoria recuperada',
          detail: firstVisit ? 'As criaturas compostas guardam a próxima runa.' : 'A sequência prima continua.',
          tone: 'violet',
          untilMs: state.elapsedMs + 3_000,
        }
        updateHud(state)
      })
      return
    }

    const shrineTile = shrineTileForArea(state.areaId)
    if (
      shrineTile
      && !state.blessedShrineAreaIds.includes(state.areaId)
      && distance(player, gridToWorld(shrineTile)) <= 40
    ) {
      const options = offerBlessings(
        state.progress.collectedRunes.length * 31 + state.areaId.length * 7 + state.blessings.length,
        state.blessings,
      )
      if (options.length > 0) {
        state.blessingChoice = options
        playSound('rune')
        updateHud(state)
      }
      return
    }

    const rune = runeForArea(state.areaId)
    if (
      rune && isRuneUnlocked(state) && !state.progress.collectedRunes.includes(rune.value) &&
      distance(player, gridToWorld(rune.position)) <= 38
    ) {
      state.progress.collectedRunes.push(rune.value)
      state.player.maxHealth += 1
      state.player.health = state.player.maxHealth
      grantTransformationCharge(state, 15)
      createParticles(state, player.x, player.y, '#f2c15c', 24, 48)
      state.shake = 3
      state.toast = {
        title: `${rune.name} recuperada`,
          detail: `${rune.clue} Vitalidade máxima aumentada e restaurada.`,
        tone: 'gold',
        untilMs: state.elapsedMs + 4_600,
      }
      playSound('rune')

      const dialogueId = RUNE_DIALOGUE_BY_VALUE[rune.value]
      showDialogue(PRIMEBOUND_DIALOGUES[dialogueId].lines)
      updateHud(state)
      return
    }

    const destination = getNextAreaId(state.areaId)
    if (destination && isNearEasternGate(state) && canUseEasternGate(state)) {
      playSound('portal')
      travelToArea(state, destination)
      updateHud(state)
    }
  }, [playSound, showDialogue, updateHud])

  useEffect(() => {
    const controlKeys = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyK',
      'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'KeyQ', 'KeyR', 'KeyF',
      'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'Enter', 'Escape',
    ])
    const down = (event: KeyboardEvent) => {
      const target = event.target
      const interactiveTarget = target instanceof Element && Boolean(
        target.closest('button, a, input, select, textarea, [contenteditable="true"]'),
      )
      if (orientationBlockedRef.current) return
      if (engineRef.current.storyCutscene) {
        if (
          !event.repeat &&
          (event.code === 'Escape' || event.code === 'Enter' || event.code === 'Space' || event.code === 'KeyE')
        ) {
          event.preventDefault()
          skipActiveStoryCutscene()
        } else if (controlKeys.has(event.code)) {
          event.preventDefault()
        }
        return
      }
      if (event.code === 'Escape') {
        if (event.repeat) return
        event.preventDefault()
        onPauseChange(!pausedRef.current)
        return
      }
      if (pausedRef.current) return
      if (dialogueRef.current) {
        if (!event.repeat && event.code === 'KeyE') {
          event.preventDefault()
          advanceDialogue()
        } else if (!interactiveTarget && !event.repeat && (event.code === 'Enter' || event.code === 'Space')) {
          event.preventDefault()
          advanceDialogue()
        }
        return
      }
      const ultimateQte = engineRef.current.cinematic?.ultimateQte
      if (ultimateQte) {
        const qteButtonTarget = target instanceof Element
          ? target.closest('.primebound-ultimate-qte__button')
          : null
        if (interactiveTarget && !qteButtonTarget) return
        if (
          qteButtonTarget && ultimateQte.mode === 'key-sequence' &&
          (event.code === 'Enter' || event.code === 'Space')
        ) return
        if (event.repeat) return
        const qteInput = getUltimateQteKeyboardInput(ultimateQte, event.code, 'down')
        if (qteInput) {
          event.preventDefault()
          submitUltimateQteInput(qteInput)
        } else if (!interactiveTarget && controlKeys.has(event.code)) {
          event.preventDefault()
        }
        return
      }
      if (interactiveTarget) return
      if (controlKeys.has(event.code)) event.preventDefault()
      if (engineRef.current.cinematic || engineRef.current.transformationIntro) return
      keysRef.current.add(event.code)
      const combatAction = COMBAT_KEY_ACTIONS[event.code]
      if (!event.repeat && combatAction) engineRef.current.queuedCombatAction = combatAction
      if (!event.repeat && event.code === 'KeyF') engineRef.current.queuedTransformation = true
      if (!event.repeat && (event.code === 'KeyK' || event.code === 'ShiftLeft' || event.code === 'ShiftRight')) engineRef.current.queuedDash = true
      if (!event.repeat && (event.code === 'KeyE' || event.code === 'Enter')) interact()
    }
    const up = (event: KeyboardEvent) => {
      keysRef.current.delete(event.code)
      const ultimateQte = engineRef.current.cinematic?.ultimateQte
      if (!ultimateQte) return
      const qteInput = getUltimateQteKeyboardInput(ultimateQte, event.code, 'up')
      if (!qteInput) return
      event.preventDefault()
      submitUltimateQteInput(qteInput)
    }
    const blur = () => keysRef.current.clear()
    window.addEventListener('keydown', down, { passive: false })
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [advanceDialogue, interact, onPauseChange, skipActiveStoryCutscene, submitUltimateQteInput])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) return undefined
    context.imageSmoothingEnabled = false
    let frameId = 0
    let idleTimer: number | null = null
    let idleFrameDrawn = false
    let previousTime = performance.now()

    const damagePlayer = (
      state: EngineState,
      amount: number,
      source: Vec2,
      sourceEnemyId?: PrimeboundEnemyId,
    ) => {
      if (state.elapsedMs < state.player.dashUntilMs) return 'evaded' as const
      if (state.elapsedMs < state.player.invulnerableUntilMs) return 'ignored' as const
      const transformation = activeHeroTransformation(state)
      if (
        transformation?.uniqueEffect.id === 'irreducible-counter' &&
        state.player.transformationGuardCharges > 0
      ) {
        state.player.transformationGuardCharges -= 1
        const sourceEnemy = sourceEnemyId
          ? state.enemies.find((enemy) => enemy.id === sourceEnemyId)
          : null
        if (sourceEnemy) {
          const reflectedDamage = Math.max(12, amount * 8)
            * transformation.uniqueEffect.reflectedDamageMultiplier
          sourceEnemy.hp = Math.max(0, sourceEnemy.hp - reflectedDamage)
          sourceEnemy.stunnedUntilMs = state.elapsedMs + 680
          sourceEnemy.intent = null
        }
        state.player.invulnerableUntilMs = state.elapsedMs + 360
        state.player.ultimateCharge = addUltimateCharge(
          state.player.ultimateCharge,
          classUltimateGain(state, 10),
        )
        state.callout = {
          title: 'CONTRAEXEMPLO IMPOSSÍVEL!',
          detail: `${state.player.transformationGuardCharges} guardas perfeitas restantes · golpe devolvido`,
          untilMs: state.elapsedMs + 1_150,
        }
        addCombatEffect(state, 'parry', 64, 520)
        createParticles(state, state.player.x, state.player.y, transformation.palette.flash, 24, 82)
        state.shake = 6
        playSound('parry')
        return 'parried' as const
      }
      const defense = resolveDefenseHit(state.player.defense, amount, state.elapsedMs)
      state.player.defense = defense.state
      if (defense.outcome === 'parried') {
        const heroClass = getHeroClass(state.heroClassId)
        const guardAction = heroActionForState(state, 'irreducible-aegis')
        const sourceEnemy = sourceEnemyId
          ? state.enemies.find((enemy) => enemy.id === sourceEnemyId)
          : null
        if (sourceEnemy) {
          const reflectionMultiplier = transformation?.uniqueEffect.id === 'irreducible-counter'
            ? transformation.uniqueEffect.reflectedDamageMultiplier
            : 1
          sourceEnemy.hp = Math.max(
            0,
            sourceEnemy.hp
              - defense.reflectedDamage
                * heroClass.modifiers.damageMultiplier
                * reflectionMultiplier,
          )
          sourceEnemy.stunnedUntilMs = state.elapsedMs + defense.staggerMs
          sourceEnemy.intent = null
        }
        state.player.ultimateCharge = addUltimateCharge(
          state.player.ultimateCharge,
          classUltimateGain(state, defense.ultimateChargeGained),
        )
        grantTransformationCharge(state, 10)
        if (heroClass.archetype === 'warrior' || heroClass.archetype === 'berserker') {
          state.player.warriorComboStep = 2
          state.player.warriorComboUntilMs = state.elapsedMs + 1_050
        }
        state.callout = {
          title: state.heroClassId === 'prime-warrior'
            ? (defense.spokenName ?? 'Teorema de Wilson!')
            : guardAction.spokenName,
          detail: guardAction.description,
          untilMs: state.elapsedMs + 1_150,
        }
        addCombatEffect(state, 'parry', 54, 460)
        createParticles(state, state.player.x, state.player.y, heroClass.palette.accent, 20, 72)
        state.shake = 4
        playSound('parry')
        return 'parried' as const
      }
      if (defense.outcome === 'blocked') {
        addCombatEffect(state, 'guard', 34, 280)
        createParticles(
          state,
          state.player.x,
          state.player.y,
          getHeroClass(state.heroClassId).palette.energy,
          7,
          26,
        )
        playSound('guard')
        amount = amount <= 1 ? 0 : Math.max(1, Math.ceil(defense.damageTaken))
        if (amount <= 0) {
          state.player.invulnerableUntilMs = state.elapsedMs + 240
          return 'blocked' as const
        }
      }
      const damageMultiplier = getHeroClass(state.heroClassId).modifiers.damageTakenMultiplier
        * (transformation?.modifiers.damageTakenMultiplier ?? 1)
      const accumulatedDamage = amount * damageMultiplier + state.player.damageRemainder
      amount = Math.floor(accumulatedDamage)
      const skinOfThirteen = blessingEffects(state.blessings).damageTakenReduction
      if (skinOfThirteen > 0 && amount > 1) amount = Math.max(1, amount - skinOfThirteen)
      state.player.damageRemainder = accumulatedDamage - amount
      if (amount <= 0) {
        state.player.invulnerableUntilMs = state.elapsedMs + 240
        return 'absorbed' as const
      }
      const result = applyDamage(
        { health: state.player.health, invulnerableUntilMs: state.player.invulnerableUntilMs },
        { amount, nowMs: state.elapsedMs, invulnerabilityMs: 900 },
      )
      if (!result.applied) return 'ignored' as const
      state.player.health = result.health
      state.player.invulnerableUntilMs = result.invulnerableUntilMs
      state.player.ultimateCharge = gainUltimateCharge(
        state.player.ultimateCharge,
        'damage-taken',
        getHeroClass(state.heroClassId).modifiers.ultimateChargeMultiplier,
      )
      grantTransformationCharge(state, 8 + result.damageTaken * 2)
      state.damageTaken += result.damageTaken
      state.shake = 5
      const away = normalizeMovement({ x: state.player.x - source.x, y: state.player.y - source.y })
      moveWithCollision(state.areaId, state.player, PLAYER_RADIUS, away.x * 13, away.y * 13)
      createParticles(state, state.player.x, state.player.y, '#ef6a68', 10, 39)
      playSound('hurt')
      if (result.defeated && !state.ended) {
        const encounter = stageEncounterFor(state)
        if (encounter.checkpointRespawnsRemaining > 0) {
          const revivedEncounter = consumeStageCheckpointRespawn(encounter)
          updateStageEncounter(state, revivedEncounter)
          const spawn = gridToWorld(PRIMEBOUND_AREAS[state.areaId].playerSpawn)
          state.player.x = spawn.x
          state.player.y = spawn.y
          state.player.health = state.player.maxHealth
          state.player.damageRemainder = 0
          state.player.stamina = state.player.maxStamina
          state.player.invulnerableUntilMs = state.elapsedMs + 1_800
          state.player.attackUntilMs = state.elapsedMs
          state.player.activeAction = null
          state.player.classDefenseUntilMs = 0
          state.player.defense = createDefenseState()
          state.projectiles = []
          state.enemyPowerEffects = []
          state.enemyHitStopMs = 0
          state.heroProjectiles = []
          state.spellZones = []
          state.pendingCombatHits = []
          state.pendingPerfectUltimateWaves = []
          state.cinematic = null
          state.transformationIntro = null
          state.queuedCombatAction = null
          state.queuedDash = false
          state.queuedTransformation = false
          for (const enemy of state.enemies) {
            enemy.intent = null
            enemy.intentTarget = null
            enemy.intentUntilMs = 0
            enemy.lastActionAtMs = state.elapsedMs
            enemy.stunnedUntilMs = Math.max(enemy.stunnedUntilMs, state.elapsedMs + 1_150)
          }
          state.toast = {
            title: 'CHECKPOINT PRIMO · CHAMA RESTAURADA',
            detail: `${revivedEncounter.checkpointRespawnsRemaining} retorno${revivedEncounter.checkpointRespawnsRemaining === 1 ? '' : 's'} restante${revivedEncounter.checkpointRespawnsRemaining === 1 ? '' : 's'} nesta região. A purificação da área foi preservada.`,
            tone: 'gold',
            untilMs: state.elapsedMs + 4_200,
          }
          state.callout = {
            title: 'RESPAWN DE FASE!',
            detail: 'Vitalidade e energia restauradas no último selo primo.',
            untilMs: state.elapsedMs + 1_650,
          }
          createParticles(state, spawn.x, spawn.y, getHeroClass(state.heroClassId).palette.energy, 32, 78)
          state.shake = 8
          playSound('portal')
          updateHud(state)
          return 'respawned' as const
        }
        state.ended = true
        onDefeat(runResult(state))
      }
      return 'hit' as const
    }

    const update = (
      state: EngineState,
      deltaSeconds: number,
      clockDeltaSeconds: number,
    ) => {
      const player = state.player
      if (startQueuedStoryCutscene(state)) {
        playSound('cinematic-rise')
        updateHud(state)
      }
      if (state.storyCutscene) {
        state.storyCutsceneBeatElapsedMs += Math.min(clockDeltaSeconds, .1) * 1_000
        const snapshot = getStoryCutsceneSnapshot(state.storyCutscene)
        const beatDurationMs = snapshot.currentBeat?.durationMs ?? 0
        if (beatDurationMs > 0 && state.storyCutsceneBeatElapsedMs >= beatDurationMs) {
          const overflowMs = state.storyCutsceneBeatElapsedMs - beatDurationMs
          if (snapshot.kind === 'guardian-reveal' && snapshot.beatIndex === 0) {
            const guardian = revealStoryGuardian(state, snapshot.sceneId)
            if (guardian) {
              const color = enemyPrimePowerFor(guardian).color
              createParticles(state, guardian.x, guardian.y, color, 20, 46)
              state.shake = reducedMotion ? 0 : 4
              playSound('cinematic-rise')
            }
          } else {
            playSound('cinematic-beat')
          }
          state.storyCutscene = advanceOrCompleteStoryCutscene(state.storyCutscene)
          state.storyCutsceneBeatElapsedMs = overflowMs
          if (getStoryCutsceneSnapshot(state.storyCutscene).finished) {
            const completedSceneId = state.storyCutscene.sceneId
            const guardian = finishStoryCutscene(state)
            playSound(guardian ? 'cinematic-release' : 'cinematic-beat')
            if (completedSceneId === PRIMEBOUND_FINALE_CUTSCENE_ID && !state.ended) {
              state.ended = true
              onVictory(runResult(state))
            }
          }
          updateHud(state)
        }
        state.queuedCombatAction = null
        state.queuedDash = false
        state.queuedTransformation = false
        return
      }
      state.presentationElapsedMs += clockDeltaSeconds * 1_000
      state.stageClockMs += Math.min(clockDeltaSeconds, .25) * 1_000
      if (state.enemyHitStopMs > 0) {
        if (reducedMotion) {
          state.enemyHitStopMs = 0
        } else {
          state.enemyHitStopMs = Math.max(0, state.enemyHitStopMs - deltaSeconds * 1_000)
          return
        }
      }
      if (!state.cinematic && !reducedMotion) {
        const climaxCaster = state.enemies.find((enemy) =>
          enemy.awake && enemy.kind === 'guardian' && enemy.intent &&
          enemy.intentUntilMs > state.elapsedMs &&
          enemy.intentUntilMs - state.elapsedMs <= 90,
        )
        if (climaxCaster) {
          const climaxScale = enemyPrimePowerFor(climaxCaster).anime.slowMotionScale
          deltaSeconds *= Math.max(.78, climaxScale)
        }
      }
      const transformationPausedByCinematic = Boolean(state.cinematic && player.transformation)
      if (state.cinematic) {
        const cinematic = state.cinematic
        // Physics remains capped for collision stability, while QTE/cinematic
        // timing follows monotonic wall time so low FPS cannot extend the window.
        cinematic.elapsedMs += clockDeltaSeconds * 1_000
        if (cinematic.ultimateQte && !cinematic.ultimateQteResult) {
          const qteSnapshot = getUltimateQteSnapshot(
            cinematic.ultimateQte,
            cinematic.elapsedMs,
          )
          if (qteSnapshot.status !== 'active') {
            cinematic.ultimateQteResult = qteSnapshot.result
            playSound(qteSnapshot.result.perfect ? 'parry' : 'cinematic-beat')
            updateHud(state)
          }
        }
        const cinematicProgress = getCinematicProgress(
          cinematic.actionId,
          cinematic.elapsedMs,
          reducedMotion,
        )
        const phrase = cinematicPhrase(
          heroCinematicForState(state, cinematic.actionId),
          cinematicProgress,
        )
        const phraseId = phrase ? cinematicProgress.phase : null
        if (phraseId && phraseId !== cinematic.lastPhraseId) {
          cinematic.lastPhraseId = phraseId
          playSound('cinematic-beat')
          updateHud(state)
        }

        if (!cinematic.impactTriggered && cinematicProgress.impactReached) {
          cinematic.impactTriggered = true
          const timeline = getCinematicTimeline(cinematic.actionId, reducedMotion)
          player.invulnerableUntilMs = Math.max(
            player.invulnerableUntilMs,
            state.elapsedMs + timeline.durationMs - timeline.impactAtMs + 100,
          )
          if (cinematic.actionId === 'prime-infinity') state.projectiles = []
          announceAction(state, cinematic.actionId)
          const regularTimeline = getCinematicTimeline(cinematic.actionId)
          const ultimateQteResult = cinematic.ultimateQte
            ? cinematic.ultimateQteResult ?? resolveUltimateQte(
                cinematic.ultimateQte,
                cinematic.elapsedMs,
              )
            : null
          cinematic.ultimateQteResult = ultimateQteResult
          performClassTechnique(
            state,
            cinematic.actionId,
            timeline.durationMs / regularTimeline.durationMs,
            ultimateQteResult?.damageMultiplier ?? 1,
          )
          const perfectUltimate = ultimateQteResult?.perfect
            ? triggerPerfectUltimateAreaAttack(
                state,
                ultimateQteResult.damageMultiplier,
                reducedMotion,
              )
            : null
          if (ultimateQteResult) {
            state.callout = {
              title: ultimateQteResult.perfect
                ? perfectUltimate?.name ?? ultimateQteResult.finisherName
                : `Amplificação ${ultimateQteResult.grade.toUpperCase()}`,
              detail: ultimateQteResult.perfect
                ? `${ultimateQteResult.finisherLine} · ${perfectUltimate?.formula ?? 'ÁREA TOTAL'} · DANO ×${ultimateQteResult.damageMultiplier.toFixed(2)}`
                : `Sincronia ${Math.round(ultimateQteResult.score / 10)}% · DANO ×${ultimateQteResult.damageMultiplier.toFixed(2)}`,
              untilMs: state.elapsedMs + (ultimateQteResult.perfect
                ? Math.max(3_200, (perfectUltimate?.durationMs ?? 0) + 1_200)
                : 2_200),
            }
            if (ultimateQteResult.perfect) {
              createParticles(
                state,
                player.x,
                player.y,
                getHeroClass(state.heroClassId).palette.energy,
                reducedMotion ? 4 : 14,
                reducedMotion ? 0 : 76,
              )
              state.shake = Math.max(state.shake, 14)
            }
          }
          playSound('cinematic-release')
          playSound(cinematic.actionId === 'prime-infinity' ? 'ultimate' : 'technique')
          updateHud(state)
        }

        state.queuedCombatAction = null
        state.queuedDash = false
        state.queuedTransformation = false
        if (cinematicProgress.phase === 'complete') {
          state.cinematic = null
          player.attackUntilMs = state.elapsedMs
          player.activeAction = null
          updateHud(state)
        } else if (!cinematic.impactTriggered) {
          return
        }
      }

      if (transformationPausedByCinematic && player.transformation) {
        const pausedMs = deltaSeconds * 1_000
        player.transformation = startHeroTransformation(
          player.transformation.classId,
          player.transformation.startedAtMs + pausedMs,
        )
        if (player.nextTransformationPulseAtMs > 0) {
          player.nextTransformationPulseAtMs += pausedMs
        }
      }
      state.elapsedMs += deltaSeconds * 1_000
      state.shake = Math.max(
        0,
        state.shake - deltaSeconds * CAMERA_SHAKE_DECAY_PER_SECOND,
      )

      if (player.transformation && !isHeroTransformationActive(player.transformation, state.elapsedMs)) {
        const fadedForm = resolveHeroTransformationDefinition(player.transformation.classId)
        player.transformation = null
        player.transformationGuardCharges = 0
        player.nextTransformationPulseAtMs = 0
        state.toast = {
          title: `${fadedForm.name} se dissipou`,
          detail: 'A forma pode ser carregada novamente em combate.',
          tone: 'violet',
          untilMs: state.elapsedMs + 2_400,
        }
        state.callout = {
          title: fadedForm.cinematic.aftermathLine,
          detail: 'O brilho recua, mas a prova permanece.',
          untilMs: state.elapsedMs + 1_250,
        }
        createParticles(state, player.x, player.y, fadedForm.palette.energy, 18, 30)
      }

      if (state.transformationIntro) {
        const intro = state.transformationIntro
        const definition = resolveHeroTransformationDefinition(state.heroClassId)
        const introElapsedMs = state.elapsedMs - intro.startedAtMs
        state.queuedCombatAction = null
        state.queuedDash = false
        state.queuedTransformation = false
        if (!intro.released && introElapsedMs >= intro.impactAtMs) {
          intro.released = true
          state.projectiles = []
          state.callout = {
            title: definition.cinematic.releaseLine,
            detail: `${definition.name.toUpperCase()} · ${definition.formula}`,
            untilMs: state.elapsedMs + 1_450,
          }
          addCombatEffect(state, 'prime-resonance', 92, 820)
          createParticles(state, player.x, player.y, definition.palette.flash, 31, 92)
          state.shake = reducedMotion
            ? 0
            : Math.min(13, definition.cinematic.shakeAmplitude)
          state.enemyHitStopMs = reducedMotion ? 0 : definition.cinematic.hitStopMs
          playSound('cinematic-release')
        }
        if (introElapsedMs >= intro.durationMs) {
          player.transformation = startHeroTransformation(state.heroClassId, state.elapsedMs)
          player.transformationCharge = 0
          player.stamina = player.maxStamina
          player.invulnerableUntilMs = Math.max(player.invulnerableUntilMs, state.elapsedMs + 360)
          const uniqueEffect = definition.uniqueEffect
          player.transformationGuardCharges = uniqueEffect.id === 'irreducible-counter'
            ? uniqueEffect.guaranteedGuards
            : 0
          player.nextTransformationPulseAtMs = uniqueEffect.id === 'mersenne-supernova'
            ? state.elapsedMs + uniqueEffect.pulseIntervalMs
            : uniqueEffect.id === 'sieve-autoforge'
              ? state.elapsedMs + uniqueEffect.pulseIntervalMs
              : uniqueEffect.id === 'elliptic-apotheosis'
                ? state.elapsedMs + uniqueEffect.orbIntervalMs
            : 0
          state.transformationIntro = null
          state.toast = {
            title: `${definition.name} ativa · 40 s`,
            detail: `${uniqueEffect.name}: ${uniqueEffect.description}`,
            tone: 'gold',
            untilMs: state.elapsedMs + 4_000,
          }
          state.callout = {
            title: definition.battleCry,
            detail: definition.title,
            untilMs: state.elapsedMs + 1_600,
          }
          updateHud(state)
        } else {
          return
        }
      }

      const transformation = activeHeroTransformation(state)
      if (transformation?.uniqueEffect.id === 'mersenne-supernova') {
        const supernova = transformation.uniqueEffect
        if (state.elapsedMs >= player.nextTransformationPulseAtMs) {
          player.nextTransformationPulseAtMs = state.elapsedMs + supernova.pulseIntervalMs
          let grantsCharge = true
          for (const enemy of livingEnemies(state)) {
            if (distance(player, enemy) > 142 * transformation.modifiers.rangeMultiplier + enemy.radius) continue
            damageEnemyWithAction(
              state,
              enemy,
              'mersenne-burst',
              supernova.novaProjectiles * supernova.novaDamageMultiplier,
              grantsCharge,
            )
            grantsCharge = false
          }
          addCombatEffect(state, 'prime-resonance', 142, 760)
          createParticles(
            state,
            player.x,
            player.y,
            transformation.palette.energy,
            supernova.novaProjectiles,
            84,
          )
          state.callout = {
            title: 'SUPERNOVA 31!',
            detail: '31 fragmentos de Mersenne atravessam o campo.',
            untilMs: state.elapsedMs + 1_050,
          }
          state.shake = reducedMotion ? 0 : 7
          playSound('technique')
        }
      }
      if (transformation?.uniqueEffect.id === 'sieve-autoforge') {
        const autoforge = transformation.uniqueEffect
        if (state.elapsedMs >= player.nextTransformationPulseAtMs) {
          player.nextTransformationPulseAtMs = state.elapsedMs + autoforge.pulseIntervalMs
          const direction = directionVector(player.facing)
          spawnSpellZone(state, {
            kind: 'sieve-turret',
            actionId: 'twin-blades',
            origin: {
              x: player.x + direction.x * 28,
              y: player.y + direction.y * 28,
            },
            radius: 92,
            durationMs: 2_650,
            armDelayMs: 80,
            pulseIntervalMs: 390,
            pulseDamages: Array.from(
              { length: 7 },
              () => 7 * autoforge.turretDamageMultiplier,
            ),
          })
          addCombatEffect(state, 'sieve-deploy', 96, 720)
          state.callout = {
            title: 'AUTOFORJA PRIMA!',
            detail: 'Torre 2·3·5·7 montada automaticamente pelo crivo.',
            untilMs: state.elapsedMs + 1_050,
          }
          playSound('technique')
        }
      }
      if (transformation?.uniqueEffect.id === 'elliptic-apotheosis') {
        const apotheosis = transformation.uniqueEffect
        if (state.elapsedMs >= player.nextTransformationPulseAtMs) {
          player.nextTransformationPulseAtMs = state.elapsedMs + apotheosis.orbIntervalMs
          const targets = livingEnemies(state)
          for (let index = 0; index < apotheosis.orbCount; index += 1) {
            const target = targets[index % Math.max(1, targets.length)] ?? null
            const angle = index / apotheosis.orbCount * Math.PI * 2
            spawnHeroProjectile(state, {
              kind: index === apotheosis.orbCount - 1 ? 'elliptic-chain' : 'elliptic-orb',
              actionId: 'twin-blades',
              damage: 8,
              speed: 190,
              direction: target
                ? projectileDirection(state, target, Math.sin(angle) * 12)
                : { x: Math.cos(angle), y: Math.sin(angle) },
              target,
              homingStrength: 6.8,
              remainingBounces: index === apotheosis.orbCount - 1 ? 3 : 0,
              radius: 4,
              lifeMs: 1_850,
              offset: Math.sin(angle) * 8,
            })
          }
          addCombatEffect(state, 'elliptic-arc', 108, 820)
          state.callout = {
            title: 'APOTEOSE ELÍPTICA!',
            detail: `${apotheosis.orbCount} pontos orbitais buscam a soma no infinito.`,
            untilMs: state.elapsedMs + 1_050,
          }
          playSound('technique')
        }
      }

      if (
        player.transformation &&
        getHeroTransformationRemainingMs(player.transformation, state.elapsedMs) <= 10_000 &&
        getHeroTransformationRemainingMs(player.transformation, state.elapsedMs) > 10_000 - deltaSeconds * 1_000
      ) {
        state.callout = {
          title: '10 SEGUNDOS DE FORMA PRIMA',
          detail: `${resolveHeroTransformationDefinition(state.heroClassId).name} está no limite.`,
          untilMs: state.elapsedMs + 1_350,
        }
      }

      if (state.queuedTransformation) {
        state.queuedTransformation = false
        const definition = resolveHeroTransformationDefinition(state.heroClassId)
        if (activeHeroTransformation(state)) {
          state.toast = {
            title: `${definition.name} já está ativa`,
            detail: `${Math.ceil(getHeroTransformationRemainingMs(player.transformation!, state.elapsedMs) / 1_000)} segundos restantes.`,
            tone: 'violet',
            untilMs: state.elapsedMs + 1_450,
          }
        } else if (player.transformationCharge < TRANSFORMATION_MAX_CHARGE) {
          state.toast = {
            title: 'Forma Prima ainda incompleta',
            detail: `Carga atual: ${Math.floor(player.transformationCharge)}%. Ataque, apare e derrote compostos.`,
            tone: 'violet',
            untilMs: state.elapsedMs + 2_000,
          }
        } else if (state.elapsedMs < player.attackUntilMs) {
          state.toast = {
            title: 'Conclua o golpe atual',
            detail: 'A transformação precisa de um instante de concentração.',
            tone: 'violet',
            untilMs: state.elapsedMs + 1_300,
          }
        } else {
          const durationMs = reducedMotion
            ? definition.cinematic.reducedMotionDurationMs
            : definition.cinematic.durationMs
          const impactAtMs = durationMs
            * (definition.cinematic.impactAtMs / definition.cinematic.durationMs)
          state.transformationIntro = {
            startedAtMs: state.elapsedMs,
            durationMs,
            impactAtMs,
            released: false,
          }
          player.transformationCharge = 0
          player.activeAction = null
          player.attackUntilMs = state.elapsedMs
          player.dashUntilMs = state.elapsedMs
          player.defense = createDefenseState()
          player.invulnerableUntilMs = Math.max(player.invulnerableUntilMs, state.elapsedMs + durationMs)
          state.queuedCombatAction = null
          state.queuedDash = false
          state.callout = {
            title: definition.cinematic.openingLine,
            detail: definition.formula,
            untilMs: state.elapsedMs + durationMs,
          }
          state.shake = 0
          playSound('cinematic-rise')
          updateHud(state)
          return
        }
      }

      const cinematicLocksControls = Boolean(
        state.cinematic || state.storyCutscene || state.transformationIntro,
      )
      if (player.warriorComboUntilMs <= state.elapsedMs) player.warriorComboStep = 0
      if (state.primeChainUntilMs <= state.elapsedMs) {
        state.primeChainCount = 0
        state.primeChainUntilMs = 0
      }
      if (state.primeAscensionUntilMs <= state.elapsedMs) state.primeAscensionUntilMs = 0
      if (state.rangerMarkUntilMs <= state.elapsedMs) {
        state.rangerMarkedEnemyId = null
        state.rangerMarkUntilMs = 0
      }
      for (const enemy of state.enemies) {
        if (enemy.rsaMarkUntilMs <= state.elapsedMs) {
          enemy.rsaMark = 0
          enemy.rsaMarkUntilMs = 0
        }
      }
      player.stamina = clamp(
        player.stamina + deltaSeconds * 22 * (player.maxStamina / 100),
        0,
        player.maxStamina,
      )

      let moveX = 0
      let moveY = 0
      if (!cinematicLocksControls) {
        if (keysRef.current.has('KeyA') || keysRef.current.has('ArrowLeft') || touchDirectionsRef.current.has('left')) moveX -= 1
        if (keysRef.current.has('KeyD') || keysRef.current.has('ArrowRight') || touchDirectionsRef.current.has('right')) moveX += 1
        if (keysRef.current.has('KeyW') || keysRef.current.has('ArrowUp') || touchDirectionsRef.current.has('up')) moveY -= 1
        if (keysRef.current.has('KeyS') || keysRef.current.has('ArrowDown') || touchDirectionsRef.current.has('down')) moveY += 1
      }
      const movement = normalizeMovement({ x: moveX, y: moveY })
      if (Math.abs(movement.x) > Math.abs(movement.y)) player.facing = movement.x < 0 ? 'left' : 'right'
      else if (movement.y !== 0) player.facing = movement.y < 0 ? 'up' : 'down'

      if (state.queuedDash) {
        state.queuedDash = false
        if (canDash({
          phase: 'playing',
          nowMs: state.elapsedMs,
          lastDashAtMs: player.lastDashAtMs,
          cooldownMs: DASH_COOLDOWN_MS,
          stamina: player.stamina,
          staminaCost: DASH_COST,
          isDashing: state.elapsedMs < player.dashUntilMs,
        })) {
          player.lastDashAtMs = state.elapsedMs
          player.dashUntilMs = state.elapsedMs + DASH_DURATION_MS
          const transformation = activeHeroTransformation(state)
          if (transformation?.uniqueEffect.id === 'modular-residue-step') {
            player.invulnerableUntilMs = Math.max(
              player.invulnerableUntilMs,
              state.elapsedMs + transformation.uniqueEffect.dashInvulnerabilityMs,
            )
            addCombatEffect(state, 'constellation-pulse', 34, 320)
            createParticles(state, player.x, player.y, transformation.palette.energy, 13, 54)
          } else if (transformation?.uniqueEffect.id === 'mobius-afterimage') {
            const afterimage = transformation.uniqueEffect
            let grantsCharge = true
            for (const enemy of livingEnemies(state)) {
              if (distance(player, enemy) > afterimage.dashEchoRadius + enemy.radius) continue
              damageEnemyWithAction(
                state,
                enemy,
                'basic-strike',
                OFFENSIVE_ACTIONS['basic-strike'].hitDamages[0] * afterimage.dashEchoDamageMultiplier,
                grantsCharge,
              )
              grantsCharge = false
              applyRsaMark(state, enemy, enemy.rsaMark & 1 ? 2 : 1)
            }
            player.invulnerableUntilMs = Math.max(player.invulnerableUntilMs, state.elapsedMs + 280)
            addCombatEffect(state, 'mobius-step', afterimage.dashEchoRadius, 520)
            createParticles(state, player.x, player.y, transformation.palette.energy, 17, 68)
          }
          player.stamina -= DASH_COST
          playSound('dash')
        }
      }

      if (state.queuedCombatAction) {
        const actionId = state.queuedCombatAction
        state.queuedCombatAction = null
        if (actionId === IRREDUCIBLE_AEGIS.id) {
          if (player.stamina >= GUARD_STAMINA_COST) {
            if (activateClassDefense(state)) {
              player.stamina -= GUARD_STAMINA_COST
              const guardAction = heroActionForState(state, 'irreducible-aegis')
              state.callout = {
                title: guardAction.spokenName,
                detail: guardAction.description,
                untilMs: state.elapsedMs + 850,
              }
              playSound('guard')
            }
          }
        } else {
          const action = OFFENSIVE_ACTIONS[actionId]
          const presentation = heroActionForState(state, actionId)
          const unlocked = isActionUnlocked(state, actionId)
          const ultimate = actionId === 'prime-infinity'
            ? consumeUltimateCharge(player.ultimateCharge)
            : null
          const setupIssue = classActionSetupIssue(state, actionId)
          if (!unlocked) {
            const missingRunes = Math.max(
              1,
              action.requiredRuneCount - state.progress.collectedRunes.length,
            )
            state.toast = {
              title: `${presentation.label} ainda está selada`,
              detail: `Recupere mais ${missingRunes} runa${missingRunes === 1 ? '' : 's'} para dominar esta família.`,
              tone: 'danger',
              untilMs: state.elapsedMs + 2_100,
            }
          } else if (state.elapsedMs < player.attackUntilMs) {
            // Let the active sequence finish so every family keeps its own cadence.
          } else if (!isCooldownReady(player.cooldowns, actionId, state.elapsedMs)) {
            if (actionId === 'prime-infinity') {
              state.toast = {
                title: 'A prova ainda reverbera',
                detail: `${presentation.label} retorna em ${formatCooldown(getCooldownRemaining(player.cooldowns, actionId, state.elapsedMs))}.`,
                tone: 'violet',
                untilMs: state.elapsedMs + 1_400,
              }
            }
          } else if (ultimate && !ultimate.activated) {
            state.toast = {
              title: `${presentation.label} ainda incompleta`,
              detail: 'Ataque, defenda e execute parries para carregar sua energia máxima.',
              tone: 'violet',
              untilMs: state.elapsedMs + 2_100,
            }
          } else if (setupIssue) {
            state.toast = {
              ...setupIssue,
              tone: 'violet',
              untilMs: state.elapsedMs + 1_900,
            }
          } else {
            if (ultimate) player.ultimateCharge = ultimate.charge
            player.defense = {
              ...player.defense,
              startedAtMs: null,
              parryUntilMs: 0,
              guardUntilMs: 0,
            }
            player.cooldowns = startHeroCooldown(state, actionId)
            player.activeAction = actionId
            const cinematicTimeline = isCinematicAction(actionId)
              ? getCinematicTimeline(actionId, reducedMotion)
              : null
            player.attackUntilMs = state.elapsedMs + (
              actionId === 'basic-strike'
                ? ATTACK_DURATION_MS
                : cinematicTimeline
                  ? cinematicTimeline.durationMs - cinematicTimeline.impactAtMs
                  : TECHNIQUE_ATTACK_DURATION_MS
            )
            player.attackSerial += 1
            player.attackOrigin = { x: player.x, y: player.y }
            player.attackFacing = player.facing
            if (actionId === 'basic-strike') {
              announceAction(state, actionId)
              activateClassBasic(state)
              playSound('swing')
            } else if (isCinematicAction(actionId)) {
              state.callout = null
              state.cinematic = {
                actionId,
                focus: { x: player.x, y: player.y },
                elapsedMs: 0,
                impactTriggered: false,
                lastPhraseId: null,
                ultimateQte: actionId === 'prime-infinity'
                  ? startUltimateQte(state.heroClassId, 0)
                  : null,
                ultimateQteResult: null,
                perfectUltimateOrigin: null,
              }
              player.dashUntilMs = state.elapsedMs
              player.invulnerableUntilMs = Math.max(player.invulnerableUntilMs, state.elapsedMs + 100)
              state.shake = 0
              playSound('cinematic-rise')
              updateHud(state)
            } else {
              announceAction(state, actionId)
              performClassTechnique(state, actionId)
              playSound('technique')
            }
          }
        }
      }

      if (state.elapsedMs >= player.attackUntilMs) player.activeAction = null

      if (state.pendingCombatHits.length > 0) {
        const futureHits: PendingCombatHit[] = []
        let landedHit = false
        for (const pendingHit of state.pendingCombatHits) {
          if (pendingHit.executeAtMs > state.elapsedMs) {
            futureHits.push(pendingHit)
            continue
          }
          const enemy = state.enemies.find(({ id }) => id === pendingHit.enemyId)
          if (!enemy || !enemy.awake || enemy.hp <= 0) continue
          if (damageEnemyWithAction(
            state,
            enemy,
            pendingHit.actionId,
            pendingHit.damage,
            pendingHit.grantsUltimateCharge,
          ) > 0) landedHit = true
        }
        state.pendingCombatHits = futureHits
        if (landedHit) playSound('hit')
      }

      if (state.pendingPerfectUltimateWaves.length > 0) {
        const futureWaves: PendingPerfectUltimateWave[] = []
        let landedPerfectWave = false
        for (const wave of state.pendingPerfectUltimateWaves) {
          if (wave.executeAtPresentationMs > state.presentationElapsedMs) {
            futureWaves.push(wave)
            continue
          }
          const origin = { x: wave.x, y: wave.y }
          for (const enemy of livingEnemies(state)) {
            if (distance(origin, enemy) > wave.radius + enemy.radius) continue
            const firstStagger = !wave.stunnedEnemyIds.has(enemy.id)
            if (damageEnemyWithPerfectUltimate(
              state,
              enemy,
              wave.damage,
              firstStagger ? wave.stunMs : 0,
              reducedMotion,
            ) > 0) {
              landedPerfectWave = true
              if (firstStagger) wave.stunnedEnemyIds.add(enemy.id)
            }
          }
          createParticles(
            state,
            wave.x,
            wave.y,
            getHeroClass(state.heroClassId).palette.accent,
            reducedMotion ? 3 : 9,
            reducedMotion ? 0 : Math.min(96, wave.radius * .42),
          )
          const waveShake = wave.isFinal
            ? Math.min(9, 6 + wave.damage * .08)
            : Math.min(6, 3 + wave.damage * .08)
          state.shake = Math.max(state.shake, waveShake)
        }
        state.pendingPerfectUltimateWaves = futureWaves
        if (landedPerfectWave) playSound('hit')
      }

      const classMovementSpeed = getHeroClass(state.heroClassId).stats.movementSpeed
        * blessingEffects(state.blessings).speedMultiplier
        * (activeHeroTransformation(state)?.modifiers.movementSpeedMultiplier ?? 1)
      const movementSpeed = state.elapsedMs < player.dashUntilMs
        ? classMovementSpeed * (BASE_DASH_SPEED / BASE_PLAYER_SPEED)
        : classMovementSpeed
      const effectiveMovement = state.cinematic
        ? { x: 0, y: 0 }
        : movement.x === 0 && movement.y === 0 && state.elapsedMs < player.dashUntilMs
          ? directionVector(player.facing)
          : movement
      if (effectiveMovement.x !== 0 || effectiveMovement.y !== 0) {
        player.lastMoveAtMs = state.elapsedMs
      }
      moveWithCollision(
        state.areaId,
        player,
        PLAYER_RADIUS,
        effectiveMovement.x * movementSpeed * deltaSeconds,
        effectiveMovement.y * movementSpeed * deltaSeconds,
      )

      if (
        getHeroClass(state.heroClassId).archetype === 'warrior' &&
        player.activeAction === 'basic-strike' &&
        state.elapsedMs < player.attackUntilMs
      ) {
        const comboDamageMultiplier = player.warriorComboStep === 3
          ? 1.65
          : player.warriorComboStep === 2 ? 1.18 : 1
        const comboReachMultiplier = player.warriorComboStep === 3
          ? 1.24
          : player.warriorComboStep === 2 ? 1.08 : 1
        for (const enemy of state.enemies) {
          if (!enemy.awake || enemy.lastAttackSerial === player.attackSerial) continue
          if (!isSwordAttackHit(
            {
              origin: player.attackOrigin,
              facing: player.attackFacing,
              range: OFFENSIVE_ACTIONS['basic-strike'].range
                * getHeroClass(state.heroClassId).modifiers.rangeMultiplier
                * (activeHeroTransformation(state)?.modifiers.rangeMultiplier ?? 1)
                * comboReachMultiplier,
              arcRadians: player.warriorComboStep === 3
                ? Math.PI * 1.25
                : heroAttackArcRadians(state, 'basic-strike'),
            },
            { center: enemy, radius: enemy.radius },
          )) continue
          enemy.lastAttackSerial = player.attackSerial
          damageEnemyWithAction(
            state,
            enemy,
            'basic-strike',
            OFFENSIVE_ACTIONS['basic-strike'].hitDamages[0] * comboDamageMultiplier,
          )
          const push = directionVector(player.attackFacing)
          const pushDistance = player.warriorComboStep === 3 ? 20 : 7
          moveWithCollision(
            state.areaId,
            enemy,
            enemy.radius,
            push.x * pushDistance,
            push.y * pushDistance,
          )
          createParticles(state, enemy.x, enemy.y, enemy.kind === 'guardian' ? '#f2c15c' : '#e06b70', 9, 44)
          state.shake = enemy.kind === 'guardian' ? 4 : 2
          playSound('hit')
        }
      }

      if (
        (!state.cinematic || state.cinematic.impactTriggered) &&
        state.heroProjectiles.length > 0
      ) {
        const activeHeroProjectiles: HeroProjectileState[] = []
        for (const projectile of state.heroProjectiles) {
          let homingTarget = projectile.targetEnemyId
            ? state.enemies.find((enemy) =>
                enemy.id === projectile.targetEnemyId && enemy.awake && enemy.hp > 0,
              ) ?? null
            : null
          if (!homingTarget && projectile.homingStrength > 0) {
            homingTarget = nearestEnemy(state, projectile, projectile.hitEnemyIds, 220)
            projectile.targetEnemyId = homingTarget?.id ?? null
          }
          if (homingTarget && projectile.homingStrength > 0) {
            const desired = normalizeMovement({
              x: homingTarget.x - projectile.x,
              y: homingTarget.y - projectile.y,
            })
            const blend = clamp(projectile.homingStrength * deltaSeconds, 0, 1)
            const steered = normalizeMovement({
              x: projectile.vx / projectile.speed * (1 - blend) + desired.x * blend,
              y: projectile.vy / projectile.speed * (1 - blend) + desired.y * blend,
            })
            projectile.vx = steered.x * projectile.speed
            projectile.vy = steered.y * projectile.speed
          }

          projectile.x += projectile.vx * deltaSeconds
          projectile.y += projectile.vy * deltaSeconds
          projectile.lifeMs -= deltaSeconds * 1_000
          if (
            projectile.lifeMs <= 0 ||
            !isWalkable(state.areaId, projectile.x, projectile.y, projectile.radius)
          ) continue

          const hitEnemy = livingEnemies(state)
            .filter((enemy) =>
              !projectile.hitEnemyIds.includes(enemy.id) &&
              distance(projectile, enemy) <= projectile.radius + enemy.radius,
            )
            .sort((first, second) => distance(projectile, first) - distance(projectile, second))[0]
          if (!hitEnemy) {
            activeHeroProjectiles.push(projectile)
            continue
          }

          const landed = damageEnemyWithAction(
            state,
            hitEnemy,
            projectile.actionId,
            projectile.damage,
            projectile.grantsUltimateCharge,
            !projectile.isTransformationEcho,
          ) > 0
          projectile.grantsUltimateCharge = false
          projectile.hitEnemyIds.push(hitEnemy.id)
          if (projectile.rsaMark !== 0) {
            applyRsaMark(state, hitEnemy, projectile.rsaMark)
          }
          if (projectile.kind === 'ricochet-arrow') markRangerTarget(state, hitEnemy)
          if (projectile.kind === 'elliptic-orb' || projectile.kind === 'elliptic-chain') {
            hitEnemy.intent = null
            hitEnemy.stunnedUntilMs = Math.max(hitEnemy.stunnedUntilMs, state.elapsedMs + 190)
            addCombatEffect(state, 'elliptic-arc', 30, 380, hitEnemy)
          }
          if (projectile.kind === 'sieve-bolt' || projectile.kind === 'turret-bolt') {
            addCombatEffect(state, 'sieve-deploy', 22, 300, hitEnemy)
          }
          if (landed) {
            createParticles(
              state,
              hitEnemy.x,
              hitEnemy.y,
              getHeroClass(state.heroClassId).palette.energy,
              8,
              45,
            )
            playSound('hit')
          }

          if (projectile.kind === 'euclid-arrow') {
            hitEnemy.intent = null
            hitEnemy.stunnedUntilMs = Math.max(hitEnemy.stunnedUntilMs, state.elapsedMs + 180)
            addCombatEffect(state, 'constellation-pulse', 24, 320, hitEnemy)
            activeHeroProjectiles.push(projectile)
            continue
          }

          const canBounce = (
            projectile.kind === 'rsa-chain' ||
            projectile.kind === 'ricochet-arrow' ||
            projectile.kind === 'elliptic-chain'
          ) && projectile.remainingBounces > 0
          const nextTarget = canBounce
            ? nearestEnemy(state, hitEnemy, projectile.hitEnemyIds, 155)
            : null
          if (nextTarget) {
            const nextDirection = normalizeMovement({
              x: nextTarget.x - hitEnemy.x,
              y: nextTarget.y - hitEnemy.y,
            })
            projectile.x = hitEnemy.x + nextDirection.x * (hitEnemy.radius + 5)
            projectile.y = hitEnemy.y + nextDirection.y * (hitEnemy.radius + 5)
            projectile.vx = nextDirection.x * projectile.speed
            projectile.vy = nextDirection.y * projectile.speed
            projectile.targetEnemyId = (
              projectile.kind === 'rsa-chain' || projectile.kind === 'elliptic-chain'
            ) ? nextTarget.id : null
            projectile.remainingBounces -= 1
            activeHeroProjectiles.push(projectile)
          } else if (projectile.kind === 'ricochet-arrow') {
            damageEnemyWithAction(
              state,
              hitEnemy,
              projectile.actionId,
              OFFENSIVE_ACTIONS['sophie-chain'].hitDamages[1],
              false,
            )
            addCombatEffect(state, 'arrow-rain', 28, 360, hitEnemy)
          }
        }
        state.heroProjectiles = activeHeroProjectiles
      }

      if (state.spellZones.length > 0) {
        const activeZones: SpellZoneState[] = []
        for (const zone of state.spellZones) {
          const age = state.elapsedMs - zone.startedAtMs
          if (zone.consumed || age >= zone.durationMs) continue
          if (state.elapsedMs < zone.armAtMs) {
            activeZones.push(zone)
            continue
          }
          if (zone.kind === 'glyph') {
            const trigger = nearestEnemy(state, zone, [], zone.radius)
            if (!trigger) {
              activeZones.push(zone)
              continue
            }
            let grantsCharge = true
            for (const enemy of livingEnemies(state)) {
              if (distance(zone, enemy) > zone.radius + enemy.radius) continue
              damageEnemyWithAction(
                state,
                enemy,
                zone.actionId,
                zone.pulseDamages[0],
                grantsCharge,
              )
              grantsCharge = false
            }
            zone.consumed = true
            addCombatEffect(state, 'glyph-detonation', zone.radius + 12, 520, zone)
            createParticles(state, zone.x, zone.y, getHeroClass(state.heroClassId).palette.accent, 14, 50)
            playSound('hit')
            continue
          }
          while (
            zone.pulseIndex < zone.pulseDamages.length &&
            state.elapsedMs >= zone.nextPulseAtMs
          ) {
            const damage = zone.pulseDamages[zone.pulseIndex]
            let grantsCharge = zone.pulseIndex === 0
            let landedPulse = false
            for (const enemy of livingEnemies(state)) {
              if (distance(zone, enemy) > zone.radius + enemy.radius) continue
              if (damageEnemyWithAction(
                state,
                enemy,
                zone.actionId,
                damage,
                grantsCharge,
              ) > 0) landedPulse = true
              grantsCharge = false
            }
            zone.pulseIndex += 1
            zone.nextPulseAtMs += zone.pulseIntervalMs
            const pulseEffectKind: CombatEffectKind = zone.kind === 'constellation'
              ? 'constellation-pulse'
              : zone.kind === 'elliptic-singularity' || zone.kind === 'elliptic-curve'
                ? 'elliptic-arc'
                : zone.kind === 'sieve-turret' || zone.kind === 'sieve-line' ||
                    zone.kind === 'sieve-minefield' || zone.kind === 'sieve-grid'
                  ? 'sieve-deploy'
                  : 'glyph-detonation'
            addCombatEffect(
              state,
              pulseEffectKind,
              zone.kind === 'constellation' ? 118 : zone.radius,
              480,
              zone,
            )
            if (landedPulse) playSound('hit')
            if (zone.pulseIntervalMs <= 0) break
          }
          activeZones.push(zone)
        }
        state.spellZones = activeZones
      }

      for (const enemy of state.enemies) {
        if (enemy.hp <= 0 || !enemy.awake) continue
        if (state.cinematic) continue
        const definition = PRIMEBOUND_ENEMIES[enemy.id]
        const toPlayer = normalizeMovement({ x: player.x - enemy.x, y: player.y - enemy.y })
        const playerDistance = distance(player, enemy)
        const controllingZone = state.spellZones.find((zone) =>
          (
            zone.kind === 'supernova' ||
            zone.kind === 'elliptic-singularity' ||
            zone.kind === 'elliptic-curve' ||
            zone.kind === 'sieve-line' ||
            zone.kind === 'sieve-grid'
          ) &&
          state.elapsedMs < zone.startedAtMs + zone.durationMs &&
          distance(zone, enemy) <= zone.radius + enemy.radius,
        )
        if (controllingZone?.kind === 'elliptic-singularity') {
          const pull = normalizeMovement({
            x: controllingZone.x - enemy.x,
            y: controllingZone.y - enemy.y,
          })
          moveWithCollision(
            state.areaId,
            enemy,
            enemy.radius,
            pull.x * 16 * deltaSeconds,
            pull.y * 16 * deltaSeconds,
          )
        }
        const enemyMoveSpeed = enemy.speed * (controllingZone ? .48 : 1)

        const resolvedBossPhase = getEnemyBossPhase(
          enemy.hp,
          enemy.maxHp,
          definition.encounterRank,
        )
        if (resolvedBossPhase > enemy.bossPhase) {
          enemy.bossPhase = resolvedBossPhase
          enemy.powerCastSerial = 0
          enemy.intent = null
          enemy.intentTarget = null
          enemy.lastActionAtMs = state.elapsedMs
          enemy.stunnedUntilMs = state.elapsedMs + 620
          state.projectiles = state.projectiles.filter((projectile) =>
            projectile.sourceEnemyId !== enemy.id,
          )
          const phasePower = enemyPrimePowerFor(enemy)
          addEnemyPowerEffect(state, enemy, phasePower, 'phase-break')
          createParticles(state, enemy.x, enemy.y, phasePower.color, 18, 58)
          state.toast = {
            title: `${definition.name} entrou na fase ${resolvedBossPhase}`,
            detail: `${definition.signaturePower.name} · ${definition.signaturePower.formula}`,
            tone: 'danger',
            untilMs: state.elapsedMs + 3_200,
          }
          state.callout = {
            title: `FASE ${resolvedBossPhase} · ${phasePower.anime.techniqueName}`,
            detail: `${phasePower.anime.battleCry} · ${phasePower.anime.glyph}`,
            untilMs: state.elapsedMs + 1_750,
            source: 'enemy',
            familyId: phasePower.id,
            phase: resolvedBossPhase,
            worldPosition: { x: enemy.x, y: enemy.y },
          }
          state.enemyHitStopMs = Math.max(
            state.enemyHitStopMs,
            Math.min(72, Math.round(phasePower.anime.hitStopMs * .65)),
          )
          state.shake = Math.max(state.shake, 3 + resolvedBossPhase * .7)
          continue
        }

        const primePower = enemyPrimePowerFor(enemy)
        if (state.elapsedMs < enemy.stunnedUntilMs) continue

        if (enemy.intent && state.elapsedMs >= enemy.intentUntilMs) {
          const lockedTarget = enemy.intentTarget ?? player
          const lockedDirection = normalizeMovement({
            x: lockedTarget.x - enemy.x,
            y: lockedTarget.y - enemy.y,
          })
          if (enemy.intent === 'charge') {
            const chargeSpeed = 128 + enemy.bossPhase * 8
            enemy.vx = lockedDirection.x * chargeSpeed
            enemy.vy = lockedDirection.y * chargeSpeed
          } else {
            executeEnemyPrimePower(state, enemy, lockedTarget)
            playSound('technique')
          }
          enemy.lastActionAtMs = state.elapsedMs
          enemy.intent = null
          enemy.intentTarget = null
        }

        if (!enemy.intent) {
          if (playerDistance < 220
            && state.elapsedMs - enemy.lastActionAtMs > primePower.cooldownMs) {
            enemy.intent = primePower.intent
            enemy.intentStartedAtMs = state.elapsedMs
            enemy.intentUntilMs = state.elapsedMs + primePower.telegraphMs
            enemy.intentTarget = { x: player.x, y: player.y }
          }
        }

        if (!enemy.intent) {
          if (enemy.kind === 'caster') {
            const retreat = playerDistance < 68 ? -1 : playerDistance > 112 ? .65 : 0
            moveWithCollision(state.areaId, enemy, enemy.radius, toPlayer.x * enemyMoveSpeed * retreat * deltaSeconds, toPlayer.y * enemyMoveSpeed * retreat * deltaSeconds)
          } else if (enemy.kind === 'guardian') {
            const bossApproach = playerDistance > 90 ? .72 : playerDistance < 54 ? -.42 : 0
            moveWithCollision(state.areaId, enemy, enemy.radius, toPlayer.x * enemyMoveSpeed * bossApproach * deltaSeconds, toPlayer.y * enemyMoveSpeed * bossApproach * deltaSeconds)
          } else if (enemy.kind === 'charger' && state.elapsedMs - enemy.lastActionAtMs < 480) {
            const slowMultiplier = controllingZone ? .48 : 1
            moveWithCollision(state.areaId, enemy, enemy.radius, enemy.vx * slowMultiplier * deltaSeconds, enemy.vy * slowMultiplier * deltaSeconds)
          } else if (playerDistance < 194) {
            moveWithCollision(state.areaId, enemy, enemy.radius, toPlayer.x * enemyMoveSpeed * deltaSeconds, toPlayer.y * enemyMoveSpeed * deltaSeconds)
          }
        }

        if (distance(player, enemy) <= PLAYER_RADIUS + enemy.radius + 1) {
          damagePlayer(state, definition.damage >= 11 ? 2 : 1, enemy, enemy.id)
        }
      }

      const survivingEnemies: EnemyState[] = []
      for (const enemy of state.enemies) {
        if (enemy.hp > 0) {
          survivingEnemies.push(enemy)
          continue
        }
        if (!state.progress.defeatedEnemyIds.includes(enemy.id)) {
          if (state.rangerMarkedEnemyId === enemy.id) {
            state.rangerMarkedEnemyId = null
            state.rangerMarkUntilMs = 0
          }
          state.progress.defeatedEnemyIds.push(enemy.id)
          state.kills += 1
          state.player.ultimateCharge = gainUltimateCharge(
            state.player.ultimateCharge,
            'enemy-defeated',
            getHeroClass(state.heroClassId).modifiers.ultimateChargeMultiplier,
          )
          const definition = PRIMEBOUND_ENEMIES[enemy.id]
          if (definition.encounterRank === 'minion') {
            updateStageEncounter(
              state,
              recordStageMinionDefeat(stageEncounterFor(state)),
            )
          }
          grantTransformationCharge(
            state,
            definition.encounterRank === 'minion' ? 10 : definition.encounterRank === 'area-boss' ? 20 : 28,
          )
          const factorText = definition.primeFactors.join(' × ')
          const encounterDefeated = definition.encounterRank !== 'minion'
          if (encounterDefeated) {
            state.projectiles = state.projectiles.filter((projectile) =>
              projectile.sourceEnemyId !== enemy.id,
            )
          }
          state.toast = {
            title: encounterDefeated
              ? `${definition.encounterRank === 'final-boss' ? 'CHEFE FINAL' : 'CHEFE'} DERROTADO · ${definition.name}`
              : `${definition.number} foi fatorado`,
            detail: encounterDefeated
              ? `${definition.number} = ${factorText}. ${definition.signaturePower.name} foi rompido.`
              : `${definition.number} = ${factorText}. A sombra perdeu sua forma.`,
            tone: enemy.kind === 'guardian' ? 'gold' : 'violet',
            untilMs: state.elapsedMs + 3_200,
          }
          createParticles(state, enemy.x, enemy.y, enemy.kind === 'guardian' ? '#f2c15c' : '#a995ef', enemy.kind === 'guardian' ? 36 : 18, 54)
          if (definition.isBoss) {
            queueStoryCutscene(state, PRIMEBOUND_FINALE_CUTSCENE_ID)
            state.player.invulnerableUntilMs = state.elapsedMs + 30_000
            state.projectiles = []
            state.heroProjectiles = []
            playSound('victory')
          }
          if (definition.encounterRank === 'area-boss') {
            completeCurrentStage(state)
          }
        }
      }
      state.enemies = survivingEnemies

      let stageEncounter = stageEncounterFor(state)
      let activeMinionCount = state.enemies.filter((enemy) =>
        enemy.hp > 0 && PRIMEBOUND_ENEMIES[enemy.id].encounterRank === 'minion',
      ).length
      if (shouldScheduleStageReinforcement(stageEncounter, activeMinionCount)) {
        stageEncounter = scheduleStageReinforcement(
          stageEncounter,
          state.stageClockMs,
          activeMinionCount,
        )
        updateStageEncounter(state, stageEncounter)
      }
      if (isStageReinforcementReady(stageEncounter, state.stageClockMs)) {
        const minionIds = areaEnemyIdsByRank(state.areaId, 'minion')
        const livingIds = new Set(state.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => enemy.id))
        const reinforcementId = minionIds.find((enemyId) => !livingIds.has(enemyId))
        if (reinforcementId) {
          state.progress.defeatedEnemyIds = state.progress.defeatedEnemyIds.filter(
            (enemyId) => enemyId !== reinforcementId,
          )
          const reinforcement = createEnemyState(reinforcementId)
          reinforcement.stunnedUntilMs = state.elapsedMs + 620
          state.enemies.push(reinforcement)
          stageEncounter = deployStageReinforcement(stageEncounter)
          updateStageEncounter(state, stageEncounter)
          activeMinionCount += 1
          createParticles(
            state,
            reinforcement.x,
            reinforcement.y,
            AREA_ACCENTS[state.areaId] ?? '#f2c15c',
            14,
            38,
          )
          state.shake = Math.max(state.shake, 2)
          playSound('portal')
        } else {
          stageEncounter = cancelStageReinforcement(stageEncounter)
          updateStageEncounter(state, stageEncounter)
        }
      }

      const sleepingAreaBoss = state.enemies.find((enemy) =>
        PRIMEBOUND_ENEMIES[enemy.id].encounterRank === 'area-boss' && !enemy.awake,
      )
      activeMinionCount = state.enemies.filter((enemy) =>
        enemy.hp > 0 && PRIMEBOUND_ENEMIES[enemy.id].encounterRank === 'minion',
      ).length
      const stageGuardianReady = canAwakenStageGuardian(
        stageEncounter,
        activeMinionCount,
      )
      if (sleepingAreaBoss && stageGuardianReady) {
        queueStoryCutscene(state, GUARDIAN_REVEAL_CUTSCENE_IDS[state.areaId])
      }

      if (
        !sleepingAreaBoss && state.areaId === 'prime-sanctuary' &&
        stageGuardianReady && !state.progress.completedStageIds.includes(state.areaId)
      ) {
        completeCurrentStage(state)
      }

      const sleepingBoss = state.enemies.find((enemy) => enemy.id === 'composite-sentinel' && !enemy.awake)
      if (sleepingBoss && canChallengeCompositeSentinel(progressView(state))) {
        queueStoryCutscene(state, GUARDIAN_REVEAL_CUTSCENE_IDS['prime-sanctuary'])
      }

      const activeProjectiles: ProjectileState[] = []
      let playerRespawnedDuringProjectileLoop = false
      for (const projectile of state.projectiles) {
        if (state.cinematic) {
          activeProjectiles.push(projectile)
          continue
        }
        projectile.ageMs += deltaSeconds * 1_000
        const projectileSpeed = Math.hypot(projectile.vx, projectile.vy)
        if (projectile.homingStrength > 0 && projectileSpeed > 0) {
          const targetDirection = normalizeMovement({
            x: player.x - projectile.x,
            y: player.y - projectile.y,
          })
          const currentDirection = {
            x: projectile.vx / projectileSpeed,
            y: projectile.vy / projectileSpeed,
          }
          const turn = clamp(projectile.homingStrength * deltaSeconds, 0, .18)
          const homingDirection = normalizeMovement({
            x: currentDirection.x + (targetDirection.x - currentDirection.x) * turn,
            y: currentDirection.y + (targetDirection.y - currentDirection.y) * turn,
          })
          projectile.vx = homingDirection.x * projectileSpeed
          projectile.vy = homingDirection.y * projectileSpeed
        }
        if (projectile.angularVelocity !== 0) {
          const rotation = projectile.angularVelocity * deltaSeconds
          const cosine = Math.cos(rotation)
          const sine = Math.sin(rotation)
          const rotatedX = projectile.vx * cosine - projectile.vy * sine
          const rotatedY = projectile.vx * sine + projectile.vy * cosine
          projectile.vx = rotatedX
          projectile.vy = rotatedY
        }
        projectile.x += projectile.vx * deltaSeconds
        projectile.y += projectile.vy * deltaSeconds
        projectile.lifeMs -= deltaSeconds * 1_000
        if (projectile.lifeMs <= 0) continue
        if (!isWalkable(state.areaId, projectile.x, projectile.y, projectile.radius)) {
          addEnemyProjectileImpact(state, projectile)
          continue
        }
        const heroClass = getHeroClass(state.heroClassId)
        const classWardActive = state.player.classDefenseUntilMs > state.elapsedMs
        if (
          classWardActive &&
          (
            heroClass.archetype === 'cryptographer' ||
            heroClass.archetype === 'arcanist' ||
            heroClass.archetype === 'assassin' ||
            heroClass.archetype === 'engineer' ||
            heroClass.archetype === 'oracle'
          ) &&
          distance(player, projectile) <= (
            heroClass.archetype === 'engineer' ? 76
              : heroClass.archetype === 'cryptographer' ? 68 : 62
          )
        ) {
          const sourceEnemy = state.enemies.find((enemy) => enemy.id === projectile.sourceEnemyId)
          if (heroClass.archetype === 'cryptographer' && sourceEnemy && sourceEnemy.hp > 0) {
            damageEnemyWithAction(state, sourceEnemy, 'basic-strike', 14, true)
            const reflectedMark: RsaMark = sourceEnemy.rsaMark & 1 ? 2 : 1
            applyRsaMark(state, sourceEnemy, reflectedMark)
          } else if (heroClass.archetype === 'arcanist') {
            spawnSpellZone(state, {
              kind: 'glyph',
              actionId: 'basic-strike',
              origin: { x: projectile.x, y: projectile.y },
              radius: 25,
              durationMs: 4_200,
              armDelayMs: 120,
              pulseDamages: [16],
            })
          } else if (heroClass.archetype === 'assassin' && sourceEnemy && sourceEnemy.hp > 0) {
            const invertedSign: RsaMark = sourceEnemy.rsaMark & 1 ? 2 : 1
            applyRsaMark(state, sourceEnemy, invertedSign)
            damageEnemyWithAction(state, sourceEnemy, 'basic-strike', 16, true)
            addCombatEffect(state, 'mobius-step', 46, 460, sourceEnemy)
          } else if (heroClass.archetype === 'engineer') {
            spawnHeroProjectile(state, {
              kind: 'turret-bolt',
              actionId: 'basic-strike',
              damage: 15,
              speed: 280,
              direction: projectileDirection(state, sourceEnemy ?? null),
              target: sourceEnemy ?? null,
              homingStrength: 4.5,
              radius: 3,
              lifeMs: 1_100,
            })
          } else if (heroClass.archetype === 'oracle') {
            spawnHeroProjectile(state, {
              kind: 'elliptic-orb',
              actionId: 'basic-strike',
              damage: 13,
              speed: 205,
              direction: projectileDirection(state, sourceEnemy ?? null),
              target: sourceEnemy ?? null,
              homingStrength: 7,
              radius: 4,
              lifeMs: 1_350,
            })
          }
          state.player.ultimateCharge = addUltimateCharge(
            state.player.ultimateCharge,
            classUltimateGain(state, 8),
          )
          createParticles(state, projectile.x, projectile.y, heroClass.palette.energy, 12, 44)
          addEnemyProjectileImpact(state, projectile)
          state.enemyHitStopMs = Math.max(state.enemyHitStopMs, 28)
          playSound('parry')
          continue
        }
        if (distance(player, projectile) <= PLAYER_RADIUS + projectile.radius) {
          const outcome = damagePlayer(
            state,
            projectile.damage,
            projectile,
            projectile.sourceEnemyId,
          )
          if (outcome !== 'respawned') {
            addEnemyProjectileImpact(
              state,
              projectile,
              outcome === 'hit' || outcome === 'parried',
            )
          }
          if (outcome === 'hit' || outcome === 'parried' || outcome === 'respawned') {
            const impactAnime = resolveEnemyPrimePowerAnimePresentation(
              projectile.familyId,
              projectile.phase,
            )
            state.enemyHitStopMs = Math.max(
              state.enemyHitStopMs,
              Math.min(48, Math.round(impactAnime.hitStopMs * .45)),
            )
            state.shake = Math.max(state.shake, impactAnime.shakePx * .45)
          }
          if (outcome === 'respawned') {
            playerRespawnedDuringProjectileLoop = true
            break
          }
          continue
        }
        activeProjectiles.push(projectile)
      }
      state.projectiles = playerRespawnedDuringProjectileLoop ? [] : activeProjectiles

      for (const particle of state.particles) {
        particle.x += particle.vx * deltaSeconds
        particle.y += particle.vy * deltaSeconds
        particle.vx *= 0.94
        particle.vy *= 0.94
        particle.lifeMs -= deltaSeconds * 1_000
      }
      state.particles = state.particles.filter((particle) => particle.lifeMs > 0)
      state.combatEffects = state.combatEffects.filter((effect) => {
        const effectClock = effect.usesPresentationClock
          ? state.presentationElapsedMs
          : state.elapsedMs
        return effectClock - effect.startedAtMs < effect.durationMs
      })
      state.enemyPowerEffects = state.enemyPowerEffects.filter((effect) =>
        state.elapsedMs - effect.startedAtMs < effect.durationMs,
      )

      if (state.toast && state.toast.untilMs <= state.elapsedMs) state.toast = null
      if (state.callout && state.callout.untilMs <= state.elapsedMs) state.callout = null
    }

    const frame = (time: number) => {
      const state = engineRef.current
      const clockDeltaSeconds = Math.max(0, (time - previousTime) / 1_000)
      const deltaSeconds = Math.min(0.034, clockDeltaSeconds)
      previousTime = time
      const active = !pausedRef.current && !orientationBlockedRef.current && !dialogueRef.current && !state.ended
      if (active) update(state, deltaSeconds, clockDeltaSeconds)
      if (active || !idleFrameDrawn) {
        drawWorld(context, state, reducedMotion, clockDeltaSeconds, peerGhostsRef.current)
      }
      idleFrameDrawn = !active
      const hudUpdateIntervalMs = state.cinematic?.ultimateQte ? 32 : 90
      if (time - lastHudUpdateRef.current >= hudUpdateIntervalMs) {
        lastHudUpdateRef.current = time
        updateHud(state)
      }
      if (active) frameId = window.requestAnimationFrame(frame)
      else {
        idleTimer = window.setTimeout(() => {
          frameId = window.requestAnimationFrame(frame)
        }, 120)
      }
    }
    frameId = window.requestAnimationFrame(frame)
    return () => {
      window.cancelAnimationFrame(frameId)
      if (idleTimer !== null) window.clearTimeout(idleTimer)
    }
  }, [onDefeat, onVictory, playSound, reducedMotion, updateHud])

  useEffect(() => () => {
  }, [])

  const holdDirection = (direction: Direction, active: boolean) => {
    if (active) touchDirectionsRef.current.add(direction)
    else touchDirectionsRef.current.delete(direction)
  }

  const directionPointer = (direction: Direction, event: ReactPointerEvent<HTMLButtonElement>, active: boolean) => {
    event.preventDefault()
    holdDirection(direction, active)
    if (active) event.currentTarget.setPointerCapture(event.pointerId)
    else if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const nudgeDirection = (direction: Direction) => {
    if (pausedRef.current || orientationBlockedRef.current || dialogueRef.current) return
    const state = engineRef.current
    if (state.cinematic || state.storyCutscene || state.transformationIntro || state.blessingChoice) return
    const vector = directionVector(direction)
    state.player.facing = direction
    moveWithCollision(state.areaId, state.player, PLAYER_RADIUS, vector.x * 12, vector.y * 12)
  }

  const queueCombatAction = (action: PlayerCombatAction) => {
    if (
      pausedRef.current || orientationBlockedRef.current ||
      dialogueRef.current || engineRef.current.cinematic ||
      engineRef.current.storyCutscene || engineRef.current.transformationIntro
    ) return
    engineRef.current.queuedCombatAction = action
    canvasRef.current?.focus()
  }

  const queueTransformation = () => {
    if (
      pausedRef.current || orientationBlockedRef.current ||
      dialogueRef.current || engineRef.current.cinematic ||
      engineRef.current.storyCutscene || engineRef.current.transformationIntro
    ) return
    engineRef.current.queuedTransformation = true
    canvasRef.current?.focus()
  }

  const heroClass = getHeroClass(heroClassId)
  const stageMechanic = getPrimeStageMechanic(hud.areaId)
  const heroStyle = {
    '--pb-hero-primary': heroClass.palette.primary,
    '--pb-hero-secondary': heroClass.palette.secondary,
    '--pb-hero-accent': heroClass.palette.accent,
    '--pb-hero-energy': heroClass.palette.energy,
  } as CSSProperties
  const activeLine = dialogue ? dialogue.lines[dialogue.index] : null
  const areaIndex = PRIMEBOUND_WORLD.areaOrder.indexOf(hud.areaId)
  const techniques = TECHNIQUE_IDS.map((actionId, index) => {
    const action = OFFENSIVE_ACTIONS[actionId]
    const presentation = heroClass.actions[TECHNIQUE_SLOT_BY_ID[actionId]]
    const cooldown = hud.cooldowns[actionId]
    const locked = hud.unlockedTechniqueCount < action.requiredRuneCount
    const family = action.family ? PRIME_FAMILIES[action.family] : null
    return { actionId, action, presentation, cooldown, family, index, locked }
  })
  const guardPresentation = heroClass.actions.Q
  const mobileControls = {
    warrior: { defense: 'PARRY', basic: 'CORTE', symbol: '†' },
    cryptographer: { defense: 'FIREWALL', basic: 'PULSO', symbol: '◇' },
    ranger: { defense: 'RECUO', basic: 'FLECHA', symbol: '➶' },
    arcanist: { defense: 'WARD', basic: 'GLIFO', symbol: '✦' },
    assassin: { defense: 'VÉU', basic: 'LÂMINA μ', symbol: 'μ' },
    berserker: { defense: 'GUARDA', basic: 'IMPACTO', symbol: '⚒' },
    engineer: { defense: 'BARREIRA', basic: 'REBITE', symbol: '⌗' },
    oracle: { defense: 'ÉGIDE', basic: 'ORBE', symbol: '𝒪' },
  }[heroClass.archetype]
  const mobileDefenseLabel = mobileControls.defense
  const mobileBasicLabel = mobileControls.basic
  const mobileBasicSymbol = mobileControls.symbol
  const defenseCooldown = hud.cooldowns[IRREDUCIBLE_AEGIS.id]
  const ultimate = OFFENSIVE_ACTIONS['prime-infinity']
  const ultimatePresentation = heroClass.actions.R
  const ultimateCooldown = hud.cooldowns['prime-infinity']
  const nextPrimeChain = PRIME_RUNE_SEQUENCE.find((prime) => prime > hud.primeChainCount) ?? 2
  const ultimateLocked = hud.unlockedTechniqueCount < ultimate.requiredRuneCount
  const ultimateReady = !ultimateLocked && hud.ultimateCharge >= 100 && ultimateCooldown === 0
  const transformationDefinition = resolveHeroTransformationDefinition(heroClassId)
  const transformationReady = !hud.transformationActive
    && hud.transformationCharge >= TRANSFORMATION_MAX_CHARGE
  const transformationMeterValue = hud.transformationActive
    ? hud.transformationRemainingMs / HERO_TRANSFORMATION_DURATION_MS * 100
    : hud.transformationCharge
  const transformationIntroActive = hud.transformationActive
    && hud.transformationPhase === 'awakening'
  const enemyCalloutAnime = hud.callout?.source === 'enemy' && hud.callout.familyId && hud.callout.phase
    ? resolveEnemyPrimePowerAnimePresentation(hud.callout.familyId, hud.callout.phase)
    : null
  const enemyCalloutStyle = enemyCalloutAnime
    ? {
        '--pb-enemy-callout-accent': ENEMY_PRIME_POWERS[enemyCalloutAnime.familyId].color,
        '--pb-enemy-callout-glow': enemyCalloutAnime.flashColor,
      } as CSSProperties
    : undefined
  const presentationLocked = Boolean(hud.cinematicActionId || hud.storyCutscene)
  const storyBeat = hud.storyCutscene?.currentBeat ?? null
  const storySpeaker = storyBeat?.speaker === 'Primebound'
    ? heroClass.characterName
    : storyBeat?.speaker
  const storyKindLabel = hud.storyCutscene?.kind === 'area-entry'
    ? 'NOVA REGIÃO'
    : hud.storyCutscene?.kind === 'guardian-reveal'
      ? 'PRESENÇA ANÔMALA'
      : 'EPÍLOGO'
  const stageProgressLabel = hud.stageCompleted
    ? 'LIMPA'
    : `${Math.round(hud.stageProgress * 100)}%`
  const stageDetail = hud.stageCompleted
    ? 'REGIÃO PURIFICADA'
    : hud.stageNextReinforcementRemainingMs > 0
      ? 'PASSOS SE APROXIMAM'
      : hud.stageStatus === 'guardian-ready'
        ? 'GUARDIÃO REVELADO'
        : `${hud.stageActiveEnemyCount} AMEAÇA${hud.stageActiveEnemyCount === 1 ? '' : 'S'} NA ÁREA`

  return (
    <div
      className="primebound-game"
      data-hero-class={heroClassId}
      style={heroStyle}
      aria-hidden={paused || undefined}
    >
      <div className="primebound-game__backdrop" aria-hidden="true" />
      <div
        ref={viewportRef}
        className="primebound-viewport"
        aria-hidden={portraitNoticeVisible && !paused ? true : undefined}
      >
        <canvas
          ref={canvasRef}
          className="primebound-canvas"
          width={VIEW_WIDTH}
          height={VIEW_HEIGHT}
          tabIndex={0}
          aria-hidden={storyCutsceneVisible || undefined}
          aria-label={`${hud.areaName}. ${hud.objectiveTitle}. Use WASD para mover, J para atacar, 1, 2 e 3 para técnicas, Q para aparar, R para a ultimate, F para a transformação, Shift para investir e E para interagir.`}
        />

        <div className={`primebound-hud${presentationLocked ? ' primebound-hud--cinematic' : ''}${hud.storyCutscene ? ' primebound-hud--story' : ''}${hud.ultimateQte ? ' primebound-hud--qte' : ''}${hud.transformationActive ? ' is-transformed' : ''}`}>
          <span className="primebound-sr-only" role="status" aria-live="assertive" aria-atomic="true">
            {hud.cinematicPhrase}
          </span>
          {hud.storyCutscene && storyBeat && (
            <section
              ref={storyDialogRef}
              className={`primebound-story-cutscene is-${hud.storyCutscene.kind} effect-${storyBeat.effect}`}
              role="dialog"
              aria-modal="true"
              tabIndex={-1}
              aria-labelledby={`primebound-story-title-${hud.storyCutscene.sceneId}`}
              aria-describedby={`primebound-story-copy-${hud.storyCutscene.sceneId}`}
            >
              <div className="primebound-story-cutscene__veil" aria-hidden="true" />
              <div className="primebound-story-cutscene__chapter">
                <span>{storyKindLabel}</span>
                <strong id={`primebound-story-title-${hud.storyCutscene.sceneId}`}>
                  {hud.storyCutscene.title}
                </strong>
              </div>
              <div
                className="primebound-story-cutscene__caption"
                id={`primebound-story-copy-${hud.storyCutscene.sceneId}`}
                aria-live="polite"
                aria-atomic="true"
              >
                <span>{storySpeaker}</span>
                <p>{storyBeat.text}</p>
                <div className="primebound-story-cutscene__progress" aria-hidden="true">
                  <i style={{ width: `${hud.storyCutsceneProgress * 100}%` }} />
                </div>
              </div>
              {hud.storyCutscene.canSkip ? (
                <button ref={storySkipButtonRef} type="button" onClick={skipActiveStoryCutscene}>
                  <kbd>ESPAÇO</kbd><span><i>OU ENTER · </i>PULAR CENA</span>
                </button>
              ) : (
                <small>O FIM DA SEQUÊNCIA</small>
              )}
            </section>
          )}
          <div
            ref={gameplayHudRef}
            className="primebound-hud__gameplay"
            aria-hidden={storyCutsceneVisible || undefined}
          >
          {hud.ultimateQte && (
            <UltimateQteOverlay
              snapshot={hud.ultimateQte}
              result={hud.ultimateQteResult}
              reducedMotion={reducedMotion}
              paused={paused}
              onInput={submitUltimateQteInput}
            />
          )}
          <header className="primebound-hud__top">
            <Link to="/jogos" className="primebound-hud__brand" aria-label="Voltar ao Primeverse">◆ <span>PRIMEBOUND</span></Link>
            <div className="primebound-area-label">
              <small>REGIÃO {areaIndex + 1} / {PRIMEBOUND_WORLD.areaOrder.length}</small>
              <strong>{hud.areaName}</strong>
              {stageMechanic && (
                <em title={stageMechanic.detail}>
                  {stageMechanic.shortLabel} // {stageMechanic.formula}
                </em>
              )}
            </div>
            <div className="primebound-hud__actions">
              <button
                type="button"
                onClick={() => {
                  setSoundEnabled((enabled) => !enabled)
                  canvasRef.current?.focus()
                }}
                aria-label={soundEnabled ? 'Desligar som' : 'Ligar som'}
              >{soundEnabled ? 'SOM ON' : 'SOM OFF'}</button>
              <button type="button" onClick={() => onPauseChange(true)} aria-label="Pausar jogo">II</button>
            </div>
          </header>

          <div className="primebound-status">
            <span className="primebound-status__hero">
              {heroClass.characterName} · {heroClass.name}
              {hud.transformationActive ? ` // ${hud.transformationName}` : ''}
            </span>
            <div
              className="primebound-health"
              role="meter"
              aria-label="Vitalidade"
              aria-valuemin={0}
              aria-valuemax={hud.maxHealth}
              aria-valuenow={hud.health}
            >
              {Array.from({ length: hud.maxHealth }, (_, index) => <i key={index} className={index < hud.health ? 'is-full' : ''} />)}
            </div>
            <div
              className="primebound-stamina"
              role="progressbar"
              aria-label="Energia de investida"
              aria-valuemin={0}
              aria-valuemax={hud.maxStamina}
              aria-valuenow={Math.round(hud.stamina)}
            ><span style={{ width: `${(hud.stamina / hud.maxStamina) * 100}%` }} /></div>
            <div
              className="primebound-class-resource"
              role="meter"
              aria-label={`${hud.classResourceLabel}: ${hud.classResourceDetail}`}
              aria-valuemin={0}
              aria-valuemax={hud.classResourceMax}
              aria-valuenow={hud.classResourceValue}
              title={hud.classResourceDetail}
            >
              <span>{hud.classResourceLabel}</span>
              <div aria-hidden="true">
                {Array.from({ length: hud.classResourceMax }, (_, index) => (
                  <i key={index} className={index < hud.classResourceValue ? 'is-active' : ''} />
                ))}
              </div>
              <small>{hud.classResourceDetail}</small>
            </div>
          </div>

          {hud.primeChainCount > 0 && (
            <div className={`primebound-prime-chain${hud.primeChainIsPrime ? ' is-prime' : ''}${hud.primeAscensionActive ? ' is-ascended' : ''}${hud.bossHealth !== null ? ' has-boss' : ''}`}>
              <span>{hud.primeAscensionActive ? 'ASCENSÃO PRIMA' : 'CADEIA DE IMPACTOS'}</span>
              <strong>{hud.primeChainCount}</strong>
              <small>{hud.primeChainIsPrime ? 'RESSONÂNCIA!' : `PRÓXIMO PRIMO: ${nextPrimeChain}`}</small>
            </div>
          )}

          <aside className="primebound-objective">
            <div
              className={`primebound-stage-progress is-${hud.stageStatus}`}
              role="group"
              aria-label={`Purificação da região em ${Math.round(hud.stageProgress * 100)} por cento. ${STAGE_STATUS_LABELS[hud.stageStatus]}. ${hud.stageActiveEnemyCount} inimigos ativos. ${hud.stageRespawnsRemaining} retornos restantes.`}
            >
              <div>
                <span>{STAGE_STATUS_LABELS[hud.stageStatus]}</span>
                <strong>{stageProgressLabel}</strong>
              </div>
              <i aria-hidden="true"><b style={{ width: `${hud.stageProgress * 100}%` }} /></i>
              <small>{stageDetail} · RETORNOS {Array.from({ length: 2 }, (_, index) => index < hud.stageRespawnsRemaining ? '◆' : '◇').join(' ')}</small>
            </div>
            <div className="primebound-objective__copy" role="status" aria-live="polite" aria-atomic="true">
              <span>JORNADA ATUAL</span>
              <strong>{hud.objectiveTitle}</strong>
              <p>{hud.objectiveDetail}</p>
            </div>
          </aside>

          <div
            className="primebound-runes"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label={`Runas: ${PRIME_RUNE_SEQUENCE.map((value) => `${value} ${hud.runes.includes(value) ? 'encontrada' : 'pendente'}`).join('; ')}`}
          >
            <span>RUNAS</span>
            {PRIME_RUNE_SEQUENCE.map((value) => (
              <i key={value} aria-hidden="true" className={hud.runes.includes(value) ? 'is-found' : ''}><b>{value}</b></i>
            ))}
          </div>

          {hud.bossHealth !== null && hud.bossMaxHealth !== null && (
            <div className={`primebound-boss-bar${hud.bossPhase ? ` is-phase-${hud.bossPhase}` : ''}`}>
              <span>
                <strong>{hud.bossLabel}</strong>
                {hud.bossPowerLabel && <small>{hud.bossPowerLabel}</small>}
              </span>
              <div
                role="progressbar"
                aria-label={`Vitalidade de ${hud.bossLabel ?? 'chefe'}`}
                aria-valuemin={0}
                aria-valuemax={hud.bossMaxHealth}
                aria-valuenow={hud.bossHealth}
              ><i style={{ width: `${(hud.bossHealth / hud.bossMaxHealth) * 100}%` }} /></div>
            </div>
          )}

          {hud.bossIntro && (
            <div
              className={`pb-boss-intro pb-boss-intro--${hud.bossIntro.rank}`}
              role="status"
              aria-live="assertive"
            >
              <i className="pb-boss-intro__bar pb-boss-intro__bar--top" aria-hidden="true" />
              <span className="pb-boss-intro__number" aria-hidden="true">{hud.bossIntro.number}</span>
              <div className="pb-boss-intro__card">
                <small>{hud.bossIntro.rank === 'final-boss' ? 'O ÚLTIMO COMPOSTO' : 'GUARDIÃO DA REGIÃO'}</small>
                <strong>{hud.bossIntro.name}</strong>
                <em>{hud.bossIntro.power}</em>
              </div>
              <i className="pb-boss-intro__bar pb-boss-intro__bar--bottom" aria-hidden="true" />
            </div>
          )}

          {hud.blessingChoice && (
            <div className="pb-blessing" role="dialog" aria-modal="true" aria-label="Santuário primo">
              <div className="pb-blessing__panel">
                <small>SANTUÁRIO PRIMO</small>
                <h2>Escolha uma bênção</h2>
                <div className="pb-blessing__options">
                  {hud.blessingChoice.map((id) => {
                    const blessing = PRIME_BLESSINGS[id]
                    const stacks = hud.blessings.filter((owned) => owned === id).length
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          chooseBlessing(engineRef.current, id)
                          updateHud(engineRef.current)
                          playSound('victory')
                        }}
                      >
                        <b>{blessing.glyph}</b>
                        <strong>{blessing.name}</strong>
                        <span>{blessing.description}</span>
                        <em>{stacks}/{blessing.maxStacks}</em>
                      </button>
                    )
                  })}
                </div>
                <p>Um toque por santuário. As sombras aguardam a sua decisão.</p>
              </div>
            </div>
          )}

          {hud.toast && (
            <div className={`primebound-toast primebound-toast--${hud.toast.tone}`} role="status">
              <i />
              <div><strong>{hud.toast.title}</strong><span>{hud.toast.detail}</span></div>
            </div>
          )}

          {hud.callout && !presentationLocked && (
            <div
              className={`primebound-combat-callout${hud.bossHealth !== null ? ' has-boss' : ''}${hud.callout.source === 'enemy' ? ` is-enemy is-phase-${hud.callout.phase ?? 1}` : ''}`}
              style={enemyCalloutStyle}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <strong>{hud.callout.title}</strong>
              <span>{hud.callout.detail}</span>
            </div>
          )}

          {hud.prompt && !dialogue && !presentationLocked && !transformationIntroActive && <div className="primebound-prompt">{hud.prompt}</div>}

          <div className="primebound-skill-belt" role="group" aria-label="Arsenal das famílias primas">
            {techniques.map(({ actionId, action, presentation, cooldown, family, index, locked }) => (
              <button
                key={actionId}
                type="button"
                className={`primebound-skill primebound-skill--${actionId}${locked ? ' primebound-skill--locked' : ''}${cooldown > 0 ? ' primebound-skill--cooldown' : ''}`}
                style={{
                  '--skill-accent': index === 0
                    ? heroClass.palette.energy
                    : index === 1 ? heroClass.palette.primary : heroClass.palette.accent,
                } as CSSProperties}
                aria-label={`${presentation.label}. ${locked ? `Bloqueada: requer ${action.requiredRuneCount} runas` : cooldown > 0 ? `Recarga: ${formatCooldown(cooldown)}` : 'Pronta'}. ${presentation.description}`}
                title={`${presentation.description} ${family ? `${family.formula}. Exemplos: ${family.examples.join(', ')}.` : ''}`}
                disabled={paused || Boolean(dialogue) || presentationLocked || transformationIntroActive || locked || cooldown > 0}
                onClick={() => queueCombatAction(actionId)}
              >
                {cooldown > 0 && <i className="primebound-skill__cooldown">{formatCooldown(cooldown)}</i>}
                <kbd className="primebound-skill__key">{index + 1}</kbd>
                <strong className="primebound-skill__name">{presentation.label}</strong>
                <small className="primebound-skill__meta">{locked ? `${action.requiredRuneCount} RUNAS` : family?.formula}</small>
              </button>
            ))}
            <button
              type="button"
              className={`primebound-skill primebound-skill--guard${hud.defenseStatus === 'cooldown' ? ' primebound-skill--cooldown' : ''}${hud.defenseStatus === 'parry' ? ' primebound-skill--parry' : ''}${hud.defenseStatus === 'guard' ? ' primebound-skill--defending' : ''}`}
              style={{ '--skill-accent': heroClass.palette.energy } as CSSProperties}
              aria-label={`${guardPresentation.label}. ${hud.defenseStatus === 'parry' ? 'Janela de parry ativa' : hud.defenseStatus === 'guard' ? 'Guarda ativa' : defenseCooldown > 0 ? `Recarga: ${formatCooldown(defenseCooldown)}` : 'Pronta'}.`}
              title={guardPresentation.description}
              disabled={paused || Boolean(dialogue) || presentationLocked || transformationIntroActive || defenseCooldown > 0 || hud.stamina < GUARD_STAMINA_COST}
              onClick={() => queueCombatAction(IRREDUCIBLE_AEGIS.id)}
            >
              {defenseCooldown > 0 && hud.defenseStatus === 'cooldown' && <i className="primebound-skill__cooldown">{formatCooldown(defenseCooldown)}</i>}
              <kbd className="primebound-skill__key">Q</kbd>
              <strong className="primebound-skill__name">{guardPresentation.label}</strong>
              <small className="primebound-skill__meta">{hud.defenseStatus === 'parry' ? 'PARRY!' : hud.defenseStatus === 'guard' ? 'DEFENDENDO' : '(p−1)! ≡ −1'}</small>
            </button>
            <button
              type="button"
              className={`primebound-transformation-meter${transformationReady ? ' is-ready' : ''}${hud.transformationActive ? ' is-active' : ''}`}
              data-hero-class={heroClassId}
              data-phase={hud.transformationPhase ?? undefined}
              aria-keyshortcuts="F"
              aria-pressed={hud.transformationActive}
              aria-label={hud.transformationActive
                ? `${hud.transformationName} ativa. ${Math.ceil(hud.transformationRemainingMs / 1_000)} segundos restantes.`
                : `${hud.transformationName}. ${Math.floor(hud.transformationCharge)} por cento carregada. ${transformationReady ? 'Pressione F para transformar.' : 'Carregue lutando.'}`}
              title={`${transformationDefinition.title}. ${transformationDefinition.description} ${transformationDefinition.formula}`}
              disabled={
                paused || Boolean(dialogue) || presentationLocked ||
                transformationIntroActive ||
                (!hud.transformationActive && !transformationReady)
              }
              onClick={queueTransformation}
            >
              <i
                className="primebound-transformation-meter__energy"
                style={{ width: `${clamp(transformationMeterValue, 0, 100)}%` }}
              />
              <span><kbd>F</kbd><em>FORMA PRIMA</em></span>
              <strong>{hud.transformationActive ? hud.transformationName : 'TRANSFORMAR'}</strong>
              <small>{hud.transformationActive
                ? `${Math.ceil(hud.transformationRemainingMs / 1_000)}s`
                : `${Math.floor(hud.transformationCharge)}%`}</small>
            </button>
            <button
              type="button"
              className={`primebound-ultimate-meter${ultimateLocked ? ' primebound-skill--locked' : ''}${ultimateCooldown > 0 ? ' primebound-skill--cooldown' : ''}${ultimateReady ? ' is-ready' : ''}`}
              aria-label={`${ultimatePresentation.label}. ${ultimateLocked ? 'Bloqueada até reunir 3 runas' : ultimateCooldown > 0 ? `Recarga: ${formatCooldown(ultimateCooldown)}` : `${Math.floor(hud.ultimateCharge)} por cento carregada`}.`}
              title={ultimatePresentation.description}
              disabled={paused || Boolean(dialogue) || presentationLocked || transformationIntroActive || !ultimateReady}
              onClick={() => queueCombatAction('prime-infinity')}
            >
              <i className="primebound-ultimate-meter__fill" style={{ width: `${hud.ultimateCharge}%` }} />
              {ultimateCooldown > 0 && <i className="primebound-skill__cooldown">{formatCooldown(ultimateCooldown)}</i>}
              <span><kbd>R</kbd> ULTIMATE</span>
              <strong>{ultimatePresentation.label}</strong>
              <small>{ultimateLocked ? '3 RUNAS' : `${Math.floor(hud.ultimateCharge)}%`}</small>
            </button>
          </div>

          <div className="primebound-game-meta">
            <span>{Math.floor(hud.elapsedMs / 60_000)}:{String(Math.floor(hud.elapsedMs / 1_000) % 60).padStart(2, '0')}</span>
            <span>{hud.kills} SOMBRAS FATORADAS</span>
          </div>

          <div className="primebound-key-hints" aria-hidden="true">
            <span><kbd>WASD</kbd> MOVER</span><span><kbd>J</kbd> GOLPE</span><span><kbd>F</kbd> FORMA</span><span><kbd>⇧</kbd> DASH</span><span><kbd>E</kbd> INTERAGIR</span>
          </div>

          <div className="primebound-touch" aria-label="Controles de toque">
            <div className="primebound-touch__dpad">
              {(['up', 'left', 'down', 'right'] as const).map((direction) => (
                <button
                  key={direction}
                  type="button"
                  className={`is-${direction}`}
                  aria-label={`Mover para ${DIRECTION_LABELS[direction]}`}
                  disabled={Boolean(dialogue) || presentationLocked || transformationIntroActive}
                  onPointerDown={(event) => directionPointer(direction, event, true)}
                  onPointerUp={(event) => directionPointer(direction, event, false)}
                  onPointerCancel={(event) => directionPointer(direction, event, false)}
                  onLostPointerCapture={() => holdDirection(direction, false)}
                  onClick={(event) => {
                    if (event.detail === 0) nudgeDirection(direction)
                  }}
                >{direction === 'up' ? '↑' : direction === 'down' ? '↓' : direction === 'left' ? '←' : '→'}</button>
              ))}
            </div>
            <div className="primebound-touch__actions">
              <button type="button" className="is-dash" aria-label="Usar investida" disabled={Boolean(dialogue) || presentationLocked || transformationIntroActive} onClick={() => { engineRef.current.queuedDash = true }}>↯<small>DASH</small></button>
              <button type="button" className="is-interact" aria-label="Interagir" disabled={Boolean(dialogue) || presentationLocked || transformationIntroActive} onClick={interact}>E<small>USAR</small></button>
              <button
                type="button"
                className="is-guard"
                aria-label={`Usar ${guardPresentation.label}`}
                disabled={Boolean(dialogue) || presentationLocked || transformationIntroActive || defenseCooldown > 0 || hud.stamina < GUARD_STAMINA_COST}
                onPointerDown={(event) => {
                  event.preventDefault()
                  queueCombatAction(IRREDUCIBLE_AEGIS.id)
                }}
                onClick={(event) => {
                  if (event.detail === 0) queueCombatAction(IRREDUCIBLE_AEGIS.id)
                }}
              >Q<small>{mobileDefenseLabel}</small></button>
              <button type="button" className="is-attack" aria-label={`Usar ${heroClass.actions.J.label}`} disabled={Boolean(dialogue) || presentationLocked || transformationIntroActive} onClick={() => queueCombatAction('basic-strike')}>{mobileBasicSymbol}<small>{mobileBasicLabel}</small></button>
            </div>
          </div>
          </div>
        </div>

        {dialogue && activeLine && (
          <div className="primebound-dialogue" role="dialog" aria-label={`Diálogo com ${speakerName(activeLine.speaker, heroClass)}`} aria-live="polite">
            <div className={`primebound-portrait primebound-portrait--${activeLine.speaker}${activeLine.speaker === 'hero' ? ` primebound-portrait--${heroClass.archetype}` : ''}`} aria-hidden="true"><i /><b /></div>
            <div className="primebound-dialogue__copy">
              <span>{speakerName(activeLine.speaker, heroClass)}</span>
              <p>{classAwareDialogueText(activeLine, heroClass)}</p>
            </div>
            <button ref={dialogueButtonRef} type="button" onClick={advanceDialogue}>
              {dialogue.index === dialogue.lines.length - 1 ? 'CONCLUIR' : 'CONTINUAR'} <b>›</b>
            </button>
            <small>{dialogue.index + 1} / {dialogue.lines.length}</small>
          </div>
        )}
      </div>
      {!paused && portraitNoticeVisible && (
        <div
          className="primebound-orientation"
          role="dialog"
          aria-modal="true"
          aria-labelledby="primebound-orientation-title"
        >
          <b aria-hidden="true">◆</b>
          <strong id="primebound-orientation-title">Gire o aparelho</strong>
          <span>Primebound precisa do espaço horizontal para manter o campo e os controles livres.</span>
          <div>
            <button ref={portraitExitButtonRef} type="button" onClick={onExitToClassSelect}>
              VOLTAR À SELEÇÃO
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
