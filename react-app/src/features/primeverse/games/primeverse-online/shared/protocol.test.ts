import { describe, expect, it } from 'vitest'

import {
  DEFAULT_AVATAR_APPEARANCE,
  MAX_MESSAGE_BYTES,
  MAX_RUN_SPEED,
  MAX_SERVER_MESSAGE_BYTES,
  MAX_WALK_SPEED,
  PROTOCOL_VERSION,
  createAvatarAppearance,
  createMovementBudget,
  isEmote,
  isInteractionTarget,
  parseClientMessage,
  parseServerMessage,
  sanitizeNickname,
  validateMovement,
  type PrimeSequenceState,
  type PlayerMovement,
  type PlayerSnapshot,
  type ServerMessage,
  type WorldState,
} from './protocol'

const previous: Pick<PlayerSnapshot, 'position' | 'sequence'> = {
  position: { x: 0, y: 1, z: 0 },
  sequence: 4,
}
const RESUME_TOKEN = 'resume_token_1234567890'

function movement(overrides: Partial<PlayerMovement> = {}): PlayerMovement {
  return {
    position: { x: 0.4, y: 1, z: 0 },
    yaw: 0,
    animation: 'walk',
    sequence: 5,
    clientTime: 1_000,
    ...overrides,
  }
}

describe('Primeverse Online nickname validation', () => {
  it('trims safe Unicode names and keeps supported separators', () => {
    expect(sanitizeNickname('  Léo_13  ')).toEqual({ ok: true, value: 'Léo_13' })
    expect(sanitizeNickname('李 7')).toEqual({ ok: true, value: '李 7' })
    expect(sanitizeNickname('Ana-Maria')).toEqual({ ok: true, value: 'Ana-Maria' })
  })

  it('rejects short, long and unsafe names', () => {
    expect(sanitizeNickname(' A ').ok).toBe(false)
    expect(sanitizeNickname('abcdefghijklmnopq').ok).toBe(false)
    expect(sanitizeNickname('<script>').ok).toBe(false)
    expect(sanitizeNickname('Ana\nMaria').ok).toBe(false)
    expect(sanitizeNickname('🚀pilot').ok).toBe(false)
    expect(sanitizeNickname(13).ok).toBe(false)
  })
})

