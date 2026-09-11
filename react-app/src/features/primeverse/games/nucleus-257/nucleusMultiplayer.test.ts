import { describe, expect, it } from 'vitest'

import type { NucleusCombatPlayer, NucleusCombatState } from '../primeverse-online/shared/protocol'
import { createCombatant } from './arenaLogic'
import {
  canUseNucleusOnlineControls,
  cameraRelativeBearingDegrees,
  cinematicLocksArenaControls,
  combatantFromNucleusPlayer,
  hasAcknowledgedNucleusJoin,
  isNucleusRemoteSampleFresh,
  nucleusOpponents,
  reconcileNucleusRoster,
} from './nucleusMultiplayer'
import { nucleusJoinRetryDelayMs, supportsNucleusOnlineMode } from './useNucleusMultiplayer'

function player(overrides: Partial<NucleusCombatPlayer> = {}): NucleusCombatPlayer {
  return {
    id: 'player-1', nickname: 'Ada', heroId: 'luma-crivo', team: 'cipher', connected: true,
    position: { x: 1, y: 0.05, z: 2 }, yaw: Math.PI / 2,
    health: 230, maxHealth: 240, shield: 60, maxShield: 80, alive: true,
    cooldownReadyAt: { primary: 1_100, signature: 2_200, mobility: 3_300, ultimate: 4_400 },
    ultimateCharge: 42, eliminations: 3, deaths: 1, respawnAt: null,
    statuses: [{ id: 'slowed', expiresAt: 5_000, magnitude: 0.25 }],
    ...overrides,
  }
}

function state(players: readonly NucleusCombatPlayer[]): NucleusCombatState {
  return {
    type: 'nucleus_state', runId: 'run:primeverse-001:nucleus-257', revision: 1,
    serverTime: 1_000, phase: 'active', players, objective: null,
  }
}

