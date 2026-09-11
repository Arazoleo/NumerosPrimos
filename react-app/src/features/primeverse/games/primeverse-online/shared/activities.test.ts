import { describe, expect, it } from 'vitest'

import {
  ACTIVITY_BY_PORTAL,
  ACTIVITY_IDS,
  ACTIVITY_MOVEMENT_PROFILES,
  ACTIVITY_SPAWNS,
  createActivityRunId,
  isActivityRunPair,
  isPositionInActivity,
} from './activities'
import {
  DEFAULT_AVATAR_APPEARANCE,
  PROTOCOL_VERSION,
  createMovementBudget,
  parseClientMessage,
  parseServerMessage,
  validateMovement,
} from './protocol'

describe('Primeverse activities', () => {
  it('maps every standalone entry portal to a canonical activity', () => {
    expect(ACTIVITY_IDS).toEqual([
      'nexus',
      'ulam-rift',
      'euclid-siege',
      'sieve-catacombs',
      'nucleus-257',
      'primebound',
    ])
    expect(ACTIVITY_BY_PORTAL).toMatchObject({
      'portal-ulam': 'ulam-rift',
      'portal-forge': 'euclid-siege',
      'portal-catacombs': 'sieve-catacombs',
      'portal-nucleus': 'nucleus-257',
    })
    expect(ACTIVITY_SPAWNS['euclid-siege']).toEqual({ x: 0, y: 0.05, z: 7.5 })
  })

  it('derives a stable run per room and activity while isolating rooms', () => {
    const first = createActivityRunId('primeverse-001', 'nucleus-257')
    expect(first).toBe('run:primeverse-001:nucleus-257')
    expect(createActivityRunId('primeverse-001', 'nucleus-257')).toBe(first)
    expect(createActivityRunId('primeverse-002', 'nucleus-257')).not.toBe(first)
    expect(createActivityRunId('primeverse-001', 'nexus')).toBeNull()
    expect(isActivityRunPair('nucleus-257', first)).toBe(true)
    expect(isActivityRunPair('ulam-rift', first)).toBe(false)
  })

  it('uses broad activity-specific movement envelopes', () => {
    expect(isPositionInActivity('ulam-rift', { x: 0, y: 44, z: -230 })).toBe(true)
    expect(isPositionInActivity('nucleus-257', { x: 0, y: 0.05, z: -230 })).toBe(false)
  })

  it('accepts each game movement model without turning checkpoints into sustained speed', () => {
    const ulamProfile = ACTIVITY_MOVEMENT_PROFILES['ulam-rift']
    const ulamRun = validateMovement(
      { position: { x: 0, y: 1.12, z: 14 }, sequence: 1 },
      {
        position: { x: 0.92, y: 1.12, z: 14 },
        yaw: 0,
        animation: 'run',
        sequence: 2,
        clientTime: 100,
      },
      100,
      createMovementBudget(),
      (position) => isPositionInActivity('ulam-rift', position),
      ulamProfile,
    )
    expect(ulamRun).toMatchObject({ ok: true, discontinuity: false })

    const impulseBudget = createMovementBudget(true, ulamProfile)
    const ulamImpulse = validateMovement(
      { position: { x: 0, y: 1.12, z: 14 }, sequence: 1 },
      {
        position: { x: 2.94, y: 1.12, z: 14 },
        yaw: 0,
        animation: 'run',
        sequence: 2,
        clientTime: 200,
      },
      200,
      impulseBudget,
      (position) => isPositionInActivity('ulam-rift', position),
      ulamProfile,
    )
    expect(ulamImpulse).toMatchObject({ ok: true, discontinuity: false })

    const sustainedImpulse = validateMovement(
      { position: { x: 2.94, y: 1.12, z: 14 }, sequence: 2 },
      {
        position: { x: 5.88, y: 1.12, z: 14 },
        yaw: 0,
        animation: 'run',
        sequence: 3,
        clientTime: 400,
      },
      200,
      ulamImpulse.ok ? ulamImpulse.nextBudget : impulseBudget,
      (position) => isPositionInActivity('ulam-rift', position),
      ulamProfile,
    )
    expect(sustainedImpulse).toMatchObject({ ok: false, reason: 'horizontal_speed' })

    const ulamFall = validateMovement(
      { position: { x: 0, y: 30, z: -140 }, sequence: 2 },
      {
        position: { x: 0, y: 24.5, z: -140 },
        yaw: 0,
        animation: 'jump',
        sequence: 3,
        clientTime: 200,
      },
      100,
      createMovementBudget(),
      (position) => isPositionInActivity('ulam-rift', position),
      ulamProfile,
    )
    expect(ulamFall).toMatchObject({ ok: true, discontinuity: false })

    const nucleusProfile = ACTIVITY_MOVEMENT_PROFILES['nucleus-257']
    const nucleusBlink = validateMovement(
      { position: { x: 0, y: 0.05, z: 20 }, sequence: 4 },
      {
        position: { x: 0, y: 0.05, z: 2 },
        yaw: 0,
        animation: 'run',
        sequence: 5,
        clientTime: 300,
      },
      100,
      createMovementBudget(),
      (position) => isPositionInActivity('nucleus-257', position),
      nucleusProfile,
      true,
    )
    expect(nucleusBlink).toMatchObject({ ok: true, discontinuity: true })

    const repeatedWithoutCredit = validateMovement(
      { position: { x: 0, y: 0.05, z: 2 }, sequence: 5 },
      {
        position: { x: 0, y: 0.05, z: -16 },
        yaw: 0,
        animation: 'run',
        sequence: 6,
        clientTime: 400,
      },
      100,
      nucleusBlink.ok ? nucleusBlink.nextBudget : createMovementBudget(),
      (position) => isPositionInActivity('nucleus-257', position),
      nucleusProfile,
      false,
    )
    expect(repeatedWithoutCredit).toMatchObject({ ok: false, reason: 'position_delta' })

    expect(createMovementBudget(true, ulamProfile)).toEqual({
      horizontal: 1.5,
      vertical: 0.75,
    })
    expect(createMovementBudget(true, nucleusProfile)).toEqual({
      horizontal: 0.5,
      vertical: 0.5,
    })
  })

  it('allows only real Euclid replay and Nucleus respawn landings', () => {
    const euclidProfile = ACTIVITY_MOVEMENT_PROFILES['euclid-siege']
    const euclidReplay = validateMovement(
      { position: { x: 0, y: 0.05, z: -38 }, sequence: 3 },
      {
        position: ACTIVITY_SPAWNS['euclid-siege'],
        yaw: Math.PI,
        animation: 'idle',
        sequence: 4,
        clientTime: 1_000,
      },
      100,
      createMovementBudget(true, euclidProfile),
      (position) => isPositionInActivity('euclid-siege', position),
      euclidProfile,
      true,
    )
    expect(euclidReplay).toMatchObject({ ok: true, discontinuity: true })

    const euclidArbitrary = validateMovement(
      { position: { x: 0, y: 0.05, z: -38 }, sequence: 3 },
      {
        position: { x: 10, y: 0.05, z: 7.5 },
        yaw: Math.PI,
        animation: 'idle',
        sequence: 4,
        clientTime: 1_000,
      },
      100,
      createMovementBudget(true, euclidProfile),
      (position) => isPositionInActivity('euclid-siege', position),
      euclidProfile,
      true,
    )
    expect(euclidArbitrary).toMatchObject({ ok: false, reason: 'position_delta' })

    const nucleusProfile = ACTIVITY_MOVEMENT_PROFILES['nucleus-257']
    const nucleusSpawns = [
      { x: 0, y: 0.05, z: 20 },
      { x: -19, y: 0.05, z: -2 },
      { x: 18, y: 0.05, z: -7 },
      { x: 3, y: 0.05, z: -21 },
    ] as const
    expect(nucleusProfile.discontinuityLandings?.map(({ center }) => center)).toEqual(nucleusSpawns)

    const farSources = [
      { x: 0, y: 0.05, z: -27 },
      { x: 27, y: 0.05, z: 0 },
      { x: -27, y: 0.05, z: 0 },
      { x: 0, y: 0.05, z: 27 },
    ] as const
    for (const [index, spawn] of nucleusSpawns.entries()) {
      const respawn = validateMovement(
        { position: farSources[index], sequence: 10 },
        {
          position: spawn,
          yaw: 0,
          animation: 'idle',
          sequence: 11,
          clientTime: 2_000,
        },
        100,
        createMovementBudget(true, nucleusProfile),
        (position) => isPositionInActivity('nucleus-257', position),
        nucleusProfile,
        true,
      )
      expect(respawn).toMatchObject({ ok: true, discontinuity: true })
    }

    const arbitraryLongJump = validateMovement(
      { position: { x: -27, y: 0.05, z: 0 }, sequence: 10 },
      {
        position: { x: 10, y: 0.05, z: 0 },
        yaw: 0,
        animation: 'idle',
        sequence: 11,
        clientTime: 2_000,
      },
      100,
      createMovementBudget(true, nucleusProfile),
      (position) => isPositionInActivity('nucleus-257', position),
      nucleusProfile,
      true,
    )
    expect(arbitraryLongJump).toMatchObject({ ok: false, reason: 'position_delta' })
  })

  it('permits known checkpoint/level landings but never bypasses activity bounds', () => {
    const profile = ACTIVITY_MOVEMENT_PROFILES['sieve-catacombs']
    const checkpoint = validateMovement(
      { position: { x: 0, y: 0, z: -59 }, sequence: 8 },
      {
        position: { x: 0, y: 0, z: 27 },
        yaw: 0,
        animation: 'idle',
        sequence: 9,
        clientTime: 1_000,
      },
      100,
      createMovementBudget(),
      (position) => isPositionInActivity('sieve-catacombs', position),
      profile,
      true,
    )
    expect(checkpoint).toMatchObject({ ok: true, discontinuity: true })

    const arbitraryLanding = validateMovement(
      { position: { x: 0, y: 0, z: -59 }, sequence: 8 },
      {
        position: { x: 20, y: 0, z: 27 },
        yaw: 0,
        animation: 'idle',
        sequence: 9,
        clientTime: 1_000,
      },
      100,
      createMovementBudget(),
      (position) => isPositionInActivity('sieve-catacombs', position),
      profile,
      true,
    )
    expect(arbitraryLanding).toMatchObject({ ok: false, reason: 'position_delta' })

    const outsideBounds = validateMovement(
      { position: { x: 0, y: 0, z: -59 }, sequence: 8 },
      {
        position: { x: 0, y: 0, z: 61 },
        yaw: 0,
        animation: 'idle',
        sequence: 9,
        clientTime: 1_000,
      },
      100,
      createMovementBudget(),
      (position) => isPositionInActivity('sieve-catacombs', position),
      profile,
      true,
    )
    expect(outsideBounds).toMatchObject({ ok: false, reason: 'out_of_bounds' })
  })
})

