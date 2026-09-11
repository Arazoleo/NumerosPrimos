export type RiftVec3 = readonly [x: number, y: number, z: number]
export type UlamRiftPhase = 'ready' | 'running' | 'won' | 'lost'

export const ULAM_RIFT_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19] as const
export type UlamRiftPrime = (typeof ULAM_RIFT_PRIMES)[number]

export interface RiftPlatform {
  readonly id: string
  readonly node: number
  readonly position: RiftVec3
  readonly size: RiftVec3
  readonly sector: UlamRiftSectorId
  readonly accent: string
}

export const ULAM_RIFT_SECTORS = [
  { id: 'root-garden', name: 'Jardins da Raiz', range: [18, -38], accent: '#57f4d0' },
  { id: 'helix-bridges', name: 'Pontes da Hélice', range: [-38, -94], accent: '#69b9ff' },
  { id: 'broken-sieve', name: 'Peneira Fraturada', range: [-94, -157], accent: '#c879ff' },
  { id: 'irredutible-crown', name: 'Coroa Irredutível', range: [-157, -230], accent: '#ffda7b' },
] as const

export type UlamRiftSectorId = (typeof ULAM_RIFT_SECTORS)[number]['id']

const PLATFORM_ACCENTS = ['#57f4d0', '#69b9ff', '#c879ff', '#ffda7b'] as const

export const ULAM_RIFT_PLATFORMS: readonly RiftPlatform[] = Object.freeze(
  Array.from({ length: 33 }, (_, node): RiftPlatform => {
    const sectorIndex = Math.min(3, Math.floor(node / 8))
    const z = 14 - node * 7.15
    const x = node === 0 ? 0 : Math.sin(node * 0.82) * 4.7 + Math.cos(node * 0.31) * 1.4
    const y = node * 1.34
    const isLanding = node % 8 === 7 || node === 0 || node === 32
    const isJumpIsland = [6, 13, 21, 28].includes(node)
    return {
      id: `rift-step-${node}`,
      node,
      position: [x, y, z],
      size: [isLanding ? 11 : 7.6, 0.72, isLanding ? 9.4 : isJumpIsland ? 5.2 : 7.5],
      sector: ULAM_RIFT_SECTORS[sectorIndex].id,
      accent: PLATFORM_ACCENTS[sectorIndex],
    }
  }),
)

export const ULAM_RIFT_SPAWN: RiftVec3 = [0, 1.12, 14]

export interface RiftTerm {
  readonly id: string
  readonly value: number
  readonly position: RiftVec3
  readonly prime: boolean
  readonly node: number
}

const PRIME_NODE_INDEXES = [2, 5, 9, 13, 17, 21, 25, 29] as const
const COMPOSITE_VALUES = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18] as const
const COMPOSITE_NODE_INDEXES = [3, 6, 10, 12, 14, 18, 20, 24, 27, 30] as const

function pointOnNode(node: number, lateralOffset = 0): RiftVec3 {
  const platform = ULAM_RIFT_PLATFORMS[node]
  return [platform.position[0] + lateralOffset, platform.position[1] + 1.45, platform.position[2]]
}

export const ULAM_RIFT_TERMS: readonly RiftTerm[] = Object.freeze([
  ...ULAM_RIFT_PRIMES.map((value, index): RiftTerm => ({
    id: `rift-prime-${value}`,
    value,
    position: pointOnNode(PRIME_NODE_INDEXES[index], index % 2 === 0 ? -0.7 : 0.7),
    prime: true,
    node: PRIME_NODE_INDEXES[index],
  })),
  ...COMPOSITE_VALUES.map((value, index): RiftTerm => ({
    id: `rift-composite-${value}`,
    value,
    position: pointOnNode(COMPOSITE_NODE_INDEXES[index], index % 2 === 0 ? 2.1 : -2.1),
    prime: false,
    node: COMPOSITE_NODE_INDEXES[index],
  })),
])

export const ULAM_RIFT_TERM_IDS = ULAM_RIFT_TERMS.map((term) => term.id)

export interface RiftTower {
  readonly id: UlamRiftTowerId
  readonly name: string
  readonly node: number
  readonly position: RiftVec3
  readonly requiredTerms: number
  readonly checkpoint: RiftVec3
  readonly accent: string
}

