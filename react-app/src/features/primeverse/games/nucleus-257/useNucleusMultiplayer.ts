import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { InterpolatedTransform } from '../primeverse-online/network/interpolation'
import type { OnlineConnectionStatus } from '../primeverse-online/network/PrimeverseOnlineClient'
import type { PrimeverseExpeditionParty } from '../primeverse-online/party'
import type {
  NucleusAbilitySlot,
  NucleusAimInput,
  NucleusCombatEventMessage,
  NucleusCombatState,
} from '../primeverse-online/shared/protocol'
import { usePrimeverseSession } from '../primeverse-online/session/PrimeverseSessionProvider'
import { hasAcknowledgedNucleusJoin } from './nucleusMultiplayer'
import type { HeroId } from './types'

export interface NucleusMultiplayerMatch {
  readonly mode: 'solo' | 'online'
  readonly connectionStatus: OnlineConnectionStatus
  readonly partyStatus: PrimeverseExpeditionParty['status']
  readonly ready: boolean
  readonly joinError: string | null
  readonly playerId: string | null
  readonly runId: PrimeverseExpeditionParty['runId']
  readonly state: NucleusCombatState | null
  readonly events: readonly NucleusCombatEventMessage[]
  readonly sendCast: (slot: NucleusAbilitySlot, aim: NucleusAimInput) => string | null
  readonly retryJoin: () => void
  readonly leave: () => boolean
  readonly getServerNow: () => number
  readonly consumeCorrection: () => InterpolatedTransform | null
  readonly sampleRemote: PrimeverseExpeditionParty['sampleRemote']
}

export function supportsNucleusOnlineMode(status: PrimeverseExpeditionParty['status']): boolean {
  return status === 'party' || status === 'joining' || status === 'reconnecting'
}

const JOIN_ACK_TIMEOUT_MS = 5_000
const JOIN_RETRY_DELAYS_MS = [1_500, 3_000, 5_000, 8_000] as const

export function nucleusJoinRetryDelayMs(attempt: number): number {
  const index = Math.min(Math.max(0, Math.floor(attempt)), JOIN_RETRY_DELAYS_MS.length - 1)
  return JOIN_RETRY_DELAYS_MS[index]
}

export function useNucleusMultiplayer(
  party: PrimeverseExpeditionParty,
  heroId: HeroId,
): NucleusMultiplayerMatch {
  const { activeIdentity, client, snapshot } = usePrimeverseSession()
  const onlineIntent = activeIdentity !== null && supportsNucleusOnlineMode(party.status)
  const runId = party.runId ?? (
    snapshot.activityId === 'nucleus-257' ? snapshot.runId : null
  )
  const joinedKey = useRef<string | null>(null)
  const joinRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const joinRetryAttempt = useRef(0)
  const [joinAttemptNonce, setJoinAttemptNonce] = useState(0)

  const clearJoinRetry = useCallback(() => {
    if (joinRetryTimer.current !== null) clearTimeout(joinRetryTimer.current)
    joinRetryTimer.current = null
  }, [])

  useEffect(() => {
    if (!onlineIntent || !client || !runId || snapshot.status !== 'online') {
      joinedKey.current = null
      clearJoinRetry()
      joinRetryAttempt.current = 0
      return
    }
    const key = `${runId}:${heroId}`
    if (joinedKey.current === key) return
    const existing = snapshot.nucleusState?.runId === runId
      ? snapshot.nucleusState.players.find((player) => player.id === snapshot.playerId)
      : undefined
    if (existing && existing.heroId !== heroId) client.leaveNucleus(runId)
    if (client.joinNucleus(runId, heroId)) {
      joinedKey.current = key
      clearJoinRetry()
      joinRetryTimer.current = setTimeout(() => {
        joinRetryTimer.current = null
        joinedKey.current = null
        setJoinAttemptNonce((current) => current + 1)
      }, JOIN_ACK_TIMEOUT_MS)
    }
  }, [
    clearJoinRetry,
    client,
    heroId,
    joinAttemptNonce,
    onlineIntent,
    runId,
    snapshot.nucleusState,
    snapshot.playerId,
    snapshot.status,
  ])

  useEffect(() => () => {
    if (!onlineIntent || !client || !runId) return
    joinedKey.current = null
    client.leaveNucleus(runId)
  }, [client, onlineIntent, runId])

  const matchingState = snapshot.nucleusState?.runId === runId ? snapshot.nucleusState : null
  const ready = onlineIntent && hasAcknowledgedNucleusJoin(matchingState, snapshot.playerId, heroId)
  const matchingEvents = useMemo(() => snapshot.nucleusEvents.filter((event) => event.runId === runId), [
    runId,
    snapshot.nucleusEvents,
  ])

  useEffect(() => {
    if (ready) {
      clearJoinRetry()
      joinRetryAttempt.current = 0
      return
    }
    if (snapshot.errorCode !== 'COMBAT_REJECTED' || joinedKey.current === null) return
    joinedKey.current = null
    clearJoinRetry()
    const attempt = joinRetryAttempt.current
    joinRetryAttempt.current += 1
    const delay = nucleusJoinRetryDelayMs(attempt)
    joinRetryTimer.current = setTimeout(() => {
      joinRetryTimer.current = null
      setJoinAttemptNonce((current) => current + 1)
    }, delay)
  }, [clearJoinRetry, ready, snapshot.errorCode, snapshot.revision])

  useEffect(() => () => clearJoinRetry(), [clearJoinRetry])

  const sendCast = useCallback((slot: NucleusAbilitySlot, aim: NucleusAimInput): string | null => {
    if (!client || !runId || !ready || matchingState?.phase !== 'active') return null
    return client.castNucleus(runId, slot, aim)
  }, [client, matchingState?.phase, ready, runId])

  const retryJoin = useCallback(() => {
    clearJoinRetry()
    joinRetryAttempt.current = 0
    joinedKey.current = null
    setJoinAttemptNonce((current) => current + 1)
  }, [clearJoinRetry])

  const leave = useCallback((): boolean => {
    clearJoinRetry()
    joinRetryAttempt.current = 0
    joinedKey.current = null
    return Boolean(client && runId && client.leaveNucleus(runId))
  }, [clearJoinRetry, client, runId])

  const getServerNow = useCallback(() => client?.getServerNow() ?? Date.now(), [client])
  const consumeCorrection = useCallback(() => client?.consumeAuthoritativeCorrection() ?? null, [client])

  return useMemo(() => ({
    mode: onlineIntent ? 'online' : 'solo',
    connectionStatus: snapshot.status,
    partyStatus: party.status,
    ready,
    joinError: !ready && onlineIntent ? snapshot.error : null,
    playerId: snapshot.playerId,
    runId,
    state: matchingState,
    events: matchingEvents,
    sendCast,
    retryJoin,
    leave,
    getServerNow,
    consumeCorrection,
    sampleRemote: party.sampleRemote,
  }), [
    consumeCorrection,
    getServerNow,
    leave,
    matchingEvents,
    matchingState,
    onlineIntent,
    party.status,
    party.sampleRemote,
    ready,
    retryJoin,
    runId,
    sendCast,
    snapshot.playerId,
    snapshot.error,
    snapshot.status,
  ])
}