describe('Primeverse Online client protocol', () => {
  it('parses and rebuilds a valid join without forwarding unknown fields', () => {
    const result = parseClientMessage(JSON.stringify({
      type: 'join',
      version: PROTOCOL_VERSION,
      nickname: '  Leonardo  ',
      appearance: {
        bodyColor: '#172b3a',
        accentColor: '#5ceee5',
        visorColor: '#8d7dff',
      },
      injected: '<img onerror=alert(1)>',
    }))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({
      type: 'join',
      version: PROTOCOL_VERSION,
      nickname: 'Leonardo',
      appearance: {
        bodyColor: '#172b3a',
        accentColor: '#5ceee5',
        visorColor: '#8d7dff',
      },
    })
    expect('injected' in result.value).toBe(false)
  })

  it('accepts only bounded opaque reconnect tokens on join', () => {
    expect(parseClientMessage({
      type: 'join',
      version: PROTOCOL_VERSION,
      nickname: 'Leonardo',
      appearance: DEFAULT_AVATAR_APPEARANCE,
      resumeToken: RESUME_TOKEN,
    })).toMatchObject({ ok: true, value: { resumeToken: RESUME_TOKEN } })
    expect(parseClientMessage({
      type: 'join',
      version: PROTOCOL_VERSION,
      nickname: 'Leonardo',
      appearance: DEFAULT_AVATAR_APPEARANCE,
      resumeToken: '../steal-session',
    }).ok).toBe(false)
  })

  it('rejects malformed, oversized, unknown and mismatched messages', () => {
    expect(parseClientMessage('{').ok).toBe(false)
    expect(parseClientMessage('x'.repeat(MAX_MESSAGE_BYTES + 1))).toMatchObject({
      ok: false,
      error: { code: 'MESSAGE_TOO_LARGE' },
    })
    expect(parseClientMessage({ type: 'chat', text: 'not supported' })).toMatchObject({
      ok: false,
      error: { code: 'UNKNOWN_MESSAGE' },
    })
    expect(parseClientMessage({
      type: 'join',
      version: 99,
      nickname: 'Ana',
      appearance: DEFAULT_AVATAR_APPEARANCE,
    })).toMatchObject({ ok: false, error: { code: 'PROTOCOL_MISMATCH' } })
    expect(parseClientMessage({
      type: 'join',
      version: PROTOCOL_VERSION,
      nickname: 'Ana',
      appearance: { bodyColor: 'red', accentColor: '#ffffff', visorColor: '#ffffff' },
    }).ok).toBe(false)
  })

  it('validates movement fields, world bounds and finite values', () => {
    expect(parseClientMessage({ type: 'move', ...movement() }).ok).toBe(true)
    expect(parseClientMessage({
      type: 'move',
      ...movement({ position: { x: 121, y: 0, z: 0 } }),
    }).ok).toBe(false)
    expect(parseClientMessage({ type: 'move', ...movement({ yaw: Infinity }) }).ok).toBe(false)
    expect(parseClientMessage({
      type: 'move',
      ...movement({ animation: 'fly' as PlayerMovement['animation'] }),
    }).ok).toBe(false)
    expect(parseClientMessage({ type: 'move', ...movement({ sequence: -1 }) }).ok).toBe(false)
  })

  it('accepts only known emotes and interaction targets', () => {
    for (const emote of ['wave', 'celebrate', 'heart', 'question', 'spark']) {
      expect(isEmote(emote)).toBe(true)
      expect(parseClientMessage({ type: 'emote', emote }).ok).toBe(true)
    }
    expect(isEmote('firehose')).toBe(false)
    expect(parseClientMessage({ type: 'emote', emote: 'firehose' }).ok).toBe(false)
    expect(isInteractionTarget('pedestal-13')).toBe(true)
    expect(parseClientMessage({
      type: 'interaction',
      target: 'pedestal-13',
      action: 'vote',
    }).ok).toBe(true)
    for (const target of [
      'portal-ulam',
      'portal-forge',
      'portal-nexus-ulam',
      'portal-nexus-forge',
      'portal-catacombs',
      'portal-nucleus',
      'portal-nexus-catacombs',
    ]) {
      expect(isInteractionTarget(target)).toBe(true)
      expect(parseClientMessage({ type: 'interaction', target, action: 'travel' }).ok).toBe(true)
    }
    expect(parseClientMessage({
      type: 'interaction',
      target: 'admin-console',
      action: 'activate',
    }).ok).toBe(false)
  })

  it('validates the complete target/action matrix instead of each enum separately', () => {
    const valid = [
      ['prime-core', 'activate'],
      ['pedestal-12', 'vote'],
      ['pedestal-13', 'vote'],
      ['pedestal-15', 'vote'],
      ['pedestal-17', 'vote'],
      ['secret-997', 'discover'],
      ['secret-constellation', 'discover'],
      ['secret-mersenne', 'discover'],
      ['spawn-plaza', 'respawn'],
      ['portal-ulam', 'travel'],
      ['portal-forge', 'travel'],
      ['portal-nexus-ulam', 'travel'],
      ['portal-nexus-forge', 'travel'],
      ['portal-catacombs', 'travel'],
      ['portal-nucleus', 'travel'],
      ['portal-nexus-catacombs', 'travel'],
    ] as const
    for (const [target, action] of valid) {
      expect(parseClientMessage({ type: 'interaction', target, action }).ok).toBe(true)
    }

    for (const action of ['activate', 'vote', 'discover', 'respawn', 'travel'] as const) {
      expect(parseClientMessage({
        type: 'interaction',
        target: 'prime-core',
        action,
      }).ok).toBe(action === 'activate')
    }
    expect(parseClientMessage({
      type: 'interaction',
      target: 'secret-997',
      action: 'vote',
    })).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } })
    expect(parseClientMessage({
      type: 'interaction',
      target: 'pedestal-13',
      action: 'discover',
    })).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } })
    expect(parseClientMessage({
      type: 'interaction',
      target: 'portal-ulam',
      action: 'activate',
    })).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } })
    expect(parseClientMessage({
      type: 'interaction',
      target: 'secret-997',
      action: 'travel',
    })).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } })
  })

  it('builds deterministic, safe avatar appearances', () => {
    expect(createAvatarAppearance(42)).toEqual(createAvatarAppearance(42))
    expect(parseClientMessage({
      type: 'join',
      version: PROTOCOL_VERSION,
      nickname: 'Ada',
      appearance: createAvatarAppearance(42),
    }).ok).toBe(true)
  })
})

