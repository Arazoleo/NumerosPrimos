import { describe, expect, it, vi } from 'vitest'

import { RSA_STAGES, RSA_VAULT_CHALLENGES } from './rsaVaultLogic'
import { createRsaVaultStore } from './rsaVaultStore'
import { getRsaPracticeStep } from './rsaVaultTutorial'
import { RSA_TUTORIAL_LAST_STEP, type RsaStage } from './types'

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

function enterGuidedPractice(store: ReturnType<typeof createRsaVaultStore>): void {
  store.getState().start()
  for (let step = 1; step < getRsaPracticeStep('factor'); step += 1) store.getState().nextTutorialStep()
  expect(store.getState().tutorialStep).toBe(getRsaPracticeStep('factor'))
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
    const clock = 100
    const { store } = createTestStore(() => clock)
    store.getState().start()
    store.getState().setInput('p', '2')
    store.getState().setInput('q', '2')
    store.getState().submitStage()

    store.getState().restart()
    expect(store.getState()).toMatchObject({
      phase: 'playing',
      runId: 2,
      vaultIndex: 0,
      attempts: 0,
      mistakes: 0,
      score: 0,
      startedAt: null,
    })
  })

  it('rejects an invalid challenge pack at construction', () => {
    expect(() => createRsaVaultStore({
      challenges: RSA_VAULT_CHALLENGES.slice(0, 3),
    })).toThrow(/four ordered/)
  })

  it('advances the presentation into guided practice without answering the puzzle', () => {
    const { store, recordProgress } = createTestStore()
    store.getState().start()
    const before = store.getState()

    for (let step = 1; step < getRsaPracticeStep('factor'); step += 1) {
      store.getState().nextTutorialStep()
      expect(store.getState().tutorialStep).toBe(step + 1)
      expect(store.getState().isTutorialActive).toBe(true)
    }

    store.getState().nextTutorialStep()
    const after = store.getState()
    expect(after.isTutorialActive).toBe(true)
    expect(after.tutorialStep).toBe(getRsaPracticeStep('factor'))
    expect(after.inputs).toBe(before.inputs)
    expect(after.attempts).toBe(0)
    expect(after.score).toBe(0)
    expect(recordProgress).not.toHaveBeenCalled()
  })

  it('skips and restarts the tutorial without changing puzzle progress', () => {
    const clock = 1_000
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

    store.getState().restart()
    expect(store.getState()).toMatchObject({
      isTutorialActive: true,
      tutorialStep: 1,
      attempts: 0,
      score: 0,
      startedAt: null,
    })
  })

  it('does not submit a stage during the interface presentation', () => {
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

  it('guides all four stages and finishes only when the first vault opens', () => {
    const { store, recordProgress } = createTestStore()
    enterGuidedPractice(store)

    for (const [index, stage] of RSA_STAGES.entries()) {
      expect(store.getState()).toMatchObject({ stage, tutorialStep: getRsaPracticeStep(stage), isTutorialActive: true })

      store.getState().nextTutorialStep()
      expect(store.getState().tutorialStep).toBe(getRsaPracticeStep(stage))

      fillCorrectStage(store, stage)
      expect(store.getState().submitStage()).toBe(true)
      expect(store.getState().attempts).toBe(index + 1)
    }

    expect(store.getState()).toMatchObject({ phase: 'unlocking', tutorialStep: RSA_TUTORIAL_LAST_STEP, isTutorialActive: true })
    const unlocking = store.getState()
    store.getState().nextTutorialStep()
    store.getState().startTutorial()
    expect(store.getState()).toBe(unlocking)
    expect(store.getState().resolveVault()).toBe(true)
    expect(store.getState()).toMatchObject({ phase: 'vault-open', tutorialStep: 0, isTutorialActive: false })
    expect(store.getState().roundResults).toHaveLength(1)
    expect(recordProgress).not.toHaveBeenCalled()

    expect(store.getState().nextVault()).toBe(true)
    expect(store.getState()).toMatchObject({ vaultIndex: 1, stage: 'factor', tutorialStep: 0, isTutorialActive: false })
    store.getState().startTutorial()
    expect(store.getState().isTutorialActive).toBe(false)
  })

  it('keeps each guided stage after an error and provides corrective feedback', () => {
    const { store } = createTestStore()
    enterGuidedPractice(store)

    for (const [index, stage] of RSA_STAGES.entries()) {
      if (stage === 'factor') {
        store.getState().setInput('p', '2')
        store.getState().setInput('q', '5')
      } else if (stage === 'totient') {
        store.getState().setInput('totient', '7')
      } else if (stage === 'inverse') {
        store.getState().setInput('privateExponent', '2')
      } else {
        store.getState().setInput('message', 'ABC')
      }
      expect(store.getState().submitStage()).toBe(false)
      expect(store.getState()).toMatchObject({
        stage,
        tutorialStep: getRsaPracticeStep(stage),
        isTutorialActive: true,
        mistakes: index + 1,
        stageAttempts: 1,
        feedback: { kind: 'error' },
      })
      expect(store.getState().feedback?.detail.length).toBeGreaterThan(0)
      expect(store.getState().completedStages).toEqual(RSA_STAGES.slice(0, index))

      fillCorrectStage(store, stage)
      expect(store.getState().submitStage()).toBe(true)
    }
    expect(store.getState()).toMatchObject({ phase: 'unlocking', attempts: 8, mistakes: 4 })
  })

  it('accepts inverted primes during guided factorization', () => {
    const { store } = createTestStore()
    enterGuidedPractice(store)
    const challenge = store.getState().challenge
    store.getState().setInput('p', challenge.primeQ.toString())
    store.getState().setInput('q', challenge.primeP.toString())

    expect(store.getState().submitStage()).toBe(true)
    expect(store.getState()).toMatchObject({ stage: 'totient', tutorialStep: getRsaPracticeStep('totient'), mistakes: 0 })
  })

  it.each(RSA_STAGES)('preserves progress and answers when skipping during %s', (stage) => {
    let clock = 1_000
    const { store } = createTestStore(() => clock)
    enterGuidedPractice(store)
    for (const previous of RSA_STAGES.slice(0, RSA_STAGES.indexOf(stage))) {
      fillCorrectStage(store, previous)
      store.getState().submitStage()
    }
    fillCorrectStage(store, stage)
    const before = store.getState()
    clock = 2_000
    store.getState().skipTutorial()
    const after = store.getState()

    expect(after).toMatchObject({
      phase: before.phase,
      stage,
      isTutorialActive: false,
      tutorialStep: 0,
      attempts: before.attempts,
      mistakes: before.mistakes,
      score: before.score,
      startedAt: before.startedAt,
    })
    expect(after.inputs).toBe(before.inputs)
    expect(after.completedStages).toBe(before.completedStages)
    expect(after.feedback).toBe(before.feedback)
    expect(after.submitStage()).toBe(true)
  })

  it.each(RSA_STAGES)('reopens guidance at %s without resetting progress', (stage) => {
    const { store } = createTestStore()
    enterGuidedPractice(store)
    for (const previous of RSA_STAGES.slice(0, RSA_STAGES.indexOf(stage))) {
      fillCorrectStage(store, previous)
      store.getState().submitStage()
    }
    store.getState().skipTutorial()
    fillCorrectStage(store, stage)
    const before = store.getState()

    store.getState().startTutorial()
    expect(store.getState()).toMatchObject({ stage, tutorialStep: getRsaPracticeStep(stage), isTutorialActive: true, score: before.score })
    expect(store.getState().inputs).toBe(before.inputs)
    expect(store.getState().completedStages).toBe(before.completedStages)
    expect(store.getState().startedAt).toBe(before.startedAt)
    expect(store.getState().submitStage()).toBe(true)
  })

  it('reopens factorization practice without repeating the presentation or discarding typed factors', () => {
    const { store } = createTestStore()
    enterGuidedPractice(store)
    store.getState().setInput('p', '3')
    store.getState().skipTutorial()
    const before = store.getState()

    store.getState().startTutorial()
    expect(store.getState()).toMatchObject({ stage: 'factor', tutorialStep: getRsaPracticeStep('factor'), isTutorialActive: true })
    expect(store.getState().inputs).toBe(before.inputs)
    expect(store.getState().startedAt).toBe(before.startedAt)
    expect(store.getState().attempts).toBe(before.attempts)
  })

  it('restarts a partially completed guided vault with clean tutorial and run state', () => {
    const { store } = createTestStore()
    enterGuidedPractice(store)
    fillCorrectStage(store, 'factor')
    store.getState().submitStage()
    store.getState().restart()

    expect(store.getState()).toMatchObject({
      runId: 2,
      phase: 'playing',
      vaultIndex: 0,
      stage: 'factor',
      tutorialStep: 1,
      tutorialReviewStep: 0,
      isTutorialActive: true,
      startedAt: null,
      attempts: 0,
      mistakes: 0,
      score: 0,
      completedStages: [],
      inputs: { p: '', q: '', totient: '', privateExponent: '', message: '' },
    })
  })

  it('reviews the introduction without advancing its real step or starting the clock', () => {
    const { store } = createTestStore()
    store.getState().start()
    const firstStep = store.getState()
    store.getState().prevTutorialStep()
    expect(store.getState()).toBe(firstStep)

    store.getState().nextTutorialStep()
    store.getState().prevTutorialStep()
    expect(store.getState()).toMatchObject({ tutorialStep: 2, tutorialReviewStep: 1, startedAt: null })
    const firstReview = store.getState()
    store.getState().prevTutorialStep()
    expect(store.getState()).toBe(firstReview)

    store.getState().nextTutorialStep()
    expect(store.getState()).toMatchObject({ tutorialStep: 2, tutorialReviewStep: 0, startedAt: null })
    store.getState().nextTutorialStep()
    expect(store.getState()).toMatchObject({ tutorialStep: getRsaPracticeStep('factor'), tutorialReviewStep: 0, startedAt: 1_000 })
  })

  it('reviews completed stages without editing answers, resubmitting, or changing the current puzzle', () => {
    const { store, recordProgress } = createTestStore()
    enterGuidedPractice(store)
    for (const stage of ['factor', 'totient'] as const) {
      fillCorrectStage(store, stage)
      store.getState().submitStage()
    }
    store.getState().setInput('privateExponent', '2')
    store.getState().submitStage()
    const before = store.getState()

    store.getState().prevTutorialStep()
    store.getState().prevTutorialStep()
    expect(store.getState()).toMatchObject({
      stage: 'inverse',
      tutorialStep: getRsaPracticeStep('inverse'),
      tutorialReviewStep: getRsaPracticeStep('factor'),
      attempts: before.attempts,
      mistakes: before.mistakes,
      stageAttempts: before.stageAttempts,
      score: before.score,
      roundScore: before.roundScore,
      startedAt: before.startedAt,
    })
    expect(store.getState().inputs).toBe(before.inputs)
    expect(store.getState().completedStages).toBe(before.completedStages)
    expect(store.getState().feedback).toBe(before.feedback)

    const reviewing = store.getState()
    store.getState().setInput('p', '11')
    store.getState().setInput('privateExponent', '3')
    expect(store.getState().submitStage()).toBe(false)
    expect(store.getState()).toBe(reviewing)
    expect(recordProgress).not.toHaveBeenCalled()

    store.getState().nextTutorialStep()
    expect(store.getState().tutorialReviewStep).toBe(getRsaPracticeStep('totient'))
    store.getState().nextTutorialStep()
    expect(store.getState()).toMatchObject({ tutorialStep: getRsaPracticeStep('inverse'), tutorialReviewStep: 0 })
    const resumed = store.getState()
    store.getState().nextTutorialStep()
    expect(store.getState()).toBe(resumed)
    fillCorrectStage(store, 'inverse')
    expect(store.getState().submitStage()).toBe(true)
    expect(store.getState().attempts).toBe(before.attempts + 1)
  })

  it.each(['resumeTutorial', 'startTutorial'] as const)('returns directly to the current stage through %s without resetting the run', (action) => {
    let clock = 1_000
    const { store } = createTestStore(() => clock)
    enterGuidedPractice(store)
    fillCorrectStage(store, 'factor')
    store.getState().submitStage()
    store.getState().setInput('totient', '8')
    const before = store.getState()
    store.getState().prevTutorialStep()
    store.getState().prevTutorialStep()
    clock = 2_000
    store.getState()[action]()

    expect(store.getState()).toMatchObject({
      stage: 'totient',
      tutorialStep: getRsaPracticeStep('totient'),
      tutorialReviewStep: 0,
      isTutorialActive: true,
      attempts: before.attempts,
      mistakes: before.mistakes,
      score: before.score,
      startedAt: before.startedAt,
    })
    expect(store.getState().inputs).toBe(before.inputs)
    expect(store.getState().completedStages).toBe(before.completedStages)
    expect(store.getState().feedback).toBe(before.feedback)
    expect(store.getState().submitStage()).toBe(true)
  })

  it('skips while reviewing and reopens at the actual stage with all progress intact', () => {
    const { store } = createTestStore()
    enterGuidedPractice(store)
    fillCorrectStage(store, 'factor')
    store.getState().submitStage()
    store.getState().setInput('totient', '8')
    const before = store.getState()
    store.getState().prevTutorialStep()
    store.getState().skipTutorial()

    expect(store.getState()).toMatchObject({
      stage: 'totient',
      tutorialStep: 0,
      tutorialReviewStep: 0,
      isTutorialActive: false,
      score: before.score,
      startedAt: before.startedAt,
      attempts: before.attempts,
    })
    expect(store.getState().inputs).toBe(before.inputs)
    expect(store.getState().completedStages).toBe(before.completedStages)
    expect(store.getState().feedback).toBe(before.feedback)
    store.getState().startTutorial()
    expect(store.getState()).toMatchObject({ tutorialStep: getRsaPracticeStep('totient'), tutorialReviewStep: 0, isTutorialActive: true })
    expect(store.getState().submitStage()).toBe(true)
  })

  it.each(['restart', 'returnToIntro'] as const)('clears review state when using %s', (action) => {
    const { store } = createTestStore()
    enterGuidedPractice(store)
    store.getState().prevTutorialStep()
    expect(store.getState().tutorialReviewStep).toBeGreaterThan(0)
    store.getState()[action]()
    expect(store.getState().tutorialReviewStep).toBe(0)
    expect(store.getState().stage).toBe('factor')
    expect(store.getState().attempts).toBe(0)
  })

  it.each(['intro', 'unlocking', 'second-vault'] as const)('ignores review navigation in %s', (phase) => {
    const { store } = createTestStore()
    if (phase !== 'intro') {
      enterGuidedPractice(store)
      for (const stage of RSA_STAGES) {
        fillCorrectStage(store, stage)
        store.getState().submitStage()
      }
      if (phase === 'second-vault') {
        store.getState().resolveVault()
        store.getState().nextVault()
      }
    }
    const before = store.getState()
    store.getState().prevTutorialStep()
    store.getState().nextTutorialStep()
    store.getState().resumeTutorial()
    store.getState().startTutorial()
    expect(store.getState()).toBe(before)
    expect(store.getState().tutorialReviewStep).toBe(0)
  })

  it('keeps the submitted calculation unchanged while answers are edited and replaces it on the next submission', () => {
    const { store } = createTestStore()
    enterGuidedPractice(store)
    store.getState().setInput('p', '2')
    store.getState().setInput('q', '5')

    expect(store.getState().submitStage()).toBe(false)
    const errorFeedback = store.getState().feedback
    expect(errorFeedback?.learning).toMatchObject({ kind: 'error', stage: 'factor' })
    expect(errorFeedback?.learning?.equation).toContain('2 × 5 = 10')
    expect(store.getState()).toMatchObject({ stage: 'factor', attempts: 1, mistakes: 1, score: 0 })

    store.getState().setInput('p', '3')
    expect(store.getState().feedback).toBe(errorFeedback)
    expect(store.getState().feedback?.learning?.equation).toContain('2 × 5 = 10')

    expect(store.getState().submitStage()).toBe(true)
    expect(store.getState()).toMatchObject({ stage: 'totient', attempts: 2, mistakes: 1 })
    expect(store.getState().feedback).not.toBe(errorFeedback)
    expect(store.getState().feedback?.learning).toMatchObject({ kind: 'success', stage: 'factor' })
    expect(store.getState().feedback?.learning?.equation).toContain('3 × 5 = 15')
  })

  it('attaches corrective calculations to each failed stage without revealing unanswered results', () => {
    const { store } = createTestStore()
    enterGuidedPractice(store)

    for (const [index, stage] of RSA_STAGES.entries()) {
      if (stage === 'factor') {
        store.getState().setInput('p', '2')
        store.getState().setInput('q', '5')
      } else if (stage === 'totient') {
        store.getState().setInput('totient', '7')
      } else if (stage === 'inverse') {
        store.getState().setInput('privateExponent', '2')
      } else {
        store.getState().setInput('message', 'ABC')
      }

      expect(store.getState().submitStage()).toBe(false)
      const learning = store.getState().feedback?.learning
      expect(learning).toMatchObject({ kind: 'error', stage })
      expect(learning?.title).toBe(store.getState().feedback?.title)
      expect(learning?.detail).toBe(store.getState().feedback?.detail)
      expect(learning?.equation.length).toBeGreaterThan(0)
      expect(learning?.instruction.length).toBeGreaterThan(0)
      expect(store.getState()).toMatchObject({ stage, attempts: index * 2 + 1, mistakes: index + 1 })

      if (stage === 'totient') {
        expect(learning?.equation).toMatch(/3\s*−\s*1/)
        expect(learning?.equation).toMatch(/5\s*−\s*1/)
        expect(learning?.equation).not.toMatch(/=\s*8\b/)
      } else if (stage === 'inverse') {
        expect(learning?.equation).toContain('3 × 2 = 6')
        expect(learning?.equation).toMatch(/resto\s*6/i)
        expect(learning?.instruction).not.toMatch(/d\s*=\s*3\b/)
      } else if (stage === 'decrypt') {
        expect(JSON.stringify(learning)).not.toContain(store.getState().challenge.message)
        expect(learning?.equation).not.toContain('7, 5, 13')
      }

      fillCorrectStage(store, stage)
      expect(store.getState().submitStage()).toBe(true)
      expect(store.getState().feedback?.learning).toMatchObject({ kind: 'success', stage })
    }

    expect(store.getState()).toMatchObject({ phase: 'unlocking', attempts: 8, mistakes: 4 })
  })

  it('preserves the learning snapshot while reviewing, skipping, and reopening guidance', () => {
    const { store } = createTestStore()
    enterGuidedPractice(store)
    fillCorrectStage(store, 'factor')
    expect(store.getState().submitStage()).toBe(true)
    const before = store.getState()
    const feedback = before.feedback
    expect(feedback?.learning).toMatchObject({ kind: 'success', stage: 'factor' })

    store.getState().prevTutorialStep()
    const reviewing = store.getState()
    store.getState().setInput('totient', '8')
    expect(store.getState().submitStage()).toBe(false)
    expect(store.getState()).toBe(reviewing)
    expect(store.getState().feedback).toBe(feedback)
    store.getState().resumeTutorial()
    store.getState().skipTutorial()
    store.getState().startTutorial()

    expect(store.getState().feedback).toBe(feedback)
    expect(store.getState()).toMatchObject({ stage: 'totient', attempts: before.attempts, score: before.score })
  })

  it('provides learning feedback after skipping the first vault tutorial and does not carry it into later vaults', () => {
    const { store } = createTestStore()
    store.getState().start()
    store.getState().skipTutorial()
    for (const stage of RSA_STAGES) {
      fillCorrectStage(store, stage)
      expect(store.getState().submitStage()).toBe(true)
      expect(store.getState().feedback?.learning).toMatchObject({ kind: 'success', stage })
    }

    expect(store.getState().resolveVault()).toBe(true)
    expect(store.getState().feedback?.learning).toBeUndefined()
    expect(store.getState().nextVault()).toBe(true)
    expect(store.getState().feedback?.learning).toBeUndefined()
    fillCorrectStage(store, 'factor')
    expect(store.getState().submitStage()).toBe(true)
    expect(store.getState().feedback?.kind).toBe('success')
    expect(store.getState().feedback?.learning).toBeUndefined()
  })

  it.each(['restart', 'returnToIntro'] as const)('clears a learning snapshot when using %s', (action) => {
    const { store } = createTestStore()
    enterGuidedPractice(store)
    store.getState().submitStage()
    expect(store.getState().feedback?.learning).toMatchObject({ kind: 'error', stage: 'factor' })

    store.getState()[action]()
    expect(store.getState().feedback?.learning).toBeUndefined()
    expect(store.getState().attempts).toBe(0)
  })

})
