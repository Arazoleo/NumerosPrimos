import type { ExpeditionActivityId } from '../shared/activities'

/**
 * The launch ticket a lobby hands every member: the run they all enter and the
 * seed that makes it the same expedition. It survives the route change through
 * sessionStorage, and each game consumes it exactly once on start.
 */
export interface LobbyLaunchTicket {
  readonly runId: string
  readonly seed: number
  readonly activityId: ExpeditionActivityId
  readonly issuedAtMs: number
}

const STORAGE_KEY = 'primeverse:lobby-ticket'
/** A stale ticket must not seed a run started minutes later by hand. */
const TICKET_TTL_MS = 90_000

export function storeLobbyTicket(ticket: Omit<LobbyLaunchTicket, 'issuedAtMs'>, nowMs = Date.now()): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...ticket, issuedAtMs: nowMs }))
  } catch {
    // Storage may be unavailable (private mode); the game then rolls its own seed.
  }
}

export function consumeLobbyTicket(
  activityId: ExpeditionActivityId,
  nowMs = Date.now(),
): LobbyLaunchTicket | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LobbyLaunchTicket>
    if (
      typeof parsed.runId !== 'string'
      || typeof parsed.seed !== 'number'
      || !Number.isFinite(parsed.seed)
      || parsed.activityId !== activityId
      || typeof parsed.issuedAtMs !== 'number'
      || nowMs - parsed.issuedAtMs > TICKET_TTL_MS
    ) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    sessionStorage.removeItem(STORAGE_KEY)
    return parsed as LobbyLaunchTicket
  } catch {
    return null
  }
}
