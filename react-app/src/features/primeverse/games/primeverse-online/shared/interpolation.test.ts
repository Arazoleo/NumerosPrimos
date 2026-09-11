import { describe, expect, it } from 'vitest'

import {
  SnapshotBuffer,
  interpolateSnapshot,
  interpolateYaw,
  lerpVec3,
  type RemoteTransformSnapshot,
} from './interpolation'

function snapshot(
  sequence: number,
  serverTime: number,
  x: number,
  yaw = 0,
): RemoteTransformSnapshot {
  return {
    position: { x, y: 1, z: 0 },
    yaw,
    animation: x === 0 ? 'idle' : 'run',
    sequence,
    serverTime,
  }
}

describe('framework-neutral snapshot interpolation', () => {
  it('lerps positions and clamps alpha without importing Three.js', () => {
    expect(lerpVec3({ x: 0, y: 2, z: 4 }, { x: 10, y: 4, z: 0 }, 0.25)).toEqual({
      x: 2.5,
      y: 2.5,
      z: 3,
    })
    expect(lerpVec3({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, 2)).toEqual({
      x: 1,
      y: 1,
      z: 1,
    })
  })

  it('interpolates yaw across the PI seam on the shortest path', () => {
    const from = 170 * Math.PI / 180
    const to = -170 * Math.PI / 180
    const midpoint = interpolateYaw(from, to, 0.5)
    expect(Math.abs(midpoint)).toBeCloseTo(Math.PI, 8)

    const result = interpolateSnapshot(snapshot(1, 100, 0, from), snapshot(2, 200, 10, to), 150)
    expect(result.position.x).toBe(5)
    expect(Math.abs(result.yaw)).toBeCloseTo(Math.PI, 8)
    expect(result.animation).toBe('run')
  })

  it('uses the configured 50-100ms delayed render timeline', () => {
    const buffer = new SnapshotBuffer(80)
    buffer.add(snapshot(1, 1_000, 0))
    buffer.add(snapshot(2, 1_100, 10))
    expect(buffer.sample(1_130)).toMatchObject({
      position: { x: 5, y: 1, z: 0 },
      sampledAt: 1_050,
    })
    expect(() => new SnapshotBuffer(49)).toThrow(RangeError)
    expect(() => new SnapshotBuffer(101)).toThrow(RangeError)
  })

  it('sorts out-of-order input, replaces duplicate sequences and caps memory', () => {
    const buffer = new SnapshotBuffer(50, 3)
    expect(buffer.add(snapshot(2, 200, 20))).toBe(true)
    expect(buffer.add(snapshot(1, 100, 10))).toBe(true)
    expect(buffer.add(snapshot(2, 190, 99))).toBe(false)
    expect(buffer.add(snapshot(2, 210, 21))).toBe(true)
    buffer.add(snapshot(3, 300, 30))
    buffer.add(snapshot(4, 400, 40))
    expect(buffer.size).toBe(3)
    expect(buffer.latest).toMatchObject({ sequence: 4, position: { x: 40 } })
  })

  it('holds trustworthy endpoints instead of extrapolating through packet gaps', () => {
    const buffer = new SnapshotBuffer(50)
    expect(buffer.sample(1_000)).toBeNull()
    buffer.add(snapshot(1, 1_000, 4))
    expect(buffer.sample(900)).toMatchObject({ position: { x: 4 } })
    expect(buffer.sample(5_000)).toMatchObject({ position: { x: 4 } })
    buffer.clear()
    expect(buffer.size).toBe(0)
    expect(buffer.sample(5_000)).toBeNull()
  })
})
