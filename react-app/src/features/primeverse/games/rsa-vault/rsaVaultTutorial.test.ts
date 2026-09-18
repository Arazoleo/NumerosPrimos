import { describe, expect, it } from 'vitest'

import { getRsaTutorialCopy, RSA_TUTORIAL_COPY } from './rsaVaultTutorial'

describe('RSA Vault tutorial copy', () => {
  it('contains one target and message for each playable step', () => {
    expect(Object.keys(RSA_TUTORIAL_COPY)).toHaveLength(7)
    for (let step = 1; step <= 7; step += 1) {
      const copy = getRsaTutorialCopy(step as 1 | 2 | 3 | 4 | 5 | 6 | 7)
      expect(copy?.target).toBeTruthy()
      expect(copy?.title).toBeTruthy()
      expect(copy?.body).toBeTruthy()
    }
  })

  it('returns no copy for the inactive step', () => {
    expect(getRsaTutorialCopy(0)).toBeNull()
  })
})