describe('Primeverse Online movement anti-teleport validation', () => {
  it('accepts legal walking, running and jumping movement', () => {
    expect(validateMovement(previous, movement({
      position: { x: MAX_WALK_SPEED, y: 1, z: 0 },
    }), 1_000).ok).toBe(true)
    expect(validateMovement(previous, movement({
      position: { x: MAX_RUN_SPEED, y: 1, z: 0 },
      animation: 'run',
    }), 1_000).ok).toBe(true)
    expect(validateMovement(previous, movement({
      position: { x: 4, y: 8, z: 0 },
      animation: 'jump',
    }), 1_000).ok).toBe(true)
  })

  it('rejects stale packets, teleporting and impossible speed', () => {
    expect(validateMovement(previous, movement({ sequence: 4 }), 100)).toMatchObject({
      ok: false,
      reason: 'stale_sequence',
    })
    expect(validateMovement(previous, movement({
      position: { x: 20, y: 1, z: 0 },
      animation: 'run',
    }), 100)).toMatchObject({ ok: false, reason: 'position_delta' })
    expect(validateMovement(previous, movement({
      position: { x: 2, y: 1, z: 0 },
    }), 100)).toMatchObject({ ok: false, reason: 'horizontal_speed' })
    expect(validateMovement(previous, movement({
      position: { x: 0, y: 5, z: 0 },
      animation: 'jump',
    }), 100)).toMatchObject({ ok: false, reason: 'vertical_speed' })
    expect(validateMovement(previous, movement(), 0)).toMatchObject({
      ok: false,
      reason: 'invalid_elapsed',
    })
  })

  it('rejects a locally plausible step into the void between realms', () => {
    expect(validateMovement(
      { position: { x: 43.9, y: 1, z: 0 }, sequence: 4 },
      movement({ position: { x: 44.1, y: 1, z: 0 } }),
      1_000,
    )).toMatchObject({ ok: false, reason: 'out_of_bounds' })
  })

  it('accepts movement inside the Cripta do Crivo and rejects its outer edge', () => {
    expect(validateMovement(
      { position: { x: 0, y: 1, z: -104 }, sequence: 4 },
      movement({ position: { x: 0, y: 1, z: -109 }, animation: 'run' }),
      1_000,
    ).ok).toBe(true)

    expect(validateMovement(
      { position: { x: 0, y: 1, z: -125.8 }, sequence: 4 },
      movement({ position: { x: 0, y: 1, z: -126.2 } }),
      1_000,
    )).toMatchObject({ ok: false, reason: 'out_of_bounds' })
  })

  it('spends burst credit once and cannot turn grace into sustained ~16 m/s movement', () => {
    let accepted = { ...previous }
    let budget = createMovementBudget()

    for (let sequence = 5; sequence < 35; sequence += 1) {
      const proposal = movement({
        sequence,
        animation: 'run',
        position: {
          x: accepted.position.x + 16 / 15,
          y: 1,
          z: 0,
        },
      })
      const result = validateMovement(accepted, proposal, 1_000 / 15, budget)
      expect(result.ok).toBe(false)
    }

    for (let sequence = 5; sequence < 65; sequence += 1) {
      const proposal = movement({
        sequence,
        animation: 'run',
        position: {
          x: accepted.position.x + MAX_RUN_SPEED / 15,
          y: 1,
          z: 0,
        },
      })
      const result = validateMovement(accepted, proposal, 1_000 / 15, budget)
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      accepted = { position: proposal.position, sequence: proposal.sequence }
      budget = result.nextBudget
    }
    expect(accepted.position.x).toBeCloseTo(MAX_RUN_SPEED * 4)
  })
})

const EMPTY_SEQUENCE: PrimeSequenceState = {
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
}

const WORLD: WorldState = {
  serverTime: 1_000,
  core: { nearbyPlayers: 0, energyLevel: 'dormant', intensity: 0.2, ringSpeed: 0.65 },
  sequence: EMPTY_SEQUENCE,
}

