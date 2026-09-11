export const SELECTABLE_PRIMES = [2, 3, 5, 7, 11, 13] as const
export type SiegePrime = (typeof SELECTABLE_PRIMES)[number]

export type SiegePhase = 'countdown' | 'wave' | 'intermission' | 'victory' | 'defeat'
export type SiegeSectorId = 'ember' | 'anvil' | 'crown' | 'crucible' | 'caldera' | 'zenith'
export type SiegeVec2 = readonly [number, number]

export interface SiegeSector {
  readonly id: SiegeSectorId
  readonly name: string
  readonly shortName: string
  readonly angle: number
  readonly accent: string
}

export const SIEGE_SECTORS: readonly SiegeSector[] = Object.freeze([
  { id: 'ember', name: 'Bastião da Brasa', shortName: 'BRASA', angle: -Math.PI / 2, accent: '#ff6b35' },
  { id: 'anvil', name: 'Portão da Bigorna', shortName: 'BIGORNA', angle: -Math.PI / 6, accent: '#ffb347' },
  { id: 'crown', name: 'Muralha da Coroa', shortName: 'COROA', angle: Math.PI / 6, accent: '#ffd66b' },
  { id: 'crucible', name: 'Passagem do Cadinho', shortName: 'CADINHO', angle: Math.PI / 2, accent: '#ff8a3d' },
  { id: 'caldera', name: 'Galeria da Caldeira', shortName: 'CALDEIRA', angle: Math.PI * 5 / 6, accent: '#ff4f32' },
  { id: 'zenith', name: 'Arco do Zênite', shortName: 'ZÊNITE', angle: -Math.PI * 5 / 6, accent: '#ffe39a' },
])

interface WaveEntry {
  readonly composite: number
  readonly sector: SiegeSectorId
  readonly elite?: boolean
  readonly boss?: boolean
}

export interface SiegeWave {
  readonly title: string
  readonly subtitle: string
  readonly objective: string
  readonly entries: readonly WaveEntry[]
}

export const SIEGE_WAVES: readonly SiegeWave[] = Object.freeze([
  {
    title: 'A Primeira Fissura',
    subtitle: 'COMPOSTOS MENORES',
    objective: 'Fatore 6, 10 e 15; então destrua seus núcleos expostos.',
    entries: [
      { composite: 6, sector: 'ember' },
      { composite: 10, sector: 'crown' },
      { composite: 15, sector: 'caldera' },
    ],
  },
  {
    title: 'Marcha dos Quadrados',
    subtitle: 'FATORES REPETIDOS',
    objective: 'Alguns escudos repetem fatores. Use o mesmo primo mais de uma vez.',
    entries: [
      { composite: 12, sector: 'anvil' },
      { composite: 18, sector: 'crucible' },
      { composite: 25, sector: 'zenith', elite: true },
      { composite: 28, sector: 'ember' },
    ],
  },
  {
    title: 'Legião Semiprima',
    subtitle: 'DUAS CHAVES',
    objective: 'Intercepte os pares semiprimos antes que alcancem o coração da forja.',
    entries: [
      { composite: 22, sector: 'crown' },
      { composite: 33, sector: 'anvil' },
      { composite: 35, sector: 'caldera' },
      { composite: 55, sector: 'crucible', elite: true },
      { composite: 65, sector: 'zenith', elite: true },
    ],
  },
  {
    title: 'Convergência das Seis Portas',
    subtitle: 'CERCO TOTAL',
    objective: 'Use o Pulso de Euclides para fatorar grupos e preserve a integridade da forja.',
    entries: [
      { composite: 30, sector: 'ember' },
      { composite: 42, sector: 'anvil', elite: true },
      { composite: 66, sector: 'crown' },
      { composite: 70, sector: 'crucible' },
      { composite: 78, sector: 'caldera', elite: true },
      { composite: 91, sector: 'zenith', elite: true },
    ],
  },
  {
    title: 'O Titã 210',
    subtitle: 'PRODUTO DOS QUATRO SELOS',
    objective: 'Rompa 2 × 3 × 5 × 7 e derrube o Titã antes da queda da Fortaleza Áurea.',
    entries: [
      { composite: 105, sector: 'ember', elite: true },
      { composite: 130, sector: 'crown', elite: true },
      { composite: 154, sector: 'caldera', elite: true },
      { composite: 210, sector: 'crucible', elite: true, boss: true },
    ],
  },
])

