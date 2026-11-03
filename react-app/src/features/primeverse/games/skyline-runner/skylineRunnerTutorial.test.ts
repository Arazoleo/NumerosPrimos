import { describe, expect, it } from 'vitest'

import { getSkylineTutorialCopy, SKYLINE_TUTORIAL_COPY } from './skylineRunnerTutorial'

describe('Skyline Runner tutorial copy', () => {
  it('defines one target and message for every step', () => {
    expect(Object.keys(SKYLINE_TUTORIAL_COPY)).toHaveLength(5)

    for (let step = 1; step <= 5; step += 1) {
      const copy = getSkylineTutorialCopy(step as 1 | 2 | 3 | 4 | 5)
      expect(copy?.target).toBeTruthy()
      expect(copy?.title.length).toBeGreaterThanOrEqual(5)
      expect(copy?.body.length).toBeLessThan(260)
      expect(copy?.body).not.toMatch(/undefined|null/)
    }
  })

  it('returns no copy for the inactive tutorial step', () => {
    expect(getSkylineTutorialCopy(0)).toBeNull()
  })

  it('maps interactive tutorial steps to the intended controls', () => {
    expect(getSkylineTutorialCopy(1)?.target).toBe('sprint')
    expect(getSkylineTutorialCopy(2)?.target).toBe('jump')
    expect(getSkylineTutorialCopy(3)?.target).toBe('hook')
    expect(getSkylineTutorialCopy(4)?.target).toBe('prime-core')
    expect(getSkylineTutorialCopy(5)?.target).toBe('sentinel')
  })

  it('explains the primeverse core rule in step 4', () => {
    const step4 = getSkylineTutorialCopy(4)
    expect(step4?.body).toMatch(/primo/i)
    expect(step4?.body).toMatch(/composto/i)
  })

  it('specifies pressing the F key to fire in step 5', () => {
    const step5 = getSkylineTutorialCopy(5)
    expect(step5?.body).toMatch(/pressione F|F/i)
    expect(step5?.hint).toMatch(/F/i)
  })
})