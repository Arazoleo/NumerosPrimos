import { describe, expect, it } from 'vitest'

import { getRsaTutorialCopy, RSA_TUTORIAL_COPY } from './rsaVaultTutorial'

describe('RSA Vault tutorial copy', () => {
  it('defines one target and message for every step', () => {
    expect(Object.keys(RSA_TUTORIAL_COPY)).toHaveLength(7)

    for (let step = 1; step <= 7; step += 1) {
      const copy = getRsaTutorialCopy(step as 1 | 2 | 3 | 4 | 5 | 6 | 7)
      expect(copy?.target).toBeTruthy()
      expect(copy?.title.length).toBeGreaterThan(5)
      expect(copy?.body.length).toBeLessThan(260)
      expect(copy?.body).not.toMatch(/undefined|null/)
    }
  })

  it('returns no copy for the inactive tutorial step', () => {
    expect(getRsaTutorialCopy(0)).toBeNull()
  })
})