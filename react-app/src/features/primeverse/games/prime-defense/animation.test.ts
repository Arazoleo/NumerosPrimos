import { describe, expect, it } from 'vitest'

import {
  DEFENSE_REDUCED_TRAVEL_DURATION_MS,
  DEFENSE_TRAVEL_DURATION_MS,
  getDefenseTravelDuration,
} from './animation'

describe('Prime Defense animation timing', () => {
  it('uses a much shorter but non-zero reduced-motion transition', () => {
    expect(getDefenseTravelDuration(false)).toBe(DEFENSE_TRAVEL_DURATION_MS)
    expect(getDefenseTravelDuration(true)).toBe(DEFENSE_REDUCED_TRAVEL_DURATION_MS)
    expect(DEFENSE_REDUCED_TRAVEL_DURATION_MS).toBeGreaterThan(0)
    expect(DEFENSE_REDUCED_TRAVEL_DURATION_MS).toBeLessThan(DEFENSE_TRAVEL_DURATION_MS)
  })
})