export interface SiegeEnemy {
  readonly id: string
  readonly composite: number
  readonly shieldRemaining: number
  readonly position: SiegeVec2
  readonly sector: SiegeSectorId
  readonly hp: number
  readonly maxHp: number
  readonly speed: number
  readonly damage: number
  readonly radius: number
  readonly attackReadyAtMs: number
  readonly stunnedUntilMs: number
  readonly enragedUntilMs: number
  readonly elite: boolean
  readonly boss: boolean
}

export interface SiegePlayer {
  readonly position: SiegeVec2
  readonly yaw: number
  readonly hp: number
  readonly maxHp: number
  readonly guarding: boolean
  readonly attackReadyAtMs: number
  readonly factorReadyAtMs: number
  readonly pulseReadyAtMs: number
}

export interface SiegeMessage {
  readonly serial: number
  readonly tone: 'neutral' | 'success' | 'danger' | 'prime'
  readonly text: string
}

export interface SiegeState {
  readonly phase: SiegePhase
  readonly elapsedMs: number
  readonly phaseEndsAtMs: number
  readonly waveIndex: number
  readonly player: SiegePlayer
  readonly forgeHp: number
  readonly forgeMaxHp: number
  readonly selectedPrime: SiegePrime
  readonly enemies: readonly SiegeEnemy[]
  readonly score: number
  readonly kills: number
  readonly combo: number
  readonly bestCombo: number
  readonly message: SiegeMessage
  readonly eventSerial: number
}

export interface SiegeInput {
  readonly moveX: number
  readonly moveZ: number
  readonly guarding: boolean
  readonly attackQueued: boolean
  readonly factorQueued: boolean
  readonly pulseQueued: boolean
  readonly selectedPrime?: SiegePrime
}

export type SiegeEventKind =
  | 'slash'
  | 'blocked'
  | 'factor'
  | 'factor-miss'
  | 'shield-break'
  | 'pulse'
  | 'enemy-defeated'
  | 'player-hit'
  | 'forge-hit'
  | 'parry'
  | 'wave-start'

export interface SiegeEvent {
  readonly serial: number
  readonly kind: SiegeEventKind
  readonly position: SiegeVec2
  readonly accent?: string
  readonly label?: string
}

export interface SiegeStepResult {
  readonly state: SiegeState
  readonly events: readonly SiegeEvent[]
}

export const SIEGE_ARENA_RADIUS = 38
export const SIEGE_CORE_RADIUS = 3.5
export const PLAYER_ATTACK_RANGE = 7.4
export const FACTOR_LANCE_RANGE = 9.5
export const PRIME_PULSE_RADIUS = 10.5
export const PRIME_PULSE_COOLDOWN_MS = 7_000

const EMPTY_INPUT: SiegeInput = Object.freeze({
  moveX: 0,
  moveZ: 0,
  guarding: false,
  attackQueued: false,
  factorQueued: false,
  pulseQueued: false,
})

export function primeFactors(value: number): readonly number[] {
  if (!Number.isInteger(value) || value < 2) return []
  const factors: number[] = []
  let remaining = value
  for (let divisor = 2; divisor * divisor <= remaining; divisor += 1) {
    while (remaining % divisor === 0) {
      factors.push(divisor)
      remaining /= divisor
    }
  }
  if (remaining > 1) factors.push(remaining)
  return factors
}

export function isSelectablePrime(value: number): value is SiegePrime {
  return SELECTABLE_PRIMES.includes(value as SiegePrime)
}

function sectorById(id: SiegeSectorId): SiegeSector {
  const sector = SIEGE_SECTORS.find((candidate) => candidate.id === id)
  if (!sector) throw new Error(`Unknown Euclid Siege sector: ${id}`)
  return sector
}

