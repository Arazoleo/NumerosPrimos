import { describe, expect, it, vi } from 'vitest'

import {
  calculatePublicValue,
  calculateSharedSecret,
} from './diffieHellmanLogic'
import { createDiffieHellmanStore } from './diffieHellmanStore'
import { DIFFIE_HELLMAN_TUTORIAL_STEPS } from './diffieHellmanTutorialCopy'

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
  it('keeps gameplay actions inactive during every tutorial step', () => {
    const now = vi.fn(() => 1_000)
    const recordProgress = vi.fn(() => false)
    const store = createDiffieHellmanStore({ now, recordProgress })
    store.getState().startTutorial()

    for (const step of DIFFIE_HELLMAN_TUTORIAL_STEPS) {
      const state = store.getState()
      expect(state).toMatchObject({
        phase: 'tutorial',
        tutorialStep: step,
        startedAt: null,
        runId: 0,
        score: 0,
        attempts: 0,
        mistakes: 0,
        pendingPacket: null,
        transmissions: [],
        result: null,
      })

      expect(state.selectPrivateExponent(state.challenge.privateOptions[0])).toBe(false)
      state.setPublicGuess('4')
      state.setSecretGuess('4')
      expect(state.submitPublicValue()).toBe(false)
      expect(state.resolvePublicTransit()).toBe(false)
      expect(state.submitSharedSecret()).toBe(false)
      expect(state.resolveSecretTransit()).toBe(false)
      expect(state.nextRound()).toBe(false)
      expect(store.getState()).toBe(state)
      expect(now).not.toHaveBeenCalled()
      expect(recordProgress).not.toHaveBeenCalled()

      store.getState().nextTutorialStep()
    }

    expect(store.getState()).toMatchObject({
      phase: 'select-private',
      tutorialStep: 0,
      startedAt: 1_000,
      runId: 1,
    })
    expect(recordProgress).not.toHaveBeenCalled()
  })

  it.each(['finish', 'skip'] as const)('excludes tutorial time from the result when players %s', (action) => {
    let clock = 1_000
    const recordProgress = vi.fn(() => false)
    const store = createDiffieHellmanStore({ now: () => clock, recordProgress })
    store.getState().startTutorial()
    clock += 600_000

    if (action === 'finish') {
      for (const _step of DIFFIE_HELLMAN_TUTORIAL_STEPS) {
        store.getState().nextTutorialStep()
      }
    } else {
      store.getState().nextTutorialStep()
      store.getState().skipTutorial()
    }

    expect(store.getState()).toMatchObject({
      phase: 'select-private',
      tutorialStep: 0,
      startedAt: clock,
      runId: 1,
    })
    expect(recordProgress).not.toHaveBeenCalled()

    for (let round = 0; round < 4; round += 1) {
      clock += 1_000
      solveCurrentRound(store)
      if (round < 3) store.getState().nextRound()
    }

    expect(store.getState().result).toMatchObject({ elapsedMs: 4_000, score: 6_700 })
    expect(recordProgress).toHaveBeenCalledTimes(1)
  })

  it('clears a previous run when opening the tutorial', () => {
    const recordProgress = vi.fn(() => false)
    const store = createDiffieHellmanStore({ recordProgress })
    store.getState().start()
    solveCurrentRound(store)
    store.getState().nextRound()
    const state = store.getState()
    state.selectPrivateExponent(state.challenge.privateOptions[0])
    store.getState().setPublicGuess('-1')
    store.getState().submitPublicValue()
    store.getState().setPublicGuess(String(calculatePublicValue(state.challenge, state.challenge.privateOptions[0])))
    store.getState().submitPublicValue()
    expect(store.getState().pendingPacket).not.toBeNull()

    store.getState().startTutorial()

    expect(store.getState()).toMatchObject({
      phase: 'tutorial',
      tutorialStep: 1,
      runId: 1,
      roundIndex: 0,
      challenge: { round: 1 },
      privateExponent: null,
      publicGuess: '',
      publicValue: null,
      secretGuess: '',
      sharedSecret: null,
      attempts: 0,
      roundAttempts: 0,
      mistakes: 0,
      roundMistakes: 0,
      score: 0,
      startedAt: null,
      completedAt: null,
      packetSequence: 0,
      pendingPacket: null,
      feedback: null,
      lastSound: null,
      transmissions: [],
      result: null,
    })
    expect(store.getState().resolvePublicTransit()).toBe(false)
    expect(recordProgress).not.toHaveBeenCalled()
  })

  it.each(['start', 'restart', 'returnToIntro'] as const)('clears the tutorial on %s and ignores stale navigation', (action) => {
    const store = createDiffieHellmanStore({ now: () => 1_000, recordProgress: () => false })
    const initial = store.getState()
    initial.nextTutorialStep()
    initial.skipTutorial()
    expect(store.getState()).toBe(initial)

    store.getState().startTutorial()
    store.getState().nextTutorialStep()
    store.getState()[action]()

    const state = store.getState()
    expect(state).toMatchObject({
      phase: action === 'returnToIntro' ? 'intro' : 'select-private',
      tutorialStep: 0,
      startedAt: action === 'returnToIntro' ? null : 1_000,
    })
    state.nextTutorialStep()
    state.skipTutorial()
    expect(store.getState()).toBe(state)

    state.startTutorial()
    expect(store.getState()).toMatchObject({ phase: 'tutorial', tutorialStep: 1, startedAt: null })
  })

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
