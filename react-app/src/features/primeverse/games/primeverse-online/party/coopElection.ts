/**
 * Deterministic co-op host election: the smallest player id in the run owns the
 * shared simulation. Every client computes the same answer with no negotiation,
 * so a host that disconnects is replaced the moment the roster changes.
 */
export function electCoopHost(playerIds: readonly string[]): string | null {
  if (playerIds.length === 0) return null
  return [...playerIds].sort((left, right) => left.localeCompare(right))[0]
}