const PLAYER: PlayerSnapshot = {
  id: 'player-1',
  nickname: 'Ada',
  activityId: 'nexus',
  runId: null,
  position: { x: 0, y: 0.04, z: 13 },
  yaw: 0,
  animation: 'idle',
  appearance: DEFAULT_AVATAR_APPEARANCE,
  emote: null,
  sequence: 0,
  updatedAt: 1_000,
}
describe('Primeverse Online server protocol', () => {
  it('deeply rebuilds welcome snapshots and strips injected properties', () => {
    const result = parseServerMessage(JSON.stringify({
      type: 'welcome',
      version: PROTOCOL_VERSION,
      playerId: PLAYER.id,
      roomId: 'primeverse-001',
      resumeToken: RESUME_TOKEN,
      players: [{ ...PLAYER, injected: true }],
      world: { ...WORLD, injected: true },
      serverTime: 1_000,
      injected: '<script>',
    }))
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.type !== 'welcome') return
    expect(result.value).toEqual({
      type: 'welcome',
      version: PROTOCOL_VERSION,
      playerId: PLAYER.id,
      roomId: 'primeverse-001',
      resumeToken: RESUME_TOKEN,
      players: [PLAYER],
      world: WORLD,
      serverTime: 1_000,
    })
    expect('injected' in result.value.players[0]).toBe(false)
  })

  it('uses a dedicated large server limit but still rejects oversized input', () => {
    const packet: ServerMessage = {
      type: 'error',
      code: 'SERVER_UNAVAILABLE',
      message: 'temporarily unavailable',
      recoverable: true,
    }
    expect(parseServerMessage(JSON.stringify(packet)).ok).toBe(true)
    expect(MAX_SERVER_MESSAGE_BYTES).toBeGreaterThanOrEqual(64 * 1_024)
    expect(parseServerMessage('x'.repeat(MAX_SERVER_MESSAGE_BYTES + 1))).toMatchObject({
      ok: false,
      error: { code: 'MESSAGE_TOO_LARGE' },
    })
  })

  it('rejects mismatched versions and malformed nested player, world and event data', () => {
    expect(parseServerMessage({
      type: 'welcome', version: 99, playerId: PLAYER.id, roomId: 'primeverse-001', resumeToken: RESUME_TOKEN,
      players: [PLAYER], world: WORLD, serverTime: 1_000,
    })).toMatchObject({ ok: false, error: { code: 'PROTOCOL_MISMATCH' } })
    expect(parseServerMessage({
      type: 'welcome', version: PROTOCOL_VERSION, playerId: PLAYER.id, roomId: '../admin', resumeToken: RESUME_TOKEN,
      players: [PLAYER], world: WORLD, serverTime: 1_000,
    })).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } })
    expect(parseServerMessage({ type: 'player_joined', player: { ...PLAYER, yaw: Infinity } }).ok).toBe(false)
    expect(parseServerMessage({
      type: 'world_state',
      state: { ...WORLD, sequence: { ...EMPTY_SEQUENCE, voteCounts: { 12: 0, 13: 7, 15: 0, 17: 0 } } },
    }).ok).toBe(false)
    expect(parseServerMessage({
      type: 'world_event',
      event: {
        kind: 'sequence_revealed', round: 1, answer: 15, winningChoice: 15,
        success: false, effect: null, at: 1_000,
      },
    }).ok).toBe(false)
  })

  it('validates and rebuilds every remaining server packet family', () => {
    const packets: ServerMessage[] = [
      { type: 'player_joined', player: PLAYER },
      { type: 'player_updated', playerId: PLAYER.id, position: PLAYER.position, yaw: 0, animation: 'walk', sequence: 1, serverTime: 1_010 },
      { type: 'player_left', playerId: PLAYER.id, reason: 'timeout' },
      { type: 'player_emote', playerId: PLAYER.id, emote: 'wave', startedAt: 1_000, durationMs: 2_000 },
      { type: 'world_state', state: WORLD },
      { type: 'world_event', event: { kind: 'sequence_started', round: 1, phaseEndsAt: 9_000, at: 1_000 } },
      { type: 'pong', clientTime: 900, serverTime: 1_000 },
      { type: 'error', code: 'RATE_LIMITED', message: 'devagar', recoverable: true },
    ]
    for (const packet of packets) expect(parseServerMessage(packet)).toEqual({ ok: true, value: packet })
    expect(parseServerMessage({ type: 'error', code: 'ROOT_ACCESS', message: 'no', recoverable: false }).ok).toBe(false)
    expect(parseServerMessage({ type: 'broadcast', payload: PLAYER }).ok).toBe(false)
  })
})

