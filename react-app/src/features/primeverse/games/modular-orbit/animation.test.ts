import { describe, expect, it } from 'vitest'

import {
  getOrbitLaunchDuration,
  getOrbitTravelDuration,
  ORBIT_HOP_DURATION_MS,
  ORBIT_LAUNCH_SETTLE_MS,
  ORBIT_MAX_LAUNCH_MS,
} from './animation'

describe('Modular Orbit animation timing', () => {
  it('gives short routes enough time to show every hop', () => {
    expect(getOrbitLaunchDuration(5)).toBe(
      4 * ORBIT_HOP_DURATION_MS + ORBIT_LAUNCH_SETTLE_MS,
    )
    expect(getOrbitTravelDuration(5)).toBe(4 * ORBIT_HOP_DURATION_MS)
  })

  it('caps intentionally long guesses so the game does not stall', () => {
    expect(getOrbitLaunchDuration(100)).toBe(ORBIT_MAX_LAUNCH_MS)
  })

  it('settles immediately when reduced motion is requested', () => {
    expect(getOrbitLaunchDuration(100, true)).toBe(240)
    expect(getOrbitTravelDuration(100, true)).toBe(1)
  })
})
