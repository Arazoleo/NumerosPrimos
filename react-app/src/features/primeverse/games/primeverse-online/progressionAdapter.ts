import { useProgressionStore } from '../../../../progression/progressionStore'

import { isDiscoveryId } from './discovery/discoveryProgress'
import type { PrimeSequenceVotes } from './shared/protocol'

export const PRIMEVERSE_ONLINE_GAME_ID = 'primeverse-online'

export const PRIMEVERSE_ONLINE_XP = {
  vote: 5,
  round: 25,
  secret: 50,
} as const

export interface PrimeverseOnlineProgressionWriter {
  awardXp(amount: number): unknown
}

export interface SequenceRoundInput {
  readonly round: number
  readonly success: boolean
  readonly playerId: string
  readonly votesByPlayer: PrimeSequenceVotes
}

export interface PrimeverseOnlineProgressRecorder {
  recordVote(round: number): boolean
  recordSequenceRound(input: SequenceRoundInput): boolean
  recordSecret(id: string): boolean
}

function assertRound(round: number): void {
  if (!Number.isSafeInteger(round) || round < 0) {
    throw new RangeError('round must be a non-negative safe integer')
  }
}

/**
 * Each event grants XP at most once per recorder: votes and rounds by round
 * number, secrets by secret id. A round pays every participant (anyone with a
 * vote in it), not only those who picked the winning choice.
 */
export function createPrimeverseOnlineProgressRecorder(
  getProgression: () => PrimeverseOnlineProgressionWriter = () => useProgressionStore.getState(),
): PrimeverseOnlineProgressRecorder {
  const votedRounds = new Set<number>()
  const rewardedRounds = new Set<number>()
  const foundSecrets = new Set<string>()

  return {
    recordVote(round) {
      assertRound(round)
      if (votedRounds.has(round)) return false
      getProgression().awardXp(PRIMEVERSE_ONLINE_XP.vote)
      votedRounds.add(round)
      return true
    },
    recordSequenceRound({ round, success, playerId, votesByPlayer }) {
      assertRound(round)
      if (!success || votesByPlayer[playerId] === undefined || rewardedRounds.has(round)) return false
      getProgression().awardXp(PRIMEVERSE_ONLINE_XP.round)
      rewardedRounds.add(round)
      return true
    },
    recordSecret(id) {
      if (!isDiscoveryId(id) || foundSecrets.has(id)) return false
      getProgression().awardXp(PRIMEVERSE_ONLINE_XP.secret)
      foundSecrets.add(id)
      return true
    },
  }
}

export const primeverseOnlineProgress = createPrimeverseOnlineProgressRecorder()