describe('Nucleus 257 combat wire protocol', () => {
  const runId = 'run:primeverse-001:nucleus-257' as const

  it('accepts intent-only combat commands and strips spoofed authority fields', () => {
    expect(parseClientMessage({
      type: 'nucleus_join',
      runId,
      heroId: 'luma-crivo',
    })).toMatchObject({ ok: true })
    expect(parseClientMessage({ type: 'nucleus_leave', runId })).toMatchObject({ ok: true })

    const cast = parseClientMessage({
      type: 'nucleus_cast',
      runId,
      castId: 'cast:ada:13',
      slot: 'primary',
      aim: { direction: { x: 0, y: 0, z: -1 }, point: { x: 0, y: 1, z: -8 } },
      clientTime: 2_000,
      targetId: 'victim',
      damage: 999,
      origin: { x: 0, y: 30, z: 0 },
    })
    expect(cast).toMatchObject({
      ok: true,
      value: {
        type: 'nucleus_cast',
        castId: 'cast:ada:13',
        slot: 'primary',
      },
    })
    if (cast.ok) {
      expect('targetId' in cast.value).toBe(false)
      expect('damage' in cast.value).toBe(false)
      expect('origin' in cast.value).toBe(false)
    }

    expect(parseClientMessage({
      type: 'nucleus_cast', runId, castId: 'bad id', slot: 'primary',
      aim: { direction: { x: 0, y: 0, z: 0 } }, clientTime: 2_000,
    }).ok).toBe(false)
    expect(parseClientMessage({
      type: 'nucleus_join', runId: 'run:primeverse-001:ulam-rift', heroId: 'luma-crivo',
    }).ok).toBe(false)
  })

  it('deeply validates authoritative combat state and cast events', () => {
    const player = {
      id: 'player-13',
      nickname: 'Ada',
      heroId: 'luma-crivo' as const,
      team: 'cipher' as const,
      connected: true,
      position: { x: 0, y: 0.05, z: 20 },
      yaw: 0,
      health: 250,
      maxHealth: 250,
      shield: 80,
      maxShield: 80,
      alive: true,
      cooldownReadyAt: { primary: 0, signature: 0, mobility: 0, ultimate: 0 },
      ultimateCharge: 0,
      eliminations: 0,
      deaths: 0,
      respawnAt: null,
      statuses: [],
    }
    const state = {
      type: 'nucleus_state' as const,
      runId,
      revision: 2,
      serverTime: 2_000,
      phase: 'waiting' as const,
      players: [player],
      objective: null,
    }
    expect(parseServerMessage(state)).toEqual({ ok: true, value: state })

    const packet = {
      type: 'nucleus_event' as const,
      runId,
      revision: 3,
      eventId: 'nucleus:3:event-13',
      serverTime: 2_100,
      event: {
        kind: 'cast' as const,
        casterId: player.id,
        castId: 'cast:13',
        abilityId: 'agulha-prima',
        slot: 'primary' as const,
        origin: { x: 0, y: 1.77, z: 20 },
        direction: { x: 0, y: 0, z: -1 },
        hitIds: ['player-17'],
        damages: [{
          sourceId: player.id, targetId: 'player-17', amount: 20, absorbedByShield: 20,
          health: 250, shield: 60, eliminated: false,
        }],
        eliminatedIds: [],
      },
    }
    expect(parseServerMessage(packet)).toEqual({ ok: true, value: packet })
    expect(parseServerMessage({
      ...state,
      players: [{ ...player, health: -1 }],
    }).ok).toBe(false)
    expect(parseServerMessage({ ...state, phase: 'active' }).ok).toBe(false)
    const sameTeamPlayers = [player, { ...player, id: 'player-18' }]
    expect(parseServerMessage({ ...state, players: sameTeamPlayers, phase: 'waiting' }).ok).toBe(true)
    expect(parseServerMessage({ ...state, players: sameTeamPlayers, phase: 'active' }).ok).toBe(false)
    expect(parseServerMessage({
      ...packet,
      event: { ...packet.event, damages: [{ ...packet.event.damages[0], amount: Infinity }] },
    }).ok).toBe(false)
  })
})

describe('lobby messages', () => {
  it('accepts a well-formed lobby handshake and normalises the code', () => {
    const create = parseClientMessage(JSON.stringify({ type: 'lobby_create', activityId: 'sieve-catacombs' }))
    expect(create.ok).toBe(true)

    const join = parseClientMessage(JSON.stringify({ type: 'lobby_join', code: 'ab2d' }))
    expect(join.ok && join.value.type === 'lobby_join' && join.value.code).toBe('AB2D')

    const ready = parseClientMessage(JSON.stringify({ type: 'lobby_ready', ready: true }))
    expect(ready.ok).toBe(true)
    expect(parseClientMessage(JSON.stringify({ type: 'lobby_leave' })).ok).toBe(true)
    expect(parseClientMessage(JSON.stringify({ type: 'lobby_launch' })).ok).toBe(true)
  })

  it('rejects malformed lobby payloads', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'lobby_create', activityId: 'nexus' })).ok).toBe(false)
    expect(parseClientMessage(JSON.stringify({ type: 'lobby_join', code: 'AB' })).ok).toBe(false)
    expect(parseClientMessage(JSON.stringify({ type: 'lobby_join', code: 'AB0D' })).ok).toBe(false)
    expect(parseClientMessage(JSON.stringify({ type: 'lobby_ready', ready: 'yes' })).ok).toBe(false)
  })
})
