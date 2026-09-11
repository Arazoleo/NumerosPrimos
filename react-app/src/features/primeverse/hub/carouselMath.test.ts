import { describe, expect, it } from 'vitest'
import {
  carouselStep,
  dragPixelsToAngle,
  nearestEquivalentAngle,
  pixelsPerCarouselStep,
  resolveCarouselDrag,
  wrapCarouselIndex,
} from './carouselMath'

describe('carouselMath', () => {
  it('wraps indexes in both directions', () => {
    expect(wrapCarouselIndex(8, 8)).toBe(0)
    expect(wrapCarouselIndex(-1, 8)).toBe(7)
    expect(wrapCarouselIndex(17, 8)).toBe(1)
  })

  it('returns safe defaults for an empty carousel', () => {
    expect(wrapCarouselIndex(4, 0)).toBe(0)
    expect(carouselStep(0)).toBe(0)
  })

  it('chooses the shortest equivalent angle across a full turn', () => {
    const current = Math.PI * 1.9
    const target = 0
    expect(nearestEquivalentAngle(target, current) - current).toBeCloseTo(Math.PI * .1)
  })

  it('keeps drag sensitivity usable from phone to desktop widths', () => {
    expect(pixelsPerCarouselStep(320)).toBe(88)
    expect(pixelsPerCarouselStep(2000)).toBe(180)
    expect(dragPixelsToAngle(-88, 320, 8)).toBeCloseTo(-Math.PI / 4)
  })

  it('treats a tap as no rotation', () => {
    expect(resolveCarouselDrag({ deltaX: 5, velocityX: .05, viewportWidth: 800 })).toBe(0)
    expect(resolveCarouselDrag({ deltaX: 1, velocityX: .4, viewportWidth: 800 })).toBe(0)
  })

  it('maps left and right drags to the adjacent game', () => {
    expect(resolveCarouselDrag({ deltaX: -120, velocityX: 0, viewportWidth: 800 })).toBe(1)
    expect(resolveCarouselDrag({ deltaX: 120, velocityX: 0, viewportWidth: 800 })).toBe(-1)
  })

  it('uses flick velocity but caps excessive movement', () => {
    expect(resolveCarouselDrag({ deltaX: -10, velocityX: -1, viewportWidth: 800 })).toBe(1)
    expect(resolveCarouselDrag({ deltaX: -1000, velocityX: -4, viewportWidth: 800 })).toBe(3)
  })
})