export const ULAM_RIFT_TOWER_IDS = [
  'tower-twins',
  'tower-quintic',
  'tower-spiral',
  'tower-crown',
] as const
export type UlamRiftTowerId = (typeof ULAM_RIFT_TOWER_IDS)[number]

function towerOnNode(
  id: UlamRiftTowerId,
  name: string,
  node: number,
  requiredTerms: number,
  accent: string,
): RiftTower {
  const platform = ULAM_RIFT_PLATFORMS[node]
  return {
    id,
    name,
    node,
    position: [platform.position[0], platform.position[1] + 0.42, platform.position[2]],
    checkpoint: [platform.position[0], platform.position[1] + 1.12, platform.position[2] + 2.3],
    requiredTerms,
    accent,
  }
}

export const ULAM_RIFT_TOWERS: readonly RiftTower[] = Object.freeze([
  towerOnNode('tower-twins', 'Torre dos Gêmeos', 7, 2, '#57f4d0'),
  towerOnNode('tower-quintic', 'Torre Pentagonal', 15, 4, '#69b9ff'),
  towerOnNode('tower-spiral', 'Torre da Espiral', 23, 6, '#c879ff'),
  towerOnNode('tower-crown', 'Coroa de Ulam', 32, 8, '#ffda7b'),
])

export interface RiftHazard {
  readonly id: string
  readonly position: RiftVec3
  readonly radius: number
  readonly damage: number
  readonly kind: 'pulse' | 'shard'
}

export const ULAM_RIFT_HAZARDS: readonly RiftHazard[] = Object.freeze([
  { id: 'pulse-1', position: pointOnNode(4), radius: 1.35, damage: 12, kind: 'pulse' },
  { id: 'shard-1', position: pointOnNode(11, -1.25), radius: 1.15, damage: 16, kind: 'shard' },
  { id: 'pulse-2', position: pointOnNode(16, 1.2), radius: 1.45, damage: 14, kind: 'pulse' },
  { id: 'shard-2', position: pointOnNode(19, -1.4), radius: 1.2, damage: 18, kind: 'shard' },
  { id: 'pulse-3', position: pointOnNode(22), radius: 1.55, damage: 16, kind: 'pulse' },
  { id: 'shard-3', position: pointOnNode(26, 1.45), radius: 1.25, damage: 20, kind: 'shard' },
  { id: 'pulse-4', position: pointOnNode(28, -0.9), radius: 1.65, damage: 20, kind: 'pulse' },
  { id: 'shard-4', position: pointOnNode(31, 1.4), radius: 1.3, damage: 22, kind: 'shard' },
])

export type RiftFeedbackKind = 'info' | 'success' | 'warning' | 'danger'

export interface RiftFeedback {
  readonly serial: number
  readonly kind: RiftFeedbackKind
  readonly message: string
}

export interface UlamRiftState {
  readonly phase: UlamRiftPhase
  readonly runSerial: number
  readonly startedAtMs: number | null
  readonly nowMs: number
  readonly elapsedMs: number
  readonly integrity: number
  readonly nextPrimeIndex: number
  readonly collectedTermIds: readonly string[]
  readonly activatedTowerIds: readonly UlamRiftTowerId[]
  readonly checkpointTowerId: UlamRiftTowerId | null
  readonly falls: number
  readonly hits: number
  readonly feedback: RiftFeedback | null
  readonly feedbackSerial: number
}

export type UlamRiftAction =
  | { readonly type: 'start'; readonly nowMs: number }
  | { readonly type: 'restart'; readonly nowMs: number }
  | { readonly type: 'tick'; readonly nowMs: number }
  | { readonly type: 'collect-term'; readonly termId: string }
  | { readonly type: 'activate-tower'; readonly towerId: UlamRiftTowerId }
  | { readonly type: 'hit-hazard'; readonly hazardId: string; readonly damage: number }
  | { readonly type: 'fall' }
  | { readonly type: 'clear-feedback'; readonly serial: number }

export interface UlamRiftObjective {
  readonly kind: 'start' | 'prime' | 'tower' | 'escape' | 'recover'
  readonly title: string
  readonly detail: string
  readonly current: number
  readonly total: number
  readonly targetPosition: RiftVec3
}

