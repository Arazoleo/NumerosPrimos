import { describe, expect, it } from 'vitest'

import {
  createSiegeEnemy,
  createSiegeState,
  phaseCountdownSeconds,
  primeFactors,
  SIEGE_WAVES,
  spawnSiegeWave,
  stepSiege,
  type SiegeInput,
  type SiegeState,
} from './siegeLogic'

const idle: SiegeInput = {
  moveX: 0,
  moveZ: 0,
  guarding: false,
  attackQueued: false,
  factorQueued: false,
  pulseQueued: false,
}

function combatState(overrides: Partial<SiegeState> = {}): SiegeState {
  const base = createSiegeState()
  return {
    ...base,
    phase: 'wave',
    elapsedMs: 3_000,
    phaseEndsAtMs: 0,
    waveIndex: 0,
    ...overrides,
  }
}

describe('Euclid Siege arithmetic', () => {
  it('factorizes repeated and semiprime shields', () => {
    expect(primeFactors(12)).toEqual([2, 2, 3])
    expect(primeFactors(91)).toEqual([7, 13])
    expect(primeFactors(210)).toEqual([2, 3, 5, 7])
    expect(primeFactors(1)).toEqual([])
  })

  it('spawns deterministic enemies in every authored wave', () => {
    expect(SIEGE_WAVES).toHaveLength(5)
    SIEGE_WAVES.forEach((wave, index) => {
      expect(spawnSiegeWave(index)).toHaveLength(wave.entries.length)
      expect(spawnSiegeWave(index)).toEqual(spawnSiegeWave(index))
    })
    expect(spawnSiegeWave(99)).toEqual([])
  })
})

describe('Euclid Siege combat loop', () => {
  it('starts after a clear countdown and reports its remaining seconds', () => {
    const initial = createSiegeState()
    expect(phaseCountdownSeconds(initial)).toBe(3)
    const started = stepSiege(initial, idle, 100).state
    let state = started
    for (let frame = 0; frame < 25; frame += 1) state = stepSiege(state, idle, 100).state
    expect(state.phase).toBe('wave')
    expect(state.waveIndex).toBe(0)
    expect(state.enemies).toHaveLength(3)
  })

  it('accepts valid prime factors and punishes an invalid one', () => {
    const enemy = { ...createSiegeEnemy({ composite: 6, sector: 'ember' }, 0, 0), position: [0, 6] as const }
    let state = combatState({ enemies: [enemy], selectedPrime: 2 })

    state = stepSiege(state, { ...idle, factorQueued: true }, 16).state
    expect(state.enemies[0].shieldRemaining).toBe(3)
    expect(state.combo).toBe(1)

    state = {
      ...state,
      elapsedMs: state.player.factorReadyAtMs,
      selectedPrime: 2,
    }
    state = stepSiege(state, { ...idle, factorQueued: true }, 16).state
    expect(state.enemies[0].shieldRemaining).toBe(3)
    expect(state.enemies[0].enragedUntilMs).toBeGreaterThan(state.elapsedMs)
    expect(state.combo).toBe(0)
  })

  it('blocks normal damage until a shield is completely factored', () => {
    const enemy = { ...createSiegeEnemy({ composite: 6, sector: 'ember' }, 0, 0), position: [0, 6] as const }
    let state = combatState({ enemies: [enemy] })
    state = stepSiege(state, { ...idle, attackQueued: true }, 16).state
    expect(state.enemies[0].hp).toBe(enemy.hp)

    state = {
      ...state,
      elapsedMs: state.player.attackReadyAtMs,
      enemies: [{ ...state.enemies[0], shieldRemaining: 1, hp: 20 }],
    }
    state = stepSiege(state, { ...idle, attackQueued: true }, 16).state
    expect(state.enemies).toHaveLength(0)
    expect(state.phase).toBe('intermission')
    expect(state.kills).toBe(1)
  })

  it('uses guarding to reduce contact damage and parry the attacker', () => {
    const baseEnemy = {
      ...createSiegeEnemy({ composite: 10, sector: 'crown' }, 0, 0),
      position: [0, 7.7] as const,
      attackReadyAtMs: 0,
    }
    const open = stepSiege(combatState({ enemies: [baseEnemy] }), idle, 16).state
    const guarded = stepSiege(combatState({ enemies: [baseEnemy] }), { ...idle, guarding: true }, 16).state

    expect(guarded.player.hp).toBeGreaterThan(open.player.hp)
    expect(guarded.enemies[0].stunnedUntilMs).toBeGreaterThan(guarded.elapsedMs)
  })

  it('finishes in victory after the final exposed enemy falls', () => {
    const enemy = {
      ...createSiegeEnemy({ composite: 210, sector: 'crucible', boss: true }, SIEGE_WAVES.length - 1, 0),
      position: [0, 6] as const,
      shieldRemaining: 1,
      hp: 10,
    }
    const final = combatState({ waveIndex: SIEGE_WAVES.length - 1, enemies: [enemy] })
    const result = stepSiege(final, { ...idle, attackQueued: true }, 16).state

    expect(result.phase).toBe('victory')
    expect(result.enemies).toHaveLength(0)
    expect(result.score).toBeGreaterThan(0)
  })
})
