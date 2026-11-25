import { describe, expect, it, vi } from 'vitest'

import { PRIMEVERSE_ONLINE_XP, createPrimeverseOnlineProgressRecorder } from './progressionAdapter'

function setup() {
  const writer = { awardXp: vi.fn() }
  return { writer, record: createPrimeverseOnlineProgressRecorder(() => writer) }
}

describe('primeverse online progression', () => {
  it('awards a vote only once per round', () => {
    const { writer, record } = setup()
    expect(record.recordVote(3)).toBe(true)
    expect(record.recordVote(3)).toBe(false)
    expect(record.recordVote(4)).toBe(true)
    expect(writer.awardXp).toHaveBeenCalledTimes(2)
    expect(writer.awardXp).toHaveBeenCalledWith(PRIMEVERSE_ONLINE_XP.vote)
  })

  it('awards a successful round once, including players who voted for a losing choice', () => {
    const { writer, record } = setup()
    const round = { round: 2, success: true, playerId: 'me', votesByPlayer: { me: 15, other: 13, third: 13 } } as const
    expect(record.recordSequenceRound(round)).toBe(true)
    expect(record.recordSequenceRound(round)).toBe(false)
    expect(writer.awardXp).toHaveBeenCalledOnce()
    expect(writer.awardXp).toHaveBeenCalledWith(PRIMEVERSE_ONLINE_XP.round)
  })

  it('does not award failed rounds or rounds the player did not vote in', () => {
    const { writer, record } = setup()
    expect(record.recordSequenceRound({ round: 1, success: false, playerId: 'me', votesByPlayer: { me: 12 } })).toBe(false)
    expect(record.recordSequenceRound({ round: 1, success: true, playerId: 'me', votesByPlayer: { other: 13 } })).toBe(false)
    expect(writer.awardXp).not.toHaveBeenCalled()
  })

  it('awards each secret once, however often it is revisited', () => {
    const { writer, record } = setup()
    expect(record.recordSecret('secret-997')).toBe(true)
    expect(record.recordSecret('secret-997')).toBe(false)
    expect(record.recordSecret('secret-mersenne')).toBe(true)
    expect(record.recordSecret('secret-constellation')).toBe(true)
    expect(record.recordSecret('secret-constellation')).toBe(false)
    expect(record.recordSecret('unknown')).toBe(false)
    expect(writer.awardXp).toHaveBeenCalledTimes(3)
    expect(writer.awardXp).toHaveBeenCalledWith(PRIMEVERSE_ONLINE_XP.secret)
  })
})
