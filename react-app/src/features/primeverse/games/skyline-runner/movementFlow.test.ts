import { describe, expect, it } from 'vitest'

import {
  FLOW_FOV_BONUS,
  IDLE_SLIDE,
  SLIDE_BOOST,
  SLIDE_MAX_MS,
  SLIDE_MIN_SPEED,
  calculateWallJump,
  detectMantleLedge,
  flowFieldOfView,
  flowSpeedMultiplier,
  updateFlow,
  updateSlide,
} from './movementFlow'
import type { Aabb } from './types'

const base = {
  flow: 0,
  deltaSeconds: 0.1,
  grounded: false,
  horizontalSpeed: 12,
  wallRunning: false,
  grappling: false,
  sliding: false,
}

describe('Skyline Runner flow meter', () => {
  it('fills while the run keeps moving and drains when it stalls', () => {
    expect(updateFlow({ ...base, wallRunning: true })).toBeGreaterThan(0)
    expect(updateFlow({ ...base, grappling: true, flow: 0.5 })).toBeGreaterThan(0.5)
    expect(updateFlow({ ...base, flow: 0.5, grounded: true, horizontalSpeed: 0 })).toBeLessThan(0.5)
    // Sprinting on a rooftop holds flow, it does not build it as fast as airtime.
    const running = updateFlow({ ...base, flow: 0.5, grounded: true, horizontalSpeed: 12 })
    const flying = updateFlow({ ...base, flow: 0.5 })
    expect(running).toBeGreaterThan(0.5)
    expect(flying).toBeGreaterThan(running)
  })

  it('stays inside 0..1 and survives broken input', () => {
    expect(updateFlow({ ...base, flow: 1, wallRunning: true })).toBe(1)
    expect(updateFlow({ ...base, flow: 0, grounded: true, horizontalSpeed: 0 })).toBe(0)
    expect(updateFlow({ ...base, deltaSeconds: Number.NaN, flow: 0.4 })).toBe(0.4)
    expect(updateFlow({ ...base, flow: 0.2, trickBonus: 0.3 })).toBeGreaterThan(0.5)
  })

  it('converts flow into speed and field of view', () => {
    expect(flowSpeedMultiplier(0)).toBe(1)
    expect(flowSpeedMultiplier(1)).toBeGreaterThan(1.3)
    expect(flowFieldOfView(75, 0)).toBe(75)
    expect(flowFieldOfView(75, 1)).toBe(75 + FLOW_FOV_BONUS)
  })
})

describe('Skyline Runner slide', () => {
  const slideBase = {
    state: IDLE_SLIDE,
    wantsSlide: true,
    grounded: true,
    horizontalSpeed: 11,
    nowMs: 1_000,
  }

  it('only starts from a real run and boosts once', () => {
    const started = updateSlide(slideBase)
    expect(started.started).toBe(true)
    expect(started.boost).toBe(SLIDE_BOOST)
    expect(started.cameraHeightScale).toBeLessThan(1)

    const tooSlow = updateSlide({ ...slideBase, horizontalSpeed: SLIDE_MIN_SPEED - 0.1 })
    expect(tooSlow.started).toBe(false)
    expect(tooSlow.boost).toBe(0)

    const sustained = updateSlide({ ...slideBase, state: started.state, nowMs: 1_400 })
    expect(sustained.boost).toBe(0)
    expect(sustained.ended).toBe(false)
  })

  it('ends on release, on takeoff, when it stalls or when it times out', () => {
    const active = updateSlide(slideBase).state
    expect(updateSlide({ ...slideBase, state: active, wantsSlide: false }).ended).toBe(true)
    expect(updateSlide({ ...slideBase, state: active, grounded: false }).ended).toBe(true)
    expect(updateSlide({ ...slideBase, state: active, horizontalSpeed: 1 }).ended).toBe(true)
    expect(updateSlide({ ...slideBase, state: active, nowMs: 1_000 + SLIDE_MAX_MS }).ended).toBe(true)
  })
})

describe('Skyline Runner ledge mantle', () => {
  const ledge: Aabb = { min: { x: 2, y: 0, z: -2 }, max: { x: 6, y: 4, z: 2 } }
  const mantleBase = {
    position: { x: 1.2, y: 4.2, z: 0 },
    velocity: { x: 3, y: -2, z: 0 },
    facing: { x: 1, y: 0, z: 0 },
    playerRadius: 0.4,
    playerHalfHeight: 0.9,
    platforms: [ledge],
  }

  it('pulls the runner onto a ledge between waist and head height', () => {
    const result = detectMantleLedge(mantleBase)
    expect(result).not.toBeNull()
    expect(result?.ledgeY).toBe(4)
    expect(result?.target.y).toBeCloseTo(4.9)
    expect(result?.climbHeight).toBeCloseTo(0.7)
  })

  it('refuses ledges that are too high, too low, behind, or already cleared', () => {
    expect(detectMantleLedge({ ...mantleBase, position: { x: 1.2, y: 8, z: 0 } })).toBeNull()
    expect(detectMantleLedge({ ...mantleBase, position: { x: 1.2, y: 1, z: 0 } })).toBeNull()
    expect(detectMantleLedge({ ...mantleBase, facing: { x: -1, y: 0, z: 0 } })).toBeNull()
    // Rising fast: the runner is jumping over it, not grabbing it.
    expect(detectMantleLedge({ ...mantleBase, velocity: { x: 3, y: 6, z: 0 } })).toBeNull()
    expect(detectMantleLedge({ ...mantleBase, facing: { x: 0, y: 1, z: 0 } })).toBeNull()
  })

  it('refuses a ledge with a ceiling sitting on top of it', () => {
    const ceiling: Aabb = { min: { x: 2, y: 4.2, z: -2 }, max: { x: 6, y: 8, z: 2 } }
    expect(detectMantleLedge({ ...mantleBase, platforms: [ledge, ceiling] })).toBeNull()
  })
})

describe('Skyline Runner wall jump', () => {
  it('throws the runner off the wall and towards the look direction, scaled by flow', () => {
    const cold = calculateWallJump({
      velocity: { x: 0, y: 0, z: 0 },
      wallNormal: { x: 1, y: 0, z: 0 },
      facing: { x: 0, y: 0, z: -1 },
      flow: 0,
    })
    const hot = calculateWallJump({
      velocity: { x: 0, y: 0, z: 0 },
      wallNormal: { x: 1, y: 0, z: 0 },
      facing: { x: 0, y: 0, z: -1 },
      flow: 1,
    })

    expect(cold.x).toBeCloseTo(7.2)
    expect(cold.z).toBeCloseTo(0)
    expect(hot.z).toBeLessThan(-2)
    expect(hot.y).toBeGreaterThan(cold.y)
  })
})
