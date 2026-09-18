import { describe, expect, it, vi } from 'vitest'

import { RSA_STAGES, RSA_VAULT_CHALLENGES } from './rsaVaultLogic'
import { createRsaVaultStore } from './rsaVaultStore'
import type { RsaStage } from './types'

function createTestStore(now = () => 1_000) {
  const recordProgress = vi.fn(() => true)
  const store = createRsaVaultStore({ now, recordProgress })
  return { store, recordProgress }
}

function fillCorrectStage(
  store: ReturnType<typeof createRsaVaultStore>,
  stage: RsaStage,
): void {
  const challenge = store.getState().challenge
  if (stage === 'factor') {
    store.getState().setInput('p', challenge.primeP.toString())
    store.getState().setInput('q', challenge.primeQ.toString())
  } else if (stage === 'totient') {
    store.getState().setInput('totient', challenge.totient.toString())
  } else if (stage === 'inverse') {
    store.getState().setInput('privateExponent', challenge.privateExponent.toString())
  } else {
    store.getState().setInput('message', challenge.message)
  }
}

function solveCurrentVault(store: ReturnType<typeof createRsaVaultStore>): void {
  for (const stage of RSA_STAGES) {
    expect(store.getState().stage).toBe(stage)
    fillCorrectStage(store, stage)
    expect(store.getState().submitStage()).toBe(true)
  }
  expect(store.getState().phase).toBe('unlocking')
  expect(store.getState().resolveVault()).toBe(true)
}

