import { describe, expect, it, vi } from 'vitest'

import {
  calculatePublicValue,
  calculateSharedSecret,
} from './diffieHellmanLogic'
import { createDiffieHellmanStore } from './diffieHellmanStore'

function solveCurrentRound(store: ReturnType<typeof createDiffieHellmanStore>): void {
  const initial = store.getState()
  const privateExponent = initial.challenge.privateOptions[0]
  initial.selectPrivateExponent(privateExponent)
  store.getState().setPublicGuess(String(calculatePublicValue(initial.challenge, privateExponent)))
  expect(store.getState().submitPublicValue()).toBe(true)
  expect(store.getState().resolvePublicTransit()).toBe(true)
  store.getState().setSecretGuess(String(calculateSharedSecret(initial.challenge, privateExponent)))
  expect(store.getState().submitSharedSecret()).toBe(true)
  expect(store.getState().resolveSecretTransit()).toBe(true)
}

describe('Diffie-Hellman Relay store', () => {
  it('moves through the public and private calculations without leaking the secret packet', () => {
    const store = createDiffieHellmanStore({ now: () => 1_000, recordProgress: () => false })
    store.getState().start()
    const challenge = store.getState().challenge
    const selected = challenge.privateOptions[1]

    expect(store.getState().selectPrivateExponent(selected)).toBe(true)
    expect(store.getState().phase).toBe('calculate-public')

    store.getState().setPublicGuess(String(calculatePublicValue(challenge, selected)))
    expect(store.getState().submitPublicValue()).toBe(true)
    expect(store.getState().pendingPacket).toMatchObject({
      kind: 'public',
      visibleToEve: true,
    })

    store.getState().resolvePublicTransit()
    store.getState().setSecretGuess(String(calculateSharedSecret(challenge, selected)))
    expect(store.getState().submitSharedSecret()).toBe(true)
    expect(store.getState().pendingPacket).toEqual(expect.objectContaining({
      kind: 'confirmation',
      label: 'CANAL CONFIRMADO',
    }))
    expect(store.getState().pendingPacket?.label).not.toContain(
      String(calculateSharedSecret(challenge, selected)),
    )
  })

  it('rejects wrong and malformed answers while tracking mistakes', () => {
    const store = createDiffieHellmanStore({ recordProgress: () => false })
    store.getState().start()
    store.getState().selectPrivateExponent(store.getState().challenge.privateOptions[0])
    store.getState().setPublicGuess('-1')

    expect(store.getState().submitPublicValue()).toBe(false)
    expect(store.getState()).toMatchObject({ attempts: 1, mistakes: 1, phase: 'calculate-public' })
  })

  it('completes all four transmissions and records progress once', () => {
    let clock = 10_000
    const recordProgress = vi.fn(() => true)
    const store = createDiffieHellmanStore({ now: () => clock, recordProgress })
    store.getState().start()

    for (let round = 0; round < 4; round += 1) {
      solveCurrentRound(store)
      if (round < 3) expect(store.getState().nextRound()).toBe(true)
      clock += 4_000
    }

    expect(store.getState().phase).toBe('complete')
    expect(store.getState().transmissions).toHaveLength(4)
    expect(store.getState().result).toMatchObject({
      mistakes: 0,
      isNewBest: true,
    })
    expect(recordProgress).toHaveBeenCalledTimes(1)
  })

  it('restarts with a clean run and ignores stale phase actions', () => {
    const store = createDiffieHellmanStore({ now: () => 50, recordProgress: () => false })
    expect(store.getState().submitPublicValue()).toBe(false)
    store.getState().start()
    store.getState().selectPrivateExponent(store.getState().challenge.privateOptions[0])
    store.getState().restart()

    expect(store.getState()).toMatchObject({
      phase: 'select-private',
      privateExponent: null,
      attempts: 0,
      mistakes: 0,
      score: 0,
    })
  })

  it('still completes when progression persistence is unavailable', () => {
    const store = createDiffieHellmanStore({
      now: () => 100,
      recordProgress: () => { throw new Error('storage blocked') },
    })
    store.getState().start()

    for (let round = 0; round < 4; round += 1) {
      solveCurrentRound(store)
      if (round < 3) store.getState().nextRound()
    }

    expect(store.getState().phase).toBe('complete')
    expect(store.getState().result?.isNewBest).toBe(false)
  })
})
