import { describe, expect, it, vi } from 'vitest'

import {
  calculateRsaVaultXp,
  evaluateRsaStage,
  RSA_STAGES,
  RSA_VAULT_CHALLENGES,
} from './rsaVaultLogic'
import { createRsaVaultStore } from './rsaVaultStore'
import type { RsaStage, RsaVaultInputs } from './types'

const EMPTY_INPUTS: RsaVaultInputs = {
  p: '',
  q: '',
  totient: '',
  privateExponent: '',
  message: '',
}

function correctInputs(stage: RsaStage, challengeIndex = 0): RsaVaultInputs {
  const challenge = RSA_VAULT_CHALLENGES[challengeIndex]
  const inputs = { ...EMPTY_INPUTS }

  if (stage === 'factor') {
    inputs.p = challenge.primeP.toString()
    inputs.q = challenge.primeQ.toString()
  } else if (stage === 'totient') {
    inputs.totient = challenge.totient.toString()
  } else if (stage === 'inverse') {
    inputs.privateExponent = challenge.privateExponent.toString()
  } else {
    inputs.message = challenge.message
  }

  return inputs
}

function solveCurrentVault(store: ReturnType<typeof createRsaVaultStore>): void {
  for (const stage of RSA_STAGES) {
    const challenge = store.getState().challenge
    const inputs = correctInputs(stage, challenge.level - 1)
    if (stage === 'factor') {
      store.getState().setInput('p', inputs.p)
      store.getState().setInput('q', inputs.q)
    } else if (stage === 'totient') {
      store.getState().setInput('totient', inputs.totient)
    } else if (stage === 'inverse') {
      store.getState().setInput('privateExponent', inputs.privateExponent)
    } else {
      store.getState().setInput('message', inputs.message)
    }

    expect(store.getState().submitStage()).toBe(true)
  }

  expect(store.getState().phase).toBe('unlocking')
  expect(store.getState().resolveVault()).toBe(true)
}

describe('RSA Vault gameplay', () => {
  it('factors the modulus with valid inputs, accepts swapped factors, and rejects invalid inputs', () => {
    const challenge = RSA_VAULT_CHALLENGES[0]

    expect(evaluateRsaStage(challenge, 'factor', {
      ...EMPTY_INPUTS,
      p: '3',
      q: '5',
    })).toMatchObject({ correct: true, malformed: false })

    expect(evaluateRsaStage(challenge, 'factor', {
      ...EMPTY_INPUTS,
      p: '5',
      q: '3',
    })).toMatchObject({ correct: true, malformed: false })

    expect(evaluateRsaStage(challenge, 'factor', {
      ...EMPTY_INPUTS,
      p: '4',
      q: '5',
    })).toMatchObject({ correct: false, malformed: false })

    for (const [p, q] of [['', '5'], ['1', '15'], ['3.5', '5'], ['-3', '5']]) {
      expect(evaluateRsaStage(challenge, 'factor', {
        ...EMPTY_INPUTS,
        p,
        q,
      })).toMatchObject({ correct: false, malformed: true })
    }
  })

  it('derives the private key and rejects malformed, incorrect, and non-canonical keys', () => {
    const challenge = RSA_VAULT_CHALLENGES[0]
    const validKey = evaluateRsaStage(challenge, 'inverse', {
      ...EMPTY_INPUTS,
      privateExponent: challenge.privateExponent.toString(),
    })

    expect(validKey).toMatchObject({ correct: true, malformed: false })

    expect(evaluateRsaStage(challenge, 'inverse', {
      ...EMPTY_INPUTS,
      privateExponent: (challenge.privateExponent + 1n).toString(),
    })).toMatchObject({ correct: false, malformed: false })

    expect(evaluateRsaStage(challenge, 'inverse', {
      ...EMPTY_INPUTS,
      privateExponent: (challenge.privateExponent + challenge.totient).toString(),
    })).toMatchObject({ correct: false, malformed: false })

    expect(evaluateRsaStage(challenge, 'inverse', {
      ...EMPTY_INPUTS,
      privateExponent: '3.5',
    })).toMatchObject({ correct: false, malformed: true })
  })

  it('completes a full run with deterministic score, XP, and exactly-once progression', () => {
    let clock = 5_000
    const recordProgress = vi.fn(() => true)
    const store = createRsaVaultStore({ now: () => clock, recordProgress })

    store.getState().start()
    expect(store.getState().startedAt).toBeNull()
    store.getState().skipTutorial()
    expect(store.getState().startedAt).toBe(5_000)

    for (let index = 0; index < RSA_VAULT_CHALLENGES.length; index += 1) {
      if (index === RSA_VAULT_CHALLENGES.length - 1) clock = 6_200
      solveCurrentVault(store)
      if (index < RSA_VAULT_CHALLENGES.length - 1) {
        expect(store.getState().phase).toBe('vault-open')
        expect(store.getState().nextVault()).toBe(true)
      }
    }

    const { result, score, phase } = store.getState()
    expect(phase).toBe('complete')
    expect(result).toMatchObject({
      attempts: 16,
      mistakes: 0,
      elapsedMs: 1_200,
      isNewBest: true,
    })
    expect(result?.score).toBe(score)
    expect(result?.xp).toBe(calculateRsaVaultXp(score, 0))
    expect(result?.vaults).toHaveLength(RSA_VAULT_CHALLENGES.length)
    expect(recordProgress).toHaveBeenCalledOnce()
    expect(recordProgress).toHaveBeenCalledWith({ score, xp: result?.xp })

    expect(store.getState().resolveVault()).toBe(false)
    expect(recordProgress).toHaveBeenCalledOnce()
  })

  it('does not count tutorial time and clamps negative elapsed time to zero', () => {
    let clock = 9_000
    const store = createRsaVaultStore({
      now: () => clock,
      recordProgress: () => false,
    })

    store.getState().start()
    for (let step = 1; step < 7; step += 1) store.getState().nextTutorialStep()
    expect(store.getState().startedAt).toBeNull()

    store.getState().nextTutorialStep()
    expect(store.getState().startedAt).toBe(9_000)
    clock = 8_000

    for (let index = 0; index < RSA_VAULT_CHALLENGES.length; index += 1) {
      solveCurrentVault(store)
      if (index < RSA_VAULT_CHALLENGES.length - 1) store.getState().nextVault()
    }

    expect(store.getState().result?.elapsedMs).toBe(0)
    expect(store.getState().completedAt).toBe(8_000)
  })

  it('clears the telemetry clock when a run is restarted', () => {
    let clock = 12_000
    const store = createRsaVaultStore({ now: () => clock })

    store.getState().start()
    store.getState().skipTutorial()
    expect(store.getState().startedAt).toBe(12_000)

    clock = 13_000
    store.getState().restart()
    expect(store.getState()).toMatchObject({
      phase: 'playing',
      startedAt: null,
      completedAt: null,
      attempts: 0,
      mistakes: 0,
      score: 0,
    })
  })
})
