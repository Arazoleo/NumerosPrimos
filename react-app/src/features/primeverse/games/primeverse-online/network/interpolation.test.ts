import { describe, expect, it } from 'vitest'

import type { PlayerSnapshot } from '../shared/protocol'
import { RemoteInterpolationBuffer } from './interpolation'

const INITIAL_PLAYER: PlayerSnapshot = {
  id: 'player-1',
  nickname: 'Euclides',
  activityId: 'nexus',
  runId: null,
  position: { x: 0, y: 0.04, z: 0 },
  yaw: Math.PI - 0.1,
  animation: 'idle',
  appearance: { bodyColor: '#172b3a', accentColor: '#5ceee5', visorColor: '#f0c35a' },
  emote: null,
  sequence: 0,
  updatedAt: 1_000,
}

describe('RemoteInterpolationBuffer adapter', () => {
  it('delegates delayed interpolation to the shared snapshot buffer and returns tuples', () => {
    const buffer = new RemoteInterpolationBuffer(INITIAL_PLAYER)
    buffer.push({
      position: [10, 0.04, -4],
      yaw: -Math.PI + 0.1,
      animation: 'run',
      sequence: 1,
      serverTime: 1_100,
    })

    const sampled = buffer.sample(1_140)

    expect(sampled?.position).toEqual([5, 0.04, -2])
    expect(Math.abs(sampled?.yaw ?? 0)).toBeCloseTo(Math.PI, 5)
    expect(sampled?.animation).toBe('run')
    expect(sampled?.serverTime).toBe(1_050)
    expect(sampled?.sequence).toBe(1)
  })

  it('clears all buffered poses', () => {
    const buffer = new RemoteInterpolationBuffer(INITIAL_PLAYER)
    buffer.clear()
    expect(buffer.sample(2_000)).toBeNull()
  })

  it('snaps across portal travel instead of interpolating an avatar through the void', () => {
    const buffer = new RemoteInterpolationBuffer(INITIAL_PLAYER)
    buffer.push({
      position: [72, 0.04, 10],
      yaw: 0,
      animation: 'idle',
      sequence: 1,
      serverTime: 1_100,
    })

    expect(buffer.sample(1_140)?.position).toEqual([72, 0.04, 10])
  })

  it('also snaps on large vertical discontinuities between floors', () => {
    const buffer = new RemoteInterpolationBuffer(INITIAL_PLAYER)
    buffer.push({
      position: [0, 24, 0],
      yaw: 0,
      animation: 'idle',
      sequence: 1,
      serverTime: 1_100,
    })

    expect(buffer.sample(1_140)?.position).toEqual([0, 24, 0])
  })
})
