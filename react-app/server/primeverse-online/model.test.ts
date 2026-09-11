import { describe, expect, it } from 'vitest'

import { createAvatarAppearance } from '../../src/features/primeverse/games/primeverse-online/shared/protocol.js'
import type { RelayEnvelope, StoredPlayer } from './model.js'
import {
  createInitialNucleusCombat,
  isNucleusCombatRecord,
  isRelayEnvelope,
  isStoredPlayer,
  parseRelayEnvelope,
} from './model.js'

const envelope: RelayEnvelope = {
  instanceId: 'instance-1',
  roomId: 'primeverse-001',
  sentAt: 1_000,
  packet: {
    type: 'player_updated',
    playerId: 'player-1',
    position: { x: 1, y: 0.04, z: 2 },
    yaw: 0,
    animation: 'walk',
    sequence: 2,
    serverTime: 1_000,
  },
}

describe('Primeverse Redis relay envelope validation', () => {
  it('parses and rebuilds a valid relay packet', () => {
    const parsed = parseRelayEnvelope(JSON.stringify({
      ...envelope,
      injected: true,
      packet: { ...envelope.packet, injected: '<script>' },
    }))
    expect(parsed).toEqual(envelope)
  })

  it('rejects shallow server packet impostors and unsafe routing metadata', () => {
    expect(parseRelayEnvelope({
      ...envelope,
      packet: { type: 'player_updated' },
    })).toBeNull()
    expect(parseRelayEnvelope({ ...envelope, roomId: '../admin' })).toBeNull()
    expect(parseRelayEnvelope({ ...envelope, instanceId: 'x'.repeat(129) })).toBeNull()
    expect(parseRelayEnvelope('{bad')).toBeNull()
    expect(isRelayEnvelope({ ...envelope, packet: { type: 'welcome' } })).toBe(false)
  })
})

describe('Primeverse durable player validation', () => {
  const player: StoredPlayer = {
    id: 'player-1',
    nickname: 'Ada 13',
    activityId: 'nexus',
    runId: null,
    position: { x: 0, y: 0.04, z: 13 },
    yaw: 0,
    animation: 'idle',
    appearance: createAvatarAppearance(1),
    emote: null,
    sequence: 0,
    updatedAt: 1_000,
    joinedAt: 900,
    resumeToken: 'resume_token_1234567890',
  }

  it('rejects corrupt Redis snapshots before they can enter a welcome packet', () => {
    expect(isStoredPlayer(player)).toBe(true)
    expect(isStoredPlayer({ ...player, id: '../admin' })).toBe(false)
    expect(isStoredPlayer({ ...player, nickname: ' Ada 13 ' })).toBe(false)
    expect(isStoredPlayer({ ...player, position: { x: 999, y: 0, z: 0 } })).toBe(false)
    expect(isStoredPlayer({ ...player, yaw: Math.PI + 0.1 })).toBe(false)
    expect(isStoredPlayer({ ...player, sequence: -1 })).toBe(false)
    expect(isStoredPlayer({ ...player, updatedAt: -1 })).toBe(false)
    expect(isStoredPlayer({ ...player, nucleusAirborneSince: 999 })).toBe(true)
    expect(isStoredPlayer({ ...player, nucleusAirborneSince: null })).toBe(true)
    expect(isStoredPlayer({ ...player, nucleusAirborneSince: -1 })).toBe(false)
  })

  it('persists activity-scoped positions only with a matching run', () => {
    const expeditionPlayer: StoredPlayer = {
      ...player,
      activityId: 'ulam-rift',
      runId: 'run:primeverse-001:ulam-rift',
      position: { x: 0, y: 44, z: -230 },
    }
    expect(isStoredPlayer(expeditionPlayer)).toBe(true)
    expect(isStoredPlayer({
      ...expeditionPlayer,
      runId: 'run:primeverse-001:nucleus-257',
    })).toBe(false)
    expect(isStoredPlayer({ ...expeditionPlayer, runId: null })).toBe(false)
    expect(isStoredPlayer({ ...expeditionPlayer, position: { x: 0, y: 44, z: -300 } })).toBe(false)
  })
})

describe('Nucleus durable combat validation', () => {
  it('accepts a real UUID plus maximum-size client cast id idempotency key', () => {
    const record = createInitialNucleusCombat('run:primeverse-001:nucleus-257', 1_000)
    const playerId = '550e8400-e29b-41d4-a716-446655440000'
    const castId = `cast:${'a'.repeat(59)}`
    const idempotencyKey = `${playerId}:${castId}`
    expect(castId).toHaveLength(64)
    expect(isNucleusCombatRecord({
      ...record,
      recentCastIds: [idempotencyKey],
    })).toBe(true)
    expect(isNucleusCombatRecord({
      ...record,
      recentCastIds: ['x'.repeat(194)],
    })).toBe(false)
  })
})