function safeTime(value: number, fallback = 0): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function withFeedback(
  state: UlamRiftState,
  kind: RiftFeedbackKind,
  message: string,
  patch: Partial<UlamRiftState> = {},
): UlamRiftState {
  const feedbackSerial = state.feedbackSerial + 1
  return {
    ...state,
    ...patch,
    feedbackSerial,
    feedback: { serial: feedbackSerial, kind, message },
  }
}

export function createUlamRiftState(runSerial = 0): UlamRiftState {
  return {
    phase: 'ready',
    runSerial,
    startedAtMs: null,
    nowMs: 0,
    elapsedMs: 0,
    integrity: 100,
    nextPrimeIndex: 0,
    collectedTermIds: [],
    activatedTowerIds: [],
    checkpointTowerId: null,
    falls: 0,
    hits: 0,
    feedback: null,
    feedbackSerial: 0,
  }
}

function runningState(state: UlamRiftState, nowMs: number): UlamRiftState {
  const safeNow = safeTime(nowMs)
  return {
    ...createUlamRiftState(state.runSerial + 1),
    phase: 'running',
    startedAtMs: safeNow,
    nowMs: safeNow,
    feedbackSerial: state.feedbackSerial,
  }
}

function damageState(state: UlamRiftState, damageValue: number, message: string): UlamRiftState {
  if (state.phase !== 'running' || !Number.isFinite(damageValue) || damageValue <= 0) return state
  const damage = Math.min(100, Math.ceil(damageValue))
  const integrity = Math.max(0, state.integrity - damage)
  return withFeedback(state, 'danger', integrity === 0 ? 'A Fenda desfez seu eco.' : message, {
    integrity,
    phase: integrity === 0 ? 'lost' : state.phase,
    hits: state.hits + 1,
  })
}

export function ulamRiftReducer(state: UlamRiftState, action: UlamRiftAction): UlamRiftState {
  switch (action.type) {
    case 'start':
      return state.phase === 'ready' ? runningState(state, action.nowMs) : state

    case 'restart':
      return runningState(state, action.nowMs)

    case 'tick': {
      if (state.phase !== 'running' || state.startedAtMs === null) return state
      const nowMs = Math.max(state.nowMs, safeTime(action.nowMs, state.nowMs))
      return { ...state, nowMs, elapsedMs: Math.max(0, nowMs - state.startedAtMs) }
    }

    case 'collect-term': {
      if (state.phase !== 'running') return state
      const term = ULAM_RIFT_TERMS.find((candidate) => candidate.id === action.termId)
      if (!term) return state
      if (state.collectedTermIds.includes(term.id)) return state
      const expected = ULAM_RIFT_PRIMES[state.nextPrimeIndex]
      if (!term.prime) {
        return damageState(state, 8, `${term.value} é composto. A Fenda drenou sua integridade.`)
      }
      if (term.value !== expected) {
        return withFeedback(state, 'warning', `Ainda não. O próximo termo irredutível é ${expected}.`)
      }
      const nextPrimeIndex = state.nextPrimeIndex + 1
      return withFeedback(state, 'success', nextPrimeIndex === ULAM_RIFT_PRIMES.length
        ? 'Sequência completa. Alcance a Coroa e desperte a última torre.'
        : `${term.value} estabilizado · próximo termo ${ULAM_RIFT_PRIMES[nextPrimeIndex]}.`, {
        nextPrimeIndex,
        collectedTermIds: [...state.collectedTermIds, term.id],
      })
    }

    case 'activate-tower': {
      if (state.phase !== 'running') return state
      const tower = ULAM_RIFT_TOWERS.find((candidate) => candidate.id === action.towerId)
      if (!tower || state.activatedTowerIds.includes(tower.id)) return state
      const towerIndex = ULAM_RIFT_TOWER_IDS.indexOf(tower.id)
      const previousTower = towerIndex > 0 ? ULAM_RIFT_TOWER_IDS[towerIndex - 1] : null
      if (previousTower && !state.activatedTowerIds.includes(previousTower)) {
        return withFeedback(state, 'warning', 'A energia não alcança esta torre. Ative o marco anterior.')
      }
      if (state.nextPrimeIndex < tower.requiredTerms) {
        const expected = ULAM_RIFT_PRIMES[state.nextPrimeIndex]
        return withFeedback(state, 'warning', `A torre exige mais termos. Encontre ${expected}.`)
      }
      const activatedTowerIds = [...state.activatedTowerIds, tower.id]
      const victory = tower.id === 'tower-crown'
      return withFeedback(state, 'success', victory
        ? 'A Coroa de Ulam despertou. A Fenda agora conhece seu caminho.'
        : `${tower.name} ativada. Checkpoint vinculado.`, {
        activatedTowerIds,
        checkpointTowerId: tower.id,
        phase: victory ? 'won' : state.phase,
        elapsedMs: state.startedAtMs === null ? state.elapsedMs : Math.max(0, state.nowMs - state.startedAtMs),
      })
    }

    case 'hit-hazard':
      return damageState(state, action.damage, `${action.hazardId} atingiu seu eco.`)

    case 'fall': {
      if (state.phase !== 'running') return state
      const damaged = damageState(state, 15, 'Você caiu no vazio. Retornando ao último checkpoint.')
      return { ...damaged, falls: state.falls + 1 }
    }

    case 'clear-feedback':
      return state.feedback?.serial === action.serial ? { ...state, feedback: null } : state
  }
}

