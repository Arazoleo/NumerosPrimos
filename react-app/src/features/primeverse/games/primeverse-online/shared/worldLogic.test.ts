import { describe, expect, it } from 'vitest'

import type { PlayerSnapshot, PrimeSequenceChoice } from './protocol'
import {
  PRIME_CORE_POSITION,
  PRIME_SEQUENCE_COOLDOWN_MS,
  PRIME_SEQUENCE_REVEAL_DURATION_MS,
  PRIME_SEQUENCE_VOTE_DURATION_MS,
  advancePrimeSequence,
  assignPlayerToRoom,
  calculatePrimeCoreState,
  castPrimeSequenceVote,
  createPrimeSequenceState,
  createRoomRegistry,
  removePlayerFromRooms,
  removePrimeSequenceVoter,
  roomSummaries,
  selectRoom,
} from './worldLogic'

function nearbyPlayer(id: string, x: number): Pick<PlayerSnapshot, 'id' | 'position'> {
  return { id, position: { x, y: PRIME_CORE_POSITION.y, z: 0 } }
}

describe('Prime Core synchronized proximity state', () => {
  it('moves through the defined energy bands by unique nearby players', () => {
    expect(calculatePrimeCoreState([])).toMatchObject({
      nearbyPlayers: 0,
      energyLevel: 'dormant',
    })
    expect(calculatePrimeCoreState([nearbyPlayer('a', 1)])).toMatchObject({
      nearbyPlayers: 1,
      energyLevel: 'awakened',
    })
    expect(calculatePrimeCoreState([
      nearbyPlayer('a', 1),
      nearbyPlayer('b', 2),
    ])).toMatchObject({ nearbyPlayers: 2, energyLevel: 'resonant' })
    expect(calculatePrimeCoreState([
      nearbyPlayer('a', 1), nearbyPlayer('b', 2), nearbyPlayer('c', 3),
    ])).toMatchObject({ nearbyPlayers: 3, energyLevel: 'accelerated' })
    expect(calculatePrimeCoreState([
      nearbyPlayer('a', 1), nearbyPlayer('b', 2), nearbyPlayer('c', 3),
      nearbyPlayer('d', 4), nearbyPlayer('e', 5),
    ])).toMatchObject({ nearbyPlayers: 5, energyLevel: 'overcharged' })
  })

  it('uses a closed radius and ignores far-away or duplicated players', () => {
    expect(calculatePrimeCoreState([
      nearbyPlayer('edge', 11),
      nearbyPlayer('edge', 1),
      nearbyPlayer('far', 11.01),
    ])).toMatchObject({ nearbyPlayers: 1, energyLevel: 'awakened' })
    expect(() => calculatePrimeCoreState([], PRIME_CORE_POSITION, 0)).toThrow(RangeError)
  })
})

describe('Primeverse room capacity and disconnect cleanup', () => {
  it('chooses the first numbered room with space deterministically', () => {
    const rooms = [
      { id: 'primeverse-3', playerCount: 1 },
      { id: 'primeverse-1', playerCount: 20 },
      { id: 'primeverse-2', playerCount: 19 },
    ]
    expect(selectRoom(rooms)).toBe('primeverse-2')
    expect(selectRoom(rooms, 'primeverse', 19)).toBe('primeverse-3')
    expect(selectRoom([
      { id: 'primeverse-1', playerCount: 20 },
      { id: 'primeverse-2', playerCount: 20 },
      { id: 'primeverse-3', playerCount: 20 },
    ])).toBe('primeverse-4')
  })

  it('places player 21 in room two and never exceeds capacity 20', () => {
    let registry = createRoomRegistry()
    for (let index = 1; index <= 21; index += 1) {
      registry = assignPlayerToRoom(registry, `player-${index}`).registry
    }
    expect(roomSummaries(registry)).toEqual([
      { id: 'primeverse-1', playerCount: 20 },
      { id: 'primeverse-2', playerCount: 1 },
    ])

    const duplicate = assignPlayerToRoom(registry, 'player-21')
    expect(duplicate.joined).toBe(false)
    expect(duplicate.roomId).toBe('primeverse-2')
  })

  it('removes disconnected players and deletes empty rooms', () => {
    const assigned = assignPlayerToRoom(createRoomRegistry(), 'ghost')
    const removed = removePlayerFromRooms(assigned.registry, 'ghost')
    expect(removed).toMatchObject({ roomId: 'primeverse-1', removed: true })
    expect(removed.registry.rooms).toEqual({})
    expect(removePlayerFromRooms(removed.registry, 'missing')).toMatchObject({
      roomId: null,
      removed: false,
    })
  })
})

