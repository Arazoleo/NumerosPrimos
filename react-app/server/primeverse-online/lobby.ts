import type { ExpeditionActivityId } from '../../src/features/primeverse/games/primeverse-online/shared/activities'

/**
 * Expedition lobbies.
 *
 * Until now players changed activity and met whoever happened to be there. A lobby
 * is the missing step: a host opens one, friends join by a short code, everyone
 * marks ready, and the host launches — at which point every member receives the
 * same run id and seed, so the expedition they walk into is literally the same one.
 *
 * This module is pure: no sockets, no storage, no clock of its own. The server owns
 * the side effects; the rules live here where they can be tested.
 */

export const LOBBY_CODE_LENGTH = 4
export const MAX_LOBBY_MEMBERS = 4
/** A lobby with no activity for this long is collected. */
export const LOBBY_IDLE_TIMEOUT_MS = 10 * 60_000

/** Unambiguous alphabet: no O/0, no I/1 — codes get read out loud. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export interface LobbyMember {
  readonly playerId: string
  readonly name: string
  readonly ready: boolean
  readonly joinedAtMs: number
}

export type LobbyPhase = 'gathering' | 'launched' | 'closed'

export interface LobbyRecord {
  readonly code: string
  readonly activityId: ExpeditionActivityId
  readonly hostId: string
  readonly members: readonly LobbyMember[]
  readonly phase: LobbyPhase
  /** Shared once launched: everyone enters the same run with the same layout. */
  readonly runId: string | null
  readonly seed: number | null
  readonly createdAtMs: number
  readonly updatedAtMs: number
}

export type LobbyFailure =
  | 'unknown-lobby'
  | 'lobby-full'
  | 'already-launched'
  | 'not-host'
  | 'not-member'
  | 'not-everyone-ready'
  | 'alone'

export interface LobbyResult {
  readonly lobby: LobbyRecord | null
  readonly error: LobbyFailure | null
}

function ok(lobby: LobbyRecord): LobbyResult {
  return Object.freeze({ lobby, error: null })
}

function fail(error: LobbyFailure): LobbyResult {
  return Object.freeze({ lobby: null, error })
}

/**
 * Deterministic code from a seed value, so the caller controls randomness and tests
 * stay reproducible. Callers retry with a new seed on collision.
 */
export function lobbyCodeFromSeed(seed: number): string {
  let value = Math.abs(Math.trunc(Number.isFinite(seed) ? seed : 0))
  let code = ''
  for (let index = 0; index < LOBBY_CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[value % CODE_ALPHABET.length]
    value = Math.floor(value / CODE_ALPHABET.length) + index * 7
  }
  return code
}

export function createLobby(input: {
  readonly code: string
  readonly activityId: ExpeditionActivityId
  readonly hostId: string
  readonly hostName: string
  readonly nowMs: number
}): LobbyRecord {
  return Object.freeze({
    code: input.code.toUpperCase(),
    activityId: input.activityId,
    hostId: input.hostId,
    members: Object.freeze([
      Object.freeze({
        playerId: input.hostId,
        name: input.hostName,
        // The host counts as ready: they are the one who presses launch.
        ready: true,
        joinedAtMs: input.nowMs,
      }),
    ]),
    phase: 'gathering' as const,
    runId: null,
    seed: null,
    createdAtMs: input.nowMs,
    updatedAtMs: input.nowMs,
  })
}

export function joinLobby(
  lobby: LobbyRecord | null,
  member: { readonly playerId: string; readonly name: string },
  nowMs: number,
): LobbyResult {
  if (!lobby || lobby.phase === 'closed') return fail('unknown-lobby')
  if (lobby.phase === 'launched') return fail('already-launched')
  const existing = lobby.members.find((candidate) => candidate.playerId === member.playerId)
  // Re-joining is idempotent: a reconnect must not duplicate the member.
  if (existing) return ok(Object.freeze({ ...lobby, updatedAtMs: nowMs }))
  if (lobby.members.length >= MAX_LOBBY_MEMBERS) return fail('lobby-full')

  return ok(Object.freeze({
    ...lobby,
    members: Object.freeze([
      ...lobby.members,
      Object.freeze({ playerId: member.playerId, name: member.name, ready: false, joinedAtMs: nowMs }),
    ]),
    updatedAtMs: nowMs,
  }))
}

export function setLobbyReady(
  lobby: LobbyRecord | null,
  playerId: string,
  ready: boolean,
  nowMs: number,
): LobbyResult {
  if (!lobby || lobby.phase === 'closed') return fail('unknown-lobby')
  if (lobby.phase === 'launched') return fail('already-launched')
  if (!lobby.members.some((member) => member.playerId === playerId)) return fail('not-member')
  return ok(Object.freeze({
    ...lobby,
    members: Object.freeze(lobby.members.map((member) => (
      member.playerId === playerId ? Object.freeze({ ...member, ready }) : member
    ))),
    updatedAtMs: nowMs,
  }))
}

/**
 * Leaving hands the lobby to the next member who joined; the last one out closes it.
 */
export function leaveLobby(
  lobby: LobbyRecord | null,
  playerId: string,
  nowMs: number,
): LobbyResult {
  if (!lobby) return fail('unknown-lobby')
  const members = lobby.members.filter((member) => member.playerId !== playerId)
  if (members.length === lobby.members.length) return fail('not-member')
  if (members.length === 0) {
    return ok(Object.freeze({ ...lobby, members: Object.freeze([]), phase: 'closed' as const, updatedAtMs: nowMs }))
  }
  const hostId = playerId === lobby.hostId ? members[0].playerId : lobby.hostId
  return ok(Object.freeze({
    ...lobby,
    hostId,
    members: Object.freeze(members.map((member) => (
      member.playerId === hostId ? Object.freeze({ ...member, ready: true }) : member
    ))),
    updatedAtMs: nowMs,
  }))
}

export function launchLobby(
  lobby: LobbyRecord | null,
  playerId: string,
  input: { readonly runId: string; readonly seed: number; readonly nowMs: number },
): LobbyResult {
  if (!lobby || lobby.phase === 'closed') return fail('unknown-lobby')
  if (lobby.phase === 'launched') return fail('already-launched')
  if (lobby.hostId !== playerId) return fail('not-host')
  if (lobby.members.length < 2) return fail('alone')
  if (!lobby.members.every((member) => member.ready)) return fail('not-everyone-ready')
  return ok(Object.freeze({
    ...lobby,
    phase: 'launched' as const,
    runId: input.runId,
    seed: input.seed,
    updatedAtMs: input.nowMs,
  }))
}

export function isLobbyExpired(lobby: LobbyRecord, nowMs: number): boolean {
  return nowMs - lobby.updatedAtMs > LOBBY_IDLE_TIMEOUT_MS
}

/** What a client is allowed to see: the same shape for every member. */
export interface LobbyView {
  readonly code: string
  readonly activityId: ExpeditionActivityId
  readonly hostId: string
  readonly phase: LobbyPhase
  readonly members: readonly LobbyMember[]
  readonly runId: string | null
  readonly seed: number | null
  readonly canLaunch: boolean
}

export function toLobbyView(lobby: LobbyRecord): LobbyView {
  return Object.freeze({
    code: lobby.code,
    activityId: lobby.activityId,
    hostId: lobby.hostId,
    phase: lobby.phase,
    members: lobby.members,
    runId: lobby.runId,
    seed: lobby.seed,
    canLaunch: lobby.phase === 'gathering'
      && lobby.members.length >= 2
      && lobby.members.every((member) => member.ready),
  })
}