describe('Nucleus authoritative roster adapter', () => {
  it('blocks online movement and powers until the local roster join is acknowledged', () => {
    expect(canUseNucleusOnlineControls(false, 'online')).toBe(false)
    expect(canUseNucleusOnlineControls(true, 'connecting')).toBe(false)
    expect(canUseNucleusOnlineControls(true, 'reconnecting')).toBe(false)
    expect(canUseNucleusOnlineControls(true, 'offline')).toBe(false)
    expect(canUseNucleusOnlineControls(true, 'online')).toBe(true)
  })

  it('keeps the ultimate cinematic non-blocking online but dramatic in solo', () => {
    expect(cinematicLocksArenaControls('solo', true)).toBe(true)
    expect(cinematicLocksArenaControls('online', true)).toBe(false)
    expect(cinematicLocksArenaControls('solo', false)).toBe(false)
  })

  it('does not let an older interpolated pose overwrite an authoritative combat snapshot', () => {
    const sample = {
      position: [3, 0.05, -4] as [number, number, number],
      yaw: 0,
      animation: 'run' as const,
      serverTime: 2_000,
      sequence: 12,
    }
    expect(isNucleusRemoteSampleFresh(sample, 1_999)).toBe(true)
    expect(isNucleusRemoteSampleFresh(sample, 2_000)).toBe(true)
    expect(isNucleusRemoteSampleFresh(sample, 2_001)).toBe(false)
    expect(isNucleusRemoteSampleFresh(null, 1_000)).toBe(false)
  })

  it('backs rejected joins off instead of retrying on every render', () => {
    expect(nucleusJoinRetryDelayMs(0)).toBe(1_500)
    expect(nucleusJoinRetryDelayMs(1)).toBe(3_000)
    expect(nucleusJoinRetryDelayMs(2)).toBe(5_000)
    expect(nucleusJoinRetryDelayMs(99)).toBe(8_000)
  })

  it('acknowledges a join only for the selected connected local hero', () => {
    expect(hasAcknowledgedNucleusJoin(state([player()]), 'player-1', 'luma-crivo')).toBe(true)
    expect(hasAcknowledgedNucleusJoin(state([player({ connected: false })]), 'player-1', 'luma-crivo')).toBe(false)
    expect(hasAcknowledgedNucleusJoin(state([player({ heroId: 'raul-rsa' })]), 'player-1', 'luma-crivo')).toBe(false)
    expect(hasAcknowledgedNucleusJoin(state([player()]), 'missing-player', 'luma-crivo')).toBe(false)
  })

  it('maps damage sources into camera-relative indicator angles', () => {
    const observer = { x: 0, z: 0 }
    expect(cameraRelativeBearingDegrees(observer, { x: 0, z: -10 }, 0)).toBeCloseTo(0)
    expect(cameraRelativeBearingDegrees(observer, { x: 10, z: 0 }, 0)).toBeCloseTo(90)
    expect(cameraRelativeBearingDegrees(observer, { x: -10, z: 0 }, 0)).toBeCloseTo(-90)
    expect(Math.abs(cameraRelativeBearingDegrees(observer, { x: 0, z: 10 }, 0))).toBeCloseTo(180)
    expect(cameraRelativeBearingDegrees(observer, { x: -10, z: 0 }, Math.PI / 2)).toBeCloseTo(0)
  })

  it('uses a real solo fallback for blocked or exhausted offline sessions', () => {
    expect(supportsNucleusOnlineMode('party')).toBe(true)
    expect(supportsNucleusOnlineMode('joining')).toBe(true)
    expect(supportsNucleusOnlineMode('reconnecting')).toBe(true)
    expect(supportsNucleusOnlineMode('blocked')).toBe(false)
    expect(supportsNucleusOnlineMode('offline')).toBe(false)
    expect(supportsNucleusOnlineMode('solo')).toBe(false)
  })

  it('maps server vitals, cooldowns and statuses to the arena model', () => {
    const combatant = combatantFromNucleusPlayer(player(), undefined, 'player-1')
    expect(combatant).toMatchObject({
      id: 'player-1', bot: false, health: 230, shield: 60, ultimateCharge: 42,
      cooldownReadyAtMs: { primary: 1_100, signature: 2_200, mobility: 3_300, ultimate: 4_400 },
      statuses: { slowed: { id: 'slowed', expiresAtMs: 5_000, magnitude: 0.25 } },
    })
    expect(combatant.facing.x).toBeCloseTo(-1)
    expect(combatant.facing.z).toBeCloseTo(0)
  })

  it('preserves nearby local prediction but accepts a respawn or large correction', () => {
    const predicted = createCombatant({
      id: 'player-1', heroId: 'luma-crivo', team: 'cipher', position: { x: 2, y: 0.05, z: 2 },
    })
    expect(combatantFromNucleusPlayer(player(), predicted, 'player-1').position.x).toBe(2)
    expect(combatantFromNucleusPlayer(player({ position: { x: 20, y: 0.05, z: -20 } }), predicted, 'player-1').position)
      .toEqual({ x: 20, y: 0.05, z: -20 })
    expect(combatantFromNucleusPlayer(player({ alive: false, health: 0 }), predicted, 'player-1').position)
      .toEqual({ x: 1, y: 0.05, z: 2 })
  })

  it('drops disconnected players and derives actual enemies from server teams', () => {
    const roster = reconcileNucleusRoster([], state([
      player(),
      player({ id: 'ally', nickname: 'Gauss', team: 'cipher' }),
      player({ id: 'enemy', nickname: 'Euler', team: 'fracture' }),
      player({ id: 'gone', connected: false, team: 'fracture' }),
    ]), 'player-1')
    expect(roster.map((combatant) => combatant.id)).toEqual(['player-1', 'ally', 'enemy'])
    expect(nucleusOpponents(roster, 'player-1').map((combatant) => combatant.id)).toEqual(['enemy'])
  })
})
