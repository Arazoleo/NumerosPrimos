import { describe, expect, it } from 'vitest'

import { HERO_CLASS_IDS } from './heroClassSystem'
import { carouselHeroClassId } from './PrimeboundClassSelect'

describe('Primebound character carousel', () => {
  it('moves through every hero in canonical roster order', () => {
    for (const [index, heroClassId] of HERO_CLASS_IDS.entries()) {
      expect(carouselHeroClassId(heroClassId, 1)).toBe(
        HERO_CLASS_IDS[(index + 1) % HERO_CLASS_IDS.length],
      )
    }
  })

  it('wraps backward from the first hero to the last', () => {
    expect(carouselHeroClassId(HERO_CLASS_IDS[0], -1)).toBe(
      HERO_CLASS_IDS[HERO_CLASS_IDS.length - 1],
    )
  })

  it('supports full-lap and multi-step navigation', () => {
    expect(carouselHeroClassId('rsa-cryptographer', HERO_CLASS_IDS.length)).toBe(
      'rsa-cryptographer',
    )
    expect(carouselHeroClassId('prime-warrior', 3)).toBe('mersenne-arcanist')
  })
})
