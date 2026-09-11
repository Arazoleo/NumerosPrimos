import { describe, expect, it } from 'vitest'

import {
  CIPHER_TEAM_COLOR,
  FRACTURE_TEAM_COLOR,
  powerEffectPalette,
} from './Nucleus257Effects'

describe('Núcleo 257 power readability', () => {
  it('keeps each mechanic visually recognisable', () => {
    expect(powerEffectPalette('sieve-field')).not.toEqual(powerEffectPalette('rsa-barrier'))
    expect(powerEffectPalette('twin-conjecture')).not.toEqual(powerEffectPalette('shared-secret'))
  })

  it('uses an invariant team signal around class-specific colors', () => {
    const friendly = powerEffectPalette('public-key-decoy', 'cipher')
    const hostile = powerEffectPalette('public-key-decoy', 'fracture')

    expect(friendly.highlight).toBe(CIPHER_TEAM_COLOR)
    expect(hostile.primary).toBe(FRACTURE_TEAM_COLOR)
    expect(hostile.highlight).toBe(powerEffectPalette('public-key-decoy').primary)
  })
})
