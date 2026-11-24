import { describe, expect, it } from 'vitest'

import { getRsaPracticeStep, getRsaTutorialCopy, RSA_TUTORIAL_COPY } from './rsaVaultTutorial'
import { RSA_TUTORIAL_LAST_STEP, type RsaTutorialStep } from './types'

describe('RSA Vault tutorial copy', () => {
  it('defines one target and message for every step', () => {
    expect(Object.keys(RSA_TUTORIAL_COPY)).toHaveLength(RSA_TUTORIAL_LAST_STEP)

    for (let step = 1; step <= RSA_TUTORIAL_LAST_STEP; step += 1) {
      const copy = getRsaTutorialCopy(step as RsaTutorialStep)
      expect(copy?.target).toBeTruthy()
      expect(copy?.title.length).toBeGreaterThan(5)
      expect(copy?.body.length).toBeLessThan(260)
      expect(copy?.body).not.toMatch(/undefined|null/)
    }
  })

  it('returns no copy for the inactive tutorial step', () => {
    expect(getRsaTutorialCopy(0)).toBeNull()
  })

  it('maps presentation and practice to the intended controls', () => {
    expect(getRsaTutorialCopy(1)?.target).toBe('public-key')
    expect(getRsaTutorialCopy(2)?.target).toBe('stage-rail')
    expect(getRsaTutorialCopy(3)?.target).toBe('factor-pair')
    expect(getRsaTutorialCopy(4)?.target).toBe('totient')
    expect(getRsaTutorialCopy(5)?.target).toBe('private-exponent')
    expect(getRsaTutorialCopy(6)?.target).toBe('workbench')
  })

  it('starts guided practice immediately after two introductory steps', () => {
    for (const step of [1, 2] as const) {
      expect(getRsaTutorialCopy(step)?.advance).toEqual({ kind: 'manual' })
    }
    expect(getRsaPracticeStep('factor')).toBe(3)

    expect(getRsaTutorialCopy(3)).toMatchObject({
      target: 'factor-pair', advance: { kind: 'stage-correct', stage: 'factor' },
    })
    expect(getRsaTutorialCopy(4)).toMatchObject({
      target: 'totient', advance: { kind: 'stage-correct', stage: 'totient' },
    })
    expect(getRsaTutorialCopy(5)).toMatchObject({
      target: 'private-exponent', advance: { kind: 'stage-correct', stage: 'inverse' },
    })
    expect(getRsaTutorialCopy(6)).toMatchObject({
      target: 'workbench', advance: { kind: 'stage-correct', stage: 'decrypt' },
    })
  })

  it('teaches controls during their use instead of promising later practice', () => {
    for (const copy of Object.values(RSA_TUTORIAL_COPY)) {
      expect(copy.body).not.toMatch(/preencherá|ainda está desativado|por enquanto/i)
    }
  })

  it('uses touch-friendly instructions on coarse-pointer devices', () => {
    expect(getRsaTutorialCopy(getRsaPracticeStep('factor'), true)?.body).toContain('toque em "Acoplar primos"')
    expect(getRsaTutorialCopy(getRsaPracticeStep('decrypt'), true)?.body).toContain('Toque nos blocos')
    for (let step = 1; step <= RSA_TUTORIAL_LAST_STEP; step += 1) {
      const copy = getRsaTutorialCopy(step as RsaTutorialStep, true)
      expect(copy?.body).not.toMatch(/\bclique\b/i)
      expect(copy?.hint ?? '').not.toMatch(/\bclique\b/i)
    }
  })
})
