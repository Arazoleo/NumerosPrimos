import { describe, expect, it } from 'vitest'

import { deriveExpeditionPartyStatus, filterExpeditionPeers, hasExpeditionActivityAck } from './partyLogic'

const RUN = 'run:primeverse-001:ulam-rift' as const

describe('expedition party scoping', () => {
  it('requires the authoritative activity and run acknowledgement', () => {
    const base = {
      hasIdentity: true,
      hasClient: true,
      connectionStatus: 'online' as const,
      targetActivityId: 'ulam-rift' as const,
      currentActivityId: 'ulam-rift' as const,
      currentRunId: RUN,
    }
    expect(hasExpeditionActivityAck(base)).toBe(true)
    expect(hasExpeditionActivityAck({ ...base, currentActivityId: 'nexus', currentRunId: null })).toBe(false)
    expect(hasExpeditionActivityAck({ ...base, connectionStatus: 'reconnecting' })).toBe(false)
  })

  it('keeps missing sessions solo and reports transient network states', () => {
    const base = {
      hasIdentity: false,
      hasClient: false,
      connectionStatus: 'idle' as const,
      targetActivityId: 'ulam-rift' as const,
      currentActivityId: 'nexus' as const,
      currentRunId: null,
    }
    expect(deriveExpeditionPartyStatus(base)).toBe('solo')
    expect(deriveExpeditionPartyStatus({ ...base, hasIdentity: true, hasClient: true })).toBe('joining')
    expect(deriveExpeditionPartyStatus({ ...base, hasIdentity: true, hasClient: true, connectionStatus: 'reconnecting' })).toBe('reconnecting')
    expect(deriveExpeditionPartyStatus({ ...base, hasIdentity: true, hasClient: true, connectionStatus: 'offline' })).toBe('offline')
    expect(deriveExpeditionPartyStatus({ ...base, hasIdentity: true, hasClient: true, connectionStatus: 'online', error: 'Chegue perto do portal.' })).toBe('blocked')
  })

  it('filters out other activities, runs and the local player', () => {
    const peers = [
      { id: 'local', activityId: 'ulam-rift' as const, runId: RUN },
      { id: 'same-run', activityId: 'ulam-rift' as const, runId: RUN },
      { id: 'other-run', activityId: 'ulam-rift' as const, runId: 'run:another:ulam-rift' as const },
      { id: 'nexus', activityId: 'nexus' as const, runId: null },
      { id: 'siege', activityId: 'euclid-siege' as const, runId: 'run:primeverse-001:euclid-siege' as const },
    ]
    expect(filterExpeditionPeers(peers, 'ulam-rift', RUN, 'local').map((peer) => peer.id)).toEqual(['same-run'])
    expect(filterExpeditionPeers(peers, 'ulam-rift', null, 'local')).toEqual([])
  })
})