describe('RSA Vault store', () => {
  it('moves through the four mathematical stages in order', () => {
    const { store } = createTestStore()
    store.getState().start()

    expect(store.getState()).toMatchObject({
      phase: 'playing',
      isTutorialActive: true,
      tutorialStep: 1,
    })

    store.getState().skipTutorial()

    fillCorrectStage(store, 'factor')
    store.getState().submitStage()
    expect(store.getState()).toMatchObject({
      phase: 'playing',
      stage: 'totient',
      completedStages: ['factor'],
      attempts: 1,
      mistakes: 0,
    })

    fillCorrectStage(store, 'totient')
    store.getState().submitStage()
    expect(store.getState().stage).toBe('inverse')
  })

  it('keeps the current stage and penalizes an incorrect submission', () => {
    const { store } = createTestStore()
    store.getState().start()

    store.getState().skipTutorial()

    store.getState().setInput('p', '2')
    store.getState().setInput('q', '7')

    expect(store.getState().submitStage()).toBe(false)
    expect(store.getState()).toMatchObject({
      phase: 'playing',
      stage: 'factor',
      attempts: 1,
      mistakes: 1,
      stageAttempts: 1,
      roundMistakes: 1,
    })
    expect(store.getState().lastSound?.event).toBe('error')
  })

  it('opens all vaults and records progression exactly once', () => {
    let clock = 5_000
    const { store, recordProgress } = createTestStore(() => clock)
    store.getState().start()

    store.getState().skipTutorial()

    for (let index = 0; index < RSA_VAULT_CHALLENGES.length; index += 1) {
      solveCurrentVault(store)
      clock += 400
      if (index < RSA_VAULT_CHALLENGES.length - 1) {
        expect(store.getState().phase).toBe('vault-open')
        expect(store.getState().nextVault()).toBe(true)
      }
    }

    const state = store.getState()
    expect(state.phase).toBe('complete')
    expect(state.roundResults).toHaveLength(4)
    expect(state.result).toMatchObject({
      attempts: 16,
      mistakes: 0,
      elapsedMs: 1_200,
      isNewBest: true,
    })
    expect(state.result?.score).toBe(state.score)
    expect(state.result?.xp).toBeGreaterThan(0)
    expect(recordProgress).toHaveBeenCalledOnce()

    expect(store.getState().resolveVault()).toBe(false)
    expect(recordProgress).toHaveBeenCalledOnce()
  })

  it('does not let input or stage actions mutate modal phases', () => {
    const { store } = createTestStore()
    store.getState().setInput('p', '3')
    expect(store.getState().inputs.p).toBe('')
    expect(store.getState().submitStage()).toBe(false)
    expect(store.getState().nextVault()).toBe(false)
  })

  it('restarts with a clean run and a new start time', () => {
    let clock = 100
    const { store } = createTestStore(() => clock)
    store.getState().start()
    store.getState().setInput('p', '2')
    store.getState().setInput('q', '2')
    store.getState().submitStage()

    clock = 900
    store.getState().restart()
    expect(store.getState()).toMatchObject({
      phase: 'playing',
      runId: 2,
      vaultIndex: 0,
      attempts: 0,
      mistakes: 0,
      score: 0,
      startedAt: 900,
    })
  })

  it('rejects an invalid challenge pack at construction', () => {
    expect(() => createRsaVaultStore({
      challenges: RSA_VAULT_CHALLENGES.slice(0, 3),
    })).toThrow(/four ordered/)
  })

  it('advances and closes the tutorial without touching the RSA run', () => {
    const { store, recordProgress } = createTestStore()
    store.getState().start()
    const before = store.getState()

    for (let step = 1; step < 7; step += 1) {
      store.getState().nextTutorialStep()
      expect(store.getState().tutorialStep).toBe(step + 1)
      expect(store.getState().isTutorialActive).toBe(true)
    }

    store.getState().nextTutorialStep()
    const after = store.getState()
    expect(after.isTutorialActive).toBe(false)
    expect(after.tutorialStep).toBe(0)
    expect(after.inputs).toBe(before.inputs)
    expect(after.attempts).toBe(0)
    expect(after.score).toBe(0)
    expect(recordProgress).not.toHaveBeenCalled()
  })

  it('skips and restarts the tutorial without changing puzzle progress', () => {
    let clock = 1_000
    const { store } = createTestStore(() => clock)
    store.getState().start()
    store.getState().nextTutorialStep()
    store.getState().skipTutorial()

    expect(store.getState()).toMatchObject({
      isTutorialActive: false,
      tutorialStep: 0,
      attempts: 0,
      score: 0,
    })

    clock = 2_000
    store.getState().restart()
    expect(store.getState()).toMatchObject({
      isTutorialActive: true,
      tutorialStep: 1,
      attempts: 0,
      score: 0,
      startedAt: 2_000,
    })
  })

  it('does not submit a stage while the tutorial is active', () => {
    const { store } = createTestStore()
    store.getState().start()
    store.getState().setInput('p', '3')
    store.getState().setInput('q', '5')

    expect(store.getState().submitStage()).toBe(false)
    expect(store.getState()).toMatchObject({
      stage: 'factor',
      attempts: 0,
      mistakes: 0,
      completedStages: [],
    })
  })

  it('clears tutorial state when returning to the intro', () => {
    const { store } = createTestStore()
    store.getState().start()
    store.getState().nextTutorialStep()
    store.getState().returnToIntro()

    expect(store.getState()).toMatchObject({
      phase: 'intro',
      isTutorialActive: false,
      tutorialStep: 0,
    })
  })

  it('does not change tutorial state when advancing while inactive', () => {
    const { store } = createTestStore()
    store.getState().nextTutorialStep()

    expect(store.getState()).toMatchObject({
      isTutorialActive: false,
      tutorialStep: 0,
    })
  })

  it('keeps the RSA run unchanged when a guided click is represented', () => {
    const { store } = createTestStore()
    store.getState().start()
    const before = store.getState()

    expect(store.getState().submitStage()).toBe(false)
    expect(store.getState()).toMatchObject({
      phase: 'playing',
      isTutorialActive: true,
      tutorialStep: 1,
      inputs: before.inputs,
      attempts: 0,
      mistakes: 0,
      score: 0,
      completedStages: [],
    })
  })

})