export function getUlamRiftCheckpoint(state: UlamRiftState): RiftVec3 {
  if (!state.checkpointTowerId) return ULAM_RIFT_SPAWN
  return ULAM_RIFT_TOWERS.find((tower) => tower.id === state.checkpointTowerId)?.checkpoint ?? ULAM_RIFT_SPAWN
}

export function getUlamRiftObjective(state: UlamRiftState): UlamRiftObjective {
  if (state.phase === 'ready') {
    return {
      kind: 'start',
      title: 'Atravesse a sequência viva',
      detail: 'Colete os primos em ordem e desperte as quatro torres.',
      current: 0,
      total: 12,
      targetPosition: ULAM_RIFT_TERMS[0].position,
    }
  }
  if (state.phase === 'lost') {
    return {
      kind: 'recover',
      title: 'Seu eco foi desfeito',
      detail: 'Reinicie a travessia. As torres voltarão a dormir.',
      current: state.nextPrimeIndex + state.activatedTowerIds.length,
      total: 12,
      targetPosition: getUlamRiftCheckpoint(state),
    }
  }
  if (state.phase === 'won') {
    return {
      kind: 'escape',
      title: 'Coroa Irredutível desperta',
      detail: 'Travessia concluída. Você dominou os oito termos e quatro torres.',
      current: 12,
      total: 12,
      targetPosition: ULAM_RIFT_TOWERS[3].position,
    }
  }

  const nextTower = ULAM_RIFT_TOWERS.find((tower) => !state.activatedTowerIds.includes(tower.id))
  if (nextTower && state.nextPrimeIndex >= nextTower.requiredTerms) {
    return {
      kind: 'tower',
      title: `Ative ${nextTower.name}`,
      detail: 'Aproxime-se do núcleo da torre e pressione E.',
      current: state.nextPrimeIndex + state.activatedTowerIds.length,
      total: 12,
      targetPosition: nextTower.position,
    }
  }

  const nextPrime = ULAM_RIFT_PRIMES[state.nextPrimeIndex]
  const term = ULAM_RIFT_TERMS.find((candidate) => candidate.prime && candidate.value === nextPrime)
  return {
    kind: 'prime',
    title: `Encontre o termo ${nextPrime}`,
    detail: 'Siga o feixe luminoso. Compostos ferem e não avançam a sequência.',
    current: state.nextPrimeIndex + state.activatedTowerIds.length,
    total: 12,
    targetPosition: term?.position ?? ULAM_RIFT_TOWERS[3].position,
  }
}

export function getUlamRiftBarrierNode(state: UlamRiftState): number | null {
  const nextTower = ULAM_RIFT_TOWERS.find((tower) => !state.activatedTowerIds.includes(tower.id))
  return nextTower?.node ?? null
}

export function sectorAtRiftPosition(position: RiftVec3): (typeof ULAM_RIFT_SECTORS)[number] {
  return ULAM_RIFT_SECTORS.find((sector) => position[2] <= sector.range[0] && position[2] > sector.range[1])
    ?? ULAM_RIFT_SECTORS[ULAM_RIFT_SECTORS.length - 1]
}

export function formatRiftTime(milliseconds: number): string {
  const safe = Math.max(0, safeTime(milliseconds))
  const minutes = Math.floor(safe / 60_000)
  const seconds = Math.floor((safe % 60_000) / 1_000)
  const hundredths = Math.floor((safe % 1_000) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
}
