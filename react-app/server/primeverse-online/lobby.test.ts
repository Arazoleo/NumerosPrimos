import { describe, expect, it } from 'vitest'

import {
  LOBBY_IDLE_TIMEOUT_MS,
  MAX_LOBBY_MEMBERS,
  createLobby,
  isLobbyExpired,
  joinLobby,
  launchLobby,
  leaveLobby,
  lobbyCodeFromSeed,
  setLobbyReady,
  toLobbyView,
} from './lobby'

const base = {
  code: 'ABCD',
  activityId: 'sieve-catacombs' as const,
  hostId: 'host',
  hostName: 'Leo',
  nowMs: 1_000,
}

function withFriend() {
  const lobby = createLobby(base)
  return joinLobby(lobby, { playerId: 'friend', name: 'Ana' }, 2_000).lobby!
}

describe('expedition lobby codes', () => {
  it('produces readable, fixed-length codes without look-alike characters', () => {
    for (const seed of [0, 1, 42, 999_983, -17]) {
      const code = lobbyCodeFromSeed(seed)
      expect(code).toHaveLength(4)
      expect(code).toMatch(/^[A-Z2-9]+$/)
      expect(code).not.toMatch(/[O0I1]/)
    }
    expect(lobbyCodeFromSeed(42)).toBe(lobbyCodeFromSeed(42))
    expect(lobbyCodeFromSeed(42)).not.toBe(lobbyCodeFromSeed(43))
  })
})

describe('gathering a party', () => {
  it('starts with the host ready and room for friends', () => {
    const lobby = createLobby(base)
    expect(lobby.members).toHaveLength(1)
    expect(lobby.members[0].ready).toBe(true)
    expect(lobby.phase).toBe('gathering')
    expect(toLobbyView(lobby).canLaunch).toBe(false)
  })

  it('accepts friends up to the cap and treats a rejoin as a reconnect', () => {
    let lobby = createLobby(base)
    for (const id of ['a', 'b', 'c']) {
      lobby = joinLobby(lobby, { playerId: id, name: id }, 2_000).lobby!
    }
    expect(lobby.members).toHaveLength(MAX_LOBBY_MEMBERS)

    const again = joinLobby(lobby, { playerId: 'a', name: 'a' }, 3_000)
    expect(again.error).toBeNull()
    expect(again.lobby?.members).toHaveLength(MAX_LOBBY_MEMBERS)

    const overflow = joinLobby(lobby, { playerId: 'd', name: 'd' }, 3_000)
    expect(overflow.error).toBe('lobby-full')
  })

  it('refuses unknown or already-launched lobbies', () => {
    expect(joinLobby(null, { playerId: 'x', name: 'x' }, 1).error).toBe('unknown-lobby')
    const launched = launchLobby(
      setLobbyReady(withFriend(), 'friend', true, 3_000).lobby!,
      'host',
      { runId: 'run:1:sieve-catacombs', seed: 7, nowMs: 4_000 },
    ).lobby!
    expect(joinLobby(launched, { playerId: 'late', name: 'late' }, 5_000).error).toBe('already-launched')
  })
})

describe('readiness and launching', () => {
  it('only launches when the host asks and everyone is ready', () => {
    const lobby = withFriend()
    expect(toLobbyView(lobby).canLaunch).toBe(false)

    expect(launchLobby(lobby, 'host', { runId: 'r', seed: 1, nowMs: 3_000 }).error)
      .toBe('not-everyone-ready')

    const ready = setLobbyReady(lobby, 'friend', true, 3_000).lobby!
    expect(toLobbyView(ready).canLaunch).toBe(true)
    expect(launchLobby(ready, 'friend', { runId: 'r', seed: 1, nowMs: 4_000 }).error).toBe('not-host')

    const launched = launchLobby(ready, 'host', {
      runId: 'run:abc:sieve-catacombs',
      seed: 4_242,
      nowMs: 4_000,
    })
    expect(launched.error).toBeNull()
    expect(launched.lobby?.phase).toBe('launched')
    // Everyone gets the same run and the same seed: the same expedition.
    expect(launched.lobby?.runId).toBe('run:abc:sieve-catacombs')
    expect(launched.lobby?.seed).toBe(4_242)
    expect(launchLobby(launched.lobby, 'host', { runId: 'r2', seed: 2, nowMs: 5_000 }).error)
      .toBe('already-launched')
  })

  it('will not launch a party of one', () => {
    expect(launchLobby(createLobby(base), 'host', { runId: 'r', seed: 1, nowMs: 2_000 }).error)
      .toBe('alone')
  })

  it('rejects readiness from someone who is not in the lobby', () => {
    expect(setLobbyReady(withFriend(), 'stranger', true, 3_000).error).toBe('not-member')
  })
})

describe('leaving', () => {
  it('hands the lobby to the next member and closes it when empty', () => {
    const lobby = withFriend()
    const afterHostLeaves = leaveLobby(lobby, 'host', 5_000).lobby!
    expect(afterHostLeaves.hostId).toBe('friend')
    expect(afterHostLeaves.members[0].ready).toBe(true)
    expect(afterHostLeaves.phase).toBe('gathering')

    const empty = leaveLobby(afterHostLeaves, 'friend', 6_000).lobby!
    expect(empty.members).toHaveLength(0)
    expect(empty.phase).toBe('closed')

    expect(leaveLobby(lobby, 'stranger', 6_000).error).toBe('not-member')
  })

  it('collects lobbies nobody has touched in a while', () => {
    const lobby = createLobby(base)
    expect(isLobbyExpired(lobby, base.nowMs + 1_000)).toBe(false)
    expect(isLobbyExpired(lobby, base.nowMs + LOBBY_IDLE_TIMEOUT_MS + 1)).toBe(true)
  })
})