export function createSiegeEnemy(entry: WaveEntry, waveIndex: number, entryIndex: number): SiegeEnemy {
  const sector = sectorById(entry.sector)
  const lateral = ((entryIndex % 3) - 1) * 1.65
  const radius = 34.2 + (entryIndex % 2) * 2.2
  const tangentX = -Math.sin(sector.angle) * lateral
  const tangentZ = Math.cos(sector.angle) * lateral
  const factorCount = primeFactors(entry.composite).length
  const boss = entry.boss === true
  const elite = entry.elite === true || boss
  const maxHp = boss ? 280 : 34 + waveIndex * 9 + factorCount * 7 + (elite ? 24 : 0)

  return {
    id: `wave-${waveIndex + 1}-${entryIndex}-${entry.composite}`,
    composite: entry.composite,
    shieldRemaining: entry.composite,
    position: [Math.cos(sector.angle) * radius + tangentX, Math.sin(sector.angle) * radius + tangentZ],
    sector: entry.sector,
    hp: maxHp,
    maxHp,
    speed: boss ? 0.72 : 1.2 + waveIndex * 0.09 + (elite ? -0.08 : 0),
    damage: boss ? 22 : 7 + waveIndex * 2 + (elite ? 3 : 0),
    radius: boss ? 1.75 : elite ? 1.05 : 0.82,
    attackReadyAtMs: 0,
    stunnedUntilMs: 0,
    enragedUntilMs: 0,
    elite,
    boss,
  }
}

export function spawnSiegeWave(waveIndex: number): readonly SiegeEnemy[] {
  const wave = SIEGE_WAVES[waveIndex]
  if (!wave) return []
  return wave.entries.map((entry, index) => createSiegeEnemy(entry, waveIndex, index))
}

export function createSiegeState(): SiegeState {
  return {
    phase: 'countdown',
    elapsedMs: 0,
    phaseEndsAtMs: 2_600,
    waveIndex: -1,
    player: {
      position: [0, 7.5],
      yaw: Math.PI,
      hp: 100,
      maxHp: 100,
      guarding: false,
      attackReadyAtMs: 0,
      factorReadyAtMs: 0,
      pulseReadyAtMs: 0,
    },
    forgeHp: 180,
    forgeMaxHp: 180,
    selectedPrime: 2,
    enemies: [],
    score: 0,
    kills: 0,
    combo: 0,
    bestCombo: 0,
    message: { serial: 0, tone: 'neutral', text: 'A forja desperta. Prepare os fatores.' },
    eventSerial: 0,
  }
}

export function createSiegeInput(): SiegeInput {
  return { ...EMPTY_INPUT }
}

