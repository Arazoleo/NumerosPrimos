import { useCallback, useEffect, useMemo, useRef } from 'react'

import type { InterpolatedTransform } from '../network/interpolation'
import type { RemotePlayer } from '../network/PrimeverseOnlineClient'
import {
  ENTRY_PORTAL_BY_ACTIVITY,
  type ActivityRunId,
  type ExpeditionActivityId,
} from '../shared/activities'
import type { AvatarAppearance, PlayerAnimation } from '../shared/protocol'
import { usePrimeverseSession } from '../session/PrimeverseSessionProvider'
import {
  deriveExpeditionPartyStatus,
  filterExpeditionPeers,
  hasExpeditionActivityAck,
  type ExpeditionPartyStatus,
  type PartyStatusInput,
} from './partyLogic'

export interface ExpeditionPartyMember {
  readonly id: string
  readonly nickname: string
  readonly appearance: AvatarAppearance
  readonly local: boolean
}

export interface PrimeverseExpeditionParty {
  readonly activityId: ExpeditionActivityId
  readonly mode: 'solo' | 'party'
  readonly status: ExpeditionPartyStatus
  readonly error: string | null
  readonly acknowledged: boolean
  readonly roomId: string | null
  readonly runId: ActivityRunId | null
  readonly peers: readonly RemotePlayer[]
  readonly members: readonly ExpeditionPartyMember[]
  readonly sendTransform: (
    position: readonly [number, number, number],
    yaw: number,
    animation: PlayerAnimation,
  ) => boolean
  readonly sampleRemote: (playerId: string) => InterpolatedTransform | null
}

export function usePrimeverseExpeditionParty(
  activityId: ExpeditionActivityId,
): PrimeverseExpeditionParty {
  const { activeIdentity, client, snapshot } = usePrimeverseSession()
  const requestedActivity = useRef<ExpeditionActivityId | null>(null)
  const statusInput: PartyStatusInput = {
    hasIdentity: activeIdentity !== null,
    hasClient: client !== null,
    connectionStatus: snapshot.status,
    targetActivityId: activityId,
    currentActivityId: snapshot.activityId,
    currentRunId: snapshot.runId,
    error: snapshot.error,
  }
  const acknowledged = hasExpeditionActivityAck(statusInput)
  const status = deriveExpeditionPartyStatus(statusInput)

  useEffect(() => {
    if (!activeIdentity || !client) {
      requestedActivity.current = null
      return
    }
    if (snapshot.status !== 'online') {
      requestedActivity.current = null
      return
    }
    if (snapshot.activityId === activityId && snapshot.runId !== null) {
      requestedActivity.current = activityId
      return
    }
    if (requestedActivity.current === activityId) return
    if (client.changeActivity(activityId, ENTRY_PORTAL_BY_ACTIVITY[activityId])) {
      requestedActivity.current = activityId
    }
  }, [activeIdentity, activityId, client, snapshot.activityId, snapshot.runId, snapshot.status])

  const peers = useMemo(() => filterExpeditionPeers(
    snapshot.players,
    activityId,
    acknowledged ? snapshot.runId : null,
    snapshot.playerId,
  ), [acknowledged, activityId, snapshot.playerId, snapshot.players, snapshot.runId])

  const members = useMemo<readonly ExpeditionPartyMember[]>(() => {
    if (!acknowledged || !activeIdentity) return []
    return [
      {
        id: snapshot.playerId ?? 'local',
        nickname: activeIdentity.nickname,
        appearance: activeIdentity.appearance,
        local: true,
      },
      ...peers.map((peer) => ({
        id: peer.id,
        nickname: peer.nickname,
        appearance: peer.appearance,
        local: false,
      })),
    ]
  }, [acknowledged, activeIdentity, peers, snapshot.playerId])

  const sendTransform = useCallback((
    position: readonly [number, number, number],
    yaw: number,
    animation: PlayerAnimation,
  ): boolean => {
    if (!client || !activeIdentity) return false
    const current = client.getSnapshot()
    if (current.status !== 'online' || current.activityId !== activityId || current.runId === null) return false
    client.sendActivityMovement(position, yaw, animation)
    return true
  }, [activeIdentity, activityId, client])

  const sampleRemote = useCallback((playerId: string): InterpolatedTransform | null => (
    client?.sampleRemote(playerId) ?? null
  ), [client])

  return useMemo(() => ({
    activityId,
    mode: acknowledged ? 'party' : 'solo',
    status,
    error: status === 'blocked' || status === 'offline' ? snapshot.error : null,
    acknowledged,
    roomId: activeIdentity ? snapshot.roomId : null,
    runId: acknowledged ? snapshot.runId : null,
    peers,
    members,
    sendTransform,
    sampleRemote,
  }), [
    acknowledged,
    activeIdentity,
    activityId,
    members,
    peers,
    sampleRemote,
    sendTransform,
    snapshot.roomId,
    snapshot.error,
    snapshot.runId,
    status,
  ])
}