describe('cooperative Prime Sequence Event', () => {
  function vote(
    state: ReturnType<typeof createPrimeSequenceState>,
    playerId: string,
    choice: PrimeSequenceChoice,
    at: number,
  ) {
    return castPrimeSequenceVote(state, playerId, choice, at)
  }

  it('starts from a physical vote and keeps each player vote idempotent', () => {
    const first = vote(createPrimeSequenceState(), 'ana', 13, 1_000)
    expect(first.accepted).toBe(true)
    expect(first.state).toMatchObject({
      round: 1,
      phase: 'voting',
      totalVotes: 1,
      voteCounts: { 12: 0, 13: 1, 15: 0, 17: 0 },
    })
    expect(first.events.map((event) => event.kind)).toEqual([
      'sequence_started',
      'sequence_vote',
    ])

    const duplicate = vote(first.state, 'ana', 17, 1_100)
    expect(duplicate).toMatchObject({ accepted: false, reason: 'already_voted' })
    expect(duplicate.state.voteCounts).toEqual(first.state.voteCounts)
  })

  it('reveals 13 and emits the world-wide prime wave only for a majority', () => {
    let state = createPrimeSequenceState()
    state = vote(state, 'ana', 13, 1_000).state
    state = vote(state, 'leo', 13, 1_100).state
    state = vote(state, 'gauss', 17, 1_200).state

    const revealed = advancePrimeSequence(state, 1_000 + PRIME_SEQUENCE_VOTE_DURATION_MS)
    expect(revealed.state).toMatchObject({
      phase: 'revealed',
      winningChoice: 13,
      revealedAnswer: 13,
      success: true,
    })
    expect(revealed.events[0]).toMatchObject({
      kind: 'sequence_revealed',
      answer: 13,
      effect: 'prime-wave',
    })

    const cooldown = advancePrimeSequence(
      revealed.state,
      1_000 + PRIME_SEQUENCE_VOTE_DURATION_MS + PRIME_SEQUENCE_REVEAL_DURATION_MS,
    )
    expect(cooldown.state.phase).toBe('cooldown')
    const reset = advancePrimeSequence(
      cooldown.state,
      1_000 + PRIME_SEQUENCE_VOTE_DURATION_MS
        + PRIME_SEQUENCE_REVEAL_DURATION_MS + PRIME_SEQUENCE_COOLDOWN_MS,
    )
    expect(reset.state).toEqual(createPrimeSequenceState(1))
  })

  it('fails a tie and removes a disconnected player pending vote', () => {
    let state = vote(createPrimeSequenceState(), 'ana', 13, 5_000).state
    state = vote(state, 'leo', 17, 5_100).state
    const withoutGhost = removePrimeSequenceVoter(state, 'leo')
    expect(withoutGhost).toMatchObject({ totalVotes: 1, voteCounts: { 13: 1, 17: 0 } })

    const tiedAgain = vote(withoutGhost, 'gauss', 17, 5_200).state
    const revealed = advancePrimeSequence(
      tiedAgain,
      5_000 + PRIME_SEQUENCE_VOTE_DURATION_MS,
    )
    expect(revealed.state).toMatchObject({
      winningChoice: 13,
      success: false,
    })
    expect(revealed.events[0]).toMatchObject({ effect: null })
  })

  it('closes voting at the exact deadline', () => {
    const first = vote(createPrimeSequenceState(), 'ana', 13, 100)
    const late = vote(first.state, 'leo', 13, 100 + PRIME_SEQUENCE_VOTE_DURATION_MS)
    expect(late).toMatchObject({ accepted: false, reason: 'vote_closed' })
  })
})
