import { describe, expect, it } from 'vitest'

import { HERO_CLASS_IDS, getHeroClass } from './heroClassSystem'
import { heroBodyRects, shade, type HeroBodyPose } from './heroSpriteBody'

const IDLE: HeroBodyPose = {
  time: 0, moving: false, attacking: false, dashing: false, casting: false, ascended: false,
}

describe('hero sprite bodies', () => {
  it('builds a detailed, bounded sprite for every hero', () => {
    for (const heroClassId of HERO_CLASS_IDS) {
      const rects = heroBodyRects(getHeroClass(heroClassId), 'down', IDLE)
      expect(rects.length).toBeGreaterThan(35)
      for (const rect of rects) {
        expect(rect.w).toBeGreaterThan(0)
        expect(rect.h).toBeGreaterThan(0)
        expect(rect.x).toBeGreaterThanOrEqual(-24)
        expect(rect.x + rect.w).toBeLessThanOrEqual(24)
        expect(rect.y).toBeGreaterThanOrEqual(-30)
        expect(rect.y + rect.h).toBeLessThanOrEqual(16)
        expect(rect.color).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })

  it('hides face details when facing away and mirrors when facing left', () => {
    const hero = getHeroClass('prime-warrior')
    const front = heroBodyRects(hero, 'down', IDLE)
    const back = heroBodyRects(hero, 'up', IDLE)
    expect(back.length).toBeLessThan(front.length)

    const right = heroBodyRects(hero, 'right', IDLE)
    const left = heroBodyRects(hero, 'left', IDLE)
    const mirrored = new Set(left.map((r) => `${r.x},${r.y},${r.w},${r.h},${r.color}`))
    for (const rect of right) {
      expect(mirrored.has(`${-rect.x - rect.w},${rect.y},${rect.w},${rect.h},${rect.color}`)).toBe(true)
    }
  })

  it('animates: walking stride and signature details change over time', () => {
    const hero = getHeroClass('goldbach-berserker')
    const still = JSON.stringify(heroBodyRects(hero, 'down', IDLE))
    const later = JSON.stringify(heroBodyRects(hero, 'down', { ...IDLE, time: 900 }))
    expect(later).not.toBe(still)
    const walking = JSON.stringify(heroBodyRects(hero, 'down', { ...IDLE, moving: true, time: 100 }))
    expect(walking).not.toBe(still)
  })

  it('shades colors without leaving hex space', () => {
    expect(shade('#808080', 50) > '#808080').toBe(true)
    expect(shade('#808080', -50) < '#808080').toBe(true)
    expect(shade('#ffffff', 40)).toBe('#ffffff')
    expect(shade('#000000', -40)).toBe('#000000')
  })
})