describe('Primeverse activity protocol', () => {
  it('validates activity transitions and never accepts a client-provided run', () => {
    expect(parseClientMessage({
      type: 'change_activity',
      activityId: 'sieve-catacombs',
      portalId: 'portal-catacombs',
      runId: 'run:forged:sieve-catacombs',
    })).toEqual({
      ok: true,
      value: {
        type: 'change_activity',
        activityId: 'sieve-catacombs',
        portalId: 'portal-catacombs',
      },
    })
    expect(parseClientMessage({
      type: 'change_activity',
      activityId: 'sieve-catacombs',
      portalId: 'portal-ulam',
    }).ok).toBe(false)
    expect(parseClientMessage({ type: 'change_activity', activityId: 'nexus' })).toEqual({
      ok: true,
      value: { type: 'change_activity', activityId: 'nexus' },
    })
  })

  it('accepts transforms outside the Nexus only inside the matching activity envelope', () => {
    const valid = {
      type: 'activity_move',
      activityId: 'ulam-rift',
      runId: 'run:primeverse-001:ulam-rift',
      position: { x: 0, y: 44, z: -230 },
      yaw: 0,
      animation: 'run',
      sequence: 9,
      clientTime: 1_000,
    }
    expect(parseClientMessage(valid).ok).toBe(true)
    expect(parseClientMessage({
      ...valid,
      runId: 'run:primeverse-001:nucleus-257',
    }).ok).toBe(false)
    expect(parseClientMessage({
      ...valid,
      position: { x: 0, y: 44, z: -300 },
    }).ok).toBe(false)
  })

  it('deeply rebuilds activity server events and activity-aware snapshots', () => {
    const runId = 'run:primeverse-001:nucleus-257'
    expect(parseServerMessage({
      type: 'activity_changed',
      playerId: 'player-1',
      activityId: 'nucleus-257',
      runId,
      serverTime: 2_000,
      sequence: 3,
      injected: true,
    })).toEqual({
      ok: true,
      value: {
        type: 'activity_changed',
        playerId: 'player-1',
        activityId: 'nucleus-257',
        runId,
        serverTime: 2_000,
        sequence: 3,
      },
    })

    expect(parseServerMessage({
      type: 'welcome',
      version: PROTOCOL_VERSION,
      playerId: 'player-1',
      roomId: 'primeverse-001',
      resumeToken: 'resume_token_1234567890',
      players: [{
        id: 'player-1',
        nickname: 'Ada',
        activityId: 'ulam-rift',
        runId: 'run:primeverse-001:ulam-rift',
        position: { x: 0, y: 44, z: -230 },
        yaw: 0,
        animation: 'run',
        appearance: DEFAULT_AVATAR_APPEARANCE,
        emote: null,
        sequence: 9,
        updatedAt: 2_000,
      }],
      world: {
        serverTime: 2_000,
        core: { nearbyPlayers: 0, energyLevel: 'dormant', intensity: 0.2, ringSpeed: 0.65 },
        sequence: {
          round: 0,
          phase: 'idle',
          startedAt: null,
          phaseEndsAt: null,
          votesByPlayer: {},
          voteCounts: { 12: 0, 13: 0, 15: 0, 17: 0 },
          totalVotes: 0,
          winningChoice: null,
          revealedAnswer: null,
          success: null,
        },
      },
      serverTime: 2_000,
    }).ok).toBe(true)
  })
})