function distance(a: SiegeVec2, b: SiegeVec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function moveToward(from: SiegeVec2, to: SiegeVec2, maxDistance: number): SiegeVec2 {
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  const length = Math.hypot(dx, dz)
  if (length < 0.0001 || maxDistance <= 0) return from
  const ratio = Math.min(1, maxDistance / length)
  return [from[0] + dx * ratio, from[1] + dz * ratio]
}

function clampToArena(position: SiegeVec2): SiegeVec2 {
  const length = Math.hypot(position[0], position[1])
  if (length <= SIEGE_ARENA_RADIUS) return position
  const ratio = SIEGE_ARENA_RADIUS / length
  return [position[0] * ratio, position[1] * ratio]
}

function closestEnemy(enemies: readonly SiegeEnemy[], origin: SiegeVec2, range: number, shielded?: boolean): SiegeEnemy | null {
  let closest: SiegeEnemy | null = null
  let closestDistance = Number.POSITIVE_INFINITY
  for (const enemy of enemies) {
    if (shielded !== undefined && (enemy.shieldRemaining > 1) !== shielded) continue
    const enemyDistance = distance(origin, enemy.position)
    if (enemyDistance <= range + enemy.radius && enemyDistance < closestDistance) {
      closest = enemy
      closestDistance = enemyDistance
    }
  }
  return closest
}

function updateEnemy(enemies: readonly SiegeEnemy[], id: string, transform: (enemy: SiegeEnemy) => SiegeEnemy): readonly SiegeEnemy[] {
  return enemies.map((enemy) => enemy.id === id ? transform(enemy) : enemy)
}

function removeDead(enemies: readonly SiegeEnemy[]): readonly SiegeEnemy[] {
  return enemies.filter((enemy) => enemy.hp > 0)
}

export function stepSiege(
  previous: SiegeState,
  input: SiegeInput = EMPTY_INPUT,
  rawDeltaMs = 16,
): SiegeStepResult {
  if (previous.phase === 'victory' || previous.phase === 'defeat') return { state: previous, events: [] }

  const deltaMs = Math.max(0, Math.min(Number.isFinite(rawDeltaMs) ? rawDeltaMs : 0, 100))
  const elapsedMs = previous.elapsedMs + deltaMs
  let phase: SiegePhase = previous.phase
  let phaseEndsAtMs = previous.phaseEndsAtMs
  let waveIndex = previous.waveIndex
  let player = previous.player
  let forgeHp = previous.forgeHp
  let enemies = previous.enemies
  const selectedPrime = input.selectedPrime ?? previous.selectedPrime
  let score = previous.score
  let kills = previous.kills
  let combo = previous.combo
  let bestCombo = previous.bestCombo
  let message = previous.message
  let eventSerial = previous.eventSerial
  const events: SiegeEvent[] = []

  const emit = (kind: SiegeEventKind, position: SiegeVec2, details?: Pick<SiegeEvent, 'accent' | 'label'>) => {
    eventSerial += 1
    events.push({ serial: eventSerial, kind, position, ...details })
  }
  const announce = (text: string, tone: SiegeMessage['tone']) => {
    message = { serial: message.serial + 1, text, tone }
  }

  if ((phase === 'countdown' || phase === 'intermission') && elapsedMs >= phaseEndsAtMs) {
    waveIndex += 1
    if (waveIndex >= SIEGE_WAVES.length) {
      phase = 'victory'
    } else {
      phase = 'wave'
      enemies = spawnSiegeWave(waveIndex)
      const wave = SIEGE_WAVES[waveIndex]
      announce(`ONDA ${waveIndex + 1} — ${wave.title}`, 'prime')
      emit('wave-start', [0, 0], { accent: '#ffd66b', label: String(waveIndex + 1) })
    }
  }

  const movementLength = Math.hypot(input.moveX, input.moveZ)
  const guarding = input.guarding && phase === 'wave'
  if (phase === 'wave' && movementLength > 0.01) {
    const normalizedX = input.moveX / Math.max(1, movementLength)
    const normalizedZ = input.moveZ / Math.max(1, movementLength)
    const speed = guarding ? 2.8 : 7.2
    const nextPosition = clampToArena([
      player.position[0] + normalizedX * speed * deltaMs / 1_000,
      player.position[1] + normalizedZ * speed * deltaMs / 1_000,
    ])
    player = {
      ...player,
      position: nextPosition,
      yaw: Math.atan2(normalizedX, normalizedZ),
      guarding,
    }
  } else {
    player = { ...player, guarding }
  }

  if (phase === 'wave' && input.factorQueued && elapsedMs >= player.factorReadyAtMs) {
    const target = closestEnemy(enemies, player.position, FACTOR_LANCE_RANGE, true)
    player = { ...player, factorReadyAtMs: elapsedMs + 520 }
    if (!target) {
      announce('Nenhum escudo composto ao alcance.', 'neutral')
    } else if (target.shieldRemaining % selectedPrime === 0) {
      const remaining = target.shieldRemaining / selectedPrime
      enemies = updateEnemy(enemies, target.id, (enemy) => ({
        ...enemy,
        shieldRemaining: remaining,
        stunnedUntilMs: remaining === 1 ? elapsedMs + 1_150 : elapsedMs + 420,
      }))
      score += remaining === 1 ? 90 : 35
      combo += 1
      bestCombo = Math.max(bestCombo, combo)
      emit(remaining === 1 ? 'shield-break' : 'factor', target.position, {
        accent: '#ffe178',
        label: remaining === 1 ? `${target.composite} = ${primeFactors(target.composite).join('×')}` : `÷${selectedPrime}`,
      })
      announce(
        remaining === 1
          ? `Escudo ${target.composite} decomposto. Núcleo exposto!`
          : `${target.shieldRemaining} ÷ ${selectedPrime} = ${remaining}`,
        'success',
      )
    } else {
      enemies = updateEnemy(enemies, target.id, (enemy) => ({ ...enemy, enragedUntilMs: elapsedMs + 2_400 }))
      player = { ...player, factorReadyAtMs: elapsedMs + 880 }
      combo = 0
      emit('factor-miss', target.position, { accent: '#ff4f3f', label: 'NÃO DIVIDE' })
      announce(`${selectedPrime} não divide ${target.shieldRemaining}. O composto acelerou!`, 'danger')
    }
  }

  if (phase === 'wave' && input.attackQueued && !guarding && elapsedMs >= player.attackReadyAtMs) {
    const target = closestEnemy(enemies, player.position, PLAYER_ATTACK_RANGE)
    player = { ...player, attackReadyAtMs: elapsedMs + 360 }
    if (!target) {
      announce('Nenhum invasor ao alcance da lâmina.', 'neutral')
    } else if (target.shieldRemaining > 1) {
      emit('blocked', target.position, { accent: '#ff9d57', label: String(target.shieldRemaining) })
      announce(`Escudo ${target.shieldRemaining}: fatore antes de atacar.`, 'danger')
    } else {
      const damage = 28 + Math.min(12, combo * 2)
      const nextHp = target.hp - damage
      enemies = updateEnemy(enemies, target.id, (enemy) => ({ ...enemy, hp: nextHp, stunnedUntilMs: elapsedMs + 180 }))
      emit(nextHp <= 0 ? 'enemy-defeated' : 'slash', target.position, { accent: '#fff0a8', label: nextHp <= 0 ? 'IRREDUTÍVEL' : `−${damage}` })
      if (nextHp <= 0) {
        enemies = removeDead(enemies)
        kills += 1
        combo += 1
        bestCombo = Math.max(bestCombo, combo)
        score += 120 + target.composite * (target.boss ? 3 : 1)
        announce(`${target.composite} reduzido ao silêncio.`, 'success')
      }
    }
  }

  if (phase === 'wave' && input.pulseQueued && !guarding && elapsedMs >= player.pulseReadyAtMs) {
    player = { ...player, pulseReadyAtMs: elapsedMs + PRIME_PULSE_COOLDOWN_MS }
    emit('pulse', player.position, { accent: '#ffe476', label: String(selectedPrime) })
    let affected = 0
    const defeated: SiegeEnemy[] = []
    enemies = enemies.map((enemy) => {
      if (distance(player.position, enemy.position) > PRIME_PULSE_RADIUS + enemy.radius) return enemy
      if (enemy.shieldRemaining > 1) {
        if (enemy.shieldRemaining % selectedPrime !== 0) return enemy
        affected += 1
        const remaining = enemy.shieldRemaining / selectedPrime
        emit(remaining === 1 ? 'shield-break' : 'factor', enemy.position, {
          accent: '#ffe476',
          label: remaining === 1 ? 'ABERTO' : `÷${selectedPrime}`,
        })
        return { ...enemy, shieldRemaining: remaining, stunnedUntilMs: elapsedMs + (remaining === 1 ? 1_250 : 500) }
      }

      affected += 1
      const next = { ...enemy, hp: enemy.hp - 46, stunnedUntilMs: elapsedMs + 500 }
      if (next.hp <= 0) defeated.push(next)
      emit(next.hp <= 0 ? 'enemy-defeated' : 'slash', enemy.position, { accent: '#fff3a6', label: next.hp <= 0 ? 'ZERO' : '−46' })
      return next
    })
    if (defeated.length > 0) {
      const deadIds = new Set(defeated.map((enemy) => enemy.id))
      enemies = enemies.filter((enemy) => !deadIds.has(enemy.id))
      kills += defeated.length
      combo += defeated.length
      bestCombo = Math.max(bestCombo, combo)
      score += defeated.reduce((total, enemy) => total + 140 + enemy.composite, 0)
    }
    if (affected > 0) {
      score += affected * 25
      announce(`Pulso ${selectedPrime}: ${affected} alvo${affected === 1 ? '' : 's'} ressoando.`, 'prime')
    } else {
      combo = 0
      announce(`O pulso ${selectedPrime} não encontrou um fator compatível.`, 'danger')
    }
  }

  if (phase === 'wave') {
    const core: SiegeVec2 = [0, 0]
    const playerAtCore = distance(player.position, core) <= SIEGE_CORE_RADIUS + 2.2
    let nextPlayerHp = player.hp
    let nextForgeHp = forgeHp

    enemies = enemies.map((enemy) => {
      if (elapsedMs < enemy.stunnedUntilMs) return enemy
      const playerDistance = distance(enemy.position, player.position)
      const coreDistance = distance(enemy.position, core)
      const huntsPlayer = playerDistance <= 5.4 + enemy.radius
      const target = huntsPlayer ? player.position : core
      const targetDistance = huntsPlayer ? playerDistance : coreDistance
      const contactRange = huntsPlayer ? 1.05 + enemy.radius : SIEGE_CORE_RADIUS + enemy.radius * 0.35
      let nextEnemy = enemy

      if (targetDistance > contactRange) {
        const rageMultiplier = elapsedMs < enemy.enragedUntilMs ? 1.42 : 1
        nextEnemy = {
          ...enemy,
          position: moveToward(enemy.position, target, enemy.speed * rageMultiplier * deltaMs / 1_000),
        }
      } else if (elapsedMs >= enemy.attackReadyAtMs) {
        nextEnemy = { ...enemy, attackReadyAtMs: elapsedMs + (enemy.boss ? 1_850 : 1_350) }
        if (huntsPlayer) {
          if (guarding) {
            const guardedDamage = Math.max(1, Math.round(enemy.damage * 0.16))
            nextPlayerHp -= guardedDamage
            nextEnemy = { ...nextEnemy, stunnedUntilMs: elapsedMs + 520 }
            score += 18
            emit('parry', player.position, { accent: '#ffe988', label: 'APARO' })
          } else {
            nextPlayerHp -= enemy.damage
            combo = 0
            emit('player-hit', player.position, { accent: '#ff3f2f', label: `−${enemy.damage}` })
          }
        } else {
          const reduction = guarding && playerAtCore ? 0.35 : 1
          const coreDamage = Math.max(1, Math.round(enemy.damage * reduction))
          nextForgeHp -= coreDamage
          combo = 0
          emit(guarding && playerAtCore ? 'parry' : 'forge-hit', core, {
            accent: guarding && playerAtCore ? '#ffe988' : '#ff3f2f',
            label: guarding && playerAtCore ? 'MURALHA' : `−${coreDamage}`,
          })
        }
      }
      return nextEnemy
    })

    player = { ...player, hp: Math.max(0, nextPlayerHp) }
    forgeHp = Math.max(0, nextForgeHp)

    if (player.hp <= 0 || forgeHp <= 0) {
      phase = 'defeat'
      announce(player.hp <= 0 ? 'O artífice caiu.' : 'O coração da forja foi rompido.', 'danger')
    } else if (enemies.length === 0) {
      if (waveIndex >= SIEGE_WAVES.length - 1) {
        phase = 'victory'
        score += Math.round(forgeHp * 12 + player.hp * 6)
        announce('O Titã foi fatorado. A Fortaleza Áurea permanece!', 'prime')
      } else {
        phase = 'intermission'
        phaseEndsAtMs = elapsedMs + 2_800
        player = { ...player, hp: Math.min(player.maxHp, player.hp + 16), guarding: false }
        forgeHp = Math.min(previous.forgeMaxHp, forgeHp + 12)
        announce('Setor seguro. A forja restaura suas muralhas.', 'success')
      }
    }
  }

  return {
    state: {
      phase,
      elapsedMs,
      phaseEndsAtMs,
      waveIndex,
      player,
      forgeHp,
      forgeMaxHp: previous.forgeMaxHp,
      selectedPrime,
      enemies,
      score,
      kills,
      combo,
      bestCombo,
      message,
      eventSerial,
    },
    events,
  }
}

export function waveProgress(state: SiegeState): { readonly current: number; readonly total: number } {
  return { current: Math.max(0, state.waveIndex + 1), total: SIEGE_WAVES.length }
}

export function phaseCountdownSeconds(state: SiegeState): number {
  if (state.phase !== 'countdown' && state.phase !== 'intermission') return 0
  return Math.max(0, Math.ceil((state.phaseEndsAtMs - state.elapsedMs) / 1_000))
}

export function formatSiegeTime(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1_000))
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`
}
