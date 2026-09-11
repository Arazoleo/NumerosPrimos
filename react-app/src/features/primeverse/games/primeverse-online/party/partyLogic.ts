import type { OnlineConnectionStatus } from '../network/PrimeverseOnlineClient'
import type { ActivityId, ActivityRunId, ExpeditionActivityId } from '../shared/activities'

export type ExpeditionPartyStatus = 'solo' | 'joining' | 'party' | 'reconnecting' | 'offline' | 'blocked'

export interface ActivityScopedPeer {
  readonly id: string
  readonly activityId: ActivityId
  readonly runId: ActivityRunId | null
}

export interface PartyStatusInput {
  readonly hasIdentity: boolean
  readonly hasClient: boolean
  readonly connectionStatus: OnlineConnectionStatus
  readonly targetActivityId: ExpeditionActivityId
  readonly currentActivityId: ActivityId
  readonly currentRunId: ActivityRunId | null
  readonly error?: string | null
}

export function hasExpeditionActivityAck(input: PartyStatusInput): boolean {
  return input.hasIdentity
    && input.hasClient
    && input.connectionStatus === 'online'
    && input.currentActivityId === input.targetActivityId
    && input.currentRunId !== null
}

export function deriveExpeditionPartyStatus(input: PartyStatusInput): ExpeditionPartyStatus {
  if (!input.hasIdentity || !input.hasClient) return 'solo'
  if (input.connectionStatus === 'reconnecting') return 'reconnecting'
  if (input.connectionStatus === 'offline' || input.connectionStatus === 'error') return 'offline'
  if (input.error && input.currentActivityId !== input.targetActivityId) return 'blocked'
  return hasExpeditionActivityAck(input) ? 'party' : 'joining'
}

export function filterExpeditionPeers<T extends ActivityScopedPeer>(
  peers: readonly T[],
  activityId: ExpeditionActivityId,
  runId: ActivityRunId | null,
  localPlayerId: string | null,
): readonly T[] {
  if (runId === null) return []
  return peers.filter((peer) => (
    peer.id !== localPlayerId
    && peer.activityId === activityId
    && peer.runId === runId
  ))
}
